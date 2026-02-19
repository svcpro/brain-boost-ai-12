import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Shield, Save, Clock, Lock, Zap, AlertTriangle, Crown } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";

const STUDY_MODES = [
  { id: "focus", label: "Focus Study Mode" },
  { id: "revision", label: "AI Revision Mode" },
  { id: "mock", label: "Mock Practice Mode" },
  { id: "emergency", label: "Emergency Rescue Mode" },
];

const ExamCountdownConfig = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [config, setConfig] = useState<any>(null);

  useEffect(() => {
    const fetch = async () => {
      const { data } = await (supabase as any).from("exam_countdown_config").select("*").limit(1).maybeSingle();
      if (data) setConfig(data);
      setLoading(false);
    };
    fetch();
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { id, created_at, ...updates } = config;
    const { error } = await (supabase as any).from("exam_countdown_config").update(updates).eq("id", config.id);
    setSaving(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Exam countdown config updated." });
    }
  };

  const toggleMode = (phase: string, modeId: string) => {
    const key = `${phase}_locked_modes`;
    const current: string[] = config[key] || [];
    const next = current.includes(modeId)
      ? current.filter((m: string) => m !== modeId)
      : [...current, modeId];
    setConfig({ ...config, [key]: next });
  };

  const toggleBypassPlan = (planKey: string) => {
    const current: string[] = config.bypass_plan_keys || [];
    const next = current.includes(planKey)
      ? current.filter((p: string) => p !== planKey)
      : [...current, planKey];
    setConfig({ ...config, bypass_plan_keys: next });
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading...</div>;
  if (!config) return <div className="p-8 text-center text-muted-foreground">No config found.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
            <Shield className="w-5 h-5 text-destructive" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">Exam Countdown Mode Control</h2>
            <p className="text-xs text-muted-foreground">Configure phase thresholds, locked modes, and plan overrides</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">System Enabled</span>
            <Switch checked={config.is_enabled} onCheckedChange={(v) => setConfig({ ...config, is_enabled: v })} />
          </div>
          <button onClick={save} disabled={saving} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 hover:opacity-90 disabled:opacity-50">
            <Save className="w-4 h-4" />
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      {/* Phase Thresholds */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-2">
          <Clock className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Phase Thresholds (Days Before Exam)</h3>
        </div>
        <div className="grid grid-cols-3 gap-4">
          {[
            { key: "normal_mode_min_days", label: "Normal Mode ≥", icon: <Zap className="w-3 h-3 text-success" /> },
            { key: "acceleration_mode_min_days", label: "Acceleration ≥", icon: <AlertTriangle className="w-3 h-3 text-warning" /> },
            { key: "lockdown_mode_min_days", label: "Lockdown ≥", icon: <Lock className="w-3 h-3 text-destructive" /> },
          ].map((t) => (
            <div key={t.key} className="space-y-1.5">
              <label className="text-xs text-muted-foreground flex items-center gap-1.5">{t.icon}{t.label}</label>
              <Input
                type="number"
                value={config[t.key]}
                onChange={(e) => setConfig({ ...config, [t.key]: parseInt(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Locked Modes Per Phase */}
      {["normal", "acceleration", "lockdown"].map((phase) => {
        const lockedKey = `${phase}_locked_modes`;
        const locked: string[] = config[lockedKey] || [];
        const phaseColors: Record<string, string> = {
          normal: "text-success",
          acceleration: "text-warning",
          lockdown: "text-destructive",
        };
        return (
          <div key={phase} className="rounded-xl border border-border bg-card p-5 space-y-3">
            <h3 className={`text-sm font-bold capitalize ${phaseColors[phase]}`}>
              {phase === "normal" ? "🟢" : phase === "acceleration" ? "🟡" : "🔴"} {phase} Phase — Locked Modes
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {STUDY_MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => toggleMode(phase, m.id)}
                  className={`flex items-center gap-2 px-3 py-2.5 rounded-lg border text-xs font-medium transition-all ${
                    locked.includes(m.id)
                      ? "bg-destructive/15 border-destructive/30 text-destructive"
                      : "bg-card border-border text-muted-foreground hover:bg-secondary/30"
                  }`}
                >
                  <Lock className={`w-3.5 h-3.5 ${locked.includes(m.id) ? "text-destructive" : "text-muted-foreground/30"}`} />
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      {/* Lock Messages */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Lock Messages</h3>
        {["acceleration", "lockdown"].map((phase) => (
          <div key={phase} className="space-y-1.5">
            <label className="text-xs text-muted-foreground capitalize">{phase} Phase Message</label>
            <Textarea
              value={config[`${phase}_lock_message`] || ""}
              onChange={(e) => setConfig({ ...config, [`${phase}_lock_message`]: e.target.value })}
              rows={2}
              className="text-xs"
            />
          </div>
        ))}
      </div>

      {/* Recommended Modes */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-4">
        <h3 className="text-sm font-bold text-foreground">Recommended Modes Per Phase</h3>
        <div className="grid grid-cols-2 gap-4">
          {["acceleration", "lockdown"].map((phase) => (
            <div key={phase} className="space-y-1.5">
              <label className="text-xs text-muted-foreground capitalize">{phase} Phase</label>
              <select
                value={config[`${phase}_recommended_mode`] || "focus"}
                onChange={(e) => setConfig({ ...config, [`${phase}_recommended_mode`]: e.target.value })}
                className="w-full h-9 rounded-lg border border-border bg-background px-3 text-xs"
              >
                {STUDY_MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Bypass */}
      <div className="rounded-xl border border-border bg-card p-5 space-y-3">
        <div className="flex items-center gap-2">
          <Crown className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-bold text-foreground">Plan-Based Bypass</h3>
        </div>
        <p className="text-xs text-muted-foreground">Users on these plans can bypass all mode locks.</p>
        <div className="flex gap-2">
          {["pro", "ultra"].map((plan) => (
            <button
              key={plan}
              onClick={() => toggleBypassPlan(plan)}
              className={`px-4 py-2 rounded-lg border text-xs font-medium capitalize transition-all ${
                (config.bypass_plan_keys || []).includes(plan)
                  ? "bg-primary/15 border-primary/30 text-primary"
                  : "bg-card border-border text-muted-foreground hover:bg-secondary/30"
              }`}
            >
              {plan}
            </button>
          ))}
        </div>
        {(config.bypass_plan_keys || []).includes("pro") && (
          <div className="flex items-center gap-2 p-2.5 rounded-lg bg-warning/10 border border-warning/20">
            <AlertTriangle className="w-3.5 h-3.5 text-warning shrink-0" />
            <p className="text-[11px] text-warning">Warning: Enabling Pro bypass means most paid users will skip all mode restrictions, defeating the lockdown purpose.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamCountdownConfig;
