import { useState, useCallback, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface AutopilotStatus {
  globally_enabled: boolean;
  user_enabled: boolean;
  intensity: string;
  today: {
    has_plan: boolean;
    total_sessions: number;
    completed_sessions: number;
    emergency_triggered: boolean;
    next_session: {
      mode: string;
      topic_id: string | null;
      topic_name: string;
      duration_minutes: number;
      slot: number;
      reason: string;
    } | null;
    progress_percent: number;
  };
}

export interface EmergencyResult {
  emergency: boolean;
  trigger_topic?: {
    id: string;
    name: string;
    memory_strength: number;
    drop: number;
  };
  critical_count?: number;
  action?: string;
}

export function useAutopilot() {
  const [status, setStatus] = useState<AutopilotStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const invoke = useCallback(async (action: string, extra: Record<string, any> = {}) => {
    const { data, error: fnError } = await supabase.functions.invoke("autopilot-engine", {
      body: { action, ...extra },
    });
    if (fnError) throw fnError;
    return data;
  }, []);

  const fetchStatus = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await invoke("get_status");
      setStatus(result);
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, invoke]);

  const generatePlan = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const result = await invoke("generate_daily_plan");
      await fetchStatus();
      return result;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session, invoke, fetchStatus]);

  const checkEmergency = useCallback(async (): Promise<EmergencyResult | null> => {
    if (!session) return null;
    try {
      return await invoke("check_emergency");
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [session, invoke]);

  const getNextMode = useCallback(async () => {
    if (!session) return null;
    try {
      return await invoke("get_next_mode");
    } catch (e: any) {
      setError(e.message);
      return null;
    }
  }, [session, invoke]);

  const toggleAutopilot = useCallback(async (enabled: boolean) => {
    if (!session) return;
    try {
      await invoke("toggle_user_autopilot", { enabled });
      await fetchStatus();
    } catch (e: any) {
      setError(e.message);
    }
  }, [session, invoke, fetchStatus]);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  return {
    status,
    loading,
    error,
    fetchStatus,
    generatePlan,
    checkEmergency,
    getNextMode,
    toggleAutopilot,
  };
}
