import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

export interface PracticeQuestion {
  id?: string;
  question: string;
  options: string[];
  correct_answer: number;
  explanation?: string;
  topic?: string;
  difficulty?: string;
  // Bank-specific
  exam_type?: string;
  subject?: string;
  year?: number;
  previous_year_tag?: string;
  // Predicted-specific
  probability_level?: string;
  probability_score?: number;
  trend_reason?: string;
  trend_weight?: number;
  trend_strength?: string;
  trend_direction?: "rising" | "stable" | "declining" | "comeback";
  trend_momentum?: number;
  volatility_index?: number;
  pattern_stability?: number;
  difficulty_evolution?: string;
  framing_change?: string;
  ml_confidence?: string;
  score_breakdown?: {
    trend_momentum: number;
    time_series_forecast: number;
    historical_frequency: number;
    difficulty_alignment: number;
    semantic_similarity: number;
    examiner_behavior: number;
    cross_exam_correlation?: number;
    syllabus_coverage?: number;
    // Legacy support
    topic_frequency?: number;
    repetition?: number;
    recent_trend?: number;
    difficulty_match?: number;
    language_similarity?: number;
  };
  similar_pyq_years?: number[];
  question_type?: "factual" | "conceptual" | "application" | "analytical";
}

export interface ProgressStats {
  total: number;
  correct: number;
  accuracy: number;
  bankCount: number;
  predictedCount: number;
  totalAvailable?: number;
}

export function useConfidencePractice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [stats, setStats] = useState<ProgressStats | null>(null);

  const fetchBankQuestions = useCallback(async (filters: {
    exam_type?: string; subject?: string; topic?: string; year?: number; difficulty?: string; count?: number;
  }) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("confidence-practice", {
        body: { action: "get_bank_questions", ...filters }
      });
      if (error) throw error;
      setQuestions(data?.questions || []);
      setTotalAvailable(data?.totalAvailable || data?.questions?.length || 0);
    } catch (e: any) {
      toast({ title: "Error loading questions", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [user]);

  const generatePredicted = useCallback(async (filters: {
    exam_type?: string; subject?: string; count?: number;
  }) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("confidence-practice", {
        body: { action: "generate_predicted", count: filters.count || 5, ...filters }
      });
      // supabase.functions.invoke throws FunctionsHttpError for non-2xx
      // but the error object may contain the response body
      if (error) {
        // Try to extract body from the error
        let msg = error.message || "Unknown error";
        try {
          if ((error as any).context?.body) {
            const body = await (error as any).context.json();
            msg = body?.error || msg;
          }
        } catch {}
        toast({ title: "Error generating questions", description: msg, variant: "destructive" });
        return;
      }
      if (data?.error) {
        toast({ title: "AI Error", description: data.error, variant: "destructive" });
        return;
      }
      setQuestions(data?.questions || []);
    } catch (e: any) {
      toast({ title: "Error generating questions", description: e.message || "Please try again", variant: "destructive" });
    }
    setLoading(false);
  }, [user]);

  const saveProgress = useCallback(async (
    questionId: string, source: string, isCorrect: boolean, selectedAnswer: number, timeTaken: number
  ) => {
    if (!user) return;
    try {
      await supabase.functions.invoke("confidence-practice", {
        body: {
          action: "save_progress",
          question_id: questionId,
          question_source: source,
          is_correct: isCorrect,
          selected_answer: selectedAnswer,
          time_taken_seconds: timeTaken,
        }
      });
    } catch { /* non-blocking */ }
  }, [user]);

  const fetchStats = useCallback(async () => {
    if (!user) return;
    try {
      const { data, error } = await supabase.functions.invoke("confidence-practice", {
        body: { action: "get_progress_stats" }
      });
      if (!error && data) setStats(data);
    } catch { /* ignore */ }
  }, [user]);

  const fetchUserExam = useCallback(async (): Promise<string> => {
    if (!user) return "";
    try {
      const { data, error } = await supabase.functions.invoke("confidence-practice", {
        body: { action: "get_user_exam" }
      });
      if (!error && data?.exam_type) return data.exam_type;
    } catch { /* ignore */ }
    return "";
  }, [user]);

  const [populatingPYQs, setPopulatingPYQs] = useState(false);
  const [pyqProgress, setPyqProgress] = useState("");

  const populateQuestionBank = useCallback(async (examType?: string) => {
    if (!user) return null;
    setPopulatingPYQs(true);
    setPyqProgress("Generating questions using AI... This may take a few minutes.");
    try {
      const { data, error } = await supabase.functions.invoke("fetch-pyqs", {
        body: { exam_type: examType || undefined, questions_per_subject_per_year: 5 }
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "Error", description: data.error, variant: "destructive" });
        return data;
      }
      toast({ title: "Question Bank Updated!", description: data.message || `${data.totalInserted} questions added.` });
      return data;
    } catch (e: any) {
      toast({ title: "Error populating questions", description: e.message, variant: "destructive" });
      return null;
    } finally {
      setPopulatingPYQs(false);
      setPyqProgress("");
    }
  }, [user]);

  return { loading, questions, totalAvailable, stats, fetchBankQuestions, generatePredicted, saveProgress, fetchStats, fetchUserExam, setQuestions, populatingPYQs, pyqProgress, populateQuestionBank };
}
