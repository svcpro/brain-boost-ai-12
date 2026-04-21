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
    const user = { id: userId };

    const { action, params } = await req.json();
    const userId = user.id;

    if (action === "compute") {
      return new Response(JSON.stringify(await computeTwin(supabase, userId)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "simulate") {
      return new Response(JSON.stringify(await runSimulation(supabase, userId, params)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "get") {
      const { data } = await supabase
        .from("cognitive_twins")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();
      return new Response(JSON.stringify(data || null), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("cognitive-twin error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function computeTwin(supabase: any, userId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [topicsRes, logsRes, scoresRes, featuresRes] = await Promise.all([
    supabase.from("topics").select("id, name, memory_strength, last_revision_date, created_at, subject_id").eq("user_id", userId).is("deleted_at", null),
    supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, topic_id, study_mode").eq("user_id", userId).gte("created_at", thirtyDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(500),
    supabase.from("memory_scores").select("score, recorded_at, topic_id").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(300),
    supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
  ]);

  const topics = topicsRes.data || [];
  const logs = logsRes.data || [];
  const scores = scoresRes.data || [];
  const features = featuresRes.data;

  // Build per-topic cognitive models
  const topicModels = topics.map((topic: any) => {
    const topicLogs = logs.filter((l: any) => l.topic_id === topic.id);
    const topicScores = scores.filter((s: any) => s.topic_id === topic.id).sort((a: any, b: any) => new Date(a.recorded_at).getTime() - new Date(b.recorded_at).getTime());

    // Decay rate from score history
    let decayRate = 0.05; // default
    if (topicScores.length >= 2) {
      const first = topicScores[0];
      const last = topicScores[topicScores.length - 1];
      const hoursDiff = (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / (1000 * 60 * 60);
      if (hoursDiff > 0 && Number(first.score) > 0) {
        decayRate = Math.max(0.001, -Math.log(Math.max(0.01, Number(last.score) / Number(first.score))) / hoursDiff);
      }
    }

    // Learning speed: how fast memory_strength increases per revision
    const learningSpeed = topicLogs.length > 0
      ? Number(topic.memory_strength) / Math.max(1, topicLogs.length)
      : 0;

    // Recall success
    const highConf = topicLogs.filter((l: any) => l.confidence_level === "high").length;
    const recallRate = topicLogs.length > 0 ? highConf / topicLogs.length : 0;

    // Stability (inverse of decay)
    const stability = 1 / Math.max(0.001, decayRate);

    return {
      topic_id: topic.id,
      topic_name: topic.name,
      memory_strength: Number(topic.memory_strength),
      decay_rate: Math.round(decayRate * 10000) / 10000,
      learning_speed: Math.round(learningSpeed * 100) / 100,
      recall_success_rate: Math.round(recallRate * 100) / 100,
      stability: Math.round(stability * 100) / 100,
      review_count: topicLogs.length,
      last_revision: topic.last_revision_date,
    };
  });

  // Aggregate cognitive profile
  const avgDecay = topicModels.length > 0 ? topicModels.reduce((s: number, t: any) => s + t.decay_rate, 0) / topicModels.length : 0.05;
  const avgSpeed = topicModels.length > 0 ? topicModels.reduce((s: number, t: any) => s + t.learning_speed, 0) / topicModels.length : 0;

  // Optimal study hour from logs
  const hourCounts: Record<number, number> = {};
  const hourConfidence: Record<number, number> = {};
  for (const log of logs) {
    const hour = new Date(log.created_at).getHours();
    hourCounts[hour] = (hourCounts[hour] || 0) + 1;
    if (log.confidence_level === "high") hourConfidence[hour] = (hourConfidence[hour] || 0) + 1;
  }
  let optimalHour = 9;
  let bestHourScore = 0;
  for (const [h, count] of Object.entries(hourCounts)) {
    const confRate = (hourConfidence[Number(h)] || 0) / count;
    const score = count * 0.3 + confRate * 0.7;
    if (score > bestHourScore) { bestHourScore = score; optimalHour = Number(h); }
  }

  // Optimal session duration
  const durations = logs.map((l: any) => l.duration_minutes || 0).filter((d: number) => d > 0);
  const highConfDurations = logs.filter((l: any) => l.confidence_level === "high").map((l: any) => l.duration_minutes || 0).filter((d: number) => d > 0);
  const optimalDuration = highConfDurations.length > 0
    ? Math.round(highConfDurations.reduce((s: number, d: number) => s + d, 0) / highConfDurations.length)
    : 25;

  // Cognitive capacity (composite)
  const avgStrength = topicModels.length > 0 ? topicModels.reduce((s: number, t: any) => s + t.memory_strength, 0) / topicModels.length : 0;
  const cognitiveCapacity = Math.min(100, avgStrength * 0.4 + (features?.study_consistency_score || 0) * 0.3 + (features?.knowledge_stability || 0) * 0.3);

  // Evolution scores
  const brainEvolution = Math.min(100, topicModels.length * 2 + avgStrength * 0.5 + (features?.learning_velocity || 0) * 10);
  const learningEfficiency = topicModels.length > 0
    ? Math.min(100, topicModels.reduce((s: number, t: any) => s + t.recall_success_rate, 0) / topicModels.length * 100)
    : 0;

  // Memory growth rate (compare recent vs older avg strength)
  const recentScores = scores.filter((s: any) => new Date(s.recorded_at) >= new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const olderScores = scores.filter((s: any) => new Date(s.recorded_at) < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
  const recentAvg = recentScores.length > 0 ? recentScores.reduce((s: number, x: any) => s + Number(x.score), 0) / recentScores.length : 0;
  const olderAvg = olderScores.length > 0 ? olderScores.reduce((s: number, x: any) => s + Number(x.score), 0) / olderScores.length : 0;
  const memoryGrowthRate = olderAvg > 0 ? ((recentAvg - olderAvg) / olderAvg) * 100 : 0;

  const twinData = {
    user_id: userId,
    topic_models: topicModels,
    avg_learning_speed: Math.round(avgSpeed * 100) / 100,
    avg_decay_rate: Math.round(avgDecay * 10000) / 10000,
    optimal_study_hour: optimalHour,
    optimal_session_duration: optimalDuration,
    cognitive_capacity_score: Math.round(cognitiveCapacity * 100) / 100,
    recall_pattern_type: avgSpeed > 15 ? "fast_learner" : avgDecay > 0.1 ? "high_decay" : "standard",
    fatigue_threshold_minutes: features?.fatigue_indicator > 50 ? 90 : 120,
    brain_evolution_score: Math.round(brainEvolution * 100) / 100,
    learning_efficiency_score: Math.round(learningEfficiency * 100) / 100,
    memory_growth_rate: Math.round(memoryGrowthRate * 100) / 100,
    twin_version: 1,
    computed_at: now.toISOString(),
  };

  // Upsert
  const { data: existing } = await supabase.from("cognitive_twins").select("id").eq("user_id", userId).maybeSingle();
  if (existing) {
    await supabase.from("cognitive_twins").update(twinData).eq("user_id", userId);
  } else {
    await supabase.from("cognitive_twins").insert(twinData);
  }

  return twinData;
}

async function runSimulation(supabase: any, userId: string, params: any) {
  const { topic_id, strategy, days_ahead = 7 } = params || {};

  // Get twin
  const { data: twin } = await supabase.from("cognitive_twins").select("*").eq("user_id", userId).maybeSingle();
  if (!twin) throw new Error("Compute your Digital Twin first");

  const topicModels = twin.topic_models as any[];

  if (topic_id && strategy === "study_now") {
    // Simulate studying a specific topic now
    const topicModel = topicModels.find((t: any) => t.topic_id === topic_id);
    if (!topicModel) throw new Error("Topic not found in twin");

    const currentStrength = topicModel.memory_strength;
    const decayRate = topicModel.decay_rate;
    const learningSpeed = topicModel.learning_speed;

    // After studying: strength increases
    const postStudyStrength = Math.min(100, currentStrength + learningSpeed * 1.5);
    // Predict retention after N days using R = e^(-t/S)
    const hoursAhead = days_ahead * 24;
    const stability = 1 / Math.max(0.001, decayRate);
    const predictedRetention = postStudyStrength * Math.exp(-hoursAhead / stability);
    const withoutStudyRetention = currentStrength * Math.exp(-hoursAhead / stability);

    const result = {
      scenario: "study_now",
      topic_name: topicModel.topic_name,
      current_strength: Math.round(currentStrength),
      post_study_strength: Math.round(postStudyStrength),
      predicted_retention_after_days: Math.round(predictedRetention),
      without_study_retention: Math.round(withoutStudyRetention),
      retention_gain: Math.round(predictedRetention - withoutStudyRetention),
      days_ahead,
      confidence: Math.min(0.95, 0.5 + topicModel.review_count * 0.05),
    };

    await supabase.from("learning_simulations").insert({
      user_id: userId,
      scenario_type: "study_now",
      input_params: { topic_id, days_ahead },
      simulation_result: result,
      predicted_retention: predictedRetention,
      confidence: result.confidence,
    });

    return result;
  }

  // Compare multiple strategies
  const strategies = ["intensive", "spaced", "minimal"];
  const comparisons = strategies.map(strat => {
    const avgDecay = twin.avg_decay_rate;
    const avgStrength = topicModels.length > 0
      ? topicModels.reduce((s: number, t: any) => s + t.memory_strength, 0) / topicModels.length
      : 50;

    let boostFactor = 1;
    let sessionFrequency = 1;
    if (strat === "intensive") { boostFactor = 2; sessionFrequency = 3; }
    else if (strat === "spaced") { boostFactor = 1.5; sessionFrequency = 1; }
    else { boostFactor = 0.5; sessionFrequency = 0.5; }

    const hoursAhead = days_ahead * 24;
    const stability = (1 / Math.max(0.001, avgDecay)) * boostFactor;
    const projectedStrength = Math.min(100, avgStrength + boostFactor * 10);
    const predictedRetention = projectedStrength * Math.exp(-hoursAhead / stability);

    // Estimate rank change (simplified)
    const rankImprovement = Math.round((predictedRetention - avgStrength) * 50);

    return {
      strategy: strat,
      projected_strength: Math.round(projectedStrength),
      predicted_retention: Math.round(predictedRetention),
      estimated_rank_change: rankImprovement,
      daily_sessions: sessionFrequency,
      effort_level: strat === "intensive" ? "high" : strat === "spaced" ? "medium" : "low",
    };
  });

  await supabase.from("learning_simulations").insert({
    user_id: userId,
    scenario_type: "strategy_comparison",
    input_params: { days_ahead },
    simulation_result: { comparisons },
    predicted_retention: comparisons[1].predicted_retention,
    confidence: 0.7,
  });

  return { comparisons, recommended: comparisons.sort((a, b) => b.predicted_retention - a.predicted_retention)[0].strategy };
}
