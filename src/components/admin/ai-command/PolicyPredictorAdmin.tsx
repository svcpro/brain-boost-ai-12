import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, Brain, TrendingUp, Zap, Loader2, CheckCircle2, XCircle,
  BarChart3, Target, Activity, Sparkles, ArrowUpRight, ArrowDownRight,
  Eye, RefreshCw, CircleDot, Flame, AlertTriangle, Layers, Atom,
  Scale, Network, Clock, ChevronRight, ChevronDown
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { EXAM_TYPES } from "@/lib/examTypes";
import {
  usePolicyDashboard, usePolicyAnalyses, usePolicyAnalysisDetail,
  useRunPolicyAnalysis, useApplyAdjustments, useRevertAdjustments
} from "@/hooks/usePolicyPredictor";
import { useCAEvents } from "@/hooks/useCurrentAffairs";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";

const IMPACT_COLORS: Record<string, string> = {
  direct: "text-rose-400 bg-rose-500/15 border-rose-500/20",
  indirect_ripple: "text-amber-400 bg-amber-500/15 border-amber-500/20",
  controversy: "text-fuchsia-400 bg-fuchsia-500/15 border-fuchsia-500/20",
};

const IMPACT_ICONS: Record<string, any> = {
  direct: Target,
  indirect_ripple: Network,
  controversy: Flame,
};

const TABS = [
  { key: "overview", label: "Dashboard", icon: BarChart3 },
  { key: "analyses", label: "Analyses", icon: Brain },
  { key: "adjustments", label: "TPI Adjustments", icon: TrendingUp },
] as const;

type Tab = typeof TABS[number]["key"];

export default function PolicyPredictorAdmin() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [selectedAnalysis, setSelectedAnalysis] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<string>("");
  const [examType, setExamType] = useState("UPSC CSE");
  const queryClient = useQueryClient();

  const { data: dashboard, isLoading: dashLoading } = usePolicyDashboard();
  const { data: analyses } = usePolicyAnalyses();
  const { data: detail } = usePolicyAnalysisDetail(selectedAnalysis);
  const { data: events } = useCAEvents();
  const runAnalysis = useRunPolicyAnalysis();
  const applyAdj = useApplyAdjustments();
  const revertAdj = useRevertAdjustments();

  // Automation config
  const { data: autoConfig } = useQuery({
    queryKey: ["ca-autopilot-config"],
    queryFn: async () => {
      const { data } = await supabase.from("ca_autopilot_config" as any).select("*").limit(1).single();
      return data as any;
    },
  });

  const toggleAutoPolicy = async (field: string, value: boolean) => {
    if (!autoConfig?.id) return;
    await supabase.from("ca_autopilot_config" as any).update({ [field]: value }).eq("id", autoConfig.id);
    queryClient.invalidateQueries({ queryKey: ["ca-autopilot-config"] });
    toast.success(`${field.replace(/_/g, " ")} ${value ? "enabled" : "disabled"}`);
  };

  const handleRunAnalysis = () => {
    if (!selectedEvent) { toast.error("Select an event first"); return; }
    runAnalysis.mutate({ event_id: selectedEvent, exam_types: [examType] }, {
      onSuccess: () => toast.success("Policy analysis complete!"),
      onError: () => toast.error("Analysis failed"),
    });
  };

  return (
    <div className="space-y-5 relative">
      {/* Background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-fuchsia-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 7, repeat: Infinity }} />
        <motion.div className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-rose-500/5 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
          transition={{ duration: 9, repeat: Infinity }} />
      </div>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
        className="relative rounded-2xl border border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/40 via-card/80 to-rose-950/30 p-5"
      >
        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <motion.div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-rose-500/30 flex items-center justify-center backdrop-blur-sm border border-fuchsia-500/20"
              animate={{ boxShadow: ["0 0 20px rgba(192,38,211,0.2)", "0 0 40px rgba(192,38,211,0.4)", "0 0 20px rgba(192,38,211,0.2)"] }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Shield className="w-7 h-7 text-fuchsia-400" />
            </motion.div>
            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-foreground tracking-tight">Current Affairs 3.0</h2>
                <Badge className="bg-gradient-to-r from-fuchsia-500/20 to-rose-500/20 border-fuchsia-500/30 text-fuchsia-300 text-[10px] font-mono">v3.0</Badge>
                <motion.div animate={{ opacity: [1, 0.4, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                  <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[9px]">
                    <CircleDot className="w-2 h-2 mr-0.5" /> PREDICTIVE
                  </Badge>
                </motion.div>
              </div>
              <p className="text-xs text-muted-foreground/80">Real-time Policy Impact Predictor · Similarity Engine · TPI Dynamic Adjustment</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger className="w-32 h-9 text-xs bg-secondary/50 border-border/50">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="z-[200] bg-popover border border-border shadow-xl">
                {EXAM_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        {[
          { label: "Analyses", count: dashboard?.analyses?.count || 0, icon: Brain, color: "text-fuchsia-400", bg: "from-fuchsia-500/20 to-fuchsia-500/5", border: "border-fuchsia-500/20" },
          { label: "Similarities", count: dashboard?.similarities?.count || 0, icon: Layers, color: "text-violet-400", bg: "from-violet-500/20 to-violet-500/5", border: "border-violet-500/20" },
          { label: "Forecasts", count: dashboard?.forecasts?.count || 0, icon: TrendingUp, color: "text-rose-400", bg: "from-rose-500/20 to-rose-500/5", border: "border-rose-500/20" },
          { label: "TPI Adjustments", count: dashboard?.adjustments?.count || 0, icon: Activity, color: "text-amber-400", bg: "from-amber-500/20 to-amber-500/5", border: "border-amber-500/20" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06, type: "spring" }} whileHover={{ scale: 1.04, y: -2 }}>
            <Card className={`bg-gradient-to-br ${s.bg} ${s.border} border shadow-lg`}>
              <CardContent className="p-3 text-center">
                <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
                <motion.p className="text-2xl font-black text-foreground" key={s.count}
                  initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                  {s.count}
                </motion.p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1.5 flex-wrap">
        {TABS.map((tab, i) => (
          <motion.button key={tab.key}
            initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all ${
              activeTab === tab.key ? "text-foreground shadow-lg" : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {activeTab === tab.key && (
              <motion.div layoutId="ca3ActiveTab"
                className="absolute inset-0 rounded-xl bg-gradient-to-r from-fuchsia-500/15 to-rose-500/15 border border-white/10"
                transition={{ type: "spring", stiffness: 300, damping: 30 }} />
            )}
            <tab.icon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>

          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Automation Controls */}
              <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-950/20 to-card/80">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Sparkles className="w-4 h-4 text-emerald-400" /> Full Automation
                  </h3>
                  <p className="text-[11px] text-muted-foreground">CA 3.0 runs automatically when new events are processed by the CA Auto Pipeline.</p>
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                      <div>
                        <p className="text-xs font-medium text-foreground">Auto Policy Analysis</p>
                        <p className="text-[10px] text-muted-foreground">Run similarity + impact analysis on every new CA event</p>
                      </div>
                      <Switch
                        checked={autoConfig?.auto_policy_analysis_enabled ?? true}
                        onCheckedChange={(v) => toggleAutoPolicy("auto_policy_analysis_enabled", v)}
                      />
                    </div>
                    <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/20 border border-border/30">
                      <div>
                        <p className="text-xs font-medium text-foreground">Auto-Apply TPI Adjustments</p>
                        <p className="text-[10px] text-muted-foreground">Automatically update Topic Probability Index after analysis</p>
                      </div>
                      <Switch
                        checked={autoConfig?.auto_apply_tpi_adjustments ?? false}
                        onCheckedChange={(v) => toggleAutoPolicy("auto_apply_tpi_adjustments", v)}
                      />
                    </div>
                  </div>
                  {autoConfig && (
                    <div className="grid grid-cols-2 gap-2 pt-1">
                      <div className="p-2 rounded-lg bg-fuchsia-500/10 border border-fuchsia-500/20 text-center">
                        <p className="text-lg font-black text-fuchsia-400">{autoConfig.total_policy_analyses_run || 0}</p>
                        <p className="text-[9px] text-muted-foreground">Auto Analyses Run</p>
                      </div>
                      <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                        <p className="text-lg font-black text-amber-400">{autoConfig.total_tpi_adjustments_applied || 0}</p>
                        <p className="text-[9px] text-muted-foreground">Auto TPI Applied</p>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Run Analysis */}
              <Card className="border-fuchsia-500/20 bg-gradient-to-br from-fuchsia-950/20 to-card/80">
                <CardContent className="p-4 space-y-3">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Zap className="w-4 h-4 text-fuchsia-400" /> Manual Policy Impact Analysis
                  </h3>
                  <p className="text-[11px] text-muted-foreground">Select a CA event to run the full 3-module prediction pipeline manually</p>
                  <div className="flex gap-2">
                    <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                      <SelectTrigger className="flex-1 h-9 text-xs bg-secondary/50 border-border/50">
                        <SelectValue placeholder="Select CA event..." />
                      </SelectTrigger>
                      <SelectContent className="z-[200] bg-popover border border-border shadow-xl max-h-60">
                        {(events || []).slice(0, 30).map((e: any) => (
                          <SelectItem key={e.id} value={e.id} className="text-xs">
                            {e.title?.substring(0, 60)}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button size="sm" disabled={runAnalysis.isPending || !selectedEvent}
                      className="gap-1.5 bg-gradient-to-r from-fuchsia-600 to-rose-600 hover:from-fuchsia-500 hover:to-rose-500 text-white"
                      onClick={handleRunAnalysis}
                    >
                      {runAnalysis.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
                      Analyze
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Impact Distribution */}
              {dashboard?.forecasts?.by_type && Object.keys(dashboard.forecasts.by_type).length > 0 && (
                <Card className="border-border/50 bg-card/80">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">Impact Type Distribution</h3>
                    <div className="grid grid-cols-3 gap-2">
                      {Object.entries(dashboard.forecasts.by_type).map(([type, count]: any) => {
                        const Icon = IMPACT_ICONS[type] || Target;
                        return (
                          <div key={type} className={`p-3 rounded-lg border ${IMPACT_COLORS[type] || "border-border/50"} text-center`}>
                            <Icon className="w-5 h-5 mx-auto mb-1" />
                            <p className="text-lg font-black text-foreground">{count}</p>
                            <p className="text-[9px] text-muted-foreground capitalize">{type.replace("_", " ")}</p>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Adjustment Status */}
              {dashboard?.adjustments && (
                <Card className="border-border/50 bg-card/80">
                  <CardContent className="p-4">
                    <h3 className="text-sm font-bold text-foreground mb-3">TPI Adjustment Status</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-center">
                        <p className="text-2xl font-black text-amber-400">{dashboard.adjustments.pending}</p>
                        <p className="text-[10px] text-muted-foreground">Pending</p>
                      </div>
                      <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-center">
                        <p className="text-2xl font-black text-emerald-400">{dashboard.adjustments.applied}</p>
                        <p className="text-[10px] text-muted-foreground">Applied</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}

          {/* ANALYSES LIST */}
          {activeTab === "analyses" && (
            <div className="space-y-3">
              {(analyses || []).length === 0 ? (
                <Card className="border-border/50 bg-card/80">
                  <CardContent className="p-8 text-center">
                    <Brain className="w-10 h-10 mx-auto mb-3 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">No policy analyses yet. Run one from the Dashboard tab.</p>
                  </CardContent>
                </Card>
              ) : (
                (analyses || []).map((a: any) => (
                  <motion.div key={a.id} whileHover={{ scale: 1.01 }}>
                    <Card className={`border cursor-pointer transition-all ${
                      selectedAnalysis === a.id ? "border-fuchsia-500/40 bg-fuchsia-500/5" : "border-border/50 bg-card/80 hover:border-fuchsia-500/20"
                    }`} onClick={() => setSelectedAnalysis(selectedAnalysis === a.id ? null : a.id)}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-bold text-foreground truncate">{a.policy_title}</h4>
                            <p className="text-[11px] text-muted-foreground mt-0.5">{a.policy_category} · {new Date(a.created_at).toLocaleDateString()}</p>
                          </div>
                          <div className="flex items-center gap-2 flex-shrink-0">
                            {a.controversy_likelihood > 0.5 && (
                              <Badge className="bg-rose-500/15 border-rose-500/30 text-rose-400 text-[9px]">
                                <AlertTriangle className="w-2.5 h-2.5 mr-0.5" /> CONTROVERSIAL
                              </Badge>
                            )}
                            <Badge className="bg-fuchsia-500/15 border-fuchsia-500/30 text-fuchsia-300 text-[9px]">
                              Impact: {(a.overall_impact_score * 100).toFixed(0)}%
                            </Badge>
                            <Badge className="bg-violet-500/15 border-violet-500/30 text-violet-300 text-[9px]">
                              Sim: {(a.top_similarity_score * 100).toFixed(0)}%
                            </Badge>
                            {selectedAnalysis === a.id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                          </div>
                        </div>

                        {/* Expanded Detail */}
                        <AnimatePresence>
                          {selectedAnalysis === a.id && detail && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
                              className="mt-4 pt-4 border-t border-border/30 space-y-4"
                            >
                              {/* Predicted Exam Framing */}
                              {detail.analysis?.predicted_exam_framing && (
                                <div className="p-3 rounded-lg bg-gradient-to-r from-fuchsia-500/10 to-rose-500/10 border border-fuchsia-500/20">
                                  <p className="text-[10px] font-bold text-fuchsia-400 mb-1 uppercase tracking-wider">Predicted Exam Framing</p>
                                  <p className="text-xs text-foreground">{detail.analysis.predicted_exam_framing}</p>
                                  <p className="text-[10px] text-muted-foreground mt-1">
                                    Question probability increase: <span className="text-emerald-400 font-bold">+{detail.analysis.question_probability_increase}%</span>
                                  </p>
                                </div>
                              )}

                              {/* Similarities */}
                              {detail.similarities.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-violet-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                    <Layers className="w-3 h-3" /> Historical Similarities ({detail.similarities.length})
                                  </p>
                                  <div className="space-y-1.5">
                                    {detail.similarities.map((s: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 text-xs">
                                        <div className="flex-1">
                                          <span className="font-medium text-foreground">{s.historical_policy_name}</span>
                                          {s.historical_policy_year && <span className="text-muted-foreground ml-1">({s.historical_policy_year})</span>}
                                        </div>
                                        <Badge className="text-[9px] bg-violet-500/15 border-violet-500/30 text-violet-300">
                                          {(s.similarity_score * 100).toFixed(0)}%
                                        </Badge>
                                        <Badge className="text-[9px] bg-secondary/50 border-border/50 text-muted-foreground capitalize">
                                          {s.pattern_type?.replace("_", " ")}
                                        </Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}

                              {/* Impact Forecasts */}
                              {detail.forecasts.length > 0 && (
                                <div>
                                  <p className="text-[10px] font-bold text-rose-400 mb-2 uppercase tracking-wider flex items-center gap-1">
                                    <TrendingUp className="w-3 h-3" /> Impact Forecasts ({detail.forecasts.length})
                                  </p>
                                  <div className="space-y-1.5">
                                    {detail.forecasts.map((f: any, i: number) => {
                                      const Icon = IMPACT_ICONS[f.impact_type] || Target;
                                      return (
                                        <div key={i} className={`p-2.5 rounded-lg border ${IMPACT_COLORS[f.impact_type] || "border-border/50"}`}>
                                          <div className="flex items-center gap-2 mb-1">
                                            <Icon className="w-3.5 h-3.5" />
                                            <span className="text-xs font-bold text-foreground">{f.topic_name}</span>
                                            <Badge className="text-[8px] ml-auto">{f.subject}</Badge>
                                          </div>
                                          <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                                            <span>TPI Shift: <span className="text-emerald-400 font-bold">+{(f.predicted_tpi_shift * 100).toFixed(0)}%</span></span>
                                            <span>Confidence: {(f.confidence * 100).toFixed(0)}%</span>
                                            <span className="capitalize">{f.time_horizon?.replace("_", " ")}</span>
                                          </div>
                                          {f.reasoning && <p className="text-[10px] text-muted-foreground/70 mt-1">{f.reasoning}</p>}
                                          {Array.isArray(f.micro_topics) && f.micro_topics.length > 0 && (
                                            <div className="flex gap-1 mt-1.5 flex-wrap">
                                              {f.micro_topics.map((mt: string, mi: number) => (
                                                <Badge key={mi} className="text-[8px] bg-secondary/30 border-border/30 text-muted-foreground">{mt}</Badge>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}

                              {/* Probability Adjustments */}
                              {detail.adjustments.length > 0 && (
                                <div>
                                  <div className="flex items-center justify-between mb-2">
                                    <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                                      <Activity className="w-3 h-3" /> TPI Adjustments ({detail.adjustments.length})
                                    </p>
                                    <div className="flex gap-1.5">
                                      {detail.adjustments.some((a: any) => a.status === "pending") && (
                                        <Button size="sm" variant="outline"
                                          className="h-6 text-[10px] border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                          disabled={applyAdj.isPending}
                                          onClick={() => applyAdj.mutate(a.id, { onSuccess: () => toast.success("Adjustments applied!") })}
                                        >
                                          {applyAdj.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3 mr-0.5" />} Apply All
                                        </Button>
                                      )}
                                      {detail.adjustments.some((a: any) => a.status === "applied") && (
                                        <Button size="sm" variant="outline"
                                          className="h-6 text-[10px] border-rose-500/30 text-rose-400 hover:bg-rose-500/10"
                                          disabled={revertAdj.isPending}
                                          onClick={() => revertAdj.mutate(a.id, { onSuccess: () => toast.success("Adjustments reverted!") })}
                                        >
                                          {revertAdj.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <XCircle className="w-3 h-3 mr-0.5" />} Revert
                                        </Button>
                                      )}
                                    </div>
                                  </div>
                                  <div className="space-y-1">
                                    {detail.adjustments.map((adj: any, i: number) => (
                                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 text-xs">
                                        <div className="flex-1">
                                          <span className="font-medium text-foreground">{adj.topic_name}</span>
                                          <span className="text-muted-foreground ml-1 text-[10px]">{adj.subject}</span>
                                        </div>
                                        <span className="text-muted-foreground text-[10px]">{(adj.old_probability * 100).toFixed(0)}%</span>
                                        <ArrowUpRight className="w-3 h-3 text-emerald-400" />
                                        <span className="text-emerald-400 font-bold text-[10px]">{(adj.new_probability * 100).toFixed(0)}%</span>
                                        <Badge className={`text-[8px] ${
                                          adj.status === "applied" ? "bg-emerald-500/15 text-emerald-400" :
                                          adj.status === "reverted" ? "bg-rose-500/15 text-rose-400" :
                                          "bg-amber-500/15 text-amber-400"
                                        }`}>{adj.status}</Badge>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))
              )}
            </div>
          )}

          {/* ADJUSTMENTS TAB */}
          {activeTab === "adjustments" && (
            <div className="space-y-3">
              <Card className="border-border/50 bg-card/80">
                <CardContent className="p-4">
                  <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
                    <Activity className="w-4 h-4 text-amber-400" /> All TPI Probability Adjustments
                  </h3>
                  <p className="text-[11px] text-muted-foreground mb-4">
                    These adjustments are generated by the Policy Impact Predictor and can be applied to dynamically update the Topic Probability Index.
                  </p>

                  {(analyses || []).filter((a: any) => a.impact_scan_status === "completed").length === 0 ? (
                    <div className="text-center py-6">
                      <TrendingUp className="w-8 h-8 mx-auto mb-2 text-muted-foreground/30" />
                      <p className="text-xs text-muted-foreground">No adjustments generated yet</p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {(analyses || []).filter((a: any) => a.impact_scan_status === "completed").map((a: any) => (
                        <div key={a.id} className="p-3 rounded-lg bg-secondary/20 border border-border/30">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-xs font-bold text-foreground truncate max-w-[60%]">{a.policy_title}</span>
                            <div className="flex gap-1">
                              <Badge className="text-[8px] bg-fuchsia-500/15 text-fuchsia-300">Impact {(a.overall_impact_score * 100).toFixed(0)}%</Badge>
                              <Badge className="text-[8px] bg-amber-500/15 text-amber-300">+{a.question_probability_increase}% Q prob</Badge>
                            </div>
                          </div>
                          <div className="flex gap-2 mt-2">
                            <Button size="sm" variant="outline"
                              className="h-6 text-[9px] border-emerald-500/30 text-emerald-400"
                              disabled={applyAdj.isPending}
                              onClick={() => applyAdj.mutate(a.id, { onSuccess: () => toast.success("Applied!") })}
                            >
                              <CheckCircle2 className="w-3 h-3 mr-0.5" /> Apply TPI
                            </Button>
                            <Button size="sm" variant="outline"
                              className="h-6 text-[9px] border-rose-500/30 text-rose-400"
                              disabled={revertAdj.isPending}
                              onClick={() => revertAdj.mutate(a.id, { onSuccess: () => toast.success("Reverted!") })}
                            >
                              <XCircle className="w-3 h-3 mr-0.5" /> Revert
                            </Button>
                            <Button size="sm" variant="ghost" className="h-6 text-[9px]"
                              onClick={() => { setSelectedAnalysis(a.id); setActiveTab("analyses"); }}
                            >
                              <Eye className="w-3 h-3 mr-0.5" /> View Detail
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          )}

        </motion.div>
      </AnimatePresence>
    </div>
  );
}
