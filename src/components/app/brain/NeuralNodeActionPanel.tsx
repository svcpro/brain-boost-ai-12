import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Zap, Play, Shield, TrendingDown, TrendingUp, Activity, Brain, X, Loader2, Clock, Target, BarChart3, Minus } from "lucide-react";
import { isPast, isToday, formatDistanceToNow } from "date-fns";
import { supabase } from "@/integrations/supabase/client";

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

const statusColor = (status: string) =>
  status === "success" ? "hsl(var(--success, 142 71% 45%))" : status === "warning" ? "hsl(var(--warning, 38 92% 50%))" : "hsl(var(--destructive))";

const trendIcon = (trend: string) =>
  trend === "improving" ? TrendingUp : trend === "declining" ? TrendingDown : Minus;

export default function NeuralNodeActionPanel({
  topic, subjectName, hue, onReview, onClose,
}: NeuralNodeActionPanelProps) {
  const [detail, setDetail] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("brain-intelligence", {
          body: { action: "node-detail", topic_id: topic.id },
        });
        if (!cancelled && !error && data) setDetail(data);
      } catch (e) {
        console.error("Node detail error:", e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [topic.id]);

  const s = detail?.memory_strength ?? topic.memory_strength;
  const dropDate = topic.next_predicted_drop_date ? new Date(topic.next_predicted_drop_date) : null;
  const isOverdue = detail?.is_overdue ?? (dropDate ? isPast(dropDate) : false);
  const isDue = dropDate ? isToday(dropDate) : false;

  const metrics = detail?.metrics || [
    { key: "stability", label: "Stability", value: `${s}%`, color: s > 70 ? "success" : s > 50 ? "warning" : "destructive" },
    { key: "mastery", label: "Mastery", value: `${Math.min(100, Math.round(s * 1.1))}%`, color: s > 70 ? "success" : s > 50 ? "warning" : "destructive" },
    { key: "decay_risk", label: "Decay Risk", value: isOverdue ? "High" : "Low", color: isOverdue ? "destructive" : "success" },
  ];

  const TrendIcon = detail?.performance_trend ? trendIcon(detail.performance_trend) : Minus;

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
        maxHeight: "70%",
        overflowY: "auto",
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2 min-w-0">
            <div
              className="w-3 h-3 rounded-full shrink-0"
              style={{ background: statusColor(metrics[0]?.color || "destructive"), boxShadow: `0 0 8px ${statusColor(metrics[0]?.color || "destructive")}` }}
            />
            <div className="min-w-0">
              <p className="text-xs font-bold text-foreground truncate">{detail?.topic_name || topic.name}</p>
              <p className="text-[9px] text-muted-foreground">{detail?.subject_name || subjectName}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {detail?.performance_trend && (
              <div className={`flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
                detail.performance_trend === "improving" ? "text-success bg-success/10" :
                detail.performance_trend === "declining" ? "text-destructive bg-destructive/10" :
                "text-muted-foreground bg-secondary/40"
              }`}>
                <TrendIcon className="w-2.5 h-2.5" />
                {detail.performance_trend}
              </div>
            )}
            <motion.button
              whileTap={{ scale: 0.85 }}
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors"
            >
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
          </div>
        ) : (
          <>
            {/* Metrics row */}
            <div className={`grid grid-cols-${Math.min(metrics.length, 4)} gap-2 mb-3`}>
              {metrics.slice(0, 4).map((m: any) => (
                <div key={m.key} className="rounded-lg p-2 text-center border border-border/30"
                  style={{ background: "hsl(var(--background) / 0.4)" }}
                >
                  <p className="text-xs font-bold tabular-nums" style={{ color: statusColor(m.color) }}>{m.value}</p>
                  <p className="text-[8px] text-muted-foreground">{m.label}</p>
                </div>
              ))}
            </div>

            {/* Session stats */}
            {detail?.session_stats && (
              <div className="flex items-center gap-3 mb-3 text-[9px] text-muted-foreground px-1">
                <span className="flex items-center gap-1"><BarChart3 className="w-2.5 h-2.5" /> {detail.session_stats.total} sessions</span>
                <span className="flex items-center gap-1"><Clock className="w-2.5 h-2.5" /> {detail.session_stats.total_minutes}min studied</span>
                {detail.hours_since_review >= 0 && (
                  <span className="flex items-center gap-1"><Activity className="w-2.5 h-2.5" /> {detail.hours_since_review}h ago</span>
                )}
              </div>
            )}

            {/* Decay status */}
            {(isOverdue || isDue || dropDate) && (
              <div className={`flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 mb-3 text-[10px] border ${
                isOverdue
                  ? "text-destructive border-destructive/20 bg-destructive/5"
                  : isDue
                  ? "text-warning border-warning/20 bg-warning/5"
                  : "text-muted-foreground border-border/30 bg-secondary/20"
              }`}>
                <TrendingDown className="w-3 h-3 shrink-0" />
                {isOverdue
                  ? `Overdue · decayed ${dropDate ? formatDistanceToNow(dropDate) : ""} ago`
                  : isDue
                  ? "Decay predicted today"
                  : `Next decay in ${dropDate ? formatDistanceToNow(dropDate) : ""}`}
              </div>
            )}

            {/* Recent history */}
            {detail?.recent_history && detail.recent_history.length > 0 && (
              <div className="mb-3">
                <p className="text-[9px] text-muted-foreground font-medium mb-1.5 px-1">Recent Sessions</p>
                <div className="space-y-1">
                  {detail.recent_history.slice(0, 3).map((h: any, i: number) => (
                    <div key={i} className="flex items-center justify-between px-2 py-1 rounded-lg bg-secondary/20 text-[9px]">
                      <span className="text-muted-foreground">{new Date(h.date).toLocaleDateString()}</span>
                      <div className="flex items-center gap-2">
                        <span className={`font-medium ${h.score > 70 ? "text-success" : h.score > 40 ? "text-warning" : "text-destructive"}`}>{h.score}%</span>
                        <span className="text-muted-foreground/60">{h.duration_minutes}min</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Action buttons */}
            <div className="grid grid-cols-2 gap-2">
              {(detail?.recommended_actions || []).slice(0, 2).map((action: any) => (
                <motion.button
                  key={action.type}
                  whileTap={{ scale: 0.95 }}
                  onClick={() => onReview(subjectName, topic.name)}
                  className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold ${
                    action.priority === "high"
                      ? "bg-primary text-primary-foreground"
                      : "border border-border/50 text-foreground"
                  }`}
                  style={action.priority === "high" ? { boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)" } : { background: "hsl(var(--secondary) / 0.4)" }}
                >
                  {action.type === "stabilize" ? <Zap className="w-3.5 h-3.5" /> :
                   action.type === "deep_focus" ? <Brain className="w-3.5 h-3.5" /> :
                   <Play className="w-3.5 h-3.5" />}
                  {action.label}
                  {action.estimated_boost > 0 && (
                    <span className="text-[8px] opacity-70">+{action.estimated_boost}%</span>
                  )}
                </motion.button>
              ))}
              {(!detail?.recommended_actions || detail.recommended_actions.length === 0) && (
                <>
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
                </>
              )}
            </div>
          </>
        )}
      </div>
    </motion.div>
  );
}
