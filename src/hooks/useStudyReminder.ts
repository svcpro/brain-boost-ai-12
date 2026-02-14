import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface ReminderPrefs {
  enabled: boolean;
  reminderHour: number; // 0-23
}

const DEFAULT_PREFS: ReminderPrefs = { enabled: false, reminderHour: 18 };

export const useStudyReminder = () => {
  const { user } = useAuth();
  const checkedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const getPrefs = useCallback(async (): Promise<ReminderPrefs> => {
    if (!user) return DEFAULT_PREFS;
    const { data } = await supabase
      .from("profiles")
      .select("study_preferences")
      .eq("id", user.id)
      .maybeSingle();
    const prefs = data?.study_preferences as Record<string, any> | null;
    return {
      enabled: prefs?.reminder_enabled ?? false,
      reminderHour: prefs?.reminder_hour ?? 18,
    };
  }, [user]);

  const savePrefs = useCallback(async (prefs: ReminderPrefs) => {
    if (!user) return;
    // Merge with existing preferences
    const { data: profile } = await supabase
      .from("profiles")
      .select("study_preferences")
      .eq("id", user.id)
      .maybeSingle();
    const existing = (profile?.study_preferences as Record<string, any>) || {};
    await supabase
      .from("profiles")
      .update({
        study_preferences: {
          ...existing,
          reminder_enabled: prefs.enabled,
          reminder_hour: prefs.reminderHour,
        },
      })
      .eq("id", user.id);
  }, [user]);

  const hasStudiedToday = useCallback(async (): Promise<boolean> => {
    if (!user) return true;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count } = await supabase
      .from("study_logs")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());
    return (count ?? 0) > 0;
  }, [user]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  const sendNotification = useCallback(async () => {
    // Browser notification (foreground)
    if (Notification.permission === "granted") {
      new Notification("📚 Time to study!", {
        body: "You haven't studied yet today. Keep your streak alive!",
        icon: "/favicon.ico",
        tag: "study-reminder",
      });
    }

    // Push notification (background/other devices)
    if (user) {
      supabase.functions.invoke("send-push-notification", {
        body: {
          recipient_id: user.id,
          title: "📚 Time to study!",
          body: "You haven't studied yet today. Keep your streak alive!",
          data: { type: "study_reminder" },
        },
      }).catch((err) => console.warn("Study reminder push failed:", err));
    }
  }, [user]);

  const checkAndNotify = useCallback(async () => {
    const prefs = await getPrefs();
    if (!prefs.enabled) return;

    const now = new Date();
    const currentHour = now.getHours();

    // Only notify at or after the reminder hour
    if (currentHour < prefs.reminderHour) return;

    // Check if already notified this session
    const notifiedKey = `acry_reminder_${now.toDateString()}`;
    if (sessionStorage.getItem(notifiedKey)) return;

    const studied = await hasStudiedToday();
    if (studied) return;

    sendNotification();
    sessionStorage.setItem(notifiedKey, "1");
  }, [getPrefs, hasStudiedToday, sendNotification]);

  // Run check on mount and every 30 minutes
  useEffect(() => {
    if (!user || checkedRef.current) return;
    checkedRef.current = true;

    // Initial check after short delay
    const timeout = setTimeout(() => checkAndNotify(), 3000);

    // Periodic check
    intervalRef.current = setInterval(() => checkAndNotify(), 30 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, checkAndNotify]);

  return { getPrefs, savePrefs, requestPermission };
};
