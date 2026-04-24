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

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

    // === 1. PREDICTION ACCURACY ANALYSIS ===
    // Check memory predictions vs actual outcomes
    const { data: predictions } = await supabase
      .from("model_predictions")
      .select("model_name, prediction, actual_outcome, is_correct, confidence, created_at")
      .eq("user_id", userId)
      .gte("created_at", thirtyDaysAgo.toISOString())
      .order("created_at", { ascending: false })
      .limit(200);

    const predsByModel: Record<string, { total: number; correct: number; avgConfidence: number }> = {};
    for (const p of (predictions || [])) {
      if (!predsByModel[p.model_name]) predsByModel[p.model_name] = { total: 0, correct: 0, avgConfidence: 0 };
      predsByModel[p.model_name].total++;
      if (p.is_correct) predsByModel[p.model_name].correct++;
      predsByModel[p.model_name].avgConfidence += (p.confidence || 0);
    }

    const accuracyReport: Record<string, { accuracy: number; total: number; avgConfidence: number; needsRetrain: boolean }> = {};
    for (const [model, stats] of Object.entries(predsByModel)) {
      const accuracy = stats.total > 0 ? stats.correct / stats.total : 0;
      const avgConf = stats.total > 0 ? stats.avgConfidence / stats.total : 0;
      accuracyReport[model] = {
        accuracy: Math.round(accuracy * 100) / 100,
        total: stats.total,
        avgConfidence: Math.round(avgConf * 100) / 100,
        needsRetrain: accuracy < 0.6 && stats.total >= 5, // retrain if accuracy below 60%
      };
    }

    // === 2. FEATURE STALENESS CHECK ===
    const { data: userFeatures } = await supabase
      .from("user_features")
      .select("computed_at")
      .eq("user_id", userId)
      .maybeSingle();

    const featureAge = userFeatures?.computed_at
      ? (now.getTime() - new Date(userFeatures.computed_at).getTime()) / (1000 * 60 * 60)
      : Infinity;

    const featuresStale = featureAge > 24; // stale if older than 24 hours

    // === 3. DATA DRIFT DETECTION ===
    // Compare recent study patterns to historical
    const { data: recentLogs } = await supabase
      .from("study_logs")
      .select("duration_minutes, confidence_level")
      .eq("user_id", userId)
      .gte("created_at", sevenDaysAgo.toISOString());

    const { data: olderLogs } = await supabase
      .from("study_logs")
      .select("duration_minutes, confidence_level")
      .eq("user_id", userId)
      .lt("created_at", sevenDaysAgo.toISOString())
      .gte("created_at", thirtyDaysAgo.toISOString());

    const recentAvgDuration = (recentLogs || []).length > 0
      ? ((recentLogs as any[]) || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0) / recentLogs!.length
      : 0;
    const olderAvgDuration = (olderLogs || []).length > 0
      ? ((olderLogs as any[]) || []).reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0) / olderLogs!.length
      : 0;

    const durationDrift = olderAvgDuration > 0
      ? Math.abs(recentAvgDuration - olderAvgDuration) / olderAvgDuration
      : 0;

    const dataDriftDetected = durationDrift > 0.3; // >30% change in study patterns

    // === 4. STQ MODEL DRIFT MONITORING ===
    let stqDrift: any = { monitored: false };
    try {
      // Check if STQ TPI scores are drifting from actual exam patterns
      const { data: recentMetrics } = await supabase
        .from("model_metrics")
        .select("metric_value, metadata, created_at")
        .eq("model_name", "stq_tpi_prediction")
        .eq("metric_type", "hit_rate")
        .order("created_at", { ascending: false })
        .limit(5);

      if (recentMetrics && recentMetrics.length >= 2) {
        const latestHitRate = recentMetrics[0].metric_value;
        const avgHistorical = recentMetrics.slice(1).reduce((s: number, m: any) => s + m.metric_value, 0) / (recentMetrics.length - 1);
        const stqDriftScore = Math.abs(latestHitRate - avgHistorical);
        
        stqDrift = {
          monitored: true,
          latest_hit_rate: latestHitRate,
          avg_historical: Math.round(avgHistorical * 100) / 100,
          drift_score: Math.round(stqDriftScore * 100) / 100,
          needs_retrain: latestHitRate < 0.4 || stqDriftScore > 0.2,
        };
      }

      // Check STQ engine staleness
      const { data: stqConfig } = await supabase
        .from("stq_engine_config")
        .select("last_retrained_at")
        .limit(1)
        .maybeSingle();

      if (stqConfig?.last_retrained_at) {
        const stqAge = (now.getTime() - new Date(stqConfig.last_retrained_at).getTime()) / (1000 * 60 * 60 * 24);
        stqDrift.days_since_retrain = Math.round(stqAge);
        stqDrift.stale = stqAge > 14; // STQ model stale after 14 days
      }
    } catch (e) {
      console.error("STQ drift check error:", e);
    }

    // === 5. AUTO-RETRAIN DECISION ===
    const modelsToRetrain: string[] = [];

    // Retrain feature engine if stale
    if (featuresStale) modelsToRetrain.push("feature_engine");

    // Retrain models with low accuracy
    for (const [model, report] of Object.entries(accuracyReport)) {
      if (report.needsRetrain) modelsToRetrain.push(model);
    }

    // If data drift detected, retrain all
    if (dataDriftDetected) {
      if (!modelsToRetrain.includes("feature_engine")) modelsToRetrain.push("feature_engine");
    }

    // If STQ drift detected, flag for STQ retrain
    if (stqDrift.needs_retrain || stqDrift.stale) {
      modelsToRetrain.push("stq_engine");
    }

    // === 6. TRIGGER RETRAINING ===
    let retrainResults: Record<string, string> = {};
    if (modelsToRetrain.includes("feature_engine")) {
      try {
        const { error } = await supabase.functions.invoke("ml-feature-engine");
        retrainResults["feature_engine"] = error ? `error: ${error.message}` : "success";
      } catch (e) {
        retrainResults["feature_engine"] = `error: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    // Auto-retrain STQ if drifting
    if (modelsToRetrain.includes("stq_engine")) {
      try {
        const { error } = await supabase.functions.invoke("stq-engine", {
          body: { action: "retrain" },
        });
        retrainResults["stq_engine"] = error ? `error: ${error.message}` : "success";
      } catch (e) {
        retrainResults["stq_engine"] = `error: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    // === 7. LOG THE MONITORING EVENT ===
    await supabase.from("ml_training_logs").insert({
      model_name: "continual_learning",
      model_version: "v2",
      training_type: "monitoring",
      status: "completed",
      completed_at: now.toISOString(),
      metrics: {
        accuracy_report: accuracyReport,
        feature_age_hours: Math.round(featureAge * 10) / 10,
        features_stale: featuresStale,
        data_drift: Math.round(durationDrift * 100) / 100,
        data_drift_detected: dataDriftDetected,
        stq_drift: stqDrift,
        models_retrained: modelsToRetrain,
        retrain_results: retrainResults,
      },
      triggered_by: "user",
    });

    // Store accuracy metrics
    for (const [model, report] of Object.entries(accuracyReport)) {
      if (report.total >= 3) {
        await supabase.from("model_metrics").insert({
          model_name: model,
          model_version: "v2",
          metric_type: "accuracy",
          metric_value: report.accuracy,
          sample_size: report.total,
          period_start: thirtyDaysAgo.toISOString(),
          period_end: now.toISOString(),
          metadata: { avg_confidence: report.avgConfidence, needs_retrain: report.needsRetrain },
        });
      }
    }

    return new Response(JSON.stringify({
      accuracy_report: accuracyReport,
      feature_staleness: { age_hours: Math.round(featureAge * 10) / 10, stale: featuresStale },
      data_drift: { drift_score: Math.round(durationDrift * 100) / 100, detected: dataDriftDetected },
      stq_model_health: stqDrift,
      retrained_models: modelsToRetrain,
      retrain_results: retrainResults,
      health_score: Math.round(
        (Object.values(accuracyReport).reduce((s, r) => s + r.accuracy, 0) / Math.max(Object.keys(accuracyReport).length, 1)) * 100
      ),
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("continual-learning error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
