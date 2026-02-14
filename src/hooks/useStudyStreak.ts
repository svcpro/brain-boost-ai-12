import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayMet: boolean;
  goalMinutes: number;
  todayMinutes: number;
}

export function useStudyStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStreak = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get daily goal
      const { data: profile } = await supabase
        .from("profiles")
        .select("daily_study_goal_minutes")
        .eq("id", user.id)
        .maybeSingle();

      const goalMinutes = profile?.daily_study_goal_minutes ?? 60;

      // Get study logs for last 90 days
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data: logs } = await supabase
        .from("study_logs")
        .select("duration_minutes, created_at")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: false });

      // Group by local date
      const dailyTotals: Record<string, number> = {};
      (logs || []).forEach((l) => {
        const day = new Date(l.created_at).toLocaleDateString("en-CA"); // YYYY-MM-DD
        dailyTotals[day] = (dailyTotals[day] || 0) + (l.duration_minutes || 0);
      });

      const today = new Date().toLocaleDateString("en-CA");
      const todayMinutes = dailyTotals[today] || 0;
      const todayMet = todayMinutes >= goalMinutes;

      // Calculate current streak: count consecutive days going backwards from today/yesterday
      let currentStreak = 0;
      const checkDate = new Date();

      // If today's goal isn't met yet, start checking from yesterday
      if (!todayMet) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let i = 0; i < 90; i++) {
        const dateStr = checkDate.toLocaleDateString("en-CA");
        if ((dailyTotals[dateStr] || 0) >= goalMinutes) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // If today is met, include it
      if (todayMet) {
        // currentStreak already includes today from the loop above
      }

      // Calculate longest streak
      const sortedDays = Object.keys(dailyTotals).sort();
      let longestStreak = 0;
      let tempStreak = 0;

      for (let i = 0; i < sortedDays.length; i++) {
        if (dailyTotals[sortedDays[i]] >= goalMinutes) {
          if (i === 0) {
            tempStreak = 1;
          } else {
            const prev = new Date(sortedDays[i - 1]);
            const curr = new Date(sortedDays[i]);
            const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
            tempStreak = diffDays === 1 && dailyTotals[sortedDays[i - 1]] >= goalMinutes
              ? tempStreak + 1
              : 1;
          }
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      longestStreak = Math.max(longestStreak, currentStreak);

      setStreak({ currentStreak, longestStreak, todayMet, goalMinutes, todayMinutes });
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { streak, loading, loadStreak };
}
