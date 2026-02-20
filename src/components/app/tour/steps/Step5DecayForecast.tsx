import { motion } from "framer-motion";
import { Shield } from "lucide-react";

const Step5DecayForecast = () => {
  // Simulated decay curve points
  const points = [40, 38, 35, 30, 25, 28, 45, 60, 70, 75, 78, 80];
  const dangerIndex = 5; // The spike/dip
  const maxY = 100;
  const width = 280;
  const height = 100;

  const getPath = () => {
    return points
      .map((p, i) => {
        const x = (i / (points.length - 1)) * width;
        const y = height - (p / maxY) * height;
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  return (
    <motion.div
      className="flex flex-col items-center justify-center h-full gap-6 px-6"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Chart */}
      <motion.div
        className="relative"
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring" }}
      >
        <svg width={width} height={height + 10} viewBox={`0 0 ${width} ${height + 10}`}>
          <defs>
            <linearGradient id="decayLine" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%" stopColor="hsl(0 72% 51%)" />
              <stop offset="40%" stopColor="hsl(0 72% 51%)" />
              <stop offset="50%" stopColor="hsl(40 100% 50%)" />
              <stop offset="70%" stopColor="hsl(155 100% 50%)" />
              <stop offset="100%" stopColor="hsl(187 100% 50%)" />
            </linearGradient>
          </defs>
          <motion.path
            d={getPath()}
            fill="none"
            stroke="url(#decayLine)"
            strokeWidth="2.5"
            strokeLinecap="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 2, ease: "easeInOut" }}
          />
          {/* Danger point */}
          <motion.circle
            cx={(dangerIndex / (points.length - 1)) * width}
            cy={height - (points[dangerIndex] / maxY) * height}
            r="5"
            fill="hsl(0 72% 51%)"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 1 }}
          />
          {/* Recovery point */}
          <motion.circle
            cx={((points.length - 1) / (points.length - 1)) * width}
            cy={height - (points[points.length - 1] / maxY) * height}
            r="5"
            fill="hsl(187 100% 50%)"
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 2 }}
          />
        </svg>

        {/* AI Shield badge */}
        <motion.div
          className="absolute -top-3 right-0 flex items-center gap-1 px-2 py-1 rounded-full glass text-xs text-primary font-semibold"
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.5 }}
        >
          <Shield className="w-3 h-3" /> AI Stabilized
        </motion.div>
      </motion.div>

      <motion.div
        className="text-center"
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.8 }}
      >
        <p className="text-lg font-display font-bold text-foreground">
          We prevent forgetting
        </p>
        <p className="text-lg font-display font-bold gradient-text">
          before it happens.
        </p>
      </motion.div>
    </motion.div>
  );
};

export default Step5DecayForecast;
