import { useMemo, useState, useEffect } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getCache } from "@/lib/offlineCache";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

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

  const stats = useMemo(() => {
    const settings = getVoiceSettings();
    if (!settings.enabled) return null;

    const now = new Date();
    const log = getCache<string[]>("voice-reminder-log") || [];
    const monday = getMondayOfWeek();
    const mondayStr = monday.toLocaleDateString("en-CA");
    const thisWeekSet = new Set(log.filter(d => d >= mondayStr));
    const elapsed = Math.min(7, Math.floor((now.getTime() - monday.getTime()) / 86400000) + 1);

    const days = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dateStr = date.toLocaleDateString("en-CA");
      const delivered = thisWeekSet.has(dateStr);
      const past = i < elapsed;
      return { label: DAY_LABELS[i], dateStr, delivered, past };
    });

    const delivered = days.filter(d => d.delivered).length;
    const scheduleLabel = getScheduleLabel(settings);

    return { days, delivered, elapsed, scheduleLabel, mondayStr };
  }, []);

  // Fetch daily study minutes for the week
  useEffect(() => {
    if (!user || !stats) return;
    const fetchMinutes = async () => {
      const monday = getMondayOfWeek();
      const sunday = new Date(monday);
      sunday.setDate(monday.getDate() + 7);

      const { data } = await supabase
        .from("study_logs")
        .select("created_at, duration_minutes")
        .eq("user_id", user.id)
        .gte("created_at", monday.toISOString())
        .lt("created_at", sunday.toISOString());

      if (!data) return;

      const mins = [0, 0, 0, 0, 0, 0, 0];
      for (const log of data) {
        const d = new Date(log.created_at);
        const dayIdx = (d.getDay() + 6) % 7; // Mon=0
        mins[dayIdx] += log.duration_minutes;
      }
      setDailyMinutes(mins);
    };
    fetchMinutes();
  }, [user, stats]);

  if (!stats) return null;

  const maxMinutes = Math.max(...dailyMinutes, 1);

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

      {(() => {
        const ignoredCount = stats.days.filter((d, i) => d.delivered && dailyMinutes[i] === 0).length;
        if (stats.delivered === stats.elapsed && stats.delivered > 0) {
          return (
            <div className="flex items-center gap-1 mt-2 text-[10px] text-success">
              <CheckCircle2 className="w-3 h-3" />
              <span>Perfect streak so far!</span>
            </div>
          );
        }
        if (ignoredCount >= 2) {
          return (
            <div className="mt-2 px-2 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-[10px] text-warning flex items-center gap-1.5">
              <Bell className="w-3 h-3 shrink-0" />
              <span>You ignored {ignoredCount} reminders this week — try studying even 5 minutes after the next one! 💪</span>
            </div>
          );
        }
        return null;
      })()}
    </div>
  );
};

export default WeeklyReminderSummary;
