import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing auth");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) throw new Error("Unauthorized");

    const { action } = await req.json();
    const userId = user.id;

    if (action === "optimize") {
      return new Response(JSON.stringify(await optimizeStrategies(supabase, userId)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "select_model") {
      return new Response(JSON.stringify(await selectBestModel(supabase, userId)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "self_improve") {
      return new Response(JSON.stringify(await selfImprove(supabase, userId)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (action === "status") {
      return new Response(JSON.stringify(await getStatus(supabase, userId)), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    throw new Error("Invalid action");
  } catch (e) {
    console.error("meta-learning error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function optimizeStrategies(supabase: any, userId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  // Analyze prediction errors to learn better strategies
  const [predictionsRes, plansRes, logsRes, strategiesRes] = await Promise.all([
    supabase.from("model_predictions").select("*").eq("user_id", userId).gte("created_at", thirtyDaysAgo.toISOString()).order("created_at", { ascending: false }).limit(100),
    supabase.from("plan_quality_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
    supabase.from("study_logs").select("duration_minutes, confidence_level, study_mode, created_at").eq("user_id", userId).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("meta_learning_strategies").select("*").eq("user_id", userId).eq("is_active", true),
  ]);

  const predictions = predictionsRes.data || [];
  const plans = plansRes.data || [];
  const logs = logsRes.data || [];
  const existingStrategies = strategiesRes.data || [];

  // 1. Analyze which study modes produce best recall
  const modePerformance: Record<string, { total: number; highConf: number }> = {};
  for (const log of logs) {
    const mode = log.study_mode || "review";
    if (!modePerformance[mode]) modePerformance[mode] = { total: 0, highConf: 0 };
    modePerformance[mode].total++;
    if (log.confidence_level === "high") modePerformance[mode].highConf++;
  }

  const bestMode = Object.entries(modePerformance)
    .map(([mode, stats]) => ({ mode, rate: stats.total > 0 ? stats.highConf / stats.total : 0, total: stats.total }))
    .filter(m => m.total >= 3)
    .sort((a, b) => b.rate - a.rate)[0];

  // 2. Analyze optimal session duration from high-confidence sessions
  const highConfLogs = logs.filter((l: any) => l.confidence_level === "high" && l.duration_minutes > 0);
  const optimalDuration = highConfLogs.length > 0
    ? Math.round(highConfLogs.reduce((s: number, l: any) => s + l.duration_minutes, 0) / highConfLogs.length)
    : 25;

  // 3. Analyze plan completion patterns
  const avgCompletion = plans.length > 0
    ? plans.reduce((s: number, p: any) => s + (Number(p.overall_completion_rate) || 0), 0) / plans.length
    : 0;

  // 4. Analyze prediction error patterns
  const wrongPredictions = predictions.filter((p: any) => p.is_correct === false);
  const errorRate = predictions.length > 0 ? wrongPredictions.length / predictions.length : 0;

  // Build optimized strategies
  const newStrategies = [
    {
      user_id: userId,
      strategy_type: "study_mode",
      strategy_params: {
        recommended_mode: bestMode?.mode || "review",
        confidence_rate: bestMode?.rate || 0,
        fallback_mode: "focus",
      },
      performance_score: bestMode?.rate || 0,
      is_active: true,
    },
    {
      user_id: userId,
      strategy_type: "session_duration",
      strategy_params: {
        optimal_minutes: optimalDuration,
        min_effective: Math.max(10, optimalDuration - 10),
        max_before_fatigue: optimalDuration + 20,
      },
      performance_score: highConfLogs.length > 5 ? 0.8 : 0.5,
      is_active: true,
    },
    {
      user_id: userId,
      strategy_type: "revision_timing",
      strategy_params: {
        error_rate: Math.round(errorRate * 100) / 100,
        plan_completion_rate: Math.round(avgCompletion * 100) / 100,
        adjust_intervals: errorRate > 0.4 ? "shorten" : "maintain",
      },
      performance_score: 1 - errorRate,
      is_active: true,
    },
  ];

  // Deactivate old strategies and insert new ones
  if (existingStrategies.length > 0) {
    await supabase.from("meta_learning_strategies").update({ is_active: false }).eq("user_id", userId);
  }

  const maxIteration = existingStrategies.length > 0
    ? Math.max(...existingStrategies.map((s: any) => s.iteration || 0)) + 1
    : 1;

  for (const strategy of newStrategies) {
    await supabase.from("meta_learning_strategies").insert({
      ...strategy,
      iteration: maxIteration,
    });
  }

  return {
    strategies: newStrategies,
    iteration: maxIteration,
    insights: {
      best_study_mode: bestMode?.mode || "review",
      optimal_duration: optimalDuration,
      prediction_error_rate: Math.round(errorRate * 100),
      plan_completion_avg: Math.round(avgCompletion * 100),
    },
  };
}

async function selectBestModel(supabase: any, userId: string) {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  // Get prediction performance by model
  const { data: predictions } = await supabase
    .from("model_predictions")
    .select("model_name, is_correct, confidence, latency_ms")
    .eq("user_id", userId)
    .gte("created_at", thirtyDaysAgo.toISOString());

  const modelPerf: Record<string, { correct: number; total: number; avgConf: number; avgLatency: number }> = {};
  for (const p of (predictions || [])) {
    if (!modelPerf[p.model_name]) modelPerf[p.model_name] = { correct: 0, total: 0, avgConf: 0, avgLatency: 0 };
    modelPerf[p.model_name].total++;
    if (p.is_correct) modelPerf[p.model_name].correct++;
    modelPerf[p.model_name].avgConf += (p.confidence || 0);
    modelPerf[p.model_name].avgLatency += (p.latency_ms || 0);
  }

  const domains = ["memory_prediction", "rank_prediction", "burnout_detection"];
  const selections: any[] = [];

  for (const domain of domains) {
    const candidates = Object.entries(modelPerf)
      .filter(([name]) => name.includes(domain) || name === domain)
      .map(([name, perf]) => ({
        model: name,
        accuracy: perf.total > 0 ? perf.correct / perf.total : 0,
        total: perf.total,
        avgConfidence: perf.total > 0 ? perf.avgConf / perf.total : 0,
        avgLatency: perf.total > 0 ? perf.avgLatency / perf.total : 0,
        // Composite score: accuracy * 0.6 + confidence_calibration * 0.2 + speed * 0.2
        score: perf.total > 0
          ? (perf.correct / perf.total) * 0.6 + (perf.avgConf / perf.total) * 0.2 + Math.max(0, 1 - (perf.avgLatency / perf.total) / 1000) * 0.2
          : 0,
      }))
      .sort((a, b) => b.score - a.score);

    const best = candidates[0] || { model: `${domain}_v1`, score: 0 };

    const selectionData = {
      user_id: userId,
      model_domain: domain,
      active_model: best.model,
      candidate_models: candidates,
      performance_history: [{ selected: best.model, score: best.score, at: new Date().toISOString() }],
      last_evaluated_at: new Date().toISOString(),
    };

    // Upsert
    const { data: existing } = await supabase
      .from("model_selections")
      .select("id, performance_history")
      .eq("user_id", userId)
      .eq("model_domain", domain)
      .maybeSingle();

    if (existing) {
      const history = [...(existing.performance_history || []), ...selectionData.performance_history].slice(-20);
      await supabase.from("model_selections").update({ ...selectionData, performance_history: history }).eq("id", existing.id);
    } else {
      await supabase.from("model_selections").insert(selectionData);
    }

    selections.push(selectionData);
  }

  return { selections, evaluated_at: new Date().toISOString() };
}

async function selfImprove(supabase: any, userId: string) {
  // Orchestrate: optimize strategies + select models + trigger continual learning
  const [stratResult, modelResult] = await Promise.all([
    optimizeStrategies(supabase, userId),
    selectBestModel(supabase, userId),
  ]);

  // Trigger continual learning check
  let continualResult = null;
  try {
    const { data } = await supabase.functions.invoke("continual-learning");
    continualResult = data;
  } catch (e) {
    continualResult = { error: "Could not run continual learning" };
  }

  // Log the self-improvement cycle
  await supabase.from("ml_training_logs").insert({
    model_name: "meta_learning",
    model_version: "v1",
    training_type: "self_improvement",
    status: "completed",
    completed_at: new Date().toISOString(),
    metrics: {
      strategy_iteration: stratResult.iteration,
      models_evaluated: modelResult.selections.length,
      continual_health: continualResult?.health_score || null,
    },
    triggered_by: "user",
  });

  return {
    strategies: stratResult,
    model_selections: modelResult,
    continual_learning: continualResult,
    improvement_cycle: stratResult.iteration,
  };
}

async function getStatus(supabase: any, userId: string) {
  const [strategiesRes, selectionsRes, twinRes] = await Promise.all([
    supabase.from("meta_learning_strategies").select("*").eq("user_id", userId).eq("is_active", true),
    supabase.from("model_selections").select("*").eq("user_id", userId),
    supabase.from("cognitive_twins").select("brain_evolution_score, learning_efficiency_score, memory_growth_rate, computed_at").eq("user_id", userId).maybeSingle(),
  ]);

  return {
    active_strategies: strategiesRes.data || [],
    model_selections: selectionsRes.data || [],
    cognitive_twin: twinRes.data || null,
    system_ready: !!(twinRes.data),
  };
}
