import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export function useExamIntelligence() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const invoke = useCallback(async (action: string, params: Record<string, any> = {}) => {
    if (!session) return null;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("exam-intelligence", {
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
    analyzeEvolution: (exam_type: string) => invoke("evolution_analysis", { exam_type }),
    extractMicroConcepts: (exam_type: string, subject: string, topic: string) => invoke("micro_concept_extract", { exam_type, subject, topic }),
    clusterQuestionDNA: (exam_type: string) => invoke("question_dna_cluster", { exam_type }),
    generateQuestions: (exam_type: string, subject: string, topic: string, count?: number, micro_concept_id?: string) => invoke("generate_questions", { exam_type, subject, topic, count, micro_concept_id }),
    detectCurriculumShift: (exam_type: string) => invoke("curriculum_shift_detect", { exam_type }),
    computeConfidenceBands: (exam_type: string, prediction_type?: string) => invoke("confidence_bands", { exam_type, prediction_type }),
    getDashboardStats: (exam_type?: string) => invoke("dashboard_stats", { exam_type }),
    retrainModel: (model_type: string, exam_type?: string) => invoke("retrain_model", { model_type, exam_type }),
  };
}
