import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// Cognitive state definitions
const COGNITIVE_STATES = ["deep_focus", "surface_focus", "cognitive_fatigue", "emotional_frustration", "high_impulse"] as const;

// Intervention ladder
const INTERVENTION_STAGES = [
  { stage: 1, type: "soft_nudge", threshold: 0.5 },
  { stage: 2, type: "micro_recall", threshold: 0.7 },
  { stage: 3, type: "hard_lock", threshold: 0.85 },
];

Deno.serve(async (req) => {
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
    const hour = now.getHours();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const today = now.toISOString().slice(0, 10);

    // Fetch all signals in parallel
    const [eventsRes, scoresRes, warningsRes, featuresRes, lockConfigRes, logsRes, examRes] = await Promise.all([
      supabase.from("distraction_events").select("*").eq("user_id", userId).gte("created_at", oneHourAgo.toISOString()).order("created_at", { ascending: false }),
      supabase.from("distraction_scores").select("*").eq("user_id", userId).order("score_date", { ascending: false }).limit(7),
      supabase.from("focus_shield_warnings").select("*").eq("user_id", userId).gte("created_at", oneDayAgo.toISOString()),
      supabase.from("user_features").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("adaptive_lock_config").select("*").limit(1).maybeSingle(),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("accelerator_enrollments").select("end_date, status").eq("user_id", userId).eq("status", "active").maybeSingle(),
    ]);

    const recentEvents = eventsRes.data || [];
    const recentScores = scoresRes.data || [];
    const recentWarnings = warningsRes.data || [];
    const features = featuresRes.data;
    const lockConfig = lockConfigRes.data;
    const studyLogs = logsRes.data || [];
    const activeExam = examRes.data;

    // ═══ MODULE 1: ATTENTION DRIFT PREDICTION ═══
    
    // Time-of-day risk (late night / post-lunch dip)
    const timeRisk = (hour >= 23 || hour < 5) ? 0.8 
      : (hour >= 13 && hour <= 15) ? 0.5 
      : (hour >= 22) ? 0.6 
      : 0.2;

    // Fatigue from user_features
    const fatigueIndicator = features?.fatigue_indicator ? Number(features.fatigue_indicator) / 100 : 0;

    // App switching velocity (switches in last hour)
    const tabSwitches = recentEvents.filter(e => e.event_type === "tab_switch").length;
    const switchVelocity = Math.min(1, tabSwitches / 15); // normalize: 15 switches/hr = max

    // Error clustering (low confidence in recent logs)
    const lowConfCount = studyLogs.filter(l => l.confidence_level === "low").length;
    const errorCluster = Math.min(1, lowConfCount / 10);

    // Latency spikes (rapid switching = high latency in attention)
    const rapidEvents = recentEvents.filter(e => e.context?.rapid === true).length;
    const latencySpike = Math.min(1, rapidEvents / 5);

    // Mock frustration (consecutive low confidence)
    let mockFrustration = 0;
    for (const log of studyLogs) {
      if (log.confidence_level === "low") mockFrustration += 0.15;
      else break;
    }
    mockFrustration = Math.min(1, mockFrustration);

    // Weighted distraction probability
    const distractionProbability = Math.min(1, Math.round((
      timeRisk * 0.15 +
      fatigueIndicator * 0.25 +
      switchVelocity * 0.2 +
      errorCluster * 0.15 +
      latencySpike * 0.1 +
      mockFrustration * 0.15
    ) * 1000) / 1000);

    // ═══ MODULE 2: COGNITIVE STATE CLASSIFIER ═══
    let cognitiveState = "surface_focus";
    let stateConfidence = 0.5;

    if (fatigueIndicator > 0.7) {
      cognitiveState = "cognitive_fatigue";
      stateConfidence = 0.7 + fatigueIndicator * 0.2;
    } else if (mockFrustration > 0.5) {
      cognitiveState = "emotional_frustration";
      stateConfidence = 0.6 + mockFrustration * 0.3;
    } else if (switchVelocity > 0.6 && latencySpike > 0.4) {
      cognitiveState = "high_impulse";
      stateConfidence = 0.65 + switchVelocity * 0.2;
    } else if (tabSwitches === 0 && fatigueIndicator < 0.3 && distractionProbability < 0.3) {
      cognitiveState = "deep_focus";
      stateConfidence = 0.8 - distractionProbability;
    } else {
      cognitiveState = "surface_focus";
      stateConfidence = 0.5 + (1 - distractionProbability) * 0.3;
    }

    // ═══ MODULE 3: ADAPTIVE INTERVENTION LADDER ═══
    const threshold = lockConfig?.prediction_threshold ?? 0.65;
    let interventionStage = 0;
    let interventionType: string | null = null;

    if (distractionProbability >= threshold) {
      // Determine stage based on recent warning count
      const recentInterventions = recentWarnings.length;
      if (recentInterventions >= 3 || distractionProbability >= 0.85) {
        interventionStage = 3;
        interventionType = "hard_lock";
      } else if (recentInterventions >= 1 || distractionProbability >= 0.7) {
        interventionStage = 2;
        interventionType = "micro_recall";
      } else {
        interventionStage = 1;
        interventionType = "soft_nudge";
      }

      // Adapt based on cognitive state
      if (cognitiveState === "cognitive_fatigue" && interventionStage >= 3) {
        interventionStage = 2; // Don't hard lock during fatigue, offer recall instead
        interventionType = "micro_recall";
      }
      if (cognitiveState === "emotional_frustration") {
        interventionStage = Math.min(interventionStage, 2);
        interventionType = interventionStage === 1 ? "soft_nudge" : "micro_recall";
      }
    }

    // ═══ MODULE 7: ADAPTIVE LOCK ENGINE ═══
    let lockDuration = lockConfig?.base_lock_seconds ?? 300;

    if (interventionStage === 3 && lockConfig) {
      // Exam proximity multiplier
      if (activeExam) {
        const daysToExam = Math.max(0, (new Date(activeExam.end_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        if (daysToExam <= 7) {
          lockDuration = Math.round(lockDuration * lockConfig.exam_proximity_multiplier);
        }
      }

      // Cognitive risk multiplier
      if (cognitiveState === "high_impulse") {
        lockDuration = Math.round(lockDuration * lockConfig.high_risk_multiplier);
      }

      // Burnout reduction
      const burnoutRisk = features?.burnout_risk_score ? Number(features.burnout_risk_score) : 0;
      if (burnoutRisk > 70) {
        lockDuration = Math.round(lockDuration * lockConfig.burnout_reduction_factor);
      }

      // Clamp
      lockDuration = Math.max(lockConfig.min_lock_seconds, Math.min(lockConfig.max_lock_seconds, lockDuration));
    }

    // ═══ MODULE 4: NEURAL DISCIPLINE SCORE ═══
    // Compute daily discipline based on resisted vs yielded
    const resistedCount = recentWarnings.filter(w => w.was_dismissed && w.recall_passed).length;
    const yieldedCount = recentWarnings.filter(w => !w.was_dismissed).length;
    const disciplineScore = Math.min(100, Math.round(
      (resistedCount * 15) - (yieldedCount * 10) + 50
    ));

    // ═══ MODULE 5: DOPAMINE REPLACEMENT ═══
    const streakMultiplier = 1.0 + (resistedCount * 0.1);
    const stabilityBoostsEarned = resistedCount >= 3 ? 1 : 0;
    const xpEarned = Math.round(resistedCount * 10 * streakMultiplier);

    // Store prediction
    await supabase.from("attention_predictions").insert({
      user_id: userId,
      distraction_probability: distractionProbability,
      cognitive_state: cognitiveState,
      fatigue_level: fatigueIndicator,
      impulse_score: switchVelocity,
      time_of_day_risk: timeRisk,
      error_cluster_score: errorCluster,
      latency_spike_score: latencySpike,
      mock_frustration_score: mockFrustration,
      app_switch_velocity: switchVelocity,
      intervention_triggered: interventionType,
      intervention_stage: interventionStage,
      context: {
        hour, tabSwitches, rapidEvents, lowConfCount,
        cognitive_confidence: stateConfidence,
        lock_duration: lockDuration,
        exam_active: !!activeExam,
      },
    });

    // Store cognitive state
    await supabase.from("cognitive_state_history").insert({
      user_id: userId,
      state: cognitiveState,
      confidence: Math.round(stateConfidence * 100) / 100,
      signals: {
        fatigue: fatigueIndicator, impulse: switchVelocity,
        frustration: mockFrustration, error_cluster: errorCluster,
      },
    });

    // Upsert neural discipline score
    await supabase.from("neural_discipline_scores").upsert({
      user_id: userId,
      score_date: today,
      discipline_score: Math.max(0, disciplineScore),
      distractions_resisted: resistedCount,
      distractions_yielded: yieldedCount,
      streak_multiplier: Math.round(streakMultiplier * 100) / 100,
      stability_boosts_earned: stabilityBoostsEarned,
      brain_level_xp_earned: xpEarned,
      dopamine_rewards_earned: resistedCount,
    }, { onConflict: "user_id,score_date" });

    // Log intervention if triggered
    if (interventionType) {
      await supabase.from("focus_interventions").insert({
        user_id: userId,
        intervention_stage: interventionStage,
        intervention_type: interventionType,
        trigger_reason: `DP=${distractionProbability}, state=${cognitiveState}`,
        distraction_probability: distractionProbability,
        cognitive_state: cognitiveState,
        lock_duration_seconds: interventionStage === 3 ? lockDuration : 0,
      });
    }

    const result = {
      prediction: {
        distraction_probability: distractionProbability,
        cognitive_state: cognitiveState,
        state_confidence: stateConfidence,
        signals: {
          time_of_day: timeRisk,
          fatigue: fatigueIndicator,
          switch_velocity: switchVelocity,
          error_cluster: errorCluster,
          latency_spike: latencySpike,
          mock_frustration: mockFrustration,
        },
      },
      intervention: interventionType ? {
        stage: interventionStage,
        type: interventionType,
        lock_duration: interventionStage === 3 ? lockDuration : 0,
        impulse_delay: lockConfig?.impulse_delay_enabled ?? true,
        impulse_type: lockConfig?.impulse_delay_type ?? "recall",
        breathing_seconds: lockConfig?.breathing_exercise_seconds ?? 30,
      } : null,
      discipline: {
        score: Math.max(0, disciplineScore),
        resisted: resistedCount,
        yielded: yieldedCount,
        streak_multiplier: streakMultiplier,
        xp_earned: xpEarned,
        stability_boost: stabilityBoostsEarned > 0,
      },
      dopamine: {
        focus_streak_multiplier: streakMultiplier,
        stability_boost_animation: stabilityBoostsEarned > 0,
        motivational_trigger: disciplineScore >= 70,
      },
    };

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("cognitive-predict error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
