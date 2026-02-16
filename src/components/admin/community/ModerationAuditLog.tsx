import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  FileText, Loader2, RefreshCw, Search, Shield, Filter
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";

interface AuditEntry {
  id: string;
  user_id: string;
  action_type: string;
  reason: string | null;
  is_automatic: boolean;
  is_active: boolean;
  created_at: string;
  created_by: string | null;
  display_name?: string;
  admin_name?: string;
}

const ModerationAuditLog = () => {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [sourceFilter, setSourceFilter] = useState<"all" | "auto" | "manual">("all");

  const fetchEntries = async () => {
    setLoading(true);
    let q = (supabase as any).from("moderation_actions").select("*").order("created_at", { ascending: false }).limit(200);
    if (typeFilter !== "all") q = q.eq("action_type", typeFilter);
    if (sourceFilter === "auto") q = q.eq("is_automatic", true);
    if (sourceFilter === "manual") q = q.eq("is_automatic", false);
    const { data } = await q;

    const allData = data || [];
    const userIds = [...new Set(allData.map((e: any) => e.user_id).filter(Boolean))];
    const adminIds = [...new Set(allData.map((e: any) => e.created_by).filter(Boolean))];
    const allIds = [...new Set([...userIds, ...adminIds])] as string[];

    let nameMap: Record<string, string> = {};
    if (allIds.length > 0) {
      const { data: profiles } = await supabase.from("profiles").select("id, display_name").in("id", allIds);
      (profiles || []).forEach((p: any) => { nameMap[p.id] = p.display_name || "Unknown"; });
    }

    setEntries(allData.map((e: any) => ({
      ...e,
      display_name: nameMap[e.user_id] || e.user_id?.slice(0, 8) || "Unknown",
      admin_name: e.created_by ? (nameMap[e.created_by] || "Admin") : "System",
    })));
    setLoading(false);
  };

  useEffect(() => { fetchEntries(); }, [typeFilter, sourceFilter]);

  const actionTypes = ["warning", "post_restriction", "temporary_ban", "community_ban", "account_suspension"];

  const getActionColor = (type: string) => {
    if (type === "warning") return "bg-warning/15 text-warning";
    if (type === "post_restriction") return "bg-orange-500/15 text-orange-400";
    return "bg-destructive/15 text-destructive";
  };

  const filtered = entries.filter(e =>
    (e.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.reason || "").toLowerCase().includes(search.toLowerCase()) ||
    (e.admin_name || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <FileText className="w-5 h-5 text-primary" /> Moderation Audit Log
        </h3>
        <button onClick={fetchEntries} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      {/* Filters */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search logs..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
        </div>
        <select value={typeFilter} onChange={e => setTypeFilter(e.target.value)}
          className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground">
          <option value="all">All Types</option>
          {actionTypes.map(t => <option key={t} value={t}>{t.replace(/_/g, " ")}</option>)}
        </select>
        <select value={sourceFilter} onChange={e => setSourceFilter(e.target.value as any)}
          className="px-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground">
          <option value="all">All Sources</option>
          <option value="auto">🤖 Automatic</option>
          <option value="manual">👤 Manual</option>
        </select>
      </div>

      {/* Summary */}
      <div className="flex gap-3 flex-wrap">
        <span className="text-xs text-muted-foreground">{filtered.length} entries</span>
        <span className="text-xs text-muted-foreground">
          🤖 {filtered.filter(e => e.is_automatic).length} auto • 👤 {filtered.filter(e => !e.is_automatic).length} manual
        </span>
      </div>

      {/* Log List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-success/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No moderation actions recorded</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {filtered.map(e => (
            <div key={e.id} className="glass rounded-lg p-3 neural-border flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center shrink-0 text-xs">
                {e.is_automatic ? "🤖" : "👤"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${getActionColor(e.action_type)}`}>
                    {e.action_type.replace(/_/g, " ")}
                  </span>
                  {!e.is_active && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">Resolved</span>}
                </div>
                <p className="text-xs text-foreground mt-0.5">
                  <span className="font-medium">{e.display_name}</span>
                  {e.reason && <span className="text-muted-foreground"> — {e.reason}</span>}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  By: {e.admin_name} • {format(new Date(e.created_at), "MMM dd, yyyy HH:mm")}
                  {" • "}{formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModerationAuditLog;
