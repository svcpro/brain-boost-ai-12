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

  // Tracking refs (session-local deltas — added to DB totals on flush)
  const tabSwitches = useRef(0);
  const blurEvents = useRef(0);
  const rapidSwitchTimestamps = useRef<number[]>([]);
  const lastBlurAt = useRef<number>(0);
  const totalDistractedMs = useRef(0);
  const focusSessionId = useRef<string | null>(null);
  const warningCooldownRef = useRef(false);
  const flushInterval = useRef<ReturnType<typeof setInterval>>();
  // Persistent baseline loaded from DB so we accumulate across reloads instead of overwriting
  const baseline = useRef({ switches: 0, blurs: 0, distractedSec: 0, rapid: 0 });
  // Spurious-event guard: ignore micro hidden/visible flips (<400ms — dev preview re-renders, devtools, focus changes)
  const SPURIOUS_THRESHOLD_MS = 400;

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

  // Load today's score AND seed baseline so we accumulate, not overwrite
  const loadTodayScore = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const { data } = await supabase
      .from("distraction_scores")
      .select("*")
      .eq("user_id", user.id)
      .eq("score_date", today)
      .maybeSingle();
    if (data) {
      setTodayScore(data as any);
      baseline.current = {
        switches: data.tab_switches ?? 0,
        blurs: data.blur_events ?? 0,
        distractedSec: data.total_distraction_seconds ?? 0,
        rapid: data.rapid_switches ?? 0,
      };
    }
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

  // Compute and flush distraction score (accumulates with DB baseline)
  const flushScore = useCallback(async () => {
    if (!user) return;
    const today = new Date().toISOString().slice(0, 10);
    const hour = new Date().getHours();
    const lateNightMin = (hour >= 23 || hour < 5) ? 1 : 0;

    // Combine session-local deltas with DB baseline so reloads/multi-tabs don't overwrite
    const sessionSeconds = Math.round(totalDistractedMs.current / 1000);
    const totalSeconds = baseline.current.distractedSec + sessionSeconds;
    const switches = baseline.current.switches + tabSwitches.current;
    const blurs = baseline.current.blurs + blurEvents.current;
    const rapidNow = rapidSwitchTimestamps.current.filter(t => Date.now() - t < 60000).length;
    const rapid = Math.max(baseline.current.rapid, rapidNow);

    // Distraction Score: weighted formula (0-100). Tab-switch and app-blur are the SAME signal
    // counted on enter+exit, so we average them to avoid double-penalising.
    const switchSignal = (switches + blurs) / 2;
    const rawScore = Math.min(100, Math.round(
      (switchSignal * 2) + (rapid * 5) + (totalSeconds * 0.1) + (lateNightMin * 10)
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
      // Roll session deltas into baseline so the next flush doesn't double-count them
      baseline.current = { switches, blurs, distractedSec: totalSeconds, rapid };
      tabSwitches.current = 0;
      blurEvents.current = 0;
      totalDistractedMs.current = 0;
    } catch {}
  }, [user]);

  // Visibility & blur tracking
  useEffect(() => {
    if (!config.is_enabled || !user) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        // User switched away — record start time, defer counting until we know it's not spurious
        lastBlurAt.current = Date.now();

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
        // Came back — only count if the absence was meaningful (>400ms)
        if (lastBlurAt.current > 0) {
          const away = Date.now() - lastBlurAt.current;
          if (away >= SPURIOUS_THRESHOLD_MS) {
            totalDistractedMs.current += away;
            tabSwitches.current += 1;
            blurEvents.current += 1;
            // Rapid-switch detection
            rapidSwitchTimestamps.current.push(Date.now());
            rapidSwitchTimestamps.current = rapidSwitchTimestamps.current.filter(t => Date.now() - t < 30000);
            const isRapid = rapidSwitchTimestamps.current.length >= 3;
            logEvent("tab_switch", 0, { rapid: isRapid });
            logEvent("app_blur", Math.round(away / 1000));
            // In-focus warning logic (was previously in the hidden branch — moved here so it fires on real switches only)
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
              supabase.from("focus_shield_warnings").insert({
                user_id: user.id,
                warning_type: newCount >= config.max_warnings_before_freeze ? "freeze" : "distraction",
              }).then(() => {});
            }
          }
          lastBlurAt.current = 0;
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
