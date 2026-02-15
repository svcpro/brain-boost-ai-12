import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, Gift, Flame, BookOpen, Brain, Sparkles, Clock, Zap, Loader2, Copy, Share2, Check, CalendarCheck } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { getCache, setCache } from "@/lib/offlineCache";
import confetti from "canvas-confetti";

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
  const [briefingText, setBriefingText] = useState<string | null>(null);
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [briefingStreak, setBriefingStreak] = useState(0);

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

    // Fetch briefing history for streak + last timestamp
    (supabase as any)
      .from("notification_history")
      .select("created_at")
      .eq("user_id", user.id)
      .eq("type", "daily_briefing")
      .order("created_at", { ascending: false })
      .limit(90)
      .then(({ data }: any) => {
        if (!data || data.length === 0) return;
        setLastBriefingAt(data[0].created_at);

        // Compute consecutive day streak
        const uniqueDays = [...new Set(
          data.map((r: any) => new Date(r.created_at).toISOString().slice(0, 10))
        )] as string[];
        uniqueDays.sort((a: string, b: string) => b.localeCompare(a)); // newest first

        let streak = 0;
        const today = new Date();
        // Check if today or yesterday is the most recent day (allow current day to count)
        const mostRecent = new Date(uniqueDays[0] + "T12:00:00");
        const diffMs = today.getTime() - mostRecent.getTime();
        const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        if (diffDays > 1) {
          setBriefingStreak(0);
          return;
        }

        let expectedDate = new Date(today);
        if (diffDays === 1) {
          expectedDate = mostRecent;
        }

        for (const dayStr of uniqueDays) {
          const expected = expectedDate.toISOString().slice(0, 10);
          if (dayStr === expected) {
            streak++;
            expectedDate.setDate(expectedDate.getDate() - 1);
          } else if (dayStr < expected) {
            break;
          }
        }
        setBriefingStreak(streak);
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

  // On-demand briefing trigger
  const handleTriggerBriefing = useCallback(async () => {
    if (briefingLoading || !user) return;
    setBriefingLoading(true);
    setBriefingText(null);
    try {
      const { data, error } = await supabase.functions.invoke("on-demand-briefing");
      if (error) throw error;
      const text = data?.briefing;
      if (text) {
        setBriefingText(text);
        const now = new Date();
        const todayKey = `briefing-${now.toISOString().slice(0, 10)}`;
        const alreadyToday = getCache<boolean>(todayKey);
        setLastBriefingAt(now.toISOString());
        toast({ title: "🧠 Brain briefing generated!" });

        if (!alreadyToday) {
          setCache(todayKey, true);
          setBriefingStreak(prev => prev + 1);
          confetti({
            particleCount: 80,
            spread: 70,
            origin: { y: 0.7 },
            colors: ["hsl(var(--primary))", "hsl(var(--accent))", "#fbbf24", "#60a5fa"],
          });
        }
      } else {
        toast({ title: "Could not generate briefing", variant: "destructive" });
      }
    } catch (err: any) {
      console.error("Briefing error:", err);
      toast({ title: "Briefing failed", description: err?.message || "Try again later", variant: "destructive" });
    } finally {
      setBriefingLoading(false);
    }
  }, [user, briefingLoading, toast]);

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
      extra: (
        <div className="mt-2 ml-6 space-y-2">
          <div className="flex items-center gap-3 flex-wrap">
            {lastBriefingAt && (
              <div className="flex items-center gap-1">
                <Clock className="w-3 h-3 text-muted-foreground" />
                <span className="text-[10px] text-muted-foreground">
                  Last briefing {formatDistanceToNow(new Date(lastBriefingAt), { addSuffix: true })}
                </span>
              </div>
            )}
            {briefingStreak > 0 && (
              <div className="flex items-center gap-1 bg-primary/10 rounded-full px-2 py-0.5">
                <CalendarCheck className="w-3 h-3 text-primary" />
                <span className="text-[10px] font-semibold text-primary">
                  {briefingStreak} day{briefingStreak !== 1 ? "s" : ""} streak
                </span>
              </div>
            )}
          </div>
          <button
            onClick={handleTriggerBriefing}
            disabled={briefingLoading}
            className="flex items-center gap-1.5 text-[11px] font-medium text-primary hover:text-primary/80 transition-colors disabled:opacity-50"
          >
            {briefingLoading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Zap className="w-3 h-3" />
            )}
            {briefingLoading ? "Generating…" : "Get briefing now"}
          </button>
          {briefingText && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 25 }}
              className="rounded-xl overflow-hidden border border-border shadow-lg"
            >
              {/* Gradient header */}
              <div className="bg-gradient-to-r from-primary via-primary/80 to-accent px-3 py-2 flex items-center gap-2">
                <Brain className="w-4 h-4 text-primary-foreground" />
                <span className="text-[11px] font-semibold text-primary-foreground tracking-wide">
                  Brain Briefing
                </span>
                <span className="ml-auto text-[9px] text-primary-foreground/70">
                  {new Date().toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                </span>
              </div>

              {/* Body */}
              <div className="bg-card p-3 space-y-2.5">
                <p className="text-[11px] text-foreground leading-relaxed whitespace-pre-wrap">
                  {briefingText}
                </p>

                {/* Actions */}
                <div className="flex items-center gap-3 pt-1 border-t border-border">
                  <button
                    onClick={async () => {
                      await navigator.clipboard.writeText(`🧠 Brain Briefing\n\n${briefingText}`);
                      setCopied(true);
                      toast({ title: "Copied to clipboard!" });
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {copied ? <Check className="w-3 h-3 text-primary" /> : <Copy className="w-3 h-3" />}
                    {copied ? "Copied!" : "Copy"}
                  </button>
                  {typeof navigator.share === "function" && (
                    <button
                      onClick={() => {
                        navigator.share({
                          title: "🧠 My Brain Briefing",
                          text: `🧠 Brain Briefing\n\n${briefingText}`,
                        }).catch(() => {});
                      }}
                      className="flex items-center gap-1 text-[10px] font-medium text-muted-foreground hover:text-foreground transition-colors"
                    >
                      <Share2 className="w-3 h-3" />
                      Share
                    </button>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </div>
      ),
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
