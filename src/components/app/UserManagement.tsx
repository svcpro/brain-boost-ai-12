import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Loader2, Users, UserPlus, ChevronRight, ArrowLeft,
  Pencil, Save, X, Trash2, CreditCard, Activity, Clock,
  BookOpen, Brain, TrendingUp, Calendar, Shield, Ban,
  CheckCircle2, XCircle, Eye, Crown, Star, BarChart3, Download,
  CheckSquare, Square, MinusSquare, ArrowUpDown, ArrowUp, ArrowDown,
  Target, Award, Bell, Send, Sparkles
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

interface UserProfile {
  id: string;
  display_name: string | null;
  email: string | null;
  phone: string | null;
  whatsapp_number: string | null;
  exam_type: string | null;
  exam_date: string | null;
  daily_study_goal_minutes: number;
  weekly_focus_goal_minutes: number;
  created_at: string;
  updated_at: string;
  avatar_url: string | null;
  opt_in_leaderboard: boolean;
  email_notifications_enabled: boolean;
  is_banned: boolean;
  banned_at: string | null;
  ban_reason: string | null;
}

interface UserSubscription {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  amount: number | null;
  currency: string | null;
  expires_at: string | null;
  created_at: string;
}

interface SubPlan {
  id: string;
  plan_key: string;
  name: string;
  price: number;
  currency: string;
}

interface UserStats {
  totalStudyMinutes: number;
  totalSessions: number;
  subjectsCount: number;
  topicsCount: number;
}

const PLAN_COLORS: Record<string, string> = {
  free: "bg-secondary text-muted-foreground",
  pro: "bg-primary/15 text-primary",
  ultra: "bg-accent/15 text-accent",
};

const STATUS_COLORS: Record<string, string> = {
  active: "bg-success/15 text-success",
  expired: "bg-destructive/15 text-destructive",
  cancelled: "bg-warning/15 text-warning",
};

// Mini sparkline SVG component
const MiniSparkline = ({ data }: { data: number[] }) => {
  if (!data.length || data.every(v => v === 0)) {
    return <div className="w-16 h-5 flex items-center"><span className="text-[8px] text-muted-foreground">No activity</span></div>;
  }
  const max = Math.max(...data, 1);
  const w = 64, h = 20, padding = 1;
  const points = data.map((v, i) => {
    const x = padding + (i / (data.length - 1)) * (w - padding * 2);
    const y = h - padding - (v / max) * (h - padding * 2);
    return `${x},${y}`;
  }).join(" ");
  return (
    <svg width={w} height={h} className="shrink-0">
      <polyline
        points={points}
        fill="none"
        stroke="hsl(var(--primary))"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity={0.7}
      />
    </svg>
  );
};

const UserManagement = () => {
  const { user: adminUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [subscriptions, setSubscriptions] = useState<UserSubscription[]>([]);
  const [plans, setPlans] = useState<SubPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedUser, setSelectedUser] = useState<UserProfile | null>(null);
  const [filter, setFilter] = useState<"all" | "banned">("all");
  const [page, setPage] = useState(1);
  const PAGE_SIZE = 20;
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkProcessing, setBulkProcessing] = useState(false);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "name_asc" | "name_desc">("newest");
  const [bulkConfirm, setBulkConfirm] = useState<{ action: "ban" | "unban" } | null>(null);
  const [studyActivity, setStudyActivity] = useState<Record<string, number[]>>({});
  const [summaryStats, setSummaryStats] = useState({ totalUsers: 0, paidUsers: 0, newThisWeek: 0, totalRevenue: 0 });

  // Debounce search input for server-side queries
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 350);
    return () => clearTimeout(timer);
  }, [search]);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    // Build server-side query with filters, sorting, and pagination
    const from = (page - 1) * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query = supabase
      .from("profiles")
      .select("id, display_name, email, phone, whatsapp_number, exam_type, exam_date, daily_study_goal_minutes, weekly_focus_goal_minutes, created_at, updated_at, avatar_url, opt_in_leaderboard, email_notifications_enabled, is_banned, banned_at, ban_reason", { count: "exact" });

    // Server-side search filter
    if (debouncedSearch) {
      query = query.or(`display_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%,id.eq.${debouncedSearch.match(/^[0-9a-f-]{36}$/i) ? debouncedSearch : "00000000-0000-0000-0000-000000000000"}`);
    }

    // Server-side status filter
    if (filter === "banned") {
      query = query.eq("is_banned", true);
    }

    // Server-side sorting
    switch (sortBy) {
      case "newest": query = query.order("created_at", { ascending: false }); break;
      case "oldest": query = query.order("created_at", { ascending: true }); break;
      case "name_asc": query = query.order("display_name", { ascending: true, nullsFirst: false }); break;
      case "name_desc": query = query.order("display_name", { ascending: false, nullsFirst: true }); break;
    }

    query = query.range(from, to);

    // Fetch page of users + summary counts + plans in parallel
    const [usersRes, plansRes, totalUsersRes, paidCountRes, newWeekRes, revenueRes] = await Promise.all([
      query,
      supabase.from("subscription_plans").select("id, plan_key, name, price, currency").order("sort_order"),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase.from("user_subscriptions").select("id", { count: "exact", head: true }).eq("status", "active").neq("plan_id", "free"),
      supabase.from("profiles").select("id", { count: "exact", head: true }).gte("created_at", weekAgo.toISOString()),
      supabase.from("user_subscriptions").select("amount").eq("status", "active"),
    ]);

    const pageUsers = (usersRes.data as UserProfile[]) || [];
    setUsers(pageUsers);
    setTotalCount(usersRes.count || 0);
    setPlans((plansRes.data as SubPlan[]) || []);

    setSummaryStats({
      totalUsers: totalUsersRes.count || 0,
      paidUsers: paidCountRes.count || 0,
      newThisWeek: newWeekRes.count || 0,
      totalRevenue: (revenueRes.data || []).reduce((sum, s: any) => sum + (s.amount || 0), 0),
    });

    // Fetch subscriptions only for visible users (not all users)
    const userIds = pageUsers.map(u => u.id);
    if (userIds.length > 0) {
      const [subsRes, logsRes] = await Promise.all([
        supabase.from("user_subscriptions").select("id, user_id, plan_id, status, amount, currency, expires_at, created_at").in("user_id", userIds).order("created_at", { ascending: false }),
        supabase.from("study_logs").select("user_id, duration_minutes, created_at").in("user_id", userIds).gte("created_at", weekAgo.toISOString()),
      ]);
      setSubscriptions((subsRes.data as UserSubscription[]) || []);

      // Build 7-day activity map per user
      const actMap: Record<string, number[]> = {};
      for (const log of (logsRes.data || [])) {
        const uid = (log as any).user_id;
        const dayIdx = 6 - Math.min(6, Math.floor((Date.now() - new Date((log as any).created_at).getTime()) / 86400000));
        if (!actMap[uid]) actMap[uid] = [0, 0, 0, 0, 0, 0, 0];
        actMap[uid][dayIdx] += (log as any).duration_minutes || 0;
      }
      setStudyActivity(actMap);
    } else {
      setSubscriptions([]);
      setStudyActivity({});
    }

    setLoading(false);
  }, [page, debouncedSearch, filter, sortBy]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getUserPlan = (userId: string) => {
    const sub = subscriptions.find(s => s.user_id === userId && s.status === "active");
    if (!sub) return { planKey: "free", planName: "Free Brain", sub: null };
    const plan = plans.find(p => p.id === sub.plan_id);
    return { planKey: plan?.plan_key || "free", planName: plan?.name || "Free", sub };
  };

  const totalPages = Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
  const paginatedUsers = users;

  // Reset page & selection when filters change
  useEffect(() => { setPage(1); setSelectedIds(new Set()); }, [search, filter, sortBy]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === paginatedUsers.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedUsers.map(u => u.id)));
    }
  };

  const bulkLogAudit = async (action: string, targetIds: string[], details: Record<string, any>) => {
    if (!adminUser) return;
    const entries = targetIds.map(tid => ({
      admin_id: adminUser.id,
      action,
      target_type: "user",
      target_id: tid,
      details: details as any,
    }));
    await supabase.from("admin_audit_logs").insert(entries);
  };

  const bulkBan = async (ban: boolean) => {
    if (selectedIds.size === 0) return;
    setBulkProcessing(true);
    const ids = Array.from(selectedIds);
    const updateData: any = {
      is_banned: ban,
      banned_at: ban ? new Date().toISOString() : null,
      ban_reason: ban ? "Bulk action by admin" : null,
    };
    const { error } = await supabase.from("profiles").update(updateData).in("id", ids);
    if (error) {
      toast({ title: `Failed to ${ban ? "ban" : "unban"} users`, variant: "destructive" });
    } else {
      await bulkLogAudit(ban ? "bulk_user_banned" : "bulk_user_unbanned", ids, { count: ids.length });
      toast({ title: `${ids.length} user(s) ${ban ? "banned" : "unbanned"}` });
      setSelectedIds(new Set());
      await fetchData();
    }
    setBulkProcessing(false);
  };

  // Summary stats from server-side counts
  const { totalUsers, paidUsers, totalRevenue, newThisWeek } = summaryStats;

  const exportCSV = () => {
    const headers = ["ID", "Display Name", "Email", "Phone", "Exam Type", "Exam Date", "Daily Goal (min)", "Weekly Goal (min)", "Plan", "Plan Status", "Amount", "Banned", "Ban Reason", "Joined", "Last Updated"];
    const rows = users.map(u => {
      const { planName, sub } = getUserPlan(u.id);
      return [
        u.id,
        u.display_name || "",
        u.email || "",
        u.phone || u.whatsapp_number || "",
        u.exam_type || "",
        u.exam_date || "",
        u.daily_study_goal_minutes,
        u.weekly_focus_goal_minutes,
        planName,
        sub?.status || "free",
        sub?.amount || 0,
        u.is_banned ? "Yes" : "No",
        u.ban_reason || "",
        u.created_at,
        u.updated_at,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `users-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast({ title: `Exported ${users.length} users (current page)` });
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  if (selectedUser) {
    return <UserDetail user={selectedUser} plans={plans} subscriptions={subscriptions} onBack={() => { setSelectedUser(null); fetchData(); }} toast={toast} />;
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">User Management</h2>
          <p className="text-xs text-muted-foreground mt-1">{totalUsers} total users</p>
        </div>
        <button
          onClick={exportCSV}
          className="px-4 py-2 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 transition-colors flex items-center gap-1.5"
        >
          <Download className="w-3.5 h-3.5" /> Export CSV
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users", value: totalUsers, icon: Users, color: "text-primary" },
          { label: "Paid Users", value: paidUsers, icon: Crown, color: "text-accent" },
          { label: "New This Week", value: newThisWeek, icon: UserPlus, color: "text-success" },
          { label: "Active Revenue", value: `₹${totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-warning" },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search, filter & sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or ID..." className="w-full pl-10 pr-4 py-2.5 bg-secondary rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none" />
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {(["all", "banned"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors capitalize ${filter === f ? (f === "banned" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary") : "text-muted-foreground hover:bg-secondary"}`}>
              {f === "all" ? "All" : f}
            </button>
          ))}
          <div className="relative">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="appearance-none pl-7 pr-3 py-2 bg-secondary rounded-lg text-xs font-medium text-foreground border border-border focus:border-primary outline-none cursor-pointer"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
              <option value="name_asc">Name A–Z</option>
              <option value="name_desc">Name Z–A</option>
            </select>
            <ArrowUpDown className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Bulk action bar */}
      <AnimatePresence>
        {selectedIds.size > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass rounded-xl p-3 neural-border flex items-center justify-between flex-wrap gap-2"
          >
            <span className="text-xs font-medium text-foreground">{selectedIds.size} user(s) selected</span>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setBulkConfirm({ action: "ban" })}
                disabled={bulkProcessing}
                className="px-3 py-1.5 bg-destructive/15 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <Ban className="w-3 h-3" /> Ban Selected
              </button>
              <button
                onClick={() => setBulkConfirm({ action: "unban" })}
                disabled={bulkProcessing}
                className="px-3 py-1.5 bg-success/15 text-success rounded-lg text-xs font-medium hover:bg-success/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
              >
                <CheckCircle2 className="w-3 h-3" /> Unban Selected
              </button>
              <button
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-muted-foreground hover:text-foreground rounded-lg text-xs font-medium transition-colors"
              >
                Clear
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* User list */}
      <div className="space-y-2">
        {/* Select all header */}
        <div className="flex items-center gap-3 px-3 py-1.5">
          <button onClick={toggleSelectAll} className="text-muted-foreground hover:text-foreground transition-colors">
            {selectedIds.size === paginatedUsers.length && paginatedUsers.length > 0 ? (
              <CheckSquare className="w-4 h-4 text-primary" />
            ) : selectedIds.size > 0 ? (
              <MinusSquare className="w-4 h-4 text-primary" />
            ) : (
              <Square className="w-4 h-4" />
            )}
          </button>
          <span className="text-[10px] text-muted-foreground">
            {selectedIds.size > 0 ? `${selectedIds.size} selected` : "Select all"}
          </span>
        </div>
        {paginatedUsers.map((u, i) => {
          const { planKey, planName } = getUserPlan(u.id);
          const isSelected = selectedIds.has(u.id);
          return (
            <motion.div
              key={u.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: Math.min(i * 0.02, 0.3) }}
              className={`glass rounded-xl p-3 neural-border flex items-center gap-3 cursor-pointer hover:bg-secondary/50 transition-colors group ${isSelected ? "ring-1 ring-primary/30 bg-primary/5" : ""}`}
            >
              <button
                onClick={(e) => { e.stopPropagation(); toggleSelect(u.id); }}
                className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                {isSelected ? <CheckSquare className="w-4 h-4 text-primary" /> : <Square className="w-4 h-4" />}
              </button>
              <div
                className="flex items-center gap-3 flex-1 min-w-0"
                onClick={() => setSelectedUser(u)}
              >
                <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 relative ${u.is_banned ? 'bg-destructive/15' : 'bg-primary/15'}`}>
                  <span className={`text-sm font-bold ${u.is_banned ? 'text-destructive' : 'text-primary'}`}>{(u.display_name || "?")[0].toUpperCase()}</span>
                  {u.is_banned && <Ban className="w-3 h-3 text-destructive absolute -bottom-0.5 -right-0.5" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-foreground truncate">{u.display_name || "Anonymous"}</p>
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${PLAN_COLORS[planKey] || PLAN_COLORS.free}`}>{planName}</span>
                    {u.is_banned && <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive">Banned</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate">{u.email || "No email"}{(u.phone || u.whatsapp_number) ? ` · ${u.phone || u.whatsapp_number}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground">{u.exam_type || "No exam"} · Goal: {u.daily_study_goal_minutes}min/day · Joined {formatDistanceToNow(new Date(u.created_at), { addSuffix: true })}</p>
                </div>
                <MiniSparkline data={studyActivity[u.id] || []} />
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </div>
            </motion.div>
          );
        })}
        {users.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No users found</p>}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            Showing {(page - 1) * PAGE_SIZE + 1}–{Math.min(page * PAGE_SIZE, totalCount)} of {totalCount}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage(p => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - page) <= 1)
              .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                if (idx > 0 && p - (arr[idx - 1]) > 1) acc.push("...");
                acc.push(p);
                return acc;
              }, [])
              .map((p, idx) =>
                p === "..." ? (
                  <span key={`e${idx}`} className="px-1 text-xs text-muted-foreground">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setPage(p)}
                    className={`w-8 h-8 rounded-lg text-xs font-medium transition-colors ${page === p ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
                  >
                    {p}
                  </button>
                )
              )}
            <button
              onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      {/* Bulk confirmation dialog */}
      <AnimatePresence>
        {bulkConfirm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
            onClick={() => !bulkProcessing && setBulkConfirm(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="glass rounded-2xl p-6 neural-border max-w-sm w-full mx-4 space-y-4"
            >
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${bulkConfirm.action === "ban" ? "bg-destructive/15" : "bg-success/15"}`}>
                  {bulkConfirm.action === "ban" ? <Ban className="w-5 h-5 text-destructive" /> : <CheckCircle2 className="w-5 h-5 text-success" />}
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">
                    {bulkConfirm.action === "ban" ? "Ban" : "Unban"} {selectedIds.size} user(s)?
                  </h3>
                  <p className="text-[11px] text-muted-foreground">This action will be logged in the audit trail.</p>
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button
                  onClick={() => setBulkConfirm(null)}
                  disabled={bulkProcessing}
                  className="px-4 py-2 rounded-lg text-xs font-medium text-muted-foreground hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={async () => {
                    await bulkBan(bulkConfirm.action === "ban");
                    setBulkConfirm(null);
                  }}
                  disabled={bulkProcessing}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 disabled:opacity-50 ${
                    bulkConfirm.action === "ban"
                      ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                      : "bg-success text-success-foreground hover:bg-success/90"
                  }`}
                >
                  {bulkProcessing ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  {bulkConfirm.action === "ban" ? "Confirm Ban" : "Confirm Unban"}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

// ─── User Detail View ───
const UserDetail = ({ user, plans, subscriptions, onBack, toast }: {
  user: UserProfile;
  plans: SubPlan[];
  subscriptions: UserSubscription[];
  onBack: () => void;
  toast: any;
}) => {
  const { user: adminUser } = useAuth();
  const { hasAnyRole } = useAdminRole();
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    display_name: user.display_name || "",
    exam_type: user.exam_type || "",
    daily_study_goal_minutes: user.daily_study_goal_minutes,
    weekly_focus_goal_minutes: user.weekly_focus_goal_minutes,
  });
  const [stats, setStats] = useState<UserStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPlan, setChangingPlan] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showBanForm, setShowBanForm] = useState(false);
  const [banning, setBanning] = useState(false);
  const [isBanned, setIsBanned] = useState(user.is_banned);
  const [examHistory, setExamHistory] = useState<any[]>([]);
  const [studyTrend, setStudyTrend] = useState<{ date: string; minutes: number }[]>([]);

  const logAudit = async (action: string, details: Record<string, any>) => {
    if (!adminUser) return;
    await supabase.from("admin_audit_logs").insert({
      admin_id: adminUser.id,
      action,
      target_type: "user",
      target_id: user.id,
      details: details as any,
    });
  };

  const userSubs = subscriptions.filter(s => s.user_id === user.id);
  const activeSub = userSubs.find(s => s.status === "active");
  const activePlan = activeSub ? plans.find(p => p.id === activeSub.plan_id) : null;

  useEffect(() => {
    (async () => {
      const fourteenDaysAgo = new Date();
      fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14);
      const [logsRes, subjectsRes, topicsRes, examsRes, trendRes] = await Promise.all([
        supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id),
        supabase.from("subjects").select("id").eq("user_id", user.id).is("deleted_at", null),
        supabase.from("topics").select("id").eq("user_id", user.id).is("deleted_at", null),
        supabase.from("exam_results").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
        supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", user.id).gte("created_at", fourteenDaysAgo.toISOString()),
      ]);
      const logs = logsRes.data || [];
      setStats({
        totalStudyMinutes: logs.reduce((sum, l) => sum + (l.duration_minutes || 0), 0),
        totalSessions: logs.length,
        subjectsCount: subjectsRes.data?.length || 0,
        topicsCount: topicsRes.data?.length || 0,
      });
      setExamHistory((examsRes.data as any[]) || []);

      // Build 14-day trend
      const trendMap: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        trendMap[format(d, "MMM d")] = 0;
      }
      for (const log of (trendRes.data || [])) {
        const key = format(new Date((log as any).created_at), "MMM d");
        if (trendMap[key] !== undefined) trendMap[key] += (log as any).duration_minutes || 0;
      }
      setStudyTrend(Object.entries(trendMap).map(([date, minutes]) => ({ date, minutes })));
      setStatsLoading(false);
    })();
  }, [user.id]);

  const saveProfile = async () => {
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      display_name: editForm.display_name || null,
      exam_type: editForm.exam_type || null,
      daily_study_goal_minutes: editForm.daily_study_goal_minutes,
      weekly_focus_goal_minutes: editForm.weekly_focus_goal_minutes,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      toast({ title: "Failed to update profile", variant: "destructive" });
      return;
    }
    await logAudit("profile_updated", { changes: editForm });
    toast({ title: "Profile updated" });
    setEditing(false);
  };

  const changePlan = async (newPlanId: string) => {
    setChangingPlan(true);
    const newPlan = plans.find(p => p.id === newPlanId);
    if (!newPlan) return;

    // Expire current active subscription
    if (activeSub) {
      await supabase.from("user_subscriptions").update({ status: "cancelled" } as any).eq("id", activeSub.id);
    }

    // Create new subscription (skip for free plan)
    if (newPlan.plan_key !== "free") {
      const expiresAt = new Date();
      expiresAt.setMonth(expiresAt.getMonth() + 1);
      await supabase.from("user_subscriptions").insert({
        user_id: user.id,
        plan_id: newPlanId,
        status: "active",
        amount: newPlan.price,
        currency: newPlan.currency,
        expires_at: expiresAt.toISOString(),
      } as any);
    }

    await logAudit("plan_changed", { from: activePlan?.plan_key || "free", to: newPlan.plan_key, amount: newPlan.price });
    toast({ title: `Plan changed to ${newPlan.name}` });
    setChangingPlan(false);
    onBack();
  };

  const totalHours = stats ? Math.round(stats.totalStudyMinutes / 60) : 0;

  const toggleBan = async (ban: boolean) => {
    setBanning(true);
    const updateData: any = {
      is_banned: ban,
      banned_at: ban ? new Date().toISOString() : null,
      ban_reason: ban ? (banReason || "Banned by admin") : null,
    };
    const { error } = await supabase.from("profiles").update(updateData).eq("id", user.id);
    setBanning(false);
    if (error) {
      toast({ title: `Failed to ${ban ? "ban" : "unban"} user`, variant: "destructive" });
      return;
    }
    setIsBanned(ban);
    setShowBanForm(false);
    setBanReason("");
    await logAudit(ban ? "user_banned" : "user_unbanned", { reason: banReason || null });
    toast({ title: ban ? "User banned" : "User unbanned" });
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <ArrowLeft className="w-4 h-4 text-muted-foreground" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-foreground">{user.display_name || "Anonymous"}</h2>
                     {isBanned && <span className="text-[9px] font-semibold px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">BANNED</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{user.email || "No email"}{(user.phone || user.whatsapp_number) ? ` · ${user.phone || user.whatsapp_number}` : ""}</p>
                  <p className="text-[10px] text-muted-foreground font-mono">{user.id}</p>
        </div>
        {!editing ? (
          <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-secondary rounded-lg text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors flex items-center gap-1.5">
            <Pencil className="w-3 h-3" /> Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button onClick={() => setEditing(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
            <button onClick={saveProfile} disabled={saving} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50">
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
            </button>
          </div>
        )}
      </div>

      {/* Study Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {statsLoading ? (
          <div className="col-span-4 flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
        ) : (
          <>
            {[
              { label: "Total Study Time", value: `${totalHours}h`, icon: Clock, color: "text-primary" },
              { label: "Sessions", value: stats!.totalSessions, icon: Activity, color: "text-accent" },
              { label: "Subjects", value: stats!.subjectsCount, icon: BookOpen, color: "text-success" },
              { label: "Topics", value: stats!.topicsCount, icon: Brain, color: "text-warning" },
            ].map((c, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-center gap-2 mb-1">
                  <c.icon className={`w-4 h-4 ${c.color}`} />
                  <span className="text-[10px] text-muted-foreground">{c.label}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{c.value}</p>
              </motion.div>
            ))}
          </>
        )}
      </div>

      {/* Profile Info / Edit Form */}
      <div className="glass rounded-xl neural-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Eye className="w-4 h-4 text-primary" /> Profile Details
        </h3>
        {editing ? (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Display Name</label>
              <input value={editForm.display_name} onChange={e => setEditForm(p => ({ ...p, display_name: e.target.value }))} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Exam Type</label>
              <input value={editForm.exam_type} onChange={e => setEditForm(p => ({ ...p, exam_type: e.target.value }))} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Daily Goal (minutes)</label>
              <input type="number" value={editForm.daily_study_goal_minutes} onChange={e => setEditForm(p => ({ ...p, daily_study_goal_minutes: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Weekly Focus Goal (minutes)</label>
              <input type="number" value={editForm.weekly_focus_goal_minutes} onChange={e => setEditForm(p => ({ ...p, weekly_focus_goal_minutes: parseInt(e.target.value) || 0 }))} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[
              { label: "Email", value: user.email || "Not set" },
              { label: "Phone", value: user.phone || user.whatsapp_number || "Not set" },
              { label: "Exam Type", value: user.exam_type || "Not set" },
              { label: "Exam Date", value: user.exam_date ? format(new Date(user.exam_date), "MMM d, yyyy") : "Not set" },
              { label: "Daily Goal", value: `${user.daily_study_goal_minutes} min` },
              { label: "Weekly Goal", value: `${user.weekly_focus_goal_minutes} min` },
              { label: "Leaderboard", value: user.opt_in_leaderboard ? "Opted in" : "Opted out" },
              { label: "Notifications", value: user.email_notifications_enabled ? "Enabled" : "Disabled" },
              { label: "Joined", value: format(new Date(user.created_at), "MMM d, yyyy") },
              { label: "Last Updated", value: formatDistanceToNow(new Date(user.updated_at), { addSuffix: true }) },
            ].map((item, i) => (
              <div key={i}>
                <p className="text-[10px] text-muted-foreground">{item.label}</p>
                <p className="text-sm font-medium text-foreground">{item.value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Subscription Management */}
      <div className="glass rounded-xl neural-border p-4 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <CreditCard className="w-4 h-4 text-accent" /> Subscription
        </h3>

        {/* Current plan */}
        <div className="flex items-center gap-3 p-3 bg-secondary/50 rounded-lg">
          <Crown className="w-5 h-5 text-accent" />
          <div className="flex-1">
            <p className="text-sm font-semibold text-foreground">{activePlan?.name || "Free Brain"}</p>
            <p className="text-[10px] text-muted-foreground">
              {activeSub
                ? `₹${activeSub.amount || 0}/${activePlan?.plan_key === "free" ? "forever" : "month"} · Expires ${activeSub.expires_at ? format(new Date(activeSub.expires_at), "MMM d, yyyy") : "Never"}`
                : "No active paid subscription"}
            </p>
          </div>
          <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLORS[activeSub?.status || "active"]}`}>
            {activeSub?.status || "free"}
          </span>
        </div>

        {/* Change plan */}
        <div>
          <p className="text-[10px] text-muted-foreground mb-2">Change Plan</p>
          <div className="flex gap-2 flex-wrap">
            {plans.map(plan => {
              const isActive = activePlan?.id === plan.id || (!activePlan && plan.plan_key === "free");
              return (
                <button
                  key={plan.id}
                  disabled={isActive || changingPlan}
                  onClick={() => {
                    if (confirm(`Change this user's plan to ${plan.name} (₹${plan.price})?`)) {
                      changePlan(plan.id);
                    }
                  }}
                  className={`px-4 py-2 rounded-lg text-xs font-medium transition-colors border disabled:opacity-50 ${
                    isActive ? "border-primary bg-primary/10 text-primary" : "border-border hover:border-primary hover:bg-primary/5 text-foreground"
                  }`}
                >
                  {changingPlan && <Loader2 className="w-3 h-3 animate-spin inline mr-1" />}
                  {plan.name} {plan.price > 0 ? `₹${plan.price}` : ""}
                  {isActive && " ✓"}
                </button>
              );
            })}
          </div>
        </div>

        {/* Subscription history */}
        {userSubs.length > 0 && (
          <div>
            <p className="text-[10px] text-muted-foreground mb-2">History</p>
            <div className="space-y-1.5">
              {userSubs.map(sub => {
                const plan = plans.find(p => p.id === sub.plan_id);
                return (
                  <div key={sub.id} className="flex items-center gap-2 text-xs">
                    <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-full ${STATUS_COLORS[sub.status] || STATUS_COLORS.expired}`}>{sub.status}</span>
                    <span className="text-foreground font-medium">{plan?.name || sub.plan_id}</span>
                    <span className="text-muted-foreground">₹{sub.amount || 0}</span>
                    <span className="text-muted-foreground ml-auto">{format(new Date(sub.created_at), "MMM d, yyyy")}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 14-Day Study Trend */}
      <div className="glass rounded-xl neural-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" /> 14-Day Study Trend
        </h3>
        {studyTrend.length > 0 ? (() => {
          const max = Math.max(...studyTrend.map(d => d.minutes), 1);
          return (
            <div className="flex items-end gap-1 h-24">
              {studyTrend.map((d, i) => (
                <div key={i} className="flex-1 flex flex-col items-center gap-1 group relative">
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-foreground text-background text-[8px] px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                    {d.date}: {d.minutes}min
                  </div>
                  <div
                    className="w-full rounded-t bg-primary/60 hover:bg-primary transition-colors min-h-[2px]"
                    style={{ height: `${Math.max(2, (d.minutes / max) * 100)}%` }}
                  />
                </div>
              ))}
            </div>
          );
        })() : (
          <p className="text-xs text-muted-foreground text-center py-4">No study data</p>
        )}
        <div className="flex justify-between text-[8px] text-muted-foreground">
          <span>{studyTrend[0]?.date}</span>
          <span>{studyTrend[studyTrend.length - 1]?.date}</span>
        </div>
      </div>

      {/* Exam History */}
      <div className="glass rounded-xl neural-border p-4 space-y-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Award className="w-4 h-4 text-accent" /> Exam History
        </h3>
        {examHistory.length > 0 ? (
          <div className="space-y-2">
            {examHistory.map((exam: any) => {
              const pct = Math.round((exam.score / exam.total_questions) * 100);
              const color = pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive";
              return (
                <div key={exam.id} className="flex items-center gap-3 p-2.5 bg-secondary/50 rounded-lg">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center ${pct >= 80 ? "bg-success/15" : pct >= 50 ? "bg-warning/15" : "bg-destructive/15"}`}>
                    <span className={`text-sm font-bold ${color}`}>{pct}%</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-xs font-medium text-foreground truncate">{exam.topics || "General"}</p>
                      <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{exam.difficulty}</span>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      {exam.score}/{exam.total_questions} correct
                      {exam.time_used_seconds ? ` · ${Math.round(exam.time_used_seconds / 60)}min` : ""}
                      {" · "}{formatDistanceToNow(new Date(exam.created_at), { addSuffix: true })}
                    </p>
                  </div>
                  {/* Mini progress bar */}
                  <div className="w-16 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                    <div className={`h-full rounded-full ${pct >= 80 ? "bg-success" : pct >= 50 ? "bg-warning" : "bg-destructive"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-4">No exams taken</p>
        )}
      </div>

      {/* Send Notification */}
      <SendNotificationSection userId={user.id} userName={user.display_name || "Anonymous"} toast={toast} logAudit={logAudit} />

      {/* Ban / Unban Section */}
      <div className={`glass rounded-xl neural-border p-4 space-y-3 ${isBanned ? 'border-destructive/30' : ''}`}>
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Ban className="w-4 h-4 text-destructive" /> Account Status
        </h3>

        {isBanned ? (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-destructive/10 rounded-lg">
              <XCircle className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-destructive">User is Banned</p>
                <p className="text-[10px] text-muted-foreground">
                  {user.ban_reason && `Reason: ${user.ban_reason} · `}
                  {user.banned_at && `Banned ${formatDistanceToNow(new Date(user.banned_at), { addSuffix: true })}`}
                </p>
              </div>
            </div>
            <button
              onClick={() => toggleBan(false)}
              disabled={banning}
              className="px-4 py-2 bg-success/15 text-success rounded-lg text-xs font-medium hover:bg-success/25 transition-colors flex items-center gap-1.5 disabled:opacity-50"
            >
              {banning ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />} Unban User
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 p-3 bg-success/10 rounded-lg">
              <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-success">Account Active</p>
                <p className="text-[10px] text-muted-foreground">This user can access the app normally.</p>
              </div>
            </div>

            {!showBanForm ? (
              <button
                onClick={() => setShowBanForm(true)}
                className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 transition-colors flex items-center gap-1.5"
              >
                <Ban className="w-3.5 h-3.5" /> Ban User
              </button>
            ) : (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-2">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Ban Reason</label>
                  <input
                    value={banReason}
                    onChange={e => setBanReason(e.target.value)}
                    placeholder="e.g. Violation of terms of service"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-destructive outline-none"
                  />
                </div>
                <div className="flex gap-2">
                  <button onClick={() => { setShowBanForm(false); setBanReason(""); }} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors">Cancel</button>
                  <button
                    onClick={() => {
                      if (confirm(`Are you sure you want to ban "${user.display_name || "this user"}"?`)) {
                        toggleBan(true);
                      }
                    }}
                    disabled={banning}
                    className="px-4 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50"
                  >
                    {banning ? <Loader2 className="w-3 h-3 animate-spin" /> : <Ban className="w-3 h-3" />} Confirm Ban
                  </button>
                </div>
              </motion.div>
            )}
          </div>
        )}
      </div>

      {/* Delete User Section */}
      <DeleteUserSection userId={user.id} userName={user.display_name || "Anonymous"} onDeleted={onBack} toast={toast} logAudit={logAudit} />
    </div>
  );
};

// ─── Delete User Section ───
const DeleteUserSection = ({ userId, userName, onDeleted, toast, logAudit }: {
  userId: string;
  userName: string;
  onDeleted: () => void;
  toast: any;
  logAudit: (action: string, details: Record<string, any>) => Promise<void>;
}) => {
  const [showConfirm, setShowConfirm] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [deleting, setDeleting] = useState(false);

  const handleDelete = async () => {
    if (confirmText !== "DELETE") return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("admin-delete-user", {
        body: { target_user_id: userId },
      });
      if (error || data?.error) {
        toast({ title: data?.error || error?.message || "Failed to delete user", variant: "destructive" });
        setDeleting(false);
        return;
      }
      toast({ title: `User "${userName}" has been permanently deleted` });
      onDeleted();
    } catch (e: any) {
      toast({ title: e.message || "Failed to delete user", variant: "destructive" });
      setDeleting(false);
    }
  };

  return (
    <div className="glass rounded-xl neural-border p-4 space-y-3 border-destructive/20">
      <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
        <Trash2 className="w-4 h-4 text-destructive" /> Danger Zone
      </h3>
      <div className="p-3 bg-destructive/5 rounded-lg border border-destructive/20">
        <p className="text-xs text-foreground font-medium">Permanently delete this user</p>
        <p className="text-[10px] text-muted-foreground mt-0.5">
          This action cannot be undone. All user data including profile, study logs, subscriptions, and exam history will be permanently removed.
        </p>
      </div>

      {!showConfirm ? (
        <button
          onClick={() => setShowConfirm(true)}
          className="px-4 py-2 bg-destructive/10 text-destructive rounded-lg text-xs font-medium hover:bg-destructive/20 transition-colors flex items-center gap-1.5"
        >
          <Trash2 className="w-3.5 h-3.5" /> Delete User
        </button>
      ) : (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="space-y-3">
          <div>
            <label className="text-[10px] text-muted-foreground mb-1 block">
              Type <span className="font-bold text-destructive">DELETE</span> to confirm
            </label>
            <input
              value={confirmText}
              onChange={e => setConfirmText(e.target.value)}
              placeholder="DELETE"
              className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-destructive/30 focus:border-destructive outline-none font-mono"
            />
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => { setShowConfirm(false); setConfirmText(""); }}
              disabled={deleting}
              className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting || confirmText !== "DELETE"}
              className="px-4 py-1.5 bg-destructive text-destructive-foreground rounded-lg text-xs font-medium flex items-center gap-1 disabled:opacity-50 transition-colors"
            >
              {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />} Permanently Delete
            </button>
          </div>
        </motion.div>
      )}
    </div>
  );
};

// ─── Send Notification ───
const SendNotificationSection = ({ userId, userName, toast, logAudit }: {
  userId: string;
  userName: string;
  toast: any;
  logAudit: (action: string, details: Record<string, any>) => Promise<void>;
}) => {
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [type, setType] = useState<string>("general");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGenerated, setAutoGenerated] = useState(false);
  const [channels, setChannels] = useState<Set<string>>(new Set(["push"]));

  // Auto-generate AI content on mount
  useEffect(() => {
    if (!autoGenerated) {
      setAutoGenerated(true);
      generateWithAI();
    }
  }, []);

  const toggleChannel = (ch: string) => {
    setChannels(prev => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const sendNotification = async () => {
    if (!title.trim()) {
      toast({ title: "Title is required", variant: "destructive" });
      return;
    }
    setSending(true);

    // Always send in-app notification
    const { error } = await supabase.from("notification_history").insert({
      user_id: userId,
      title: title.trim(),
      body: body.trim() || null,
      type,
      read: false,
    });
    if (error) {
      toast({ title: "Failed to send notification", variant: "destructive" });
      setSending(false);
      return;
    }

    // Send to additional channels in parallel
    const channelPromises: Promise<any>[] = [];

    if (channels.has("email")) {
      channelPromises.push(
        Promise.resolve(supabase.from("email_queue").insert({
          user_id: userId,
          to_email: "pending",
          subject: title.trim(),
          html_body: `<div style="font-family:sans-serif;padding:20px"><h2>${title.trim()}</h2><p>${body.trim() || ""}</p></div>`,
          trigger_key: "admin_manual",
          status: "pending",
          priority: "high",
          variables: {} as any,
        }))
      );
    }

    if (channels.has("whatsapp")) {
      channelPromises.push(
        Promise.resolve(supabase.from("whatsapp_queue" as any).insert({
          user_id: userId,
          message_body: `*${title.trim()}*\n${body.trim() || ""}`,
          trigger_key: "admin_manual",
          status: "pending",
          priority: "high",
        }))
      );
    }

    if (channels.has("voice")) {
      channelPromises.push(
        Promise.resolve(supabase.from("voice_notification_queue" as any).insert({
          user_id: userId,
          script: `${title.trim()}. ${body.trim() || ""}`,
          trigger_key: "admin_manual",
          status: "pending",
          priority: "high",
        }))
      );
    }

    await Promise.allSettled(channelPromises);
    await logAudit("notification_sent", { title: title.trim(), type, channels: Array.from(channels), to: userId });
    toast({ title: `Notification sent to ${userName} via ${Array.from(channels).join(", ")}` });
    setSending(false);
    setSent(true);
    setTitle("");
    setBody("");
    setTimeout(() => setSent(false), 3000);
  };

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-notification", {
        body: { userId, type },
      });
      if (error) throw error;
      if (data?.title) setTitle(data.title);
      if (data?.body) setBody(data.body);
      toast({ title: "AI generated notification content ✨" });
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e?.message || "Try again", variant: "destructive" });
    }
    setGenerating(false);
  };

  const NOTIFICATION_TYPES = [
    { value: "general", label: "General" },
    { value: "reminder", label: "Reminder" },
    { value: "achievement", label: "Achievement" },
    { value: "warning", label: "Warning" },
    { value: "system", label: "System" },
  ];

  const CHANNELS = [
    { value: "push", label: "🔔 In-App" },
    { value: "email", label: "📧 Email" },
    { value: "whatsapp", label: "💬 WhatsApp" },
    { value: "voice", label: "🔊 Voice" },
  ];

  return (
    <div className="glass rounded-xl neural-border p-4 space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bell className="w-4 h-4 text-accent" /> Send Notification
        </h3>
        {generating && (
          <span className="text-[10px] text-accent flex items-center gap-1">
            <Sparkles className="w-3 h-3 animate-pulse" /> AI is composing…
          </span>
        )}
      </div>

      <div className="space-y-3">
        {/* Notification Type */}
        <div className="flex gap-2 flex-wrap">
          {NOTIFICATION_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${type === t.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
            >
              {t.label}
            </button>
          ))}
          <button
            onClick={generateWithAI}
            disabled={generating}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors bg-accent/15 text-accent hover:bg-accent/25 flex items-center gap-1 disabled:opacity-50 ml-auto"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generating ? "Generating…" : "Regenerate AI"}
          </button>
        </div>

        {/* Delivery Channels */}
        <div>
          <label className="text-[10px] text-muted-foreground mb-1.5 block">Delivery Channels</label>
          <div className="flex gap-2 flex-wrap">
            {CHANNELS.map(ch => (
              <button
                key={ch.value}
                onClick={() => toggleChannel(ch.value)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                  channels.has(ch.value)
                    ? "border-primary/40 bg-primary/10 text-primary"
                    : "border-border text-muted-foreground hover:border-primary/20"
                }`}
              >
                {ch.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder={generating ? "AI is writing..." : "e.g. Great progress this week!"}
            maxLength={120}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Body (optional)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder={generating ? "AI is writing..." : "Add more details..."}
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none resize-none"
          />
        </div>
        <div className="flex items-center justify-between">
          <p className="text-[9px] text-muted-foreground">{title.length}/120 · {body.length}/500 · {channels.size} channel{channels.size !== 1 ? "s" : ""}</p>
          <button
            onClick={sendNotification}
            disabled={sending || !title.trim() || channels.size === 0}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1.5 hover:bg-primary/90 transition-colors disabled:opacity-50"
          >
            {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : sent ? <CheckCircle2 className="w-3 h-3" /> : <Send className="w-3 h-3" />}
            {sent ? "Sent!" : "Send Notification"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserManagement;
