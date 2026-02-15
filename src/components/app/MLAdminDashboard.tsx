import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Brain, Activity, TrendingUp, Zap, RefreshCw, Clock,
  BarChart3, AlertTriangle, CheckCircle2, Loader2, ArrowLeft,
  Cpu, Database, Target, Flame, Gauge, ChevronDown, ChevronUp
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useMLFeatures, type UserFeatures } from "@/hooks/useMLFeatures";
import { useBurnoutDetection, type BurnoutData } from "@/hooks/useBurnoutDetection";
import { useAdaptiveDifficulty, type AdaptiveDifficultyData } from "@/hooks/useAdaptiveDifficulty";

interface ModelMetric {
  model_name: string;
  metric_type: string;
  metric_value: number;
  sample_size: number;
  period_start: string;
  period_end: string;
}

interface TrainingLog {
  id: string;
  model_name: string;
  model_version: string;
  training_type: string;
  status: string;
  started_at: string;
  completed_at: string | null;
  training_data_size: number | null;
  metrics: any;
  triggered_by: string;
}

interface PredictionStats {
  model_name: string;
  total_predictions: number;
  avg_latency: number;
  avg_confidence: number;
}

const MODEL_NAMES = [
  { key: "forgetting_curve", label: "Forgetting Curve", icon: Brain, color: "text-primary" },
  { key: "memory_strength", label: "Memory Strength", icon: Gauge, color: "text-accent" },
  { key: "rank_prediction", label: "Rank Prediction", icon: TrendingUp, color: "text-success" },
  { key: "burnout_detection", label: "Burnout Detection", icon: Flame, color: "text-destructive" },
  { key: "adaptive_difficulty", label: "Adaptive Difficulty", icon: Target, color: "text-warning" },
  { key: "feature_engine", label: "Feature Engine", icon: Cpu, color: "text-muted-foreground" },
];

const MLAdminDashboard = ({ onBack }: { onBack: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { features, loading: featuresLoading, compute: computeFeatures } = useMLFeatures();
  const { data: burnoutData, loading: burnoutLoading, detect: detectBurnout } = useBurnoutDetection();
  const { data: difficultyData, loading: diffLoading, predict: predictDifficulty } = useAdaptiveDifficulty();

  const [trainingLogs, setTrainingLogs] = useState<TrainingLog[]>([]);
  const [predictionStats, setPredictionStats] = useState<PredictionStats[]>([]);
  const [retraining, setRetraining] = useState(false);
  const [expandedModel, setExpandedModel] = useState<string | null>(null);
  const [loadingData, setLoadingData] = useState(true);

  const fetchDashboardData = useCallback(async () => {
    if (!user) return;
    setLoadingData(true);
    try {
      const [logsRes, predsRes] = await Promise.all([
        supabase
          .from("ml_training_logs")
          .select("*")
          .order("started_at", { ascending: false })
          .limit(20),
        supabase
          .from("model_predictions")
          .select("model_name, latency_ms, confidence")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(200),
      ]);

      setTrainingLogs(logsRes.data || []);

      // Compute stats per model
      const preds = predsRes.data || [];
      const statsMap = new Map<string, { total: number; latencySum: number; confSum: number }>();
      for (const p of preds) {
        const existing = statsMap.get(p.model_name) || { total: 0, latencySum: 0, confSum: 0 };
        existing.total++;
        existing.latencySum += p.latency_ms || 0;
        existing.confSum += p.confidence || 0;
        statsMap.set(p.model_name, existing);
      }
      const stats: PredictionStats[] = [];
      for (const [name, s] of statsMap) {
        stats.push({
          model_name: name,
          total_predictions: s.total,
          avg_latency: s.total > 0 ? Math.round(s.latencySum / s.total) : 0,
          avg_confidence: s.total > 0 ? Math.round((s.confSum / s.total) * 100) : 0,
        });
      }
      setPredictionStats(stats);
    } catch (e: any) {
      console.error("Failed to fetch ML dashboard data:", e);
    } finally {
      setLoadingData(false);
    }
  }, [user]);

  useEffect(() => {
    fetchDashboardData();
  }, [fetchDashboardData]);

  const handleRetrain = async () => {
    setRetraining(true);
    try {
      await computeFeatures();
      await Promise.all([detectBurnout(), predictDifficulty()]);
      await fetchDashboardData();
      toast({ title: "🧠 Models Retrained", description: "All ML models have been updated with latest data." });
    } catch (e: any) {
      toast({ title: "Retrain failed", description: e.message, variant: "destructive" });
    } finally {
      setRetraining(false);
    }
  };

  const getModelStats = (modelKey: string) => {
    return predictionStats.find(s => s.model_name === modelKey);
  };

  const getRecentLogs = (modelKey: string) => {
    return trainingLogs.filter(l => l.model_name === modelKey);
  };

  return (
    <div className="p-4 space-y-5 max-w-2xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Cpu className="w-5 h-5 text-primary" />
            ML Control Panel
          </h1>
          <p className="text-xs text-muted-foreground">Monitor and manage AI models</p>
        </div>
        <button
          onClick={handleRetrain}
          disabled={retraining}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 disabled:opacity-50 transition-all"
        >
          {retraining ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Retrain All
        </button>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-3 gap-3">
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Database className="w-3.5 h-3.5 text-primary" />
            <span className="text-[10px] text-muted-foreground">Models</span>
          </div>
          <p className="text-xl font-bold text-foreground">{MODEL_NAMES.length}</p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }} className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Activity className="w-3.5 h-3.5 text-success" />
            <span className="text-[10px] text-muted-foreground">Predictions</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {predictionStats.reduce((s, p) => s + p.total_predictions, 0)}
          </p>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-1.5 mb-1">
            <Clock className="w-3.5 h-3.5 text-warning" />
            <span className="text-[10px] text-muted-foreground">Trainings</span>
          </div>
          <p className="text-xl font-bold text-foreground">{trainingLogs.length}</p>
        </motion.div>
      </div>

      {/* Burnout & Difficulty Live Status */}
      {(burnoutData || difficultyData) && (
        <div className="grid grid-cols-2 gap-3">
          {burnoutData && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-1.5 mb-2">
                <Flame className={`w-4 h-4 ${burnoutData.risk_level === "high" ? "text-destructive" : burnoutData.risk_level === "moderate" ? "text-warning" : "text-success"}`} />
                <span className="text-xs font-medium text-foreground">Burnout Risk</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground">{burnoutData.burnout_score}</span>
                <span className="text-[10px] text-muted-foreground">/100</span>
              </div>
              <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full mt-1 inline-block ${
                burnoutData.risk_level === "high" ? "bg-destructive/15 text-destructive" :
                burnoutData.risk_level === "moderate" ? "bg-warning/15 text-warning" :
                "bg-success/15 text-success"
              }`}>
                {burnoutData.risk_level}
              </span>
            </motion.div>
          )}
          {difficultyData && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-1.5 mb-2">
                <Target className="w-4 h-4 text-warning" />
                <span className="text-xs font-medium text-foreground">Adaptive Difficulty</span>
              </div>
              <div className="flex items-baseline gap-1">
                <span className="text-2xl font-bold text-foreground capitalize">{difficultyData.recommended_difficulty}</span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                Score: {difficultyData.difficulty_score}/3 · {difficultyData.recommended_question_count} Qs
              </span>
            </motion.div>
          )}
        </div>
      )}

      {/* User Features */}
      {features && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border space-y-3">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Feature Vector</span>
            <span className="text-[10px] text-muted-foreground ml-auto">
              {new Date(features.computed_at).toLocaleString()}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Study Consistency", value: `${features.study_consistency_score}%`, color: features.study_consistency_score > 50 ? "text-success" : "text-warning" },
              { label: "Engagement", value: `${features.engagement_score}%`, color: features.engagement_score > 50 ? "text-success" : "text-warning" },
              { label: "Recall Success", value: `${(features.recall_success_rate * 100).toFixed(0)}%`, color: features.recall_success_rate > 0.6 ? "text-success" : "text-destructive" },
              { label: "Fatigue", value: `${features.fatigue_indicator}%`, color: features.fatigue_indicator < 30 ? "text-success" : "text-destructive" },
              { label: "Learning Velocity", value: `${features.learning_velocity}/day`, color: "text-primary" },
              { label: "Knowledge Stability", value: `${features.knowledge_stability}%`, color: features.knowledge_stability > 60 ? "text-success" : "text-warning" },
              { label: "24h Study", value: `${features.hours_studied_last_24h}h`, color: "text-foreground" },
              { label: "7d Study", value: `${features.hours_studied_last_7d}h`, color: "text-foreground" },
            ].map((f, i) => (
              <div key={i} className="flex justify-between items-center py-1 px-2 rounded-lg bg-secondary/30">
                <span className="text-[10px] text-muted-foreground">{f.label}</span>
                <span className={`text-xs font-semibold ${f.color}`}>{f.value}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Model Cards */}
      <div className="space-y-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Zap className="w-4 h-4 text-primary" />
          Model Registry
        </h3>
        {loadingData ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-primary" />
          </div>
        ) : (
          MODEL_NAMES.map((model, idx) => {
            const stats = getModelStats(model.key);
            const logs = getRecentLogs(model.key);
            const isExpanded = expandedModel === model.key;

            return (
              <motion.div
                key={model.key}
                initial={{ opacity: 0, x: -15 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                className="glass rounded-xl neural-border overflow-hidden"
              >
                <button
                  onClick={() => setExpandedModel(isExpanded ? null : model.key)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary/30 transition-colors"
                >
                  <model.icon className={`w-4 h-4 ${model.color}`} />
                  <div className="flex-1 text-left">
                    <p className="text-sm font-medium text-foreground">{model.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      v1 · {stats ? `${stats.total_predictions} predictions` : "No data yet"}
                    </p>
                  </div>
                  {stats && (
                    <div className="flex items-center gap-2 mr-2">
                      <span className="text-[10px] text-muted-foreground">
                        {stats.avg_latency}ms
                      </span>
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        stats.avg_confidence > 70 ? "bg-success/15 text-success" :
                        stats.avg_confidence > 40 ? "bg-warning/15 text-warning" :
                        "bg-destructive/15 text-destructive"
                      }`}>
                        {stats.avg_confidence}%
                      </span>
                    </div>
                  )}
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </button>

                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    className="border-t border-border px-3 py-2 space-y-2"
                  >
                    {stats && (
                      <div className="grid grid-cols-3 gap-2">
                        <div className="text-center py-1">
                          <p className="text-lg font-bold text-foreground">{stats.total_predictions}</p>
                          <p className="text-[9px] text-muted-foreground">Predictions</p>
                        </div>
                        <div className="text-center py-1">
                          <p className="text-lg font-bold text-foreground">{stats.avg_latency}ms</p>
                          <p className="text-[9px] text-muted-foreground">Avg Latency</p>
                        </div>
                        <div className="text-center py-1">
                          <p className="text-lg font-bold text-foreground">{stats.avg_confidence}%</p>
                          <p className="text-[9px] text-muted-foreground">Confidence</p>
                        </div>
                      </div>
                    )}
                    {logs.length > 0 && (
                      <div className="space-y-1">
                        <p className="text-[10px] font-medium text-muted-foreground">Recent Training</p>
                        {logs.slice(0, 3).map((log) => (
                          <div key={log.id} className="flex items-center gap-2 text-[10px] py-1 px-2 rounded bg-secondary/30">
                            {log.status === "completed" ? (
                              <CheckCircle2 className="w-3 h-3 text-success shrink-0" />
                            ) : log.status === "failed" ? (
                              <AlertTriangle className="w-3 h-3 text-destructive shrink-0" />
                            ) : (
                              <Loader2 className="w-3 h-3 text-primary animate-spin shrink-0" />
                            )}
                            <span className="text-muted-foreground flex-1">
                              {log.training_type} · {log.training_data_size || 0} samples
                            </span>
                            <span className="text-muted-foreground/70">
                              {new Date(log.started_at).toLocaleDateString()}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    {!stats && logs.length === 0 && (
                      <p className="text-[10px] text-muted-foreground py-2 text-center">No data collected yet. Use the app to generate predictions.</p>
                    )}
                  </motion.div>
                )}
              </motion.div>
            );
          })
        )}
      </div>

      {/* Burnout Recommendations */}
      {burnoutData && burnoutData.recommendations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border space-y-2">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-foreground">Wellness Recommendations</span>
          </div>
          <div className="space-y-1.5">
            {burnoutData.recommendations.map((tip, i) => (
              <div key={i} className="flex items-start gap-2 py-1.5 px-2 rounded-lg bg-secondary/30">
                <span className="text-primary text-xs mt-0.5">•</span>
                <p className="text-xs text-foreground/80 leading-relaxed">{tip}</p>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default MLAdminDashboard;
