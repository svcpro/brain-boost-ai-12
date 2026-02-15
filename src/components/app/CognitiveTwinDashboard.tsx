import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Cpu, Zap, TrendingUp, Clock, Target, RefreshCw, Sparkles, ChevronDown, ChevronUp, Activity, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { useCognitiveTwin } from "@/hooks/useCognitiveTwin";
import { useMetaLearning } from "@/hooks/useMetaLearning";
import WhatIfSimulator from "./WhatIfSimulator";
import TopicImpactRanking from "./TopicImpactRanking";
import { toast } from "sonner";

export default function CognitiveTwinDashboard() {
  const { twin, simulation, loading: twinLoading, computeTwin, getTwin, simulate } = useCognitiveTwin();
  const { status, improveResult, loading: metaLoading, getStatus, selfImprove } = useMetaLearning();
  const [expanded, setExpanded] = useState(false);
  const [simDays, setSimDays] = useState(7);

  const loading = twinLoading || metaLoading;

  useEffect(() => {
    getTwin();
    getStatus();
  }, []);

  const handleComputeTwin = async () => {
    toast.loading("Building your Digital Twin...", { id: "twin" });
    await computeTwin();
    toast.success("Digital Twin updated!", { id: "twin" });
  };

  const handleSelfImprove = async () => {
    toast.loading("ACRY is self-improving...", { id: "improve" });
    await selfImprove();
    toast.success("Self-improvement cycle complete!", { id: "improve" });
    getStatus();
  };

  const handleSimulate = async () => {
    await simulate({ days_ahead: simDays });
  };

  return (
    <div className="space-y-4">
      {/* Hero: Digital Twin Status */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl neural-border bg-gradient-to-br from-primary/10 via-background to-accent/10 p-5"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Brain className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h3 className="font-bold text-foreground">Cognitive Digital Twin</h3>
              <p className="text-xs text-muted-foreground">Your AI brain model</p>
            </div>
          </div>
          <Button size="sm" onClick={handleComputeTwin} disabled={loading} className="gap-1">
            <RefreshCw className={`w-3 h-3 ${loading ? "animate-spin" : ""}`} />
            {twin ? "Update" : "Build"}
          </Button>
        </div>

        {twin ? (
          <div className="grid grid-cols-2 gap-3">
            <StatCard icon={<Zap className="w-4 h-4 text-yellow-500" />} label="Evolution" value={`${Math.round(twin.brain_evolution_score)}`} suffix="/100" />
            <StatCard icon={<Target className="w-4 h-4 text-green-500" />} label="Efficiency" value={`${Math.round(twin.learning_efficiency_score)}%`} />
            <StatCard icon={<Clock className="w-4 h-4 text-blue-500" />} label="Best Hour" value={`${twin.optimal_study_hour}:00`} />
            <StatCard icon={<Activity className="w-4 h-4 text-purple-500" />} label="Session" value={`${twin.optimal_session_duration}m`} />
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            Build your Digital Twin to model your cognitive patterns
          </p>
        )}
      </motion.div>

      {/* Cognitive Capacity */}
      {twin && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="p-4">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-foreground">Cognitive Capacity</span>
              <Badge variant={twin.cognitive_capacity_score > 70 ? "default" : twin.cognitive_capacity_score > 40 ? "secondary" : "destructive"}>
                {twin.recall_pattern_type.replace("_", " ")}
              </Badge>
            </div>
            <Progress value={twin.cognitive_capacity_score} className="h-2 mb-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Growth: {twin.memory_growth_rate > 0 ? "+" : ""}{twin.memory_growth_rate.toFixed(1)}%</span>
              <span>Decay rate: {twin.avg_decay_rate.toFixed(4)}/hr</span>
            </div>
          </Card>
        </motion.div>
      )}

      {/* Most Impactful Topics */}
      {twin && twin.topic_models && twin.topic_models.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.11 }}>
          <TopicImpactRanking topicModels={twin.topic_models} />
        </motion.div>
      )}

      {/* What-If Simulator */}
      {twin && twin.topic_models && twin.topic_models.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.13 }}>
          <WhatIfSimulator topicModels={twin.topic_models} />
        </motion.div>
      )}

      {/* Predictive Simulation */}
      {twin && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="p-4">
            <div className="flex items-center gap-2 mb-3">
              <Gauge className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Predictive Simulation</span>
            </div>
            <div className="flex gap-2 mb-3">
              {[3, 7, 14, 30].map(d => (
                <Button key={d} size="sm" variant={simDays === d ? "default" : "outline"} onClick={() => setSimDays(d)} className="text-xs flex-1">
                  {d}d
                </Button>
              ))}
            </div>
            <Button size="sm" className="w-full gap-1" onClick={handleSimulate} disabled={loading}>
              <Sparkles className="w-3 h-3" /> Simulate {simDays}-Day Strategies
            </Button>

            <AnimatePresence>
              {simulation?.comparisons && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-3 space-y-2">
                  {simulation.comparisons.map((c, i) => (
                    <div key={c.strategy} className={`p-3 rounded-lg border ${c.strategy === simulation.recommended ? "border-primary bg-primary/5" : "border-border"}`}>
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium capitalize">{c.strategy}</span>
                          {c.strategy === simulation.recommended && (
                            <Badge variant="default" className="text-[10px]">Recommended</Badge>
                          )}
                        </div>
                        <Badge variant="outline" className="text-xs">{c.effort_level}</Badge>
                      </div>
                      <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                        <span>Retention: {c.predicted_retention}%</span>
                        <span>Rank: {c.estimated_rank_change > 0 ? "+" : ""}{c.estimated_rank_change}</span>
                      </div>
                      <Progress value={c.predicted_retention} className="h-1.5 mt-1" />
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        </motion.div>
      )}

      {/* Self-Improving AI */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Cpu className="w-4 h-4 text-primary" />
              <span className="text-sm font-bold text-foreground">Meta-Learning Engine</span>
            </div>
            <Button size="sm" variant="outline" onClick={handleSelfImprove} disabled={loading} className="gap-1">
              <Sparkles className="w-3 h-3" /> Self-Improve
            </Button>
          </div>

          {status?.active_strategies && status.active_strategies.length > 0 ? (
            <div className="space-y-2">
              {status.active_strategies.map((s: any, i: number) => (
                <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-muted/50">
                  <div>
                    <span className="text-xs font-medium capitalize">{s.strategy_type.replace("_", " ")}</span>
                    <p className="text-[10px] text-muted-foreground">Iteration {s.iteration}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="w-12 h-1.5 rounded-full bg-muted overflow-hidden">
                      <div className="h-full bg-primary rounded-full" style={{ width: `${(s.performance_score || 0) * 100}%` }} />
                    </div>
                    <span className="text-[10px] text-muted-foreground">{Math.round((s.performance_score || 0) * 100)}%</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-2">
              Run Self-Improve to optimize ACRY's learning strategies
            </p>
          )}

          {/* Model Selections */}
          {status?.model_selections && status.model_selections.length > 0 && (
            <div className="mt-3">
              <button onClick={() => setExpanded(!expanded)} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
                {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                Active Models ({status.model_selections.length})
              </button>
              <AnimatePresence>
                {expanded && (
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-2 space-y-1">
                    {status.model_selections.map((m: any, i: number) => (
                      <div key={i} className="flex items-center justify-between text-xs p-2 rounded bg-muted/30">
                        <span className="capitalize">{m.model_domain.replace("_", " ")}</span>
                        <Badge variant="outline" className="text-[10px]">{m.active_model}</Badge>
                      </div>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
        </Card>
      </motion.div>

      {/* Self-Improvement Result */}
      <AnimatePresence>
        {improveResult && (
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}>
            <Card className="p-4 border-primary/30">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="w-4 h-4 text-green-500" />
                <span className="text-sm font-bold text-foreground">Improvement Cycle #{improveResult.improvement_cycle}</span>
              </div>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Best Mode</span>
                  <p className="font-medium capitalize">{improveResult.strategies.insights.best_study_mode}</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Optimal Duration</span>
                  <p className="font-medium">{improveResult.strategies.insights.optimal_duration}m</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Error Rate</span>
                  <p className="font-medium">{improveResult.strategies.insights.prediction_error_rate}%</p>
                </div>
                <div className="p-2 rounded bg-muted/50">
                  <span className="text-muted-foreground">Plan Completion</span>
                  <p className="font-medium">{improveResult.strategies.insights.plan_completion_avg}%</p>
                </div>
              </div>
            </Card>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function StatCard({ icon, label, value, suffix }: { icon: React.ReactNode; label: string; value: string; suffix?: string }) {
  return (
    <div className="p-3 rounded-xl bg-muted/50 flex items-center gap-2">
      {icon}
      <div>
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-sm font-bold text-foreground">{value}<span className="text-xs font-normal text-muted-foreground">{suffix}</span></p>
      </div>
    </div>
  );
}
