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
  // NOTE: keys MUST match the placeholders inside each template's body_template,
  // because the engine resolves variables by exact key name (after the
  // identity variable_map). Missing keys cause MSG91/DLT to drop the message.
  const map: Record<string, Record<string, unknown>> = {
    // Auth
    account_locked: { ...base },
    login_detected: { ...base, device: "Chrome / Windows" },
    mobile_verified: { ...base },

    // Action
    emergency_revision: { ...base, topic: "Physics" },
    study_reminder: { ...base, topic: "Algebra" },

    // Home
    daily_brief_generated: { ...base, stability: 82 },
    comeback_user: { ...base, days: 3 },
    streak_risk: { ...base, days: 7, hours: 3 },
    final_streak_save: { ...base, days: 7 },

    // MyRank
    friend_joined: { ...base, friend: "Rahul", exam: "NEET UG" },
    leaderboard_climb: { ...base, exam: "NEET UG", positions: 5, rank: 14 },
    rank_drop: { ...base, points: 42 },
    weekly_summary_ready: { ...base, questions: 47, accuracy: 78, rank: 124 },

    // Practice
    exam_today: { ...base, exam: "NEET UG" },
    exam_countdown: { ...base, exam: "NEET UG", days: 30 },
    mock_test_due: { ...base, exam: "NEET UG", time: "20:00" },
    weak_topic_detected: { ...base, topic: "Algebra", strength: 42 },

    // You / Billing
    invoice_generated: { ...base, amount: 149 },
    milestone_unlocked: { ...base, milestone: "Level 5" },
    payment_failed: { ...base, amount: 149 },
    payment_success: { ...base, amount: 149, expiry: "25 May 2026" },
    referral_reward: { ...base, friend: "Rahul", reward: "₹50 cashback" },
    subscription_expiring: { ...base, days: 3 },
    trial_ending: { ...base, days: 2 },
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

    // Create a job row up-front so the UI can poll progress
    const { data: job, error: jobErr } = await sb
      .from("sms_broadcast_jobs")
      .insert({
        created_by: userData.user.id,
        status: "running",
        total_pairs: totalPairs,
      })
      .select("id")
      .single();
    if (jobErr || !job) throw jobErr || new Error("failed_to_create_job");
    const jobId = job.id as string;

    // Background fan-out — runs after we already returned 202
    const engineUrl = `${SUPABASE_URL}/functions/v1/sms-event-engine`;
    const work = (async () => {
      const results: Array<Record<string, unknown>> = [];
      let sent = 0, failed = 0, skipped = 0, processed = 0;
      const FLUSH_EVERY = 10;

      const flush = async (final = false) => {
        await sb
          .from("sms_broadcast_jobs")
          .update({
            sent,
            failed,
            skipped,
            results,
            status: final ? "complete" : "running",
            finished_at: final ? new Date().toISOString() : null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      };

      try {
        for (const user of users || []) {
          const userEvents = (events || []).slice(0, maxPerUser);
          // Send this user's events in parallel for speed; engine handles rate limits
          const settled = await Promise.allSettled(
            userEvents.map(async (ev) => {
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
              return { r, json, ev };
            }),
          );

          for (let i = 0; i < settled.length; i++) {
            const ev = userEvents[i];
            const s = settled[i];
            if (s.status === "fulfilled") {
              const { r, json } = s.value;
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
            } else {
              failed++;
              results.push({
                user_id: user.id,
                phone: user.phone,
                event_key: ev.event_key,
                status: 0,
                outcome: "exception",
                reason: String(s.reason?.message || s.reason),
              });
            }
            processed++;
          }

          if (processed % FLUSH_EVERY < userEvents.length) await flush(false);
        }
        await flush(true);
        console.log(`[broadcast-test] job ${jobId} complete sent=${sent} failed=${failed} skipped=${skipped}`);
      } catch (e) {
        console.error(`[broadcast-test] job ${jobId} crashed`, e);
        await sb
          .from("sms_broadcast_jobs")
          .update({
            status: "error",
            last_error: String((e as Error)?.message || e),
            sent, failed, skipped, results,
            finished_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          })
          .eq("id", jobId);
      }
    })();

    // @ts-ignore - EdgeRuntime is provided by the Supabase runtime
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work);
    } else {
      // Fallback (shouldn't be hit on Supabase) — fire and forget
      work.catch((e) => console.error("[broadcast-test] bg error", e));
    }

    return new Response(
      JSON.stringify({
        ok: true,
        accepted: true,
        job_id: jobId,
        events: events?.length || 0,
        users: users?.length || 0,
        total_pairs: totalPairs,
        message: "Broadcast started in background. Poll sms_broadcast_jobs for progress.",
      }),
      { status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[broadcast-test] error", e);
    return new Response(
      JSON.stringify({ error: String((e as Error)?.message || e) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
