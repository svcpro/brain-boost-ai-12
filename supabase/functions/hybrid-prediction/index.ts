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

    const userId = user.id;

    // Fetch personal data + global patterns in parallel
    const [twinRes, featuresRes, embeddingRes, globalRes, topicsRes] = await Promise.all([
      supabase.from("cognitive_twins").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("user_cognitive_embeddings").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("global_learning_patterns").select("*").order("pattern_date", { ascending: false }).limit(50),
      supabase.from("topics").select("id, name, memory_strength, last_revision_date, subject_id").eq("user_id", userId).is("deleted_at", null),
    ]);

    const twin = twinRes.data;
    const features = featuresRes.data;
    const embedding = embeddingRes.data;
    const globalPatterns = globalRes.data || [];
    const topics = topicsRes.data || [];

    // Calculate personal weight based on data maturity (more data = trust personal more)
    const topicModels = (twin?.topic_models as any[]) || [];
    const dataPoints = topicModels.reduce((s: number, t: any) => s + (t.review_count || 0), 0);
    const personalWeight = Math.min(0.9, 0.4 + dataPoints * 0.01); // 0.4-0.9 based on data volume
    const globalWeight = 1 - personalWeight;

    const predictions: any[] = [];

    // === HYBRID MEMORY PREDICTIONS ===
    const globalDecayPatterns = globalPatterns.filter(p => p.pattern_type === "decay_patterns");
    const globalAvgDecay = globalDecayPatterns.length > 0
      ? Number((globalDecayPatterns[0].metrics as any)?.avg_decay_slope ?? 0)
      : 0;

    for (const topic of topics) {
      const topicModel = topicModels.find((t: any) => t.topic_id === topic.id);
      const personalDecay = topicModel?.decay_rate ?? 0.05;
      const personalStrength = Number(topic.memory_strength);

      // Check global difficulty for this topic
      const globalDifficulty = globalPatterns.find(
        p => p.pattern_type === "topic_difficulty" && p.pattern_key === topic.name.toLowerCase().trim()
      );
      const globalAvgStrength = globalDifficulty
        ? Number((globalDifficulty.metrics as any)?.avg_strength ?? 50)
        : 50;

      // Hybrid memory strength = weighted combination
      const hybridStrength = personalStrength * personalWeight + globalAvgStrength * globalWeight;

      // Hybrid decay = weighted combination (if topic is globally hard, expect more decay)
      const hybridDecay = personalDecay * personalWeight + Math.abs(globalAvgDecay) * globalWeight;

      // Predict hours until significant drop
      const stability = 1 / Math.max(0.001, hybridDecay);
      const hoursUntilDrop = stability * Math.log(Math.max(0.01, hybridStrength / 40)); // drop to 40%

      // Risk level
      const riskLevel = hoursUntilDrop < 12 ? "critical" : hoursUntilDrop < 48 ? "high" : hoursUntilDrop < 168 ? "medium" : "low";

      // Confidence based on data + global corroboration
      const hasGlobalData = !!globalDifficulty;
      const confidence = Math.min(0.95, (topicModel?.review_count ?? 0) * 0.05 + (hasGlobalData ? 0.15 : 0) + 0.3);

      predictions.push({
        topic_id: topic.id,
        topic_name: topic.name,
        personal_strength: Math.round(personalStrength),
        global_avg_strength: Math.round(globalAvgStrength),
        hybrid_strength: Math.round(hybridStrength * 100) / 100,
        personal_decay: Math.round(personalDecay * 10000) / 10000,
        hybrid_decay: Math.round(hybridDecay * 10000) / 10000,
        hours_until_drop: Math.round(hoursUntilDrop),
        risk_level: riskLevel,
        confidence: Math.round(confidence * 100) / 100,
        global_corroborated: hasGlobalData,
      });
    }

    // === HYBRID RANK PREDICTION ===
    const avgPersonalStrength = topics.length > 0
      ? topics.reduce((s, t) => s + Number(t.memory_strength), 0) / topics.length
      : 0;

    // Global revision effectiveness
    const revEffPatterns = globalPatterns.filter(p => p.pattern_type === "revision_effectiveness");
    const globalRetentionAvg = revEffPatterns.length > 0
      ? revEffPatterns.reduce((s, p) => s + Number((p.metrics as any)?.avg_retention ?? 50), 0) / revEffPatterns.length
      : 50;

    const personalRankScore = avgPersonalStrength * 0.4 + (features?.study_consistency_score ?? 0) * 0.35 + (features?.knowledge_stability ?? 0) * 0.25;
    const globalRankAdjustment = (globalRetentionAvg - 50) / 100; // how user compares to global
    const hybridRankScore = personalRankScore * personalWeight + (personalRankScore * (1 + globalRankAdjustment)) * globalWeight;

    // Overall hybrid health
    const hybridHealth = predictions.length > 0
      ? predictions.reduce((s, p) => s + p.hybrid_strength, 0) / predictions.length
      : 0;

    // Store hybrid predictions
    const hybridRows = [
      {
        user_id: userId,
        prediction_type: "memory_health",
        personal_score: avgPersonalStrength,
        global_score: globalRetentionAvg,
        hybrid_score: hybridHealth,
        personal_weight: personalWeight,
        global_weight: globalWeight,
        confidence: Math.min(0.95, 0.5 + dataPoints * 0.005),
        metadata: { topic_count: predictions.length, at_risk: predictions.filter(p => p.risk_level === "critical" || p.risk_level === "high").length },
        computed_at: new Date().toISOString(),
      },
      {
        user_id: userId,
        prediction_type: "rank_estimate",
        personal_score: personalRankScore,
        global_score: personalRankScore * (1 + globalRankAdjustment),
        hybrid_score: hybridRankScore,
        personal_weight: personalWeight,
        global_weight: globalWeight,
        confidence: Math.min(0.95, 0.4 + dataPoints * 0.005),
        metadata: { global_adjustment: globalRankAdjustment },
        computed_at: new Date().toISOString(),
      },
    ];

    await supabase.from("hybrid_predictions").insert(hybridRows);

    return new Response(JSON.stringify({
      hybrid_health: Math.round(hybridHealth * 100) / 100,
      hybrid_rank_score: Math.round(hybridRankScore * 100) / 100,
      personal_weight: Math.round(personalWeight * 100) / 100,
      global_weight: Math.round(globalWeight * 100) / 100,
      topic_predictions: predictions,
      data_maturity_points: dataPoints,
      embedding_cluster: embedding?.cluster_id || "unknown",
      cognitive_fingerprint: embedding?.cognitive_fingerprint || null,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("hybrid-prediction error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
