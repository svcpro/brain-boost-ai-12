import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache } from "@/lib/offlineCache";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { DAY_LABELS, getScheduleLabel, getMondayOfWeek, type WeeklyStats } from "./types";

export function useWeeklyReminderData() {
  const { user } = useAuth();
  const [dailyMinutes, setDailyMinutes] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);
  const [lastWeekMinutes, setLastWeekMinutes] = useState<number[]>([0, 0, 0, 0, 0, 0, 0]);

  const stats = useMemo<WeeklyStats | null>(() => {
    const settings = getVoiceSettings();
    if (!settings.enabled) return null;

    const now = new Date();
    const log = getCache<string[]>("voice-reminder-log") || [];
    const monday = getMondayOfWeek();
    const mondayStr = monday.toLocaleDateString("en-CA");
    const thisWeekSet = new Set(log.filter(d => d >= mondayStr));
    const elapsed = Math.min(7, Math.floor((now.getTime() - monday.getTime()) / 86400000) + 1);

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

  return { stats, dailyMinutes, lastWeekMinutes };
}
