import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { peekAll, removeFromQueue, queueLength } from "@/lib/offlineQueue";
import type { QueuedStudyLog } from "@/lib/offlineQueue";

async function syncEntry(entry: QueuedStudyLog, userId: string): Promise<boolean> {
  try {
    // Find or create subject
    let { data: subject } = await supabase
      .from("subjects")
      .select("id")
      .eq("user_id", userId)
      .eq("name", entry.subjectName)
      .maybeSingle();

    if (!subject) {
      const { data: newSubject, error: subErr } = await supabase
        .from("subjects")
        .insert({ user_id: userId, name: entry.subjectName })
        .select("id")
        .single();
      if (subErr) throw subErr;
      subject = newSubject;
    }

    let topicId = null;
    if (entry.topicName && subject) {
      let { data: topic } = await supabase
        .from("topics")
        .select("id")
        .eq("user_id", userId)
        .eq("subject_id", subject.id)
        .eq("name", entry.topicName)
        .maybeSingle();

      if (!topic) {
        const { data: newTopic, error: topErr } = await supabase
          .from("topics")
          .insert({
            user_id: userId,
            subject_id: subject.id,
            name: entry.topicName,
            memory_strength: entry.confidenceLevel === "high" ? 80 : entry.confidenceLevel === "medium" ? 50 : 30,
            last_revision_date: entry.createdAt,
          })
          .select("id")
          .single();
        if (topErr) throw topErr;
        topic = newTopic;
      } else {
        await supabase
          .from("topics")
          .update({ last_revision_date: entry.createdAt })
          .eq("id", topic.id);
      }
      topicId = topic?.id;
    }

    const { error: logErr } = await supabase.from("study_logs").insert({
      user_id: userId,
      subject_id: subject?.id,
      topic_id: topicId,
      duration_minutes: entry.durationMinutes,
      confidence_level: entry.confidenceLevel,
      study_mode: entry.studyMode,
      created_at: entry.createdAt,
    });

    if (logErr) throw logErr;
    return true;
  } catch {
    return false;
  }
}

export function useOfflineSync() {
  const { user } = useAuth();
  const { toast } = useToast();
  const syncingRef = useRef(false);

  const syncAll = async () => {
    if (!user || syncingRef.current || !navigator.onLine) return;
    const queue = peekAll();
    if (queue.length === 0) return;

    syncingRef.current = true;
    let synced = 0;

    for (const entry of queue) {
      const ok = await syncEntry(entry, user.id);
      if (ok) {
        removeFromQueue(entry.id);
        synced++;
      } else {
        // Stop on first failure (likely still offline)
        break;
      }
    }

    syncingRef.current = false;

    if (synced > 0) {
      toast({
        title: `Synced ${synced} offline session${synced > 1 ? "s" : ""} ✅`,
        description: "Your study data is now up to date.",
      });
    }
  };

  useEffect(() => {
    if (!user) return;

    // Try syncing on mount
    syncAll();

    // Sync when coming back online
    const handler = () => syncAll();
    window.addEventListener("online", handler);
    return () => window.removeEventListener("online", handler);
  }, [user]);

  return { pendingCount: queueLength(), syncAll };
}
