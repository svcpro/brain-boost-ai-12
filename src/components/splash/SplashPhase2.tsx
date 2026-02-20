import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { useEffect, useMemo, useState } from "react";

const SplashPhase2 = () => {
  const progress = useMotionValue(0);
  const displayValue = useTransform(progress, (v) => Math.round(v));
  const [currentValue, setCurrentValue] = useState(0);

  useEffect(() => {
    const controls = animate(progress, 81, {
      duration: 2,
      ease: [0.25, 0.1, 0.25, 1],
      delay: 0.3,
    });
    const unsub = displayValue.on("change", (v) => setCurrentValue(v));
    return () => { controls.stop(); unsub(); };
  }, []);

  const nodes = useMemo(() =>
    Array.from({ length: 14 }, (_, i) => ({
      id: i,
      x: 10 + Math.random() * 80,
      y: 20 + Math.random() * 60,
      size: 1.5 + Math.random() * 2,
      delay: 0.2 + i * 0.08,
    })), []);

  const connections = useMemo(() => {
    const conns: { from: number; to: number; delay: number }[] = [];
    nodes.forEach((n, i) => {
      const nearest = nodes
        .map((m, j) => ({ j, dist: Math.hypot(m.x - n.x, m.y - n.y) }))
        .filter((m) => m.j !== i)
        .sort((a, b) => a.dist - b.dist)
        .slice(0, 2);
      nearest.forEach((m) => conns.push({ from: i, to: m.j, delay: 0.3 + i * 0.04 }));
    });
    return conns;
  }, [nodes]);

  const ringColor = currentValue > 70 ? "#00FF94" : currentValue > 40 ? "#00E5FF" : "#7C4DFF";

  const labels = [
    { text: "Stability ↑", delay: 0.8, top: "28%", left: "8%" },
    { text: "Risk ↓", delay: 1.3, top: "25%", right: "8%" },
    { text: "Optimizing", delay: 1.8, bottom: "28%", left: "12%" },
  ];

  return (
    <motion.div
      className="absolute inset-0 flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{ duration: 0.4 }}
    >
      {/* Neural web background */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none">
        {connections.map((c, i) => (
          <motion.line
            key={i}
            x1={`${nodes[c.from].x}%`} y1={`${nodes[c.from].y}%`}
            x2={`${nodes[c.to].x}%`} y2={`${nodes[c.to].y}%`}
            stroke="#00E5FF" strokeWidth="0.4"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 0.15 }}
            transition={{ duration: 0.5, delay: c.delay }}
          />
        ))}
        {nodes.map((n) => (
          <motion.circle
            key={n.id}
            cx={`${n.x}%`} cy={`${n.y}%`}
            r={n.size}
            fill="#00E5FF"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: [0, 0.5, 0.2] }}
            transition={{ duration: 0.4, delay: n.delay }}
          />
        ))}
      </svg>

      {/* Center ring */}
      <div className="relative flex items-center justify-center">
        <motion.div
          className="absolute w-44 h-44 rounded-full pointer-events-none"
          initial={{ opacity: 0 }} animate={{ opacity: 0.4 }} transition={{ delay: 0.2 }}
          style={{ background: `radial-gradient(circle, ${ringColor}10 0%, transparent 70%)` }}
        />

        <svg width="150" height="150" viewBox="0 0 150 150" className="relative z-10">
          <circle cx="75" cy="75" r="62" fill="none" stroke="#ffffff06" strokeWidth="5" />
          <motion.circle
            cx="75" cy="75" r="62" fill="none"
            stroke={ringColor} strokeWidth="5" strokeLinecap="round"
            strokeDasharray={390} strokeDashoffset={390}
            style={{ filter: `drop-shadow(0 0 6px ${ringColor}50)` }}
            initial={{ strokeDashoffset: 390 }}
            animate={{ strokeDashoffset: 390 - (390 * 81) / 100 }}
            transition={{ duration: 2, delay: 0.3, ease: [0.25, 0.1, 0.25, 1] }}
            transform="rotate(-90 75 75)"
          />
          {/* Subtle ticks */}
          {Array.from({ length: 24 }, (_, i) => {
            const angle = (i * 15 - 90) * (Math.PI / 180);
            const x1 = 75 + Math.cos(angle) * 55;
            const y1 = 75 + Math.sin(angle) * 55;
            const x2 = 75 + Math.cos(angle) * 58;
            const y2 = 75 + Math.sin(angle) * 58;
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#ffffff10" strokeWidth="0.8" />;
          })}
        </svg>

        <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
          <motion.span
            className="text-3xl font-bold tabular-nums"
            style={{ color: ringColor }}
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.4, type: "spring" }}
          >
            {currentValue}%
          </motion.span>
          <motion.span
            className="text-[9px] uppercase tracking-[0.15em] mt-0.5 font-medium"
            style={{ color: "#ffffff40" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.7 }}
          >
            Brain Stability
          </motion.span>
        </div>
      </div>

      {/* Floating labels */}
      {labels.map((l, i) => (
        <motion.div
          key={i}
          className="absolute px-2.5 py-1 rounded-full text-[8px] font-semibold tracking-wider uppercase"
          style={{
            top: l.top, bottom: (l as any).bottom, left: l.left, right: (l as any).right,
            background: "#00E5FF06",
            border: "1px solid #00E5FF15",
            color: "#00E5FF80",
            backdropFilter: "blur(6px)",
          }}
          initial={{ opacity: 0, scale: 0.7 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: l.delay, duration: 0.3 }}
        >
          {l.text}
        </motion.div>
      ))}

      {/* Bottom subtitle */}
      <motion.p
        className="mt-8 text-[10px] tracking-[0.15em] uppercase font-medium text-center"
        style={{ color: "#ffffff30" }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
      >
        Memory Network Activating
      </motion.p>
    </motion.div>
  );
};

export default SplashPhase2;
