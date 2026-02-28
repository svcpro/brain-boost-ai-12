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

const isAuthTokenError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || "").toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid or expired token") ||
    msg.includes("missing or invalid authorization header")
  );
};

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
      const invokePredict = () =>
        supabase.functions.invoke("memory-engine", {
          body: { action: "predict" },
        });

      let { data, error: fnError } = await invokePredict();

      if (fnError && isAuthTokenError(fnError)) {
        await supabase.auth.refreshSession();
        const retry = await invokePredict();
        data = retry.data;
        fnError = retry.error;
      }

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
      const invokeRecommendations = () =>
        supabase.functions.invoke("memory-engine", {
          body: { action: "generate_recommendations" },
        });

      let { data, error: fnError } = await invokeRecommendations();

      if (fnError && isAuthTokenError(fnError)) {
        await supabase.auth.refreshSession();
        const retry = await invokeRecommendations();
        data = retry.data;
        fnError = retry.error;
      }

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
