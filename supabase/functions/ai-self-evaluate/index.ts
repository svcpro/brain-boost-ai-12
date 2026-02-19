import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const sevenDaysAgo = new Date(now.getTime() - 7 * 86400000).toISOString();
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000).toISOString();
    const periodStart = sevenDaysAgo;
    const periodEnd = now.toISOString();

    // Get all active users (those with cognitive twins)
    const { data: users } = await supabase.from("cognitive_twins").select("user_id");
    if (!users || users.length === 0) {
      return new Response(JSON.stringify({ message: "No users to evaluate", evaluated: 0 }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const globalMetrics: Array<{ model_name: string; metric_type: string; metric_value: number; sample_size: number; period_start: string; period_end: string; metadata: any }> = [];
    let totalValidated = 0;

    for (const { user_id: userId } of users) {
      try {
        // === 1. VALIDATE RANK PREDICTIONS ===
        const [rankPredsRes, examResultsRes] = await Promise.all([
          supabase.from("rank_predictions").select("predicted_rank, percentile, recorded_at")
            .eq("user_id", userId).gte("recorded_at", thirtyDaysAgo).order("recorded_at", { ascending: false }).limit(10),
          supabase.from("exam_results").select("score, total_questions, created_at")
            .eq("user_id", userId).gte("created_at", thirtyDaysAgo).order("created_at", { ascending: false }).limit(10),
        ]);

        const rankPreds = rankPredsRes.data || [];
        const exams = examResultsRes.data || [];

        // Validate: did exam performance correlate with rank prediction direction?
        if (rankPreds.length >= 2 && exams.length >= 2) {
          const rankImproved = rankPreds[0].predicted_rank < rankPreds[rankPreds.length - 1].predicted_rank;
          const latestScore = (exams[0].score / exams[0].total_questions) * 100;
          const oldestScore = (exams[exams.length - 1].score / exams[exams.length - 1].total_questions) * 100;
          const scoreImproved = latestScore > oldestScore;
          const directionMatch = rankImproved === scoreImproved;

          // Update predictions with validation
          for (const pred of rankPreds) {
            await supabase.from("model_predictions")
              .update({
                is_correct: directionMatch,
                actual_outcome: { latest_score_pct: latestScore, direction_match: directionMatch },
                validated_at: now.toISOString(),
              })
              .eq("user_id", userId)
              .eq("model_name", "rank_prediction")
              .is("validated_at", null)
              .lte("created_at", pred.recorded_at);
          }
          totalValidated++;
        }

        // === 2. VALIDATE MEMORY PREDICTIONS ===
        const { data: memPreds } = await supabase.from("model_predictions")
          .select("id, prediction, created_at")
          .eq("user_id", userId)
          .eq("model_name", "memory_strength")
          .is("validated_at", null)
          .gte("created_at", thirtyDaysAgo)
          .limit(20);

        if (memPreds && memPreds.length > 0) {
          const { data: currentTopics } = await supabase.from("topics")
            .select("id, memory_strength")
            .eq("user_id", userId)
            .is("deleted_at", null);

          const topicMap = new Map((currentTopics || []).map(t => [t.id, Number(t.memory_strength)]));

          for (const pred of memPreds) {
            const prediction = pred.prediction as any;
            if (prediction?.topic_id && topicMap.has(prediction.topic_id)) {
              const actual = topicMap.get(prediction.topic_id)!;
              const predicted = prediction.predicted_strength ?? prediction.score ?? 0;
              const error = Math.abs(actual - predicted);
              const isCorrect = error < 15; // Within 15% is "correct"

              await supabase.from("model_predictions").update({
                is_correct: isCorrect,
                actual_outcome: { actual_strength: actual, error },
                validated_at: now.toISOString(),
              }).eq("id", pred.id);
            }
          }
        }

        // === 3. MEASURE RECOMMENDATION EFFECTIVENESS ===
        const [recsRes, logsRes] = await Promise.all([
          supabase.from("ai_recommendations").select("id, topic_id, completed, created_at, type")
            .eq("user_id", userId).gte("created_at", thirtyDaysAgo),
          supabase.from("study_logs").select("topic_id, created_at")
            .eq("user_id", userId).gte("created_at", thirtyDaysAgo),
        ]);

        const recs = recsRes.data || [];
        const studyLogs = logsRes.data || [];

        if (recs.length > 0) {
          const completedRecs = recs.filter(r => r.completed).length;
          const completionRate = completedRecs / recs.length;

          // Check if recommended topics were actually studied
          const recTopicIds = new Set(recs.filter(r => r.topic_id).map(r => r.topic_id));
          const studiedRecTopics = studyLogs.filter(l => l.topic_id && recTopicIds.has(l.topic_id)).length;
          const followThroughRate = recTopicIds.size > 0 ? Math.min(1, studiedRecTopics / recTopicIds.size) : 0;

          // Store per-user recommendation metrics
          globalMetrics.push({
            model_name: "recommendation_engine",
            metric_type: "completion_rate",
            metric_value: Math.round(completionRate * 100) / 100,
            sample_size: recs.length,
            period_start: periodStart,
            period_end: periodEnd,
            metadata: { user_id: userId, completed: completedRecs, total: recs.length },
          });

          globalMetrics.push({
            model_name: "recommendation_engine",
            metric_type: "follow_through_rate",
            metric_value: Math.round(followThroughRate * 100) / 100,
            sample_size: recTopicIds.size,
            period_start: periodStart,
            period_end: periodEnd,
            metadata: { user_id: userId, studied: studiedRecTopics, recommended: recTopicIds.size },
          });
        }

      } catch (e) {
        console.error(`Evaluation failed for user ${userId}:`, e);
      }
    }

    // === 4. COMPUTE GLOBAL MODEL ACCURACY METRICS ===
    const modelNames = ["rank_prediction", "memory_strength", "forgetting_curve", "burnout_detection", "adaptive_difficulty"];

    for (const modelName of modelNames) {
      const { data: validatedPreds } = await supabase.from("model_predictions")
        .select("is_correct, confidence")
        .eq("model_name", modelName)
        .not("validated_at", "is", null)
        .gte("created_at", thirtyDaysAgo);

      if (validatedPreds && validatedPreds.length >= 3) {
        const correct = validatedPreds.filter(p => p.is_correct).length;
        const accuracy = correct / validatedPreds.length;
        const avgConfidence = validatedPreds.reduce((s, p) => s + (Number(p.confidence) || 0), 0) / validatedPreds.length;

        // Calibration: how well does confidence match accuracy?
        const calibrationError = Math.abs(avgConfidence - accuracy);

        globalMetrics.push({
          model_name: modelName,
          metric_type: "accuracy",
          metric_value: Math.round(accuracy * 1000) / 1000,
          sample_size: validatedPreds.length,
          period_start: periodStart,
          period_end: periodEnd,
          metadata: { correct, total: validatedPreds.length },
        });

        globalMetrics.push({
          model_name: modelName,
          metric_type: "calibration_error",
          metric_value: Math.round(calibrationError * 1000) / 1000,
          sample_size: validatedPreds.length,
          period_start: periodStart,
          period_end: periodEnd,
          metadata: { avg_confidence: Math.round(avgConfidence * 100) / 100, accuracy: Math.round(accuracy * 100) / 100 },
        });
      }
    }

    // === 5. AUTO-SELECT BEST MODELS ===
    const domains = ["memory_prediction", "rank_prediction", "study_optimization"];
    for (const domain of domains) {
      const candidates = globalMetrics
        .filter(m => m.metric_type === "accuracy" && m.sample_size >= 3)
        .sort((a, b) => b.metric_value - a.metric_value);

      if (candidates.length > 0) {
        const best = candidates[0];
        await supabase.from("model_selections").upsert({
          user_id: users[0].user_id, // Global selection
          model_domain: domain,
          active_model: best.model_name,
          candidate_models: candidates.map(c => ({ name: c.model_name, accuracy: c.metric_value, samples: c.sample_size })),
          performance_history: candidates.slice(0, 5).map(c => ({ name: c.model_name, score: c.metric_value, date: periodEnd })),
          last_evaluated_at: now.toISOString(),
        }, { onConflict: "user_id,model_domain" });
      }
    }

    // Store all metrics
    if (globalMetrics.length > 0) {
      await supabase.from("model_metrics").insert(globalMetrics);
    }

    // Log the evaluation run
    await supabase.from("ml_training_logs").insert({
      model_name: "self_evaluation",
      model_version: "v1",
      training_type: "auto_evaluation",
      status: "completed",
      completed_at: now.toISOString(),
      training_data_size: totalValidated,
      metrics: {
        users_evaluated: users.length,
        predictions_validated: totalValidated,
        metrics_stored: globalMetrics.length,
      },
      triggered_by: "cron",
    });

    console.log(`Self-evaluation: ${users.length} users, ${totalValidated} validated, ${globalMetrics.length} metrics stored`);

    return new Response(JSON.stringify({
      success: true,
      users_evaluated: users.length,
      predictions_validated: totalValidated,
      metrics_stored: globalMetrics.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ai-self-evaluate error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
