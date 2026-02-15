import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, Gift, Flame, BookOpen, Brain, Sparkles, Clock } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCache, setCache } from "@/lib/offlineCache";

const PREF_KEY = "push-notif-prefs";

export interface PushNotifPrefs {
  freezeGifts: boolean;
  streakMilestones: boolean;
  studyReminders: boolean;
  brainUpdateReminders: boolean;
  weeklyInsights: boolean;
  dailyBriefing: boolean;
}

const defaultPrefs: PushNotifPrefs = {
  freezeGifts: true,
  streakMilestones: true,
  studyReminders: true,
  brainUpdateReminders: true,
  weeklyInsights: true,
  dailyBriefing: true,
};

export function getPushNotifPrefs(): PushNotifPrefs {
  return getCache<PushNotifPrefs>(PREF_KEY) ?? defaultPrefs;
}

export function setPushNotifPrefs(prefs: PushNotifPrefs) {
  setCache(PREF_KEY, prefs);
}

const NotificationPreferencesPanel = () => {
  const { permission, subscribed, supported, error: pushError, subscribe, unsubscribe } = usePushNotifications();
  const { toast } = useToast();
  const { user } = useAuth();
  const [prefs, setPrefs] = useState<PushNotifPrefs>(defaultPrefs);
  const [loaded, setLoaded] = useState(false);
  const [lastBriefingAt, setLastBriefingAt] = useState<string | null>(null);

  // Load prefs + last briefing timestamp from DB on mount
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profiles")
      .select("push_notification_prefs")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.push_notification_prefs) {
          const dbPrefs = { ...defaultPrefs, ...data.push_notification_prefs };
          setPrefs(dbPrefs);
          setPushNotifPrefs(dbPrefs);
        }
        setLoaded(true);
      });

    // Fetch last daily briefing notification
    (supabase as any)
      .from("notification_history")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_briefing")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data?.created_at) {
          setLastBriefingAt(data.created_at);
        }
      });
  }, [user]);

  // Save prefs to DB + local cache
  const updatePrefs = useCallback(async (updated: PushNotifPrefs) => {
    setPrefs(updated);
    setPushNotifPrefs(updated);
    if (user) {
      await (supabase as any)
        .from("profiles")
        .update({ push_notification_prefs: updated })
        .eq("id", user.id);
    }
  }, [user]);

  const handleMasterToggle = async () => {
    if (subscribed) {
      await unsubscribe();
      toast({ title: "Push notifications disabled" });
    } else {
      const ok = await subscribe();
      if (ok) {
        toast({ title: "🔔 Push notifications enabled!" });
      }
      // Error toast is handled below via pushError state
    }
  };

  const toggleItems = [
    {
      icon: Gift,
      label: "Freeze gifts",
      desc: "When someone sends you a streak freeze",
      key: "freezeGifts" as const,
    },
    {
      icon: Flame,
      label: "Streak milestones",
      desc: "Celebrate 7, 14, and 30-day streaks",
      key: "streakMilestones" as const,
    },
    {
      icon: BookOpen,
      label: "Study reminders",
      desc: "Reminders when topics need revision",
      key: "studyReminders" as const,
    },
    {
      icon: Brain,
      label: "Brain update reminders",
      desc: "Nudge when you haven't updated your brain in 24h",
      key: "brainUpdateReminders" as const,
    },
    {
      icon: Sparkles,
      label: "Weekly insights",
      desc: "AI-generated study recommendations every Monday",
      key: "weeklyInsights" as const,
    },
    {
      icon: Brain,
      label: "Daily morning briefing",
      desc: "AI cognitive summary sent every morning",
      key: "dailyBriefing" as const,
      extra: lastBriefingAt ? (
        <div className="flex items-center gap-1 mt-1 ml-6">
          <Clock className="w-3 h-3 text-muted-foreground" />
          <span className="text-[10px] text-muted-foreground">
            Last briefing {formatDistanceToNow(new Date(lastBriefingAt), { addSuffix: true })}
          </span>
        </div>
      ) : null,
    },
  ];

  if (!supported) return null;

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="glass rounded-xl p-4 neural-border space-y-4 mt-1">
        {/* Master toggle */}
        <div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-semibold text-foreground">Push Notifications</span>
            <button
              onClick={handleMasterToggle}
              className={`w-10 h-6 rounded-full transition-all relative ${subscribed ? "bg-primary" : "bg-secondary"}`}
            >
              <motion.div
                className="w-4 h-4 rounded-full bg-white absolute top-1"
                animate={{ left: subscribed ? 22 : 4 }}
                transition={{ type: "spring", stiffness: 500, damping: 30 }}
              />
            </button>
          </div>
          <p className="text-[10px] text-muted-foreground mt-1">
            {subscribed
              ? "Receiving push notifications on this device"
              : permission === "denied"
              ? "Blocked by browser — enable in your browser's site settings, then try again"
              : "Enable to receive alerts on this device"}
          </p>
          {pushError && !subscribed && (
            <p className="text-[10px] text-destructive mt-1">{pushError}</p>
          )}
        </div>

        {subscribed && (
          <>
            <div className="border-t border-border" />

            {toggleItems.map((item, i) => (
              <div key={item.key} className={i > 0 ? "border-t border-border pt-3" : ""}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <item.icon className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm text-foreground">{item.label}</span>
                  </div>
                  <button
                    onClick={() => {
                      const updated = { ...prefs, [item.key]: !prefs[item.key] };
                      updatePrefs(updated);
                      toast({ title: updated[item.key] ? `${item.label} notifications enabled` : `${item.label} notifications disabled` });
                    }}
                    className={`w-10 h-6 rounded-full transition-all relative ${prefs[item.key] ? "bg-primary" : "bg-secondary"}`}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-1"
                      animate={{ left: prefs[item.key] ? 22 : 4 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1 ml-6">{item.desc}</p>
                {"extra" in item && item.extra}
              </div>
            ))}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default NotificationPreferencesPanel;
