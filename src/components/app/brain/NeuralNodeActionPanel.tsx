import { motion } from "framer-motion";
import { Zap, Play, Shield, TrendingDown, Activity, Brain, X } from "lucide-react";
import { isPast, isToday, formatDistanceToNow } from "date-fns";

interface TopicInfo {
  id: string;
  name: string;
  memory_strength: number;
  next_predicted_drop_date: string | null;
  last_revision_date: string | null;
}

interface NeuralNodeActionPanelProps {
  topic: TopicInfo;
  subjectName: string;
  hue: number;
  onReview: (subject: string, topic: string) => void;
  onClose: () => void;
}

const strengthColor = (s: number) =>
  s > 70 ? "hsl(var(--success))" : s > 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

export default function NeuralNodeActionPanel({
  topic, subjectName, hue, onReview, onClose,
}: NeuralNodeActionPanelProps) {
  const s = topic.memory_strength;
  const dropDate = topic.next_predicted_drop_date ? new Date(topic.next_predicted_drop_date) : null;
  const isOverdue = dropDate ? isPast(dropDate) : false;
  const isDue = dropDate ? isToday(dropDate) : false;
  const mastery = Math.min(100, Math.round(s * 1.1));
  const decayRisk = isOverdue ? 90 : isDue ? 65 : dropDate ? 30 : 10;

  const metrics = [
    { icon: Brain, label: "Stability", value: `${s}%`, color: strengthColor(s) },
    { icon: Activity, label: "Mastery", value: `${mastery}%`, color: strengthColor(mastery) },
    { icon: TrendingDown, label: "Decay Risk", value: `${decayRisk}%`, color: strengthColor(100 - decayRisk) },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: 10 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="absolute inset-x-3 bottom-3 z-30 rounded-2xl overflow-hidden backdrop-blur-xl"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card) / 0.95), hsl(var(--secondary) / 0.85))",
        border: `1px solid hsl(${hue} 50% 50% / 0.3)`,
        boxShadow: `0 8px 32px hsl(${hue} 50% 20% / 0.3), 0 0 60px hsl(${hue} 50% 50% / 0.08)`,
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: strengthColor(s), boxShadow: `0 0 8px ${strengthColor(s)}` }}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{topic.name}</p>
              <p className="text-[9px] text-muted-foreground">{subjectName}</p>
            </div>
          </div>
          <motion.button
            whileTap={{ scale: 0.85 }}
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.button>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {metrics.map((m) => (
            <div key={m.label} className="rounded-lg p-2 text-center border border-border/30"
              style={{ background: "hsl(var(--background) / 0.4)" }}
            >
              <m.icon className="w-3 h-3 mx-auto mb-1" style={{ color: m.color }} />
              <p className="text-xs font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[8px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        {/* Decay status */}
        {dropDate && (
          <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 mb-3 text-[10px] border ${
            isOverdue
              ? "text-destructive border-destructive/20 bg-destructive/5"
              : isDue
              ? "text-warning border-warning/20 bg-warning/5"
              : "text-muted-foreground border-border/30 bg-secondary/20"
          }`}>
            <TrendingDown className="w-3 h-3 shrink-0" />
            {isOverdue
              ? `Overdue · decayed ${formatDistanceToNow(dropDate)} ago`
              : isDue
              ? "Decay predicted today"
              : `Next decay in ${formatDistanceToNow(dropDate)}`}
          </div>
        )}

        {/* Action buttons */}
        <div className="grid grid-cols-2 gap-2">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onReview(subjectName, topic.name)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold"
            style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)" }}
          >
            <Zap className="w-3.5 h-3.5" />
            Stabilize Now
          </motion.button>
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => onReview(subjectName, topic.name)}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold border border-border/50 text-foreground"
            style={{ background: "hsl(var(--secondary) / 0.4)" }}
          >
            <Play className="w-3.5 h-3.5" />
            Deep Focus
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
}
