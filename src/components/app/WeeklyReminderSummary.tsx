import { useMemo } from "react";
import { Bell, CheckCircle2 } from "lucide-react";
import { getCache } from "@/lib/offlineCache";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";

const WeeklyReminderSummary = () => {
  const stats = useMemo(() => {
    const settings = getVoiceSettings();
    if (!settings.enabled) return null;

    const now = new Date();
    const log = getCache<string[]>("voice-reminder-log") || [];

    // Get Monday of current week
    const day = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - ((day + 6) % 7));
    monday.setHours(0, 0, 0, 0);
    const mondayStr = monday.toLocaleDateString("en-CA");

    const thisWeek = log.filter(d => d >= mondayStr);
    const delivered = thisWeek.length;

    // Days elapsed this week (1-7)
    const elapsed = Math.min(7, Math.floor((now.getTime() - monday.getTime()) / 86400000) + 1);

    return { delivered, elapsed };
  }, []);

  if (!stats) return null;

  const dots = Array.from({ length: 7 }, (_, i) => i < stats.delivered);

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
          {dots.map((filled, i) => (
            <div
              key={i}
              className={`w-2.5 h-2.5 rounded-full transition-colors ${
                filled
                  ? "bg-success shadow-[0_0_4px_hsl(var(--success)/0.5)]"
                  : i < stats.elapsed
                    ? "bg-destructive/30"
                    : "bg-muted"
              }`}
            />
          ))}
        </div>
        <div className="flex items-center gap-1 ml-auto">
          <span className="text-lg font-bold text-foreground">{stats.delivered}</span>
          <span className="text-[10px] text-muted-foreground">/ 7</span>
        </div>
      </div>
      {stats.delivered === stats.elapsed && stats.delivered > 0 && (
        <div className="flex items-center gap-1 mt-2 text-[10px] text-success">
          <CheckCircle2 className="w-3 h-3" />
          <span>Perfect streak so far!</span>
        </div>
      )}
    </div>
  );
};

export default WeeklyReminderSummary;
