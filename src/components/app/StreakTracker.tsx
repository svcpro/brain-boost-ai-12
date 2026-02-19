import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, Trophy, Star, Sparkles, Award, Snowflake, Shield } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import StreakBadge from "./StreakBadge";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import { useVoice } from "@/pages/AppDashboard";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { getCache, setCache } from "@/lib/offlineCache";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getPushNotifPrefs } from "./NotificationPreferencesPanel";
import confetti from "canvas-confetti";

const STREAK_MILESTONES = [3, 7, 14, 30];
const CELEBRATION_MILESTONES = [7, 14, 30];

const MILESTONE_NOTIF: Record<number, { title: string; body: string }> = {
  7: { title: "⭐ 7-Day Streak!", body: "You've studied for 7 days straight. Keep the momentum!" },
  14: { title: "🔥 14-Day Streak!", body: "Two weeks of consistent studying. You're on fire!" },
  30: { title: "🏆 30-Day Legend!", body: "30 days of dedication. You're unstoppable!" },
};

const MILESTONE_CONFIG: Record<number, { icon: typeof Star; label: string; emoji: string; color: string }> = {
  7: { icon: Star, label: "1 Week Warrior!", emoji: "⭐", color: "text-primary" },
  14: { icon: Flame, label: "2 Week Phoenix!", emoji: "🔥", color: "text-success" },
  30: { icon: Award, label: "30-Day Legend!", emoji: "🏆", color: "text-warning" },
  100: { icon: Sparkles, label: "100-Day Master!", emoji: "🔥", color: "text-destructive" },
};

const StreakTracker = () => {
  const { streak, loading } = useStudyStreak();
  const { user } = useAuth();
  const voice = useVoice();
  const streakVoiceFiredRef = useRef(false);
  const [celebration, setCelebration] = useState<number | null>(null);

  // Streak auto-loads via realtime subscription in useStudyStreak

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

    // Fire milestone confetti — bigger burst for higher milestones
    const intensity = streak.currentStreak >= 30 ? 150 : streak.currentStreak >= 14 ? 120 : 90;
    const duration = streak.currentStreak >= 30 ? 3500 : 2500;
    const end = Date.now() + duration;
    const fire = () => {
      confetti({ particleCount: intensity, spread: 140, origin: { y: 0.5, x: 0.5 }, colors: ["#6366f1", "#f59e0b", "#ef4444", "#22c55e", "#a855f7"], gravity: 0.8, scalar: 1.2, ticks: 120 });
      if (Date.now() < end) setTimeout(fire, 250);
    };
    fire();

    // Send push notification for streak milestone
    if (user && MILESTONE_NOTIF[streak.currentStreak] && getPushNotifPrefs().streakMilestones) {
      const notif = MILESTONE_NOTIF[streak.currentStreak];
      supabase.functions.invoke("send-push-notification", {
        body: { recipient_id: user.id, title: notif.title, body: notif.body, data: { type: "streak_milestone", streak: streak.currentStreak } },
      }).catch((err) => console.warn("Streak push failed:", err));
    }

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
          const dateStr = date.toLocaleDateString("en-CA");
          const dayLabel = date.toLocaleDateString("en-US", { weekday: "narrow" });
          const isToday = i === 6;

          const studied = (streak.dailyTotals[dateStr] || 0) >= streak.goalMinutes;
          const frozen = streak.frozenDays.has(dateStr);
          const met = studied || frozen;

          const freezeRecord = frozen && !studied
            ? streak.freezeRecords.find(f => f.used_date === dateStr)
            : null;

          const dot = (
            <div
              className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ${
                frozen && !studied
                  ? "bg-accent/30 text-accent-foreground border border-accent/50 cursor-pointer"
                  : studied
                  ? "bg-primary/20 text-primary border border-primary/40"
                  : isToday
                  ? "bg-secondary border border-border text-foreground"
                  : "bg-secondary/50 text-muted-foreground"
              }`}
            >
              {frozen && !studied ? "🛡️" : studied ? "✓" : dayLabel}
            </div>
          );

          return (
            <div key={i} className="flex flex-col items-center gap-1">
              {freezeRecord ? (
                <Popover>
                  <PopoverTrigger asChild>{dot}</PopoverTrigger>
                  <PopoverContent className="w-48 p-3" side="top" align="center">
                    <div className="flex items-center gap-2 mb-1.5">
                      <Shield className="w-3.5 h-3.5 text-primary" />
                      <span className="text-xs font-semibold text-foreground">Streak Shield</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Used on {new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      Earned {new Date(freezeRecord.earned_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </p>
                  </PopoverContent>
                </Popover>
              ) : dot}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mt-2 px-1">
        <div className="flex items-center gap-1">
          <span className="text-[9px]">✓</span>
          <span className="text-[9px] text-muted-foreground">Studied</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px]">🛡️</span>
          <span className="text-[9px] text-muted-foreground">Auto-shield</span>
        </div>
      </div>
      {/* Next freeze reward countdown */}
      {(() => {
        const FREEZE_MILESTONES = [5, 7, 14, 30];
        const next = FREEZE_MILESTONES.find((m) => streak.currentStreak < m);
        if (!next) return null;
        const daysLeft = next - streak.currentStreak;
        const progress = (streak.currentStreak / next) * 100;
        return (
          <div className="mt-3 px-1">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1.5">
                <Snowflake className="w-3 h-3 text-primary" />
                <span className="text-[10px] text-muted-foreground">Next freeze reward</span>
              </div>
              <span className="text-[10px] font-semibold text-foreground">
                {daysLeft} day{daysLeft !== 1 ? "s" : ""} left
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                initial={{ width: 0 }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.8, ease: "easeOut" }}
              />
            </div>
            <p className="text-[9px] text-muted-foreground mt-1">
              🛡️ {next}-day milestone → earn a streak freeze
            </p>
          </div>
        );
      })()}

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
