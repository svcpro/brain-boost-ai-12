import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-route",
};

const json = (data: unknown, status = 200) =>
  new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function getClients(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("authorization") || "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } });
  const adminClient = createClient(url, serviceKey);
  return { userClient, adminClient };
}

async function getUser(client: any) {
  const { data: { user }, error } = await client.auth.getUser();
  if (error || !user) return null;
  return user;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const round4 = (n: number) => Math.round(n * 10000) / 10000;

// ─── Ebbinghaus forgetting curve: R = e^(-t/S) ───
function computeDecayFactors(topic: any, studyLogs: any[], now: Date) {
  const tLogs = studyLogs.filter((l: any) => l.topic_id === topic.id);

  // Factor 1: Initial mastery
  const highConfCount = tLogs.filter((l: any) => l.confidence_level === "high").length;
  const initialMastery = Math.min(1, highConfCount / Math.max(tLogs.length, 1));

  // Factor 2: Recall strength
  const reviewCount = tLogs.length;
  const lastReview = tLogs[0] ? new Date(tLogs[0].created_at) : new Date(topic.created_at || now);
  const hoursSinceReview = (now.getTime() - lastReview.getTime()) / (1000 * 60 * 60);
  const recencyWeight = Math.exp(-hoursSinceReview / 168);
  const recallStrength = Math.min(1, (reviewCount * recencyWeight) / 10);

  // Factor 3: Answer latency
  const avgLatency = tLogs.length > 0
    ? tLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 5), 0) / tLogs.length
    : 10;
  const latencyFactor = Math.min(1, 5 / Math.max(avgLatency, 1));

  // Factor 4: Time gap
  const timeGapHours = hoursSinceReview;

  // Factor 5: Error severity
  const recentErrors = tLogs.slice(0, 10).filter((l: any) => l.confidence_level === "low").length;
  const errorSeverity = Math.min(1, recentErrors / 5);

  // Compute stability
  const baseStability = 24;
  const masteryBoost = 1 + initialMastery * 3;
  const reviewBoost = 1 + Math.log2(reviewCount + 1) * 0.5;
  const errorPenalty = 1 + errorSeverity * 0.5;
  const latencyBoost = 1 + latencyFactor * 0.3;

  const stability = (baseStability * masteryBoost * reviewBoost * latencyBoost) / errorPenalty;
  const decayRate = 1 / stability;
  const predictedRetention = Math.exp(-timeGapHours / stability);

  // Next optimal review (when retention drops to 70%)
  const hoursUntil70 = -stability * Math.log(0.7);
  const nextOptimalReview = new Date(lastReview.getTime() + hoursUntil70 * 60 * 60 * 1000);

  return {
    initialMastery, recallStrength, latencyFactor, errorSeverity,
    stability, decayRate, predictedRetention,
    hoursSinceReview, timeGapHours, reviewCount,
    hoursUntil70, nextOptimalReview, lastReview,
    avgLatency,
  };
}

// ─── ROUTE: dashboard ───
// Full Forgetting Curve 2.0 dashboard with all topics, retention, and risk analysis
async function handleDashboard(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const [topicsRes, logsRes] = await Promise.all([
    userClient.from("topics").select("*, subjects(name)").eq("user_id", user.id).is("deleted_at", null),
    userClient.from("study_logs").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(500),
  ]);

  const topics = topicsRes.data || [];
  const studyLogs = logsRes.data || [];

  if (topics.length === 0) {
    return json({
      success: true,
      data: {
        overall_retention: 0,
        overall_retention_pct: 0,
        total_topics: 0,
        urgent_count: 0,
        warning_count: 0,
        safe_count: 0,
        topic_decays: [],
        risk_alert: null,
        model_version: "2.0",
        model_name: "Forgetting Curve 2.0",
        model_description: "5-Factor Decay Model",
      },
    });
  }

  const now = new Date();
  const topicDecays: any[] = [];

  for (const topic of topics) {
    const f = computeDecayFactors(topic, studyLogs, now);

    const reasoning = `Decay rate: ${f.decayRate.toFixed(4)}/hr. Mastery: ${(f.initialMastery * 100).toFixed(0)}%, ${f.reviewCount} reviews, ${(f.errorSeverity * 100).toFixed(0)}% error severity. ${f.predictedRetention < 0.5 ? "⚠️ Below 50% retention — urgent review needed." : ""}`;

    topicDecays.push({
      topic_id: topic.id,
      topic_name: topic.name,
      subject_name: topic.subjects?.name || null,
      subject_id: topic.subject_id || null,
      memory_strength: Math.round(Number(topic.memory_strength) || 0),
      initial_mastery: round4(f.initialMastery),
      recall_strength: round4(f.recallStrength),
      error_severity: round4(f.errorSeverity),
      decay_rate: parseFloat(f.decayRate.toFixed(6)),
      predicted_retention: round4(f.predictedRetention),
      predicted_retention_pct: Math.round(f.predictedRetention * 100),
      next_optimal_review: f.nextOptimalReview.toISOString(),
      hours_until_optimal_review: Math.max(0, round2(f.hoursUntil70 - f.hoursSinceReview)),
      hours_since_last_review: round2(f.hoursSinceReview),
      last_revision_date: topic.last_revision_date || null,
      stability_hours: round2(f.stability),
      review_count: f.reviewCount,
      risk_level: f.predictedRetention < 0.3 ? "critical" : f.predictedRetention < 0.5 ? "high" : f.predictedRetention < 0.7 ? "medium" : "low",
      review_urgency: f.hoursUntil70 - f.hoursSinceReview <= 0 ? "now" : f.hoursUntil70 - f.hoursSinceReview <= 24 ? "today" : "scheduled",
      ai_reasoning: reasoning,
      factors: {
        initial_mastery: round4(f.initialMastery),
        recall_strength: round4(f.recallStrength),
        latency_factor: round4(f.latencyFactor),
        error_severity: round4(f.errorSeverity),
        time_gap_hours: round2(f.timeGapHours),
      },
    });
  }

  // Sort by retention (most urgent first)
  topicDecays.sort((a: any, b: any) => a.predicted_retention - b.predicted_retention);

  const overallRetention = topicDecays.reduce((s: number, t: any) => s + t.predicted_retention, 0) / topicDecays.length;
  const urgentCount = topicDecays.filter((t: any) => t.predicted_retention < 0.5).length;
  const warningCount = topicDecays.filter((t: any) => t.predicted_retention >= 0.5 && t.predicted_retention < 0.7).length;
  const safeCount = topicDecays.filter((t: any) => t.predicted_retention >= 0.7).length;

  // Risk alert
  let riskAlert: any = null;
  if (urgentCount > 0) {
    riskAlert = {
      type: "warning",
      message: `${urgentCount} topic${urgentCount > 1 ? "s" : ""} below 50% — review needed`,
      urgent_topics: topicDecays.filter((t: any) => t.predicted_retention < 0.5).map((t: any) => t.topic_name),
    };
  }

  return json({
    success: true,
    data: {
      overall_retention: round4(overallRetention),
      overall_retention_pct: Math.round(overallRetention * 100),
      total_topics: topicDecays.length,
      urgent_count: urgentCount,
      warning_count: warningCount,
      safe_count: safeCount,
      topic_decays: topicDecays,
      risk_alert: riskAlert,
      model_version: "2.0",
      model_name: "Forgetting Curve 2.0",
      model_description: "5-Factor Decay Model",
    },
  });
}

// ─── ROUTE: topic-detail ───
// Detailed analysis for a single topic
async function handleTopicDetail(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_id, topic_name } = body;
  if (!topic_id && !topic_name) return json({ error: "topic_id or topic_name required" }, 400);

  let query = userClient.from("topics").select("*, subjects(name)").eq("user_id", user.id).is("deleted_at", null);
  if (topic_id) query = query.eq("id", topic_id);
  else query = query.eq("name", topic_name);

  const { data: topic } = await query.maybeSingle();
  if (!topic) return json({ error: "Topic not found" }, 404);

  // Fetch all study logs for this topic
  const { data: logs } = await userClient
    .from("study_logs")
    .select("id, created_at, duration_minutes, confidence_level, study_mode, notes")
    .eq("user_id", user.id)
    .eq("topic_id", topic.id)
    .order("created_at", { ascending: false })
    .limit(50);

  const studyLogs = logs || [];
  const now = new Date();
  const f = computeDecayFactors(topic, studyLogs, now);

  // Build retention timeline (projected 7 days)
  const retentionTimeline: any[] = [];
  for (let h = 0; h <= 168; h += 12) {
    const futureRetention = Math.exp(-(f.hoursSinceReview + h) / f.stability);
    retentionTimeline.push({
      hours_from_now: h,
      predicted_retention: round4(futureRetention),
      predicted_retention_pct: Math.round(futureRetention * 100),
      label: h === 0 ? "Now" : h < 24 ? `${h}h` : `${Math.round(h / 24)}d`,
    });
  }

  // Study history summary
  const totalSessions = studyLogs.length;
  const totalMinutes = studyLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  const confidenceDist = {
    high: studyLogs.filter((l: any) => l.confidence_level === "high").length,
    medium: studyLogs.filter((l: any) => l.confidence_level === "medium").length,
    low: studyLogs.filter((l: any) => l.confidence_level === "low").length,
  };

  // Determine fix difficulty
  const retPct = Math.round(f.predictedRetention * 100);
  const fixDifficulty = retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard";

  return json({
    success: true,
    data: {
      topic_id: topic.id,
      topic_name: topic.name,
      subject_name: topic.subjects?.name || null,
      memory_strength: Math.round(Number(topic.memory_strength) || 0),
      predicted_retention: round4(f.predictedRetention),
      predicted_retention_pct: retPct,
      decay_rate: parseFloat(f.decayRate.toFixed(6)),
      stability_hours: round2(f.stability),
      hours_since_last_review: round2(f.hoursSinceReview),
      last_revision_date: topic.last_revision_date,
      next_optimal_review: f.nextOptimalReview.toISOString(),
      hours_until_optimal_review: Math.max(0, round2(f.hoursUntil70 - f.hoursSinceReview)),
      risk_level: f.predictedRetention < 0.3 ? "critical" : f.predictedRetention < 0.5 ? "high" : f.predictedRetention < 0.7 ? "medium" : "low",
      factors: {
        initial_mastery: { value: round4(f.initialMastery), label: "Initial Mastery", description: "Based on high-confidence study sessions" },
        recall_strength: { value: round4(f.recallStrength), label: "Recall Strength", description: "Review frequency × recency" },
        latency_factor: { value: round4(f.latencyFactor), label: "Encoding Speed", description: "Faster study = stronger encoding" },
        error_severity: { value: round4(f.errorSeverity), label: "Error Severity", description: "Recent low-confidence answers" },
        time_gap: { value: round2(f.timeGapHours), label: "Time Gap (hours)", description: "Hours since last review" },
      },
      retention_timeline: retentionTimeline,
      study_history: {
        total_sessions: totalSessions,
        total_minutes: totalMinutes,
        confidence_distribution: confidenceDist,
        recent_sessions: studyLogs.slice(0, 5).map((l: any) => ({
          id: l.id,
          date: l.created_at,
          duration_minutes: l.duration_minutes,
          confidence: l.confidence_level,
          mode: l.study_mode,
          notes: l.notes,
        })),
      },
      fix_config: {
        difficulty: fixDifficulty,
        question_count: 5,
        time_limit_seconds: 180,
        estimated_boost: Math.round((1 - f.predictedRetention) * 30),
      },
    },
  });
}

// ─── ROUTE: fix-init ───
// Initializes a Quick Fix session for a specific topic
async function handleFixInit(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, retention_pct } = body;
  if (!topic_name) return json({ error: "topic_name is required" }, 400);

  const retPct = typeof retention_pct === "number" ? retention_pct : 50;
  const difficulty = retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard";

  // Fetch topic
  const { data: topicRow } = await userClient
    .from("topics")
    .select("id, name, memory_strength, last_revision_date, decay_rate")
    .eq("user_id", user.id)
    .eq("name", topic_name)
    .is("deleted_at", null)
    .maybeSingle();

  // Recent study logs
  let recentSessions = 0;
  let totalStudyMinutes = 0;
  if (topicRow) {
    const { data: logs } = await userClient
      .from("study_logs")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .eq("topic_id", topicRow.id)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString());
    recentSessions = logs?.length || 0;
    totalStudyMinutes = (logs || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  }

  const currentStrength = topicRow ? Math.round(Number(topicRow.memory_strength) || 0) : 0;

  return json({
    success: true,
    data: {
      session_config: {
        topic_name,
        subject_name: subject_name || "General",
        difficulty,
        question_count: 5,
        time_limit_seconds: 180,
        session_type: "quick_fix",
      },
      topic_analysis: {
        topic_id: topicRow?.id || null,
        current_memory_strength: currentStrength,
        retention_pct: retPct,
        decay_rate: topicRow?.decay_rate || 0.05,
        last_revision: topicRow?.last_revision_date || null,
        recent_sessions_7d: recentSessions,
        total_study_minutes_7d: totalStudyMinutes,
        risk_level: currentStrength < 30 ? "critical" : currentStrength < 50 ? "high" : currentStrength < 70 ? "medium" : "low",
      },
      analysis_steps: [
        { step: 1, label: "Scanning topic memory", status: "complete" },
        { step: 2, label: "Identifying weak points", status: "complete" },
        { step: 3, label: "Generating targeted questions", status: "complete" },
        { step: 4, label: "Calibrating difficulty", status: "complete" },
      ],
    },
  });
}

// ─── ROUTE: fix-questions ───
// Generates AI-powered MCQ questions
async function handleFixQuestions(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, retention_pct, count, difficulty: overrideDiff } = body;
  if (!topic_name) return json({ error: "topic_name is required" }, 400);

  const retPct = typeof retention_pct === "number" ? retention_pct : 50;
  const difficulty = overrideDiff || (retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard");
  const qCount = Math.min(Math.max(count || 5, 3), 10);

  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) return json({ error: "AI not configured" }, 500);

  const prompt = `Generate ${qCount} multiple-choice questions for a student studying "${topic_name}" under subject "${subject_name || "General"}".
Difficulty: ${difficulty} (student's current retention is ${retPct}%).

Return ONLY a valid JSON array, no markdown:
[
  {
    "question": "...",
    "options": ["A text", "B text", "C text", "D text"],
    "correct_index": 0,
    "explanation": "Brief explanation why the correct answer is right",
    "difficulty": "${difficulty}",
    "concept_tag": "micro-concept tested"
  }
]

Rules:
- Exactly 4 options per question
- correct_index is 0-based
- Questions should target weak recall areas for ${difficulty} difficulty
- Explanations must be concise (1-2 sentences)
- Each question tests a distinct concept`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: "You are an expert question generator for competitive exam preparation. Return only valid JSON." },
        { role: "user", content: prompt },
      ],
      temperature: 0.7,
    }),
  });

  if (!resp.ok) {
    if (resp.status === 429) return json({ error: "Rate limited. Try again shortly." }, 429);
    if (resp.status === 402) return json({ error: "AI credits exhausted." }, 402);
    return json({ error: "AI generation failed" }, 500);
  }

  const aiData = await resp.json();
  let text = aiData.choices?.[0]?.message?.content || "";
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();

  let questions: any[];
  try {
    questions = JSON.parse(text);
  } catch {
    return json({ error: "Failed to parse AI response" }, 500);
  }

  if (!Array.isArray(questions) || questions.length === 0) {
    return json({ error: "No questions generated" }, 500);
  }

  const normalized = questions.map((q: any, i: number) => ({
    question: String(q.question || ""),
    options: Array.isArray(q.options) ? q.options.map(String) : ["A", "B", "C", "D"],
    correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
    explanation: String(q.explanation || ""),
    difficulty: String(q.difficulty || difficulty),
    concept_tag: String(q.concept_tag || ""),
    question_number: i + 1,
  }));

  return json({
    success: true,
    data: {
      topic_name,
      subject_name: subject_name || "General",
      difficulty,
      retention_pct: retPct,
      question_count: normalized.length,
      time_limit_seconds: 180,
      questions: normalized,
    },
  });
}

// ─── ROUTE: fix-submit ───
// Validates a single answer
async function handleFixSubmit(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { question_number, selected_index, correct_index, question_text, topic_name } = body;
  if (typeof selected_index !== "number" || typeof correct_index !== "number") {
    return json({ error: "selected_index and correct_index are required" }, 400);
  }

  return json({
    success: true,
    data: {
      question_number: question_number || 1,
      selected_index,
      correct_index,
      is_correct: selected_index === correct_index,
      topic_name: topic_name || "",
      question_text: question_text || "",
      points_earned: selected_index === correct_index ? 1 : 0,
    },
  });
}

// ─── ROUTE: fix-complete ───
// Finishes quiz, logs study, updates memory, returns results
async function handleFixComplete(body: any, userClient: any, adminClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, answers, total_questions, time_taken_seconds, retention_pct } = body;
  if (!topic_name || !Array.isArray(answers)) {
    return json({ error: "topic_name and answers array are required" }, 400);
  }

  const totalQ = total_questions || answers.length;
  const correctCount = answers.filter((a: any) => a.selected_index === a.correct_index).length;
  const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const memoryBoost = Math.round((correctCount / Math.max(totalQ, 1)) * 30);
  const confidence: string = accuracy >= 80 ? "high" : accuracy >= 50 ? "medium" : "low";
  const subName = subject_name || "General";
  const durationMinutes = time_taken_seconds ? Math.max(1, Math.round(time_taken_seconds / 60)) : 3;

  // Find or create subject
  let { data: subject } = await adminClient
    .from("subjects").select("id").eq("user_id", user.id).eq("name", subName).maybeSingle();
  if (!subject) {
    const { data: newSub } = await adminClient
      .from("subjects").insert({ user_id: user.id, name: subName }).select("id").single();
    subject = newSub;
  }

  // Find or create topic + update memory
  let topicId: string | null = null;
  let oldStrength = 0;
  let newStrength = 0;

  if (subject) {
    let { data: topicRow } = await adminClient
      .from("topics").select("id, memory_strength")
      .eq("user_id", user.id).eq("subject_id", subject.id).eq("name", topic_name).maybeSingle();

    if (!topicRow) {
      const initStr = confidence === "high" ? 80 : confidence === "medium" ? 50 : 30;
      const { data: newT } = await adminClient
        .from("topics")
        .insert({ user_id: user.id, subject_id: subject.id, name: topic_name, memory_strength: initStr, last_revision_date: new Date().toISOString() })
        .select("id, memory_strength").single();
      topicRow = newT;
    }

    if (topicRow) {
      topicId = topicRow.id;
      oldStrength = Number(topicRow.memory_strength) || 0;
      newStrength = Math.min(100, oldStrength + memoryBoost);
      await adminClient.from("topics").update({ memory_strength: newStrength, last_revision_date: new Date().toISOString() }).eq("id", topicRow.id);
    }
  }

  // Log study
  await adminClient.from("study_logs").insert({
    user_id: user.id,
    subject_id: subject?.id || null,
    topic_id: topicId,
    duration_minutes: durationMinutes,
    confidence_level: confidence,
    study_mode: "fix",
    notes: `Quick Fix: ${correctCount}/${totalQ} correct (${accuracy}%)`,
  });

  // ML event (non-blocking)
  adminClient.from("ml_events").insert({
    user_id: user.id,
    event_type: "quick_fix_complete",
    event_category: "study",
    payload: { topic: topic_name, subject: subName, score: correctCount, total: totalQ, accuracy, memory_boost: memoryBoost, old_strength: oldStrength, new_strength: newStrength, time_taken_seconds: time_taken_seconds || 180 },
  }).then(() => {}).catch(() => {});

  const resultMessage = correctCount === totalQ ? "Perfect! 🎉" : accuracy >= 60 ? "Great job! 💪" : "Keep practicing! 📚";

  return json({
    success: true,
    data: {
      score: correctCount,
      total_questions: totalQ,
      accuracy,
      result_message: resultMessage,
      memory_update: {
        topic_name,
        subject_name: subName,
        old_strength: oldStrength,
        new_strength: newStrength,
        memory_boost: memoryBoost,
        retention_recalculated: true,
      },
      session_stats: {
        duration_minutes: durationMinutes,
        confidence_level: confidence,
        study_mode: "fix",
        time_taken_seconds: time_taken_seconds || 180,
      },
      answer_breakdown: answers.map((a: any, i: number) => ({
        question_number: a.question_number || i + 1,
        selected_index: a.selected_index,
        correct_index: a.correct_index,
        is_correct: a.selected_index === a.correct_index,
      })),
      keep_momentum: {
        suggestion: accuracy >= 80 ? "You've mastered this! Try a harder topic next."
          : accuracy >= 50 ? "Good progress! One more session will solidify this."
          : "Review the explanations and try again in a few hours.",
        next_review_in_hours: accuracy >= 80 ? 48 : accuracy >= 50 ? 24 : 4,
      },
    },
  });
}

// ─── MAIN ROUTER ───
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userClient, adminClient } = getClients(req);

    let body: Record<string, any> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const action = String(
      body.action || req.headers.get("x-route") || new URL(req.url).searchParams.get("action") || "dashboard"
    );

    switch (action) {
      case "dashboard":
        return await handleDashboard(body, userClient);
      case "topic-detail":
      case "topic_detail":
        return await handleTopicDetail(body, userClient);
      case "fix-init":
      case "fix_init":
        return await handleFixInit(body, userClient);
      case "fix-questions":
      case "fix_questions":
        return await handleFixQuestions(body, userClient);
      case "fix-submit":
      case "fix_submit":
        return await handleFixSubmit(body, userClient);
      case "fix-complete":
      case "fix_complete":
        return await handleFixComplete(body, userClient, adminClient);
      default:
        return json({
          error: `Unknown action: ${action}`,
          available_actions: ["dashboard", "topic-detail", "fix-init", "fix-questions", "fix-submit", "fix-complete"],
        }, 400);
    }
  } catch (e) {
    console.error("forgetting-curve error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
