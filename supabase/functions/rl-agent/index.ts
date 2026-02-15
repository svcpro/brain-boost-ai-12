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
    const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

    // ── Gather all user-specific signals ──
    const [logsRes, plansRes, twinRes, topicsRes, strategiesRes, predictionsRes] = await Promise.all([
      supabase.from("study_logs").select("topic_id, duration_minutes, confidence_level, study_mode, created_at")
        .eq("user_id", userId).gte("created_at", thirtyDaysAgo).order("created_at", { ascending: true }),
      supabase.from("plan_quality_logs").select("rl_signals, overall_completion_rate, created_at")
        .eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("cognitive_twins").select("optimal_study_hour, optimal_session_duration, fatigue_threshold_minutes, avg_decay_rate, avg_learning_speed")
        .eq("user_id", userId).maybeSingle(),
      supabase.from("topics").select("id, name, memory_strength, last_revision_date, subject_id")
        .eq("user_id", userId).is("deleted_at", null),
      supabase.from("meta_learning_strategies").select("strategy_type, strategy_params, performance_score")
        .eq("user_id", userId).eq("is_active", true),
      supabase.from("model_predictions").select("is_correct, confidence, created_at")
        .eq("user_id", userId).gte("created_at", thirtyDaysAgo),
    ]);

    const logs = logsRes.data || [];
    const plans = plansRes.data || [];
    const twin = twinRes.data;
    const topics = topicsRes.data || [];
    const strategies = strategiesRes.data || [];
    const predictions = predictionsRes.data || [];

    // ── 1. OPTIMAL TIMING: learn best hour + day patterns ──
    const hourBuckets: Record<number, { total: number; highConf: number; totalMin: number }> = {};
    const dayBuckets: Record<number, { total: number; highConf: number }> = {};

    for (const log of logs) {
      const d = new Date(log.created_at);
      const h = d.getHours();
      const day = d.getDay();
      if (!hourBuckets[h]) hourBuckets[h] = { total: 0, highConf: 0, totalMin: 0 };
      hourBuckets[h].total++;
      hourBuckets[h].totalMin += log.duration_minutes || 0;
      if (log.confidence_level === "high") hourBuckets[h].highConf++;

      if (!dayBuckets[day]) dayBuckets[day] = { total: 0, highConf: 0 };
      dayBuckets[day].total++;
      if (log.confidence_level === "high") dayBuckets[day].highConf++;
    }

    // Score each hour: effectiveness rate weighted by volume
    const hourScores = Object.entries(hourBuckets)
      .map(([h, b]) => ({
        hour: Number(h),
        score: b.total >= 2 ? (b.highConf / b.total) * 0.7 + Math.min(1, b.total / 20) * 0.3 : 0,
        sessions: b.total,
      }))
      .sort((a, b) => b.score - a.score);

    const bestHours = hourScores.slice(0, 3).map(h => h.hour);
    const worstHours = hourScores.filter(h => h.sessions >= 2).slice(-2).map(h => h.hour);

    const dayScores = Object.entries(dayBuckets)
      .map(([d, b]) => ({
        day: Number(d),
        score: b.total >= 2 ? (b.highConf / b.total) * 0.7 + Math.min(1, b.total / 10) * 0.3 : 0,
        sessions: b.total,
      }))
      .sort((a, b) => b.score - a.score);

    const bestDays = dayScores.slice(0, 3).map(d => d.day);

    // ── 2. OPTIMAL SEQUENCE: which topic ordering maximizes retention ──
    // Build per-topic effectiveness from logs
    const topicEffectiveness: Record<string, { reviews: number; highConf: number; avgDuration: number; lastSeen: string }> = {};
    for (const log of logs) {
      if (!log.topic_id) continue;
      if (!topicEffectiveness[log.topic_id]) topicEffectiveness[log.topic_id] = { reviews: 0, highConf: 0, avgDuration: 0, lastSeen: "" };
      const te = topicEffectiveness[log.topic_id];
      te.reviews++;
      if (log.confidence_level === "high") te.highConf++;
      te.avgDuration = ((te.avgDuration * (te.reviews - 1)) + (log.duration_minutes || 0)) / te.reviews;
      te.lastSeen = log.created_at;
    }

    // Priority score: weak memory + low effectiveness + stale = high priority
    const now = Date.now();
    const topicPriorities = topics.map(t => {
      const eff = topicEffectiveness[t.id];
      const strength = Number(t.memory_strength);
      const staleness = t.last_revision_date ? (now - new Date(t.last_revision_date).getTime()) / 86400000 : 30;
      const effScore = eff ? (eff.reviews > 0 ? eff.highConf / eff.reviews : 0) : 0;

      // RL reward signal: prioritize weak, stale, low-effectiveness topics
      const priority = (100 - strength) * 0.4 + Math.min(staleness, 30) * 0.35 + (1 - effScore) * 25 * 0.25;

      return {
        topic_id: t.id,
        topic_name: t.name,
        subject_id: t.subject_id,
        memory_strength: strength,
        staleness_days: Math.round(staleness),
        effectiveness: Math.round(effScore * 100),
        priority_score: Math.round(priority * 100) / 100,
        recommended_duration: eff
          ? Math.round(Math.max(10, Math.min(45, eff.avgDuration * (strength < 40 ? 1.3 : 1))))
          : twin?.optimal_session_duration || 25,
      };
    }).sort((a, b) => b.priority_score - a.priority_score);

    // ── 3. OPTIMAL INTENSITY: session length + break patterns ──
    // Analyze which session durations produce best outcomes
    const durationBuckets: Record<string, { total: number; highConf: number }> = {};
    for (const log of logs) {
      const bucket = log.duration_minutes <= 15 ? "short" : log.duration_minutes <= 30 ? "medium" : log.duration_minutes <= 45 ? "long" : "extended";
      if (!durationBuckets[bucket]) durationBuckets[bucket] = { total: 0, highConf: 0 };
      durationBuckets[bucket].total++;
      if (log.confidence_level === "high") durationBuckets[bucket].highConf++;
    }

    const intensityScores = Object.entries(durationBuckets)
      .map(([bucket, b]) => ({
        bucket,
        effectiveness: b.total >= 3 ? Math.round((b.highConf / b.total) * 100) : null,
        sessions: b.total,
      }))
      .filter(b => b.effectiveness !== null)
      .sort((a, b) => (b.effectiveness ?? 0) - (a.effectiveness ?? 0));

    const bestIntensity = intensityScores[0]?.bucket || "medium";

    // Fatigue detection: sessions with declining confidence over time in same day
    const sessionsByDay: Record<string, typeof logs> = {};
    for (const log of logs) {
      const dayKey = log.created_at.slice(0, 10);
      if (!sessionsByDay[dayKey]) sessionsByDay[dayKey] = [];
      sessionsByDay[dayKey].push(log);
    }

    let fatigueAfterMinutes = twin?.fatigue_threshold_minutes || 90;
    let fatigueSignals = 0;
    for (const [, daySessions] of Object.entries(sessionsByDay)) {
      if (daySessions.length < 3) continue;
      let cumMin = 0;
      let confDropped = false;
      for (let i = 0; i < daySessions.length; i++) {
        cumMin += daySessions[i].duration_minutes || 0;
        if (i >= 2 && daySessions[i].confidence_level !== "high" && daySessions[i - 1].confidence_level === "high") {
          confDropped = true;
          fatigueAfterMinutes = Math.min(fatigueAfterMinutes, cumMin);
        }
      }
      if (confDropped) fatigueSignals++;
    }

    // ── 4. RL REWARD SIGNAL from plan quality ──
    const avgPlanCompletion = plans.length > 0
      ? plans.reduce((s, p) => s + (Number(p.overall_completion_rate) || 0), 0) / plans.length
      : 0;

    const rlRewardSignals = plans.flatMap(p => {
      const signals = p.rl_signals as any;
      if (!signals) return [];
      return Array.isArray(signals) ? signals : [signals];
    });

    // Prediction accuracy as reward
    const correctPreds = predictions.filter(p => p.is_correct === true).length;
    const predAccuracy = predictions.length > 0 ? correctPreds / predictions.length : 0;

    // ── 5. COMPOSE POLICY ──
    const policy = {
      timing: {
        best_hours: bestHours,
        worst_hours: worstHours,
        best_days: bestDays,
        optimal_start_hour: bestHours[0] ?? twin?.optimal_study_hour ?? 9,
        confidence: hourScores.length >= 3 ? "high" : hourScores.length >= 1 ? "medium" : "low",
      },
      sequence: {
        priority_topics: topicPriorities.slice(0, 10),
        strategy: topicPriorities.length > 0 && topicPriorities[0].memory_strength < 30
          ? "rescue_first" : "interleaved",
        interleave_subjects: true,
      },
      intensity: {
        best_bucket: bestIntensity,
        recommended_session_minutes: bestIntensity === "short" ? 15 : bestIntensity === "medium" ? 25 : bestIntensity === "long" ? 35 : 45,
        fatigue_threshold_minutes: fatigueAfterMinutes,
        fatigue_signals_detected: fatigueSignals,
        max_daily_minutes: Math.min(180, fatigueAfterMinutes * 1.5),
      },
      reward_signals: {
        plan_completion_rate: Math.round(avgPlanCompletion * 100),
        prediction_accuracy: Math.round(predAccuracy * 100),
        total_sessions_analyzed: logs.length,
        rl_signal_count: rlRewardSignals.length,
      },
    };

    // ── Store RL policy as meta_learning_strategy ──
    await supabase.from("meta_learning_strategies").update({ is_active: false })
      .eq("user_id", userId).eq("strategy_type", "rl_policy");

    const { data: prevPolicy } = await supabase.from("meta_learning_strategies")
      .select("iteration").eq("user_id", userId).eq("strategy_type", "rl_policy")
      .order("iteration", { ascending: false }).limit(1).maybeSingle();

    const iteration = (prevPolicy?.iteration || 0) + 1;

    await supabase.from("meta_learning_strategies").insert({
      user_id: userId,
      strategy_type: "rl_policy",
      strategy_params: policy,
      performance_score: (avgPlanCompletion * 0.5 + predAccuracy * 0.5),
      is_active: true,
      iteration,
    });

    return new Response(JSON.stringify({
      policy,
      iteration,
      data_points: logs.length,
      topics_ranked: topicPriorities.length,
    }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("rl-agent error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
