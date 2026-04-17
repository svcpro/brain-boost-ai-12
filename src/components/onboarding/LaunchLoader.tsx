import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useState } from "react";
import { Brain, Sparkles, Target, Zap, Rocket, CheckCircle2 } from "lucide-react";

interface LaunchLoaderProps {
  active: boolean;
  /** Optional: called after the launch sequence finishes its visible animation */
  onSequenceComplete?: () => void;
}

const STAGES = [
  { id: 0, label: "Calibrating neural profile", icon: Brain, color: "#00E5FF" },
  { id: 1, label: "Mapping syllabus universe", icon: Target, color: "#7C4DFF" },
  { id: 2, label: "Activating memory engine", icon: Zap, color: "#00FF94" },
  { id: 3, label: "Personalizing AI mentor", icon: Sparkles, color: "#FFB300" },
  { id: 4, label: "Launching ACRY", icon: Rocket, color: "#FF3D71" },
];

const LaunchLoader = ({ active, onSequenceComplete }: LaunchLoaderProps) => {
  const [stage, setStage] = useState(0);
  const [progress, setProgress] = useState(0);

  // Particle field
  const particles = useMemo(
    () =>
      Array.from({ length: 32 }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        y: Math.random() * 100,
        size: Math.random() * 2 + 0.6,
        duration: 4 + Math.random() * 6,
        delay: Math.random() * 3,
        color: i % 4 === 0 ? "#00E5FF" : i % 4 === 1 ? "#7C4DFF" : i % 4 === 2 ? "#00FF94" : "#FF3D71",
      })),
    []
  );

  useEffect(() => {
    if (!active) {
      setStage(0);
      setProgress(0);
      return;
    }
    const stageTimers: ReturnType<typeof setTimeout>[] = [];
    STAGES.forEach((_, i) => {
      stageTimers.push(setTimeout(() => setStage(i), i * 700));
    });
    // Smooth progress
    const start = Date.now();
    const total = STAGES.length * 700 + 500;
    const interval = setInterval(() => {
      const elapsed = Date.now() - start;
      const pct = Math.min(100, (elapsed / total) * 100);
      setProgress(pct);
      if (pct >= 100) clearInterval(interval);
    }, 40);
    const done = setTimeout(() => onSequenceComplete?.(), total);
    return () => {
      stageTimers.forEach(clearTimeout);
      clearInterval(interval);
      clearTimeout(done);
    };
  }, [active, onSequenceComplete]);

  const ActiveIcon = STAGES[stage].icon;
  const activeColor = STAGES[stage].color;

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4 }}
          className="fixed inset-0 z-[200] flex items-center justify-center"
          style={{ background: "radial-gradient(circle at 50% 40%, #0B0F1A 0%, #050810 70%)" }}
        >
          {/* Particle field */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            {particles.map((p) => (
              <motion.div
                key={p.id}
                className="absolute rounded-full"
                style={{
                  width: p.size,
                  height: p.size,
                  left: `${p.x}%`,
                  top: `${p.y}%`,
                  background: p.color,
                  boxShadow: `0 0 ${p.size * 6}px ${p.color}80`,
                }}
                animate={{
                  y: [0, -40, 0],
                  opacity: [0.1, 0.7, 0.1],
                  scale: [1, 1.4, 1],
                }}
                transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
              />
            ))}
          </div>

          {/* Ambient glow orbs */}
          <motion.div
            className="absolute w-[500px] h-[500px] rounded-full pointer-events-none"
            style={{ background: `radial-gradient(circle, ${activeColor}25, transparent 70%)`, filter: "blur(60px)" }}
            animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />

          {/* Center stack */}
          <div className="relative flex flex-col items-center gap-8 px-6 max-w-[420px] w-full">
            {/* Orbital rings + core */}
            <div className="relative w-44 h-44 flex items-center justify-center">
              {/* Outer rotating ring */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{ border: `1px solid ${activeColor}40` }}
                animate={{ rotate: 360 }}
                transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
              >
                <div
                  className="absolute -top-1 left-1/2 -translate-x-1/2 w-2 h-2 rounded-full"
                  style={{ background: activeColor, boxShadow: `0 0 12px ${activeColor}` }}
                />
              </motion.div>

              {/* Mid ring (counter) */}
              <motion.div
                className="absolute inset-4 rounded-full"
                style={{ border: `1px dashed ${activeColor}30` }}
                animate={{ rotate: -360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              />

              {/* Inner ring */}
              <motion.div
                className="absolute inset-8 rounded-full"
                style={{ border: `1px solid ${activeColor}25` }}
                animate={{ rotate: 360 }}
                transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              >
                {[0, 90, 180, 270].map((deg) => (
                  <div
                    key={deg}
                    className="absolute w-1 h-1 rounded-full"
                    style={{
                      background: activeColor,
                      boxShadow: `0 0 8px ${activeColor}`,
                      top: "50%",
                      left: "50%",
                      transform: `rotate(${deg}deg) translateY(-44px)`,
                    }}
                  />
                ))}
              </motion.div>

              {/* Pulsing rings */}
              {[0, 1, 2].map((i) => (
                <motion.div
                  key={`pulse-${i}`}
                  className="absolute inset-0 rounded-full pointer-events-none"
                  style={{ border: `1px solid ${activeColor}` }}
                  animate={{ scale: [1, 1.6], opacity: [0.5, 0] }}
                  transition={{ duration: 2, delay: i * 0.6, repeat: Infinity, ease: "easeOut" }}
                />
              ))}

              {/* Core */}
              <motion.div
                key={stage}
                initial={{ scale: 0, rotate: -180, opacity: 0 }}
                animate={{ scale: 1, rotate: 0, opacity: 1 }}
                transition={{ type: "spring", bounce: 0.5, duration: 0.7 }}
                className="relative w-20 h-20 rounded-3xl flex items-center justify-center"
                style={{
                  background: `linear-gradient(135deg, ${activeColor}30, ${activeColor}08)`,
                  border: `1px solid ${activeColor}60`,
                  boxShadow: `0 0 30px ${activeColor}50, inset 0 1px 0 ${activeColor}30`,
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                >
                  <ActiveIcon size={36} style={{ color: activeColor, filter: `drop-shadow(0 0 8px ${activeColor})` }} />
                </motion.div>
              </motion.div>
            </div>

            {/* Brand title */}
            <div className="text-center">
              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-2xl font-bold tracking-[0.2em] mb-1"
                style={{
                  background: "linear-gradient(135deg, #00E5FF, #7C4DFF, #00FF94)",
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  filter: "drop-shadow(0 0 20px #00E5FF40)",
                }}
              >
                LAUNCHING ACRY
              </motion.h2>
              <p className="text-[10px] uppercase tracking-[0.3em]" style={{ color: "#ffffff40" }}>
                Neural System Initializing
              </p>
            </div>

            {/* Progress bar */}
            <div className="w-full">
              <div className="h-1 rounded-full overflow-hidden relative" style={{ background: "#ffffff08" }}>
                <motion.div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${progress}%`,
                    background: "linear-gradient(90deg, #00E5FF, #7C4DFF, #00FF94)",
                    boxShadow: "0 0 12px #00E5FF80",
                  }}
                  transition={{ ease: "easeOut" }}
                />
                {/* Shimmer */}
                <motion.div
                  className="absolute inset-y-0 w-1/4"
                  style={{
                    background: "linear-gradient(90deg, transparent, #ffffff40, transparent)",
                  }}
                  animate={{ left: ["-25%", "100%"] }}
                  transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
                />
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] tracking-wider" style={{ color: "#ffffff35" }}>
                  {Math.floor(progress)}%
                </span>
                <span className="text-[9px] tracking-wider" style={{ color: activeColor }}>
                  STAGE {stage + 1} / {STAGES.length}
                </span>
              </div>
            </div>

            {/* Stage list */}
            <div className="w-full space-y-1.5">
              {STAGES.map((s, i) => {
                const Icon = s.icon;
                const isDone = i < stage;
                const isActive = i === stage;
                return (
                  <motion.div
                    key={s.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: isDone || isActive ? 1 : 0.3, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    className="flex items-center gap-2.5 px-3 py-2 rounded-lg"
                    style={{
                      background: isActive ? `${s.color}10` : "transparent",
                      border: `1px solid ${isActive ? s.color + "30" : "transparent"}`,
                    }}
                  >
                    <div className="relative w-5 h-5 flex items-center justify-center">
                      {isDone ? (
                        <motion.div
                          initial={{ scale: 0, rotate: -90 }}
                          animate={{ scale: 1, rotate: 0 }}
                          transition={{ type: "spring", bounce: 0.5 }}
                        >
                          <CheckCircle2 size={16} style={{ color: "#00FF94" }} />
                        </motion.div>
                      ) : isActive ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                        >
                          <Icon size={14} style={{ color: s.color }} />
                        </motion.div>
                      ) : (
                        <Icon size={14} style={{ color: "#ffffff30" }} />
                      )}
                    </div>
                    <span
                      className="text-[11px] font-medium tracking-wide"
                      style={{ color: isActive ? s.color : isDone ? "#ffffff80" : "#ffffff40" }}
                    >
                      {s.label}
                    </span>
                    {isActive && (
                      <motion.div
                        className="ml-auto flex gap-0.5"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                      >
                        {[0, 1, 2].map((d) => (
                          <motion.div
                            key={d}
                            className="w-1 h-1 rounded-full"
                            style={{ background: s.color }}
                            animate={{ opacity: [0.2, 1, 0.2] }}
                            transition={{ duration: 1, delay: d * 0.2, repeat: Infinity }}
                          />
                        ))}
                      </motion.div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default LaunchLoader;
