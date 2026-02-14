import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Star, Award, Sparkles, Lock } from "lucide-react";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import StreakBadge from "./StreakBadge";

interface MilestoneConfig {
  days: number;
  icon: typeof Star;
  label: string;
  emoji: string;
  gradient: string;
  borderColor: string;
}

const MILESTONES: MilestoneConfig[] = [
  { days: 7, icon: Star, label: "Week Warrior", emoji: "⭐", gradient: "from-indigo-500/20 to-indigo-700/10", borderColor: "border-indigo-500/40" },
  { days: 14, icon: Star, label: "Fortnight Focus", emoji: "🌟", gradient: "from-cyan-500/20 to-cyan-700/10", borderColor: "border-cyan-500/40" },
  { days: 30, icon: Award, label: "30-Day Legend", emoji: "🏆", gradient: "from-amber-500/20 to-amber-700/10", borderColor: "border-amber-500/40" },
  { days: 60, icon: Award, label: "Two-Month Titan", emoji: "💎", gradient: "from-purple-500/20 to-purple-700/10", borderColor: "border-purple-500/40" },
  { days: 100, icon: Sparkles, label: "100-Day Master", emoji: "🔥", gradient: "from-red-500/20 to-red-700/10", borderColor: "border-red-500/40" },
  { days: 365, icon: Sparkles, label: "Year of Mastery", emoji: "👑", gradient: "from-yellow-500/20 to-yellow-700/10", borderColor: "border-yellow-500/40" },
];

// Milestones that have shareable badge themes in StreakBadge
const SHAREABLE_MILESTONES = [7, 14, 30, 60, 100, 365];

const BadgeGallery = () => {
  const { streak, loadStreak } = useStudyStreak();
  const [longestEver, setLongestEver] = useState(0);
  const [selectedBadge, setSelectedBadge] = useState<number | null>(null);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  useEffect(() => {
    if (!streak) return;
    setLongestEver(streak.longestStreak);
  }, [streak]);

  const earned = MILESTONES.filter((m) => longestEver >= m.days);
  const nextMilestone = MILESTONES.find((m) => longestEver < m.days);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center justify-between mb-3">
        <span className="text-sm font-semibold text-foreground">Streak Badges</span>
        <span className="text-[10px] text-muted-foreground">
          {earned.length}/{MILESTONES.length} earned
        </span>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {MILESTONES.map((m, i) => {
          const isEarned = longestEver >= m.days;
          const isShareable = isEarned && SHAREABLE_MILESTONES.includes(m.days);
          return (
            <motion.div
              key={m.days}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.05 * i }}
              onClick={() => isShareable && setSelectedBadge(m.days)}
              className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                isEarned
                  ? `bg-gradient-to-b ${m.gradient} ${m.borderColor}`
                  : "bg-secondary/20 border-border/30 opacity-50"
              } ${isShareable ? "cursor-pointer active:scale-95" : ""}`}
            >
              <div className="text-2xl leading-none">
                {isEarned ? m.emoji : <Lock className="w-5 h-5 text-muted-foreground" />}
              </div>
              <span className="text-[10px] font-semibold text-foreground text-center leading-tight">
                {m.label}
              </span>
              <span className="text-[9px] text-muted-foreground">{m.days}d</span>
              {isEarned && (
                <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center">
                  <span className="text-[8px] text-success-foreground font-bold">✓</span>
                </div>
              )}
              {isShareable && (
                <span className="text-[8px] text-primary font-medium">Tap to share</span>
              )}
            </motion.div>
          );
        })}
      </div>

      {/* Shareable badge preview */}
      <AnimatePresence>
        {selectedBadge && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-4 overflow-hidden"
          >
            <StreakBadge milestone={selectedBadge} onClose={() => setSelectedBadge(null)} />
          </motion.div>
        )}
      </AnimatePresence>

      {nextMilestone && longestEver > 0 && !selectedBadge && (
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-primary/60"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (longestEver / nextMilestone.days) * 100)}%` }}
              transition={{ duration: 0.8 }}
            />
          </div>
          <span className="text-[10px] text-muted-foreground whitespace-nowrap">
            {nextMilestone.days - longestEver}d to {nextMilestone.emoji}
          </span>
        </div>
      )}

      {earned.length === 0 && (
        <p className="text-[10px] text-muted-foreground text-center mt-2">
          Start a study streak to earn your first badge!
        </p>
      )}
    </motion.div>
  );
};

export default BadgeGallery;
