import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface UserFeatures {
  avg_time_since_revision_hours: number;
  avg_revision_frequency: number;
  recall_success_rate: number;
  memory_decay_slope: number;
  study_consistency_score: number;
  engagement_score: number;
  fatigue_indicator: number;
  response_latency_score: number;
  avg_session_duration_minutes: number;
  app_open_frequency: number;
  subject_strength_score: number;
  rank_trajectory_slope: number;
  learning_velocity: number;
  knowledge_stability: number;
  burnout_risk_score: number;
  consecutive_long_sessions: number;
  hours_studied_last_24h: number;
  hours_studied_last_7d: number;
  computed_at: string;
}

export function useMLFeatures() {
  const [features, setFeatures] = useState<UserFeatures | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const compute = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("ml-feature-engine");
      if (fnError) throw fnError;
      setFeatures(data?.features || null);
      return data?.features;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { features, loading, error, compute };
}
