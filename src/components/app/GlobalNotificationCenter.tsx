import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Loader2,
  X, Brain, AlertTriangle, BookOpen, TrendingUp, Users,
  CreditCard, Shield, Megaphone, Settings, Sparkles,
  ChevronRight, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
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

const TYPE_CONFIG: Record<string, { icon: any; label: string; color: string }> = {
  ai_brain: { icon: Brain, label: "AI Brain", color: "text-primary" },
  memory_risk: { icon: AlertTriangle, label: "Memory Risk", color: "text-destructive" },
  study_reminder: { icon: BookOpen, label: "Study Reminder", color: "text-accent" },
  rank_update: { icon: TrendingUp, label: "Rank Update", color: "text-warning" },
  community: { icon: Users, label: "Community", color: "text-primary" },
  subscription: { icon: CreditCard, label: "Subscription", color: "text-warning" },
  security: { icon: Shield, label: "Security", color: "text-destructive" },
  admin_broadcast: { icon: Megaphone, label: "Announcement", color: "text-accent" },
  system: { icon: Settings, label: "System", color: "text-muted-foreground" },
  weekly_insight: { icon: Sparkles, label: "Weekly Insight", color: "text-primary" },
  streak_milestone: { icon: TrendingUp, label: "Streak", color: "text-warning" },
  freeze_gift: { icon: Sparkles, label: "Gift", color: "text-accent" },
  achievement: { icon: TrendingUp, label: "Achievement", color: "text-warning" },
  warning: { icon: AlertTriangle, label: "Warning", color: "text-destructive" },
  reminder: { icon: Clock, label: "Reminder", color: "text-accent" },
  general: { icon: Bell, label: "General", color: "text-primary" },
};

const PRIORITY_STYLES: Record<string, string> = {
  high: "border-l-4 border-l-destructive",
  medium: "border-l-4 border-l-warning",
  low: "border-l-4 border-l-muted",
};

const FILTER_TABS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "ai_brain", label: "🧠 AI" },
  { key: "study_reminder", label: "📚 Study" },
  { key: "community", label: "👥 Community" },
  { key: "subscription", label: "💳 Billing" },
];

interface GlobalNotificationCenterProps {
  unreadCount: number;
  setUnreadCount: (fn: (c: number) => number) => void;
}

const GlobalNotificationCenter = ({ unreadCount, setUnreadCount }: GlobalNotificationCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
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

  return (
    <>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative p-2 rounded-lg hover:bg-secondary transition-colors"
        title="Notifications"
      >
        <Bell className="w-5 h-5 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        )}
      </button>

      {/* Overlay */}
      <AnimatePresence>
        {open && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-background/60 backdrop-blur-sm z-50"
              onClick={() => setOpen(false)}
            />
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.97 }}
              transition={{ type: "spring", damping: 25, stiffness: 350 }}
              className="fixed top-0 right-0 w-full max-w-md h-full bg-card border-l border-border z-50 flex flex-col shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Bell className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">Notifications</h2>
                    <p className="text-[10px] text-muted-foreground">
                      {unreadCount > 0 ? `${unreadCount} unread` : "All caught up!"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  {unreadCount > 0 && (
                    <button
                      onClick={markAllRead}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <CheckCheck className="w-3.5 h-3.5" />
                      Mark all read
                    </button>
                  )}
                  <button
                    onClick={() => setOpen(false)}
                    className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
                  >
                    <X className="w-4 h-4 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Filter Tabs */}
              <div className="flex items-center gap-1 px-4 py-2.5 border-b border-border overflow-x-auto scrollbar-none">
                {FILTER_TABS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setFilter(f.key)}
                    className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[10px] font-medium transition-colors ${
                      filter === f.key
                        ? "bg-primary/15 text-primary"
                        : "text-muted-foreground hover:bg-secondary"
                    }`}
                  >
                    {f.label}
                    {f.key === "unread" && unreadCount > 0 && (
                      <span className="ml-1 text-[9px] bg-destructive/20 text-destructive px-1.5 py-0.5 rounded-full">
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto">
                {loading ? (
                  <div className="flex items-center justify-center py-16">
                    <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
                  </div>
                ) : filtered.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 gap-3">
                    <div className="w-16 h-16 rounded-full bg-secondary/50 flex items-center justify-center">
                      <BellOff className="w-7 h-7 text-muted-foreground/40" />
                    </div>
                    <p className="text-xs text-muted-foreground font-medium">No notifications</p>
                    <p className="text-[10px] text-muted-foreground/60">
                      {filter === "all" ? "You're all caught up!" : "No notifications of this type"}
                    </p>
                  </div>
                ) : (
                  <div className="py-2">
                    {groupByDate(filtered).map((group) => (
                      <div key={group.label}>
                        <div className="flex items-center gap-2 px-5 pt-3 pb-1.5">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                            {group.label}
                          </span>
                          <div className="flex-1 h-px bg-border/50" />
                          <span className="text-[9px] text-muted-foreground">{group.items.length}</span>
                        </div>
                        <AnimatePresence>
                          {group.items.map((n, idx) => {
                            const cfg = getConfig(n.type);
                            const Icon = cfg.icon;
                            return (
                              <motion.div
                                key={n.id}
                                initial={{ opacity: 0, x: 10 }}
                                animate={{ opacity: 1, x: 0 }}
                                exit={{ opacity: 0, x: -50, height: 0 }}
                                transition={{ delay: idx * 0.02 }}
                                onClick={() => handleClick(n)}
                                className={`group mx-3 mb-1 rounded-xl cursor-pointer transition-colors ${
                                  n.read ? "bg-secondary/30 hover:bg-secondary/50" : "bg-accent/10 hover:bg-accent/15"
                                } ${PRIORITY_STYLES[n.priority] || PRIORITY_STYLES.medium}`}
                              >
                                <div className="flex items-start gap-3 p-3.5">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                                    n.read ? "bg-secondary/60" : "bg-primary/10"
                                  }`}>
                                    <Icon className={`w-4 h-4 ${n.read ? "text-muted-foreground" : cfg.color}`} />
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                      <p className={`text-[12px] font-semibold leading-snug ${
                                        n.read ? "text-muted-foreground" : "text-foreground"
                                      }`}>
                                        {n.title}
                                      </p>
                                      {!n.read && (
                                        <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1" />
                                      )}
                                    </div>
                                    {n.body && (
                                      <p className={`text-[11px] leading-relaxed mt-0.5 line-clamp-2 ${
                                        n.read ? "text-muted-foreground/70" : "text-foreground/70"
                                      }`}>
                                        {n.body}
                                      </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-1.5">
                                      <span className={`text-[9px] px-1.5 py-0.5 rounded-full bg-secondary/60 font-medium ${cfg.color}`}>
                                        {cfg.label}
                                      </span>
                                      <span className="text-[9px] text-muted-foreground">
                                        {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                      </span>
                                      {n.action_url && (
                                        <ChevronRight className="w-3 h-3 text-muted-foreground ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
                                      )}
                                    </div>
                                  </div>
                                  {/* Action buttons */}
                                  <div className="flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                    {!n.read && (
                                      <button
                                        onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                        className="p-1 rounded-md hover:bg-secondary"
                                        title="Mark as read"
                                      >
                                        <Check className="w-3 h-3 text-primary" />
                                      </button>
                                    )}
                                    <button
                                      onClick={(e) => { e.stopPropagation(); deleteNotification(n.id); }}
                                      className="p-1 rounded-md hover:bg-destructive/15"
                                      title="Delete"
                                    >
                                      <Trash2 className="w-3 h-3 text-destructive" />
                                    </button>
                                  </div>
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
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};

export default GlobalNotificationCenter;
