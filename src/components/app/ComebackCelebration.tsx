import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { PartyPopper, X } from "lucide-react";
import confetti from "canvas-confetti";

interface ComebackCelebrationProps {
  show: boolean;
  onDismiss: () => void;
}

const ComebackCelebration = ({ show, onDismiss }: ComebackCelebrationProps) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!show) { setVisible(false); return; }
    setVisible(true);

    // Gentle confetti — softer than milestones
    const timer = setTimeout(() => {
      confetti({
        particleCount: 50,
        spread: 60,
        origin: { y: 0.55 },
        colors: ["#22c55e", "#4ade80", "#86efac"],
        gravity: 0.8,
        scalar: 0.9,
      });
    }, 200);

    // Auto-dismiss after 5 seconds
    const dismiss = setTimeout(() => {
      setVisible(false);
      onDismiss();
    }, 5000);

    return () => { clearTimeout(timer); clearTimeout(dismiss); };
  }, [show, onDismiss]);

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
          className="glass rounded-xl p-5 neural-border border border-success/25 relative overflow-hidden"
        >
          {/* Success shimmer */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-success/5 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 2, ease: "easeInOut" }}
          />

          <button
            onClick={() => { setVisible(false); onDismiss(); }}
            className="absolute top-3 right-3 p-1 rounded-full hover:bg-secondary/60 transition-colors z-10"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>

          <div className="flex items-center gap-4 relative z-10">
            <motion.div
              className="p-3 rounded-xl bg-success/10"
              animate={{ rotate: [0, -8, 8, -4, 4, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <PartyPopper className="w-6 h-6 text-success" />
            </motion.div>

            <div className="flex-1 min-w-0">
              <motion.h3
                className="font-bold text-foreground text-sm"
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 }}
              >
                Welcome back! 🎉
              </motion.h3>
              <motion.p
                className="text-xs text-muted-foreground mt-1 leading-relaxed"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.3 }}
              >
                You just completed your first session after a break — that takes real determination. Your streak starts fresh today!
              </motion.p>
            </div>
          </div>

          {/* Progress indicator */}
          <div className="mt-3 h-0.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full bg-success/50 rounded-full"
              initial={{ width: "100%" }}
              animate={{ width: "0%" }}
              transition={{ duration: 5, ease: "linear" }}
            />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ComebackCelebration;
