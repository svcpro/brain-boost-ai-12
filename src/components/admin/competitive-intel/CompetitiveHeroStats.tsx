import { motion } from "framer-motion";
import { Swords, TrendingUp, Users, Target, Zap, Shield } from "lucide-react";

interface Props {
  trendCount: number;
  datasetCount: number;
  opponentEnabled: boolean;
  engineToggles: number;
}

const STATS = [
  { key: "trends", label: "Trend Patterns", icon: TrendingUp, gradient: "from-orange-500 to-amber-400", glow: "shadow-orange-500/30" },
  { key: "datasets", label: "Exam Datasets", icon: Target, gradient: "from-cyan-500 to-blue-400", glow: "shadow-cyan-500/30" },
  { key: "opponent", label: "Opponent Sim", icon: Swords, gradient: "from-rose-500 to-pink-400", glow: "shadow-rose-500/30" },
  { key: "engines", label: "Active Engines", icon: Zap, gradient: "from-emerald-500 to-green-400", glow: "shadow-emerald-500/30" },
];

export default function CompetitiveHeroStats({ trendCount, datasetCount, opponentEnabled, engineToggles }: Props) {
  const values = [trendCount, datasetCount, opponentEnabled ? 1 : 0, engineToggles];

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
      {STATS.map((stat, i) => (
        <motion.div
          key={stat.key}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ delay: i * 0.08, type: "spring", stiffness: 200 }}
          whileHover={{ scale: 1.04, y: -2 }}
          className={`relative overflow-hidden rounded-2xl p-4 cursor-default group`}
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        >
          {/* Animated gradient orb */}
          <motion.div
            className={`absolute -top-6 -right-6 w-20 h-20 rounded-full bg-gradient-to-br ${stat.gradient} opacity-20 blur-xl`}
            animate={{ scale: [1, 1.3, 1], opacity: [0.15, 0.3, 0.15] }}
            transition={{ duration: 3, repeat: Infinity, delay: i * 0.5 }}
          />

          {/* Shimmer sweep */}
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent -skew-x-12"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 4, repeat: Infinity, delay: i * 0.8, ease: "easeInOut" }}
          />

          <div className="relative z-10">
            <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${stat.gradient} flex items-center justify-center mb-3 shadow-lg ${stat.glow}`}>
              <stat.icon className="w-4.5 h-4.5 text-white" />
            </div>
            <motion.p
              className="text-2xl font-black text-foreground"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.1 + 0.3 }}
            >
              {stat.key === "opponent" ? (opponentEnabled ? "ON" : "OFF") : values[i]}
            </motion.p>
            <p className="text-[10px] font-medium text-muted-foreground mt-0.5 uppercase tracking-wider">{stat.label}</p>
          </div>
        </motion.div>
      ))}
    </div>
  );
}
