import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Database, Download, Loader2, CheckCircle2, HardDrive, FileJson, AlertTriangle,
  Sparkles, Clock, RefreshCw, FileText, ListChecks, Trash2, Filter, Zap,
  Layers, GitBranch, FastForward,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type RunStatus = "queued" | "running" | "completed" | "failed";
type Run = {
  id: string;
  status: RunStatus;
  format: string;
  scope: string;
  mode?: string | null;
  since_timestamp?: string | null;
  skipped_tables?: string[] | null;
  total_tables: number;
  completed_tables: number;
  failed_tables: string[] | null;
  total_rows: number;
  size_bytes: number;
  download_url: string | null;
  storage_path: string | null;
  duration_ms: number | null;
  started_at: string;
  finished_at: string | null;
  expires_at: string | null;
};

const fmtBytes = (n: number) => {
  if (!n) return "0 B";
  const u = ["B", "KB", "MB", "GB"];
  let i = 0; let v = n;
  while (v >= 1024 && i < u.length - 1) { v /= 1024; i++; }
  return `${v.toFixed(v >= 10 || i === 0 ? 0 : 1)} ${u[i]}`;
};

const fmtMs = (ms: number | null) => {
  if (!ms) return "—";
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 100) / 10;
  return s < 60 ? `${s}s` : `${Math.floor(s / 60)}m ${Math.round(s % 60)}s`;
};

export default function AdminBackup() {
  const { toast } = useToast();
  const [tables, setTables] = useState<string[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState("");
  const [exportFormat, setExportFormat] = useState<"json" | "ndjson">("json");
  const [mode, setMode] = useState<"full" | "incremental">("full");
  const [lastRun, setLastRun] = useState<{ finished_at: string; mode: string } | null>(null);
  const [running, setRunning] = useState(false);
  const [runs, setRuns] = useState<Run[]>([]);
  const [latest, setLatest] = useState<Run | null>(null);

  // Load table list and history
  const loadAll = async () => {
    try {
      const [{ data: tbls }, { data: lr }] = await Promise.all([
        supabase.functions.invoke("admin-full-backup", { body: { action: "list_tables" } }),
        supabase.functions.invoke("admin-full-backup", { body: { action: "last_run" } }),
      ]);
      if (tbls?.tables) {
        setTables(tbls.tables);
        setSelected(new Set(tbls.tables));
      }
      if (lr?.last) setLastRun(lr.last);
    } catch (e) { console.error(e); }

    const { data } = await supabase.from("admin_backup_runs")
      .select("*").order("created_at", { ascending: false }).limit(20);
    if (data) setRuns(data as Run[]);
  };

  useEffect(() => { loadAll(); }, []);

  // Realtime progress for the active run
  useEffect(() => {
    if (!latest?.id || latest.status === "completed" || latest.status === "failed") return;
    const ch = supabase
      .channel(`backup-${latest.id}`)
      .on("postgres_changes",
        { event: "UPDATE", schema: "public", table: "admin_backup_runs", filter: `id=eq.${latest.id}` },
        (payload) => setLatest(payload.new as Run))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [latest?.id, latest?.status]);

  const startBackup = async () => {
    if (running) return;
    setRunning(true);
    setLatest({
      id: "pending", status: "running", format: exportFormat,
      scope: selected.size === tables.length ? "full" : "partial",
      total_tables: selected.size, completed_tables: 0, failed_tables: [],
      total_rows: 0, size_bytes: 0, download_url: null, storage_path: null,
      duration_ms: null, started_at: new Date().toISOString(), finished_at: null, expires_at: null,
    });
    try {
      const { data, error } = await supabase.functions.invoke("admin-full-backup", {
        body: {
          action: "start",
          format: exportFormat,
          tables: selected.size === tables.length ? null : Array.from(selected),
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      toast({
        title: "✅ Backup ready",
        description: `${data.completed_tables}/${data.total_tables} tables · ${fmtBytes(data.size_bytes)} · ${fmtMs(data.duration_ms)}`,
      });
      // Auto-download
      if (data.download_url) {
        const a = document.createElement("a");
        a.href = data.download_url;
        a.download = `acry-backup-${Date.now()}.${exportFormat}`;
        a.click();
      }
      await loadAll();
      // Re-select latest from refreshed list
      const { data: fresh } = await supabase.from("admin_backup_runs").select("*").eq("id", data.run_id).maybeSingle();
      if (fresh) setLatest(fresh as Run);
    } catch (e: any) {
      toast({ title: "Backup failed", description: e.message, variant: "destructive" });
      setLatest(null);
    } finally {
      setRunning(false);
    }
  };

  const downloadRun = async (run: Run) => {
    if (run.download_url) {
      window.open(run.download_url, "_blank");
      return;
    }
    if (!run.storage_path) return;
    const { data } = await supabase.storage.from("admin-backups")
      .createSignedUrl(run.storage_path, 60 * 60);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const deleteRun = async (run: Run) => {
    if (run.storage_path) {
      await supabase.storage.from("admin-backups").remove([run.storage_path]);
    }
    await supabase.from("admin_backup_runs").delete().eq("id", run.id);
    setRuns((r) => r.filter((x) => x.id !== run.id));
    toast({ title: "Backup deleted" });
  };

  const toggleAll = (checked: boolean) =>
    setSelected(new Set(checked ? tables : []));

  const toggle = (t: string) => {
    const next = new Set(selected);
    next.has(t) ? next.delete(t) : next.add(t);
    setSelected(next);
  };

  const filtered = tables.filter((t) => t.toLowerCase().includes(filter.toLowerCase()));
  const progressPct = latest && latest.total_tables
    ? Math.round((latest.completed_tables / latest.total_tables) * 100)
    : 0;

  return (
    <div className="space-y-5 mt-4">
      {/* Hero */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl neural-border p-6 relative overflow-hidden">
        <div className="absolute -top-12 -right-12 w-48 h-48 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
        <div className="flex items-center gap-3 mb-5 relative">
          <div className="p-3 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 neural-border">
            <HardDrive className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">Full System Backup</h3>
              <span className="px-2 py-0.5 rounded-full text-[9px] font-bold bg-primary/15 text-primary">v3.0</span>
            </div>
            <p className="text-xs text-muted-foreground">Server-side · Bypasses RLS · Parallel · Auto-download</p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2.5 mb-5">
          {[
            { icon: Database, label: "Tables", value: tables.length, color: "text-primary" },
            { icon: ListChecks, label: "Selected", value: selected.size, color: "text-accent" },
            { icon: Zap, label: "Parallelism", value: "4×", color: "text-warning" },
            { icon: Clock, label: "URL valid", value: "24h", color: "text-emerald-400" },
          ].map((s) => (
            <div key={s.label} className="bg-secondary/30 rounded-xl p-3 text-center neural-border">
              <s.icon className={`w-3.5 h-3.5 mx-auto mb-1 ${s.color}`} />
              <p className="text-base font-bold text-foreground">{s.value}</p>
              <p className="text-[9px] text-muted-foreground uppercase tracking-wide">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Format selector */}
        <div className="flex gap-2 mb-4">
          {[
            { id: "json", label: "JSON", desc: "Single file · pretty" },
            { id: "ndjson", label: "NDJSON", desc: "Streamable · scale-ready" },
          ].map((f) => (
            <button key={f.id} onClick={() => setExportFormat(f.id as any)}
              className={`flex-1 p-3 rounded-xl neural-border transition-all text-left ${
                exportFormat === f.id ? "bg-primary/15 ring-1 ring-primary/40" : "bg-secondary/20 hover:bg-secondary/40"
              }`}>
              <div className="flex items-center gap-2 mb-0.5">
                <FileJson className={`w-3.5 h-3.5 ${exportFormat === f.id ? "text-primary" : "text-muted-foreground"}`} />
                <span className="text-xs font-bold text-foreground">{f.label}</span>
              </div>
              <p className="text-[10px] text-muted-foreground">{f.desc}</p>
            </button>
          ))}
        </div>

        {/* Live progress */}
        <AnimatePresence>
          {latest && (latest.status === "running" || latest.status === "queued") && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }} className="mb-4 space-y-2 overflow-hidden">
              <div className="flex items-center justify-between text-xs">
                <span className="text-muted-foreground flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin text-primary" />
                  Exporting {latest.completed_tables}/{latest.total_tables} tables
                  {latest.total_rows > 0 && <span className="text-foreground">· {latest.total_rows.toLocaleString()} rows</span>}
                </span>
                <span className="text-primary font-bold">{progressPct}%</span>
              </div>
              <div className="w-full h-2 rounded-full bg-secondary/50 overflow-hidden">
                <motion.div
                  className="h-full bg-gradient-to-r from-primary to-accent rounded-full"
                  initial={{ width: 0 }} animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.4 }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Action button */}
        <button onClick={startBackup} disabled={running || selected.size === 0}
          className="w-full flex items-center justify-center gap-3 py-4 rounded-xl bg-gradient-to-r from-primary to-accent neural-border transition-all active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed shadow-lg shadow-primary/20">
          {running ? (
            <>
              <Loader2 className="w-5 h-5 text-primary-foreground animate-spin" />
              <span className="text-sm font-bold text-primary-foreground">Generating backup...</span>
            </>
          ) : (
            <>
              <Sparkles className="w-5 h-5 text-primary-foreground" />
              <span className="text-sm font-bold text-primary-foreground">
                Generate {selected.size === tables.length ? "Full" : `${selected.size}-table`} Backup
              </span>
            </>
          )}
        </button>

        {latest?.status === "completed" && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
              <div className="min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">
                  {latest.completed_tables}/{latest.total_tables} tables · {latest.total_rows.toLocaleString()} rows · {fmtBytes(latest.size_bytes)}
                </p>
                <p className="text-[10px] text-muted-foreground">Generated in {fmtMs(latest.duration_ms)}</p>
              </div>
            </div>
            <button onClick={() => downloadRun(latest)}
              className="px-3 py-1.5 rounded-lg bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 text-[11px] font-semibold flex items-center gap-1">
              <Download className="w-3 h-3" /> Re-download
            </button>
          </motion.div>
        )}
      </motion.div>

      {/* Table picker */}
      <div className="glass rounded-2xl neural-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-primary" />
            <h4 className="text-sm font-bold text-foreground">Tables</h4>
            <span className="text-[10px] text-muted-foreground">({selected.size}/{tables.length})</span>
          </div>
          <div className="flex gap-1.5">
            <button onClick={() => toggleAll(true)}
              className="px-2.5 py-1 rounded-lg bg-secondary/40 hover:bg-secondary/60 text-[10px] font-medium text-foreground">
              All
            </button>
            <button onClick={() => toggleAll(false)}
              className="px-2.5 py-1 rounded-lg bg-secondary/40 hover:bg-secondary/60 text-[10px] font-medium text-foreground">
              None
            </button>
          </div>
        </div>
        <input value={filter} onChange={(e) => setFilter(e.target.value)}
          placeholder="Search tables..."
          className="w-full mb-3 px-3 py-2 rounded-lg bg-secondary/30 neural-border text-xs text-foreground placeholder:text-muted-foreground outline-none focus:ring-1 focus:ring-primary/40" />
        <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 max-h-64 overflow-y-auto pr-1">
          {filtered.map((t) => {
            const on = selected.has(t);
            return (
              <button key={t} onClick={() => toggle(t)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] text-left truncate transition-all ${
                  on ? "bg-primary/15 text-foreground ring-1 ring-primary/30" : "bg-secondary/20 text-muted-foreground hover:bg-secondary/40"
                }`}>
                {on ? "✓ " : ""}{t}
              </button>
            );
          })}
          {filtered.length === 0 && <p className="text-[10px] text-muted-foreground col-span-full text-center py-4">No matches</p>}
        </div>
      </div>

      {/* History */}
      <div className="glass rounded-2xl neural-border p-5">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-accent" />
            <h4 className="text-sm font-bold text-foreground">Backup History</h4>
            <span className="text-[10px] text-muted-foreground">(last 20 · auto-expire 7d)</span>
          </div>
          <button onClick={loadAll} className="p-1.5 rounded-lg bg-secondary/40 hover:bg-secondary/60">
            <RefreshCw className="w-3 h-3 text-foreground" />
          </button>
        </div>

        {runs.length === 0 ? (
          <div className="text-center py-8">
            <FileText className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
            <p className="text-xs text-muted-foreground">No backups yet — generate your first one above.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {runs.map((r) => {
              const failedCount = r.failed_tables?.length || 0;
              return (
                <div key={r.id} className="p-3 rounded-xl bg-secondary/20 neural-border flex items-center gap-3">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    r.status === "completed" ? "bg-emerald-500/15"
                    : r.status === "failed" ? "bg-destructive/15"
                    : "bg-warning/15"
                  }`}>
                    {r.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                      : r.status === "failed" ? <AlertTriangle className="w-4 h-4 text-destructive" />
                      : <Loader2 className="w-4 h-4 text-warning animate-spin" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground truncate">
                      {format(new Date(r.started_at), "MMM dd, HH:mm:ss")} · {r.format.toUpperCase()} · {r.scope}
                    </p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {r.completed_tables}/{r.total_tables} tables · {r.total_rows.toLocaleString()} rows · {fmtBytes(r.size_bytes)} · {fmtMs(r.duration_ms)}
                      {failedCount > 0 && <span className="text-destructive"> · {failedCount} failed</span>}
                    </p>
                  </div>
                  {r.status === "completed" && (
                    <button onClick={() => downloadRun(r)}
                      className="p-1.5 rounded-lg bg-primary/15 hover:bg-primary/25 text-primary">
                      <Download className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button onClick={() => deleteRun(r)}
                    className="p-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/20 text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
