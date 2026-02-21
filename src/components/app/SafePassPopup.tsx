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
  predictedSafeRankRange: [number, number]; // predicted rank range to pass
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
  NEET:           [1560, 2580],
  "JEE Main":     [800, 1500],
  "JEE Advanced": [200, 500],
  UPSC:           [100, 300],
  CAT:            [300, 800],
  GATE:           [500, 1200],
  SSC:            [1000, 3000],
  CLAT:           [200, 600],
  Boards:         [2000, 5000],
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
  if (allTopics.length === 0) return null;

  const currentRank = rankData?.predicted_rank ?? 0;
  if (currentRank <= 0) return null;

  const examLabel = examType || "Exam";

  // Estimate total candidates from exam type
  const candidateMap: Record<string, number> = {
    NEET: 2400000, "JEE Main": 1200000, "JEE Advanced": 250000,
    UPSC: 1200000, CAT: 300000, GATE: 900000, SSC: 3000000,
    CLAT: 70000, Boards: 5000000,
  };
  const totalCandidates = (examType && candidateMap[examType]) || 1000000;

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

  // Determine zone based on activity score
  let rankStatus: SafePassData["rankStatus"];
  let currentZone: string;
  if (activityScore >= 85) {
    rankStatus = "topper";
    currentZone = "🏆 Topper Zone — Outstanding Activity";
  } else if (activityScore >= 70) {
    rankStatus = "comfortable";
    currentZone = "🎯 Comfortable — Strong Preparation";
  } else if (activityScore >= 50) {
    rankStatus = "safe";
    currentZone = "✅ Safe Zone — On Track";
  } else if (activityScore >= 30) {
    rankStatus = "borderline";
    currentZone = "⚡ Borderline — Needs More Effort";
  } else {
    rankStatus = "at_risk";
    currentZone = "🔴 At Risk — Study More to Improve";
  }

  // Pass probability from activity score
  let passProbability: number;
  if (activityScore >= 90) passProbability = 95;
  else if (activityScore >= 80) passProbability = 88;
  else if (activityScore >= 70) passProbability = 78;
  else if (activityScore >= 60) passProbability = 65;
  else if (activityScore >= 50) passProbability = 52;
  else if (activityScore >= 40) passProbability = 38;
  else if (activityScore >= 25) passProbability = 22;
  else passProbability = 10;

  // Exam urgency adjustment
  if (daysToExam !== null && daysToExam <= 30 && activityScore < 60) {
    passProbability = Math.max(5, passProbability - Math.round((30 - daysToExam) * 0.4));
  }

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

/* ─── UI helpers ─── */
const probColor = (p: number) =>
  p >= 75 ? "hsl(var(--success))" : p >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

const statusColor = (s: SafePassData["rankStatus"]) =>
  s === "topper" || s === "comfortable" ? "hsl(var(--success))"
  : s === "safe" ? "hsl(var(--primary))"
  : s === "borderline" ? "hsl(var(--warning))"
  : "hsl(var(--destructive))";

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
  const color = data ? statusColor(data.rankStatus) : "hsl(var(--muted-foreground))";

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            className="fixed inset-x-4 top-[8%] z-[101] mx-auto max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-border/50 shadow-2xl"
            style={{ background: "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--secondary)/0.6) 40%, hsl(var(--card)) 100%)" }}
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />

            {/* Header */}
            <div className="relative p-5 pb-3">
              <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
                <X className="w-4 h-4" />
              </motion.button>
              <div className="flex items-center gap-2.5 mb-1">
                <motion.div
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--success)/0.15))", border: "1px solid hsl(var(--primary)/0.3)" }}
                  animate={{ boxShadow: ["0 0 0px hsl(var(--primary)/0)", "0 0 16px hsl(var(--primary)/0.4)", "0 0 0px hsl(var(--primary)/0)"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Shield className="w-5 h-5 text-primary" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Safe Pass Prediction</h2>
                  <p className="text-[9px] text-muted-foreground">
                    Based on your app activity & study effort
                  </p>
                </div>
              </div>
              {data?.daysToExam != null && (
                <motion.div
                  className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[9px] font-bold"
                  style={{ background: data.daysToExam <= 7 ? "hsl(var(--destructive)/0.15)" : "hsl(var(--primary)/0.1)", color: data.daysToExam <= 7 ? "hsl(var(--destructive))" : "hsl(var(--primary))" }}
                  initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring" }}
                >
                  <Target className="w-3 h-3" />
                  {data.daysToExam} days to {data.examLabel}
                </motion.div>
              )}
            </div>

            {!data ? (
              <div className="px-5 pb-6 text-center">
                <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">Add topics & start studying to generate prediction</p>
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-4">

                {/* ── Activity Score + Predicted Rank Range ── */}
                <motion.div
                  className="rounded-2xl p-4 text-center relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--card)))", border: `1px solid ${color}30` }}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                >
                  {/* Current Rank */}
                  <p className="text-[9px] text-muted-foreground mb-1">Your Current Rank</p>
                  <motion.p
                    className="text-3xl font-extrabold tabular-nums text-foreground"
                    initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  >
                    #{data.currentRank.toLocaleString()}
                  </motion.p>

                  {/* Zone badge */}
                  <motion.span
                    className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mt-2"
                    style={{ background: `${color}20`, color }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }}
                  >
                    {data.currentZone}
                  </motion.span>

                  {/* Predicted Safe Rank Range (activity-based) */}
                  <div className="mt-4 rounded-xl p-3" style={{ background: "linear-gradient(135deg, hsl(var(--success)/0.08), hsl(var(--secondary)/0.4))", border: "1px solid hsl(var(--success)/0.25)" }}>
                    <p className="text-[9px] text-success font-semibold mb-1.5 flex items-center justify-center gap-1">
                      <Target className="w-3 h-3" />
                      🎯 Predicted Rank Range to Pass {data.examLabel}
                    </p>
                    <motion.p className="text-xl font-extrabold text-success tabular-nums"
                      initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                      #{data.predictedSafeRankRange[0].toLocaleString()} — #{data.predictedSafeRankRange[1].toLocaleString()}
                    </motion.p>
                    <p className="text-[8px] text-muted-foreground mt-1">
                      Based on your study effort, this is where you'll likely land
                    </p>
                  </div>

                  {/* Activity Score gauge + Pass probability */}
                  <div className="flex items-center justify-center gap-6 mt-4">
                    {/* Activity Score */}
                    <div className="text-center">
                      <div className="relative w-14 h-14">
                        <svg viewBox="0 0 68 68" className="w-full h-full -rotate-90">
                          <circle cx="34" cy="34" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                          <motion.circle cx="34" cy="34" r="28" fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 28}
                            initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - data.activityScore / 100) }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                            style={{ filter: `drop-shadow(0 0 6px ${color})` }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.span className="text-sm font-extrabold text-foreground tabular-nums"
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                            {data.activityScore}
                          </motion.span>
                        </div>
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-1">Activity Score</p>
                    </div>
                    {/* Pass probability */}
                    <div className="text-center">
                      <div className="relative w-14 h-14">
                        <svg viewBox="0 0 68 68" className="w-full h-full -rotate-90">
                          <circle cx="34" cy="34" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                          <motion.circle cx="34" cy="34" r="28" fill="none" stroke={probColor(data.passProbability)} strokeWidth="5" strokeLinecap="round"
                            strokeDasharray={2 * Math.PI * 28}
                            initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                            animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - data.passProbability / 100) }}
                            transition={{ duration: 1.2, ease: "easeOut", delay: 0.5 }}
                            style={{ filter: `drop-shadow(0 0 6px ${probColor(data.passProbability)})` }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <motion.span className="text-sm font-extrabold text-foreground tabular-nums"
                            initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                            {data.passProbability}%
                          </motion.span>
                        </div>
                      </div>
                      <p className="text-[8px] text-muted-foreground mt-1">Pass Chance</p>
                    </div>
                  </div>
                </motion.div>

                {/* ── Your Activity Breakdown ── */}
                <motion.div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-3 flex items-center gap-1">
                    <Brain className="w-3 h-3 text-primary" />
                    What's Driving Your Prediction
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl bg-secondary/40 p-2.5 text-center border border-border/20">
                      <Clock className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                      <p className="text-sm font-extrabold text-foreground tabular-nums">{data.metrics.totalStudyMinutes}</p>
                      <p className="text-[7px] text-muted-foreground">Total Minutes</p>
                    </div>
                    <div className="rounded-xl bg-secondary/40 p-2.5 text-center border border-border/20">
                      <BookOpen className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                      <p className="text-sm font-extrabold text-foreground tabular-nums">{data.metrics.totalSessions}</p>
                      <p className="text-[7px] text-muted-foreground">Sessions Done</p>
                    </div>
                    <div className="rounded-xl bg-secondary/40 p-2.5 text-center border border-border/20">
                      <Flame className="w-3.5 h-3.5 text-warning mx-auto mb-1" />
                      <p className="text-sm font-extrabold text-foreground tabular-nums">{data.metrics.streakDays}</p>
                      <p className="text-[7px] text-muted-foreground">Day Streak</p>
                    </div>
                    <div className="rounded-xl bg-secondary/40 p-2.5 text-center border border-border/20">
                      <Target className="w-3.5 h-3.5 text-success mx-auto mb-1" />
                      <p className="text-sm font-extrabold text-foreground tabular-nums">
                        {data.metrics.topicsStrong}/{data.metrics.topicsCovered}
                      </p>
                      <p className="text-[7px] text-muted-foreground">Topics Strong</p>
                    </div>
                  </div>
                  {/* Memory strength bar */}
                  <div className="mt-3">
                    <div className="flex justify-between mb-1">
                      <span className="text-[8px] text-muted-foreground">Avg Memory Strength</span>
                      <span className="text-[8px] font-bold text-foreground">{data.metrics.avgMemoryStrength}%</span>
                    </div>
                    <div className="w-full h-1.5 rounded-full bg-border/40 overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: `linear-gradient(90deg, hsl(var(--destructive)), hsl(var(--warning)), hsl(var(--success)))` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${data.metrics.avgMemoryStrength}%` }}
                        transition={{ duration: 1, delay: 0.4 }}
                      />
                    </div>
                  </div>
                </motion.div>

                {/* ── Improvement Tips (Addiction Hook) ── */}
                {data.improvementTips.length > 0 && (
                  <motion.div className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <p className="text-[9px] font-semibold text-primary uppercase tracking-wider mb-2.5 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> Do This to Improve Rank
                    </p>
                    <div className="space-y-2">
                      {data.improvementTips.map((tip, i) => (
                        <motion.div key={i}
                          className="flex items-center gap-2.5 rounded-xl bg-card/60 px-3 py-2.5 border border-border/30"
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.08 }}>
                          <span className="text-base">{tip.icon}</span>
                          <div className="flex-1">
                            <p className="text-[10px] text-foreground font-medium">{tip.label}</p>
                            <p className="text-[8px] text-success font-bold">{tip.impact}</p>
                          </div>
                          <ArrowUpRight className="w-3.5 h-3.5 text-success shrink-0" />
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── Topic Gaps ── */}
                {data.topicGaps.length > 0 && (
                  <motion.div className="rounded-2xl border border-warning/20 bg-warning/5 p-4"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}>
                    <p className="text-[9px] font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Weak Topics Holding You Back
                    </p>
                    <div className="space-y-1.5">
                      {data.topicGaps.map((gap, i) => (
                        <motion.div key={i}
                          className="flex items-center gap-2 rounded-xl bg-card/50 px-3 py-2 border border-border/30"
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.45 + i * 0.06 }}>
                          <div className="w-2 h-2 rounded-full bg-warning shrink-0" />
                          <span className="text-[10px] text-foreground truncate flex-1">{gap.name}</span>
                          <span className="text-[10px] text-destructive font-bold tabular-nums">{gap.strength}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── What-If Scenarios ── */}
                <motion.div className="rounded-2xl relative overflow-hidden p-4"
                  style={{ background: "linear-gradient(135deg, hsl(var(--success)/0.08), hsl(var(--card)))", border: "1px solid hsl(var(--success)/0.25)" }}
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
                  <motion.div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-success/40"
                    animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 2, repeat: Infinity }} />
                  <p className="text-[9px] font-semibold text-success uppercase tracking-wider mb-3 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3" /> What If You Do More?
                  </p>
                  <div className="grid grid-cols-3 gap-2">
                    <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                      <span className="text-base">⏱️</span>
                      <motion.p className="text-xs font-extrabold text-success tabular-nums mt-1"
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                        #{data.whatIf.if30MinMore.toLocaleString()}
                      </motion.p>
                      <p className="text-[7px] text-muted-foreground">+30 min/day</p>
                    </div>
                    <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                      <span className="text-base">📚</span>
                      <motion.p className="text-xs font-extrabold text-success tabular-nums mt-1"
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                        #{data.whatIf.if3TopicsFix.toLocaleString()}
                      </motion.p>
                      <p className="text-[7px] text-muted-foreground">Fix 3 topics</p>
                    </div>
                    <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                      <span className="text-base">🔥</span>
                      <motion.p className="text-xs font-extrabold text-success tabular-nums mt-1"
                        initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: "spring" }}>
                        #{data.whatIf.ifStreakBonus.toLocaleString()}
                      </motion.p>
                      <p className="text-[7px] text-muted-foreground">Keep streak</p>
                    </div>
                  </div>
                  <motion.p className="text-[9px] text-success/80 text-center mt-3 font-medium"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                    More you study → Better your predicted rank 🚀
                  </motion.p>
                </motion.div>

                {data.topicGaps.length === 0 && (
                  <motion.div className="rounded-2xl bg-success/10 border border-success/20 p-4 text-center"
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
                    <Trophy className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-xs text-success font-semibold">All Topics Strong!</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Keep revising to maintain your rank</p>
                  </motion.div>
                )}

                <p className="text-[7px] text-muted-foreground/40 text-center italic pt-1">
                  Prediction based on {data.metrics.totalStudyMinutes} min studied • {data.metrics.totalSessions} sessions • {data.metrics.daysActive} active days • {data.metrics.topicsCovered} topics
                </p>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default SafePassPopup;
