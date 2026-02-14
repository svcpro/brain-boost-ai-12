import { motion } from "framer-motion";
import { Coffee, Crosshair, AlertOctagon, Upload, FileText, Mic, Camera } from "lucide-react";

const modes = [
  {
    icon: Coffee,
    title: "Lazy Mode",
    desc: "Quick 5-min micro sessions. AI picks your weakest spots.",
    color: "text-primary",
    bg: "neural-gradient",
  },
  {
    icon: Crosshair,
    title: "Focus Mode",
    desc: "Deep study with distraction blocking. Maximum retention.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: AlertOctagon,
    title: "Emergency Recovery",
    desc: "Exam in <7 days? AI creates rapid rescue plan.",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
];

const ActionTab = () => {
  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Action Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose your study mode or upload content.</p>
      </motion.div>

      {/* Study Modes */}
      <div className="space-y-3">
        {modes.map((mode, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            className="w-full glass rounded-xl p-5 neural-border hover:glow-primary transition-all duration-300 text-left group"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${mode.bg} neural-border`}>
                <mode.icon className={`w-6 h-6 ${mode.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{mode.title}</h3>
                <p className="text-sm text-muted-foreground">{mode.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Upload Content */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
      >
        <h2 className="font-semibold text-foreground text-sm mb-3">Upload Content</h2>
        <div className="grid grid-cols-3 gap-3">
          {[
            { icon: FileText, label: "PDF" },
            { icon: Camera, label: "Scan" },
            { icon: Mic, label: "Voice" },
          ].map((item, i) => (
            <button
              key={i}
              className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2"
            >
              <item.icon className="w-5 h-5 text-primary" />
              <span className="text-xs text-muted-foreground">{item.label}</span>
            </button>
          ))}
        </div>
      </motion.div>

      {/* Quick Study Log */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <h2 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Quick Study Signal
        </h2>
        <div className="space-y-3">
          <select className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
            <option>Select Subject</option>
            <option>Physics</option>
            <option>Chemistry</option>
            <option>Mathematics</option>
            <option>Biology</option>
          </select>
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Minutes"
              className="flex-1 rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select className="flex-1 rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary">
              <option>Confidence</option>
              <option>Low</option>
              <option>Medium</option>
              <option>High</option>
            </select>
          </div>
          <button className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all">
            Update My Brain
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ActionTab;
