import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, Sparkles, Cpu, Zap } from "lucide-react";

interface Props {
  onComplete?: () => void;
  message?: string;
}

/**
 * Ultra-Advanced AI Neural Boot Loader.
 *
 * - Glassy backdrop tuned to the app theme (no harsh black).
 * - Rotating neural orbit rings with a pulsing core Brain icon.
 * - Animated "neural sync" progress bar with shimmer.
 * - Cycling AI status lines (e.g. "Calibrating neurons", "Loading memory map").
 *
 * Designed to be reused across Home, Action, MyRank, Practice Zone, You tabs.
 */
const STATUS_LINES = [
  "Initializing neural cortex",
  "Calibrating memory map",
  "Syncing intelligence layer",
  "Optimizing prediction engine",
  "Ready",
];

const NeuralBootLoader = ({ onComplete, message = "Loading" }: Props) => {
  const [statusIdx, setStatusIdx] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => onComplete?.(), 1600);
    return () => clearTimeout(t);
  }, [onComplete]);

  // Cycle through AI status lines while loading
  useEffect(() => {
    const interval = setInterval(() => {
      setStatusIdx((i) => Math.min(i + 1, STATUS_LINES.length - 1));
    }, 320);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative flex flex-col items-center justify-center py-16 min-h-[420px] overflow-hidden rounded-3xl">
      {/* Ambient glow background */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[340px] h-[340px] rounded-full bg-primary/10 blur-3xl animate-[pulse_3s_ease-in-out_infinite]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[220px] h-[220px] rounded-full bg-accent/15 blur-2xl animate-[pulse_2.2s_ease-in-out_infinite]" />
      </div>

      {/* Floating neural particles */}
      <div className="absolute inset-0 pointer-events-none">
        {Array.from({ length: 14 }).map((_, i) => (
          <motion.span
            key={i}
            className="absolute w-1 h-1 rounded-full bg-primary/60"
            initial={{
              x: `${50 + Math.cos((i / 14) * Math.PI * 2) * 30}%`,
              y: `${50 + Math.sin((i / 14) * Math.PI * 2) * 30}%`,
              opacity: 0,
            }}
            animate={{
              opacity: [0, 1, 0],
              scale: [0.5, 1.4, 0.5],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
              delay: (i / 14) * 1.4,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Core orbit system */}
      <div className="relative w-44 h-44 flex items-center justify-center">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-primary/30"
          style={{
            borderTopColor: "hsl(var(--primary))",
            borderRightColor: "transparent",
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        />
        {/* Middle counter-rotating ring */}
        <motion.div
          className="absolute inset-4 rounded-full border-2 border-accent/30"
          style={{
            borderBottomColor: "hsl(var(--accent))",
            borderLeftColor: "transparent",
          }}
          animate={{ rotate: -360 }}
          transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
        />
        {/* Inner dashed ring */}
        <motion.div
          className="absolute inset-8 rounded-full border border-dashed border-primary/40"
          animate={{ rotate: 360 }}
          transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
        />

        {/* Orbiting micro icons */}
        {[Sparkles, Cpu, Zap].map((Icon, i) => (
          <motion.div
            key={i}
            className="absolute w-6 h-6 rounded-full bg-background/80 backdrop-blur flex items-center justify-center border border-primary/40 shadow-[0_0_12px_hsl(var(--primary)/0.4)]"
            style={{ top: "50%", left: "50%", marginLeft: -12, marginTop: -12 }}
            animate={{
              rotate: [0, 360],
            }}
            transition={{
              duration: 3 + i * 0.6,
              repeat: Infinity,
              ease: "linear",
            }}
          >
            <motion.div
              style={{
                transform: `translateX(${72 + i * 6}px)`,
              }}
              animate={{ rotate: [0, -360] }}
              transition={{
                duration: 3 + i * 0.6,
                repeat: Infinity,
                ease: "linear",
              }}
            >
              <Icon className="w-3 h-3 text-primary" />
            </motion.div>
          </motion.div>
        ))}

        {/* Pulsing core */}
        <motion.div
          className="relative w-20 h-20 rounded-full flex items-center justify-center"
          style={{
            background:
              "radial-gradient(circle at 30% 30%, hsl(var(--primary)/0.9), hsl(var(--accent)/0.6) 60%, transparent 75%)",
            boxShadow:
              "0 0 40px hsl(var(--primary)/0.6), inset 0 0 24px hsl(var(--accent)/0.5)",
          }}
          animate={{
            scale: [1, 1.08, 1],
          }}
          transition={{
            duration: 1.4,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        >
          <Brain className="w-9 h-9 text-primary-foreground drop-shadow-[0_0_8px_hsl(var(--primary))]" />
        </motion.div>
      </div>

      {/* Message */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="mt-8 text-center px-6"
      >
        <div className="text-base font-bold tracking-wide bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent animate-[shimmer_3s_linear_infinite] bg-[length:200%_auto]">
          {message}
        </div>
        <motion.div
          key={statusIdx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mt-1.5 text-[11px] text-muted-foreground font-medium tracking-wide uppercase"
        >
          {STATUS_LINES[statusIdx]}
          <span className="inline-block w-1 h-1 rounded-full bg-primary ml-1 animate-pulse" />
        </motion.div>
      </motion.div>

      {/* Neural progress bar */}
      <div className="mt-5 w-48 h-1 rounded-full bg-muted/40 overflow-hidden relative">
        <motion.div
          className="absolute inset-y-0 left-0 rounded-full"
          style={{
            background:
              "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--accent)), hsl(var(--primary)))",
            backgroundSize: "200% 100%",
          }}
          initial={{ width: "0%" }}
          animate={{ width: "100%", backgroundPosition: ["0% 0%", "200% 0%"] }}
          transition={{
            width: { duration: 1.5, ease: "easeInOut" },
            backgroundPosition: { duration: 2, repeat: Infinity, ease: "linear" },
          }}
        />
      </div>

      <style>{`
        @keyframes shimmer {
          0% { background-position: 0% center; }
          100% { background-position: 200% center; }
        }
      `}</style>
    </div>
  );
};

export default NeuralBootLoader;
