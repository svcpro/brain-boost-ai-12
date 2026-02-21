import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Shield, AlertTriangle, Zap, ArrowUpRight, X, Target, TrendingUp,
} from "lucide-react";
import { TopicPrediction } from "@/hooks/useMemoryEngine";
import { RankPredictionData } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ─── Exam-specific configuration ─── */
interface ExamConfig {
  label: string;
  totalCandidates: number;
  qualifyingCutoffRank: number;      // approx rank to "pass"
  topRankZone: number;               // elite zone
  difficultyMultiplier: number;      // 1 = avg, >1 = harder exam
  weightOverrides?: Partial<FactorWeights>;
}

interface FactorWeights {
  memoryStrength: number;
  coverage: number;
  consistency: number;
  brainHealth: number;
  recency: number;
  decayVelocity: number;
  volume: number;
  examPressure: number;
}

const DEFAULT_WEIGHTS: FactorWeights = {
  memoryStrength: 0.25,
  coverage: 0.20,
  consistency: 0.15,
  brainHealth: 0.10,
  recency: 0.10,
  decayVelocity: 0.08,
  volume: 0.07,
  examPressure: 0.05,
};

const EXAM_CONFIGS: Record<string, ExamConfig> = {
  neet: {
    label: "NEET",
    totalCandidates: 2400000,
    qualifyingCutoffRank: 800000,
    topRankZone: 50000,
    difficultyMultiplier: 1.15,
    weightOverrides: { memoryStrength: 0.28, coverage: 0.22, consistency: 0.12 },
  },
  jee: {
    label: "JEE Main",
    totalCandidates: 1200000,
    qualifyingCutoffRank: 350000,
    topRankZone: 25000,
    difficultyMultiplier: 1.25,
    weightOverrides: { memoryStrength: 0.22, coverage: 0.24, decayVelocity: 0.12 },
  },
  "jee-advanced": {
    label: "JEE Advanced",
    totalCandidates: 250000,
    qualifyingCutoffRank: 40000,
    topRankZone: 5000,
    difficultyMultiplier: 1.40,
    weightOverrides: { coverage: 0.26, memoryStrength: 0.24, decayVelocity: 0.14 },
  },
  upsc: {
    label: "UPSC",
    totalCandidates: 1200000,
    qualifyingCutoffRank: 15000,
    topRankZone: 1000,
    difficultyMultiplier: 1.50,
    weightOverrides: { consistency: 0.22, volume: 0.12, memoryStrength: 0.20 },
  },
  cat: {
    label: "CAT",
    totalCandidates: 290000,
    qualifyingCutoffRank: 30000,
    topRankZone: 3000,
    difficultyMultiplier: 1.20,
  },
  gate: {
    label: "GATE",
    totalCandidates: 900000,
    qualifyingCutoffRank: 100000,
    topRankZone: 10000,
    difficultyMultiplier: 1.10,
  },
  ssc: {
    label: "SSC CGL",
    totalCandidates: 3000000,
    qualifyingCutoffRank: 50000,
    topRankZone: 5000,
    difficultyMultiplier: 1.05,
    weightOverrides: { consistency: 0.20, volume: 0.10 },
  },
  clat: {
    label: "CLAT",
    totalCandidates: 75000,
    qualifyingCutoffRank: 15000,
    topRankZone: 2000,
    difficultyMultiplier: 1.10,
  },
  boards: {
    label: "Board Exams",
    totalCandidates: 5000000,
    qualifyingCutoffRank: 2500000,
    topRankZone: 100000,
    difficultyMultiplier: 0.85,
    weightOverrides: { memoryStrength: 0.30, coverage: 0.25, consistency: 0.15 },
  },
};

const DEFAULT_CONFIG: ExamConfig = {
  label: "General Exam",
  totalCandidates: 500000,
  qualifyingCutoffRank: 100000,
  topRankZone: 10000,
  difficultyMultiplier: 1.0,
};

function resolveExamConfig(examType: string | null): ExamConfig {
  if (!examType) return DEFAULT_CONFIG;
  const key = examType.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  // Try exact, then prefix match
  if (EXAM_CONFIGS[key]) return EXAM_CONFIGS[key];
  for (const k of Object.keys(EXAM_CONFIGS)) {
    if (key.includes(k) || k.includes(key)) return EXAM_CONFIGS[k];
  }
  return { ...DEFAULT_CONFIG, label: examType };
}

/* ─── Safe Pass computation ─── */
interface SafePassData {
  safeRankLow: number;
  safeRankHigh: number;
  passProbability: number;
  topicGaps: { name: string; strength: number; impact: number }[];
  whatIf: {
    improvedProbability: number;
    improvedRankLow: number;
    improvedRankHigh: number;
    minutesNeeded: number;
  };
  factorScore: number;
  examConfig: ExamConfig;
  daysToExam: number | null;
  factorBreakdown: { label: string; pct: number; weight: string }[];
}

function computeSafePass(
  allTopics: TopicPrediction[],
  overallHealth: number,
  streakDays: number,
  examType: string | null,
  examDate: string | null,
  rankData: RankPredictionData | null
): SafePassData | null {
  if (allTopics.length === 0) return null;

  const config = resolveExamConfig(examType);
  const w: FactorWeights = { ...DEFAULT_WEIGHTS, ...config.weightOverrides };

  // Normalize weights to sum to 1
  const wSum = Object.values(w).reduce((a, b) => a + b, 0);
  Object.keys(w).forEach(k => (w[k as keyof FactorWeights] /= wSum));

  const avgStrength = allTopics.reduce((s, t) => s + t.memory_strength, 0) / allTopics.length;
  const strongCount = allTopics.filter(t => t.memory_strength >= 70).length;
  const coverageRatio = strongCount / Math.max(allTopics.length, 1);

  // Consistency from streak
  const consistencyPct = Math.min(streakDays, 30) / 30 * 100;

  // Recency: use rank data if available
  const recencyPct = rankData?.factors?.recency_score ?? (streakDays > 0 ? Math.min(80, 40 + streakDays * 2) : 30);
  
  // Decay velocity
  const decayPct = rankData?.factors?.decay_velocity_score ?? Math.max(20, 100 - allTopics.filter(t => t.memory_strength < 40).length * 15);

  // Volume
  const volumePct = rankData?.factors?.composite_score
    ? Math.min(100, rankData.factors.composite_score)
    : Math.min(100, allTopics.length * 5);

  // Exam pressure
  let daysToExam: number | null = null;
  let examPressurePct = 50;
  if (examDate) {
    const diff = Math.ceil((new Date(examDate).getTime() - Date.now()) / 86400000);
    daysToExam = Math.max(0, diff);
    // More pressure = higher urgency score if prepared, lower if not
    const preparedness = avgStrength * coverageRatio;
    if (daysToExam <= 7) {
      examPressurePct = preparedness > 50 ? 85 : 25;
    } else if (daysToExam <= 30) {
      examPressurePct = preparedness > 40 ? 70 : 35;
    } else {
      examPressurePct = 50 + (preparedness > 50 ? 15 : -10);
    }
  }
  examPressurePct = rankData?.factors?.exam_pressure_score ?? examPressurePct;

  // Weighted composite
  const rawScore =
    avgStrength * w.memoryStrength +
    coverageRatio * 100 * w.coverage +
    consistencyPct * w.consistency +
    overallHealth * w.brainHealth +
    recencyPct * w.recency +
    decayPct * w.decayVelocity +
    volumePct * w.volume +
    examPressurePct * w.examPressure;

  // Active-student baseline boost: anyone actively studying with topics
  // is already ahead of a large portion of casual/non-serious candidates.
  // Boost scales with topic count (more topics = more serious preparation).
  const topicMaturityBoost = Math.min(20, allTopics.length * 0.8);
  const activeStudentBoost = 15 + topicMaturityBoost; // 15-35 point baseline
  const boostedScore = Math.min(100, rawScore + activeStudentBoost);

  // Apply difficulty multiplier (harder exam lowers effective score slightly)
  const factorScore = Math.max(0, Math.min(100, boostedScore / config.difficultyMultiplier));

  // Sigmoid-based rank mapping (bell-curve distribution)
  // Real exams follow a normal distribution — most students cluster in the middle.
  // This maps factorScore to a percentile using a sigmoid, then to rank.
  const { totalCandidates, qualifyingCutoffRank } = config;
  
  // Sigmoid: maps 0-100 score to 0-1 percentile with S-curve
  // k controls steepness, midpoint is at score 50
  const k = 0.08; // steepness — lower = smoother curve
  const sigmoid = (score: number) => 1 / (1 + Math.exp(-k * (score - 45)));
  const percentile = sigmoid(factorScore); // 0 to 1, where 1 = top rank
  
  const centerRank = Math.max(1, Math.round(totalCandidates * (1 - percentile)));
  const spreadPct = factorScore > 70 ? 0.02 : factorScore > 50 ? 0.04 : 0.06;
  const spread = Math.round(totalCandidates * spreadPct);
  const safeRankLow = Math.max(1, centerRank - spread);
  const safeRankHigh = Math.min(totalCandidates, centerRank + spread);

  // Pass probability: based on rank position relative to qualifying cutoff
  const passMargin = (qualifyingCutoffRank - centerRank) / qualifyingCutoffRank;
  const baseProbability = 50 + passMargin * 50;
  const passProbability = Math.round(Math.min(95, Math.max(15, baseProbability)));

  // Topic gaps
  const topicGaps = [...allTopics]
    .filter(t => t.memory_strength < 60)
    .sort((a, b) => a.memory_strength - b.memory_strength)
    .slice(0, 5)
    .map(t => ({
      name: t.name,
      strength: Math.round(t.memory_strength),
      impact: Math.round((60 - t.memory_strength) * 0.4 * config.difficultyMultiplier),
    }));

  // What-if simulation
  const potentialGain = topicGaps.slice(0, 3).reduce((s, g) => s + g.impact, 0);
  const improvedScore = Math.min(100, factorScore + potentialGain);
  const improvedPercentile = sigmoid(improvedScore);
  const improvedCenter = Math.max(1, Math.round(totalCandidates * (1 - improvedPercentile)));
  const improvedMargin = (qualifyingCutoffRank - improvedCenter) / qualifyingCutoffRank;
  const improvedProb = Math.round(Math.min(95, Math.max(15, 50 + improvedMargin * 50)));

  const factorBreakdown = [
    { label: "Memory Strength", pct: Math.round(avgStrength), weight: `${Math.round(w.memoryStrength * 100)}%` },
    { label: "Topic Coverage", pct: Math.round(coverageRatio * 100), weight: `${Math.round(w.coverage * 100)}%` },
    { label: "Study Consistency", pct: Math.round(consistencyPct), weight: `${Math.round(w.consistency * 100)}%` },
    { label: "Brain Health", pct: overallHealth, weight: `${Math.round(w.brainHealth * 100)}%` },
    { label: "Recency Momentum", pct: Math.round(recencyPct), weight: `${Math.round(w.recency * 100)}%` },
    { label: "Decay Control", pct: Math.round(decayPct), weight: `${Math.round(w.decayVelocity * 100)}%` },
    { label: "Study Volume", pct: Math.round(volumePct), weight: `${Math.round(w.volume * 100)}%` },
    { label: "Exam Pressure", pct: Math.round(examPressurePct), weight: `${Math.round(w.examPressure * 100)}%` },
  ];

  return {
    safeRankLow,
    safeRankHigh,
    passProbability,
    topicGaps,
    whatIf: {
      improvedProbability: improvedProb,
      improvedRankLow: Math.max(1, improvedCenter - spread),
      improvedRankHigh: Math.min(totalCandidates, improvedCenter + spread),
      minutesNeeded: topicGaps.slice(0, 3).length * 15,
    },
    factorScore,
    examConfig: config,
    daysToExam,
    factorBreakdown,
  };
}

/* ─── UI helpers ─── */
const probColor = (p: number) =>
  p >= 75 ? "hsl(var(--success))" : p >= 55 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

const formatRank = (n: number) => {
  if (n >= 1000000) return `${(n / 1000000).toFixed(1)}M`;
  if (n >= 100000) return `${(n / 1000).toFixed(0)}K`;
  if (n >= 10000) return `${(n / 1000).toFixed(1)}K`;
  return n.toLocaleString();
};

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
  const [examType, setExamType] = useState<string | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !user) return;
    supabase.from("profiles").select("exam_type, exam_date").eq("id", user.id).single()
      .then(({ data }) => {
        if (data) {
          setExamType(data.exam_type);
          setExamDate(data.exam_date);
        }
      });
  }, [open, user]);

  const data = computeSafePass(allTopics, overallHealth, streakDays, examType, examDate, rankData ?? null);

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
                  <Trophy className="w-5 h-5 text-primary" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Safe Pass Prediction</h2>
                  <p className="text-[9px] text-muted-foreground">
                    {data?.examConfig.label ?? "Loading..."} • {data ? `${formatRank(data.examConfig.totalCandidates)} candidates` : ""}
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
                {/* Rank Zone + Probability */}
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
                  <p className="text-[9px] text-muted-foreground mb-1 relative z-10">Your Safe Rank Zone — {data.examConfig.label}</p>
                  <motion.p
                    className="text-2xl font-extrabold text-primary tabular-nums relative z-10"
                    initial={{ scale: 0.7, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  >
                    {formatRank(data.safeRankLow)} — {formatRank(data.safeRankHigh)}
                  </motion.p>
                  <p className="text-[8px] text-muted-foreground relative z-10">
                    out of ~{formatRank(data.examConfig.totalCandidates)} candidates • Cutoff ~{formatRank(data.examConfig.qualifyingCutoffRank)}
                  </p>

                  {/* Probability gauge */}
                  <div className="flex items-center justify-center gap-4 mt-4 relative z-10">
                    <div className="relative w-16 h-16">
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
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span className="text-base font-extrabold text-foreground tabular-nums"
                          initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                          {data.passProbability}%
                        </motion.span>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">Pass Probability</p>
                      <p className="text-[9px] text-muted-foreground">
                        {data.passProbability >= 75 ? "You're in the safe zone 🎯"
                          : data.passProbability >= 55 ? "Getting closer, keep studying 📈"
                          : "Needs more preparation ⚡"}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* Factor Breakdown — 8 factors */}
                <motion.div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    8-Factor Prediction Engine • {data.examConfig.label}
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
                  <p className="text-[7px] text-muted-foreground/50 mt-2 text-right">
                    Difficulty: ×{data.examConfig.difficultyMultiplier.toFixed(2)}
                  </p>
                </motion.div>

                {/* Topic Gaps */}
                {data.topicGaps.length > 0 && (
                  <motion.div className="rounded-2xl border border-warning/20 bg-warning/5 p-4"
                    initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
                    <p className="text-[9px] font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Topic Gaps Holding You Back
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
                          <span className="text-[9px] text-success font-medium">+{gap.impact}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* What-If Simulation */}
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
                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-card/60 p-3 text-center border border-border/30">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <span className="text-[9px] text-muted-foreground line-through tabular-nums">{data.passProbability}%</span>
                          <ArrowUpRight className="w-3 h-3 text-success" />
                        </div>
                        <motion.p className="text-lg font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                          {data.whatIf.improvedProbability}%
                        </motion.p>
                        <p className="text-[8px] text-muted-foreground">Pass Chance</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-3 text-center border border-border/30">
                        <ArrowUpRight className="w-3 h-3 text-success mx-auto mb-0.5" />
                        <motion.p className="text-sm font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                          {formatRank(data.whatIf.improvedRankLow)}–{formatRank(data.whatIf.improvedRankHigh)}
                        </motion.p>
                        <p className="text-[8px] text-muted-foreground">New Rank Zone</p>
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
                    <p className="text-xs text-success font-semibold">All Topics Above Pass Threshold!</p>
                    <p className="text-[10px] text-muted-foreground mt-1">Maintain your study consistency to stay in the safe zone.</p>
                  </motion.div>
                )}

                <p className="text-[7px] text-muted-foreground/40 text-center italic pt-1">
                  {data.examConfig.label} prediction • 8-factor engine with exam-specific difficulty ×{data.examConfig.difficultyMultiplier.toFixed(2)}
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
