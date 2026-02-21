import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Fully autonomous silent study tracker.
 * Zero user input required — tracks all app interactions automatically:
 * - Topic views/taps in Brain tab
 * - Study mode sessions (Focus, Mock, Recall, Emergency)
 * - Time spent on study-related screens
 * - Quiz/recall interactions
 * 
 * Auto-flushes to study_logs and boosts memory_strength silently.
 */

interface TrackedSession {
  subject: string;
  topic: string;
  topicId?: string;
  subjectId?: string;
  startTime: number;
}

const MIN_TRACK_SECONDS = 15; // 15s minimum to count (lowered for better detection)
const MAX_AUTO_LOG_MINUTES = 15;
const FLUSH_INTERVAL_MS = 3 * 60 * 1000; // flush every 3 minutes
const DEDUP_KEY = "acry-auto-log-dedup";

// Prevent duplicate logs for the same topic within 10 minutes
function isDuplicate(topicKey: string): boolean {
  try {
    const dedup = JSON.parse(localStorage.getItem(DEDUP_KEY) || "{}");
    const lastLog = dedup[topicKey];
    if (lastLog && Date.now() - lastLog < 10 * 60 * 1000) return true;
    dedup[topicKey] = Date.now();
    // Clean old entries
    for (const key of Object.keys(dedup)) {
      if (Date.now() - dedup[key] > 30 * 60 * 1000) delete dedup[key];
    }
    localStorage.setItem(DEDUP_KEY, JSON.stringify(dedup));
    return false;
  } catch {
    return false;
  }
}

export function useAutoStudyTracker() {
  const { user } = useAuth();
  const activeSession = useRef<TrackedSession | null>(null);
  const pendingLogs = useRef<{ subject: string; topic: string; subjectId?: string; topicId?: string; durationSec: number }[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const appOpenTime = useRef<number>(Date.now());

  // Track a topic view — call when user taps/views a topic
  const trackTopicView = useCallback((subject: string, topic: string, subjectId?: string, topicId?: string) => {
    // Close any previous session
    if (activeSession.current) {
      const elapsed = (Date.now() - activeSession.current.startTime) / 1000;
      if (elapsed >= MIN_TRACK_SECONDS) {
        const key = `${activeSession.current.subject}::${activeSession.current.topic}`;
        if (!isDuplicate(key)) {
          pendingLogs.current.push({
            subject: activeSession.current.subject,
            topic: activeSession.current.topic,
            subjectId: activeSession.current.subjectId,
            topicId: activeSession.current.topicId,
            durationSec: Math.min(elapsed, MAX_AUTO_LOG_MINUTES * 60),
          });
        }
      }
    }
    activeSession.current = { subject, topic, subjectId, topicId, startTime: Date.now() };
  }, []);

  // Track a quick interaction (e.g., micro-action completion, recall answer)
  const trackMicroInteraction = useCallback((subject: string, topic: string, durationSec: number = 30, subjectId?: string, topicId?: string) => {
    const key = `${subject}::${topic}`;
    if (!isDuplicate(key)) {
      pendingLogs.current.push({
        subject,
        topic,
        subjectId,
        topicId,
        durationSec: Math.min(durationSec, MAX_AUTO_LOG_MINUTES * 60),
      });
    }
  }, []);

  // End tracking for the current topic
  const endTracking = useCallback(() => {
    if (activeSession.current) {
      const elapsed = (Date.now() - activeSession.current.startTime) / 1000;
      if (elapsed >= MIN_TRACK_SECONDS) {
        const key = `${activeSession.current.subject}::${activeSession.current.topic}`;
        if (!isDuplicate(key)) {
          pendingLogs.current.push({
            subject: activeSession.current.subject,
            topic: activeSession.current.topic,
            subjectId: activeSession.current.subjectId,
            topicId: activeSession.current.topicId,
            durationSec: Math.min(elapsed, MAX_AUTO_LOG_MINUTES * 60),
          });
        }
      }
      activeSession.current = null;
    }
  }, []);

  // Flush pending logs to the database — fully silent, no toasts
  const flushLogs = useCallback(async () => {
    if (!user || pendingLogs.current.length === 0) return;

    const logsToFlush = [...pendingLogs.current];
    pendingLogs.current = [];

    // Aggregate by topic
    const aggregated = new Map<string, { subject: string; topic: string; subjectId?: string; topicId?: string; totalMin: number }>();

    for (const log of logsToFlush) {
      const key = `${log.subject}::${log.topic}`;
      const existing = aggregated.get(key);
      if (existing) {
        existing.totalMin += Math.ceil(log.durationSec / 60);
      } else {
        aggregated.set(key, {
          subject: log.subject,
          topic: log.topic,
          subjectId: log.subjectId,
          topicId: log.topicId,
          totalMin: Math.max(1, Math.ceil(log.durationSec / 60)),
        });
      }
    }

    for (const entry of aggregated.values()) {
      try {
        let subjectId = entry.subjectId;
        let topicId = entry.topicId;

        if (!subjectId) {
          const { data: sub } = await supabase
            .from("subjects")
            .select("id")
            .eq("user_id", user.id)
            .eq("name", entry.subject)
            .maybeSingle();
          subjectId = sub?.id;
        }

        if (!topicId && subjectId) {
          const { data: topic } = await supabase
            .from("topics")
            .select("id")
            .eq("user_id", user.id)
            .eq("subject_id", subjectId)
            .eq("name", entry.topic)
            .maybeSingle();
          topicId = topic?.id;
        }

        // Silent auto-log
        await supabase.from("study_logs").insert({
          user_id: user.id,
          subject_id: subjectId || null,
          topic_id: topicId || null,
          duration_minutes: Math.min(entry.totalMin, MAX_AUTO_LOG_MINUTES),
          confidence_level: "medium",
          study_mode: "auto",
          notes: "AI auto-detected",
        });

        // Auto-boost memory_strength (+3) silently
        if (topicId) {
          const { data: topicData } = await supabase
            .from("topics")
            .select("memory_strength")
            .eq("id", topicId)
            .maybeSingle();

          if (topicData) {
            await supabase
              .from("topics")
              .update({
                memory_strength: Math.min(99, (topicData.memory_strength || 50) + 3),
                last_revision_date: new Date().toISOString(),
              })
              .eq("id", topicId);
          }
        }
      } catch (err) {
        console.error("Auto-tracker flush error:", err);
      }
    }
  }, [user]);

  // Track total app usage time and log it as general study activity
  const logAppSession = useCallback(async () => {
    if (!user) return;
    const sessionMin = Math.round((Date.now() - appOpenTime.current) / 60000);
    if (sessionMin < 2) return; // at least 2 min app usage

    try {
      // Check if we already logged an app-session today
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const { data: existing } = await supabase
        .from("study_logs")
        .select("id")
        .eq("user_id", user.id)
        .eq("study_mode", "auto")
        .eq("notes", "AI auto-detected: app session")
        .gte("created_at", todayStart.toISOString())
        .limit(1);

      if (existing && existing.length > 0) return; // already logged today

      await supabase.from("study_logs").insert({
        user_id: user.id,
        duration_minutes: Math.min(sessionMin, 60),
        confidence_level: "medium",
        study_mode: "auto",
        notes: "AI auto-detected: app session",
      });
    } catch {}
  }, [user]);

  // Setup flush interval and cleanup
  useEffect(() => {
    appOpenTime.current = Date.now();
    flushTimerRef.current = setInterval(flushLogs, FLUSH_INTERVAL_MS);

    const handleUnload = () => {
      endTracking();
      logAppSession();
      if (pendingLogs.current.length > 0) {
        try {
          localStorage.setItem("acry-pending-auto-logs", JSON.stringify(pendingLogs.current));
        } catch {}
      }
    };

    // Recover pending logs from previous session
    try {
      const stored = localStorage.getItem("acry-pending-auto-logs");
      if (stored) {
        const recovered = JSON.parse(stored);
        pendingLogs.current.push(...recovered);
        localStorage.removeItem("acry-pending-auto-logs");
        if (pendingLogs.current.length > 0) flushLogs();
      }
    } catch {}

    window.addEventListener("beforeunload", handleUnload);
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") {
        endTracking();
        flushLogs();
      }
    });

    return () => {
      if (flushTimerRef.current) clearInterval(flushTimerRef.current);
      window.removeEventListener("beforeunload", handleUnload);
      endTracking();
      flushLogs();
    };
  }, [user, flushLogs, endTracking, logAppSession]);

  return { trackTopicView, trackMicroInteraction, endTracking, flushLogs };
}
