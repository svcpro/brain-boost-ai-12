import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const MSG91_AUTH_KEY = Deno.env.get("MSG91_AUTH_KEY")!;
const MSG91_TEMPLATE_ID = Deno.env.get("MSG91_TEMPLATE_ID")!;

const admin = createClient(SUPABASE_URL, SERVICE_KEY);

/**
 * Daily MyRank re-engagement.
 * Finds users who took a test 1+ days ago and haven't been pinged today,
 * generates a "your friend beat you / today's rank is live" message,
 * and sends via MSG91 SMS.
 */
async function sendSms(phone: string, message: string) {
  // Strip leading + and country prefix logic (assume India: 91)
  const clean = phone.replace(/^\+/, "").replace(/\s+/g, "");
  const mobile = clean.length === 10 ? `91${clean}` : clean;

  const res = await fetch("https://control.msg91.com/api/v5/flow/", {
    method: "POST",
    headers: {
      authkey: MSG91_AUTH_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      template_id: MSG91_TEMPLATE_ID,
      short_url: "1",
      recipients: [{ mobiles: mobile, message }],
    }),
  });
  return res.ok;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    // Find logged-in users with a completed test ≥1 day ago, not pinged today
    const { data: candidates } = await admin
      .from("myrank_tests")
      .select("id, user_id, category, percentile, rank, last_reengaged_at")
      .not("user_id", "is", null)
      .not("completed_at", "is", null)
      .lte("completed_at", cutoff)
      .or(`last_reengaged_at.is.null,last_reengaged_at.lt.${todayStart.toISOString()}`)
      .order("completed_at", { ascending: false })
      .limit(500);

    if (!candidates || candidates.length === 0) {
      return new Response(JSON.stringify({ ok: true, sent: 0, message: "no candidates" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Dedupe per user (latest test per user)
    const seen = new Set<string>();
    const queue = candidates.filter(c => {
      if (seen.has(c.user_id!)) return false;
      seen.add(c.user_id!);
      return true;
    });

    let sent = 0;
    let failed = 0;

    for (const t of queue) {
      // Get user's phone
      const { data: profile } = await admin.from("profiles")
        .select("phone, display_name")
        .eq("id", t.user_id!)
        .maybeSingle();

      if (!profile?.phone) continue;

      // Did anyone outrank them since their last test?
      const { count: betterCount } = await admin.from("myrank_tests")
        .select("*", { count: "exact", head: true })
        .eq("category", t.category)
        .gt("percentile", t.percentile || 0)
        .not("completed_at", "is", null);

      const name = profile.display_name?.split(" ")[0] || "Champion";
      const messages = [
        `${name}, ${betterCount || 12} people just beat your ${t.category} rank! Reclaim your spot 👉 https://acry.ai/myrank`,
        `${name}, today's MyRank ${t.category} is live! Can you stay in top ${Math.max(1, Math.round(100 - (t.percentile || 0)))}%? 👉 https://acry.ai/myrank`,
        `${name}, your friend just took the ${t.category} test and ranked higher 😳 Check your new rank 👉 https://acry.ai/myrank`,
      ];
      const message = messages[Math.floor(Math.random() * messages.length)];

      const ok = await sendSms(profile.phone, message);
      if (ok) {
        sent++;
        await admin.from("myrank_tests")
          .update({ last_reengaged_at: new Date().toISOString() })
          .eq("id", t.id);
      } else {
        failed++;
      }
    }

    return new Response(JSON.stringify({ ok: true, sent, failed, candidates: queue.length }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("[myrank-reengagement]", e);
    return new Response(JSON.stringify({ error: e.message || "Internal error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
