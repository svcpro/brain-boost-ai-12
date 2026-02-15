import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Clock, CalendarDays, Battery, Zap, TrendingUp, ChevronDown, ChevronUp } from "lucide-react";
import { useRLAgent, RLAgentData } from "@/hooks/useRLAgent";
import { getCache, setCache } from "@/lib/offlineCache";

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const formatHour = (h: number) => {
  if (h === 0) return "12 AM";
  if (h === 12) return "12 PM";
  return h < 12 ? `${h} AM` : `${h - 12} PM`;
};

const RLPolicyCard = () => {
  const { data, loading, optimize } = useRLAgent();
  const [cached, setCached] = useState<RLAgentData | null>(() => getCache("rl-policy-data"));
  const [expanded, setExpanded] = useState(false);

  const policy = data?.policy || cached?.policy;
  const iteration = data?.iteration || cached?.iteration || 0;
  const dataPoints = data?.data_points || cached?.data_points || 0;

  useEffect(() => {
    if (data) {
      setCached(data);
      setCache("rl-policy-data", data);
    }
  }, [data]);

  // Load on mount if no cached data
  useEffect(() => {
    if (!cached && !loading) optimize();
  }, []);

  if (!policy) return null;

  const { timing, intensity, reward_signals } = policy;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(e => !e)}
        className="w-full p-4 flex items-center gap-3 text-left"
      >
        <div className="w-9 h-9 rounded-xl bg-accent/15 flex items-center justify-center shrink-0">
          <Zap className="w-5 h-5 text-accent" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">RL Study Policy</h3>
          <p className="text-[10px] text-muted-foreground">
            Iteration #{iteration} • {dataPoints} sessions analyzed
          </p>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
      </button>

      {/* Summary row — always visible */}
      <div className="px-4 pb-4 grid grid-cols-3 gap-2">
        <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
          <Clock className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
          <p className="text-xs font-bold text-foreground">
            {formatHour(timing.optimal_start_hour)}
          </p>
          <p className="text-[9px] text-muted-foreground">Best time</p>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
          <CalendarDays className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
          <p className="text-xs font-bold text-foreground">
            {timing.best_days?.slice(0, 2).map(d => DAY_LABELS[d]).join(", ") || "—"}
          </p>
          <p className="text-[9px] text-muted-foreground">Best days</p>
        </div>
        <div className="rounded-lg bg-secondary/40 p-2.5 text-center">
          <Battery className="w-3.5 h-3.5 text-warning mx-auto mb-1" />
          <p className="text-xs font-bold text-foreground">
            {intensity.fatigue_threshold_minutes}m
          </p>
          <p className="text-[9px] text-muted-foreground">Fatigue limit</p>
        </div>
      </div>

      {/* Expanded details */}
      {expanded && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          className="px-4 pb-4 space-y-3"
        >
          {/* Optimal hours */}
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Peak Hours</p>
            <div className="flex gap-1.5 flex-wrap">
              {timing.best_hours?.map(h => (
                <span key={h} className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-medium">
                  {formatHour(h)}
                </span>
              ))}
              {timing.worst_hours?.length > 0 && (
                <>
                  <span className="text-[10px] text-muted-foreground mx-1">•</span>
                  {timing.worst_hours.map(h => (
                    <span key={h} className="px-2 py-0.5 rounded-full bg-destructive/15 text-destructive text-[10px] font-medium line-through">
                      {formatHour(h)}
                    </span>
                  ))}
                </>
              )}
            </div>
          </div>

          {/* Intensity */}
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">Session Intensity</p>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div>
                <p className="text-sm font-bold text-foreground">{intensity.recommended_session_minutes}m</p>
                <p className="text-[9px] text-muted-foreground">Ideal session</p>
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">{intensity.max_daily_minutes}m</p>
                <p className="text-[9px] text-muted-foreground">Max daily</p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-1.5">
              <span className="text-[9px] text-muted-foreground">Best bucket:</span>
              <span className="px-1.5 py-0.5 rounded bg-accent/15 text-accent text-[9px] font-medium capitalize">
                {intensity.best_bucket}
              </span>
              {intensity.fatigue_signals_detected > 0 && (
                <span className="px-1.5 py-0.5 rounded bg-warning/15 text-warning text-[9px] font-medium ml-auto">
                  {intensity.fatigue_signals_detected} fatigue signals
                </span>
              )}
            </div>
          </div>

          {/* Reward signals */}
          <div className="rounded-lg bg-secondary/30 p-3">
            <p className="text-[10px] text-muted-foreground mb-2 font-medium uppercase tracking-wider">RL Rewards</p>
            <div className="grid grid-cols-2 gap-2">
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-success" />
                <div>
                  <p className="text-xs font-medium text-foreground">{reward_signals.plan_completion_rate}%</p>
                  <p className="text-[9px] text-muted-foreground">Plan completion</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-3 h-3 text-primary" />
                <div>
                  <p className="text-xs font-medium text-foreground">{reward_signals.prediction_accuracy}%</p>
                  <p className="text-[9px] text-muted-foreground">Prediction accuracy</p>
                </div>
              </div>
            </div>
          </div>

          {/* Confidence badge */}
          <div className="flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">
              Timing confidence: <span className={`font-medium ${timing.confidence === "high" ? "text-success" : timing.confidence === "medium" ? "text-warning" : "text-muted-foreground"}`}>{timing.confidence}</span>
            </span>
            <span className="text-[10px] text-muted-foreground">
              {reward_signals.rl_signal_count} RL signals
            </span>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
};

export default RLPolicyCard;
