import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, handleCors, corsHeaders } from "../_shared/auth.ts";

Deno.serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);

    // Fetch all data sources in parallel
    const [featuresRes, twinRes, logsRes, scoresRes, examsRes] = await Promise.all([
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("cognitive_twins").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode").eq("user_id", userId).order("created_at", { ascending: false }).limit(200),
      supabase.from("memory_scores").select("score, recorded_at, topic_id").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(100),
      supabase.from("exam_results").select("score, total_questions, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
    ]);

    const features = featuresRes.data;
    const twin = twinRes.data;
    const logs = logsRes.data || [];
    const scores = scoresRes.data || [];
    const exams = examsRes.data || [];

    // Build 16-dimensional cognitive embedding
    const featureLabels = [
      "memory_decay_speed",
      "learning_speed",
      "recall_success",
      "revision_effectiveness",
      "study_consistency",
      "cognitive_fatigue",
      "optimal_time_alignment",
      "focus_duration",
      "learning_efficiency",
      "knowledge_breadth",
      "exam_performance",
      "engagement_level",
      "burnout_resilience",
      "memory_stability",
      "improvement_velocity",
      "session_regularity",
    ];

    // Normalize each dimension to 0-1
    const norm = (val: number, min: number, max: number) => Math.max(0, Math.min(1, (val - min) / (max - min || 1)));

    // Dimension 0: Memory decay speed (lower decay = higher score)
    const decaySpeed = twin?.avg_decay_rate ?? 0.05;
    const d0 = 1 - norm(decaySpeed, 0, 0.2);

    // Dimension 1: Learning speed
    const d1 = norm(twin?.avg_learning_speed ?? 0, 0, 30);

    // Dimension 2: Recall success rate
    const d2 = features?.recall_success_rate ?? 0;

    // Dimension 3: Revision effectiveness (strength gain per revision)
    const topicModels = twin?.topic_models as any[] || [];
    const avgRevisionEff = topicModels.length > 0
      ? topicModels.reduce((s: number, t: any) => s + (t.review_count > 0 ? t.memory_strength / t.review_count : 0), 0) / topicModels.length
      : 0;
    const d3 = norm(avgRevisionEff, 0, 20);

    // Dimension 4: Study consistency
    const d4 = norm(features?.study_consistency_score ?? 0, 0, 100);

    // Dimension 5: Cognitive fatigue (low fatigue = high score)
    const d5 = 1 - norm(features?.fatigue_indicator ?? 0, 0, 100);

    // Dimension 6: Optimal time alignment (how well study times match optimal hour)
    const optimalHour = twin?.optimal_study_hour ?? 9;
    const hourDiffs = (logs as any[]).map((l: any) => Math.abs(new Date(l.created_at).getHours() - optimalHour));
    const avgHourDiff = hourDiffs.length > 0 ? hourDiffs.reduce((a: number, b: number) => a + b, 0) / hourDiffs.length : 6;
    const d6 = 1 - norm(avgHourDiff, 0, 12);

    // Dimension 7: Focus duration capacity
    const d7 = norm(features?.avg_session_duration_minutes ?? 0, 0, 90);

    // Dimension 8: Learning efficiency
    const d8 = norm(twin?.learning_efficiency_score ?? 0, 0, 100);

    // Dimension 9: Knowledge breadth (topic count normalized)
    const d9 = norm(topicModels.length, 0, 50);

    // Dimension 10: Exam performance
    const avgExam = exams.length > 0
      ? (exams as any[]).reduce((s: number, e: any) => s + (e.score / Math.max(1, e.total_questions)), 0) / exams.length
      : 0;
    const d10 = avgExam;

    // Dimension 11: Engagement level
    const d11 = norm(features?.engagement_score ?? 0, 0, 200);

    // Dimension 12: Burnout resilience (low burnout risk = high resilience)
    const d12 = 1 - norm(features?.burnout_risk_score ?? 0, 0, 100);

    // Dimension 13: Memory stability (knowledge stability)
    const d13 = norm(features?.knowledge_stability ?? 0, 0, 100);

    // Dimension 14: Improvement velocity
    const d14 = norm(features?.learning_velocity ?? 0, 0, 5);

    // Dimension 15: Session regularity (inverse of response latency)
    const d15 = 1 - norm(features?.response_latency_score ?? 0, 0, 48);

    const embedding = [d0, d1, d2, d3, d4, d5, d6, d7, d8, d9, d10, d11, d12, d13, d14, d15]
      .map(v => Math.round(v * 10000) / 10000);

    // Generate cognitive fingerprint (hash-like string for quick comparison)
    const fingerprint = embedding.map(v => Math.round(v * 9).toString()).join("");

    // Simple cluster assignment based on dominant traits
    const dominantIdx = embedding.indexOf(Math.max(...embedding));
    const weakestIdx = embedding.indexOf(Math.min(...embedding));
    const clusterLabels = [
      "memory_master", "fast_learner", "recall_champion", "revision_pro",
      "consistency_king", "zen_scholar", "time_optimizer", "deep_focus",
      "efficiency_expert", "knowledge_explorer", "exam_ace", "engaged_learner",
      "resilient_mind", "stable_memory", "rapid_improver", "regular_studier",
    ];
    const cluster = clusterLabels[dominantIdx] || "balanced";
    const similarityGroup = `${cluster}_weak_${featureLabels[weakestIdx]}`;

    const embeddingData = {
      user_id: userId,
      embedding,
      embedding_version: 1,
      dimensions: 16,
      feature_labels: featureLabels,
      cognitive_fingerprint: fingerprint,
      cluster_id: cluster,
      similarity_group: similarityGroup,
      computed_at: new Date().toISOString(),
    };

    // Upsert
    const { data: existing } = await supabase.from("user_cognitive_embeddings").select("id").eq("user_id", userId).maybeSingle();
    if (existing) {
      await supabase.from("user_cognitive_embeddings").update(embeddingData).eq("user_id", userId);
    } else {
      await supabase.from("user_cognitive_embeddings").insert(embeddingData);
    }

    return new Response(JSON.stringify(embeddingData), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    if (e instanceof Response) return e;
    console.error("user-embedding error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
