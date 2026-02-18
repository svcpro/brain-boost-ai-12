import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { format, formatDistanceToNow } from "https://esm.sh/date-fns@3";
import { resolveTemplate, sanitizeMessage } from "../_shared/variableResolver.ts";

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

    const { user_ids, template_message } = await req.json();
    if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
      throw new Error("user_ids array required");
    }

    // Fetch all data in parallel using service role (bypasses RLS)
    const sevenDaysAgo = new Date(Date.now() - 7 * 86400000).toISOString();

    const [profilesRes, topicsRes, logsRes, missionsRes, twinsRes, examsRes] = await Promise.all([
      supabase.from("profiles")
        .select("id, display_name, exam_type, exam_date, created_at, last_brain_update_at, daily_study_goal_minutes")
        .in("id", user_ids),
      supabase.from("topics")
        .select("user_id, name, memory_strength, last_revision_date, next_predicted_drop_date")
        .in("user_id", user_ids)
        .is("deleted_at", null)
        .order("memory_strength", { ascending: true }),
      supabase.from("study_logs")
        .select("user_id, duration_minutes, confidence_level, created_at, topic_id")
        .in("user_id", user_ids)
        .gte("created_at", sevenDaysAgo),
      supabase.from("brain_missions")
        .select("user_id, title, mission_type, reward_type, reward_value, priority, expires_at")
        .in("user_id", user_ids)
        .eq("status", "active")
        .limit(100),
      supabase.from("cognitive_twins")
        .select("user_id, brain_evolution_score, learning_efficiency_score, optimal_study_hour")
        .in("user_id", user_ids)
        .order("computed_at", { ascending: false }),
      supabase.from("exam_results")
        .select("user_id, score, total_questions")
        .in("user_id", user_ids)
        .order("created_at", { ascending: false })
        .limit(200),
    ]);

    const profiles = profilesRes.data || [];
    const topics = topicsRes.data || [];
    const studyLogs = logsRes.data || [];
    const missions = missionsRes.data || [];
    const twins = twinsRes.data || [];
    const exams = examsRes.data || [];

    // Group by user
    const topicsByUser: Record<string, any[]> = {};
    topics.forEach((t: any) => { (topicsByUser[t.user_id] ??= []).push(t); });

    const logsByUser: Record<string, any[]> = {};
    studyLogs.forEach((l: any) => { (logsByUser[l.user_id] ??= []).push(l); });

    const missionsByUser: Record<string, any> = {};
    missions.forEach((m: any) => { if (!missionsByUser[m.user_id]) missionsByUser[m.user_id] = m; });

    const twinByUser: Record<string, any> = {};
    twins.forEach((t: any) => { if (!twinByUser[t.user_id]) twinByUser[t.user_id] = t; });

    const examsByUser: Record<string, any[]> = {};
    exams.forEach((e: any) => { (examsByUser[e.user_id] ??= []).push(e); });

    const result: Record<string, Record<string, string>> = {};

    for (const profile of profiles) {
      const uid = profile.id;
      const uTopics = topicsByUser[uid] || [];
      const uLogs = logsByUser[uid] || [];
      const uMission = missionsByUser[uid];
      const uTwin = twinByUser[uid];
      const uExams = examsByUser[uid] || [];

      const totalTopics = uTopics.length;
      const weakestTopic = uTopics[0];
      const atRiskTopics = uTopics.filter((t: any) => (t.memory_strength || 0) < 50);
      const avgScore = totalTopics > 0 ? Math.round(uTopics.reduce((s: number, t: any) => s + (t.memory_strength || 0), 0) / totalTopics) : 0;
      const totalMinutes = uLogs.reduce((s: number, l: any) => s + (l.duration_minutes || 0), 0);
      const totalSessions = uLogs.length;
      const sortedLogs = [...uLogs].sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      const lastLog = sortedLogs[0];
      const daysSinceLastStudy = lastLog ? Math.floor((Date.now() - new Date(lastLog.created_at).getTime()) / 86400000) : 0;
      const lastStudiedStr = lastLog ? formatDistanceToNow(new Date(lastLog.created_at), { addSuffix: true }) : "never";

      const revisionCount = weakestTopic ? uLogs.filter((l: any) => l.topic_id === weakestTopic?.id).length : 0;
      const brainScore = uTwin?.brain_evolution_score ? Math.round(uTwin.brain_evolution_score * 100) : avgScore;
      const hoursSinceUpdate = profile.last_brain_update_at
        ? Math.round((Date.now() - new Date(profile.last_brain_update_at).getTime()) / 3600000)
        : 48;

      const examAccuracy = uExams.length > 0
        ? Math.round(uExams.reduce((s: number, e: any) => s + (e.score / e.total_questions) * 100, 0) / uExams.length)
        : 0;

      const daysLeft = profile.exam_date
        ? Math.max(0, Math.ceil((new Date(profile.exam_date).getTime() - Date.now()) / 86400000))
        : 0;

      const topImprovement = uTopics.length > 1 ? uTopics[uTopics.length - 1]?.name : "N/A";
      const weakArea = weakestTopic?.name || "N/A";

      result[uid] = {
        name: profile.display_name || "there",
        topic: weakestTopic?.name || "your topics",
        memory_score: `${weakestTopic?.memory_strength ?? avgScore}`,
        last_studied: lastStudiedStr,
        days_since_review: String(daysSinceLastStudy),
        revision_count: String(revisionCount),
        predicted_drop_date: weakestTopic?.next_predicted_drop_date
          ? format(new Date(weakestTopic.next_predicted_drop_date), "MMM d")
          : "soon",
        decay_rate: (weakestTopic?.memory_strength || 0) < 30 ? "fast" : "moderate",
        urgency_level: (weakestTopic?.memory_strength || 0) < 30 ? "HIGH" : "MEDIUM",
        at_risk_count: String(atRiskTopics.length),
        top_risk_topic: atRiskTopics[0]?.name || "N/A",
        weakest_score: `${weakestTopic?.memory_strength ?? 0}`,
        total_topics: String(totalTopics),
        avg_score: `${avgScore}`,
        streak_days: String(totalSessions > 0 ? Math.min(totalSessions, 7) : 0),
        milestone: `${Math.min(totalSessions, 7)}-day streak`,
        total_sessions: String(totalSessions),
        best_streak: String(totalSessions),
        rank: "N/A",
        hours_remaining: "6h",
        last_study_time: lastLog ? format(new Date(lastLog.created_at), "h:mm a") : "N/A",
        streak_freeze_count: "0",
        hours_since_update: `${hoursSinceUpdate}h`,
        pending_topics: String(atRiskTopics.length),
        brain_score: `${brainScore}/100`,
        topics_due: String(atRiskTopics.length),
        today_topics_count: String(Math.min(atRiskTopics.length, 5)),
        focus_topic: weakestTopic?.name || "your focus area",
        predicted_rank: "Top 10%",
        mission_title: uMission?.title || "Complete a study session",
        mission_type: uMission?.mission_type || "review",
        reward: uMission?.reward_value ? `${uMission.reward_value} XP` : "🏆 Badge",
        deadline: uMission?.expires_at ? formatDistanceToNow(new Date(uMission.expires_at)) : "48h",
        difficulty: uMission?.priority || "Medium",
        topics_studied: String(new Set(uLogs.map((l: any) => l.topic_id)).size),
        hours_studied: `${(totalMinutes / 60).toFixed(1)}h`,
        accuracy: `${examAccuracy}%`,
        rank_change: "+0",
        top_improvement: topImprovement,
        weak_area: weakArea,
        exam_name: profile.exam_type || "your exam",
        days_left: String(daysLeft),
        readiness_score: `${avgScore}%`,
        topics_remaining: String(atRiskTopics.length),
        daily_target: `${Math.max(1, Math.ceil(atRiskTopics.length / Math.max(daysLeft, 1)))} topics`,
        fatigue_score: totalMinutes > 120 ? "HIGH" : "LOW",
        session_duration: `${(totalMinutes / Math.max(totalSessions, 1)).toFixed(0)} min`,
        break_suggestion: totalMinutes > 120 ? "Take a 15-min break" : "Keep going!",
        optimal_study_time: uTwin?.optimal_study_hour ? `${uTwin.optimal_study_hour}:00` : "morning",
        plan_name: "Pro",
        days_remaining: "30",
        expiry_date: format(new Date(Date.now() + 30 * 86400000), "MMM d"),
        renewal_price: "₹499/mo",
        discount_code: "RENEW20",
        exam_type: profile.exam_type || "NEET",
        first_topic: uTopics[uTopics.length - 1]?.name || "Biology Basics",
        community_count: "2,400+",
        inactive_days: String(daysSinceLastStudy),
        streak_lost: daysSinceLastStudy > 1 ? `${Math.min(totalSessions, 7)}-day streak` : "none",
        topics_decaying: String(atRiskTopics.length),
        memory_drop_pct: `${Math.max(0, 100 - avgScore)}`,
        friends_active: "friends are studying today",
        new_rank: "N/A",
        old_rank: "N/A",
        top_score: "N/A",
        percentile: "Top 10%",
        offer_name: "Special Offer",
        discount_pct: "30%",
        valid_until: format(new Date(Date.now() + 7 * 86400000), "MMM d"),
        promo_code: "BRAIN30",
        current_plan: "Free",
        upgrade_plan: "Pro",
        price: "₹299/mo",
        savings_pct: "40%",
        features_unlocked: "AI Brain, Unlimited Exams, Priority Support",
        referral_code: `REF${uid.slice(0, 6).toUpperCase()}`,
        reward_amount: "₹100 credit",
        friends_joined: "0",
        referral_link: "https://brain-boost-ai-12.lovable.app/refer",
        comeback_offer: "7 days Pro free",
        app_url: "https://brain-boost-ai-12.lovable.app",
      };
    }

    // If template_message provided, return resolved messages per user with UVR validation
    if (template_message) {
      const resolved: Record<string, string> = {};
      const validation_warnings: Record<string, string[]> = {};
      for (const [uid, vars] of Object.entries(result)) {
        const { resolved: msg, warnings } = resolveTemplate(template_message, vars);
        // Final sanitization pass
        const { cleaned, issues } = sanitizeMessage(msg);
        resolved[uid] = cleaned;
        if (warnings.length > 0 || issues.length > 0) {
          validation_warnings[uid] = [...warnings, ...issues];
        }
      }
      return new Response(JSON.stringify({ success: true, resolved_messages: resolved, variables: result, validation_warnings }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, variables: result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("resolve-whatsapp-variables error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
