import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Cpu } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import CompetitiveHeroStats from "../competitive-intel/CompetitiveHeroStats";
import EngineControlPanel from "../competitive-intel/EngineControlPanel";
import TrendPatternsPanel from "../competitive-intel/TrendPatternsPanel";
import OpponentSimPanel from "../competitive-intel/OpponentSimPanel";
import DatasetListPanel from "../competitive-intel/DatasetListPanel";

export default function CompetitiveIntelAdmin() {
  const qc = useQueryClient();
  const [newTrend, setNewTrend] = useState({ exam_type: "JEE", subject: "", topic: "", year: 2024, frequency_count: 1, predicted_probability: 50 });

  // Config
  const { data: config } = useQuery({
    queryKey: ["intel-config"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("competitive_intel_config").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // Datasets
  const { data: datasets } = useQuery({
    queryKey: ["exam-datasets"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("exam_datasets").select("*").order("created_at", { ascending: false }).limit(20);
      return data || [];
    },
  });

  // Trends
  const { data: trends } = useQuery({
    queryKey: ["admin-exam-trends"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("exam_trend_patterns").select("*").order("predicted_probability", { ascending: false }).limit(30);
      return data || [];
    },
  });

  // Opponent config
  const { data: opponentConfig } = useQuery({
    queryKey: ["opponent-config"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("opponent_simulation_config").select("*").limit(1).maybeSingle();
      return data;
    },
  });

  // Toggle config
  const toggleConfig = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: boolean }) => {
      if (!config?.id) return;
      const { error } = await (supabase as any).from("competitive_intel_config").update({ [key]: value }).eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Config updated"); qc.invalidateQueries({ queryKey: ["intel-config"] }); },
  });

  // Add trend
  const addTrend = useMutation({
    mutationFn: async () => {
      if (!newTrend.subject || !newTrend.topic) throw new Error("Subject and topic required");
      const { error } = await (supabase as any).from("exam_trend_patterns").insert({ ...newTrend, source: "manual" });
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Trend added"); qc.invalidateQueries({ queryKey: ["admin-exam-trends"] }); setNewTrend(p => ({ ...p, subject: "", topic: "" })); },
    onError: (e: any) => toast.error(e.message),
  });

  // Delete trend
  const deleteTrend = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("exam_trend_patterns").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["admin-exam-trends"] }); },
  });

  // Update opponent config
  const updateOpponent = useMutation({
    mutationFn: async (updates: any) => {
      if (!opponentConfig?.id) return;
      const { error } = await (supabase as any).from("opponent_simulation_config").update(updates).eq("id", opponentConfig.id);
      if (error) throw error;
    },
    onSuccess: () => { toast.success("Opponent config saved"); qc.invalidateQueries({ queryKey: ["opponent-config"] }); },
  });

  // Count active engine toggles
  const activeEngines = config ? ["trend_engine_enabled", "weakness_engine_enabled", "accelerator_enabled", "opponent_sim_enabled", "rank_heatmap_enabled"].filter(k => config[k] !== false).length : 0;

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        {/* Animated background orbs */}
        <motion.div
          className="absolute -top-10 -left-10 w-40 h-40 rounded-full bg-gradient-to-br from-orange-500/15 to-amber-400/10 blur-3xl"
          animate={{ scale: [1, 1.2, 1], x: [0, 15, 0] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-10 -right-10 w-40 h-40 rounded-full bg-gradient-to-br from-rose-500/10 to-pink-400/10 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], x: [0, -15, 0] }}
          transition={{ duration: 7, repeat: Infinity }}
        />

        <div className="relative z-10 flex items-center gap-4">
          <motion.div
            className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-500 to-amber-400 flex items-center justify-center shadow-xl shadow-orange-500/25"
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
          >
            <Swords className="w-6 h-6 text-white" />
          </motion.div>
          <div>
            <h2 className="text-xl font-black text-foreground flex items-center gap-2">
              Competition v3.0
              <motion.span
                className="text-[10px] px-2 py-0.5 rounded-full bg-gradient-to-r from-orange-500 to-amber-400 text-white font-bold"
                animate={{ scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                LIVE
              </motion.span>
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Exam pattern analysis · Opponent simulation · Rank intelligence
            </p>
          </div>
        </div>
      </motion.div>

      {/* Hero Stats */}
      <CompetitiveHeroStats
        trendCount={trends?.length || 0}
        datasetCount={datasets?.length || 0}
        opponentEnabled={opponentConfig?.is_enabled ?? false}
        engineToggles={activeEngines}
      />

      {/* Engine Controls */}
      <EngineControlPanel config={config} toggleConfig={toggleConfig} />

      {/* Two-column layout for trends & opponent */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <TrendPatternsPanel
          trends={trends || []}
          addTrend={addTrend}
          deleteTrend={deleteTrend}
          newTrend={newTrend}
          setNewTrend={setNewTrend}
        />
        <div className="space-y-5">
          <OpponentSimPanel opponentConfig={opponentConfig} updateOpponent={updateOpponent} />
          <DatasetListPanel datasets={datasets || []} />
        </div>
      </div>
    </div>
  );
}
