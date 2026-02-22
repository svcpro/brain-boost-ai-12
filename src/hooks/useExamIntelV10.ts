import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useExamIntelV10() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const invoke = useCallback(async (action: string, params: Record<string, any> = {}) => {
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("exam-intel-v10", {
        body: { action, params },
      });
      if (fnError) throw fnError;
      return data;
    } catch (e: any) {
      setError(e.message);
      return null;
    } finally {
      setLoading(false);
    }
  }, [session]);

  return {
    loading,
    error,
    // Admin actions
    runFullPipeline: (exam_types?: string[]) => invoke("run_full_pipeline", { exam_types }),
    computeTopicScores: (exam_type: string) => invoke("compute_topic_scores", { exam_type }),
    generateIntelQuestions: (exam_type: string, subject: string, topic: string, count?: number) =>
      invoke("generate_intel_questions", { exam_type, subject, topic, count }),
    getIntelDashboard: (exam_type?: string) => invoke("get_intel_dashboard", { exam_type }),
    getPipelineStatus: () => invoke("get_pipeline_status"),
    detectShifts: (exam_type: string) => invoke("detect_shifts_and_alert", { exam_type }),
    // Student actions
    getStudentIntel: (exam_type: string) => invoke("get_student_intel", { exam_type }),
    computeStudentBrief: (exam_type: string) => invoke("compute_student_brief", { exam_type }),
  };
}
