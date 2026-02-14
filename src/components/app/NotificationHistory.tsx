import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, Check, CheckCheck, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

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

  return (
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
                onClick={clearAll}
                className="text-[10px] text-destructive hover:underline flex items-center gap-1"
              >
                <Trash2 className="w-3 h-3" />
                Clear all
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-6">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : notifications.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">
            No notifications yet
          </p>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            <AnimatePresence>
              {notifications.map((n) => (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className={`flex items-start gap-2 p-2.5 rounded-lg transition-colors ${
                    n.read ? "bg-secondary/20" : "bg-primary/10 border border-primary/20"
                  }`}
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
              ))}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
};

export default NotificationHistory;
