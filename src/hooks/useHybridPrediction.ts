import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface HybridTopicPrediction {
  topic_id: string;
  topic_name: string;
  personal_strength: number;
  global_avg_strength: number;
  hybrid_strength: number;
  personal_decay: number;
  hybrid_decay: number;
  hours_until_drop: number;
  risk_level: "critical" | "high" | "medium" | "low";
  confidence: number;
  global_corroborated: boolean;
}

export interface HybridPredictionData {
  hybrid_health: number;
  hybrid_rank_score: number;
  personal_weight: number;
  global_weight: number;
  topic_predictions: HybridTopicPrediction[];
  data_maturity_points: number;
  embedding_cluster: string;
  cognitive_fingerprint: string | null;
}

export function useHybridPrediction() {
  const [data, setData] = useState<HybridPredictionData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const predict = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("hybrid-prediction");
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
