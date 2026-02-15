import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AdaptiveDifficultyData {
  recommended_difficulty: "easy" | "medium" | "hard";
  difficulty_score: number;
  recommended_question_count: number;
  factors: {
    overall_accuracy: number;
    exam_trend: number;
    avg_recent_difficulty: number;
    recall_rate: number;
    knowledge_stability: number;
  };
}

export function useAdaptiveDifficulty() {
  const [data, setData] = useState<AdaptiveDifficultyData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const predict = useCallback(async (topics?: string) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("adaptive-difficulty", {
        body: { topics },
      });
      if (fnError) throw fnError;
      setData(result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, predict };
}
