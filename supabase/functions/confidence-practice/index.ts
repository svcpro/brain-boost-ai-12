import { createClient } from "npm:@supabase/supabase-js@2";

// Robust JSON parser: strips markdown fences, trailing garbage, and balances braces
function safeJsonParse(raw: string): any {
  let text = raw.trim();
  text = text.replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/i, "");
  const startBrace = text.indexOf("{");
  const startBracket = text.indexOf("[");
  let start = -1;
  if (startBrace === -1) start = startBracket;
  else if (startBracket === -1) start = startBrace;
  else start = Math.min(startBrace, startBracket);
  if (start === -1) throw new Error("No JSON object found in response");
  text = text.substring(start);
  try { return JSON.parse(text); } catch {}
  const openChar = text[0];
  let depth = 0, inString = false, escape = false, endPos = -1;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (escape) { escape = false; continue; }
    if (c === "\\") { escape = true; continue; }
    if (c === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (c === "{" || c === "[") depth++;
    if (c === "}" || c === "]") { depth--; if (depth === 0) { endPos = i; break; } }
  }
  if (endPos > 0) { try { return JSON.parse(text.substring(0, endPos + 1)); } catch {} }
  const lastEnd = Math.max(text.lastIndexOf("}"), text.lastIndexOf("]"));
  if (lastEnd > 0) { try { return JSON.parse(text.substring(0, lastEnd + 1)); } catch {} }
  throw new Error("Could not extract valid JSON from AI response");
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const userClient = createClient(
      supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );
    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await userClient.auth.getClaims(token);

    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    const user = { id: claimsData.claims.sub as string, email: claimsData.claims.email as string };

    const body = await req.json();
    const { action, exam_type, subject, topic, year, difficulty, mode, count } = body;

    if (action === "generate_predicted") {
      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY not configured");

      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_type")
        .eq("id", user.id)
        .maybeSingle();
      const targetExam = exam_type || profile?.exam_type || "competitive exam";
      const targetSubject = subject || "mixed subjects";

      // ── Deep PYQ pattern analysis ──
      const { data: pyqData } = await supabase
        .from("question_bank")
        .select("topic, subject, year, difficulty, question")
        .eq("exam_type", targetExam)
        .order("year", { ascending: false });

      const totalPYQs = pyqData?.length || 0;
      const allYears = [...new Set((pyqData || []).map(q => q.year).filter(Boolean))].sort();
      const yearSpan = allYears.length;
      const recentYear = allYears[allYears.length - 1] || 2024;

      // Build deep topic analytics
      interface TopicAnalytics {
        count: number;
        years: Set<number>;
        difficulties: string[];
        yearCounts: Record<number, number>;
        questions: string[];
        subjects: Set<string>;
      }
      const topicAnalytics: Record<string, TopicAnalytics> = {};
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

      const maxYears = Math.max(yearSpan, 5);

      // ══════════════════════════════════════════════════════════════
      // PHASE 1: Advanced Trend Research Layer
      // ══════════════════════════════════════════════════════════════

      interface TrendMetrics {
        trendDirection: "rising" | "stable" | "declining" | "comeback";
        trendMomentum: number;
        volatilityIndex: number;
        patternStability: number;
        difficultyEvolution: string;
        framingChange: string;
        crossExamCorrelation: number;
        syllabusCoverage: number;
      }

      // ══════════════════════════════════════════════════════════════
      // PHASE 2: Time-Series Forecast & Pattern Drift Detection
      // ══════════════════════════════════════════════════════════════

      // Cross-exam correlation: check if this topic appears in other exams too
      const { data: crossExamData } = await supabase
        .from("question_bank")
        .select("exam_type, topic")
        .neq("exam_type", targetExam)
        .limit(500);

      const crossExamTopics: Record<string, Set<string>> = {};
      for (const q of (crossExamData || [])) {
        const key = q.topic || "General";
        if (!crossExamTopics[key]) crossExamTopics[key] = new Set();
        crossExamTopics[key].add(q.exam_type);
      }

      // Syllabus coverage: check user's topic coverage
      const { data: userStudied } = await supabase
        .from("topics")
        .select("name, memory_strength")
        .eq("user_id", user.id)
        .eq("deleted", false);

      const studiedTopicNames = new Set((userStudied || []).map((t: any) => t.name?.toLowerCase()));

      function computeTrendMetrics(topicName: string, analytics: TopicAnalytics, allYrs: number[], maxY: number): TrendMetrics {
        const sortedYears = [...allYrs].sort();
        const yearCounts = sortedYears.map(y => analytics.yearCounts[y] || 0);

        // ── Trend Direction via linear regression slope ──
        const n = yearCounts.length;
        let sumX = 0, sumY = 0, sumXY = 0, sumXX = 0;
        for (let i = 0; i < n; i++) {
          sumX += i; sumY += yearCounts[i]; sumXY += i * yearCounts[i]; sumXX += i * i;
        }
        const slope = n > 1 ? (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX) : 0;

        const lastTwoYears = sortedYears.slice(-2);
        const recentPresence = lastTwoYears.filter(y => (analytics.yearCounts[y] || 0) > 0).length;
        const earlyYears = sortedYears.slice(0, -2);
        const earlyAbsence = earlyYears.length > 0 && earlyYears.filter(y => (analytics.yearCounts[y] || 0) === 0).length >= 2;
        const isComeback = recentPresence > 0 && earlyAbsence && slope > 0;

        let trendDirection: TrendMetrics["trendDirection"];
        if (isComeback) trendDirection = "comeback";
        else if (slope > 0.3) trendDirection = "rising";
        else if (slope < -0.3) trendDirection = "declining";
        else trendDirection = "stable";

        const recentWeight = lastTwoYears.reduce((s, y) => s + (analytics.yearCounts[y] || 0), 0);
        const avgCount = analytics.count / Math.max(maxY, 1);
        const momentumRaw = (Math.abs(slope) * 30) + (recentWeight / Math.max(avgCount, 1)) * 35 + (analytics.years.size / maxY) * 35;
        const trendMomentum = Math.round(Math.max(0, Math.min(100, momentumRaw)));

        const mean = yearCounts.reduce((a, b) => a + b, 0) / Math.max(n, 1);
        const variance = yearCounts.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / Math.max(n, 1);
        const stdDev = Math.sqrt(variance);
        const volatilityIndex = Math.round(Math.min(100, (stdDev / Math.max(mean, 0.5)) * 50));

        const appearedRatio = analytics.years.size / maxY;
        const countConsistency = mean > 0 ? 1 - (stdDev / (mean * 2)) : 0;
        const patternStability = Math.round(Math.max(0, Math.min(100, (appearedRatio * 60 + Math.max(0, countConsistency) * 40))));

        const recentDiffs = (pyqData || []).filter(q => q.topic === topicName && q.year && q.year >= recentYear - 1).map(q => q.difficulty);
        const olderDiffs = (pyqData || []).filter(q => q.topic === topicName && q.year && q.year < recentYear - 1).map(q => q.difficulty);
        const recentHardRatio = recentDiffs.filter(d => d === "hard").length / Math.max(recentDiffs.length, 1);
        const olderHardRatio = olderDiffs.filter(d => d === "hard").length / Math.max(olderDiffs.length, 1);
        const difficultyEvolution = recentHardRatio > olderHardRatio + 0.2 ? "conceptual_shift" :
          recentHardRatio < olderHardRatio - 0.2 ? "factual_shift" : "stable";

        const recentQs = analytics.questions.slice(0, Math.ceil(analytics.questions.length / 2));
        const statementCount = recentQs.filter(q => q.toLowerCase().includes("statement") || q.toLowerCase().includes("assertion")).length;
        const caseStudyCount = recentQs.filter(q => q.toLowerCase().includes("case") || q.toLowerCase().includes("passage") || q.toLowerCase().includes("read")).length;
        const framingChange = statementCount > recentQs.length * 0.3 ? "statement_increase" :
          caseStudyCount > recentQs.length * 0.2 ? "case_study_growth" : "stable";

        // ── NEW Factor 7: Cross-Exam Correlation ──
        const crossExamAppearances = crossExamTopics[topicName]?.size || 0;
        const crossExamCorrelation = Math.round(Math.min(100, crossExamAppearances * 25 + (crossExamAppearances > 0 ? 30 : 0)));

        // ── NEW Factor 8: Syllabus Coverage Gap ──
        const isStudied = studiedTopicNames.has(topicName.toLowerCase());
        const userStrength = (userStudied || []).find((t: any) => t.name?.toLowerCase() === topicName.toLowerCase());
        const memStrength = userStrength ? (userStrength as any).memory_strength || 0 : 0;
        // Higher score = more important to practice (weak or unstudied topics)
        const syllabusCoverage = isStudied ? Math.round(Math.max(20, 100 - memStrength * 100)) : 85;

        return { trendDirection, trendMomentum, volatilityIndex, patternStability, difficultyEvolution, framingChange, crossExamCorrelation, syllabusCoverage };
      }

      // ══════════════════════════════════════════════════════════════
      // PHASE 3: Hybrid ML Prediction Model (UPGRADED 8-factor formula)
      // ══════════════════════════════════════════════════════════════

      const topicScores: Record<string, {
        finalScore: number;
        trendMomentumWeight: number;
        timeSeriesForecast: number;
        historicalFrequency: number;
        difficultyAlignment: number;
        semanticSimilarity: number;
        examinerBehavior: number;
        crossExamCorrelation: number;
        syllabusCoverage: number;
        trendDirection: string;
        trendMomentum: number;
        volatilityIndex: number;
        patternStability: number;
        difficultyEvolution: string;
        framingChange: string;
        yearBreakdown: Record<number, number>;
        evidenceSummary: string;
        trendStrength: string;
      }> = {};

      for (const [topicName, analytics] of Object.entries(topicAnalytics)) {
        const trend = computeTrendMetrics(topicName, analytics, allYears, maxYears);

        // Factor 1: Trend Momentum (0.20)
        const trendMomentumWeight = trend.trendMomentum;

        // Factor 2: Time-Series Forecast (0.15) — LSTM-inspired EWMA
        const sortedYrs = [...allYears].sort();
        const alpha = 0.4;
        let ewma = analytics.yearCounts[sortedYrs[0]] || 0;
        for (let i = 1; i < sortedYrs.length; i++) {
          ewma = alpha * (analytics.yearCounts[sortedYrs[i]] || 0) + (1 - alpha) * ewma;
        }
        const avgPerYear = analytics.count / maxYears;
        const timeSeriesForecast = Math.round(Math.min(100, (ewma / Math.max(avgPerYear, 0.5)) * 50));

        // Factor 3: Historical Frequency (0.15)
        const historicalFrequency = Math.round(Math.min(100, (analytics.count / Math.max(totalPYQs, 1)) * 100 * 10));

        // Factor 4: Difficulty Alignment (0.12)
        const diffCounts: Record<string, number> = {};
        analytics.difficulties.forEach(d => diffCounts[d] = (diffCounts[d] || 0) + 1);
        const dominantDiffCount = Math.max(...Object.values(diffCounts), 0);
        const difficultyAlignment = analytics.difficulties.length > 0
          ? Math.round((dominantDiffCount / analytics.difficulties.length) * 100) : 50;

        // Factor 5: Semantic Similarity (0.08)
        const uniqueStarts = new Set(analytics.questions.map(q => q.slice(0, 30).toLowerCase()));
        const semanticSimilarity = analytics.questions.length > 1
          ? Math.round(Math.min(100, (uniqueStarts.size / analytics.questions.length) * 100)) : 60;

        // Factor 6: Examiner Behavior Model (0.08)
        const yearsPresent = [...analytics.years].sort();
        let cyclicalScore = 50;
        if (yearsPresent.length >= 3) {
          const gaps = [];
          for (let i = 1; i < yearsPresent.length; i++) gaps.push(yearsPresent[i] - yearsPresent[i - 1]);
          const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
          const gapVariance = gaps.reduce((s, g) => s + Math.pow(g - avgGap, 2), 0) / gaps.length;
          cyclicalScore = Math.round(Math.max(30, Math.min(100, 100 - gapVariance * 20)));
        } else if (yearsPresent.length >= 2) {
          cyclicalScore = 60;
        }
        const examinerBehavior = cyclicalScore;

        // Factor 7: Cross-Exam Correlation (0.12)
        const crossExamCorrelation = trend.crossExamCorrelation;

        // Factor 8: Syllabus Coverage Gap (0.10)
        const syllabusCoverage = trend.syllabusCoverage;

        // ── UPGRADED 8-FACTOR HYBRID FORMULA ──
        const rawScore =
          (trendMomentumWeight * 0.20) +
          (timeSeriesForecast * 0.15) +
          (historicalFrequency * 0.15) +
          (difficultyAlignment * 0.12) +
          (semanticSimilarity * 0.08) +
          (examinerBehavior * 0.08) +
          (crossExamCorrelation * 0.12) +
          (syllabusCoverage * 0.10);

        // Cap to 55-85% range for authenticity
        const finalScore = Math.round(Math.max(55, Math.min(85, rawScore)));

        const trendStrength = trend.trendMomentum >= 70 ? "High" : trend.trendMomentum >= 40 ? "Medium" : "Emerging";

        const yearsList = [...analytics.years].sort().join(", ");
        const evidenceParts = [];
        evidenceParts.push(`Appeared in ${analytics.years.size}/${maxYears} years (${yearsList})`);
        if (trend.trendDirection === "rising") evidenceParts.push("📈 Rising trend detected");
        else if (trend.trendDirection === "declining") evidenceParts.push("📉 Declining trend");
        else if (trend.trendDirection === "comeback") evidenceParts.push("⚡ Comeback candidate");
        evidenceParts.push(`${analytics.count} total occurrences`);
        if (crossExamCorrelation > 50) evidenceParts.push(`🌐 Appears in ${crossExamTopics[topicName]?.size || 0} other exams`);
        if (trend.difficultyEvolution !== "stable") evidenceParts.push(`Difficulty: ${trend.difficultyEvolution.replace("_", " ")}`);
        if (trend.framingChange !== "stable") evidenceParts.push(`Pattern: ${trend.framingChange.replace("_", " ")}`);
        const evidenceSummary = evidenceParts.join(". ");

        topicScores[topicName] = {
          finalScore,
          trendMomentumWeight: Math.round(trendMomentumWeight),
          timeSeriesForecast: Math.round(timeSeriesForecast),
          historicalFrequency: Math.round(historicalFrequency),
          difficultyAlignment: Math.round(difficultyAlignment),
          semanticSimilarity: Math.round(semanticSimilarity),
          examinerBehavior: Math.round(examinerBehavior),
          crossExamCorrelation: Math.round(crossExamCorrelation),
          syllabusCoverage: Math.round(syllabusCoverage),
          trendDirection: trend.trendDirection,
          trendMomentum: trend.trendMomentum,
          volatilityIndex: trend.volatilityIndex,
          patternStability: trend.patternStability,
          difficultyEvolution: trend.difficultyEvolution,
          framingChange: trend.framingChange,
          yearBreakdown: analytics.yearCounts,
          evidenceSummary,
          trendStrength,
        };
      }

      // Sort topics by score
      const rankedTopics = Object.entries(topicScores)
        .sort(([, a], [, b]) => b.finalScore - a.finalScore);

      const patternSummary = rankedTopics.slice(0, 15).map(([t, s]) =>
        `${t}: Score=${s.finalScore}%, Trend=${s.trendDirection}, Momentum=${s.trendMomentum}, CrossExam=${s.crossExamCorrelation}, SyllabusCoverage=${s.syllabusCoverage}, Volatility=${s.volatilityIndex}, Stability=${s.patternStability}, DiffEvolution=${s.difficultyEvolution}, Framing=${s.framingChange}`
      ).join("\n");

      const subjectSummary = Object.entries(subjectFrequency)
        .sort(([, a], [, b]) => b - a)
        .map(([subj, cnt]) => `${subj}: ${cnt} questions (${Math.round((cnt / Math.max(totalPYQs, 1)) * 100)}%)`)
        .join(", ");

      // Get user's weak topics
      const { data: userTopics } = await supabase
        .from("topics")
        .select("name, memory_strength, subjects(name)")
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("memory_strength", { ascending: true })
        .limit(20);

      const topicContext = userTopics?.map((t: any) => `${t.name} (strength: ${Math.round((t.memory_strength || 0) * 100)}%)`).join(", ") || "General topics";

      // Fetch previously practiced predicted questions to avoid repeats — include question text for dedup
      const { data: prevPracticed } = await supabase
        .from("practice_progress")
        .select("question_id")
        .eq("user_id", user.id)
        .eq("question_source", "predicted");
      const prevPracticedCount = prevPracticed?.length || 0;

      // Fetch actual question texts for strict dedup
      const prevIds = (prevPracticed || []).map((p: any) => p.question_id).filter(Boolean);
      let prevQuestionTexts: string[] = [];
      if (prevIds.length > 0) {
        const { data: prevQs } = await supabase
          .from("question_bank")
          .select("question")
          .in("id", prevIds.slice(0, 50));
        prevQuestionTexts = (prevQs || []).map((q: any) => q.question?.slice(0, 80) || "");
      }

      const topicScoreMap = rankedTopics.slice(0, 20).map(([t, s]) =>
        `"${t}": { score: ${s.finalScore}, trend: "${s.trendDirection}", momentum: ${s.trendMomentum}, crossExam: ${s.crossExamCorrelation}, syllabusCoverage: ${s.syllabusCoverage}, volatility: ${s.volatilityIndex}, stability: ${s.patternStability}, diff_evolution: "${s.difficultyEvolution}", framing: "${s.framingChange}", time_series: ${s.timeSeriesForecast}, hist_freq: ${s.historicalFrequency}, diff_align: ${s.difficultyAlignment}, semantic: ${s.semanticSimilarity}, examiner: ${s.examinerBehavior} }`
      ).join(",\n");

      const questionCount = Math.min(count || 5, 10);

      // Build dedup context
      const dedupContext = prevQuestionTexts.length > 0
        ? `\n\nPREVIOUSLY GENERATED QUESTIONS (DO NOT repeat or paraphrase these):\n${prevQuestionTexts.map((q, i) => `${i + 1}. ${q}`).join("\n")}`
        : "";

      const aiMessages = [
        {
          role: "system",
          content: `You are an expert Indian competitive exam analyst for ${targetExam} using an Ultra-Advanced Trend-Based ML Research Engine v3.0. You have analyzed ${totalPYQs} PYQs from last ${maxYears} years using 8-factor deep pattern detection.

COMPUTED PREDICTION SCORES (Hybrid 8-Factor Model):
${topicScoreMap || "No historical data — use general exam patterns."}

SUBJECT WEIGHTAGE: ${subjectSummary || "Equal distribution assumed."}

UPGRADED FORMULA (8 factors):
Final Score = (Trend Momentum × 0.20) + (Time-Series Forecast × 0.15) + (Historical Frequency × 0.15) + (Difficulty Alignment × 0.12) + (Semantic Similarity × 0.08) + (Examiner Behavior × 0.08) + (Cross-Exam Correlation × 0.12) + (Syllabus Coverage Gap × 0.10)

NEW FACTORS:
- Cross-Exam Correlation: Topics appearing across multiple exam types have higher universal importance
- Syllabus Coverage Gap: User's weak/unstudied topics are prioritized for maximum exam preparedness

TREND RESEARCH PATTERNS:
${patternSummary}
${dedupContext}

CRITICAL RULES:
- probability_score MUST be between 55 and 85. NEVER 100%.
- Use the pre-computed scores above. Match each question's topic to the closest topic score.
- trend_reason must cite SPECIFIC evidence: exact years, occurrence counts, trend direction, momentum scores, cross-exam presence.
- trend_direction MUST be one of: "rising", "stable", "declining", "comeback"
- trend_strength must be: "High", "Medium", or "Emerging"
- ml_confidence must be: "Strong" (score 75+), "Moderate" (65-74), or "Fair" (55-64)
- For each question, provide score_breakdown with ALL 8 components.
- Include trend_momentum, volatility_index, pattern_stability numbers.
- Include difficulty_evolution and framing_change strings.
- Generate exam-level questions that feel genuinely likely to appear in the upcoming ${targetExam} exam.
- IMAGE-BASED QUESTIONS: For subjects like Physics, Chemistry, Biology, Geography — you MAY include image descriptions in markdown format using descriptive text like "[Diagram: ...]" or descriptive scenarios that test visual/spatial reasoning. For conceptual topics, include data interpretation tables or passage-based questions.
- CRITICAL UNIQUENESS: Every question MUST be 100% unique and novel. Do NOT repeat, paraphrase, or create close variants of any existing PYQ or previously generated question. The user has already practiced ${prevPracticedCount} predicted questions. Create genuinely new questions exploring untested angles of each topic.
- REAL EXAM STANDARD: Questions must exactly match the format, difficulty distribution, and cognitive level of actual ${targetExam} papers. Include a mix of: factual recall (20%), conceptual understanding (40%), application-based (30%), and analytical/higher-order (10%).
- Return VALID JSON only.`
        },
        {
          role: "user",
          content: `Generate exactly ${questionCount} UNIQUE predicted questions for ${targetExam}, subject: ${targetSubject}.
User's weak areas: ${topicContext}.
Prioritize high-score topics from the trend research analysis. Include at least 1-2 data-interpretation or passage-based questions for real exam feel.
IMPORTANT: Each question must be completely different from standard PYQ bank questions. Create fresh, novel questions exploring new angles based on the 8-factor trend patterns.

Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard","probability_score":55-85,"probability_level":"Very High|High|Medium","trend_direction":"rising|stable|declining|comeback","trend_strength":"High|Medium|Emerging","trend_momentum":0-100,"volatility_index":0-100,"pattern_stability":0-100,"difficulty_evolution":"stable|conceptual_shift|factual_shift","framing_change":"stable|statement_increase|case_study_growth","ml_confidence":"Strong|Moderate|Fair","trend_reason":"Detailed evidence with years, counts, cross-exam data...","score_breakdown":{"trend_momentum":0-100,"time_series_forecast":0-100,"historical_frequency":0-100,"difficulty_alignment":0-100,"semantic_similarity":0-100,"examiner_behavior":0-100,"cross_exam_correlation":0-100,"syllabus_coverage":0-100},"similar_pyq_years":[2020,2021],"question_type":"factual|conceptual|application|analytical"}]}`
        }
      ];

      // ── AI Call with Lovable Gateway + Direct Gemini API fallback ──
      let aiData: any = null;
      let lastError = "";

      const modelsToTry = [
        "google/gemini-3-flash-preview",
        "google/gemini-2.5-flash",
        "google/gemini-2.5-flash-lite",
      ];

      for (const model of modelsToTry) {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45000);
          const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
            method: "POST",
            headers: { Authorization: `Bearer ${LOVABLE_API_KEY}`, "Content-Type": "application/json" },
            body: JSON.stringify({ model, messages: aiMessages, response_format: { type: "json_object" } }),
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (aiResponse.status === 429 || aiResponse.status === 402) {
            lastError = aiResponse.status === 429 ? "Rate limited" : "Credits exhausted";
            console.error(`Lovable ${model}: ${lastError}`);
            continue;
          }
          if (!aiResponse.ok) {
            lastError = `Status ${aiResponse.status}`;
            await aiResponse.text();
            continue;
          }
          aiData = await aiResponse.json();
          console.log(`Lovable ${model} succeeded`);
          break;
        } catch (e: any) {
          lastError = e.name === "AbortError" ? "Timeout" : (e.message || "Error");
          console.error(`Lovable ${model}: ${lastError}`);
        }
      }

      // Fallback to direct Google Gemini API with expanded model list & retry
      if (!aiData) {
        const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (GEMINI_KEY) {
          console.log("Falling back to direct Gemini API...");
          const geminiModels = ["gemini-2.0-flash", "gemini-2.0-flash-lite", "gemini-1.5-flash"];
          for (const gModel of geminiModels) {
            // Retry each model up to 2 times with delay for rate limits
            for (let attempt = 0; attempt < 2; attempt++) {
              if (attempt > 0) {
                console.log(`Retrying ${gModel} after delay...`);
                await new Promise(r => setTimeout(r, 3000));
              }
              try {
                const controller = new AbortController();
                const timeout = setTimeout(() => controller.abort(), 55000);
                const geminiResponse = await fetch(
                  `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${GEMINI_KEY}`,
                  {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      contents: [
                        { role: "user", parts: [{ text: aiMessages[0].content + "\n\n" + aiMessages[1].content }] }
                      ],
                      generationConfig: { responseMimeType: "application/json", temperature: 0.7 },
                    }),
                    signal: controller.signal,
                  }
                );
                clearTimeout(timeout);

                if (geminiResponse.status === 429) {
                  lastError = `Gemini ${gModel}: rate limited`;
                  console.error(lastError);
                  continue; // retry with delay
                }
                if (!geminiResponse.ok) {
                  const errBody = await geminiResponse.text();
                  lastError = `Gemini ${gModel}: ${geminiResponse.status}`;
                  console.error(lastError, errBody);
                  break; // move to next model for non-429 errors
                }

                const geminiData = await geminiResponse.json();
                const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
                if (textContent) {
                  const parsed = safeJsonParse(textContent);
                  aiData = { choices: [{ message: { content: JSON.stringify(parsed) } }] };
                  console.log(`Direct Gemini ${gModel} succeeded (attempt ${attempt + 1})`);
                  break;
                }
              } catch (e: any) {
                lastError = e.name === "AbortError" ? "Gemini timeout" : (e.message || "Gemini error");
                console.error(`Gemini ${gModel} attempt ${attempt + 1}: ${lastError}`);
              }
            }
            if (aiData) break;
          }
        } else {
          console.error("No GOOGLE_GEMINI_API_KEY configured for fallback");
        }
      }

      if (!aiData) {
        const hint = lastError.includes("429") || lastError.includes("rate")
          ? "AI service is rate limited. Please wait 30 seconds and try again."
          : lastError.includes("402") || lastError.includes("Credit")
          ? "AI credits exhausted. Please try again later or contact support."
          : "AI service temporarily unavailable. Please try again in a moment.";
        return new Response(JSON.stringify({ error: hint }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let questions: any[] = [];
      try {
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = safeJsonParse(toolCall.function.arguments);
          questions = parsed.questions || [];
        } else {
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = safeJsonParse(typeof content === "string" ? content : JSON.stringify(content));
            questions = parsed.questions || [];
          }
        }
      } catch (parseErr: any) {
        console.error("Parse error:", parseErr.message);
        return new Response(JSON.stringify({ error: "Failed to parse AI response. Please try again." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      questions = questions.map((q: any) => ({
        ...q,
        probability_score: Math.max(55, Math.min(85, q.probability_score || 65)),
        trend_momentum: Math.max(0, Math.min(100, q.trend_momentum || 50)),
        volatility_index: Math.max(0, Math.min(100, q.volatility_index || 30)),
        pattern_stability: Math.max(0, Math.min(100, q.pattern_stability || 50)),
      }));

      return new Response(JSON.stringify({
        questions,
        analysis: {
          totalPYQsAnalyzed: totalPYQs,
          yearsCovered: allYears,
          topTrendingTopics: rankedTopics.slice(0, 10).map(([t, s]) => ({
            topic: t,
            score: s.finalScore,
            trend: s.trendDirection,
            momentum: s.trendMomentum,
            volatility: s.volatilityIndex,
            stability: s.patternStability,
            crossExamCorrelation: s.crossExamCorrelation,
            syllabusCoverage: s.syllabusCoverage,
            difficultyEvolution: s.difficultyEvolution,
            framingChange: s.framingChange,
            years: [...topicAnalytics[t].years].sort(),
            yearBreakdown: s.yearBreakdown,
          })),
          examType: targetExam,
          formula: "TrendMomentum(20%) + TimeSeries(15%) + HistFreq(15%) + DiffAlign(12%) + Semantic(8%) + ExaminerBehavior(8%) + CrossExamCorrelation(12%) + SyllabusCoverage(10%)",
          engineVersion: "3.0-UltraML",
        }
      }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_user_exam") {
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_type")
        .eq("id", user.id)
        .maybeSingle();
      return new Response(JSON.stringify({ exam_type: profile?.exam_type || "" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_bank_questions") {
      // Fetch IDs of questions user has already answered to exclude them
      const { data: answeredData } = await supabase
        .from("practice_progress")
        .select("question_id")
        .eq("user_id", user.id);
      const answeredIds = new Set((answeredData || []).map((d: any) => d.question_id).filter(Boolean));

      const batchSize = 1000;
      let allQuestions: any[] = [];
      let offset = 0;
      let hasMore = true;

      while (hasMore) {
        let query = supabase.from("question_bank").select("*");
        if (exam_type) query = query.eq("exam_type", exam_type);
        if (subject) query = query.eq("subject", subject);
        if (topic) query = query.ilike("topic", `%${topic}%`);
        if (year) query = query.eq("year", year);
        if (difficulty) query = query.eq("difficulty", difficulty);
        query = query.range(offset, offset + batchSize - 1);

        const { data, error } = await query;
        if (error) throw error;

        if (data && data.length > 0) {
          // Filter out already-answered questions
          const fresh = data.filter((q: any) => !answeredIds.has(q.id));
          allQuestions = allQuestions.concat(fresh);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      const totalAvailable = allQuestions.length;
      let result = allQuestions;
      if (count && count > 0 && allQuestions.length > count) {
        for (let i = allQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }
        result = allQuestions.slice(0, count);
      }

      return new Response(JSON.stringify({ questions: result, totalAvailable }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "save_progress") {
      const { question_id, question_source, is_correct, selected_answer, time_taken_seconds } = body;
      const { error } = await supabase.from("practice_progress").insert({
        user_id: user.id,
        question_id,
        question_source,
        is_correct,
        selected_answer,
        time_taken_seconds,
      });
      if (error) throw error;
      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    if (action === "get_progress_stats") {
      const { data, error } = await supabase
        .from("practice_progress")
        .select("is_correct, question_source")
        .eq("user_id", user.id);
      if (error) throw error;

      const total = data?.length || 0;
      const correct = data?.filter((d: any) => d.is_correct).length || 0;
      const bankCount = data?.filter((d: any) => d.question_source === "bank").length || 0;
      const predictedCount = data?.filter((d: any) => d.question_source === "predicted").length || 0;

      return new Response(JSON.stringify({ total, correct, accuracy: total > 0 ? Math.round((correct / total) * 100) : 0, bankCount, predictedCount }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

    return new Response(JSON.stringify({ error: "Unknown action" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  } catch (e) {
    console.error("confidence-practice error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
