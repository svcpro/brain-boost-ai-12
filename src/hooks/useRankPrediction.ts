import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";

export interface RankFactors {
  avg_strength: number;
  coverage_ratio: number;
  total_hours: number;
  composite_score: number;
  topic_count: number;
  strong_topics: number;
  consistency_score?: number;
  recency_score?: number;
  decay_velocity_score?: number;
  confidence_score?: number;
  exam_pressure_score?: number;
}

export interface WeeklyDay {
  day: string;
  hours: number;
}

export interface RankPredictionData {
  predicted_rank: number | null;
  percentile: number | null;
  rank_change: number;
  trend: "rising" | "falling" | "stable" | "neutral";
  factors: RankFactors;
  history: { rank: number; date: string }[];
  weekly_data: WeeklyDay[];
  week_total_hours: number;
}

const CACHE_KEY = "rank-prediction";

const isAuthTokenError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || "").toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid or expired token") ||
    msg.includes("missing or invalid authorization header")
  );
};

export function useRankPrediction() {
  const [data, setData] = useState<RankPredictionData | null>(() => getCache<RankPredictionData>(CACHE_KEY));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const predictRank = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const invokeRankPrediction = () =>
        supabase.functions.invoke("memory-engine", {
          body: { action: "predict_rank" },
        });

      let { data: result, error: fnError } = await invokeRankPrediction();

      if (fnError && isAuthTokenError(fnError)) {
        await supabase.auth.refreshSession();
        const retry = await invokeRankPrediction();
        result = retry.data;
        fnError = retry.error;
      }

      if (fnError) throw fnError;
      setData(result);
      setCache(CACHE_KEY, result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, predictRank };
}
