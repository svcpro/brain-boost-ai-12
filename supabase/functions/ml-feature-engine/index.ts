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
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

    // Fetch all relevant data in parallel
    const [topicsRes, logsRes, recentLogsRes, examsRes, scoresRes] = await Promise.all([
      supabase.from("topics").select("id, memory_strength, last_revision_date, created_at").eq("user_id", userId).is("deleted_at", null),
      supabase.from("study_logs").select("duration_minutes, created_at, confidence_level, study_mode").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", userId).gte("created_at", fourteenDaysAgo.toISOString()),
      supabase.from("exam_results").select("score, total_questions, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(20),
      supabase.from("memory_scores").select("score, recorded_at, topic_id").eq("user_id", userId).order("recorded_at", { ascending: false }).limit(200),
    ]);

    const topics = topicsRes.data || [];
    const allLogs = logsRes.data || [];
    const recentLogs = recentLogsRes.data || [];
    const exams = examsRes.data || [];
    const memScores = scoresRes.data || [];

    // === MEMORY FEATURES ===
    const avgTimeSinceRevision = topics.length > 0
      ? topics.reduce((sum, t) => {
          const lastRev = t.last_revision_date ? new Date(t.last_revision_date) : new Date(t.created_at);
          return sum + (now.getTime() - lastRev.getTime()) / (1000 * 60 * 60);
        }, 0) / topics.length
      : 0;

    const revisionFrequency = allLogs.length > 0 && allLogs.length > 1
      ? allLogs.length / Math.max(1, (now.getTime() - new Date(allLogs[allLogs.length - 1].created_at).getTime()) / (1000 * 60 * 60 * 24))
      : 0;

    const highConfCount = allLogs.filter(l => l.confidence_level === "high").length;
    const recallSuccessRate = allLogs.length > 0 ? highConfCount / allLogs.length : 0;

    // Memory decay slope: average change in memory scores over time
    const topicScoreChanges: number[] = [];
    const scoresByTopic = new Map<string, { score: number; time: number }[]>();
    for (const s of memScores) {
      if (!scoresByTopic.has(s.topic_id)) scoresByTopic.set(s.topic_id, []);
      scoresByTopic.get(s.topic_id)!.push({ score: Number(s.score), time: new Date(s.recorded_at).getTime() });
    }
    for (const [, scores] of scoresByTopic) {
      if (scores.length >= 2) {
        const sorted = scores.sort((a, b) => a.time - b.time);
        const slope = (sorted[sorted.length - 1].score - sorted[0].score) / Math.max(1, (sorted[sorted.length - 1].time - sorted[0].time) / (1000 * 60 * 60));
        topicScoreChanges.push(slope);
      }
    }
    const memoryDecaySlope = topicScoreChanges.length > 0
      ? topicScoreChanges.reduce((s, v) => s + v, 0) / topicScoreChanges.length
      : 0;

    // === BEHAVIOR FEATURES ===
    // Study consistency: how many of the last 14 days had study sessions
    const studyDays = new Set(recentLogs.map(l => new Date(l.created_at).toDateString()));
    const studyConsistency = studyDays.size / 14 * 100;

    // Engagement: sessions per day (last 7 days)
    const last7dLogs = recentLogs.filter(l => new Date(l.created_at) >= sevenDaysAgo);
    const engagementScore = last7dLogs.length / 7 * 100;

    // Average session duration
    const avgSessionDuration = allLogs.length > 0
      ? allLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0) / allLogs.length
      : 0;

    // App open frequency (approximated by sessions per day)
    const appOpenFrequency = revisionFrequency;

    // Response latency (avg time between sessions in hours)
    let responseLatency = 0;
    if (allLogs.length >= 2) {
      let totalGap = 0;
      for (let i = 0; i < Math.min(allLogs.length - 1, 20); i++) {
        totalGap += (new Date(allLogs[i].created_at).getTime() - new Date(allLogs[i + 1].created_at).getTime()) / (1000 * 60 * 60);
      }
      responseLatency = totalGap / Math.min(allLogs.length - 1, 20);
    }

    // === BURNOUT FEATURES ===
    const last24hLogs = allLogs.filter(l => new Date(l.created_at) >= oneDayAgo);
    const hoursStudied24h = last24hLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;
    const hoursStudied7d = last7dLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0) / 60;

    // Consecutive long sessions (>45 min each)
    let consecutiveLong = 0;
    for (const l of allLogs) {
      if ((l.duration_minutes || 0) >= 45) consecutiveLong++;
      else break;
    }

    // Fatigue indicator: combined signal
    const fatigueIndicator = Math.min(100, (
      (hoursStudied24h > 4 ? 30 : hoursStudied24h > 2 ? 15 : 0) +
      (consecutiveLong >= 3 ? 30 : consecutiveLong >= 2 ? 15 : 0) +
      (avgSessionDuration > 60 ? 20 : avgSessionDuration > 40 ? 10 : 0) +
      (hoursStudied7d > 25 ? 20 : hoursStudied7d > 15 ? 10 : 0)
    ));

    // Burnout risk score
    const burnoutRiskScore = Math.min(100, fatigueIndicator * 0.6 + (100 - studyConsistency) * 0.2 + (responseLatency < 2 ? 20 : 0));

    // === EXAM FEATURES ===
    const avgExamScore = exams.length > 0
      ? exams.reduce((s, e) => s + (e.score / Math.max(1, e.total_questions)) * 100, 0) / exams.length
      : 0;

    // Rank trajectory slope
    const { data: rankHistory } = await supabase
      .from("rank_predictions")
      .select("predicted_rank, recorded_at")
      .eq("user_id", userId)
      .order("recorded_at", { ascending: true })
      .limit(10);

    let rankTrajectory = 0;
    if (rankHistory && rankHistory.length >= 2) {
      const first = rankHistory[0];
      const last = rankHistory[rankHistory.length - 1];
      const daysDiff = (new Date(last.recorded_at).getTime() - new Date(first.recorded_at).getTime()) / (1000 * 60 * 60 * 24);
      rankTrajectory = daysDiff > 0 ? (first.predicted_rank - last.predicted_rank) / daysDiff : 0; // positive = improving
    }

    // === LEARNING FEATURES ===
    // Learning velocity: topics added per day (last 14 days)
    const recentTopics = topics.filter(t => new Date(t.created_at) >= fourteenDaysAgo);
    const learningVelocity = recentTopics.length / 14;

    // Knowledge stability: % of topics with memory_strength > 60
    const stableTopics = topics.filter(t => Number(t.memory_strength) > 60).length;
    const knowledgeStability = topics.length > 0 ? (stableTopics / topics.length) * 100 : 0;

    // === UPSERT FEATURES ===
    const features = {
      user_id: userId,
      avg_time_since_revision_hours: Math.round(avgTimeSinceRevision * 100) / 100,
      avg_revision_frequency: Math.round(revisionFrequency * 100) / 100,
      recall_success_rate: Math.round(recallSuccessRate * 100) / 100,
      memory_decay_slope: Math.round(memoryDecaySlope * 1000) / 1000,
      study_consistency_score: Math.round(studyConsistency * 100) / 100,
      engagement_score: Math.round(engagementScore * 100) / 100,
      fatigue_indicator: Math.round(fatigueIndicator * 100) / 100,
      response_latency_score: Math.round(responseLatency * 100) / 100,
      avg_session_duration_minutes: Math.round(avgSessionDuration * 100) / 100,
      app_open_frequency: Math.round(appOpenFrequency * 100) / 100,
      subject_strength_score: Math.round(avgExamScore * 100) / 100,
      rank_trajectory_slope: Math.round(rankTrajectory * 1000) / 1000,
      learning_velocity: Math.round(learningVelocity * 100) / 100,
      knowledge_stability: Math.round(knowledgeStability * 100) / 100,
      burnout_risk_score: Math.round(burnoutRiskScore * 100) / 100,
      consecutive_long_sessions: consecutiveLong,
      hours_studied_last_24h: Math.round(hoursStudied24h * 100) / 100,
      hours_studied_last_7d: Math.round(hoursStudied7d * 100) / 100,
      computed_at: now.toISOString(),
    };

    // Check if user_features row exists
    const { data: existing } = await supabase
      .from("user_features")
      .select("id")
      .eq("user_id", userId)
      .maybeSingle();

    if (existing) {
      await supabase.from("user_features").update(features).eq("user_id", userId);
    } else {
      await supabase.from("user_features").insert(features);
    }

    // Log the computation as a training event
    const startTime = Date.now();
    await supabase.from("ml_training_logs").insert({
      model_name: "feature_engine",
      model_version: "v1",
      training_type: "incremental",
      status: "completed",
      completed_at: new Date().toISOString(),
      training_data_size: allLogs.length + topics.length,
      metrics: {
        features_computed: Object.keys(features).length - 2, // exclude user_id and computed_at
        data_points: allLogs.length,
        topics_analyzed: topics.length,
      },
      triggered_by: "system",
    });

    return new Response(JSON.stringify({ features, status: "computed" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("ml-feature-engine error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
