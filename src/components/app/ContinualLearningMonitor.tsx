import { motion } from "framer-motion";
import { Activity, AlertTriangle, CheckCircle, RefreshCw, Loader2, TrendingUp, Database, Cpu } from "lucide-react";
import { useContinualLearning } from "@/hooks/useContinualLearning";

export default function ContinualLearningMonitor() {
  const { report, loading, monitor } = useContinualLearning();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center">
            <Cpu className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Continual Learning</h3>
            <p className="text-[10px] text-muted-foreground">Self-improving AI models</p>
          </div>
        </div>
        <button
          onClick={() => monitor()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {loading ? <Loader2 className="w-3 h-3 animate-spin" /> : <RefreshCw className="w-3 h-3" />}
          Run Health Check
        </button>
      </div>

      {loading && !report && (
        <div className="glass rounded-xl neural-border p-6 flex flex-col items-center gap-2">
          <Loader2 className="w-5 h-5 text-primary animate-spin" />
          <p className="text-[10px] text-muted-foreground">Analyzing model health & drift…</p>
        </div>
      )}

      {report && (
        <div className="space-y-3">
          {/* Health Score */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl neural-border p-4"
          >
            <div className="flex items-center justify-between mb-3">
              <span className="text-xs font-semibold text-foreground">AI Health Score</span>
              <span className={`text-lg font-bold ${report.health_score >= 70 ? "text-success" : report.health_score >= 40 ? "text-warning" : "text-destructive"}`}>
                {report.health_score}%
              </span>
            </div>
            <div className="h-2 rounded-full bg-secondary">
              <motion.div
                className={`h-full rounded-full ${report.health_score >= 70 ? "bg-success" : report.health_score >= 40 ? "bg-warning" : "bg-destructive"}`}
                initial={{ width: 0 }}
                animate={{ width: `${report.health_score}%` }}
                transition={{ duration: 0.8 }}
              />
            </div>
          </motion.div>

          {/* Model Accuracy */}
          {Object.keys(report.accuracy_report).length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="glass rounded-xl neural-border p-4 space-y-2"
            >
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-3.5 h-3.5 text-primary" />
                <span className="text-xs font-semibold text-foreground">Model Accuracy</span>
              </div>
              {Object.entries(report.accuracy_report).map(([model, stats]) => (
                <div key={model} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                  <div className="flex items-center gap-2">
                    {stats.needsRetrain ? (
                      <AlertTriangle className="w-3 h-3 text-destructive" />
                    ) : (
                      <CheckCircle className="w-3 h-3 text-success" />
                    )}
                    <span className="text-[10px] font-medium text-foreground">{model.replace(/_/g, " ")}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`text-[10px] font-bold ${stats.accuracy >= 0.7 ? "text-success" : stats.accuracy >= 0.5 ? "text-warning" : "text-destructive"}`}>
                      {Math.round(stats.accuracy * 100)}%
                    </span>
                    <span className="text-[9px] text-muted-foreground">({stats.total} preds)</span>
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {/* Feature & Drift Status */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid grid-cols-2 gap-3"
          >
            <div className="glass rounded-xl neural-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Database className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-foreground">Features</span>
              </div>
              <p className={`text-xs font-bold ${report.feature_staleness.stale ? "text-warning" : "text-success"}`}>
                {report.feature_staleness.stale ? "Stale" : "Fresh"}
              </p>
              <p className="text-[9px] text-muted-foreground">{Math.round(report.feature_staleness.age_hours)}h old</p>
            </div>
            <div className="glass rounded-xl neural-border p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Activity className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-foreground">Data Drift</span>
              </div>
              <p className={`text-xs font-bold ${report.data_drift.detected ? "text-destructive" : "text-success"}`}>
                {report.data_drift.detected ? "Detected" : "Stable"}
              </p>
              <p className="text-[9px] text-muted-foreground">{Math.round(report.data_drift.drift_score * 100)}% shift</p>
            </div>
          </motion.div>

          {/* Retrained Models */}
          {report.retrained_models.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.3 }}
              className="rounded-xl bg-primary/10 border border-primary/20 p-3"
            >
              <span className="text-[10px] font-semibold text-primary">Auto-Retrained:</span>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                {report.retrained_models.map(m => (
                  <span key={m} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/20 text-primary font-medium">
                    {m.replace(/_/g, " ")}
                  </span>
                ))}
              </div>
            </motion.div>
          )}
        </div>
      )}
    </div>
  );
}
