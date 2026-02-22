import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

async function debateInvoke(action: string, params: Record<string, any> = {}) {
  const { data, error } = await supabase.functions.invoke("ca-debate-engine", {
    body: { action, ...params },
  });
  if (error) throw error;
  return data;
}

export function useDebateDashboard() {
  return useQuery({
    queryKey: ["ca-debate-dashboard"],
    queryFn: () => debateInvoke("get_dashboard"),
    staleTime: 30_000,
  });
}

export function useDebateAnalyses() {
  return useQuery({
    queryKey: ["ca-debate-analyses"],
    queryFn: async () => {
      const { data } = await supabase
        .from("ca_debate_analyses" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      return (data || []) as any[];
    },
  });
}

export function useDebateAnalysisDetail(id: string | null) {
  return useQuery({
    queryKey: ["ca-debate-detail", id],
    queryFn: async () => {
      if (!id) return null;
      const [analysis, frameworks] = await Promise.all([
        supabase.from("ca_debate_analyses" as any).select("*").eq("id", id).single(),
        supabase.from("ca_framework_applications" as any).select("*").eq("debate_analysis_id", id),
      ]);
      return {
        analysis: analysis.data as any,
        frameworks: (frameworks.data || []) as any[],
      };
    },
    enabled: !!id,
  });
}

export function useGenerateAnalysis() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { event_id?: string; topic_title: string; topic_context: string }) =>
      debateInvoke("generate_analysis", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-debate-analyses"] });
      qc.invalidateQueries({ queryKey: ["ca-debate-dashboard"] });
    },
  });
}

export function useApplyFrameworks() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (debate_analysis_id: string) =>
      debateInvoke("apply_frameworks", { debate_analysis_id }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-debate-detail"] });
      qc.invalidateQueries({ queryKey: ["ca-debate-dashboard"] });
    },
  });
}

export function useEvaluateWriting() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (params: { user_id: string; debate_analysis_id?: string; topic_title: string; user_answer: string; time_taken_seconds?: number }) =>
      debateInvoke("evaluate_writing", params),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["ca-debate-dashboard"] });
    },
  });
}

export function useWritingEvaluations(userId?: string) {
  return useQuery({
    queryKey: ["ca-writing-evaluations", userId],
    queryFn: async () => {
      let query = supabase
        .from("ca_writing_evaluations" as any)
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (userId) query = query.eq("user_id", userId);
      const { data } = await query;
      return (data || []) as any[];
    },
  });
}
