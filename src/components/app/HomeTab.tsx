import { motion } from "framer-motion";
import { Brain, AlertTriangle, Target, Calendar, CheckCircle, Wrench } from "lucide-react";

const HomeTab = () => {
  const missions = [
    { subject: "Physics – Electrostatics", type: "Review", urgency: "high" },
    { subject: "Chemistry – Organic Reactions", type: "Fix", urgency: "critical" },
    { subject: "Math – Integration", type: "Practice", urgency: "medium" },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Greeting */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Brain Command Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Your AI brain is active and monitoring.</p>
      </motion.div>

      {/* Stats row */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Target className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Predicted Rank</span>
          </div>
          <p className="text-2xl font-bold gradient-text">#12,450</p>
        </div>
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-warning" />
            <span className="text-xs text-muted-foreground">Exam Countdown</span>
          </div>
          <p className="text-2xl font-bold text-foreground">87 <span className="text-sm text-muted-foreground">days</span></p>
        </div>
      </motion.div>

      {/* Forget Risk Radar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="font-semibold text-foreground text-sm">Forget Risk Radar</h2>
          <span className="ml-auto px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-medium">3 at risk</span>
        </div>
        <div className="space-y-3">
          {["Thermodynamics", "Organic Chemistry", "Trigonometry"].map((topic, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="flex-1">
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-foreground">{topic}</span>
                  <span className="text-[10px] text-destructive">{[82, 65, 45][i]}% risk</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-warning to-destructive transition-all"
                    style={{ width: `${[82, 65, 45][i]}%` }}
                  />
                </div>
              </div>
              <button className="px-3 py-1 rounded-lg neural-gradient neural-border text-[10px] text-primary font-medium hover:glow-primary transition-all">
                Fix
              </button>
            </div>
          ))}
        </div>
      </motion.div>

      {/* Auto Brain Mission */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <Brain className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Today's Brain Mission</h2>
        </div>
        <div className="space-y-3">
          {missions.map((m, i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
              <div className={`w-2 h-2 rounded-full ${
                m.urgency === "critical" ? "bg-destructive animate-pulse" :
                m.urgency === "high" ? "bg-warning" : "bg-primary"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{m.subject}</p>
                <p className="text-[10px] text-muted-foreground">{m.type}</p>
              </div>
              <CheckCircle className="w-4 h-4 text-muted-foreground" />
            </div>
          ))}
        </div>
      </motion.div>

      {/* Quick Actions */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
      >
        <button className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2">
          <CheckCircle className="w-6 h-6 text-success" />
          <span className="text-xs font-medium text-foreground">I Studied Today</span>
        </button>
        <button className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2">
          <Wrench className="w-6 h-6 text-warning" />
          <span className="text-xs font-medium text-foreground">Fix Now</span>
        </button>
      </motion.div>
    </div>
  );
};

export default HomeTab;
