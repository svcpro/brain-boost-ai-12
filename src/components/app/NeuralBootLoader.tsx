import { useEffect, useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Cpu, Activity, Sparkles, Zap, Check } from "lucide-react";

const STAGES = [
  { id: 1, label: "Booting Neural Core", icon: Cpu },
  { id: 2, label: "Syncing Memory Engine", icon: Brain },
  { id: 3, label: "Calibrating Predictions", icon: Activity },
  { id: 4, label: "Loading Mission Map", icon: Sparkles },
  { id: 5, label: "Igniting Dashboard", icon: Zap },
];

interface Props {
  onComplete?: () => void;
  message?: string;
}

const NeuralBootLoader = ({ onComplete, message = "Initializing your AI Second Brain" }: Props) => {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);

  // Particle field positions (stable across renders)
  const particles = useMemo(
    () =>
      Array.from({ length: 22 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 3 + 1,
        delay: Math.random() * 2,
        duration: Math.random() * 3 + 2,
      })),
    []
  );

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setStage((s) => {
        if (s >= STAGES.length) {
          clearInterval(stageInterval);
          return s;
        }
        return s + 1;
      });
    }, 480);
    return () => clearInterval(stageInterval);
  }, []);

  useEffect(() => {
    const tick = setInterval(() => {
      setProgress((p) => {
        const target = (stage / STAGES.length) * 100;
        if (p >= target) return p;
        return Math.min(target, p + 2);
      });
    }, 30);
    return () => clearInterval(tick);
  }, [stage]);

  useEffect(() => {
    if (stage >= STAGES.length && progress >= 100) {
      const t = setTimeout(() => onComplete?.(), 350);
      return () => clearTimeout(t);
    }
  }, [stage, progress, onComplete]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="relative min-h-[80vh] flex flex-col items-center justify-center px-6 overflow-hidden"
    >
      {/* Ambient gradient orbs */}
      <div className="absolute inset-0 pointer-events-none">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.25, 0.4, 0.25] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="absolute top-1/4 left-1/4 w-72 h-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.4), transparent 70%)" }}
        />
        <motion.div
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 1 }}
          className="absolute bottom-1/4 right-1/4 w-72 h-72 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--accent) / 0.4), transparent 70%)" }}
        />
      </div>

      {/* Particle field */}
      <div className="absolute inset-0 pointer-events-none">
        {particles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full bg-primary/60"
            style={{
              left: `${p.x}%`,
              top: `${p.y}%`,
              width: p.size,
              height: p.size,
            }}
            animate={{
              y: [0, -20, 0],
              opacity: [0, 1, 0],
              scale: [0.5, 1.2, 0.5],
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Orbital rings + pulsing core */}
      <div className="relative w-44 h-44 flex items-center justify-center mb-8">
        {/* Outer ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          className="absolute inset-0 rounded-full border-2 border-primary/30 border-t-primary border-r-primary/60"
        />
        {/* Mid ring */}
        <motion.div
          animate={{ rotate: -360 }}
          transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
          className="absolute inset-3 rounded-full border-2 border-accent/30 border-b-accent border-l-accent/60"
        />
        {/* Inner ring */}
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
          className="absolute inset-7 rounded-full border border-primary/40 border-t-primary"
        />

        {/* Glow halo */}
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0.9, 0.5] }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          className="absolute inset-10 rounded-full blur-xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.6), transparent 70%)" }}
        />

        {/* Pulsing core */}
        <motion.div
          animate={{ scale: [1, 1.08, 1] }}
          transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }}
          className="relative w-20 h-20 rounded-full flex items-center justify-center shadow-2xl"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(var(--primary)), hsl(var(--accent)))",
            boxShadow: "0 0 40px hsl(var(--primary) / 0.6)",
          }}
        >
          <Brain className="w-9 h-9 text-primary-foreground" strokeWidth={2.2} />
        </motion.div>
      </div>

      {/* Title */}
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="text-center mb-6 z-10"
      >
        <h2 className="text-lg font-bold text-foreground mb-1 tracking-tight">
          {message}
        </h2>
        <p className="text-xs text-muted-foreground">
          Calibrating cognitive signals…
        </p>
      </motion.div>

      {/* Gradient progress bar */}
      <div className="relative w-full max-w-xs mb-6 z-10">
        <div className="h-2 rounded-full bg-muted/60 overflow-hidden backdrop-blur-sm">
          <motion.div
            className="h-full rounded-full relative"
            style={{
              width: `${progress}%`,
              background:
                "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
              backgroundSize: "200% 100%",
            }}
            animate={{ backgroundPosition: ["0% 0%", "200% 0%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/40 to-transparent animate-pulse" />
          </motion.div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span className="text-[10px] font-medium text-muted-foreground tracking-wider">
            NEURAL INIT
          </span>
          <span className="text-[10px] font-bold text-primary tabular-nums">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

    </motion.div>
  );
};

export default NeuralBootLoader;
