import { useState, useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FocusShieldConfig {
  is_enabled: boolean;
  auto_freeze_enabled: boolean;
  distraction_threshold: number;
  warning_cooldown_seconds: number;
  micro_recall_required: boolean;
  max_warnings_before_freeze: number;
  freeze_duration_seconds: number;
}

interface DistractionScore {
  distraction_score: number;
  focus_score: number;
  tab_switches: number;
  blur_events: number;
  total_distraction_seconds: number;
  rapid_switches: number;
  late_night_minutes: number;
}

const DEFAULT_CONFIG: FocusShieldConfig = {
  is_enabled: true,
  auto_freeze_enabled: true,
  distraction_threshold: 60,
  warning_cooldown_seconds: 30,
  micro_recall_required: true,
  max_warnings_before_freeze: 3,
  freeze_duration_seconds: 300,
};

export function useFocusShield() {
  const { user } = useAuth();
  const [config, setConfig] = useState<FocusShieldConfig>(DEFAULT_CONFIG);
  const [isFocusActive, setIsFocusActive] = useState(false);
  const [showWarning, setShowWarning] = useState(false);
  const [showFreeze, setShowFreeze] = useState(false);
  const [warningCount, setWarningCount] = useState(0);
  const [todayScore, setTodayScore] = useState<DistractionScore | null>(null);

  // Tracking refs
  const tabSwitches = useRef(0);
  const blurEvents = useRef(0);
  const rapidSwitchTimestamps = useRef<number[]>([]);
  const lastBlurAt = useRef<number>(0);
  const totalDistractedMs = useRef(0);
  const focusSessionId = useRef<string | null>(null);
  const warningCooldownRef = useRef(false);
  const flushInterval = useRef<ReturnType<typeof setInterval>>();

  // Load config
  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("focus_shield_config")
        .select("*")
        .limit(1)
        .single();
      if (data) setConfig(data as any);
    })();
  }, []);

  // Load today's score
  const loadTodayScore = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("distraction_scores")
      .select("*")
      .eq("user_id", user.id)
      .eq("score_date", today)
      .maybeSingle();
    if (data) setTodayScore(data as any);
  }, [user]);

  useEffect(() => { loadTodayScore(); }, [loadTodayScore]);

  // Log distraction event
  const logEvent = useCallback(async (
    eventType: string,
    durationSeconds = 0,
    context: Record<string, any> = {}
  ) => {
    if (!user) return;
    try {
      await supabase.from("distraction_events").insert({
        user_id: user.id,
        event_type: eventType,
        during_focus_session: isFocusActive,
        focus_session_id: focusSessionId.current,
        duration_seconds: durationSeconds,
        context,
      });
    } catch {}
  }, [user, isFocusActive]);

  // Compute and flush distraction score
  const flushScore = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getHours();
    const lateNightMin = (hour >= 23 || hour < 5) ? 1 : 0;

    const totalSeconds = Math.round(totalDistractedMs.current / 1000);
    const switches = tabSwitches.current;
    const blurs = blurEvents.current;
    const rapid = rapidSwitchTimestamps.current.filter(
      t => Date.now() - t < 60000
    ).length;

    // Distraction Score: weighted formula (0-100)
    const rawScore = Math.min(100, Math.round(
      (switches * 2) + (blurs * 1.5) + (rapid * 5) + (totalSeconds * 0.1) + (lateNightMin * 10)
    ));

    try {
      await supabase.from("distraction_scores").upsert({
        user_id: user.id,
        score_date: today,
        distraction_score: rawScore,
        focus_score: 100 - rawScore,
        tab_switches: switches,
        blur_events: blurs,
        total_distraction_seconds: totalSeconds,
        rapid_switches: rapid,
        late_night_minutes: lateNightMin,
      }, { onConflict: "user_id,score_date" });
      
      setTodayScore({
        distraction_score: rawScore,
        focus_score: 100 - rawScore,
        tab_switches: switches,
        blur_events: blurs,
        total_distraction_seconds: totalSeconds,
        rapid_switches: rapid,
        late_night_minutes: lateNightMin,
      });
    } catch {}
  }, [user]);

  // Visibility & blur tracking
  useEffect(() => {
    if (!config.is_enabled || !user) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away
        tabSwitches.current += 1;
        lastBlurAt.current = Date.now();

        // Check rapid switching
        rapidSwitchTimestamps.current.push(Date.now());
        rapidSwitchTimestamps.current = rapidSwitchTimestamps.current.filter(
          t => Date.now() - t < 30000
        );

        logEvent("tab_switch", 0, { rapid: rapidSwitchTimestamps.current.length >= 3 });

        // Trigger warning during focus
        if (isFocusActive && !warningCooldownRef.current) {
          const newCount = warningCount + 1;
          setWarningCount(newCount);

          if (config.auto_freeze_enabled && newCount >= config.max_warnings_before_freeze) {
            setShowFreeze(true);
            logEvent("freeze_triggered", config.freeze_duration_seconds);
          } else {
            setShowWarning(true);
            warningCooldownRef.current = true;
            setTimeout(() => { warningCooldownRef.current = false; }, config.warning_cooldown_seconds * 1000);
          }

          // Log warning
          supabase.from("focus_shield_warnings").insert({
            user_id: user.id,
            warning_type: newCount >= config.max_warnings_before_freeze ? "freeze" : "distraction",
          }).then(() => {});
        }
      } else {
        // Came back
        if (lastBlurAt.current > 0) {
          const away = Date.now() - lastBlurAt.current;
          totalDistractedMs.current += away;
          blurEvents.current += 1;
          logEvent("app_blur", Math.round(away / 1000));
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    
    // Flush every 60s
    flushInterval.current = setInterval(flushScore, 60000);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      clearInterval(flushInterval.current);
      flushScore(); // Final flush
    };
  }, [config, user, isFocusActive, warningCount, logEvent, flushScore]);

  // Start/stop focus mode
  const startFocus = useCallback((sessionId?: string) => {
    setIsFocusActive(true);
    setWarningCount(0);
    focusSessionId.current = sessionId || crypto.randomUUID();
    logEvent("focus_started");
  }, [logEvent]);

  const stopFocus = useCallback(() => {
    setIsFocusActive(false);
    focusSessionId.current = null;
    flushScore();
    logEvent("focus_ended");
  }, [logEvent, flushScore]);

  const dismissWarning = useCallback((recallPassed?: boolean) => {
    setShowWarning(false);
    if (user) {
      supabase.from("focus_shield_warnings").insert({
        user_id: user.id,
        warning_type: "recall_challenge",
        was_dismissed: true,
        recall_passed: recallPassed ?? false,
      }).then(() => {});
    }
  }, [user]);

  const dismissFreeze = useCallback(() => {
    setShowFreeze(false);
    setWarningCount(0);
  }, []);

  return {
    config,
    isFocusActive,
    showWarning,
    showFreeze,
    warningCount,
    todayScore,
    startFocus,
    stopFocus,
    dismissWarning,
    dismissFreeze,
    microRecallRequired: config.micro_recall_required,
  };
}
