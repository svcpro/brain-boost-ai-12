import { motion } from "framer-motion";
import { Brain } from "lucide-react";
import { useState, useEffect } from "react";

const Step3BrainActivation = () => {
  const [stability, setStability] = useState(72);

  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setStability((s) => {
          if (s >= 78) { clearInterval(interval); return 78; }
          return s + 1;
        });
      }, 150);
      return () => clearInterval(interval);
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9 }}
    >
      {/* Brain map with nodes */}
      <div className="relative w-48 h-48">
        {/* Central brain */}
        <motion.div
          className="absolute inset-0 flex items-center justify-center"
          animate={{ rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <Brain className="w-16 h-16 text-primary" />
        </motion.div>

        {/* Orbiting nodes */}
        {[0, 60, 120, 180, 240, 300].map((angle, i) => (
          <motion.div
            key={i}
            className="absolute w-3 h-3 rounded-full"
            style={{
              background: `hsl(${187 + i * 12} 100% 50%)`,
              boxShadow: `0 0 12px hsl(${187 + i * 12} 100% 50% / 0.6)`,
              top: "50%",
              left: "50%",
            }}
            initial={{ opacity: 0 }}
            animate={{
              opacity: 1,
              x: Math.cos((angle * Math.PI) / 180) * 70 - 6,
              y: Math.sin((angle * Math.PI) / 180) * 70 - 6,
            }}
            transition={{ delay: 0.3 + i * 0.15, type: "spring" }}
          />
        ))}

        {/* Stability ring */}
        <svg className="absolute inset-0 w-full h-full" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="45" fill="none" stroke="hsl(228 30% 16%)" strokeWidth="3" />
          <motion.circle
            cx="50" cy="50" r="45"
            fill="none"
            stroke="url(#stabilityGrad)"
            strokeWidth="3"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            initial={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - 0.72) }}
            animate={{ strokeDashoffset: 2 * Math.PI * 45 * (1 - stability / 100) }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            transform="rotate(-90 50 50)"
          />
          <defs>
            <linearGradient id="stabilityGrad" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="hsl(187 100% 50%)" />
              <stop offset="100%" stopColor="hsl(155 100% 50%)" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      <motion.p
        className="text-xl font-display font-bold text-foreground text-center"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        Your Brain Is Now Activated.
      </motion.p>

      <motion.div
        className="flex items-center gap-2 px-4 py-2 rounded-full glass"
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ delay: 0.8, type: "spring" }}
      >
        <span className="text-sm text-muted-foreground">Stability</span>
        <span className="text-lg font-bold text-primary font-display">{stability}%</span>
        <motion.span
          className="text-xs text-success font-semibold"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 2 }}
        >
          +6%
        </motion.span>
      </motion.div>
    </motion.div>
  );
};

export default Step3BrainActivation;
