import type { getVoiceSettings } from "@/hooks/useVoiceNotification";

export const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export interface DayInfo {
  label: string;
  dateStr: string;
  delivered: boolean;
  past: boolean;
}

export interface WeeklyStats {
  days: DayInfo[];
  delivered: number;
  elapsed: number;
  scheduleLabel: string;
  mondayStr: string;
  lastWeekDays: { delivered: boolean }[];
}

export function getScheduleLabel(settings: ReturnType<typeof getVoiceSettings>): string {
  const hour = settings.schedule === "custom"
    ? (settings.customHour ?? 18)
    : settings.schedule === "morning" ? 8 : settings.schedule === "afternoon" ? 14 : 19;
  return `${hour % 12 || 12}:00 ${hour >= 12 ? "PM" : "AM"}`;
}

export function getMondayOfWeek() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  monday.setHours(0, 0, 0, 0);
  return monday;
}
