import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface CognitiveEmbedding {
  embedding: number[];
  feature_labels: string[];
  cognitive_fingerprint: string;
  cluster_id: string;
  similarity_group: string;
  computed_at: string;
}

export function useUserEmbedding() {
  const [embedding, setEmbedding] = useState<CognitiveEmbedding | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { session } = useAuth();

  const compute = useCallback(async () => {
    if (!session) return;
    setLoading(true);
    setError(null);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("user-embedding");
      if (fnError) throw fnError;
      setEmbedding(data);
      return data;
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [session]);

  return { embedding, loading, error, compute };
}
