import { useState } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { getMondayOfWeek } from "./weekly-reminder/types";
import { useWeeklyReminderData } from "./weekly-reminder/useWeeklyReminderData";
import DayDetailPanel from "./weekly-reminder/DayDetailPanel";
import StudyBarChart from "./weekly-reminder/StudyBarChart";
import WeeklyTrendComparison from "./weekly-reminder/WeeklyTrendComparison";
import { NudgeWithFeedback, UndoDismiss } from "./weekly-reminder/MotivationalNudge";

const WeeklyReminderSummary = () => {
  const [activeDot, setActiveDot] = useState<number | null>(null);
  const { stats, dailyMinutes, lastWeekMinutes } = useWeeklyReminderData();
  const [nudgeDismissed, setNudgeDismissed] = useState<"visible" | "undo" | "hidden">(() => {
    try {
      const dismissed = localStorage.getItem("acry-nudge-dismissed");
      return dismissed === getMondayOfWeek().toLocaleDateString("en-CA") ? "hidden" : "visible";
    } catch { return "visible"; }
  });

  if (!stats) return null;

  const ignoredCount = stats.days.filter((d, i) => d.delivered && dailyMinutes[i] === 0).length;
  const lastWeekIgnored = stats.lastWeekDays.filter((d, i) => d.delivered && lastWeekMinutes[i] === 0).length;
  const nudgeThreshold = getVoiceSettings().nudgeThreshold ?? 2;

  return (
    <div className="glass rounded-xl p-4 neural-border">
      {/* Header */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <Bell className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">Voice Reminders</span>
        </div>
        <span className="text-[10px] text-muted-foreground">This week</span>
      </div>

      {/* Delivery dots */}
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

      {/* Expandable day detail */}
      <DayDetailPanel
        activeDot={activeDot}
        days={stats.days}
        dailyMinutes={dailyMinutes}
        scheduleLabel={stats.scheduleLabel}
      />

      {/* Study bar chart with legend */}
      <StudyBarChart days={stats.days} dailyMinutes={dailyMinutes} />

      {/* Week-over-week trend */}
      <WeeklyTrendComparison ignoredCount={ignoredCount} lastWeekIgnored={lastWeekIgnored} />

      {/* Motivational messages */}
      {stats.delivered === stats.elapsed && stats.delivered > 0 ? (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-success">
          <CheckCircle2 className="w-3 h-3" />
          <span>Perfect streak so far!</span>
        </div>
      ) : ignoredCount >= nudgeThreshold && nudgeDismissed === "visible" ? (
        <NudgeWithFeedback ignoredCount={ignoredCount} onDismiss={() => setNudgeDismissed("undo")} />
      ) : ignoredCount >= nudgeThreshold && nudgeDismissed === "undo" ? (
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

export default WeeklyReminderSummary;
