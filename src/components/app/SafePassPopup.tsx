import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Shield, AlertTriangle, Zap, ArrowUpRight, X, Target, TrendingUp, Brain, Clock, Flame, BookOpen,
} from "lucide-react";
import { TopicPrediction } from "@/hooks/useMemoryEngine";
import { RankPredictionData } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Activity-based rank prediction engine ─── 
   Predicts a safe rank RANGE purely from app activity signals:
   - Total study minutes
   - Topics covered & their memory strength
   - Study streak days
   - Overall brain health
   - Session frequency & consistency
*/

interface ActivityMetrics {
  totalStudyMinutes: number;
  totalSessions: number;
  avgMemoryStrength: number;
  topicsCovered: number;
  topicsStrong: number;   // memory > 70%
  topicsMedium: number;   // 40-70%
  topicsWeak: number;     // < 40%
  streakDays: number;
  overallHealth: number;
  daysActive: number;     // unique days with study activity
}

interface SafePassData {
  currentRank: number;
  activityScore: number;          // 0-100 composite score
  predictedSafeRankRange: [number, number];
  safeZoneTarget: [number, number];        // actual target safe zone to pass
  currentZone: string;
  passProbability: number;
  rankStatus: "topper" | "comfortable" | "safe" | "borderline" | "at_risk";
  progressPercent: number;
  metrics: ActivityMetrics;
  improvementTips: { label: string; impact: string; icon: string }[];
  whatIf: {
    if30MinMore: number;    // predicted rank if +30min daily
    if3TopicsFix: number;   // predicted rank if fix 3 weak topics
    ifStreakBonus: number;   // predicted rank if maintain streak
  };
  daysToExam: number | null;
  examLabel: string;
  topicGaps: { name: string; strength: number; }[];
}

/* ─── Activity Score Calculator ─── */
function computeActivityScore(m: ActivityMetrics): number {
  // Weight each factor
  const studyTimeScore = Math.min(100, (m.totalStudyMinutes / 500) * 100);    // 500 min = full score
  const coverageScore = m.topicsCovered > 0
    ? (m.topicsStrong / m.topicsCovered) * 100
    : 0;
  const consistencyScore = Math.min(100, (m.daysActive / 30) * 100);          // 30 active days = full
  const streakScore = Math.min(100, (m.streakDays / 14) * 100);               // 14-day streak = full
  const healthScore = m.overallHealth;
  const sessionScore = Math.min(100, (m.totalSessions / 50) * 100);           // 50 sessions = full

  // Weighted composite
  return Math.round(
    studyTimeScore * 0.25 +
    coverageScore * 0.20 +
    consistencyScore * 0.20 +
    streakScore * 0.10 +
    healthScore * 0.15 +
    sessionScore * 0.10
  );
}

/* ─── Safe zone target rank per exam ─── 
   These are the rank ranges where a user is considered "safe to pass"
   based on real exam patterns. The user's current app rank needs to 
   reach this range through sustained study effort.
*/
const SAFE_ZONE_MAP: Record<string, [number, number]> = {
  // ─── Government Exams ───
  "SSC CGL":      [1000, 5000],         // ~50K vacancies across posts
  "IBPS PO":      [500, 2000],          // Probationary Officer selections
  "SBI PO":       [400, 1500],          // SBI PO selections
  "RRB NTPC":     [2000, 8000],         // Large-scale railway recruitment
  "RRB Group D":  [5000, 15000],        // Mass railway recruitment
  NDA:            [200, 400],           // National Defence Academy selections
  CDS:            [150, 350],           // Combined Defence Services
  "State PSC":    [100, 500],           // State civil services
  "UGC NET":      [1000, 3000],         // Lectureship/JRF qualifying
  UPSC:           [100, 300],           // IAS+IPS+IFS selections
  SSC:            [1000, 3000],         // ~50K vacancies (legacy key)

  // ─── Private Entrance Exams ───
  "JEE Advanced": [200, 500],           // Any IIT seat
  "JEE Main":     [800, 1500],          // Decent NIT seat
  NEET:           [1560, 2580],         // Any govt MBBS seat
  "NEET UG":      [1560, 2580],         // Any govt MBBS seat (alias)
  CAT:            [300, 800],           // Any IIM seat
  GATE:           [500, 1200],          // Top PSU/IIT M.Tech
  CLAT:           [200, 600],           // Top NLU seats
  "CUET UG":      [500, 2000],         // Top central university seats
  BITSAT:         [100, 400],           // BITS Pilani/Goa/Hyderabad
  "NIFT Entrance":[100, 350],          // Top NIFT campus seats
  XAT:            [200, 600],           // XLRI & top B-school seats

  // ─── Global Exams ───
  SAT:            [50, 200],            // Top US university admits (percentile-based)
  GRE:            [100, 500],           // Top grad school admits
  GMAT:           [80, 300],            // Top MBA program admits
  IELTS:          [50, 150],            // Band 7.5+ equivalent ranking
  TOEFL:          [50, 150],            // Score 100+ equivalent ranking
  USMLE:          [100, 500],           // US medical licensing top scores
  CFA:            [200, 800],           // CFA Program pass ranking
  "CPA Exam":     [150, 500],          // CPA qualifying rank
  MCAT:           [100, 400],           // Top med school admits
  ACCA:           [200, 600],           // ACCA qualification ranking

  // ─── Boards ───
  Boards:         [100, 240],           // Top percentile
};
const DEFAULT_SAFE_ZONE: [number, number] = [1000, 3000];

/* ─── Map activity score to predicted rank ─── */
function activityToPredictedRank(score: number, currentRank: number, safeZone: [number, number]): [number, number] {
  // At score 0 → stays near current rank
  // At score 100 → reaches safe zone best rank
  // Interpolate between current rank and safe zone based on activity score
  const progress = score / 100; // 0 to 1
  
  // Use exponential curve so early effort shows visible improvement
  const curve = Math.pow(progress, 0.7); // slightly accelerated curve
  
  const predictedBest = Math.max(1, Math.round(currentRank - (currentRank - safeZone[0]) * curve));
  const predictedWorst = Math.max(predictedBest, Math.round(currentRank - (currentRank - safeZone[1]) * curve));
  
  return [predictedBest, predictedWorst];
}

/* ─── Main computation ─── */
function computeSafePass(
  allTopics: TopicPrediction[],
  overallHealth: number,
  streakDays: number,
  examDate: string | null,
  rankData: RankPredictionData | null,
  examType: string | null,
  studyLogs: { duration_minutes: number; created_at: string }[],
): SafePassData | null {
  if (allTopics.length === 0 && studyLogs.length === 0) return null;

  const examLabel = examType || "Exam";

  // Estimate total candidates from exam type
  const candidateMap: Record<string, number> = {
    NEET: 2400000, "JEE Main": 1200000, "JEE Advanced": 250000,
    UPSC: 1200000, CAT: 300000, GATE: 900000, SSC: 3000000,
    CLAT: 70000, Boards: 5000000,
  };
  const totalCandidates = (examType && candidateMap[examType]) || 1000000;

  // Use rank prediction data if available, otherwise derive from total candidates
  const currentRank = (rankData?.predicted_rank && rankData.predicted_rank > 0)
    ? rankData.predicted_rank
    : Math.round(totalCandidates * 0.7); // Default: assume user starts at ~70th percentile position

  // examLabel, candidateMap, totalCandidates already declared above

  // Days to exam
  let daysToExam: number | null = null;
  if (examDate) {
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    daysToExam = Math.max(0, diff);
  }

  // Build activity metrics from study logs + topics
  const totalStudyMinutes = studyLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
  const totalSessions = studyLogs.length;

  // Unique active days
  const uniqueDays = new Set(studyLogs.map(l => l.created_at.slice(0, 10)));
  const daysActive = uniqueDays.size;

  const topicsStrong = allTopics.filter(t => t.memory_strength >= 70).length;
  const topicsMedium = allTopics.filter(t => t.memory_strength >= 40 && t.memory_strength < 70).length;
  const topicsWeak = allTopics.filter(t => t.memory_strength < 40).length;
  const avgMemoryStrength = allTopics.length > 0
    ? Math.round(allTopics.reduce((s, t) => s + t.memory_strength, 0) / allTopics.length)
    : 0;

  const metrics: ActivityMetrics = {
    totalStudyMinutes,
    totalSessions,
    avgMemoryStrength,
    topicsCovered: allTopics.length,
    topicsStrong,
    topicsMedium,
    topicsWeak,
    streakDays,
    overallHealth,
    daysActive,
  };

  const safeZone = (examType && SAFE_ZONE_MAP[examType]) ? SAFE_ZONE_MAP[examType] : DEFAULT_SAFE_ZONE;
  const activityScore = computeActivityScore(metrics);
  const predictedSafeRankRange = activityToPredictedRank(activityScore, currentRank, safeZone);

  // ─── ACCURATE ZONE: based on predicted rank vs safe zone target ───
  // Compare the user's best predicted rank against the safe zone boundaries
  const predictedBestRank = predictedSafeRankRange[0];
  const safeTop = safeZone[0];    // e.g. 1560 for NEET (best safe rank)
  const safeBottom = safeZone[1]; // e.g. 2580 for NEET (worst safe rank)
  
  // Calculate how far the predicted rank is from the safe zone
  // rankRatio: < 1 means inside/above safe zone, > 1 means below safe zone
  const rankRatio = predictedBestRank / safeBottom;
  
  // Also factor in coverage, strength, and consistency for a blended score
  const coverageRatio = allTopics.length > 0 ? topicsStrong / Math.max(allTopics.length, 1) : 0;
  const strengthFactor = avgMemoryStrength / 100; // 0-1
  const consistencyFactor = Math.min(1, daysActive / 30);
  
  // Blended position score: 60% rank position, 20% topic mastery, 10% consistency, 10% activity
  const positionScore = Math.max(0, Math.min(100,
    (1 - Math.min(rankRatio, 3) / 3) * 100  // rank position normalized 0-100
  ));
  const blendedScore = Math.round(
    positionScore * 0.50 +
    (coverageRatio * 100) * 0.20 +
    strengthFactor * 100 * 0.15 +
    consistencyFactor * 100 * 0.15
  );

  let rankStatus: SafePassData["rankStatus"];
  let currentZone: string;

  if (predictedBestRank <= safeTop && blendedScore >= 75) {
    // Predicted rank is ABOVE the safe zone top — topper
    rankStatus = "topper";
    currentZone = "🏆 Topper Zone — Outstanding Activity";
  } else if (predictedBestRank <= safeBottom && blendedScore >= 55) {
    // Predicted rank is INSIDE the safe zone — comfortable
    rankStatus = "comfortable";
    currentZone = "🎯 Comfortable — Strong Preparation";
  } else if (predictedBestRank <= safeBottom * 1.5 && blendedScore >= 40) {
    // Within 1.5x of safe zone bottom — safe
    rankStatus = "safe";
    currentZone = "✅ Safe Zone — On Track";
  } else if (predictedBestRank <= safeBottom * 3 && blendedScore >= 20) {
    // Within 3x of safe zone — borderline
    rankStatus = "borderline";
    currentZone = "⚡ Borderline — Needs More Effort";
  } else {
    // Far from safe zone — at risk
    rankStatus = "at_risk";
    currentZone = "🔴 At Risk — Study More to Improve";
  }

  // ─── Pass probability: blended from rank proximity + preparation quality ───
  let passProbability: number;
  if (predictedBestRank <= safeTop) {
    // Above safe zone: 85-98% based on mastery depth
    passProbability = Math.round(85 + blendedScore * 0.13);
  } else if (predictedBestRank <= safeBottom) {
    // Inside safe zone: 60-85%
    const withinZone = 1 - (predictedBestRank - safeTop) / (safeBottom - safeTop);
    passProbability = Math.round(60 + withinZone * 25);
  } else {
    // Below safe zone: scale down based on distance
    const distRatio = Math.min(predictedBestRank / safeBottom, 10);
    passProbability = Math.max(5, Math.round(55 / distRatio + blendedScore * 0.1));
  }

  // Exam urgency adjustment — reduce confidence when exam is near & preparation is weak
  if (daysToExam !== null && daysToExam <= 30 && blendedScore < 50) {
    const urgencyPenalty = Math.round((30 - daysToExam) * (50 - blendedScore) * 0.02);
    passProbability = Math.max(3, passProbability - urgencyPenalty);
  }
  // Clamp
  passProbability = Math.min(98, Math.max(3, passProbability));

  const progressPercent = activityScore;

  // Topic gaps
  const topicGaps = [...allTopics]
    .filter(t => t.memory_strength < 60)
    .sort((a, b) => a.memory_strength - b.memory_strength)
    .slice(0, 5)
    .map(t => ({ name: t.name, strength: Math.round(t.memory_strength) }));

  // Improvement tips based on weakest metrics
  const tips: SafePassData["improvementTips"] = [];
  if (totalStudyMinutes < 200) tips.push({ label: "Study 30 min more daily", impact: "+8-12% pass chance", icon: "⏱️" });
  if (topicsWeak > 2) tips.push({ label: `Fix ${topicsWeak} weak topics`, impact: "+5-10% pass chance", icon: "📚" });
  if (streakDays < 7) tips.push({ label: "Build a 7-day streak", impact: "+3-5% pass chance", icon: "🔥" });
  if (daysActive < 10) tips.push({ label: "Study more consistently", impact: "+6-8% pass chance", icon: "📅" });
  if (totalSessions < 20) tips.push({ label: "Do more practice sessions", impact: "+4-7% pass chance", icon: "🎯" });

  // What-if scenarios: simulate improved activity score
  const scoreWith30Min = Math.min(100, activityScore + 12);
  const scoreWith3Topics = Math.min(100, activityScore + 8);
  const scoreWithStreak = Math.min(100, activityScore + 5);

  return {
    currentRank,
    activityScore,
    predictedSafeRankRange,
    safeZoneTarget: safeZone,
    currentZone,
    passProbability,
    rankStatus,
    progressPercent,
    metrics,
    improvementTips: tips.slice(0, 3),
    topicGaps,
    whatIf: {
      if30MinMore: activityToPredictedRank(scoreWith30Min, currentRank, safeZone)[0],
      if3TopicsFix: activityToPredictedRank(scoreWith3Topics, currentRank, safeZone)[0],
      ifStreakBonus: activityToPredictedRank(scoreWithStreak, currentRank, safeZone)[0],
    },
    daysToExam,
    examLabel,
  };
}

/* ─── Zone-specific design system ─── */
const ZONE_CONFIG = {
  topper: {
    gradient: "linear-gradient(135deg, #00e676, #00c853, #69f0ae)",
    glow: "0 0 40px rgba(0, 230, 118, 0.5), 0 0 80px rgba(0, 230, 118, 0.2)",
    bg: "linear-gradient(160deg, rgba(0,230,118,0.08) 0%, hsl(var(--card)) 50%, rgba(0,200,83,0.06) 100%)",
    border: "rgba(0,230,118,0.4)",
    text: "#00e676",
    emoji: "👑",
    label: "TOPPER ZONE",
    sub: "You're dominating! Stay consistent.",
    pulse: "rgba(0,230,118,0.3)",
  },
  comfortable: {
    gradient: "linear-gradient(135deg, #00bcd4, #26c6da, #4dd0e1)",
    glow: "0 0 40px rgba(0, 188, 212, 0.5), 0 0 80px rgba(0, 188, 212, 0.2)",
    bg: "linear-gradient(160deg, rgba(0,188,212,0.08) 0%, hsl(var(--card)) 50%, rgba(38,198,218,0.06) 100%)",
    border: "rgba(0,188,212,0.4)",
    text: "#00bcd4",
    emoji: "🎯",
    label: "COMFORTABLE",
    sub: "Strong preparation! Push harder to top.",
    pulse: "rgba(0,188,212,0.3)",
  },
  safe: {
    gradient: "linear-gradient(135deg, #7c4dff, #651fff, #b388ff)",
    glow: "0 0 40px rgba(124, 77, 255, 0.5), 0 0 80px rgba(124, 77, 255, 0.2)",
    bg: "linear-gradient(160deg, rgba(124,77,255,0.08) 0%, hsl(var(--card)) 50%, rgba(101,31,255,0.06) 100%)",
    border: "rgba(124,77,255,0.4)",
    text: "#7c4dff",
    emoji: "✅",
    label: "SAFE ZONE",
    sub: "On track! Keep the momentum going.",
    pulse: "rgba(124,77,255,0.3)",
  },
  borderline: {
    gradient: "linear-gradient(135deg, #ff9100, #ff6d00, #ffab40)",
    glow: "0 0 40px rgba(255, 145, 0, 0.5), 0 0 80px rgba(255, 145, 0, 0.2)",
    bg: "linear-gradient(160deg, rgba(255,145,0,0.1) 0%, hsl(var(--card)) 50%, rgba(255,109,0,0.08) 100%)",
    border: "rgba(255,145,0,0.5)",
    text: "#ff9100",
    emoji: "⚠️",
    label: "BORDERLINE",
    sub: "Danger zone! Increase effort NOW.",
    pulse: "rgba(255,145,0,0.4)",
  },
  at_risk: {
    gradient: "linear-gradient(135deg, #ff1744, #d50000, #ff5252)",
    glow: "0 0 40px rgba(255, 23, 68, 0.6), 0 0 80px rgba(255, 23, 68, 0.3), 0 0 120px rgba(255, 23, 68, 0.1)",
    bg: "linear-gradient(160deg, rgba(255,23,68,0.12) 0%, hsl(var(--card)) 40%, rgba(213,0,0,0.1) 100%)",
    border: "rgba(255,23,68,0.6)",
    text: "#ff1744",
    emoji: "🚨",
    label: "AT RISK",
    sub: "Critical! Start studying immediately!",
    pulse: "rgba(255,23,68,0.5)",
  },
};

const probColor = (p: number) =>
  p >= 75 ? "#00e676" : p >= 50 ? "#ff9100" : "#ff1744";

/* ─── Component ─── */
interface SafePassPopupProps {
  open: boolean;
  onClose: () => void;
  allTopics: TopicPrediction[];
  overallHealth: number;
  streakDays: number;
  rankData?: RankPredictionData | null;
}

const SafePassPopup: React.FC<SafePassPopupProps> = ({
  open, onClose, allTopics, overallHealth, streakDays, rankData,
}) => {
  const { user } = useAuth();
  const [examDate, setExamDate] = useState<string | null>(null);
  const [examType, setExamType] = useState<string | null>(null);
  const [studyLogs, setStudyLogs] = useState<{ duration_minutes: number; created_at: string }[]>([]);

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const [profileRes, logsRes] = await Promise.all([
        supabase.from("profiles").select("exam_type, exam_date").eq("id", user.id).single(),
        supabase.from("study_logs").select("duration_minutes, created_at")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(500),
      ]);
      if (profileRes.data) {
        setExamDate(profileRes.data.exam_date);
        setExamType(profileRes.data.exam_type);
      }
      if (logsRes.data) setStudyLogs(logsRes.data);
    })();
  }, [open, user]);

  const data = computeSafePass(allTopics, overallHealth, streakDays, examDate, rankData ?? null, examType, studyLogs);
  const zone = data ? ZONE_CONFIG[data.rankStatus] : ZONE_CONFIG.at_risk;
  const circ = 2 * Math.PI * 44;

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop with zone-tinted radial glow */}
          <motion.div
            className="fixed inset-0 z-[100]"
            style={{ background: data ? `radial-gradient(circle at center, ${zone.pulse} 0%, rgba(0,0,0,0.75) 70%)` : "rgba(0,0,0,0.7)" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />

          <motion.div
            className="fixed inset-x-3 top-[5%] z-[101] mx-auto max-w-[420px] max-h-[90vh] overflow-y-auto rounded-[28px] shadow-2xl"
            style={{
              background: data ? zone.bg : "hsl(var(--card))",
              border: `2px solid ${data ? zone.border : "hsl(var(--border))"}`,
              boxShadow: data ? zone.glow : "none",
            }}
            initial={{ opacity: 0, scale: 0.8, y: 60 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8, y: 60 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
          >
            {/* Animated background orbs */}
            {data && (
              <>
                <motion.div className="absolute top-0 left-0 w-40 h-40 rounded-full blur-[60px] pointer-events-none"
                  style={{ background: zone.pulse }}
                  animate={{ opacity: [0.3, 0.6, 0.3], scale: [1, 1.2, 1], x: [-10, 10, -10] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                />
                <motion.div className="absolute bottom-20 right-0 w-32 h-32 rounded-full blur-[50px] pointer-events-none"
                  style={{ background: zone.pulse }}
                  animate={{ opacity: [0.2, 0.5, 0.2], scale: [1, 1.3, 1] }}
                  transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                />
              </>
            )}

            {/* ═══ HEADER ═══ */}
            <div className="relative p-5 pb-2">
              <motion.button whileTap={{ scale: 0.8 }} onClick={onClose}
                className="absolute top-4 right-4 w-9 h-9 rounded-full bg-black/20 backdrop-blur-md flex items-center justify-center text-white/70 hover:text-white transition-colors z-10">
                <X className="w-4 h-4" />
              </motion.button>

              <div className="flex items-center gap-3">
                <motion.div
                  className="relative w-12 h-12 rounded-2xl flex items-center justify-center overflow-hidden"
                  style={{ background: zone.gradient }}
                  animate={{ boxShadow: [`0 0 0px ${zone.pulse}`, `0 0 24px ${zone.pulse}`, `0 0 0px ${zone.pulse}`] }}
                  transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Shield className="w-6 h-6 text-white drop-shadow-lg" />
                  <motion.div className="absolute inset-0"
                    style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.3) 50%, transparent 60%)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 1 }}
                  />
                </motion.div>
                <div>
                  <h2 className="text-base font-extrabold text-foreground tracking-tight">Sure Pass Prediction Engine</h2>
                  <p className="text-[10px] text-muted-foreground">Your path to exam success</p>
                </div>
              </div>

              {data?.daysToExam != null && (
                <motion.div
                  className="mt-3 inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold backdrop-blur-md"
                  style={{
                    background: data.daysToExam <= 14 ? "rgba(255,23,68,0.15)" : "rgba(0,230,118,0.1)",
                    color: data.daysToExam <= 14 ? "#ff1744" : "#00e676",
                    border: `1px solid ${data.daysToExam <= 14 ? "rgba(255,23,68,0.3)" : "rgba(0,230,118,0.2)"}`,
                  }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.3, type: "spring" }}
                >
                  {data.daysToExam <= 14 ? (
                    <motion.span animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }}>⏰</motion.span>
                  ) : <Target className="w-3.5 h-3.5" />}
                  {data.daysToExam === 0 ? "EXAM TODAY!" : `${data.daysToExam} days to ${data.examLabel}`}
                </motion.div>
              )}
            </div>

            {!data ? (
              <div className="px-5 pb-8 text-center">
                <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                  <Target className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                </motion.div>
                <p className="text-sm text-muted-foreground font-medium">Start studying to unlock your prediction</p>
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-4">

                {/* ═══ ZONE STATUS HERO ═══ */}
                <motion.div className="rounded-[20px] p-5 text-center relative overflow-hidden"
                  style={{ border: `2px solid ${zone.border}` }}
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
                  <motion.div className="absolute inset-0 rounded-[20px] pointer-events-none"
                    style={{ boxShadow: `inset 0 0 30px ${zone.pulse}` }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {/* Zone badge */}
                  <motion.div className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-black tracking-wide mb-4"
                    style={{ background: zone.gradient, color: "#fff" }}
                    initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }}
                    transition={{ delay: 0.25, type: "spring", stiffness: 200 }}>
                    <motion.span className="text-lg"
                      animate={data.rankStatus === "at_risk" ? { scale: [1, 1.4, 1], rotate: [0, -15, 15, 0] } : { scale: [1, 1.15, 1] }}
                      transition={{ duration: data.rankStatus === "at_risk" ? 0.6 : 2, repeat: Infinity }}>
                      {zone.emoji}
                    </motion.span>
                    {zone.label}
                  </motion.div>

                  <p className="text-[10px] text-muted-foreground font-medium mb-1">{zone.sub}</p>

                  {/* Current Rank */}
                  <p className="text-[9px] text-muted-foreground mt-4 mb-1 uppercase tracking-widest">Your Current Rank</p>
                  <motion.p className="text-4xl font-black tabular-nums"
                    style={{ color: zone.text, textShadow: `0 0 20px ${zone.pulse}` }}
                    initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.35, type: "spring", stiffness: 180 }}>
                    #{data.currentRank.toLocaleString()}
                  </motion.p>

                  {/* Target Safe Zone */}
                  <motion.div className="mt-5 rounded-2xl p-4 relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(0,230,118,0.06), rgba(0,200,83,0.04))", border: "1.5px solid rgba(0,230,118,0.3)" }}
                    initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                    {[0, 1].map(i => (
                      <motion.div key={i} className="absolute w-2 h-2 rounded-full" style={{ background: "#00e676", top: `${15 + i * 20}%`, right: `${5 + i * 8}%` }}
                        animate={{ scale: [0, 1, 0], opacity: [0, 1, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.7 }} />
                    ))}
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2 flex items-center justify-center gap-1.5" style={{ color: "#00e676" }}>
                      <Target className="w-3.5 h-3.5" />🎯 Target Safe Zone to Pass {data.examLabel}
                    </p>
                    <motion.p className="text-2xl font-black tabular-nums"
                      style={{ color: "#00e676", textShadow: "0 0 16px rgba(0,230,118,0.4)" }}
                      initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55, type: "spring" }}>
                      #{data.safeZoneTarget[0].toLocaleString()} — #{data.safeZoneTarget[1].toLocaleString()}
                    </motion.p>
                    <p className="text-[8px] text-muted-foreground mt-1.5">Reach this rank to secure your seat</p>
                    {data.currentRank > data.safeZoneTarget[1] && (
                      <motion.div className="mt-3 flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full text-[9px] font-bold mx-auto w-fit"
                        style={{ background: data.rankStatus === "at_risk" ? "rgba(255,23,68,0.15)" : "rgba(255,145,0,0.12)", color: data.rankStatus === "at_risk" ? "#ff1744" : "#ff9100" }}
                        initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                        <ArrowUpRight className="w-3 h-3" />
                        {(data.currentRank - data.safeZoneTarget[1]).toLocaleString()} ranks to climb
                      </motion.div>
                    )}
                  </motion.div>

                  {/* Twin Gauges */}
                  <div className="flex items-center justify-center gap-8 mt-5">
                    {[
                      { val: data.activityScore, label: "Activity Score", suffix: "", color: zone.text },
                      { val: data.passProbability, label: "Pass Chance", suffix: "%", color: probColor(data.passProbability) },
                    ].map((g, gi) => (
                      <motion.div key={gi} className="text-center" initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.5 + gi * 0.1, type: "spring" }}>
                        <div className="relative w-[68px] h-[68px]">
                          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                            <circle cx="50" cy="50" r="44" fill="none" stroke="hsl(var(--border)/0.3)" strokeWidth="6" />
                            <motion.circle cx="50" cy="50" r="44" fill="none" stroke={g.color} strokeWidth="6" strokeLinecap="round"
                              strokeDasharray={circ} initial={{ strokeDashoffset: circ }}
                              animate={{ strokeDashoffset: circ * (1 - g.val / 100) }}
                              transition={{ duration: 1.5, ease: "easeOut", delay: 0.6 + gi * 0.15 }}
                              style={{ filter: `drop-shadow(0 0 8px ${g.color})` }} />
                          </svg>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <motion.span className="text-base font-black tabular-nums text-foreground"
                              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.8 + gi * 0.1, type: "spring" }}>
                              {g.val}{g.suffix}
                            </motion.span>
                          </div>
                        </div>
                        <p className="text-[8px] text-muted-foreground mt-1 font-medium">{g.label}</p>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>

                {/* ═══ ZONE LADDER ═══ */}
                <motion.div className="rounded-[20px] border border-border/30 bg-card/40 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3 text-center">
                    Your Position on the Ladder
                  </p>
                  <div className="space-y-1.5">
                    {(["topper", "comfortable", "safe", "borderline", "at_risk"] as const).map((level, i) => {
                      const cfg = ZONE_CONFIG[level];
                      const isActive = data.rankStatus === level;
                      return (
                        <motion.div key={level}
                          className="relative flex items-center gap-2.5 rounded-xl px-3 py-2 transition-all"
                          style={{
                            background: isActive ? `linear-gradient(90deg, ${cfg.pulse}, transparent)` : "transparent",
                            border: isActive ? `1.5px solid ${cfg.border}` : "1px solid transparent",
                            boxShadow: isActive ? `0 0 16px ${cfg.pulse}` : "none",
                          }}
                          initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.35 + i * 0.06 }}>
                          {isActive && (
                            <motion.div className="absolute -left-1 w-2.5 h-2.5 rounded-full"
                              style={{ background: cfg.gradient }}
                              animate={{ scale: [1, 1.6, 1], opacity: [1, 0.4, 1] }}
                              transition={{ duration: 1.2, repeat: Infinity }} />
                          )}
                          <span className="text-sm">{cfg.emoji}</span>
                          <span className={`text-[10px] flex-1 ${isActive ? "font-extrabold" : "font-medium text-muted-foreground"}`}
                            style={{ color: isActive ? cfg.text : undefined }}>
                            {cfg.label}
                          </span>
                          {isActive && (
                            <motion.span className="text-[8px] font-bold px-2 py-0.5 rounded-full"
                              style={{ background: cfg.gradient, color: "#fff" }}
                              animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
                              YOU
                            </motion.span>
                          )}
                        </motion.div>
                      );
                    })}
                  </div>
                </motion.div>

                {/* ═══ METRICS ═══ */}
                <motion.div className="rounded-[20px] border border-border/30 bg-card/40 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                  <p className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Brain className="w-3.5 h-3.5" style={{ color: zone.text }} /> What's Driving Your Score
                  </p>
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { icon: Clock, val: data.metrics.totalStudyMinutes, label: "Minutes Studied", color: zone.text },
                      { icon: BookOpen, val: data.metrics.totalSessions, label: "Sessions Done", color: "#7c4dff" },
                      { icon: Flame, val: data.metrics.streakDays, label: "Day Streak", color: "#ff9100" },
                      { icon: Target, val: `${data.metrics.topicsStrong}/${data.metrics.topicsCovered}`, label: "Topics Strong", color: "#00e676" },
                    ].map((item, i) => (
                      <motion.div key={i} className="rounded-xl p-3 text-center border border-border/20"
                        style={{ background: "hsl(var(--secondary)/0.3)" }}
                        initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.06, type: "spring" }}
                        whileHover={{ scale: 1.05, borderColor: item.color }}>
                        <item.icon className="w-4 h-4 mx-auto mb-1.5" style={{ color: item.color }} />
                        <p className="text-lg font-black text-foreground tabular-nums">{item.val}</p>
                        <p className="text-[7px] text-muted-foreground font-medium">{item.label}</p>
                      </motion.div>
                    ))}
                  </div>
                  <div className="mt-4">
                    <div className="flex justify-between mb-1.5">
                      <span className="text-[8px] text-muted-foreground font-medium">Memory Strength</span>
                      <span className="text-[9px] font-bold" style={{ color: zone.text }}>{data.metrics.avgMemoryStrength}%</span>
                    </div>
                    <div className="w-full h-2 rounded-full bg-border/30 overflow-hidden">
                      <motion.div className="h-full rounded-full" style={{ background: zone.gradient }}
                        initial={{ width: 0 }} animate={{ width: `${data.metrics.avgMemoryStrength}%` }}
                        transition={{ duration: 1.2, delay: 0.5, ease: "easeOut" }} />
                    </div>
                  </div>
                </motion.div>

                {/* ═══ IMPROVEMENT TIPS ═══ */}
                {data.improvementTips.length > 0 && (
                  <motion.div className="rounded-[20px] p-4 relative overflow-hidden"
                    style={{ background: `linear-gradient(135deg, ${zone.pulse}15, hsl(var(--card)))`, border: `1.5px solid ${zone.border}60` }}
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: zone.text }}>
                      <Zap className="w-3.5 h-3.5" /> Level Up Your Rank
                    </p>
                    <div className="space-y-2">
                      {data.improvementTips.map((tip, i) => (
                        <motion.div key={i} className="flex items-center gap-3 rounded-xl px-3 py-3 border border-border/20"
                          style={{ background: "hsl(var(--card)/0.7)" }}
                          initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.45 + i * 0.08 }} whileHover={{ x: 4 }}>
                          <span className="text-lg">{tip.icon}</span>
                          <div className="flex-1 min-w-0">
                            <p className="text-[10px] text-foreground font-semibold">{tip.label}</p>
                            <p className="text-[9px] font-bold" style={{ color: "#00e676" }}>{tip.impact}</p>
                          </div>
                          <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                            <ArrowUpRight className="w-4 h-4 shrink-0" style={{ color: "#00e676" }} />
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ═══ WEAK TOPICS — RED ALERT ═══ */}
                {data.topicGaps.length > 0 && (
                  <motion.div className="rounded-[20px] p-4 relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(255,23,68,0.06), hsl(var(--card)))", border: "1.5px solid rgba(255,23,68,0.3)" }}
                    initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                    <motion.div className="absolute top-3 right-3 w-2.5 h-2.5 rounded-full" style={{ background: "#ff1744" }}
                      animate={{ scale: [1, 1.5, 1], opacity: [1, 0.3, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                    <p className="text-[9px] font-bold uppercase tracking-widest mb-2.5 flex items-center gap-1.5" style={{ color: "#ff1744" }}>
                      <AlertTriangle className="w-3.5 h-3.5" /> 🚨 Weak Topics — Fix These NOW
                    </p>
                    <div className="space-y-1.5">
                      {data.topicGaps.map((gap, i) => (
                        <motion.div key={i} className="flex items-center gap-2.5 rounded-xl px-3 py-2 border"
                          style={{ borderColor: gap.strength < 20 ? "rgba(255,23,68,0.3)" : "hsl(var(--border)/0.2)", background: gap.strength < 20 ? "rgba(255,23,68,0.05)" : "hsl(var(--card)/0.5)" }}
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.06 }}>
                          <motion.div className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: gap.strength < 20 ? "#ff1744" : gap.strength < 40 ? "#ff9100" : "#ffab40" }}
                            animate={gap.strength < 20 ? { scale: [1, 1.4, 1] } : {}} transition={{ duration: 1, repeat: Infinity }} />
                          <span className="text-[10px] text-foreground truncate flex-1 font-medium">{gap.name}</span>
                          <span className="text-[10px] font-black tabular-nums" style={{ color: gap.strength < 20 ? "#ff1744" : "#ff9100" }}>{gap.strength}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ═══ WHAT-IF ═══ */}
                <motion.div className="rounded-[20px] p-4 relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, rgba(0,230,118,0.06), hsl(var(--card)))", border: "1.5px solid rgba(0,230,118,0.25)" }}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  {[0, 1, 2].map(i => (
                    <motion.div key={i} className="absolute w-1.5 h-1.5 rounded-full"
                      style={{ background: "#00e676", top: `${20 + i * 25}%`, right: `${8 + i * 12}%` }}
                      animate={{ y: [-5, 5, -5], opacity: [0, 1, 0] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.7 }} />
                  ))}
                  <p className="text-[9px] font-bold uppercase tracking-widest mb-3 flex items-center gap-1.5" style={{ color: "#00e676" }}>
                    <TrendingUp className="w-3.5 h-3.5" /> What If You Push Harder?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { emoji: "⏱️", rank: data.whatIf.if30MinMore, label: "+30 min/day" },
                      { emoji: "📚", rank: data.whatIf.if3TopicsFix, label: "Fix 3 topics" },
                      { emoji: "🔥", rank: data.whatIf.ifStreakBonus, label: "Keep streak" },
                    ].map((s, i) => (
                      <motion.div key={i} className="rounded-xl p-3 text-center border border-border/20"
                        style={{ background: "hsl(var(--card)/0.6)" }}
                        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.55 + i * 0.08, type: "spring" }} whileHover={{ scale: 1.08 }}>
                        <motion.span className="text-xl block mb-1"
                          animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}>
                          {s.emoji}
                        </motion.span>
                        <motion.p className="text-xs font-black tabular-nums" style={{ color: "#00e676" }}
                          initial={{ scale: 0.7 }} animate={{ scale: 1 }} transition={{ delay: 0.65 + i * 0.08, type: "spring" }}>
                          #{s.rank.toLocaleString()}
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
                      </motion.div>
                    ))}
                  </div>
                  <motion.p className="text-[10px] text-center mt-3 font-bold" style={{ color: "#00e676" }}
                    animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2, repeat: Infinity }}>
                    More effort = Better rank = Pass guaranteed 🚀
                  </motion.p>
                </motion.div>

                {/* ═══ ALL STRONG — Celebration ═══ */}
                {data.topicGaps.length === 0 && (
                  <motion.div className="rounded-[20px] p-5 text-center relative overflow-hidden"
                    style={{ background: "linear-gradient(135deg, rgba(0,230,118,0.1), rgba(105,240,174,0.05))", border: "1.5px solid rgba(0,230,118,0.3)" }}
                    initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.4 }}>
                    <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                      <Trophy className="w-10 h-10 mx-auto mb-2" style={{ color: "#FFD700", filter: "drop-shadow(0 0 12px rgba(255,215,0,0.5))" }} />
                    </motion.div>
                    <p className="text-sm font-black" style={{ color: "#00e676" }}>All Topics Strong! 💪</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Keep revising to maintain your edge</p>
                  </motion.div>
                )}

                <motion.p className="text-[7px] text-muted-foreground/30 text-center italic pt-2"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}>
                  {data.metrics.totalStudyMinutes} min • {data.metrics.totalSessions} sessions • {data.metrics.daysActive} active days • {data.metrics.topicsCovered} topics
                </motion.p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SafePassPopup;
