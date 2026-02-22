import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useCAAutopilotConfig() {
  return useQuery({
    queryKey: ["ca-autopilot-config"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ca_autopilot_config")
        .select("*")
        .limit(1)
        .single();
      if (error) throw error;
      return data;
    },
  });
}

export function useUpdateCAAutopilot() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { data: config } = await supabase
        .from("ca_autopilot_config")
        .select("id")
        .limit(1)
        .single();
      if (!config) throw new Error("No config found");

      const { error } = await supabase
        .from("ca_autopilot_config")
        .update({ ...updates, updated_at: new Date().toISOString() })
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["ca-autopilot-config"] }),
  });
}

export function useTriggerAutoPipeline() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("ca-auto-pipeline", {
        body: { force: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-autopilot-config"] });
      qc.invalidateQueries({ queryKey: ["ca-events"] });
      qc.invalidateQueries({ queryKey: ["ca-dashboard"] });
    },
  });
}
