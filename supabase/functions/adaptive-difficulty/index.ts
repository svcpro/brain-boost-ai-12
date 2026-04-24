import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, handleCors, jsonResponse, errorResponse, securityHeaders } from "../_shared/auth.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);

    const body = await req.json();
    const { topics: requestedTopics } = body;
    const startTime = Date.now();

    // Get question performance history
    const { data: questionPerf } = await supabase
      .from("question_performance")
      .select("question_hash, times_seen, times_wrong, last_seen_at")
      .eq("user_id", userId);

    // Get exam results for trend analysis
    const { data: examResults } = await supabase
      .from("exam_results")
      .select("score, total_questions, difficulty, created_at, topics")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(20);

    // Get user features
    const { data: features } = await supabase
      .from("user_features")
      .select("recall_success_rate, subject_strength_score, knowledge_stability")
      .eq("user_id", userId)
      .maybeSingle();

    const perf: any[] = (questionPerf as any[]) || [];
    const exams: any[] = (examResults as any[]) || [];

    // === ADAPTIVE DIFFICULTY ALGORITHM ===

    // Factor 1: Overall accuracy rate
    const totalSeen = perf.reduce((s, q) => s + q.times_seen, 0);
    const totalWrong = perf.reduce((s, q) => s + q.times_wrong, 0);
    const overallAccuracy = totalSeen > 0 ? 1 - (totalWrong / totalSeen) : 0.5;

    // Factor 2: Recent exam performance trend
    let examTrend = 0;
    if (exams.length >= 2) {
      const recentScores = exams.slice(0, 5).map(e => e.score / Math.max(1, e.total_questions));
      const olderScores = exams.slice(5, 10).map(e => e.score / Math.max(1, e.total_questions));
      if (olderScores.length > 0) {
        const avgRecent = recentScores.reduce((s, v) => s + v, 0) / recentScores.length;
        const avgOlder = olderScores.reduce((s, v) => s + v, 0) / olderScores.length;
        examTrend = avgRecent - avgOlder; // positive = improving
      }
    }

    // Factor 3: Difficulty distribution of recent exams
    const difficultyMap: Record<string, number> = { easy: 1, medium: 2, hard: 3 };
    const recentDifficulties = exams.slice(0, 5).map(e => difficultyMap[e.difficulty] || 2);
    const avgRecentDifficulty = recentDifficulties.length > 0
      ? recentDifficulties.reduce((s, v) => s + v, 0) / recentDifficulties.length
      : 2;

    // Factor 4: Feature-based adjustments
    const recallRate = features?.recall_success_rate || 0.5;
    const stability = features?.knowledge_stability || 50;

    // === COMPUTE RECOMMENDED DIFFICULTY ===
    // Score from 1 (easiest) to 3 (hardest)
    let difficultyScore = 2; // start at medium

    // Adjust based on accuracy (high accuracy → harder questions)
    if (overallAccuracy > 0.8) difficultyScore += 0.5;
    else if (overallAccuracy > 0.65) difficultyScore += 0.2;
    else if (overallAccuracy < 0.4) difficultyScore -= 0.5;
    else if (overallAccuracy < 0.55) difficultyScore -= 0.2;

    // Adjust based on trend (improving → slightly harder)
    if (examTrend > 0.1) difficultyScore += 0.3;
    else if (examTrend < -0.1) difficultyScore -= 0.3;

    // Adjust based on knowledge stability
    if (stability > 70) difficultyScore += 0.2;
    else if (stability < 30) difficultyScore -= 0.2;

    // Clamp
    difficultyScore = Math.max(1, Math.min(3, difficultyScore));

    // Map to difficulty level
    const recommendedDifficulty = difficultyScore >= 2.5 ? "hard" : difficultyScore >= 1.5 ? "medium" : "easy";

    // Question count recommendation (more questions for lower accuracy to build practice)
    const recommendedCount = overallAccuracy > 0.7 ? 10 : overallAccuracy > 0.5 ? 7 : 5;

    const latencyMs = Date.now() - startTime;

    const prediction = {
      recommended_difficulty: recommendedDifficulty,
      difficulty_score: Math.round(difficultyScore * 100) / 100,
      recommended_question_count: recommendedCount,
      factors: {
        overall_accuracy: Math.round(overallAccuracy * 100) / 100,
        exam_trend: Math.round(examTrend * 100) / 100,
        avg_recent_difficulty: Math.round(avgRecentDifficulty * 100) / 100,
        recall_rate: Math.round(recallRate * 100) / 100,
        knowledge_stability: Math.round(stability * 100) / 100,
      },
    };

    // Store prediction
    await supabase.from("model_predictions").insert({
      user_id: userId,
      model_name: "adaptive_difficulty",
      model_version: "v1",
      prediction,
      confidence: Math.min(1, (totalSeen + exams.length * 5) / 50),
      latency_ms: latencyMs,
    });

    return new Response(JSON.stringify(prediction), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("adaptive-difficulty error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
