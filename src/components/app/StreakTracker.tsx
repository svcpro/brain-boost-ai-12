import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, Star, Sparkles, Award } from "lucide-react";
import StreakBadge from "./StreakBadge";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import { useVoice } from "@/pages/AppDashboard";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { getCache, setCache } from "@/lib/offlineCache";
import confetti from "canvas-confetti";

const STREAK_MILESTONES = [3, 7, 14, 30];
const CELEBRATION_MILESTONES = [7, 30, 100];

const MILESTONE_CONFIG: Record<number, { icon: typeof Star; label: string; emoji: string; color: string }> = {
  7: { icon: Star, label: "1 Week Warrior!", emoji: "⭐", color: "text-primary" },
  30: { icon: Award, label: "30-Day Legend!", emoji: "🏆", color: "text-warning" },
  100: { icon: Sparkles, label: "100-Day Master!", emoji: "🔥", color: "text-destructive" },
};

const StreakTracker = () => {
  const { streak, loading, loadStreak } = useStudyStreak();
  const voice = useVoice();
  const streakVoiceFiredRef = useRef(false);
  const [celebration, setCelebration] = useState<number | null>(null);

  useEffect(() => {
    loadStreak();
  }, [loadStreak]);

  // Voice alert on streak milestone
  useEffect(() => {
    if (!streak || streakVoiceFiredRef.current || !voice) return;
    if (!streak.todayMet) return;
    const settings = getVoiceSettings();
    if (!settings.enabled) return;
    if (STREAK_MILESTONES.includes(streak.currentStreak)) {
      streakVoiceFiredRef.current = true;
      voice.speak("motivation", { daily_topic: `${streak.currentStreak} day streak` });
    }
  }, [streak, voice]);

  // Celebration for 7, 30, 100 milestones
  useEffect(() => {
    if (!streak || !streak.todayMet) return;
    if (!CELEBRATION_MILESTONES.includes(streak.currentStreak)) return;

    const cacheKey = `streak-celebrated-${streak.currentStreak}`;
    const alreadyCelebrated = getCache<boolean>(cacheKey);
    if (alreadyCelebrated) return;

    setCache(cacheKey, true);
    setCelebration(streak.currentStreak);

    // Fire confetti
    const end = Date.now() + 2500;
    const fire = () => {
      confetti({ particleCount: 80, spread: 100, origin: { y: 0.6 }, colors: ["#6366f1", "#f59e0b", "#ef4444", "#22c55e"] });
      if (Date.now() < end) requestAnimationFrame(fire);
    };
    fire();

    // Auto-dismiss after 5s
    const timer = setTimeout(() => setCelebration(null), 5000);
    return () => clearTimeout(timer);
  }, [streak]);

  if (loading || !streak) return null;

  const flameColor = streak.currentStreak >= 7
    ? "text-warning"
    : streak.currentStreak >= 3
    ? "text-primary"
    : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      <div className="flex items-center gap-4">
        {/* Flame icon with streak count */}
        <div className="relative">
          <motion.div
            animate={streak.currentStreak > 0 ? {
              scale: [1, 1.15, 1],
            } : {}}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
          >
            <Flame className={`w-10 h-10 ${flameColor}`} />
          </motion.div>
          {streak.currentStreak > 0 && (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-warning flex items-center justify-center"
            >
              <span className="text-[10px] font-bold text-warning-foreground">{streak.currentStreak}</span>
            </motion.div>
          )}
        </div>

        {/* Info */}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold text-foreground">
              {streak.currentStreak > 0
                ? `${streak.currentStreak} day streak!`
                : "No streak yet"}
            </span>
            {streak.todayMet && (
              <span className="px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[9px] font-medium">
                ✓ Today
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {streak.currentStreak === 0
              ? `Study ${streak.goalMinutes} min today to start a streak`
              : !streak.todayMet
              ? `Study ${streak.goalMinutes - streak.todayMinutes} more min to keep it alive`
              : "Keep it going tomorrow!"}
          </p>
        </div>

        {/* Best streak */}
        {streak.longestStreak > 0 && (
          <div className="flex flex-col items-center gap-0.5">
            <Trophy className="w-4 h-4 text-warning" />
            <span className="text-[10px] text-muted-foreground">Best</span>
            <span className="text-xs font-bold text-foreground">{streak.longestStreak}d</span>
          </div>
        )}
      </div>

      {/* Streak dots for last 7 days */}
      <div className="flex items-center justify-between mt-3 px-1">
        {Array.from({ length: 7 }).map((_, i) => {
          const date = new Date();
          date.setDate(date.getDate() - (6 - i));
          const dayLabel = date.toLocaleDateString("en-US", { weekday: "narrow" });
          // We can't easily check each day here without passing dailyTotals,
          // so we use a simple heuristic based on streak position
          const daysAgo = 6 - i;
          const isToday = daysAgo === 0;

          // Check if this day is within the current streak
          let met = false;
          if (isToday) {
            met = streak.todayMet;
          } else if (streak.todayMet) {
            met = daysAgo <= streak.currentStreak - 1;
          } else {
            met = daysAgo >= 1 && daysAgo <= streak.currentStreak;
          }

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ${
                  met
                    ? "bg-primary/20 text-primary border border-primary/40"
                    : isToday
                    ? "bg-secondary border border-border text-foreground"
                    : "bg-secondary/50 text-muted-foreground"
                }`}
              >
                {met ? "✓" : dayLabel}
              </div>
            </div>
          );
        })}
      </div>

      {/* Milestone celebration banner */}
      <AnimatePresence>
        {celebration && MILESTONE_CONFIG[celebration] && (() => {
          const config = MILESTONE_CONFIG[celebration];
          const Icon = config.icon;
          return (
            <motion.div
              key={celebration}
              initial={{ opacity: 0, scale: 0.8, height: 0 }}
              animate={{ opacity: 1, scale: 1, height: "auto" }}
              exit={{ opacity: 0, scale: 0.8, height: 0 }}
              className="mt-3 rounded-lg border border-primary/30 bg-primary/10 p-3 overflow-hidden"
            >
              <div className="flex items-center gap-3">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 0] }}
                  transition={{ duration: 0.6, repeat: 2 }}
                >
                  <Icon className={`w-6 h-6 ${config.color}`} />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {config.emoji} {config.label}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    {celebration} days of consistent studying. Incredible dedication!
                  </p>
                </div>
                <button
                  onClick={() => setCelebration(null)}
                  className="text-[10px] text-muted-foreground hover:text-foreground transition-colors self-start"
                >
                  ✕
                </button>
              </div>
              <div className="mt-3">
                <StreakBadge milestone={celebration} onClose={() => setCelebration(null)} />
              </div>
            </motion.div>
          );
        })()}
      </AnimatePresence>
    </motion.div>
  );
};

export default StreakTracker;
