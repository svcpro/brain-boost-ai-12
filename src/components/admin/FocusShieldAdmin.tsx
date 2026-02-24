import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  ShieldAlert, Settings, BarChart3, Users, TrendingDown,
  TrendingUp, Clock, Zap, Eye, EyeOff, Save, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface ShieldConfig {
  id: string;
  is_enabled: boolean;
  auto_freeze_enabled: boolean;
  distraction_threshold: number;
  warning_cooldown_seconds: number;
  micro_recall_required: boolean;
  max_warnings_before_freeze: number;
  freeze_duration_seconds: number;
}

interface ScoreRow {
  distraction_score: number;
  focus_score: number;
  tab_switches: number;
  blur_events: number;
  total_distraction_seconds: number;
  rapid_switches: number;
  score_date: string;
}

export default function FocusShieldAdmin() {
  const [tab, setTab] = useState<"config" | "analytics">("analytics");
  const [config, setConfig] = useState<ShieldConfig | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [cfgRes, scoresRes] = await Promise.all([
      supabase.from("focus_shield_config").select("*").limit(1).single(),
      supabase.from("distraction_scores").select("*").order("score_date", { ascending: false }).limit(50),
    ]);
    if (cfgRes.data) setConfig(cfgRes.data as any);
    if (scoresRes.data) setScores(scoresRes.data as any);
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase
      .from("focus_shield_config")
      .update({
        is_enabled: config.is_enabled,
        auto_freeze_enabled: config.auto_freeze_enabled,
        distraction_threshold: config.distraction_threshold,
        warning_cooldown_seconds: config.warning_cooldown_seconds,
        micro_recall_required: config.micro_recall_required,
        max_warnings_before_freeze: config.max_warnings_before_freeze,
        freeze_duration_seconds: config.freeze_duration_seconds,
      })
      .eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else toast.success("Focus Shield config saved");
  };

  // Aggregate stats
  const avgDistraction = scores.length
    ? Math.round(scores.reduce((s, r) => s + r.distraction_score, 0) / scores.length)
    : 0;
  const avgFocus = scores.length ? 100 - avgDistraction : 100;
  const totalSwitches = scores.reduce((s, r) => s + r.tab_switches, 0);
  const totalDistractedMin = Math.round(
    scores.reduce((s, r) => s + r.total_distraction_seconds, 0) / 60
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Focus Shield</h2>
          <p className="text-xs text-muted-foreground">Distraction Intelligence Engine</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5">
        {(["analytics", "config"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            {t === "analytics" ? <BarChart3 className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
            {t === "analytics" ? "Analytics" : "Configuration"}
          </button>
        ))}
      </div>

      {/* Analytics */}
      {tab === "analytics" && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Summary Cards */}
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={TrendingDown} label="Avg Distraction" value={`${avgDistraction}%`}
              color={avgDistraction > 50 ? "text-destructive" : "text-warning"}
              bg={avgDistraction > 50 ? "bg-destructive/10" : "bg-warning/10"} />
            <StatCard icon={TrendingUp} label="Avg Focus" value={`${avgFocus}%`}
              color="text-success" bg="bg-success/10" />
            <StatCard icon={Zap} label="Total Tab Switches" value={String(totalSwitches)}
              color="text-warning" bg="bg-warning/10" />
            <StatCard icon={Clock} label="Distracted Time" value={`${totalDistractedMin}m`}
              color="text-destructive" bg="bg-destructive/10" />
          </div>

          {/* Recent scores table */}
          <div className="rounded-xl border border-border/50 overflow-hidden">
            <div className="px-4 py-3 bg-secondary/30 border-b border-border/50">
              <p className="text-xs font-semibold text-foreground">Recent Distraction Scores</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {scores.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-border/30 text-muted-foreground">
                      <th className="text-left px-4 py-2">Date</th>
                      <th className="text-center px-2 py-2">Score</th>
                      <th className="text-center px-2 py-2">Switches</th>
                      <th className="text-center px-2 py-2">Rapid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {scores.map(s => (
                      <tr key={s.score_date} className="border-b border-border/20">
                        <td className="px-4 py-2 text-foreground">{s.score_date}</td>
                        <td className="text-center px-2 py-2">
                          <span className={`font-bold ${s.distraction_score > 50 ? "text-destructive" : s.distraction_score > 25 ? "text-warning" : "text-success"}`}>
                            {s.distraction_score}
                          </span>
                        </td>
                        <td className="text-center px-2 py-2 text-muted-foreground">{s.tab_switches}</td>
                        <td className="text-center px-2 py-2 text-muted-foreground">{s.rapid_switches}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </motion.div>
      )}

      {/* Configuration */}
      {tab === "config" && config && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Toggle rows */}
          <ToggleRow label="Focus Shield Enabled" desc="Track and warn on distractions"
            value={config.is_enabled} onChange={v => setConfig({ ...config, is_enabled: v })} />
          <ToggleRow label="Auto Freeze" desc="Lock app after repeated distractions"
            value={config.auto_freeze_enabled} onChange={v => setConfig({ ...config, auto_freeze_enabled: v })} />
          <ToggleRow label="Micro Recall Required" desc="Require recall challenge to unlock"
            value={config.micro_recall_required} onChange={v => setConfig({ ...config, micro_recall_required: v })} />

          {/* Numeric settings */}
          <NumberRow label="Distraction Threshold" value={config.distraction_threshold}
            onChange={v => setConfig({ ...config, distraction_threshold: v })} unit="score" />
          <NumberRow label="Warning Cooldown" value={config.warning_cooldown_seconds}
            onChange={v => setConfig({ ...config, warning_cooldown_seconds: v })} unit="sec" />
          <NumberRow label="Max Warnings Before Freeze" value={config.max_warnings_before_freeze}
            onChange={v => setConfig({ ...config, max_warnings_before_freeze: v })} unit="" />
          <NumberRow label="Freeze Duration" value={config.freeze_duration_seconds}
            onChange={v => setConfig({ ...config, freeze_duration_seconds: v })} unit="sec" />

          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={saveConfig}
            disabled={saving}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save Configuration"}
          </motion.button>
        </motion.div>
      )}
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} border border-border/30 p-4`}>
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: {
  label: string; desc: string; value: boolean; onChange: (v: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${value ? "bg-primary" : "bg-muted"}`}
      >
        <motion.div
          animate={{ x: value ? 20 : 0 }}
          className="w-5 h-5 rounded-full bg-white shadow-sm"
        />
      </button>
    </div>
  );
}

function NumberRow({ label, value, onChange, unit }: {
  label: string; value: number; onChange: (v: number) => void; unit: string;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          className="w-20 px-3 py-1.5 rounded-lg bg-secondary border border-border/50 text-foreground text-sm text-right outline-none"
        />
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}
