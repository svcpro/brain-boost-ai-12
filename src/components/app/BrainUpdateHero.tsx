import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Sparkles, RefreshCw, CheckCircle2, BellRing } from "lucide-react";

interface BrainUpdateHeroProps {
  onOpen: () => void;
  overallHealth: number;
  hasTopics: boolean;
}

const LAST_TAP_KEY = "brain-update-last-tap";

const isStale = () => {
  const last = localStorage.getItem(LAST_TAP_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > 24 * 60 * 60 * 1000;
};

export const markBrainUpdated = () => {
  localStorage.setItem(LAST_TAP_KEY, String(Date.now()));
};

const BrainUpdateHero = ({ onOpen, overallHealth, hasTopics }: BrainUpdateHeroProps) => {
  const [needsNudge, setNeedsNudge] = useState(isStale);

  const handleClick = () => {
    setNeedsNudge(false);
    onOpen();
  };

  // Re-check staleness every minute
  useEffect(() => {
    const id = setInterval(() => setNeedsNudge(isStale()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.button
      onClick={handleClick}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      whileHover={{ scale: 1.02, y: -2 }}
      whileTap={{ scale: 0.97 }}
      className={`w-full relative overflow-hidden rounded-2xl p-6 text-left group focus:outline-none transition-shadow ${
        needsNudge
          ? "shadow-[0_0_30px_hsl(var(--primary)/0.35)] ring-2 ring-primary/50"
          : "shadow-[0_0_20px_hsl(var(--primary)/0.15)] hover:shadow-[0_0_35px_hsl(var(--primary)/0.3)]"
      }`}
    >
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-accent/15 rounded-2xl" />
      <motion.div
        className="absolute inset-0 bg-gradient-to-r from-primary/0 via-primary/15 to-primary/0"
        animate={{ x: ["-100%", "200%"] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
        style={{ width: "60%" }}
      />

      {/* Pulsing glow border */}
      <div className="absolute inset-0 rounded-2xl border-2 border-primary/40 group-hover:border-primary/60 transition-colors" />
      <motion.div
        className="absolute inset-0 rounded-2xl border-2 border-primary/30"
        animate={{ opacity: [0.2, 1, 0.2], scale: [1, 1.01, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      {/* Outer glow pulse */}
      <motion.div
        className="absolute -inset-1 rounded-3xl bg-primary/10 blur-md -z-10"
        animate={{ opacity: [0.3, 0.7, 0.3], scale: [0.98, 1.02, 0.98] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Floating particles */}
      {[...Array(5)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full bg-primary/40"
          initial={{ x: `${20 + i * 15}%`, y: "80%", opacity: 0 }}
          animate={{ y: [null, "10%", "80%"], opacity: [0, 0.8, 0] }}
          transition={{ duration: 2.5 + i * 0.4, repeat: Infinity, delay: i * 0.5, ease: "easeInOut" }}
        />
      ))}

      {/* Content */}
      <div className="relative flex items-center gap-4">
        {/* Brain icon */}
        <div className="relative">
          <div className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.2)]">
            <Brain className="w-7 h-7 text-primary" />
          </div>
          {/* Status dot */}
          <motion.div
            className={`absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2 border-background ${
              hasTopics ? "bg-primary" : "bg-muted-foreground"
            }`}
            animate={hasTopics ? { scale: [1, 1.3, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity }}
          />
        </div>

        {/* Text */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">Update My Brain</h2>
            <motion.div
              animate={{ rotate: [0, 15, -15, 0] }}
              transition={{ duration: 1.5, repeat: Infinity, delay: 2 }}
            >
              <Sparkles className="w-4 h-4 text-warning" />
            </motion.div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {needsNudge
              ? "⏰ It's been a while — tap to log what you studied!"
              : hasTopics
              ? "Tap to log a study session & refresh your brain"
              : "Start here — log your first study session"}
          </p>
        </div>

        {/* Arrow / indicator */}
        <motion.div
          animate={{ x: [0, 4, 0] }}
          transition={{ duration: 1.5, repeat: Infinity }}
          className="flex-shrink-0"
        >
          {needsNudge ? (
            <motion.div animate={{ rotate: [0, 15, -15, 0] }} transition={{ duration: 0.6, repeat: Infinity }}>
              <BellRing className="w-5 h-5 text-warning" />
            </motion.div>
          ) : (
            <Zap className="w-5 h-5 text-primary" />
          )}
        </motion.div>
      </div>
    </motion.button>
  );
};

export default BrainUpdateHero;
