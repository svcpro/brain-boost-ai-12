import { useMemo, useState, useEffect, useRef } from "react";
import { Bell, CheckCircle2, TrendingDown, TrendingUp, Minus, X, Undo2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getCache } from "@/lib/offlineCache";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { nudgeFeedback } from "@/lib/feedback";

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getScheduleLabel(settings: ReturnType<typeof getVoiceSettings>): string {
  const hour = settings.schedule === "custom"
    ? (settings.customHour ?? 18)
    : settings.schedule === "morning" ? 8 : settings.schedule === "afternoon" ? 14 : 19;
  return `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
}

function getMondayOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

const WeeklyReminderSummary = () => {
  const [activeDot, setActiveDot] = useState<number | null>(null);
  const { user } = useAuth();
  const [dailyMinutes, setDailyMinutes] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [lastWeekMinutes, setLastWeekMinutes] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [nudgeDismissed, setNudgeDismissed] = useState<"visible" | "undo" | "hidden">(() => {
    try {
      const dismissed = localStorage.getItem("acry-nudge-dismissed");
      return dismissed === getMondayOfWeek().toLocaleDateString("en-CA") ? "hidden" : "visible";
    } catch { return "visible"; }
  });

  const stats = useMemo(() => {
    const settings = getVoiceSettings();
    if (!settings.enabled) return null;

    const now = new Date();
    const log = getCache<string[]>("voice-reminder-log") || [];
    const monday = getMondayOfWeek();
    const mondayStr = monday.toLocaleDateString("en-CA");
    const thisWeekSet = new Set(log.filter(d => d >= mondayStr));
    const elapsed = Math.min(7, Math.floor((now.getTime() - monday.getTime()) / 86400000) + 1);

    // Last week delivered dates
    const lastMonday = new Date(monday);
    lastMonday.setDate(monday.getDate() - 7);
    const lastMondayStr = lastMonday.toLocaleDateString("en-CA");
    const lastWeekDeliveredDates = log.filter(d => d >= lastMondayStr && d < mondayStr);

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toLocaleDateString("en-CA");
      const delivered = thisWeekSet.has(dateStr);
      const past = i < elapsed;
      return { label: DAY_LABELS[i], dateStr, delivered, past };
    });

    // Build last week days for ignored calculation
    const lastWeekDays = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(lastMonday);
      date.setDate(lastMonday.getDate() + i);
      const dateStr = date.toLocaleDateString("en-CA");
      const delivered = lastWeekDeliveredDates.includes(dateStr);
      return { delivered };
    });

    const delivered = days.filter(d => d.delivered).length;
    const scheduleLabel = getScheduleLabel(settings);

    return { days, delivered, elapsed, scheduleLabel, mondayStr, lastWeekDays };
  }, []);

  // Fetch daily study minutes for this week and last week
  useEffect(() => {
    if (!user || !stats) return;
    const fetchMinutes = async () => {
      const monday = getMondayOfWeek();
      const lastMonday = new Date(monday);
      lastMonday.setDate(monday.getDate() - 7);
      const nextSunday = new Date(monday);
      nextSunday.setDate(monday.getDate() + 7);

      const { data } = await supabase
        .from("study_logs")
        .select("created_at, duration_minutes")
        .eq("user_id", user.id)
        .gte("created_at", lastMonday.toISOString())
        .lt("created_at", nextSunday.toISOString());

      if (!data) return;

      const thisWeek = [0, 0, 0, 0, 0, 0, 0];
      const lastWeek = [0, 0, 0, 0, 0, 0, 0];
      for (const log of data) {
        const d = new Date(log.created_at);
        const dayIdx = (d.getDay() + 6) % 7;
        if (d >= monday) {
          thisWeek[dayIdx] += log.duration_minutes;
        } else {
          lastWeek[dayIdx] += log.duration_minutes;
        }
      }
      setDailyMinutes(thisWeek);
      setLastWeekMinutes(lastWeek);
    };
    fetchMinutes();
  }, [user, stats]);

  if (!stats) return null;

  const maxMinutes = Math.max(...dailyMinutes, 1);
  const ignoredCount = stats.days.filter((d, i) => d.delivered && dailyMinutes[i] === 0).length;
  const lastWeekIgnored = stats.lastWeekDays.filter((d, i) => d.delivered && lastWeekMinutes[i] === 0).length;
  const diff = ignoredCount - lastWeekIgnored;

  const TrendIcon = diff < 0 ? TrendingDown : diff > 0 ? TrendingUp : Minus;
  const trendColor = diff < 0 ? "text-success" : diff > 0 ? "text-warning" : "text-muted-foreground";
  const trendLabel = diff < 0
    ? `${Math.abs(diff)} fewer ignored vs last week`
    : diff > 0
      ? `${diff} more ignored vs last week`
      : "Same as last week";

  return (
    <div className="glass rounded-xl p-4 neural-border">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Voice Reminders</span>
        </div>
        <span className="text-[10px] text-muted-foreground">This week</span>
      </div>
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          {stats.days.map((day, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setActiveDot(activeDot === i ? null : i)}
              className={`w-2.5 h-2.5 rounded-full transition-all cursor-pointer hover:scale-125 ${
                day.delivered
                  ? "bg-success shadow-[0_0_4px_hsl(var(--success)/0.5)]"
                  : day.past
                    ? "bg-destructive/30"
                    : "bg-muted"
              } ${activeDot === i ? "ring-1 ring-primary ring-offset-1 ring-offset-background" : ""}`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-lg font-bold text-foreground">{stats.delivered}</span>
          <span className="text-[10px] text-muted-foreground">/ 7</span>
        </div>
      </div>

      <AnimatePresence>
        {activeDot !== null && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-2 px-2 py-1.5 rounded-lg bg-secondary/40 text-[10px] flex items-center justify-between">
              <span className="text-muted-foreground">
                <span className="font-medium text-foreground">{stats.days[activeDot].label}</span>
                {" · "}
                {stats.days[activeDot].dateStr}
              </span>
              <span className={
                stats.days[activeDot].delivered && dailyMinutes[activeDot] === 0
                  ? "text-warning"
                  : stats.days[activeDot].delivered
                    ? "text-success"
                    : stats.days[activeDot].past
                      ? "text-destructive"
                      : "text-muted-foreground"
              }>
                {stats.days[activeDot].delivered && dailyMinutes[activeDot] === 0
                  ? `⚠ Ignored — 0 min studied`
                  : stats.days[activeDot].delivered
                    ? `✓ Delivered · ${dailyMinutes[activeDot]} min studied`
                    : stats.days[activeDot].past
                      ? `✗ Missed (${stats.scheduleLabel})`
                      : `Scheduled ${stats.scheduleLabel}`}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Mini bar chart: study minutes + reminder overlay */}
      <div className="mt-3 flex items-end gap-1 h-12">
        {stats.days.map((day, i) => (
          <div key={i} className="flex-1 flex flex-col items-center gap-0.5">
            <div className="w-full relative flex items-end justify-center h-8">
              <motion.div
                initial={{ height: 0 }}
                animate={{ height: `${(dailyMinutes[i] / maxMinutes) * 100}%` }}
                transition={{ duration: 0.4, delay: i * 0.05 }}
                className={`w-full rounded-t-sm min-h-[2px] ${
                  day.delivered && dailyMinutes[i] === 0
                    ? "bg-warning/40"
                    : day.delivered
                      ? "bg-success/60"
                      : day.past
                        ? "bg-muted-foreground/20"
                        : "bg-muted/40"
                }`}
              />
              {day.delivered && dailyMinutes[i] === 0 ? (
                <div className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-warning animate-pulse shadow-[0_0_3px_hsl(var(--warning)/0.6)]" />
              ) : day.delivered ? (
                <div className="absolute -top-0.5 w-1.5 h-1.5 rounded-full bg-success shadow-[0_0_3px_hsl(var(--success)/0.6)]" />
              ) : null}
            </div>
            <span className={`text-[8px] leading-none ${day.delivered && dailyMinutes[i] === 0 ? "text-warning font-bold" : "text-muted-foreground"}`}>{day.label.charAt(0)}</span>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-2 text-[8px] text-muted-foreground">
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-sm bg-success/60" /> Study mins
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-success" /> Reminder sent
          </span>
          <span className="flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-warning" /> Ignored
          </span>
        </div>
        <span className="text-[8px] text-muted-foreground">
          {dailyMinutes.reduce((a, b) => a + b, 0)} min total
        </span>
      </div>

      {/* Weekly trend comparison */}
      <div className="mt-2 flex items-center justify-between px-1">
        <div className={`flex items-center gap-1 text-[10px] ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          <span>{trendLabel}</span>
        </div>
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          <span>This: <span className={ignoredCount > 0 ? "text-warning font-semibold" : "text-success font-semibold"}>{ignoredCount}</span></span>
          <span>Last: <span className="font-semibold">{lastWeekIgnored}</span></span>
        </div>
      </div>

      {/* Motivational messages */}
      {stats.delivered === stats.elapsed && stats.delivered > 0 ? (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-success">
          <CheckCircle2 className="w-3 h-3" />
          <span>Perfect streak so far!</span>
        </div>
      ) : ignoredCount >= (getVoiceSettings().nudgeThreshold ?? 2) && nudgeDismissed === "visible" ? (
        <NudgeWithFeedback ignoredCount={ignoredCount} onDismiss={() => setNudgeDismissed("undo")} />
      ) : ignoredCount >= (getVoiceSettings().nudgeThreshold ?? 2) && nudgeDismissed === "undo" ? (
        <UndoDismiss onUndo={() => setNudgeDismissed("visible")} onExpire={() => {
          setNudgeDismissed("hidden");
          try {
            localStorage.setItem("acry-nudge-dismissed", getMondayOfWeek().toLocaleDateString("en-CA"));
          } catch {}
        }} />
      ) : null}
    </div>
  );
};

/** Brief undo bar that auto-expires after 4 seconds */
const UndoDismiss = ({ onUndo, onExpire }: { onUndo: () => void; onExpire: () => void }) => {
  useEffect(() => {
    const timer = setTimeout(onExpire, 4000);
    return () => clearTimeout(timer);
  }, [onExpire]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-2 px-2 py-1.5 rounded-lg bg-secondary/40 border border-border text-[10px] text-muted-foreground flex items-center justify-between"
    >
      <span>Nudge dismissed</span>
      <button
        type="button"
        onClick={onUndo}
        className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
      >
        <Undo2 className="w-3 h-3" />
        Undo
      </button>
    </motion.div>
  );
};

/** Small component that triggers feedback once on mount */
const NudgeWithFeedback = ({ ignoredCount, onDismiss }: { ignoredCount: number; onDismiss: () => void }) => {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      nudgeFeedback();
    }
  }, []);

  return (
    <div className="mt-2 px-2 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-[10px] text-warning flex items-center gap-1.5">
      <Bell className="w-3 h-3 shrink-0" />
      <span className="flex-1">You ignored {ignoredCount} reminders this week — try studying even 5 minutes after the next one! 💪</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-warning/20 transition-colors"
        aria-label="Dismiss nudge"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

export default WeeklyReminderSummary;
