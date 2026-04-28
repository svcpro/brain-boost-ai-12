import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import {
  History, AlertTriangle, AlertCircle, CheckCircle2, Bell, TrendingUp,
  Rocket, RotateCcw, Activity, Loader2, RefreshCw, Trash2, Download,
  Filter, Search, Clock, Database, Zap, Users, ChevronDown, ChevronRight
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import { useAdminRole } from "@/hooks/useAdminRole";

type EventType = "alert" | "snapshot" | "recommendation" | "upgrade" | "rollback" | "resolved";
type Severity = "info" | "warning" | "critical";

interface Incident {
  id: string;
  event_type: EventType;
  severity: Severity;
  title: string;
  description: string | null;
  metric_name: string | null;
  metric_value: number | null;
  threshold_value: number | null;
  current_tier: string | null;
  recommended_tier: string | null;
  snapshot: any;
  metadata: any;
  resolved_at: string | null;
  created_by: string | null;
  created_at: string;
}

const EVENT_META: Record<EventType, { icon: any; label: string; color: string; bg: string }> = {
  alert:          { icon: AlertTriangle, label: "Alert",          color: "text-warning",     bg: "bg-warning/10 border-warning/30" },
  snapshot:       { icon: Activity,      label: "Snapshot",       color: "text-primary",     bg: "bg-primary/10 border-primary/30" },
  recommendation: { icon: TrendingUp,    label: "Recommendation", color: "text-accent",      bg: "bg-accent/10 border-accent/30" },
  upgrade:        { icon: Rocket,        label: "Upgrade",        color: "text-success",     bg: "bg-success/10 border-success/30" },
  rollback:       { icon: RotateCcw,     label: "Rollback",       color: "text-destructive", bg: "bg-destructive/10 border-destructive/30" },
  resolved:       { icon: CheckCircle2,  label: "Resolved",       color: "text-success",     bg: "bg-success/10 border-success/30" },
};

const SEVERITY_META: Record<Severity, { color: string; bg: string }> = {
  info:     { color: "text-primary",     bg: "bg-primary/15" },
  warning:  { color: "text-warning",     bg: "bg-warning/15" },
  critical: { color: "text-destructive", bg: "bg-destructive/15 animate-pulse" },
};

const PAGE_SIZE = 50;

export default function IncidentTimeline() {
  const { isSuperAdmin } = useAdminRole();
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filterType, setFilterType] = useState<EventType | "all">("all");
  const [filterSeverity, setFilterSeverity] = useState<Severity | "all">("all");
  const [search, setSearch] = useState("");
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [stats, setStats] = useState({ total: 0, critical: 0, last24h: 0, alerts: 0 });

  const fetchIncidents = useCallback(async (reset = false) => {
    setRefreshing(true);
    try {
      const offset = reset ? 0 : page * PAGE_SIZE;
      let q = supabase.from("incident_history" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .range(offset, offset + PAGE_SIZE - 1);
      if (filterType !== "all") q = q.eq("event_type", filterType);
      if (filterSeverity !== "all") q = q.eq("severity", filterSeverity);

      const { data, error } = await q;
      if (error) throw error;
      const rows = (data as any as Incident[]) || [];
      setIncidents(prev => reset ? rows : [...prev, ...rows]);
      setHasMore(rows.length === PAGE_SIZE);
      if (reset) setPage(0);
    } catch (e: any) {
      toast.error("Failed to load incidents", { description: e.message });
    } finally {
      setRefreshing(false);
      setLoading(false);
    }
  }, [page, filterType, filterSeverity]);

  const fetchStats = useCallback(async () => {
    try {
      const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
      const [{ count: total }, { count: critical }, { count: last24h }, { count: alerts }] = await Promise.all([
        supabase.from("incident_history" as any).select("id", { count: "exact", head: true }),
        supabase.from("incident_history" as any).select("id", { count: "exact", head: true }).eq("severity", "critical"),
        supabase.from("incident_history" as any).select("id", { count: "exact", head: true }).gte("created_at", since24h),
        supabase.from("incident_history" as any).select("id", { count: "exact", head: true }).eq("event_type", "alert"),
      ]);
      setStats({ total: total || 0, critical: critical || 0, last24h: last24h || 0, alerts: alerts || 0 });
    } catch {}
  }, []);

  useEffect(() => { fetchIncidents(true); fetchStats(); }, [filterType, filterSeverity]);

  // Realtime subscription for new incidents
  useEffect(() => {
    const channel = supabase
      .channel("incident-history-stream")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "incident_history" }, (payload) => {
        const newIncident = payload.new as Incident;
        // Apply filters before prepending
        if (filterType !== "all" && newIncident.event_type !== filterType) return;
        if (filterSeverity !== "all" && newIncident.severity !== filterSeverity) return;
        setIncidents(prev => [newIncident, ...prev].slice(0, (page + 1) * PAGE_SIZE));
        fetchStats();
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [filterType, filterSeverity, page, fetchStats]);

  const filtered = useMemo(() => {
    if (!search) return incidents;
    const s = search.toLowerCase();
    return incidents.filter(i =>
      i.title.toLowerCase().includes(s) ||
      i.description?.toLowerCase().includes(s) ||
      i.metric_name?.toLowerCase().includes(s)
    );
  }, [incidents, search]);

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const handleResolve = async (id: string) => {
    try {
      await supabase.from("incident_history" as any)
        .update({ resolved_at: new Date().toISOString() })
        .eq("id", id);
      setIncidents(prev => prev.map(i => i.id === id ? { ...i, resolved_at: new Date().toISOString() } : i));
      toast.success("Marked as resolved");
    } catch (e: any) { toast.error(e.message); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this incident permanently?")) return;
    try {
      await supabase.from("incident_history" as any).delete().eq("id", id);
      setIncidents(prev => prev.filter(i => i.id !== id));
      toast.success("Incident deleted");
      fetchStats();
    } catch (e: any) { toast.error(e.message); }
  };

  const handleClearOld = async () => {
    if (!confirm("Delete all incidents older than 30 days?")) return;
    try {
      const cutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      await supabase.from("incident_history" as any).delete().lt("created_at", cutoff);
      toast.success("Old incidents cleared");
      fetchIncidents(true); fetchStats();
    } catch (e: any) { toast.error(e.message); }
  };

  const exportCSV = () => {
    const headers = ["Date", "Type", "Severity", "Title", "Metric", "Value", "Threshold", "Tier", "Description"];
    const rows = filtered.map(i => [
      i.created_at, i.event_type, i.severity, i.title,
      i.metric_name || "", i.metric_value ?? "", i.threshold_value ?? "",
      i.current_tier || "", (i.description || "").replace(/\n/g, " "),
    ]);
    const csv = [headers, ...rows].map(r => r.map(c => `"${String(c).replace(/"/g,'""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = `incidents-${format(new Date(), "yyyy-MM-dd")}.csv`; a.click();
    URL.revokeObjectURL(url);
    toast.success("Exported CSV");
  };

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent/30 to-primary/20 flex items-center justify-center neural-border">
            <History className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
              Incident History
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-success/15 text-success border border-success/30">REALTIME</span>
            </h2>
            <p className="text-xs text-muted-foreground">Every alert, snapshot & scaling decision</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => fetchIncidents(true)} disabled={refreshing}
            className="p-2 rounded-lg bg-secondary hover:bg-primary/10">
            {refreshing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          </button>
          <button onClick={exportCSV}
            className="px-3 py-2 rounded-lg bg-secondary hover:bg-primary/10 text-xs flex items-center gap-1.5">
            <Download className="w-3.5 h-3.5" /> Export
          </button>
          {isSuperAdmin && (
            <button onClick={handleClearOld}
              className="px-3 py-2 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive text-xs flex items-center gap-1.5 border border-destructive/30">
              <Trash2 className="w-3.5 h-3.5" /> Clear 30d+
            </button>
          )}
        </div>
      </div>

      {/* Stat KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard icon={History} label="Total Events" value={stats.total} color="primary" />
        <StatCard icon={AlertCircle} label="Critical" value={stats.critical} color="destructive" />
        <StatCard icon={Clock} label="Last 24h" value={stats.last24h} color="warning" />
        <StatCard icon={Bell} label="Alerts Fired" value={stats.alerts} color="accent" />
      </div>

      {/* Filters */}
      <div className="glass rounded-2xl neural-border p-4 space-y-3">
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">Type:</span>
          <FilterChip active={filterType === "all"} onClick={() => setFilterType("all")}>All</FilterChip>
          {(Object.keys(EVENT_META) as EventType[]).map(t => (
            <FilterChip key={t} active={filterType === t} onClick={() => setFilterType(t)}>
              {EVENT_META[t].label}
            </FilterChip>
          ))}
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-muted-foreground ml-6">Severity:</span>
          <FilterChip active={filterSeverity === "all"} onClick={() => setFilterSeverity("all")}>All</FilterChip>
          {(Object.keys(SEVERITY_META) as Severity[]).map(s => (
            <FilterChip key={s} active={filterSeverity === s} onClick={() => setFilterSeverity(s)}>
              <span className="capitalize">{s}</span>
            </FilterChip>
          ))}
        </div>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-2.5 text-muted-foreground" />
          <input type="text" placeholder="Search title, description, metric..." value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground" />
        </div>
      </div>

      {/* Timeline */}
      <div className="glass rounded-2xl neural-border p-5">
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <History className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm">No incidents recorded yet</p>
            <p className="text-[10px] mt-1">Events will appear here automatically as alerts trigger</p>
          </div>
        ) : (
          <div className="relative">
            <div className="absolute left-[15px] top-0 bottom-0 w-px bg-gradient-to-b from-primary/40 via-border to-transparent" />
            <div className="space-y-3">
              <AnimatePresence>
                {filtered.map((inc, idx) => {
                  const meta = EVENT_META[inc.event_type] || EVENT_META.alert;
                  const sev = SEVERITY_META[inc.severity] || SEVERITY_META.info;
                  const Icon = meta.icon;
                  const isExpanded = expanded.has(inc.id);
                  return (
                    <motion.div key={inc.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }}
                      transition={{ delay: Math.min(idx * 0.02, 0.3) }}
                      className="relative pl-10">
                      {/* Timeline dot */}
                      <div className={`absolute left-0 top-3 w-8 h-8 rounded-full ${meta.bg} border-2 flex items-center justify-center z-10`}>
                        <Icon className={`w-3.5 h-3.5 ${meta.color}`} />
                      </div>
                      {/* Card */}
                      <div className={`glass rounded-xl border p-3 ${meta.bg} ${inc.resolved_at ? "opacity-60" : ""}`}>
                        <div className="flex items-start justify-between gap-3 cursor-pointer" onClick={() => toggleExpand(inc.id)}>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${sev.bg} ${sev.color}`}>
                                {inc.severity}
                              </span>
                              <span className={`text-[9px] uppercase font-bold ${meta.color}`}>{meta.label}</span>
                              {inc.resolved_at && <span className="text-[9px] text-success">● RESOLVED</span>}
                            </div>
                            <p className="text-sm font-bold text-foreground mt-1 truncate">{inc.title}</p>
                            <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(inc.created_at), { addSuffix: true })}</span>
                              <span>·</span>
                              <span>{format(new Date(inc.created_at), "MMM d, HH:mm:ss")}</span>
                              {inc.metric_name && (
                                <><span>·</span><span className="font-mono">{inc.metric_name}={inc.metric_value}</span></>
                              )}
                            </div>
                          </div>
                          {isExpanded ? <ChevronDown className="w-4 h-4 text-muted-foreground flex-shrink-0" /> :
                                        <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        </div>

                        <AnimatePresence>
                          {isExpanded && (
                            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden">
                              <div className="mt-3 pt-3 border-t border-border space-y-2">
                                {inc.description && (
                                  <p className="text-xs text-foreground">{inc.description}</p>
                                )}
                                <div className="grid grid-cols-2 gap-2 text-[10px]">
                                  {inc.metric_name && <Detail label="Metric" value={inc.metric_name} />}
                                  {inc.metric_value !== null && <Detail label="Value" value={String(inc.metric_value)} />}
                                  {inc.threshold_value !== null && <Detail label="Threshold" value={String(inc.threshold_value)} />}
                                  {inc.current_tier && <Detail label="Current Tier" value={inc.current_tier} />}
                                  {inc.recommended_tier && <Detail label="Recommended Tier" value={inc.recommended_tier} />}
                                </div>
                                {inc.snapshot && Object.keys(inc.snapshot).length > 0 && (
                                  <details className="text-[10px]">
                                    <summary className="cursor-pointer text-muted-foreground hover:text-foreground">View snapshot</summary>
                                    <pre className="mt-2 p-2 bg-background rounded text-[9px] overflow-x-auto text-foreground">
                                      {JSON.stringify(inc.snapshot, null, 2)}
                                    </pre>
                                  </details>
                                )}
                                <div className="flex items-center gap-2 pt-2">
                                  {!inc.resolved_at && (
                                    <button onClick={(e) => { e.stopPropagation(); handleResolve(inc.id); }}
                                      className="text-[10px] px-2 py-1 rounded bg-success/15 text-success hover:bg-success/25 border border-success/30">
                                      ✓ Mark Resolved
                                    </button>
                                  )}
                                  {isSuperAdmin && (
                                    <button onClick={(e) => { e.stopPropagation(); handleDelete(inc.id); }}
                                      className="text-[10px] px-2 py-1 rounded bg-destructive/10 text-destructive hover:bg-destructive/20 border border-destructive/30">
                                      <Trash2 className="w-3 h-3 inline mr-1" />Delete
                                    </button>
                                  )}
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>

            {hasMore && filtered.length >= PAGE_SIZE && (
              <button onClick={() => { setPage(p => p + 1); fetchIncidents(false); }}
                className="w-full mt-4 py-2 rounded-lg bg-secondary hover:bg-primary/10 text-xs text-muted-foreground">
                Load more
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  const colorMap: any = { primary: "text-primary", accent: "text-accent", success: "text-success", warning: "text-warning", destructive: "text-destructive" };
  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl neural-border p-4">
      <Icon className={`w-4 h-4 ${colorMap[color]} mb-2`} />
      <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
    </motion.div>
  );
}

function FilterChip({ active, onClick, children }: any) {
  return (
    <button onClick={onClick}
      className={`text-[10px] px-2.5 py-1 rounded-full border transition-all ${
        active ? "bg-primary/15 text-primary border-primary/40" : "bg-secondary text-muted-foreground border-border hover:border-primary/30"
      }`}>
      {children}
    </button>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between p-1.5 rounded bg-background/50">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  );
}
