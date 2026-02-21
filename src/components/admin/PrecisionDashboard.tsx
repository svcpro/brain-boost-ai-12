import React, { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, RefreshCw, BarChart3, Activity, Brain, Sparkles, TrendingUp, AlertTriangle } from "lucide-react";
import { usePrecisionIntelligence } from "@/hooks/usePrecisionIntelligence";
import { useToast } from "@/hooks/use-toast";

export default function AdminPrecisionDashboard() {
  const { fetchDashboard, triggerSelfLearn, loading } = usePrecisionIntelligence();
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [recalResult, setRecalResult] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDashboard().then(setDashboardData);
  }, []);

  const handleRecalibrate = useCallback(async () => {
    const result = await triggerSelfLearn();
    if (result) {
      setRecalResult(result);
      toast({ title: "✅ Recalibration Complete", description: `${result.models?.length || 0} models updated. ${result.user_count} users affected.` });
      fetchDashboard().then(setDashboardData);
    }
  }, [triggerSelfLearn, fetchDashboard, toast]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
            <Shield className="w-5 h-5 text-primary" />
            v7.0 Precision Intelligence Dashboard
          </h2>
          <p className="text-xs text-muted-foreground mt-1">AI model performance analytics & self-learning loop</p>
        </div>
        <button
          onClick={handleRecalibrate}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          {loading ? "Recalibrating..." : "Trigger Recalibration"}
        </button>
      </div>

      {/* Recalibration result */}
      {recalResult && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl border border-chart-2/30 bg-chart-2/5 p-4"
        >
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-chart-2" />
            Recalibration Results
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(recalResult.models || []).map((m: any) => (
              <div key={m.model} className="text-center px-3 py-2 rounded-lg bg-card border border-border">
                <p className="text-xs font-medium text-foreground capitalize">{m.model.replace(/_/g, " ")}</p>
                <p className="text-lg font-bold text-chart-2">{(m.new_accuracy * 100).toFixed(1)}%</p>
                <p className="text-[9px] text-muted-foreground">
                  Δ {((m.new_accuracy - m.previous_accuracy) * 100).toFixed(1)}%
                </p>
              </div>
            ))}
          </div>
          <div className="flex items-center gap-4 mt-3 text-[10px] text-muted-foreground">
            <span>{recalResult.user_count} users</span>
            <span>{recalResult.data_points} data points</span>
            <span>Overall: {(recalResult.overall_accuracy * 100).toFixed(1)}%</span>
          </div>
        </motion.div>
      )}

      {/* Recalibration History */}
      {dashboardData?.recalibration_history && dashboardData.recalibration_history.length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-primary" />
            Recalibration History
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 text-muted-foreground font-medium">Model</th>
                  <th className="text-left py-2 text-muted-foreground font-medium">Type</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Prev</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">New</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Delta</th>
                  <th className="text-right py-2 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {dashboardData.recalibration_history.slice(0, 10).map((log: any) => (
                  <tr key={log.id} className="border-b border-border/50">
                    <td className="py-2 text-foreground capitalize">{(log.model_name || "").replace(/_/g, " ")}</td>
                    <td className="py-2 text-muted-foreground">{(log.recalibration_type || "").replace(/_/g, " ")}</td>
                    <td className="py-2 text-right text-muted-foreground">{((log.previous_accuracy || 0) * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right text-foreground font-medium">{((log.new_accuracy || 0) * 100).toFixed(1)}%</td>
                    <td className={`py-2 text-right font-medium ${(log.accuracy_delta || 0) > 0 ? "text-chart-2" : "text-destructive"}`}>
                      {(log.accuracy_delta || 0) > 0 ? "+" : ""}{((log.accuracy_delta || 0) * 100).toFixed(1)}%
                    </td>
                    <td className="py-2 text-right text-muted-foreground">{new Date(log.created_at).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Behavioral Micro Events */}
      {dashboardData?.micro_event_summary && Object.keys(dashboardData.micro_event_summary).length > 0 && (
        <div className="rounded-xl border border-border bg-card p-4">
          <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-chart-5" />
            Behavioral Micro Events ({dashboardData.total_micro_events} total)
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {Object.entries(dashboardData.micro_event_summary).map(([type, stats]: [string, any]) => (
              <div key={type} className="text-center px-3 py-3 rounded-lg bg-secondary/50 border border-border/50">
                <p className="text-xs font-medium text-foreground capitalize">{type.replace(/_/g, " ")}</p>
                <p className="text-xl font-bold text-foreground mt-1">{stats.count}</p>
                <p className="text-[9px] text-muted-foreground">Avg severity: {(stats.avgSeverity * 100).toFixed(0)}%</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
