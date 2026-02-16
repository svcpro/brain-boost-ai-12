import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, BarChart3, RefreshCw, Loader2, CheckCircle2, XCircle,
  Activity, TrendingUp, Zap, Clock, Settings, ChevronDown, Play,
  AlertTriangle, Layers, Target, GitBranch
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
  error_message: string | null;
  triggered_by: string | null;
}

interface ModelMetric {
  id: string;
  model_name: string;
  model_version: string;
  metric_type: string;
  metric_value: number;
  sample_size: number;
  period_start: string;
  period_end: string;
  metadata: any;
  created_at: string;
}

interface ModelPrediction {
  id: string;
  model_name: string;
  model_version: string;
  confidence: number | null;
  is_correct: boolean | null;
  latency_ms: number | null;
  created_at: string;
}

interface ModelSelection {
  id: string;
  model_domain: string;
  active_model: string;
  candidate_models: any;
  performance_history: any;
  last_evaluated_at: string | null;
}

type Tab = "overview" | "training" | "predictions" | "versions" | "parameters";

const AIModelManagement = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState<TrainingLog[]>([]);
  const [metrics, setMetrics] = useState<ModelMetric[]>([]);
  const [predictions, setPredictions] = useState<ModelPrediction[]>([]);
  const [selections, setSelections] = useState<ModelSelection[]>([]);
  const [retraining, setRetraining] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [logsRes, metricsRes, predsRes, selRes] = await Promise.all([
      supabase.from("ml_training_logs").select("*").order("started_at", { ascending: false }).limit(30),
      supabase.from("model_metrics").select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("model_predictions").select("id, model_name, model_version, confidence, is_correct, latency_ms, created_at").order("created_at", { ascending: false }).limit(100),
      supabase.from("model_selections").select("*").order("last_evaluated_at", { ascending: false }).limit(20),
    ]);
    setLogs((logsRes.data || []) as TrainingLog[]);
    setMetrics((metricsRes.data || []) as ModelMetric[]);
    setPredictions((predsRes.data || []) as ModelPrediction[]);
    setSelections((selRes.data || []) as ModelSelection[]);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const triggerRetrain = async (modelName: string) => {
    setRetraining(modelName);
    try {
      const { error } = await supabase.from("ml_training_logs").insert({
        model_name: modelName,
        model_version: "retrain-" + Date.now(),
        training_type: "manual_retrain",
        status: "running",
        triggered_by: "admin_panel",
      });
      if (error) throw error;

      // Try to invoke the continual-learning edge function
      try {
        await supabase.functions.invoke("continual-learning", {
          body: { action: "retrain", model: modelName },
        });
      } catch { /* function may not exist */ }

      toast({ title: "Retraining triggered", description: `${modelName} retraining started.` });
      await fetchAll();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setRetraining(null);
    }
  };

  // Computed stats
  const uniqueModels = [...new Set(logs.map(l => l.model_name))];
  const totalPredictions = predictions.length;
  const validatedPreds = predictions.filter(p => p.is_correct !== null);
  const accuracyRate = validatedPreds.length > 0
    ? Math.round((validatedPreds.filter(p => p.is_correct).length / validatedPreds.length) * 100)
    : null;
  const avgLatency = predictions.filter(p => p.latency_ms).length > 0
    ? Math.round(predictions.filter(p => p.latency_ms).reduce((s, p) => s + (p.latency_ms || 0), 0) / predictions.filter(p => p.latency_ms).length)
    : null;
  const avgConfidence = predictions.filter(p => p.confidence).length > 0
    ? Math.round(predictions.filter(p => p.confidence).reduce((s, p) => s + (p.confidence || 0), 0) / predictions.filter(p => p.confidence).length * 100)
    : null;

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "training", label: "Training Logs", icon: Zap },
    { key: "predictions", label: "Prediction Accuracy", icon: Target },
    { key: "versions", label: "Version History", icon: GitBranch },
    { key: "parameters", label: "Parameters", icon: Settings },
  ];

  if (loading) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Brain className="w-5 h-5 text-primary" />
          AI Model Management
        </h2>
        <button onClick={fetchAll} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Models", value: uniqueModels.length, icon: Layers, color: "text-primary" },
          { label: "Predictions", value: totalPredictions, icon: Activity, color: "text-primary" },
          { label: "Accuracy", value: accuracyRate !== null ? `${accuracyRate}%` : "—", icon: Target, color: accuracyRate && accuracyRate >= 70 ? "text-success" : "text-warning" },
          { label: "Avg Latency", value: avgLatency !== null ? `${avgLatency}ms` : "—", icon: Clock, color: avgLatency && avgLatency < 200 ? "text-success" : "text-warning" },
          { label: "Confidence", value: avgConfidence !== null ? `${avgConfidence}%` : "—", icon: TrendingUp, color: avgConfidence && avgConfidence >= 70 ? "text-success" : "text-warning" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
            className="glass rounded-xl p-4 neural-border text-center">
            <stat.icon className={`w-4 h-4 mx-auto mb-1.5 ${stat.color}`} />
            <p className={`text-lg font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground">{stat.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {tab === "overview" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Model Performance Summary</h3>
          {uniqueModels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No models tracked yet</p>
          ) : (
            <div className="space-y-3">
              {uniqueModels.map(model => {
                const modelLogs = logs.filter(l => l.model_name === model);
                const modelPreds = predictions.filter(p => p.model_name === model);
                const modelMetrics = metrics.filter(m => m.model_name === model);
                const validated = modelPreds.filter(p => p.is_correct !== null);
                const acc = validated.length > 0 ? Math.round((validated.filter(p => p.is_correct).length / validated.length) * 100) : null;
                const latestLog = modelLogs[0];
                const latestVersion = latestLog?.model_version || "—";

                return (
                  <motion.div key={model} className="glass rounded-xl neural-border overflow-hidden"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <div className="p-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <Brain className="w-4 h-4 text-primary" />
                          <span className="text-sm font-semibold text-foreground">{model}</span>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{latestVersion}</span>
                        </div>
                        <button
                          onClick={() => triggerRetrain(model)}
                          disabled={retraining === model}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                        >
                          {retraining === model ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                          Retrain
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        <div className="p-2.5 rounded-lg bg-secondary/50">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Accuracy</p>
                          <p className={`text-sm font-bold ${acc && acc >= 70 ? "text-success" : acc ? "text-warning" : "text-muted-foreground"}`}>
                            {acc !== null ? `${acc}%` : "—"}
                          </p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-secondary/50">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Predictions</p>
                          <p className="text-sm font-bold text-foreground">{modelPreds.length}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-secondary/50">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Trainings</p>
                          <p className="text-sm font-bold text-foreground">{modelLogs.length}</p>
                        </div>
                        <div className="p-2.5 rounded-lg bg-secondary/50">
                          <p className="text-[10px] text-muted-foreground mb-0.5">Metrics</p>
                          <p className="text-sm font-bold text-foreground">{modelMetrics.length}</p>
                        </div>
                      </div>
                      {/* Metric sparkline area */}
                      {modelMetrics.length > 0 && (
                        <div className="mt-3 space-y-1">
                          {modelMetrics.slice(0, 3).map(m => (
                            <div key={m.id} className="flex items-center justify-between text-xs">
                              <span className="text-muted-foreground">{m.metric_type}</span>
                              <div className="flex items-center gap-2">
                                <div className="w-20 h-1.5 bg-secondary rounded-full overflow-hidden">
                                  <div className="h-full bg-primary rounded-full" style={{ width: `${Math.min(m.metric_value * 100, 100)}%` }} />
                                </div>
                                <span className="text-foreground font-medium w-12 text-right">
                                  {m.metric_value < 1 ? `${(m.metric_value * 100).toFixed(1)}%` : m.metric_value.toFixed(2)}
                                </span>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Training Logs Tab */}
      {tab === "training" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-foreground">Training History</h3>
            <span className="text-xs text-muted-foreground">{logs.length} entries</span>
          </div>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No training logs yet</p>
          ) : (
            <div className="space-y-2">
              {logs.map((l, i) => (
                <motion.div key={l.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className="glass rounded-xl p-4 neural-border">
                  <div className="flex items-center gap-3">
                    {l.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-success flex-shrink-0" />
                      : l.status === "failed" ? <XCircle className="w-4 h-4 text-destructive flex-shrink-0" />
                      : <Loader2 className="w-4 h-4 text-primary animate-spin flex-shrink-0" />}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="text-sm font-semibold text-foreground">{l.model_name}</p>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">v{l.model_version}</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          l.status === "completed" ? "bg-success/15 text-success" : l.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                        }`}>{l.status}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                        <span>{l.training_type}</span>
                        <span>·</span>
                        <span>{l.training_data_size || 0} samples</span>
                        {l.triggered_by && <><span>·</span><span>by {l.triggered_by}</span></>}
                      </div>
                      {l.error_message && (
                        <p className="text-[10px] text-destructive mt-1 truncate">{l.error_message}</p>
                      )}
                      {l.metrics && typeof l.metrics === "object" && (
                        <div className="flex gap-3 mt-1.5">
                          {Object.entries(l.metrics as Record<string, any>).slice(0, 4).map(([k, v]) => (
                            <span key={k} className="text-[10px] text-muted-foreground">
                              {k}: <span className="text-foreground font-medium">{typeof v === "number" ? v.toFixed(3) : String(v)}</span>
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-[10px] text-muted-foreground">{new Date(l.started_at).toLocaleDateString()}</p>
                      <p className="text-[10px] text-muted-foreground">{new Date(l.started_at).toLocaleTimeString()}</p>
                      {l.completed_at && (
                        <p className="text-[10px] text-success mt-0.5">
                          {Math.round((new Date(l.completed_at).getTime() - new Date(l.started_at).getTime()) / 1000)}s
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Prediction Accuracy Tab */}
      {tab === "predictions" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Prediction Accuracy Monitor</h3>

          {/* Per-model accuracy breakdown */}
          {uniqueModels.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No predictions yet</p>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {uniqueModels.map(model => {
                  const mp = predictions.filter(p => p.model_name === model);
                  const val = mp.filter(p => p.is_correct !== null);
                  const correct = val.filter(p => p.is_correct).length;
                  const wrong = val.filter(p => !p.is_correct).length;
                  const pending = mp.filter(p => p.is_correct === null).length;
                  const accPct = val.length > 0 ? Math.round((correct / val.length) * 100) : null;
                  const avgLat = mp.filter(p => p.latency_ms).reduce((s, p, _, a) => s + (p.latency_ms || 0) / a.length, 0);

                  return (
                    <div key={model} className="glass rounded-xl p-4 neural-border">
                      <div className="flex items-center gap-2 mb-3">
                        <Brain className="w-4 h-4 text-primary" />
                        <span className="text-sm font-semibold text-foreground">{model}</span>
                      </div>
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span className="text-muted-foreground">Accuracy</span>
                          <span className={`font-bold ${accPct && accPct >= 70 ? "text-success" : accPct ? "text-warning" : "text-muted-foreground"}`}>
                            {accPct !== null ? `${accPct}%` : "—"}
                          </span>
                        </div>
                        {accPct !== null && (
                          <div className="w-full h-2 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${accPct >= 70 ? "bg-success" : accPct >= 50 ? "bg-warning" : "bg-destructive"}`}
                              style={{ width: `${accPct}%` }} />
                          </div>
                        )}
                        <div className="grid grid-cols-3 gap-2 mt-2">
                          <div className="text-center">
                            <p className="text-xs font-bold text-success">{correct}</p>
                            <p className="text-[9px] text-muted-foreground">Correct</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-destructive">{wrong}</p>
                            <p className="text-[9px] text-muted-foreground">Wrong</p>
                          </div>
                          <div className="text-center">
                            <p className="text-xs font-bold text-muted-foreground">{pending}</p>
                            <p className="text-[9px] text-muted-foreground">Pending</p>
                          </div>
                        </div>
                        {avgLat > 0 && (
                          <p className="text-[10px] text-muted-foreground mt-1">
                            Avg latency: <span className="text-foreground">{Math.round(avgLat)}ms</span>
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent predictions list */}
              <h3 className="text-sm font-semibold text-foreground mt-4">Recent Predictions</h3>
              <div className="space-y-1.5 max-h-64 overflow-y-auto">
                {predictions.slice(0, 20).map(p => (
                  <div key={p.id} className="flex items-center gap-3 px-3 py-2 rounded-lg bg-secondary/30 text-xs">
                    {p.is_correct === true ? <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />
                      : p.is_correct === false ? <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />
                      : <Clock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />}
                    <span className="text-foreground font-medium">{p.model_name}</span>
                    <span className="text-muted-foreground">v{p.model_version}</span>
                    {p.confidence && <span className="text-muted-foreground ml-auto">{Math.round(p.confidence * 100)}% conf</span>}
                    {p.latency_ms && <span className="text-muted-foreground">{p.latency_ms}ms</span>}
                    <span className="text-muted-foreground">{new Date(p.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}

      {/* Version History Tab */}
      {tab === "versions" && (
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-foreground">Model Version History</h3>

          {/* Active Models (from model_selections) */}
          {selections.length > 0 && (
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Model Selections</p>
              {selections.map(s => (
                <div key={s.id} className="glass rounded-xl p-4 neural-border">
                  <div className="flex items-center gap-2 mb-2">
                    <GitBranch className="w-4 h-4 text-primary" />
                    <span className="text-sm font-semibold text-foreground">{s.model_domain}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success">active: {s.active_model}</span>
                  </div>
                  {s.candidate_models && Array.isArray(s.candidate_models) && (
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {(s.candidate_models as any[]).map((c, idx) => {
                        const label = typeof c === "string" ? c : (c?.model || c?.name || JSON.stringify(c));
                        const labelStr = String(label);
                        return (
                          <span key={idx} className={`text-[10px] px-2 py-0.5 rounded-full ${labelStr === s.active_model ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
                            {labelStr}
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {s.last_evaluated_at && (
                    <p className="text-[10px] text-muted-foreground mt-2">Last evaluated: {new Date(s.last_evaluated_at).toLocaleString()}</p>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Version timeline from training logs */}
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-4">Training Version Timeline</p>
          {logs.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No versions tracked</p>
          ) : (
            <div className="relative pl-6 space-y-3">
              <div className="absolute left-2.5 top-2 bottom-2 w-px bg-border" />
              {logs.map((l, i) => (
                <motion.div key={l.id} initial={{ opacity: 0, x: -5 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
                  className="relative">
                  <div className={`absolute left-[-18px] top-3 w-2.5 h-2.5 rounded-full border-2 border-background ${
                    l.status === "completed" ? "bg-success" : l.status === "failed" ? "bg-destructive" : "bg-primary"
                  }`} />
                  <div className="glass rounded-lg p-3 neural-border">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-foreground">{l.model_name}</span>
                      <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">v{l.model_version}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        l.status === "completed" ? "bg-success/15 text-success" : l.status === "failed" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"
                      }`}>{l.status}</span>
                      <span className="text-[10px] text-muted-foreground ml-auto">{new Date(l.started_at).toLocaleString()}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{l.training_type} · {l.training_data_size || 0} samples</p>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Parameters Tab */}
      {tab === "parameters" && (
        <ParametersTab selections={selections} metrics={metrics} onRefresh={fetchAll} />
      )}
    </div>
  );
};

// Parameters sub-tab
const ParametersTab = ({ selections, metrics, onRefresh }: { selections: ModelSelection[]; metrics: ModelMetric[]; onRefresh: () => void }) => {
  const { toast } = useToast();

  // Group metrics by model for a parameter-like view
  const modelGroups = [...new Set(metrics.map(m => m.model_name))];

  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-foreground">Model Parameters & Configuration</h3>

      {/* Active model selections as editable parameters */}
      {selections.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider">Active Model Selections</p>
          {selections.map(s => {
            const perfHistory = Array.isArray(s.performance_history)
              ? s.performance_history as any[]
              : s.performance_history && typeof s.performance_history === "object"
                ? Object.entries(s.performance_history as Record<string, any>)
                : [];

            return (
              <div key={s.id} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-center gap-2 mb-3">
                  <Settings className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{s.model_domain}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-muted-foreground">Active Model</span>
                    <span className="text-foreground font-medium px-2 py-0.5 rounded bg-primary/10 text-primary">{s.active_model}</span>
                  </div>
                  {perfHistory.length > 0 && (
                    <div className="mt-2 space-y-1">
                      <p className="text-[10px] text-muted-foreground">Performance History</p>
                      {(Array.isArray(perfHistory[0]) ? perfHistory : perfHistory.map((item: any, i: number) => [String(i), item])).slice(0, 5).map(([key, val]: [string, any], idx: number) => (
                        <div key={idx} className="flex items-center justify-between text-[10px]">
                          <span className="text-muted-foreground">{typeof val === "object" && val?.selected ? val.selected : key}</span>
                          <span className="text-foreground">{typeof val === "number" ? val.toFixed(3) : typeof val === "object" ? `score: ${val?.score ?? "—"}` : String(val)}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Latest metrics per model as observable parameters */}
      {modelGroups.length > 0 && (
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground uppercase tracking-wider mt-4">Model Metrics (Latest)</p>
          {modelGroups.map(model => {
            const modelM = metrics.filter(m => m.model_name === model);
            const byType = modelM.reduce<Record<string, ModelMetric>>((acc, m) => {
              if (!acc[m.metric_type] || new Date(m.created_at) > new Date(acc[m.metric_type].created_at)) {
                acc[m.metric_type] = m;
              }
              return acc;
            }, {});

            return (
              <div key={model} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-center gap-2 mb-3">
                  <Brain className="w-4 h-4 text-primary" />
                  <span className="text-sm font-semibold text-foreground">{model}</span>
                  <span className="text-[10px] text-muted-foreground">({Object.keys(byType).length} metrics)</span>
                </div>
                <div className="space-y-1.5">
                  {Object.entries(byType).map(([type, m]) => (
                    <div key={type} className="flex items-center justify-between text-xs px-2 py-1.5 rounded-lg bg-secondary/30">
                      <span className="text-muted-foreground">{type}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-foreground font-medium">
                          {m.metric_value < 1 ? `${(m.metric_value * 100).toFixed(1)}%` : m.metric_value.toFixed(3)}
                        </span>
                        <span className="text-[9px] text-muted-foreground">n={m.sample_size}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selections.length === 0 && modelGroups.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No model parameters configured yet</p>
      )}
    </div>
  );
};

export default AIModelManagement;
