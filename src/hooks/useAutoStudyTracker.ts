import { useEffect, useRef, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Silent auto-study tracker that logs micro-study events in the background.
 * Tracks:
 * - Time spent on study-related tabs (Brain, Action)
 * - Topic taps/views as micro-study events
 * - Aggregates into study_logs automatically
 */

interface TrackedSession {
  subject: string;
  topic: string;
  topicId?: string;
  subjectId?: string;
  startTime: number;
}

const MIN_TRACK_SECONDS = 30; // minimum 30s to count as study
const MAX_AUTO_LOG_MINUTES = 15; // cap auto-logged sessions at 15 min
const FLUSH_INTERVAL_MS = 5 * 60 * 1000; // flush every 5 minutes

export function useAutoStudyTracker() {
  const { user } = useAuth();
  const activeSession = useRef<TrackedSession | null>(null);
  const pendingLogs = useRef<{ subject: string; topic: string; subjectId?: string; topicId?: string; durationSec: number }[]>([]);
  const flushTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track a topic view — call when user taps/views a topic
  const trackTopicView = useCallback((subject: string, topic: string, subjectId?: string, topicId?: string) => {
    // Close any previous session
    if (activeSession.current) {
      const elapsed = (Date.now() - activeSession.current.startTime) / 1000;
      if (elapsed >= MIN_TRACK_SECONDS) {
        pendingLogs.current.push({
          subject: activeSession.current.subject,
          topic: activeSession.current.topic,
          subjectId: activeSession.current.subjectId,
          topicId: activeSession.current.topicId,
          durationSec: Math.min(elapsed, MAX_AUTO_LOG_MINUTES * 60),
        });
      }
    }

    activeSession.current = { subject, topic, subjectId, topicId, startTime: Date.now() };
  }, []);

  // End tracking for the current topic
  const endTracking = useCallback(() => {
    if (activeSession.current) {
      const elapsed = (Date.now() - activeSession.current.startTime) / 1000;
      if (elapsed >= MIN_TRACK_SECONDS) {
        pendingLogs.current.push({
          subject: activeSession.current.subject,
          topic: activeSession.current.topic,
          subjectId: activeSession.current.subjectId,
          topicId: activeSession.current.topicId,
          durationSec: Math.min(elapsed, MAX_AUTO_LOG_MINUTES * 60),
        });
      }
      activeSession.current = null;
    }
  }, []);

  // Flush pending logs to the database
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
        // Find or resolve subject/topic IDs
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

        // Insert auto-detected study log
        await supabase.from("study_logs").insert({
          user_id: user.id,
          subject_id: subjectId || null,
          topic_id: topicId || null,
          duration_minutes: Math.min(entry.totalMin, MAX_AUTO_LOG_MINUTES),
          confidence_level: "medium",
          study_mode: "auto",
          notes: "Auto-detected study activity",
        });

        // Also boost memory_strength slightly (+3) for auto-tracked topics
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

  // Get today's auto-detected activity count
  const getTodayAutoLogs = useCallback(async () => {
    if (!user) return [];
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const { data } = await supabase
      .from("study_logs")
      .select("id, subject_id, topic_id, duration_minutes, created_at, notes")
      .eq("user_id", user.id)
      .eq("study_mode", "auto")
      .gte("created_at", todayStart.toISOString())
      .order("created_at", { ascending: false });

    return data || [];
  }, [user]);

  // Setup flush interval and cleanup
  useEffect(() => {
    flushTimerRef.current = setInterval(flushLogs, FLUSH_INTERVAL_MS);

    // Flush on page unload
    const handleUnload = () => {
      endTracking();
      // Use sendBeacon-style sync flush
      if (pendingLogs.current.length > 0 && user) {
        // Store pending for next session
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
        if (pendingLogs.current.length > 0) {
          flushLogs();
        }
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
  }, [user, flushLogs, endTracking]);

  return { trackTopicView, endTracking, flushLogs, getTodayAutoLogs };
}
