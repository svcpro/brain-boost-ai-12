import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { HeartCrack, X, Sparkles, RotateCcw, Play } from "lucide-react";

interface StreakRecoveryProps {
  currentStreak: number;
  longestStreak: number;
  todayMet: boolean;
  onStartRecovery?: () => void;
}

const DISMISSED_KEY = "streak-recovery-dismissed";

function getDismissedDate(): string | null {
  try {
    return localStorage.getItem(DISMISSED_KEY);
  } catch {
    return null;
  }
}

function setDismissedToday() {
  localStorage.setItem(DISMISSED_KEY, new Date().toLocaleDateString("en-CA"));
}

const MESSAGES = [
  { text: "Missing a few days is normal — what matters is coming back.", tip: "Start with just 5 minutes today." },
  { text: "Every expert has had setbacks. Your comeback starts now.", tip: "Try a quick review of your strongest topic." },
  { text: "A break doesn't erase your progress — your brain remembers more than you think.", tip: "Pick one topic and do a light refresh." },
];

const StreakRecoveryCard = ({ currentStreak, longestStreak, todayMet, onStartRecovery }: StreakRecoveryProps) => {
  const [visible, setVisible] = useState(false);
  const [msgIndex, setMsgIndex] = useState(0);

  useEffect(() => {
    // Show if: user had a streak of 3+ but currently at 0, and hasn't studied today
    if (currentStreak === 0 && longestStreak >= 3 && !todayMet) {
      const today = new Date().toLocaleDateString("en-CA");
      if (getDismissedDate() === today) return;
      setMsgIndex(Math.floor(Math.random() * MESSAGES.length));
      setVisible(true);
    } else {
      setVisible(false);
    }
  }, [currentStreak, longestStreak, todayMet]);

  const handleDismiss = () => {
    setDismissedToday();
    setVisible(false);
  };

  const msg = MESSAGES[msgIndex];

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 280, damping: 24 }}
          className="glass rounded-xl p-4 neural-border border border-warning/20 relative overflow-hidden"
        >
          {/* Soft gradient accent */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-warning/40 via-warning/60 to-warning/40 rounded-t-xl" />

          <button
            onClick={handleDismiss}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary/60 transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-start gap-3">
            <motion.div
              className="p-2.5 rounded-xl bg-warning/10 shrink-0"
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <HeartCrack className="w-5 h-5 text-warning" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <RotateCcw className="w-3.5 h-3.5 text-warning" />
                <h3 className="font-semibold text-foreground text-sm">Time to bounce back!</h3>
              </div>

              <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
                {msg.text}
              </p>

              <div className="flex items-center gap-1.5 mt-2.5 px-2.5 py-1.5 rounded-lg bg-primary/5 border border-primary/10">
                <Sparkles className="w-3 h-3 text-primary shrink-0" />
                <span className="text-[11px] text-primary font-medium">{msg.tip}</span>
              </div>

              {longestStreak > 0 && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Your best was <span className="font-semibold text-foreground">{longestStreak} days</span> — you can beat that! 💪
                </p>
              )}

              {onStartRecovery && (
                <motion.button
                  onClick={() => { onStartRecovery(); handleDismiss(); }}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  className="mt-3 w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold transition-colors hover:bg-primary/90"
                >
                  <Play className="w-3.5 h-3.5" />
                  Start Recovery Session
                </motion.button>
              )}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default StreakRecoveryCard;
