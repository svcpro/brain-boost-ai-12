import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key, api-key",
};

/* ─── Safe zone target rank per exam ─── */
const SAFE_ZONE_MAP: Record<string, [number, number]> = {
  "SSC CGL": [1000, 5000], "IBPS PO": [500, 2000], "SBI PO": [400, 1500],
  "RRB NTPC": [2000, 8000], "RRB Group D": [5000, 15000],
  NDA: [200, 400], CDS: [150, 350], "State PSC": [100, 500],
  "UGC NET": [1000, 3000], UPSC: [100, 300], SSC: [1000, 3000],
  "JEE Advanced": [200, 500], "JEE Main": [800, 1500],
  NEET: [1560, 2580], "NEET UG": [1560, 2580],
  CAT: [300, 800], GATE: [500, 1200], CLAT: [200, 600],
  "CUET UG": [500, 2000], BITSAT: [100, 400], "NIFT Entrance": [100, 350],
  XAT: [200, 600],
  SAT: [50, 200], GRE: [100, 500], GMAT: [80, 300],
  IELTS: [50, 150], TOEFL: [50, 150], USMLE: [100, 500],
  CFA: [200, 800], "CPA Exam": [150, 500], MCAT: [100, 400], ACCA: [200, 600],
  Boards: [100, 240],
};
const DEFAULT_SAFE_ZONE: [number, number] = [1000, 3000];

const CANDIDATE_MAP: Record<string, number> = {
  "SSC CGL": 3000000, "IBPS PO": 800000, "SBI PO": 600000,
  "RRB NTPC": 12000000, "RRB Group D": 18000000,
  NDA: 500000, CDS: 400000, "State PSC": 800000, "UGC NET": 1200000,
  UPSC: 1200000, SSC: 3000000,
  "JEE Advanced": 250000, "JEE Main": 1200000,
  NEET: 2400000, "NEET UG": 2400000,
  CAT: 300000, GATE: 900000, CLAT: 70000,
  "CUET UG": 1500000, BITSAT: 200000, "NIFT Entrance": 50000, XAT: 100000,
  SAT: 2200000, GRE: 700000, GMAT: 200000,
  IELTS: 3500000, TOEFL: 2000000, USMLE: 80000,
  CFA: 250000, "CPA Exam": 150000, MCAT: 90000, ACCA: 500000,
  Boards: 5000000,
};

const ZONE_CONFIG = {
  topper: { emoji: "👑", label: "TOPPER ZONE", sub: "You're dominating! Stay consistent.", gradient: "linear-gradient(135deg, #00e676, #00c853, #69f0ae)", text: "#00e676", border: "rgba(0,230,118,0.4)" },
  comfortable: { emoji: "🎯", label: "COMFORTABLE", sub: "Strong preparation! Push harder to top.", gradient: "linear-gradient(135deg, #00bcd4, #26c6da, #4dd0e1)", text: "#00bcd4", border: "rgba(0,188,212,0.4)" },
  safe: { emoji: "✅", label: "SAFE ZONE", sub: "On track! Keep the momentum going.", gradient: "linear-gradient(135deg, #7c4dff, #651fff, #b388ff)", text: "#7c4dff", border: "rgba(124,77,255,0.4)" },
  borderline: { emoji: "⚠️", label: "BORDERLINE", sub: "Danger zone! Increase effort NOW.", gradient: "linear-gradient(135deg, #ff9100, #ff6d00, #ffab40)", text: "#ff9100", border: "rgba(255,145,0,0.5)" },
  at_risk: { emoji: "🚨", label: "AT RISK", sub: "Critical! Start studying immediately!", gradient: "linear-gradient(135deg, #ff1744, #d50000, #ff5252)", text: "#ff1744", border: "rgba(255,23,68,0.6)" },
};

/* ─── Helpers ─── */
interface ActivityMetrics {
  total_study_minutes: number;
  total_sessions: number;
  avg_memory_strength: number;
  topics_covered: number;
  topics_strong: number;
  topics_medium: number;
  topics_weak: number;
  streak_days: number;
  overall_health: number;
  days_active: number;
}

function computeActivityScore(m: ActivityMetrics): number {
  const studyTimeScore = Math.min(100, (m.total_study_minutes / 500) * 100);
  const coverageScore = m.topics_covered > 0 ? (m.topics_strong / m.topics_covered) * 100 : 0;
  const consistencyScore = Math.min(100, (m.days_active / 30) * 100);
  const streakScore = Math.min(100, (m.streak_days / 14) * 100);
  const healthScore = m.overall_health;
  const sessionScore = Math.min(100, (m.total_sessions / 50) * 100);
  return Math.round(
    studyTimeScore * 0.25 + coverageScore * 0.20 + consistencyScore * 0.20 +
    streakScore * 0.10 + healthScore * 0.15 + sessionScore * 0.10
  );
}

function activityToPredictedRank(score: number, currentRank: number, safeZone: [number, number]): [number, number] {
  const curve = Math.pow(score / 100, 0.7);
  const predictedBest = Math.max(1, Math.round(currentRank - (currentRank - safeZone[0]) * curve));
  const predictedWorst = Math.max(predictedBest, Math.round(currentRank - (currentRank - safeZone[1]) * curve));
  return [predictedBest, predictedWorst];
}

/* ─── Auth resolver ─── */
async function resolveUser(req: Request) {
  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const supabaseKey = Deno.env.get("SUPABASE_ANON_KEY")!;
  const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  // Try JWT
  const authHeader = req.headers.get("Authorization");
  if (authHeader?.startsWith("Bearer ey")) {
    const client = createClient(supabaseUrl, supabaseKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await client.auth.getUser();
    if (user) return { userId: user.id, client, serviceClient: createClient(supabaseUrl, serviceKey) };
  }

  // Try API key
  const apiKey = req.headers.get("x-api-key") || req.headers.get("api-key") ||
    (authHeader && !authHeader.startsWith("Bearer ey") ? authHeader.replace("Bearer ", "") : null);

  if (apiKey) {
    const svc = createClient(supabaseUrl, serviceKey);
    const prefix = apiKey.substring(0, 10) + "...";
    const { data } = await svc.from("api_keys").select("created_by").eq("key_prefix", prefix).eq("is_active", true).maybeSingle();
    if (data?.created_by) {
      const userClient = createClient(supabaseUrl, supabaseKey);
      return { userId: data.created_by, client: userClient, serviceClient: svc };
    }
  }
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const auth = await resolveUser(req);
    if (!auth) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });

    const { userId, serviceClient } = auth;

    // Fetch all data in parallel
    const [profileRes, topicsRes, logsRes, rankRes, featuresRes, streakRes] = await Promise.all([
      serviceClient.from("profiles").select("exam_type, exam_date").eq("id", userId).maybeSingle(),
      serviceClient.from("topics").select("id, name, memory_strength, subject").eq("user_id", userId).is("deleted_at", null),
      serviceClient.from("study_logs").select("duration_minutes, created_at").eq("user_id", userId).order("created_at", { ascending: false }).limit(500),
      serviceClient.from("rank_predictions_v2").select("predicted_rank, percentile_score").eq("user_id", userId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from("user_features").select("study_consistency_score, recall_success_rate, knowledge_stability, burnout_risk_score").eq("user_id", userId).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      serviceClient.from("focus_streaks").select("current_streak").eq("user_id", userId).maybeSingle(),
    ]);

    const profile = profileRes.data;
    const allTopics = topicsRes.data || [];
    const studyLogs = logsRes.data || [];
    const rankData = rankRes.data;
    const features = featuresRes.data;
    const streakDays = streakRes.data?.current_streak || 0;

    const examType = profile?.exam_type || null;
    const examDate = profile?.exam_date || null;
    const examLabel = examType || "Exam";

    if (allTopics.length === 0 && studyLogs.length === 0) {
      return new Response(JSON.stringify({
        status: "no_data",
        message: "Start studying to unlock your prediction",
        exam_label: examLabel,
        exam_type: examType,
      }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // ─── Compute metrics ───
    const totalStudyMinutes = studyLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
    const totalSessions = studyLogs.length;
    const uniqueDays = new Set(studyLogs.map(l => l.created_at.slice(0, 10)));
    const daysActive = uniqueDays.size;
    const topicsStrong = allTopics.filter(t => (t.memory_strength || 0) >= 70).length;
    const topicsMedium = allTopics.filter(t => (t.memory_strength || 0) >= 40 && (t.memory_strength || 0) < 70).length;
    const topicsWeak = allTopics.filter(t => (t.memory_strength || 0) < 40).length;
    const avgMemoryStrength = allTopics.length > 0
      ? Math.round(allTopics.reduce((s, t) => s + (t.memory_strength || 0), 0) / allTopics.length)
      : 0;

    const overallHealth = Math.min(100, features
      ? Math.round(((Math.min(1, features.knowledge_stability || 0)) * 100 + (Math.min(1, features.recall_success_rate || 0)) * 100 + (Math.min(1, features.study_consistency_score || 0)) * 100) / 3)
      : avgMemoryStrength);

    const metrics: ActivityMetrics = {
      total_study_minutes: totalStudyMinutes,
      total_sessions: totalSessions,
      avg_memory_strength: avgMemoryStrength,
      topics_covered: allTopics.length,
      topics_strong: topicsStrong,
      topics_medium: topicsMedium,
      topics_weak: topicsWeak,
      streak_days: streakDays,
      overall_health: overallHealth,
      days_active: daysActive,
    };

    // ─── Rank & zones ───
    const totalCandidates = (examType && CANDIDATE_MAP[examType]) || 1000000;
    const currentRank = (rankData?.predicted_rank && rankData.predicted_rank > 0)
      ? rankData.predicted_rank
      : Math.round(totalCandidates * 0.7);

    const safeZone = (examType && SAFE_ZONE_MAP[examType]) ? SAFE_ZONE_MAP[examType] : DEFAULT_SAFE_ZONE;
    const activityScore = computeActivityScore(metrics);
    const predictedRankRange = activityToPredictedRank(activityScore, currentRank, safeZone);

    // ─── Zone classification ───
    const predictedBestRank = predictedRankRange[0];
    const safeTop = safeZone[0];
    const safeBottom = safeZone[1];
    const rankRatio = predictedBestRank / safeBottom;
    const coverageRatio = allTopics.length > 0 ? topicsStrong / Math.max(allTopics.length, 1) : 0;
    const strengthFactor = avgMemoryStrength / 100;
    const consistencyFactor = Math.min(1, daysActive / 30);
    const positionScore = Math.max(0, Math.min(100, (1 - Math.min(rankRatio, 3) / 3) * 100));
    const blendedScore = Math.round(
      positionScore * 0.50 + (coverageRatio * 100) * 0.20 +
      strengthFactor * 100 * 0.15 + consistencyFactor * 100 * 0.15
    );

    let rankStatus: string;
    let currentZone: string;
    if (predictedBestRank <= safeTop && blendedScore >= 75) {
      rankStatus = "topper"; currentZone = "🏆 Topper Zone — Outstanding Activity";
    } else if (predictedBestRank <= safeBottom && blendedScore >= 55) {
      rankStatus = "comfortable"; currentZone = "🎯 Comfortable — Strong Preparation";
    } else if (predictedBestRank <= safeBottom * 1.5 && blendedScore >= 40) {
      rankStatus = "safe"; currentZone = "✅ Safe Zone — On Track";
    } else if (predictedBestRank <= safeBottom * 3 && blendedScore >= 20) {
      rankStatus = "borderline"; currentZone = "⚡ Borderline — Needs More Effort";
    } else {
      rankStatus = "at_risk"; currentZone = "🔴 At Risk — Study More to Improve";
    }

    // ─── Pass probability ───
    let passProbability: number;
    if (predictedBestRank <= safeTop) {
      passProbability = Math.round(85 + blendedScore * 0.13);
    } else if (predictedBestRank <= safeBottom) {
      const withinZone = 1 - (predictedBestRank - safeTop) / (safeBottom - safeTop);
      passProbability = Math.round(60 + withinZone * 25);
    } else {
      const distRatio = Math.min(predictedBestRank / safeBottom, 10);
      passProbability = Math.max(5, Math.round(55 / distRatio + blendedScore * 0.1));
    }

    let daysToExam: number | null = null;
    if (examDate) {
      const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
      daysToExam = Math.max(0, diff);
    }
    if (daysToExam !== null && daysToExam <= 30 && blendedScore < 50) {
      const urgencyPenalty = Math.round((30 - daysToExam) * (50 - blendedScore) * 0.02);
      passProbability = Math.max(3, passProbability - urgencyPenalty);
    }
    passProbability = Math.min(98, Math.max(3, passProbability));

    // ─── Ranks to climb ───
    const ranksToClimb = currentRank > safeBottom ? currentRank - safeBottom : 0;

    // ─── Topic gaps (Weak Topics — Fix These NOW) ───
    const topicGaps = [...allTopics]
      .filter(t => (t.memory_strength || 0) < 60)
      .sort((a, b) => (a.memory_strength || 0) - (b.memory_strength || 0))
      .slice(0, 5)
      .map(t => ({
        id: t.id,
        name: t.name,
        subject: t.subject || "",
        strength: Math.round(t.memory_strength || 0),
        severity: (t.memory_strength || 0) < 20 ? "critical" : (t.memory_strength || 0) < 40 ? "high" : "medium",
      }));

    // ─── Improvement Tips (Level Up Your Rank) ───
    const improvementTips: { label: string; impact: string; icon: string; action_type: string }[] = [];
    if (totalStudyMinutes < 200) improvementTips.push({ label: "Study 30 min more daily", impact: "+8-12% pass chance", icon: "⏱️", action_type: "study_time" });
    if (topicsWeak > 2) improvementTips.push({ label: `Fix ${topicsWeak} weak topics`, impact: "+5-10% pass chance", icon: "📚", action_type: "fix_topics" });
    if (streakDays < 7) improvementTips.push({ label: "Build a 7-day streak", impact: "+3-5% pass chance", icon: "🔥", action_type: "streak" });
    if (daysActive < 10) improvementTips.push({ label: "Study more consistently", impact: "+6-8% pass chance", icon: "📅", action_type: "consistency" });
    if (totalSessions < 20) improvementTips.push({ label: "Do more practice sessions", impact: "+4-7% pass chance", icon: "🎯", action_type: "sessions" });

    // ─── What-If Scenarios ───
    const scoreWith30Min = Math.min(100, activityScore + 12);
    const scoreWith3Topics = Math.min(100, activityScore + 8);
    const scoreWithStreak = Math.min(100, activityScore + 5);

    const whatIf = {
      scenarios: [
        {
          emoji: "⏱️",
          label: "+30 min/day",
          predicted_rank: activityToPredictedRank(scoreWith30Min, currentRank, safeZone)[0],
          rank_improvement: currentRank - activityToPredictedRank(scoreWith30Min, currentRank, safeZone)[0],
        },
        {
          emoji: "📚",
          label: "Fix 3 topics",
          predicted_rank: activityToPredictedRank(scoreWith3Topics, currentRank, safeZone)[0],
          rank_improvement: currentRank - activityToPredictedRank(scoreWith3Topics, currentRank, safeZone)[0],
        },
        {
          emoji: "🔥",
          label: "Keep streak",
          predicted_rank: activityToPredictedRank(scoreWithStreak, currentRank, safeZone)[0],
          rank_improvement: currentRank - activityToPredictedRank(scoreWithStreak, currentRank, safeZone)[0],
        },
      ],
      motivation_text: "More effort = Better rank = Pass guaranteed 🚀",
    };

    // ─── Position on Ladder ───
    const ladder = (["topper", "comfortable", "safe", "borderline", "at_risk"] as const).map(level => {
      const cfg = ZONE_CONFIG[level];
      return {
        level,
        emoji: cfg.emoji,
        label: cfg.label,
        sub: cfg.sub,
        is_current: rankStatus === level,
        style: { gradient: cfg.gradient, text_color: cfg.text, border_color: cfg.border },
      };
    });

    // ─── Score Drivers (What's Driving Your Score) ───
    const scoreDrivers = {
      metrics: [
        { icon: "clock", value: totalStudyMinutes, label: "Minutes Studied", color: ZONE_CONFIG[rankStatus as keyof typeof ZONE_CONFIG]?.text || "#7c4dff" },
        { icon: "book", value: totalSessions, label: "Sessions Done", color: "#7c4dff" },
        { icon: "flame", value: streakDays, label: "Day Streak", color: "#ff9100" },
        { icon: "target", value: `${topicsStrong}/${allTopics.length}`, label: "Topics Strong", color: "#00e676" },
      ],
      memory_strength: {
        value: avgMemoryStrength,
        label: "Memory Strength",
        color: ZONE_CONFIG[rankStatus as keyof typeof ZONE_CONFIG]?.text || "#7c4dff",
      },
    };

    // ─── Celebration (All Strong) ───
    const allStrong = topicGaps.length === 0 && allTopics.length > 0;

    // ─── Zone style metadata for UI ───
    const zoneStyle = ZONE_CONFIG[rankStatus as keyof typeof ZONE_CONFIG] || ZONE_CONFIG.at_risk;

    // ─── Full response ───
    const response = {
      status: "success",
      exam: {
        exam_type: examType,
        exam_label: examLabel,
        days_to_exam: daysToExam,
        is_exam_urgent: daysToExam !== null && daysToExam <= 14,
        exam_countdown_label: daysToExam === null ? null : daysToExam === 0 ? "EXAM TODAY!" : `${daysToExam} days to ${examLabel}`,
        total_candidates: totalCandidates,
      },

      // ═══ HERO: Zone Status ═══
      zone_status: {
        rank_status: rankStatus,
        current_zone: currentZone,
        zone_emoji: zoneStyle.emoji,
        zone_label: zoneStyle.label,
        zone_sub: zoneStyle.sub,
        zone_style: {
          gradient: zoneStyle.gradient,
          text_color: zoneStyle.text,
          border_color: zoneStyle.border,
        },
      },

      // ═══ RANK DATA ═══
      rank: {
        current_rank: currentRank,
        predicted_rank_range: { best: predictedRankRange[0], worst: predictedRankRange[1] },
        safe_zone_target: { top: safeZone[0], bottom: safeZone[1] },
        ranks_to_climb: ranksToClimb,
        is_above_safe_zone: currentRank <= safeBottom,
      },

      // ═══ SCORES ═══
      scores: {
        activity_score: activityScore,
        pass_probability: passProbability,
        blended_score: blendedScore,
        position_score: positionScore,
      },

      // ═══ SECTION: Your Position on the Ladder ═══
      position_ladder: ladder,

      // ═══ SECTION: What's Driving Your Score ═══
      score_drivers: scoreDrivers,

      // ═══ SECTION: Level Up Your Rank ═══
      level_up_tips: improvementTips.slice(0, 3),

      // ═══ SECTION: Weak Topics — Fix These NOW ═══
      weak_topics: {
        count: topicGaps.length,
        topics: topicGaps,
        all_strong: allStrong,
        celebration_message: allStrong ? "All Topics Strong! 💪" : null,
        celebration_sub: allStrong ? "Keep revising to maintain your edge" : null,
      },

      // ═══ SECTION: What If You Push Harder? ═══
      what_if: whatIf,

      // ═══ ACTIVITY METRICS ═══
      activity_metrics: metrics,

      // ═══ FOOTER ═══
      footer_summary: `${totalStudyMinutes} min • ${totalSessions} sessions • ${daysActive} active days • ${allTopics.length} topics`,
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("safe-pass-prediction error:", e);
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
