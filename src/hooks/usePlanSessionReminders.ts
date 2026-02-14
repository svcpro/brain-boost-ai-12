import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const REMINDER_CHECK_INTERVAL = 5 * 60 * 1000; // 5 minutes
const REMINDER_ADVANCE_MINUTES = 15; // notify 15 min before session

interface PlanSessionRow {
  id: string;
  day_name: string;
  day_date: string | null;
  topic: string;
  subject: string;
  duration_minutes: number;
  mode: string;
  completed: boolean;
}

function getTodayDayName(): string {
  return ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][new Date().getDay()];
}

export function usePlanSessionReminders() {
  const { user } = useAuth();
  const notifiedRef = useRef<Set<string>>(new Set());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const checkAndNotify = useCallback(async () => {
    if (!user) return;
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Get the latest saved plan
    const { data: plans } = await supabase
      .from("study_plans")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1);

    if (!plans || plans.length === 0) return;

    const { data: sessions } = await supabase
      .from("plan_sessions")
      .select("id, day_name, day_date, topic, subject, duration_minutes, mode, completed")
      .eq("plan_id", plans[0].id)
      .eq("completed", false);

    if (!sessions || sessions.length === 0) return;

    const todayName = getTodayDayName();
    const todaySessions = sessions.filter((s: PlanSessionRow) => s.day_name === todayName);

    for (const session of todaySessions) {
      if (notifiedRef.current.has(session.id)) continue;

      // Send notification for today's incomplete sessions
      notifiedRef.current.add(session.id);

      try {
        const reg = await navigator.serviceWorker?.ready;
        if (reg) {
          reg.showNotification("📚 Study Session Reminder", {
            body: `Time to study: ${session.topic} (${session.subject}) – ${session.duration_minutes} min ${session.mode}`,
            icon: "/pwa-192x192.png",
            badge: "/pwa-192x192.png",
            tag: `session-${session.id}`,
            data: { sessionId: session.id },
          } as NotificationOptions);
        } else {
          new Notification("📚 Study Session Reminder", {
            body: `Time to study: ${session.topic} (${session.subject}) – ${session.duration_minutes} min ${session.mode}`,
            icon: "/pwa-192x192.png",
            tag: `session-${session.id}`,
          });
        }
      } catch {
        // Fallback to basic notification
        new Notification("📚 Study Session Reminder", {
          body: `Time to study: ${session.topic} (${session.subject}) – ${session.duration_minutes} min`,
        });
      }
    }
  }, [user]);

  const startReminders = useCallback(() => {
    // Initial check
    checkAndNotify();
    // Periodic checks
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(checkAndNotify, REMINDER_CHECK_INTERVAL);
  }, [checkAndNotify]);

  const stopReminders = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  useEffect(() => {
    return () => stopReminders();
  }, [stopReminders]);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!("Notification" in window)) return false;
    if (Notification.permission === "granted") return true;
    if (Notification.permission === "denied") return false;
    const result = await Notification.requestPermission();
    return result === "granted";
  }, []);

  return { startReminders, stopReminders, requestPermission, checkAndNotify };
}
