import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-route, x-api-key, api-key, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const sanitizeNulls = (value: unknown): unknown => {
  if (value === null) return "";
  if (Array.isArray(value)) return value.map(sanitizeNulls);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>).map(([k, v]) => [k, sanitizeNulls(v)])
    );
  }
  return value;
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(sanitizeNulls(data)), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
const admin = createClient(supabaseUrl, serviceKey);

async function resolveUser(req: Request): Promise<string | null> {
  const auth = req.headers.get("authorization") ?? "";
  if (auth.startsWith("Bearer ")) {
    const token = auth.replace("Bearer ", "").trim();
    const { data } = await admin.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }
  const apiKeyCandidates = [
    req.headers.get("x-api-key"),
    req.headers.get("api-key"),
    req.headers.get("apikey"),
  ].filter(Boolean).map(k => k!.trim()).filter(Boolean);
  if (auth && !auth.startsWith("Bearer ")) apiKeyCandidates.push(auth.trim());

  for (const candidate of apiKeyCandidates) {
    const acryMatch = candidate.match(/acry_[A-Za-z0-9]+/)?.[0];
    if (acryMatch) {
      const storedPrefix = `${acryMatch.substring(0, 10)}...`;
      const { data: keyRow } = await admin.from("api_keys").select("created_by").eq("key_prefix", storedPrefix).eq("is_active", true).maybeSingle();
      if (keyRow?.created_by) return keyRow.created_by;
    }
    const { data: hashRow } = await admin.from("api_keys").select("created_by").eq("key_hash", candidate).eq("is_active", true).maybeSingle();
    if (hashRow?.created_by) return hashRow.created_by;
  }
  return null;
}

// ─── Helper: today's start ISO ───
const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
};

const clampNumber = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const toStrengthPercent = (value: unknown, fallback = 50) => {
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return fallback;
  if (num >= 0 && num <= 1) return Math.round(num * 100);
  return Math.round(clampNumber(num, 0, 100));
};

const toStrengthUnit = (value: unknown, fallback = 0.5) => {
  const fallbackPercent = clampNumber(Math.round(fallback * 100), 0, 100);
  return toStrengthPercent(value, fallbackPercent) / 100;
};

const getDifficultyFromStrength = (strengthPercent: number) =>
  strengthPercent < 30 ? "easy" : strengthPercent < 60 ? "medium" : "hard";

const getHealthFromStrength = (strengthPercent: number) =>
  strengthPercent < 30 ? "critical" : strengthPercent < 60 ? "moderate" : "strong";

const getRiskPercentage = (strengthPercent: number) =>
  clampNumber(100 - strengthPercent, 0, 100);

const getDaysToForget = (predictedDropDate?: string | null) => {
  if (!predictedDropDate) return null;
  const diffMs = new Date(predictedDropDate).getTime() - Date.now();
  if (!Number.isFinite(diffMs)) return null;
  return Math.max(0, Math.ceil(diffMs / 86400000));
};

const sumPhaseMinutes = (phases: Array<{ duration?: number; duration_minutes?: number }>) =>
  phases.reduce((sum, phase) => sum + Number(phase.duration ?? phase.duration_minutes ?? 0), 0);

const buildRevisionMetrics = ({
  topicCount,
  durationMinutes,
  cyclesCount,
  estGain,
  strengthPercent,
  predictedDropDate,
}: {
  topicCount: number;
  durationMinutes: number;
  cyclesCount: number;
  estGain: number;
  strengthPercent: number;
  predictedDropDate?: string | null;
}) => {
  const riskPercentage = getRiskPercentage(strengthPercent);
  return {
    topic_no: topicCount,
    topic_count: topicCount,
    duration_minutes: durationMinutes,
    duration_label: `${durationMinutes} min`,
    duration_cycles: cyclesCount,
    cycles_count: cyclesCount,
    est_gain: estGain,
    est_gain_label: `+${estGain}%`,
    risk_percentage: riskPercentage,
    risk_label: `${riskPercentage}% risk`,
    days_to_forget: getDaysToForget(predictedDropDate),
    predicted_drop_date: predictedDropDate || "",
  };
};

// ═══════════════════════════════════════════════════════════
//  ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════

// 1. INIT — Full Action Tab bootstrap (single call loads everything)
async function handleInit(userId: string) {
  const today = todayStart();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    recTopicsRes, sessionsRes, allTopicsRes, weekSessionsRes,
    tasksRes, completedCountRes, profileRes, predRes, subjectsRes
  ] = await Promise.all([
    // Recommended topics (weakest 5 for variety)
    admin.from("topics").select("id, name, memory_strength, subject_id, subjects(name)")
      .eq("user_id", userId).is("deleted_at", null)
      .order("memory_strength", { ascending: true }).limit(5),
    // Today's study sessions
    admin.from("study_logs").select("duration_minutes, confidence_level, created_at")
      .eq("user_id", userId).gte("created_at", today),
    // All topics for gains calc
    admin.from("topics").select("memory_strength").eq("user_id", userId).is("deleted_at", null),
    // Week sessions for chart
    admin.from("study_logs").select("duration_minutes, created_at")
      .eq("user_id", userId).gte("created_at", weekAgo),
    // Active tasks (top 3)
    admin.from("ai_recommendations").select("id, title, description, priority, type, topic_id")
      .eq("user_id", userId).eq("completed", false)
      .order("created_at", { ascending: false }).limit(3),
    // Completed today count
    admin.from("ai_recommendations").select("id", { count: "exact", head: true })
      .eq("user_id", userId).eq("completed", true).gte("created_at", today),
    // Profile for exam date
    admin.from("profiles").select("exam_date, exam_type").eq("id", userId).maybeSingle(),
    // Exam countdown prediction
    admin.from("exam_countdown_predictions").select("*").eq("user_id", userId).maybeSingle(),
    // Subjects count (fallback if no topics)
    admin.from("subjects").select("id, name").eq("user_id", userId).is("deleted_at", null).limit(5),
  ]);

  // ── Recommended Topic ──
  const recTopics = (recTopicsRes.data || []) as any[];
  const recTopic = recTopics[0] || null;
  let recommendedTopic: any;

  if (recTopic) {
    const strength = recTopic.memory_strength ?? 0;
    recommendedTopic = {
      id: recTopic.id,
      name: recTopic.name,
      subject: (recTopic as any).subjects?.name || "General",
      stability: Math.round(strength * 100),
      estimated_time: strength < 0.3 ? "25 min deep session"
        : strength < 0.6 ? "15 min review" : "10 min refresh",
      health: strength < 0.3 ? "critical" : strength < 0.6 ? "moderate" : "strong",
      strategy: strength < 0.3 ? "recovery" : strength < 0.6 ? "reinforcement" : "maintenance",
      reason: strength < 0.3
        ? "This topic is critically weak and needs immediate attention"
        : strength < 0.6
        ? "Below target stability — a quick review will strengthen retention"
        : "Maintenance review to keep memory fresh",
      alternatives: recTopics.slice(1).map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: (t as any).subjects?.name || "General",
        stability: Math.round((t.memory_strength ?? 0) * 100),
      })),
    };
  } else {
    // No topics exist — provide helpful fallback
    const userSubjects = (subjectsRes.data || []) as any[];
    recommendedTopic = {
      id: "",
      name: userSubjects.length > 0 ? "Add topics to get started" : "Set up your syllabus",
      subject: userSubjects.length > 0 ? userSubjects[0].name : "Getting Started",
      stability: 0,
      estimated_time: "5 min setup",
      health: "setup_required",
      strategy: "onboarding",
      reason: userSubjects.length > 0
        ? "You have subjects but no topics yet. Add topics to unlock AI-powered study recommendations."
        : "Set up your exam syllabus to get personalized study recommendations from the AI engine.",
      alternatives: [],
      is_empty: true,
      has_subjects: userSubjects.length > 0,
      subjects_count: userSubjects.length,
    };
  }

  // ── Today's Gains ──
  const sessions = (sessionsRes.data || []) as any[];
  const topics = (allTopicsRes.data || []) as any[];
  const weekSessions = (weekSessionsRes.data || []) as any[];

  const totalMin = sessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
  const count = sessions.length;
  const stabilityGain = Math.min(count * 2.5, 15);
  const weakTopics = topics.filter((t: any) => (t.memory_strength ?? 0) < 0.4).length;
  const totalTopics = topics.length || 1;
  const riskReduction = Math.min(count * 3, Math.round((1 - weakTopics / totalTopics) * 100));
  const rankChange = Math.min(count * 1.5, 10);

  const confMap: Record<string, number> = { high: 100, medium: 70, low: 40 };
  const focusScores = sessions.filter((s: any) => s.confidence_level).map((s: any) => confMap[s.confidence_level] || 50);
  const focusScore = focusScores.length > 0 ? Math.round(focusScores.reduce((a: number, b: number) => a + b, 0) / focusScores.length) : 0;

  // Weekly chart data
  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyData: { day: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    const mins = weekSessions
      .filter((s: any) => { const t = new Date(s.created_at).getTime(); return t >= dayStart.getTime() && t <= dayEnd.getTime(); })
      .reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
    weeklyData.push({ day: dayLabels[d.getDay()], value: mins });
  }
  let focusStreak = 0;
  for (let i = weeklyData.length - 1; i >= 0; i--) {
    if (weeklyData[i].value > 0) focusStreak++; else break;
  }

  // ── Active Tasks ──
  const activeTasks = (tasksRes.data || []).map((t: any) => ({
    ...t,
    estimated_minutes: t.priority === "critical" || t.priority === "high" ? 5 : t.priority === "medium" ? 4 : 3,
    impact_level: t.priority === "critical" || t.priority === "high" ? "high" : t.priority === "medium" ? "medium" : "low",
  }));
  const completedToday = completedCountRes.count || 0;

  // ── Exam Countdown ──
  const profile = profileRes.data as any;
  const prediction = predRes.data as any;
  let examCountdown: any = { phase: "no_exam", days_remaining: null, exam_date: null, locked_modes: [], lock_message: "", recommended_mode: "", can_bypass: false, is_enabled: false };

  if (profile?.exam_date) {
    const daysLeft = Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000);
    let phase = "normal";
    if (prediction) {
      if (daysLeft <= (prediction.predicted_lockdown_days ?? 3)) phase = "lockdown";
      else if (daysLeft <= (prediction.predicted_acceleration_days ?? 14)) phase = "acceleration";
    } else {
      if (daysLeft <= 3) phase = "lockdown";
      else if (daysLeft <= 14) phase = "acceleration";
    }
    const lockedModes = phase === "lockdown"
      ? (prediction?.locked_modes_lockdown ?? ["focus", "revision", "emergency"])
      : phase === "acceleration" ? (prediction?.locked_modes_acceleration ?? []) : [];

    examCountdown = {
      phase,
      days_remaining: daysLeft,
      exam_date: profile.exam_date,
      exam_type: profile.exam_type || "",
      locked_modes: lockedModes,
      lock_message: phase === "lockdown" ? (prediction?.lockdown_message ?? `${daysLeft} days to exam — only Mock & CA allowed`) : (prediction?.acceleration_message ?? ""),
      recommended_mode: phase === "lockdown" ? (prediction?.recommended_mode_lockdown ?? "mock") : (prediction?.recommended_mode_acceleration ?? "focus"),
      can_bypass: phase === "acceleration",
      is_enabled: true,
      ai_reasoning: prediction?.ai_reasoning ?? "",
      confidence: prediction?.confidence_score ?? 0,
    };
  }

  // ── Study Modes list (static metadata) ──
  const studyModes = [
    { id: "focus", title: "Focus Study Mode", description: "Deep Pomodoro sessions with distraction blocking. Maximum retention through spaced repetition.", duration: "25-50 min", gain: "+8-12% stability", is_locked: examCountdown.locked_modes.includes("focus") },
    { id: "revision", title: "AI Revision Mode", description: "AI picks your weakest topics for rapid micro-review. Smart spaced repetition at work.", duration: "5-15 min", gain: "+3-6% recall", is_locked: examCountdown.locked_modes.includes("revision") },
    { id: "mock", title: "Mock Practice Mode", description: "Simulate real exam conditions. Timed questions with instant AI-powered feedback.", duration: "15-30 min", gain: "+5-10% readiness", is_locked: examCountdown.locked_modes.includes("mock") },
    { id: "emergency", title: "Emergency Rescue Mode", description: "Memory crisis? AI runs rapid recall bursts + high-impact MCQ sprints to stabilize critical topics.", duration: "5-8 min", gain: "Emergency stabilization", is_locked: examCountdown.locked_modes.includes("emergency") },
    { id: "current-affairs", title: "Current Affairs Quiz", description: "AI-generated questions from latest news events. Stay exam-ready with daily current affairs practice.", duration: "5-10 min", gain: "+CA readiness", is_locked: examCountdown.locked_modes.includes("current-affairs") },
    { id: "intel-practice", title: "Exam Intel Practice", description: "AI-predicted high-probability questions. Practice what's most likely to appear in your exam.", duration: "10-20 min", gain: "+Prediction mastery", is_locked: examCountdown.locked_modes.includes("intel-practice") },
  ];

  return {
    recommended_topic: recommendedTopic,
    study_modes: studyModes,
    todays_gains: { stability_gain: stabilityGain, risk_reduction: riskReduction, rank_change: rankChange, focus_score: focusScore, focus_streak: focusStreak, study_minutes: totalMin, sessions_count: count, weekly_data: weeklyData },
    active_tasks: { tasks: activeTasks, completed_today: completedToday, daily_goal: 5 },
    exam_countdown: examCountdown,
  };
}

// 2. SESSION HISTORY — Focus session logs
async function handleSessionHistory(userId: string, body: any) {
  const limit = body.limit ?? 50;
  const mode = body.mode ?? "focus";

  const { data } = await admin.from("study_logs")
    .select("id, duration_minutes, confidence_level, created_at, subject_id, topic_id, notes, study_mode")
    .eq("user_id", userId).eq("study_mode", mode)
    .order("created_at", { ascending: false }).limit(limit);

  if (!data || data.length === 0) return { sessions: [], subjects: {}, topics: {} };

  const subjectIds = [...new Set(data.map((d: any) => d.subject_id).filter(Boolean))] as string[];
  const topicIds = [...new Set(data.map((d: any) => d.topic_id).filter(Boolean))] as string[];

  const [subjectsRes, topicsRes] = await Promise.all([
    subjectIds.length > 0 ? admin.from("subjects").select("id, name").in("id", subjectIds) : { data: [] },
    topicIds.length > 0 ? admin.from("topics").select("id, name").in("id", topicIds) : { data: [] },
  ]);

  const subjectMap = Object.fromEntries((subjectsRes.data || []).map((s: any) => [s.id, s.name]));
  const topicMap = Object.fromEntries((topicsRes.data || []).map((t: any) => [t.id, t.name]));

  return {
    sessions: data.map((d: any) => ({
      id: d.id,
      duration_minutes: d.duration_minutes,
      confidence_level: d.confidence_level || "",
      created_at: d.created_at,
      subject: subjectMap[d.subject_id] || "General",
      topic: topicMap[d.topic_id] || "",
      notes: d.notes || "",
      study_mode: d.study_mode || mode,
    })),
    subjects: subjectMap,
    topics: topicMap,
  };
}

// 3. START SESSION — Log session start
async function handleStartSession(userId: string, body: any) {
  const { mode, topic_id, subject_id } = body;
  if (!mode) return { error: "mode is required" };

  const { data, error } = await admin.from("study_logs").insert({
    user_id: userId,
    study_mode: mode,
    topic_id: topic_id || null,
    subject_id: subject_id || null,
    duration_minutes: 0,
    confidence_level: "medium",
  }).select("id, created_at").single();

  if (error) return { error: error.message };
  return { session_id: data.id, started_at: data.created_at };
}

// 4. END SESSION — Update session with duration and confidence
async function handleEndSession(userId: string, body: any) {
  const { session_id, duration_minutes, confidence_level, notes, topic_id, subject_id } = body;
  if (!session_id) return { error: "session_id is required" };

  const update: any = {};
  if (duration_minutes !== undefined) update.duration_minutes = duration_minutes;
  if (confidence_level) update.confidence_level = confidence_level;
  if (notes) update.notes = notes;
  if (topic_id) update.topic_id = topic_id;
  if (subject_id) update.subject_id = subject_id;

  const { error } = await admin.from("study_logs")
    .update(update).eq("id", session_id).eq("user_id", userId);

  if (error) return { error: error.message };

  // Update topic memory_strength on study completion
  if (topic_id && duration_minutes && duration_minutes > 0) {
    const { data: topic } = await admin.from("topics")
      .select("memory_strength").eq("id", topic_id).eq("user_id", userId).maybeSingle();
    if (topic) {
      const boost = Math.min(duration_minutes * 0.5, 15) / 100;
      const newStrength = Math.min(1, (topic.memory_strength ?? 0) + boost);
      await admin.from("topics").update({ memory_strength: newStrength, last_revision_date: new Date().toISOString() }).eq("id", topic_id);
    }
  }

  return { success: true };
}

// 5. LOG SESSION — Quick log without start/end flow
async function handleLogSession(userId: string, body: any) {
  const { mode, duration_minutes, confidence_level, topic_id, subject_id, notes } = body;
  if (!mode || !duration_minutes) return { error: "mode and duration_minutes are required" };

  const { data, error } = await admin.from("study_logs").insert({
    user_id: userId,
    study_mode: mode,
    duration_minutes,
    confidence_level: confidence_level || "medium",
    topic_id: topic_id || null,
    subject_id: subject_id || null,
    notes: notes || null,
  }).select("id").single();

  if (error) return { error: error.message };

  // Update topic strength
  if (topic_id && duration_minutes > 0) {
    const { data: topic } = await admin.from("topics")
      .select("memory_strength").eq("id", topic_id).eq("user_id", userId).maybeSingle();
    if (topic) {
      const boost = Math.min(duration_minutes * 0.5, 15) / 100;
      const newStrength = Math.min(1, (topic.memory_strength ?? 0) + boost);
      await admin.from("topics").update({ memory_strength: newStrength, last_revision_date: new Date().toISOString() }).eq("id", topic_id);
    }
  }

  return { success: true, session_id: data.id };
}

// 6. TASK COMPLETE — Mark AI recommendation as done
async function handleTaskComplete(userId: string, body: any) {
  const { task_id } = body;
  if (!task_id) return { error: "task_id is required" };

  const { error } = await admin.from("ai_recommendations")
    .update({ completed: true }).eq("id", task_id).eq("user_id", userId);

  if (error) return { error: error.message };
  return { success: true };
}

// 7. TOPIC EXPLORER — Subjects & topics with health data
async function handleTopicExplorer(userId: string, body: any) {
  const subjectId = body.subject_id;

  if (!subjectId) {
    // Return all subjects with aggregated topic health
    const { data: subjects } = await admin.from("subjects")
      .select("id, name").eq("user_id", userId).is("deleted_at", null)
      .order("name");

    if (!subjects || subjects.length === 0) return { subjects: [] };

    const { data: topics } = await admin.from("topics")
      .select("id, subject_id, memory_strength")
      .eq("user_id", userId).is("deleted_at", null);

    const topicsBySubject = new Map<string, any[]>();
    (topics || []).forEach((t: any) => {
      const arr = topicsBySubject.get(t.subject_id) || [];
      arr.push(t);
      topicsBySubject.set(t.subject_id, arr);
    });

    return {
      subjects: subjects.map((s: any) => {
        const sTopics = topicsBySubject.get(s.id) || [];
        const total = sTopics.length;
        const avgStrength = total > 0
          ? Math.round(sTopics.reduce((sum: number, t: any) => sum + (t.memory_strength ?? 0), 0) / total * 100)
          : 0;
        const critical = sTopics.filter((t: any) => (t.memory_strength ?? 0) < 0.3).length;
        const strong = sTopics.filter((t: any) => (t.memory_strength ?? 0) >= 0.7).length;
        return { id: s.id, name: s.name, topic_count: total, avg_strength: avgStrength, critical_count: critical, strong_count: strong };
      }),
    };
  }

  // Return topics for a specific subject
  const { data: topics } = await admin.from("topics")
    .select("id, name, memory_strength, last_revision_date, next_predicted_drop_date")
    .eq("user_id", userId).eq("subject_id", subjectId).is("deleted_at", null)
    .order("memory_strength", { ascending: true });

  return {
    topics: (topics || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      memory_strength: Math.round((t.memory_strength ?? 0) * 100),
      last_revision_date: t.last_revision_date || "",
      next_predicted_drop_date: t.next_predicted_drop_date || "",
      health: (t.memory_strength ?? 0) < 0.3 ? "critical" : (t.memory_strength ?? 0) < 0.6 ? "moderate" : "strong",
      strategy: (t.memory_strength ?? 0) < 0.3 ? "recovery"
        : (t.memory_strength ?? 0) < 0.6 ? "reinforcement" : "maintenance",
    })),
  };
}

// 8. TOPIC STRATEGY — AI strategy for a specific topic
async function handleTopicStrategy(userId: string, body: any) {
  const { topic_id } = body;
  if (!topic_id) return { error: "topic_id is required" };

  const { data: topic } = await admin.from("topics")
    .select("id, name, memory_strength, last_revision_date, subject_id, subjects(name)")
    .eq("id", topic_id).eq("user_id", userId).maybeSingle();

  if (!topic) return { error: "Topic not found" };

  const strength = (topic.memory_strength ?? 0) * 100;
  let strategy: any;

  if (strength < 30) {
    strategy = {
      level: "critical",
      steps: [
        { title: "Recall Burst", description: "Quick 5-min recall exercise to reactivate memory traces", mode: "emergency", duration: 5 },
        { title: "Deep Focus", description: "15-min focused review with active note-taking", mode: "focus", duration: 15 },
        { title: "Pressure Test", description: "10-min timed MCQ sprint to reinforce under pressure", mode: "mock", duration: 10 },
      ],
    };
  } else if (strength < 60) {
    strategy = {
      level: "moderate",
      steps: [
        { title: "Smart Review", description: "AI-guided revision targeting weak micro-concepts", mode: "revision", duration: 10 },
        { title: "Application Practice", description: "Apply concepts in mock scenarios", mode: "mock", duration: 15 },
        { title: "Spaced Recall", description: "Quick recall test to cement the improvement", mode: "revision", duration: 5 },
      ],
    };
  } else {
    strategy = {
      level: "strong",
      steps: [
        { title: "Maintenance Review", description: "Light 5-min review to keep memory fresh", mode: "revision", duration: 5 },
        { title: "Challenge Mode", description: "Advanced questions to deepen mastery", mode: "mock", duration: 10 },
        { title: "Cross-Link", description: "Connect this topic with related concepts", mode: "focus", duration: 10 },
      ],
    };
  }

  return {
    topic: {
      id: topic.id,
      name: topic.name,
      memory_strength: Math.round(strength),
      subject: (topic as any).subjects?.name || "General",
      last_revision_date: topic.last_revision_date || "",
    },
    strategy,
  };
}

// 9. QUESTIONS — Get AI-generated MCQs (proxies to ai-brain-agent)
async function handleQuestions(userId: string, body: any, authHeader: string) {
  const { topic_name, subject_name, difficulty, count, topic_id } = body;

  // If topic_id provided, resolve name
  let resolvedTopicName = topic_name;
  let resolvedSubjectName = subject_name;

  if (topic_id && !topic_name) {
    const { data: topic } = await admin.from("topics")
      .select("name, subject_id, subjects(name)")
      .eq("id", topic_id).eq("user_id", userId).maybeSingle();
    if (topic) {
      resolvedTopicName = topic.name;
      resolvedSubjectName = (topic as any).subjects?.name || subject_name || "General";
    }
  }

  // Call ai-brain-agent for questions
  const agentUrl = `${supabaseUrl}/functions/v1/ai-brain-agent`;
  const resp = await fetch(agentUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${serviceKey}`,
      "apikey": anonKey,
    },
    body: JSON.stringify({
      action: "mission_questions",
      user_id: userId,
      topic_name: resolvedTopicName,
      subject_name: resolvedSubjectName,
      difficulty: difficulty || "medium",
      count: count || 5,
    }),
  });

  const data = await resp.json();
  return data;
}

// 10. TODAYS GAINS — Standalone refresh
async function handleTodaysGains(userId: string) {
  const today = todayStart();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [sessionsRes, topicsRes, weekRes] = await Promise.all([
    admin.from("study_logs").select("duration_minutes, confidence_level, created_at").eq("user_id", userId).gte("created_at", today),
    admin.from("topics").select("memory_strength").eq("user_id", userId).is("deleted_at", null),
    admin.from("study_logs").select("duration_minutes, created_at").eq("user_id", userId).gte("created_at", weekAgo),
  ]);

  const sessions = (sessionsRes.data || []) as any[];
  const topics = (topicsRes.data || []) as any[];
  const weekSessions = (weekRes.data || []) as any[];

  const totalMin = sessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
  const count = sessions.length;
  const stabilityGain = Math.min(count * 2.5, 15);
  const weakTopics = topics.filter((t: any) => (t.memory_strength ?? 0) < 0.4).length;
  const totalTopics = topics.length || 1;
  const riskReduction = Math.min(count * 3, Math.round((1 - weakTopics / totalTopics) * 100));
  const rankChange = Math.min(count * 1.5, 10);

  const confMap: Record<string, number> = { high: 100, medium: 70, low: 40 };
  const focusScores = sessions.filter((s: any) => s.confidence_level).map((s: any) => confMap[s.confidence_level] || 50);
  const focusScore = focusScores.length > 0 ? Math.round(focusScores.reduce((a: number, b: number) => a + b, 0) / focusScores.length) : 0;

  const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const weeklyData: { day: string; value: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const dayStart2 = new Date(d); dayStart2.setHours(0, 0, 0, 0);
    const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
    const mins = weekSessions.filter((s: any) => { const t = new Date(s.created_at).getTime(); return t >= dayStart2.getTime() && t <= dayEnd.getTime(); }).reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
    weeklyData.push({ day: dayLabels[d.getDay()], value: mins });
  }
  let focusStreak = 0;
  for (let i = weeklyData.length - 1; i >= 0; i--) { if (weeklyData[i].value > 0) focusStreak++; else break; }

  return { stability_gain: stabilityGain, risk_reduction: riskReduction, rank_change: rankChange, focus_score: focusScore, focus_streak: focusStreak, study_minutes: totalMin, sessions_count: count, weekly_data: weeklyData };
}

// 11. DAILY SUMMARY — Quick stats
async function handleDailySummary(userId: string) {
  const today = todayStart();

  const [sessionsRes, missionRes] = await Promise.all([
    admin.from("study_logs").select("duration_minutes, study_mode, topic_id, confidence_level").eq("user_id", userId).gte("created_at", today),
    admin.from("brain_missions").select("id, status, mission_type").eq("user_id", userId).gte("created_at", today),
  ]);

  const sessions = (sessionsRes.data || []) as any[];
  const missions = (missionRes.data || []) as any[];

  const totalMin = sessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
  const topicsStudied = new Set(sessions.map((s: any) => s.topic_id).filter(Boolean)).size;
  const modeBreakdown: Record<string, number> = {};
  sessions.forEach((s: any) => { modeBreakdown[s.study_mode || "other"] = (modeBreakdown[s.study_mode || "other"] || 0) + (s.duration_minutes || 0); });

  return {
    total_minutes: totalMin,
    session_count: sessions.length,
    topics_studied: topicsStudied,
    mode_breakdown: modeBreakdown,
    missions_completed: missions.filter((m: any) => m.status === "completed").length,
    missions_active: missions.filter((m: any) => m.status === "active" || m.status === "in_progress").length,
  };
}

// 12. TOPICS LIST — Get all user topics (for mode selection)
async function handleTopicsList(userId: string, body: any) {
  const subjectId = body.subject_id;
  let query = admin.from("topics")
    .select("id, name, memory_strength, subject_id, last_revision_date")
    .eq("user_id", userId).is("deleted_at", null)
    .order("memory_strength", { ascending: true });

  if (subjectId) query = query.eq("subject_id", subjectId);

  const { data } = await query.limit(100);
  return {
    topics: (data || []).map((t: any) => ({
      id: t.id,
      name: t.name,
      memory_strength: Math.round((t.memory_strength ?? 0) * 100),
      subject_id: t.subject_id,
      last_revision_date: t.last_revision_date || "",
    })),
  };
}

// 13. SUBJECTS LIST
async function handleSubjectsList(userId: string) {
  const { data } = await admin.from("subjects")
    .select("id, name").eq("user_id", userId).is("deleted_at", null).order("name");
  return { subjects: data || [] };
}

// 14. RECOMMENDED NEXT — AI-powered next actions after focus session
async function handleRecommendedNext(userId: string, body: any) {
  const currentTopicId = body.topic_id || null;
  const currentMode = body.mode || "focus";
  const sessionMinutes = body.session_minutes || 0;

  const today = todayStart();

  const [
    weakTopicsRes, recentSessionsRes, missionsRes,
    todaySessionsRes, profileRes, currentTopicRes
  ] = await Promise.all([
    // Weakest topics (top 10)
    admin.from("topics")
      .select("id, name, memory_strength, subject_id, subjects(name), last_revision_date, next_predicted_drop_date")
      .eq("user_id", userId).is("deleted_at", null)
      .order("memory_strength", { ascending: true }).limit(10),
    // Recent sessions (last 5) to avoid recommending same topic
    admin.from("study_logs")
      .select("topic_id, study_mode, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(5),
    // Active missions
    admin.from("brain_missions")
      .select("id, title, description, mission_type, priority, target_topic_id, target_value, current_value, status, expires_at")
      .eq("user_id", userId).in("status", ["active", "in_progress"])
      .order("priority", { ascending: true }).limit(5),
    // Today's sessions for fatigue detection
    admin.from("study_logs")
      .select("duration_minutes, study_mode, created_at")
      .eq("user_id", userId).gte("created_at", today),
    // Profile for exam date
    admin.from("profiles")
      .select("exam_date, exam_type").eq("id", userId).maybeSingle(),
    // Current topic details (if provided)
    currentTopicId
      ? admin.from("topics")
          .select("id, name, memory_strength, subject_id, subjects(name)")
          .eq("id", currentTopicId).eq("user_id", userId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  const weakTopics = (weakTopicsRes.data || []) as any[];
  const recentSessions = (recentSessionsRes.data || []) as any[];
  const missions = (missionsRes.data || []) as any[];
  const todaySessions = (todaySessionsRes.data || []) as any[];
  const profile = profileRes.data as any;
  const currentTopic = currentTopicRes.data as any;

  // ── Fatigue detection ──
  const todayMinutes = todaySessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
  const todayCount = todaySessions.length;
  const isFatigued = todayMinutes > 120 || todayCount > 8;

  // ── Recently studied topic IDs (to deprioritize) ──
  const recentTopicIds = new Set(recentSessions.map((s: any) => s.topic_id).filter(Boolean));

  // ── Exam proximity ──
  let daysToExam: number | null = null;
  let examUrgency = "normal";
  if (profile?.exam_date) {
    daysToExam = Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000);
    if (daysToExam <= 3) examUrgency = "critical";
    else if (daysToExam <= 14) examUrgency = "high";
    else if (daysToExam <= 30) examUrgency = "moderate";
  }

  // ── Build recommended_next items ──
  const recommendations: any[] = [];

  // 1. Priority: Continue current topic if weak
  if (currentTopic && (currentTopic.memory_strength ?? 0) < 0.6) {
    const strength = Math.round((currentTopic.memory_strength ?? 0) * 100);
    recommendations.push({
      type: "continue_topic",
      priority: "high",
      title: `Continue: ${currentTopic.name}`,
      subtitle: `${strength}% stability — needs more reinforcement`,
      topic_id: currentTopic.id,
      topic_name: currentTopic.name,
      subject: (currentTopic as any).subjects?.name || "General",
      memory_strength: strength,
      recommended_mode: strength < 30 ? "emergency" : "revision",
      recommended_duration: strength < 30 ? 10 : 8,
      reason: strength < 30
        ? "Critical stability — emergency recall burst recommended"
        : "Below threshold — quick revision will lock in gains from this session",
      icon: "refresh-cw",
      color: strength < 30 ? "#EF4444" : "#F59E0B",
    });
  }

  // 2. Weakest unvisited topic
  const nextWeakTopic = weakTopics.find((t: any) =>
    t.id !== currentTopicId && !recentTopicIds.has(t.id) && (t.memory_strength ?? 0) < 0.5
  );
  if (nextWeakTopic) {
    const strength = Math.round((nextWeakTopic.memory_strength ?? 0) * 100);
    recommendations.push({
      type: "weak_topic",
      priority: strength < 20 ? "critical" : "high",
      title: `Rescue: ${nextWeakTopic.name}`,
      subtitle: `${strength}% stability — ${(nextWeakTopic as any).subjects?.name || "General"}`,
      topic_id: nextWeakTopic.id,
      topic_name: nextWeakTopic.name,
      subject: (nextWeakTopic as any).subjects?.name || "General",
      memory_strength: strength,
      recommended_mode: strength < 20 ? "emergency" : "focus",
      recommended_duration: strength < 20 ? 8 : 15,
      reason: strength < 20
        ? "Memory critical — immediate rescue needed before full decay"
        : "Weakest unstudied topic — high impact opportunity",
      icon: "alert-triangle",
      color: strength < 20 ? "#EF4444" : "#F97316",
    });
  }

  // 3. Topic about to drop (predicted drop date approaching)
  const droppingTopic = weakTopics.find((t: any) => {
    if (t.id === currentTopicId || recentTopicIds.has(t.id)) return false;
    if (!t.next_predicted_drop_date) return false;
    const dropDate = new Date(t.next_predicted_drop_date);
    const hoursUntilDrop = (dropDate.getTime() - Date.now()) / 3600000;
    return hoursUntilDrop > 0 && hoursUntilDrop < 48;
  });
  if (droppingTopic) {
    const strength = Math.round((droppingTopic.memory_strength ?? 0) * 100);
    const hoursLeft = Math.round((new Date(droppingTopic.next_predicted_drop_date).getTime() - Date.now()) / 3600000);
    recommendations.push({
      type: "dropping_soon",
      priority: "high",
      title: `Save: ${droppingTopic.name}`,
      subtitle: `Dropping in ${hoursLeft}h — ${strength}% stability`,
      topic_id: droppingTopic.id,
      topic_name: droppingTopic.name,
      subject: (droppingTopic as any).subjects?.name || "General",
      memory_strength: strength,
      recommended_mode: "revision",
      recommended_duration: 10,
      reason: `Memory predicted to drop within ${hoursLeft} hours — quick revision now prevents decay`,
      icon: "clock",
      color: "#F59E0B",
    });
  }

  // 4. Active mission progress
  const topMission = missions[0];
  if (topMission) {
    const progress = topMission.target_value
      ? Math.round(((topMission.current_value || 0) / topMission.target_value) * 100)
      : 0;
    recommendations.push({
      type: "mission",
      priority: "medium",
      title: `Mission: ${topMission.title}`,
      subtitle: `${progress}% complete${topMission.expires_at ? ` — expires ${new Date(topMission.expires_at).toLocaleDateString()}` : ""}`,
      mission_id: topMission.id,
      topic_id: topMission.target_topic_id || "",
      progress,
      recommended_mode: topMission.mission_type === "recall" ? "revision" : topMission.mission_type === "practice" ? "mock" : "focus",
      recommended_duration: 15,
      reason: "Active brain mission — completing this earns rewards and builds streaks",
      icon: "target",
      color: "#8B5CF6",
    });
  }

  // 5. Mode switch suggestion (if same mode too long)
  const recentModes = recentSessions.map((s: any) => s.study_mode);
  const sameModeSessions = recentModes.filter((m: string) => m === currentMode).length;
  if (sameModeSessions >= 3) {
    const suggestedMode = currentMode === "focus" ? "mock" : currentMode === "mock" ? "revision" : "focus";
    recommendations.push({
      type: "mode_switch",
      priority: "low",
      title: `Switch to ${suggestedMode === "mock" ? "Mock Practice" : suggestedMode === "revision" ? "Quick Revision" : "Focus Study"}`,
      subtitle: "Variety improves retention by 23%",
      recommended_mode: suggestedMode,
      recommended_duration: suggestedMode === "revision" ? 10 : 20,
      reason: `You've done ${sameModeSessions} ${currentMode} sessions in a row — switching modes activates different memory pathways`,
      icon: "shuffle",
      color: "#06B6D4",
    });
  }

  // 6. Break suggestion if fatigued
  if (isFatigued) {
    recommendations.push({
      type: "take_break",
      priority: "medium",
      title: "Take a Break",
      subtitle: `${todayMinutes} min studied today — rest boosts retention`,
      recommended_duration: 15,
      reason: `You've studied ${todayMinutes} minutes across ${todayCount} sessions today. Research shows short breaks improve long-term memory consolidation.`,
      icon: "coffee",
      color: "#10B981",
    });
  }

  // Sort by priority
  const priorityOrder: Record<string, number> = { critical: 0, high: 1, medium: 2, low: 3 };
  recommendations.sort((a, b) => (priorityOrder[a.priority] ?? 9) - (priorityOrder[b.priority] ?? 9));

  return {
    recommended_next: recommendations.slice(0, 5),
    context: {
      current_topic: currentTopic ? {
        id: currentTopic.id,
        name: currentTopic.name,
        memory_strength: Math.round((currentTopic.memory_strength ?? 0) * 100),
      } : null,
      session_minutes: sessionMinutes,
      today_total_minutes: todayMinutes,
      today_session_count: todayCount,
      is_fatigued: isFatigued,
      days_to_exam: daysToExam,
      exam_urgency: examUrgency,
      active_missions: missions.length,
    },
    meta: {
      generated_at: new Date().toISOString(),
      total_recommendations: recommendations.length,
    },
  };
}
// 14b. SESSION BLUEPRINT — Lightweight preview before starting (no session created)
async function handleSessionBlueprint(userId: string, body: any) {
  const { topic_id, mode } = body;
  const studyMode = mode || "focus";

  // ── Resolve topic ──
  let targetTopic: any = null;
  if (topic_id) {
    const { data } = await admin.from("topics")
      .select("id, name, memory_strength, subject_id, last_revision_date, next_predicted_drop_date, subjects(name)")
      .eq("id", topic_id).eq("user_id", userId).maybeSingle();
    targetTopic = data;
  } else {
    const recentRes = await admin.from("study_logs")
      .select("topic_id").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(3);
    const recentIds = (recentRes.data || []).map((r: any) => r.topic_id).filter(Boolean);
    const { data: candidates } = await admin.from("topics")
      .select("id, name, memory_strength, subject_id, last_revision_date, next_predicted_drop_date, subjects(name)")
      .eq("user_id", userId).is("deleted_at", null)
      .order("memory_strength", { ascending: true }).limit(5);
    targetTopic = (candidates || []).find((t: any) => !recentIds.includes(t.id)) || (candidates || [])[0] || null;
  }

  // ── Auto-create fallback topic if none exist ──
  if (!targetTopic) {
    const fallbackName = "General Practice";

    // Look for or create a default "General" subject for this user
    let subjectId: string | null = null;
    const { data: existingSubject } = await admin.from("subjects")
      .select("id").eq("name", "General").eq("user_id", userId).maybeSingle();
    
    if (existingSubject) {
      subjectId = existingSubject.id;
    } else {
      const { data: newSubject } = await admin.from("subjects")
        .insert({ name: "General", user_id: userId })
        .select("id").single();
      subjectId = newSubject?.id || null;
    }

    if (subjectId) {
      const { data: newTopic } = await admin.from("topics")
        .insert({
          user_id: userId,
          name: fallbackName,
          subject_id: subjectId,
          memory_strength: 0.5,
        })
        .select("id, name, memory_strength, subject_id, last_revision_date, next_predicted_drop_date, subjects(name)")
        .single();

      if (newTopic) {
        targetTopic = newTopic;
      }
    }
  }

  const strengthPct = targetTopic ? toStrengthPercent(targetTopic.memory_strength, 50) : 50;
  const difficulty = getDifficultyFromStrength(strengthPct);
  const topicName = targetTopic?.name || "General Practice";
  const subjectName = (targetTopic as any)?.subjects?.name || "General";

  // ── Mode-specific config ──
  const modeConfigs: Record<string, { duration: number; questionCount: number; phases: any[] }> = {
    focus: {
      duration: 30,
      questionCount: 10,
      phases: [
        { type: "recall", title: "Active Recall", description: "Retrieve key concepts from memory without aids", duration: 8, icon: "brain" },
        { type: "reinforcement", title: "Concept Reinforcement", description: "Strengthen weak neural pathways with targeted content", duration: 9, icon: "refresh-cw" },
        { type: "mcq", title: "Adaptive Assessment", description: "AI-calibrated questions matching your current level", duration: 9, icon: "target" },
        { type: "review", title: "Consolidation Review", description: "Lock in gains with spaced review of key takeaways", duration: 4, icon: "book-open" },
      ],
    },
    revision: {
      duration: 10,
      questionCount: 8,
      phases: [
        { type: "recall", title: "Quick Recall Scan", description: "Rapid retrieval of previously learned concepts", duration: 3, icon: "brain" },
        { type: "mcq", title: "Decay Check", description: "Test which memories have weakened since last review", duration: 4, icon: "target" },
        { type: "review", title: "Stability Lock", description: "Re-anchor fading memories for long-term retention", duration: 3, icon: "book-open" },
      ],
    },
    mock: {
      duration: 30,
      questionCount: 15,
      phases: [
        { type: "mcq", title: "Simulated Exam", description: "Timed exam-condition questions with negative marking", duration: 25, icon: "target" },
        { type: "review", title: "Performance Analysis", description: "Detailed breakdown of accuracy, speed, and weak areas", duration: 5, icon: "bar-chart" },
      ],
    },
    emergency: {
      duration: 8,
      questionCount: 6,
      phases: [
        { type: "detection", title: "Crisis Detection", description: "AI scans your memory health to identify critical-risk topics", duration: 0.5, icon: "alert-triangle", emoji: "🔴" },
        { type: "emotional-reset", title: "Emotional Reset", description: "Guided breathing exercise to calm anxiety before rescue", duration: 1, icon: "wind", emoji: "🧘" },
        { type: "recall", title: "Phase 1 · Critical Recall", description: "Rapid 45-second recall bursts for each crisis topic", duration: 2, icon: "brain", emoji: "⚡" },
        { type: "mcq", title: "Phase 2 · High-Impact MCQ", description: "Targeted questions to test and reinforce critical memories", duration: 2.5, icon: "target", emoji: "🎯" },
        { type: "confidence-lock", title: "Phase 3 · Confidence Lock", description: "Lock recovered knowledge into long-term memory", duration: 0.5, icon: "shield", emoji: "🛡️" },
        { type: "stability-recovery", title: "Stability Recovery", description: "Animated stability gain visualization and scoring", duration: 1, icon: "heart-pulse", emoji: "💚" },
        { type: "recovery-plan", title: "Mission Complete", description: "AI-generated recovery plan with next steps", duration: 0.5, icon: "trophy", emoji: "🏆" },
      ],
    },
    "current-affairs": {
      duration: 15,
      questionCount: 10,
      phases: [
        { type: "mcq", title: "Current Affairs Quiz", description: "Recent events mapped to exam syllabus topics", duration: 10, icon: "globe" },
        { type: "review", title: "Exam Relevance Review", description: "Connect current events to likely exam questions", duration: 5, icon: "book-open" },
      ],
    },
    "intel-practice": {
      duration: 20,
      questionCount: 10,
      phases: [
        { type: "mcq", title: "High-Probability Questions", description: "AI-predicted most likely exam questions based on patterns", duration: 15, icon: "trending-up" },
        { type: "review", title: "Intel Debrief", description: "Strategic insights on exam readiness and gaps", duration: 5, icon: "shield" },
      ],
    },
  };

  const config = modeConfigs[studyMode] || modeConfigs.focus;

  // ── Expected outcomes ──
  const stabilityGainMin = strengthPct < 30 ? 8 : strengthPct < 60 ? 5 : 3;
  const stabilityGainMax = strengthPct < 30 ? 15 : strengthPct < 60 ? 12 : 8;
  const rankImpactMin = strengthPct < 30 ? 150 : strengthPct < 60 ? 80 : 30;
  const rankImpactMax = strengthPct < 30 ? 400 : strengthPct < 60 ? 200 : 100;

  // ── Profile for exam context ──
  const { data: profile } = await admin.from("profiles")
    .select("exam_date, exam_type").eq("id", userId).maybeSingle();
  const daysToExam = profile?.exam_date
    ? Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000) : null;

  const revisionMetrics = buildRevisionMetrics({
    topicCount: 1,
    durationMinutes: config.duration,
    cyclesCount: config.phases.length,
    estGain: stabilityGainMin,
    strengthPercent: strengthPct,
    predictedDropDate: targetTopic?.next_predicted_drop_date || null,
  });

  // ── Mock-specific: target percentile based on strength ──
  const targetPercentile = strengthPct >= 70 ? "Top 15%" : strengthPct >= 50 ? "Top 30%" : strengthPct >= 30 ? "Top 45%" : "Top 60%";

  return {
    blueprint: {
      mode: studyMode,
      mode_label: studyMode === "focus" ? "Focus Study Mode"
        : studyMode === "revision" ? "AI Revision Mode"
        : studyMode === "mock" ? "Mock Exam Blueprint"
        : studyMode === "emergency" ? "Emergency Rescue Mode"
        : studyMode === "current-affairs" ? "Current Affairs Quiz"
        : studyMode === "intel-practice" ? "Exam Intel Practice"
        : "Study Session",
      description: studyMode === "focus" ? "4-phase deep work blueprint"
        : studyMode === "revision" ? "Decay stabilization protocol"
        : studyMode === "mock" ? "AI-generated competitive challenge"
        : studyMode === "emergency" ? "Critical memory rescue"
        : studyMode === "current-affairs" ? "Exam-mapped current events"
        : studyMode === "intel-practice" ? "AI-predicted exam questions"
        : "AI-powered study session",
    },
    ai_selected_topic: {
      id: targetTopic?.id || "",
      name: topicName,
      subject: subjectName,
      memory_strength: strengthPct,
      stability_label: `${strengthPct}% stable`,
      revision_count: 0,
      last_revision_date: targetTopic?.last_revision_date || "",
      predicted_drop_date: targetTopic?.next_predicted_drop_date || "",
      risk_percentage: revisionMetrics.risk_percentage,
      risk_label: revisionMetrics.risk_label,
      days_to_forget: revisionMetrics.days_to_forget,
    },
    topics_selected: [{
      name: topicName,
      subject: subjectName,
      stability: strengthPct,
      stability_label: `${strengthPct}% stable`,
    }],
    session_config: {
      duration_minutes: config.duration,
      difficulty,
      difficulty_label: difficulty.charAt(0).toUpperCase() + difficulty.slice(1),
      total_phases: config.phases.length,
      total_questions: config.questionCount,
      scoring: studyMode === "mock"
        ? { correct: 4, incorrect: -1, unanswered: 0, negative_marking: true }
        : { correct: 4, incorrect: -1, unanswered: 0 },
      cycles_count: revisionMetrics.cycles_count,
      duration_cycles: revisionMetrics.duration_cycles,
    },
    ...(studyMode === "mock" ? {
      mock_config: {
        target_percentile: targetPercentile,
        target_label: `Target: ${targetPercentile}`,
        target_description: "Based on your current brain data",
        negative_marking: true,
        strict_timer: true,
        no_hints: true,
        show_explanation_after_submit: true,
        total_marks: config.questionCount * 4,
        passing_marks: Math.round(config.questionCount * 4 * 0.4),
      },
    } : {}),
    ...(studyMode === "emergency" ? await (async () => {
      // Fetch top 3 weakest crisis topics for emergency mode
      const { data: crisisTopics } = await admin.from("topics")
        .select("id, name, memory_strength, subject_id, subjects(name), last_revision_date, next_predicted_drop_date")
        .eq("user_id", userId).is("deleted_at", null)
        .order("memory_strength", { ascending: true }).limit(3);

      const crisisTargets = (crisisTopics || []).map((t: any) => {
        const ms = toStrengthPercent(t.memory_strength, 0);
        return {
          id: t.id,
          name: t.name,
          subject: (t as any).subjects?.name || "General",
          memory_strength: ms,
          stability_label: `${ms}% stable`,
          risk_level: ms < 25 ? "critical" : ms < 45 ? "high" : "medium",
          risk_label: ms < 25 ? "🔴 Critical" : ms < 45 ? "🟠 High Risk" : "🟡 Moderate",
          last_revision_date: t.last_revision_date || "",
          predicted_drop_date: t.next_predicted_drop_date || "",
          days_to_forget: getDaysToForget(t.next_predicted_drop_date),
        };
      });
      const avgStrength = crisisTargets.length > 0
        ? Math.round(crisisTargets.reduce((s: number, t: any) => s + t.memory_strength, 0) / crisisTargets.length)
        : strengthPct;
      const intensity = avgStrength < 20 ? "severe" : avgStrength < 40 ? "moderate" : "mild";

      return {
        emergency_config: {
          crisis_intensity: intensity,
          crisis_intensity_label: intensity === "severe" ? "🔴 Severe Crisis" : intensity === "moderate" ? "🟠 Moderate Crisis" : "🟡 Mild Crisis",
          crisis_description: intensity === "severe"
            ? "Critical memory collapse detected — immediate stabilization required"
            : intensity === "moderate"
            ? "Significant memory decay — rescue protocol initiated"
            : "Early warning signs — preventive stabilization recommended",
          crisis_topics: crisisTargets,
          crisis_topics_count: crisisTargets.length,
          avg_stability: avgStrength,
          avg_stability_label: `${avgStrength}% average stability`,
          total_stages: 7,
          stages: ["detection", "emotional-reset", "phase1-recall", "phase2-mcq", "phase3-confidence", "stability-recovery", "recovery-plan"],
          stage_labels: {
            detection: "🔴 Crisis Detection",
            "emotional-reset": "🧘 Emotional Reset",
            "phase1-recall": "⚡ Critical Recall",
            "phase2-mcq": "🎯 High-Impact MCQ",
            "phase3-confidence": "🛡️ Confidence Lock",
            "stability-recovery": "💚 Stability Recovery",
            "recovery-plan": "🏆 Mission Complete",
          },
          recall_config: {
            duration_seconds_per_topic: 45,
            total_recall_topics: crisisTargets.length,
            total_recall_time_seconds: crisisTargets.length * 45,
            instructions: "Recall everything you know about each topic in 45 seconds. Write/think as fast as possible.",
          },
          mcq_config: {
            questions_per_topic: 2,
            total_questions: crisisTargets.length * 2,
            difficulty: intensity === "severe" ? "easy" : "medium",
            show_explanation_after_answer: true,
            scoring: { correct: 4, incorrect: 0, unanswered: 0, negative_marking: false },
          },
          breathing_config: {
            steps: ["Breathe in...", "Hold...", "Breathe out...", "Relax..."],
            cycle_duration_ms: 2000,
            total_cycles: 2,
            total_duration_seconds: 16,
            skip_allowed: true,
          },
          confidence_lock: {
            description: "Lock recovered knowledge into long-term memory",
            requires_mcq_completion: true,
          },
          estimated_stability_gain: intensity === "severe" ? "+15-25%" : intensity === "moderate" ? "+10-18%" : "+5-12%",
          estimated_duration_minutes: intensity === "severe" ? 8 : intensity === "moderate" ? 6 : 5,
          features: {
            voice_guidance: true,
            confetti_on_complete: true,
            animated_stability_bar: true,
            recovery_plan_generation: true,
            scan_line_animation: true,
            pulse_danger_glow: true,
          },
        },
        crisis_topics: crisisTargets,
      };
    })() : {}),
    expected_outcomes: {
      stability_gain: `+${stabilityGainMin}-${stabilityGainMax}%`,
      stability_gain_min: stabilityGainMin,
      stability_gain_max: stabilityGainMax,
      rank_impact: `+${rankImpactMin}-${rankImpactMax} ranks`,
      rank_impact_min: rankImpactMin,
      rank_impact_max: rankImpactMax,
      current_stability: strengthPct,
      projected_stability: Math.min(100, strengthPct + stabilityGainMax),
      est_gain: revisionMetrics.est_gain,
      est_gain_label: revisionMetrics.est_gain_label,
    },
    session_phases: config.phases,
    total_questions: config.questionCount,
    time_limit_minutes: config.duration,
    time_limit_label: `${config.duration} min`,
    questions_label: `${config.questionCount} Questions`,
    topic_no: revisionMetrics.topic_no,
    duration_minutes: revisionMetrics.duration_minutes,
    duration_cycles: revisionMetrics.duration_cycles,
    est_gain: revisionMetrics.est_gain,
    risk_percentage: revisionMetrics.risk_percentage,
    revision_metrics: revisionMetrics,
    exam_context: {
      exam_type: profile?.exam_type || "",
      days_to_exam: daysToExam,
      urgency: daysToExam !== null ? (daysToExam <= 7 ? "critical" : daysToExam <= 30 ? "high" : daysToExam <= 90 ? "moderate" : "low") : "unknown",
    },
    cta: {
      label: studyMode === "focus" ? "Enter Focus Mode"
        : studyMode === "revision" ? "Start Revision"
        : studyMode === "mock" ? "Begin Mock Exam"
        : studyMode === "emergency" ? "Launch Rescue"
        : studyMode === "current-affairs" ? "Start Quiz"
        : studyMode === "intel-practice" ? "Start Practice"
        : "Start Session",
      next_action: "start-focus-session",
      payload: { mode: studyMode, topic_id: targetTopic?.id || null },
    },
    meta: {
      generated_at: new Date().toISOString(),
    },
  };
}

// 15. START FOCUS SESSION — Full bootstrap: creates session + fetches questions + topic context
async function handleStartFocusSession(userId: string, body: any, authHeader: string) {
  const { topic_id, mode, duration_minutes } = body;
  if (!mode) return { error: "mode is required" };

  // ── Resolve topic (use provided or auto-pick weakest) ──
  let targetTopic: any = null;
  let resolvedTopicId = topic_id || null;

  if (topic_id) {
    const { data } = await admin.from("topics")
      .select("id, name, memory_strength, next_predicted_drop_date, subject_id, subjects(name)")
      .eq("id", topic_id).eq("user_id", userId).maybeSingle();
    targetTopic = data;
  } else {
    const recentRes = await admin.from("study_logs")
      .select("topic_id").eq("user_id", userId)
      .order("created_at", { ascending: false }).limit(3);
    const recentIds = (recentRes.data || []).map((r: any) => r.topic_id).filter(Boolean);

    const { data: candidates } = await admin.from("topics")
      .select("id, name, memory_strength, next_predicted_drop_date, subject_id, subjects(name)")
      .eq("user_id", userId).is("deleted_at", null)
      .order("memory_strength", { ascending: true }).limit(5);
    targetTopic = (candidates || []).find((t: any) => !recentIds.includes(t.id)) || (candidates || [])[0] || null;
  }

  if (targetTopic) resolvedTopicId = targetTopic.id;

  // ── Create study session log ──
  const { data: session, error: sessionErr } = await admin.from("study_logs").insert({
    user_id: userId,
    study_mode: mode,
    topic_id: resolvedTopicId,
    subject_id: targetTopic?.subject_id || null,
    duration_minutes: 0,
    confidence_level: "medium",
  }).select("id, created_at").single();

  if (sessionErr) return { error: sessionErr.message };

  // ── Fetch questions via ai-brain-agent ──
  let questions: any[] = [];
  const topicName = targetTopic?.name || "General";
  const subjectName = (targetTopic as any)?.subjects?.name || "General";
  const strengthPct = targetTopic ? toStrengthPercent(targetTopic.memory_strength, 50) : 50;
  const difficulty = getDifficultyFromStrength(strengthPct);
  const questionCount = mode === "mock" ? 15 : mode === "emergency" ? 6 : mode === "revision" ? 8 : 10;

  try {
    const agentUrl = `${supabaseUrl}/functions/v1/ai-brain-agent`;
    const resp = await fetch(agentUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${serviceKey}`,
        "apikey": anonKey,
      },
      body: JSON.stringify({
        action: "mission_questions",
        user_id: userId,
        topic_name: topicName,
        subject_name: subjectName,
        difficulty,
        count: questionCount,
      }),
    });
    const agentData = await resp.json();
    questions = Array.isArray(agentData?.questions) ? agentData.questions : [];
  } catch (e) {
    console.error("Failed to fetch questions from ai-brain-agent:", e);
  }

  // ── Ensure questions have proper structure ──
  questions = questions.map((q: any, idx: number) => ({
    id: q.id || `q_${idx}_${Date.now()}`,
    question_text: q.question || q.question_text || "",
    options: Array.isArray(q.options) ? q.options : [],
    correct_answer_index: typeof q.correct_answer_index === "number" ? q.correct_answer_index
      : typeof q.correct_index === "number" ? q.correct_index
      : typeof q.correct_answer === "number" ? q.correct_answer
      : Array.isArray(q.options) && typeof q.correct_answer === "string" ? q.options.indexOf(q.correct_answer) : 0,
    explanation: q.explanation || "",
    difficulty: q.difficulty || difficulty,
    marks: q.marks || 1,
    topic_name: topicName,
    subject_name: subjectName,
  }));

  // ── Session config ──
  const sessionConfig = {
    total_questions: questions.length,
    time_limit_seconds: mode === "emergency" ? 300
      : mode === "revision" ? 600
      : mode === "mock" ? 1800
      : (duration_minutes || 25) * 60,
    mode,
    scoring: { correct: 4, incorrect: -1, unanswered: 0 },
    features: {
      show_explanation_after_answer: mode !== "mock",
      show_correct_answer: mode !== "mock",
      allow_skip: true,
      show_timer: true,
      show_progress: true,
      auto_submit_on_timeout: true,
    },
  };

  // ── Topic context for UI ──
  const topicContext = targetTopic ? {
    id: targetTopic.id,
    name: targetTopic.name,
    subject: (targetTopic as any).subjects?.name || "General",
    memory_strength: strengthPct,
    health: getHealthFromStrength(strengthPct),
    strategy: strengthPct < 30 ? "recovery" : strengthPct < 60 ? "reinforcement" : "maintenance",
    risk_percentage: getRiskPercentage(strengthPct),
    predicted_drop_date: targetTopic.next_predicted_drop_date || "",
    days_to_forget: getDaysToForget(targetTopic.next_predicted_drop_date || null),
  } : {
    id: session.id,
    name: "General Practice",
    subject: "General",
    memory_strength: 50,
    health: "moderate",
    strategy: "reinforcement",
  };

  // ── Session phases ──
  const stabilityPct = strengthPct;
  const sessionPhases = mode === "mock"
    ? [
        { phase: 1, type: "exam", title: "Simulated Exam", duration_minutes: 25, description: `Timed exam-condition MCQs with negative marking on ${topicName}` },
        { phase: 2, type: "analysis", title: "Performance Analysis", duration_minutes: 5, description: "Detailed breakdown of accuracy, speed, and weak areas" },
      ]
    : mode === "revision"
    ? [
        { phase: 1, type: "recall", title: "Quick Recall Scan", duration_minutes: 3, description: `Rapid retrieval of ${topicName}` },
        { phase: 2, type: "assessment", title: "Decay Check", duration_minutes: 4, description: "Test which memories have weakened since last review" },
        { phase: 3, type: "review", title: "Stability Lock", duration_minutes: 3, description: "Re-anchor fading memories for long-term retention" },
      ]
    : [
        { phase: 1, type: "recall", title: "Active Recall", duration_minutes: mode === "emergency" ? 2 : 8, description: `Recall key concepts from ${topicName}` },
        { phase: 2, type: "reinforcement", title: "Concept Reinforcement", duration_minutes: mode === "emergency" ? 2 : 9, description: "Strengthen weak connections through targeted questions" },
        { phase: 3, type: "assessment", title: "Adaptive Assessment", duration_minutes: mode === "emergency" ? 1 : 5, description: "AI-calibrated difficulty based on your performance" },
        { phase: 4, type: "review", title: "Review & Consolidate", duration_minutes: mode === "emergency" ? 0 : 3, description: "Solidify learning with spaced review" },
      ].filter(p => p.duration_minutes > 0);

  const stabilityGainMin = stabilityPct < 30 ? 12 : stabilityPct < 60 ? 8 : 4;
  const stabilityGainMax = stabilityPct < 30 ? 22 : stabilityPct < 60 ? 15 : 8;
  const rankImpactMin = stabilityPct < 30 ? 300 : stabilityPct < 60 ? 150 : 50;
  const rankImpactMax = stabilityPct < 30 ? 600 : stabilityPct < 60 ? 400 : 150;

  const estimatedDurationMinutes = mode === "mock" ? 30 : mode === "emergency" ? 5 : mode === "revision" ? 10 : 25;
  const targetPercentile = strengthPct >= 70 ? "Top 15%" : strengthPct >= 50 ? "Top 30%" : strengthPct >= 30 ? "Top 45%" : "Top 60%";
  const revisionMetrics = buildRevisionMetrics({
    topicCount: 1,
    durationMinutes: estimatedDurationMinutes,
    cyclesCount: sessionPhases.length,
    estGain: stabilityGainMin,
    strengthPercent: stabilityPct,
    predictedDropDate: targetTopic?.next_predicted_drop_date || null,
  });

  return {
    session_id: session.id,
    started_at: session.created_at,
    topic: {
      ...topicContext,
      stability_label: `${strengthPct}% stable`,
    },
    topics_selected: [{
      name: topicName,
      subject: subjectName,
      stability: strengthPct,
      stability_label: `${strengthPct}% stable`,
    }],
    questions,
    session_config: sessionConfig,
    session_phases: sessionPhases,
    phases_count: sessionPhases.length,
    current_stability: stabilityPct,
    ...(mode === "mock" ? {
      mock_config: {
        target_percentile: targetPercentile,
        target_label: `Target: ${targetPercentile}`,
        target_description: "Based on your current brain data",
        negative_marking: true,
        strict_timer: true,
        no_hints: true,
        show_explanation_after_submit: true,
        total_marks: questions.length * 4,
        passing_marks: Math.round(questions.length * 4 * 0.4),
      },
    } : {}),
    expected_outcomes: {
      stability_gain: `+${stabilityGainMin}-${stabilityGainMax}%`,
      rank_impact: `+${rankImpactMin}-${rankImpactMax} ranks`,
      stability_gain_min: stabilityGainMin,
      stability_gain_max: stabilityGainMax,
      rank_impact_min: rankImpactMin,
      rank_impact_max: rankImpactMax,
      est_gain: revisionMetrics.est_gain,
      est_gain_label: revisionMetrics.est_gain_label,
    },
    topic_no: revisionMetrics.topic_no,
    duration_minutes: revisionMetrics.duration_minutes,
    duration_cycles: revisionMetrics.duration_cycles,
    est_gain: revisionMetrics.est_gain,
    risk_percentage: revisionMetrics.risk_percentage,
    revision_metrics: revisionMetrics,
    meta: {
      question_count: questions.length,
      difficulty,
      estimated_duration_minutes: estimatedDurationMinutes,
    },
  };
}

// 16. SUBMIT ANSWER — Record individual answer during session
async function handleSubmitAnswer(userId: string, body: any) {
  const { session_id, question_id, selected_option_index, correct_option_index, time_taken_ms, is_correct } = body;
  if (!session_id || question_id === undefined) return { error: "session_id and question_id are required" };

  await admin.from("behavioral_micro_events").insert({
    user_id: userId,
    event_type: "quiz_answer",
    session_id,
    context: {
      question_id,
      selected_option_index,
      correct_option_index,
      is_correct: is_correct ?? (selected_option_index === correct_option_index),
      time_taken_ms: time_taken_ms || 0,
    },
    severity: is_correct ? 0 : (time_taken_ms > 30000 ? 3 : 1),
  });

  return {
    success: true,
    is_correct: is_correct ?? (selected_option_index === correct_option_index),
    recorded_at: new Date().toISOString(),
  };
}

// 17. COMPLETE FOCUS SESSION — End session, calculate results, update memory, generate recommendations
async function handleCompleteFocusSession(userId: string, body: any, authHeader: string) {
  let {
    session_id, answers, topic_id, duration_minutes, mode, total_questions,
  } = body;
  if (!session_id) return { error: "session_id is required" };

  // ── Resolve topic_id from study_logs if missing ──
  if (!topic_id) {
    const { data: sessionLog } = await admin.from("study_logs")
      .select("topic_id")
      .eq("id", session_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (sessionLog?.topic_id) {
      topic_id = sessionLog.topic_id;
    }
  }

  const answersList = Array.isArray(answers) ? answers : [];
  const totalQ = total_questions || answersList.length || 0;

  // ── Calculate scores ──
  let correct = 0, incorrect = 0, skipped = 0, totalTimeTakenMs = 0;
  const questionResults: any[] = [];

  answersList.forEach((a: any) => {
    const isCorrect = a.is_correct ?? (a.selected_option_index === a.correct_option_index);
    if (a.selected_option_index === -1 || a.selected_option_index === null || a.selected_option_index === undefined) {
      skipped++;
    } else if (isCorrect) {
      correct++;
    } else {
      incorrect++;
    }
    totalTimeTakenMs += (a.time_taken_ms || 0);
    questionResults.push({
      question_id: a.question_id,
      selected_option_index: a.selected_option_index ?? -1,
      correct_option_index: a.correct_option_index,
      is_correct: isCorrect,
      time_taken_ms: a.time_taken_ms || 0,
    });
  });

  const totalMarks = (correct * 4) + (incorrect * -1);
  const maxMarks = totalQ * 4;
  const percentage = maxMarks > 0 ? Math.round((totalMarks / maxMarks) * 100) : 0;
  const accuracy = totalQ > 0 ? Math.round((correct / totalQ) * 100) : null;
  const accuracyDisplay = accuracy !== null ? accuracy : "N/A";
  const accuracyNum = accuracy ?? 0;
  const avgTimePerQuestion = answersList.length > 0 ? Math.round(totalTimeTakenMs / answersList.length) : 0;

  // ── Performance grade ──
  let grade = "needs_improvement", gradeLabel = "Needs Improvement", gradeColor = "#EF4444";
  if (totalQ === 0) {
    grade = "focus_only"; gradeLabel = "Focus Session Complete ✅"; gradeColor = "#3B82F6";
  } else if (percentage >= 90) { grade = "excellent"; gradeLabel = "Excellent 🎯"; gradeColor = "#10B981"; }
  else if (percentage >= 75) { grade = "great"; gradeLabel = "Great Job 🌟"; gradeColor = "#22C55E"; }
  else if (percentage >= 60) { grade = "good"; gradeLabel = "Good Effort 📖"; gradeColor = "#3B82F6"; }
  else if (percentage >= 40) { grade = "fair"; gradeLabel = "Keep Practicing 💪"; gradeColor = "#F59E0B"; }

  // ── Speed analysis ──
  const speedAnalysis = avgTimePerQuestion === 0 ? "N/A" : avgTimePerQuestion < 15000 ? "fast" : avgTimePerQuestion > 45000 ? "slow" : "balanced";

  // ── Update study_logs ──
  const finalDuration = duration_minutes || Math.ceil(totalTimeTakenMs / 60000) || 1;
  const confidenceLevel = percentage >= 70 ? "high" : percentage >= 40 ? "medium" : "low";

  await admin.from("study_logs").update({
    duration_minutes: finalDuration,
    confidence_level: confidenceLevel,
    notes: `Score: ${correct}/${totalQ} (${percentage}%) | Mode: ${mode || "focus"}`,
  }).eq("id", session_id).eq("user_id", userId);

  // ── Update topic memory_strength ──
  let memoryImpact: any = { before: 0, after: 0, change: 0, change_label: "No topic data", topic_name: "General Practice", subject: "General" };
  let resolvedPredictedDropDate: string | null = null;

  // Try resolving topic even without topic_id — pick user's weakest topic as context
  let resolvedTopicId = topic_id;
  if (!resolvedTopicId) {
    const { data: weakestTopic } = await admin.from("topics")
      .select("id, name, memory_strength, next_predicted_drop_date, subject_id, subjects(name)")
      .eq("user_id", userId)
      .order("memory_strength", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (weakestTopic) {
      resolvedTopicId = weakestTopic.id;
      const weakestStrength = toStrengthPercent(weakestTopic.memory_strength, 0);
      resolvedPredictedDropDate = weakestTopic.next_predicted_drop_date || null;
      memoryImpact = {
        before: weakestStrength,
        after: weakestStrength,
        change: 0,
        change_label: "Focus session — no direct quiz impact",
        topic_name: weakestTopic.name || "General Practice",
        subject: (weakestTopic as any).subjects?.name || "General",
      };
    }
  }

  if (resolvedTopicId) {
    const { data: topic } = await admin.from("topics")
      .select("memory_strength, next_predicted_drop_date, name, subject_id, subjects(name)")
      .eq("id", resolvedTopicId).eq("user_id", userId).maybeSingle();

    if (topic) {
      resolvedPredictedDropDate = topic.next_predicted_drop_date || resolvedPredictedDropDate;
      const oldStrengthPct = toStrengthPercent(topic.memory_strength, 0);
      const oldStrengthUnit = toStrengthUnit(topic.memory_strength, 0);
      const performanceMultiplier = accuracyNum >= 80 ? 1.5 : accuracyNum >= 60 ? 1.0 : accuracyNum >= 40 ? 0.5 : 0.2;
      const durationMultiplier = Math.min(finalDuration / 10, 2);
      const focusBonus = totalQ === 0 ? 0.02 : 0; // small boost for pure focus sessions
      const boost = (0.05 * performanceMultiplier * durationMultiplier) + focusBonus;
      const newStrengthPct = Math.round(Math.min(1, oldStrengthUnit + boost) * 100);
      const strengthChange = newStrengthPct - oldStrengthPct;

      await admin.from("topics").update({
        memory_strength: newStrengthPct,
        last_revision_date: new Date().toISOString(),
      }).eq("id", resolvedTopicId);

      memoryImpact = {
        before: oldStrengthPct,
        after: newStrengthPct,
        change: strengthChange,
        change_label: `${strengthChange >= 0 ? "+" : ""}${strengthChange}% stability`,
        topic_name: topic.name || "General Practice",
        subject: (topic as any).subjects?.name || "General",
      };
    }
  }

  // ── Streaks & XP ──
  const today = todayStart();
  const { count: todaySessionCount } = await admin.from("study_logs")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId).gte("created_at", today);

  const xpEarned = (correct * 10) + (finalDuration * 2) + (accuracyNum >= 80 ? 50 : accuracyNum >= 60 ? 25 : 0);

  // ── Focus Quality Score ──
  const timeEfficiency = Math.min(finalDuration / (duration_minutes || 25), 1);
  const accuracyFactor = accuracyNum / 100;
  const completionFactor = totalQ > 0 ? ((correct + incorrect) / totalQ) : (timeEfficiency > 0 ? 0.5 : 0);
  const focusQualityRaw = totalQ > 0 
    ? Math.round((timeEfficiency * 30 + accuracyFactor * 40 + completionFactor * 30))
    : Math.round(timeEfficiency * 100); // pure focus = time-based quality
  const focusQuality = Math.max(1, focusQualityRaw);

  // ── Stability metrics ──
  const currentStability = memoryImpact.after || memoryImpact.before || 50;
  const stabilityBefore = memoryImpact.before || 50;
  const stabilityChange = memoryImpact.change || 0;
  const stabilityGainMin = Math.max(1, stabilityChange > 0 ? stabilityChange : Math.round(Math.max(accuracyNum, finalDuration * 2) * 0.08));
  const stabilityGainMax = Math.max(stabilityGainMin + 3, Math.round(Math.max(accuracyNum, finalDuration * 3) * 0.15));

  // ── Rank Impact ──
  const rankBase = totalQ === 0 ? (finalDuration >= 15 ? 80 : finalDuration >= 5 ? 40 : 20) : (accuracyNum >= 80 ? 150 : accuracyNum >= 60 ? 100 : accuracyNum >= 40 ? 50 : 20);
  const rankBoost = Math.round(finalDuration * 2);
  const rankImpactMin = rankBase;
  const rankImpactMax = rankBase + rankBoost + (stabilityChange * 10);

  // ── Session Phases ──
  const sessionPhases: any[] = [];
  if (finalDuration >= 1) sessionPhases.push({ phase: "Recall Warm-up", duration_minutes: Math.max(1, Math.round(finalDuration * 0.15)), status: "completed", description: "Quick memory activation" });
  if (finalDuration >= 3) sessionPhases.push({ phase: "Reinforcement", duration_minutes: Math.max(2, Math.round(finalDuration * 0.35)), status: "completed", description: "Strengthening weak connections" });
  if (totalQ > 0) sessionPhases.push({ phase: "Assessment", duration_minutes: Math.max(2, Math.round(finalDuration * 0.35)), status: "completed", description: `${totalQ} questions attempted` });
  sessionPhases.push({ phase: "Review", duration_minutes: Math.max(1, Math.round(finalDuration * 0.15)), status: "completed", description: "Performance analysis & next steps" });

  // ── Next recommendations ──
  let nextRecommendations: any[] = [];
  try {
    const recResult = await handleRecommendedNext(userId, { topic_id: resolvedTopicId || null, mode: mode || "focus", session_minutes: finalDuration });
    nextRecommendations = recResult.recommended_next || [];
  } catch (e) {
    console.error("Failed to generate next recommendations:", e);
  }

  // ── Weak areas ──
  const weakAreas: any[] = [];
  if (incorrect > 0) {
    weakAreas.push({ type: "incorrect_answers", count: incorrect, message: `${incorrect} question${incorrect > 1 ? "s" : ""} answered incorrectly — review explanations` });
  }
  if (avgTimePerQuestion > 45000 && answersList.length > 0) {
    weakAreas.push({ type: "slow_speed", avg_time_seconds: Math.round(avgTimePerQuestion / 1000), message: "Average response time is above 45 seconds — practice for speed" });
  }
  if (skipped > 0) {
    weakAreas.push({ type: "skipped_questions", count: skipped, message: `${skipped} question${skipped > 1 ? "s" : ""} skipped — attempt all for better assessment` });
  }

  const topicsStabilized = memoryImpact.topic_name ? 1 : 0;
  const riskBefore = getRiskPercentage(stabilityBefore);
  const riskAfter = getRiskPercentage(memoryImpact.after || currentStability);
  const revisionMetrics = {
    ...buildRevisionMetrics({
      topicCount: topicsStabilized,
      durationMinutes: finalDuration,
      cyclesCount: sessionPhases.length,
      estGain: Math.max(memoryImpact.change, stabilityGainMin),
      strengthPercent: memoryImpact.after || currentStability,
      predictedDropDate: resolvedPredictedDropDate,
    }),
    topics_stabilized: topicsStabilized,
    risk_percentage_before: riskBefore,
    risk_percentage_after: riskAfter,
    risk_reduction: Math.max(0, riskBefore - riskAfter),
  };

  // ── Mock-specific scoring breakdown ──
  const isMock = mode === "mock";
  const negativeMarks = isMock ? incorrect * 1 : 0;
  const netMarks = isMock ? (correct * 4) - negativeMarks : totalMarks;
  const mockPercentile = isMock ? (percentage >= 90 ? "Top 5%" : percentage >= 75 ? "Top 15%" : percentage >= 60 ? "Top 30%" : percentage >= 40 ? "Top 45%" : "Top 60%") : null;

  return {
    result: {
      session_id,
      mode: mode || "focus",
      total_questions: totalQ,
      correct,
      incorrect,
      skipped,
      total_marks: isMock ? netMarks : totalMarks,
      max_marks: maxMarks,
      percentage,
      accuracy: accuracyDisplay,
      grade,
      grade_label: gradeLabel,
      grade_color: gradeColor,
      duration_minutes: finalDuration,
      avg_time_per_question_ms: avgTimePerQuestion,
      speed_analysis: speedAnalysis,
      topic_id: resolvedTopicId || "",
      topic_name: memoryImpact.topic_name,
      subject: memoryImpact.subject,
    },
    ...(isMock ? {
      mock_result: {
        net_marks: netMarks,
        positive_marks: correct * 4,
        negative_marks: negativeMarks,
        unanswered_count: skipped,
        attempted: correct + incorrect,
        total: totalQ,
        percentile: mockPercentile,
        percentile_label: `You're in ${mockPercentile}`,
        pass: netMarks >= Math.round(totalQ * 4 * 0.4),
        pass_label: netMarks >= Math.round(totalQ * 4 * 0.4) ? "Passed ✅" : "Below cutoff ❌",
        cutoff_marks: Math.round(totalQ * 4 * 0.4),
        time_per_question_seconds: answersList.length > 0 ? Math.round(avgTimePerQuestion / 1000) : 0,
        accuracy_breakdown: {
          correct_percentage: totalQ > 0 ? Math.round((correct / totalQ) * 100) : 0,
          incorrect_percentage: totalQ > 0 ? Math.round((incorrect / totalQ) * 100) : 0,
          skipped_percentage: totalQ > 0 ? Math.round((skipped / totalQ) * 100) : 0,
        },
      },
    } : {}),
    stability: {
      current: currentStability,
      before: stabilityBefore,
      after: memoryImpact.after || currentStability,
      health: currentStability >= 70 ? "strong" : currentStability >= 40 ? "moderate" : "weak",
    },
    stability_gain: `+${stabilityGainMin}-${stabilityGainMax}%`,
    rank_impact: `+${rankImpactMin}-${rankImpactMax} ranks`,
    focus_quality: {
      score: focusQuality,
      label: focusQuality >= 80 ? "Excellent" : focusQuality >= 60 ? "Good" : focusQuality >= 40 ? "Fair" : "Needs Improvement",
    },
    time_focused: `${finalDuration}m`,
    session_phases: sessionPhases,
    phases_count: sessionPhases.length,
    topic_no: revisionMetrics.topic_no,
    duration_minutes: revisionMetrics.duration_minutes,
    duration_cycles: revisionMetrics.duration_cycles,
    est_gain: revisionMetrics.est_gain,
    risk_percentage: revisionMetrics.risk_percentage_after,
    revision_metrics: revisionMetrics,
    memory_impact: {
      ...memoryImpact,
      risk_percentage_before: revisionMetrics.risk_percentage_before,
      risk_percentage_after: revisionMetrics.risk_percentage_after,
    },
    rewards: {
      xp_earned: xpEarned,
      sessions_today: todaySessionCount || 0,
      streak_maintained: true,
    },
    weak_areas: weakAreas,
    question_results: questionResults,
    recommended_next: nextRecommendations.slice(0, 3),
    keep_momentum: {
      title: "Keep the Momentum",
      subtitle: "AI-suggested next actions",
      icon: "zap",
      actions: [
        {
          id: "quick_recall",
          title: "Quick Recall Test",
          subtitle: `5-min recall on what you just studied`,
          duration: "5 min",
          icon: "brain",
          action: "start-focus-session",
          params: { mode: "revision", topic_id: resolvedTopicId || null, duration_minutes: 5 },
        },
        {
          id: "review_weak",
          title: "Review Weak Areas",
          subtitle: "Focus on topics below 40% stability",
          duration: "10 min",
          icon: "book-open",
          action: "start-focus-session",
          params: { mode: "emergency", duration_minutes: 10 },
        },
        {
          id: "ai_session",
          title: "Start Another AI Session",
          subtitle: "Let AI pick your next optimal topic",
          duration: "20-30 min",
          icon: "sparkles",
          action: "start-focus-session",
          params: { mode: "focus", duration_minutes: 25 },
        },
        {
          id: "check_progress",
          title: "Check Your Progress",
          subtitle: "View brain health and stability trends",
          duration: "2 min",
          icon: "bar-chart",
          action: "navigate",
          params: { screen: "brain_tab" },
        },
      ],
      done_button: {
        title: "Done for Now",
        action: "navigate",
        params: { screen: "home" },
      },
    },
    meta: {
      completed_at: new Date().toISOString(),
      mode: mode || "focus",
    },
  };
}

// 18. SESSION STATUS — Get current phase, timer state, and motivational text for active session
async function handleSessionStatus(userId: string, body: any) {
  const { session_id, elapsed_seconds, current_phase_index } = body;
  if (!session_id) return { error: "session_id is required" };

  // Fetch session
  const { data: session } = await admin.from("study_logs")
    .select("id, study_mode, topic_id, duration_minutes, created_at, subject_id")
    .eq("id", session_id).eq("user_id", userId).maybeSingle();

  if (!session) return { error: "Session not found" };

  // Fetch topic
  let topicName = "General Practice";
  let subjectName = "General";
  let strengthPct = 50;
  if (session.topic_id) {
    const { data: topic } = await admin.from("topics")
      .select("name, memory_strength, subjects(name)")
      .eq("id", session.topic_id).maybeSingle();
    if (topic) {
      topicName = topic.name || topicName;
      subjectName = (topic as any).subjects?.name || subjectName;
      strengthPct = toStrengthPercent(topic.memory_strength, 50);
    }
  }

  const mode = session.study_mode || "focus";
  const stabilityPct = strengthPct;

  // Build phases
  const phases = mode === "revision"
    ? [
        { phase: 1, type: "recall", title: "Quick Recall Scan", duration_seconds: 180, description: `Rapid retrieval of ${topicName}`, icon: "brain" },
        { phase: 2, type: "assessment", title: "Decay Check", duration_seconds: 240, description: `Test which memories have weakened in ${topicName}.`, icon: "target" },
        { phase: 3, type: "review", title: "Stability Lock", duration_seconds: 180, description: `Re-anchor fading memories and extend retention.`, icon: "check-circle" },
      ]
    : [
        { phase: 1, type: "recall", title: "Active Recall", duration_seconds: mode === "emergency" ? 120 : 480, description: `Recall key concepts from ${topicName}`, icon: "brain" },
        { phase: 2, type: "reinforcement", title: "Concept Reinforcement", duration_seconds: mode === "emergency" ? 120 : 540, description: `Review and strengthen the concepts of ${topicName}. Fill gaps from the recall phase.`, icon: "refresh-cw" },
        { phase: 3, type: "assessment", title: "Adaptive Assessment", duration_seconds: mode === "emergency" ? 60 : 300, description: `AI-calibrated questions on ${topicName}. Answer carefully.`, icon: "target" },
        { phase: 4, type: "review", title: "Review & Consolidate", duration_seconds: mode === "emergency" ? 0 : 180, description: `Solidify your learning and lock in memory gains.`, icon: "check-circle" },
      ].filter(p => p.duration_seconds > 0);

  const totalSessionSeconds = phases.reduce((s, p) => s + p.duration_seconds, 0);
  const elapsedSec = elapsed_seconds || 0;
  const phaseIdx = typeof current_phase_index === "number" ? current_phase_index : 0;
  const activePhase = phases[Math.min(phaseIdx, phases.length - 1)];

  // Calculate elapsed within current phase
  let elapsedBefore = 0;
  for (let i = 0; i < phaseIdx && i < phases.length; i++) elapsedBefore += phases[i].duration_seconds;
  const phaseElapsed = Math.max(0, elapsedSec - elapsedBefore);
  const phaseRemaining = Math.max(0, activePhase.duration_seconds - phaseElapsed);

  // Difficulty badge
  const difficultyLabel = stabilityPct < 30 ? "HARD" : stabilityPct < 60 ? "MEDIUM" : "EASY";

  // Motivational messages per phase type
  const motivationalMessages: Record<string, string[]> = {
    recall: ["Activate your memory traces 🧠", "Dig deep — recall builds strength", "Every recall attempt strengthens connections"],
    reinforcement: ["Deep focus — stay in the zone", "Strengthen those neural pathways 💪", "Building lasting memory connections"],
    assessment: ["Show what you know 🎯", "Stay sharp — accuracy matters", "Trust your preparation"],
    review: ["Lock in your gains 🔒", "Consolidating memory for long-term retention", "Almost there — strong finish!"],
  };
  const msgs = motivationalMessages[activePhase.type] || motivationalMessages.reinforcement;
  const motivational_message = msgs[Math.floor(Math.random() * msgs.length)];

  // Phase progress (which phases are complete, active, pending)
  const phasesWithStatus = phases.map((p, i) => ({
    ...p,
    status: i < phaseIdx ? "completed" : i === phaseIdx ? "active" : "pending",
    progress_percent: i < phaseIdx ? 100 : i === phaseIdx ? Math.round((phaseElapsed / p.duration_seconds) * 100) : 0,
  }));

  // Timer display
  const timerMinutes = Math.floor(phaseRemaining / 60);
  const timerSeconds = phaseRemaining % 60;
  const timerDisplay = `${String(timerMinutes).padStart(2, "0")}:${String(timerSeconds).padStart(2, "0")}`;

  return {
    session_id,
    mode,
    is_active: true,
    topic: {
      id: session.topic_id || "",
      name: topicName,
      subject: subjectName,
      memory_strength: stabilityPct,
      risk_percentage: getRiskPercentage(stabilityPct),
    },
    current_phase: {
      index: phaseIdx,
      phase_number: activePhase.phase,
      type: activePhase.type,
      title: activePhase.title,
      description: activePhase.description,
      icon: activePhase.icon,
      label: `Phase ${phaseIdx + 1}/${phases.length} · ${topicName}`,
      duration_seconds: activePhase.duration_seconds,
      elapsed_seconds: phaseElapsed,
      remaining_seconds: phaseRemaining,
    },
    timer: {
      display: timerDisplay,
      total_session_seconds: totalSessionSeconds,
      total_elapsed_seconds: elapsedSec,
      total_remaining_seconds: Math.max(0, totalSessionSeconds - elapsedSec),
      status: "focusing",
      status_label: "focusing...",
    },
    difficulty: difficultyLabel,
    motivational_message,
    phases: phasesWithStatus,
    phases_count: phases.length,
    controls: {
      can_pause: true,
      can_skip_phase: phaseIdx < phases.length - 1,
      can_end_session: true,
      show_ambient_sounds: true,
      ambient_options: [
        { id: "vibration", icon: "vibrate", label: "Vibration" },
        { id: "music", icon: "music", label: "Lo-fi Music" },
        { id: "whitenoise", icon: "radio", label: "White Noise" },
      ],
    },
    meta: {
      started_at: session.created_at,
      generated_at: new Date().toISOString(),
    },
  };
}

// 19. PAUSE/RESUME SESSION — Toggle pause state
async function handlePauseResumeSession(userId: string, body: any) {
  const { session_id, action: pauseAction, elapsed_seconds, current_phase_index, pause_reason } = body;
  if (!session_id) return { error: "session_id is required" };
  if (!pauseAction || !["pause", "resume"].includes(pauseAction)) return { error: "action must be 'pause' or 'resume'" };

  const { data: session } = await admin.from("study_logs")
    .select("id, study_mode, topic_id, created_at")
    .eq("id", session_id).eq("user_id", userId).maybeSingle();

  if (!session) return { error: "Session not found" };

  // Log pause/resume event
  await admin.from("behavioral_micro_events").insert({
    user_id: userId,
    event_type: pauseAction === "pause" ? "session_paused" : "session_resumed",
    session_id,
    context: {
      elapsed_seconds: elapsed_seconds || 0,
      current_phase_index: current_phase_index ?? 0,
      pause_reason: pause_reason || "",
      timestamp: new Date().toISOString(),
    },
    severity: pauseAction === "pause" ? 1 : 0,
  });

  const isPaused = pauseAction === "pause";

  return {
    success: true,
    session_id,
    is_paused: isPaused,
    status: isPaused ? "paused" : "active",
    status_label: isPaused ? "Session paused" : "focusing...",
    message: isPaused
      ? "Session paused. Take a breath — your progress is saved."
      : "Welcome back! Resuming your focus session.",
    timer: {
      status: isPaused ? "paused" : "focusing",
      elapsed_seconds: elapsed_seconds || 0,
      current_phase_index: current_phase_index ?? 0,
    },
    recorded_at: new Date().toISOString(),
  };
}

// 20. NEXT PHASE — Advance to next phase in session
async function handleNextPhase(userId: string, body: any) {
  const { session_id, current_phase_index, elapsed_seconds, phase_performance } = body;
  if (!session_id) return { error: "session_id is required" };
  if (current_phase_index === undefined) return { error: "current_phase_index is required" };

  const { data: session } = await admin.from("study_logs")
    .select("id, study_mode, topic_id, created_at")
    .eq("id", session_id).eq("user_id", userId).maybeSingle();

  if (!session) return { error: "Session not found" };

  // Fetch topic
  let topicName = "General Practice";
  let strengthPct = 50;
  if (session.topic_id) {
    const { data: topic } = await admin.from("topics")
      .select("name, memory_strength").eq("id", session.topic_id).maybeSingle();
    if (topic) {
      topicName = topic.name || topicName;
      strengthPct = toStrengthPercent(topic.memory_strength, 50);
    }
  }

  const mode = session.study_mode || "focus";

  const phases = mode === "revision"
    ? [
        { phase: 1, type: "recall", title: "Quick Recall Scan", duration_seconds: 180, description: `Rapid retrieval of ${topicName}`, icon: "brain" },
        { phase: 2, type: "assessment", title: "Decay Check", duration_seconds: 240, description: `Test which memories have weakened in ${topicName}.`, icon: "target" },
        { phase: 3, type: "review", title: "Stability Lock", duration_seconds: 180, description: `Re-anchor fading memories and extend retention.`, icon: "check-circle" },
      ]
    : [
        { phase: 1, type: "recall", title: "Active Recall", duration_seconds: mode === "emergency" ? 120 : 480, description: `Recall key concepts from ${topicName}`, icon: "brain" },
        { phase: 2, type: "reinforcement", title: "Concept Reinforcement", duration_seconds: mode === "emergency" ? 120 : 540, description: `Review and strengthen the concepts of ${topicName}. Fill gaps from the recall phase.`, icon: "refresh-cw" },
        { phase: 3, type: "assessment", title: "Adaptive Assessment", duration_seconds: mode === "emergency" ? 60 : 300, description: `AI-calibrated questions on ${topicName}. Answer carefully.`, icon: "target" },
        { phase: 4, type: "review", title: "Review & Consolidate", duration_seconds: mode === "emergency" ? 0 : 180, description: `Solidify your learning and lock in memory gains.`, icon: "check-circle" },
      ].filter(p => p.duration_seconds > 0);

  const nextPhaseIdx = current_phase_index + 1;
  const isSessionComplete = nextPhaseIdx >= phases.length;

  // Log phase transition
  await admin.from("behavioral_micro_events").insert({
    user_id: userId,
    event_type: "phase_transition",
    session_id,
    context: {
      from_phase: current_phase_index,
      to_phase: isSessionComplete ? "complete" : nextPhaseIdx,
      elapsed_seconds: elapsed_seconds || 0,
      phase_performance: phase_performance || {},
    },
    severity: 0,
  });

  if (isSessionComplete) {
    return {
      success: true,
      session_id,
      is_session_complete: true,
      message: "All phases complete! Generating your results...",
      action: "complete-focus-session",
      next_step: {
        action: "complete-focus-session",
        description: "Call complete-focus-session to finalize and get results",
      },
      meta: { completed_at: new Date().toISOString() },
    };
  }

  const nextPhase = phases[nextPhaseIdx];
  const stabilityPct = strengthPct;
  const difficultyLabel = stabilityPct < 30 ? "HARD" : stabilityPct < 60 ? "MEDIUM" : "EASY";

  // Phase transition messages
  const transitionMessages: Record<string, string> = {
    recall: "Time to activate your memory! 🧠",
    reinforcement: "Great recall! Now let's strengthen those connections 💪",
    assessment: "Reinforcement complete! Time to test your knowledge 🎯",
    review: "Almost done! Let's lock in everything you've learned 🔒",
  };

  // Recalculate elapsed for new phase
  let elapsedBefore = 0;
  for (let i = 0; i < nextPhaseIdx; i++) elapsedBefore += phases[i].duration_seconds;

  const phasesWithStatus = phases.map((p, i) => ({
    ...p,
    status: i < nextPhaseIdx ? "completed" : i === nextPhaseIdx ? "active" : "pending",
    progress_percent: i < nextPhaseIdx ? 100 : 0,
  }));

  const timerMinutes = Math.floor(nextPhase.duration_seconds / 60);
  const timerSeconds = nextPhase.duration_seconds % 60;
  const timerDisplay = `${String(timerMinutes).padStart(2, "0")}:${String(timerSeconds).padStart(2, "0")}`;

  return {
    success: true,
    session_id,
    is_session_complete: false,
    transition_message: transitionMessages[nextPhase.type] || "Moving to next phase...",
    current_phase: {
      index: nextPhaseIdx,
      phase_number: nextPhase.phase,
      type: nextPhase.type,
      title: nextPhase.title,
      description: nextPhase.description,
      icon: nextPhase.icon,
      label: `Phase ${nextPhaseIdx + 1}/${phases.length} · ${topicName}`,
      duration_seconds: nextPhase.duration_seconds,
      elapsed_seconds: 0,
      remaining_seconds: nextPhase.duration_seconds,
    },
    timer: {
      display: timerDisplay,
      total_elapsed_seconds: elapsedBefore,
      status: "focusing",
      status_label: "focusing...",
    },
    difficulty: difficultyLabel,
    phases: phasesWithStatus,
    phases_count: phases.length,
    meta: {
      transitioned_at: new Date().toISOString(),
      previous_phase: current_phase_index,
    },
  };
}

// ═══════════════════════════════════════════════════════════
//  MAIN ROUTER
// ═══════════════════════════════════════════════════════════

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await resolveUser(req);
    if (!userId) return json({ error: "Unauthorized" }, 401);

    let body: any = {};
    if (req.method === "POST" || req.method === "PATCH" || req.method === "PUT") {
      try { const text = await req.text(); if (text.trim()) body = JSON.parse(text); } catch { /* empty */ }
    }

    const url = new URL(req.url);
    const query = Object.fromEntries(url.searchParams.entries());
    // Merge query params into body so handlers work with either JSON body or query params
    body = { ...query, ...body };
    let route = url.pathname.replace(/^\/+|\/+$/g, "")
      .replace(/^functions\/v1\/action-tab-api\/?/i, "")
      .replace(/^action-tab-api\/?/i, "")
      .replace(/^\/+|\/+$/g, "");

    if (!route) {
      route = req.headers.get("x-route") || String(body.route || body.action || query.route || query.action || "");
    }

    const authHeader = req.headers.get("authorization") || "";

    switch (route) {
      case "init":
        return json(await handleInit(userId));

      case "todays-gains":
        return json(await handleTodaysGains(userId));

      case "session-history":
        return json(await handleSessionHistory(userId, body));

      case "start-session":
        return json(await handleStartSession(userId, body));

      case "end-session":
        return json(await handleEndSession(userId, body));

      case "log-session":
        return json(await handleLogSession(userId, body));

      case "task-complete":
        return json(await handleTaskComplete(userId, body));

      case "topic-explorer":
        return json(await handleTopicExplorer(userId, body));

      case "topic-strategy":
        return json(await handleTopicStrategy(userId, body));

      case "questions":
        return json(await handleQuestions(userId, body, authHeader));

      case "daily-summary":
        return json(await handleDailySummary(userId));

      case "topics-list":
        return json(await handleTopicsList(userId, body));

      case "subjects-list":
        return json(await handleSubjectsList(userId));

      case "recommended-next":
        return json(await handleRecommendedNext(userId, body));

      case "session-blueprint":
        return json(await handleSessionBlueprint(userId, body));

      case "start-focus-session":
        return json(await handleStartFocusSession(userId, body, authHeader));

      case "submit-answer":
        return json(await handleSubmitAnswer(userId, body));

      case "complete-focus-session":
        return json(await handleCompleteFocusSession(userId, body, authHeader));

      case "session-status":
        return json(await handleSessionStatus(userId, body));

      case "pause-resume-session":
        return json(await handlePauseResumeSession(userId, body));

      case "next-phase":
        return json(await handleNextPhase(userId, body));

      default:
        return json({ error: `Unknown route: ${route}`, available_routes: [
          "init", "todays-gains", "session-history", "start-session", "end-session",
          "log-session", "task-complete", "topic-explorer", "topic-strategy",
          "questions", "daily-summary", "topics-list", "subjects-list", "recommended-next",
          "session-blueprint", "start-focus-session", "submit-answer", "complete-focus-session",
          "session-status", "pause-resume-session", "next-phase"
        ] }, 404);
    }
  } catch (e) {
    console.error("action-tab-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
