import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Clock, Lock, Shield, Sparkles, TrendingUp, Users, RefreshCw } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface UserPrediction {
  id: string;
  user_id: string;
  exam_date: string;
  predicted_acceleration_days: number;
  predicted_lockdown_days: number;
  locked_modes_acceleration: string[];
  locked_modes_lockdown: string[];
  recommended_mode_acceleration: string;
  recommended_mode_lockdown: string;
  ai_reasoning: string;
  confidence_score: number;
  factors: any;
  computed_at: string;
}

const MODE_LABELS: Record<string, string> = {
  focus: "Focus Study",
  revision: "AI Revision",
  mock: "Mock Practice",
  emergency: "Emergency Rescue",
};

const ExamCountdownConfig = () => {
  const [predictions, setPredictions] = useState<UserPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [userNames, setUserNames] = useState<Record<string, string>>({});

  useEffect(() => {
    fetchPredictions();
  }, []);

  const fetchPredictions = async () => {
    setLoading(true);
    const { data } = await (supabase as any)
      .from("exam_countdown_predictions")
      .select("*")
      .order("computed_at", { ascending: false })
      .limit(50);

    if (data) {
      setPredictions(data);
      // Fetch user names
      const userIds = data.map((p: any) => p.user_id);
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, display_name, email")
          .in("id", userIds);
        if (profiles) {
          const names: Record<string, string> = {};
          profiles.forEach((p: any) => {
            names[p.id] = p.display_name || p.email || "Unknown";
          });
          setUserNames(names);
        }
      }
    }
    setLoading(false);
  };

  const getPhaseForUser = (p: UserPrediction) => {
    const days = Math.ceil((new Date(p.exam_date).getTime() - Date.now()) / 86400000);
    if (days < 0) return { phase: "passed", days, color: "text-muted-foreground" };
    if (days <= p.predicted_lockdown_days) return { phase: "lockdown", days, color: "text-destructive" };
    if (days <= p.predicted_acceleration_days) return { phase: "acceleration", days, color: "text-warning" };
    return { phase: "normal", days, color: "text-success" };
  };

  if (loading) return <div className="p-8 text-center text-muted-foreground">Loading AI predictions...</div>;

  const phaseStats = {
    normal: predictions.filter(p => getPhaseForUser(p).phase === "normal").length,
    acceleration: predictions.filter(p => getPhaseForUser(p).phase === "acceleration").length,
    lockdown: predictions.filter(p => getPhaseForUser(p).phase === "lockdown").length,
    passed: predictions.filter(p => getPhaseForUser(p).phase === "passed").length,
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
            <Brain className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">AI Exam Countdown Intelligence</h2>
            <p className="text-xs text-muted-foreground">AI automatically predicts optimal phase transitions per student</p>
          </div>
        </div>
        <button
          onClick={fetchPredictions}
          className="p-2 rounded-lg hover:bg-secondary/50 transition-colors"
          title="Refresh"
        >
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      {/* Info Banner */}
      <div className="rounded-xl bg-primary/5 border border-primary/20 p-4 flex items-start gap-3">
        <Sparkles className="w-5 h-5 text-primary shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-foreground">Fully AI-Driven</p>
          <p className="text-xs text-muted-foreground mt-0.5">
            Phase thresholds, locked modes, and recommendations are computed per-user based on memory strength, 
            weak topics, study patterns, brain evolution, and learning efficiency. Predictions refresh every 24 hours.
          </p>
        </div>
      </div>

      {/* Phase Distribution */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: "Normal", count: phaseStats.normal, icon: "🟢", color: "text-success" },
          { label: "Acceleration", count: phaseStats.acceleration, icon: "🟡", color: "text-warning" },
          { label: "Lockdown", count: phaseStats.lockdown, icon: "🔴", color: "text-destructive" },
          { label: "Passed", count: phaseStats.passed, icon: "⚫", color: "text-muted-foreground" },
        ].map(s => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
            <span className="text-lg">{s.icon}</span>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.count}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Per-User Predictions */}
      <div className="rounded-xl border border-border bg-card">
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Users className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-bold text-foreground">Per-User AI Predictions</h3>
          <Badge variant="secondary" className="ml-auto text-[10px]">{predictions.length} users</Badge>
        </div>

        {predictions.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground text-sm">
            No predictions yet. Predictions are generated when users with exam dates visit the app.
          </div>
        ) : (
          <div className="divide-y divide-border max-h-[500px] overflow-y-auto">
            {predictions.map(p => {
              const { phase, days, color } = getPhaseForUser(p);
              const factors = p.factors || {};
              return (
                <div key={p.id} className="p-4 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${
                        phase === "lockdown" ? "bg-destructive" : phase === "acceleration" ? "bg-warning" : phase === "normal" ? "bg-success" : "bg-muted-foreground"
                      }`} />
                      <span className="text-sm font-medium text-foreground">{userNames[p.user_id] || p.user_id.slice(0, 8)}</span>
                      <Badge variant="outline" className={`text-[10px] ${color}`}>
                        {phase.toUpperCase()}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Clock className="w-3 h-3" />
                      {days > 0 ? `${days}d left` : "Passed"}
                    </div>
                  </div>

                  {/* AI Decision Details */}
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-muted-foreground">Accel. trigger</p>
                      <p className="font-medium text-foreground">{p.predicted_acceleration_days} days before</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-muted-foreground">Lockdown trigger</p>
                      <p className="font-medium text-foreground">{p.predicted_lockdown_days} days before</p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-muted-foreground">Locked (Accel.)</p>
                      <p className="font-medium text-foreground">
                        {p.locked_modes_acceleration?.length > 0 
                          ? p.locked_modes_acceleration.map(m => MODE_LABELS[m] || m).join(", ")
                          : "None"}
                      </p>
                    </div>
                    <div className="rounded-lg bg-secondary/30 p-2">
                      <p className="text-muted-foreground">Locked (Lockdown)</p>
                      <p className="font-medium text-foreground">
                        {p.locked_modes_lockdown?.length > 0 
                          ? p.locked_modes_lockdown.map(m => MODE_LABELS[m] || m).join(", ")
                          : "None"}
                      </p>
                    </div>
                  </div>

                  {/* AI Reasoning */}
                  {p.ai_reasoning && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
                      <Brain className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{p.ai_reasoning}</p>
                    </div>
                  )}

                  {/* Confidence + Factors */}
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3" />
                      Confidence: {(p.confidence_score * 100).toFixed(0)}%
                    </span>
                    {factors.avg_memory !== undefined && (
                      <span>Memory: {(factors.avg_memory * 100).toFixed(0)}%</span>
                    )}
                    {factors.weak_topics !== undefined && (
                      <span>Weak: {factors.weak_topics}</span>
                    )}
                    <span className="ml-auto">
                      Updated: {new Date(p.computed_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamCountdownConfig;
