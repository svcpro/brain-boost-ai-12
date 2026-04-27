import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import {
  Calendar, RefreshCw, X, Send, AlertTriangle, Clock, CheckCircle2,
  Loader2, Trash2, Activity,
} from "lucide-react";

type Item = {
  id: string;
  user_id: string;
  event_key: string;
  status: "pending" | "sent" | "failed" | "processing" | "cancelled";
  scheduled_for: string;
  attempts: number;
  last_error: string | null;
  sent_at: string | null;
  created_at: string;
  source: string;
  ist_hour: number;
  user_name: string | null;
  user_phone: string | null;
};

type Totals = Record<string, number>;

const STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  processing: "bg-blue-500/15 text-blue-300 border-blue-500/30",
  sent: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  cancelled: "bg-muted text-muted-foreground border-border",
};

function fmtIst(iso: string) {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }) + " IST";
}

const SmsScheduledQueue = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [buckets, setBuckets] = useState<Record<number, number>>({});
  const [totals, setTotals] = useState<Totals>({});
  const [status, setStatus] = useState<string>("all");
  const [windowH, setWindowH] = useState<string>("24");
  const [loading, setLoading] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke(
        `sms-scheduled-admin?action=list&status=${status}&window_hours=${windowH}&limit=200`,
        { method: "GET" },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setItems((data as any).items || []);
      setBuckets((data as any).buckets_ist || {});
      setTotals((data as any).totals || {});
    } catch (e: any) {
      toast.error(`Failed to load queue: ${e.message || e}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    const t = setInterval(load, 30_000); // auto-refresh every 30s
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status, windowH]);

  const cancel = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sms-scheduled-admin?action=cancel",
        { method: "POST", body: { id } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Cancelled");
      load();
    } catch (e: any) {
      toast.error(`Cancel failed: ${e.message || e}`);
    } finally {
      setBusyId(null);
    }
  };

  const resend = async (id: string) => {
    setBusyId(id);
    try {
      const { data, error } = await supabase.functions.invoke(
        "sms-scheduled-admin?action=resend",
        { method: "POST", body: { id } },
      );
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      toast.success("Re-queued — will send within 5 min");
      load();
    } catch (e: any) {
      toast.error(`Resend failed: ${e.message || e}`);
    } finally {
      setBusyId(null);
    }
  };

  const purge = async () => {
    if (!confirm("Purge sent/failed/cancelled rows older than 7 days?")) return;
    try {
      const { data, error } = await supabase.functions.invoke(
        "sms-scheduled-admin?action=purge_old",
        { method: "POST", body: { days: 7 } },
      );
      if (error) throw error;
      toast.success(`Purged ${(data as any).deleted || 0} rows`);
      load();
    } catch (e: any) {
      toast.error(`Purge failed: ${e.message || e}`);
    }
  };

  const maxBucket = useMemo(
    () => Math.max(1, ...Object.values(buckets)),
    [buckets],
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-violet-500/15 flex items-center justify-center">
            <Calendar className="h-5 w-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground">Scheduled SMS Queue</h3>
            <p className="text-xs text-muted-foreground">
              Upcoming AI-orchestrated sends · India Standard Time (IST)
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All status</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="processing">Processing</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
            </SelectContent>
          </Select>
          <Select value={windowH} onValueChange={setWindowH}>
            <SelectTrigger className="w-36 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="6">Next 6h</SelectItem>
              <SelectItem value="12">Next 12h</SelectItem>
              <SelectItem value="24">Next 24h</SelectItem>
              <SelectItem value="72">Next 3 days</SelectItem>
              <SelectItem value="168">Next 7 days</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} className="gap-2">
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button variant="outline" size="sm" onClick={purge} className="gap-2 text-red-300 hover:text-red-200">
            <Trash2 className="h-4 w-4" /> Purge old
          </Button>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Pending" value={totals.pending || 0} icon={<Clock className="h-4 w-4" />} tone="amber" />
        <StatCard label="Processing" value={totals.processing || 0} icon={<Loader2 className="h-4 w-4" />} tone="blue" />
        <StatCard label="Sent" value={totals.sent || 0} icon={<CheckCircle2 className="h-4 w-4" />} tone="emerald" />
        <StatCard label="Failed" value={totals.failed || 0} icon={<AlertTriangle className="h-4 w-4" />} tone="red" />
        <StatCard label="Cancelled" value={totals.cancelled || 0} icon={<X className="h-4 w-4" />} tone="muted" />
      </div>

      {/* IST hourly chart */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Activity className="h-4 w-4 text-violet-400" />
            Pending sends · next 24h by IST hour
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1 h-32">
            {Array.from({ length: 24 }).map((_, h) => {
              const count = buckets[h] || 0;
              const heightPct = (count / maxBucket) * 100;
              const isQuiet = h >= 22 || h < 8;
              return (
                <div key={h} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                  <div className="text-[10px] text-muted-foreground tabular-nums">
                    {count > 0 ? count : ""}
                  </div>
                  <div className="w-full h-full flex items-end">
                    <div
                      className={`w-full rounded-t transition-all ${
                        count === 0
                          ? "bg-muted/30"
                          : isQuiet
                            ? "bg-red-500/40"
                            : "bg-gradient-to-t from-violet-500/60 to-violet-400"
                      }`}
                      style={{ height: `${Math.max(heightPct, count > 0 ? 4 : 2)}%` }}
                      title={`${h.toString().padStart(2, "0")}:00 IST · ${count} pending${isQuiet ? " (quiet hours)" : ""}`}
                    />
                  </div>
                  <div className={`text-[10px] tabular-nums ${isQuiet ? "text-red-400/60" : "text-muted-foreground"}`}>
                    {h.toString().padStart(2, "0")}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-3 flex items-center gap-4 text-[11px] text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded bg-gradient-to-t from-violet-500/60 to-violet-400" />
              Active hours
            </span>
            <span className="flex items-center gap-1.5">
              <span className="h-2 w-3 rounded bg-red-500/40" />
              Quiet hours (22:00–08:00 IST)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Queue list */}
      <Card className="bg-card/50 border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-semibold">
            Queue ({items.length})
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {items.length === 0 ? (
            <div className="text-center py-12 text-sm text-muted-foreground">
              {loading ? "Loading…" : "No scheduled dispatches in this window."}
            </div>
          ) : (
            <div className="divide-y divide-border/50 max-h-[520px] overflow-y-auto">
              {items.map((it) => (
                <div key={it.id} className="px-4 py-3 hover:bg-muted/30 transition-colors">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className={`${STATUS_STYLES[it.status]} text-[10px] uppercase`}>
                          {it.status}
                        </Badge>
                        <span className="text-sm font-medium text-foreground truncate">
                          {it.event_key}
                        </span>
                        <Badge variant="outline" className="text-[10px] bg-muted/30">
                          IST {it.ist_hour.toString().padStart(2, "0")}:00
                        </Badge>
                        {it.attempts > 0 && (
                          <Badge variant="outline" className="text-[10px] bg-muted/30">
                            attempts: {it.attempts}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-1 text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                        <span>📅 {fmtIst(it.scheduled_for)}</span>
                        {it.user_name && <span>👤 {it.user_name}</span>}
                        {it.user_phone && <span className="font-mono">{it.user_phone}</span>}
                        <span className="opacity-60">via {it.source}</span>
                      </div>
                      {it.last_error && (
                        <div className="mt-1 text-xs text-red-400 truncate" title={it.last_error}>
                          ⚠ {it.last_error}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {(it.status === "pending" || it.status === "failed") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => resend(it.id)}
                          disabled={busyId === it.id}
                          className="h-8 gap-1.5 text-emerald-300 hover:text-emerald-200"
                        >
                          {busyId === it.id ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Send className="h-3.5 w-3.5" />
                          )}
                          Send now
                        </Button>
                      )}
                      {(it.status === "pending" || it.status === "failed") && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => cancel(it.id)}
                          disabled={busyId === it.id}
                          className="h-8 gap-1.5 text-red-300 hover:text-red-200"
                        >
                          <X className="h-3.5 w-3.5" />
                          Cancel
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

const StatCard = ({
  label, value, icon, tone,
}: {
  label: string; value: number; icon: React.ReactNode;
  tone: "amber" | "blue" | "emerald" | "red" | "muted";
}) => {
  const toneStyles: Record<string, string> = {
    amber: "bg-amber-500/10 text-amber-300 border-amber-500/30",
    blue: "bg-blue-500/10 text-blue-300 border-blue-500/30",
    emerald: "bg-emerald-500/10 text-emerald-300 border-emerald-500/30",
    red: "bg-red-500/10 text-red-300 border-red-500/30",
    muted: "bg-muted/30 text-muted-foreground border-border",
  };
  return (
    <div className={`rounded-xl border p-3 ${toneStyles[tone]}`}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide opacity-80">
        {icon}
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold tabular-nums">{value}</div>
    </div>
  );
};

export default SmsScheduledQueue;
