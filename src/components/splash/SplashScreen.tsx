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
    <div className="fixed inset-0 z-[100] overflow-hidden"
      style={{ background: "linear-gradient(180deg, #0B0F1A 0%, #111827 100%)" }}
    >
      {/* Particle field background */}
      <SplashParticleField />

      <AnimatePresence mode="wait">
        {phase === 0 && <SplashPhase1 key="p1" />}
        {phase === 1 && <SplashPhase2 key="p2" />}
        {phase === 2 && <SplashPhase3 key="p3" onComplete={onComplete} />}
      </AnimatePresence>

      {/* Skip button visible on phase 2+ */}
      {phase < 2 && (
        <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.4 }}
          transition={{ delay: 1.5 }}
          onClick={onComplete}
          className="absolute bottom-8 right-6 text-xs text-white/40 hover:text-white/70 transition-colors z-50"
        >
          Skip →
        </motion.button>
      )}
    </div>
  );
};

// Background particle field shared across all phases
const SplashParticleField = () => {
  const particles = Array.from({ length: 40 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 2 + 0.5,
    duration: 8 + Math.random() * 12,
    delay: Math.random() * 5,
    color: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#7C4DFF" : "#00FF94",
  }));

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
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
            boxShadow: `0 0 ${p.size * 3}px ${p.color}40`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0.1, 0.4, 0.1],
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
  );
};

export default SplashScreen;
