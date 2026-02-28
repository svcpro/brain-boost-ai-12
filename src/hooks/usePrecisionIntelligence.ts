import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";

export interface PrecisionScore {
  unified_precision_score: number;
  confidence_interval: { low: number; high: number };
  factors: {
    performance_trend: number;
    topic_weight_importance: number;
    forgetting_curve_factor: number;
    retrieval_strength_index: number;
    behavioral_timing_score: number;
    error_clustering_score: number;
  };
  weights: Record<string, number>;
  data_maturity: number;
  ai_reasoning: string;
  decaying_topics: number;
  total_topics: number;
}

export interface TopicDecayV2 {
  topic_id: string;
  topic_name: string;
  subject_name: string | null;
  initial_mastery: number;
  recall_strength: number;
  error_severity: number;
  decay_rate: number;
  predicted_retention: number;
  next_optimal_review: string;
  hours_until_optimal_review: number;
  stability_hours: number;
  ai_reasoning: string;
}

export interface DecayV2Data {
  topic_decays: TopicDecayV2[];
  overall_retention: number;
  urgent_count: number;
  model_version: string;
}

export interface RankV2Data {
  predicted_rank: number;
  rank_band: { low: number; high: number };
  percentile: number;
  confidence_interval: { low: number; high: number };
  consistency_coefficient: number;
  volatility_index: number;
  high_weight_factor: number;
  composite_score: number;
  trend: string;
  model_version: string;
  ai_reasoning: string;
  data_maturity: number;
}

export interface MicroAdjustment {
  event_type: string;
  severity: number;
  adjustment: string;
  details: Record<string, any>;
}

const PRECISION_CACHE = "acry-precision-score";
const DECAY_CACHE = "acry-decay-v2";
const RANK_CACHE = "acry-rank-v2";

const isAuthTokenError = (error: unknown): boolean => {
  const msg = String((error as any)?.message || "").toLowerCase();
  return (
    msg.includes("401") ||
    msg.includes("unauthorized") ||
    msg.includes("invalid or expired token") ||
    msg.includes("missing or invalid authorization header")
  );
};

export function usePrecisionIntelligence() {
  const { session } = useAuth();
  const [precisionScore, setPrecisionScore] = useState<PrecisionScore | null>(() => getCache(PRECISION_CACHE));
  const [decayData, setDecayData] = useState<DecayV2Data | null>(() => getCache(DECAY_CACHE));
  const [rankData, setRankData] = useState<RankV2Data | null>(() => getCache(RANK_CACHE));
  const [microAdjustments, setMicroAdjustments] = useState<MicroAdjustment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    if (!session) return null;

    const doInvoke = () =>
      supabase.functions.invoke("precision-intelligence", {
        body: { action, ...extra },
      });

    let { data, error: fnError } = await doInvoke();

    if (fnError && isAuthTokenError(fnError)) {
      await supabase.auth.refreshSession();
      const retry = await doInvoke();
      data = retry.data;
      fnError = retry.error;
    }

    if (fnError) throw fnError;
    return data;
  }, [session]);

  const computePrecision = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoke("compute_precision");
      setPrecisionScore(data);
      setCache(PRECISION_CACHE, data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, invoke]);

  const computeDecayV2 = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoke("decay_v2");
      setDecayData(data);
      setCache(DECAY_CACHE, data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, invoke]);

  const computeRankV2 = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const data = await invoke("rank_v2");
      setRankData(data);
      setCache(RANK_CACHE, data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, invoke]);

  const detectMicroBehavior = useCallback(async (events: Array<{
    event_type: string;
    topic_id?: string;
    context?: Record<string, any>;
    session_id?: string;
  }>) => {
    if (!session) return;
    try {
      const data = await invoke("detect_micro", { events });
      setMicroAdjustments(data?.adjustments || []);
      return data;
    } catch (e: any) {
      console.error("Micro detection error:", e);
    }
  }, [session, invoke]);

  const triggerSelfLearn = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      return await invoke("self_learn");
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, invoke]);

  const fetchDashboard = useCallback(async () => {
    if (!session) return;
    try {
      return await invoke("dashboard");
    } catch (e: any) {
      setError(e.message);
    }
  }, [session, invoke]);

  return {
    precisionScore,
    decayData,
    rankData,
    microAdjustments,
    loading,
    error,
    computePrecision,
    computeDecayV2,
    computeRankV2,
    detectMicroBehavior,
    triggerSelfLearn,
    fetchDashboard,
  };
}
