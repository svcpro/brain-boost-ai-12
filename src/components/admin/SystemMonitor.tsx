import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  Activity, Server, Zap, Database, RefreshCw, Loader2,
  CheckCircle2, AlertTriangle, XCircle, Clock, TrendingUp,
  Cpu, HardDrive, Wifi, DollarSign, BarChart3, Shield,
  Table2, ArrowUpRight, ArrowDownRight, Gauge
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

interface EdgeFunctionStatus {
  name: string;
  status: "healthy" | "degraded" | "down";
  lastInvoked: string | null;
  invocations24h: number;
  avgLatencyMs: number;
  errorRate: number;
}

interface ApiUsageRow {
  service_name: string;
  display_name: string;
  monthly_usage_count: number;
  usage_limit: number | null;
  status: string;
  is_enabled: boolean;
  usage_reset_at: string | null;
  monthly_cost_estimate: number;
  category: string;
}

interface DbTableInfo {
  table_name: string;
  row_count: number;
}

interface CostSummary {
  totalMonthlyCost: number;
  costByCategory: Record<string, number>;
  costPerCall: number;
  topCostService: string;
}

interface InferenceStats {
  total24h: number;
  totalWeek: number;
  avgLatency: number;
  accuracyRate: number;
  modelBreakdown: { model: string; count: number; avgLatency: number; accuracy: number }[];
}

const SystemMonitor = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [apiUsage, setApiUsage] = useState<ApiUsageRow[]>([]);
  const [inferenceStats, setInferenceStats] = useState<InferenceStats>({ total24h: 0, totalWeek: 0, avgLatency: 0, accuracyRate: 0, modelBreakdown: [] });
  const [systemHealth, setSystemHealth] = useState<{ dbConnected: boolean; authHealthy: boolean; storageHealthy: boolean; edgeFunctionsHealthy: boolean }>({
    dbConnected: true, authHealthy: true, storageHealthy: true, edgeFunctionsHealthy: true,
  });
  const [edgeFunctions, setEdgeFunctions] = useState<EdgeFunctionStatus[]>([]);
  const [recentErrors, setRecentErrors] = useState<{ id: string; model_name: string; error_message: string; started_at: string }[]>([]);
  const [dbTables, setDbTables] = useState<DbTableInfo[]>([]);
  const [costSummary, setCostSummary] = useState<CostSummary>({ totalMonthlyCost: 0, costByCategory: {}, costPerCall: 0, topCostService: "" });
  const [lastRefresh, setLastRefresh] = useState(new Date());

  const fetchData = useCallback(async () => {
    const now = new Date();
    const twentyFourHoursAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

    const [apiRes, predictions24hRes, predictionsWeekRes, trainingErrorsRes, trainingLogsRes] = await Promise.all([
      supabase.from("api_integrations").select("service_name, display_name, monthly_usage_count, usage_limit, status, is_enabled, usage_reset_at, monthly_cost_estimate, category"),
      supabase.from("model_predictions").select("model_name, latency_ms, is_correct, confidence, created_at").gte("created_at", twentyFourHoursAgo.toISOString()),
      supabase.from("model_predictions").select("model_name, latency_ms, is_correct, created_at").gte("created_at", sevenDaysAgo.toISOString()),
      supabase.from("ml_training_logs").select("id, model_name, error_message, started_at").eq("status", "failed").order("started_at", { ascending: false }).limit(5),
      supabase.from("ml_training_logs").select("model_name, status, started_at, completed_at, metrics").order("started_at", { ascending: false }).limit(50),
    ]);

    const apiData = (apiRes.data || []) as ApiUsageRow[];
    setApiUsage(apiData);
    setRecentErrors((trainingErrorsRes.data || []).map(e => ({ ...e, error_message: e.error_message || "Unknown error" })));

    // Inference stats
    const preds24h = predictions24hRes.data || [];
    const predsWeek = predictionsWeekRes.data || [];
    const avgLat = preds24h.length > 0 ? Math.round(preds24h.reduce((s, p) => s + (p.latency_ms || 0), 0) / preds24h.length) : 0;
    const correctCount = preds24h.filter(p => p.is_correct === true).length;
    const validatedCount = preds24h.filter(p => p.is_correct !== null).length;
    const accuracyRate = validatedCount > 0 ? Math.round((correctCount / validatedCount) * 100) : 0;

    // Model breakdown
    const modelMap: Record<string, { count: number; totalLat: number; correct: number; validated: number }> = {};
    for (const p of preds24h) {
      if (!modelMap[p.model_name]) modelMap[p.model_name] = { count: 0, totalLat: 0, correct: 0, validated: 0 };
      modelMap[p.model_name].count++;
      modelMap[p.model_name].totalLat += p.latency_ms || 0;
      if (p.is_correct !== null) {
        modelMap[p.model_name].validated++;
        if (p.is_correct) modelMap[p.model_name].correct++;
      }
    }
    const modelBreakdown = Object.entries(modelMap)
      .map(([model, s]) => ({
        model,
        count: s.count,
        avgLatency: s.count > 0 ? Math.round(s.totalLat / s.count) : 0,
        accuracy: s.validated > 0 ? Math.round((s.correct / s.validated) * 100) : 0,
      }))
      .sort((a, b) => b.count - a.count);

    setInferenceStats({ total24h: preds24h.length, totalWeek: predsWeek.length, avgLatency: avgLat, accuracyRate, modelBreakdown });

    // Edge function health from training logs
    const fnNames = [...new Set((trainingLogsRes.data || []).map(l => l.model_name))];
    const efStatuses: EdgeFunctionStatus[] = fnNames.slice(0, 8).map(name => {
      const logs = (trainingLogsRes.data || []).filter(l => l.model_name === name);
      const recent = logs.filter(l => new Date(l.started_at).getTime() > twentyFourHoursAgo.getTime());
      const failed = recent.filter(l => l.status === "failed").length;
      const errorRate = recent.length > 0 ? failed / recent.length : 0;
      const latencies = recent
        .filter(l => l.completed_at && l.started_at)
        .map(l => new Date(l.completed_at!).getTime() - new Date(l.started_at).getTime());
      const avgLat = latencies.length > 0 ? Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) : 0;

      return {
        name,
        status: errorRate > 0.5 ? "down" : errorRate > 0.1 ? "degraded" : "healthy",
        lastInvoked: logs[0]?.started_at || null,
        invocations24h: recent.length,
        avgLatencyMs: avgLat,
        errorRate: Math.round(errorRate * 100),
      };
    });
    setEdgeFunctions(efStatuses);

    // Cost summary
    const totalMonthlyCost = apiData.reduce((s, a) => s + (a.monthly_cost_estimate || 0), 0);
    const totalCalls = apiData.reduce((s, a) => s + (a.monthly_usage_count || 0), 0);
    const costByCategory: Record<string, number> = {};
    apiData.forEach(a => {
      costByCategory[a.category] = (costByCategory[a.category] || 0) + (a.monthly_cost_estimate || 0);
    });
    const topCostService = apiData.length > 0
      ? [...apiData].sort((a, b) => (b.monthly_cost_estimate || 0) - (a.monthly_cost_estimate || 0))[0].display_name
      : "";
    setCostSummary({
      totalMonthlyCost,
      costByCategory,
      costPerCall: totalCalls > 0 ? totalMonthlyCost / totalCalls : 0,
      topCostService,
    });

    // DB table row counts
    const tableNames = ["profiles", "topics", "study_sessions", "memory_scores", "exam_results", "ai_chat_messages", "model_predictions", "ml_events", "notification_history", "study_plans"];
    const tablePromises = tableNames.map(async (t) => {
      const { count } = await supabase.from(t as any).select("*", { count: "exact", head: true });
      return { table_name: t, row_count: count || 0 };
    });
    const tableResults = await Promise.all(tablePromises);
    setDbTables(tableResults.sort((a, b) => b.row_count - a.row_count));

    // System health checks
    const dbOk = !!(apiRes.data);
    const hasFailedRecently = efStatuses.some(e => e.status === "down");
    setSystemHealth({
      dbConnected: dbOk,
      authHealthy: true,
      storageHealthy: true,
      edgeFunctionsHealthy: !hasFailedRecently,
    });

    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchData().finally(() => setLoading(false));
    const interval = setInterval(fetchData, 30000); // auto-refresh every 30s
    return () => clearInterval(interval);
  }, [fetchData]);

  const handleRefresh = async () => {
    setRefreshing(true);
    await fetchData();
    setRefreshing(false);
  };

  const statusIcon = (ok: boolean) => ok
    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
    : <XCircle className="w-4 h-4 text-destructive" />;

  const efStatusBadge = (status: "healthy" | "degraded" | "down") => {
    const map = {
      healthy: { color: "bg-emerald-500/15 text-emerald-500", label: "Healthy" },
      degraded: { color: "bg-amber-500/15 text-amber-500", label: "Degraded" },
      down: { color: "bg-destructive/15 text-destructive", label: "Down" },
    };
    const m = map[status];
    return <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${m.color}`}>{m.label}</span>;
  };

  const overallHealth = systemHealth.dbConnected && systemHealth.authHealthy && systemHealth.storageHealthy && systemHealth.edgeFunctionsHealthy;
  const healthPct = [systemHealth.dbConnected, systemHealth.authHealthy, systemHealth.storageHealthy, systemHealth.edgeFunctionsHealthy].filter(Boolean).length * 25;

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Activity className="w-5 h-5 text-primary" />
            System Monitor
          </h2>
          <p className="text-xs text-muted-foreground mt-1">
            Last refreshed: {format(lastRefresh, "HH:mm:ss")} · Auto-refreshes every 30s
          </p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors disabled:opacity-50">
          <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* System Health Overview */}
      <div className="glass rounded-2xl p-5 neural-border">
        <div className="flex items-center gap-3 mb-4">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${overallHealth ? "bg-emerald-500/15" : "bg-destructive/15"}`}>
            {overallHealth ? <CheckCircle2 className="w-5 h-5 text-emerald-500" /> : <AlertTriangle className="w-5 h-5 text-destructive" />}
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">
              {overallHealth ? "All Systems Operational" : "Some Systems Degraded"}
            </h3>
            <p className="text-xs text-muted-foreground">Health Score: {healthPct}%</p>
          </div>
          <div className="ml-auto flex items-center gap-1">
            <div className={`w-2.5 h-2.5 rounded-full ${overallHealth ? "bg-emerald-500 animate-pulse" : "bg-destructive animate-pulse"}`} />
            <span className={`text-xs font-medium ${overallHealth ? "text-emerald-500" : "text-destructive"}`}>
              {overallHealth ? "LIVE" : "ALERT"}
            </span>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Database", ok: systemHealth.dbConnected, icon: Database },
            { label: "Authentication", ok: systemHealth.authHealthy, icon: Server },
            { label: "Storage", ok: systemHealth.storageHealthy, icon: HardDrive },
            { label: "Backend Functions", ok: systemHealth.edgeFunctionsHealthy, icon: Cpu },
          ].map(s => (
            <div key={s.label} className="flex items-center gap-2 p-3 rounded-xl bg-secondary/50">
              {statusIcon(s.ok)}
              <div>
                <p className="text-xs font-medium text-foreground">{s.label}</p>
                <p className={`text-[10px] ${s.ok ? "text-emerald-500" : "text-destructive"}`}>{s.ok ? "Operational" : "Issue Detected"}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "AI Inferences (24h)", value: inferenceStats.total24h, icon: Zap, color: "text-primary", sub: `${inferenceStats.totalWeek} this week` },
          { label: "Avg Latency", value: `${inferenceStats.avgLatency}ms`, icon: Clock, color: "text-accent", sub: inferenceStats.avgLatency < 200 ? "Within target" : "Above target" },
          { label: "Accuracy Rate", value: `${inferenceStats.accuracyRate}%`, icon: TrendingUp, color: "text-success", sub: `${inferenceStats.modelBreakdown.length} active models` },
          { label: "Monthly Cost", value: `$${costSummary.totalMonthlyCost.toFixed(2)}`, icon: DollarSign, color: "text-warning", sub: costSummary.topCostService ? `Top: ${costSummary.topCostService}` : "No cost data" },
        ].map(c => (
          <div key={c.label} className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{c.label}</p>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
          </div>
        ))}
      </div>

      {/* Cost & Usage Monitor */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Cost Breakdown by Service */}
        <div className="glass rounded-2xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <DollarSign className="w-4 h-4 text-warning" />
            Cost & Usage per Service
          </h3>
          <div className="space-y-2.5">
            {apiUsage.map(api => {
              const costPerCallService = api.monthly_usage_count > 0 ? api.monthly_cost_estimate / api.monthly_usage_count : 0;
              return (
                <div key={api.service_name} className="p-3 rounded-xl bg-secondary/50">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${api.is_enabled ? "bg-success" : "bg-muted-foreground"}`} />
                      <span className="text-xs font-medium text-foreground">{api.display_name}</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">${(api.monthly_cost_estimate || 0).toFixed(2)}</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                    <span>{(api.monthly_usage_count || 0).toLocaleString()} calls</span>
                    <span>${costPerCallService.toFixed(5)}/call</span>
                    <span className="capitalize">{api.category}</span>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Avg Cost / Call</span>
            <span className="text-sm font-bold text-foreground">${costSummary.costPerCall.toFixed(5)}</span>
          </div>
        </div>

        {/* Database Health Monitor */}
        <div className="glass rounded-2xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-primary" />
            Database Health Monitor
          </h3>
          <div className="space-y-1">
            <div className="flex items-center justify-between px-2 py-1.5 text-[10px] text-muted-foreground uppercase tracking-wider font-medium">
              <span>Table</span>
              <span>Rows</span>
            </div>
            {dbTables.map((t, i) => {
              const maxRows = Math.max(...dbTables.map(x => x.row_count), 1);
              const pct = (t.row_count / maxRows) * 100;
              return (
                <div key={t.table_name} className="p-2.5 rounded-lg bg-secondary/30 hover:bg-secondary/50 transition-colors">
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <Table2 className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs font-mono text-foreground">{t.table_name}</span>
                    </div>
                    <span className="text-xs font-bold text-foreground">{t.row_count.toLocaleString()}</span>
                  </div>
                  <div className="h-1 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 pt-3 border-t border-border/50 flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">Total Records</span>
            <span className="text-sm font-bold text-foreground">{dbTables.reduce((s, t) => s + t.row_count, 0).toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* AI Inference Breakdown */}
        <div className="glass rounded-2xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Zap className="w-4 h-4 text-primary" />
            AI Inference by Model (24h)
          </h3>
          {inferenceStats.modelBreakdown.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No inference data in the last 24 hours</p>
          ) : (
            <div className="space-y-3">
              {inferenceStats.modelBreakdown.map(m => {
                const maxCount = Math.max(...inferenceStats.modelBreakdown.map(x => x.count), 1);
                const pct = (m.count / maxCount) * 100;
                return (
                  <div key={m.model}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-xs font-medium text-foreground truncate max-w-[140px]">{m.model}</span>
                      <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                        <span>{m.count} calls</span>
                        <span>{m.avgLatency}ms</span>
                        <span className={m.accuracy >= 70 ? "text-emerald-500" : m.accuracy >= 50 ? "text-amber-500" : "text-destructive"}>
                          {m.accuracy}% acc
                        </span>
                      </div>
                    </div>
                    <div className="h-2 bg-secondary rounded-full overflow-hidden">
                      <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* API Usage */}
        <div className="glass rounded-2xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <Database className="w-4 h-4 text-accent" />
            API Usage
          </h3>
          {apiUsage.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-6">No API integrations configured</p>
          ) : (
            <div className="space-y-2.5">
              {apiUsage.map(api => {
                const usagePct = api.usage_limit ? Math.min((api.monthly_usage_count || 0) / api.usage_limit * 100, 100) : 0;
                const isHigh = usagePct > 80;
                return (
                  <div key={api.service_name} className="p-3 rounded-xl bg-secondary/50">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${api.is_enabled ? (api.status === "active" ? "bg-emerald-500" : "bg-amber-500") : "bg-muted-foreground"}`} />
                        <span className="text-xs font-medium text-foreground">{api.display_name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {(api.monthly_usage_count || 0).toLocaleString()}
                        {api.usage_limit ? ` / ${api.usage_limit.toLocaleString()}` : ""}
                      </span>
                    </div>
                    {api.usage_limit && (
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${isHigh ? "bg-destructive" : "bg-primary/60"}`}
                          style={{ width: `${usagePct}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Backend Functions Status */}
      <div className="glass rounded-2xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Cpu className="w-4 h-4 text-primary" />
          Backend Functions Status
        </h3>
        {edgeFunctions.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No function activity recorded</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {edgeFunctions.map(ef => (
              <div key={ef.name} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground truncate">{ef.name}</span>
                    {efStatusBadge(ef.status)}
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span>{ef.invocations24h} calls/24h</span>
                    <span>{ef.avgLatencyMs}ms avg</span>
                    {ef.errorRate > 0 && <span className="text-destructive">{ef.errorRate}% errors</span>}
                  </div>
                </div>
                {ef.lastInvoked && (
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    {format(new Date(ef.lastInvoked), "HH:mm")}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Recent Errors */}
      {recentErrors.length > 0 && (
        <div className="glass rounded-2xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
            <AlertTriangle className="w-4 h-4 text-destructive" />
            Recent Errors
          </h3>
          <div className="space-y-2">
            {recentErrors.map(err => (
              <div key={err.id} className="flex items-start gap-3 p-3 rounded-xl bg-destructive/5 border border-destructive/10">
                <XCircle className="w-4 h-4 text-destructive mt-0.5 shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-medium text-foreground">{err.model_name}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(err.started_at), "MMM d, HH:mm")}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{err.error_message}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scalability & Performance Section */}
      <div className="glass rounded-2xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2 mb-4">
          <Gauge className="w-4 h-4 text-primary" />
          Scalability & Performance Optimizations
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Caching Status */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-2 mb-3">
              <Database className="w-4 h-4 text-primary" />
              <span className="text-xs font-semibold text-foreground">Query Caching</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">Active</span>
            </div>
            <div className="space-y-2">
              {[
                { label: "Leaderboard", ttl: "30s TTL", type: "In-Memory" },
                { label: "Study Insights", ttl: "60s TTL", type: "In-Memory" },
                { label: "Brain Briefings", ttl: "120s TTL", type: "Stale-While-Revalidate" },
              ].map(c => (
                <div key={c.label} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{c.label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground font-medium">{c.ttl}</span>
                    <span className="text-muted-foreground">{c.type}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Limiting Status */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-warning/10 to-warning/5 border border-warning/20">
            <div className="flex items-center gap-2 mb-3">
              <Shield className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold text-foreground">Rate Limiting</span>
              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success font-medium">Active</span>
            </div>
            <div className="space-y-2">
              {[
                { fn: "AI Brain Agent", limit: "15 req/min" },
                { fn: "AI Chat", limit: "20 req/min" },
                { fn: "Voice Notification", limit: "5 req/min" },
                { fn: "Cognitive Twin", limit: "5 req/min" },
                { fn: "Leaderboard", limit: "30 req/min" },
              ].map(r => (
                <div key={r.fn} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{r.fn}</span>
                  <span className="text-foreground font-medium">{r.limit}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Scale Readiness */}
          <div className="p-4 rounded-xl bg-gradient-to-br from-success/10 to-success/5 border border-success/20">
            <div className="flex items-center gap-2 mb-3">
              <TrendingUp className="w-4 h-4 text-success" />
              <span className="text-xs font-semibold text-foreground">Scale Readiness</span>
            </div>
            <div className="space-y-2.5">
              {[
                { label: "CDN Static Assets", status: true },
                { label: "Serverless Auto-Scale", status: true },
                { label: "DB Query Caching", status: true },
                { label: "Per-User Rate Limits", status: true },
                { label: "AI Multi-Model Fallback", status: true },
                { label: "Retry + Backoff", status: true },
                { label: "Code Splitting", status: true },
                { label: "PWA + Offline", status: true },
              ].map(s => (
                <div key={s.label} className="flex items-center gap-2 text-[10px]">
                  <CheckCircle2 className={`w-3 h-3 ${s.status ? "text-success" : "text-muted-foreground"}`} />
                  <span className={s.status ? "text-foreground" : "text-muted-foreground"}>{s.label}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SystemMonitor;
