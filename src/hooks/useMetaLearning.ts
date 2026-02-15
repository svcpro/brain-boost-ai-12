import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface MetaLearningStrategy {
  strategy_type: string;
  strategy_params: Record<string, any>;
  performance_score: number;
  iteration: number;
  is_active: boolean;
}

export interface ModelSelection {
  model_domain: string;
  active_model: string;
  candidate_models: any[];
  last_evaluated_at: string;
}

export interface MetaLearningStatus {
  active_strategies: MetaLearningStrategy[];
  model_selections: ModelSelection[];
  cognitive_twin: any;
  system_ready: boolean;
}

export interface SelfImproveResult {
  strategies: { strategies: MetaLearningStrategy[]; iteration: number; insights: any };
  model_selections: { selections: ModelSelection[] };
  continual_learning: any;
  improvement_cycle: number;
}

export function useMetaLearning() {
  const [status, setStatus] = useState<MetaLearningStatus | null>(null);
  const [improveResult, setImproveResult] = useState<SelfImproveResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const getStatus = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("meta-learning", {
        body: { action: "status" },
      });
      if (fnError) throw fnError;
      setStatus(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const selfImprove = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("meta-learning", {
        body: { action: "self_improve" },
      });
      if (fnError) throw fnError;
      setImproveResult(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const optimizeStrategies = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("meta-learning", {
        body: { action: "optimize" },
      });
      if (fnError) throw fnError;
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { status, improveResult, loading, error, getStatus, selfImprove, optimizeStrategies };
}
