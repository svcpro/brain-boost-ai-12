import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface RLPolicy {
  timing: {
    best_hours: number[];
    worst_hours: number[];
    best_days: number[];
    optimal_start_hour: number;
    confidence: string;
  };
  sequence: {
    priority_topics: Array<{
      topic_id: string;
      topic_name: string;
      memory_strength: number;
      staleness_days: number;
      effectiveness: number;
      priority_score: number;
      recommended_duration: number;
    }>;
    strategy: string;
    interleave_subjects: boolean;
  };
  intensity: {
    best_bucket: string;
    recommended_session_minutes: number;
    fatigue_threshold_minutes: number;
    fatigue_signals_detected: number;
    max_daily_minutes: number;
  };
  reward_signals: {
    plan_completion_rate: number;
    prediction_accuracy: number;
    total_sessions_analyzed: number;
    rl_signal_count: number;
  };
}

export interface RLAgentData {
  policy: RLPolicy;
  iteration: number;
  data_points: number;
  topics_ranked: number;
}

export function useRLAgent() {
  const [data, setData] = useState<RLAgentData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const optimize = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("rl-agent");
      if (fnError) throw fnError;
      setData(result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, optimize };
}
