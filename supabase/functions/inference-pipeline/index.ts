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
    const startTime = Date.now();
    const stages: Record<string, { status: string; latency_ms: number; data?: any }> = {};

    // ══════════════════════════════════════════
    // STAGE 1: Load User Profile (cognitive twin)
    // ══════════════════════════════════════════
    let t0 = Date.now();
    const { data: twin } = await supabase.from("cognitive_twins")
      .select("*").eq("user_id", userId).maybeSingle();

    const { data: features } = await supabase.from("user_features")
      .select("*").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle();

    stages["1_profile"] = {
      status: twin ? "loaded" : "missing",
      latency_ms: Date.now() - t0,
      data: twin ? {
        decay_rate: twin.avg_decay_rate,
        learning_speed: twin.avg_learning_speed,
        optimal_hour: twin.optimal_study_hour,
        session_duration: twin.optimal_session_duration,
        brain_evolution: twin.brain_evolution_score,
      } : null,
    };

    // ══════════════════════════════════════════
    // STAGE 2: Load User Embedding
    // ══════════════════════════════════════════
    t0 = Date.now();
    const { data: embedding } = await supabase.from("user_cognitive_embeddings")
      .select("embedding, cluster_id, cognitive_fingerprint, embedding_version, dimensions")
      .eq("user_id", userId).maybeSingle();

    stages["2_embedding"] = {
      status: embedding ? "loaded" : "missing",
      latency_ms: Date.now() - t0,
      data: embedding ? {
        cluster: embedding.cluster_id,
        fingerprint: embedding.cognitive_fingerprint,
        version: embedding.embedding_version,
        dimensions: embedding.dimensions,
      } : null,
    };

    // ══════════════════════════════════════════
    // STAGE 3: Load User-Specific Parameters (RL policy + strategies)
    // ══════════════════════════════════════════
    t0 = Date.now();
    const [strategiesRes, selectionsRes] = await Promise.all([
      supabase.from("meta_learning_strategies").select("strategy_type, strategy_params, performance_score, iteration")
        .eq("user_id", userId).eq("is_active", true),
      supabase.from("model_selections").select("model_domain, active_model, last_evaluated_at")
        .eq("user_id", userId),
    ]);

    const activeStrategies = strategiesRes.data || [];
    const modelSelections = selectionsRes.data || [];

    // Extract RL policy if exists
    const rlPolicy = activeStrategies.find(s => s.strategy_type === "rl_policy");

    stages["3_parameters"] = {
      status: activeStrategies.length > 0 ? "loaded" : "default",
      latency_ms: Date.now() - t0,
      data: {
        strategy_count: activeStrategies.length,
        model_selections: modelSelections.length,
        rl_policy_iteration: rlPolicy?.iteration || 0,
        strategies: activeStrategies.map(s => s.strategy_type),
      },
    };

    // ══════════════════════════════════════════
    // STAGE 4: Run Predictions (hybrid memory + rank + RL recommendations)
    // ══════════════════════════════════════════
    t0 = Date.now();

    // Invoke existing functions in parallel
    const [hybridRes, rlRes] = await Promise.all([
      supabase.functions.invoke("hybrid-prediction"),
      supabase.functions.invoke("rl-agent"),
    ]);

    const hybridData = hybridRes.data;
    const rlData = rlRes.data;

    stages["4_predictions"] = {
      status: hybridData && rlData ? "complete" : hybridData ? "partial_hybrid" : rlData ? "partial_rl" : "failed",
      latency_ms: Date.now() - t0,
      data: {
        hybrid_health: hybridData?.hybrid_health,
        hybrid_rank: hybridData?.hybrid_rank_score,
        topics_predicted: hybridData?.topic_predictions?.length || 0,
        rl_topics_ranked: rlData?.topics_ranked || 0,
        rl_iteration: rlData?.iteration || 0,
      },
    };

    // ══════════════════════════════════════════
    // STAGE 5: Compose Personalized Result
    // ══════════════════════════════════════════
    t0 = Date.now();

    // Merge RL priority sequence with hybrid predictions
    const topicPredictions = hybridData?.topic_predictions || [];
    const rlPriorities = rlData?.policy?.sequence?.priority_topics || [];

    // Enrich hybrid predictions with RL priority ordering
    const enrichedTopics = topicPredictions.map((tp: any) => {
      const rlEntry = rlPriorities.find((rp: any) => rp.topic_id === tp.topic_id);
      return {
        ...tp,
        rl_priority: rlEntry?.priority_score || 0,
        recommended_duration: rlEntry?.recommended_duration || 25,
        staleness_days: rlEntry?.staleness_days || null,
      };
    }).sort((a: any, b: any) => b.rl_priority - a.rl_priority);

    // Build study schedule recommendation from RL timing
    const timing = rlData?.policy?.timing || {};
    const intensity = rlData?.policy?.intensity || {};

    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const schedule = {
      best_study_windows: (timing.best_hours || []).map((h: number) => ({
        hour: h,
        label: `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`,
      })),
      avoid_hours: (timing.worst_hours || []).map((h: number) => ({
        hour: h,
        label: `${h > 12 ? h - 12 : h === 0 ? 12 : h}:00 ${h >= 12 ? "PM" : "AM"}`,
      })),
      best_days: (timing.best_days || []).map((d: number) => dayNames[d] || `Day ${d}`),
      session_minutes: intensity.recommended_session_minutes || 25,
      max_daily_minutes: intensity.max_daily_minutes || 120,
      fatigue_warning_at: intensity.fatigue_threshold_minutes || 90,
    };

    const totalLatency = Date.now() - startTime;

    stages["5_compose"] = {
      status: "complete",
      latency_ms: Date.now() - t0,
    };

    // Log inference run
    await supabase.from("model_predictions").insert({
      user_id: userId,
      model_name: "inference_pipeline",
      model_version: "v1",
      prediction: {
        hybrid_health: hybridData?.hybrid_health,
        hybrid_rank: hybridData?.hybrid_rank_score,
        rl_iteration: rlData?.iteration,
        topics_count: enrichedTopics.length,
      },
      confidence: hybridData?.personal_weight || 0.5,
      latency_ms: totalLatency,
      input_features: {
        has_twin: !!twin,
        has_embedding: !!embedding,
        strategy_count: activeStrategies.length,
      },
    });

    return new Response(JSON.stringify({
      // Pipeline metadata
      pipeline_version: "v1",
      total_latency_ms: totalLatency,
      stages,

      // User profile summary
      profile: {
        brain_evolution: twin?.brain_evolution_score || 0,
        learning_efficiency: twin?.learning_efficiency_score || 0,
        cognitive_cluster: embedding?.cluster_id || "unclassified",
        fingerprint: embedding?.cognitive_fingerprint || null,
        data_maturity: hybridData?.data_maturity_points || 0,
      },

      // Predictions
      predictions: {
        hybrid_health: hybridData?.hybrid_health || 0,
        hybrid_rank_score: hybridData?.hybrid_rank_score || 0,
        personal_weight: hybridData?.personal_weight || 0.7,
        global_weight: hybridData?.global_weight || 0.3,
        topic_predictions: enrichedTopics,
      },

      // RL-optimized recommendations
      recommendations: {
        study_sequence: enrichedTopics.slice(0, 5).map((t: any) => ({
          topic: t.topic_name,
          duration: t.recommended_duration,
          reason: t.risk_level === "critical" ? "Critical decay risk"
            : t.staleness_days > 7 ? "Not reviewed recently"
            : t.memory_strength < 40 ? "Weak retention"
            : "Priority review",
        })),
        schedule,
        intensity_profile: intensity.best_bucket || "medium",
      },

      // Reward signals
      reward_signals: rlData?.policy?.reward_signals || {},
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("inference-pipeline error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
