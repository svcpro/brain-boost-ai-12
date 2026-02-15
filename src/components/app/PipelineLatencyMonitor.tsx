import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Timer, Play, CheckCircle, XCircle, Loader2, History, ChevronDown, ChevronUp, AlertTriangle, Settings2 } from "lucide-react";
import { useInferencePipeline, PipelineResult } from "@/hooks/useInferencePipeline";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import { useToast } from "@/hooks/use-toast";

const STAGE_LABELS: Record<string, string> = {
  "1_profile": "Load Profile",
  "2_embedding": "Load Embedding",
  "3_parameters": "Load Parameters",
  "4_predictions": "Run Predictions",
  "5_compose": "Compose Results",
  load_profile: "Load Profile",
  load_embedding: "Load Embedding",
  load_parameters: "Load Parameters",
  hybrid_prediction: "Hybrid Prediction",
  rl_agent: "RL Agent",
  compose: "Compose Results",
  telemetry: "Store Telemetry",
};

const getBarColor = (ms: number) => {
  if (ms < 300) return "bg-success";
  if (ms < 1000) return "bg-warning";
  return "bg-destructive";
};

const getDotColor = (ms: number) => {
  if (ms < 1500) return "hsl(var(--success))";
  if (ms < 3000) return "hsl(var(--warning))";
  return "hsl(var(--destructive))";
};

interface HistoryEntry {
  id: string;
  created_at: string;
  latency_ms: number | null;
  confidence: number | null;
}

const LatencySparkline = ({ history }: { history: HistoryEntry[] }) => {
  if (history.length < 2) return null;

  const values = history.map(h => h.latency_ms ?? 0);
  const max = Math.max(...values, 1);
  const min = Math.min(...values);
  const w = 220;
  const h = 48;
  const pad = 4;

  const points = values.map((v, i) => {
    const x = pad + (i / (values.length - 1)) * (w - pad * 2);
    const y = pad + ((max - v) / (max - min || 1)) * (h - pad * 2);
    return { x, y, v };
  });

  const pathD = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-12">
      {/* Area fill */}
      <path
        d={`${pathD} L ${points[points.length - 1].x} ${h - pad} L ${points[0].x} ${h - pad} Z`}
        fill="hsl(var(--primary) / 0.08)"
      />
      {/* Line */}
      <path d={pathD} fill="none" stroke="hsl(var(--primary))" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2.5" fill={getDotColor(p.v)} />
      ))}
    </svg>
  );
};

const DEFAULT_THRESHOLD = 3000;
const THRESHOLD_KEY = "acry-pipeline-latency-threshold";

const PipelineLatencyMonitor = () => {
  const { data, loading, error, run } = useInferencePipeline();
  const { user } = useAuth();
  const { toast } = useToast();
  const [hasRun, setHasRun] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [threshold, setThreshold] = useState<number>(() => {
    const saved = localStorage.getItem(THRESHOLD_KEY);
    return saved ? Number(saved) : DEFAULT_THRESHOLD;
  });
  const [showThresholdEditor, setShowThresholdEditor] = useState(false);
  const [thresholdInput, setThresholdInput] = useState(String(threshold));

  const saveThreshold = () => {
    const val = Math.max(500, Math.min(30000, Number(thresholdInput) || DEFAULT_THRESHOLD));
    setThreshold(val);
    setThresholdInput(String(val));
    localStorage.setItem(THRESHOLD_KEY, String(val));
    setShowThresholdEditor(false);
  };

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setHistoryLoading(true);
    try {
      const { data: rows } = await supabase
        .from("model_predictions")
        .select("id, created_at, latency_ms, confidence")
        .eq("user_id", user.id)
        .eq("model_name", "inference_pipeline")
        .order("created_at", { ascending: true })
        .limit(20);
      setHistory(rows || []);
    } catch {} finally {
      setHistoryLoading(false);
    }
  }, [user]);

  useEffect(() => { loadHistory(); }, [loadHistory]);
  useEffect(() => { if (data) loadHistory(); }, [data, loadHistory]);

  // Alert when latency exceeds threshold after a run
  useEffect(() => {
    if (!data) return;
    const total = data.total_latency_ms;
    if (total > threshold) {
      toast({
        title: "⚠️ Pipeline latency exceeded threshold",
        description: `${total}ms > ${threshold}ms limit. Check slow stages.`,
        variant: "destructive",
      });
    }
  }, [data, threshold]);

  const handleRun = async () => {
    setHasRun(true);
    await run();
  };

  const stages = data?.stages;
  const maxLatency = stages
    ? Math.max(...Object.values(stages).map(s => s.latency_ms), 1)
    : 1;

  const avgLatency = history.length > 0
    ? Math.round(history.reduce((s, h) => s + (h.latency_ms ?? 0), 0) / history.length)
    : null;

  const lastLatency = history.length > 0 ? history[history.length - 1].latency_ms : null;
  const prevLatency = history.length > 1 ? history[history.length - 2].latency_ms : null;
  const trend = lastLatency && prevLatency ? lastLatency - prevLatency : null;
  const exceeded = data ? data.total_latency_ms > threshold : false;
  const slowStages = stages
    ? Object.entries(stages).filter(([, s]) => s.latency_ms > threshold * 0.4).map(([k]) => STAGE_LABELS[k] || k)
    : [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${exceeded ? "bg-destructive/15" : "bg-primary/15"}`}>
          {exceeded ? <AlertTriangle className="w-5 h-5 text-destructive" /> : <Timer className="w-5 h-5 text-primary" />}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Pipeline Latency</h3>
          <p className="text-[10px] text-muted-foreground">
            {data ? `${data.total_latency_ms}ms total • v${data.pipeline_version}` : "Run the inference pipeline to see stage timings"}
          </p>
        </div>
        <button
          onClick={() => { setThresholdInput(String(threshold)); setShowThresholdEditor(v => !v); }}
          className="p-1.5 rounded-lg hover:bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors shrink-0"
          title="Configure alert threshold"
        >
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={handleRun}
          disabled={loading}
          className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-[11px] font-semibold hover:bg-primary/25 transition-colors disabled:opacity-50 flex items-center gap-1.5"
        >
          {loading ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Play className="w-3.5 h-3.5" />
          )}
          {loading ? "Running…" : "Run"}
        </motion.button>
      </div>

      {/* Threshold editor */}
      <AnimatePresence>
        {showThresholdEditor && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 flex items-center gap-2">
              <span className="text-[10px] text-muted-foreground shrink-0">Alert when &gt;</span>
              <input
                type="number"
                value={thresholdInput}
                onChange={e => setThresholdInput(e.target.value)}
                onKeyDown={e => e.key === "Enter" && saveThreshold()}
                className="w-20 px-2 py-1 rounded-md bg-secondary/50 border border-border text-xs text-foreground tabular-nums text-center"
                min={500}
                max={30000}
                step={500}
              />
              <span className="text-[10px] text-muted-foreground shrink-0">ms</span>
              <button
                onClick={saveThreshold}
                className="px-2 py-1 rounded-md bg-primary/15 text-primary text-[10px] font-semibold hover:bg-primary/25 transition-colors"
              >
                Save
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Threshold exceeded alert */}
      {exceeded && (
        <motion.div
          initial={{ opacity: 0, y: -4 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-4 mb-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 flex items-start gap-2"
        >
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <div>
            <p className="text-[11px] font-medium text-destructive">
              Latency exceeded {threshold}ms threshold
            </p>
            {slowStages.length > 0 && (
              <p className="text-[10px] text-destructive/80 mt-0.5">
                Bottleneck: {slowStages.join(", ")}
              </p>
            )}
          </div>
        </motion.div>
      )}

      {/* Stage breakdown */}
      {stages && (
        <div className="px-4 pb-4 space-y-2">
          {Object.entries(stages).map(([key, stage], i) => {
            const label = STAGE_LABELS[key] || key.replace(/_/g, " ");
            const pct = Math.max(8, (stage.latency_ms / maxLatency) * 100);
            const ok = stage.status !== "failed";

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-2"
              >
                {ok ? (
                  <CheckCircle className="w-3 h-3 text-success shrink-0" />
                ) : (
                  <XCircle className="w-3 h-3 text-destructive shrink-0" />
                )}
                <span className="text-[11px] text-foreground font-medium w-28 truncate capitalize shrink-0">
                  {label}
                </span>
                <div className="flex-1 h-3 rounded-full bg-secondary/40 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full ${getBarColor(stage.latency_ms)}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6, delay: 0.1 + i * 0.05 }}
                  />
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums w-12 text-right shrink-0">
                  {stage.latency_ms}ms
                </span>
              </motion.div>
            );
          })}

          {/* Total bar */}
          <div className="flex items-center gap-2 pt-1 border-t border-border/50 mt-1">
            <Timer className="w-3 h-3 text-primary shrink-0" />
            <span className="text-[11px] text-foreground font-semibold w-28 shrink-0">Total</span>
            <div className="flex-1" />
            <span className="text-[11px] font-bold text-primary tabular-nums">
              {data.total_latency_ms}ms
            </span>
          </div>
        </div>
      )}

      {/* History toggle */}
      <button
        onClick={() => setShowHistory(v => !v)}
        className="w-full px-4 py-2.5 flex items-center gap-2 border-t border-border/50 hover:bg-secondary/20 transition-colors"
      >
        <History className="w-3.5 h-3.5 text-muted-foreground" />
        <span className="text-[11px] font-medium text-muted-foreground">
          Latency History {history.length > 0 ? `(${history.length} runs)` : ""}
        </span>
        <div className="flex-1" />
        {avgLatency !== null && (
          <span className="text-[10px] text-muted-foreground tabular-nums mr-2">
            avg {avgLatency}ms
          </span>
        )}
        {showHistory ? (
          <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {historyLoading ? (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
                </div>
              ) : history.length === 0 ? (
                <p className="text-[11px] text-muted-foreground text-center py-3">
                  No pipeline runs recorded yet. Tap Run to start.
                </p>
              ) : (
                <>
                  {/* Sparkline chart */}
                  <div className="rounded-lg bg-secondary/30 p-3">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">Latency Trend</p>
                      {trend !== null && (
                        <span className={`text-[10px] font-medium ${trend <= 0 ? "text-success" : "text-warning"}`}>
                          {trend <= 0 ? "↓" : "↑"} {Math.abs(trend)}ms
                        </span>
                      )}
                    </div>
                    <LatencySparkline history={history} />
                    <div className="flex justify-between mt-1">
                      <span className="text-[9px] text-muted-foreground">
                        {format(new Date(history[0].created_at), "MMM d")}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {format(new Date(history[history.length - 1].created_at), "MMM d")}
                      </span>
                    </div>
                  </div>

                  {/* Recent runs list */}
                  <div className="space-y-1.5">
                    {[...history].reverse().slice(0, 8).map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 py-1">
                        <div
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: getDotColor(entry.latency_ms ?? 0) }}
                        />
                        <span className="text-[10px] text-muted-foreground flex-1">
                          {format(new Date(entry.created_at), "MMM d, HH:mm")}
                        </span>
                        <span className="text-[11px] font-medium text-foreground tabular-nums">
                          {entry.latency_ms ?? "—"}ms
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Error state */}
      {error && hasRun && !loading && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-destructive">{error}</p>
        </div>
      )}

      {/* Empty state */}
      {!stages && !loading && hasRun && !error && (
        <div className="px-4 pb-4">
          <p className="text-[11px] text-muted-foreground">No stage data returned.</p>
        </div>
      )}
    </motion.div>
  );
};

export default PipelineLatencyMonitor;
