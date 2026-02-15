import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BurnoutData {
  burnout_score: number;
  risk_level: "high" | "moderate" | "low";
  signals: {
    hours_24h: number;
    confidence_decline: number;
    duration_decline: number;
    consecutive_long: number;
    late_night_sessions: number;
  };
  recommendations: string[];
  confidence: number;
}

export function useBurnoutDetection() {
  const [data, setData] = useState<BurnoutData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const detect = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data: result, error: fnError } = await supabase.functions.invoke("burnout-detection");
      if (fnError) throw fnError;
      setData(result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { data, loading, error, detect };
}
