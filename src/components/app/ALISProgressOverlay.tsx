import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Sparkles, Atom, Shield, Zap, Eye, Target, Cpu } from "lucide-react";

const ANALYSIS_STAGES = [
  { icon: Atom, label: "Parsing input", sublabel: "Extracting semantic context", color: "var(--primary)" },
  { icon: Brain, label: "Cognitive mapping", sublabel: "Neural pattern recognition", color: "var(--accent)" },
  { icon: Eye, label: "Gap detection", sublabel: "Identifying knowledge blind spots", color: "var(--warning)" },
  { icon: Shield, label: "Cross-validation", sublabel: "Verifying with knowledge graph", color: "var(--success)" },
  { icon: Target, label: "Strategy synthesis", sublabel: "Building mastery blueprint", color: "var(--primary)" },
];

export default function ALISProgressOverlay() {
  const [stageIdx, setStageIdx] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stageInterval = setInterval(() => {
      setStageIdx(prev => (prev < ANALYSIS_STAGES.length - 1 ? prev + 1 : prev));
    }, 1400);
    return () => clearInterval(stageInterval);
  }, []);

  useEffect(() => {
    const progressInterval = setInterval(() => {
      setProgress(prev => Math.min(prev + 0.8 + Math.random() * 0.6, 95));
    }, 100);
    return () => clearInterval(progressInterval);
  }, []);

  const currentStage = ANALYSIS_STAGES[stageIdx];
  const CurrentIcon = currentStage.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="absolute inset-0 z-40 flex flex-col items-center justify-center"
      style={{ background: "hsl(var(--background) / 0.92)", backdropFilter: "blur(30px)" }}
    >
      {/* Ambient particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 20 }).map((_, i) => (
          <motion.div
            key={i}
            className="absolute rounded-full"
            style={{
              width: 2 + Math.random() * 4,
              height: 2 + Math.random() * 4,
              background: `hsl(${currentStage.color} / ${0.3 + Math.random() * 0.4})`,
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
            }}
            animate={{
              y: [0, -40 - Math.random() * 60, 0],
              x: [0, (Math.random() - 0.5) * 40, 0],
              opacity: [0, 0.8, 0],
              scale: [0, 1.5, 0],
            }}
            transition={{
              duration: 2 + Math.random() * 3,
              repeat: Infinity,
              delay: Math.random() * 3,
              ease: "easeInOut",
            }}
          />
        ))}
      </div>

      {/* Central orb */}
      <div className="relative mb-8">
        {/* Outer rotating ring */}
        <motion.div
          className="absolute -inset-6 rounded-full"
          style={{
            border: `2px solid hsl(${currentStage.color} / 0.15)`,
            borderTopColor: `hsl(${currentStage.color} / 0.6)`,
          }}
          animate={{ rotate: 360 }}
          transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
        {/* Middle pulse ring */}
        <motion.div
          className="absolute -inset-3 rounded-full"
          style={{ border: `1px solid hsl(${currentStage.color} / 0.1)` }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2, repeat: Infinity }}
        />
        {/* Inner glow */}
        <motion.div
          className="w-20 h-20 rounded-full flex items-center justify-center relative"
          style={{
            background: `radial-gradient(circle, hsl(${currentStage.color} / 0.15), hsl(${currentStage.color} / 0.03))`,
            boxShadow: `0 0 40px hsl(${currentStage.color} / 0.2), 0 0 80px hsl(${currentStage.color} / 0.1)`,
          }}
          animate={{ scale: [1, 1.06, 1] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={stageIdx}
              initial={{ scale: 0, rotate: -90, opacity: 0 }}
              animate={{ scale: 1, rotate: 0, opacity: 1 }}
              exit={{ scale: 0, rotate: 90, opacity: 0 }}
              transition={{ type: "spring", damping: 12 }}
            >
              <CurrentIcon className="w-8 h-8" style={{ color: `hsl(${currentStage.color})` }} />
            </motion.div>
          </AnimatePresence>
        </motion.div>
      </div>

      {/* Stage label */}
      <AnimatePresence mode="wait">
        <motion.div
          key={stageIdx}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -12 }}
          transition={{ duration: 0.3 }}
          className="text-center mb-6"
        >
          <p className="text-sm font-bold text-foreground tracking-wide">{currentStage.label}</p>
          <p className="text-[10px] text-muted-foreground mt-1">{currentStage.sublabel}</p>
        </motion.div>
      </AnimatePresence>

      {/* Progress bar */}
      <div className="w-56 space-y-2">
        <div className="w-full h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary) / 0.6)" }}>
          <motion.div
            className="h-full rounded-full relative"
            style={{
              width: `${progress}%`,
              background: `linear-gradient(90deg, hsl(${currentStage.color}), hsl(${currentStage.color} / 0.6))`,
              boxShadow: `0 0 12px hsl(${currentStage.color} / 0.5)`,
            }}
            transition={{ duration: 0.15, ease: "linear" }}
          >
            {/* Shimmer */}
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent 30%, hsl(0 0% 100% / 0.3) 50%, transparent 70%)" }}
              animate={{ x: ["-100%", "200%"] }}
              transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
            />
          </motion.div>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-[9px] text-muted-foreground/60 font-medium">{Math.round(progress)}%</span>
          <div className="flex items-center gap-1">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity }}>
              <Sparkles className="w-2.5 h-2.5 text-muted-foreground/50" />
            </motion.div>
            <span className="text-[9px] text-muted-foreground/60 font-medium">ACRY Ω</span>
          </div>
        </div>
      </div>

      {/* Stage dots */}
      <div className="flex items-center gap-2 mt-6">
        {ANALYSIS_STAGES.map((stage, i) => (
          <motion.div
            key={i}
            className="rounded-full"
            style={{
              width: i === stageIdx ? 16 : 6,
              height: 6,
              borderRadius: 999,
              background: i <= stageIdx ? `hsl(${stage.color})` : "hsl(var(--secondary))",
              boxShadow: i === stageIdx ? `0 0 8px hsl(${stage.color} / 0.5)` : "none",
            }}
            animate={i === stageIdx ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1, repeat: Infinity }}
            layout
          />
        ))}
      </div>
    </motion.div>
  );
}
