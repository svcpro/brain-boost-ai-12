import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { enqueue } from "@/lib/offlineQueue";

export function useStudyLogger() {
  const { user } = useAuth();
  const { toast } = useToast();

  const logStudy = useCallback(async ({
    subjectName,
    topicName,
    durationMinutes,
    confidenceLevel,
    studyMode = "lazy",
  }: {
    subjectName: string;
    topicName?: string;
    durationMinutes: number;
    confidenceLevel: "low" | "medium" | "high";
    studyMode?: "lazy" | "focus" | "emergency" | "fix";
  }) => {
    if (!user) return;

    // If offline, queue and return
    if (!navigator.onLine) {
      enqueue({ subjectName, topicName, durationMinutes, confidenceLevel, studyMode });
      toast({ title: "Saved offline 📴", description: "Your session will sync when you're back online." });
      return true;
    }

    try {
      // Find or create subject
      let { data: subject } = await supabase
        .from("subjects")
        .select("id")
        .eq("user_id", user.id)
        .eq("name", subjectName)
        .maybeSingle();

      if (!subject) {
        const { data: newSubject, error: subErr } = await supabase
          .from("subjects")
          .insert({ user_id: user.id, name: subjectName })
          .select("id")
          .single();
        if (subErr) throw subErr;
        subject = newSubject;
      }

      let topicId = null;
      if (topicName && subject) {
        let { data: topic } = await supabase
          .from("topics")
          .select("id")
          .eq("user_id", user.id)
          .eq("subject_id", subject.id)
          .eq("name", topicName)
          .maybeSingle();

        if (!topic) {
          const { data: newTopic, error: topErr } = await supabase
            .from("topics")
            .insert({
              user_id: user.id,
              subject_id: subject.id,
              name: topicName,
              memory_strength: confidenceLevel === "high" ? 80 : confidenceLevel === "medium" ? 50 : 30,
              last_revision_date: new Date().toISOString(),
            })
            .select("id")
            .single();
          if (topErr) throw topErr;
          topic = newTopic;
        } else {
          await supabase
            .from("topics")
            .update({ last_revision_date: new Date().toISOString() })
            .eq("id", topic.id);
        }
        topicId = topic?.id;
      }

      const { error: logErr } = await supabase.from("study_logs").insert({
        user_id: user.id,
        subject_id: subject?.id,
        topic_id: topicId,
        duration_minutes: durationMinutes,
        confidence_level: confidenceLevel,
        study_mode: studyMode,
      });

      if (logErr) throw logErr;

      toast({ title: "Brain Updated!", description: "Your study session has been logged." });
      return true;
    } catch (e: any) {
      // Network error during request – queue it
      if (!navigator.onLine || e?.message?.includes("fetch") || e?.message?.includes("network")) {
        enqueue({ subjectName, topicName, durationMinutes, confidenceLevel, studyMode });
        toast({ title: "Saved offline 📴", description: "Your session will sync when you're back online." });
        return true;
      }
      toast({ title: "Error", description: e.message, variant: "destructive" });
      return false;
    }
  }, [user, toast]);

  return { logStudy };
}
