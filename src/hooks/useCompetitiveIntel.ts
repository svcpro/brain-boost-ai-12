import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

export function useRankHeatmap() {
  const { user } = useAuth();

  const { data: snapshots, isLoading } = useQuery({
    queryKey: ["rank-heatmap", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("rank_heatmap_snapshots")
        .select("*").eq("user_id", user!.id).order("computed_at", { ascending: false }).limit(10);
      return data || [];
    },
  });

  const compute = useMutation({
    mutationFn: async (examType?: string) => {
      const { data, error } = await supabase.functions.invoke("competitive-intelligence", {
        body: { action: "compute_rank_heatmap", exam_type: examType || "general" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => toast.success("Rank heatmap updated"),
    onError: () => toast.error("Failed to compute rank"),
  });

  return { snapshots, isLoading, compute: compute.mutate, isComputing: compute.isPending, latest: snapshots?.[0] };
}

export function useWeaknessPredictions() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: predictions, isLoading } = useQuery({
    queryKey: ["weakness-predictions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("weakness_predictions")
        .select("*").eq("user_id", user!.id).order("computed_at", { ascending: false }).limit(5);
      return data || [];
    },
  });

  const predict = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("competitive-intelligence", {
        body: { action: "predict_weaknesses" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Weakness analysis complete"); qc.invalidateQueries({ queryKey: ["weakness-predictions"] }); },
    onError: () => toast.error("Prediction failed"),
  });

  return { predictions, isLoading, predict: () => predict.mutate(undefined), isPredicting: predict.isPending };
}

export function useExamTrends(examType: string = "general") {
  const { data: trends, isLoading } = useQuery({
    queryKey: ["exam-trends", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("exam_trend_patterns")
        .select("*").eq("exam_type", examType).order("predicted_probability", { ascending: false }).limit(20);
      return data || [];
    },
  });

  return { trends, isLoading };
}

export function useAccelerator() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: enrollment, isLoading } = useQuery({
    queryKey: ["accelerator", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any).from("accelerator_enrollments")
        .select("*").eq("user_id", user!.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle();
      return data;
    },
  });

  const enroll = useMutation({
    mutationFn: async (examType?: string) => {
      const { data, error } = await supabase.functions.invoke("competitive-intelligence", {
        body: { action: "generate_accelerator", exam_type: examType || "general" },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("🚀 Accelerator activated!"); qc.invalidateQueries({ queryKey: ["accelerator"] }); },
    onError: () => toast.error("Failed to start accelerator"),
  });

  return { enrollment, isLoading, enroll: enroll.mutate, isEnrolling: enroll.isPending };
}
