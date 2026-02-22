import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function policyInvoke(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("ca-policy-predictor", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export function usePolicyDashboard() {
  return useQuery({
    queryKey: ["ca-policy-dashboard"],
    queryFn: () => policyInvoke("get_dashboard"),
    staleTime: 30_000,
  });
}

export function usePolicyAnalyses() {
  return useQuery({
    queryKey: ["ca-policy-analyses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ca_policy_analyses" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });
}

export function usePolicyAnalysisDetail(analysisId: string | null) {
  return useQuery({
    queryKey: ["ca-policy-detail", analysisId],
    queryFn: async () => {
      if (!analysisId) return null;
      const [analysis, similarities, forecasts, adjustments] = await Promise.all([
        supabase.from("ca_policy_analyses" as any).select("*").eq("id", analysisId).single(),
        supabase.from("ca_policy_similarities" as any).select("*").eq("policy_analysis_id", analysisId).order("similarity_score", { ascending: false }),
        supabase.from("ca_impact_forecasts" as any).select("*").eq("policy_analysis_id", analysisId),
        supabase.from("ca_probability_adjustments" as any).select("*").eq("policy_analysis_id", analysisId),
      ]);
      return {
        analysis: analysis.data as any,
        similarities: (similarities.data || []) as any[],
        forecasts: (forecasts.data || []) as any[],
        adjustments: (adjustments.data || []) as any[],
      };
    },
    enabled: !!analysisId,
  });
}

export function useRunPolicyAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { event_id: string; exam_types?: string[] }) =>
      policyInvoke("analyze_policy", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-policy-dashboard"] });
      qc.invalidateQueries({ queryKey: ["ca-policy-analyses"] });
    },
  });
}

export function useApplyAdjustments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (analysis_id: string) =>
      policyInvoke("apply_adjustments", { analysis_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-policy-detail"] });
      qc.invalidateQueries({ queryKey: ["ca-policy-dashboard"] });
    },
  });
}

export function useRevertAdjustments() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (analysis_id: string) =>
      policyInvoke("revert_adjustments", { analysis_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-policy-detail"] });
      qc.invalidateQueries({ queryKey: ["ca-policy-dashboard"] });
    },
  });
}
