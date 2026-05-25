// auto-trial-reminder — runs daily via pg_cron
// Sends SMS to all users whose trial is ending within 5 days (and not yet expired/renewed).
// Idempotent per day: skips users already notified today (checked via admin_audit_logs).
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
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

    const now = Date.now();
    const horizon = new Date(now + 5 * 86400000).toISOString();
    const nowIso = new Date(now).toISOString();

    // Find active trial users whose trial ends within next 5 days
    const { data: subs, error: subErr } = await sb
      .from("user_subscriptions")
      .select("user_id, trial_end_date, is_trial, status")
      .eq("is_trial", true)
      .not("trial_end_date", "is", null)
      .gte("trial_end_date", nowIso)
      .lte("trial_end_date", horizon);

    if (subErr) throw subErr;

    const candidateIds = (subs || []).map((s: any) => s.user_id);
    if (candidateIds.length === 0) {
      return json({ ok: true, total: 0, sent: 0, skipped: 0, failed: 0 });
    }

    // Dedupe: skip users already notified today (any auto trial reminder SMS today)
    const startOfDay = new Date();
    startOfDay.setUTCHours(0, 0, 0, 0);
    const { data: alreadyToday } = await sb
      .from("sms_messages")
      .select("user_id")
      .eq("source", "auto_trial_reminder")
      .gte("created_at", startOfDay.toISOString())
      .in("user_id", candidateIds);
    const sentToday = new Set((alreadyToday || []).map((r: any) => r.user_id));

    const toNotify = candidateIds.filter((id) => !sentToday.has(id));
    const { data: profiles } = await sb
      .from("profiles")
      .select("id, display_name, phone")
      .in("id", toNotify);

    const subByUser = new Map<string, any>();
    for (const s of subs || []) subByUser.set(s.user_id, s);

    const renewUrl = "https://acry.ai";
    let sent = 0,
      failed = 0;


    await Promise.all(
      (profiles || []).map(async (p: any) => {
        const sub = subByUser.get(p.id);
        const end = sub?.trial_end_date;
        const diffDays = end
          ? Math.max(0, Math.ceil((new Date(end).getTime() - Date.now()) / 86400000))
          : 0;
        const name = (p.display_name?.split(" ")?.[0]) || "there";
        try {
          const r = await fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${SERVICE_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              event_type: "trial_ending",
              user_id: p.id,
              source: "auto_trial_reminder",
              bypass_quota: true,
              data: { name, days: diffDays, link: renewUrl, url: renewUrl },
            }),
          });
          if (r.ok) sent++;
          else failed++;
        } catch {
          failed++;
        }
      }),
    );


    return json({
      ok: true,
      total: candidateIds.length,
      sent,
      skipped: sentToday.size,
      failed,
    });
  } catch (e) {
    console.error("auto-trial-reminder error", e);
    return json({ error: e instanceof Error ? e.message : String(e) }, 500);
  }
});
