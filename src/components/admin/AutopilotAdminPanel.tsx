import { useState, useEffect } from "react";
import { Bot, Save, Loader2, Zap, Shield, Mail, Bell } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface AutopilotConfig {
  id: string;
  is_enabled: boolean;
  intensity_level: string;
  auto_schedule_enabled: boolean;
  auto_mode_switch_enabled: boolean;
  auto_emergency_enabled: boolean;
  auto_mock_optimization_enabled: boolean;
  auto_weekly_report_enabled: boolean;
  emergency_drop_threshold: number;
  emergency_min_memory_strength: number;
  report_send_day: number;
  report_send_hour: number;
  report_channels: string[];
  max_daily_auto_sessions: number;
}

export default function AutopilotAdminPanel() {
  const [config, setConfig] = useState<AutopilotConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadConfig();
  }, []);

  const loadConfig = async () => {
    const { data } = await supabase.from("autopilot_config").select("*").limit(1).single();
    if (data) setConfig(data as unknown as AutopilotConfig);
    setLoading(false);
  };

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from("autopilot_config")
      .update({
        is_enabled: config.is_enabled,
        intensity_level: config.intensity_level,
        auto_schedule_enabled: config.auto_schedule_enabled,
        auto_mode_switch_enabled: config.auto_mode_switch_enabled,
        auto_emergency_enabled: config.auto_emergency_enabled,
        auto_mock_optimization_enabled: config.auto_mock_optimization_enabled,
        auto_weekly_report_enabled: config.auto_weekly_report_enabled,
        emergency_drop_threshold: config.emergency_drop_threshold,
        emergency_min_memory_strength: config.emergency_min_memory_strength,
        report_send_day: config.report_send_day,
        report_send_hour: config.report_send_hour,
        report_channels: config.report_channels,
        max_daily_auto_sessions: config.max_daily_auto_sessions,
        updated_at: new Date().toISOString(),
      } as any)
      .eq("id", config.id);
    setSaving(false);
    if (error) toast.error("Failed to save");
    else toast.success("Autopilot config saved");
  };

  if (loading || !config) return <div className="text-sm text-muted-foreground p-4">Loading...</div>;

  const update = (key: keyof AutopilotConfig, value: any) =>
    setConfig(prev => prev ? { ...prev, [key]: value } : prev);

  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

  return (
    <div className="space-y-4">
      {/* Master Toggle */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Bot className="w-4 h-4 text-primary" />
              Autopilot Engine
            </CardTitle>
            <Switch checked={config.is_enabled} onCheckedChange={v => update("is_enabled", v)} />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Intensity */}
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Default Intensity</span>
            <Select value={config.intensity_level} onValueChange={v => update("intensity_level", v)}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="gentle">🌿 Gentle</SelectItem>
                <SelectItem value="balanced">⚡ Balanced</SelectItem>
                <SelectItem value="intense">🔥 Intense</SelectItem>
                <SelectItem value="beast">💀 Beast</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Max Sessions */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Max Daily Sessions</span>
              <Badge variant="outline">{config.max_daily_auto_sessions}</Badge>
            </div>
            <Slider
              value={[config.max_daily_auto_sessions]}
              onValueChange={([v]) => update("max_daily_auto_sessions", v)}
              min={2} max={10} step={1}
            />
          </div>
        </CardContent>
      </Card>

      {/* Feature Toggles */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Zap className="w-4 h-4 text-warning" />
            Feature Controls
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {[
            { key: "auto_schedule_enabled" as const, label: "Auto Daily Scheduling", desc: "Generate daily plans automatically" },
            { key: "auto_mode_switch_enabled" as const, label: "Auto Mode Switching", desc: "Switch Focus/Revision/Mock intelligently" },
            { key: "auto_emergency_enabled" as const, label: "Auto Emergency Trigger", desc: "Detect drops and trigger rescue" },
            { key: "auto_mock_optimization_enabled" as const, label: "Auto Mock Optimization", desc: "Adjust difficulty from performance" },
            { key: "auto_weekly_report_enabled" as const, label: "Weekly AI Reports", desc: "Auto-generate performance summaries" },
          ].map(item => (
            <div key={item.key} className="flex items-center justify-between py-1">
              <div>
                <p className="text-sm text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <Switch checked={config[item.key] as boolean} onCheckedChange={v => update(item.key, v)} />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Emergency Config */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-destructive" />
            Emergency Thresholds
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Drop Threshold (%)</span>
              <Badge variant="outline">{config.emergency_drop_threshold}%</Badge>
            </div>
            <Slider
              value={[config.emergency_drop_threshold]}
              onValueChange={([v]) => update("emergency_drop_threshold", v)}
              min={5} max={50} step={5}
            />
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">Min Memory Strength</span>
              <Badge variant="outline">{config.emergency_min_memory_strength}%</Badge>
            </div>
            <Slider
              value={[config.emergency_min_memory_strength]}
              onValueChange={([v]) => update("emergency_min_memory_strength", v)}
              min={10} max={50} step={5}
            />
          </div>
        </CardContent>
      </Card>

      {/* Report Config */}
      <Card className="bg-card border-border/50">
        <CardHeader className="pb-3">
          <CardTitle className="text-base flex items-center gap-2">
            <Mail className="w-4 h-4 text-accent" />
            Weekly Report Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Send Day</span>
            <Select value={String(config.report_send_day)} onValueChange={v => update("report_send_day", parseInt(v))}>
              <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
              <SelectContent>
                {dayNames.map((d, i) => (
                  <SelectItem key={i} value={String(i)}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Send Hour</span>
            <Select value={String(config.report_send_hour)} onValueChange={v => update("report_send_hour", parseInt(v))}>
              <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {i > 12 ? i - 12 : i === 0 ? 12 : i}:00 {i >= 12 ? "PM" : "AM"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">Channels</span>
            <div className="flex gap-1.5">
              {["email", "in_app"].map(ch => (
                <Badge
                  key={ch}
                  variant={config.report_channels.includes(ch) ? "default" : "outline"}
                  className="cursor-pointer text-[10px]"
                  onClick={() => {
                    const channels = config.report_channels.includes(ch)
                      ? config.report_channels.filter(c => c !== ch)
                      : [...config.report_channels, ch];
                    update("report_channels", channels);
                  }}
                >
                  {ch === "email" ? "📧 Email" : "🔔 In-App"}
                </Badge>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Save */}
      <Button onClick={save} disabled={saving} className="w-full">
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
        Save Autopilot Configuration
      </Button>
    </div>
  );
}
