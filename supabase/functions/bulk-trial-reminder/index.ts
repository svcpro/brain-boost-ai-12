// bulk-trial-reminder — admin one-click bulk trial-end reminder
// Dispatches to both WhatsApp (via whatsapp-notify) and SMS (via sms-event-engine).
// Input: { user_ids: string[] }
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const json = (d: unknown, s = 200) =>
  new Response(JSON.stringify(d), {
    status: s,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });

    // Verify caller is an admin
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace(/^Bearer\s+/i, "");
    if (!token) return json({ error: "unauthorized" }, 401);
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData.user) return json({ error: "unauthorized" }, 401);
    const { data: isAdmin } = await sb.rpc("is_admin", { _user_id: userData.user.id });
    if (!isAdmin) return json({ error: "forbidden" }, 403);

    const body = await req.json().catch(() => ({}));
    const user_ids: string[] = Array.isArray(body.user_ids) ? body.user_ids : [];
    const channel: "whatsapp" | "sms" | "both" = body.channel === "whatsapp" || body.channel === "sms" ? body.channel : "both";
    if (user_ids.length === 0) return json({ error: "user_ids required" }, 400);

    const renewUrl = "https://acry.ai";

    // Fetch user profile + subscription info for personalization
    const [{ data: profiles }, { data: subs }] = await Promise.all([
      sb.from("profiles").select("id, display_name, email, phone, whatsapp_number").in("id", user_ids),
      sb
        .from("user_subscriptions")
        .select("user_id, trial_end_date, expires_at, plan_id, is_trial, status")
        .in("user_id", user_ids),
    ]);

    const subByUser = new Map<string, any>();
    for (const s of subs || []) subByUser.set(s.user_id, s);

    let waSent = 0,
      waFail = 0,
      smsSent = 0,
      smsFail = 0;

    await Promise.all(
      (profiles || []).map(async (p: any) => {
        const sub = subByUser.get(p.id);
        const end = sub?.trial_end_date || sub?.expires_at;
        const diffDays = end
          ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000))
          : 0;
        const name = (p.display_name?.split(" ")?.[0]) || "there";
        const expiryDate = end ? new Date(end).toISOString().slice(0, 10) : "";

        // WhatsApp: ai_subscription_expiry template
        if (channel === "whatsapp" || channel === "both") {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/whatsapp-notify`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                action: "send",
                user_id: p.id,
                template_name: "ai_subscription_expiry",
                category: "critical",
                source: "admin_bulk_trial_reminder",
                triggered_by: userData.user.id,
                variables: {
                  name,
                  plan_name: "ACRY Premium",
                  days_remaining: String(diffDays),
                  expiry_date: expiryDate,
                  renewal_price: "149",
                  discount_code: "RENEW",
                },
              }),
            });
            if (r.ok) waSent++;
            else waFail++;
          } catch {
            waFail++;
          }
        }

        // SMS: MSG91 DLT template via registry
        if (channel === "sms" || channel === "both") {
          try {
            const r = await fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
              method: "POST",
              headers: {
                Authorization: `Bearer ${SERVICE_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                event_type: diffDays <= 0 ? "subscription_expiring" : "trial_ending",
                user_id: p.id,
                source: "admin_bulk_trial_reminder",
                data: {
                  name,
                  days: diffDays,
                  link: renewUrl,
                  url: renewUrl,
                },
              }),
            });
            if (r.ok) smsSent++;
            else smsFail++;
          } catch {
            smsFail++;
          }
        }
      }),
    );

    // Audit log
    await sb.from("admin_audit_logs").insert(
      user_ids.map((tid) => ({
        admin_id: userData.user.id,
        action: "bulk_trial_reminder_sent",
        target_type: "user",
        target_id: tid,
        details: { channel } as any,
      })),
    );

    return json({
      ok: true,
      total: user_ids.length,
      whatsapp: { sent: waSent, failed: waFail },
      sms: { sent: smsSent, failed: smsFail },
    });
  } catch (e) {
    console.error("bulk-trial-reminder error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
