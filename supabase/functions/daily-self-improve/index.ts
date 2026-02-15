import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    // Use service role for cron-triggered runs
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get all users who have a cognitive twin (active users)
    const { data: twins, error: twinsError } = await supabase
      .from("cognitive_twins")
      .select("user_id");

    if (twinsError) throw twinsError;
    if (!twins || twins.length === 0) {
      return new Response(JSON.stringify({ message: "No active twins to process", processed: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results: { user_id: string; status: string; insights?: any }[] = [];

    for (const twin of twins) {
      try {
        const userId = twin.user_id;

        // === 1. Run self-improvement cycle for this user ===
        const cycleResult = await runSelfImprovementCycle(supabase, userId);

        // === 2. Send notification with insights ===
        const summary = buildInsightsSummary(cycleResult);

        await supabase.from("notification_history").insert({
          user_id: userId,
          title: "🧠 Daily Brain Evolution",
          body: summary,
          type: "self_improvement",
        });

        results.push({ user_id: userId, status: "success", insights: cycleResult.summary });
      } catch (e) {
        console.error(`Self-improve failed for user ${twin.user_id}:`, e);
        results.push({ user_id: twin.user_id, status: "error" });
      }
    }

    return new Response(JSON.stringify({
      processed: results.length,
      successful: results.filter(r => r.status === "success").length,
      results,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("daily-self-improve error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

async function runSelfImprovementCycle(supabase: any, userId: string) {
  const now = new Date();
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  // Fetch data in parallel
  const [predictionsRes, logsRes, plansRes, featuresRes, twinRes] = await Promise.all([
    supabase.from("model_predictions").select("model_name, is_correct, confidence").eq("user_id", userId).gte("created_at", thirtyDaysAgo.toISOString()).limit(100),
    supabase.from("study_logs").select("duration_minutes, confidence_level, study_mode, created_at").eq("user_id", userId).gte("created_at", thirtyDaysAgo.toISOString()),
    supabase.from("plan_quality_logs").select("overall_completion_rate").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("cognitive_twins").select("brain_evolution_score, learning_efficiency_score, memory_growth_rate, avg_decay_rate").eq("user_id", userId).maybeSingle(),
  ]);

  const predictions = predictionsRes.data || [];
  const logs = logsRes.data || [];
  const plans = plansRes.data || [];
  const features = featuresRes.data;
  const twin = twinRes.data;

  // --- Analyze prediction accuracy ---
  const correctCount = predictions.filter((p: any) => p.is_correct).length;
  const predictionAccuracy = predictions.length > 0 ? correctCount / predictions.length : 0;

  // --- Analyze study mode effectiveness ---
  const modeStats: Record<string, { total: number; high: number }> = {};
  for (const log of logs) {
    const mode = log.study_mode || "review";
    if (!modeStats[mode]) modeStats[mode] = { total: 0, high: 0 };
    modeStats[mode].total++;
    if (log.confidence_level === "high") modeStats[mode].high++;
  }
  const bestMode = Object.entries(modeStats)
    .map(([mode, s]) => ({ mode, rate: s.total > 0 ? s.high / s.total : 0 }))
    .filter(m => m.rate > 0)
    .sort((a, b) => b.rate - a.rate)[0];

  // --- Analyze optimal session duration ---
  const highConfLogs = logs.filter((l: any) => l.confidence_level === "high" && l.duration_minutes > 0);
  const optimalDuration = highConfLogs.length > 0
    ? Math.round(highConfLogs.reduce((s: number, l: any) => s + l.duration_minutes, 0) / highConfLogs.length)
    : 25;

  // --- Plan completion trend ---
  const avgCompletion = plans.length > 0
    ? plans.reduce((s: number, p: any) => s + (Number(p.overall_completion_rate) || 0), 0) / plans.length
    : 0;

  // --- Recent activity check ---
  const recentLogs = logs.filter((l: any) => new Date(l.created_at) >= sevenDaysAgo);
  const studiedToday = logs.some((l: any) => {
    const d = new Date(l.created_at);
    return d.toDateString() === now.toDateString();
  });

  // --- Compute data drift ---
  const recentAvgDuration = recentLogs.length > 0
    ? recentLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0) / recentLogs.length
    : 0;
  const olderLogs = logs.filter((l: any) => new Date(l.created_at) < sevenDaysAgo);
  const olderAvgDuration = olderLogs.length > 0
    ? olderLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0) / olderLogs.length
    : 0;
  const durationDrift = olderAvgDuration > 0 ? Math.abs(recentAvgDuration - olderAvgDuration) / olderAvgDuration : 0;

  // --- Update strategies ---
  await supabase.from("meta_learning_strategies").update({ is_active: false }).eq("user_id", userId);

  const { data: latestStrat } = await supabase
    .from("meta_learning_strategies")
    .select("iteration")
    .eq("user_id", userId)
    .order("iteration", { ascending: false })
    .limit(1)
    .maybeSingle();

  const nextIteration = (latestStrat?.iteration || 0) + 1;

  const strategies = [
    {
      user_id: userId,
      strategy_type: "study_mode",
      strategy_params: { recommended_mode: bestMode?.mode || "review", confidence_rate: bestMode?.rate || 0 },
      performance_score: bestMode?.rate || 0,
      iteration: nextIteration,
      is_active: true,
    },
    {
      user_id: userId,
      strategy_type: "session_duration",
      strategy_params: { optimal_minutes: optimalDuration },
      performance_score: highConfLogs.length > 5 ? 0.8 : 0.5,
      iteration: nextIteration,
      is_active: true,
    },
    {
      user_id: userId,
      strategy_type: "revision_timing",
      strategy_params: { prediction_accuracy: Math.round(predictionAccuracy * 100), drift: Math.round(durationDrift * 100) },
      performance_score: predictionAccuracy,
      iteration: nextIteration,
      is_active: true,
    },
  ];

  for (const s of strategies) {
    await supabase.from("meta_learning_strategies").insert(s);
  }

  // --- Log training event ---
  await supabase.from("ml_training_logs").insert({
    model_name: "meta_learning",
    model_version: "v1",
    training_type: "daily_self_improvement",
    status: "completed",
    completed_at: now.toISOString(),
    metrics: {
      prediction_accuracy: Math.round(predictionAccuracy * 100),
      best_mode: bestMode?.mode || "review",
      optimal_duration: optimalDuration,
      plan_completion: Math.round(avgCompletion * 100),
      data_drift: Math.round(durationDrift * 100),
      iteration: nextIteration,
    },
    triggered_by: "cron",
  });

  return {
    summary: {
      prediction_accuracy: Math.round(predictionAccuracy * 100),
      best_study_mode: bestMode?.mode || "review",
      optimal_duration: optimalDuration,
      plan_completion: Math.round(avgCompletion * 100),
      brain_evolution: twin?.brain_evolution_score ? Math.round(twin.brain_evolution_score) : null,
      memory_growth: twin?.memory_growth_rate ? Math.round(twin.memory_growth_rate * 10) / 10 : null,
      data_drift_detected: durationDrift > 0.3,
      iteration: nextIteration,
      studied_today: studiedToday,
      recent_sessions: recentLogs.length,
    },
  };
}

function buildInsightsSummary(result: any): string {
  const s = result.summary;
  const parts: string[] = [];

  parts.push(`🔄 Self-improvement cycle #${s.iteration} complete.`);

  if (s.brain_evolution !== null) {
    parts.push(`Brain evolution: ${s.brain_evolution}/100.`);
  }

  if (s.prediction_accuracy > 0) {
    parts.push(`Prediction accuracy: ${s.prediction_accuracy}%.`);
  }

  parts.push(`Best study mode: ${s.best_study_mode} (${s.optimal_duration}m sessions).`);

  if (s.memory_growth !== null) {
    parts.push(`Memory growth: ${s.memory_growth > 0 ? "+" : ""}${s.memory_growth}%.`);
  }

  if (s.data_drift_detected) {
    parts.push("⚠️ Study pattern shift detected — strategies adjusted.");
  }

  if (!s.studied_today) {
    parts.push("📚 You haven't studied today — even 15 min helps!");
  }

  return parts.join(" ");
}
