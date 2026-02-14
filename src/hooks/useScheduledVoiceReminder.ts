import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { useVoice } from "@/pages/AppDashboard";
import { getCache, setCache } from "@/lib/offlineCache";

const CHECK_INTERVAL = 60 * 1000; // check every minute
const FIRED_KEY = "voice-schedule-fired-date";

function getScheduleHour(settings: ReturnType<typeof getVoiceSettings>): number {
  switch (settings.schedule) {
    case "morning": return 8;
    case "afternoon": return 14;
    case "evening": return 19;
    case "custom": return settings.customHour ?? 18;
    default: return 8;
  }
}

/**
 * Fires a scheduled daily voice reminder once per day at the user's preferred time.
 * Uses in-app interval polling (works while app is open).
 */
export function useScheduledVoiceReminder() {
  const { user } = useAuth();
  const voice = useVoice();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const check = useCallback(async () => {
    if (!user || !voice) return;

    const settings = getVoiceSettings();
    if (!settings.enabled) return;

    const now = new Date();
    const todayStr = now.toLocaleDateString("en-CA"); // YYYY-MM-DD
    const firedDate = getCache<string>(FIRED_KEY);

    // Already fired today
    if (firedDate === todayStr) return;

    const targetHour = getScheduleHour(settings);

    // Only fire if we're within the target hour window (target hour + 0-59 min)
    if (now.getHours() !== targetHour) return;

    // Mark as fired for today
    setCache(FIRED_KEY, todayStr);

    // Append to weekly delivery log
    const logKey = "voice-reminder-log";
    const log = getCache<string[]>(logKey) || [];
    log.push(todayStr);
    // Keep only last 14 days
    const cutoff = new Date(now.getTime() - 14 * 86400000).toLocaleDateString("en-CA");
    setCache(logKey, log.filter(d => d >= cutoff));

    // Fetch today's context: upcoming plan sessions or general daily reminder
    try {
      const { data: plans } = await supabase
        .from("study_plans")
        .select("id")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      let topic: string | undefined;
      let subject: string | undefined;
      let dailyMinutes: number | undefined;

      if (plans && plans.length > 0) {
        const dayName = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][now.getDay()];

        const { data: sessions } = await supabase
          .from("plan_sessions")
          .select("topic, subject, duration_minutes")
          .eq("plan_id", plans[0].id)
          .eq("completed", false)
          .eq("day_name", dayName)
          .limit(1);

        if (sessions && sessions.length > 0) {
          topic = sessions[0].topic;
          subject = sessions[0].subject;
          dailyMinutes = sessions[0].duration_minutes;
        }
      }

      // If no plan session, check today's total logged minutes vs goal
      if (!topic) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("daily_study_goal_minutes")
          .eq("id", user.id)
          .maybeSingle();

        dailyMinutes = profile?.daily_study_goal_minutes ?? 60;
      }

      voice.speak("daily_reminder", {
        topic,
        subject,
        daily_minutes: dailyMinutes,
      });
    } catch {
      // Offline or error — skip silently
    }
  }, [user, voice]);

  useEffect(() => {
    // Initial check
    check();

    // Poll every minute
    intervalRef.current = setInterval(check, CHECK_INTERVAL);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [check]);
}
