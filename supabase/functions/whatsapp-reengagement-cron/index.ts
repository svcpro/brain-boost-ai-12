// ═══════════════════════════════════════════════════════════════════
// WhatsApp Re-engagement Cron (MSG91 Marketing API)
// Scans inactive users (never-signed-in, 24h, 3d, 7d) and sends an
// AI-generated WhatsApp nudge via the existing whatsapp-notify pipeline.
// Idempotent: dedup via whatsapp_reengagement_log per (user_id, tier).
// ═══════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type Tier = "never_signed_in" | "inactive_24h" | "inactive_3d" | "inactive_7d";

// Inactivity tier → MSG91 approved template name
// Both templates accept a single {{customer_name}} body parameter.
const TIER_MSG91_TEMPLATE: Record<Tier, string> = {
  never_signed_in: "re_engagement_message",
  inactive_24h: "re_enguage_two",
  inactive_3d: "re_enguage_two",
  inactive_7d: "re_enguage_two",
};

const TIER_CATEGORY: Record<Tier, string> = {
  never_signed_in: "engagement",
  inactive_24h: "engagement",
  inactive_3d: "engagement",
  inactive_7d: "engagement",
};

// Minimum hours between re-sends for the same tier (dedup window)
const TIER_COOLDOWN_HOURS: Record<Tier, number> = {
  never_signed_in: 72,
  inactive_24h: 72,
  inactive_3d: 96,
  inactive_7d: 168,
};

async function generateAIMessage(
  tier: Tier,
  user: { display_name?: string | null; exam_type?: string | null; days_inactive: number },
): Promise<{ headline: string; body: string }> {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  const name = user.display_name?.split(" ")[0] || "Champion";
  const exam = user.exam_type || "your exam";

  const fallback = {
    never_signed_in: {
      headline: `${name}, your ACRY brain is ready`,
      body: `Your personalized ${exam} plan is waiting. 2 minutes today = 1 week ahead.`,
    },
    inactive_24h: {
      headline: `${name}, don't break the rhythm`,
      body: `One quick 3-minute session keeps your ${exam} momentum alive.`,
    },
    inactive_3d: {
      headline: `${name}, your rank is slipping`,
      body: `3 days off the grid. Top rankers fight back today — your ${exam} brain misses you.`,
    },
    inactive_7d: {
      headline: `${name}, last call from ACRY`,
      body: `7 days silent. Your forgetting curve is steep. Open the app and we'll rebuild instantly.`,
    },
  }[tier];

  if (!LOVABLE_API_KEY) return fallback;

  const prompt = `You are ACRY AI, a study coach for Indian exam aspirants. Generate a WhatsApp re-engagement nudge.
User: ${name} | Exam: ${exam} | Inactive: ${user.days_inactive} day(s) | Tier: ${tier}
Rules: Warm, urgent, no clichés. Use first name. Mention exam. Max 1 emoji.
Return ONLY JSON: {"headline":"<= 60 chars","body":"<= 140 chars"}`;

  try {
    const r = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash-lite",
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!r.ok) return fallback;
    const data = await r.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?|```/g, "").trim();
    const parsed = JSON.parse(cleaned);
    return {
      headline: String(parsed.headline || fallback.headline).slice(0, 80),
      body: String(parsed.body || fallback.body).slice(0, 160),
    };
  } catch {
    return fallback;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const body = await req.json().catch(() => ({}));
    const dryRun = body.dry_run === true;
    const onlyTier: Tier | null = body.tier || null;
    const limit = Math.min(Number(body.limit) || 500, 2000);

    // Load template active flags from admin-controlled table
    const { data: tplRows } = await supabase
      .from("whatsapp_msg91_templates")
      .select("template_name, is_active");
    const tplActive = new Map<string, boolean>(
      (tplRows || []).map((r: any) => [r.template_name, r.is_active !== false]),
    );
    const isTierActive = (t: Tier) => tplActive.get(TIER_MSG91_TEMPLATE[t]) !== false;

    // Pull eligible profiles (must have phone + opt-in) — fetch all auth pages we need
    const authMap = new Map<string, { last_sign_in_at: string | null; created_at: string }>();
    const PER_PAGE = 1000;
    for (let page = 1; page <= 10; page++) {
      const { data: pageData } = await supabase.auth.admin.listUsers({ page, perPage: PER_PAGE });
      const users = pageData?.users || [];
      for (const u of users) {
        authMap.set(u.id, { last_sign_in_at: u.last_sign_in_at || null, created_at: u.created_at });
      }
      if (users.length < PER_PAGE) break;
    }

    const { data: profiles } = await supabase
      .from("profiles")
      .select("id, display_name, exam_type, phone, whatsapp_enabled, whatsapp_opted_in, is_banned")
      .eq("whatsapp_enabled", true)
      .eq("is_banned", false)
      .not("phone", "is", null)
      .limit(limit);

    if (!profiles?.length) return json({ processed: 0, reason: "no_eligible_users" });

    const profileIds = profiles.map((p: any) => p.id);

    // Batch fetch latest study_log per user
    const { data: logs } = await supabase
      .from("study_logs")
      .select("user_id, created_at")
      .in("user_id", profileIds)
      .order("created_at", { ascending: false })
      .limit(5000);
    const lastLogMap = new Map<string, number>();
    for (const l of logs || []) {
      if (!lastLogMap.has(l.user_id)) lastLogMap.set(l.user_id, new Date(l.created_at).getTime());
    }

    // Batch fetch recent reengagement logs for cooldown
    const maxCooldownHours = Math.max(...Object.values(TIER_COOLDOWN_HOURS));
    const { data: recentSends } = await supabase
      .from("whatsapp_reengagement_log")
      .select("user_id, tier, sent_at")
      .in("user_id", profileIds)
      .gte("sent_at", new Date(Date.now() - maxCooldownHours * 3600000).toISOString());
    const cooldownMap = new Map<string, number>(); // key: user_id|tier => sent_at ms
    for (const r of recentSends || []) {
      const k = `${r.user_id}|${r.tier}`;
      const ms = new Date(r.sent_at).getTime();
      if (!cooldownMap.has(k) || cooldownMap.get(k)! < ms) cooldownMap.set(k, ms);
    }

    const now = Date.now();
    const tally = { scanned: 0, never_signed_in: 0, inactive_24h: 0, inactive_3d: 0, inactive_7d: 0, sent: 0, skipped_cooldown: 0, skipped_no_auth: 0, errors: 0 };

    for (const profile of profiles) {
      tally.scanned++;
      const auth = authMap.get(profile.id);
      if (!auth) { tally.skipped_no_auth++; continue; }

      const signinMs = auth.last_sign_in_at ? new Date(auth.last_sign_in_at).getTime() : 0;
      const createdMs = new Date(auth.created_at).getTime();
      const logMs = lastLogMap.get(profile.id) || 0;

      const lastActiveMs = Math.max(signinMs, logMs);
      const hoursSinceSignup = (now - createdMs) / 3600000;
      const hoursSinceActive = lastActiveMs ? (now - lastActiveMs) / 3600000 : Infinity;

      let tier: Tier | null = null;
      if (!signinMs && hoursSinceSignup >= 24) tier = "never_signed_in";
      else if (hoursSinceActive >= 168) tier = "inactive_7d";
      else if (hoursSinceActive >= 72) tier = "inactive_3d";
      else if (hoursSinceActive >= 24) tier = "inactive_24h";

      if (!tier) continue;
      if (onlyTier && tier !== onlyTier) continue;
      if (!isTierActive(tier)) continue;
      tally[tier]++;

      // Cooldown check (in-memory)
      const cooldownMs = TIER_COOLDOWN_HOURS[tier] * 3600000;
      const lastSentMs = cooldownMap.get(`${profile.id}|${tier}`) || 0;
      if (lastSentMs && now - lastSentMs < cooldownMs) { tally.skipped_cooldown++; continue; }

      if (dryRun) { tally.sent++; continue; }

      const daysInactive = Math.floor(hoursSinceActive / 24);
      const ai = await generateAIMessage(tier, {
        display_name: profile.display_name,
        exam_type: profile.exam_type,
        days_inactive: isFinite(daysInactive) ? daysInactive : Math.floor(hoursSinceSignup / 24),
      });

      // ─── MSG91 Bulk WhatsApp (re_engagement_message template) ───
      try {
        const MSG91_AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY");
        if (!MSG91_AUTH_KEY) throw new Error("MSG91_AUTH_KEY missing");

        const rawPhone = String(profile.phone || "").replace(/\D/g, "");
        const phone = rawPhone.length === 10 ? `91${rawPhone}` : rawPhone;
        if (phone.length < 10) { tally.errors++; continue; }

        const firstName = (profile.display_name?.split(" ")[0] || "Champion").slice(0, 50);

        const templateName = TIER_MSG91_TEMPLATE[tier];
        const msg91Body = {
          integrated_number: "918796032562",
          content_type: "template",
          payload: {
            messaging_product: "whatsapp",
            type: "template",
            template: {
              name: templateName,
              language: { code: "en", policy: "deterministic" },
              namespace: "5a93dcbd_6802_42d5_af95_17d4fd2d7441",
              to_and_components: [
                {
                  to: [phone],
                  components: {
                    body_customer_name: {
                      type: "text",
                      value: firstName,
                      parameter_name: "customer_name",
                    },
                  },
                },
              ],
            },
          },
        };

        const sendRes = await fetch(
          "https://api.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              authkey: MSG91_AUTH_KEY,
            },
            body: JSON.stringify(msg91Body),
          },
        );
        const out = await sendRes.json().catch(() => ({}));
        const ok = sendRes.ok && (out?.type === "success" || out?.status === "success" || !out?.error);

        await supabase.from("whatsapp_reengagement_log").insert({
          user_id: profile.id,
          tier,
          template_name: templateName,
          ai_message: `${ai.headline} — ${ai.body}`,
          status: ok ? "sent" : "failed",
          metadata: {
            headline: ai.headline,
            body: ai.body,
            days_inactive: daysInactive,
            phone,
            msg91_response: out,
            http_status: sendRes.status,
          },
        });

        if (ok) tally.sent++;
        else tally.errors++;
      } catch (e) {
        tally.errors++;
        console.error("[wa-reeng] send error", profile.id, e);
        await supabase.from("whatsapp_reengagement_log").insert({
          user_id: profile.id,
          tier,
          template_name: TIER_MSG91_TEMPLATE[tier],
          status: "failed",
          metadata: { error: e instanceof Error ? e.message : String(e) },
        }).then(() => {}, () => {});
      }
    }

    return json({ ok: true, dry_run: dryRun, ...tally });
  } catch (e) {
    console.error("[wa-reeng] fatal", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
