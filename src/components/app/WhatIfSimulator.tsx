import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FlaskConical, ChevronDown, TrendingUp, TrendingDown, Sparkles, Crosshair, Zap, Shield, AlertTriangle, Trophy, Brain, Clock, Target } from "lucide-react";
import FocusModeSession from "./FocusModeSession";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Area, AreaChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { useCognitiveTwin, type TopicCognitiveModel } from "@/hooks/useCognitiveTwin";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import confetti from "canvas-confetti";

interface Props {
  topicModels: TopicCognitiveModel[];
  subjectMap?: Record<string, string>;
}

interface ScenarioInput {
  name: string;
  daily_hours: number;
  focus_topics: string;
  intensity: string;
  revision_frequency: string;
}

interface ScenarioResult {
  name: string;
  predicted_rank_min: number;
  predicted_rank_max: number;
  predicted_retention: number;
  predicted_score_min: number;
  predicted_score_max: number;
  burnout_risk: string;
  knowledge_gap_risk: string;
  confidence: number;
  strategy_note: string;
}

interface SimulationOutput {
  scenarios: ScenarioResult[];
  recommended_scenario: string;
  recommendation_reason: string;
  overall_outlook: string;
}

const PRESET_SCENARIOS: ScenarioInput[] = [
  { name: "Relaxed Pace", daily_hours: 1, focus_topics: "weak topics only", intensity: "low", revision_frequency: "every 3 days" },
  { name: "Balanced Study", daily_hours: 2.5, focus_topics: "mix of weak and strong topics", intensity: "moderate", revision_frequency: "daily" },
  { name: "Intensive Grind", daily_hours: 5, focus_topics: "all topics with priority on weakest", intensity: "high", revision_frequency: "twice daily" },
];

const riskColor = (risk: string) => {
  switch (risk) {
    case "low": return "text-success";
    case "moderate": return "text-warning";
    case "high": return "text-destructive";
    case "critical": return "text-destructive animate-pulse";
    default: return "text-muted-foreground";
  }
};

const riskBg = (risk: string) => {
  switch (risk) {
    case "low": return "bg-success/10 border-success/20";
    case "moderate": return "bg-warning/10 border-warning/20";
    case "high": return "bg-destructive/10 border-destructive/20";
    case "critical": return "bg-destructive/15 border-destructive/30";
    default: return "bg-secondary/30 border-border/40";
  }
};

export default function WhatIfSimulator({ topicModels, subjectMap = {} }: Props) {
  const { simulate, loading: twinLoading } = useCognitiveTwin();
  const [selectedTopicId, setSelectedTopicId] = useState<string>("");
  const [daysAhead, setDaysAhead] = useState(14);
  const [simResult, setSimResult] = useState<any>(null);
  const [open, setOpen] = useState(false);
  const [focusOpen, setFocusOpen] = useState(false);

  // World Model state
  const [worldModelResult, setWorldModelResult] = useState<SimulationOutput | null>(null);
  const [worldModelLoading, setWorldModelLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"topic" | "world">("world");
  const [selectedScenarios, setSelectedScenarios] = useState<number[]>([0, 1]);

  const selectedTopic = useMemo(
    () => topicModels.find(t => t.topic_id === selectedTopicId),
    [topicModels, selectedTopicId]
  );

  // Generate retention curve data points
  const chartData = useMemo(() => {
    if (!selectedTopic) return [];
    const decayRate = selectedTopic.decay_rate || 0.05;
    const stability = 1 / Math.max(0.001, decayRate);
    const currentStrength = selectedTopic.memory_strength;
    const learningSpeed = selectedTopic.learning_speed || 5;
    const postStudyStrength = Math.min(100, currentStrength + learningSpeed * 1.5);
    const points = [];
    for (let day = 0; day <= daysAhead; day++) {
      const hours = day * 24;
      const withoutStudy = currentStrength * Math.exp(-hours / stability);
      const withStudy = postStudyStrength * Math.exp(-hours / stability);
      points.push({
        day: `Day ${day}`,
        dayNum: day,
        "Without Study": Math.max(0, Math.round(withoutStudy * 10) / 10),
        "After Study": Math.max(0, Math.round(withStudy * 10) / 10),
      });
    }
    return points;
  }, [selectedTopic, daysAhead]);

  const retentionGain = useMemo(() => {
    if (chartData.length < 2) return 0;
    const last = chartData[chartData.length - 1];
    return Math.round((last["After Study"] - last["Without Study"]) * 10) / 10;
  }, [chartData]);

  const handleTopicSimulate = async () => {
    if (!selectedTopicId) return;
    toast.loading("Simulating...", { id: "sim" });
    const result = await simulate({ topic_id: selectedTopicId, strategy: "study_now", days_ahead: daysAhead });
    setSimResult(result);
    toast.success("Simulation complete!", { id: "sim" });
  };

  const handleWorldSimulation = useCallback(async () => {
    if (selectedScenarios.length < 1) {
      toast.error("Select at least 1 scenario");
      return;
    }
    setWorldModelLoading(true);
    toast.loading("Running World Model simulation...", { id: "world-sim" });
    try {
      const scenarios = selectedScenarios.map(i => PRESET_SCENARIOS[i]);
      const { data, error } = await supabase.functions.invoke("world-model-simulation", {
        body: { scenarios },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setWorldModelResult(data);
      toast.success("Simulation complete!", { id: "world-sim" });
      confetti({ particleCount: 50, spread: 60, origin: { y: 0.7 } });
    } catch (e: any) {
      console.error(e);
      toast.error(e.message || "Simulation failed", { id: "world-sim" });
    } finally {
      setWorldModelLoading(false);
    }
  }, [selectedScenarios]);

  const toggleScenario = (idx: number) => {
    setSelectedScenarios(prev =>
      prev.includes(idx) ? prev.filter(i => i !== idx) : [...prev, idx]
    );
  };

  if (topicModels.length === 0) return null;

  return (
    <Card className="p-4 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <FlaskConical className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">World Model Simulator</h3>
            <p className="text-[10px] text-muted-foreground">Simulate future outcomes with different strategies</p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {/* Tab Switcher */}
              <div className="flex rounded-lg bg-secondary/40 p-0.5 gap-0.5">
                <button
                  onClick={() => setActiveTab("world")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                    activeTab === "world" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Brain className="w-3 h-3" /> World Model
                </button>
                <button
                  onClick={() => setActiveTab("topic")}
                  className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all flex items-center justify-center gap-1 ${
                    activeTab === "topic" ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <Target className="w-3 h-3" /> Topic Sim
                </button>
              </div>

              {/* ===== WORLD MODEL TAB ===== */}
              {activeTab === "world" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                  {/* Scenario Selection */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-2 block">Select Strategies to Compare</label>
                    <div className="space-y-2">
                      {PRESET_SCENARIOS.map((scenario, idx) => (
                        <button
                          key={idx}
                          onClick={() => toggleScenario(idx)}
                          className={`w-full text-left rounded-lg border p-3 transition-all ${
                            selectedScenarios.includes(idx)
                              ? "border-primary/50 bg-primary/5 shadow-sm"
                              : "border-border/40 bg-secondary/20 hover:border-border/60"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`w-2 h-2 rounded-full ${selectedScenarios.includes(idx) ? "bg-primary" : "bg-muted-foreground/30"}`} />
                              <span className="text-xs font-semibold text-foreground">{scenario.name}</span>
                            </div>
                            <Badge variant="outline" className="text-[9px]">{scenario.daily_hours}h/day</Badge>
                          </div>
                          <div className="mt-1 flex gap-2 ml-4">
                            <span className="text-[9px] text-muted-foreground">{scenario.intensity} intensity</span>
                            <span className="text-[9px] text-muted-foreground">·</span>
                            <span className="text-[9px] text-muted-foreground">{scenario.revision_frequency}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <Button
                    className="w-full gap-2"
                    onClick={handleWorldSimulation}
                    disabled={worldModelLoading || selectedScenarios.length < 1}
                  >
                    {worldModelLoading ? (
                      <>
                        <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                          <Brain className="w-4 h-4" />
                        </motion.div>
                        Running Simulation...
                      </>
                    ) : (
                      <>
                        <Zap className="w-4 h-4" />
                        Simulate Future ({selectedScenarios.length} scenario{selectedScenarios.length !== 1 ? "s" : ""})
                      </>
                    )}
                  </Button>

                  {/* World Model Results */}
                  <AnimatePresence>
                    {worldModelResult && (
                      <motion.div
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        className="space-y-3"
                      >
                        {/* Overall Outlook */}
                        <div className="rounded-lg bg-primary/5 border border-primary/20 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Sparkles className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-bold text-foreground">AI Outlook</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{worldModelResult.overall_outlook}</p>
                        </div>

                        {/* Scenario Cards */}
                        {worldModelResult.scenarios.map((scenario, idx) => {
                          const isRecommended = scenario.name === worldModelResult.recommended_scenario;
                          return (
                            <motion.div
                              key={scenario.name}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: idx * 0.1 }}
                              className={`rounded-lg border p-3 space-y-2.5 ${
                                isRecommended ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20" : "border-border/40 bg-secondary/20"
                              }`}
                            >
                              {/* Scenario Header */}
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  {isRecommended && <Trophy className="w-3.5 h-3.5 text-primary" />}
                                  <span className="text-xs font-bold text-foreground">{scenario.name}</span>
                                  {isRecommended && (
                                    <Badge className="text-[8px] bg-primary/20 text-primary border-primary/30">Recommended</Badge>
                                  )}
                                </div>
                                <span className="text-[9px] text-muted-foreground">
                                  {Math.round(scenario.confidence * 100)}% confidence
                                </span>
                              </div>

                              {/* Metrics Grid */}
                              <div className="grid grid-cols-3 gap-2">
                                <div className="rounded-md bg-background/50 p-2 text-center">
                                  <p className="text-[8px] text-muted-foreground mb-0.5">Rank Range</p>
                                  <p className="text-xs font-bold text-foreground">
                                    {scenario.predicted_rank_min.toLocaleString()}–{scenario.predicted_rank_max.toLocaleString()}
                                  </p>
                                </div>
                                <div className="rounded-md bg-background/50 p-2 text-center">
                                  <p className="text-[8px] text-muted-foreground mb-0.5">Retention</p>
                                  <p className="text-xs font-bold text-primary">{scenario.predicted_retention}%</p>
                                </div>
                                <div className="rounded-md bg-background/50 p-2 text-center">
                                  <p className="text-[8px] text-muted-foreground mb-0.5">Score Range</p>
                                  <p className="text-xs font-bold text-foreground">
                                    {scenario.predicted_score_min}–{scenario.predicted_score_max}%
                                  </p>
                                </div>
                              </div>

                              {/* Risk Indicators */}
                              <div className="flex gap-2">
                                <div className={`flex-1 rounded-md border px-2 py-1.5 ${riskBg(scenario.burnout_risk)}`}>
                                  <div className="flex items-center gap-1">
                                    <AlertTriangle className={`w-2.5 h-2.5 ${riskColor(scenario.burnout_risk)}`} />
                                    <span className="text-[9px] text-muted-foreground">Burnout</span>
                                  </div>
                                  <span className={`text-[10px] font-semibold capitalize ${riskColor(scenario.burnout_risk)}`}>
                                    {scenario.burnout_risk}
                                  </span>
                                </div>
                                <div className={`flex-1 rounded-md border px-2 py-1.5 ${riskBg(scenario.knowledge_gap_risk)}`}>
                                  <div className="flex items-center gap-1">
                                    <Shield className={`w-2.5 h-2.5 ${riskColor(scenario.knowledge_gap_risk)}`} />
                                    <span className="text-[9px] text-muted-foreground">Knowledge Gaps</span>
                                  </div>
                                  <span className={`text-[10px] font-semibold capitalize ${riskColor(scenario.knowledge_gap_risk)}`}>
                                    {scenario.knowledge_gap_risk}
                                  </span>
                                </div>
                              </div>

                              {/* Strategy Note */}
                              <p className="text-[10px] text-muted-foreground leading-relaxed italic">
                                💡 {scenario.strategy_note}
                              </p>
                            </motion.div>
                          );
                        })}

                        {/* Recommendation */}
                        <div className="rounded-lg bg-accent/10 border border-accent/20 p-3">
                          <div className="flex items-center gap-1.5 mb-1">
                            <Trophy className="w-3.5 h-3.5 text-primary" />
                            <span className="text-xs font-bold text-foreground">Why "{worldModelResult.recommended_scenario}"?</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed">{worldModelResult.recommendation_reason}</p>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              )}

              {/* ===== TOPIC SIMULATION TAB ===== */}
              {activeTab === "topic" && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                  {/* Topic Selector */}
                  <div>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">Select Topic</label>
                    <Select value={selectedTopicId} onValueChange={setSelectedTopicId}>
                      <SelectTrigger className="w-full text-sm">
                        <SelectValue placeholder="Choose a topic..." />
                      </SelectTrigger>
                      <SelectContent>
                        {topicModels.map(t => (
                          <SelectItem key={t.topic_id} value={t.topic_id}>
                            <div className="flex items-center justify-between w-full gap-2">
                              <span className="truncate">{t.topic_name}</span>
                              <Badge variant={t.memory_strength > 70 ? "default" : t.memory_strength > 40 ? "secondary" : "destructive"} className="text-[10px] ml-1 shrink-0">
                                {Math.round(t.memory_strength)}%
                              </Badge>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Days Slider */}
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-medium text-muted-foreground">Predict ahead</label>
                      <span className="text-xs font-bold text-foreground">{daysAhead} days</span>
                    </div>
                    <Slider
                      value={[daysAhead]}
                      onValueChange={([v]) => setDaysAhead(v)}
                      min={3}
                      max={30}
                      step={1}
                      className="w-full"
                    />
                  </div>

                  {/* Chart */}
                  {selectedTopic && chartData.length > 0 && (
                    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                      <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                          <defs>
                            <linearGradient id="withStudyGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                              <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                            </linearGradient>
                            <linearGradient id="withoutStudyGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.2} />
                              <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                          <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} interval={Math.max(0, Math.floor(daysAhead / 6))} />
                          <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickLine={false} axisLine={false} tickFormatter={v => `${v}%`} />
                          <Tooltip
                            contentStyle={{
                              backgroundColor: "hsl(var(--card))",
                              border: "1px solid hsl(var(--border))",
                              borderRadius: "8px",
                              fontSize: "12px",
                              color: "hsl(var(--foreground))",
                            }}
                            formatter={(value: number) => [`${value}%`, undefined]}
                          />
                          <Legend wrapperStyle={{ fontSize: "11px" }} />
                          <Area type="monotone" dataKey="Without Study" stroke="hsl(var(--destructive))" fill="url(#withoutStudyGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "hsl(var(--destructive))" }} />
                          <Area type="monotone" dataKey="After Study" stroke="hsl(var(--primary))" fill="url(#withStudyGrad)" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: "hsl(var(--primary))" }} />
                        </AreaChart>
                      </ResponsiveContainer>

                      {/* Summary badges */}
                      <div className="flex items-center justify-between mt-2">
                        <div className="flex items-center gap-1.5">
                          {retentionGain > 0 ? <TrendingUp className="w-3.5 h-3.5 text-primary" /> : <TrendingDown className="w-3.5 h-3.5 text-destructive" />}
                          <span className="text-xs font-medium text-foreground">+{retentionGain}% retention gain after {daysAhead} days</span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">{selectedTopic.review_count} reviews</Badge>
                      </div>

                      {/* Action buttons */}
                      <div className="flex gap-2 mt-3">
                        <Button size="sm" className="flex-1 gap-1" onClick={handleTopicSimulate} disabled={twinLoading}>
                          <Sparkles className="w-3 h-3" /> Deep Simulation
                        </Button>
                        <Button size="sm" variant="default" className="flex-1 gap-1 bg-success hover:bg-success/90 text-success-foreground" onClick={() => setFocusOpen(true)}>
                          <Crosshair className="w-3 h-3" /> Study Now
                        </Button>
                      </div>

                      {/* Server simulation result */}
                      <AnimatePresence>
                        {simResult && simResult.scenario === "study_now" && (
                          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="mt-3 p-3 rounded-lg bg-primary/5 border border-primary/20">
                            <p className="text-xs font-semibold text-foreground mb-1.5 flex items-center gap-1">
                              <FlaskConical className="w-3 h-3 text-primary" /> Deep Simulation Result
                            </p>
                            <div className="grid grid-cols-2 gap-2 text-xs">
                              <div>
                                <span className="text-muted-foreground">Current</span>
                                <p className="font-bold text-foreground">{simResult.current_strength}%</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">After Study</span>
                                <p className="font-bold text-primary">{simResult.post_study_strength}%</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Retention @ {simResult.days_ahead}d</span>
                                <p className="font-bold text-foreground">{simResult.predicted_retention_after_days}%</p>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Confidence</span>
                                <p className="font-bold text-foreground">{Math.round((simResult.confidence || 0) * 100)}%</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}

                  {!selectedTopicId && (
                    <p className="text-xs text-muted-foreground text-center py-4">
                      Pick a topic above to preview its retention curve
                    </p>
                  )}
                </motion.div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
      <FocusModeSession
        open={focusOpen}
        onClose={() => setFocusOpen(false)}
        initialSubject={subjectMap[selectedTopicId] || selectedTopic?.topic_name || ""}
        initialTopic={selectedTopic?.topic_name || ""}
        autoStart
        onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))}
      />
    </Card>
  );
}
