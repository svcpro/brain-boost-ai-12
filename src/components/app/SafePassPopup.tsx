import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Shield, AlertTriangle, Zap, ArrowUpRight, X, Target, TrendingUp,
} from "lucide-react";
import { TopicPrediction } from "@/hooks/useMemoryEngine";

interface SafePassPopupProps {
  open: boolean;
  onClose: () => void;
  allTopics: TopicPrediction[];
  overallHealth: number;
  streakDays: number;
}

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
}

function computeSafePass(
  allTopics: TopicPrediction[],
  overallHealth: number,
  streakDays: number
): SafePassData | null {
  if (allTopics.length === 0) return null;

  const avgStrength = allTopics.reduce((s, t) => s + t.memory_strength, 0) / allTopics.length;
  const strongCount = allTopics.filter((t) => t.memory_strength >= 70).length;
  const coverageRatio = strongCount / Math.max(allTopics.length, 1);
  const readinessScore = Math.round((strongCount / allTopics.length) * 100);

  const factorScore =
    avgStrength * 0.3 +
    coverageRatio * 100 * 0.25 +
    (Math.min(streakDays, 30) / 30) * 100 * 0.15 +
    overallHealth * 0.15 +
    readinessScore * 0.15;

  const totalCandidates = 10000;
  const centerRank = Math.round(totalCandidates * (1 - factorScore / 100));
  const spread = Math.round(totalCandidates * 0.05);
  const safeRankLow = Math.max(1, centerRank - spread);
  const safeRankHigh = Math.min(totalCandidates, centerRank + spread);
  const passProbability = Math.round(Math.min(85, Math.max(55, factorScore * 0.9 + 10)));

  const topicGaps = [...allTopics]
    .filter((t) => t.memory_strength < 60)
    .sort((a, b) => a.memory_strength - b.memory_strength)
    .slice(0, 5)
    .map((t) => ({
      name: t.name,
      strength: Math.round(t.memory_strength),
      impact: Math.round((60 - t.memory_strength) * 0.4),
    }));

  const potentialGain = topicGaps.slice(0, 3).reduce((s, g) => s + g.impact, 0);
  const improvedScore = Math.min(100, factorScore + potentialGain);
  const improvedCenter = Math.round(totalCandidates * (1 - improvedScore / 100));
  const improvedProb = Math.min(85, Math.max(55, improvedScore * 0.9 + 10));

  return {
    safeRankLow,
    safeRankHigh,
    passProbability,
    topicGaps,
    whatIf: {
      improvedProbability: Math.round(improvedProb),
      improvedRankLow: Math.max(1, improvedCenter - spread),
      improvedRankHigh: Math.min(totalCandidates, improvedCenter + spread),
      minutesNeeded: topicGaps.slice(0, 3).length * 15,
    },
    factorScore,
  };
}

const probColor = (p: number) =>
  p >= 75 ? "hsl(var(--success))" : p >= 65 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

const SafePassPopup: React.FC<SafePassPopupProps> = ({
  open,
  onClose,
  allTopics,
  overallHealth,
  streakDays,
}) => {
  const data = computeSafePass(allTopics, overallHealth, streakDays);

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 z-[100] bg-black/60 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Popup */}
          <motion.div
            className="fixed inset-x-4 top-[8%] z-[101] mx-auto max-w-md max-h-[85vh] overflow-y-auto rounded-3xl border border-border/50 shadow-2xl"
            style={{
              background:
                "linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--secondary)/0.6) 40%, hsl(var(--card)) 100%)",
            }}
            initial={{ opacity: 0, scale: 0.85, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.85, y: 40 }}
            transition={{ type: "spring", stiffness: 300, damping: 28 }}
          >
            {/* Decorative glowing orbs */}
            <div className="absolute top-0 right-0 w-32 h-32 rounded-full bg-primary/15 blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 w-24 h-24 rounded-full bg-success/10 blur-2xl pointer-events-none" />

            {/* Header */}
            <div className="relative p-5 pb-3">
              <motion.button
                whileTap={{ scale: 0.85 }}
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-secondary/60 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
              >
                <X className="w-4 h-4" />
              </motion.button>

              <div className="flex items-center gap-2.5 mb-1">
                {/* Animated trophy */}
                <motion.div
                  className="relative w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--success)/0.15))",
                    border: "1px solid hsl(var(--primary)/0.3)",
                  }}
                  animate={{
                    boxShadow: [
                      "0 0 0px hsl(var(--primary)/0)",
                      "0 0 16px hsl(var(--primary)/0.4)",
                      "0 0 0px hsl(var(--primary)/0)",
                    ],
                  }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Trophy className="w-5 h-5 text-primary" />
                </motion.div>
                <div>
                  <h2 className="text-sm font-bold text-foreground">Safe Pass Prediction</h2>
                  <p className="text-[9px] text-muted-foreground">AI-powered exam rank forecast</p>
                </div>
              </div>
            </div>

            {!data ? (
              <div className="px-5 pb-6 text-center">
                <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2 opacity-40" />
                <p className="text-xs text-muted-foreground">Add topics to generate prediction</p>
              </div>
            ) : (
              <div className="px-5 pb-6 space-y-4">
                {/* ── Rank Zone + Probability ── */}
                <motion.div
                  className="rounded-2xl p-4 text-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--primary)/0.08), hsl(var(--card)))",
                    border: "1px solid hsl(var(--primary)/0.2)",
                  }}
                  initial={{ opacity: 0, y: 15 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15 }}
                >
                  {/* Animated scanning line */}
                  <motion.div
                    className="absolute inset-0 pointer-events-none"
                    style={{
                      background: "linear-gradient(180deg, transparent 0%, hsl(var(--primary)/0.06) 50%, transparent 100%)",
                      height: "30%",
                    }}
                    animate={{ y: ["0%", "300%", "0%"] }}
                    transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
                  />

                  <p className="text-[9px] text-muted-foreground mb-1 relative z-10">Your Safe Rank Zone</p>
                  <motion.p
                    className="text-2xl font-extrabold text-primary tabular-nums relative z-10"
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
                  >
                    {data.safeRankLow.toLocaleString()} — {data.safeRankHigh.toLocaleString()}
                  </motion.p>
                  <p className="text-[8px] text-muted-foreground relative z-10">out of ~10,000 candidates</p>

                  {/* Probability gauge below */}
                  <div className="flex items-center justify-center gap-4 mt-4 relative z-10">
                    <div className="relative w-16 h-16">
                      <svg viewBox="0 0 68 68" className="w-full h-full -rotate-90">
                        <circle cx="34" cy="34" r="28" fill="none" stroke="hsl(var(--border))" strokeWidth="5" />
                        <motion.circle
                          cx="34"
                          cy="34"
                          r="28"
                          fill="none"
                          stroke={probColor(data.passProbability)}
                          strokeWidth="5"
                          strokeLinecap="round"
                          strokeDasharray={2 * Math.PI * 28}
                          initial={{ strokeDashoffset: 2 * Math.PI * 28 }}
                          animate={{
                            strokeDashoffset:
                              2 * Math.PI * 28 * (1 - data.passProbability / 100),
                          }}
                          transition={{ duration: 1.2, ease: "easeOut", delay: 0.4 }}
                          style={{
                            filter: `drop-shadow(0 0 6px ${probColor(data.passProbability)})`,
                          }}
                        />
                      </svg>
                      <div className="absolute inset-0 flex flex-col items-center justify-center">
                        <motion.span
                          className="text-base font-extrabold text-foreground tabular-nums"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.6, type: "spring" }}
                        >
                          {data.passProbability}%
                        </motion.span>
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs font-semibold text-foreground">Pass Probability</p>
                      <p className="text-[9px] text-muted-foreground">
                        {data.passProbability >= 75
                          ? "You're in the safe zone 🎯"
                          : data.passProbability >= 65
                          ? "Getting closer, keep studying 📈"
                          : "Needs more preparation ⚡"}
                      </p>
                    </div>
                  </div>
                </motion.div>

                {/* ── Factor Breakdown ── */}
                <motion.div
                  className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                >
                  <p className="text-[9px] font-semibold text-muted-foreground uppercase tracking-wider mb-2.5 flex items-center gap-1">
                    <TrendingUp className="w-3 h-3 text-primary" />
                    Prediction Factors
                  </p>
                  <div className="space-y-2">
                    {[
                      { label: "Memory Strength", pct: Math.round(allTopics.reduce((s, t) => s + t.memory_strength, 0) / Math.max(allTopics.length, 1)), weight: "30%" },
                      { label: "Topic Coverage", pct: Math.round((allTopics.filter(t => t.memory_strength >= 70).length / Math.max(allTopics.length, 1)) * 100), weight: "25%" },
                      { label: "Study Consistency", pct: Math.round(Math.min(streakDays, 30) / 30 * 100), weight: "15%" },
                      { label: "Brain Health", pct: overallHealth, weight: "15%" },
                    ].map((f, i) => (
                      <div key={i}>
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-[10px] text-foreground">{f.label}</span>
                          <span className="text-[9px] text-muted-foreground">{f.pct}% <span className="text-[7px]">({f.weight})</span></span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                          <motion.div
                            className="h-full rounded-full"
                            style={{
                              background: f.pct >= 70 ? "hsl(var(--success))" : f.pct >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))",
                            }}
                            initial={{ width: 0 }}
                            animate={{ width: `${f.pct}%` }}
                            transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>

                {/* ── Topic Gaps ── */}
                {data.topicGaps.length > 0 && (
                  <motion.div
                    className="rounded-2xl border border-warning/20 bg-warning/5 p-4"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.35 }}
                  >
                    <p className="text-[9px] font-semibold text-warning uppercase tracking-wider mb-2 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      Topic Gaps Holding You Back
                    </p>
                    <div className="space-y-1.5">
                      {data.topicGaps.map((gap, i) => (
                        <motion.div
                          key={i}
                          className="flex items-center gap-2 rounded-xl bg-card/50 px-3 py-2 border border-border/30"
                          initial={{ opacity: 0, x: -12 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.4 + i * 0.06 }}
                        >
                          <div className="w-2 h-2 rounded-full bg-warning shrink-0" />
                          <span className="text-[10px] text-foreground truncate flex-1">{gap.name}</span>
                          <span className="text-[10px] text-destructive font-bold tabular-nums">{gap.strength}%</span>
                          <span className="text-[9px] text-success font-medium">+{gap.impact}%</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {/* ── What-If Simulation ── */}
                {data.topicGaps.length > 0 && (
                  <motion.div
                    className="rounded-2xl relative overflow-hidden p-4"
                    style={{
                      background: "linear-gradient(135deg, hsl(var(--success)/0.08), hsl(var(--card)))",
                      border: "1px solid hsl(var(--success)/0.25)",
                    }}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.45 }}
                  >
                    {/* Animated pulse ring */}
                    <motion.div
                      className="absolute top-2 right-2 w-3 h-3 rounded-full bg-success/40"
                      animate={{ scale: [1, 1.8, 1], opacity: [0.6, 0, 0.6] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />

                    <p className="text-[9px] font-semibold text-success uppercase tracking-wider mb-3 flex items-center gap-1">
                      <Zap className="w-3 h-3" />
                      What If You Fix Top 3 Weak Topics?
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div className="rounded-xl bg-card/60 p-3 text-center border border-border/30">
                        <div className="flex items-center justify-center gap-1 mb-0.5">
                          <span className="text-[9px] text-muted-foreground line-through tabular-nums">
                            {data.passProbability}%
                          </span>
                          <ArrowUpRight className="w-3 h-3 text-success" />
                        </div>
                        <motion.p
                          className="text-lg font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.6, type: "spring" }}
                        >
                          {data.whatIf.improvedProbability}%
                        </motion.p>
                        <p className="text-[8px] text-muted-foreground">Pass Chance</p>
                      </div>
                      <div className="rounded-xl bg-card/60 p-3 text-center border border-border/30">
                        <ArrowUpRight className="w-3 h-3 text-success mx-auto mb-0.5" />
                        <motion.p
                          className="text-sm font-extrabold text-success tabular-nums"
                          initial={{ scale: 0.8 }}
                          animate={{ scale: 1 }}
                          transition={{ delay: 0.65, type: "spring" }}
                        >
                          {data.whatIf.improvedRankLow.toLocaleString()}–{data.whatIf.improvedRankHigh.toLocaleString()}
                        </motion.p>
                        <p className="text-[8px] text-muted-foreground">New Rank Zone</p>
                      </div>
                    </div>

                    <motion.p
                      className="text-[10px] text-success/80 text-center mt-3 font-medium"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.8 }}
                    >
                      ⏱️ ~{data.whatIf.minutesNeeded} min of focused study needed
                    </motion.p>
                  </motion.div>
                )}

                {data.topicGaps.length === 0 && (
                  <motion.div
                    className="rounded-2xl bg-success/10 border border-success/20 p-4 text-center"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.35 }}
                  >
                    <Shield className="w-8 h-8 text-success mx-auto mb-2" />
                    <p className="text-xs text-success font-semibold">All Topics Above Pass Threshold!</p>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      Maintain your study consistency to stay in the safe zone.
                    </p>
                  </motion.div>
                )}

                {/* Footer */}
                <p className="text-[7px] text-muted-foreground/40 text-center italic pt-1">
                  Prediction based on memory strength, coverage, consistency & brain health • Capped 55-85%
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
