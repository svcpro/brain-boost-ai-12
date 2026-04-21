import React, { useEffect, useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Activity, AlertTriangle, Brain, ChevronDown, ChevronUp, Clock, Cpu,
  FlaskConical, Layers, RefreshCw, Sparkles, Target, TrendingDown, Zap,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import QuickFixQuiz from "./QuickFixQuiz";

type Risk = "critical" | "high" | "medium" | "low";

interface TopicDecay {
  topic_id: string;
  topic_name: string;
  subject_name: string | null;
  predicted_retention: number;
  predicted_retention_pct: number;
  decay_velocity_24h: number;
  hours_until_optimal_review: number;
  risk_level: Risk;
  review_urgency: string;
  memory_strength: number;
  stability_hours: number;
  factors: Record<string, number>;
}

interface LandscapeRow {
  subject: string;
  critical: number;
  high: number;
  medium: number;
  low: number;
  total: number;
  health_score: number;
}

interface DashboardData {
  overall_retention: number;
  overall_retention_pct: number;
  total_topics: number;
  urgent_count: number;
  warning_count: number;
  safe_count: number;
  topic_decays: TopicDecay[];
  memory_landscape: LandscapeRow[];
  risk_alert: { type: string; message: string; urgent_topics: string[] } | null;
  user_context: {
    best_study_hour: number;
    recent_load_minutes_24h: number;
    late_night_sessions: number;
  };
  model_version: string;
  model_name: string;
  model_description: string;
  factor_count: number;
}

interface AIInsight {
  narrative: string;
  actions: string[];
  cached?: boolean;
}

type Tab = "overview" | "landscape" | "simulator" | "ai";

const RISK_COLOR: Record<Risk, string> = {
  critical: "text-destructive",
  high: "text-chart-5",
  medium: "text-chart-4",
  low: "text-chart-2",
};
const RISK_BG: Record<Risk, string> = {
  critical: "bg-destructive",
  high: "bg-chart-5",
  medium: "bg-chart-4",
  low: "bg-chart-2",
};

export default function ForgettingCurve2Card() {
  const { user } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [tab, setTab] = useState<Tab>("overview");
  const [expanded, setExpanded] = useState(false);
  const [fixSession, setFixSession] = useState<{ subject: string; topic: string; retention: number } | null>(null);

  // AI narrative
  const [aiInsight, setAiInsight] = useState<AIInsight | null>(null);
  const [aiLoading, setAiLoading] = useState(false);

  // Simulator
  const [simTopicId, setSimTopicId] = useState<string>("");
  const [simScenario, setSimScenario] = useState<"review_now" | "review_3x_this_week" | "skip_7_days">("review_now");
  const [simResult, setSimResult] = useState<any>(null);
  const [simLoading, setSimLoading] = useState(false);

  const fetchDashboard = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: apiData, error } = await supabase.functions.invoke("forgetting-curve", {
        body: { action: "dashboard" },
      });
      if (!error && apiData?.success) setData(apiData.data);
    } catch (e) {
      console.error("FC2 fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!hasLoaded && user) {
      setHasLoaded(true);
      fetchDashboard();
    }
  }, [hasLoaded, user, fetchDashboard]);

  // Lazy-load AI when user opens AI tab
  useEffect(() => {
    if (tab !== "ai" || aiInsight || aiLoading) return;
    setAiLoading(true);
    supabase.functions
      .invoke("forgetting-curve", { body: { action: "ai-narrative" } })
      .then(({ data: r }) => { if (r?.success) setAiInsight(r.data); })
      .catch(() => {})
      .finally(() => setAiLoading(false));
  }, [tab, aiInsight, aiLoading]);

  // Initialize simulator topic to first urgent
  useEffect(() => {
    if (!simTopicId && data?.topic_decays?.length) {
      setSimTopicId(data.topic_decays[0].topic_id);
    }
  }, [data, simTopicId]);

  const runSimulation = async () => {
    if (!simTopicId) return;
    setSimLoading(true);
    setSimResult(null);
    try {
      const { data: r } = await supabase.functions.invoke("forgetting-curve", {
        body: { action: "simulate", topic_id: simTopicId, scenario: simScenario },
      });
      if (r?.success) setSimResult(r.data);
    } catch (e) {
      console.error(e);
    } finally {
      setSimLoading(false);
    }
  };

  const handleFix = (topic: TopicDecay) => {
    setFixSession({
      subject: topic.subject_name || "",
      topic: topic.topic_name,
      retention: topic.predicted_retention_pct,
    });
  };

  const overallRisk: Risk = useMemo(() => {
    if (!data) return "low";
    const r = data.overall_retention;
    if (r < 0.3) return "critical";
    if (r < 0.5) return "high";
    if (r < 0.7) return "medium";
    return "low";
  }, [data]);

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 animate-pulse">
        <div className="h-32 bg-secondary rounded" />
      </div>
    );
  }

  if (!data || !data.topic_decays || data.topic_decays.length === 0) return null;

  // Defensive defaults so a partial/legacy API response cannot crash the card
  const userContext = data.user_context ?? { best_study_hour: 18, recent_load_minutes_24h: 0, late_night_sessions: 0 };
  const memoryLandscape = data.memory_landscape ?? [];
  const factorCount = data.factor_count ?? 12;

  const displayTopics = expanded ? data.topic_decays.slice(0, 12) : data.topic_decays.slice(0, 4);
  const simTopic = data.topic_decays.find(t => t.topic_id === simTopicId);

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(var(--chart-3) / 0.06), hsl(var(--primary) / 0.04), hsl(var(--card)))",
        }}
      >
        {/* Header */}
        <div className="p-5 pb-3">
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-chart-3/30 to-primary/20 flex items-center justify-center">
                  <Brain className="w-5 h-5 text-chart-3" />
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-chart-3 animate-pulse" />
              </div>
              <div>
                <div className="flex items-center gap-1.5">
                  <h3 className="text-sm font-bold text-foreground">Forgetting Curve 2.0</h3>
                  <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-primary/15 text-primary font-bold">NEURAL</span>
                </div>
                <p className="text-[10px] text-muted-foreground">{factorCount}-Factor Decay · DSR + Circadian + Interference</p>
              </div>
            </div>
            <button
              onClick={fetchDashboard}
              disabled={loading}
              className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
              aria-label="Refresh"
            >
              <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>

          {/* Headline metrics */}
          <div className="grid grid-cols-4 gap-2 mt-3">
            <Metric icon={<Target className="w-3 h-3" />} label="Retention" value={`${data.overall_retention_pct}%`} colorClass={RISK_COLOR[overallRisk]} />
            <Metric icon={<AlertTriangle className="w-3 h-3" />} label="Urgent" value={`${data.urgent_count}/${data.total_topics}`} colorClass="text-destructive" />
            <Metric icon={<Clock className="w-3 h-3" />} label="Best hr" value={`${userContext.best_study_hour}:00`} colorClass="text-chart-2" />
            <Metric icon={<Cpu className="w-3 h-3" />} label="Load 24h" value={`${userContext.recent_load_minutes_24h}m`} colorClass="text-chart-5" />
          </div>
        </div>

        {/* Tabs */}
        <div className="px-3 flex gap-1 border-b border-border/40">
          {[
            { id: "overview" as Tab, label: "Topics", icon: TrendingDown },
            { id: "landscape" as Tab, label: "Landscape", icon: Layers },
            { id: "simulator" as Tab, label: "What-if", icon: FlaskConical },
            { id: "ai" as Tab, label: "AI", icon: Sparkles },
          ].map(t => {
            const Icon = t.icon;
            const active = tab === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-1 px-2.5 py-2 text-[10px] font-medium transition-colors relative ${
                  active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-3 h-3" />
                {t.label}
                {active && (
                  <motion.div layoutId="fc2-tab" className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary rounded-t" />
                )}
              </button>
            );
          })}
        </div>

        {/* Content */}
        <div className="p-4">
          <AnimatePresence mode="wait">
            {tab === "overview" && (
              <motion.div
                key="overview"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
              >
                {data.risk_alert && (
                  <div className="flex items-start gap-2 mb-3 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20">
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <p className="text-[10px] text-destructive font-semibold leading-tight">{data.risk_alert.message}</p>
                      <p className="text-[9px] text-destructive/80 mt-0.5">Auto-rescue interventions queued in your Brain.</p>
                    </div>
                  </div>
                )}
                <div className="space-y-2">
                  {displayTopics.map(topic => (
                    <TopicRow key={topic.topic_id} topic={topic} onFix={handleFix} />
                  ))}
                </div>
                {data.topic_decays.length > 4 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="w-full flex items-center justify-center gap-1 py-2 mt-2 text-[10px] text-muted-foreground hover:text-primary transition-colors"
                  >
                    {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {expanded ? "Show less" : `Show ${Math.min(data.topic_decays.length, 12) - 4} more`}
                  </button>
                )}
              </motion.div>
            )}

            {tab === "landscape" && (
              <motion.div
                key="landscape"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-2"
              >
                <p className="text-[10px] text-muted-foreground mb-2">Memory health by subject (lower = riskier).</p>
                {memoryLandscape.map(row => (
                  <div key={row.subject} className="px-3 py-2.5 rounded-xl bg-secondary/30 border border-border/30">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-medium text-foreground truncate">{row.subject}</span>
                      <span className={`text-[10px] font-bold ${row.health_score >= 70 ? "text-chart-2" : row.health_score >= 40 ? "text-chart-5" : "text-destructive"}`}>
                        {row.health_score}/100
                      </span>
                    </div>
                    <div className="flex h-1.5 rounded-full overflow-hidden bg-secondary">
                      {row.critical > 0 && <div className="bg-destructive" style={{ width: `${(row.critical / row.total) * 100}%` }} />}
                      {row.high > 0     && <div className="bg-chart-5"     style={{ width: `${(row.high     / row.total) * 100}%` }} />}
                      {row.medium > 0   && <div className="bg-chart-4"     style={{ width: `${(row.medium   / row.total) * 100}%` }} />}
                      {row.low > 0      && <div className="bg-chart-2"     style={{ width: `${(row.low      / row.total) * 100}%` }} />}
                    </div>
                    <div className="flex items-center gap-3 mt-1.5 text-[9px] text-muted-foreground">
                      <span>🔴 {row.critical}</span>
                      <span>🟠 {row.high}</span>
                      <span>🟡 {row.medium}</span>
                      <span>🟢 {row.low}</span>
                    </div>
                  </div>
                ))}
              </motion.div>
            )}

            {tab === "simulator" && (
              <motion.div
                key="simulator"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                <p className="text-[10px] text-muted-foreground">See how an action will change your retention.</p>
                <div>
                  <label className="text-[10px] text-muted-foreground">Topic</label>
                  <select
                    value={simTopicId}
                    onChange={e => { setSimTopicId(e.target.value); setSimResult(null); }}
                    className="w-full mt-1 px-2 py-1.5 rounded-lg bg-secondary border border-border text-xs text-foreground outline-none focus:border-primary"
                  >
                    {data.topic_decays.map(t => (
                      <option key={t.topic_id} value={t.topic_id}>
                        {t.topic_name} ({t.predicted_retention_pct}%)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground">Scenario</label>
                  <div className="grid grid-cols-3 gap-1.5 mt-1">
                    {[
                      { id: "review_now",          label: "Review now" },
                      { id: "review_3x_this_week", label: "3× this wk" },
                      { id: "skip_7_days",         label: "Skip 7 d" },
                    ].map(s => (
                      <button
                        key={s.id}
                        onClick={() => { setSimScenario(s.id as any); setSimResult(null); }}
                        className={`px-2 py-1.5 rounded-lg text-[10px] font-medium border transition-colors ${
                          simScenario === s.id ? "bg-primary text-primary-foreground border-primary" : "bg-secondary text-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {s.label}
                      </button>
                    ))}
                  </div>
                </div>
                <button
                  onClick={runSimulation}
                  disabled={simLoading || !simTopicId}
                  className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {simLoading ? <RefreshCw className="w-3 h-3 animate-spin" /> : <FlaskConical className="w-3 h-3" />}
                  Run simulation
                </button>
                {simResult && simTopic && (
                  <div className="rounded-xl border border-border bg-card p-3 space-y-2">
                    <p className="text-[10px] text-muted-foreground">{simResult.scenario_label}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-secondary/40 p-2">
                        <p className="text-[9px] text-muted-foreground">Current</p>
                        <p className="text-base font-bold text-foreground">{simResult.baseline.predicted_retention_pct}%</p>
                      </div>
                      <div className={`rounded-lg p-2 ${simResult.retention_delta >= 0 ? "bg-chart-2/15" : "bg-destructive/10"}`}>
                        <p className="text-[9px] text-muted-foreground">After scenario</p>
                        <p className={`text-base font-bold ${simResult.retention_delta >= 0 ? "text-chart-2" : "text-destructive"}`}>
                          {simResult.simulated.predicted_retention_pct}%
                        </p>
                      </div>
                    </div>
                    <p className="text-[10px] text-foreground">
                      Retention {simResult.retention_delta >= 0 ? "gain" : "loss"}:{" "}
                      <span className={`font-bold ${simResult.retention_delta >= 0 ? "text-chart-2" : "text-destructive"}`}>
                        {simResult.retention_delta >= 0 ? "+" : ""}{Math.round(simResult.retention_delta * 100)}%
                      </span>
                    </p>
                  </div>
                )}
              </motion.div>
            )}

            {tab === "ai" && (
              <motion.div
                key="ai"
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                className="space-y-3"
              >
                {aiLoading && (
                  <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                    <RefreshCw className="w-3 h-3 animate-spin" /> Generating personalized insight…
                  </div>
                )}
                {aiInsight && (
                  <>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3">
                      <div className="flex items-center gap-1.5 mb-1.5">
                        <Sparkles className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-semibold text-primary">AI Memory Coach</span>
                        {aiInsight.cached && <span className="text-[8px] text-muted-foreground">cached</span>}
                      </div>
                      <p className="text-[11px] leading-relaxed text-foreground whitespace-pre-line">{aiInsight.narrative}</p>
                    </div>
                    {aiInsight.actions.length > 0 && (
                      <div className="space-y-1.5">
                        {aiInsight.actions.map((a, i) => (
                          <div key={i} className="flex items-start gap-2 px-3 py-2 rounded-lg bg-secondary/30 border border-border/30">
                            <span className="text-[10px] font-bold text-primary">{i + 1}.</span>
                            <span className="text-[11px] text-foreground">{a}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
                {!aiInsight && !aiLoading && (
                  <p className="text-[10px] text-muted-foreground">Open this tab to generate insights.</p>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Version footer */}
          <div className="flex items-center justify-between mt-3 pt-2 border-t border-border/30">
            <span className="text-[9px] text-muted-foreground">{data.model_description}</span>
            <span className="text-[9px] font-mono text-muted-foreground">{data.model_version}</span>
          </div>
        </div>
      </motion.div>

      <QuickFixQuiz
        open={!!fixSession}
        onClose={() => {
          setFixSession(null);
          fetchDashboard();
          window.dispatchEvent(new Event("insights-refresh"));
        }}
        topicName={fixSession?.topic || ""}
        subjectName={fixSession?.subject || ""}
        retentionPct={fixSession?.retention || 0}
      />
    </>
  );
}

function Metric({ icon, label, value, colorClass }: { icon: React.ReactNode; label: string; value: string | number; colorClass: string }) {
  return (
    <div className="rounded-lg bg-secondary/40 border border-border/30 px-2 py-1.5">
      <div className="flex items-center gap-1 text-muted-foreground">
        {icon}
        <span className="text-[8px] uppercase tracking-wide">{label}</span>
      </div>
      <p className={`text-sm font-bold ${colorClass}`}>{value}</p>
    </div>
  );
}

function TopicRow({ topic, onFix }: { topic: TopicDecay; onFix: (t: TopicDecay) => void }) {
  const retPct = topic.predicted_retention_pct;
  const dropPerDay = Math.round(topic.decay_velocity_24h * 100);
  return (
    <motion.div
      whileTap={{ scale: 0.97 }}
      onClick={() => onFix(topic)}
      className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-secondary/30 border border-border/30 cursor-pointer hover:border-primary/30 hover:bg-secondary/50 transition-all"
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-medium text-foreground truncate">{topic.topic_name}</span>
          {topic.subject_name && (
            <span className="text-[8px] text-muted-foreground px-1.5 py-0.5 rounded bg-secondary shrink-0">{topic.subject_name}</span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-1">
          <div className="flex-1 h-1 rounded-full bg-secondary overflow-hidden">
            <div className={`h-full rounded-full ${RISK_BG[topic.risk_level]}`} style={{ width: `${retPct}%` }} />
          </div>
          <span className={`text-[9px] font-medium ${RISK_COLOR[topic.risk_level]} w-8 text-right`}>{retPct}%</span>
        </div>
        {dropPerDay > 0 && (
          <div className="flex items-center gap-1 mt-0.5">
            <TrendingDown className="w-2.5 h-2.5 text-destructive" />
            <span className="text-[9px] text-destructive">−{dropPerDay}% / 24h</span>
          </div>
        )}
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {topic.hours_until_optimal_review > 0 ? `${Math.round(topic.hours_until_optimal_review)}h` : "Now"}
        </span>
        <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-colors">
          <Zap className="w-3 h-3 text-primary" />
          <span className="text-[9px] font-semibold text-primary">Fix</span>
        </div>
      </div>
    </motion.div>
  );
}
