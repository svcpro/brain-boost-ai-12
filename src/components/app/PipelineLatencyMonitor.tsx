import { useState } from "react";
import { motion } from "framer-motion";
import { Timer, Play, CheckCircle, XCircle, Loader2 } from "lucide-react";
import { useInferencePipeline, PipelineResult } from "@/hooks/useInferencePipeline";

const STAGE_LABELS: Record<string, string> = {
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

const PipelineLatencyMonitor = () => {
  const { data, loading, error, run } = useInferencePipeline();
  const [hasRun, setHasRun] = useState(false);

  const handleRun = async () => {
    setHasRun(true);
    await run();
  };

  const stages = data?.stages;
  const maxLatency = stages
    ? Math.max(...Object.values(stages).map(s => s.latency_ms), 1)
    : 1;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
          <Timer className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-foreground">Pipeline Latency</h3>
          <p className="text-[10px] text-muted-foreground">
            {data ? `${data.total_latency_ms}ms total • v${data.pipeline_version}` : "Run the inference pipeline to see stage timings"}
          </p>
        </div>
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

      {/* Stage breakdown */}
      {stages && (
        <div className="px-4 pb-4 space-y-2">
          {Object.entries(stages).map(([key, stage], i) => {
            const label = STAGE_LABELS[key] || key.replace(/_/g, " ");
            const pct = Math.max(8, (stage.latency_ms / maxLatency) * 100);
            const ok = stage.status === "ok";

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
