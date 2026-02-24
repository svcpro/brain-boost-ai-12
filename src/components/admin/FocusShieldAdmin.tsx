import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Settings, BarChart3, TrendingDown,
  TrendingUp, Clock, Zap, Save, RefreshCw, Brain,
  Activity, Target, Lock, Radar, FlaskConical,
  Gauge, Fingerprint, Sparkles, ShieldCheck, AlertTriangle
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// ═══ Types ═══
interface ShieldConfig {
  id: string;
  is_enabled: boolean;
  auto_freeze_enabled: boolean;
  distraction_threshold: number;
  warning_cooldown_seconds: number;
  micro_recall_required: boolean;
  max_warnings_before_freeze: number;
  freeze_duration_seconds: number;
  prediction_enabled: boolean;
  cognitive_classifier_enabled: boolean;
  adaptive_lock_enabled: boolean;
  dopamine_replacement_enabled: boolean;
  neural_discipline_enabled: boolean;
  impulse_delay_enabled: boolean;
  prediction_threshold: number;
}

interface LockConfig {
  id: string;
  base_lock_seconds: number;
  exam_proximity_multiplier: number;
  high_risk_multiplier: number;
  burnout_reduction_factor: number;
  max_lock_seconds: number;
  min_lock_seconds: number;
  impulse_delay_type: string;
  breathing_exercise_seconds: number;
  intervention_ab_enabled: boolean;
  ab_variant_a: string;
  ab_variant_b: string;
  ab_traffic_split: number;
  prediction_threshold: number;
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

interface PredictionRow {
  distraction_probability: number;
  cognitive_state: string;
  intervention_triggered: string | null;
  intervention_stage: number;
  predicted_at: string;
  context: any;
}

interface DisciplineRow {
  discipline_score: number;
  distractions_resisted: number;
  distractions_yielded: number;
  score_date: string;
  streak_multiplier: number;
  brain_level_xp_earned: number;
}

type AdminTab = "analytics" | "predictions" | "discipline" | "locks" | "config";

const TAB_ITEMS: { key: AdminTab; label: string; icon: any }[] = [
  { key: "analytics", label: "Analytics", icon: BarChart3 },
  { key: "predictions", label: "Predictions", icon: Radar },
  { key: "discipline", label: "Discipline", icon: Brain },
  { key: "locks", label: "Lock Engine", icon: Lock },
  { key: "config", label: "Config", icon: Settings },
];

export default function FocusShieldAdmin() {
  const [tab, setTab] = useState<AdminTab>("analytics");
  const [config, setConfig] = useState<ShieldConfig | null>(null);
  const [lockConfig, setLockConfig] = useState<LockConfig | null>(null);
  const [scores, setScores] = useState<ScoreRow[]>([]);
  const [predictions, setPredictions] = useState<PredictionRow[]>([]);
  const [disciplineScores, setDisciplineScores] = useState<DisciplineRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => { loadData(); }, []);

  const loadData = async () => {
    setLoading(true);
    const [cfgRes, scoresRes, predRes, discRes, lockRes] = await Promise.all([
      supabase.from("focus_shield_config").select("*").limit(1).single(),
      supabase.from("distraction_scores").select("*").order("score_date", { ascending: false }).limit(50),
      supabase.from("attention_predictions").select("*").order("predicted_at", { ascending: false }).limit(100),
      supabase.from("neural_discipline_scores").select("*").order("score_date", { ascending: false }).limit(50),
      supabase.from("adaptive_lock_config").select("*").limit(1).single(),
    ]);
    if (cfgRes.data) setConfig(cfgRes.data as any);
    if (scoresRes.data) setScores(scoresRes.data as any);
    if (predRes.data) setPredictions(predRes.data as any);
    if (discRes.data) setDisciplineScores(discRes.data as any);
    if (lockRes.data) setLockConfig(lockRes.data as any);
    setLoading(false);
  };

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from("focus_shield_config").update({
      is_enabled: config.is_enabled,
      auto_freeze_enabled: config.auto_freeze_enabled,
      distraction_threshold: config.distraction_threshold,
      warning_cooldown_seconds: config.warning_cooldown_seconds,
      micro_recall_required: config.micro_recall_required,
      max_warnings_before_freeze: config.max_warnings_before_freeze,
      freeze_duration_seconds: config.freeze_duration_seconds,
      prediction_enabled: config.prediction_enabled,
      cognitive_classifier_enabled: config.cognitive_classifier_enabled,
      adaptive_lock_enabled: config.adaptive_lock_enabled,
      dopamine_replacement_enabled: config.dopamine_replacement_enabled,
      neural_discipline_enabled: config.neural_discipline_enabled,
      impulse_delay_enabled: config.impulse_delay_enabled,
      prediction_threshold: config.prediction_threshold,
    }).eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else toast.success("Config saved");
  };

  const saveLockConfig = async () => {
    if (!lockConfig) return;
    setSaving(true);
    const { id, ...rest } = lockConfig;
    const { error } = await supabase.from("adaptive_lock_config").update(rest).eq("id", id);
    setSaving(false);
    if (error) toast.error("Failed to save lock config");
    else toast.success("Lock config saved");
  };

  // Aggregates
  const avgDistraction = scores.length ? Math.round(scores.reduce((s, r) => s + r.distraction_score, 0) / scores.length) : 0;
  const avgFocus = scores.length ? 100 - avgDistraction : 100;
  const totalSwitches = scores.reduce((s, r) => s + r.tab_switches, 0);
  const totalDistractedMin = Math.round(scores.reduce((s, r) => s + r.total_distraction_seconds, 0) / 60);

  // Prediction aggregates
  const avgDP = predictions.length ? Math.round(predictions.reduce((s, p) => s + p.distraction_probability, 0) / predictions.length * 100) : 0;
  const stateDistribution = predictions.reduce((acc, p) => {
    acc[p.cognitive_state] = (acc[p.cognitive_state] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  const interventionCount = predictions.filter(p => p.intervention_triggered).length;

  // Discipline aggregates
  const avgDiscipline = disciplineScores.length ? Math.round(disciplineScores.reduce((s, d) => s + d.discipline_score, 0) / disciplineScores.length) : 0;
  const totalResisted = disciplineScores.reduce((s, d) => s + d.distractions_resisted, 0);
  const totalYielded = disciplineScores.reduce((s, d) => s + d.distractions_yielded, 0);
  const totalXP = disciplineScores.reduce((s, d) => s + d.brain_level_xp_earned, 0);

  if (loading) {
    return <div className="flex items-center justify-center py-20"><RefreshCw className="w-5 h-5 animate-spin text-muted-foreground" /></div>;
  }

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-warning/20 flex items-center justify-center">
          <ShieldAlert className="w-5 h-5 text-warning" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">Predictive Cognitive Control</h2>
          <p className="text-xs text-muted-foreground">Ultra Advanced Focus Shield • 7 Modules Active</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TAB_ITEMS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {tab === "analytics" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={TrendingDown} label="Avg Distraction" value={`${avgDistraction}%`}
                  color={avgDistraction > 50 ? "text-destructive" : "text-warning"} bg={avgDistraction > 50 ? "bg-destructive/10" : "bg-warning/10"} />
                <StatCard icon={TrendingUp} label="Avg Focus" value={`${avgFocus}%`} color="text-success" bg="bg-success/10" />
                <StatCard icon={Zap} label="Tab Switches" value={String(totalSwitches)} color="text-warning" bg="bg-warning/10" />
                <StatCard icon={Clock} label="Distracted Time" value={`${totalDistractedMin}m`} color="text-destructive" bg="bg-destructive/10" />
              </div>

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
            </div>
          )}

          {tab === "predictions" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={Radar} label="Avg DP" value={`${avgDP}%`}
                  color={avgDP > 65 ? "text-destructive" : "text-primary"} bg={avgDP > 65 ? "bg-destructive/10" : "bg-primary/10"} />
                <StatCard icon={AlertTriangle} label="Interventions" value={String(interventionCount)} color="text-warning" bg="bg-warning/10" />
                <StatCard icon={Activity} label="Predictions" value={String(predictions.length)} color="text-primary" bg="bg-primary/10" />
                <StatCard icon={Brain} label="Top State" value={
                  Object.entries(stateDistribution).sort((a, b) => b[1] - a[1])[0]?.[0]?.replace("_", " ") || "N/A"
                } color="text-accent" bg="bg-accent/10" />
              </div>

              {/* State Distribution */}
              <div className="rounded-xl border border-border/50 p-4 space-y-3">
                <p className="text-xs font-semibold text-foreground">Cognitive State Distribution</p>
                {Object.entries(stateDistribution).sort((a, b) => b[1] - a[1]).map(([state, count]) => {
                  const pct = Math.round((count / Math.max(1, predictions.length)) * 100);
                  const stateColors: Record<string, string> = {
                    deep_focus: "bg-success", surface_focus: "bg-primary",
                    cognitive_fatigue: "bg-warning", emotional_frustration: "bg-destructive",
                    high_impulse: "bg-accent",
                  };
                  return (
                    <div key={state} className="space-y-1">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-foreground capitalize">{state.replace(/_/g, " ")}</span>
                        <span className="text-muted-foreground">{count} ({pct}%)</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden">
                        <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8 }}
                          className={`h-full rounded-full ${stateColors[state] || "bg-muted"}`} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Recent Predictions */}
              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="px-4 py-3 bg-secondary/30 border-b border-border/50">
                  <p className="text-xs font-semibold text-foreground">Recent Predictions</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="text-left px-4 py-2">Time</th>
                        <th className="text-center px-2 py-2">DP</th>
                        <th className="text-center px-2 py-2">State</th>
                        <th className="text-center px-2 py-2">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {predictions.slice(0, 30).map((p, i) => (
                        <tr key={i} className="border-b border-border/20">
                          <td className="px-4 py-2 text-foreground">{new Date(p.predicted_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                          <td className="text-center px-2 py-2">
                            <span className={`font-bold ${p.distraction_probability > 0.7 ? "text-destructive" : p.distraction_probability > 0.5 ? "text-warning" : "text-success"}`}>
                              {Math.round(p.distraction_probability * 100)}%
                            </span>
                          </td>
                          <td className="text-center px-2 py-2 text-muted-foreground capitalize">{p.cognitive_state.replace(/_/g, " ")}</td>
                          <td className="text-center px-2 py-2">
                            {p.intervention_triggered ? (
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-warning/15 text-warning font-medium">
                                Stage {p.intervention_stage}
                              </span>
                            ) : <span className="text-[9px] text-muted-foreground">—</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "discipline" && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <StatCard icon={ShieldCheck} label="Avg Discipline" value={`${avgDiscipline}`} color="text-primary" bg="bg-primary/10" />
                <StatCard icon={Target} label="Resisted" value={String(totalResisted)} color="text-success" bg="bg-success/10" />
                <StatCard icon={AlertTriangle} label="Yielded" value={String(totalYielded)} color="text-destructive" bg="bg-destructive/10" />
                <StatCard icon={Sparkles} label="XP Earned" value={String(totalXP)} color="text-accent" bg="bg-accent/10" />
              </div>

              <div className="rounded-xl border border-border/50 overflow-hidden">
                <div className="px-4 py-3 bg-secondary/30 border-b border-border/50">
                  <p className="text-xs font-semibold text-foreground">Neural Discipline History</p>
                </div>
                <div className="max-h-64 overflow-y-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border/30 text-muted-foreground">
                        <th className="text-left px-4 py-2">Date</th>
                        <th className="text-center px-2 py-2">Score</th>
                        <th className="text-center px-2 py-2">Resisted</th>
                        <th className="text-center px-2 py-2">Yielded</th>
                        <th className="text-center px-2 py-2">XP</th>
                      </tr>
                    </thead>
                    <tbody>
                      {disciplineScores.map(d => (
                        <tr key={d.score_date} className="border-b border-border/20">
                          <td className="px-4 py-2 text-foreground">{d.score_date}</td>
                          <td className="text-center px-2 py-2">
                            <span className={`font-bold ${d.discipline_score >= 70 ? "text-success" : d.discipline_score >= 40 ? "text-warning" : "text-destructive"}`}>
                              {d.discipline_score}
                            </span>
                          </td>
                          <td className="text-center px-2 py-2 text-success">{d.distractions_resisted}</td>
                          <td className="text-center px-2 py-2 text-destructive">{d.distractions_yielded}</td>
                          <td className="text-center px-2 py-2 text-accent">{d.brain_level_xp_earned}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === "locks" && lockConfig && (
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">Adaptive Lock Engine — lock duration scales with exam proximity, cognitive risk, and burnout.</p>

              <NumberRow label="Base Lock Duration" value={lockConfig.base_lock_seconds} onChange={v => setLockConfig({ ...lockConfig, base_lock_seconds: v })} unit="sec" />
              <NumberRow label="Min Lock" value={lockConfig.min_lock_seconds} onChange={v => setLockConfig({ ...lockConfig, min_lock_seconds: v })} unit="sec" />
              <NumberRow label="Max Lock" value={lockConfig.max_lock_seconds} onChange={v => setLockConfig({ ...lockConfig, max_lock_seconds: v })} unit="sec" />
              <NumberRow label="Exam Proximity Multiplier" value={lockConfig.exam_proximity_multiplier} onChange={v => setLockConfig({ ...lockConfig, exam_proximity_multiplier: v })} unit="x" />
              <NumberRow label="High Risk Multiplier" value={lockConfig.high_risk_multiplier} onChange={v => setLockConfig({ ...lockConfig, high_risk_multiplier: v })} unit="x" />
              <NumberRow label="Burnout Reduction" value={lockConfig.burnout_reduction_factor} onChange={v => setLockConfig({ ...lockConfig, burnout_reduction_factor: v })} unit="x" />
              <NumberRow label="Prediction Threshold" value={lockConfig.prediction_threshold} onChange={v => setLockConfig({ ...lockConfig, prediction_threshold: v })} unit="" />
              <NumberRow label="Breathing Exercise" value={lockConfig.breathing_exercise_seconds} onChange={v => setLockConfig({ ...lockConfig, breathing_exercise_seconds: v })} unit="sec" />
              <NumberRow label="A/B Traffic Split" value={lockConfig.ab_traffic_split} onChange={v => setLockConfig({ ...lockConfig, ab_traffic_split: v })} unit="%" />

              <ToggleRow label="Intervention A/B Testing" desc="Split users between intervention strategies"
                value={lockConfig.intervention_ab_enabled} onChange={v => setLockConfig({ ...lockConfig, intervention_ab_enabled: v })} />

              <div className="flex gap-2">
                <SelectRow label="Impulse Delay Type" value={lockConfig.impulse_delay_type}
                  options={["recall", "breathing", "both"]}
                  onChange={v => setLockConfig({ ...lockConfig, impulse_delay_type: v })} />
              </div>

              <motion.button whileTap={{ scale: 0.97 }} onClick={saveLockConfig} disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Lock Config"}
              </motion.button>
            </div>
          )}

          {tab === "config" && config && (
            <div className="space-y-4">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold">Core Settings</p>
              <ToggleRow label="Focus Shield Enabled" desc="Track and warn on distractions" value={config.is_enabled} onChange={v => setConfig({ ...config, is_enabled: v })} />
              <ToggleRow label="Auto Freeze" desc="Lock app after repeated distractions" value={config.auto_freeze_enabled} onChange={v => setConfig({ ...config, auto_freeze_enabled: v })} />
              <ToggleRow label="Micro Recall Required" desc="Require recall challenge to unlock" value={config.micro_recall_required} onChange={v => setConfig({ ...config, micro_recall_required: v })} />

              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pt-2">Predictive Modules</p>
              <ToggleRow label="Attention Drift Prediction" desc="ML-based distraction probability" value={config.prediction_enabled} onChange={v => setConfig({ ...config, prediction_enabled: v })} />
              <ToggleRow label="Cognitive State Classifier" desc="Classify focus/fatigue/impulse states" value={config.cognitive_classifier_enabled} onChange={v => setConfig({ ...config, cognitive_classifier_enabled: v })} />
              <ToggleRow label="Adaptive Lock Engine" desc="Dynamic lock duration based on context" value={config.adaptive_lock_enabled} onChange={v => setConfig({ ...config, adaptive_lock_enabled: v })} />
              <ToggleRow label="Dopamine Replacement" desc="Reward focus resistance with boosts" value={config.dopamine_replacement_enabled} onChange={v => setConfig({ ...config, dopamine_replacement_enabled: v })} />
              <ToggleRow label="Neural Discipline Tracking" desc="Track resisted distractions for XP" value={config.neural_discipline_enabled} onChange={v => setConfig({ ...config, neural_discipline_enabled: v })} />
              <ToggleRow label="Impulse Delay Challenge" desc="Require exercise before unlock" value={config.impulse_delay_enabled} onChange={v => setConfig({ ...config, impulse_delay_enabled: v })} />

              <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-semibold pt-2">Thresholds</p>
              <NumberRow label="Distraction Threshold" value={config.distraction_threshold} onChange={v => setConfig({ ...config, distraction_threshold: v })} unit="score" />
              <NumberRow label="Prediction Threshold" value={config.prediction_threshold} onChange={v => setConfig({ ...config, prediction_threshold: v })} unit="" />
              <NumberRow label="Warning Cooldown" value={config.warning_cooldown_seconds} onChange={v => setConfig({ ...config, warning_cooldown_seconds: v })} unit="sec" />
              <NumberRow label="Max Warnings" value={config.max_warnings_before_freeze} onChange={v => setConfig({ ...config, max_warnings_before_freeze: v })} unit="" />
              <NumberRow label="Freeze Duration" value={config.freeze_duration_seconds} onChange={v => setConfig({ ...config, freeze_duration_seconds: v })} unit="sec" />

              <motion.button whileTap={{ scale: 0.97 }} onClick={saveConfig} disabled={saving}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2">
                <Save className="w-4 h-4" />{saving ? "Saving..." : "Save Configuration"}
              </motion.button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// ═══ Shared Components ═══

function StatCard({ icon: Icon, label, value, color, bg }: { icon: any; label: string; value: string; color: string; bg: string }) {
  return (
    <div className={`rounded-xl ${bg} border border-border/30 p-4`}>
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
      <div>
        <p className="text-sm font-medium text-foreground">{label}</p>
        <p className="text-[10px] text-muted-foreground">{desc}</p>
      </div>
      <button onClick={() => onChange(!value)} className={`w-11 h-6 rounded-full transition-colors flex items-center px-0.5 ${value ? "bg-primary" : "bg-muted"}`}>
        <motion.div animate={{ x: value ? 20 : 0 }} className="w-5 h-5 rounded-full bg-white shadow-sm" />
      </button>
    </div>
  );
}

function NumberRow({ label, value, onChange, unit }: { label: string; value: number; onChange: (v: number) => void; unit: string }) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div className="flex items-center gap-2">
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))} step={value < 10 ? 0.1 : 1}
          className="w-20 px-3 py-1.5 rounded-lg bg-secondary border border-border/50 text-foreground text-sm text-right outline-none" />
        {unit && <span className="text-[10px] text-muted-foreground">{unit}</span>}
      </div>
    </div>
  );
}

function SelectRow({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div className="flex-1 flex items-center justify-between p-4 rounded-xl bg-secondary/30 border border-border/50">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <select value={value} onChange={e => onChange(e.target.value)}
        className="px-3 py-1.5 rounded-lg bg-secondary border border-border/50 text-foreground text-sm outline-none">
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
