import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

      const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3-flash-preview",
          messages: [
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
- Generate exam-level questions that feel genuinely likely to appear.`
            },
            {
              role: "user",
              content: `Generate ${count || 10} predicted questions for ${targetExam}, subject: ${targetSubject}.
User's weak areas: ${topicContext}.
Prioritize high-score topics from the analysis.`
            }
          ],
          tools: [{
            type: "function",
            function: {
              name: "return_questions",
              description: "Return predicted exam questions with authentic pattern-based prediction scores",
              parameters: {
                type: "object",
                properties: {
                  questions: {
                    type: "array",
                    items: {
                      type: "object",
                      properties: {
                        question: { type: "string" },
                        options: { type: "array", items: { type: "string" } },
                        correct_answer: { type: "integer" },
                        explanation: { type: "string" },
                        topic: { type: "string" },
                        difficulty: { type: "string", enum: ["easy", "medium", "hard"] },
                        probability_score: { type: "integer", minimum: 55, maximum: 85, description: "Match prediction percentage based on formula" },
                        probability_level: { type: "string", enum: ["Very High", "High", "Medium"] },
                        trend_strength: { type: "string", enum: ["High", "Medium", "Emerging"], description: "Trend strength indicator" },
                        ml_confidence: { type: "string", enum: ["Strong", "Moderate", "Fair"], description: "ML model confidence level" },
                        trend_reason: { type: "string", description: "Evidence-based reason, e.g. 'Appeared in 4/5 years (2020-2024), 12 total occurrences, increasing trend'" },
                        score_breakdown: {
                          type: "object",
                          properties: {
                            topic_frequency: { type: "integer", description: "Topic frequency weight 0-100" },
                            repetition: { type: "integer", description: "Year repetition score 0-100" },
                            recent_trend: { type: "integer", description: "Recent trend weight 0-100" },
                            difficulty_match: { type: "integer", description: "Difficulty pattern match 0-100" },
                            language_similarity: { type: "integer", description: "Language structure similarity 0-100" }
                          },
                          required: ["topic_frequency", "repetition", "recent_trend", "difficulty_match", "language_similarity"]
                        },
                        similar_pyq_years: { type: "array", items: { type: "integer" }, description: "Years when similar questions appeared" }
                      },
                      required: ["question", "options", "correct_answer", "explanation", "topic", "difficulty", "probability_score", "probability_level", "trend_strength", "ml_confidence", "trend_reason", "score_breakdown", "similar_pyq_years"]
                    }
                  }
                },
                required: ["questions"]
              }
            }
          }],
          tool_choice: { type: "function", function: { name: "return_questions" } }
        }),
      });

      if (!aiResponse.ok) {
        const status = aiResponse.status;
        if (status === 429) return new Response(JSON.stringify({ error: "Rate limited, please try again shortly." }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        if (status === 402) return new Response(JSON.stringify({ error: "AI credits exhausted." }), { status: 402, headers: { ...corsHeaders, "Content-Type": "application/json" } });
        throw new Error(`AI error: ${status}`);
      }

      const aiData = await aiResponse.json();
      const toolCall = aiData.choices?.[0]?.message?.tool_calls?.[0];
      let questions = [];
      if (toolCall?.function?.arguments) {
        const parsed = JSON.parse(toolCall.function.arguments);
        questions = (parsed.questions || []).map((q: any) => ({
          ...q,
          // Enforce score cap
          probability_score: Math.max(55, Math.min(85, q.probability_score || 65)),
        }));
      }

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
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
