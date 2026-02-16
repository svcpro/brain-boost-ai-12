import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import {
  UserX, Loader2, RefreshCw, Search, Shield, AlertTriangle,
  Ban, Check, Eye, ChevronDown, ChevronUp
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface ModerationProfile {
  id: string;
  user_id: string;
  total_warnings: number;
  total_flags: number;
  total_violations: number;
  current_penalty: string | null;
  is_restricted: boolean;
  is_banned: boolean;
  last_violation_at: string | null;
  display_name?: string;
}

interface ModerationAction {
  id: string;
  action_type: string;
  reason: string | null;
  is_automatic: boolean;
  is_active: boolean;
  created_at: string;
}

const UserModerationPanel = () => {
  const { toast } = useToast();
  const [profiles, setProfiles] = useState<ModerationProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedUser, setExpandedUser] = useState<string | null>(null);
  const [userActions, setUserActions] = useState<ModerationAction[]>([]);
  const [actionsLoading, setActionsLoading] = useState(false);

  const fetchProfiles = async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("user_moderation_profiles").select("*").order("total_violations", { ascending: false }).limit(100);
    
    // Fetch display names
    const userIds = (data || []).map((p: any) => p.user_id);
    let names: Record<string, string> = {};
    if (userIds.length > 0) {
      const { data: profilesData } = await supabase.from("profiles").select("id, display_name").in("id", userIds);
      (profilesData || []).forEach((p: any) => { names[p.id] = p.display_name; });
    }

    setProfiles((data || []).map((p: any) => ({ ...p, display_name: names[p.user_id] || "Unknown" })));
    setLoading(false);
  };

  useEffect(() => { fetchProfiles(); }, []);

  const fetchUserActions = async (userId: string) => {
    setActionsLoading(true);
    const { data } = await (supabase as any).from("moderation_actions").select("*").eq("user_id", userId).order("created_at", { ascending: false }).limit(50);
    setUserActions(data || []);
    setActionsLoading(false);
  };

  const toggleExpand = (userId: string) => {
    if (expandedUser === userId) {
      setExpandedUser(null);
    } else {
      setExpandedUser(userId);
      fetchUserActions(userId);
    }
  };

  const banUser = async (userId: string) => {
    if (!confirm("Ban this user from all communities?")) return;
    await (supabase as any).from("user_moderation_profiles").update({
      is_banned: true, current_penalty: "account_suspension", updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    await (supabase as any).from("moderation_actions").insert({
      user_id: userId, action_type: "account_suspension", reason: "Manual ban by admin", is_automatic: false,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    await supabase.from("notification_history").insert({
      user_id: userId, title: "🚫 Account Suspended",
      body: "Your account has been suspended due to community guideline violations.", type: "moderation_penalty",
    });
    toast({ title: "User banned" });
    fetchProfiles();
  };

  const restrictUser = async (userId: string) => {
    await (supabase as any).from("user_moderation_profiles").update({
      is_restricted: true, current_penalty: "post_restriction", updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    await (supabase as any).from("moderation_actions").insert({
      user_id: userId, action_type: "post_restriction", reason: "Manual restriction by admin", is_automatic: false,
      created_by: (await supabase.auth.getUser()).data.user?.id,
    });
    toast({ title: "User restricted" });
    fetchProfiles();
  };

  const removePenalties = async (userId: string) => {
    await (supabase as any).from("user_moderation_profiles").update({
      is_restricted: false, is_banned: false, current_penalty: null, updated_at: new Date().toISOString(),
    }).eq("user_id", userId);
    await (supabase as any).from("moderation_actions").update({ is_active: false }).eq("user_id", userId).eq("is_active", true);
    toast({ title: "All penalties removed ✅" });
    fetchProfiles();
  };

  const filtered = profiles.filter(p =>
    (p.display_name || "").toLowerCase().includes(search.toLowerCase()) ||
    p.user_id.includes(search)
  );

  const getPenaltyBadge = (penalty: string | null) => {
    if (!penalty) return null;
    const colors: Record<string, string> = {
      warning: "bg-warning/15 text-warning",
      post_restriction: "bg-orange-500/15 text-orange-400",
      temporary_ban: "bg-destructive/15 text-destructive",
      community_ban: "bg-destructive/15 text-destructive",
      account_suspension: "bg-destructive/20 text-destructive",
    };
    return <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${colors[penalty] || "bg-muted text-muted-foreground"}`}>{penalty.replace(/_/g, " ")}</span>;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold text-foreground">User Moderation</h3>
        <button onClick={fetchProfiles} className="p-2 hover:bg-secondary rounded-lg"><RefreshCw className="w-4 h-4 text-muted-foreground" /></button>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary/50 border border-border text-sm text-foreground" />
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <Shield className="w-12 h-12 text-success/50 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No moderation profiles</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map(p => (
            <div key={p.id} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${p.is_banned ? "bg-destructive/15" : p.is_restricted ? "bg-warning/15" : "bg-secondary"}`}>
                  <UserX className={`w-5 h-5 ${p.is_banned ? "text-destructive" : p.is_restricted ? "text-warning" : "text-muted-foreground"}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground">{p.display_name}</p>
                    {p.is_banned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">BANNED</span>}
                    {p.is_restricted && !p.is_banned && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">RESTRICTED</span>}
                    {getPenaltyBadge(p.current_penalty)}
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    ⚠️ {p.total_warnings} warnings • 🚩 {p.total_flags} flags • ❌ {p.total_violations} violations
                    {p.last_violation_at && ` • Last: ${formatDistanceToNow(new Date(p.last_violation_at), { addSuffix: true })}`}
                  </p>
                </div>
                <div className="flex gap-1 shrink-0">
                  <button onClick={() => toggleExpand(p.user_id)} className="p-1.5 bg-secondary text-muted-foreground rounded-lg hover:bg-secondary/80">
                    {expandedUser === p.user_id ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                  {!p.is_restricted && !p.is_banned && (
                    <button onClick={() => restrictUser(p.user_id)} className="p-1.5 bg-warning/10 text-warning rounded-lg hover:bg-warning/20" title="Restrict">
                      <AlertTriangle className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {!p.is_banned && (
                    <button onClick={() => banUser(p.user_id)} className="p-1.5 bg-destructive/10 text-destructive rounded-lg hover:bg-destructive/20" title="Ban">
                      <Ban className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {(p.is_restricted || p.is_banned) && (
                    <button onClick={() => removePenalties(p.user_id)} className="p-1.5 bg-success/10 text-success rounded-lg hover:bg-success/20" title="Remove penalties">
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>

              {/* Expanded: action history */}
              {expandedUser === p.user_id && (
                <div className="mt-3 p-3 rounded-lg bg-secondary/30 space-y-2">
                  <p className="text-xs font-semibold text-foreground">Action History</p>
                  {actionsLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                  ) : userActions.length === 0 ? (
                    <p className="text-[11px] text-muted-foreground">No actions recorded</p>
                  ) : (
                    userActions.map(a => (
                      <div key={a.id} className="flex items-center gap-2 py-1 border-b border-border/30 last:border-0">
                        <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-medium ${
                          a.action_type === "warning" ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                        }`}>{a.action_type.replace(/_/g, " ")}</span>
                        <span className="text-[10px] text-foreground/70 flex-1 truncate">{a.reason}</span>
                        <span className="text-[9px] text-muted-foreground shrink-0">
                          {a.is_automatic ? "🤖" : "👤"} {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default UserModerationPanel;
