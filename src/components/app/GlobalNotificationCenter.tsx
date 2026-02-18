import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Loader2,
  X, Brain, AlertTriangle, BookOpen, TrendingUp, Users,
  CreditCard, Shield, Megaphone, Settings, Sparkles,
  ChevronRight, Clock, Zap, Award, Volume2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { notifyFeedback } from "@/lib/feedback";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read: boolean;
  created_at: string;
  action_url: string | null;
  priority: string;
}

const TYPE_CONFIG: Record<string, { icon: any; label: string; gradient: string; bg: string }> = {
  ai_brain:        { icon: Brain,          label: "AI Brain",       gradient: "from-primary/20 to-accent/10",    bg: "bg-primary/10" },
  memory_risk:     { icon: AlertTriangle,  label: "Memory Risk",    gradient: "from-destructive/20 to-warning/10", bg: "bg-destructive/10" },
  study_reminder:  { icon: BookOpen,       label: "Study",          gradient: "from-accent/20 to-primary/10",    bg: "bg-accent/10" },
  rank_update:     { icon: TrendingUp,     label: "Rank Update",    gradient: "from-warning/20 to-accent/10",    bg: "bg-warning/10" },
  community:       { icon: Users,          label: "Community",      gradient: "from-primary/15 to-accent/10",    bg: "bg-primary/10" },
  subscription:    { icon: CreditCard,     label: "Subscription",   gradient: "from-warning/20 to-primary/10",   bg: "bg-warning/10" },
  security:        { icon: Shield,         label: "Security",       gradient: "from-destructive/20 to-warning/10", bg: "bg-destructive/10" },
  admin_broadcast: { icon: Megaphone,      label: "Announcement",   gradient: "from-accent/20 to-primary/10",    bg: "bg-accent/10" },
  system:          { icon: Settings,       label: "System",         gradient: "from-muted/30 to-secondary/20",   bg: "bg-muted/20" },
  weekly_insight:  { icon: Sparkles,       label: "Insight",        gradient: "from-primary/20 to-accent/10",    bg: "bg-primary/10" },
  streak_milestone:{ icon: Zap,            label: "Streak",         gradient: "from-warning/25 to-accent/10",    bg: "bg-warning/10" },
  freeze_gift:     { icon: Sparkles,       label: "Gift",           gradient: "from-accent/20 to-primary/10",    bg: "bg-accent/10" },
  achievement:     { icon: Award,          label: "Achievement",    gradient: "from-warning/25 to-primary/10",   bg: "bg-warning/10" },
  warning:         { icon: AlertTriangle,  label: "Warning",        gradient: "from-destructive/20 to-warning/10", bg: "bg-destructive/10" },
  reminder:        { icon: Clock,          label: "Reminder",       gradient: "from-accent/15 to-primary/10",    bg: "bg-accent/10" },
  general:         { icon: Bell,           label: "General",        gradient: "from-primary/15 to-accent/10",    bg: "bg-primary/10" },
  voice:           { icon: Volume2,        label: "Voice",          gradient: "from-warning/20 to-accent/10",    bg: "bg-warning/10" },
};

const PRIORITY_ACCENT: Record<string, string> = {
  high: "border-l-destructive shadow-[inset_0_0_20px_-8px_hsl(var(--destructive)/0.15)]",
  medium: "border-l-warning",
  low: "border-l-border",
};

const FILTER_TABS = [
  { key: "all", label: "All", icon: null },
  { key: "unread", label: "Unread", icon: null },
  { key: "ai_brain", label: "AI", icon: "🧠" },
  { key: "study_reminder", label: "Study", icon: "📚" },
  { key: "community", label: "Social", icon: "👥" },
  { key: "subscription", label: "Billing", icon: "💳" },
  { key: "security", label: "Security", icon: "🛡️" },
];

interface GlobalNotificationCenterProps {
  unreadCount: number;
  setUnreadCount: (fn: (c: number) => number) => void;
}

const GlobalNotificationCenter = ({ unreadCount, setUnreadCount }: GlobalNotificationCenterProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("notification_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    setNotifications((data || []) as Notification[]);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    if (open) load();
  }, [open, load]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("global-notif-center")
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "notification_history",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev].slice(0, 100));
        setUnreadCount((c) => c + 1);
        notifyFeedback();
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "notification_history",
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const updated = payload.new as Notification;
        setNotifications((prev) => prev.map((n) => n.id === updated.id ? updated : n));
        if (updated.read && !(payload.old as any).read) {
          setUnreadCount((c) => Math.max(0, c - 1));
        }
      })
      .on("postgres_changes", {
        event: "DELETE",
        schema: "public",
        table: "notification_history",
      }, (payload) => {
        const oldId = (payload.old as any).id;
        setNotifications((prev) => {
          const removed = prev.find((n) => n.id === oldId);
          if (removed && !removed.read) setUnreadCount((c) => Math.max(0, c - 1));
          return prev.filter((n) => n.id !== oldId);
        });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, setUnreadCount]);

  const markRead = async (id: string) => {
    await (supabase as any).from("notification_history").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await (supabase as any).from("notification_history").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(() => 0);
  };

  const deleteNotification = async (id: string) => {
    const n = notifications.find((x) => x.id === id);
    await (supabase as any).from("notification_history").delete().eq("id", id);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const handleClick = (n: Notification) => {
    if (!n.read) markRead(n.id);
    if (n.action_url) {
      window.location.href = n.action_url;
      setOpen(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (filter === "all") return true;
    if (filter === "unread") return !n.read;
    return n.type === filter;
  });

  const getConfig = (type: string | null) => TYPE_CONFIG[type || "general"] || TYPE_CONFIG.general;

  const groupByDate = (items: Notification[]) => {
    const groups: { label: string; items: Notification[] }[] = [];
    const today: Notification[] = [];
    const yesterday: Notification[] = [];
    const earlier: Notification[] = [];
    for (const n of items) {
      const d = new Date(n.created_at);
      if (isToday(d)) today.push(n);
      else if (isYesterday(d)) yesterday.push(n);
      else earlier.push(n);
    }
    if (today.length) groups.push({ label: "Today", items: today });
    if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
    if (earlier.length) groups.push({ label: "Earlier", items: earlier });
    return groups;
  };

  const panel = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-background/70 backdrop-blur-md z-[9998]"
            onClick={() => setOpen(false)}
          />

          {/* Panel - slides from right */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed top-0 right-0 w-full max-w-[420px] h-full z-[9999] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Glassmorphism container */}
            <div className="flex flex-col h-full bg-gradient-to-b from-card via-card to-background border-l border-border/50 shadow-[-20px_0_60px_-15px_hsl(var(--primary)/0.1)]">

              {/* Header with glow */}
              <div className="relative px-5 pt-5 pb-4">
                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none" />
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/20 flex items-center justify-center shadow-[0_0_20px_-5px_hsl(var(--primary)/0.3)]">
                        <Bell className="w-5 h-5 text-primary" />
                      </div>
                      {unreadCount > 0 && (
                        <span className="absolute -top-1 -right-1 min-w-[20px] h-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1.5 shadow-[0_0_10px_hsl(var(--destructive)/0.4)]">
                          {unreadCount}
                        </span>
                      )}
                    </div>
                    <div>
                      <h2 className="text-base font-bold text-foreground tracking-tight">Notifications</h2>
                      <p className="text-[11px] text-muted-foreground mt-0.5">
                        {unreadCount > 0 ? `${unreadCount} new alert${unreadCount > 1 ? "s" : ""}` : "✨ All caught up!"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    {unreadCount > 0 && (
                      <button
                        onClick={markAllRead}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium text-primary hover:bg-primary/10 transition-all active:scale-95"
                      >
                        <CheckCheck className="w-3.5 h-3.5" />
                        Read all
                      </button>
                    )}
                    <button
                      onClick={() => setOpen(false)}
                      className="p-2 rounded-xl hover:bg-secondary/80 transition-all active:scale-90"
                    >
                      <X className="w-4 h-4 text-muted-foreground" />
                    </button>
                  </div>
                </div>

                {/* Filter chips */}
                <div className="flex items-center gap-1.5 mt-4 overflow-x-auto scrollbar-none pb-0.5">
                  {FILTER_TABS.map((f) => (
                    <button
                      key={f.key}
                      onClick={() => setFilter(f.key)}
                      className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 ${
                        filter === f.key
                          ? "bg-primary text-primary-foreground shadow-[0_2px_10px_-2px_hsl(var(--primary)/0.4)]"
                          : "bg-secondary/60 text-muted-foreground hover:bg-secondary hover:text-foreground"
                      }`}
                    >
                      {f.icon && <span className="mr-1">{f.icon}</span>}
                      {f.label}
                      {f.key === "unread" && unreadCount > 0 && (
                        <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                          filter === f.key ? "bg-primary-foreground/20 text-primary-foreground" : "bg-destructive/15 text-destructive"
                        }`}>
                          {unreadCount}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              {/* Divider with glow */}
              <div className="h-px bg-gradient-to-r from-transparent via-border to-transparent" />

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        <Loader2 className="w-5 h-5 animate-spin text-primary" />
                      </div>
                      <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-ping" />
                    </div>
                    <p className="text-[11px] text-muted-foreground">Loading notifications…</p>
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <div className="relative">
                      <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-secondary/80 to-muted/40 flex items-center justify-center border border-border/50">
                        <BellOff className="w-8 h-8 text-muted-foreground/30" />
                      </div>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-muted-foreground">No notifications</p>
                      <p className="text-[11px] text-muted-foreground/50 mt-1">
                        {filter === "all" ? "You're all caught up! 🎉" : "Nothing in this category yet"}
                      </p>
                    </div>
                  </div>
                ) : (
                  <div className="px-3 py-2 space-y-1">
                    {groupByDate(filtered).map((group) => (
                      <div key={group.label}>
                        {/* Date header */}
                        <div className="flex items-center gap-2.5 px-2 pt-4 pb-2">
                          <span className="text-[10px] font-bold text-muted-foreground/80 uppercase tracking-[0.08em]">
                            {group.label}
                          </span>
                          <div className="flex-1 h-px bg-gradient-to-r from-border/40 to-transparent" />
                          <span className="text-[9px] text-muted-foreground/50 tabular-nums">{group.items.length}</span>
                        </div>

                        <AnimatePresence>
                          {group.items.map((n, idx) => {
                            const cfg = getConfig(n.type);
                            const Icon = cfg.icon;
                            return (
                              <motion.div
                                key={n.id}
                                initial={{ opacity: 0, y: 8 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, x: -60, height: 0, marginBottom: 0 }}
                                transition={{ delay: idx * 0.025, duration: 0.25 }}
                                layout
                              >
                                <div
                                  onClick={() => handleClick(n)}
                                  className={`group relative rounded-xl cursor-pointer transition-all duration-200 border-l-[3px] mb-1.5 ${
                                    n.read
                                      ? "bg-secondary/20 hover:bg-secondary/40 " + (PRIORITY_ACCENT[n.priority] || PRIORITY_ACCENT.medium)
                                      : "bg-gradient-to-r " + cfg.gradient + " hover:brightness-110 border-l-primary shadow-[0_1px_8px_-3px_hsl(var(--primary)/0.15)]"
                                  }`}
                                >
                                  <div className="flex items-start gap-3 p-3">
                                    {/* Icon with glow for unread */}
                                    <div className={`relative w-9 h-9 rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105 ${
                                      n.read ? "bg-secondary/50" : cfg.bg + " shadow-[0_0_12px_-3px_hsl(var(--primary)/0.2)]"
                                    }`}>
                                      <Icon className={`w-4 h-4 ${n.read ? "text-muted-foreground/60" : "text-primary"}`} />
                                      {!n.read && (
                                        <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary border-2 border-card shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
                                      )}
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                      <p className={`text-[12px] font-semibold leading-snug ${
                                        n.read ? "text-muted-foreground/80" : "text-foreground"
                                      }`}>
                                        {n.title}
                                      </p>
                                      {n.body && (
                                        <p className={`text-[11px] leading-relaxed mt-0.5 line-clamp-2 ${
                                          n.read ? "text-muted-foreground/50" : "text-foreground/60"
                                        }`}>
                                          {n.body}
                                        </p>
                                      )}
                                      <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
                                        <span className={`text-[9px] px-2 py-0.5 rounded-full font-semibold ${
                                          n.read ? "bg-secondary/60 text-muted-foreground/60" : cfg.bg + " text-primary"
                                        }`}>
                                          {cfg.label}
                                        </span>
                                        {n.priority === "high" && (
                                          <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-semibold">
                                            Urgent
                                          </span>
                                        )}
                                        <span className="text-[9px] text-muted-foreground/50 tabular-nums">
                                          {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                        </span>
                                      </div>
                                    </div>

                                    {/* Hover actions */}
                                    <div className="flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-all duration-200 shrink-0 translate-x-1 group-hover:translate-x-0">
                                      {!n.read && (
                                        <button
                                          onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                          className="p-1.5 rounded-lg hover:bg-primary/15 transition-colors"
                                          title="Mark as read"
                                        >
                                          <Check className="w-3 h-3 text-primary" />
                                        </button>
                                      )}
                                      <button
                                        onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                        className="p-1.5 rounded-lg hover:bg-destructive/15 transition-colors"
                                        title="Delete"
                                      >
                                        <Trash2 className="w-3 h-3 text-destructive/70" />
                                      </button>
                                    </div>
                                  </div>

                                  {/* Action arrow */}
                                  {n.action_url && (
                                    <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-60 transition-opacity">
                                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            );
                          })}
                        </AnimatePresence>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="relative p-2 rounded-xl hover:bg-secondary/80 transition-all active:scale-90 group"
        title="Notifications"
      >
        <Bell className={`w-5 h-5 transition-colors ${unreadCount > 0 ? "text-primary" : "text-foreground/70 group-hover:text-foreground"}`} />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 shadow-[0_0_8px_hsl(var(--destructive)/0.5)] animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Render panel via portal to avoid z-index conflicts */}
      {createPortal(panel, document.body)}
    </>
  );
};

export default GlobalNotificationCenter;
