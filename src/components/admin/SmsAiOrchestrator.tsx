import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Sparkles, Brain, Play, RefreshCw, Activity, Loader2, Clock, CheckCircle2, AlertTriangle } from "lucide-react";
import { format } from "date-fns";

type Config = {
  id: string;
  enabled: boolean;
  dry_run: boolean;
  max_per_user_per_day: number;
  max_users_per_run: number;
  lookback_hours: number;
  quiet_hours_start: number;
  quiet_hours_end: number;
  ai_model: string;
};

type RunLog = {
  id: string;
  triggered_by: string;
  status: string;
  dry_run: boolean;
  model: string;
  users_scanned: number;
  decisions_made: number;
  sms_sent: number;
  sms_skipped: number;
  sms_failed: number;
  ai_calls: number;
  duration_ms: number | null;
  started_at: string;
  finished_at: string | null;
  error: string | null;
};

const SmsAiOrchestrator = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  const [runs, setRuns] = useState<RunLog[]>([]);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadAll = async () => {
    setLoading(true);
    const [{ data: cfg }, { data: logs }] = await Promise.all([
      supabase.from("sms_orchestration_config").select("*").limit(1).maybeSingle(),
      supabase.from("sms_orchestration_log").select("*").order("started_at", { ascending: false }).limit(20),
    ]);
    setConfig((cfg as Config) || null);
    setRuns((logs as RunLog[]) || []);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const updateConfig = async (patch: Partial<Config>) => {
    if (!config) return;
    setSaving(true);
    const next = { ...config, ...patch };
    setConfig(next);
    const { error } = await supabase
      .from("sms_orchestration_config")
      .update(patch)
      .eq("id", config.id);
    setSaving(false);
    if (error) {
      toast({ title: "Save failed", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Saved", description: "Orchestrator settings updated." });
    }
  };

  const runNow = async (dryRun: boolean) => {
    setRunning(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-sms-orchestrator", {
        body: { dry_run: dryRun },
      });
      if (error) throw error;
      toast({
        title: dryRun ? "Dry-run started" : "Orchestration started",
        description: "AI is picking the best SMS for each user. Refresh in a few seconds.",
      });
      // Poll once after a short delay
      setTimeout(() => loadAll(), 4000);
    } catch (e: any) {
      toast({ title: "Run failed", description: e?.message || "Unknown error", variant: "destructive" });
    } finally {
      setRunning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!config) {
    return (
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Orchestrator config row missing. Please contact support.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Hero */}
      <Card className="border-violet-500/20 bg-gradient-to-br from-violet-500/5 via-fuchsia-500/5 to-transparent">
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Brain className="h-5 w-5 text-violet-400" />
                AI SMS Orchestrator
                <Badge variant="outline" className="border-violet-500/40 text-violet-300">
                  <Sparkles className="h-3 w-3 mr-1" /> Autonomous
                </Badge>
              </CardTitle>
              <CardDescription>
                Runs every hour. AI scans each user's signals, picks up to {config.max_per_user_per_day} best events, and dispatches them at the optimal time.
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={loadAll} disabled={running}>
                <RefreshCw className={`h-4 w-4 ${running ? "animate-spin" : ""}`} />
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => runNow(true)}
                disabled={running}
              >
                Dry-run
              </Button>
              <Button
                size="sm"
                className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:opacity-90"
                onClick={() => runNow(false)}
                disabled={running || !config.enabled}
              >
                {running ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Play className="h-4 w-4 mr-2" />}
                Run now
              </Button>
            </div>
          </div>
        </CardHeader>
      </Card>

      {/* Config */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Settings</CardTitle>
          <CardDescription>Cron triggers automatically every hour at :05</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Enabled</Label>
              <p className="text-xs text-muted-foreground">Master kill-switch for autonomous sends</p>
            </div>
            <Switch
              checked={config.enabled}
              disabled={saving}
              onCheckedChange={(v) => updateConfig({ enabled: v })}
            />
          </div>
          <div className="flex items-center justify-between rounded-lg border p-3">
            <div>
              <Label>Dry-run mode</Label>
              <p className="text-xs text-muted-foreground">Decide but don't send</p>
            </div>
            <Switch
              checked={config.dry_run}
              disabled={saving}
              onCheckedChange={(v) => updateConfig({ dry_run: v })}
            />
          </div>
          <div className="space-y-1">
            <Label>Max SMS per user per day</Label>
            <Input
              type="number"
              min={1}
              max={10}
              value={config.max_per_user_per_day}
              onChange={(e) => setConfig({ ...config, max_per_user_per_day: Number(e.target.value) })}
              onBlur={() => updateConfig({ max_per_user_per_day: config.max_per_user_per_day })}
            />
          </div>
          <div className="space-y-1">
            <Label>Max users per run</Label>
            <Input
              type="number"
              min={10}
              max={2000}
              value={config.max_users_per_run}
              onChange={(e) => setConfig({ ...config, max_users_per_run: Number(e.target.value) })}
              onBlur={() => updateConfig({ max_users_per_run: config.max_users_per_run })}
            />
          </div>
          <div className="space-y-1">
            <Label>Quiet hours (IST)</Label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                min={0}
                max={23}
                value={config.quiet_hours_start}
                onChange={(e) => setConfig({ ...config, quiet_hours_start: Number(e.target.value) })}
                onBlur={() => updateConfig({ quiet_hours_start: config.quiet_hours_start })}
              />
              <span className="text-muted-foreground">→</span>
              <Input
                type="number"
                min={0}
                max={23}
                value={config.quiet_hours_end}
                onChange={(e) => setConfig({ ...config, quiet_hours_end: Number(e.target.value) })}
                onBlur={() => updateConfig({ quiet_hours_end: config.quiet_hours_end })}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              No SMS will be sent during these India Standard Time hours (e.g. 22 → 8 means silent 10pm–8am IST)
            </p>
          </div>
          <div className="space-y-1">
            <Label>AI model</Label>
            <Input
              value={config.ai_model}
              onChange={(e) => setConfig({ ...config, ai_model: e.target.value })}
              onBlur={() => updateConfig({ ai_model: config.ai_model })}
            />
            <p className="text-xs text-muted-foreground">Default: google/gemini-3-flash-preview</p>
          </div>
        </CardContent>
      </Card>

      {/* Recent runs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Activity className="h-4 w-4" /> Recent runs
          </CardTitle>
          <CardDescription>Last 20 orchestration cycles</CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[420px] pr-2">
            {runs.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground text-sm">
                No runs yet. Click "Run now" to test.
              </div>
            ) : (
              <div className="space-y-2">
                {runs.map((r) => (
                  <div key={r.id} className="rounded-lg border p-3 text-sm">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {r.status === "complete" ? (
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                        ) : r.status === "running" ? (
                          <Loader2 className="h-4 w-4 animate-spin text-blue-400" />
                        ) : (
                          <AlertTriangle className="h-4 w-4 text-amber-500" />
                        )}
                        <span className="font-medium">{r.status}</span>
                        <Badge variant="outline" className="text-xs capitalize">{r.triggered_by}</Badge>
                        {r.dry_run && (
                          <Badge variant="outline" className="text-xs border-amber-500/40 text-amber-400">
                            dry-run
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {format(new Date(r.started_at), "MMM dd, HH:mm")}
                        {r.duration_ms ? ` · ${(r.duration_ms / 1000).toFixed(1)}s` : ""}
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 sm:grid-cols-5 gap-2 text-xs">
                      <Stat label="Scanned" value={r.users_scanned} />
                      <Stat label="AI calls" value={r.ai_calls} />
                      <Stat label="Decisions" value={r.decisions_made} />
                      <Stat label="Sent" value={r.sms_sent} positive />
                      <Stat label="Failed" value={r.sms_failed} negative />
                    </div>
                    {r.error && (
                      <div className="mt-2 text-xs text-rose-400 bg-rose-500/10 rounded p-2">
                        {r.error}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
};

const Stat = ({ label, value, positive, negative }: { label: string; value: number; positive?: boolean; negative?: boolean }) => (
  <div className="rounded border bg-muted/20 px-2 py-1">
    <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
    <div className={`font-semibold ${positive && value > 0 ? "text-emerald-400" : negative && value > 0 ? "text-rose-400" : ""}`}>
      {value}
    </div>
  </div>
);

export default SmsAiOrchestrator;
