// OneSignal Automation Cron — scans signals every 15 min and dispatches.
// Triggers: streak_at_risk, daily_review_due, inactive_study_24h,
// reengagement_1d/3d/7d, trial_expiring_3d/1d/expired, exam_today_motivation,
// scheduled push_campaigns due now.
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function dispatch(event_key: string, user_ids: string[], data: Record<string, unknown> = {}) {
  if (!user_ids.length) return;
  await fetch(`${SUPABASE_URL}/functions/v1/onesignal-dispatch`, {
    method: "POST",
    headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ action: "send_event", event_key, user_ids, data }),
  }).catch(() => {});
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);
  const stats: Record<string, number> = {};
  const now = new Date();

  try {
    // 1. Scheduled campaigns due
    const { data: due } = await supabase.from("push_campaigns")
      .select("*").eq("status", "scheduled").lte("scheduled_at", now.toISOString()).limit(20);
    for (const c of due || []) {
      await fetch(`${SUPABASE_URL}/functions/v1/onesignal-dispatch`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_broadcast",
          campaign_id: c.id,
          title: c.title, body: c.body,
          icon_url: c.icon_url, image_url: c.image_url, deep_link: c.deep_link,
          segments: ["Subscribed Users"],
        }),
      }).catch(() => {});
      stats.scheduled_sent = (stats.scheduled_sent || 0) + 1;
    }

    // 2. Active users (last 30d)
    const { data: users } = await supabase.from("profiles")
      .select("id, last_active_at, exam_date")
      .gte("last_active_at", new Date(Date.now() - 30 * 86400_000).toISOString())
      .limit(2000);

    const today = now.toISOString().slice(0, 10);
    for (const u of users || []) {
      const lastActive = u.last_active_at ? new Date(u.last_active_at).getTime() : 0;
      const daysIdle = Math.floor((Date.now() - lastActive) / 86400_000);

      if (daysIdle === 1) { await dispatch("reengagement_1d", [u.id]); stats.r1 = (stats.r1 || 0) + 1; }
      else if (daysIdle === 3) { await dispatch("reengagement_3d", [u.id]); stats.r3 = (stats.r3 || 0) + 1; }
      else if (daysIdle === 7) { await dispatch("reengagement_7d", [u.id]); stats.r7 = (stats.r7 || 0) + 1; }

      // Exam day
      if (u.exam_date && String(u.exam_date).slice(0, 10) === today) {
        await dispatch("exam_today_motivation", [u.id]); stats.exam_day = (stats.exam_day || 0) + 1;
      }
    }

    // 3. Trial expiring
    const { data: trials } = await supabase.from("user_subscriptions")
      .select("user_id, trial_end_date, is_trial, status")
      .eq("is_trial", true).eq("status", "active");
    for (const t of trials || []) {
      const ms = new Date(t.trial_end_date).getTime() - Date.now();
      const days = Math.ceil(ms / 86400_000);
      if (days === 3) { await dispatch("trial_expiring_3d", [t.user_id]); stats.t3 = (stats.t3 || 0) + 1; }
      else if (days === 1) { await dispatch("trial_expiring_1d", [t.user_id]); stats.t1 = (stats.t1 || 0) + 1; }
      else if (days <= 0) { await dispatch("trial_expired", [t.user_id]); stats.t0 = (stats.t0 || 0) + 1; }
    }

    // 4. Streak at risk: users with current streak who haven't studied today (after 8pm local)
    const hour = now.getHours();
    if (hour >= 19) {
      const { data: streaks } = await supabase.from("study_streaks")
        .select("user_id, current_streak, last_study_date").gt("current_streak", 0);
      for (const s of streaks || []) {
        if (String(s.last_study_date).slice(0, 10) !== today) {
          await dispatch("streak_at_risk", [s.user_id], { streak: s.current_streak });
          stats.streak_risk = (stats.streak_risk || 0) + 1;
        }
      }
    }

    return new Response(JSON.stringify({ ok: true, stats }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("automation-cron:", e);
    return new Response(JSON.stringify({ error: String(e), stats }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
