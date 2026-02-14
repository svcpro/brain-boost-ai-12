import { useEffect, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { differenceInDays } from "date-fns";

const STALE_DAYS = 3; // Flag questions not practiced in 3+ days

export const useWeakQuestionReminder = () => {
  const { user } = useAuth();
  const checkedRef = useRef(false);

  const checkWeakQuestions = useCallback(async () => {
    if (!user) return;

    // Check if already notified today
    const notifiedKey = `weak_q_reminder_${new Date().toDateString()}`;
    if (sessionStorage.getItem(notifiedKey)) return;

    // Check notification permission
    if (!("Notification" in window) || Notification.permission !== "granted") return;

    // Check user pref for reminders
    const { data: profile } = await supabase
      .from("profiles")
      .select("study_preferences")
      .eq("id", user.id)
      .maybeSingle();
    const prefs = (profile?.study_preferences as Record<string, any>) || {};
    if (prefs.weak_question_reminders === false) return;

    // Find stale weak questions
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - STALE_DAYS);

    const { data: weakQs, count } = await supabase
      .from("question_performance")
      .select("id, question_text, last_seen_at, times_wrong", { count: "exact" })
      .eq("user_id", user.id)
      .gte("times_wrong", 2)
      .lt("last_seen_at", cutoff.toISOString())
      .order("times_wrong", { ascending: false })
      .limit(1);

    const staleCount = count ?? 0;
    if (staleCount === 0) return;

    const oldest = weakQs?.[0];
    const daysSince = oldest ? differenceInDays(new Date(), new Date(oldest.last_seen_at)) : STALE_DAYS;

    new Notification("🧠 Weak questions need review!", {
      body: `You have ${staleCount} weak question${staleCount > 1 ? "s" : ""} not practiced in ${daysSince}+ days. Retry them to boost retention!`,
      icon: "/favicon.ico",
      tag: "weak-question-reminder",
    });

    sessionStorage.setItem(notifiedKey, "1");
  }, [user]);

  useEffect(() => {
    if (!user || checkedRef.current) return;
    checkedRef.current = true;

    // Check after 5s delay (let app settle)
    const timeout = setTimeout(() => checkWeakQuestions(), 5000);

    // Re-check every 2 hours
    const interval = setInterval(() => checkWeakQuestions(), 2 * 60 * 60 * 1000);

    return () => {
      clearTimeout(timeout);
      clearInterval(interval);
    };
  }, [user, checkWeakQuestions]);
};
