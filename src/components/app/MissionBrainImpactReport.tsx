import React from "react";
import { motion } from "framer-motion";
import { Brain, TrendingUp, Trophy, Flame, Award, BarChart3, Sparkles, Target, Zap } from "lucide-react";

interface MissionBrainImpactReportProps {
  topicName: string;
  subjectName: string;
  memoryBefore: number;
  memoryAfter: number;
  rankBefore: number;
  rankAfter: number;
  accuracy: number;
  xpEarned: number;
  brainBoost: number;
  streakDays: number;
  badges: string[];
  difficulty: string;
}

export default function MissionBrainImpactReport({
  topicName, subjectName, memoryBefore, memoryAfter,
  rankBefore, rankAfter, accuracy, xpEarned, brainBoost,
  streakDays, badges, difficulty,
}: MissionBrainImpactReportProps) {
  const rankChange = rankBefore - rankAfter;

  const getMemoryLabel = (val: number) =>
    val >= 80 ? "Strong" : val >= 60 ? "Good" : val >= 40 ? "Moderate" : val >= 20 ? "Weak" : "Critical";

  const getMemoryColor = (val: number) =>
    val >= 80 ? "text-emerald-500" : val >= 60 ? "text-primary" : val >= 40 ? "text-warning" : "text-destructive";

  const getBarColor = (val: number) =>
    val >= 80 ? "bg-emerald-500" : val >= 60 ? "bg-primary" : val >= 40 ? "bg-warning" : "bg-destructive";

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center mb-5">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}
          className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3 border border-primary/10">
          <BarChart3 className="w-7 h-7 text-primary" />
        </motion.div>
        <h3 className="text-lg font-bold text-foreground">Brain Impact Report</h3>
        <p className="text-[11px] text-muted-foreground mt-1">How this mission changed your brain</p>
      </div>

      {/* Memory Strength */}
      <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 }}
        className="p-4 rounded-2xl bg-card border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
            <Brain className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground">Memory Strength</span>
          <span className="text-[10px] text-muted-foreground ml-auto">{topicName}</span>
        </div>
        
        <div className="flex items-end justify-between mb-3">
          <div className="text-center">
            <p className={`text-xl font-bold ${getMemoryColor(memoryBefore)}`}>{Math.round(memoryBefore)}%</p>
            <p className="text-[9px] text-muted-foreground font-medium">Before</p>
          </div>
          <motion.div initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.5, duration: 0.6 }}
            className="flex-1 mx-5 flex flex-col gap-1.5">
            <div className="h-3 bg-secondary rounded-full overflow-hidden relative">
              <motion.div className={`h-full rounded-full absolute left-0 opacity-30 ${getBarColor(memoryBefore)}`}
                initial={{ width: 0 }} animate={{ width: `${memoryBefore}%` }} transition={{ delay: 0.6, duration: 0.5 }} />
              <motion.div className={`h-full rounded-full absolute left-0 ${getBarColor(memoryAfter)}`}
                initial={{ width: `${memoryBefore}%` }} animate={{ width: `${memoryAfter}%` }} transition={{ delay: 1, duration: 0.8 }} />
            </div>
          </motion.div>
          <div className="text-center">
            <p className={`text-xl font-bold ${getMemoryColor(memoryAfter)}`}>{Math.round(memoryAfter)}%</p>
            <p className="text-[9px] text-muted-foreground font-medium">After</p>
          </div>
        </div>
        
        <div className="flex items-center justify-center gap-1.5 pt-2 border-t border-border/30">
          <TrendingUp className="w-3.5 h-3.5 text-emerald-500" />
          <span className="text-[11px] font-semibold text-emerald-500">
            +{brainBoost}% improvement → {getMemoryLabel(memoryAfter)}
          </span>
        </div>
      </motion.div>

      {/* Rank Impact */}
      <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 }}
        className="p-4 rounded-2xl bg-card border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-warning/8 flex items-center justify-center">
            <Trophy className="w-3.5 h-3.5 text-warning" />
          </div>
          <span className="text-xs font-bold text-foreground">Rank Projection</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-xl font-bold text-muted-foreground">#{rankBefore.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground font-medium">Before</p>
          </div>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/8 border border-emerald-500/10">
            <TrendingUp className={`w-4 h-4 ${rankChange > 0 ? "text-emerald-500" : "text-muted-foreground"}`} />
            <span className={`text-xs font-bold ${rankChange > 0 ? "text-emerald-500" : "text-muted-foreground"}`}>
              {rankChange > 0 ? `↑ ${rankChange}` : "—"}
            </span>
          </motion.div>
          <div className="text-center">
            <p className="text-xl font-bold text-primary">#{rankAfter.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground font-medium">After</p>
          </div>
        </div>
      </motion.div>

      {/* Performance Breakdown */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.6 }}
        className="p-4 rounded-2xl bg-card border border-border/50">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center">
            <Target className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-xs font-bold text-foreground">Performance Analysis</span>
        </div>
        <div className="space-y-3">
          <PerfRow label="Accuracy" value={`${accuracy}%`} color={accuracy >= 75 ? "text-emerald-500" : accuracy >= 50 ? "text-warning" : "text-destructive"} />
          <PerfRow label="Difficulty" value={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} color={difficulty === "hard" ? "text-warning" : difficulty === "easy" ? "text-emerald-500" : "text-primary"} />
          <PerfRow label="XP Earned" value={`+${xpEarned}`} color="text-primary" />
          <PerfRow label="Mission Streak" value={`${streakDays} days`} color="text-warning" />
        </div>
      </motion.div>

      {/* AI Insight */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }}
        className="p-4 rounded-2xl bg-primary/5 border border-primary/10">
        <div className="flex items-start gap-2.5">
          <Sparkles className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p className="text-[11px] text-muted-foreground leading-relaxed">
            {accuracy >= 80
              ? `Excellent mastery of ${topicName}! Memory strength is now ${getMemoryLabel(memoryAfter).toLowerCase()}. Continue daily missions to maintain this level.`
              : accuracy >= 50
              ? `Good progress on ${topicName}. Focus on missed concepts to push memory strength higher. Tomorrow's mission targets those gaps.`
              : `${topicName} needs more practice. AI will generate easier questions tomorrow to build your foundation before increasing difficulty.`}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function PerfRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] text-muted-foreground font-medium">{label}</span>
      <span className={`text-[11px] font-bold ${color}`}>{value}</span>
    </div>
  );
}
