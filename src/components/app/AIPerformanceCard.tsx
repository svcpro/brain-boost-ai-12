import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, TrendingUp, Target, ChevronDown, CheckCircle, AlertTriangle, Brain, Zap, BarChart3, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface MetricRow {
  model_name: string;
  metric_type: string;
  metric_value: number;
  sample_size: number;
  period_end: string;
  metadata: any;
}

interface TrainingLogRow {
  model_name: string;
  training_type: string;
  status: string;
  completed_at: string | null;
  metrics: any;
}

const modelLabels: Record<string, string> = {
  rank_prediction: "Rank Prediction",
  memory_strength: "Memory Strength",
  forgetting_curve: "Forgetting Curve",
  burnout_detection: "Burnout Detection",
  adaptive_difficulty: "Adaptive Difficulty",
  recommendation_engine: "Recommendations",
  self_evaluation: "Self-Evaluation",
};

const AIPerformanceCard = () => {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState<MetricRow[]>([]);
  const [logs, setLogs] = useState<TrainingLogRow[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const [metricsRes, logsRes] = await Promise.all([
        supabase.from("model_metrics")
          .select("model_name, metric_type, metric_value, sample_size, period_end, metadata")
          .order("created_at", { ascending: false })
          .limit(50),
        supabase.from("ml_training_logs")
          .select("model_name, training_type, status, completed_at, metrics")
          .order("started_at", { ascending: false })
          .limit(10),
      ]);
      setMetrics(metricsRes.data || []);
      setLogs(logsRes.data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="glass rounded-xl neural-border p-4 animate-pulse">
        <div className="h-4 bg-secondary/50 rounded w-1/2 mb-3" />
        <div className="h-3 bg-secondary/30 rounded w-3/4" />
      </div>
    );
  }

  // Parse accuracy metrics per model
  const accuracyMetrics = metrics.filter(m => m.metric_type === "accuracy");
  const recMetrics = metrics.filter(m => m.model_name === "recommendation_engine");
  const lastEvalLog = logs.find(l => l.model_name === "self_evaluation");
  const lastSelfImprove = logs.find(l => l.training_type === "daily_self_improvement");

  // Overall AI health: weighted avg of model accuracies
  const overallAccuracy = accuracyMetrics.length > 0
    ? Math.round((accuracyMetrics.reduce((s, m) => s + m.metric_value, 0) / accuracyMetrics.length) * 100)
    : null;

  const recCompletionRate = recMetrics.find(m => m.metric_type === "completion_rate");
  const recFollowThrough = recMetrics.find(m => m.metric_type === "follow_through_rate");

  const hasData = accuracyMetrics.length > 0 || recMetrics.length > 0 || lastSelfImprove;

  if (!hasData) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/10 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Shield className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">AI Self-Evaluation</p>
          <p className="text-[10px] text-muted-foreground">
            {overallAccuracy !== null
              ? `Overall accuracy: ${overallAccuracy}% across ${accuracyMetrics.length} models`
              : "Tracking AI performance and accuracy"}
          </p>
        </div>
        {overallAccuracy !== null && (
          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            overallAccuracy >= 70 ? "bg-success/15 text-success" :
            overallAccuracy >= 50 ? "bg-warning/15 text-warning" :
            "bg-destructive/15 text-destructive"
          }`}>
            {overallAccuracy}%
          </span>
        )}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Model Accuracy Breakdown */}
              {accuracyMetrics.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Target className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Prediction Accuracy</span>
                  </div>
                  <div className="space-y-1.5">
                    {accuracyMetrics.map((m, i) => {
                      const pct = Math.round(m.metric_value * 100);
                      return (
                        <motion.div
                          key={`${m.model_name}-${i}`}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.05 }}
                          className="flex items-center gap-2"
                        >
                          <span className="text-[10px] text-muted-foreground w-24 shrink-0 truncate">
                            {modelLabels[m.model_name] || m.model_name}
                          </span>
                          <div className="flex-1 h-2 rounded-full bg-secondary">
                            <motion.div
                              className={`h-full rounded-full ${pct >= 70 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive"}`}
                              initial={{ width: 0 }}
                              animate={{ width: `${pct}%` }}
                              transition={{ duration: 0.6, delay: i * 0.1 }}
                            />
                          </div>
                          <div className="flex items-center gap-1">
                            {pct >= 70 ? (
                              <CheckCircle className="w-3 h-3 text-success" />
                            ) : (
                              <AlertTriangle className="w-3 h-3 text-warning" />
                            )}
                            <span className="text-[10px] font-bold text-foreground w-8 text-right">{pct}%</span>
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Recommendation Effectiveness */}
              {(recCompletionRate || recFollowThrough) && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Zap className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground">Recommendation Effectiveness</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {recCompletionRate && (
                      <div className="p-2.5 rounded-lg bg-secondary/20 text-center">
                        <p className={`text-lg font-bold ${recCompletionRate.metric_value >= 0.5 ? "text-success" : "text-warning"}`}>
                          {Math.round(recCompletionRate.metric_value * 100)}%
                        </p>
                        <p className="text-[9px] text-muted-foreground">Completion Rate</p>
                        <p className="text-[9px] text-muted-foreground">{recCompletionRate.sample_size} recommendations</p>
                      </div>
                    )}
                    {recFollowThrough && (
                      <div className="p-2.5 rounded-lg bg-secondary/20 text-center">
                        <p className={`text-lg font-bold ${recFollowThrough.metric_value >= 0.5 ? "text-success" : "text-warning"}`}>
                          {Math.round(recFollowThrough.metric_value * 100)}%
                        </p>
                        <p className="text-[9px] text-muted-foreground">Follow-Through</p>
                        <p className="text-[9px] text-muted-foreground">{recFollowThrough.sample_size} topics studied</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Latest Self-Improvement Cycle */}
              {lastSelfImprove && lastSelfImprove.metrics && (
                <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Latest Self-Improvement</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">
                      Cycle #{lastSelfImprove.metrics.iteration || "?"}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    {lastSelfImprove.metrics.prediction_accuracy !== undefined && (
                      <div>
                        <p className="text-sm font-bold text-foreground">{lastSelfImprove.metrics.prediction_accuracy}%</p>
                        <p className="text-[9px] text-muted-foreground">Pred. Accuracy</p>
                      </div>
                    )}
                    {lastSelfImprove.metrics.best_mode && (
                      <div>
                        <p className="text-sm font-bold text-foreground capitalize">{lastSelfImprove.metrics.best_mode}</p>
                        <p className="text-[9px] text-muted-foreground">Best Study Mode</p>
                      </div>
                    )}
                    {lastSelfImprove.metrics.optimal_duration && (
                      <div>
                        <p className="text-sm font-bold text-foreground">{lastSelfImprove.metrics.optimal_duration}m</p>
                        <p className="text-[9px] text-muted-foreground">Optimal Duration</p>
                      </div>
                    )}
                    {lastSelfImprove.metrics.plan_completion !== undefined && (
                      <div>
                        <p className="text-sm font-bold text-foreground">{lastSelfImprove.metrics.plan_completion}%</p>
                        <p className="text-[9px] text-muted-foreground">Plan Completion</p>
                      </div>
                    )}
                  </div>
                  {lastSelfImprove.metrics.data_drift > 30 && (
                    <p className="text-[9px] text-warning mt-2 flex items-center gap-1">
                      <AlertTriangle className="w-2.5 h-2.5" />
                      Study pattern drift detected — strategies auto-adjusted
                    </p>
                  )}
                </div>
              )}

              {/* Evaluation Activity */}
              {lastEvalLog && (
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <BarChart3 className="w-3 h-3" />
                  <span>
                    Last evaluation: {lastEvalLog.metrics?.users_evaluated || 0} users,{" "}
                    {lastEvalLog.metrics?.predictions_validated || 0} predictions validated
                  </span>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default AIPerformanceCard;
