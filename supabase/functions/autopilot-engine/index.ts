import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const body = await req.json();
    const { action } = body;
    const userId = user.id;

    // Handle toggle and status BEFORE guards so they work even when disabled
    if (action === "toggle_user_autopilot") {
      const enabled = body.enabled ?? true;
      await supabase.from("user_autopilot_preferences").upsert({
        user_id: userId,
        autopilot_enabled: enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });
      return json({ status: "ok", autopilot_enabled: enabled });
    }

    if (action === "get_status") {
      return await getStatus(supabase, userId);
    }

    if (action === "complete_session") {
      return await completeSession(supabase, userId, body.slot);
    }

    // Load global config
    const { data: config } = await supabase.from("autopilot_config").select("*").limit(1).single();
    if (!config?.is_enabled) {
      return json({ status: "disabled", message: "Autopilot is globally disabled" });
    }

    // Load user prefs
    const { data: prefs } = await supabase.from("user_autopilot_preferences")
      .select("*").eq("user_id", userId).maybeSingle();

    if (prefs && !prefs.autopilot_enabled) {
      return json({ status: "user_disabled", message: "Autopilot disabled by user" });
    }

    const intensity = prefs?.preferred_intensity || config.intensity_level || "balanced";
    const maxSessions = prefs?.max_sessions_per_day || config.max_daily_auto_sessions || 6;

    if (action === "generate_daily_plan") {
      return await generateDailyPlan(supabase, userId, config, intensity, maxSessions);
    }

    if (action === "check_emergency") {
      return await checkEmergency(supabase, userId, config);
    }

    if (action === "get_next_mode") {
      return await getNextMode(supabase, userId, intensity);
    }

    return json({ error: "Unknown action" }, 400);
  } catch (e) {
    console.error("autopilot-engine error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});

function json(data: any, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════
// GENERATE DAILY PLAN
// ═══════════════════════════════════════
async function generateDailyPlan(
  supabase: any, userId: string, config: any, intensity: string, maxSessions: number
) {
  const today = new Date().toISOString().split("T")[0];

  // Check if plan already exists for today
  const { data: existing } = await supabase.from("autopilot_sessions")
    .select("*").eq("user_id", userId).eq("session_date", today).maybeSingle();

  if (existing) {
    return json({ status: "exists", session: existing });
  }

  // Load user data for intelligent scheduling
  const [topicsRes, twinRes, streakRes] = await Promise.all([
    supabase.from("memory_scores").select("topic_id, memory_strength, last_reviewed_at, topics(name)")
      .eq("user_id", userId).order("memory_strength", { ascending: true }).limit(20),
    supabase.from("cognitive_twins").select("optimal_study_hour, optimal_session_duration, fatigue_threshold_minutes")
      .eq("user_id", userId).maybeSingle(),
    supabase.from("study_streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
  ]);

  const weakTopics = topicsRes.data || [];
  const twin = twinRes.data;
  const streak = streakRes.data;

  // Intensity multipliers
  const intensityMap: Record<string, { sessions: number; durationMin: number }> = {
    gentle: { sessions: Math.min(3, maxSessions), durationMin: 15 },
    balanced: { sessions: Math.min(4, maxSessions), durationMin: 20 },
    intense: { sessions: Math.min(5, maxSessions), durationMin: 25 },
    beast: { sessions: Math.min(6, maxSessions), durationMin: 30 },
  };

  const plan = intensityMap[intensity] || intensityMap.balanced;
  const optimalHour = twin?.optimal_study_hour || 9;
  const sessionDuration = twin?.optimal_session_duration || plan.durationMin;

  // Build schedule: alternate modes based on topic health
  const schedule = [];
  const criticalTopics = weakTopics.filter((t: any) => t.memory_strength < 40);
  const decayingTopics = weakTopics.filter((t: any) => t.memory_strength >= 40 && t.memory_strength < 70);

  for (let i = 0; i < plan.sessions; i++) {
    const hour = optimalHour + i;
    let mode = "revision";
    let topic = weakTopics[i % weakTopics.length];

    if (i === 0 && criticalTopics.length > 0) {
      mode = "focus";
      topic = criticalTopics[0];
    } else if (i === plan.sessions - 1) {
      mode = "mock";
      topic = null; // mock covers all
    } else if (criticalTopics.length > i) {
      mode = "focus";
      topic = criticalTopics[i];
    } else if (decayingTopics.length > 0) {
      mode = "revision";
      topic = decayingTopics[i % decayingTopics.length];
    }

    schedule.push({
      slot: i + 1,
      hour,
      time_label: `${hour > 12 ? hour - 12 : hour === 0 ? 12 : hour}:00 ${hour >= 12 ? "PM" : "AM"}`,
      mode,
      duration_minutes: mode === "mock" ? sessionDuration + 10 : sessionDuration,
      topic_id: topic?.topic_id || null,
      topic_name: topic?.topics?.name || "Mixed Review",
      reason: mode === "focus" ? "Critical decay risk"
        : mode === "mock" ? "Performance assessment"
        : "Memory reinforcement",
      completed: false,
    });
  }

  // Save session
  const { data: session, error } = await supabase.from("autopilot_sessions").insert({
    user_id: userId,
    session_date: today,
    planned_schedule: schedule,
    total_sessions: plan.sessions,
    performance_summary: {
      intensity,
      streak: streak?.current_streak || 0,
      critical_topics: criticalTopics.length,
      optimal_hour: optimalHour,
    },
  }).select().single();

  if (error) throw error;

  return json({
    status: "generated",
    session,
    next_session: schedule.find((s: any) => !s.completed) || null,
  });
}

// ═══════════════════════════════════════
// CHECK EMERGENCY
// ═══════════════════════════════════════
async function checkEmergency(supabase: any, userId: string, config: any) {
  if (!config.auto_emergency_enabled) {
    return json({ emergency: false, reason: "Auto-emergency disabled" });
  }

  const dropThreshold = config.emergency_drop_threshold || 15;
  const minStrength = config.emergency_min_memory_strength || 30;

  // Find topics with critical drops
  const { data: scores } = await supabase.from("memory_scores")
    .select("topic_id, memory_strength, previous_strength, topics(name)")
    .eq("user_id", userId)
    .lt("memory_strength", minStrength)
    .order("memory_strength", { ascending: true })
    .limit(5);

  const criticalTopics = (scores || []).filter((s: any) => {
    const drop = (s.previous_strength || 100) - s.memory_strength;
    return drop >= dropThreshold || s.memory_strength < 20;
  });

  if (criticalTopics.length === 0) {
    return json({ emergency: false, topics_checked: scores?.length || 0 });
  }

  const worstTopic = criticalTopics[0];

  // Mark today's autopilot session as emergency
  const today = new Date().toISOString().split("T")[0];
  await supabase.from("autopilot_sessions")
    .update({
      emergency_triggered: true,
      emergency_topic_id: worstTopic.topic_id,
    })
    .eq("user_id", userId)
    .eq("session_date", today);

  return json({
    emergency: true,
    trigger_topic: {
      id: worstTopic.topic_id,
      name: worstTopic.topics?.name || "Unknown",
      memory_strength: worstTopic.memory_strength,
      drop: (worstTopic.previous_strength || 100) - worstTopic.memory_strength,
    },
    critical_count: criticalTopics.length,
    action: "rescue_mode",
  });
}

// ═══════════════════════════════════════
// GET NEXT MODE (Auto Mode Switching)
// ═══════════════════════════════════════
async function getNextMode(supabase: any, userId: string, intensity: string) {
  const today = new Date().toISOString().split("T")[0];

  const { data: session } = await supabase.from("autopilot_sessions")
    .select("*").eq("user_id", userId).eq("session_date", today).maybeSingle();

  if (!session) {
    return json({ mode: "focus", reason: "No daily plan yet — defaulting to focus" });
  }

  const schedule = session.planned_schedule || [];
  const nextSlot = schedule.find((s: any) => !s.completed);

  if (!nextSlot) {
    return json({ mode: "completed", reason: "All sessions completed for today!" });
  }

  return json({
    mode: nextSlot.mode,
    topic_id: nextSlot.topic_id,
    topic_name: nextSlot.topic_name,
    duration_minutes: nextSlot.duration_minutes,
    slot: nextSlot.slot,
    total_slots: schedule.length,
    reason: nextSlot.reason,
  });
}

// ═══════════════════════════════════════
// GET STATUS
// ═══════════════════════════════════════
async function getStatus(supabase: any, userId: string) {
  const today = new Date().toISOString().split("T")[0];

  const [sessionRes, prefsRes, configRes] = await Promise.all([
    supabase.from("autopilot_sessions").select("*").eq("user_id", userId).eq("session_date", today).maybeSingle(),
    supabase.from("user_autopilot_preferences").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("autopilot_config").select("*").limit(1).single(),
  ]);

  const session = sessionRes.data;
  const prefs = prefsRes.data;
  const config = configRes.data;

  const schedule = session?.planned_schedule || [];
  const completed = schedule.filter((s: any) => s.completed).length;
  const next = schedule.find((s: any) => !s.completed);

  return json({
    globally_enabled: config?.is_enabled ?? true,
    user_enabled: prefs?.autopilot_enabled ?? true,
    intensity: prefs?.preferred_intensity || config?.intensity_level || "balanced",
    today: {
      has_plan: !!session,
      total_sessions: session?.total_sessions || 0,
      completed_sessions: completed,
      emergency_triggered: session?.emergency_triggered || false,
      next_session: next || null,
      progress_percent: session ? Math.round((completed / session.total_sessions) * 100) : 0,
    },
  });
}

// ═══════════════════════════════════════
// COMPLETE SESSION
// ═══════════════════════════════════════
async function completeSession(supabase: any, userId: string, slot?: number) {
  const today = new Date().toISOString().split("T")[0];

  const { data: session } = await supabase.from("autopilot_sessions")
    .select("*").eq("user_id", userId).eq("session_date", today).maybeSingle();

  if (!session) {
    return json({ error: "No session found for today" }, 404);
  }

  const schedule = session.planned_schedule || [];

  // Mark the specified slot (or first incomplete) as completed
  let marked = false;
  for (const s of schedule) {
    if (slot != null && s.slot === slot) {
      s.completed = true;
      marked = true;
      break;
    } else if (slot == null && !s.completed) {
      s.completed = true;
      marked = true;
      break;
    }
  }

  if (!marked) {
    return json({ status: "no_change", message: "No incomplete session to mark" });
  }

  const completedCount = schedule.filter((s: any) => s.completed).length;

  const { error } = await supabase.from("autopilot_sessions")
    .update({
      planned_schedule: schedule,
      completed_sessions: completedCount,
      updated_at: new Date().toISOString(),
    })
    .eq("id", session.id);

  if (error) throw error;

  return json({
    status: "completed",
    completed_sessions: completedCount,
    total_sessions: session.total_sessions,
    progress_percent: Math.round((completedCount / session.total_sessions) * 100),
  });
}
