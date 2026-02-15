import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, Users, Brain, BookOpen, CreditCard,
  Bell, Shield, ScrollText, Settings, LogOut, ChevronRight,
  Loader2, AlertTriangle, Search, MoreVertical, Eye,
  Ban, Trash2, RefreshCw, Send, Clock, TrendingUp,
  Activity, Zap, Database, BarChart3, UserPlus, ChevronDown,
  CheckCircle2, XCircle, ArrowLeft, Home, User, Download, Upload
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useAdminRole, type AppRole } from "@/hooks/useAdminRole";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useNavigate } from "react-router-dom";

type AdminSection = "dashboard" | "users" | "ai" | "knowledge" | "subscriptions" | "notifications" | "admins" | "audit" | "settings";

const ROLE_LABELS: Record<AppRole, string> = {
  super_admin: "Super Admin",
  admin: "Admin",
  ai_admin: "AI Admin",
  support_admin: "Support",
  finance_admin: "Finance",
};

const ROLE_COLORS: Record<AppRole, string> = {
  super_admin: "bg-destructive/15 text-destructive",
  admin: "bg-primary/15 text-primary",
  ai_admin: "bg-accent/15 text-accent",
  support_admin: "bg-warning/15 text-warning",
  finance_admin: "bg-success/15 text-success",
};

const NAV_ITEMS: { key: AdminSection; label: string; icon: any; roles: AppRole[] }[] = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard, roles: ["super_admin", "admin", "ai_admin", "support_admin", "finance_admin"] },
  { key: "users", label: "Users", icon: Users, roles: ["super_admin", "admin", "support_admin"] },
  { key: "ai", label: "AI Models", icon: Brain, roles: ["super_admin", "admin", "ai_admin"] },
  { key: "knowledge", label: "Knowledge DB", icon: BookOpen, roles: ["super_admin", "admin"] },
  { key: "subscriptions", label: "Subscriptions", icon: CreditCard, roles: ["super_admin", "admin", "finance_admin"] },
  { key: "notifications", label: "Notifications", icon: Bell, roles: ["super_admin", "admin"] },
  { key: "admins", label: "Admin Roles", icon: Shield, roles: ["super_admin"] },
  { key: "audit", label: "Audit Logs", icon: ScrollText, roles: ["super_admin", "admin"] },
  { key: "settings", label: "Settings", icon: Settings, roles: ["super_admin"] },
];

const AdminPanel = () => {
  const { user, signOut } = useAuth();
  const { roles, isAdmin, isSuperAdmin, loading: roleLoading, hasAnyRole, refetch: refetchRoles } = useAdminRole();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [section, setSection] = useState<AdminSection>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);

  if (roleLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="glass rounded-2xl p-8 neural-border text-center max-w-sm">
          <AlertTriangle className="w-12 h-12 text-destructive mx-auto mb-4" />
          <h1 className="text-xl font-bold text-foreground mb-2">Access Denied</h1>
          <p className="text-sm text-muted-foreground mb-4">You don't have admin privileges.</p>
          <button onClick={() => navigate("/app")} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium">
            Back to App
          </button>
        </motion.div>
      </div>
    );
  }

  const visibleNavItems = NAV_ITEMS.filter(item => hasAnyRole(...item.roles));

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar */}
      <aside className="hidden md:flex w-64 flex-col bg-card border-r border-border p-4">
        <div className="flex items-center gap-2 mb-6 px-2">
          <Shield className="w-6 h-6 text-primary" />
          <h1 className="text-lg font-bold text-foreground">ACRY Admin</h1>
        </div>
        <nav className="flex-1 space-y-1">
          {visibleNavItems.map(item => (
            <button
              key={item.key}
              onClick={() => setSection(item.key)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                section === item.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
              }`}
            >
              <item.icon className="w-4 h-4" />
              {item.label}
            </button>
          ))}
        </nav>
        <div className="border-t border-border pt-4 mt-4 space-y-2">
          <div className="flex flex-wrap gap-1 px-2">
            {roles.map(r => (
              <span key={r} className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[r]}`}>
                {ROLE_LABELS[r]}
              </span>
            ))}
          </div>
          <button onClick={() => navigate("/app")} className="w-full flex items-center gap-2 px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
            <ArrowLeft className="w-4 h-4" />
            Back to App
          </button>
        </div>
      </aside>

      {/* Mobile header */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-50 bg-card border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1">
          <LayoutDashboard className="w-5 h-5 text-primary" />
        </button>
        <h1 className="text-sm font-bold text-foreground flex-1">ACRY Admin</h1>
        <button onClick={() => navigate("/app")} className="text-xs text-muted-foreground">← App</button>
      </div>

      {/* Mobile nav */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ x: -300 }}
            animate={{ x: 0 }}
            exit={{ x: -300 }}
            className="md:hidden fixed inset-0 z-40 bg-background/80 backdrop-blur-sm"
            onClick={() => setSidebarOpen(false)}
          >
            <motion.nav className="w-64 h-full bg-card border-r border-border p-4 space-y-1" onClick={e => e.stopPropagation()}>
              {visibleNavItems.map(item => (
                <button
                  key={item.key}
                  onClick={() => { setSection(item.key); setSidebarOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                    section === item.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </button>
              ))}
            </motion.nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main content */}
      <main className="flex-1 p-4 md:p-6 mt-14 md:mt-0 overflow-auto">
        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
            {section === "dashboard" && <DashboardSection />}
            {section === "users" && <UsersSection />}
            {section === "ai" && <AISection />}
            {section === "knowledge" && <KnowledgeSection />}
            {section === "subscriptions" && <SubscriptionsSection />}
            {section === "notifications" && <NotificationsSection toast={toast} />}
            {section === "admins" && <AdminsSection isSuperAdmin={isSuperAdmin} refetchRoles={refetchRoles} toast={toast} />}
            {section === "audit" && <AuditSection />}
            {section === "settings" && <SettingsSection toast={toast} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
};

// ─── Dashboard ───
const DashboardSection = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const today = new Date().toISOString().split("T")[0];
      const [usersRes, subsRes, logsRes, predsRes] = await Promise.all([
        supabase.from("profiles").select("id, created_at", { count: "exact" }),
        supabase.from("user_subscriptions").select("id, plan_id, amount, status"),
        supabase.from("study_logs").select("id, created_at").gte("created_at", today),
        supabase.from("model_predictions").select("id").gte("created_at", today),
      ]);
      const totalUsers = usersRes.count || 0;
      const activeSubs = (subsRes.data || []).filter(s => s.status === "active" && s.plan_id !== "free").length;
      const revenue = (subsRes.data || []).filter(s => s.status === "active").reduce((sum, s) => sum + (s.amount || 0), 0);
      const newToday = (usersRes.data || []).filter(u => u.created_at >= today).length;
      setStats({ totalUsers, activeSubs, revenue, newToday, studySessions: logsRes.data?.length || 0, predictions: predsRes.data?.length || 0 });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const cards = [
    { label: "Total Users", value: stats.totalUsers, icon: Users, color: "text-primary" },
    { label: "New Today", value: stats.newToday, icon: UserPlus, color: "text-success" },
    { label: "Active Subs", value: stats.activeSubs, icon: CreditCard, color: "text-accent" },
    { label: "Revenue", value: `₹${(stats.revenue / 100).toLocaleString()}`, icon: TrendingUp, color: "text-warning" },
    { label: "Study Sessions", value: stats.studySessions, icon: Activity, color: "text-primary" },
    { label: "AI Predictions", value: stats.predictions, icon: Zap, color: "text-accent" },
  ];

  return (
    <div className="space-y-6">
      <h2 className="text-xl font-bold text-foreground">Dashboard</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {cards.map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-xs text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{c.value}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

// ─── Users ───
const UsersSection = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("profiles").select("id, display_name, exam_type, created_at, daily_study_goal_minutes").order("created_at", { ascending: false }).limit(100);
      setUsers(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = users.filter(u => (u.display_name || "").toLowerCase().includes(search.toLowerCase()) || u.id.includes(search));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">User Management</h2>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..." className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none" />
      </div>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(u => (
            <div key={u.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-primary/15 flex items-center justify-center">
                <span className="text-xs font-bold text-primary">{(u.display_name || "?")[0].toUpperCase()}</span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{u.display_name || "Anonymous"}</p>
                <p className="text-[10px] text-muted-foreground">{u.exam_type || "No exam"} · Goal: {u.daily_study_goal_minutes}min</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(u.created_at).toLocaleDateString()}</span>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users found</p>}
        </div>
      )}
    </div>
  );
};

// ─── AI Models ───
const AISection = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [predictions, setPredictions] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [logsRes, predsRes] = await Promise.all([
        supabase.from("ml_training_logs").select("*").order("started_at", { ascending: false }).limit(20),
        supabase.from("model_metrics").select("*").order("created_at", { ascending: false }).limit(20),
      ]);
      setLogs(logsRes.data || []);
      setPredictions(predsRes.data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">AI Model Management</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Training Logs</h3>
            {logs.map(l => (
              <div key={l.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
                {l.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-success" /> : l.status === "failed" ? <XCircle className="w-4 h-4 text-destructive" /> : <Loader2 className="w-4 h-4 text-primary animate-spin" />}
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{l.model_name} <span className="text-muted-foreground">v{l.model_version}</span></p>
                  <p className="text-[10px] text-muted-foreground">{l.training_type} · {l.training_data_size || 0} samples</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(l.started_at).toLocaleString()}</span>
              </div>
            ))}
            {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No training logs yet</p>}
          </div>
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-foreground">Model Metrics</h3>
            {predictions.map(m => (
              <div key={m.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
                <BarChart3 className="w-4 h-4 text-accent" />
                <div className="flex-1">
                  <p className="text-sm font-medium text-foreground">{m.model_name}: {m.metric_type}</p>
                  <p className="text-[10px] text-muted-foreground">Value: {m.metric_value} · Samples: {m.sample_size}</p>
                </div>
              </div>
            ))}
            {predictions.length === 0 && <p className="text-sm text-muted-foreground text-center py-4">No metrics yet</p>}
          </div>
        </>
      )}
    </div>
  );
};

// ─── Knowledge DB ───
const KnowledgeSection = () => {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("subjects").select("id, name, created_at").is("deleted_at", null).order("name").limit(200);
      setSubjects(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Knowledge Database</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {subjects.map(s => (
            <div key={s.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <BookOpen className="w-4 h-4 text-primary" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.name}</p>
                <p className="text-[10px] text-muted-foreground">Created: {new Date(s.created_at).toLocaleDateString()}</p>
              </div>
            </div>
          ))}
          {subjects.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No subjects in database</p>}
        </div>
      )}
    </div>
  );
};

// ─── Subscriptions ───
const SubscriptionsSection = () => {
  const [subs, setSubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false }).limit(100);
      setSubs(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Subscription Management</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {subs.map(s => (
            <div key={s.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <CreditCard className={`w-4 h-4 ${s.status === "active" ? "text-success" : "text-muted-foreground"}`} />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{s.plan_id} <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${s.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>{s.status}</span></p>
                <p className="text-[10px] text-muted-foreground">{s.amount ? `₹${(s.amount / 100).toFixed(0)}` : "Free"} · {s.expires_at ? `Expires: ${new Date(s.expires_at).toLocaleDateString()}` : "No expiry"}</p>
              </div>
            </div>
          ))}
          {subs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No subscriptions found</p>}
        </div>
      )}
    </div>
  );
};

// ─── Notifications ───
const NotificationsSection = ({ toast }: { toast: any }) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);

  const sendGlobal = async () => {
    if (!title.trim()) return;
    setSending(true);
    try {
      // Insert notification for all users
      const { data: profiles } = await supabase.from("profiles").select("id");
      if (profiles && profiles.length > 0) {
        const notifications = profiles.map(p => ({
          user_id: p.id,
          title: title.trim(),
          body: body.trim() || null,
          type: "admin_broadcast",
        }));
        // Batch insert in chunks
        for (let i = 0; i < notifications.length; i += 50) {
          await supabase.from("notification_history").insert(notifications.slice(i, i + 50));
        }
      }
      toast({ title: "✅ Sent", description: `Notification sent to ${profiles?.length || 0} users` });
      setTitle("");
      setBody("");
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="space-y-4 max-w-lg">
      <h2 className="text-xl font-bold text-foreground">Send Notification</h2>
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Notification title..." className="w-full px-3 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none" />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Optional body message..." rows={3} className="w-full px-3 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none resize-none" />
        <button onClick={sendGlobal} disabled={!title.trim() || sending} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-all">
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
          Send to All Users
        </button>
      </div>
    </div>
  );
};

// ─── Admin Roles ───
const AdminsSection = ({ isSuperAdmin, refetchRoles, toast }: { isSuperAdmin: boolean; refetchRoles: () => Promise<void>; toast: any }) => {
  const [admins, setAdmins] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newEmail, setNewEmail] = useState("");
  const [newRole, setNewRole] = useState<AppRole>("admin");
  const [adding, setAdding] = useState(false);

  const fetchAdmins = useCallback(async () => {
    const { data } = await supabase.from("user_roles").select("*").order("created_at", { ascending: false });
    setAdmins(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const addAdmin = async () => {
    if (!newEmail.trim()) return;
    setAdding(true);
    try {
      // Look up user by email from profiles — we can't query auth.users directly
      // Instead, we look up all profiles and match. For a real system you'd use an edge function.
      // For now, we'll let the super admin paste a user_id
      const userId = newEmail.trim();
      await supabase.from("user_roles").insert({ user_id: userId, role: newRole });
      await supabase.from("admin_audit_logs").insert({ admin_id: userId, action: "role_assigned", target_type: "user_roles", target_id: userId, details: { role: newRole } });
      toast({ title: "✅ Role assigned" });
      setNewEmail("");
      fetchAdmins();
      refetchRoles();
    } catch (e: any) {
      toast({ title: "Failed", description: e.message, variant: "destructive" });
    } finally {
      setAdding(false);
    }
  };

  const removeAdmin = async (id: string) => {
    await supabase.from("user_roles").delete().eq("id", id);
    toast({ title: "Role removed" });
    fetchAdmins();
    refetchRoles();
  };

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Admin Role Management</h2>
      {isSuperAdmin && (
        <div className="glass rounded-xl p-4 neural-border space-y-3">
          <p className="text-sm font-medium text-foreground">Add Admin Role</p>
          <input value={newEmail} onChange={e => setNewEmail(e.target.value)} placeholder="User ID..." className="w-full px-3 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none" />
          <div className="flex gap-2 flex-wrap">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map(r => (
              <button key={r} onClick={() => setNewRole(r)} className={`text-xs px-3 py-1.5 rounded-lg border transition-colors ${newRole === r ? "border-primary bg-primary/15 text-primary" : "border-border text-muted-foreground hover:text-foreground"}`}>
                {ROLE_LABELS[r]}
              </button>
            ))}
          </div>
          <button onClick={addAdmin} disabled={!newEmail.trim() || adding} className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
            {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
            Assign Role
          </button>
        </div>
      )}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {admins.map(a => (
            <div key={a.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <Shield className="w-4 h-4 text-primary" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{a.user_id}</p>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${ROLE_COLORS[a.role as AppRole] || "bg-muted text-muted-foreground"}`}>
                  {ROLE_LABELS[a.role as AppRole] || a.role}
                </span>
              </div>
              {isSuperAdmin && (
                <button onClick={() => removeAdmin(a.id)} className="p-1.5 hover:bg-destructive/15 rounded-lg transition-colors">
                  <Trash2 className="w-3.5 h-3.5 text-destructive" />
                </button>
              )}
            </div>
          ))}
          {admins.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No admin roles assigned</p>}
        </div>
      )}
    </div>
  );
};

// ─── Audit Logs ───
const AuditSection = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("admin_audit_logs").select("*").order("created_at", { ascending: false }).limit(50);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold text-foreground">Audit Logs</h2>
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {logs.map(l => (
            <div key={l.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
              <ScrollText className="w-4 h-4 text-muted-foreground" />
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">{l.action}</p>
                <p className="text-[10px] text-muted-foreground">{l.target_type} · {l.target_id || "N/A"}</p>
              </div>
              <span className="text-[10px] text-muted-foreground">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
          {logs.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No audit logs yet</p>}
        </div>
      )}
    </div>
  );
};

// ─── Settings (Feature Flags) ───
const TAB_GROUPS = [
  { key: "tab_home", label: "Home Tab", icon: Home, prefix: "home_" },
  { key: "tab_action", label: "Action Tab", icon: Zap, prefix: "action_" },
  { key: "tab_brain", label: "Brain Tab", icon: Brain, prefix: "brain_" },
  { key: "tab_progress", label: "Progress Tab", icon: TrendingUp, prefix: "progress_" },
  { key: "tab_you", label: "You Tab", icon: User, prefix: "you_" },
];

const SettingsSection = ({ toast }: { toast: any }) => {
  const [flags, setFlags] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedTab, setExpandedTab] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [confirmReset, setConfirmReset] = useState(false);
  const [importDiff, setImportDiff] = useState<{ flag_key: string; label: string; from: boolean; to: boolean }[] | null>(null);
  const [pendingImport, setPendingImport] = useState<{ flag_key: string; enabled: boolean }[] | null>(null);
  const [lastToggle, setLastToggle] = useState<{ key: string; previousEnabled: boolean } | null>(null);
  const [changelog, setChangelog] = useState<any[]>([]);
  const [showChangelog, setShowChangelog] = useState(false);
  const [changelogHasMore, setChangelogHasMore] = useState(true);
  const [changelogFilter, setChangelogFilter] = useState<"all" | "enabled" | "disabled">("all");
  const [changelogLoading, setChangelogLoading] = useState(false);
  const CHANGELOG_PAGE_SIZE = 20;
  const nameMapRef = useRef(new Map<string, string>());

  const fetchChangelog = useCallback(async (offset = 0, append = false) => {
    setChangelogLoading(true);
    const { data } = await supabase
      .from("admin_audit_logs")
      .select("*")
      .eq("target_type", "feature_flags")
      .order("created_at", { ascending: false })
      .range(offset, offset + CHANGELOG_PAGE_SIZE - 1);
    if (!data) { setChangelogLoading(false); return; }
    // Fetch any new admin names
    const newIds = data.map(d => d.admin_id).filter(id => !nameMapRef.current.has(id));
    if (newIds.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name")
        .in("id", [...new Set(newIds)]);
      (profiles || []).forEach(p => nameMapRef.current.set(p.id, p.display_name || "Admin"));
    }
    const mapped = data.map(d => ({ ...d, admin_name: nameMapRef.current.get(d.admin_id) || "Unknown" }));
    setChangelog(prev => append ? [...prev, ...mapped] : mapped);
    setChangelogHasMore(data.length === CHANGELOG_PAGE_SIZE);
    setChangelogLoading(false);
  }, []);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("feature_flags").select("*").order("flag_key");
      setFlags((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  // Ctrl+Z undo last toggle
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "z" && lastToggle) {
        e.preventDefault();
        toggleFlag(lastToggle.key, lastToggle.previousEnabled, true);
        setLastToggle(null);
        toast({ title: "↩️ Last toggle undone" });
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [lastToggle]);

  const toggleFlag = async (key: string, enabled: boolean, isUndo = false) => {
    if (!isUndo) {
      const prev = flags.find(f => f.flag_key === key);
      if (prev) setLastToggle({ key, previousEnabled: prev.enabled });
    }
    await supabase
      .from("feature_flags")
      .update({ enabled, updated_at: new Date().toISOString() } as any)
      .eq("flag_key", key);
    setFlags(prev => prev.map(f => f.flag_key === key ? { ...f, enabled } : f));
    await supabase.from("admin_audit_logs").insert({
      admin_id: (await supabase.auth.getUser()).data.user?.id,
      action: enabled ? "feature_enabled" : "feature_disabled",
      target_type: "feature_flags",
      target_id: key,
      details: { flag_key: key, enabled },
    } as any);
    if (!isUndo) toast({ title: enabled ? "✅ Enabled" : "🚫 Disabled", description: (flags.find(f => f.flag_key === key)?.label || key) });
    if (showChangelog) fetchChangelog();
  };

  // Bulk toggle all section flags under a tab
  const toggleAllSections = async (prefix: string, enabled: boolean) => {
    const sectionFlags = flags.filter(f => f.flag_key.startsWith(prefix));
    for (const f of sectionFlags) {
      await supabase.from("feature_flags").update({ enabled, updated_at: new Date().toISOString() } as any).eq("flag_key", f.flag_key);
    }
    setFlags(prev => prev.map(f => f.flag_key.startsWith(prefix) ? { ...f, enabled } : f));
    toast({ title: enabled ? "✅ All sections enabled" : "🚫 All sections disabled" });
  };

  const resetAllFlags = async () => {
    const disabledFlags = flags.filter(f => !f.enabled);
    if (disabledFlags.length === 0) {
      toast({ title: "All flags are already enabled" });
      return;
    }
    const previousStates = disabledFlags.map(f => ({ key: f.flag_key, enabled: f.enabled }));
    for (const f of disabledFlags) {
      await supabase.from("feature_flags").update({ enabled: true, updated_at: new Date().toISOString() } as any).eq("flag_key", f.flag_key);
    }
    setFlags(prev => prev.map(f => ({ ...f, enabled: true })));

    const undoReset = async () => {
      for (const s of previousStates) {
        await supabase.from("feature_flags").update({ enabled: s.enabled, updated_at: new Date().toISOString() } as any).eq("flag_key", s.key);
      }
      setFlags(prev => prev.map(f => {
        const prev_state = previousStates.find(s => s.key === f.flag_key);
        return prev_state ? { ...f, enabled: prev_state.enabled } : f;
      }));
      toast({ title: "↩️ Reset undone" });
    };

    toast({
      title: "✅ All flags reset to enabled",
      description: `${disabledFlags.length} flag(s) were enabled`,
      action: (
        <ToastAction altText="Undo reset" onClick={undoReset} className="text-xs font-semibold text-primary hover:text-primary/80 underline underline-offset-2 border-0">
          Undo
        </ToastAction>
      ),
      duration: 6000,
    });
  };

  const exportFlags = () => {
    const config = {
      exported_at: new Date().toISOString(),
      total: flags.length,
      enabled: flags.filter(f => f.enabled).length,
      disabled: flags.filter(f => !f.enabled).length,
      flags: flags.map(f => ({ flag_key: f.flag_key, enabled: f.enabled })),
    };
    const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `feature-flags-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: "📦 Flags exported" });
  };

  const importFlags = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        const imported: { flag_key: string; enabled: boolean }[] = Array.isArray(parsed) ? parsed : parsed?.flags;
        if (!Array.isArray(imported) || !imported.every(f => typeof f.flag_key === "string" && typeof f.enabled === "boolean")) {
          toast({ title: "❌ Invalid file format", description: "Expected { flags: [...] } or an array of { flag_key, enabled }" });
          return;
        }
        const changes = imported
          .map(item => {
            const existing = flags.find(f => f.flag_key === item.flag_key);
            if (existing && existing.enabled !== item.enabled) {
              return { flag_key: item.flag_key, label: existing.label || item.flag_key, from: existing.enabled, to: item.enabled };
            }
            return null;
          })
          .filter(Boolean) as { flag_key: string; label: string; from: boolean; to: boolean }[];
        if (changes.length === 0) {
          toast({ title: "No changes", description: "All flags already match the imported file" });
          return;
        }
        setImportDiff(changes);
        setPendingImport(imported);
      } catch {
        toast({ title: "❌ Failed to parse file" });
      }
    };
    input.click();
  };

  const applyImport = async () => {
    if (!pendingImport || !importDiff) return;
    for (const change of importDiff) {
      await supabase.from("feature_flags").update({ enabled: change.to, updated_at: new Date().toISOString() } as any).eq("flag_key", change.flag_key);
    }
    setFlags(prev => prev.map(f => {
      const match = pendingImport.find(i => i.flag_key === f.flag_key);
      return match ? { ...f, enabled: match.enabled } : f;
    }));
    toast({ title: "📥 Flags imported", description: `${importDiff.length} flag(s) updated` });
    setImportDiff(null);
    setPendingImport(null);
  };

  const cancelImport = () => {
    setImportDiff(null);
    setPendingImport(null);
  };

  const query = searchQuery.toLowerCase().trim();

  return (
    <div className="space-y-4 max-w-lg">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground">App Section Controls</h2>
        {!loading && (
          <div className="flex items-center gap-2 text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/15 text-primary px-2.5 py-1 font-medium">
              {flags.filter(f => f.enabled).length} enabled
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-muted text-muted-foreground px-2.5 py-1 font-medium">
              {flags.filter(f => !f.enabled).length} disabled
            </span>
          </div>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Enable or disable tabs and their individual sections for all users.</p>
        {!loading && flags.some(f => !f.enabled) && (
          <AnimatePresence mode="wait">
            {confirmReset ? (
              <motion.div key="confirm" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.9 }} className="flex items-center gap-2">
                <span className="text-xs text-destructive font-medium">Reset all?</span>
                <button onClick={() => { resetAllFlags(); setConfirmReset(false); }} className="text-xs font-semibold text-destructive hover:text-destructive/80 transition-colors">Yes</button>
                <button onClick={() => setConfirmReset(false)} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
              </motion.div>
            ) : (
              <motion.button key="trigger" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setConfirmReset(true)}
                className="shrink-0 text-xs font-medium text-primary hover:text-primary/80 transition-colors underline underline-offset-2"
              >
                Reset all
              </motion.button>
            )}
          </AnimatePresence>
        )}
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="text"
          placeholder="Search flags..."
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full rounded-xl bg-secondary border border-border pl-9 pr-3 py-2.5 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
        />
        {searchQuery && (
          <button onClick={() => setSearchQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
            <XCircle className="w-4 h-4" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between">
        <p className="text-[10px] text-muted-foreground/60">{"💡 Press "}<kbd className="px-1 py-0.5 rounded bg-muted text-muted-foreground text-[10px] font-mono">Ctrl+Z</kbd>{" to undo last toggle"}</p>
        {!loading && (
          <div className="flex items-center gap-1.5">
            <button onClick={exportFlags} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Download className="w-3 h-3" /> Export
            </button>
            <span className="text-muted-foreground/40">|</span>
            <button onClick={importFlags} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
              <Upload className="w-3 h-3" /> Import
            </button>
          </div>
        )}
      </div>

      {/* Import diff preview */}
      <AnimatePresence>
        {importDiff && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl neural-border p-4 space-y-3 overflow-hidden"
          >
            <p className="text-sm font-semibold text-foreground">Review changes ({importDiff.length})</p>
            <div className="space-y-1.5 max-h-48 overflow-y-auto">
              {importDiff.map(d => (
                <div key={d.flag_key} className="flex items-center justify-between text-xs py-1">
                  <span className="text-foreground truncate mr-2">{d.label}</span>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${d.from ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {d.from ? "ON" : "OFF"}
                    </span>
                    <span className="text-muted-foreground">→</span>
                    <span className={`px-1.5 py-0.5 rounded-full font-medium ${d.to ? "bg-primary/15 text-primary" : "bg-muted text-muted-foreground"}`}>
                      {d.to ? "ON" : "OFF"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-2 pt-1">
              <button onClick={applyImport} className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors">
                Apply {importDiff.length} change{importDiff.length > 1 ? "s" : ""}
              </button>
              <button onClick={cancelImport} className="text-xs font-medium text-muted-foreground hover:text-foreground transition-colors">
                Cancel
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : query ? (
        /* Flat search results */
        <div className="space-y-2">
          {(() => {
            const matched = flags.filter(f =>
              (f.label || f.flag_key).toLowerCase().includes(query) || f.flag_key.toLowerCase().includes(query)
            );
            if (matched.length === 0) return <p className="text-sm text-muted-foreground text-center py-8">No flags matching "{searchQuery}"</p>;
            return matched.map(flag => (
              <div key={flag.id} className="glass rounded-xl neural-border p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-medium text-foreground">{flag.label || flag.flag_key}</p>
                  <p className="text-[9px] text-muted-foreground">{flag.flag_key} · {flag.enabled ? "Visible" : "Hidden"}</p>
                </div>
                <button
                  onClick={() => toggleFlag(flag.flag_key, !flag.enabled)}
                  className={`relative w-9 h-5 rounded-full transition-colors ${flag.enabled ? "bg-primary" : "bg-muted"}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${flag.enabled ? "translate-x-4" : "translate-x-0"}`} />
                </button>
              </div>
            ));
          })()}
        </div>
      ) : (
        <div className="space-y-3">
          {TAB_GROUPS.map(group => {
            const tabFlag = flags.find(f => f.flag_key === group.key);
            const sectionFlags = flags.filter(f => f.flag_key.startsWith(group.prefix));
            const isExpanded = expandedTab === group.key;
            const enabledCount = sectionFlags.filter(f => f.enabled).length;

            return (
              <div key={group.key} className="glass rounded-xl neural-border overflow-hidden">
                {/* Tab-level toggle */}
                <div className="p-4 flex items-center gap-3">
                  <group.icon className="w-4 h-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-foreground">{group.label}</p>
                    <p className="text-[10px] text-muted-foreground">
                      {tabFlag?.enabled ? `${enabledCount}/${sectionFlags.length} sections active` : "Tab disabled"}
                    </p>
                  </div>
                  {tabFlag && (
                    <button
                      onClick={() => toggleFlag(tabFlag.flag_key, !tabFlag.enabled)}
                      className={`relative w-11 h-6 rounded-full transition-colors shrink-0 ${tabFlag.enabled ? "bg-primary" : "bg-muted"}`}
                    >
                      <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${tabFlag.enabled ? "translate-x-5" : "translate-x-0"}`} />
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedTab(isExpanded ? null : group.key)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    </motion.div>
                  </button>
                </div>

                {/* Section-level toggles */}
                <AnimatePresence>
                  {isExpanded && sectionFlags.length > 0 && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.25 }}
                      className="overflow-hidden"
                    >
                      <div className="border-t border-border px-4 pb-3 pt-2 space-y-2">
                        {/* Bulk actions */}
                        <div className="flex gap-2 mb-2">
                          <button
                            onClick={() => toggleAllSections(group.prefix, true)}
                            className="text-[10px] text-primary font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
                          >
                            Enable All
                          </button>
                          <button
                            onClick={() => toggleAllSections(group.prefix, false)}
                            className="text-[10px] text-destructive font-medium px-2 py-1 rounded-md hover:bg-destructive/10 transition-colors"
                          >
                            Disable All
                          </button>
                        </div>
                        {sectionFlags.map(flag => (
                          <div key={flag.id} className="flex items-center justify-between py-1.5">
                            <div>
                              <p className="text-xs font-medium text-foreground">{flag.label || flag.flag_key}</p>
                              <p className="text-[9px] text-muted-foreground">
                                {flag.enabled ? "Visible" : "Hidden"}
                              </p>
                            </div>
                            <button
                              onClick={() => toggleFlag(flag.flag_key, !flag.enabled)}
                              className={`relative w-9 h-5 rounded-full transition-colors ${flag.enabled ? "bg-primary" : "bg-muted"}`}
                            >
                              <span className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${flag.enabled ? "translate-x-4" : "translate-x-0"}`} />
                            </button>
                          </div>
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}

      {/* Changelog */}
      <div className="pt-2">
        <button
          onClick={() => { setShowChangelog(!showChangelog); if (!showChangelog && changelog.length === 0) fetchChangelog(); }}
          className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
        >
          <ScrollText className="w-3.5 h-3.5" />
          {showChangelog ? "Hide changelog" : "Show changelog"}
        </button>
        <AnimatePresence>
          {showChangelog && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden mt-2 space-y-2"
            >
              {/* Filter */}
              <div className="flex items-center gap-1">
                {(["all", "enabled", "disabled"] as const).map(f => (
                  <button
                    key={f}
                    onClick={() => setChangelogFilter(f)}
                    className={`text-[10px] px-2 py-1 rounded-full font-medium transition-colors ${changelogFilter === f ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:text-foreground"}`}
                  >
                    {f === "all" ? "All" : f === "enabled" ? "Enabled" : "Disabled"}
                  </button>
                ))}
              </div>
              {changelog.length === 0 && !changelogLoading ? (
                <p className="text-xs text-muted-foreground py-4 text-center">No changes recorded yet</p>
              ) : (
                <div className="space-y-1 max-h-72 overflow-y-auto pr-1">
                  {changelog.filter(log => changelogFilter === "all" || (changelogFilter === "enabled" ? log.action === "feature_enabled" : log.action === "feature_disabled")).map(log => {
                    const isEnabled = log.action === "feature_enabled";
                    const flagLabel = (log.details as any)?.flag_key || log.target_id || "unknown";
                    const time = new Date(log.created_at);
                    const timeStr = time.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + time.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
                    return (
                      <div key={log.id} className="flex items-start gap-2 py-1.5 border-b border-border/50 last:border-0">
                        <div className={`mt-0.5 w-2 h-2 rounded-full shrink-0 ${isEnabled ? "bg-primary" : "bg-muted-foreground"}`} />
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-foreground">
                            <span className="font-medium">{log.admin_name}</span>
                            {" "}
                            <span className={isEnabled ? "text-primary" : "text-muted-foreground"}>
                              {isEnabled ? "enabled" : "disabled"}
                            </span>
                            {" "}
                            <span className="font-mono text-muted-foreground">{flagLabel}</span>
                          </p>
                          <p className="text-[9px] text-muted-foreground">{timeStr}</p>
                        </div>
                      </div>
                    );
                  })}
                  {changelogLoading && (
                    <div className="flex justify-center py-2">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-muted-foreground" />
                    </div>
                  )}
                  {!changelogLoading && changelogHasMore && changelog.length > 0 && (
                    <button
                      onClick={() => fetchChangelog(changelog.length, true)}
                      className="w-full text-center text-[11px] text-primary hover:text-primary/80 py-2 transition-colors"
                    >
                      Load more
                    </button>
                  )}
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default AdminPanel;
