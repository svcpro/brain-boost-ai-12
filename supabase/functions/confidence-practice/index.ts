import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceKey);
    const authHeader = req.headers.get("Authorization");
    
    // Get user
    const { data: { user }, error: authError } = await createClient(
      supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    ).auth.getUser();
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" }
      });
    }

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
      }
      const topicAnalytics: Record<string, TopicAnalytics> = {};
      const subjectFrequency: Record<string, number> = {};

      for (const q of (pyqData || [])) {
        const key = q.topic || q.subject || "General";
        if (!topicAnalytics[key]) {
          topicAnalytics[key] = { count: 0, years: new Set(), difficulties: [], yearCounts: {}, questions: [] };
        }
        const ta = topicAnalytics[key];
        ta.count++;
        if (q.year) { ta.years.add(q.year); ta.yearCounts[q.year] = (ta.yearCounts[q.year] || 0) + 1; }
        if (q.difficulty) ta.difficulties.push(q.difficulty);
        if (q.question) ta.questions.push(q.question.slice(0, 100));
        if (q.subject) subjectFrequency[q.subject] = (subjectFrequency[q.subject] || 0) + 1;
      }

      // ── Compute weighted prediction scores per topic ──
      // Formula: TopicFreq(0.30) + Repetition(0.20) + RecentTrend(0.20) + DifficultyMatch(0.15) + LanguageSimilarity(0.15)
      const topicScores: Record<string, {
        finalScore: number;
        topicFreqWeight: number;
        repetitionScore: number;
        recentTrendWeight: number;
        difficultyPatternMatch: number;
        languageSimilarityScore: number;
        trendStrength: string;
        yearBreakdown: Record<number, number>;
        evidenceSummary: string;
      }> = {};

      const maxYears = Math.max(yearSpan, 5);

      for (const [topic, analytics] of Object.entries(topicAnalytics)) {
        // 1. Topic Frequency Weight (0-100): how often this topic appears relative to total
        const topicFreqWeight = Math.min(100, (analytics.count / Math.max(totalPYQs, 1)) * 100 * 10);

        // 2. Repetition Score (0-100): how many years out of span it appeared
        const repetitionScore = (analytics.years.size / maxYears) * 100;

        // 3. Recent Trend Weight (0-100): heavier if appeared in last 2 years with increasing count
        const recentYears = [recentYear, recentYear - 1];
        const recentCount = recentYears.reduce((sum, y) => sum + (analytics.yearCounts[y] || 0), 0);
        const olderCount = Object.entries(analytics.yearCounts)
          .filter(([y]) => !recentYears.includes(Number(y)))
          .reduce((sum, [, c]) => sum + c, 0);
        const avgOlder = olderCount / Math.max(maxYears - 2, 1);
        const avgRecent = recentCount / 2;
        const trendRatio = avgOlder > 0 ? avgRecent / avgOlder : (avgRecent > 0 ? 2 : 0);
        const recentTrendWeight = Math.min(100, trendRatio * 50);

        // 4. Difficulty Pattern Match (0-100): consistency of difficulty pattern
        const diffCounts: Record<string, number> = {};
        analytics.difficulties.forEach(d => diffCounts[d] = (diffCounts[d] || 0) + 1);
        const dominantDiffCount = Math.max(...Object.values(diffCounts), 0);
        const difficultyPatternMatch = analytics.difficulties.length > 0
          ? (dominantDiffCount / analytics.difficulties.length) * 100
          : 50;

        // 5. Language Structure Similarity (0-100): question diversity indicator (more unique = higher exam relevance)
        const uniqueStarts = new Set(analytics.questions.map(q => q.slice(0, 30).toLowerCase()));
        const languageSimilarityScore = analytics.questions.length > 1
          ? Math.min(100, (uniqueStarts.size / analytics.questions.length) * 100)
          : 60;

        // Weighted formula
        const rawScore =
          (topicFreqWeight * 0.30) +
          (repetitionScore * 0.20) +
          (recentTrendWeight * 0.20) +
          (difficultyPatternMatch * 0.15) +
          (languageSimilarityScore * 0.15);

        // Cap to 55-85% range for authenticity
        const finalScore = Math.round(Math.max(55, Math.min(85, rawScore)));

        // Trend strength
        const trendStrength = trendRatio >= 1.5 ? "High" : trendRatio >= 0.8 ? "Medium" : "Emerging";

        // Evidence summary
        const yearsList = [...analytics.years].sort().join(", ");
        const evidenceParts = [];
        evidenceParts.push(`Appeared in ${analytics.years.size}/${maxYears} years (${yearsList})`);
        if (trendRatio > 1) evidenceParts.push(`Increasing trend in recent years`);
        evidenceParts.push(`${analytics.count} total occurrences`);
        const evidenceSummary = evidenceParts.join(". ");

        topicScores[topic] = {
          finalScore,
          topicFreqWeight: Math.round(topicFreqWeight),
          repetitionScore: Math.round(repetitionScore),
          recentTrendWeight: Math.round(recentTrendWeight),
          difficultyPatternMatch: Math.round(difficultyPatternMatch),
          languageSimilarityScore: Math.round(languageSimilarityScore),
          trendStrength,
          yearBreakdown: analytics.yearCounts,
          evidenceSummary,
        };
      }

      // Sort topics by score for AI context
      const rankedTopics = Object.entries(topicScores)
        .sort(([, a], [, b]) => b.finalScore - a.finalScore);

      const patternSummary = rankedTopics.slice(0, 15).map(([topic, s]) =>
        `${topic}: Score=${s.finalScore}%, Years=${topicAnalytics[topic].years.size}/${maxYears}, Trend=${s.trendStrength}, Evidence: ${s.evidenceSummary}`
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

      // Build topic score map string for AI
      const topicScoreMap = rankedTopics.slice(0, 20).map(([topic, s]) =>
        `"${topic}": { score: ${s.finalScore}, trend: "${s.trendStrength}", freq_weight: ${s.topicFreqWeight}, repetition: ${s.repetitionScore}, recent_trend: ${s.recentTrendWeight}, difficulty_match: ${s.difficultyPatternMatch}, lang_similarity: ${s.languageSimilarityScore} }`
      ).join(",\n");

      const questionCount = Math.min(count || 5, 10);

      const aiMessages = [
        {
          role: "system",
          content: `You are an expert Indian competitive exam analyst for ${targetExam}. You have analyzed ${totalPYQs} PYQs from last ${maxYears} years.

COMPUTED PREDICTION SCORES (using weighted formula):
${topicScoreMap || "No historical data — use general exam patterns."}

SUBJECT WEIGHTAGE: ${subjectSummary || "Equal distribution assumed."}

FORMULA USED:
Score = (TopicFrequency × 0.30) + (Repetition × 0.20) + (RecentTrend × 0.20) + (DifficultyMatch × 0.15) + (LanguageSimilarity × 0.15)

CRITICAL RULES:
- probability_score MUST be between 55 and 85. Never 100%.
- Use the pre-computed scores above. Match each question's topic to the closest topic score.
- trend_reason must cite SPECIFIC evidence: exact years, occurrence counts, trend direction.
- trend_strength must be: "High", "Medium", or "Emerging"
- ml_confidence must be: "Strong" (score 75+), "Moderate" (65-74), or "Fair" (55-64)
- For each question, provide score_breakdown with the 5 component weights.
- Generate exam-level questions that feel genuinely likely to appear.
- Return VALID JSON only.`
        },
        {
          role: "user",
          content: `Generate exactly ${questionCount} predicted questions for ${targetExam}, subject: ${targetSubject}.
User's weak areas: ${topicContext}.
Prioritize high-score topics from the analysis.

Return JSON: {"questions":[{"question":"...","options":["A","B","C","D"],"correct_answer":0,"explanation":"...","topic":"...","difficulty":"easy|medium|hard","probability_score":55-85,"probability_level":"Very High|High|Medium","trend_strength":"High|Medium|Emerging","ml_confidence":"Strong|Moderate|Fair","trend_reason":"...","score_breakdown":{"topic_frequency":0-100,"repetition":0-100,"recent_trend":0-100,"difficulty_match":0-100,"language_similarity":0-100},"similar_pyq_years":[2020,2021]}]}`
        }
      ];

      // ── AI Call with Lovable Gateway + Direct Gemini API fallback ──
      let aiData: any = null;
      let lastError = "";

      // Step 1: Try Lovable AI gateway models
      const modelsToTry = [
        "google/gemini-2.5-flash",
        "google/gemini-2.5-flash-lite",
        "openai/gpt-5-nano",
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

      // Step 2: Fallback to direct Google Gemini API if Lovable gateway failed
      if (!aiData) {
        const GEMINI_KEY = Deno.env.get("GOOGLE_GEMINI_API_KEY");
        if (GEMINI_KEY) {
          console.log("Falling back to direct Gemini API...");
          const geminiModels = ["gemini-2.5-flash", "gemini-2.0-flash"];
          for (const gModel of geminiModels) {
            try {
              const controller = new AbortController();
              const timeout = setTimeout(() => controller.abort(), 50000);
              const geminiResponse = await fetch(
                `https://generativelanguage.googleapis.com/v1beta/models/${gModel}:generateContent?key=${GEMINI_KEY}`,
                {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    contents: [
                      { role: "user", parts: [{ text: aiMessages[0].content + "\n\n" + aiMessages[1].content }] }
                    ],
                    generationConfig: {
                      responseMimeType: "application/json",
                      temperature: 0.7,
                    },
                  }),
                  signal: controller.signal,
                }
              );
              clearTimeout(timeout);

              if (!geminiResponse.ok) {
                const errBody = await geminiResponse.text();
                lastError = `Gemini ${gModel}: ${geminiResponse.status}`;
                console.error(lastError, errBody);
                continue;
              }

              const geminiData = await geminiResponse.json();
              const textContent = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;
              if (textContent) {
                // Parse the JSON from Gemini's text response
                const parsed = JSON.parse(textContent);
                aiData = {
                  choices: [{ message: { content: JSON.stringify(parsed) } }]
                };
                console.log(`Direct Gemini ${gModel} succeeded`);
                break;
              }
            } catch (e: any) {
              lastError = e.name === "AbortError" ? "Gemini timeout" : (e.message || "Gemini error");
              console.error(`Gemini ${gModel}: ${lastError}`);
            }
          }
        } else {
          console.error("No GOOGLE_GEMINI_API_KEY configured for fallback");
        }
      }

      if (!aiData) {
        return new Response(JSON.stringify({ error: "AI service temporarily unavailable. Please try again in a moment." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" }
        });
      }

      let questions: any[] = [];
      try {
        // Try tool_calls format first
        const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
        if (toolCall?.function?.arguments) {
          const parsed = JSON.parse(toolCall.function.arguments);
          questions = parsed.questions || [];
        } else {
          // Try direct content JSON
          const content = aiData.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(typeof content === "string" ? content : JSON.stringify(content));
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
      }));

      return new Response(JSON.stringify({
        questions,
        analysis: {
          totalPYQsAnalyzed: totalPYQs,
          yearsCovered: allYears,
          topTrendingTopics: rankedTopics.slice(0, 8).map(([topic, s]) => ({
            topic,
            score: s.finalScore,
            trend: s.trendStrength,
            years: [...topicAnalytics[topic].years].sort(),
          })),
          examType: targetExam,
          formula: "TopicFreq(30%) + Repetition(20%) + RecentTrend(20%) + DifficultyMatch(15%) + LangSimilarity(15%)",
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
      // Fetch real questions from question_bank using pagination
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
          allQuestions = allQuestions.concat(data);
          offset += batchSize;
          hasMore = data.length === batchSize;
        } else {
          hasMore = false;
        }
      }

      // If count specified, randomly pick that many; otherwise return all
      let result = allQuestions;
      if (count && count > 0 && allQuestions.length > count) {
        for (let i = allQuestions.length - 1; i > 0; i--) {
          const j = Math.floor(Math.random() * (i + 1));
          [allQuestions[i], allQuestions[j]] = [allQuestions[j], allQuestions[i]];
        }
        result = allQuestions.slice(0, count);
      }

      return new Response(JSON.stringify({ questions: result, totalAvailable: allQuestions.length }), {
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
