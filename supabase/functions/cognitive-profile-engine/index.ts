import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { authenticateRequest, handleCors, jsonResponse, errorResponse } from "../_shared/auth.ts";

serve(async (req) => {
  const corsResp = handleCors(req);
  if (corsResp) return corsResp;

  try {
    const { userId, supabase } = await authenticateRequest(req);
    const body = await req.json().catch(() => ({}));
    const action = body.action || "analyze";

    // Fetch config
    const { data: config } = await supabase.from("fatigue_config").select("*").limit(1).maybeSingle();

    if (action === "analyze_session") {
      // Called after each practice/exam session with answer data
      const { answers, session_duration_ms, language } = body;
      if (!answers || !Array.isArray(answers)) throw new Error("answers array required");

      const totalAnswers = answers.length;
      const correctAnswers = answers.filter((a: any) => a.is_correct).length;
      const avgSpeedMs = totalAnswers > 0 ? answers.reduce((s: number, a: any) => s + (a.time_ms || 0), 0) / totalAnswers : 0;
      const accuracyRate = totalAnswers > 0 ? correctAnswers / totalAnswers : 0;

      // Detect learning style signals
      let conceptualSignals = 0;
      let memorizerSignals = 0;
      for (const a of answers) {
        if (a.time_ms > 15000 && a.is_correct) conceptualSignals++; // slow + correct = conceptual
        if (a.time_ms < 8000 && a.is_correct) memorizerSignals++; // fast + correct = memorizer
        if (a.time_ms < 5000 && !a.is_correct) memorizerSignals++; // too fast + wrong = guessing/memorizer
      }

      // Speed pattern
      const speeds = answers.map((a: any) => a.time_ms || 0);
      const speedStdDev = Math.sqrt(speeds.reduce((s: number, v: number) => s + Math.pow(v - avgSpeedMs, 2), 0) / Math.max(speeds.length, 1));
      const speedVariability = avgSpeedMs > 0 ? speedStdDev / avgSpeedMs : 0;

      let speedPattern = "moderate";
      if (avgSpeedMs < 6000) speedPattern = "fast";
      else if (avgSpeedMs > 15000) speedPattern = "slow";
      if (speedVariability > 0.6) speedPattern = "variable";

      // Speed-accuracy tradeoff
      const fastCorrect = answers.filter((a: any) => a.time_ms < 8000 && a.is_correct).length;
      const slowCorrect = answers.filter((a: any) => a.time_ms > 12000 && a.is_correct).length;
      let tradeoff = "balanced";
      if (fastCorrect > slowCorrect * 1.5) tradeoff = "speed_first";
      else if (slowCorrect > fastCorrect * 1.5) tradeoff = "accuracy_first";

      // Get existing profile
      const { data: existing } = await supabase.from("cognitive_profiles").select("*").eq("user_id", userId).maybeSingle();

      const prevTotal = existing?.total_answers_analyzed || 0;
      const newTotal = prevTotal + totalAnswers;
      const weight = totalAnswers / Math.max(newTotal, 1);

      // Weighted update
      const newConceptual = (existing?.conceptual_score || 0) * (1 - weight) + (conceptualSignals / Math.max(totalAnswers, 1)) * 100 * weight;
      const newMemorizer = (existing?.memorizer_score || 0) * (1 - weight) + (memorizerSignals / Math.max(totalAnswers, 1)) * 100 * weight;

      let learningStyle: string = "hybrid";
      if (newConceptual > newMemorizer * 1.3) learningStyle = "conceptual";
      else if (newMemorizer > newConceptual * 1.3) learningStyle = "memorizer";

      const styleConfidence = Math.min(100, Math.round(Math.abs(newConceptual - newMemorizer) + newTotal * 0.5));

      const profileData = {
        user_id: userId,
        learning_style: learningStyle,
        learning_style_confidence: styleConfidence,
        avg_answer_speed_ms: Math.round((existing?.avg_answer_speed_ms || avgSpeedMs) * (1 - weight) + avgSpeedMs * weight),
        speed_pattern: speedPattern,
        accuracy_rate: Math.round(((existing?.accuracy_rate || accuracyRate) * (1 - weight) + accuracyRate * weight) * 10000) / 10000,
        speed_accuracy_tradeoff: tradeoff,
        conceptual_score: Math.round(newConceptual * 100) / 100,
        memorizer_score: Math.round(newMemorizer * 100) / 100,
        total_answers_analyzed: newTotal,
        last_recalibrated_at: new Date().toISOString(),
      };

      if (existing) {
        await supabase.from("cognitive_profiles").update(profileData).eq("user_id", userId);
      } else {
        await supabase.from("cognitive_profiles").insert(profileData);
      }

      // === FATIGUE DETECTION ===
      const delayThreshold = config?.delay_threshold_ms || 8000;
      const mistakeThreshold = config?.mistake_cluster_threshold || 3;
      const sessionMaxMin = config?.session_max_minutes || 90;
      const sessionDurationMin = (session_duration_ms || 0) / 60000;

      // Mistake clusters: consecutive wrong answers
      let maxConsecutiveWrong = 0;
      let currentStreak = 0;
      for (const a of answers) {
        if (!a.is_correct) { currentStreak++; maxConsecutiveWrong = Math.max(maxConsecutiveWrong, currentStreak); }
        else currentStreak = 0;
      }

      const slowAnswers = answers.filter((a: any) => a.time_ms > delayThreshold).length;
      const fatigueScore = Math.min(100, Math.round(
        (slowAnswers / Math.max(totalAnswers, 1)) * 30 +
        (maxConsecutiveWrong / Math.max(mistakeThreshold, 1)) * 30 +
        (Math.min(sessionDurationMin, sessionMaxMin) / sessionMaxMin) * 40
      ));

      let fatigueEvent = null;
      if (fatigueScore > 60) {
        fatigueEvent = {
          user_id: userId,
          event_type: "fatigue_detected",
          trigger_reason: fatigueScore > 80 ? "high_fatigue_critical" : "moderate_fatigue",
          response_delay_avg_ms: avgSpeedMs,
          mistake_cluster_count: maxConsecutiveWrong,
          session_duration_minutes: sessionDurationMin,
          fatigue_score: fatigueScore,
        };
        await supabase.from("fatigue_events").insert(fatigueEvent);
      }

      // === EMOTIONAL CONFIDENCE DETECTION ===
      const rescueThreshold = config?.rescue_mode_wrong_threshold || 4;
      let confidenceEvent = null;
      if (maxConsecutiveWrong >= rescueThreshold) {
        const boostMessages = [
          "💪 Every expert was once a beginner. You're learning!",
          "🌟 Mistakes are proof you're trying. Keep going!",
          "🧠 Your brain is rewiring right now. This struggle is growth!",
          "🔥 Champions aren't born, they're made through practice like this.",
          "💎 Pressure creates diamonds. You're becoming stronger!",
        ];
        confidenceEvent = {
          user_id: userId,
          event_type: maxConsecutiveWrong >= rescueThreshold + 2 ? "rescue_triggered" : "struggle_detected",
          consecutive_wrong: maxConsecutiveWrong,
          boost_message: boostMessages[Math.floor(Math.random() * boostMessages.length)],
        };
        await supabase.from("confidence_events").insert(confidenceEvent);
      }

      // === LANGUAGE PERFORMANCE ===
      if (language) {
        const lang = language.toLowerCase().includes("hindi") ? "hindi" : "english";
        const { data: langPerf } = await supabase.from("language_performance")
          .select("*").eq("user_id", userId).eq("language", lang).maybeSingle();

        const prevCorrect = langPerf?.correct_answers || 0;
        const prevTotal2 = langPerf?.total_questions || 0;
        const newCorrect2 = prevCorrect + correctAnswers;
        const newTotal2 = prevTotal2 + totalAnswers;
        const newAccuracy = newTotal2 > 0 ? newCorrect2 / newTotal2 : 0;
        const oldAccuracy = prevTotal2 > 0 ? prevCorrect / prevTotal2 : 0;
        const improvement = oldAccuracy > 0 ? ((newAccuracy - oldAccuracy) / oldAccuracy) * 100 : 0;

        const langData = {
          user_id: userId,
          language: lang,
          total_questions: newTotal2,
          correct_answers: newCorrect2,
          avg_response_time_ms: Math.round((langPerf?.avg_response_time_ms || avgSpeedMs) * 0.7 + avgSpeedMs * 0.3),
          accuracy_rate: Math.round(newAccuracy * 10000) / 10000,
          improvement_pct: Math.round(improvement * 100) / 100,
          period_end: new Date().toISOString(),
        };

        if (langPerf) {
          await supabase.from("language_performance").update(langData).eq("id", langPerf.id);
        } else {
          await supabase.from("language_performance").insert({ ...langData, period_start: new Date().toISOString() });
        }
      }

      // === LOG RECALIBRATION ===
      await supabase.from("ai_recalibration_logs").insert({
        user_id: userId,
        recalibration_type: "session",
        old_profile: existing || {},
        new_profile: profileData,
        changes_summary: `Style: ${learningStyle} (${styleConfidence}% conf), Speed: ${speedPattern}, Tradeoff: ${tradeoff}, Fatigue: ${fatigueScore}`,
        triggered_by: "session_complete",
      });

      return jsonResponse({
        profile: profileData,
        fatigue: fatigueEvent ? { detected: true, score: fatigueScore, event: fatigueEvent } : { detected: false, score: fatigueScore },
        confidence: confidenceEvent ? { triggered: true, event: confidenceEvent } : { triggered: false },
        session_stats: { total: totalAnswers, correct: correctAnswers, accuracy: accuracyRate, avg_speed_ms: Math.round(avgSpeedMs) },
      });
    }

    if (action === "get_profile") {
      const [profileRes, fatigueRes, confRes, langRes, recalRes] = await Promise.all([
        supabase.from("cognitive_profiles").select("*").eq("user_id", userId).maybeSingle(),
        supabase.from("fatigue_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("confidence_events").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(10),
        supabase.from("language_performance").select("*").eq("user_id", userId),
        supabase.from("ai_recalibration_logs").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(5),
      ]);

      return jsonResponse({
        profile: profileRes.data,
        fatigue_history: fatigueRes.data || [],
        confidence_history: confRes.data || [],
        language_performance: langRes.data || [],
        recalibrations: recalRes.data || [],
      });
    }

    // Default: get_profile
    const { data: profile } = await supabase.from("cognitive_profiles").select("*").eq("user_id", userId).maybeSingle();
    return jsonResponse({ profile });

  } catch (e) {
    console.error("cognitive-profile-engine error:", e);
    return errorResponse(e instanceof Error ? e.message : "Unknown error", 500);
  }
});
