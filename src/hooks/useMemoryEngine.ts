import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";

export interface TopicPrediction {
  id: string;
  name: string;
  subject_name: string | null;
  memory_strength: number;
  next_predicted_drop_date: string;
  hours_until_drop: number;
  stability: number;
  review_count: number;
  risk_level: "critical" | "high" | "medium" | "low";
}

export interface MemoryPrediction {
  topics: TopicPrediction[];
  overall_health: number;
  at_risk: TopicPrediction[];
}

const CACHE_KEY = "memory-prediction";

export function useMemoryEngine() {
  const [prediction, setPrediction] = useState<MemoryPrediction | null>(() => getCache<MemoryPrediction>(CACHE_KEY));
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const predict = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("memory-engine", {
        body: { action: "predict" },
      });
      if (fnError) throw fnError;
      setPrediction(data);
      setCache(CACHE_KEY, data);
      return data;
    } catch (e: any) {
      setError(e.message);
      // Offline – cached data already loaded via initial state
    } finally {
      setLoading(false);
    }
  }, [session]);

  const generateRecommendations = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("memory-engine", {
        body: { action: "generate_recommendations" },
      });
      if (fnError) throw fnError;
      setRecommendations(data.recommendations || []);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { prediction, recommendations, loading, error, predict, generateRecommendations };
}
