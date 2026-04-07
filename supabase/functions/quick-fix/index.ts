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

function getSupabase(req: Request) {
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY") || Deno.env.get("SUPABASE_PUBLISHABLE_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const authHeader = req.headers.get("authorization") || "";
  const userClient = createClient(url, anon, {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(url, serviceKey);
  return { userClient, adminClient };
}

async function getUser(userClient: any) {
  const { data: { user }, error } = await userClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

// ─── AI Question Generator ───
async function generateQuestions(
  topicName: string,
  subjectName: string,
  difficulty: string,
  count: number,
  retentionPct: number,
) {
  const apiKey = Deno.env.get("LOVABLE_API_KEY");
  if (!apiKey) throw new Error("AI not configured");

  const prompt = `Generate ${count} multiple-choice questions for a student studying "${topicName}" under subject "${subjectName}".
Difficulty: ${difficulty} (student's current retention is ${retentionPct}%).

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
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
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
    if (resp.status === 429) throw new Error("Rate limited. Try again shortly.");
    if (resp.status === 402) throw new Error("AI credits exhausted.");
    throw new Error("AI generation failed");
  }

  const aiData = await resp.json();
  let text = aiData.choices?.[0]?.message?.content || "";
  // Strip markdown fences
  text = text.replace(/```json\s*/gi, "").replace(/```\s*/gi, "").trim();
  const questions = JSON.parse(text);
  if (!Array.isArray(questions) || questions.length === 0) throw new Error("No questions generated");

  return questions.map((q: any, i: number) => ({
    question: String(q.question || ""),
    options: Array.isArray(q.options) ? q.options.map(String) : ["A", "B", "C", "D"],
    correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
    explanation: String(q.explanation || ""),
    difficulty: String(q.difficulty || difficulty),
    concept_tag: String(q.concept_tag || ""),
    question_number: i + 1,
  }));
}

// ─── ROUTE: init ───
// Analyzes the topic and returns metadata for the quiz session
async function handleInit(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, retention_pct } = body;
  if (!topic_name) return json({ error: "topic_name is required" }, 400);

  const retPct = typeof retention_pct === "number" ? retention_pct : 50;
  const difficulty = retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard";

  // Fetch topic data if exists
  const { data: topicRow } = await userClient
    .from("topics")
    .select("id, name, memory_strength, last_revision_date, decay_rate")
    .eq("user_id", user.id)
    .eq("name", topic_name)
    .maybeSingle();

  // Fetch recent study logs for this topic
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  let recentSessions = 0;
  let totalStudyMinutes = 0;

  if (topicRow) {
    const { data: logs } = await userClient
      .from("study_logs")
      .select("duration_minutes, created_at")
      .eq("user_id", user.id)
      .eq("topic_id", topicRow.id)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString())
      .order("created_at", { ascending: false });

    recentSessions = logs?.length || 0;
    totalStudyMinutes = (logs || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
  }

  const currentStrength = topicRow ? Number(topicRow.memory_strength) || 0 : 0;
  const decayRate = topicRow?.decay_rate || 0.05;

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
        decay_rate: decayRate,
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

// ─── ROUTE: questions ───
// Generates AI-powered MCQ questions for the quiz
async function handleQuestions(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { topic_name, subject_name, retention_pct, count, difficulty: overrideDiff } = body;
  if (!topic_name) return json({ error: "topic_name is required" }, 400);

  const retPct = typeof retention_pct === "number" ? retention_pct : 50;
  const difficulty = overrideDiff || (retPct < 30 ? "easy" : retPct < 60 ? "medium" : "hard");
  const qCount = Math.min(Math.max(count || 5, 3), 10);

  const questions = await generateQuestions(topic_name, subject_name || "General", difficulty, qCount, retPct);

  return json({
    success: true,
    data: {
      topic_name,
      subject_name: subject_name || "General",
      difficulty,
      retention_pct: retPct,
      question_count: questions.length,
      time_limit_seconds: 180,
      questions,
    },
  });
}

// ─── ROUTE: submit-answer ───
// Validates a single answer and returns correctness + explanation
async function handleSubmitAnswer(body: any, userClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const { question_number, selected_index, correct_index, question_text, topic_name } = body;
  if (typeof selected_index !== "number" || typeof correct_index !== "number") {
    return json({ error: "selected_index and correct_index are required" }, 400);
  }

  const isCorrect = selected_index === correct_index;

  return json({
    success: true,
    data: {
      question_number: question_number || 1,
      selected_index,
      correct_index,
      is_correct: isCorrect,
      topic_name: topic_name || "",
      question_text: question_text || "",
      points_earned: isCorrect ? 1 : 0,
    },
  });
}

// ─── ROUTE: complete ───
// Finishes the quiz, logs study, updates memory strength, returns full results
async function handleComplete(body: any, userClient: any, adminClient: any) {
  const user = await getUser(userClient);
  if (!user) return json({ error: "Unauthorized" }, 401);

  const {
    topic_name,
    subject_name,
    answers, // [{ question_number, selected_index, correct_index }]
    total_questions,
    time_taken_seconds,
    retention_pct,
  } = body;

  if (!topic_name || !Array.isArray(answers)) {
    return json({ error: "topic_name and answers array are required" }, 400);
  }

  const totalQ = total_questions || answers.length;
  const correctCount = answers.filter((a: any) => a.selected_index === a.correct_index).length;
  const accuracy = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const memoryBoost = Math.round((correctCount / Math.max(totalQ, 1)) * 30);
  const confidence: "low" | "medium" | "high" =
    accuracy >= 80 ? "high" : accuracy >= 50 ? "medium" : "low";

  const subName = subject_name || "General";
  const durationMinutes = time_taken_seconds
    ? Math.max(1, Math.round(time_taken_seconds / 60))
    : 3;

  // ─── Find or create subject ───
  let { data: subject } = await adminClient
    .from("subjects")
    .select("id")
    .eq("user_id", user.id)
    .eq("name", subName)
    .maybeSingle();

  if (!subject) {
    const { data: newSub } = await adminClient
      .from("subjects")
      .insert({ user_id: user.id, name: subName })
      .select("id")
      .single();
    subject = newSub;
  }

  // ─── Find or create topic ───
  let topicId: string | null = null;
  let oldStrength = 0;
  let newStrength = 0;

  if (subject) {
    let { data: topicRow } = await adminClient
      .from("topics")
      .select("id, memory_strength")
      .eq("user_id", user.id)
      .eq("subject_id", subject.id)
      .eq("name", topic_name)
      .maybeSingle();

    if (!topicRow) {
      const initStrength = confidence === "high" ? 80 : confidence === "medium" ? 50 : 30;
      const { data: newTopic } = await adminClient
        .from("topics")
        .insert({
          user_id: user.id,
          subject_id: subject.id,
          name: topic_name,
          memory_strength: initStrength,
          last_revision_date: new Date().toISOString(),
        })
        .select("id, memory_strength")
        .single();
      topicRow = newTopic;
    }

    if (topicRow) {
      topicId = topicRow.id;
      oldStrength = Number(topicRow.memory_strength) || 0;
      newStrength = Math.min(100, oldStrength + memoryBoost);

      // Update topic memory
      await adminClient
        .from("topics")
        .update({
          memory_strength: newStrength,
          last_revision_date: new Date().toISOString(),
        })
        .eq("id", topicRow.id);
    }
  }

  // ─── Log study session ───
  await adminClient.from("study_logs").insert({
    user_id: user.id,
    subject_id: subject?.id || null,
    topic_id: topicId,
    duration_minutes: durationMinutes,
    confidence_level: confidence,
    study_mode: "fix",
    notes: `Quick Fix: ${correctCount}/${totalQ} correct (${accuracy}%)`,
  });

  // ─── Track ML event (non-blocking) ───
  adminClient.from("ml_events").insert({
    user_id: user.id,
    event_type: "quick_fix_complete",
    event_category: "study",
    payload: {
      topic: topic_name,
      subject: subName,
      score: correctCount,
      total: totalQ,
      accuracy,
      memory_boost: memoryBoost,
      old_strength: oldStrength,
      new_strength: newStrength,
      time_taken_seconds: time_taken_seconds || 180,
    },
  }).then(() => {}).catch(() => {});

  // ─── Build result message ───
  const resultMessage =
    correctCount === totalQ
      ? "Perfect! 🎉"
      : accuracy >= 60
      ? "Great job! 💪"
      : "Keep practicing! 📚";

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
        suggestion: accuracy >= 80
          ? "You've mastered this! Try a harder topic next."
          : accuracy >= 50
          ? "Good progress! One more session will solidify this."
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
    const { userClient, adminClient } = getSupabase(req);

    let body: Record<string, any> = {};
    if (req.method !== "GET" && req.method !== "HEAD") {
      const raw = await req.text();
      if (raw.trim()) body = JSON.parse(raw);
    }

    const action = String(
      body.action || req.headers.get("x-route") || new URL(req.url).searchParams.get("action") || "init"
    );

    switch (action) {
      case "init":
        return await handleInit(body, userClient);
      case "questions":
        return await handleQuestions(body, userClient);
      case "submit-answer":
      case "submit_answer":
        return await handleSubmitAnswer(body, userClient);
      case "complete":
        return await handleComplete(body, userClient, adminClient);
      default:
        return json({ error: `Unknown action: ${action}`, available_actions: ["init", "questions", "submit-answer", "complete"] }, 400);
    }
  } catch (e) {
    console.error("quick-fix error:", e);
    return json({ error: e instanceof Error ? e.message : "Unknown error" }, 500);
  }
});
