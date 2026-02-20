import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

// "Memory Network Activation" — Neural web + brain stability ring
const SplashPhase2 = () => {
  const progress = useMotionValue(0);
  const displayValue = useTransform(progress, (v) => Math.round(v));
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const controls = animate(progress, 81, {
      duration: 2.2,
      ease: [0.25, 0.1, 0.25, 1],
      delay: 0.4,
    });
    const unsub = displayValue.on("change", (v) => setCurrentValue(v));
    return () => { controls.stop(); unsub(); };
  }, []);

  const nodes = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: 15 + Math.random() * 70,
      y: 15 + Math.random() * 70,
      size: 2 + Math.random() * 3,
      delay: 0.3 + i * 0.1,
    })), []);

  const connections = useMemo(() => {
    const conns: { from: number; to: number; delay: number }[] = [];
    nodes.forEach((n, i) => {
      const nearest = nodes
        .map((m, j) => ({ j, dist: Math.hypot(m.x - n.x, m.y - n.y) }))
        .filter((m) => m.j !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      nearest.forEach((m) => conns.push({ from: i, to: m.j, delay: 0.5 + i * 0.05 }));
    });
    return conns;
  }, [nodes]);

  const labels = [
    { text: "Stability Increasing", delay: 0.8, x: "18%", y: "22%" },
    { text: "Risk Reducing", delay: 1.4, x: "65%", y: "18%" },
    { text: "Optimization Running", delay: 2.0, x: "20%", y: "78%" },
  ];

  const ringColor = currentValue > 70 ? "#00FF94" : currentValue > 40 ? "#00E5FF" : "#7C4DFF";

  return (
    <motion.div
      className="absolute inset-0 flex items-center justify-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -30 }}
      transition={{ duration: 0.5 }}
    >
      {/* Neural network grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {connections.map((c, i) => (
          <motion.line
            key={i}
            x1={`${nodes[c.from].x}%`} y1={`${nodes[c.from].y}%`}
            x2={`${nodes[c.to].x}%`} y2={`${nodes[c.to].y}%`}
            stroke="#00E5FF"
            strokeWidth="0.5"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.2 }}
            transition={{ duration: 0.6, delay: c.delay }}
          />
        ))}
        {nodes.map((n) => (
          <motion.circle
            key={n.id}
            cx={`${n.x}%`} cy={`${n.y}%`}
            r={n.size}
            fill="#00E5FF"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: [0, 0.6, 0.3] }}
            transition={{ duration: 0.5, delay: n.delay }}
          />
        ))}
      </svg>

      {/* Center stability ring */}
      <div className="relative flex items-center justify-center">
        {/* Outer glow */}
        <motion.div
          className="absolute w-52 h-52 rounded-full"
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.5 }}
          transition={{ delay: 0.3 }}
          style={{
            background: `radial-gradient(circle, ${ringColor}10 0%, transparent 70%)`,
          }}
        />

        {/* Ring SVG */}
        <svg width="180" height="180" viewBox="0 0 180 180" className="relative z-10">
          {/* Background ring */}
          <circle cx="90" cy="90" r="75" fill="none" stroke="#ffffff08" strokeWidth="6" />
          {/* Progress ring */}
          <motion.circle
            cx="90" cy="90" r="75"
            fill="none"
            stroke={ringColor}
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={471}
            strokeDashoffset={471}
            style={{ filter: `drop-shadow(0 0 8px ${ringColor}60)` }}
            initial={{ strokeDashoffset: 471 }}
            animate={{ strokeDashoffset: 471 - (471 * 81) / 100 }}
            transition={{ duration: 2.2, delay: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
            transform="rotate(-90 90 90)"
          />
          {/* Tick marks */}
          {Array.from({ length: 36 }, (_, i) => {
            const angle = (i * 10 - 90) * (Math.PI / 180);
            const x1 = 90 + Math.cos(angle) * 68;
            const y1 = 90 + Math.sin(angle) * 68;
            const x2 = 90 + Math.cos(angle) * 72;
            const y2 = 90 + Math.sin(angle) * 72;
            return (
              <line key={i} x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="#ffffff15" strokeWidth="1" />
            );
          })}
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <motion.span
            className="text-4xl font-bold tabular-nums"
            style={{ color: ringColor }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {currentValue}%
          </motion.span>
          <motion.span
            className="text-[10px] uppercase tracking-[0.15em] mt-1"
            style={{ color: "#ffffff50" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
          >
            Brain Stability
          </motion.span>
        </div>
      </div>

      {/* Floating micro labels */}
      {labels.map((l, i) => (
        <motion.div
          key={i}
          className="absolute px-3 py-1.5 rounded-full text-[9px] font-medium tracking-wider uppercase"
          style={{
            left: l.x,
            top: l.y,
            background: "#00E5FF08",
            border: "1px solid #00E5FF20",
            color: "#00E5FF90",
            backdropFilter: "blur(8px)",
          }}
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: l.delay, duration: 0.4 }}
        >
          {l.text}
        </motion.div>
      ))}
    </motion.div>
  );
};

export default SplashPhase2;
