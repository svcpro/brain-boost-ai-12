import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Loader2,
  Filter, Sparkles, Brain, AlertTriangle, BookOpen,
  Zap, Award, Clock, Volume2, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
import { insightFeedback, notifyFeedback } from "@/lib/feedback";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface Notification {
  id: string;
  title: string;
  body: string | null;
  type: string | null;
  read: boolean;
  created_at: string;
}

const TYPE_META: Record<string, { icon: any; emoji: string; label: string; color: string }> = {
  freeze_gift:      { icon: Sparkles,       emoji: "❄️", label: "Gift",       color: "text-accent" },
  streak_milestone: { icon: Zap,            emoji: "🔥", label: "Streak",    color: "text-warning" },
  study_reminder:   { icon: BookOpen,       emoji: "📚", label: "Study",     color: "text-primary" },
  weekly_insight:   { icon: Sparkles,       emoji: "📋", label: "Insight",   color: "text-primary" },
  ai_brain:         { icon: Brain,          emoji: "🧠", label: "AI Brain",  color: "text-primary" },
  memory_risk:      { icon: AlertTriangle,  emoji: "⚠️", label: "Risk",     color: "text-destructive" },
  achievement:      { icon: Award,          emoji: "🏆", label: "Achievement", color: "text-warning" },
  reminder:         { icon: Clock,          emoji: "⏰", label: "Reminder",  color: "text-accent" },
  voice:            { icon: Volume2,        emoji: "🎤", label: "Voice",     color: "text-warning" },
};

const DEFAULT_META = { icon: Bell, emoji: "🔔", label: "General", color: "text-muted-foreground" };

const getMeta = (type: string | null) => TYPE_META[type || ""] || DEFAULT_META;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "weekly_insight", label: "📋 Insights" },
  { key: "study_reminder", label: "📚 Study" },
  { key: "streak_milestone", label: "🔥 Streak" },
];

const NotificationHistory = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [activeFilter, setActiveFilter] = useState("all");
  const [generatingInsights, setGeneratingInsights] = useState(false);
  const [lastInsightTime, setLastInsightTime] = useState<Date | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const COOLDOWN_HOURS = 24;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("notification_history")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50);
    const items = (data || []) as Notification[];
    setNotifications(items);
    setUnreadCount(items.filter((n) => !n.read).length);
    const lastInsight = items.find((n) => n.type === "weekly_insight");
    setLastInsightTime(lastInsight ? new Date(lastInsight.created_at) : null);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Realtime
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notif-history-rt')
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'notification_history',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        const n = payload.new as Notification;
        setNotifications((prev) => [n, ...prev].slice(0, 50));
        setUnreadCount((c) => c + 1);
        n.type === "weekly_insight" ? insightFeedback() : notifyFeedback();
      })
      .on('postgres_changes', {
        event: 'DELETE', schema: 'public', table: 'notification_history',
      }, (payload) => {
        const oldId = (payload.old as any).id;
        setNotifications((prev) => prev.filter((n) => n.id !== oldId));
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await (supabase as any).from("notification_history").update({ read: true }).eq("id", id);
    setNotifications((prev) => prev.map((n) => n.id === id ? { ...n, read: true } : n));
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await (supabase as any).from("notification_history").update({ read: true }).eq("user_id", user.id).eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    if (!user) return;
    await (supabase as any).from("notification_history").delete().eq("user_id", user.id);
    setNotifications([]);
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    const n = notifications.find((x) => x.id === id);
    await (supabase as any).from("notification_history").delete().eq("id", id);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const cooldownRemaining = lastInsightTime
    ? Math.max(0, COOLDOWN_HOURS * 60 * 60 * 1000 - (Date.now() - lastInsightTime.getTime()))
    : 0;
  const isCoolingDown = cooldownRemaining > 0;
  const cooldownHoursLeft = Math.ceil(cooldownRemaining / (1000 * 60 * 60));

  const triggerWeeklyInsights = async () => {
    if (!user || generatingInsights || isCoolingDown) return;
    setGeneratingInsights(true);
    try {
      const { error } = await supabase.functions.invoke("weekly-insights-summary");
      if (error) throw error;
      toast({ title: "📋 Weekly insights generated!", description: "Check your notifications for recommendations." });
      await load();
    } catch (err: any) {
      toast({ title: "Failed to generate insights", description: err.message || "Try again later.", variant: "destructive" });
    } finally {
      setGeneratingInsights(false);
    }
  };

  const filtered = notifications.filter((n) => {
    if (activeFilter === "all") return true;
    if (activeFilter === "unread") return !n.read;
    return n.type === activeFilter;
  });

  const groupByDate = (items: Notification[]) => {
    const today: Notification[] = [], yesterday: Notification[] = [], earlier: Notification[] = [];
    for (const n of items) {
      const d = new Date(n.created_at);
      if (isToday(d)) today.push(n);
      else if (isYesterday(d)) yesterday.push(n);
      else earlier.push(n);
    }
    const groups: { label: string; items: Notification[] }[] = [];
    if (today.length) groups.push({ label: "Today", items: today });
    if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
    if (earlier.length) groups.push({ label: "Earlier", items: earlier });
    return groups;
  };

  return (
    <>
      <motion.div
        initial={{ height: 0, opacity: 0 }}
        animate={{ height: "auto", opacity: 1 }}
        exit={{ height: 0, opacity: 0 }}
        transition={{ duration: 0.3, ease: "easeOut" }}
        className="overflow-hidden"
      >
        <div className="rounded-2xl border border-border/40 bg-card/80 backdrop-blur-sm shadow-lg mt-2 overflow-hidden">
          {/* Header */}
          <div className="relative px-4 pt-4 pb-3">
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent pointer-events-none rounded-t-2xl" />
            <div className="relative flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary/20 to-accent/10 border border-primary/15 flex items-center justify-center">
                  <Bell className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground tracking-tight">Notifications</h3>
                  <p className="text-[10px] text-muted-foreground">
                    {unreadCount > 0 ? `${unreadCount} unread` : "All caught up ✨"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllRead}
                    className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-primary hover:bg-primary/10 transition-all active:scale-95"
                  >
                    <CheckCheck className="w-3 h-3" />
                    Read all
                  </button>
                )}
                {notifications.length > 0 && (
                  <button
                    onClick={() => setShowClearConfirm(true)}
                    className="p-1.5 rounded-lg hover:bg-destructive/10 transition-all active:scale-95"
                    title="Clear all"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Filter chips — horizontal scroll */}
          {notifications.length > 0 && (
            <div className="px-4 pb-3">
              <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none pb-0.5">
                <Filter className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                {FILTERS.map((f) => (
                  <button
                    key={f.key}
                    onClick={() => setActiveFilter(f.key)}
                    className={`whitespace-nowrap px-2.5 py-1 rounded-full text-[10px] font-medium transition-all active:scale-95 shrink-0 ${
                      activeFilter === f.key
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
                    }`}
                  >
                    {f.label}
                    {f.key === "unread" && unreadCount > 0 && (
                      <span className={`ml-1 text-[9px] px-1 py-0.5 rounded-full font-bold ${
                        activeFilter === f.key ? "bg-primary-foreground/20" : "bg-destructive/15 text-destructive"
                      }`}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Generate Insights CTA */}
          <div className="px-4 pb-3">
            <button
              onClick={triggerWeeklyInsights}
              disabled={generatingInsights || isCoolingDown}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/15 hover:to-accent/15 border border-primary/15 transition-all text-[11px] font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
            >
              {generatingInsights ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <Sparkles className="w-3.5 h-3.5" />
              )}
              {generatingInsights
                ? "Generating…"
                : isCoolingDown
                  ? `Available in ~${cooldownHoursLeft}h`
                  : "Generate Weekly Insights"}
            </button>
          </div>

          <div className="h-px bg-gradient-to-r from-transparent via-border/50 to-transparent" />

          {/* Content */}
          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {loading ? (
              <div className="flex flex-col items-center justify-center py-12 gap-2">
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Loader2 className="w-4 h-4 animate-spin text-primary" />
                </div>
                <p className="text-[10px] text-muted-foreground">Loading…</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-secondary/80 to-muted/30 flex items-center justify-center border border-border/30">
                  <BellOff className="w-6 h-6 text-muted-foreground/30" />
                </div>
                <div className="text-center">
                  <p className="text-xs font-medium text-muted-foreground">
                    {notifications.length === 0 ? "No notifications yet" : "Nothing here"}
                  </p>
                  <p className="text-[10px] text-muted-foreground/50 mt-0.5">
                    {notifications.length === 0 ? "Alerts will appear here" : "Try a different filter"}
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-3 py-2">
                {groupByDate(filtered).map((group) => (
                  <div key={group.label}>
                    {/* Date header */}
                    <div className="flex items-center gap-2 px-1 pt-3 pb-1.5">
                      <span className="text-[9px] font-bold text-muted-foreground/70 uppercase tracking-[0.1em]">
                        {group.label}
                      </span>
                      <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                      <span className="text-[9px] text-muted-foreground/40 tabular-nums">{group.items.length}</span>
                    </div>

                    <AnimatePresence>
                      {group.items.map((n, idx) => {
                        const meta = getMeta(n.type);
                        const Icon = meta.icon;
                        const isExpanded = expandedId === n.id;

                        return (
                          <motion.div
                            key={n.id}
                            initial={{ opacity: 0, y: 6 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -40, height: 0 }}
                            transition={{ delay: idx * 0.02, duration: 0.2 }}
                            layout
                            onClick={() => {
                              if (!n.read) markRead(n.id);
                              setExpandedId(isExpanded ? null : n.id);
                            }}
                            className={`group relative rounded-xl cursor-pointer transition-all duration-150 mb-1.5 border ${
                              n.read
                                ? "bg-secondary/20 border-border/20 hover:bg-secondary/40"
                                : "bg-gradient-to-r from-primary/[0.06] to-accent/[0.04] border-primary/20 shadow-[0_1px_6px_-2px_hsl(var(--primary)/0.12)]"
                            }`}
                          >
                            <div className="flex items-start gap-2.5 p-3">
                              {/* Icon */}
                              <div className={`w-8 h-8 rounded-lg shrink-0 flex items-center justify-center ${
                                n.read ? "bg-secondary/60" : "bg-primary/10"
                              }`}>
                                <Icon className={`w-3.5 h-3.5 ${n.read ? "text-muted-foreground/50" : meta.color}`} />
                              </div>

                              {/* Content */}
                              <div className="flex-1 min-w-0">
                                <div className="flex items-start justify-between gap-2">
                                  <p className={`text-[12px] font-semibold leading-snug ${
                                    n.read ? "text-muted-foreground" : "text-foreground"
                                  }`}>
                                    {n.title}
                                  </p>
                                  {!n.read && (
                                    <span className="w-2 h-2 rounded-full bg-primary shrink-0 mt-1 shadow-[0_0_6px_hsl(var(--primary)/0.4)]" />
                                  )}
                                </div>

                                {/* Body preview or expanded */}
                                {n.body && (
                                  <p className={`text-[11px] leading-relaxed mt-1 ${
                                    n.read ? "text-muted-foreground/60" : "text-foreground/65"
                                  } ${isExpanded || n.type === "weekly_insight" ? "whitespace-pre-line" : "line-clamp-2"}`}>
                                    {n.body}
                                  </p>
                                )}

                                {/* Meta row */}
                                <div className="flex items-center gap-2 mt-1.5">
                                  <span className="text-[9px] text-muted-foreground/50 tabular-nums">
                                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                  </span>
                                  <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-md ${
                                    n.read ? "bg-secondary/40 text-muted-foreground/40" : "bg-primary/8 text-primary/70"
                                  }`}>
                                    {meta.label}
                                  </span>
                                  {n.body && !isExpanded && n.type !== "weekly_insight" && (
                                    <ChevronDown className="w-3 h-3 text-muted-foreground/30" />
                                  )}
                                </div>
                              </div>

                              {/* Actions */}
                              <div className="flex flex-col items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                                {!n.read && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                    className="p-1 rounded-md hover:bg-primary/10 transition-colors"
                                    title="Mark read"
                                  >
                                    <Check className="w-3 h-3 text-primary/70" />
                                  </button>
                                )}
                                <button
                                  onClick={(e) => deleteNotification(n.id, e)}
                                  className="p-1 rounded-md hover:bg-destructive/10 transition-colors"
                                  title="Delete"
                                >
                                  <Trash2 className="w-3 h-3 text-muted-foreground/40" />
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
        </div>
      </motion.div>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This will permanently delete all notifications. This cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="text-xs h-9">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => { clearAll(); setShowClearConfirm(false); }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs h-9"
            >
              Clear all
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default NotificationHistory;
