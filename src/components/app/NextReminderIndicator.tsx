import { useMemo, useState, useEffect } from "react";
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

function computeInfo() {
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

  // Minutes until the target hour starts
  const targetMs = new Date(now.getFullYear(), now.getMonth(), now.getDate(), hour).getTime();
  const minsLeft = Math.max(0, Math.round((targetMs - now.getTime()) / 60000));
  const imminent = !firedToday && !alreadyPassed && minsLeft > 0 && minsLeft <= 60;

  return { enabled: true, firedToday, label, alreadyPassed, imminent, minsLeft };
}

interface Props {
  onOpenVoiceSettings?: () => void;
}

const NextReminderIndicator = ({ onOpenVoiceSettings }: Props) => {
  const [info, setInfo] = useState(computeInfo);

  useEffect(() => {
    const id = setInterval(() => setInfo(computeInfo()), 30_000);
    return () => clearInterval(id);
  }, []);

  return (
    <button
      onClick={onOpenVoiceSettings}
      className="flex items-center gap-1.5 text-[10px] hover:opacity-80 transition-opacity cursor-pointer"
    >
      {!info.enabled ? (
        <>
          <BellOff className="w-3 h-3 text-muted-foreground" />
          <span className="text-muted-foreground underline decoration-dotted">Voice reminders off</span>
        </>
      ) : (
        <>
          <Bell className={`w-3 h-3 ${info.firedToday ? "text-success" : info.imminent ? "text-warning animate-pulse" : "text-primary"}`} />
          <span className="text-muted-foreground underline decoration-dotted">
            {info.firedToday
              ? "Today's reminder sent ✓"
              : info.imminent
                ? `Firing in ~${info.minsLeft} min`
                : info.alreadyPassed
                  ? `Reminder tomorrow (${info.label})`
                  : `Next reminder: ${info.label}`}
          </span>
        </>
      )}
    </button>
  );
};

export default NextReminderIndicator;
