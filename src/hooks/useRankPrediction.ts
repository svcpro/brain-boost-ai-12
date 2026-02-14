import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RankFactors {
  avg_strength: number;
  coverage_ratio: number;
  total_hours: number;
  composite_score: number;
  topic_count: number;
  strong_topics: number;
}

export interface WeeklyDay {
  day: string;
  hours: number;
}

export interface RankPredictionData {
  predicted_rank: number | null;
  percentile: number | null;
  rank_change: number;
  factors: RankFactors;
  history: { rank: number; date: string }[];
  weekly_data: WeeklyDay[];
  week_total_hours: number;
}

export function useRankPrediction() {
  const [data, setData] = useState<RankPredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const predictRank = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("memory-engine", {
        body: { action: "predict_rank" },
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

  return { data, loading, error, predictRank };
}
