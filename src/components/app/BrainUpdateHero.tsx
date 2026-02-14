import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Sparkles, RefreshCw, CheckCircle2, BellRing } from "lucide-react";

interface BrainUpdateHeroProps {
  onUpdate: () => Promise<void>;
  isActive: boolean;
  overallHealth: number;
  hasTopics: boolean;
}

const LAST_TAP_KEY = "brain-update-last-tap";

const isStale = () => {
  const last = localStorage.getItem(LAST_TAP_KEY);
  if (!last) return true;
  return Date.now() - Number(last) > 24 * 60 * 60 * 1000;
};

const BrainUpdateHero = ({ onUpdate, isActive, overallHealth, hasTopics }: BrainUpdateHeroProps) => {
  const [done, setDone] = useState(false);
  const [needsNudge, setNeedsNudge] = useState(isStale);

  const handleClick = async () => {
    if (isActive) return;
    setDone(false);
    localStorage.setItem(LAST_TAP_KEY, String(Date.now()));
    setNeedsNudge(false);
    await onUpdate();
    setDone(true);
    setTimeout(() => setDone(false), 3000);
  };

  // Re-check staleness every minute
  useEffect(() => {
    const id = setInterval(() => setNeedsNudge(isStale()), 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <motion.button
      onClick={handleClick}
      disabled={isActive}
      initial={{ opacity: 0, y: -10, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ type: "spring", stiffness: 200, damping: 20 }}
      whileHover={!isActive ? { scale: 1.02, y: -2 } : {}}
      whileTap={!isActive ? { scale: 0.97 } : {}}
      className={`w-full relative overflow-hidden rounded-2xl p-6 text-left group focus:outline-none disabled:cursor-wait transition-shadow ${
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
          initial={{
            x: `${20 + i * 15}%`,
            y: "80%",
            opacity: 0,
          }}
          animate={{
            y: [null, "10%", "80%"],
            opacity: [0, 0.8, 0],
          }}
          transition={{
            duration: 2.5 + i * 0.4,
            repeat: Infinity,
            delay: i * 0.5,
            ease: "easeInOut",
          }}
        />
      ))}

      {/* Content */}
      <div className="relative flex items-center gap-4">
        {/* Animated brain icon */}
        <div className="relative">
          <motion.div
            animate={isActive ? { rotate: 360 } : { rotate: 0 }}
            transition={isActive ? { duration: 1.5, repeat: Infinity, ease: "linear" } : {}}
            className="w-16 h-16 rounded-xl bg-gradient-to-br from-primary/30 to-primary/10 flex items-center justify-center shadow-[0_0_15px_hsl(var(--primary)/0.2)]"
          >
            <AnimatePresence mode="wait">
              {isActive ? (
                <motion.div
                  key="loading"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <RefreshCw className="w-7 h-7 text-primary animate-spin" />
                </motion.div>
              ) : done ? (
                <motion.div
                  key="done"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <CheckCircle2 className="w-7 h-7 text-primary" />
                </motion.div>
              ) : (
                <motion.div
                  key="brain"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0 }}
                >
                  <Brain className="w-7 h-7 text-primary" />
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
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
            <h2 className="text-xl font-bold text-foreground">
              {isActive ? "Updating Brain…" : done ? "Brain Updated!" : "Update My Brain"}
            </h2>
            {!isActive && !done && (
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, delay: 2 }}
              >
                <Sparkles className="w-4 h-4 text-warning" />
              </motion.div>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isActive
              ? "AI is analyzing your memory patterns…"
              : done
              ? `Brain health: ${overallHealth}% — recommendations refreshed`
              : needsNudge
              ? "⏰ It's been a while — tap to refresh your memory predictions!"
              : hasTopics
              ? "Tap to run AI analysis & refresh memory predictions"
              : "Start here — analyze your study data with AI"}
          </p>
        </div>

        {/* Arrow / indicator */}
        {!isActive && !done && (
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
        )}
      </div>

      {/* Progress bar when active */}
      <AnimatePresence>
        {isActive && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="relative mt-3 h-1 rounded-full bg-secondary/50 overflow-hidden"
          >
            <motion.div
              className="h-full bg-gradient-to-r from-primary via-primary/80 to-primary rounded-full"
              initial={{ width: "0%" }}
              animate={{ width: "90%" }}
              transition={{ duration: 8, ease: "easeOut" }}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </motion.button>
  );
};

export default BrainUpdateHero;
