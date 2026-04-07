import { createClient } from "npm:@supabase/supabase-js@2";
import {
  authenticateRequest,
  handleCors,
  jsonResponse,
  errorResponse,
} from "../_shared/auth.ts";

/**
 * Today's Gains API — Full end-to-end
 *
 * Computes all daily reward metrics server-side:
 *   stabilityGain, riskReduction, rankChange, focusScore,
 *   focusStreak, studyMinutes, sessionsCount, weeklyData,
 *   topicsStudied, avgSessionDuration, bestSession,
 *   confidenceBreakdown, todayVsYesterday
 */

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const { userId, supabase } = await authenticateRequest(req);

    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const now = new Date();
    const todayStart = new Date(now);
    todayStart.setHours(0, 0, 0, 0);

    const yesterdayStart = new Date(todayStart);
    yesterdayStart.setDate(yesterdayStart.getDate() - 1);
    const yesterdayEnd = new Date(todayStart);
    yesterdayEnd.setMilliseconds(-1);

    const weekAgo = new Date(Date.now() - 7 * 86400000);

    // ── Parallel data fetches ──
    const [sessionsRes, topicsRes, weekRes, yesterdayRes, todayTopicsRes] = await Promise.all([
      // 1. Today's sessions
      adminClient
        .from("study_logs")
        .select("id, duration_minutes, confidence_level, topic_id, created_at, session_type")
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString())
        .order("created_at", { ascending: true }),

      // 2. All user topics (for risk calculation)
      adminClient
        .from("topics")
        .select("id, name, memory_strength, next_review, subject")
        .eq("user_id", userId),

      // 3. Last 7 days sessions (for weekly momentum + streak)
      adminClient
        .from("study_logs")
        .select("duration_minutes, confidence_level, created_at")
        .eq("user_id", userId)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: true }),

      // 4. Yesterday's sessions (for comparison)
      adminClient
        .from("study_logs")
        .select("duration_minutes, confidence_level")
        .eq("user_id", userId)
        .gte("created_at", yesterdayStart.toISOString())
        .lt("created_at", todayStart.toISOString()),

      // 5. Today's unique topics studied
      adminClient
        .from("study_logs")
        .select("topic_id")
        .eq("user_id", userId)
        .gte("created_at", todayStart.toISOString())
        .not("topic_id", "is", null),
    ]);

    const sessions = sessionsRes.data || [];
    const topics = topicsRes.data || [];
    const weekSessions = weekRes.data || [];
    const yesterdaySessions = yesterdayRes.data || [];
    const todayTopicIds = todayTopicsRes.data || [];

    // ── Core metrics ──
    const count = sessions.length;
    const totalMin = sessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);

    // Stability gain: sessions × 2.5, capped at 15
    const stabilityGain = Math.min(count * 2.5, 15);

    // Risk reduction: based on weak topics ratio
    const weakTopics = topics.filter((t: any) => (t.memory_strength ?? 0) < 0.4);
    const totalTopics = topics.length || 1;
    const riskReduction = Math.min(count * 3, Math.round((1 - weakTopics.length / totalTopics) * 100));

    // Rank change estimate
    const rankChange = Math.min(count * 1.5, 10);

    // Focus quality from confidence levels
    const confMap: Record<string, number> = { high: 100, medium: 70, low: 40 };
    const focusScores = sessions
      .filter((s: any) => s.confidence_level)
      .map((s: any) => confMap[s.confidence_level] || 50);
    const focusScore = focusScores.length > 0
      ? Math.round(focusScores.reduce((a: number, b: number) => a + b, 0) / focusScores.length)
      : 0;

    // ── 7-day weekly data ──
    const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const weeklyData: { day: string; value: number; sessions: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
      const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
      const daySessions = weekSessions.filter((s: any) => {
        const t = new Date(s.created_at).getTime();
        return t >= dayStart.getTime() && t <= dayEnd.getTime();
      });
      const mins = daySessions.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
      weeklyData.push({
        day: dayLabels[d.getDay()],
        value: mins,
        sessions: daySessions.length,
      });
    }

    // Focus streak: consecutive days (from today backwards) with sessions
    let focusStreak = 0;
    for (let i = 0; i < weeklyData.length; i++) {
      const idx = weeklyData.length - 1 - i;
      if (weeklyData[idx].value > 0) focusStreak++;
      else break;
    }

    // ── Extended metrics ──

    // Unique topics studied today
    const uniqueTopicIds = [...new Set(todayTopicIds.map((t: any) => t.topic_id))];
    const topicsStudied = uniqueTopicIds.length;

    // Topic names studied today
    const topicsStudiedNames = uniqueTopicIds
      .map((id) => {
        const found = topics.find((t: any) => t.id === id);
        return found ? { id: found.id, name: found.name, subject: found.subject } : null;
      })
      .filter(Boolean);

    // Average session duration
    const avgSessionDuration = count > 0 ? Math.round(totalMin / count) : 0;

    // Best (longest) session today
    const bestSession = sessions.length > 0
      ? Math.max(...sessions.map((s: any) => s.duration_minutes || 0))
      : 0;

    // Confidence breakdown
    const confidenceBreakdown = {
      high: sessions.filter((s: any) => s.confidence_level === "high").length,
      medium: sessions.filter((s: any) => s.confidence_level === "medium").length,
      low: sessions.filter((s: any) => s.confidence_level === "low").length,
      unrated: sessions.filter((s: any) => !s.confidence_level).length,
    };

    // Session types breakdown
    const sessionTypes: Record<string, number> = {};
    sessions.forEach((s: any) => {
      const type = s.session_type || "study";
      sessionTypes[type] = (sessionTypes[type] || 0) + 1;
    });

    // Today vs Yesterday comparison
    const yesterdayMin = yesterdaySessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
    const yesterdayCount = yesterdaySessions.length;
    const todayVsYesterday = {
      minutes_diff: totalMin - yesterdayMin,
      sessions_diff: count - yesterdayCount,
      minutes_change_pct: yesterdayMin > 0 ? Math.round(((totalMin - yesterdayMin) / yesterdayMin) * 100) : totalMin > 0 ? 100 : 0,
      trend: totalMin > yesterdayMin ? "up" : totalMin < yesterdayMin ? "down" : "same",
    };

    // Weak topics at risk (memory_strength < 0.4)
    const weakTopicsList = weakTopics
      .sort((a: any, b: any) => (a.memory_strength ?? 0) - (b.memory_strength ?? 0))
      .slice(0, 5)
      .map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: t.subject,
        memory_strength: t.memory_strength ?? 0,
        overdue: t.next_review ? new Date(t.next_review) < now : false,
      }));

    // Session timeline (for detailed view)
    const sessionTimeline = sessions.map((s: any) => ({
      id: s.id,
      duration_minutes: s.duration_minutes || 0,
      confidence_level: s.confidence_level || "unrated",
      session_type: s.session_type || "study",
      topic_id: s.topic_id,
      created_at: s.created_at,
    }));

    // ── Weekly summary stats ──
    const weekTotalMin = weekSessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
    const weekTotalSessions = weekSessions.length;
    const weekAvgDaily = Math.round(weekTotalMin / 7);

    // ── Build response ──
    const response = {
      success: true,
      data: {
        // Core 4 metrics (displayed in cards)
        stability_gain: parseFloat(stabilityGain.toFixed(1)),
        risk_reduction: riskReduction,
        rank_change: parseFloat(rankChange.toFixed(1)),
        focus_score: focusScore,

        // Session summary
        sessions_count: count,
        study_minutes: totalMin,
        avg_session_duration: avgSessionDuration,
        best_session_minutes: bestSession,

        // Streak & momentum
        focus_streak: focusStreak,
        weekly_data: weeklyData,

        // Topics
        topics_studied_count: topicsStudied,
        topics_studied: topicsStudiedNames,
        weak_topics_count: weakTopics.length,
        total_topics_count: topics.length,
        weak_topics: weakTopicsList,

        // Breakdowns
        confidence_breakdown: confidenceBreakdown,
        session_types: sessionTypes,

        // Comparison
        today_vs_yesterday: todayVsYesterday,

        // Timeline
        session_timeline: sessionTimeline,

        // Weekly rollup
        weekly_summary: {
          total_minutes: weekTotalMin,
          total_sessions: weekTotalSessions,
          avg_daily_minutes: weekAvgDaily,
        },

        // Metadata
        computed_at: now.toISOString(),
        date: todayStart.toISOString().split("T")[0],
      },
    };

    return jsonResponse(response);
  } catch (err) {
    if (err instanceof Response) return err;
    console.error("[todays-gains] Error:", err);
    return errorResponse("Failed to compute today's gains", 500);
  }
});
