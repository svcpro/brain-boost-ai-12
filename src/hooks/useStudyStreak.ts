import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  todayMet: boolean;
  goalMinutes: number;
  todayMinutes: number;
  autoShieldUsed?: boolean;
  frozenDays: Set<string>;
  dailyTotals: Record<string, number>;
}

export function useStudyStreak() {
  const { user } = useAuth();
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(false);

  const loadStreak = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get daily goal + auto-use pref
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

      // Get used freeze dates
      const { data: freezes } = await (supabase as any)
        .from("streak_freezes")
        .select("used_date")
        .eq("user_id", user.id)
        .not("used_date", "is", null);

      const frozenDays = new Set<string>();
      (freezes || []).forEach((f: any) => {
        if (f.used_date) frozenDays.add(f.used_date);
      });

      // Group by local date
      const dailyTotals: Record<string, number> = {};
      (logs || []).forEach((l) => {
        const day = new Date(l.created_at).toLocaleDateString("en-CA");
        dailyTotals[day] = (dailyTotals[day] || 0) + (l.duration_minutes || 0);
      });

      const today = new Date().toLocaleDateString("en-CA");
      const todayMinutes = dailyTotals[today] || 0;
      const todayMet = todayMinutes >= goalMinutes;

      // Calculate current streak (frozen days count as met)
      let currentStreak = 0;
      const checkDate = new Date();

      if (!todayMet && !frozenDays.has(today)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }

      for (let i = 0; i < 90; i++) {
        const dateStr = checkDate.toLocaleDateString("en-CA");
        const dayMet = (dailyTotals[dateStr] || 0) >= goalMinutes;
        const dayFrozen = frozenDays.has(dateStr);
        if (dayMet || dayFrozen) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else {
          break;
        }
      }

      // Calculate longest streak (accounting for frozen days)
      const allDays = new Set([...Object.keys(dailyTotals), ...frozenDays]);
      const sortedDays = [...allDays].sort();
      let longestStreak = 0;
      let tempStreak = 0;

      for (let i = 0; i < sortedDays.length; i++) {
        const dayMet = (dailyTotals[sortedDays[i]] || 0) >= goalMinutes;
        const dayFrozen = frozenDays.has(sortedDays[i]);
        if (dayMet || dayFrozen) {
          if (i === 0) {
            tempStreak = 1;
          } else {
            const prev = new Date(sortedDays[i - 1]);
            const curr = new Date(sortedDays[i]);
            const diffDays = (curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24);
            const prevMet = (dailyTotals[sortedDays[i - 1]] || 0) >= goalMinutes || frozenDays.has(sortedDays[i - 1]);
            tempStreak = diffDays === 1 && prevMet ? tempStreak + 1 : 1;
          }
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
      }

      longestStreak = Math.max(longestStreak, currentStreak);

      // Auto-use freeze: if yesterday was missed and we have auto-use enabled
      // This is handled separately to trigger the DB update
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = yesterday.toLocaleDateString("en-CA");
      const yesterdayMet = (dailyTotals[yesterdayStr] || 0) >= goalMinutes;
      const yesterdayFrozen = frozenDays.has(yesterdayStr);

      if (!yesterdayMet && !yesterdayFrozen && currentStreak === 0) {
        // Check auto-use preference
        const { data: pref } = await (supabase as any)
          .from("profiles")
          .select("auto_use_streak_freeze")
          .eq("id", user.id)
          .maybeSingle();

        if (pref?.auto_use_streak_freeze) {
          // Find an available freeze
          const { data: available } = await (supabase as any)
            .from("streak_freezes")
            .select("id")
            .eq("user_id", user.id)
            .is("used_date", null)
            .limit(1);

          if (available && available.length > 0) {
            await (supabase as any)
              .from("streak_freezes")
              .update({ used_date: yesterdayStr })
              .eq("id", available[0].id);

            // Record in-app notification
            await supabase.from("notification_history").insert({
              user_id: user.id,
              title: "🛡️ Your streak was saved!",
              body: `Auto-shield activated for ${yesterdayStr} — your streak is safe.`,
              type: "streak_shield",
            } as any);

            // Re-run to get updated streak with the newly used freeze
            setLoading(false);
            // Set flag so UI can show toast on first load
            const LOCAL_KEY = `auto-shield-notified-${yesterdayStr}`;
            if (!localStorage.getItem(LOCAL_KEY)) {
              localStorage.setItem(LOCAL_KEY, "1");
              // Will be picked up after re-run
              return loadStreak().then(() => {
                setStreak(prev => prev ? { ...prev, autoShieldUsed: true } : prev);
              });
            }
            return loadStreak();
          }
        }
      }

      setStreak({ currentStreak, longestStreak, todayMet, goalMinutes, todayMinutes, frozenDays, dailyTotals });
    } finally {
      setLoading(false);
    }
  }, [user]);

  return { streak, loading, loadStreak };
}
