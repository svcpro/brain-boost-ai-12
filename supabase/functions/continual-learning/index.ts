import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

    const userId = user.id;
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
      ? (recentLogs || []).reduce((s, l) => s + (l.duration_minutes || 0), 0) / recentLogs!.length
      : 0;
    const olderAvgDuration = (olderLogs || []).length > 0
      ? (olderLogs || []).reduce((s, l) => s + (l.duration_minutes || 0), 0) / olderLogs!.length
      : 0;

    const durationDrift = olderAvgDuration > 0
      ? Math.abs(recentAvgDuration - olderAvgDuration) / olderAvgDuration
      : 0;

    const dataDriftDetected = durationDrift > 0.3; // >30% change in study patterns

    // === 4. AUTO-RETRAIN DECISION ===
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

    // === 5. TRIGGER RETRAINING ===
    let retrainResults: Record<string, string> = {};
    if (modelsToRetrain.includes("feature_engine")) {
      try {
        const { error } = await supabase.functions.invoke("ml-feature-engine");
        retrainResults["feature_engine"] = error ? `error: ${error.message}` : "success";
      } catch (e) {
        retrainResults["feature_engine"] = `error: ${e instanceof Error ? e.message : "unknown"}`;
      }
    }

    // === 6. LOG THE MONITORING EVENT ===
    await supabase.from("ml_training_logs").insert({
      model_name: "continual_learning",
      model_version: "v1",
      training_type: "monitoring",
      status: "completed",
      completed_at: now.toISOString(),
      metrics: {
        accuracy_report: accuracyReport,
        feature_age_hours: Math.round(featureAge * 10) / 10,
        features_stale: featuresStale,
        data_drift: Math.round(durationDrift * 100) / 100,
        data_drift_detected: dataDriftDetected,
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
          model_version: "v1",
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
