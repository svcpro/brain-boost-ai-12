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
  trend_weight?: number;
}

export interface ProgressStats {
  total: number;
  correct: number;
  accuracy: number;
  bankCount: number;
  predictedCount: number;
}

export function useConfidencePractice() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<PracticeQuestion[]>([]);
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
        body: { action: "generate_predicted", ...filters }
      });
      if (error) throw error;
      if (data?.error) {
        toast({ title: "AI Error", description: data.error, variant: "destructive" });
        return;
      }
      setQuestions(data?.questions || []);
    } catch (e: any) {
      toast({ title: "Error generating questions", description: e.message, variant: "destructive" });
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

  return { loading, questions, stats, fetchBankQuestions, generatePredicted, saveProgress, fetchStats, setQuestions };
}
