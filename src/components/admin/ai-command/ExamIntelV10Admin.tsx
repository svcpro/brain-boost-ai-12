import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Radar, Brain, Sparkles, TrendingUp, BarChart3, RefreshCw,
  AlertTriangle, Zap, ChevronRight, Shield, Activity,
  Cpu, Flame, Eye, Loader2, CheckCircle2, Rocket,
  ArrowUpRight, ArrowDownRight, Minus, Network, Play,
  Target, Clock, Layers, BarChart2, Users, Bell
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useExamIntelV10 } from "@/hooks/useExamIntelV10";
import { toast } from "sonner";
import { EXAM_TYPES } from "@/lib/examTypes";

const TABS = [
  { key: "overview", label: "Command Center", icon: Radar, gradient: "from-violet-500 to-fuchsia-500" },
  { key: "predictions", label: "Topic Predictions", icon: TrendingUp, gradient: "from-emerald-500 to-teal-500" },
  { key: "pipeline", label: "Auto Pipeline", icon: Cpu, gradient: "from-cyan-500 to-blue-500" },
  { key: "alerts", label: "Intel Alerts", icon: Bell, gradient: "from-amber-500 to-orange-500" },
  { key: "questions", label: "Intel Questions", icon: Target, gradient: "from-rose-500 to-red-500" },
] as const;

type TabKey = typeof TABS[number]["key"];

export default function ExamIntelV10Admin() {
  const [examType, setExamType] = useState("NEET");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [dashboard, setDashboard] = useState<any>(null);
  const [pipelineRunning, setPipelineRunning] = useState(false);
  const { loading, runFullPipeline, computeTopicScores, getIntelDashboard, getPipelineStatus, detectShifts, generateIntelQuestions } = useExamIntelV10();

  const fetchDashboard = useCallback(async () => {
    const data = await getIntelDashboard(examType);
    if (data) setDashboard(data);
  }, [examType]);

  useEffect(() => { fetchDashboard(); }, [fetchDashboard]);

  const handleRunPipeline = async () => {
    setPipelineRunning(true);
    toast.info("🚀 Full Intel Pipeline starting...");
    const result = await runFullPipeline([examType]);
    if (result) {
      toast.success(`Pipeline complete: ${result.topics_analyzed} topics, ${result.predictions_generated} questions, ${result.alerts_created} alerts`);
      fetchDashboard();
    }
    setPipelineRunning(false);
  };

  const handleComputeScores = async () => {
    toast.info("Computing topic scores...");
    const result = await computeTopicScores(examType);
    if (result) { toast.success(`${result.count} topic scores computed`); fetchDashboard(); }
  };

  const handleDetectShifts = async () => {
    toast.info("Detecting curriculum shifts...");
    const result = await detectShifts(examType);
    if (result) { toast.success(`${result.shifts_detected} shifts, ${result.alerts_created} alerts`); fetchDashboard(); }
  };

  const trendIcon = (dir: string) => dir === "rising" ? <ArrowUpRight className="w-3 h-3 text-emerald-400" /> : dir === "declining" ? <ArrowDownRight className="w-3 h-3 text-red-400" /> : <Minus className="w-3 h-3 text-muted-foreground" />;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500/20 to-fuchsia-500/20 border border-violet-500/30">
            <Radar className="w-6 h-6 text-violet-400" />
          </div>
          <div>
            <h2 className="text-xl font-bold bg-gradient-to-r from-violet-400 to-fuchsia-400 bg-clip-text text-transparent">
              Exam Intel v10.0
            </h2>
            <p className="text-xs text-muted-foreground">Fully Autonomous AI Prediction Engine</p>
          </div>
        </div>
        <Select value={examType} onValueChange={setExamType}>
          <SelectTrigger className="w-40 bg-card/50 border-border/50"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXAM_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
        {TABS.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-all ${
              activeTab === tab.key
                ? `bg-gradient-to-r ${tab.gradient} text-white shadow-lg`
                : "bg-card/50 text-muted-foreground hover:text-foreground border border-border/30"
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}>
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Pipeline Control */}
              <Card className="bg-gradient-to-br from-violet-500/10 to-fuchsia-500/10 border-violet-500/20">
                <CardContent className="p-5">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h3 className="font-bold text-sm">🧠 Autonomous Pipeline</h3>
                      <p className="text-xs text-muted-foreground">Zero-touch: PYQ Analysis → Predictions → Questions → Student Briefs → Alerts</p>
                    </div>
                    <Button
                      onClick={handleRunPipeline}
                      disabled={pipelineRunning || loading}
                      className="bg-gradient-to-r from-violet-600 to-fuchsia-600 hover:from-violet-700 hover:to-fuchsia-700"
                      size="sm"
                    >
                      {pipelineRunning ? <><Loader2 className="w-3 h-3 mr-1 animate-spin" /> Running...</> : <><Rocket className="w-3 h-3 mr-1" /> Run Full Pipeline</>}
                    </Button>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                    {[
                      { label: "Topic Predictions", value: dashboard?.topic_scores?.count || 0, icon: TrendingUp, color: "text-emerald-400" },
                      { label: "Intel Questions", value: dashboard?.practice_questions?.count || 0, icon: Target, color: "text-cyan-400" },
                      { label: "Student Briefs", value: dashboard?.student_briefs?.count || 0, icon: Users, color: "text-violet-400" },
                      { label: "Active Alerts", value: dashboard?.alerts?.count || 0, icon: Bell, color: "text-amber-400" },
                      { label: "Pipeline Runs", value: dashboard?.pipeline_runs?.length || 0, icon: Activity, color: "text-rose-400" },
                    ].map((s, i) => (
                      <div key={i} className="bg-card/40 rounded-lg p-3 border border-border/20">
                        <s.icon className={`w-4 h-4 mb-1 ${s.color}`} />
                        <p className="text-lg font-bold">{s.value}</p>
                        <p className="text-[10px] text-muted-foreground">{s.label}</p>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-3 gap-3">
                <Button variant="outline" size="sm" onClick={handleComputeScores} disabled={loading} className="h-auto py-3 flex-col gap-1">
                  <BarChart3 className="w-4 h-4 text-emerald-400" />
                  <span className="text-[10px]">Compute Scores</span>
                </Button>
                <Button variant="outline" size="sm" onClick={handleDetectShifts} disabled={loading} className="h-auto py-3 flex-col gap-1">
                  <Layers className="w-4 h-4 text-rose-400" />
                  <span className="text-[10px]">Detect Shifts</span>
                </Button>
                <Button variant="outline" size="sm" onClick={() => { toast.info("Generating..."); generateIntelQuestions(examType, "General", "Top Topics", 5).then(r => { if (r) toast.success(`${r.count} questions generated`); fetchDashboard(); }); }} disabled={loading} className="h-auto py-3 flex-col gap-1">
                  <Sparkles className="w-4 h-4 text-amber-400" />
                  <span className="text-[10px]">Generate Questions</span>
                </Button>
              </div>
            </div>
          )}

          {activeTab === "predictions" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" /> Topic Probability Index (TPI)
              </h3>
              {(dashboard?.topic_scores?.data || []).length === 0 ? (
                <Card className="bg-card/30 border-border/20">
                  <CardContent className="p-6 text-center">
                    <Radar className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No predictions yet. Run the pipeline to generate topic scores.</p>
                  </CardContent>
                </Card>
              ) : (
                (dashboard?.topic_scores?.data || []).map((s: any, i: number) => (
                  <motion.div key={s.id || i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}>
                    <Card className="bg-card/30 border-border/20 hover:border-violet-500/30 transition-colors">
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            {trendIcon(s.trend_direction)}
                            <span className="text-sm font-medium">{s.topic}</span>
                            <Badge variant="outline" className="text-[9px] h-4">{s.subject}</Badge>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[9px] h-4 ${
                              s.composite_score > 0.7 ? "bg-red-500/20 text-red-400 border-red-500/30" :
                              s.composite_score > 0.5 ? "bg-amber-500/20 text-amber-400 border-amber-500/30" :
                              "bg-emerald-500/20 text-emerald-400 border-emerald-500/30"
                            }`}>
                              {Math.round((s.composite_score || 0) * 100)}%
                            </Badge>
                          </div>
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-[10px] text-muted-foreground">
                          <div>Probability: <span className="text-foreground font-medium">{Math.round(s.probability_score * 100)}%</span></div>
                          <div>Frequency: <span className="text-foreground font-medium">{Math.round((s.historical_frequency || 0) * 100)}%</span></div>
                          <div>CA Boost: <span className="text-foreground font-medium">{Math.round((s.ca_boost_score || 0) * 100)}%</span></div>
                          <div>AI Confidence: <span className="text-foreground font-medium">{Math.round((s.ai_confidence || 0) * 100)}%</span></div>
                        </div>
                        <Progress value={(s.composite_score || 0) * 100} className="h-1 mt-2" />
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {activeTab === "pipeline" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Cpu className="w-4 h-4 text-cyan-400" /> Pipeline Execution History
              </h3>
              {(dashboard?.pipeline_runs || []).length === 0 ? (
                <Card className="bg-card/30 border-border/20">
                  <CardContent className="p-6 text-center">
                    <Cpu className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No pipeline runs yet.</p>
                  </CardContent>
                </Card>
              ) : (
                (dashboard?.pipeline_runs || []).map((run: any, i: number) => (
                  <Card key={run.id} className="bg-card/30 border-border/20">
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          {run.status === "completed" ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> :
                           run.status === "running" ? <Loader2 className="w-4 h-4 text-cyan-400 animate-spin" /> :
                           <AlertTriangle className="w-4 h-4 text-red-400" />}
                          <span className="text-xs font-medium">{run.pipeline_stage}</span>
                          <Badge variant="outline" className="text-[9px] h-4">{run.exam_type}</Badge>
                        </div>
                        <span className="text-[10px] text-muted-foreground">
                          {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : "..."}
                        </span>
                      </div>
                      <div className="grid grid-cols-4 gap-2 text-[10px]">
                        <div>Topics: <span className="font-bold">{run.topics_analyzed || 0}</span></div>
                        <div>Questions: <span className="font-bold">{run.predictions_generated || 0}</span></div>
                        <div>Alerts: <span className="font-bold">{run.alerts_created || 0}</span></div>
                        <div>Briefs: <span className="font-bold">{run.student_briefs_updated || 0}</span></div>
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "alerts" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Bell className="w-4 h-4 text-amber-400" /> Recent Intel Alerts
              </h3>
              {(dashboard?.alerts?.data || []).length === 0 ? (
                <Card className="bg-card/30 border-border/20">
                  <CardContent className="p-6 text-center">
                    <Bell className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                    <p className="text-xs text-muted-foreground">No alerts generated yet.</p>
                  </CardContent>
                </Card>
              ) : (
                (dashboard?.alerts?.data || []).map((alert: any) => (
                  <Card key={alert.id} className={`border-l-2 ${
                    alert.severity === "critical" ? "border-l-red-500 bg-red-500/5" :
                    alert.severity === "high" ? "border-l-amber-500 bg-amber-500/5" :
                    "border-l-blue-500 bg-blue-500/5"
                  }`}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between mb-1">
                        <Badge className={`text-[9px] h-4 ${
                          alert.severity === "critical" ? "bg-red-500/20 text-red-400" :
                          alert.severity === "high" ? "bg-amber-500/20 text-amber-400" :
                          "bg-blue-500/20 text-blue-400"
                        }`}>{alert.alert_type}</Badge>
                        <span className="text-[10px] text-muted-foreground">{new Date(alert.created_at).toLocaleDateString()}</span>
                      </div>
                      <p className="text-xs">{alert.message}</p>
                    </CardContent>
                  </Card>
                ))
              )}
            </div>
          )}

          {activeTab === "questions" && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <Target className="w-4 h-4 text-rose-400" /> Intel Practice Questions
              </h3>
              <p className="text-xs text-muted-foreground">
                Total: {dashboard?.practice_questions?.count || 0} AI-generated high-probability questions
              </p>
              <Button
                variant="outline" size="sm"
                onClick={() => { toast.info("Generating batch..."); generateIntelQuestions(examType, "General", "High Probability", 10).then(r => { if (r) toast.success(`${r.count} questions generated`); fetchDashboard(); }); }}
                disabled={loading}
              >
                <Sparkles className="w-3 h-3 mr-1" /> Generate Batch
              </Button>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
