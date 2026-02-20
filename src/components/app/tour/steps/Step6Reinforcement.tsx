import { motion } from "framer-motion";
import { TrendingUp, Shield, Trophy } from "lucide-react";

const stats = [
  { icon: TrendingUp, label: "+8% Stability", color: "text-success" },
  { icon: Shield, label: "Risk Reduced", color: "text-primary" },
  { icon: Trophy, label: "Rank Boosted", color: "text-warning" },
];

const Step6Reinforcement = () => (
  <motion.div
    className="flex flex-col items-center justify-center h-full gap-8 px-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    {/* Stats */}
    <div className="flex gap-4">
      {stats.map((stat, i) => (
        <motion.div
          key={stat.label}
          className="flex flex-col items-center gap-2 px-4 py-4 rounded-2xl glass"
          initial={{ y: 30, opacity: 0, scale: 0.8 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.3, type: "spring", stiffness: 200 }}
        >
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
          >
            <stat.icon className={`w-6 h-6 ${stat.color}`} />
          </motion.div>
          <span className="text-xs font-semibold text-foreground whitespace-nowrap">
            {stat.label}
          </span>
        </motion.div>
      ))}
    </div>

    {/* Text */}
    <motion.div
      className="text-center"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 1.2 }}
    >
      <p className="text-lg font-display text-muted-foreground">This is not studying.</p>
      <motion.p
        className="text-xl font-display font-bold gradient-text mt-1"
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1.6, type: "spring" }}
      >
        This is training your brain.
      </motion.p>
    </motion.div>
  </motion.div>
);

export default Step6Reinforcement;
