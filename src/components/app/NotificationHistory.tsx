import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, Loader2, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, isToday, isYesterday } from "date-fns";
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

const NotificationHistory = () => {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const load = async () => {
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
    setLoading(false);
  };

  useEffect(() => { load(); }, [user]);

  // Realtime subscription for new/updated/deleted notifications
  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel('notification-history-realtime')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notification_history',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newNotif = payload.new as Notification;
          setNotifications((prev) => [newNotif, ...prev].slice(0, 50));
          setUnreadCount((c) => c + 1);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'notification_history',
        },
        (payload) => {
          const oldId = (payload.old as any).id;
          setNotifications((prev) => prev.filter((n) => n.id !== oldId));
        }
      )
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user]);

  const markRead = async (id: string) => {
    await (supabase as any)
      .from("notification_history")
      .update({ read: true })
      .eq("id", id);
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, read: true } : n))
    );
    setUnreadCount((c) => Math.max(0, c - 1));
  };

  const markAllRead = async () => {
    if (!user) return;
    await (supabase as any)
      .from("notification_history")
      .update({ read: true })
      .eq("user_id", user.id)
      .eq("read", false);
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
    setUnreadCount(0);
  };

  const clearAll = async () => {
    if (!user) return;
    await (supabase as any)
      .from("notification_history")
      .delete()
      .eq("user_id", user.id);
    setNotifications([]);
    setUnreadCount(0);
  };

  const deleteNotification = async (id: string) => {
    const n = notifications.find((x) => x.id === id);
    await (supabase as any)
      .from("notification_history")
      .delete()
      .eq("id", id);
    setNotifications((prev) => prev.filter((x) => x.id !== id));
    if (n && !n.read) setUnreadCount((c) => Math.max(0, c - 1));
  };

  const typeEmoji: Record<string, string> = {
    freeze_gift: "❄️",
    streak_milestone: "🔥",
    study_reminder: "📚",
  };

  const typeLabels: Record<string, string> = {
    freeze_gift: "Freeze Gifts",
    streak_milestone: "Streak Milestones",
    study_reminder: "Study Reminders",
  };

  const filtered = typeFilter === "all"
    ? notifications
    : notifications.filter((n) => n.type === typeFilter);

  return (
    <>
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="glass rounded-xl p-4 neural-border space-y-3 mt-1">
        <div className="flex items-center justify-between">
          <span className="text-sm font-semibold text-foreground">
            Notification History
          </span>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <button
                onClick={markAllRead}
                className="text-[10px] text-primary hover:underline flex items-center gap-1"
              >
                <CheckCheck className="w-3 h-3" />
                Mark all read
              </button>
            )}
            {notifications.length > 0 && (
              <button
                onClick={() => setShowClearConfirm(true)}
                className="text-[10px] text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>
        </div>

        {/* Type filter */}
        {notifications.length > 0 && (
          <div className="flex items-center gap-1.5 flex-wrap">
            <Filter className="w-3 h-3 text-muted-foreground" />
            {[{ key: "all", label: "All" }, ...Object.entries(typeLabels).map(([key, label]) => ({ key, label }))].map((f) => (
              <button
                key={f.key}
                onClick={() => setTypeFilter(f.key)}
                className={`text-[10px] px-2 py-0.5 rounded-full transition-colors ${
                  typeFilter === f.key
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {f.key !== "all" && typeEmoji[f.key] ? `${typeEmoji[f.key]} ` : ""}{f.label}
              </button>
            ))}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            {notifications.length === 0 ? "No notifications yet" : "No notifications of this type"}
          </p>
        ) : (
          <div className="space-y-1 max-h-64 overflow-y-auto">
            <AnimatePresence>
              {(() => {
                const groups: { label: string; items: Notification[] }[] = [];
                const today: Notification[] = [];
                const yesterday: Notification[] = [];
                const earlier: Notification[] = [];
                for (const n of filtered) {
                  const d = new Date(n.created_at);
                  if (isToday(d)) today.push(n);
                  else if (isYesterday(d)) yesterday.push(n);
                  else earlier.push(n);
                }
                if (today.length) groups.push({ label: "Today", items: today });
                if (yesterday.length) groups.push({ label: "Yesterday", items: yesterday });
                if (earlier.length) groups.push({ label: "Earlier", items: earlier });

                return groups.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider px-1 pt-2 pb-1">
                      {group.label}
                    </p>
                    {group.items.map((n) => (
                      <div key={n.id} className="relative overflow-hidden rounded-lg mb-1">
                        {/* Mark as read background revealed on swipe right */}
                        {!n.read && (
                          <div className="absolute inset-0 bg-primary flex items-center justify-start pl-4 rounded-lg">
                            <Check className="w-4 h-4 text-primary-foreground" />
                          </div>
                        )}
                        {/* Delete background revealed on swipe left */}
                        <div className="absolute inset-0 bg-destructive flex items-center justify-end pr-4 rounded-lg">
                          <Trash2 className="w-4 h-4 text-destructive-foreground" />
                        </div>
                        <motion.div
                          drag="x"
                          dragConstraints={{ left: -120, right: n.read ? 0 : 120 }}
                          dragElastic={0.1}
                          onDragEnd={(_, info) => {
                            if (info.offset.x < -80) {
                              deleteNotification(n.id);
                            } else if (info.offset.x > 80 && !n.read) {
                              markRead(n.id);
                            }
                          }}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -200 }}
                          className={`relative flex items-start gap-2 p-2.5 rounded-lg cursor-grab active:cursor-grabbing ${
                            n.read ? "bg-secondary/20" : "bg-primary/10 border border-primary/20"
                          }`}
                          style={{ touchAction: "pan-y" }}
                        >
                          <span className="text-base mt-0.5">
                            {typeEmoji[n.type || ""] || "🔔"}
                          </span>
                          <div className="flex-1 min-w-0">
                            <p className={`text-xs font-medium ${n.read ? "text-muted-foreground" : "text-foreground"}`}>
                              {n.title}
                            </p>
                            {n.body && (
                              <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">
                                {n.body}
                              </p>
                            )}
                            <p className="text-[9px] text-muted-foreground/60 mt-1">
                              {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            {!n.read && (
                              <button
                                onClick={() => markRead(n.id)}
                                className="p-1 rounded hover:bg-secondary/50"
                                title="Mark as read"
                              >
                                <Check className="w-3 h-3 text-primary" />
                              </button>
                            )}
                            <button
                              onClick={() => deleteNotification(n.id)}
                              className="p-1 rounded hover:bg-destructive/20"
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3 text-muted-foreground" />
                            </button>
                          </div>
                        </motion.div>
                      </div>
                    ))}
                  </div>
                ));
              })()}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>

    <AlertDialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Clear all notifications?</AlertDialogTitle>
          <AlertDialogDescription>
            This will permanently delete all your notifications. This action cannot be undone.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={() => { clearAll(); setShowClearConfirm(false); }} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
            Clear all
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
    </>
  );
};

export default NotificationHistory;
