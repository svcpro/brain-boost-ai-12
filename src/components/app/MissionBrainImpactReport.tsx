import React from "react";
import { motion } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, Trophy, Flame, Award, BarChart3, Sparkles, Target, Zap } from "lucide-react";

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
  const memoryChange = memoryAfter - memoryBefore;
  const rankChange = rankBefore - rankAfter;

  const getMemoryLabel = (val: number) =>
    val >= 80 ? "Strong" : val >= 60 ? "Good" : val >= 40 ? "Moderate" : val >= 20 ? "Weak" : "Critical";

  const getMemoryColor = (val: number) =>
    val >= 80 ? "text-green-500" : val >= 60 ? "text-primary" : val >= 40 ? "text-warning" : "text-destructive";

  return (
    <div className="space-y-4">
      <div className="text-center mb-4">
        <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200 }}>
          <BarChart3 className="w-8 h-8 text-primary mx-auto mb-2" />
        </motion.div>
        <h3 className="text-base font-bold text-foreground">Brain Impact Report</h3>
        <p className="text-[10px] text-muted-foreground mt-1">How this mission changed your brain</p>
      </div>

      {/* Memory Strength Change */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.2 }}
        className="p-4 rounded-xl bg-card border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Memory Strength: {topicName}</span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <div className="text-center">
            <p className={`text-lg font-bold ${getMemoryColor(memoryBefore)}`}>{Math.round(memoryBefore)}%</p>
            <p className="text-[9px] text-muted-foreground">Before</p>
          </div>
          <motion.div
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: 0.5, duration: 0.6 }}
            className="flex-1 mx-4 flex items-center"
          >
            <div className="h-2 flex-1 bg-secondary rounded-full overflow-hidden relative">
              <motion.div
                className="h-full bg-primary/30 rounded-full absolute left-0"
                initial={{ width: 0 }}
                animate={{ width: `${memoryBefore}%` }}
                transition={{ delay: 0.6, duration: 0.5 }}
              />
              <motion.div
                className="h-full bg-primary rounded-full absolute left-0"
                initial={{ width: `${memoryBefore}%` }}
                animate={{ width: `${memoryAfter}%` }}
                transition={{ delay: 1, duration: 0.8 }}
              />
            </div>
          </motion.div>
          <div className="text-center">
            <p className={`text-lg font-bold ${getMemoryColor(memoryAfter)}`}>{Math.round(memoryAfter)}%</p>
            <p className="text-[9px] text-muted-foreground">After</p>
          </div>
        </div>
        <div className="flex items-center justify-center gap-1 mt-1">
          <TrendingUp className="w-3 h-3 text-green-500" />
          <span className="text-[10px] font-medium text-green-500">
            +{brainBoost}% improvement → {getMemoryLabel(memoryAfter)}
          </span>
        </div>
      </motion.div>

      {/* Rank Impact */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 0.4 }}
        className="p-4 rounded-xl bg-card border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Trophy className="w-4 h-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Rank Projection Impact</span>
        </div>
        <div className="flex items-center justify-between">
          <div className="text-center">
            <p className="text-lg font-bold text-foreground">#{rankBefore.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">Before</p>
          </div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            className="flex items-center gap-1"
          >
            <ArrowIcon direction={rankChange > 0 ? "up" : "neutral"} />
            <span className={`text-xs font-bold ${rankChange > 0 ? "text-green-500" : "text-muted-foreground"}`}>
              {rankChange > 0 ? `↑ ${rankChange} ranks` : "No change"}
            </span>
          </motion.div>
          <div className="text-center">
            <p className="text-lg font-bold text-primary">#{rankAfter.toLocaleString()}</p>
            <p className="text-[9px] text-muted-foreground">After</p>
          </div>
        </div>
      </motion.div>

      {/* Performance Breakdown */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6 }}
        className="p-4 rounded-xl bg-card border border-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Performance Analysis</span>
        </div>
        <div className="space-y-2.5">
          <PerformanceRow label="Accuracy" value={`${accuracy}%`} color={accuracy >= 75 ? "text-green-500" : accuracy >= 50 ? "text-warning" : "text-destructive"} />
          <PerformanceRow label="Difficulty" value={difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} color={difficulty === "hard" ? "text-warning" : difficulty === "easy" ? "text-green-500" : "text-primary"} />
          <PerformanceRow label="XP Earned" value={`+${xpEarned}`} color="text-primary" />
          <PerformanceRow label="Mission Streak" value={`${streakDays} days`} color="text-warning" />
        </div>
      </motion.div>

      {/* AI Insight */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        className="p-3 rounded-xl bg-primary/5 border border-primary/15"
      >
        <div className="flex items-start gap-2">
          <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {accuracy >= 80
              ? `Excellent mastery of ${topicName}! Your memory strength is now ${getMemoryLabel(memoryAfter).toLowerCase()}. Continue daily missions to maintain this level.`
              : accuracy >= 50
              ? `Good progress on ${topicName}. Focus on the concepts you missed to push your memory strength higher. Tomorrow's mission will target those gaps.`
              : `${topicName} needs more practice. The AI will generate easier questions tomorrow to build your foundation before increasing difficulty.`}
          </p>
        </div>
      </motion.div>
    </div>
  );
}

function PerformanceRow({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] text-muted-foreground">{label}</span>
      <span className={`text-[11px] font-bold ${color}`}>{value}</span>
    </div>
  );
}

function ArrowIcon({ direction }: { direction: "up" | "neutral" }) {
  return direction === "up"
    ? <TrendingUp className="w-4 h-4 text-green-500" />
    : <div className="w-4 h-4" />;
}
