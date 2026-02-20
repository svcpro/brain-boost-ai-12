import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import SplashPhase1 from "./SplashPhase1";
import SplashPhase2 from "./SplashPhase2";
import SplashPhase3 from "./SplashPhase3";

interface SplashScreenProps {
  onComplete: () => void;
}

const SplashScreen = ({ onComplete }: SplashScreenProps) => {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2800);
    const t2 = setTimeout(() => setPhase(2), 5600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center"
      style={{ background: "linear-gradient(180deg, #0B0F1A 0%, #111827 100%)" }}
    >
      {/* Mobile phone frame */}
      <div className="relative w-full max-w-[430px] h-[100dvh] overflow-hidden flex flex-col">
        {/* Status bar mock */}
        <div className="flex items-center justify-between px-6 pt-3 pb-1 z-50">
          <motion.span className="text-[10px] font-medium" style={{ color: "#ffffff50" }}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
          >
            {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
          </motion.span>
          <div className="flex items-center gap-1.5">
            {/* Signal bars */}
            <svg width="14" height="10" viewBox="0 0 14 10" fill="none">
              <rect x="0" y="7" width="2" height="3" rx="0.5" fill="#ffffff40" />
              <rect x="3" y="5" width="2" height="5" rx="0.5" fill="#ffffff40" />
              <rect x="6" y="3" width="2" height="7" rx="0.5" fill="#ffffff50" />
              <rect x="9" y="0" width="2" height="10" rx="0.5" fill="#ffffff50" />
            </svg>
            {/* Battery */}
            <svg width="18" height="9" viewBox="0 0 18 9" fill="none">
              <rect x="0.5" y="0.5" width="15" height="8" rx="1.5" stroke="#ffffff40" strokeWidth="1" />
              <rect x="16" y="2.5" width="1.5" height="4" rx="0.5" fill="#ffffff30" />
              <rect x="2" y="2" width="10" height="5" rx="0.8" fill="#00FF94" opacity="0.6" />
            </svg>
          </div>
        </div>

        {/* Particle background confined to phone */}
        <SplashParticleField />

        {/* Phase indicator dots */}
        <div className="absolute top-14 left-1/2 -translate-x-1/2 flex gap-2 z-50">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="rounded-full"
              style={{
                width: phase === i ? 20 : 6,
                height: 6,
                background: phase === i ? "#00E5FF" : "#ffffff15",
                boxShadow: phase === i ? "0 0 8px #00E5FF60" : "none",
              }}
              animate={{ width: phase === i ? 20 : 6 }}
              transition={{ duration: 0.3 }}
            />
          ))}
        </div>

        {/* Content area */}
        <div className="flex-1 relative">
          <AnimatePresence mode="wait">
            {phase === 0 && <SplashPhase1 key="p1" />}
            {phase === 1 && <SplashPhase2 key="p2" />}
            {phase === 2 && <SplashPhase3 key="p3" onComplete={onComplete} />}
          </AnimatePresence>
        </div>

        {/* Bottom safe area with skip */}
        <div className="px-6 pb-6 pt-2 z-50">
          {phase < 2 && (
            <motion.button
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              onClick={onComplete}
              className="w-full py-2.5 text-center text-xs font-medium rounded-xl"
              style={{ color: "#ffffff40", background: "#ffffff06", border: "1px solid #ffffff08" }}
            >
              Skip Introduction →
            </motion.button>
          )}
        </div>
      </div>
    </div>
  );
};

const SplashParticleField = () => {
  const particles = Array.from({ length: 25 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.5 + 0.5,
    duration: 8 + Math.random() * 10,
    delay: Math.random() * 4,
    color: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#7C4DFF" : "#00FF94",
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 3}px ${p.color}30`,
          }}
          animate={{ y: [0, -20, 0], opacity: [0.08, 0.3, 0.08] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

export default SplashScreen;
