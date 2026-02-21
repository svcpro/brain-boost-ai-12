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

/* ─── Safe Pass result ─── */
interface SafePassData {
  brainScore: number;
  brainRank: number;         // 1-based rank among peers
  totalPeers: number;
  percentile: number;        // top X%
  passProbability: number;
  safeZoneLabel: string;
  topicGaps: { name: string; strength: number; impact: number }[];
  whatIf: {
    improvedBrainScore: number;
    improvedPercentile: number;
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

  // Brain Stability Score — weighted composite (same as hero score but enriched)
  const brainScore = Math.round(
    overallHealth * 0.35 +          // Brain health is primary
    avgStrength * 0.25 +            // Memory strength
    coverageRatio * 100 * 0.15 +    // Topic coverage
    consistencyPct * 0.10 +         // Study consistency
    recencyPct * 0.05 +             // Recency
    decayPct * 0.05 +               // Decay control
    volumePct * 0.03 +              // Volume
    examPressurePct * 0.02          // Exam pressure
  );

  // Rank among peers (same exam users on the platform)
  const peerCount = peerStats ? Math.max(peerStats.peerCount, 1) : 100;
  const peerAvg = peerStats?.avgStrength ?? 50;
  const peerTop = peerStats?.topPerformerStrength ?? 90;

  // Percentile: how this user's brainScore compares to peer average
  // Using a sigmoid centered on peer average for realistic distribution
  const k = 0.06;
  const sigmoid = (score: number, mid: number) => 1 / (1 + Math.exp(-k * (score - mid)));
  const rawPercentile = sigmoid(brainScore, peerAvg) * 100;
  const percentile = Math.round(Math.min(99, Math.max(1, rawPercentile)));

  // Rank = percentile mapped to peer count
  const brainRank = Math.max(1, Math.round(peerCount * (1 - percentile / 100)));

  // Safe zone label
  const safeZoneLabel =
    percentile >= 90 ? "🏆 Elite Zone" :
    percentile >= 75 ? "🎯 Safe Zone" :
    percentile >= 50 ? "📈 Rising Zone" :
    percentile >= 30 ? "⚡ Improvement Zone" :
    "🔴 At Risk Zone";

  // Pass probability based on brain stability percentile
  const passProbability = Math.round(Math.min(95, Math.max(15,
    percentile >= 75 ? 60 + (percentile - 75) * 1.4 :
    percentile >= 50 ? 45 + (percentile - 50) * 0.6 :
    15 + percentile * 0.6
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

  // What-if: if top 3 gaps improved to 70%
  const gapBoost = topicGaps.slice(0, 3).reduce((s, g) => s + g.impact, 0);
  const improvedBrainScore = Math.min(100, brainScore + gapBoost);
  const improvedPercentile = Math.round(Math.min(99, Math.max(1, sigmoid(improvedBrainScore, peerAvg) * 100)));
  const improvedProbability = Math.round(Math.min(95, Math.max(15,
    improvedPercentile >= 75 ? 60 + (improvedPercentile - 75) * 1.4 :
    improvedPercentile >= 50 ? 45 + (improvedPercentile - 50) * 0.6 :
    15 + improvedPercentile * 0.6
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
    brainRank,
    totalPeers: peerCount,
    percentile,
    passProbability,
    safeZoneLabel,
    topicGaps,
    whatIf: {
      improvedBrainScore,
      improvedPercentile,
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

                  {/* Rank + Percentile */}
                  <div className="flex items-center justify-center gap-6 mt-4 relative z-10">
                    <div className="text-center">
                      <motion.p className="text-lg font-extrabold text-foreground tabular-nums"
                        initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.5 }}>
                        #{data.brainRank}
                      </motion.p>
                      <p className="text-[8px] text-muted-foreground">Rank among {data.totalPeers} peers</p>
                    </div>
                    <div className="w-px h-8 bg-border/40" />
                    <div className="text-center">
                      <motion.p className="text-lg font-extrabold tabular-nums"
                        style={{ color: zoneColor(data.percentile) }}
                        initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.55 }}>
                        Top {100 - data.percentile}%
                      </motion.p>
                      <p className="text-[8px] text-muted-foreground">Percentile in {data.examLabel}</p>
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
                          <span className="text-[8px] text-muted-foreground line-through tabular-nums">{data.brainScore}</span>
                          <ArrowUpRight className="w-2.5 h-2.5 text-success" />
                        </div>
                        <motion.p className="text-base font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.6, type: "spring" }}>
                          {data.whatIf.improvedBrainScore}
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Brain Score</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <ArrowUpRight className="w-2.5 h-2.5 text-success mx-auto mb-0.5" />
                        <motion.p className="text-base font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.65, type: "spring" }}>
                          Top {100 - data.whatIf.improvedPercentile}%
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Percentile</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-2.5 text-center border border-border/30">
                        <ArrowUpRight className="w-2.5 h-2.5 text-success mx-auto mb-0.5" />
                        <motion.p className="text-base font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }} animate={{ scale: 1 }} transition={{ delay: 0.7, type: "spring" }}>
                          {data.whatIf.improvedProbability}%
                        </motion.p>
                        <p className="text-[7px] text-muted-foreground">Pass Chance</p>
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
