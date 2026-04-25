// SMS Broadcast Test — fully automated fan-out of every enabled SMS event
// to every phone-verified user. Admin-only. Calls sms-event-engine per pair
// with sample data tailored to each event. Returns a per-pair result summary.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;

const sb = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

// Sample data per event type. Engine maps these via variable_map.
function sampleDataFor(eventKey: string, displayName: string): Record<string, unknown> {
  const base = {
    app: "ACRY",
    link: "https://acry.ai",
    url: "https://acry.ai",
    time: new Date().toISOString().slice(11, 16),
  };
  const map: Record<string, Record<string, unknown>> = {
    badge_earned: { ...base, badge: "Champion", count: 5 },
    milestone_unlocked: { ...base, milestone: "Level 5" },
    comeback_user: { ...base, days: 3 },
    streak_risk: { ...base, days: 7, hours: 3 },
    final_streak_save: { ...base, days: 7 },
    emergency_revision: { ...base, topic: "Physics" },
    daily_brief_generated: { ...base, count: 12 },
    study_reminder: { ...base, time: "20:00" },
    leaderboard_climb: { ...base, rank: 14, change: 5 },
    weak_topic_detected: { ...base, topic: "Algebra", score: 42 },
    weekly_summary_ready: { ...base, count: 47, accuracy: 78 },
    sure_shot_ready: { ...base, count: 25 },
    login_detected: { ...base, device: "Chrome / Windows", city: "Mumbai" },
    account_locked: { ...base },
    suspicious_activity: { ...base, device: "Unknown" },
    password_changed: { ...base },
    exam_today: { ...base, exam: "NEET UG" },
    exam_countdown: { ...base, exam: "NEET UG", days: 30 },
    mock_test_due: { ...base, test: "Full Mock 12" },
    rank_drop: { ...base, rank: 248, change: -42 },
    friend_joined: { ...base, friend: "Rahul" },
    payment_failed: { ...base, amount: "₹149", reason: "Card declined" },
    payment_success: { ...base, amount: "₹149", plan: "Premium" },
    invoice_generated: { ...base, amount: "₹149", invoice: "INV-2026-001" },
    refund_processed: { ...base, amount: "₹149" },
    subscription_expiring: { ...base, days: 3, plan: "Premium" },
    plan_downgraded: { ...base, plan: "Starter" },
    plan_upgraded: { ...base, plan: "Premium" },
    trial_ending: { ...base, days: 2 },
    referral_reward: { ...base, amount: "₹50", friend: "Rahul" },
    email_verified: { ...base },
    mobile_verified: { ...base },
    user_signup: { ...base },
    test_completed: { ...base, score: 84 },
    feature_announcement: { ...base, feature: "BrainLens" },
  };
  return map[eventKey] ?? { ...base, event: displayName };
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await sb.rpc("is_admin", { _user_id: userId });
  return !!data;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // Auth: require admin
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.replace(/^Bearer\s+/i, "").trim();
    if (!token) {
      return new Response(JSON.stringify({ error: "missing_auth" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: userData, error: userErr } = await sb.auth.getUser(token);
    if (userErr || !userData?.user) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!(await isAdmin(userData.user.id))) {
      return new Response(JSON.stringify({ error: "forbidden_admin_only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = (await req.json().catch(() => ({}))) as {
      dry_run?: boolean;
      event_keys?: string[];
      user_ids?: string[];
      max_per_user?: number;
    };
    const dryRun = !!body.dry_run;
    const maxPerUser = Math.max(1, Math.min(100, body.max_per_user ?? 100));

    // Pull enabled events with a mapped template
    let evQuery = sb
      .from("sms_event_registry")
      .select("event_key, display_name, template_name, is_enabled")
      .eq("is_enabled", true)
      .not("template_name", "is", null);
    if (body.event_keys?.length) evQuery = evQuery.in("event_key", body.event_keys);
    const { data: events, error: evErr } = await evQuery;
    if (evErr) throw evErr;

    // Pull users with phone numbers
    let usrQuery = sb
      .from("profiles")
      .select("id, display_name, phone")
      .not("phone", "is", null)
      .neq("phone", "");
    if (body.user_ids?.length) usrQuery = usrQuery.in("id", body.user_ids);
    const { data: users, error: usrErr } = await usrQuery;
    if (usrErr) throw usrErr;

    const totalPairs = (events?.length || 0) * (users?.length || 0);
    console.log(
      `[broadcast-test] events=${events?.length} users=${users?.length} pairs=${totalPairs} dryRun=${dryRun}`,
    );

    if (dryRun) {
      return new Response(
        JSON.stringify({
          dry_run: true,
          events: events?.length || 0,
          users: users?.length || 0,
          total_pairs: totalPairs,
          sample: events?.slice(0, 3).map((e) => ({
            event_key: e.event_key,
            template_name: e.template_name,
            sample_data: sampleDataFor(e.event_key, e.display_name),
          })),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fan out: per user, cap at maxPerUser events
    const engineUrl = `${SUPABASE_URL}/functions/v1/sms-event-engine`;
    const results: Array<Record<string, unknown>> = [];
    let sent = 0;
    let failed = 0;
    let skipped = 0;

    for (const user of users || []) {
      const userEvents = (events || []).slice(0, maxPerUser);
      for (const ev of userEvents) {
        try {
          const r = await fetch(engineUrl, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${SERVICE_KEY}`,
              apikey: ANON_KEY,
            },
            body: JSON.stringify({
              event_type: ev.event_key,
              user_id: user.id,
              data: sampleDataFor(ev.event_key, ev.display_name),
              source: "broadcast_test_all",
            }),
          });
          const json = await r.json().catch(() => ({}));
          const ok = r.ok && (json as any)?.ok !== false;
          if (ok) sent++;
          else if ((json as any)?.outcome === "skipped") skipped++;
          else failed++;
          results.push({
            user_id: user.id,
            phone: user.phone,
            event_key: ev.event_key,
            status: r.status,
            outcome: (json as any)?.outcome ?? (ok ? "sent" : "failed"),
            reason: (json as any)?.reason ?? null,
          });
        } catch (e) {
          failed++;
          results.push({
            user_id: user.id,
            phone: user.phone,
            event_key: ev.event_key,
            status: 0,
            outcome: "exception",
            reason: String((e as Error)?.message || e),
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        ok: true,
        events: events?.length || 0,
        users: users?.length || 0,
        total_pairs: totalPairs,
        sent,
        failed,
        skipped,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[broadcast-test] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
