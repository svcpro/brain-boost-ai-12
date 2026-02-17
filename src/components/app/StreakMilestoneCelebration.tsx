import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, X, Flame, Star, Crown } from "lucide-react";
import confetti from "canvas-confetti";
import { useAuth } from "@/contexts/AuthContext";
import { useWhatsAppPreview } from "@/hooks/useWhatsAppPreview";
import WhatsAppPreviewModal from "@/components/app/WhatsAppPreviewModal";

interface StreakMilestoneProps {
  currentStreak: number;
}

const MILESTONES = [
  { days: 7, label: "1 Week Streak!", icon: Flame, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30", emoji: "🔥" },
  { days: 14, label: "2 Week Streak!", icon: Star, color: "text-primary", bg: "bg-primary/10", border: "border-primary/30", emoji: "⭐" },
  { days: 30, label: "30 Day Streak!", icon: Crown, color: "text-success", bg: "bg-success/10", border: "border-success/30", emoji: "👑" },
];

const DISMISSED_KEY = "streak-milestone-dismissed";

function getDismissed(): Record<number, string> {
  try {
    return JSON.parse(localStorage.getItem(DISMISSED_KEY) || "{}");
  } catch {
    return {};
  }
}

function setDismissed(days: number) {
  const dismissed = getDismissed();
  dismissed[days] = new Date().toISOString();
  localStorage.setItem(DISMISSED_KEY, JSON.stringify(dismissed));
}

const StreakMilestoneCelebration = ({ currentStreak }: StreakMilestoneProps) => {
  const { user } = useAuth();
  const [visible, setVisible] = useState(false);
  const [milestone, setMilestone] = useState<typeof MILESTONES[0] | null>(null);
  const { previewState, showPreview, confirmSend, cancelSend } = useWhatsAppPreview();

  useEffect(() => {
    if (currentStreak <= 0) return;

    // Find the highest milestone the user has hit
    const dismissed = getDismissed();
    const hit = [...MILESTONES].reverse().find(
      (m) => currentStreak >= m.days && !dismissed[m.days]
    );

    if (hit) {
      setMilestone(hit);
      setVisible(true);
      // Send WhatsApp streak milestone notification
      if (user) {
        showPreview("streak_milestone", { user_id: user.id, data: { days: hit.days } });
      }
    }
  }, [currentStreak, user]);

  // Fire confetti when card appears
  useEffect(() => {
    if (!visible || !milestone) return;
    const timer = setTimeout(() => {
      const colors = milestone.days >= 30
        ? ["#22c55e", "#16a34a", "#4ade80"]
        : milestone.days >= 14
        ? ["#6366f1", "#818cf8", "#a5b4fc"]
        : ["#f59e0b", "#fbbf24", "#fcd34d"];

      confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 }, colors });
    }, 300);
    return () => clearTimeout(timer);
  }, [visible, milestone]);

  const handleDismiss = useCallback(() => {
    if (milestone) setDismissed(milestone.days);
    setVisible(false);
  }, [milestone]);

  if (!milestone) return null;

  const Icon = milestone.icon;

  return (
    <>
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -10 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className={`glass rounded-xl p-5 neural-border ${milestone.border} border relative overflow-hidden`}
        >
          {/* Shimmer overlay */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, ease: "easeInOut" }}
          />

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary/60 transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            <motion.div
              className={`p-3 rounded-xl ${milestone.bg}`}
              animate={{ rotate: [0, -10, 10, -5, 5, 0] }}
              transition={{ duration: 0.6, delay: 0.5 }}
            >
              <Icon className={`w-7 h-7 ${milestone.color}`} />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Trophy className="w-4 h-4 text-warning" />
                <h3 className="font-bold text-foreground text-sm">Milestone Unlocked!</h3>
              </div>
              <motion.p
                className={`text-lg font-extrabold ${milestone.color} mt-0.5`}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
              >
                {milestone.emoji} {milestone.label}
              </motion.p>
              <p className="text-[11px] text-muted-foreground mt-1">
                {milestone.days === 7 && "A full week of consistency — you're building a habit!"}
                {milestone.days === 14 && "Two weeks strong — your discipline is inspiring!"}
                {milestone.days === 30 && "A whole month! You're in the top tier of learners!"}
              </p>
            </div>
          </div>

          {/* Streak count */}
          <div className="flex items-center justify-center gap-1.5 mt-3 pt-3 border-t border-border">
            <Flame className="w-3.5 h-3.5 text-warning" />
            <span className="text-xs font-semibold text-foreground">{currentStreak}-day streak</span>
            <span className="text-[10px] text-muted-foreground">and counting!</span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    <WhatsAppPreviewModal
      open={previewState.open}
      message={previewState.message}
      eventType={previewState.eventType}
      onConfirm={confirmSend}
      onCancel={cancelSend}
      sending={previewState.sending}
    />
    </>
  );
};

export default StreakMilestoneCelebration;
