// ═══════════════════════════════════════════════════════════════════
// Voice Broadcast Scheduler — runs on cron (every 15 min)
// For each active event row in voice_broadcast_event_voices, resolves
// the eligible user cohort, calls voice-broadcast `send_to_user`
// per user, and logs to voice_broadcast_event_logs (cooldown enforced).
// ═══════════════════════════════════════════════════════════════════
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (d: unknown, status = 200) =>
  new Response(JSON.stringify(d), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

// One OBD campaign per event per run, carrying ALL eligible users in a single bulk upload.
// 5000 is OBD's practical per-campaign ceiling; raise only if your account allows more.
const MAX_PER_EVENT_PER_RUN = 5000;

type EventRow = {
  event_key: string;
  voice_prompt_id: string | null;
  is_active: boolean;
  cooldown_hours: number;
  send_window_start: string;
  send_window_end: string;
  location_json: string;
};

// Convert UTC now → IST HH:MM
function istHHMM(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${String(ist.getUTCHours()).padStart(2, "0")}:${String(ist.getUTCMinutes()).padStart(2, "0")}`;
}
function istWeekday(): number {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return ist.getUTCDay(); // 0=Sun
}

function inSendWindow(start: string, end: string): boolean {
  const now = istHHMM();
  return now >= start.slice(0, 5) && now <= end.slice(0, 5);
}

async function eligibleUserIds(eventKey: string): Promise<string[]> {
  // All cohort queries return user ids with a valid phone. Capped by MAX_PER_EVENT_PER_RUN.
  const nowIso = new Date().toISOString();
  const hoursAgo = (h: number) => new Date(Date.now() - h * 3600_000).toISOString();

  switch (eventKey) {
    case "signup_welcome": {
      // Signed up within the last 30 minutes
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .gte("created_at", hoursAgo(0.5))
        .not("phone", "is", null)
        .limit(MAX_PER_EVENT_PER_RUN);
      return (data || []).map((r: any) => r.id);
    }
    case "onboarding_incomplete": {
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("onboarding_completed", false)
        .lt("created_at", hoursAgo(2))
        .gt("created_at", hoursAgo(48))
        .not("phone", "is", null)
        .limit(MAX_PER_EVENT_PER_RUN);
      return (data || []).map((r: any) => r.id);
    }
    case "inactive_24h":
    case "inactive_24h_plus":
    case "inactive_3d_7d":
    case "final_reengagement": {
      const ranges: Record<string, [number, number]> = {
        inactive_24h: [22, 26],
        inactive_24h_plus: [26, 72],
        inactive_3d_7d: [72, 168],
        final_reengagement: [336, 10000],
      };
      const [lo, hi] = ranges[eventKey];
      const { data } = await supabase
        .from("device_sessions")
        .select("user_id, last_active_at")
        .lt("last_active_at", hoursAgo(lo))
        .gt("last_active_at", hoursAgo(hi))
        .limit(MAX_PER_EVENT_PER_RUN * 3);
      const seen = new Set<string>();
      const ids: string[] = [];
      for (const r of data || []) {
        if (!seen.has(r.user_id)) { seen.add(r.user_id); ids.push(r.user_id); }
        if (ids.length >= MAX_PER_EVENT_PER_RUN) break;
      }
      return ids;
    }
    case "daily_ai_tools_alert":
    case "leaderboard_alert":
    case "missing_activity":
    case "weekly_performance": {
      // Daily/weekly broadcast to active opted-in users
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("is_banned", false)
        .eq("voice_notifications_enabled", true)
        .not("phone", "is", null)
        .limit(MAX_PER_EVENT_PER_RUN);
      return (data || []).map((r: any) => r.id);
    }
    case "trial_end": {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("is_trial", true)
        .gte("trial_end_date", nowIso)
        .lte("trial_end_date", new Date(Date.now() + 48 * 3600_000).toISOString())
        .limit(MAX_PER_EVENT_PER_RUN);
      return (data || []).map((r: any) => r.user_id);
    }
    case "premium_upgrade": {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("user_id")
        .eq("is_trial", true)
        .lte("trial_end_date", nowIso)
        .gte("trial_end_date", hoursAgo(24))
        .limit(MAX_PER_EVENT_PER_RUN);
      return (data || []).map((r: any) => r.user_id);
    }
    default:
      return [];
  }
}

async function passesCooldown(eventKey: string, userId: string, hours: number): Promise<boolean> {
  const cutoff = new Date(Date.now() - hours * 3600_000).toISOString();
  const { data } = await supabase
    .from("voice_broadcast_event_logs")
    .select("id")
    .eq("event_key", eventKey)
    .eq("user_id", userId)
    .gte("sent_at", cutoff)
    .limit(1);
  return !data || data.length === 0;
}

async function callVoiceBroadcast(payload: Record<string, unknown>): Promise<any> {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/voice-broadcast`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${SERVICE_ROLE}`,
    },
    body: JSON.stringify(payload),
  });
  return await res.json().catch(() => ({}));
}

async function processEvent(ev: EventRow): Promise<{ event_key: string; attempted: number; sent: number; skipped: number; reasons: Record<string, number> }> {
  const reasons: Record<string, number> = {};
  let sent = 0, skipped = 0;

  if (!ev.is_active || !ev.voice_prompt_id) {
    return { event_key: ev.event_key, attempted: 0, sent: 0, skipped: 0, reasons: { inactive: 1 } };
  }
  if (!inSendWindow(ev.send_window_start, ev.send_window_end)) {
    return { event_key: ev.event_key, attempted: 0, sent: 0, skipped: 0, reasons: { outside_window: 1 } };
  }
  if (ev.event_key === "weekly_performance" && istWeekday() !== 0) {
    return { event_key: ev.event_key, attempted: 0, sent: 0, skipped: 0, reasons: { not_sunday: 1 } };
  }

  // 1. Resolve eligible users
  const candidates = await eligibleUserIds(ev.event_key);

  // 2. Filter by cooldown (per-user enforcement preserved)
  const eligible: string[] = [];
  for (const userId of candidates) {
    if (await passesCooldown(ev.event_key, userId, ev.cooldown_hours)) {
      eligible.push(userId);
    } else {
      skipped++; reasons.cooldown = (reasons.cooldown || 0) + 1;
    }
  }

  if (eligible.length === 0) {
    return { event_key: ev.event_key, attempted: candidates.length, sent: 0, skipped, reasons };
  }

  // 3. ONE batched OBD campaign for all eligible users (avoids hourly campaign cap)
  const resp = await callVoiceBroadcast({
    action: "send_event_batch",
    event_key: ev.event_key,
    user_ids: eligible,
    prompt_id: ev.voice_prompt_id,
  });

  if (resp?.ok) {
    sent = Number(resp?.recipients ?? eligible.length);
  } else {
    skipped += eligible.length;
    const key = resp?.reason || resp?.message || "unknown";
    reasons[key] = (reasons[key] || 0) + eligible.length;
  }

  return { event_key: ev.event_key, attempted: candidates.length, sent, skipped, reasons };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => ({}));
    const onlyEvent: string | undefined = body.event_key;

    // Master kill-switch via voice_broadcast_config
    const { data: cfg } = await supabase.from("voice_broadcast_config").select("is_enabled").maybeSingle();
    if (cfg && cfg.is_enabled === false) {
      return json({ ok: true, skipped: true, reason: "broadcast_disabled" });
    }

    let q = supabase.from("voice_broadcast_event_voices").select("*").eq("is_active", true);
    if (onlyEvent) q = q.eq("event_key", onlyEvent);
    const { data: events } = await q;

    const results = [];
    let obdHourlyCapHit = false;
    for (const ev of (events || []) as EventRow[]) {
      if (obdHourlyCapHit) {
        results.push({ event_key: ev.event_key, attempted: 0, sent: 0, skipped: 0, reasons: { deferred_obd_hourly_cap: 1 } });
        continue;
      }
      try {
        const r = await processEvent(ev);
        results.push(r);
        // Detect OBD provider hourly cap — stop remaining events this run
        if (Object.keys(r.reasons || {}).some((k) => /hourly\s*limit/i.test(k))) {
          obdHourlyCapHit = true;
        }
      } catch (e) {
        results.push({ event_key: ev.event_key, error: (e as Error).message });
      }
    }

    return json({ ok: true, ran_at: new Date().toISOString(), obd_hourly_cap_hit: obdHourlyCapHit, results });
  } catch (e) {
    return json({ ok: false, error: (e as Error).message }, 500);
  }
});
