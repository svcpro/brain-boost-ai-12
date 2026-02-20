import { motion } from "framer-motion";
import { useMemo } from "react";

const SplashPhase1 = () => {
  const neuralLines = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({
      id: i,
      angle: (i / 8) * 360,
      length: 40 + Math.random() * 50,
      delay: 1.2 + i * 0.1,
    })), []);

  const assemblyParticles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      startX: (Math.random() - 0.5) * 250,
      startY: (Math.random() - 0.5) * 250,
      size: Math.random() * 2.5 + 1,
      delay: Math.random() * 0.5,
      color: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#7C4DFF" : "#00FF94",
    })), []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-8"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.05 }}
      transition={{ duration: 0.4 }}
    >
      {/* Energy pulse from bottom */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-0.5 rounded-full"
        style={{ background: "linear-gradient(to top, #00E5FF, transparent)" }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "45%", opacity: [0, 0.6, 0] }}
        transition={{ duration: 1, ease: "easeOut" }}
      />

      {/* Assembly particles */}
      <div className="absolute inset-0 pointer-events-none">
        {assemblyParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size, height: p.size,
              left: "50%", top: "45%",
              background: p.color,
              boxShadow: `0 0 ${p.size * 3}px ${p.color}`,
            }}
            initial={{ x: p.startX, y: p.startY, opacity: 0 }}
            animate={{ x: [p.startX, 0], y: [p.startY, 0], opacity: [0, 0.8, 0], scale: [0, 1.2, 0] }}
            transition={{ duration: 1.2, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Logo */}
      <motion.div
        className="relative"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 1, delay: 0.5, type: "spring", bounce: 0.2 }}
      >
        {/* Ambient glow */}
        <motion.div
          className="absolute inset-[-40px] rounded-full pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{ background: "radial-gradient(circle, #00E5FF12 0%, #7C4DFF08 50%, transparent 75%)" }}
        />

        <motion.div
          animate={{ y: [0, -4, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        >
          <div
            className="w-24 h-24 rounded-[1.5rem] flex items-center justify-center relative overflow-hidden"
            style={{
              background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 14%))",
              border: "1px solid #00E5FF35",
              boxShadow: "0 0 50px #00E5FF10, 0 0 100px #7C4DFF06, inset 0 1px 0 #ffffff08",
            }}
          >
            <svg width="52" height="52" viewBox="0 0 48 48" fill="none" className="relative z-10">
              <defs>
                <linearGradient id="sp1Grad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00E5FF" />
                  <stop offset="60%" stopColor="#7C4DFF" />
                  <stop offset="100%" stopColor="#00E5FF" />
                </linearGradient>
                <filter id="sp1Glow">
                  <feGaussianBlur stdDeviation="1.5" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              <motion.circle cx="24" cy="24" r="22" stroke="url(#sp1Grad)" strokeWidth="1" fill="none" opacity="0.3"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.8, delay: 0.8 }}
              />
              <motion.path d="M24 8L38 38H10L24 8Z" stroke="url(#sp1Grad)" strokeWidth="2" fill="none"
                strokeLinejoin="round" filter="url(#sp1Glow)"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 1 }}
              />
              <motion.line x1="15" y1="30" x2="33" y2="30" stroke="url(#sp1Grad)" strokeWidth="1.5" opacity="0.7"
                initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.5, delay: 1.3 }}
              />
              <motion.circle cx="24" cy="8" r="2" fill="#00E5FF"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.5, type: "spring" }}
              />
              <motion.circle cx="10" cy="38" r="1.5" fill="#7C4DFF"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.6, type: "spring" }}
              />
              <motion.circle cx="38" cy="38" r="1.5" fill="#7C4DFF"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.7, type: "spring" }}
              />
              <motion.circle cx="24" cy="30" r="1.2" fill="#00FF94"
                initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.8, type: "spring" }}
              />
            </svg>

            {/* Light sweep */}
            <motion.div className="absolute inset-0 overflow-hidden rounded-[1.5rem]">
              <motion.div
                className="absolute top-0 -left-full w-1/2 h-full"
                style={{ background: "linear-gradient(90deg, transparent, #00E5FF18, #ffffff08, transparent)" }}
                animate={{ left: ["-50%", "150%"] }}
                transition={{ duration: 0.8, delay: 2, ease: "easeInOut" }}
              />
            </motion.div>
          </div>
        </motion.div>

        {/* Orbiting energy ring */}
        <motion.div
          className="absolute inset-[-5px] rounded-[1.8rem] pointer-events-none"
          style={{ border: "1px solid #00E5FF12" }}
          animate={{ rotate: 360 }}
          transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
        />

        {/* Neural lines expanding outward */}
        <svg className="absolute inset-[-40px] w-[calc(100%+80px)] h-[calc(100%+80px)] pointer-events-none">
          {neuralLines.map((l) => {
            const rad = (l.angle * Math.PI) / 180;
            const cx = 68, cy = 68;
            return (
              <motion.line
                key={l.id}
                x1={cx} y1={cy}
                x2={cx + Math.cos(rad) * l.length}
                y2={cy + Math.sin(rad) * l.length}
                stroke="#00E5FF" strokeWidth="0.4"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 0.3, 0.08] }}
                transition={{ duration: 0.6, delay: l.delay }}
              />
            );
          })}
        </svg>

        {/* Electric pulse */}
        <motion.div
          className="absolute inset-0 rounded-[1.5rem] pointer-events-none"
          animate={{
            opacity: [0, 0.7, 0],
            boxShadow: ["0 0 0px #00E5FF00", "0 0 35px #00E5FF40, 0 0 70px #7C4DFF15", "0 0 0px #00E5FF00"],
          }}
          transition={{ duration: 1.2, delay: 1.8 }}
        />
      </motion.div>

      {/* Brand name */}
      <motion.h2
        className="mt-8 text-2xl font-bold tracking-[0.12em]"
        style={{ color: "#ffffff" }}
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2, duration: 0.5 }}
      >
        ACRY
      </motion.h2>

      {/* Tagline */}
      <motion.p
        className="mt-2 text-[11px] font-medium tracking-[0.18em] uppercase"
        style={{ color: "#00E5FF90" }}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 2.2, duration: 0.5 }}
      >
        AI Second Brain
      </motion.p>

      {/* Bottom decorative line */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2 h-px rounded-full"
        style={{ background: "linear-gradient(90deg, transparent, #00E5FF30, transparent)" }}
        initial={{ width: 0, opacity: 0 }}
        animate={{ width: 120, opacity: 1 }}
        transition={{ delay: 2.4, duration: 0.6 }}
      />
    </motion.div>
  );
};

export default SplashPhase1;
