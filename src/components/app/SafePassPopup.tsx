import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Shield, AlertTriangle, Zap, ArrowUpRight, X, Target, TrendingUp, Brain, Users,
} from "lucide-react";
import { TopicPrediction } from "@/hooks/useMemoryEngine";
import { RankPredictionData } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Peer stats from DB ─── */
interface PeerStats {
  examType: string;
  peerCount: number;
  avgStrength: number;
  topPerformerStrength: number;
}

/* ─── Exam-specific cutoff data ─── */
interface ExamCutoff {
  label: string;
  totalCandidates: number;
  safeRankCutoff: number;       // rank <= this = safe to pass
  comfortableRankCutoff: number; // rank <= this = comfortable
  topperRankCutoff: number;      // rank <= this = topper zone
}

const EXAM_CUTOFFS: Record<string, ExamCutoff> = {
  NEET:          { label: "NEET",          totalCandidates: 2400000, safeRankCutoff: 720000, comfortableRankCutoff: 200000, topperRankCutoff: 50000 },
  "JEE Main":    { label: "JEE Main",     totalCandidates: 1200000, safeRankCutoff: 250000, comfortableRankCutoff: 100000, topperRankCutoff: 25000 },
  "JEE Advanced":{ label: "JEE Advanced", totalCandidates: 250000,  safeRankCutoff: 50000,  comfortableRankCutoff: 15000,  topperRankCutoff: 5000 },
  UPSC:          { label: "UPSC",         totalCandidates: 1200000, safeRankCutoff: 15000,  comfortableRankCutoff: 5000,   topperRankCutoff: 1000 },
  CAT:           { label: "CAT",          totalCandidates: 300000,  safeRankCutoff: 30000,  comfortableRankCutoff: 10000,  topperRankCutoff: 2000 },
  GATE:          { label: "GATE",         totalCandidates: 900000,  safeRankCutoff: 50000,  comfortableRankCutoff: 15000,  topperRankCutoff: 3000 },
  SSC:           { label: "SSC CGL",      totalCandidates: 3000000, safeRankCutoff: 100000, comfortableRankCutoff: 30000,  topperRankCutoff: 5000 },
  CLAT:          { label: "CLAT",         totalCandidates: 70000,   safeRankCutoff: 10000,  comfortableRankCutoff: 3000,   topperRankCutoff: 500 },
  Boards:        { label: "Board Exams",  totalCandidates: 5000000, safeRankCutoff: 3000000,comfortableRankCutoff: 1000000,topperRankCutoff: 100000 },
};

const DEFAULT_CUTOFF: ExamCutoff = { label: "Exam", totalCandidates: 1000000, safeRankCutoff: 300000, comfortableRankCutoff: 100000, topperRankCutoff: 20000 };

/* ─── Safe Pass result ─── */
interface SafePassData {
  brainScore: number;
  currentRank: number;
  totalCandidates: number;
  safeRankZone: [number, number];   // [lower, upper] rank range to pass
  percentile: number;
  passProbability: number;
  safeZoneLabel: string;
  topicGaps: { name: string; strength: number; impact: number }[];
  whatIf: {
    improvedRank: number;
    improvedProbability: number;
    minutesNeeded: number;
  };
  factorBreakdown: { label: string; pct: number; weight: string }[];
  daysToExam: number | null;
  examLabel: string;
}

/* ─── Computation ─── */
function computeSafePass(
  allTopics: TopicPrediction[],
  overallHealth: number,
  streakDays: number,
  examDate: string | null,
  rankData: RankPredictionData | null,
  peerStats: PeerStats | null,
): SafePassData | null {
  if (allTopics.length === 0) return null;

  // Use the actual rank from the app's rank prediction system
  const currentRank = rankData?.predicted_rank ?? 0;
  if (currentRank <= 0) return null;

  // Determine exam cutoff
  const examType = peerStats?.examType ?? "";
  const cutoff = EXAM_CUTOFFS[examType] ?? DEFAULT_CUTOFF;

  // Brain Stability Score (for display)
  const avgStrength = allTopics.reduce((s, t) => s + t.memory_strength, 0) / allTopics.length;
  const strongCount = allTopics.filter(t => t.memory_strength >= 70).length;
  const coverageRatio = strongCount / Math.max(allTopics.length, 1);
  const consistencyPct = Math.min(streakDays, 30) / 30 * 100;
  const recencyPct = rankData?.factors?.recency_score ?? (streakDays > 0 ? Math.min(80, 40 + streakDays * 2) : 30);
  const decayPct = rankData?.factors?.decay_velocity_score ?? Math.max(20, 100 - allTopics.filter(t => t.memory_strength < 40).length * 15);
  const volumePct = Math.min(100, allTopics.length * 3);

  let daysToExam: number | null = null;
  let examPressurePct = 50;
  if (examDate) {
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    daysToExam = Math.max(0, diff);
    const prep = avgStrength * coverageRatio / 100;
    examPressurePct = daysToExam <= 7
      ? (prep > 0.5 ? 85 : 25)
      : daysToExam <= 30
        ? (prep > 0.4 ? 70 : 35)
        : 50 + (prep > 0.5 ? 15 : -10);
  }

  const brainScore = Math.round(
    overallHealth * 0.35 + avgStrength * 0.25 + coverageRatio * 100 * 0.15 +
    consistencyPct * 0.10 + recencyPct * 0.05 + decayPct * 0.05 +
    volumePct * 0.03 + examPressurePct * 0.02
  );

  // Safe Rank Zone: based on current rank vs exam cutoffs
  // Safe zone = the rank range needed to pass/qualify
  const safeRankZone: [number, number] = [1, cutoff.safeRankCutoff];

  // Percentile based on current rank position in total candidates
  const percentile = Math.round(Math.max(1, Math.min(99, (1 - currentRank / cutoff.totalCandidates) * 100)));

  // Zone label based on rank vs cutoffs
  const safeZoneLabel =
    currentRank <= cutoff.topperRankCutoff ? "🏆 Topper Zone" :
    currentRank <= cutoff.comfortableRankCutoff ? "🎯 Comfortable Zone" :
    currentRank <= cutoff.safeRankCutoff ? "✅ Safe Zone" :
    currentRank <= cutoff.safeRankCutoff * 1.3 ? "⚡ Borderline Zone" :
    "🔴 At Risk Zone";

  // Pass probability: how likely to pass based on rank vs safe cutoff
  const rankRatio = currentRank / cutoff.safeRankCutoff;
  const passProbability = Math.round(Math.min(95, Math.max(10,
    rankRatio <= 0.1 ? 95 :                                    // Top 10% of cutoff
    rankRatio <= 0.3 ? 90 - (rankRatio - 0.1) * 25 :          // 85-90%
    rankRatio <= 0.5 ? 85 - (rankRatio - 0.3) * 25 :          // 80-85%
    rankRatio <= 0.8 ? 75 - (rankRatio - 0.5) * 33 :          // 65-75%
    rankRatio <= 1.0 ? 55 - (rankRatio - 0.8) * 50 :          // 45-55%
    rankRatio <= 1.3 ? 35 - (rankRatio - 1.0) * 50 :          // 20-35%
    10                                                          // Beyond 130% of cutoff
  )));

  // Topic gaps
  const topicGaps = [...allTopics]
    .filter(t => t.memory_strength < 60)
    .sort((a, b) => a.memory_strength - b.memory_strength)
    .slice(0, 5)
    .map(t => ({
      name: t.name,
      strength: Math.round(t.memory_strength),
      impact: Math.round((60 - t.memory_strength) * 0.5),
    }));

  // What-if: improving top 3 weak topics would boost rank
  const totalGapImpact = topicGaps.slice(0, 3).reduce((s, g) => s + g.impact, 0);
  // Each point of brain score improvement could improve rank by ~1-2% of current position
  const rankImprovement = Math.round(currentRank * (totalGapImpact / 100) * 0.4);
  const improvedRank = Math.max(1, currentRank - rankImprovement);
  const improvedRatio = improvedRank / cutoff.safeRankCutoff;
  const improvedProbability = Math.round(Math.min(95, Math.max(10,
    improvedRatio <= 0.1 ? 95 :
    improvedRatio <= 0.3 ? 90 - (improvedRatio - 0.1) * 25 :
    improvedRatio <= 0.5 ? 85 - (improvedRatio - 0.3) * 25 :
    improvedRatio <= 0.8 ? 75 - (improvedRatio - 0.5) * 33 :
    improvedRatio <= 1.0 ? 55 - (improvedRatio - 0.8) * 50 :
    improvedRatio <= 1.3 ? 35 - (improvedRatio - 1.0) * 50 :
    10
  )));

  const factorBreakdown = [
    { label: "Brain Health", pct: overallHealth, weight: "35%" },
    { label: "Memory Strength", pct: Math.round(avgStrength), weight: "25%" },
    { label: "Topic Coverage", pct: Math.round(coverageRatio * 100), weight: "15%" },
    { label: "Study Consistency", pct: Math.round(consistencyPct), weight: "10%" },
    { label: "Recency Momentum", pct: Math.round(recencyPct), weight: "5%" },
    { label: "Decay Control", pct: Math.round(decayPct), weight: "5%" },
    { label: "Study Volume", pct: Math.round(volumePct), weight: "3%" },
    { label: "Exam Readiness", pct: Math.round(examPressurePct), weight: "2%" },
  ];

  return {
    brainScore,
    currentRank,
    totalCandidates: cutoff.totalCandidates,
    safeRankZone,
    percentile,
    passProbability,
    safeZoneLabel,
    topicGaps,
    whatIf: {
      improvedRank,
      improvedProbability,
      minutesNeeded: topicGaps.slice(0, 3).length * 15,
    },
    factorBreakdown,
    daysToExam,
    examLabel: peerStats?.examType ?? "Your Exam",
  };
}

/* ─── UI helpers ─── */
const probColor = (p: number) =>
  p >= 75 ? "hsl(var(--success))" : p >= 55 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

const zoneColor = (pct: number) =>
  pct >= 75 ? "hsl(var(--success))" : pct >= 50 ? "hsl(var(--primary))" : pct >= 30 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

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
  const [peerStats, setPeerStats] = useState<PeerStats | null>(null);

  useEffect(() => {
    if (!open || !user) return;

    // Fetch user's exam info + peer stats in parallel
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_type, exam_date")
        .eq("id", user.id)
        .single();

      if (!profile) return;
      setExamDate(profile.exam_date);

      if (profile.exam_type) {
        // Get peer stats for same exam type
        const { data: peers } = await supabase
          .from("profiles")
          .select("id")
          .eq("exam_type", profile.exam_type);

        const peerIds = (peers || []).map(p => p.id);

        if (peerIds.length > 0) {
          const { data: topicStats } = await supabase
            .from("topics")
            .select("user_id, memory_strength")
            .in("user_id", peerIds)
            .is("deleted_at", null);

          if (topicStats && topicStats.length > 0) {
            // Group by user and compute per-user avg
            const userAvgs: Record<string, number[]> = {};
            topicStats.forEach(t => {
              if (!userAvgs[t.user_id]) userAvgs[t.user_id] = [];
              userAvgs[t.user_id].push(t.memory_strength);
            });

            const userScores = Object.values(userAvgs).map(
              strengths => strengths.reduce((a, b) => a + b, 0) / strengths.length
            );

            setPeerStats({
              examType: profile.exam_type,
              peerCount: userScores.length,
              avgStrength: userScores.reduce((a, b) => a + b, 0) / userScores.length,
              topPerformerStrength: Math.max(...userScores),
            });
          } else {
            setPeerStats({
              examType: profile.exam_type,
              peerCount: peerIds.length,
              avgStrength: 50,
              topPerformerStrength: 80,
            });
          }
        }
      }
    })();
  }, [open, user]);

  const data = computeSafePass(allTopics, overallHealth, streakDays, examDate, rankData ?? null, peerStats);

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
            style={{
              background: "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--secondary)/0.6) 40%, hsl(var(--card)) 100%)",
            }}
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-success/10 blur-2xl pointer-events-none" />

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
                  <Brain className="w-5 h-5 text-primary" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Safe Pass Prediction</h2>
                  <p className="text-[9px] text-muted-foreground flex items-center gap-1">
                    <Users className="w-2.5 h-2.5" />
                    Based on Brain Stability Score
                    {peerStats && ` • ${peerStats.peerCount} ${peerStats.examType} peers`}
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
                  {data.daysToExam} days to exam
                </motion.div>
              )}
            </div>

            {!data ? (
              <div className="px-5 pb-6 text-center">
                <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">Add topics to generate prediction</p>
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-4">

                {/* ── Brain Score + Zone + Rank ── */}
                <motion.div
                  className="rounded-2xl p-4 text-center relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--card)))", border: "1px solid hsl(var(--primary)/0.2)" }}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                >
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{ background: "linear-gradient(180deg, transparent 0%, hsl(var(--primary)/0.06) 50%, transparent 100%)", height: "30%" }}
                    animate={{ y: ["0%", "300%", "0%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />

                  {/* Brain Score big number */}
                  <p className="text-[9px] text-muted-foreground mb-1 relative z-10">Brain Stability Score</p>
                  <motion.p
                    className="text-4xl font-extrabold tabular-nums relative z-10"
                    style={{ color: zoneColor(data.percentile) }}
                    initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  >
                    {data.brainScore}
                  </motion.p>

                  {/* Zone badge */}
                  <motion.span
                    className="inline-block px-3 py-1 rounded-full text-[10px] font-bold mt-1 relative z-10"
                    style={{ background: `${zoneColor(data.percentile)}20`, color: zoneColor(data.percentile) }}
                    initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.4, type: "spring" }}
                  >
                    {data.safeZoneLabel}
                  </motion.span>

                  {/* Current Rank + Safe Zone */}
                  <div className="flex items-center justify-center gap-6 mt-4 relative z-10">
                    <div className="text-center">
                      <motion.p className="text-lg font-extrabold text-foreground tabular-nums"
                        initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                        #{data.currentRank.toLocaleString()}
                      </motion.p>
                      <p className="text-[8px] text-muted-foreground">Your Current Rank</p>
                    </div>
                    <div className="w-px h-8 bg-border/40" />
                    <div className="text-center">
                      <motion.p className="text-lg font-extrabold tabular-nums"
                        style={{ color: zoneColor(data.percentile) }}
                        initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }}>
                        ≤ {data.safeRankZone[1].toLocaleString()}
                      </motion.p>
                      <p className="text-[8px] text-muted-foreground">Safe Rank to Pass {data.examLabel}</p>
                    </div>
                  </div>

                  {/* Pass probability gauge */}
                  <div className="flex items-center justify-center gap-4 mt-4 relative z-10">
                    <div className="relative w-14 h-14">
                      <svg viewBox="0 0 68 68" className="w-full h-full -rotate-90">
                        <circle cx="34" cy="34" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                        <motion.circle cx="34" cy="34" r="28" fill="none" stroke={probColor(data.passProbability)} strokeWidth="5" strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 28}
                          initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                          animate={{ strokeDashoffset: 2 * Math.PI * 28 * (1 - data.passProbability / 100) }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                          style={{ filter: `drop-shadow(0 0 6px ${probColor(data.passProbability)})` }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <motion.span className="text-sm font-extrabold text-foreground tabular-nums"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                          {data.passProbability}%
                        </motion.span>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">Pass Probability</p>
                      <p className="text-[9px] text-muted-foreground">
                        {data.passProbability >= 75 ? "You're in the safe zone 🎯"
                          : data.passProbability >= 55 ? "Keep pushing, almost there 📈"
                          : "Focus on weak topics ⚡"}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* ── Factor Breakdown ── */}
                <motion.div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    Brain Score Breakdown
                  </p>
                  <div className="space-y-2">
                    {data.factorBreakdown.map((f, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-foreground">{f.label}</span>
                          <span className="text-[9px] text-muted-foreground">{f.pct}% <span className="text-[7px]">({f.weight})</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                          <motion.div className="h-full rounded-full"
                            style={{ background: f.pct >= 70 ? "hsl(var(--success))" : f.pct >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))" }}
                            initial={{ width: 0 }} animate={{ width: `${f.pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3 + i * 0.08 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* ── Topic Gaps ── */}
                {data.topicGaps.length > 0 && (
                  <motion.div className="rounded-2xl border border-warning/20 bg-warning/5 p-4"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <p className="text-[9px] font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Topics Holding Your Score Back
                    </p>
                    <div className="space-y-1.5">
                      {data.topicGaps.map((gap, i) => (
                        <motion.div key={i}
                          className="flex items-center gap-2 rounded-xl bg-card/50 px-3 py-2 border border-border/30"
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.06 }}>
                          <div className="w-2 h-2 rounded-full bg-warning shrink-0" />
                          <span className="text-[10px] text-foreground truncate flex-1">{gap.name}</span>
                          <span className="text-[10px] text-destructive font-bold tabular-nums">{gap.strength}%</span>
                          <span className="text-[9px] text-success font-medium">+{gap.impact}pt</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── What-If ── */}
                {data.topicGaps.length > 0 && (
                  <motion.div className="rounded-2xl relative overflow-hidden p-4"
                    style={{ background: "linear-gradient(135deg, hsl(var(--success)/0.08), hsl(var(--card)))", border: "1px solid hsl(var(--success)/0.25)" }}
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
                    <motion.div className="absolute top-2 right-2 w-3 h-3 rounded-full bg-success/40"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }} />
                    <p className="text-[9px] font-semibold text-success uppercase tracking-wider mb-3 flex items-center gap-1">
                      <Zap className="w-3 h-3" /> What If You Fix Top 3 Weak Topics?
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <span className="text-[8px] text-muted-foreground line-through tabular-nums">#{data.currentRank.toLocaleString()}</span>
                          <ArrowUpRight className="w-2.5 h-2.5 text-success" />
                        </div>
                        <motion.p className="text-base font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                          #{data.whatIf.improvedRank.toLocaleString()}
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Predicted Rank</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <ArrowUpRight className="w-2.5 h-2.5 text-success mx-auto mb-0.5" />
                        <motion.p className="text-base font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                          {data.whatIf.improvedProbability}%
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Pass Chance</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <ArrowUpRight className="w-2.5 h-2.5 text-success mx-auto mb-0.5" />
                        <motion.p className="text-base font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: "spring" }}>
                          ↑{(data.currentRank - data.whatIf.improvedRank).toLocaleString()}
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Rank Jump</p>
                      </div>
                    </div>
                    <motion.p className="text-[10px] text-success/80 text-center mt-3 font-medium"
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}>
                      ⏱️ ~{data.whatIf.minutesNeeded} min of focused study needed
                    </motion.p>
                  </motion.div>
                )}

                {data.topicGaps.length === 0 && (
                  <motion.div className="rounded-2xl bg-success/10 border border-success/20 p-4 text-center"
                    initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.35 }}>
                    <Shield className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-xs text-success font-semibold">All Topics Above Safe Threshold!</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Your brain stability is strong. Keep it up!</p>
                  </motion.div>
                )}

                <p className="text-[7px] text-muted-foreground/40 text-center italic pt-1">
                  Ranked by Brain Stability Score among {data.examLabel} peers on this platform
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
