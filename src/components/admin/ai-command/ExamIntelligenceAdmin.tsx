import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Dna, Brain, Layers, Sparkles, TrendingUp, BarChart3, RefreshCw,
  AlertTriangle, Atom, ChevronRight, Shield, Activity, Radar,
  Cpu, Flame, Eye, Waypoints, CircleDot, Loader2, CheckCircle2,
  ArrowUpRight, ArrowDownRight, Minus, Zap, Network
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Progress } from "@/components/ui/progress";
import { useExamIntelligence } from "@/hooks/useExamIntelligence";
import { toast } from "sonner";

const EXAM_TYPES = ["UPSC", "NEET", "JEE", "SSC CGL", "CAT", "GATE", "GRE", "SAT", "CLAT", "NDA"];

const MODULE_TABS = [
  { key: "overview", label: "Neural Overview", icon: Radar, gradient: "from-violet-500 to-fuchsia-500" },
  { key: "evolution", label: "Evolution Engine", icon: TrendingUp, gradient: "from-emerald-500 to-teal-500" },
  { key: "micro", label: "Micro-Concepts", icon: Atom, gradient: "from-cyan-500 to-blue-500" },
  { key: "dna", label: "Question DNA", icon: Dna, gradient: "from-violet-500 to-purple-500" },
  { key: "generate", label: "Generative AI", icon: Sparkles, gradient: "from-amber-500 to-orange-500" },
  { key: "shifts", label: "Curriculum Shift", icon: Layers, gradient: "from-rose-500 to-red-500" },
  { key: "confidence", label: "Confidence Bands", icon: Shield, gradient: "from-blue-500 to-indigo-500" },
  { key: "retrain", label: "Model Control", icon: RefreshCw, gradient: "from-slate-400 to-zinc-500" },
] as const;

type TabKey = typeof MODULE_TABS[number]["key"];

export default function ExamIntelligenceAdmin() {
  const [examType, setExamType] = useState("NEET");
  const [activeTab, setActiveTab] = useState<TabKey>("overview");
  const [stats, setStats] = useState<any>(null);
  const [evolutionReport, setEvolutionReport] = useState<any>(null);
  const [clusters, setClusters] = useState<any>(null);
  const [shifts, setShifts] = useState<any>(null);
  const [retrainStatus, setRetrainStatus] = useState<Record<string, "idle" | "running" | "done">>({});
  const { loading, error, analyzeEvolution, clusterQuestionDNA, detectCurriculumShift, getDashboardStats, retrainModel, extractMicroConcepts, generateQuestions, computeConfidenceBands } = useExamIntelligence();

  const fetchStats = useCallback(() => {
    getDashboardStats(examType).then(setStats);
  }, [examType]);

  useEffect(() => { fetchStats(); }, [fetchStats]);

  const handleEvolution = async () => {
    const result = await analyzeEvolution(examType);
    if (result) { setEvolutionReport(result); toast.success("Evolution analysis complete"); }
  };

  const handleCluster = async () => {
    const result = await clusterQuestionDNA(examType);
    if (result) { setClusters(result); toast.success(`${result.count} DNA clusters identified`); }
  };

  const handleShifts = async () => {
    const result = await detectCurriculumShift(examType);
    if (result) { setShifts(result); toast.success(`${result.total_detected} shifts detected`); }
  };

  const handleRetrain = async (type: string) => {
    setRetrainStatus(prev => ({ ...prev, [type]: "running" }));
    await retrainModel(type, examType);
    setRetrainStatus(prev => ({ ...prev, [type]: "done" }));
    toast.success(`${type} model retrained`);
    setTimeout(() => setRetrainStatus(prev => ({ ...prev, [type]: "idle" })), 3000);
  };

  const handleMicroExtract = async () => {
    const result = await extractMicroConcepts(examType, "Physics", "Mechanics");
    if (result) { toast.success(`${result.count} micro-concepts extracted`); fetchStats(); }
  };

  const handleGenerateQ = async () => {
    const result = await generateQuestions(examType, "Physics", "Mechanics", 5);
    if (result) { toast.success(`${result.count} questions generated`); fetchStats(); }
  };

  const handleConfidence = async () => {
    const result = await computeConfidenceBands(examType, "rank");
    if (result) toast.success("Confidence bands computed");
  };

  const systemHealth = stats ? Math.min(100, 40 + (stats.evolution_reports?.count || 0) * 5 + (stats.micro_concepts?.count || 0) * 2 + (stats.dna_clusters?.count || 0) * 3) : 0;

  return (
    <div className="space-y-5 relative">
      {/* Animated Background Orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div
          className="absolute -top-20 -right-20 w-60 h-60 rounded-full bg-violet-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute -bottom-20 -left-20 w-48 h-48 rounded-full bg-cyan-500/5 blur-3xl"
          animate={{ scale: [1.2, 1, 1.2], opacity: [0.4, 0.2, 0.4] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-40 h-40 rounded-full bg-fuchsia-500/3 blur-3xl"
          animate={{ scale: [1, 1.3, 1], opacity: [0.2, 0.5, 0.2] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* === HERO HEADER === */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-violet-500/20 bg-gradient-to-br from-violet-950/40 via-card/80 to-fuchsia-950/30 p-5"
      >
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent skew-x-12"
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, repeatDelay: 6, ease: "easeInOut" }}
        />

        <div className="relative flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-4">
            {/* Animated Icon */}
            <div className="relative">
              <motion.div
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500/30 to-fuchsia-500/30 flex items-center justify-center backdrop-blur-sm border border-violet-500/20"
                animate={{ boxShadow: ["0 0 20px rgba(139,92,246,0.2)", "0 0 40px rgba(139,92,246,0.4)", "0 0 20px rgba(139,92,246,0.2)"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <Dna className="w-7 h-7 text-violet-400" />
              </motion.div>
              {/* Orbiting particle */}
              <motion.div
                className="absolute w-2 h-2 rounded-full bg-cyan-400"
                animate={{
                  x: [0, 20, 0, -20, 0],
                  y: [-20, 0, 20, 0, -20],
                  opacity: [1, 0.6, 1, 0.6, 1],
                }}
                transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                style={{ top: "50%", left: "50%", marginTop: -4, marginLeft: -4 }}
              />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h2 className="text-xl font-bold text-foreground tracking-tight">
                  Exam Intelligence
                </h2>
                <Badge className="bg-gradient-to-r from-violet-500/20 to-fuchsia-500/20 border-violet-500/30 text-violet-300 text-[10px] font-mono">
                  v10.0
                </Badge>
                <motion.div
                  animate={{ opacity: [1, 0.4, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Badge className="bg-emerald-500/15 border-emerald-500/30 text-emerald-400 text-[9px]">
                    <CircleDot className="w-2 h-2 mr-0.5" /> LIVE
                  </Badge>
                </motion.div>
              </div>
              <p className="text-xs text-muted-foreground/80">
                Autonomous Exam Evolution Modeling · Predictive Question Generation · Neural Intelligence
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* System health ring */}
            <div className="relative w-12 h-12">
              <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
                <circle cx="24" cy="24" r="20" fill="none" stroke="hsl(var(--border))" strokeWidth="3" opacity="0.2" />
                <motion.circle
                  cx="24" cy="24" r="20" fill="none"
                  stroke="url(#healthGrad)"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeDasharray={`${systemHealth * 1.257} 125.7`}
                  initial={{ strokeDasharray: "0 125.7" }}
                  animate={{ strokeDasharray: `${systemHealth * 1.257} 125.7` }}
                  transition={{ duration: 1.5, ease: "easeOut" }}
                />
                <defs>
                  <linearGradient id="healthGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="rgb(139,92,246)" />
                    <stop offset="100%" stopColor="rgb(6,182,212)" />
                  </linearGradient>
                </defs>
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-foreground">
                {systemHealth}%
              </span>
            </div>

            <Select value={examType} onValueChange={setExamType}>
              <SelectTrigger className="w-32 h-9 text-xs bg-secondary/50 border-border/50 backdrop-blur-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {EXAM_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        </div>
      </motion.div>

      {/* === STATS GRID === */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
        {[
          { label: "Evolution", count: stats?.evolution_reports?.count || 0, icon: TrendingUp, from: "from-emerald-500/20", to: "to-teal-500/10", iconColor: "text-emerald-400", borderColor: "border-emerald-500/20", glowColor: "shadow-emerald-500/10" },
          { label: "Micro-Nodes", count: stats?.micro_concepts?.count || 0, icon: Atom, from: "from-cyan-500/20", to: "to-blue-500/10", iconColor: "text-cyan-400", borderColor: "border-cyan-500/20", glowColor: "shadow-cyan-500/10" },
          { label: "DNA Clusters", count: stats?.dna_clusters?.count || 0, icon: Dna, from: "from-violet-500/20", to: "to-purple-500/10", iconColor: "text-violet-400", borderColor: "border-violet-500/20", glowColor: "shadow-violet-500/10" },
          { label: "Generated Qs", count: stats?.generated_questions?.count || 0, icon: Sparkles, from: "from-amber-500/20", to: "to-orange-500/10", iconColor: "text-amber-400", borderColor: "border-amber-500/20", glowColor: "shadow-amber-500/10" },
          { label: "Shifts", count: stats?.curriculum_shifts?.count || 0, icon: AlertTriangle, from: "from-rose-500/20", to: "to-red-500/10", iconColor: "text-rose-400", borderColor: "border-rose-500/20", glowColor: "shadow-rose-500/10" },
        ].map((s, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 12, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: i * 0.06, type: "spring", stiffness: 200 }}
            whileHover={{ scale: 1.04, y: -2 }}
            className="group cursor-default"
          >
            <Card className={`relative overflow-hidden bg-gradient-to-br ${s.from} ${s.to} ${s.borderColor} border shadow-lg ${s.glowColor} transition-shadow duration-300 group-hover:shadow-xl`}>
              {/* Shimmer on hover */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
              <CardContent className="p-3 text-center relative">
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", delay: i * 0.5 }}
                >
                  <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.iconColor} drop-shadow-sm`} />
                </motion.div>
                <motion.p
                  className="text-2xl font-black text-foreground tracking-tight"
                  key={s.count}
                  initial={{ scale: 1.3, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring" }}
                >
                  {s.count}
                </motion.p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* === MODULE NAVIGATION === */}
      <div className="flex gap-1.5 flex-wrap">
        {MODULE_TABS.map((tab, i) => (
          <motion.button
            key={tab.key}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            onClick={() => setActiveTab(tab.key)}
            className={`relative flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all duration-300 ${
              activeTab === tab.key
                ? "text-foreground shadow-lg"
                : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
            }`}
          >
            {activeTab === tab.key && (
              <motion.div
                layoutId="activeModuleTab"
                className={`absolute inset-0 rounded-xl bg-gradient-to-r ${tab.gradient} opacity-15 border border-white/10`}
                transition={{ type: "spring", stiffness: 300, damping: 30 }}
              />
            )}
            <tab.icon className="w-3.5 h-3.5 relative z-10" />
            <span className="relative z-10 hidden sm:inline">{tab.label}</span>
          </motion.button>
        ))}
      </div>

      {/* === TAB CONTENT === */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ type: "spring", stiffness: 200, damping: 25 }}
        >
          {/* OVERVIEW */}
          {activeTab === "overview" && (
            <div className="space-y-4">
              {/* Neural Status Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { title: "Pattern Detection", subtitle: "Topic rotation & difficulty analysis", icon: Radar, status: "Active", statusColor: "text-emerald-400", gradient: "from-emerald-500/10 to-teal-500/5", border: "border-emerald-500/20", value: stats?.evolution_reports?.count || 0, label: "patterns" },
                  { title: "Generative Engine", subtitle: "AI question synthesis pipeline", icon: Sparkles, status: "Ready", statusColor: "text-amber-400", gradient: "from-amber-500/10 to-orange-500/5", border: "border-amber-500/20", value: stats?.generated_questions?.count || 0, label: "questions" },
                  { title: "Shift Detection", subtitle: "Curriculum change monitoring", icon: Activity, status: "Scanning", statusColor: "text-cyan-400", gradient: "from-cyan-500/10 to-blue-500/5", border: "border-cyan-500/20", value: stats?.curriculum_shifts?.count || 0, label: "shifts" },
                ].map((card, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: i * 0.1, type: "spring" }}
                  >
                    <Card className={`relative overflow-hidden bg-gradient-to-br ${card.gradient} ${card.border} border`}>
                      <motion.div
                        className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.02] to-transparent"
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 5, repeat: Infinity, repeatDelay: 8, delay: i * 2 }}
                      />
                      <CardContent className="p-4 relative">
                        <div className="flex items-start justify-between mb-3">
                          <motion.div
                            className="w-10 h-10 rounded-xl bg-background/50 flex items-center justify-center backdrop-blur-sm"
                            whileHover={{ rotate: 15, scale: 1.1 }}
                          >
                            <card.icon className={`w-5 h-5 ${card.statusColor}`} />
                          </motion.div>
                          <motion.div
                            className="flex items-center gap-1"
                            animate={{ opacity: [1, 0.5, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <CircleDot className={`w-2 h-2 ${card.statusColor}`} />
                            <span className={`text-[10px] font-medium ${card.statusColor}`}>{card.status}</span>
                          </motion.div>
                        </div>
                        <h4 className="text-sm font-bold text-foreground mb-0.5">{card.title}</h4>
                        <p className="text-[10px] text-muted-foreground mb-3">{card.subtitle}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-black text-foreground">{card.value}</span>
                          <span className="text-[10px] text-muted-foreground">{card.label}</span>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Module Pipeline Visualization */}
              <Card className="relative overflow-hidden border-border/30 bg-card/50 backdrop-blur-sm">
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/[0.02] to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 6, repeat: Infinity, repeatDelay: 4 }}
                />
                <CardContent className="p-4 relative">
                  <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                    <Waypoints className="w-4 h-4 text-violet-400" />
                    Intelligence Pipeline
                  </h4>
                  <div className="flex items-center gap-1 overflow-x-auto pb-2">
                    {[
                      { label: "Data Ingest", icon: Eye, color: "text-blue-400", bg: "bg-blue-500/10" },
                      { label: "Evolution", icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10" },
                      { label: "Micro-Extract", icon: Atom, color: "text-cyan-400", bg: "bg-cyan-500/10" },
                      { label: "DNA Cluster", icon: Dna, color: "text-violet-400", bg: "bg-violet-500/10" },
                      { label: "Generate", icon: Sparkles, color: "text-amber-400", bg: "bg-amber-500/10" },
                      { label: "Predict", icon: Shield, color: "text-rose-400", bg: "bg-rose-500/10" },
                    ].map((step, i) => (
                      <div key={i} className="flex items-center gap-1 flex-shrink-0">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.15, type: "spring" }}
                          className={`flex flex-col items-center gap-1 p-2.5 rounded-xl ${step.bg} border border-border/30 min-w-[72px]`}
                          whileHover={{ y: -3 }}
                        >
                          <step.icon className={`w-4 h-4 ${step.color}`} />
                          <span className="text-[9px] font-medium text-muted-foreground text-center">{step.label}</span>
                        </motion.div>
                        {i < 5 && (
                          <motion.div
                            initial={{ scaleX: 0 }}
                            animate={{ scaleX: 1 }}
                            transition={{ delay: i * 0.15 + 0.1 }}
                          >
                            <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
                          </motion.div>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Quick Actions */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {[
                  { label: "Run Evolution", action: handleEvolution, icon: TrendingUp, gradient: "from-emerald-500 to-teal-500" },
                  { label: "Extract Concepts", action: handleMicroExtract, icon: Atom, gradient: "from-cyan-500 to-blue-500" },
                  { label: "DNA Cluster", action: handleCluster, icon: Dna, gradient: "from-violet-500 to-purple-500" },
                  { label: "Generate Qs", action: handleGenerateQ, icon: Sparkles, gradient: "from-amber-500 to-orange-500" },
                ].map((a, i) => (
                  <motion.div key={i} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={a.action}
                      disabled={loading}
                      className="w-full h-auto py-3 flex flex-col items-center gap-1.5 bg-card/50 border-border/30 hover:border-border/50 relative overflow-hidden group"
                    >
                      <div className={`absolute inset-0 bg-gradient-to-br ${a.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-300`} />
                      {loading ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" /> : <a.icon className="w-4 h-4 text-foreground relative z-10" />}
                      <span className="text-[10px] font-medium relative z-10">{a.label}</span>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </div>
          )}

          {/* EVOLUTION ENGINE */}
          {activeTab === "evolution" && (
            <Card className="relative overflow-hidden border-emerald-500/20 bg-gradient-to-br from-emerald-500/5 to-card/80">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-emerald-500/[0.03] to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6 }} />
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div
                      className="w-10 h-10 rounded-xl bg-emerald-500/15 flex items-center justify-center"
                      animate={{ boxShadow: ["0 0 0px rgba(16,185,129,0)", "0 0 20px rgba(16,185,129,0.2)", "0 0 0px rgba(16,185,129,0)"] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      <TrendingUp className="w-5 h-5 text-emerald-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Meta-Pattern Evolution Model</h3>
                      <p className="text-[10px] text-muted-foreground">Time-series topic rotation · Difficulty inflation · Structural shifts</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleEvolution} disabled={loading} className="bg-emerald-500/15 hover:bg-emerald-500/25 text-emerald-400 border-emerald-500/20 text-xs">
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <BarChart3 className="w-3 h-3 mr-1" />}
                    Analyze {examType}
                  </Button>
                </div>

                {evolutionReport && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { label: "Difficulty Inflation", value: (evolutionReport.difficulty_inflation_rate * 100).toFixed(0), suffix: "%", color: evolutionReport.difficulty_inflation_rate > 0.3 ? "text-rose-400" : "text-emerald-400", icon: evolutionReport.difficulty_inflation_rate > 0.3 ? ArrowUpRight : Minus },
                        { label: "Structural Drift", value: (evolutionReport.structural_drift_index * 100).toFixed(0), suffix: "%", color: "text-amber-400", icon: Activity },
                        { label: "Topic Rotation", value: (evolutionReport.topic_rotation_score * 100).toFixed(0), suffix: "%", color: "text-cyan-400", icon: RefreshCw },
                      ].map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.1 }} className="p-3 rounded-xl bg-background/50 border border-border/30 text-center">
                          <m.icon className={`w-3 h-3 mx-auto mb-1 ${m.color}`} />
                          <p className="text-[10px] text-muted-foreground mb-0.5">{m.label}</p>
                          <p className={`text-lg font-black ${m.color}`}>{m.value}{m.suffix}</p>
                        </motion.div>
                      ))}
                    </div>

                    {evolutionReport.rising_topics?.length > 0 && (
                      <div className="p-3 rounded-xl bg-emerald-500/5 border border-emerald-500/15">
                        <p className="text-[10px] font-medium text-emerald-400 mb-2 flex items-center gap-1"><ArrowUpRight className="w-3 h-3" /> Rising Topics</p>
                        <div className="flex flex-wrap gap-1.5">
                          {evolutionReport.rising_topics.map((t: string, i: number) => (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                              <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20 text-[10px]">{t}</Badge>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}

                    {evolutionReport.declining_topics?.length > 0 && (
                      <div className="p-3 rounded-xl bg-rose-500/5 border border-rose-500/15">
                        <p className="text-[10px] font-medium text-rose-400 mb-2 flex items-center gap-1"><ArrowDownRight className="w-3 h-3" /> Declining Topics</p>
                        <div className="flex flex-wrap gap-1.5">
                          {evolutionReport.declining_topics.map((t: string, i: number) => (
                            <motion.div key={i} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}>
                              <Badge className="bg-rose-500/10 text-rose-400 border-rose-500/20 text-[10px]">{t}</Badge>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    )}
                  </motion.div>
                )}

                {!evolutionReport && (
                  <div className="flex flex-col items-center py-8 text-center">
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                      <Network className="w-10 h-10 text-emerald-500/20 mb-3" />
                    </motion.div>
                    <p className="text-xs text-muted-foreground">Run analysis to detect exam evolution patterns for {examType}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* MICRO-CONCEPTS */}
          {activeTab === "micro" && (
            <Card className="relative overflow-hidden border-cyan-500/20 bg-gradient-to-br from-cyan-500/5 to-card/80">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-cyan-500/[0.03] to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6 }} />
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="w-10 h-10 rounded-xl bg-cyan-500/15 flex items-center justify-center" animate={{ boxShadow: ["0 0 0px rgba(6,182,212,0)", "0 0 20px rgba(6,182,212,0.2)", "0 0 0px rgba(6,182,212,0)"] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Atom className="w-5 h-5 text-cyan-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Subtopic Granular Engine</h3>
                      <p className="text-[10px] text-muted-foreground">Break topics → micro-concepts · Probability scores · Memory injection</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleMicroExtract} disabled={loading} className="bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-400 border-cyan-500/20 text-xs">
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Atom className="w-3 h-3 mr-1" />}
                    Extract
                  </Button>
                </div>

                {stats?.micro_concepts?.data?.length > 0 ? (
                  <div className="space-y-1.5 max-h-64 overflow-y-auto pr-1">
                    {stats.micro_concepts.data.slice(0, 12).map((mc: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.04 }}
                        className="flex items-center justify-between p-2.5 rounded-xl bg-background/40 border border-border/20 group hover:border-cyan-500/20 transition-colors"
                      >
                        <div className="flex items-center gap-2.5">
                          <motion.div
                            className={`w-2 h-2 rounded-full ${mc.trend_direction === 'rising' ? 'bg-emerald-400' : mc.trend_direction === 'declining' ? 'bg-rose-400' : 'bg-amber-400'}`}
                            animate={mc.trend_direction === 'rising' ? { scale: [1, 1.4, 1] } : {}}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                          <span className="text-xs text-foreground">{mc.micro_concept}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[9px] font-mono">{mc.trend_direction}</Badge>
                          <div className="w-16">
                            <Progress value={mc.probability_score * 100} className="h-1.5" />
                          </div>
                          <span className="text-[10px] font-bold text-cyan-400 w-8 text-right">{(mc.probability_score * 100).toFixed(0)}%</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Atom className="w-10 h-10 text-cyan-500/20 mb-3" />
                    </motion.div>
                    <p className="text-xs text-muted-foreground">Extract micro-concepts to populate the granular engine</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* QUESTION DNA */}
          {activeTab === "dna" && (
            <Card className="relative overflow-hidden border-violet-500/20 bg-gradient-to-br from-violet-500/5 to-card/80">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-violet-500/[0.03] to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6 }} />
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="w-10 h-10 rounded-xl bg-violet-500/15 flex items-center justify-center" animate={{ boxShadow: ["0 0 0px rgba(139,92,246,0)", "0 0 20px rgba(139,92,246,0.2)", "0 0 0px rgba(139,92,246,0)"] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Dna className="w-5 h-5 text-violet-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Question DNA Clustering</h3>
                      <p className="text-[10px] text-muted-foreground">Cognitive structure extraction · Concept layering · Rising archetypes</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleCluster} disabled={loading} className="bg-violet-500/15 hover:bg-violet-500/25 text-violet-400 border-violet-500/20 text-xs">
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Dna className="w-3 h-3 mr-1" />}
                    Cluster
                  </Button>
                </div>

                {(clusters?.clusters || stats?.dna_clusters?.data)?.length > 0 ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(clusters?.clusters || stats?.dna_clusters?.data).slice(0, 8).map((c: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ scale: 1.02 }}
                        className="p-3 rounded-xl bg-background/40 border border-border/20 hover:border-violet-500/20 transition-all"
                      >
                        <div className="flex items-start justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Dna className="w-3.5 h-3.5 text-violet-400" />
                            <span className="text-xs font-bold text-foreground">{c.cluster_label}</span>
                          </div>
                          {c.is_rising && (
                            <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>
                              <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[9px]">
                                <ArrowUpRight className="w-2 h-2 mr-0.5" /> Rising
                              </Badge>
                            </motion.div>
                          )}
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground capitalize">{c.archetype}</span>
                          <span className="text-[10px] font-medium text-foreground">{c.cluster_size || 0} questions</span>
                        </div>
                        {c.growth_rate !== undefined && (
                          <div className="mt-1.5">
                            <Progress value={Math.max(0, Math.min(100, (c.growth_rate + 1) * 50))} className="h-1" />
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}>
                      <Dna className="w-10 h-10 text-violet-500/20 mb-3" />
                    </motion.div>
                    <p className="text-xs text-muted-foreground">Run DNA clustering to identify question archetypes</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* GENERATIVE ENGINE */}
          {activeTab === "generate" && (
            <Card className="relative overflow-hidden border-amber-500/20 bg-gradient-to-br from-amber-500/5 to-card/80">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-amber-500/[0.03] to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6 }} />
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="w-10 h-10 rounded-xl bg-amber-500/15 flex items-center justify-center" animate={{ boxShadow: ["0 0 0px rgba(245,158,11,0)", "0 0 20px rgba(245,158,11,0.2)", "0 0 0px rgba(245,158,11,0)"] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Sparkles className="w-5 h-5 text-amber-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Generative Question Engine</h3>
                      <p className="text-[10px] text-muted-foreground">AI synthesis · Future-style questions · High-probability alignment</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleGenerateQ} disabled={loading} className="bg-amber-500/15 hover:bg-amber-500/25 text-amber-400 border-amber-500/20 text-xs">
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Sparkles className="w-3 h-3 mr-1" />}
                    Generate
                  </Button>
                </div>

                {stats?.generated_questions?.data?.length > 0 ? (
                  <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                    {stats.generated_questions.data.slice(0, 6).map((q: any, i: number) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="p-3 rounded-xl bg-background/40 border border-border/20 hover:border-amber-500/20 transition-colors space-y-2"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <Badge className={`text-[9px] border-0 ${q.difficulty_level === 'hard' ? 'bg-rose-500/15 text-rose-400' : q.difficulty_level === 'medium' ? 'bg-amber-500/15 text-amber-400' : 'bg-emerald-500/15 text-emerald-400'}`}>{q.difficulty_level}</Badge>
                            <Badge variant="outline" className="text-[9px]">{q.cognitive_type}</Badge>
                          </div>
                          {q.is_approved ? (
                            <Badge className="bg-emerald-500/15 text-emerald-400 border-0 text-[9px]"><CheckCircle2 className="w-2 h-2 mr-0.5" /> Approved</Badge>
                          ) : (
                            <Badge className="bg-amber-500/15 text-amber-400 border-0 text-[9px]">Pending</Badge>
                          )}
                        </div>
                        <p className="text-xs text-foreground/90 line-clamp-2 leading-relaxed">{q.question_text}</p>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <motion.div animate={{ scale: [1, 1.15, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                      <Sparkles className="w-10 h-10 text-amber-500/20 mb-3" />
                    </motion.div>
                    <p className="text-xs text-muted-foreground">Generate AI-powered future-style exam questions</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CURRICULUM SHIFTS */}
          {activeTab === "shifts" && (
            <Card className="relative overflow-hidden border-rose-500/20 bg-gradient-to-br from-rose-500/5 to-card/80">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-rose-500/[0.03] to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6 }} />
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="w-10 h-10 rounded-xl bg-rose-500/15 flex items-center justify-center" animate={{ boxShadow: ["0 0 0px rgba(244,63,94,0)", "0 0 20px rgba(244,63,94,0.2)", "0 0 0px rgba(244,63,94,0)"] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Layers className="w-5 h-5 text-rose-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Predictive Curriculum Shift</h3>
                      <p className="text-[10px] text-muted-foreground">Syllabus changes · Auto-recalibration · Topic Intelligence Scores</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleShifts} disabled={loading} className="bg-rose-500/15 hover:bg-rose-500/25 text-rose-400 border-rose-500/20 text-xs">
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <AlertTriangle className="w-3 h-3 mr-1" />}
                    Detect
                  </Button>
                </div>

                {(shifts?.shifts || stats?.curriculum_shifts?.data)?.length > 0 ? (
                  <div className="space-y-2">
                    {(shifts?.shifts || stats?.curriculum_shifts?.data).slice(0, 8).map((s: any, i: number) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }} className="flex items-center justify-between p-3 rounded-xl bg-background/40 border border-border/20 hover:border-rose-500/20 transition-colors">
                        <div className="flex items-center gap-2.5">
                          <motion.div animate={s.shift_type?.includes('increase') ? { y: [0, -3, 0] } : { y: [0, 3, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                            {s.shift_type?.includes('increase') ? <ArrowUpRight className="w-4 h-4 text-emerald-400" /> : <ArrowDownRight className="w-4 h-4 text-rose-400" />}
                          </motion.div>
                          <div>
                            <p className="text-xs font-medium text-foreground">{s.affected_topic}</p>
                            <p className="text-[10px] text-muted-foreground capitalize">{s.shift_type?.replace('_', ' ')}</p>
                          </div>
                        </div>
                        <div className="text-right flex items-center gap-3">
                          <div>
                            <p className="text-xs font-bold text-foreground">{s.old_weight} → {s.new_weight}</p>
                            <p className="text-[10px] text-muted-foreground">Conf: {(s.confidence * 100).toFixed(0)}%</p>
                          </div>
                          <div className="w-12">
                            <Progress value={s.confidence * 100} className="h-1.5" />
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center py-8 text-center">
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 5, repeat: Infinity }}>
                      <Layers className="w-10 h-10 text-rose-500/20 mb-3" />
                    </motion.div>
                    <p className="text-xs text-muted-foreground">Detect curriculum structure changes for {examType}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* CONFIDENCE BANDS */}
          {activeTab === "confidence" && (
            <Card className="relative overflow-hidden border-blue-500/20 bg-gradient-to-br from-blue-500/5 to-card/80">
              <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-blue-500/[0.03] to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 5, repeat: Infinity, repeatDelay: 6 }} />
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <motion.div className="w-10 h-10 rounded-xl bg-blue-500/15 flex items-center justify-center" animate={{ boxShadow: ["0 0 0px rgba(59,130,246,0)", "0 0 20px rgba(59,130,246,0.2)", "0 0 0px rgba(59,130,246,0)"] }} transition={{ duration: 3, repeat: Infinity }}>
                      <Shield className="w-5 h-5 text-blue-400" />
                    </motion.div>
                    <div>
                      <h3 className="text-sm font-bold text-foreground">Confidence Interval Engine</h3>
                      <p className="text-[10px] text-muted-foreground">Volatility-adjusted predictions · Risk bands · Statistical confidence</p>
                    </div>
                  </div>
                  <Button size="sm" onClick={handleConfidence} disabled={loading} className="bg-blue-500/15 hover:bg-blue-500/25 text-blue-400 border-blue-500/20 text-xs">
                    {loading ? <Loader2 className="w-3 h-3 mr-1 animate-spin" /> : <Shield className="w-3 h-3 mr-1" />}
                    Compute Bands
                  </Button>
                </div>

                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: "Prediction Type", value: "Rank + Memory", icon: Brain, color: "text-violet-400" },
                    { label: "Confidence Level", value: "95%", icon: Shield, color: "text-blue-400" },
                    { label: "Model Version", value: "v10.0", icon: Cpu, color: "text-emerald-400" },
                  ].map((item, i) => (
                    <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }} className="p-3 rounded-xl bg-background/40 border border-border/20 text-center">
                      <item.icon className={`w-4 h-4 mx-auto mb-1 ${item.color}`} />
                      <p className="text-[10px] text-muted-foreground">{item.label}</p>
                      <p className="text-xs font-bold text-foreground mt-0.5">{item.value}</p>
                    </motion.div>
                  ))}
                </div>

                <div className="p-4 rounded-xl bg-background/30 border border-blue-500/10">
                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="w-3.5 h-3.5 text-blue-400" />
                    <span className="text-xs font-medium text-foreground">Risk-Adjusted Prediction Band</span>
                  </div>
                  <div className="relative h-8 rounded-lg overflow-hidden bg-secondary/30">
                    <motion.div className="absolute inset-y-0 left-[20%] right-[20%] bg-blue-500/15 border-x border-blue-500/30" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1, ease: "easeOut" }} />
                    <motion.div className="absolute inset-y-0 left-[35%] right-[35%] bg-blue-500/25" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 1.2, ease: "easeOut", delay: 0.2 }} />
                    <motion.div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-blue-400" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 2, repeat: Infinity }} />
                  </div>
                  <div className="flex justify-between mt-1.5">
                    <span className="text-[9px] text-muted-foreground">Lower Bound</span>
                    <span className="text-[9px] font-medium text-blue-400">Point Estimate</span>
                    <span className="text-[9px] text-muted-foreground">Upper Bound</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* MODEL CONTROL */}
          {activeTab === "retrain" && (
            <Card className="relative overflow-hidden border-border/30 bg-gradient-to-br from-secondary/20 to-card/80">
              <CardContent className="p-5 relative space-y-4">
                <div className="flex items-center gap-3 mb-2">
                  <motion.div className="w-10 h-10 rounded-xl bg-secondary/50 flex items-center justify-center" whileHover={{ rotate: 180 }} transition={{ duration: 0.5 }}>
                    <RefreshCw className="w-5 h-5 text-foreground" />
                  </motion.div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Model Retraining Control</h3>
                    <p className="text-[10px] text-muted-foreground">Retrain individual AI models for {examType}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    { type: "evolution", label: "Evolution Model", desc: "Topic rotation & difficulty trends", icon: TrendingUp, gradient: "from-emerald-500 to-teal-500", iconColor: "text-emerald-400" },
                    { type: "micro_concept", label: "Micro-Concept Model", desc: "Subtopic probability scoring", icon: Atom, gradient: "from-cyan-500 to-blue-500", iconColor: "text-cyan-400" },
                    { type: "question_dna", label: "Question DNA Model", desc: "Cognitive archetype clustering", icon: Dna, gradient: "from-violet-500 to-purple-500", iconColor: "text-violet-400" },
                    { type: "generative", label: "Generative Engine", desc: "AI question synthesis", icon: Sparkles, gradient: "from-amber-500 to-orange-500", iconColor: "text-amber-400" },
                    { type: "curriculum", label: "Curriculum Shift", desc: "Syllabus change detection", icon: Layers, gradient: "from-rose-500 to-red-500", iconColor: "text-rose-400" },
                    { type: "confidence", label: "Confidence Band", desc: "Statistical prediction bands", icon: Shield, gradient: "from-blue-500 to-indigo-500", iconColor: "text-blue-400" },
                  ].map((m, i) => {
                    const status = retrainStatus[m.type] || "idle";
                    return (
                      <motion.div
                        key={m.type}
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.06 }}
                        whileHover={{ scale: 1.02 }}
                      >
                        <Button
                          variant="outline"
                          onClick={() => handleRetrain(m.type)}
                          disabled={loading || status === "running"}
                          className="w-full h-auto p-3.5 flex items-start gap-3 bg-card/50 border-border/30 hover:border-border/50 relative overflow-hidden group justify-start"
                        >
                          <div className={`absolute inset-0 bg-gradient-to-br ${m.gradient} opacity-0 group-hover:opacity-5 transition-opacity duration-300`} />
                          <div className="relative z-10">
                            {status === "running" ? (
                              <Loader2 className={`w-5 h-5 animate-spin ${m.iconColor}`} />
                            ) : status === "done" ? (
                              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring" }}>
                                <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                              </motion.div>
                            ) : (
                              <m.icon className={`w-5 h-5 ${m.iconColor}`} />
                            )}
                          </div>
                          <div className="text-left relative z-10">
                            <p className="text-xs font-bold text-foreground">{m.label}</p>
                            <p className="text-[10px] text-muted-foreground">{m.desc}</p>
                          </div>
                        </Button>
                      </motion.div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}
        </motion.div>
      </AnimatePresence>

      {error && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-3 rounded-xl bg-destructive/10 border border-destructive/20">
          <p className="text-xs text-destructive flex items-center gap-1.5"><AlertTriangle className="w-3 h-3" /> {error}</p>
        </motion.div>
      )}
    </div>
  );
}
