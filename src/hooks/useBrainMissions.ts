import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface BrainMission {
  id: string;
  title: string;
  description: string | null;
  mission_type: string;
  priority: string;
  target_topic_id: string | null;
  target_metric: string | null;
  target_value: number | null;
  current_value: number | null;
  status: string;
  expires_at: string | null;
  reward_value: number;
  reasoning: string | null;
  created_at: string;
}

export function useBrainMissions() {
  const [missions, setMissions] = useState<BrainMission[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const generate = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("brain-missions", {
        body: { action: "generate" },
      });
      if (fnError) throw fnError;
      setMissions(data?.missions || []);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const list = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("brain-missions", {
        body: { action: "list" },
      });
      if (fnError) throw fnError;
      setMissions(data || []);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  const complete = useCallback(async (missionId: string) => {
    if (!session) return;
    try {
      await supabase.functions.invoke("brain-missions", {
        body: { action: "complete", mission_id: missionId },
      });
      setMissions(prev => prev.filter(m => m.id !== missionId));
    } catch (e: any) {
      setError(e.message);
    }
  }, [session]);

  return { missions, loading, error, generate, list, complete };
}
