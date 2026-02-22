import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Brain, FileText, BarChart3, Plus, Play, Eye,
  ChevronRight, Loader2, CheckCircle2, Lightbulb, Scale,
  Globe, BookOpen, Landmark, TrendingUp, PenTool, Zap,
  Target, Sparkles, Activity, Shield, ArrowRight, Cpu,
  Flame, Award, Clock, Users
} from "lucide-react";
import { useDebateDashboard, useDebateAnalyses, useDebateAnalysisDetail, useGenerateAnalysis, useApplyFrameworks } from "@/hooks/useDebateEngine";

type Tab = "dashboard" | "analyses" | "detail" | "create";

const FRAMEWORK_LABELS: Record<string, { label: string; icon: any; gradient: string; glow: string }> = {
  pestle: { label: "PESTLE Analysis", icon: BarChart3, gradient: "from-blue-500/20 to-cyan-500/20", glow: "shadow-blue-500/20" },
  stakeholder: { label: "Stakeholder Mapping", icon: Users, gradient: "from-purple-500/20 to-pink-500/20", glow: "shadow-purple-500/20" },
  cost_benefit: { label: "Cost-Benefit Analysis", icon: Scale, gradient: "from-emerald-500/20 to-green-500/20", glow: "shadow-emerald-500/20" },
  long_short_term: { label: "Long vs Short Term", icon: TrendingUp, gradient: "from-orange-500/20 to-amber-500/20", glow: "shadow-orange-500/20" },
};

const PIPELINE_STAGES = [
  { label: "Topic", icon: Target, color: "from-cyan-500 to-blue-500" },
  { label: "Multi-Angle", icon: Swords, color: "from-orange-500 to-red-500" },
  { label: "PESTLE", icon: BarChart3, color: "from-blue-500 to-indigo-500" },
  { label: "Stakeholders", icon: Users, color: "from-purple-500 to-pink-500" },
  { label: "Cost-Benefit", icon: Scale, color: "from-emerald-500 to-green-500" },
  { label: "Long/Short", icon: TrendingUp, color: "from-amber-500 to-orange-500" },
  { label: "Writing", icon: PenTool, color: "from-pink-500 to-rose-500" },
  { label: "AI Eval", icon: Award, color: "from-violet-500 to-purple-500" },
];

// Animated counter hook
function useAnimatedCount(target: number, duration = 1200) {
  const [count, setCount] = useState(0);
  useEffect(() => {
    if (target === 0) { setCount(0); return; }
    let start = 0;
    const step = Math.ceil(target / (duration / 16));
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setCount(target); clearInterval(timer); }
      else setCount(start);
    }, 16);
    return () => clearInterval(timer);
  }, [target, duration]);
  return count;
}

// Orbiting particle component
function OrbitingParticle({ delay = 0, size = 3, radius = 20, color = "bg-primary" }: { delay?: number; size?: number; radius?: number; color?: string }) {
  return (
    <motion.div
      className={`absolute rounded-full ${color}`}
      style={{ width: size, height: size }}
      animate={{
        x: [radius, 0, -radius, 0, radius],
        y: [0, radius, 0, -radius, 0],
        opacity: [0.3, 0.8, 0.3, 0.8, 0.3],
      }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Pulsing glow ring
function GlowRing({ color = "primary", size = 48 }: { color?: string; size?: number }) {
  return (
    <motion.div
      className="absolute inset-0 rounded-2xl"
      style={{ boxShadow: `0 0 ${size}px rgba(var(--${color}), 0.15)` }}
      animate={{ opacity: [0.3, 0.7, 0.3] }}
      transition={{ duration: 3, repeat: Infinity }}
    />
  );
}

export default function DebateEngineAdmin() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ title: "", context: "", event_id: "" });
  const [activePipelineStage, setActivePipelineStage] = useState(0);

  const dashboard = useDebateDashboard();
  const analyses = useDebateAnalyses();
  const detail = useDebateAnalysisDetail(selectedId);
  const generateAnalysis = useGenerateAnalysis();
  const applyFrameworks = useApplyFrameworks();

  // Animate pipeline stages
  useEffect(() => {
    const timer = setInterval(() => {
      setActivePipelineStage(prev => (prev + 1) % PIPELINE_STAGES.length);
    }, 2000);
    return () => clearInterval(timer);
  }, []);

  const handleGenerate = () => {
    if (!newTopic.title.trim()) return;
    generateAnalysis.mutate(
      { topic_title: newTopic.title, topic_context: newTopic.context, event_id: newTopic.event_id || undefined },
      {
        onSuccess: (data: any) => {
          setSelectedId(data.id);
          setTab("detail");
          setNewTopic({ title: "", context: "", event_id: "" });
        },
      }
    );
  };

  const stats = dashboard.data || {};

  const STAT_CARDS = [
    { label: "Total Analyses", value: stats.totalAnalyses || 0, icon: Brain, gradient: "from-cyan-500 to-blue-600", glow: "cyan" },
    { label: "Frameworks Applied", value: stats.totalFrameworks || 0, icon: BarChart3, gradient: "from-purple-500 to-violet-600", glow: "purple" },
    { label: "Writing Evaluations", value: stats.totalEvaluations || 0, icon: PenTool, gradient: "from-emerald-500 to-green-600", glow: "green" },
    { label: "Avg Writing Score", value: stats.avgWritingScore || 0, suffix: "/10", icon: Award, gradient: "from-orange-500 to-red-500", glow: "orange" },
  ];

  const TABS_CONFIG = [
    { key: "dashboard" as Tab, label: "Command Center", icon: Cpu, gradient: "from-cyan-500 to-blue-500" },
    { key: "analyses" as Tab, label: "Analysis Lab", icon: Brain, gradient: "from-purple-500 to-pink-500" },
    { key: "create" as Tab, label: "Generate New", icon: Sparkles, gradient: "from-orange-500 to-red-500" },
  ];

  return (
    <div className="space-y-6 relative">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div
          className="absolute top-10 right-20 w-64 h-64 rounded-full bg-gradient-to-br from-orange-500/5 to-red-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 6, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-20 left-10 w-48 h-48 rounded-full bg-gradient-to-br from-cyan-500/5 to-blue-500/5 blur-3xl"
          animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.2, 0.4, 0.2] }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-56 h-56 rounded-full bg-gradient-to-br from-purple-500/5 to-pink-500/5 blur-3xl"
          animate={{ x: [-20, 20, -20], y: [-10, 10, -10], opacity: [0.2, 0.35, 0.2] }}
          transition={{ duration: 10, repeat: Infinity }}
        />
      </div>

      {/* ═══════ HEADER ═══════ */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Animated icon */}
            <div className="relative">
              <motion.div
                className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 via-red-500/20 to-pink-500/20 flex items-center justify-center border border-orange-500/20 backdrop-blur-sm"
                animate={{ boxShadow: ["0 0 20px rgba(249,115,22,0.1)", "0 0 40px rgba(249,115,22,0.2)", "0 0 20px rgba(249,115,22,0.1)"] }}
                transition={{ duration: 3, repeat: Infinity }}
              >
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                  <Swords className="w-7 h-7 text-orange-400" />
                </motion.div>
              </motion.div>
              <OrbitingParticle delay={0} size={4} radius={28} color="bg-orange-400" />
              <OrbitingParticle delay={1.3} size={3} radius={24} color="bg-red-400" />
              <OrbitingParticle delay={2.6} size={3} radius={30} color="bg-pink-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-foreground tracking-tight">CA 4.0</h2>
                <motion.span
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest border border-orange-500/20"
                  animate={{ opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  AI Powered
                </motion.span>
                <motion.span
                  className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest border border-purple-500/20"
                  animate={{ opacity: [0.6, 1, 0.6] }}
                  transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}
                >
                  Debate Engine
                </motion.span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Multi-angle analysis • Structured frameworks • Writing evaluation</p>
            </div>
          </div>

          {/* Live status indicator */}
          <motion.div
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <motion.div
              className="w-2 h-2 rounded-full bg-emerald-400"
              animate={{ scale: [1, 1.3, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">System Active</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══════ TAB NAVIGATION ═══════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 flex-wrap">
        {TABS_CONFIG.map((t, i) => (
          <motion.button
            key={t.key}
            onClick={() => setTab(t.key)}
            whileHover={{ scale: 1.03, y: -1 }}
            whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.08 }}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all overflow-hidden ${
              tab === t.key
                ? "bg-gradient-to-r " + t.gradient + " text-white shadow-lg"
                : "bg-card/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}
          >
            {tab === t.key && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent"
                animate={{ x: ["-100%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
              />
            )}
            <t.icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* ═══════ TAB CONTENT ═══════ */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.98 }}
          transition={{ duration: 0.3 }}
        >
          {/* ═══════ DASHBOARD TAB ═══════ */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              {/* Stat Cards with Animated Counters */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STAT_CARDS.map((s, i) => {
                  const animatedVal = useAnimatedCount(typeof s.value === "number" ? s.value : parseFloat(String(s.value)) || 0);
                  return (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 30, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ delay: i * 0.1, type: "spring", stiffness: 200 }}
                      whileHover={{ y: -4, scale: 1.02 }}
                      className="relative group"
                    >
                      <div className="relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-5 overflow-hidden hover:border-primary/30 transition-all duration-300">
                        {/* Glow effect */}
                        <motion.div
                          className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${s.gradient} blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500`}
                        />
                        
                        {/* Icon */}
                        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${s.gradient} flex items-center justify-center mb-3 shadow-lg`}>
                          <s.icon className="w-5 h-5 text-white" />
                        </div>
                        
                        <p className="text-xs text-muted-foreground font-medium mb-1">{s.label}</p>
                        <div className="flex items-baseline gap-1">
                          <span className="text-3xl font-black text-foreground tabular-nums">{animatedVal}</span>
                          {s.suffix && <span className="text-sm text-muted-foreground font-bold">{s.suffix}</span>}
                        </div>
                        
                        {/* Bottom accent line */}
                        <motion.div
                          className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${s.gradient}`}
                          initial={{ width: "0%" }}
                          animate={{ width: "100%" }}
                          transition={{ delay: i * 0.15 + 0.3, duration: 0.8 }}
                        />
                      </div>
                    </motion.div>
                  );
                })}
              </div>

              {/* ═══════ ANIMATED PIPELINE FLOW ═══════ */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="relative bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-6 overflow-hidden"
              >
                <div className="flex items-center gap-2 mb-5">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  >
                    <Cpu className="w-5 h-5 text-primary" />
                  </motion.div>
                  <h3 className="text-sm font-bold text-foreground">CA 4.0 Intelligence Pipeline</h3>
                  <motion.span
                    className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold"
                    animate={{ opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  >
                    LIVE
                  </motion.span>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      <motion.div
                        animate={i === activePipelineStage ? {
                          scale: [1, 1.08, 1],
                          boxShadow: ["0 0 0px transparent", "0 0 20px rgba(var(--primary), 0.3)", "0 0 0px transparent"],
                        } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-500 ${
                          i === activePipelineStage
                            ? `bg-gradient-to-r ${stage.color} text-white shadow-lg`
                            : i < activePipelineStage
                            ? "bg-primary/10 text-primary border border-primary/20"
                            : "bg-secondary/50 text-muted-foreground border border-border"
                        }`}
                      >
                        <stage.icon className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold whitespace-nowrap">{stage.label}</span>
                      </motion.div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <motion.div
                          animate={i === activePipelineStage ? { opacity: [0.3, 1, 0.3], x: [0, 3, 0] } : {}}
                          transition={{ duration: 0.8, repeat: Infinity }}
                        >
                          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${i < activePipelineStage ? "text-primary" : "text-muted-foreground/30"}`} />
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>

                {/* Shimmer sweep */}
                <motion.div
                  className="absolute inset-0 bg-gradient-to-r from-transparent via-white/3 to-transparent"
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, repeatDelay: 6 }}
                />
              </motion.div>

              {/* ═══════ MODULE CARDS ═══════ */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  {
                    title: "Module 1: Multi-Angle Analysis",
                    desc: "Pro/Counter arguments, Ethical, Economic, Constitutional & International dimensions",
                    icon: Swords, gradient: "from-orange-500 to-red-500",
                    features: ["Pro Arguments", "Counter Arguments", "Ethical Dimension", "Economic Impact", "Constitutional Link", "International View"],
                  },
                  {
                    title: "Module 2: Framework Engine",
                    desc: "PESTLE, Stakeholder Mapping, Cost-Benefit, Long vs Short Term analysis",
                    icon: BarChart3, gradient: "from-blue-500 to-purple-500",
                    features: ["PESTLE Analysis", "Stakeholder Map", "Cost-Benefit", "Long/Short Term"],
                  },
                  {
                    title: "Module 3: Writing Evaluator",
                    desc: "Structure, Depth, Evidence, Clarity, Logical Flow scoring with AI feedback",
                    icon: PenTool, gradient: "from-emerald-500 to-cyan-500",
                    features: ["Structure Score", "Depth Score", "Evidence Score", "Clarity Score", "Logical Flow", "Model Answer"],
                  },
                ].map((mod, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 + i * 0.12 }}
                    whileHover={{ y: -4 }}
                    className="group relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300"
                  >
                    {/* Top gradient bar */}
                    <div className={`h-1 bg-gradient-to-r ${mod.gradient}`} />
                    
                    <div className="p-5">
                      <div className="flex items-center gap-3 mb-3">
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${mod.gradient} flex items-center justify-center shadow-lg`}>
                          <mod.icon className="w-4.5 h-4.5 text-white" />
                        </div>
                        <h4 className="text-sm font-bold text-foreground">{mod.title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground mb-4 leading-relaxed">{mod.desc}</p>
                      
                      <div className="flex flex-wrap gap-1.5">
                        {mod.features.map((f, fi) => (
                          <motion.span
                            key={fi}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: 0.6 + i * 0.1 + fi * 0.05 }}
                            className="px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground text-[10px] font-medium border border-border/50"
                          >
                            {f}
                          </motion.span>
                        ))}
                      </div>
                    </div>

                    {/* Hover glow */}
                    <motion.div
                      className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${mod.gradient} blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700`}
                    />
                  </motion.div>
                ))}
              </div>

              {/* ═══════ SCORING RADAR VISUALIZATION ═══════ */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7 }}
                className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-6"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Writing Evaluation Dimensions</h3>
                </div>
                <div className="grid grid-cols-5 gap-3">
                  {[
                    { label: "Structure", score: 8.5, color: "from-cyan-500 to-blue-500" },
                    { label: "Depth", score: 7.8, color: "from-purple-500 to-pink-500" },
                    { label: "Evidence", score: 6.9, color: "from-orange-500 to-red-500" },
                    { label: "Clarity", score: 8.2, color: "from-emerald-500 to-green-500" },
                    { label: "Logic Flow", score: 7.5, color: "from-amber-500 to-yellow-500" },
                  ].map((dim, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.8 + i * 0.08 }}
                      className="text-center"
                    >
                      <div className="relative w-16 h-16 mx-auto mb-2">
                        <svg viewBox="0 0 36 36" className="w-16 h-16 -rotate-90">
                          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2" className="stroke-border" />
                          <motion.circle
                            cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5"
                            strokeLinecap="round"
                            className="stroke-primary"
                            strokeDasharray="100"
                            initial={{ strokeDashoffset: 100 }}
                            animate={{ strokeDashoffset: 100 - (dim.score / 10) * 100 }}
                            transition={{ delay: 1 + i * 0.1, duration: 1, ease: "easeOut" }}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          <span className="text-sm font-black text-foreground">{dim.score}</span>
                        </div>
                      </div>
                      <span className="text-[10px] font-bold text-muted-foreground">{dim.label}</span>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          )}

          {/* ═══════ ANALYSES LIST TAB ═══════ */}
          {tab === "analyses" && (
            <div className="space-y-3">
              {analyses.isLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="w-8 h-8 text-primary" />
                  </motion.div>
                  <span className="text-xs text-muted-foreground font-medium">Loading Analysis Lab...</span>
                </div>
              )}
              {analyses.data?.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                  <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center"
                  >
                    <Swords className="w-8 h-8 text-orange-400" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground font-medium">No analyses yet</p>
                  <p className="text-xs text-muted-foreground mt-1">Generate your first multi-angle analysis to get started</p>
                  <button onClick={() => setTab("create")} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold hover:opacity-90 transition-opacity">
                    <Plus className="w-3.5 h-3.5 inline mr-1.5" />Create Analysis
                  </button>
                </motion.div>
              )}
              {analyses.data?.map((a: any, i: number) => (
                <motion.div
                  key={a.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  whileHover={{ x: 4, scale: 1.005 }}
                  onClick={() => { setSelectedId(a.id); setTab("detail"); }}
                  className="group relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 cursor-pointer overflow-hidden"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Swords className="w-4 h-4 text-orange-400 shrink-0" />
                        <h4 className="font-bold text-foreground text-sm truncate">{a.topic_title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 ml-6">{a.topic_context}</p>
                      <div className="flex items-center gap-3 mt-2.5 ml-6">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          a.status === "frameworks_applied"
                            ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20"
                            : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                        }`}>
                          {a.status === "frameworks_applied" ? "✓ Complete" : "⚡ Generated"}
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                          <Target className="w-3 h-3" />
                          Relevance: <span className="font-bold text-foreground">{a.exam_relevance_score}%</span>
                        </span>
                      </div>
                    </div>
                    <motion.div whileHover={{ x: 3 }} className="ml-3">
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-400 transition-colors" />
                    </motion.div>
                  </div>

                  {/* Hover shimmer */}
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-r from-transparent via-orange-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, repeatDelay: 2 }}
                  />
                </motion.div>
              ))}
            </div>
          )}

          {/* ═══════ DETAIL VIEW TAB ═══════ */}
          {tab === "detail" && selectedId && (
            <div className="space-y-5">
              {detail.isLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Brain className="w-8 h-8 text-primary" />
                  </motion.div>
                  <span className="text-xs text-muted-foreground">Decoding analysis...</span>
                </div>
              )}
              {detail.data?.analysis && (
                <>
                  {/* Back + Action Bar */}
                  <div className="flex items-center justify-between">
                    <motion.button
                      whileHover={{ x: -3 }}
                      onClick={() => setTab("analyses")}
                      className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium"
                    >
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" />
                      Back to Analysis Lab
                    </motion.button>
                    {detail.data.analysis.status !== "frameworks_applied" && (
                      <motion.button
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => applyFrameworks.mutate(selectedId)}
                        disabled={applyFrameworks.isPending}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold shadow-lg disabled:opacity-50"
                      >
                        {applyFrameworks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                        Apply All Frameworks
                      </motion.button>
                    )}
                  </div>

                  {/* Topic Card */}
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="relative bg-gradient-to-br from-orange-500/10 via-card to-red-500/5 border border-orange-500/20 rounded-2xl p-6 overflow-hidden"
                  >
                    <div className="flex items-start gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg shrink-0">
                        <Swords className="w-5 h-5 text-white" />
                      </div>
                      <div>
                        <h3 className="text-lg font-black text-foreground">{detail.data.analysis.topic_title}</h3>
                        <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{detail.data.analysis.topic_context}</p>
                        <div className="flex items-center gap-3 mt-3">
                          <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-orange-500/15 text-orange-400 font-bold border border-orange-500/20">
                            Exam Relevance: {detail.data.analysis.exam_relevance_score}%
                          </span>
                        </div>
                      </div>
                    </div>
                    <motion.div
                      className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-bl-full"
                      animate={{ opacity: [0.3, 0.6, 0.3] }}
                      transition={{ duration: 4, repeat: Infinity }}
                    />
                  </motion.div>

                  {/* Pro vs Counter Arguments */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Pro */}
                    <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 }}
                      className="bg-card/80 border border-emerald-500/20 rounded-2xl overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-emerald-500 to-green-500" />
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">Pro Arguments</h4>
                          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold">
                            {(detail.data.analysis.pro_arguments || []).length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {(detail.data.analysis.pro_arguments || []).map((arg: any, i: number) => (
                            <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                              className="pl-3 border-l-2 border-emerald-500/30">
                              <span className="text-xs font-bold text-emerald-400">{arg.point || arg}</span>
                              {arg.explanation && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{arg.explanation}</p>}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>

                    {/* Counter */}
                    <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
                      className="bg-card/80 border border-red-500/20 rounded-2xl overflow-hidden">
                      <div className="h-1 bg-gradient-to-r from-red-500 to-orange-500" />
                      <div className="p-5">
                        <div className="flex items-center gap-2 mb-4">
                          <div className="w-7 h-7 rounded-lg bg-red-500/20 flex items-center justify-center">
                            <Swords className="w-4 h-4 text-red-400" />
                          </div>
                          <h4 className="text-sm font-bold text-foreground">Counter Arguments</h4>
                          <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold">
                            {(detail.data.analysis.counter_arguments || []).length}
                          </span>
                        </div>
                        <div className="space-y-3">
                          {(detail.data.analysis.counter_arguments || []).map((arg: any, i: number) => (
                            <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                              className="pl-3 border-l-2 border-red-500/30">
                              <span className="text-xs font-bold text-red-400">{arg.point || arg}</span>
                              {arg.explanation && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{arg.explanation}</p>}
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </motion.div>
                  </div>

                  {/* 4 Dimensions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: "Ethical Dimension", icon: Lightbulb, gradient: "from-yellow-500 to-amber-500", border: "border-yellow-500/20", content: detail.data.analysis.ethical_dimension },
                      { label: "Economic Dimension", icon: BarChart3, gradient: "from-blue-500 to-cyan-500", border: "border-blue-500/20", content: detail.data.analysis.economic_dimension },
                      { label: "Constitutional Link", icon: Landmark, gradient: "from-purple-500 to-violet-500", border: "border-purple-500/20", content: detail.data.analysis.constitutional_link },
                      { label: "International Perspective", icon: Globe, gradient: "from-cyan-500 to-teal-500", border: "border-cyan-500/20", content: detail.data.analysis.international_perspective },
                    ].map((dim, i) => (
                      <motion.div key={i} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.08 }}
                        className={`bg-card/80 border ${dim.border} rounded-2xl overflow-hidden`}>
                        <div className={`h-1 bg-gradient-to-r ${dim.gradient}`} />
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-3">
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${dim.gradient} flex items-center justify-center`}>
                              <dim.icon className="w-4 h-4 text-white" />
                            </div>
                            <h4 className="text-sm font-bold text-foreground">{dim.label}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{dim.content || "Not generated yet"}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Frameworks */}
                  {detail.data.frameworks.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Scale className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Applied Reasoning Frameworks</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{detail.data.frameworks.length}</span>
                      </div>
                      {detail.data.frameworks.map((fw: any, i: number) => {
                        const meta = FRAMEWORK_LABELS[fw.framework_type] || { label: fw.framework_type, icon: FileText, gradient: "from-gray-500/20 to-gray-600/20", glow: "shadow-gray-500/20" };
                        return (
                          <motion.div key={fw.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                            className={`bg-card/80 border border-border rounded-2xl overflow-hidden hover:${meta.glow} hover:shadow-lg transition-all duration-300`}>
                            <div className={`h-1 bg-gradient-to-r ${meta.gradient.replace("/20", "")}`} />
                            <div className="p-5">
                              <div className="flex items-center gap-2 mb-3">
                                <meta.icon className="w-5 h-5 text-primary" />
                                <h4 className="text-sm font-bold text-foreground">{meta.label}</h4>
                              </div>
                              <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-56 bg-secondary/30 rounded-xl p-3 border border-border/50 font-mono">
                                {JSON.stringify(fw.framework_data, null, 2)}
                              </pre>
                            </div>
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* ═══════ CREATE NEW ANALYSIS TAB ═══════ */}
          {tab === "create" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-8 max-w-2xl overflow-hidden">
              {/* Decorative gradient */}
              <motion.div
                className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-bl-full"
                animate={{ opacity: [0.3, 0.5, 0.3] }}
                transition={{ duration: 4, repeat: Infinity }}
              />

              <div className="relative space-y-5">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg">
                    <Sparkles className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">Generate Multi-Angle Analysis</h3>
                    <p className="text-[10px] text-muted-foreground">AI will analyze topic from 6 dimensions with structured frameworks</p>
                  </div>
                </div>

                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Topic Title *</label>
                  <input
                    value={newTopic.title}
                    onChange={e => setNewTopic(p => ({ ...p, title: e.target.value }))}
                    placeholder="e.g., National Education Policy 2020"
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Context / Description</label>
                  <textarea
                    value={newTopic.context}
                    onChange={e => setNewTopic(p => ({ ...p, context: e.target.value }))}
                    placeholder="Provide background context for comprehensive AI analysis..."
                    rows={5}
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all resize-none"
                  />
                </div>
                <div>
                  <label className="text-xs text-muted-foreground mb-1.5 block font-medium">Link to CA Event <span className="text-muted-foreground/50">(optional)</span></label>
                  <input
                    value={newTopic.event_id}
                    onChange={e => setNewTopic(p => ({ ...p, event_id: e.target.value }))}
                    placeholder="Event UUID"
                    className="w-full px-4 py-3 rounded-xl bg-background border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-orange-500/30 focus:border-orange-500/50 transition-all"
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={handleGenerate}
                  disabled={!newTopic.title.trim() || generateAnalysis.isPending}
                  className="relative flex items-center justify-center gap-2 w-full px-4 py-3 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold shadow-lg disabled:opacity-50 overflow-hidden"
                >
                  {generateAnalysis.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Generating Multi-Angle Analysis...</span>
                    </>
                  ) : (
                    <>
                      <Brain className="w-4 h-4" />
                      <span>Generate Analysis</span>
                    </>
                  )}
                  {!generateAnalysis.isPending && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }}
                    />
                  )}
                </motion.button>

                {/* What AI generates */}
                <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">AI Will Generate:</p>
                  <div className="grid grid-cols-3 gap-2">
                    {["Pro Arguments", "Counter Arguments", "Ethical Dimension", "Economic Impact", "Constitutional Link", "International View"].map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ delay: 0.3 + i * 0.06 }}
                        className="flex items-center gap-1.5 text-[10px] text-muted-foreground"
                      >
                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                        {item}
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
