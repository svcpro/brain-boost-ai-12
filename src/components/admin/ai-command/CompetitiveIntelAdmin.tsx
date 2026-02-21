import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, Upload, ToggleLeft, ToggleRight, Settings, TrendingUp, Database, RefreshCw, Plus, Trash2, Save, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

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

  const configToggles = [
    { key: "trend_engine_enabled", label: "Trend Engine" },
    { key: "weakness_engine_enabled", label: "Weakness Engine" },
    { key: "accelerator_enabled", label: "30-Day Accelerator" },
    { key: "opponent_sim_enabled", label: "Opponent Simulation" },
    { key: "rank_heatmap_enabled", label: "Rank Heatmap" },
  ];

  return (
    <div className="space-y-5">
      {/* Master Toggles */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2 mb-2">
          <Settings className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Engine Controls</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {configToggles.map(t => {
            const enabled = config?.[t.key] ?? true;
            return (
              <button
                key={t.key}
                onClick={() => toggleConfig.mutate({ key: t.key, value: !enabled })}
                className="flex items-center justify-between p-3 rounded-lg bg-background/50 hover:bg-secondary/50 transition-colors"
              >
                <span className="text-xs font-medium text-foreground">{t.label}</span>
                {enabled ? <ToggleRight className="w-5 h-5 text-primary" /> : <ToggleLeft className="w-5 h-5 text-muted-foreground" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Add Trend Pattern */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-bold text-foreground">Exam Trend Patterns</h3>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          <select value={newTrend.exam_type} onChange={e => setNewTrend(p => ({ ...p, exam_type: e.target.value }))}
            className="p-2 rounded-lg bg-background border border-border text-xs text-foreground">
            <option>JEE</option><option>NEET</option><option>UPSC</option><option>general</option>
          </select>
          <input placeholder="Subject" value={newTrend.subject} onChange={e => setNewTrend(p => ({ ...p, subject: e.target.value }))}
            className="p-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground" />
          <input placeholder="Topic" value={newTrend.topic} onChange={e => setNewTrend(p => ({ ...p, topic: e.target.value }))}
            className="p-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground" />
          <input type="number" placeholder="Year" value={newTrend.year} onChange={e => setNewTrend(p => ({ ...p, year: +e.target.value }))}
            className="p-2 rounded-lg bg-background border border-border text-xs text-foreground" />
          <input type="number" placeholder="Freq" value={newTrend.frequency_count} onChange={e => setNewTrend(p => ({ ...p, frequency_count: +e.target.value }))}
            className="p-2 rounded-lg bg-background border border-border text-xs text-foreground" />
          <input type="number" placeholder="Probability %" value={newTrend.predicted_probability} onChange={e => setNewTrend(p => ({ ...p, predicted_probability: +e.target.value }))}
            className="p-2 rounded-lg bg-background border border-border text-xs text-foreground" />
        </div>
        <button onClick={() => addTrend.mutate()} disabled={addTrend.isPending}
          className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium disabled:opacity-50">
          <Plus className="w-3.5 h-3.5" /> Add Pattern
        </button>

        {/* Existing trends */}
        {trends && trends.length > 0 && (
          <div className="space-y-1.5 max-h-48 overflow-y-auto">
            {trends.map((t: any) => (
              <div key={t.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs">
                <span className="text-primary font-bold w-8">{t.predicted_probability}%</span>
                <span className="text-foreground flex-1 truncate">{t.topic} · {t.subject}</span>
                <span className="text-muted-foreground">{t.exam_type}</span>
                <button onClick={() => deleteTrend.mutate(t.id)} className="text-destructive hover:text-destructive/80"><Trash2 className="w-3.5 h-3.5" /></button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Opponent Simulation Config */}
      {opponentConfig && (
        <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
          <div className="flex items-center gap-2">
            <Swords className="w-4 h-4 text-warning" />
            <h3 className="text-sm font-bold text-foreground">Opponent Simulation</h3>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground">Pressure Level</label>
              <select
                defaultValue={opponentConfig.pressure_level}
                onChange={e => updateOpponent.mutate({ pressure_level: e.target.value })}
                className="w-full p-2 rounded-lg bg-background border border-border text-xs text-foreground mt-1"
              >
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="extreme">Extreme</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Time Pressure (multiplier)</label>
              <input
                type="number" step="0.05" min="0.5" max="1.0"
                defaultValue={opponentConfig.time_pressure_multiplier}
                onBlur={e => updateOpponent.mutate({ time_pressure_multiplier: +e.target.value })}
                className="w-full p-2 rounded-lg bg-background border border-border text-xs text-foreground mt-1"
              />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground">Difficulty Escalation</label>
              <input
                type="number" step="0.05" min="1.0" max="2.0"
                defaultValue={opponentConfig.difficulty_escalation_rate}
                onBlur={e => updateOpponent.mutate({ difficulty_escalation_rate: +e.target.value })}
                className="w-full p-2 rounded-lg bg-background border border-border text-xs text-foreground mt-1"
              />
            </div>
            <div className="flex items-end">
              <button
                onClick={() => updateOpponent.mutate({ is_enabled: !opponentConfig.is_enabled })}
                className={`w-full py-2 rounded-lg text-xs font-medium ${opponentConfig.is_enabled ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}
              >
                {opponentConfig.is_enabled ? "✅ Enabled" : "❌ Disabled"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Datasets */}
      <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
        <div className="flex items-center gap-2">
          <Database className="w-4 h-4 text-muted-foreground" />
          <h3 className="text-sm font-bold text-foreground">Uploaded Datasets</h3>
        </div>
        {datasets && datasets.length > 0 ? (
          <div className="space-y-2">
            {datasets.map((d: any) => (
              <div key={d.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/50 text-xs">
                <span className="text-foreground flex-1">{d.exam_type} {d.year} — {d.subject || "All"}</span>
                <span className={`px-2 py-0.5 rounded text-[10px] font-medium ${d.status === "processed" ? "bg-primary/15 text-primary" : d.status === "error" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>
                  {d.status}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">No datasets uploaded yet. Use CSV/PDF upload or manual entry above.</p>
        )}
      </div>
    </div>
  );
}
