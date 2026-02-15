import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface TopicCognitiveModel {
  topic_id: string;
  topic_name: string;
  memory_strength: number;
  decay_rate: number;
  learning_speed: number;
  recall_success_rate: number;
  stability: number;
  review_count: number;
  last_revision: string | null;
}

export interface CognitiveTwin {
  topic_models: TopicCognitiveModel[];
  avg_learning_speed: number;
  avg_decay_rate: number;
  optimal_study_hour: number;
  optimal_session_duration: number;
  cognitive_capacity_score: number;
  recall_pattern_type: string;
  fatigue_threshold_minutes: number;
  brain_evolution_score: number;
  learning_efficiency_score: number;
  memory_growth_rate: number;
  twin_version: number;
  computed_at: string;
}

export interface SimulationResult {
  scenario?: string;
  topic_name?: string;
  current_strength?: number;
  post_study_strength?: number;
  predicted_retention_after_days?: number;
  without_study_retention?: number;
  retention_gain?: number;
  days_ahead?: number;
  confidence?: number;
  comparisons?: Array<{
    strategy: string;
    projected_strength: number;
    predicted_retention: number;
    estimated_rank_change: number;
    daily_sessions: number;
    effort_level: string;
  }>;
  recommended?: string;
}

export function useCognitiveTwin() {
  const [twin, setTwin] = useState<CognitiveTwin | null>(null);
  const [simulation, setSimulation] = useState<SimulationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const computeTwin = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("cognitive-twin", {
        body: { action: "compute" },
      });
      if (fnError) throw fnError;
      setTwin(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const getTwin = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("cognitive-twin", {
        body: { action: "get" },
      });
      if (fnError) throw fnError;
      setTwin(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const simulate = useCallback(async (params: { topic_id?: string; strategy?: string; days_ahead?: number }) => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("cognitive-twin", {
        body: { action: "simulate", params },
      });
      if (fnError) throw fnError;
      setSimulation(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { twin, simulation, loading, error, computeTwin, getTwin, simulate };
}
