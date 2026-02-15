import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface ContinualLearningReport {
  accuracy_report: Record<string, { accuracy: number; total: number; avgConfidence: number; needsRetrain: boolean }>;
  feature_staleness: { age_hours: number; stale: boolean };
  data_drift: { drift_score: number; detected: boolean };
  retrained_models: string[];
  retrain_results: Record<string, string>;
  health_score: number;
}

export function useContinualLearning() {
  const [report, setReport] = useState<ContinualLearningReport | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const monitor = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("continual-learning");
      if (fnError) throw fnError;
      setReport(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { report, loading, error, monitor };
}
