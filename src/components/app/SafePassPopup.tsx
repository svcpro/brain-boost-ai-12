import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Shield, AlertTriangle, Zap, ArrowUpRight, X, Target, TrendingUp, Brain, Users,
} from "lucide-react";
import { TopicPrediction } from "@/hooks/useMemoryEngine";
import { RankPredictionData } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Exam-specific real cutoff data (2025-2026 based) ─── */
interface ExamConfig {
  label: string;
  totalCandidates: number;
  /** General category qualifying cutoff rank */
  qualifyingCutoffRank: number;
  /** Government/top college safe cutoff rank */
  governmentSeatCutoff: number;
  /** Top college / topper cutoff rank */
  topCollegeCutoff: number;
  /** Category-wise cutoff ranges [General, OBC, SC, ST] */
  categoryRanks: { label: string; cutoff: number }[];
}

const EXAM_CONFIGS: Record<string, ExamConfig> = {
  NEET: {
    label: "NEET",
    totalCandidates: 2400000,
    qualifyingCutoffRank: 800000,
    governmentSeatCutoff: 85000,
    topCollegeCutoff: 15000,
    categoryRanks: [
      { label: "General", cutoff: 720000 },
      { label: "OBC", cutoff: 780000 },
      { label: "SC", cutoff: 850000 },
      { label: "ST", cutoff: 900000 },
    ],
  },
  "JEE Main": {
    label: "JEE Main",
    totalCandidates: 1200000,
    qualifyingCutoffRank: 250000,
    governmentSeatCutoff: 35000,
    topCollegeCutoff: 10000,
    categoryRanks: [
      { label: "General", cutoff: 250000 },
      { label: "OBC", cutoff: 320000 },
      { label: "SC", cutoff: 400000 },
      { label: "ST", cutoff: 450000 },
    ],
  },
  "JEE Advanced": {
    label: "JEE Advanced",
    totalCandidates: 250000,
    qualifyingCutoffRank: 40000,
    governmentSeatCutoff: 10000,
    topCollegeCutoff: 2000,
    categoryRanks: [
      { label: "General", cutoff: 40000 },
      { label: "OBC", cutoff: 55000 },
      { label: "SC", cutoff: 70000 },
      { label: "ST", cutoff: 80000 },
    ],
  },
  UPSC: {
    label: "UPSC CSE",
    totalCandidates: 1200000,
    qualifyingCutoffRank: 15000,
    governmentSeatCutoff: 5000,
    topCollegeCutoff: 1000,
    categoryRanks: [
      { label: "General", cutoff: 800 },
      { label: "OBC", cutoff: 1200 },
      { label: "SC", cutoff: 2000 },
      { label: "ST", cutoff: 2500 },
    ],
  },
  CAT: {
    label: "CAT",
    totalCandidates: 300000,
    qualifyingCutoffRank: 30000,
    governmentSeatCutoff: 5000,
    topCollegeCutoff: 1000,
    categoryRanks: [
      { label: "General", cutoff: 30000 },
      { label: "OBC", cutoff: 40000 },
      { label: "SC", cutoff: 50000 },
      { label: "ST", cutoff: 55000 },
    ],
  },
  GATE: {
    label: "GATE",
    totalCandidates: 900000,
    qualifyingCutoffRank: 50000,
    governmentSeatCutoff: 10000,
    topCollegeCutoff: 2000,
    categoryRanks: [
      { label: "General", cutoff: 50000 },
      { label: "OBC", cutoff: 65000 },
      { label: "SC", cutoff: 80000 },
      { label: "ST", cutoff: 90000 },
    ],
  },
  SSC: {
    label: "SSC CGL",
    totalCandidates: 3000000,
    qualifyingCutoffRank: 100000,
    governmentSeatCutoff: 25000,
    topCollegeCutoff: 5000,
    categoryRanks: [
      { label: "General", cutoff: 100000 },
      { label: "OBC", cutoff: 130000 },
      { label: "SC", cutoff: 160000 },
      { label: "ST", cutoff: 180000 },
    ],
  },
  CLAT: {
    label: "CLAT",
    totalCandidates: 70000,
    qualifyingCutoffRank: 10000,
    governmentSeatCutoff: 3000,
    topCollegeCutoff: 500,
    categoryRanks: [
      { label: "General", cutoff: 10000 },
      { label: "OBC", cutoff: 13000 },
      { label: "SC", cutoff: 16000 },
      { label: "ST", cutoff: 18000 },
    ],
  },
  Boards: {
    label: "Board Exams",
    totalCandidates: 5000000,
    qualifyingCutoffRank: 4000000,
    governmentSeatCutoff: 1000000,
    topCollegeCutoff: 100000,
    categoryRanks: [
      { label: "General", cutoff: 4000000 },
    ],
  },
};

const DEFAULT_CONFIG: ExamConfig = {
  label: "Exam",
  totalCandidates: 1000000,
  qualifyingCutoffRank: 300000,
  governmentSeatCutoff: 50000,
  topCollegeCutoff: 10000,
  categoryRanks: [{ label: "General", cutoff: 300000 }],
};

/* ─── Result ─── */
interface SafePassData {
  currentRank: number;
  examConfig: ExamConfig;
  safeRankZone: [number, number];   // predicted safe zone range
  zoneLabel: string;
  passProbability: number;
  rankStatus: "topper" | "comfortable" | "safe" | "borderline" | "at_risk";
  topicGaps: { name: string; strength: number; rankImpact: number }[];
  whatIf: {
    improvedRank: number;
    improvedProbability: number;
    minutesNeeded: number;
  };
  daysToExam: number | null;
  percentileAmongCandidates: number;
}

/* ─── Computation ─── */
function computeSafePass(
  allTopics: TopicPrediction[],
  overallHealth: number,
  streakDays: number,
  examDate: string | null,
  rankData: RankPredictionData | null,
  examType: string | null,
): SafePassData | null {
  if (allTopics.length === 0) return null;

  const currentRank = rankData?.predicted_rank ?? 0;
  if (currentRank <= 0) return null;

  const config = (examType && EXAM_CONFIGS[examType]) ? EXAM_CONFIGS[examType] : DEFAULT_CONFIG;

  // Days to exam
  let daysToExam: number | null = null;
  if (examDate) {
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    daysToExam = Math.max(0, diff);
  }

  // Percentile among total candidates
  const percentileAmongCandidates = Math.round(
    Math.max(1, Math.min(99.9, (1 - currentRank / config.totalCandidates) * 100) * 10) / 10
  );

  // Determine rank status & zone label
  let rankStatus: SafePassData["rankStatus"];
  let zoneLabel: string;
  if (currentRank <= config.topCollegeCutoff) {
    rankStatus = "topper";
    zoneLabel = "🏆 Topper Zone";
  } else if (currentRank <= config.governmentSeatCutoff) {
    rankStatus = "comfortable";
    zoneLabel = "🎯 Comfortable Zone";
  } else if (currentRank <= config.qualifyingCutoffRank) {
    rankStatus = "safe";
    zoneLabel = "✅ Safe to Pass";
  } else if (currentRank <= config.qualifyingCutoffRank * 1.2) {
    rankStatus = "borderline";
    zoneLabel = "⚡ Borderline — Push Harder";
  } else {
    rankStatus = "at_risk";
    zoneLabel = "🔴 At Risk — Needs Improvement";
  }

  // Safe rank zone: confidence interval around current rank based on preparation variance
  const avgStrength = allTopics.reduce((s, t) => s + t.memory_strength, 0) / allTopics.length;
  const varianceFactor = Math.max(0.03, (100 - avgStrength) / 100 * 0.15);
  const lowerBound = Math.max(1, Math.round(currentRank * (1 - varianceFactor)));
  const upperBound = Math.round(currentRank * (1 + varianceFactor));
  const safeRankZone: [number, number] = [lowerBound, upperBound];

  // Pass probability based on rank vs qualifying cutoff
  const rankRatio = currentRank / config.qualifyingCutoffRank;
  let passProbability: number;
  if (rankRatio <= 0.02) passProbability = 99;
  else if (rankRatio <= 0.05) passProbability = 97;
  else if (rankRatio <= 0.1) passProbability = 95;
  else if (rankRatio <= 0.2) passProbability = 92;
  else if (rankRatio <= 0.4) passProbability = 87;
  else if (rankRatio <= 0.6) passProbability = 80;
  else if (rankRatio <= 0.8) passProbability = 70;
  else if (rankRatio <= 0.95) passProbability = 55;
  else if (rankRatio <= 1.0) passProbability = 45;
  else if (rankRatio <= 1.1) passProbability = 30;
  else if (rankRatio <= 1.3) passProbability = 18;
  else passProbability = 8;

  // Apply days-to-exam adjustment
  if (daysToExam !== null && daysToExam <= 30) {
    if (rankStatus === "borderline" || rankStatus === "at_risk") {
      passProbability = Math.max(5, passProbability - Math.round((30 - daysToExam) * 0.3));
    }
  }

  // Topic gaps with rank impact
  const topicGaps = [...allTopics]
    .filter(t => t.memory_strength < 60)
    .sort((a, b) => a.memory_strength - b.memory_strength)
    .slice(0, 5)
    .map(t => {
      const strengthGap = 60 - t.memory_strength;
      const rankImpact = Math.round(currentRank * (strengthGap / 100) * 0.08);
      return {
        name: t.name,
        strength: Math.round(t.memory_strength),
        rankImpact,
      };
    });

  // What-if: fixing top 3 weak topics
  const totalRankImprovement = topicGaps.slice(0, 3).reduce((s, g) => s + g.rankImpact, 0);
  const improvedRank = Math.max(1, currentRank - totalRankImprovement);
  const improvedRatio = improvedRank / config.qualifyingCutoffRank;
  let improvedProbability: number;
  if (improvedRatio <= 0.02) improvedProbability = 99;
  else if (improvedRatio <= 0.05) improvedProbability = 97;
  else if (improvedRatio <= 0.1) improvedProbability = 95;
  else if (improvedRatio <= 0.2) improvedProbability = 92;
  else if (improvedRatio <= 0.4) improvedProbability = 87;
  else if (improvedRatio <= 0.6) improvedProbability = 80;
  else if (improvedRatio <= 0.8) improvedProbability = 70;
  else if (improvedRatio <= 0.95) improvedProbability = 55;
  else if (improvedRatio <= 1.0) improvedProbability = 45;
  else if (improvedRatio <= 1.1) improvedProbability = 30;
  else improvedProbability = 18;

  return {
    currentRank,
    examConfig: config,
    safeRankZone,
    zoneLabel,
    passProbability,
    rankStatus,
    topicGaps,
    whatIf: {
      improvedRank,
      improvedProbability,
      minutesNeeded: topicGaps.slice(0, 3).length * 15,
    },
    daysToExam,
    percentileAmongCandidates,
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

  useEffect(() => {
    if (!open || !user) return;
    (async () => {
      const { data: profile } = await supabase
        .from("profiles")
        .select("exam_type, exam_date")
        .eq("id", user.id)
        .single();
      if (profile) {
        setExamDate(profile.exam_date);
        setExamType(profile.exam_type);
      }
    })();
  }, [open, user]);

  const data = computeSafePass(allTopics, overallHealth, streakDays, examDate, rankData ?? null, examType);
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
                    Based on your rank #{rankData?.predicted_rank?.toLocaleString() ?? "—"}
                    {data && ` • ${data.examConfig.label}`}
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
                  {data.daysToExam} days to {data.examConfig.label}
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

                {/* ── Your Rank + Predicted Safe Zone ── */}
                <motion.div
                  className="rounded-2xl p-4 text-center relative overflow-hidden"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--card)))", border: `1px solid ${color}30` }}
                  initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                >
                  {/* Current Rank */}
                  <p className="text-[9px] text-muted-foreground mb-1">Your Current Rank</p>
                  <motion.p
                    className="text-4xl font-extrabold tabular-nums"
                    style={{ color }}
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
                    {data.zoneLabel}
                  </motion.span>

                  {/* Predicted Safe Rank Zone */}
                  <div className="mt-4 rounded-xl p-3" style={{ background: "hsl(var(--secondary)/0.4)", border: "1px solid hsl(var(--border)/0.3)" }}>
                    <p className="text-[9px] text-muted-foreground mb-1.5">Predicted Safe Rank Zone</p>
                    <motion.p className="text-xl font-extrabold text-foreground tabular-nums"
                      initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                      #{data.safeRankZone[0].toLocaleString()} — #{data.safeRankZone[1].toLocaleString()}
                    </motion.p>
                    <p className="text-[8px] text-muted-foreground mt-1">
                      Based on your study variance • Top {data.percentileAmongCandidates}% of {data.examConfig.totalCandidates.toLocaleString()} candidates
                    </p>
                  </div>

                  {/* Pass probability gauge */}
                  <div className="flex items-center justify-center gap-4 mt-4">
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
                        {data.passProbability >= 80 ? "You're in the safe zone 🎯"
                          : data.passProbability >= 50 ? "Keep pushing, almost there 📈"
                          : "Focus on weak topics ⚡"}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* ── Exam Cutoff Reference ── */}
                <motion.div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    {data.examConfig.label} Qualifying Cutoffs
                  </p>
                  <div className="space-y-2">
                    {/* Topper */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground">🏆 Top College</span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: data.currentRank <= data.examConfig.topCollegeCutoff ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}>
                        ≤ #{data.examConfig.topCollegeCutoff.toLocaleString()}
                      </span>
                    </div>
                    {/* Govt seat */}
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] text-foreground">🎯 Govt. Seat</span>
                      <span className="text-[10px] font-bold tabular-nums" style={{ color: data.currentRank <= data.examConfig.governmentSeatCutoff ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}>
                        ≤ #{data.examConfig.governmentSeatCutoff.toLocaleString()}
                      </span>
                    </div>
                    {/* Category cutoffs */}
                    {data.examConfig.categoryRanks.map((cat, i) => (
                      <div key={i} className="flex items-center justify-between">
                        <span className="text-[10px] text-foreground">✅ Qualifying ({cat.label})</span>
                        <span className="text-[10px] font-bold tabular-nums" style={{ color: data.currentRank <= cat.cutoff ? "hsl(var(--success))" : "hsl(var(--muted-foreground))" }}>
                          ≤ #{cat.cutoff.toLocaleString()}
                        </span>
                      </div>
                    ))}
                    {/* Rank position indicator */}
                    <div className="mt-2 pt-2 border-t border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-semibold text-primary">📍 Your Rank</span>
                        <span className="text-[10px] font-extrabold tabular-nums" style={{ color }}>
                          #{data.currentRank.toLocaleString()}
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>

                {/* ── Topic Gaps ── */}
                {data.topicGaps.length > 0 && (
                  <motion.div className="rounded-2xl border border-warning/20 bg-warning/5 p-4"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <p className="text-[9px] font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Weak Topics Affecting Your Rank
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
                          <span className="text-[9px] text-success font-medium">↑{gap.rankImpact.toLocaleString()}</span>
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
                        <motion.p className="text-sm font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                          #{data.whatIf.improvedRank.toLocaleString()}
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">New Rank</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <ArrowUpRight className="w-2.5 h-2.5 text-success mx-auto mb-0.5" />
                        <motion.p className="text-sm font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                          {data.whatIf.improvedProbability}%
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Pass Chance</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <ArrowUpRight className="w-2.5 h-2.5 text-success mx-auto mb-0.5" />
                        <motion.p className="text-sm font-extrabold text-success tabular-nums"
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
                    <Trophy className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-xs text-success font-semibold">All Topics Strong!</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Keep revising to maintain your rank</p>
                  </motion.div>
                )}

                <p className="text-[7px] text-muted-foreground/40 text-center italic pt-1">
                  Prediction based on your rank #{data.currentRank.toLocaleString()} among {data.examConfig.totalCandidates.toLocaleString()} {data.examConfig.label} candidates
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
