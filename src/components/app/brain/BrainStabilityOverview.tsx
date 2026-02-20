import { motion } from "framer-motion";
import { Brain, Shield, AlertTriangle, Target, TrendingUp, TrendingDown, Minus } from "lucide-react";

interface BrainStabilityOverviewProps {
  overallHealth: number;
  totalTopics: number;
  totalAtRisk: number;
  totalSubjects: number;
  hasData: boolean;
}

const StabilityArc = ({ value, size = 160 }: { value: number; size?: number }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const arcFraction = 0.75; // 270 degrees
  const arcLength = circ * arcFraction;
  const offset = arcLength * (1 - value / 100);

  const color = value > 70
    ? "hsl(var(--success))"
    : value > 50
    ? "hsl(var(--warning))"
    : "hsl(var(--destructive))";

  const glowColor = value > 70
    ? "hsl(142 71% 45% / 0.4)"
    : value > 50
    ? "hsl(38 92% 50% / 0.4)"
    : "hsl(0 72% 51% / 0.4)";

  const label = value > 70 ? "Strong" : value > 50 ? "Needs Care" : "Critical";

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      {/* Neural glow behind */}
      <div
        className="absolute inset-4 rounded-full blur-2xl opacity-30 pointer-events-none"
        style={{ background: glowColor }}
      />

      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" style={{ transform: "rotate(135deg)" }}>
        {/* Track */}
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke="hsl(var(--secondary))"
          strokeWidth="10"
          strokeDasharray={`${arcLength} ${circ - arcLength}`}
          strokeLinecap="round"
        />
        {/* Value arc */}
        <motion.circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circ - arcLength}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}
        />
      </svg>

      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: size * 0.08 }}>
        <motion.span
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
          className="text-4xl font-bold text-foreground tabular-nums"
        >
          {value > 0 ? `${value}%` : "—"}
        </motion.span>
        <span className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color }}>
          {value > 0 ? label : "No data"}
        </span>
      </div>
    </div>
  );
};

export default function BrainStabilityOverview({
  overallHealth, totalTopics, totalAtRisk, totalSubjects, hasData,
}: BrainStabilityOverviewProps) {
  const decayRisk = hasData ? Math.min(100, Math.round((totalAtRisk / Math.max(totalTopics, 1)) * 100)) : 0;
  const examReadiness = hasData ? Math.round(overallHealth * 0.85 + (100 - decayRisk) * 0.15) : 0;

  const metrics = [
    {
      icon: Brain,
      label: "Memory Strength",
      value: hasData ? `${overallHealth}%` : "—",
      color: overallHealth > 70 ? "text-success" : overallHealth > 50 ? "text-warning" : "text-destructive",
      bgColor: overallHealth > 70 ? "bg-success/10" : overallHealth > 50 ? "bg-warning/10" : "bg-destructive/10",
    },
    {
      icon: AlertTriangle,
      label: "Decay Risk",
      value: hasData ? `${decayRisk}%` : "—",
      color: decayRisk < 20 ? "text-success" : decayRisk < 50 ? "text-warning" : "text-destructive",
      bgColor: decayRisk < 20 ? "bg-success/10" : decayRisk < 50 ? "bg-warning/10" : "bg-destructive/10",
    },
    {
      icon: Target,
      label: "Exam Readiness",
      value: hasData ? `${examReadiness}%` : "—",
      color: examReadiness > 70 ? "text-success" : examReadiness > 50 ? "text-warning" : "text-destructive",
      bgColor: examReadiness > 70 ? "bg-success/10" : examReadiness > 50 ? "bg-warning/10" : "bg-destructive/10",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl p-6"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
        border: "1px solid hsl(var(--border))",
      }}
    >
      {/* Ambient neural glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "hsl(var(--primary))" }}
      />

      {/* Title */}
      <div className="relative z-10 flex items-center justify-center gap-2 mb-2">
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          className="w-2 h-2 rounded-full bg-primary"
        />
        <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
          Brain Stability
        </span>
      </div>

      {/* Arc */}
      <div className="relative z-10">
        <StabilityArc value={hasData ? overallHealth : 0} />
      </div>

      {/* Metric cards */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.8 }}
        className="relative z-10 grid grid-cols-3 gap-2.5 mt-2"
      >
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 + i * 0.1 }}
            className="rounded-xl bg-background/50 backdrop-blur-sm p-3 border border-border/50 text-center"
          >
            <div className={`w-7 h-7 rounded-lg ${m.bgColor} flex items-center justify-center mx-auto mb-1.5`}>
              <m.icon className={`w-3.5 h-3.5 ${m.color}`} />
            </div>
            <p className={`text-base font-bold tabular-nums ${m.color}`}>{m.value}</p>
            <p className="text-[8px] text-muted-foreground mt-0.5 leading-tight">{m.label}</p>
          </motion.div>
        ))}
      </motion.div>
    </motion.section>
  );
}
