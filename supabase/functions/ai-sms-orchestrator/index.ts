// AI-driven SMS orchestrator
// - Pulls eligible users with phone numbers
// - Gathers per-user signals (recent SMS, study activity, profile, exam date)
// - Asks Lovable AI to choose 0-3 best events + send times per user
// - Dispatches via sms-event-engine, respecting per-user daily cap and quiet hours
// - Logs every decision and outcome to sms_orchestration_log

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY")!;
const sb = createClient(SUPABASE_URL, SERVICE_KEY);

// ---------- Helpers ----------

function nowIso() {
  return new Date().toISOString();
}

// India Standard Time (UTC+5:30) — all SMS scheduling/quiet-hours are evaluated in IST
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

function nowIST(d: Date = new Date()): Date {
  return new Date(d.getTime() + IST_OFFSET_MS);
}

function hourOfDayIST(d: Date = new Date()): number {
  return nowIST(d).getUTCHours();
}

function istTimeHHMM(d: Date = new Date()): string {
  return nowIST(d).toISOString().slice(11, 16);
}

function inQuietHours(hourIst: number, start: number, end: number) {
  // start/end are admin-set (0-23) in IST. Treat range as wrap-around (e.g. 22 -> 8).
  if (start === end) return false;
  if (start < end) return hourIst >= start && hourIst < end;
  return hourIst >= start || hourIst < end;
}

async function isAdmin(userId: string): Promise<boolean> {
  const { data } = await sb.rpc("is_admin", { _user_id: userId });
  return !!data;
}

function sampleDataFor(eventKey: string, profile: any): Record<string, unknown> {
  const base: Record<string, unknown> = {
    name: profile?.display_name || "User",
    link: "https://acry.ai",
    url: "https://acry.ai",
    time: istTimeHHMM(),
    exam: profile?.exam_type || "your exam",
  };
  // Defaults that align with template placeholders — engine will only use what each template needs.
  switch (eventKey) {
    case "study_reminder":
    case "emergency_revision":
      return { ...base, topic: "today's focus topic" };
    case "weak_topic_detected":
      return { ...base, topic: "Algebra", strength: 42 };
    case "current_affairs_alert":
      return { ...base, count: 5, prob: 72 };
    case "sureshot_ready":
      return { ...base, count: 25 };
    case "streak_risk":
      return { ...base, days: 7, hours: 3 };
    case "final_streak_save":
      return { ...base, days: 7 };
    case "comeback_user":
      return { ...base, days: 3 };
    case "exam_countdown":
      return { ...base, days: profile?.exam_days_left ?? 30 };
    case "mock_test_due":
      return { ...base };
    case "leaderboard_climb":
      return { ...base, positions: 5, rank: 14 };
    case "rank_war_invite":
      return { ...base, time: "20:00" };
    case "rank_drop":
      return { ...base, points: 42 };
    case "weekly_summary_ready":
      return { ...base, questions: 47, accuracy: 78, rank: 124 };
    case "daily_brief_generated":
      return { ...base, stability: 82 };
    case "trial_ending":
      return { ...base, days: 2 };
    case "subscription_expiring":
      return { ...base, days: 3 };
    case "milestone_unlocked":
      return { ...base, milestone: "Level 5" };
    case "referral_reward":
      return { ...base, friend: "Rahul", reward: "₹50 cashback" };
    default:
      return base;
  }
}

// ---------- Signal gathering ----------

async function gatherUserSignals(userId: string, lookbackHours: number) {
  const since = new Date(Date.now() - lookbackHours * 3600 * 1000).toISOString();
  const todayStart = new Date(); todayStart.setUTCHours(0, 0, 0, 0);

  const [{ data: recentSms }, { data: recentAudit }, { data: todaySent }] = await Promise.all([
    sb.from("sms_messages")
      .select("template_name, status, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(20),
    sb.from("sms_event_audit")
      .select("event_key, outcome, reason, created_at")
      .eq("user_id", userId)
      .gte("created_at", since)
      .order("created_at", { ascending: false })
      .limit(30),
    sb.from("sms_messages")
      .select("id", { count: "exact", head: false })
      .eq("user_id", userId)
      .gte("created_at", todayStart.toISOString()),
  ]);

  return {
    recent_sms: (recentSms || []).map((r) => ({
      template: r.template_name,
      status: r.status,
      at: r.created_at,
    })),
    recent_audit: (recentAudit || []).map((r) => ({
      event: r.event_key,
      outcome: r.outcome,
      reason: r.reason,
      at: r.created_at,
    })),
    sent_today: (todaySent || []).length,
  };
}

// ---------- AI decision ----------

interface Decision {
  event_key: string;
  send_at_minutes_from_now: number;
  reason: string;
}

async function askAi(
  model: string,
  profile: any,
  signals: any,
  events: { event_key: string; display_name: string; category: string; priority: string }[],
  maxPicks: number,
): Promise<Decision[]> {
  const system =
    "You are an SMS engagement strategist for a study app. Pick the BEST events to send to ONE user RIGHT NOW. " +
    "Maximize engagement and avoid annoyance. Never recommend events the user already received in the last 24h. " +
    "Spread send times across the next 12 hours (use minutes 0-720). " +
    "Return STRICT JSON via the tool call. If no event is appropriate, return an empty picks array.";

  const userPayload = {
    user_profile: {
      name: profile?.display_name,
      exam_type: profile?.exam_type,
      exam_date: profile?.exam_date,
      exam_days_left: profile?.exam_days_left,
      onboarding_completed: profile?.onboarding_completed,
      created_at: profile?.created_at,
    },
    signals,
    available_events: events,
    constraints: {
      max_picks: maxPicks,
      timezone_note: "Times are in minutes from NOW (UTC).",
    },
  };

  const body = {
    model,
    messages: [
      { role: "system", content: system },
      { role: "user", content: JSON.stringify(userPayload) },
    ],
    tools: [{
      type: "function",
      function: {
        name: "recommend_sms",
        description: "Recommend up to N SMS events to send to this user, with send-time and rationale.",
        parameters: {
          type: "object",
          properties: {
            picks: {
              type: "array",
              maxItems: maxPicks,
              items: {
                type: "object",
                properties: {
                  event_key: { type: "string", description: "Must be one of available_events.event_key" },
                  send_at_minutes_from_now: { type: "integer", minimum: 0, maximum: 720 },
                  reason: { type: "string", description: "1-sentence rationale" },
                },
                required: ["event_key", "send_at_minutes_from_now", "reason"],
                additionalProperties: false,
              },
            },
          },
          required: ["picks"],
          additionalProperties: false,
        },
      },
    }],
    tool_choice: { type: "function", function: { name: "recommend_sms" } },
  };

  const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${LOVABLE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const txt = await res.text().catch(() => "");
    throw new Error(`ai_gateway_${res.status}: ${txt.slice(0, 200)}`);
  }
  const json = await res.json();
  const tc = json.choices?.[0]?.message?.tool_calls?.[0];
  const args = tc?.function?.arguments;
  if (!args) return [];
  try {
    const parsed = JSON.parse(args);
    return Array.isArray(parsed?.picks) ? parsed.picks.slice(0, maxPicks) : [];
  } catch {
    return [];
  }
}

// ---------- Dispatch ----------

async function dispatchEvent(userId: string, profile: any, eventKey: string, sendAtMin: number) {
  // For "now" picks (≤2 minutes), call sms-event-engine immediately.
  // For future picks, queue into sms_scheduled_sends if it exists.
  if (sendAtMin <= 2) {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventKey,
        user_id: userId,
        data: sampleDataFor(eventKey, profile),
        source: "ai_orchestrator",
      }),
    });
    const out = await res.json().catch(() => ({}));
    return { dispatched: "now", ok: !!out?.ok, status: out?.status || res.status };
  }

  // Schedule for later
  const scheduledFor = new Date(Date.now() + sendAtMin * 60 * 1000).toISOString();
  const { error } = await sb.from("sms_scheduled_sends").insert({
    user_id: userId,
    event_key: eventKey,
    scheduled_for: scheduledFor,
    payload: sampleDataFor(eventKey, profile),
    source: "ai_orchestrator",
    status: "pending",
  });
  if (error) {
    // Fallback: send immediately if scheduling table is missing or insert fails
    const res = await fetch(`${SUPABASE_URL}/functions/v1/sms-event-engine`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${SERVICE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        event_type: eventKey,
        user_id: userId,
        data: sampleDataFor(eventKey, profile),
        source: "ai_orchestrator_fallback",
      }),
    });
    const out = await res.json().catch(() => ({}));
    return { dispatched: "now_fallback", ok: !!out?.ok, status: out?.status || res.status, schedule_error: error.message };
  }
  return { dispatched: "scheduled", scheduled_for: scheduledFor };
}

// ---------- Main run ----------

async function runOrchestration(triggeredBy: string, triggeredByUser: string | null, overrideDryRun?: boolean) {
  const startedAt = Date.now();

  // Load config
  const { data: cfg } = await sb.from("sms_orchestration_config").select("*").limit(1).maybeSingle();
  if (!cfg) throw new Error("orchestration_config_missing");
  if (!cfg.enabled) {
    return { ok: false, status: "disabled" };
  }

  const dryRun = overrideDryRun ?? cfg.dry_run;
  const model = cfg.ai_model || "google/gemini-3-flash-preview";

  // Insert run row
  const { data: runRow, error: runErr } = await sb.from("sms_orchestration_log").insert({
    triggered_by: triggeredBy,
    triggered_by_user: triggeredByUser,
    status: "running",
    dry_run: dryRun,
    model,
  }).select("*").single();
  if (runErr || !runRow) throw new Error(`log_insert_failed: ${runErr?.message}`);

  // Quiet hours guard
  if (inQuietHours(hourOfDayUTC(), cfg.quiet_hours_start, cfg.quiet_hours_end)) {
    await sb.from("sms_orchestration_log").update({
      status: "skipped_quiet_hours",
      finished_at: nowIso(),
      duration_ms: Date.now() - startedAt,
    }).eq("id", runRow.id);
    return { ok: true, run_id: runRow.id, status: "skipped_quiet_hours" };
  }

  // Available events
  const { data: events } = await sb.from("sms_event_registry")
    .select("event_key, display_name, category, priority")
    .eq("is_enabled", true)
    .not("template_name", "is", null);
  const availableEvents = events || [];
  if (availableEvents.length === 0) {
    await sb.from("sms_orchestration_log").update({
      status: "no_events",
      finished_at: nowIso(),
      duration_ms: Date.now() - startedAt,
    }).eq("id", runRow.id);
    return { ok: true, run_id: runRow.id, status: "no_events" };
  }

  // Eligible users (have phone)
  const { data: users } = await sb.from("profiles")
    .select("id, display_name, exam_type, exam_date, onboarding_completed, created_at, phone")
    .not("phone", "is", null)
    .neq("phone", "")
    .limit(cfg.max_users_per_run);
  const eligibleUsers = users || [];

  let decisionsMade = 0;
  let smsSent = 0;
  let smsSkipped = 0;
  let smsFailed = 0;
  let aiCalls = 0;
  const decisionsLog: any[] = [];

  // Process in small concurrency batches to keep AI gateway happy
  const concurrency = 3;
  for (let i = 0; i < eligibleUsers.length; i += concurrency) {
    const batch = eligibleUsers.slice(i, i + concurrency);
    await Promise.all(batch.map(async (u) => {
      try {
        const signals = await gatherUserSignals(u.id, cfg.lookback_hours);
        const remainingToday = Math.max(0, cfg.max_per_user_per_day - (signals.sent_today || 0));
        if (remainingToday <= 0) {
          decisionsLog.push({ user_id: u.id, skipped: "daily_cap" });
          smsSkipped += 1;
          return;
        }

        const profileForAi = {
          ...u,
          exam_days_left: u.exam_date
            ? Math.max(0, Math.ceil((new Date(u.exam_date).getTime() - Date.now()) / 86400000))
            : null,
        };

        aiCalls += 1;
        const picks = await askAi(model, profileForAi, signals, availableEvents, remainingToday);

        if (picks.length === 0) {
          decisionsLog.push({ user_id: u.id, picks: [] });
          return;
        }

        for (const pick of picks) {
          // Validate event key
          if (!availableEvents.find((e) => e.event_key === pick.event_key)) {
            decisionsLog.push({ user_id: u.id, invalid_pick: pick.event_key });
            continue;
          }
          decisionsMade += 1;
          if (dryRun) {
            decisionsLog.push({ user_id: u.id, dry_run: true, pick });
            continue;
          }
          try {
            const result = await dispatchEvent(u.id, profileForAi, pick.event_key, pick.send_at_minutes_from_now);
            decisionsLog.push({ user_id: u.id, pick, result });
            if (result.dispatched === "scheduled") smsSent += 0; // scheduled, not sent yet
            else if (result.ok) smsSent += 1;
            else smsFailed += 1;
          } catch (err) {
            smsFailed += 1;
            decisionsLog.push({ user_id: u.id, pick, error: (err as Error).message });
          }
        }
      } catch (err) {
        decisionsLog.push({ user_id: u.id, error: (err as Error).message });
      }
    }));
  }

  await sb.from("sms_orchestration_log").update({
    status: "complete",
    users_scanned: eligibleUsers.length,
    decisions_made: decisionsMade,
    sms_sent: smsSent,
    sms_skipped: smsSkipped,
    sms_failed: smsFailed,
    ai_calls: aiCalls,
    decisions: decisionsLog.slice(0, 500), // cap log size
    finished_at: nowIso(),
    duration_ms: Date.now() - startedAt,
  }).eq("id", runRow.id);

  return {
    ok: true,
    run_id: runRow.id,
    users_scanned: eligibleUsers.length,
    decisions_made: decisionsMade,
    sms_sent: smsSent,
    sms_skipped: smsSkipped,
    sms_failed: smsFailed,
  };
}

// ---------- HTTP entry ----------

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const url = new URL(req.url);
    const isCron = url.searchParams.get("source") === "cron" ||
                   req.headers.get("x-orchestrator-source") === "cron";
    let triggeredBy = "manual";
    let triggeredByUser: string | null = null;
    let body: any = {};

    try { body = await req.json(); } catch { body = {}; }

    if (isCron) {
      triggeredBy = "cron";
    } else {
      // Admin auth required for manual runs
      const auth = req.headers.get("Authorization") || "";
      const token = auth.replace(/^Bearer\s+/i, "").trim();
      if (!token) {
        return new Response(JSON.stringify({ error: "missing_auth" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const { data: u } = await sb.auth.getUser(token);
      if (!u?.user) {
        return new Response(JSON.stringify({ error: "invalid_token" }), {
          status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!(await isAdmin(u.user.id))) {
        return new Response(JSON.stringify({ error: "forbidden_admin_only" }), {
          status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      triggeredByUser = u.user.id;
    }

    // Run in background to avoid 150s idle timeout
    const work = runOrchestration(triggeredBy, triggeredByUser, body?.dry_run);
    // @ts-ignore EdgeRuntime is provided by Supabase
    if (typeof EdgeRuntime !== "undefined" && EdgeRuntime?.waitUntil) {
      // @ts-ignore
      EdgeRuntime.waitUntil(work.catch((e) => console.error("orchestrator bg error", e)));
      return new Response(JSON.stringify({ ok: true, accepted: true }), {
        status: 202, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const result = await work;
    return new Response(JSON.stringify(result), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("ai-sms-orchestrator error", err);
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
