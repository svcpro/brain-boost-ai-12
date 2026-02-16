import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Activity, Loader2, AlertTriangle, Shield, Ban, Eye } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface StreamEvent {
  id: string;
  type: "flag" | "action";
  subtype: string;
  user_id: string;
  details: string;
  severity: "low" | "medium" | "high";
  created_at: string;
}

const ModerationActivityStream = () => {
  const [events, setEvents] = useState<StreamEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [live, setLive] = useState(true);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchRecent = async () => {
    const [flagsRes, actionsRes] = await Promise.all([
      (supabase as any).from("content_flags").select("id, risk_level, categories, status, auto_hidden, created_at, user_id")
        .order("created_at", { ascending: false }).limit(30),
      (supabase as any).from("moderation_actions").select("id, action_type, reason, is_automatic, created_at, user_id")
        .order("created_at", { ascending: false }).limit(30),
    ]);

    const flagEvents: StreamEvent[] = (flagsRes.data || []).map((f: any) => ({
      id: `flag-${f.id}`,
      type: "flag" as const,
      subtype: f.risk_level,
      user_id: f.user_id,
      details: `${f.risk_level} risk flag (${(f.categories || []).join(", ")}) — ${f.status}${f.auto_hidden ? " [auto-hidden]" : ""}`,
      severity: f.risk_level as "low" | "medium" | "high",
      created_at: f.created_at,
    }));

    const actionEvents: StreamEvent[] = (actionsRes.data || []).map((a: any) => ({
      id: `action-${a.id}`,
      type: "action" as const,
      subtype: a.action_type,
      user_id: a.user_id,
      details: `${a.is_automatic ? "🤖" : "👤"} ${a.action_type.replace(/_/g, " ")}${a.reason ? `: ${a.reason}` : ""}`,
      severity: ["temporary_ban", "community_ban", "account_suspension"].includes(a.action_type) ? "high" as const : a.action_type === "warning" ? "medium" as const : "low" as const,
      created_at: a.created_at,
    }));

    const all = [...flagEvents, ...actionEvents].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).slice(0, 50);
    setEvents(all);
    setLoading(false);
  };

  useEffect(() => {
    fetchRecent();
    if (live) {
      intervalRef.current = setInterval(fetchRecent, 15000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [live]);

  const getIcon = (e: StreamEvent) => {
    if (e.type === "flag") return e.severity === "high" ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> : <Eye className="w-3.5 h-3.5 text-warning" />;
    if (["temporary_ban", "community_ban", "account_suspension"].includes(e.subtype)) return <Ban className="w-3.5 h-3.5 text-destructive" />;
    return <Shield className="w-3.5 h-3.5 text-warning" />;
  };

  const getSeverityColor = (s: string) => {
    if (s === "high") return "border-l-destructive";
    if (s === "medium") return "border-l-warning";
    return "border-l-muted-foreground";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Activity className="w-5 h-5 text-primary" /> Live Activity
        </h3>
        <button onClick={() => setLive(!live)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 ${live ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
          <span className={`w-2 h-2 rounded-full ${live ? "bg-success animate-pulse" : "bg-muted-foreground"}`} />
          {live ? "Live" : "Paused"}
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : events.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-success/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No recent moderation activity</p>
        </div>
      ) : (
        <div className="space-y-1">
          {events.map(e => (
            <div key={e.id} className={`rounded-lg p-2.5 bg-secondary/30 border-l-2 ${getSeverityColor(e.severity)} flex items-start gap-2.5`}>
              <div className="mt-0.5 shrink-0">{getIcon(e)}</div>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground line-clamp-2">{e.details}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  User: {e.user_id.slice(0, 8)}… • {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default ModerationActivityStream;
