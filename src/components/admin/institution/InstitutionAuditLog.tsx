import { useState, useEffect } from "react";
import {
  ScrollText, Loader2, Search, Users, Shield, Settings, Key
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface AuditLog {
  id: string;
  institution_id: string;
  actor_user_id: string;
  action: string;
  target_type: string;
  target_id: string | null;
  details: any;
  ip_address: string | null;
  created_at: string;
}

interface Props {
  institutionId: string;
  institutionName: string;
}

const ACTION_ICONS: Record<string, any> = {
  login: Users,
  create: Settings,
  update: Settings,
  delete: Shield,
  api_access: Key,
};

export default function InstitutionAuditLog({ institutionId, institutionName }: Props) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => { loadLogs(); }, [institutionId]);

  const loadLogs = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("institution_audit_logs")
      .select("*")
      .eq("institution_id", institutionId)
      .order("created_at", { ascending: false })
      .limit(100);
    setLogs((data as any[]) || []);
    setLoading(false);
  };

  const filtered = logs.filter(l =>
    l.action.toLowerCase().includes(search.toLowerCase()) ||
    l.target_type.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-warning/20 flex items-center justify-center">
          <ScrollText className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Audit Logs</h3>
          <p className="text-[10px] text-muted-foreground">{institutionName} • Security trail</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search actions..." className="w-full bg-secondary/60 border border-border/50 rounded-lg pl-9 pr-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/40" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <ScrollText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No audit logs</p>
        </div>
      ) : (
        <div className="space-y-1 max-h-96 overflow-y-auto">
          {filtered.map(log => {
            const Icon = ACTION_ICONS[log.action] || Settings;
            return (
              <div key={log.id} className="flex items-start gap-3 p-2.5 rounded-lg bg-secondary/20 hover:bg-secondary/30 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center shrink-0 mt-0.5">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground capitalize">{log.action}</span>
                    <span className="text-[10px] text-muted-foreground">on {log.target_type}</span>
                    {log.target_id && <span className="text-[10px] font-mono text-muted-foreground">{log.target_id.slice(0, 8)}...</span>}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                    <span>User: {log.actor_user_id.slice(0, 8)}...</span>
                    {log.ip_address && <span>IP: {log.ip_address}</span>}
                    <span>{format(new Date(log.created_at), "dd MMM HH:mm")}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
