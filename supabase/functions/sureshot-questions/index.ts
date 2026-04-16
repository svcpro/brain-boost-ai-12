import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-api-key, api-key, content-type, x-route",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const adminClient = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
);

function safeJsonParse(raw: string): any {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const startBrace = text.indexOf("{");
  const startBracket = text.indexOf("[");
  let start = -1;
  if (startBrace === -1) start = startBracket;
  else if (startBracket === -1) start = startBrace;
  else start = Math.min(startBrace, startBracket);
  if (start === -1) throw new Error("No JSON found");
  text = text.substring(start);
  try { return JSON.parse(text); } catch {}
  let depth = 0, inStr = false, esc = false, endPos = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (esc) { esc = false; continue; }
    if (c === "\\") { esc = true; continue; }
    if (c === '"') { inStr = !inStr; continue; }
    if (inStr) continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") { depth--; if (depth === 0) { endPos = i; break; } }
  }
  if (endPos > 0) { try { return JSON.parse(text.substring(0, endPos + 1)); } catch {} }
  throw new Error("Could not parse JSON from AI response");
}

function safeNum(v: any, fb = 0): number { const n = Number(v); return isNaN(n) ? fb : n; }

async function resolveUserId(req: Request): Promise<string | null> {
  const authHeader = req.headers.get("authorization") || "";
  if (authHeader.startsWith("Bearer ey")) {
    const token = authHeader.replace("Bearer ", "");
    const { data } = await adminClient.auth.getUser(token);
    if (data?.user?.id) return data.user.id;
  }
  const apiKey = req.headers.get("x-api-key") || req.headers.get("api-key") || "";
  if (apiKey) {
    const prefix = apiKey.substring(0, 10) + "...";
    const { data } = await adminClient.from("api_keys").select("created_by").eq("key_prefix", prefix).eq("is_active", true).maybeSingle();
    if (data?.created_by) return data.created_by;
  }
  if (authHeader.startsWith("acry_")) {
    const prefix = authHeader.substring(0, 10) + "...";
    const { data } = await adminClient.from("api_keys").select("created_by").eq("key_prefix", prefix).eq("is_active", true).maybeSingle();
    if (data?.created_by) return data.created_by;
  }
  return null;
}

function respond(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: init — Dashboard overview for SureShot Questions
// ═══════════════════════════════════════════════════════════
async function handleInit(userId: string, body: any) {
  const { data: profile } = await adminClient.from("profiles").select("exam_type, display_name").eq("id", userId).maybeSingle();
  const examType = body.exam_type || profile?.exam_type || "General";

  // Parallel data fetching
  const [progressRes, pyqRes, topicsRes, memoryRes] = await Promise.all([
    adminClient.from("practice_progress").select("is_correct, question_source, created_at").eq("user_id", userId),
    adminClient.from("question_bank").select("id, topic, subject, year, difficulty, exam_type").eq("exam_type", examType).limit(1000),
    adminClient.from("topics").select("id, name, subject, exam_type"),
    adminClient.from("memory_scores").select("topic_id, score, memory_strength").eq("user_id", userId),
  ]);

  const progress = progressRes.data || [];
  const pyqs = pyqRes.data || [];
  const topics = topicsRes.data || [];
  const memoryScores = memoryRes.data || [];

  // Stats
  const totalPracticed = progress.length;
  const predictedPracticed = progress.filter((p: any) => p.question_source === "predicted").length;
  const correctCount = progress.filter((p: any) => p.is_correct).length;
  const accuracy = totalPracticed > 0 ? Math.round((correctCount / totalPracticed) * 100) : 0;

  // PYQ analysis
  const topicFreq: Record<string, { count: number; years: Set<number>; subjects: Set<string> }> = {};
  for (const q of pyqs) {
    const key = q.topic || q.subject || "General";
    if (!topicFreq[key]) topicFreq[key] = { count: 0, years: new Set(), subjects: new Set() };
    topicFreq[key].count++;
    if (q.year) topicFreq[key].years.add(q.year);
    if (q.subject) topicFreq[key].subjects.add(q.subject);
  }

  const topicMap = new Map(topics.map((t: any) => [t.id, t]));
  const memoryMap: Record<string, number> = {};
  for (const ms of memoryScores) {
    const topic = topicMap.get(ms.topic_id);
    if (topic) memoryMap[topic.name] = safeNum(ms.memory_strength, 0) * 100;
  }

  // Top trending topics
  const trending = Object.entries(topicFreq)
    .sort((a, b) => b[1].count - a[1].count)
    .slice(0, 10)
    .map(([name, data]) => ({
      topic: name,
      pyq_count: data.count,
      years_appeared: [...data.years].sort(),
      subjects: [...data.subjects],
      repeat_rate: data.years.size > 0 ? Math.round((data.count / data.years.size) * 100) / 100 : 0,
      memory_strength: Math.round(memoryMap[name] || 0),
      is_weak: (memoryMap[name] || 0) < 50,
    }));

  // Subject distribution
  const subjectDist: Record<string, number> = {};
  for (const q of pyqs) {
    if (q.subject) subjectDist[q.subject] = (subjectDist[q.subject] || 0) + 1;
  }

  return respond({
    success: true,
    action: "init",
    sureshot_questions: {
      user: {
        name: profile?.display_name || "Student",
        exam_type: examType,
      },
      stats: {
        total_pyqs_analyzed: pyqs.length,
        total_practiced: totalPracticed,
        predicted_practiced: predictedPracticed,
        accuracy_percentage: accuracy,
        correct_count: correctCount,
        total_topics: Object.keys(topicFreq).length,
      },
      trending_topics: trending,
      subject_distribution: Object.entries(subjectDist).map(([subject, count]) => ({
        subject,
        count,
        percentage: Math.round((count / Math.max(pyqs.length, 1)) * 100),
      })),
      available_modes: [
        { key: "ai_predicted", label: "🔥 AI Predicted Questions", description: "ML-powered questions based on 8-factor trend analysis", icon: "Brain" },
        { key: "pyq_bank", label: "📚 PYQ Question Bank", description: "Practice from real past year questions", icon: "BookOpen" },
      ],
      cta: {
        label: "Start Practice",
        sublabel: `${pyqs.length}+ PYQs analyzed • AI-powered predictions`,
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: generate — AI Predicted Question Generation
// ═══════════════════════════════════════════════════════════
async function handleGenerate(userId: string, body: any) {
  const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
  if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

  const { data: profile } = await adminClient.from("profiles").select("exam_type").eq("id", userId).maybeSingle();
  const examType = body.exam_type || profile?.exam_type || "competitive exam";
  const subject = body.subject || "mixed subjects";
  const questionCount = Math.min(body.count || 10, 20);

  // Deep PYQ pattern analysis
  const { data: pyqData } = await adminClient
    .from("question_bank")
    .select("topic, subject, year, difficulty, question")
    .eq("exam_type", examType)
    .order("year", { ascending: false });

  const totalPYQs = pyqData?.length || 0;
  const allYears = [...new Set((pyqData || []).map((q: any) => q.year).filter(Boolean))].sort();
  const yearSpan = allYears.length;
  const recentYear = allYears[allYears.length - 1] || 2024;
  const maxYears = Math.max(yearSpan, 5);

  // Build topic analytics
  const topicAnalytics: Record<string, { count: number; years: Set<number>; difficulties: string[]; yearCounts: Record<number, number>; questions: string[]; subjects: Set<string> }> = {};
  const subjectFrequency: Record<string, number> = {};

  for (const q of (pyqData || [])) {
    const key = q.topic || q.subject || "General";
    if (!topicAnalytics[key]) {
      topicAnalytics[key] = { count: 0, years: new Set(), difficulties: [], yearCounts: {}, questions: [], subjects: new Set() };
    }
    const ta = topicAnalytics[key];
    ta.count++;
    if (q.year) { ta.years.add(q.year); ta.yearCounts[q.year] = (ta.yearCounts[q.year] || 0) + 1; }
    if (q.difficulty) ta.difficulties.push(q.difficulty);
    if (q.question) ta.questions.push(q.question.slice(0, 100));
    if (q.subject) { ta.subjects.add(q.subject); subjectFrequency[q.subject] = (subjectFrequency[q.subject] || 0) + 1; }
  }

  // Cross-exam + user data
  const [crossExamRes, userTopicsRes, prevPracticedRes] = await Promise.all([
    adminClient.from("question_bank").select("exam_type, topic").neq("exam_type", examType).limit(500),
    adminClient.from("topics").select("name, memory_strength").eq("user_id", userId).eq("deleted", false).order("memory_strength", { ascending: true }).limit(20),
    adminClient.from("practice_progress").select("question_id").eq("user_id", userId).eq("question_source", "predicted"),
  ]);

  const crossExamTopics: Record<string, Set<string>> = {};
  for (const q of (crossExamRes.data || [])) {
    const key = q.topic || "General";
    if (!crossExamTopics[key]) crossExamTopics[key] = new Set();
    crossExamTopics[key].add(q.exam_type);
  }

  const studiedTopicNames = new Set((userTopicsRes.data || []).map((t: any) => t.name?.toLowerCase()));
  const userTopics = userTopicsRes.data || [];
  const prevPracticed = prevPracticedRes.data || [];

  // Dedup
  const prevIds = prevPracticed.map((p: any) => p.question_id).filter(Boolean);
  let prevQuestionTexts: string[] = [];
  if (prevIds.length > 0) {
    const { data: prevQs } = await adminClient.from("question_bank").select("question").in("id", prevIds.slice(0, 50));
    prevQuestionTexts = (prevQs || []).map((q: any) => q.question?.slice(0, 80) || "");
  }

  // 8-factor scoring
  function computeScore(topicName: string, analytics: any) {
    const sortedYears = [...allYears].sort();
    const yearCounts = sortedYears.map((y: number) => analytics.yearCounts[y] || 0);
    const n = yearCounts.length;

    // Trend direction via linear regression
    let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
    for (let i = 0; i < n; i++) { sumX += i; sumY += yearCounts[i]; sumXY += i * yearCounts[i]; sumXX += i * i; }
    const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;

    const lastTwoYears = sortedYears.slice(-2);
    const recentPresence = lastTwoYears.filter((y: number) => (analytics.yearCounts[y] || 0) > 0).length;
    const earlyYears = sortedYears.slice(0, -2);
    const earlyAbsence = earlyYears.length > 0 && earlyYears.filter((y: number) => (analytics.yearCounts[y] || 0) === 0).length >= 2;
    const isComeback = recentPresence > 0 && earlyAbsence && slope > 0;

    let trendDirection: string;
    if (isComeback) trendDirection = "comeback";
    else if (slope > 0.3) trendDirection = "rising";
    else if (slope < -0.3) trendDirection = "declining";
    else trendDirection = "stable";

    const recentWeight = lastTwoYears.reduce((s: number, y: number) => s + (analytics.yearCounts[y] || 0), 0);
    const avgCount = analytics.count / Math.max(maxYears, 1);
    const trendMomentum = Math.round(Math.max(0, Math.min(100, (Math.abs(slope) * 30) + (recentWeight / Math.max(avgCount, 1)) * 35 + (analytics.years.size / maxYears) * 35)));

    const mean = yearCounts.reduce((a: number, b: number) => a + b, 0) / Math.max(n, 1);
    const variance = yearCounts.reduce((s: number, v: number) => s + Math.pow(v - mean, 2), 0) / Math.max(n, 1);
    const volatilityIndex = Math.round(Math.min(100, (Math.sqrt(variance) / Math.max(mean, 0.5)) * 50));
    const patternStability = Math.round(Math.max(0, Math.min(100, (analytics.years.size / maxYears) * 60 + (mean > 0 ? 1 - (Math.sqrt(variance) / (mean * 2)) : 0) * 40)));

    // Difficulty evolution
    const recentDiffs = (pyqData || []).filter((q: any) => q.topic === topicName && q.year && q.year >= recentYear - 1).map((q: any) => q.difficulty);
    const olderDiffs = (pyqData || []).filter((q: any) => q.topic === topicName && q.year && q.year < recentYear - 1).map((q: any) => q.difficulty);
    const recentHardRatio = recentDiffs.filter((d: any) => d === "hard").length / Math.max(recentDiffs.length, 1);
    const olderHardRatio = olderDiffs.filter((d: any) => d === "hard").length / Math.max(olderDiffs.length, 1);
    const difficultyEvolution = recentHardRatio > olderHardRatio + 0.2 ? "conceptual_shift" : recentHardRatio < olderHardRatio - 0.2 ? "factual_shift" : "stable";

    // Framing change
    const recentQs = analytics.questions.slice(0, Math.ceil(analytics.questions.length / 2));
    const statementCount = recentQs.filter((q: string) => q.toLowerCase().includes("statement") || q.toLowerCase().includes("assertion")).length;
    const caseStudyCount = recentQs.filter((q: string) => q.toLowerCase().includes("case") || q.toLowerCase().includes("passage")).length;
    const framingChange = statementCount > recentQs.length * 0.3 ? "statement_increase" : caseStudyCount > recentQs.length * 0.2 ? "case_study_growth" : "stable";

    // Factor values
    const f1_trendMomentum = trendMomentum;
    const alpha = 0.4;
    let ewma = analytics.yearCounts[sortedYears[0]] || 0;
    for (let i = 1; i < sortedYears.length; i++) ewma = alpha * (analytics.yearCounts[sortedYears[i]] || 0) + (1 - alpha) * ewma;
    const f2_timeSeries = Math.round(Math.min(100, (ewma / Math.max(avgCount, 0.5)) * 50));
    const f3_histFreq = Math.round(Math.min(100, (analytics.count / Math.max(totalPYQs, 1)) * 100 * 10));
    const diffCounts: Record<string, number> = {};
    analytics.difficulties.forEach((d: string) => diffCounts[d] = (diffCounts[d] || 0) + 1);
    const f4_diffAlign = analytics.difficulties.length > 0 ? Math.round((Math.max(...Object.values(diffCounts)) / analytics.difficulties.length) * 100) : 50;
    const uniqueStarts = new Set(analytics.questions.map((q: string) => q.slice(0, 30).toLowerCase()));
    const f5_semantic = analytics.questions.length > 1 ? Math.round(Math.min(100, (uniqueStarts.size / analytics.questions.length) * 100)) : 60;
    const yearsPresent = [...analytics.years].sort();
    let f6_examiner = 50;
    if (yearsPresent.length >= 3) {
      const gaps = [];
      for (let i = 1; i < yearsPresent.length; i++) gaps.push(yearsPresent[i] - yearsPresent[i - 1]);
      const avgGap = gaps.reduce((a: number, b: number) => a + b, 0) / gaps.length;
      const gv = gaps.reduce((s: number, g: number) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
      f6_examiner = Math.round(Math.max(30, Math.min(100, 100 - gv * 20)));
    }
    const f7_crossExam = Math.round(Math.min(100, (crossExamTopics[topicName]?.size || 0) * 25 + ((crossExamTopics[topicName]?.size || 0) > 0 ? 30 : 0)));
    const isStudied = studiedTopicNames.has(topicName.toLowerCase());
    const userStrength = userTopics.find((t: any) => t.name?.toLowerCase() === topicName.toLowerCase());
    const memStr = userStrength ? safeNum((userStrength as any).memory_strength, 0) : 0;
    const f8_syllabus = isStudied ? Math.round(Math.max(20, 100 - memStr * 100)) : 85;

    const rawScore = f1_trendMomentum * 0.20 + f2_timeSeries * 0.15 + f3_histFreq * 0.15 + f4_diffAlign * 0.12 + f5_semantic * 0.08 + f6_examiner * 0.08 + f7_crossExam * 0.12 + f8_syllabus * 0.10;
    const finalScore = Math.round(Math.max(55, Math.min(85, rawScore)));
    const trendStrength = trendMomentum >= 70 ? "High" : trendMomentum >= 40 ? "Medium" : "Emerging";

    return {
      finalScore, trendDirection, trendMomentum, volatilityIndex, patternStability,
      difficultyEvolution, framingChange, trendStrength, yearBreakdown: analytics.yearCounts,
      score_breakdown: { trend_momentum: f1_trendMomentum, time_series_forecast: f2_timeSeries, historical_frequency: f3_histFreq, difficulty_alignment: f4_diffAlign, semantic_similarity: f5_semantic, examiner_behavior: f6_examiner, cross_exam_correlation: f7_crossExam, syllabus_coverage: f8_syllabus },
    };
  }

  const topicScores: Record<string, any> = {};
  for (const [topicName, analytics] of Object.entries(topicAnalytics)) {
    topicScores[topicName] = computeScore(topicName, analytics);
  }

  const rankedTopics = Object.entries(topicScores).sort(([, a]: any, [, b]: any) => b.finalScore - a.finalScore);
  const patternSummary = rankedTopics.slice(0, 15).map(([t, s]: any) =>
    `${t}: Score=${s.finalScore}%, Trend=${s.trendDirection}, Momentum=${s.trendMomentum}, CrossExam=${s.score_breakdown.cross_exam_correlation}, Syllabus=${s.score_breakdown.syllabus_coverage}`
  ).join("\n");

  const subjectSummary = Object.entries(subjectFrequency).sort(([, a], [, b]) => b - a).map(([s, c]) => `${s}: ${c}`).join(", ");
  const topicContext = userTopics.map((t: any) => `${t.name} (${Math.round((t.memory_strength || 0) * 100)}%)`).join(", ") || "General";
  const topicScoreMap = rankedTopics.slice(0, 20).map(([t, s]: any) =>
    `"${t}": { score: ${s.finalScore}, trend: "${s.trendDirection}", momentum: ${s.trendMomentum} }`
  ).join(",\n");
  const dedupContext = prevQuestionTexts.length > 0 ? `\nPREVIOUSLY GENERATED (DO NOT repeat):\n${prevQuestionTexts.map((q, i) => `${i + 1}. ${q}`).join("\n")}` : "";

  const aiMessages = [
    {
      role: "system",
      content: `You are an expert Indian competitive exam analyst for ${examType} using an Ultra-Advanced ML Research Engine v3.0. Analyzed ${totalPYQs} PYQs from ${maxYears} years.

PREDICTION SCORES (8-Factor Model):
${topicScoreMap || "No data — use exam patterns."}

SUBJECT WEIGHTAGE: ${subjectSummary || "Equal"}

TREND RESEARCH:
${patternSummary}
${dedupContext}

RULES:
- probability_score MUST be 55-85. Never 100%.
- trend_reason must cite specific years, counts, momentum.
- trend_direction: "rising"|"stable"|"declining"|"comeback"
- trend_strength: "High"|"Medium"|"Emerging"
- ml_confidence: "Strong"(75+), "Moderate"(65-74), "Fair"(55-64)
- Include score_breakdown with all 8 factors.
- Generate real exam-level questions.
- Every question MUST be unique. User practiced ${prevPracticed.length} predicted questions already.
- Mix: factual(20%), conceptual(40%), application(30%), analytical(10%).
- Return VALID JSON only.`
    },
    {
      role: "user",
      content: `Generate exactly ${questionCount} UNIQUE predicted questions for ${examType}, subject: ${subject}.
User weak areas: ${topicContext}.
Prioritize high-score topics. Include 1-2 data/passage-based questions.

Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"...","topic":"...","subject":"...","difficulty":"easy|medium|hard","probability_score":55-85,"probability_level":"Very High|High|Medium","trend_direction":"rising|stable|declining|comeback","trend_strength":"High|Medium|Emerging","trend_momentum":0-100,"volatility_index":0-100,"pattern_stability":0-100,"difficulty_evolution":"stable|conceptual_shift|factual_shift","framing_change":"stable|statement_increase|case_study_growth","ml_confidence":"Strong|Moderate|Fair","trend_reason":"...","score_breakdown":{"trend_momentum":0-100,"time_series_forecast":0-100,"historical_frequency":0-100,"difficulty_alignment":0-100,"semantic_similarity":0-100,"examiner_behavior":0-100,"cross_exam_correlation":0-100,"syllabus_coverage":0-100},"similar_pyq_years":[2020,2021],"question_type":"factual|conceptual|application|analytical"}]}`
    }
  ];

  // AI call with fallback
  let aiData: any = null;
  let lastError = "";
  const models = ["google/gemini-3-flash-preview", "google/gemini-2.5-flash", "google/gemini-2.5-flash-lite"];

  for (const model of models) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 45000);
      const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({ model, messages: aiMessages, response_format: { type: "json_object" } }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      if (res.status === 429 || res.status === 402) { lastError = `${res.status}`; continue; }
      if (!res.ok) { await res.text(); continue; }
      aiData = await res.json();
      break;
    } catch (e: any) {
      lastError = e.message || "Error";
    }
  }

  // Gemini fallback
  if (!aiData) {
    const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
    if (GEMINI_KEY) {
      for (const gModel of ["gemini-2.0-flash", "gemini-2.0-flash-lite"]) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 55000);
          const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${GEMINI_KEY}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [{ role: "user", parts: [{ text: aiMessages[0].content + "\n\n" + aiMessages[1].content }] }],
              generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
            }),
            signal: controller.signal,
          });
          clearTimeout(timeout);
          if (!res.ok) continue;
          const gd = await res.json();
          const txt = gd?.candidates?.[0]?.content?.parts?.[0]?.text;
          if (txt) { aiData = { choices: [{ message: { content: JSON.stringify(safeJsonParse(txt)) } }] }; break; }
        } catch {}
      }
    }
  }

  if (!aiData) {
    return respond({ error: "AI service temporarily unavailable. Please try again.", questions: [], session_id: null });
  }

  // Parse questions
  let questions: any[] = [];
  try {
    const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
    if (toolCall?.function?.arguments) {
      questions = safeJsonParse(toolCall.function.arguments).questions || [];
    } else {
      const content = aiData.choices?.[0]?.message?.content;
      if (content) questions = safeJsonParse(typeof content === "string" ? content : JSON.stringify(content)).questions || [];
    }
  } catch {
    return respond({ error: "Failed to parse AI response. Please try again.", questions: [], session_id: null });
  }

  // Normalize
  questions = questions.map((q: any, idx: number) => ({
    ...q,
    id: `sq_${Date.now()}_${idx}`,
    probability_score: Math.max(55, Math.min(85, q.probability_score || 65)),
    trend_momentum: Math.max(0, Math.min(100, q.trend_momentum || 50)),
    volatility_index: Math.max(0, Math.min(100, q.volatility_index || 30)),
    pattern_stability: Math.max(0, Math.min(100, q.pattern_stability || 50)),
  }));

  const sessionId = `ss_${Date.now()}_${userId.substring(0, 8)}`;

  return respond({
    success: true,
    action: "generate",
    session_id: sessionId,
    total_questions: questions.length,
    exam_type: examType,
    questions,
    analysis: {
      total_pyqs_analyzed: totalPYQs,
      years_covered: allYears,
      top_trending_topics: rankedTopics.slice(0, 10).map(([t, s]: any) => ({
        topic: t,
        score: s.finalScore,
        trend: s.trendDirection,
        momentum: s.trendMomentum,
        volatility: s.volatilityIndex,
        stability: s.patternStability,
        cross_exam: s.score_breakdown.cross_exam_correlation,
        syllabus_coverage: s.score_breakdown.syllabus_coverage,
      })),
      formula: "TrendMomentum(20%) + TimeSeries(15%) + HistFreq(15%) + DiffAlign(12%) + Semantic(8%) + ExaminerBehavior(8%) + CrossExam(12%) + Syllabus(10%)",
      engine_version: "SureShot v3.0 UltraML",
    },
    ui_metadata: {
      title: "🔥 AI Predicted Questions",
      subtitle: `${questions.length} questions generated from ${totalPYQs}+ PYQ analysis`,
      powered_by: "SureShot Ultra AI Engine v3.0",
      badge: "🎯 ML-Predicted",
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: submit — Submit answer for a single question
// ═══════════════════════════════════════════════════════════
async function handleSubmit(userId: string, body: any) {
  const { question_id, selected_answer, correct_answer, time_taken_seconds, session_id } = body;

  const isCorrect = selected_answer === correct_answer;

  // Save to practice_progress
  await adminClient.from("practice_progress").insert({
    user_id: userId,
    question_id: question_id || `predicted_${Date.now()}`,
    question_source: "predicted",
    is_correct: isCorrect,
    selected_answer: String(selected_answer),
    time_taken_seconds: safeNum(time_taken_seconds, 0),
  });

  // Update memory if topic provided
  if (body.topic) {
    const { data: topicData } = await adminClient.from("topics").select("id").eq("name", body.topic).limit(1).maybeSingle();
    if (topicData?.id) {
      const { data: existing } = await adminClient.from("memory_scores").select("id, score, review_count").eq("user_id", userId).eq("topic_id", topicData.id).maybeSingle();
      if (existing) {
        const newScore = isCorrect ? Math.min(1, (existing.score || 0) + 0.05) : Math.max(0, (existing.score || 0) - 0.03);
        await adminClient.from("memory_scores").update({
          score: newScore,
          review_count: (existing.review_count || 0) + 1,
          last_reviewed_at: new Date().toISOString(),
        }).eq("id", existing.id);
      }
    }
  }

  return respond({
    success: true,
    action: "submit",
    result: {
      is_correct: isCorrect,
      selected_answer,
      correct_answer,
      time_taken_seconds: safeNum(time_taken_seconds, 0),
      feedback: isCorrect ? "✅ Correct! Great job!" : "❌ Incorrect. Review the explanation.",
      points_earned: isCorrect ? 10 : 0,
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: complete — Complete session with full results
// ═══════════════════════════════════════════════════════════
async function handleComplete(userId: string, body: any) {
  const { session_id, answers, total_questions, total_time_seconds } = body;
  const answersArr = answers || [];

  const correct = answersArr.filter((a: any) => a.is_correct).length;
  const incorrect = answersArr.filter((a: any) => !a.is_correct).length;
  const skipped = (total_questions || answersArr.length) - answersArr.length;
  const total = answersArr.length;
  const accuracy = total > 0 ? Math.round((correct / total) * 100) : 0;
  const avgTime = total > 0 ? Math.round(answersArr.reduce((s: number, a: any) => s + safeNum(a.time_taken_seconds, 0), 0) / total) : 0;

  // Topic-wise breakdown
  const topicResults: Record<string, { correct: number; total: number; topics_list: string[] }> = {};
  for (const a of answersArr) {
    const topic = a.topic || "General";
    if (!topicResults[topic]) topicResults[topic] = { correct: 0, total: 0, topics_list: [] };
    topicResults[topic].total++;
    if (a.is_correct) topicResults[topic].correct++;
  }

  const topicBreakdown = Object.entries(topicResults).map(([topic, data]) => ({
    topic,
    correct: data.correct,
    total: data.total,
    accuracy: Math.round((data.correct / data.total) * 100),
    status: data.correct === data.total ? "mastered" : data.correct / data.total >= 0.5 ? "improving" : "needs_work",
    icon: data.correct === data.total ? "🟢" : data.correct / data.total >= 0.5 ? "🟡" : "🔴",
  }));

  // Difficulty breakdown
  const diffResults: Record<string, { correct: number; total: number }> = {};
  for (const a of answersArr) {
    const diff = a.difficulty || "medium";
    if (!diffResults[diff]) diffResults[diff] = { correct: 0, total: 0 };
    diffResults[diff].total++;
    if (a.is_correct) diffResults[diff].correct++;
  }

  const diffBreakdown = Object.entries(diffResults).map(([difficulty, data]) => ({
    difficulty,
    correct: data.correct,
    total: data.total,
    accuracy: Math.round((data.correct / data.total) * 100),
  }));

  // Performance grade
  let grade = "D", gradeLabel = "Needs Improvement", gradeColor = "#ef4444";
  if (accuracy >= 90) { grade = "A+"; gradeLabel = "Exceptional!"; gradeColor = "#10b981"; }
  else if (accuracy >= 80) { grade = "A"; gradeLabel = "Excellent!"; gradeColor = "#22c55e"; }
  else if (accuracy >= 70) { grade = "B+"; gradeLabel = "Very Good"; gradeColor = "#84cc16"; }
  else if (accuracy >= 60) { grade = "B"; gradeLabel = "Good"; gradeColor = "#eab308"; }
  else if (accuracy >= 50) { grade = "C"; gradeLabel = "Average"; gradeColor = "#f97316"; }

  // Log study session
  await adminClient.from("study_sessions").insert({
    user_id: userId,
    session_type: "sureshot_predicted",
    started_at: new Date(Date.now() - (total_time_seconds || 0) * 1000).toISOString(),
    ended_at: new Date().toISOString(),
    duration_minutes: Math.round((total_time_seconds || 0) / 60),
    questions_attempted: total,
    questions_correct: correct,
    score: accuracy,
    metadata: { session_id, topic_breakdown: topicBreakdown, difficulty_breakdown: diffBreakdown },
  });

  // Weak topics for recommendations
  const weakTopics = topicBreakdown.filter(t => t.status === "needs_work").map(t => t.topic);
  const strongTopics = topicBreakdown.filter(t => t.status === "mastered").map(t => t.topic);

  // Next action suggestions
  const keepMomentum = [];
  if (weakTopics.length > 0) {
    keepMomentum.push({ action: "focus_study", label: `📚 Fix Weak: ${weakTopics[0]}`, description: `Your weakest area — practice more`, duration_estimate: "15 min", params: { topic: weakTopics[0] } });
  }
  keepMomentum.push({ action: "ai_predicted", label: "🔥 More Predicted Questions", description: "Continue with AI-predicted practice", duration_estimate: "20 min", params: {} });
  keepMomentum.push({ action: "revision", label: "🔄 Quick Revision", description: "Revise topics from this session", duration_estimate: "10 min", params: {} });

  // Historical comparison
  const { data: prevSessions } = await adminClient
    .from("study_sessions")
    .select("score, questions_attempted, questions_correct")
    .eq("user_id", userId)
    .eq("session_type", "sureshot_predicted")
    .order("created_at", { ascending: false })
    .limit(10);

  const prevAccuracies = (prevSessions || []).map((s: any) => s.score || 0);
  const avgHistorical = prevAccuracies.length > 1 ? Math.round(prevAccuracies.slice(1).reduce((a: number, b: number) => a + b, 0) / (prevAccuracies.length - 1)) : 0;
  const improvement = avgHistorical > 0 ? accuracy - avgHistorical : 0;

  return respond({
    success: true,
    action: "complete",
    session_id,
    result: {
      // Score overview
      score: {
        correct,
        incorrect,
        skipped,
        total: total_questions || total,
        accuracy,
        grade,
        grade_label: gradeLabel,
        grade_color: gradeColor,
      },

      // Time analysis
      time: {
        total_seconds: total_time_seconds || 0,
        total_formatted: `${Math.floor((total_time_seconds || 0) / 60)}m ${(total_time_seconds || 0) % 60}s`,
        avg_per_question_seconds: avgTime,
        avg_formatted: `${avgTime}s`,
      },

      // Topic breakdown
      topic_breakdown: topicBreakdown,

      // Difficulty breakdown
      difficulty_breakdown: diffBreakdown,

      // Weak & strong
      weak_topics: weakTopics,
      strong_topics: strongTopics,

      // Historical comparison
      comparison: {
        previous_avg_accuracy: avgHistorical,
        improvement_points: improvement,
        trend: improvement > 0 ? "improving" : improvement < 0 ? "declining" : "stable",
        trend_icon: improvement > 0 ? "📈" : improvement < 0 ? "📉" : "➡️",
        sessions_completed: (prevSessions || []).length,
      },

      // Next actions
      keep_momentum: keepMomentum,

      // UI metadata
      ui: {
        title: accuracy >= 70 ? "🎉 Great Performance!" : accuracy >= 50 ? "💪 Good Effort!" : "📚 Keep Practicing!",
        subtitle: `You scored ${accuracy}% in SureShot Predicted Questions`,
        share_text: `I scored ${accuracy}% on AI Predicted Questions for ${body.exam_type || "my exam"}! 🔥`,
        badge_earned: accuracy >= 80 ? { icon: "🏆", label: "SureShot Champion" } : accuracy >= 60 ? { icon: "⭐", label: "Rising Star" } : null,
      },
    },
  });
}

// ═══════════════════════════════════════════════════════════
// ACTION: history — Past session history
// ═══════════════════════════════════════════════════════════
async function handleHistory(userId: string, body: any) {
  const limit = body.limit || 20;
  const { data: sessions } = await adminClient
    .from("study_sessions")
    .select("*")
    .eq("user_id", userId)
    .eq("session_type", "sureshot_predicted")
    .order("created_at", { ascending: false })
    .limit(limit);

  const history = (sessions || []).map((s: any) => ({
    id: s.id,
    date: s.started_at,
    questions_attempted: s.questions_attempted || 0,
    questions_correct: s.questions_correct || 0,
    accuracy: s.score || 0,
    duration_minutes: s.duration_minutes || 0,
    topic_breakdown: (s.metadata as any)?.topic_breakdown || [],
  }));

  // Overall stats
  const totalSessions = history.length;
  const totalQuestions = history.reduce((s: number, h: any) => s + h.questions_attempted, 0);
  const totalCorrect = history.reduce((s: number, h: any) => s + h.questions_correct, 0);
  const overallAccuracy = totalQuestions > 0 ? Math.round((totalCorrect / totalQuestions) * 100) : 0;

  return respond({
    success: true,
    action: "history",
    sessions: history,
    overall_stats: {
      total_sessions: totalSessions,
      total_questions_attempted: totalQuestions,
      total_correct: totalCorrect,
      overall_accuracy: overallAccuracy,
      total_study_minutes: history.reduce((s: number, h: any) => s + h.duration_minutes, 0),
    },
  });
}

// ═══════════════════════════════════════════════════════════
// MAIN HANDLER
// ═══════════════════════════════════════════════════════════
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const userId = await resolveUserId(req);
    if (!userId) return respond({ error: "Unauthorized" }, 401);

    let body: any = {};
    if (req.method === "POST") {
      try { body = await req.json(); } catch { body = {}; }
    }

    const action = body.action || "init";

    switch (action) {
      case "init": return await handleInit(userId, body);
      case "generate": return await handleGenerate(userId, body);
      case "submit": return await handleSubmit(userId, body);
      case "complete": return await handleComplete(userId, body);
      case "history": return await handleHistory(userId, body);
      default: return respond({ error: `Unknown action: ${action}` }, 400);
    }
  } catch (err) {
    console.error("sureshot-questions error:", err);
    return respond({ error: "Internal server error", details: String(err) }, 500);
  }
});
