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

// ═══════════════════════════════════════════════════════════
//  ROUTE HANDLERS
// ═══════════════════════════════════════════════════════════

// 1. INIT — Full Action Tab bootstrap (single call loads everything)
async function handleInit(userId: string) {
  const today = todayStart();
  const weekAgo = new Date(Date.now() - 7 * 86400000).toISOString();

  const [
    recTopicRes, sessionsRes, allTopicsRes, weekSessionsRes,
    tasksRes, completedCountRes, profileRes, predRes
  ] = await Promise.all([
    // Recommended topic (weakest)
    admin.from("topics").select("id, name, memory_strength, subject_id, subjects(name)")
      .eq("user_id", userId).is("deleted_at", null)
      .order("memory_strength", { ascending: true }).limit(1).maybeSingle(),
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
  ]);

  // ── Recommended Topic ──
  const recTopic = recTopicRes.data;
  const recommendedTopic = recTopic ? {
    id: recTopic.id,
    name: recTopic.name,
    subject: (recTopic as any).subjects?.name || "General",
    stability: Math.round((recTopic.memory_strength ?? 0) * 100),
    estimated_time: (recTopic.memory_strength ?? 0) < 0.3 ? "25 min deep session"
      : (recTopic.memory_strength ?? 0) < 0.6 ? "15 min review" : "10 min refresh",
  } : null;

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
      "Authorization": authHeader,
      "apikey": anonKey,
    },
    body: JSON.stringify({
      action: "mission_questions",
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

      default:
        return json({ error: `Unknown route: ${route}`, available_routes: [
          "init", "todays-gains", "session-history", "start-session", "end-session",
          "log-session", "task-complete", "topic-explorer", "topic-strategy",
          "questions", "daily-summary", "topics-list", "subjects-list", "recommended-next"
        ] }, 404);
    }
  } catch (e) {
    console.error("action-tab-api error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
