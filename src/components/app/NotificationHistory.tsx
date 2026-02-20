import { useState, useEffect, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, Check, CheckCheck, Trash2, Loader2,
  Sparkles, Brain, AlertTriangle, BookOpen,
  Zap, Award, Clock, Volume2, ChevronDown, ArrowLeft, Filter
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, isToday, isYesterday, format } from "date-fns";
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

const TYPE_META: Record<string, { icon: any; label: string; color: string; bg: string }> = {
  freeze_gift:      { icon: Sparkles,      label: "Gift",        color: "text-accent",       bg: "bg-accent/10" },
  streak_milestone: { icon: Zap,           label: "Streak",      color: "text-warning",      bg: "bg-warning/10" },
  study_reminder:   { icon: BookOpen,      label: "Study",       color: "text-primary",      bg: "bg-primary/10" },
  weekly_insight:   { icon: Sparkles,      label: "Insight",     color: "text-primary",      bg: "bg-primary/10" },
  ai_brain:         { icon: Brain,         label: "AI Brain",    color: "text-primary",      bg: "bg-primary/10" },
  memory_risk:      { icon: AlertTriangle, label: "Risk",        color: "text-destructive",  bg: "bg-destructive/10" },
  achievement:      { icon: Award,         label: "Achievement", color: "text-warning",      bg: "bg-warning/10" },
  reminder:         { icon: Clock,         label: "Reminder",    color: "text-accent",       bg: "bg-accent/10" },
  voice:            { icon: Volume2,       label: "Voice",       color: "text-warning",      bg: "bg-warning/10" },
};

const DEFAULT_META = { icon: Bell, label: "General", color: "text-muted-foreground", bg: "bg-secondary/40" };
const getMeta = (type: string | null) => TYPE_META[type || ""] || DEFAULT_META;

const FILTERS = [
  { key: "all", label: "All" },
  { key: "unread", label: "Unread" },
  { key: "weekly_insight", label: "📋 Insights" },
  { key: "study_reminder", label: "📚 Study" },
  { key: "streak_milestone", label: "🔥 Streak" },
  { key: "ai_brain", label: "🧠 AI" },
];

interface NotificationHistoryProps {
  onClose?: () => void;
}

const NotificationHistory = ({ onClose }: NotificationHistoryProps) => {
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
      toast({ title: "📋 Weekly insights generated!", description: "Check your notifications." });
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

  const content = (
    <motion.div
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="fixed inset-0 z-[9999] flex flex-col bg-background"
    >
      {/* Status bar safe area */}
      <div className="w-full bg-background" style={{ paddingTop: "env(safe-area-inset-top, 0px)" }} />

      {/* Top Navigation Bar */}
      <div className="relative flex items-center justify-between px-4 py-3 bg-background border-b border-border/30">
        <div className="absolute inset-0 bg-gradient-to-b from-primary/[0.03] to-transparent pointer-events-none" />
        <div className="relative flex items-center gap-3">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-secondary/60 hover:bg-secondary flex items-center justify-center transition-all active:scale-90"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-foreground" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground tracking-tight">Notifications</h1>
            <p className="text-[10px] text-muted-foreground -mt-0.5">
              {unreadCount > 0 ? `${unreadCount} new` : "All caught up ✨"}
            </p>
          </div>
        </div>

        <div className="relative flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              onClick={markAllRead}
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-primary hover:bg-primary/10 transition-all active:scale-95"
            >
              <CheckCheck className="w-3.5 h-3.5" />
              Read all
            </button>
          )}
          {notifications.length > 0 && (
            <button
              onClick={() => setShowClearConfirm(true)}
              className="w-8 h-8 rounded-lg hover:bg-destructive/10 flex items-center justify-center transition-all active:scale-90"
            >
              <Trash2 className="w-3.5 h-3.5 text-destructive/60" />
            </button>
          )}
        </div>
      </div>

      {/* Sticky filter + insights section */}
      <div className="bg-background/95 backdrop-blur-sm border-b border-border/20">
        {/* Filter chips */}
        <div className="px-4 py-2.5">
          <div className="flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            {FILTERS.map((f) => (
              <button
                key={f.key}
                onClick={() => setActiveFilter(f.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-full text-[11px] font-medium transition-all active:scale-95 shrink-0 ${
                  activeFilter === f.key
                    ? "bg-primary text-primary-foreground shadow-[0_2px_8px_-2px_hsl(var(--primary)/0.35)]"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
                }`}
              >
                {f.label}
                {f.key === "unread" && unreadCount > 0 && (
                  <span className={`ml-1.5 text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                    activeFilter === f.key ? "bg-primary-foreground/20" : "bg-destructive/15 text-destructive"
                  }`}>
                    {unreadCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Generate Insights */}
        <div className="px-4 pb-3">
          <button
            onClick={triggerWeeklyInsights}
            disabled={generatingInsights || isCoolingDown}
            className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-primary/10 via-accent/8 to-primary/10 hover:from-primary/15 hover:to-primary/15 border border-primary/15 transition-all text-[11px] font-semibold text-primary disabled:opacity-40 disabled:cursor-not-allowed active:scale-[0.98]"
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
      </div>

      {/* Scrollable notification list */}
      <div className="flex-1 overflow-y-auto overscroll-contain">
        {loading ? (
          <div className="flex flex-col items-center justify-center h-64 gap-3">
            <div className="relative">
              <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Loader2 className="w-5 h-5 animate-spin text-primary" />
              </div>
              <div className="absolute inset-0 rounded-2xl bg-primary/5 animate-ping" />
            </div>
            <p className="text-[11px] text-muted-foreground">Loading notifications…</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-72 gap-4">
            <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-secondary/80 to-muted/30 flex items-center justify-center border border-border/30">
              <BellOff className="w-8 h-8 text-muted-foreground/25" />
            </div>
            <div className="text-center px-8">
              <p className="text-sm font-semibold text-muted-foreground">
                {notifications.length === 0 ? "No notifications yet" : "Nothing here"}
              </p>
              <p className="text-[11px] text-muted-foreground/50 mt-1 leading-relaxed">
                {notifications.length === 0
                  ? "Your alerts and insights will appear here as you study"
                  : "Try selecting a different filter above"}
              </p>
            </div>
          </div>
        ) : (
          <div className="px-4 pb-24">
            {groupByDate(filtered).map((group) => (
              <div key={group.label}>
                {/* Date group header */}
                <div className="flex items-center gap-2.5 pt-5 pb-2">
                  <span className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-[0.1em]">
                    {group.label}
                  </span>
                  <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
                  <span className="text-[9px] text-muted-foreground/40 tabular-nums font-medium">
                    {group.items.length}
                  </span>
                </div>

                <div className="space-y-2">
                  <AnimatePresence>
                    {group.items.map((n, idx) => {
                      const meta = getMeta(n.type);
                      const Icon = meta.icon;
                      const isExpanded = expandedId === n.id;

                      return (
                        <motion.div
                          key={n.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, x: -50, height: 0, marginBottom: 0 }}
                          transition={{ delay: idx * 0.02, duration: 0.25 }}
                          layout
                          onClick={() => {
                            if (!n.read) markRead(n.id);
                            setExpandedId(isExpanded ? null : n.id);
                          }}
                          className={`relative rounded-2xl cursor-pointer transition-all duration-200 overflow-hidden ${
                            n.read
                              ? "bg-card/60 border border-border/20"
                              : "bg-gradient-to-br from-primary/[0.06] via-card to-accent/[0.04] border border-primary/20 shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.12)]"
                          }`}
                        >
                          <div className="flex items-start gap-3 p-3.5">
                            {/* Type Icon */}
                            <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center ${
                              n.read ? "bg-secondary/50" : meta.bg
                            }`}>
                              <Icon className={`w-4.5 h-4.5 ${n.read ? "text-muted-foreground/40" : meta.color}`} />
                            </div>

                            {/* Content */}
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-[13px] font-semibold leading-snug pr-1 ${
                                  n.read ? "text-muted-foreground" : "text-foreground"
                                }`}>
                                  {n.title}
                                </p>
                                <div className="flex items-center gap-1.5 shrink-0 mt-0.5">
                                  {!n.read && (
                                    <span className="w-2.5 h-2.5 rounded-full bg-primary shadow-[0_0_8px_hsl(var(--primary)/0.5)] animate-pulse" />
                                  )}
                                </div>
                              </div>

                              {/* Body */}
                              {n.body && (
                                <motion.div
                                  initial={false}
                                  animate={{ height: isExpanded ? "auto" : "2.6em" }}
                                  className="overflow-hidden"
                                >
                                  <p className={`text-[11px] leading-relaxed mt-1.5 ${
                                    n.read ? "text-muted-foreground/55" : "text-foreground/60"
                                  } ${isExpanded || n.type === "weekly_insight" ? "whitespace-pre-line" : "line-clamp-2"}`}>
                                    {n.body}
                                  </p>
                                </motion.div>
                              )}

                              {/* Meta row */}
                              <div className="flex items-center gap-2 mt-2">
                                <span className="text-[10px] text-muted-foreground/45 tabular-nums">
                                  {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                                </span>
                                <span className={`text-[9px] font-semibold px-2 py-0.5 rounded-md ${
                                  n.read ? "bg-secondary/50 text-muted-foreground/40" : `${meta.bg} ${meta.color}/70`
                                }`}>
                                  {meta.label}
                                </span>
                                {n.body && !isExpanded && n.type !== "weekly_insight" && (
                                  <ChevronDown className="w-3 h-3 text-muted-foreground/25" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Swipe-to-action hint on expanded */}
                          <AnimatePresence>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: "auto", opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="flex items-center justify-end gap-2 px-4 pb-3 pt-0"
                              >
                                {!n.read && (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); markRead(n.id); }}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 hover:bg-primary/15 text-[10px] font-medium text-primary transition-all active:scale-95"
                                  >
                                    <Check className="w-3 h-3" />
                                    Mark read
                                  </button>
                                )}
                                <button
                                  onClick={(e) => deleteNotification(n.id, e)}
                                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive/10 hover:bg-destructive/15 text-[10px] font-medium text-destructive transition-all active:scale-95"
                                >
                                  <Trash2 className="w-3 h-3" />
                                  Delete
                                </button>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Bottom safe area */}
      <div className="w-full bg-background" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} />
    </motion.div>
  );

  return (
    <>
      <AnimatePresence>
        {createPortal(content, document.body)}
      </AnimatePresence>

      <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <AlertDialogContent className="max-w-[340px] rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">Clear all notifications?</AlertDialogTitle>
            <AlertDialogDescription className="text-xs">
              This permanently deletes all notifications. This cannot be undone.
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
