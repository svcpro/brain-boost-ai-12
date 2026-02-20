import { motion } from "framer-motion";
import { Target, RefreshCw, Zap, AlertOctagon } from "lucide-react";

const actions = [
  { icon: Target, label: "Focus Mode", status: "Auto-prepared", color: "text-primary" },
  { icon: RefreshCw, label: "AI Revision", status: "Auto-scheduled", color: "text-accent" },
  { icon: Zap, label: "Mock Test", status: "Auto-optimized", color: "text-warning" },
  { icon: AlertOctagon, label: "Emergency Rescue", status: "Standby", color: "text-destructive" },
];

const Step4ActionPreview = () => (
  <motion.div
    className="flex flex-col items-center justify-center h-full gap-8 px-6"
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
  >
    <div className="w-full max-w-xs flex flex-col gap-3">
      {actions.map((action, i) => (
        <motion.div
          key={action.label}
          className="flex items-center gap-3 px-4 py-3 rounded-2xl glass"
          initial={{ x: 60, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: i * 0.25, type: "spring", stiffness: 200 }}
        >
          <div className={`p-2 rounded-xl neural-gradient neural-border ${action.color}`}>
            <action.icon className="w-4 h-4" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-medium text-foreground">{action.label}</p>
            <p className="text-xs text-muted-foreground">{action.status}</p>
          </div>
          <motion.div
            className="w-2 h-2 rounded-full bg-success"
            animate={{ scale: [1, 1.4, 1], opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.2 }}
          />
        </motion.div>
      ))}
    </div>

    <motion.div
      className="text-center"
      initial={{ y: 20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ delay: 1.2 }}
    >
      <p className="text-lg font-display font-bold text-foreground">
        You don't plan.
      </p>
      <p className="text-lg font-display font-bold gradient-text">
        AI plans for you.
      </p>
    </motion.div>
  </motion.div>
);

export default Step4ActionPreview;
