import { motion } from "framer-motion";
import { useMemo } from "react";

// "The Brain Awakens" — Logo forms from particles with neural energy pulse
const SplashPhase1 = () => {
  const neuralLines = useMemo(() =>
    Array.from({ length: 12 }, (_, i) => ({
      id: i,
      angle: (i / 12) * 360,
      length: 60 + Math.random() * 80,
      delay: 1.2 + i * 0.08,
    })), []);

  const assemblyParticles = useMemo(() =>
    Array.from({ length: 30 }, (_, i) => ({
      id: i,
      startX: (Math.random() - 0.5) * 400,
      startY: (Math.random() - 0.5) * 400,
      size: Math.random() * 3 + 1,
      delay: Math.random() * 0.6,
      color: i % 3 === 0 ? "#00E5FF" : i % 3 === 1 ? "#7C4DFF" : "#00FF94",
    })), []);

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, scale: 1.1 }}
      transition={{ duration: 0.5 }}
    >
      {/* Energy pulse from bottom */}
      <motion.div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1 rounded-full"
        style={{ background: "linear-gradient(to top, #00E5FF, transparent)" }}
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "50vh", opacity: [0, 0.8, 0] }}
        transition={{ duration: 1.2, ease: "easeOut" }}
      />

      {/* Assembly particles converging to center */}
      <div className="absolute inset-0 pointer-events-none">
        {assemblyParticles.map((p) => (
          <motion.div
            key={p.id}
            className="absolute rounded-full"
            style={{
              width: p.size,
              height: p.size,
              left: "50%",
              top: "50%",
              background: p.color,
              boxShadow: `0 0 ${p.size * 4}px ${p.color}`,
            }}
            initial={{ x: p.startX, y: p.startY, opacity: 0 }}
            animate={{
              x: [p.startX, 0],
              y: [p.startY, 0],
              opacity: [0, 1, 0.3],
              scale: [0, 1.5, 0],
            }}
            transition={{ duration: 1.4, delay: p.delay, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* Main logo container */}
      <motion.div
        className="relative"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ duration: 1.2, delay: 0.6, type: "spring", bounce: 0.2 }}
      >
        {/* Glow backdrop */}
        <motion.div
          className="absolute inset-[-30px] rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          style={{
            background: "radial-gradient(circle, #00E5FF10 0%, #7C4DFF08 40%, transparent 70%)",
          }}
        />

        {/* Logo icon */}
        <div
          className="w-28 h-28 rounded-3xl flex items-center justify-center relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(228 50% 8%), hsl(228 40% 12%))",
            border: "1px solid #00E5FF40",
            boxShadow: "0 0 60px #00E5FF15, 0 0 120px #7C4DFF08",
          }}
        >
          {/* Neural triangle A */}
          <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
            <defs>
              <linearGradient id="splashGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#00E5FF" />
                <stop offset="60%" stopColor="#7C4DFF" />
                <stop offset="100%" stopColor="#00E5FF" />
              </linearGradient>
              <filter id="splashGlow">
                <feGaussianBlur stdDeviation="2" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <motion.circle cx="24" cy="24" r="22" stroke="url(#splashGrad)" strokeWidth="1.2" fill="none" opacity="0.4"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1, delay: 0.8 }}
            />
            <motion.path d="M24 8L38 38H10L24 8Z" stroke="url(#splashGrad)" strokeWidth="2" fill="none"
              strokeLinejoin="round" filter="url(#splashGlow)"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, delay: 1 }}
            />
            <motion.line x1="15" y1="30" x2="33" y2="30" stroke="url(#splashGrad)" strokeWidth="1.5" opacity="0.8"
              initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.6, delay: 1.4 }}
            />
            <motion.circle cx="24" cy="8" r="2.5" fill="#00E5FF"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.6, type: "spring" }}
            />
            <motion.circle cx="10" cy="38" r="2" fill="#7C4DFF"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.7, type: "spring" }}
            />
            <motion.circle cx="38" cy="38" r="2" fill="#7C4DFF"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.8, type: "spring" }}
            />
            <motion.circle cx="24" cy="30" r="1.5" fill="#00FF94"
              initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 1.9, type: "spring" }}
            />
          </svg>

          {/* Light sweep */}
          <motion.div
            className="absolute inset-0 overflow-hidden rounded-3xl"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 2 }}
          >
            <motion.div
              className="absolute top-0 -left-full w-1/2 h-full"
              style={{ background: "linear-gradient(90deg, transparent, #00E5FF20, #ffffff10, transparent)" }}
              animate={{ left: ["-50%", "150%"] }}
              transition={{ duration: 1, delay: 2, ease: "easeInOut" }}
            />
          </motion.div>
        </div>

        {/* Electric edge glow */}
        <motion.div
          className="absolute inset-0 rounded-3xl pointer-events-none"
          initial={{ opacity: 0 }}
          animate={{
            opacity: [0, 0.8, 0],
            boxShadow: [
              "0 0 0px #00E5FF00",
              "0 0 40px #00E5FF50, 0 0 80px #7C4DFF20",
              "0 0 0px #00E5FF00",
            ],
          }}
          transition={{ duration: 1.5, delay: 1.8 }}
        />

        {/* Expanding neural lines */}
        <svg className="absolute inset-[-60px] w-[calc(100%+120px)] h-[calc(100%+120px)] pointer-events-none">
          {neuralLines.map((l) => {
            const rad = (l.angle * Math.PI) / 180;
            const cx = 80, cy = 80;
            const endX = cx + Math.cos(rad) * l.length;
            const endY = cy + Math.sin(rad) * l.length;
            return (
              <motion.line
                key={l.id}
                x1={cx} y1={cy} x2={endX} y2={endY}
                stroke="#00E5FF"
                strokeWidth="0.5"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: [0, 0.4, 0.1] }}
                transition={{ duration: 0.8, delay: l.delay }}
              />
            );
          })}
        </svg>
      </motion.div>

      {/* Tagline */}
      <motion.p
        className="mt-10 text-sm font-medium tracking-[0.2em] uppercase"
        style={{ color: "#00E5FF" }}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 0.8, y: 0 }}
        transition={{ delay: 2.2, duration: 0.6 }}
      >
        AI Second Brain
      </motion.p>
    </motion.div>
  );
};

export default SplashPhase1;
