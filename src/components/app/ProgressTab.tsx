import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Clock, Users, SlidersHorizontal } from "lucide-react";

const ProgressTab = () => {
  const weeklyData = [
    { day: "Mon", hours: 3.5, score: 72 },
    { day: "Tue", hours: 2, score: 68 },
    { day: "Wed", hours: 4, score: 75 },
    { day: "Thu", hours: 1, score: 65 },
    { day: "Fri", hours: 5, score: 80 },
    { day: "Sat", hours: 4.5, score: 82 },
    { day: "Sun", hours: 3, score: 78 },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Progress Intelligence</h1>
        <p className="text-muted-foreground text-sm mt-1">Track your brain evolution.</p>
      </motion.div>

      {/* Rank Prediction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Rank Prediction</h2>
        </div>
        <div className="flex items-end gap-2">
          <span className="text-4xl font-bold gradient-text">#12,450</span>
          <span className="text-sm text-success mb-1 flex items-center gap-1">
            <TrendingUp className="w-3 h-3" /> +2,300
          </span>
        </div>
        <p className="text-xs text-muted-foreground mt-2">Based on current pace, you'll be in the top 8% by exam day.</p>

        {/* Mini rank graph */}
        <div className="mt-4 flex items-end gap-1 h-16">
          {[45, 42, 38, 35, 30, 25, 20, 18, 15, 12].map((v, i) => (
            <motion.div
              key={i}
              className="flex-1 bg-primary/30 rounded-t"
              initial={{ height: 0 }}
              animate={{ height: `${(1 - v / 50) * 100}%` }}
              transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
            />
          ))}
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[9px] text-muted-foreground">10 weeks ago</span>
          <span className="text-[9px] text-muted-foreground">Now</span>
        </div>
      </motion.div>

      {/* Weekly Study */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">This Week</h2>
          <span className="ml-auto text-xs text-muted-foreground">23h total</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {weeklyData.map((d, i) => (
            <div key={i} className="flex-1 flex flex-col items-center gap-1">
              <motion.div
                className="w-full rounded-t bg-primary/40"
                initial={{ height: 0 }}
                animate={{ height: `${(d.hours / 5) * 100}%` }}
                transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
              />
              <span className="text-[9px] text-muted-foreground">{d.day}</span>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="grid grid-cols-2 gap-3"
      >
        {[
          { icon: Clock, label: "Brain Evolution", desc: "Timeline view" },
          { icon: Users, label: "Competition Intel", desc: "Peer comparison" },
          { icon: SlidersHorizontal, label: "Exam Simulator", desc: "Strategy testing" },
          { icon: BarChart3, label: "Weekly Report", desc: "AI analysis" },
        ].map((item, i) => (
          <button
            key={i}
            className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left"
          >
            <item.icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default ProgressTab;
