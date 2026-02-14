import { useMemo } from "react";
import { Bell, BellOff } from "lucide-react";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { getCache } from "@/lib/offlineCache";

function getScheduleHour(settings: ReturnType<typeof getVoiceSettings>): number {
  switch (settings.schedule) {
    case "morning": return 8;
    case "afternoon": return 14;
    case "evening": return 19;
    case "custom": return settings.customHour ?? 18;
    default: return 8;
  }
}

const NextReminderIndicator = () => {
  const info = useMemo(() => {
    const settings = getVoiceSettings();
    if (!settings.enabled) return { enabled: false } as const;

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA");
    const firedToday = getCache<string>("voice-schedule-fired-date") === todayStr;
    const hour = getScheduleHour(settings);

    const label = settings.schedule === "custom"
      ? `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`
      : settings.schedule.charAt(0).toUpperCase() + settings.schedule.slice(1);

    const alreadyPassed = now.getHours() >= hour + 1;

    return { enabled: true, firedToday, label, alreadyPassed };
  }, []);

  if (!info.enabled) {
    return (
      <div className="flex items-center gap-1.5 text-muted-foreground text-[10px]">
        <BellOff className="w-3 h-3" />
        <span>Voice reminders off</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-[10px]">
      <Bell className={`w-3 h-3 ${info.firedToday ? "text-success" : "text-primary"}`} />
      <span className="text-muted-foreground">
        {info.firedToday
          ? "Today's reminder sent ✓"
          : info.alreadyPassed
            ? `Reminder tomorrow (${info.label})`
            : `Next reminder: ${info.label}`}
      </span>
    </div>
  );
};

export default NextReminderIndicator;
