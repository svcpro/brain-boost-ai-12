import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Bell, Gift, Flame, BookOpen, Brain, Sparkles, Clock, Zap, Loader2, Copy, Share2, Check, CalendarCheck, Shield, Crown, Award } from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
          const newStreak = briefingStreak + 1;
          setBriefingStreak(newStreak);

          const milestones = [7, 14, 30];
          const isMilestone = milestones.includes(newStreak);

          if (isMilestone) {
            // Big celebration for milestones
            const duration = 2500;
            const end = Date.now() + duration;
            const milestoneColors = newStreak >= 30
              ? ["#fbbf24", "#f59e0b", "#eab308", "#facc15", "#fef08a"]
              : newStreak >= 14
              ? ["#a78bfa", "#8b5cf6", "#7c3aed", "#c084fc", "#e9d5ff"]
              : ["#60a5fa", "#3b82f6", "#2563eb", "#93c5fd", "#bfdbfe"];

            const frame = () => {
              confetti({
                particleCount: 3,
                angle: 60,
                spread: 55,
                origin: { x: 0 },
                colors: milestoneColors,
              });
              confetti({
                particleCount: 3,
                angle: 120,
                spread: 55,
                origin: { x: 1 },
                colors: milestoneColors,
              });
              if (Date.now() < end) requestAnimationFrame(frame);
            };
            frame();

            const emoji = newStreak >= 30 ? "👑" : newStreak >= 14 ? "⚡" : "🔥";
            toast({ title: `${emoji} ${newStreak}-day briefing streak!`, description: "You're on fire! Keep that brain sharp." });
          } else {
            // Normal confetti
            confetti({
              particleCount: 80,
              spread: 70,
              origin: { y: 0.7 },
              colors: ["hsl(var(--primary))", "hsl(var(--accent))", "#fbbf24", "#60a5fa"],
            });
          }
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
            {briefingStreak > 0 && (() => {
              const tier = briefingStreak >= 30
                ? { icon: Crown, label: "Legendary", bg: "bg-yellow-500/15", text: "text-yellow-600 dark:text-yellow-400", ring: "ring-yellow-500/30" }
                : briefingStreak >= 14
                ? { icon: Award, label: "Dedicated", bg: "bg-purple-500/15", text: "text-purple-600 dark:text-purple-400", ring: "ring-purple-500/30" }
                : briefingStreak >= 7
                ? { icon: Shield, label: "Committed", bg: "bg-blue-500/15", text: "text-blue-600 dark:text-blue-400", ring: "ring-blue-500/30" }
                : { icon: CalendarCheck, label: "", bg: "bg-primary/10", text: "text-primary", ring: "" };
              const TierIcon = tier.icon;
              const tierThresholds = [0, 7, 14, 30];
              const currentFloor = briefingStreak >= 30 ? 30 : briefingStreak >= 14 ? 14 : briefingStreak >= 7 ? 7 : 0;
              const nextCeiling = briefingStreak >= 30 ? 30 : briefingStreak >= 14 ? 30 : briefingStreak >= 7 ? 14 : 7;
              const progress = briefingStreak >= 30 ? 100 : ((briefingStreak - currentFloor) / (nextCeiling - currentFloor)) * 100;
              const nextTier = briefingStreak >= 30
                ? null
                : briefingStreak >= 14
                ? { name: "Legendary 👑", daysLeft: 30 - briefingStreak }
                : briefingStreak >= 7
                ? { name: "Dedicated 🏅", daysLeft: 14 - briefingStreak }
                : { name: "Committed 🛡️", daysLeft: 7 - briefingStreak };
              const tooltipText = nextTier
                ? `${nextTier.daysLeft} more day${nextTier.daysLeft !== 1 ? "s" : ""} to ${nextTier.name}`
                : "🎉 Max tier reached!";
              const barColor = briefingStreak >= 30
                ? "bg-yellow-500"
                : briefingStreak >= 14
                ? "bg-purple-500"
                : briefingStreak >= 7
                ? "bg-blue-500"
                : "bg-primary";
              return (
                <TooltipProvider delayDuration={200}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <motion.div
                        key={tier.label}
                        initial={{ scale: 0.8, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className={`flex flex-col gap-1 rounded-xl px-2.5 py-1 cursor-default ${tier.bg} ${tier.ring ? `ring-1 ${tier.ring}` : ""}`}
                      >
                        <div className="flex items-center gap-1.5">
                          <TierIcon className={`w-3 h-3 ${tier.text}`} />
                          <span className={`text-[10px] font-semibold ${tier.text}`}>
                            {briefingStreak} day{briefingStreak !== 1 ? "s" : ""}
                            {tier.label ? ` · ${tier.label}` : " streak"}
                          </span>
                        </div>
                        <div className="w-full h-1 rounded-full bg-foreground/10 overflow-hidden">
                          <motion.div
                            className={`h-full rounded-full ${barColor}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.6, ease: "easeOut" }}
                          />
                        </div>
                        {nextTier && (
                          <span className="text-[8px] text-muted-foreground font-medium">
                            Next: {nextTier.name}
                          </span>
                        )}
                      </motion.div>
                    </TooltipTrigger>
                    <TooltipContent side="top" className="text-xs">
                      {tooltipText}
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              );
            })()}
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
