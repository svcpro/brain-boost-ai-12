import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PipelineResult {
  pipeline_version: string;
  total_latency_ms: number;
  stages: Record<string, { status: string; latency_ms: number; data?: any }>;
  profile: {
    brain_evolution: number;
    learning_efficiency: number;
    cognitive_cluster: string;
    fingerprint: string | null;
    data_maturity: number;
  };
  predictions: {
    hybrid_health: number;
    hybrid_rank_score: number;
    personal_weight: number;
    global_weight: number;
    topic_predictions: any[];
  };
  recommendations: {
    study_sequence: Array<{ topic: string; duration: number; reason: string }>;
    schedule: {
      best_study_windows: Array<{ hour: number; label: string }>;
      avoid_hours: Array<{ hour: number; label: string }>;
      best_days: string[];
      session_minutes: number;
      max_daily_minutes: number;
      fatigue_warning_at: number;
    };
    intensity_profile: string;
  };
  reward_signals: {
    plan_completion_rate: number;
    prediction_accuracy: number;
    total_sessions_analyzed: number;
    rl_signal_count: number;
  };
}

export function useInferencePipeline() {
  const [data, setData] = useState<PipelineResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const run = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("inference-pipeline");
      if (fnError) throw fnError;
      setData(result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, run };
}
