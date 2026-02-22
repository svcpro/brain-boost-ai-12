import { useState, useMemo, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Upload, RefreshCw, TrendingUp, Database, Zap, BarChart3, AlertTriangle, Loader2, Target, Layers, Sparkles, Trash2, Pencil, Search, CheckSquare, Square, X, Download, Filter, BookOpen, GraduationCap, Rocket, Check, Circle, Activity, Cpu, Shield, Flame, Eye, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const STQ_EXAM_TYPES = [
  { id: "SSC CGL", category: "Government" },
  { id: "IBPS PO", category: "Government" },
  { id: "SBI PO", category: "Government" },
  { id: "RRB NTPC", category: "Government" },
  { id: "RRB Group D", category: "Government" },
  { id: "NDA", category: "Government" },
  { id: "CDS", category: "Government" },
  { id: "State PSC", category: "Government" },
  { id: "UGC NET", category: "Government" },
  { id: "JEE Advanced", category: "Entrance" },
  { id: "NEET UG", category: "Entrance" },
  { id: "CAT", category: "Entrance" },
  { id: "GATE", category: "Entrance" },
  { id: "CLAT", category: "Entrance" },
  { id: "CUET UG", category: "Entrance" },
  { id: "BITSAT", category: "Entrance" },
  { id: "NIFT", category: "Entrance" },
  { id: "XAT", category: "Entrance" },
  { id: "SAT", category: "Global" },
  { id: "GRE", category: "Global" },
  { id: "GMAT", category: "Global" },
  { id: "IELTS", category: "Global" },
  { id: "TOEFL", category: "Global" },
  { id: "USMLE", category: "Global" },
  { id: "CFA", category: "Global" },
  { id: "CPA", category: "Global" },
  { id: "MCAT", category: "Global" },
  { id: "ACCA", category: "Global" },
];

const STQ_EXAM_SUBJECTS: Record<string, string[]> = {
  "JEE Advanced": ["Physics", "Chemistry", "Mathematics"],
  "NEET UG": ["Physics", "Chemistry", "Biology"],
  "CAT": ["Quantitative Aptitude", "Verbal Ability", "Data Interpretation", "Logical Reasoning"],
  "GATE": ["Engineering Mathematics", "General Aptitude", "Core Subject"],
  "SSC CGL": ["General Intelligence", "English Language", "Quantitative Aptitude", "General Awareness"],
  "IBPS PO": ["Reasoning", "English Language", "Quantitative Aptitude", "General Awareness", "Computer Aptitude"],
  "NDA": ["Mathematics", "General Ability Test", "English", "General Knowledge"],
  "UGC NET": ["General Paper", "Subject Paper"],
  "SAT": ["Math", "Evidence-Based Reading", "Writing"],
  "GRE": ["Verbal Reasoning", "Quantitative Reasoning", "Analytical Writing"],
  "GMAT": ["Quantitative", "Verbal", "Integrated Reasoning", "Analytical Writing"],
  "CLAT": ["English", "Current Affairs", "Legal Reasoning", "Logical Reasoning", "Quantitative Techniques"],
  "State PSC": ["General Studies", "CSAT", "Optional Subject"],
  "CUET UG": ["General Test", "Domain Subject", "Language"],
  "USMLE": ["Anatomy", "Physiology", "Biochemistry", "Pharmacology", "Pathology", "Microbiology"],
  "CFA": ["Ethics", "Quantitative Methods", "Economics", "Financial Reporting", "Corporate Finance", "Equity Investments", "Fixed Income", "Derivatives", "Portfolio Management"],
  "MCAT": ["Biology", "Chemistry", "Physics", "Psychology", "Critical Analysis"],
};

type STQTab = "dashboard" | "pipeline" | "syllabus" | "mining" | "tpi" | "patterns" | "training";

const TAB_CONFIG: { key: STQTab; label: string; icon: any; gradient: string; activeColor: string }[] = [
  { key: "dashboard", label: "Dashboard", icon: BarChart3, gradient: "from-cyan-500 to-blue-600", activeColor: "text-cyan-400" },
  { key: "pipeline", label: "🚀 Full Auto Pipeline", icon: Rocket, gradient: "from-orange-500 to-red-600", activeColor: "text-orange-400" },
  { key: "syllabus", label: "Syllabus Parser", icon: Layers, gradient: "from-violet-500 to-purple-600", activeColor: "text-violet-400" },
  { key: "mining", label: "Question Mining", icon: Database, gradient: "from-emerald-500 to-green-600", activeColor: "text-emerald-400" },
  { key: "tpi", label: "TPI Scores", icon: Target, gradient: "from-rose-500 to-pink-600", activeColor: "text-rose-400" },
  { key: "patterns", label: "Pattern Evolution", icon: TrendingUp, gradient: "from-amber-500 to-orange-600", activeColor: "text-amber-400" },
  { key: "training", label: "Model Training", icon: RefreshCw, gradient: "from-sky-500 to-indigo-600", activeColor: "text-sky-400" },
];

// =============================================
// ANIMATED COUNTER
// =============================================
function AnimatedCounter({ value, duration = 1.2 }: { value: number; duration?: number }) {
  const [display, setDisplay] = useState(0);
  const prevRef = useRef(0);

  useEffect(() => {
    const start = prevRef.current;
    const diff = value - start;
    if (diff === 0) { setDisplay(value); return; }
    const startTime = performance.now();
    const step = (now: number) => {
      const elapsed = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - elapsed, 3);
      setDisplay(Math.round(start + diff * eased));
      if (elapsed < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
    prevRef.current = value;
  }, [value, duration]);

  return <>{display}</>;
}

// =============================================
// FLOATING PARTICLES
// =============================================
function FloatingParticles() {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(6)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{
            background: `hsl(${175 + i * 30}, 80%, 60%)`,
            left: `${10 + i * 15}%`,
            top: `${20 + (i % 3) * 25}%`,
          }}
          animate={{
            y: [0, -20, 0],
            x: [0, 10, 0],
            opacity: [0.3, 0.8, 0.3],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{
            duration: 3 + i * 0.5,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.4,
          }}
        />
      ))}
    </div>
  );
}

// =============================================
// MAIN COMPONENT
// =============================================
export default function STQEngineAdmin() {
  const [tab, setTab] = useState<STQTab>("dashboard");
  const [examType, setExamType] = useState("JEE Advanced");
  const [showExamDropdown, setShowExamDropdown] = useState(false);

  return (
    <div className="space-y-6">
      {/* ===== HERO HEADER ===== */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden rounded-2xl border border-border/50"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--background)) 50%, hsl(var(--card)) 100%)",
        }}
      >
        {/* Animated gradient orbs */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <motion.div
            className="absolute -top-20 -right-20 w-60 h-60 rounded-full opacity-[0.08]"
            style={{ background: "radial-gradient(circle, hsl(15, 100%, 55%), transparent 70%)" }}
            animate={{ scale: [1, 1.3, 1], rotate: [0, 90, 0] }}
            transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
          />
          <motion.div
            className="absolute -bottom-10 -left-10 w-40 h-40 rounded-full opacity-[0.06]"
            style={{ background: "radial-gradient(circle, hsl(175, 80%, 50%), transparent 70%)" }}
            animate={{ scale: [1.2, 1, 1.2], rotate: [0, -60, 0] }}
            transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>

        <FloatingParticles />

        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {/* Animated Logo */}
              <div className="relative">
                <motion.div
                  className="w-14 h-14 rounded-2xl flex items-center justify-center relative overflow-hidden"
                  style={{
                    background: "linear-gradient(135deg, hsl(15, 100%, 55%), hsl(330, 100%, 55%), hsl(270, 100%, 60%))",
                    boxShadow: "0 0 30px hsla(15, 100%, 55%, 0.3), 0 0 60px hsla(330, 100%, 55%, 0.15)",
                  }}
                  animate={{ boxShadow: [
                    "0 0 30px hsla(15, 100%, 55%, 0.3), 0 0 60px hsla(330, 100%, 55%, 0.15)",
                    "0 0 40px hsla(15, 100%, 55%, 0.5), 0 0 80px hsla(330, 100%, 55%, 0.25)",
                    "0 0 30px hsla(15, 100%, 55%, 0.3), 0 0 60px hsla(330, 100%, 55%, 0.15)",
                  ]}}
                  transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                >
                  {/* Shimmer sweep */}
                  <motion.div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(105deg, transparent 40%, hsla(0,0%,100%,0.2) 50%, transparent 60%)" }}
                    animate={{ x: ["-100%", "200%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
                  />
                  <Brain className="w-7 h-7 text-white relative z-10" />
                </motion.div>

                {/* Orbiting particle */}
                <motion.div
                  className="absolute w-2 h-2 rounded-full"
                  style={{ background: "hsl(175, 100%, 65%)", boxShadow: "0 0 8px hsl(175, 100%, 65%)" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                  initial={{ x: 24, y: 0 }}
                >
                  <motion.div style={{ x: 24 }} />
                </motion.div>

                {/* Live pulse */}
                <motion.div
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full border-2"
                  style={{ borderColor: "hsl(var(--card))", background: "hsl(142, 76%, 46%)" }}
                  animate={{ scale: [1, 1.3, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-xl font-black text-foreground tracking-tight">STQ Engine</h2>
                  <motion.span
                    className="px-2 py-0.5 rounded-md text-[10px] font-black tracking-wider"
                    style={{
                      background: "linear-gradient(135deg, hsl(15, 100%, 55%), hsl(330, 100%, 55%))",
                      color: "white",
                    }}
                    animate={{ scale: [1, 1.05, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    v9.0
                  </motion.span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Syllabus → Topic → Question ML Pipeline
                </p>
                <div className="flex items-center gap-3 mt-1.5">
                  <div className="flex items-center gap-1">
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: "hsl(142, 76%, 46%)" }}
                      animate={{ opacity: [1, 0.4, 1] }}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-[10px] text-muted-foreground">Engine Active</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground/50">•</span>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Cpu className="w-3 h-3" /> 12-Factor Ensemble
                  </span>
                </div>
              </div>
            </div>

            {/* Exam Selector */}
            <div className="relative">
              <button
                onClick={() => setShowExamDropdown(!showExamDropdown)}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl border border-border/50 text-sm font-semibold text-foreground transition-all hover:border-primary/30"
                style={{ background: "hsla(var(--secondary), 0.5)", backdropFilter: "blur(8px)" }}
              >
                <Target className="w-4 h-4 text-primary" />
                {examType}
                <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform ${showExamDropdown ? "rotate-180" : ""}`} />
              </button>

               <AnimatePresence>
                {showExamDropdown && (
                  <>
                    <div className="fixed inset-0 z-[99]" onClick={() => setShowExamDropdown(false)} />
                    <motion.div
                      initial={{ opacity: 0, y: -5, scale: 0.95 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      className="absolute right-0 mt-2 w-64 rounded-xl border border-border shadow-2xl z-[100] max-h-80 overflow-y-auto bg-popover"
                    >
                      {["Government", "Entrance", "Global"].map(cat => (
                        <div key={cat}>
                          <p className="px-3 pt-2.5 pb-1 text-[9px] font-bold uppercase tracking-widest text-muted-foreground/60">{cat}</p>
                          {STQ_EXAM_TYPES.filter(e => e.category === cat).map(e => (
                            <button
                              key={e.id}
                              onClick={() => { setExamType(e.id); setShowExamDropdown(false); }}
                              className={`w-full flex items-center gap-2 px-3 py-2 text-left text-xs whitespace-nowrap truncate transition-colors ${
                                examType === e.id
                                  ? "bg-primary/10 text-primary font-semibold"
                                  : "text-foreground hover:bg-accent"
                              }`}
                            >
                              {examType === e.id && <Check className="w-3 h-3 shrink-0" />}
                              <span className="truncate">{e.id}</span>
                            </button>
                          ))}
                        </div>
                      ))}
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </div>
        </div>
      </motion.div>

      {/* ===== TAB NAVIGATION ===== */}
      <div className="flex gap-1.5 flex-wrap">
        {TAB_CONFIG.map((t, i) => {
          const active = tab === t.key;
          return (
            <motion.button
              key={t.key}
              onClick={() => setTab(t.key)}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className={`relative flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-semibold transition-all duration-300 overflow-hidden ${
                active
                  ? `${t.activeColor} shadow-lg`
                  : "text-muted-foreground hover:text-foreground hover:bg-secondary/60"
              }`}
              style={active ? {
                background: `linear-gradient(135deg, hsla(var(--card), 0.9), hsla(var(--secondary), 0.8))`,
                border: "1px solid hsla(var(--primary), 0.2)",
              } : {}}
            >
              {active && (
                <motion.div
                  layoutId="stq-tab-glow"
                  className="absolute inset-0 rounded-xl opacity-10"
                  style={{ background: `linear-gradient(135deg, ${t.gradient.replace('from-', '').replace(' to-', ', ').split(', ').map(c => `var(--tw-gradient-${c})`).join(', ') || 'hsl(var(--primary))'})` }}
                  transition={{ type: "spring", bounce: 0.2, duration: 0.5 }}
                />
              )}
              <t.icon className="w-3.5 h-3.5 relative z-10" />
              <span className="relative z-10 hidden sm:inline">{t.label}</span>
              {active && (
                <motion.div
                  className="absolute bottom-0 left-1/2 w-6 h-0.5 rounded-full -translate-x-1/2"
                  style={{ background: "hsl(var(--primary))" }}
                  layoutId="stq-tab-indicator"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* ===== CONTENT ===== */}
      <AnimatePresence mode="wait">
        <motion.div
          key={tab}
          initial={{ opacity: 0, y: 12, scale: 0.99 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, scale: 0.99 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
        >
          {tab === "dashboard" && <DashboardView examType={examType} />}
          {tab === "pipeline" && <FullAutoPipeline examType={examType} />}
          {tab === "syllabus" && <SyllabusParser examType={examType} />}
          {tab === "mining" && <QuestionMining examType={examType} />}
          {tab === "tpi" && <TPIScores examType={examType} />}
          {tab === "patterns" && <PatternEvolution examType={examType} />}
          {tab === "training" && <ModelTraining examType={examType} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

// =============================================
// ULTRA DASHBOARD
// =============================================
function DashboardView({ examType }: { examType: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["stq-dashboard", examType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "get_dashboard", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
  });

  if (isLoading) return <LoadingState />;

  const stats = data?.stats || {};
  const topTPI = (data?.tpi_scores || []).slice(0, 10);

  const STAT_CARDS = [
    { label: "Taxonomy Items", value: stats.taxonomy_count || 0, icon: Layers, gradient: "from-blue-500 to-cyan-500", glow: "hsla(200, 80%, 55%, 0.2)" },
    { label: "Questions Mined", value: stats.questions_mined || 0, icon: Database, gradient: "from-emerald-500 to-green-500", glow: "hsla(155, 80%, 50%, 0.2)" },
    { label: "TPI Topics", value: stats.topics_with_tpi || 0, icon: Target, gradient: "from-orange-500 to-amber-500", glow: "hsla(30, 90%, 55%, 0.2)" },
    { label: "High TPI (>85)", value: stats.high_tpi_count || 0, icon: Flame, gradient: "from-red-500 to-rose-500", glow: "hsla(0, 80%, 55%, 0.2)" },
    { label: "Medium TPI", value: stats.medium_tpi_count || 0, icon: Activity, gradient: "from-yellow-500 to-orange-400", glow: "hsla(40, 90%, 55%, 0.2)" },
    { label: "Pattern Alerts", value: stats.pattern_detections || 0, icon: AlertTriangle, gradient: "from-purple-500 to-violet-500", glow: "hsla(270, 80%, 55%, 0.2)" },
  ];

  return (
    <div className="space-y-5">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {STAT_CARDS.map((s, i) => {
          const Icon = s.icon;
          return (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, y: 15, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: i * 0.07, type: "spring", bounce: 0.3 }}
              className="relative rounded-2xl p-4 border border-border/40 overflow-hidden group cursor-default"
              style={{ background: "hsl(var(--card))" }}
            >
              {/* Hover glow */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                style={{ background: `radial-gradient(circle at 50% 50%, ${s.glow}, transparent 70%)` }}
              />

              {/* Shimmer on hover */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100"
                style={{ background: "linear-gradient(105deg, transparent 40%, hsla(0,0%,100%,0.05) 50%, transparent 60%)" }}
                animate={{ x: ["-200%", "200%"] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 1 }}
              />

              <div className="relative z-10">
                <div className="flex items-center justify-between mb-2">
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center bg-gradient-to-br ${s.gradient}`}
                    style={{ boxShadow: `0 4px 15px ${s.glow}` }}
                  >
                    <Icon className="w-4 h-4 text-white" />
                  </div>
                  {s.value > 0 && (
                    <motion.div
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ background: `hsl(142, 76%, 46%)` }}
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>
                <p className="text-2xl font-black text-foreground tabular-nums">
                  <AnimatedCounter value={s.value} />
                </p>
                <p className="text-[10px] text-muted-foreground font-medium mt-0.5">{s.label}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Top TPI Topics */}
      {topTPI.length > 0 && (
        <GlassCard title="🎯 Top Predicted Topics" subtitle="Highest probability topics for next exam" icon={Target} iconGradient="from-rose-500 to-pink-500">
          <div className="space-y-1.5 max-h-64 overflow-y-auto scrollbar-thin">
            {topTPI.map((t: any, i: number) => (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className="flex items-center gap-2.5 p-2.5 rounded-xl bg-background/40 hover:bg-background/60 transition-all text-xs group"
              >
                <span className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[9px] font-black text-primary">
                  {i + 1}
                </span>
                <TPIBadge score={t.tpi_score} />
                <span className="text-foreground flex-1 truncate font-semibold">{t.topic}</span>
                <span className="text-muted-foreground text-[10px]">{t.subject}</span>
                <span className="text-[9px] text-muted-foreground/70 tabular-nums">{t.confidence?.toFixed(0)}%</span>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Engine Status */}
      {data?.config && (
        <GlassCard title="⚡ Engine Status" subtitle="Module activation state" icon={Shield} iconGradient="from-cyan-500 to-blue-500">
          <div className="grid grid-cols-2 gap-2">
            {[
              { label: "Syllabus Parser", enabled: data.config.syllabus_parser_enabled, icon: Layers },
              { label: "Question Mining", enabled: data.config.question_mining_enabled, icon: Database },
              { label: "TPI Engine", enabled: data.config.tpi_engine_enabled, icon: Target },
              { label: "Pattern Detection", enabled: data.config.pattern_detection_enabled, icon: TrendingUp },
              { label: "Memory Injection", enabled: data.config.memory_injection_enabled, icon: Brain },
              { label: "Mock Integration", enabled: data.config.mock_integration_enabled, icon: Eye },
              { label: "SureShot Link", enabled: data.config.sureshot_integration_enabled, icon: Zap },
              { label: "Auto Retrain", enabled: data.config.auto_retrain_enabled, icon: RefreshCw },
            ].map((s, i) => {
              const SIcon = s.icon;
              return (
                <motion.div
                  key={s.label}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-center gap-2.5 p-2.5 rounded-xl transition-all ${
                    s.enabled
                      ? "bg-emerald-500/5 border border-emerald-500/15"
                      : "bg-secondary/30 border border-border/30"
                  }`}
                >
                  <SIcon className={`w-3.5 h-3.5 ${s.enabled ? "text-emerald-400" : "text-muted-foreground/40"}`} />
                  <span className={`text-[11px] font-medium flex-1 ${s.enabled ? "text-foreground" : "text-muted-foreground/60"}`}>{s.label}</span>
                  {s.enabled ? (
                    <motion.div
                      className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center"
                      animate={{ scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      <Check className="w-3 h-3 text-emerald-400" />
                    </motion.div>
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-secondary flex items-center justify-center">
                      <X className="w-3 h-3 text-muted-foreground/40" />
                    </div>
                  )}
                </motion.div>
              );
            })}
          </div>

          {/* Model Info Bar */}
          <motion.div
            className="mt-3 flex items-center gap-3 px-3 py-2 rounded-xl border border-border/30"
            style={{ background: "hsla(var(--secondary), 0.3)" }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <Cpu className="w-4 h-4 text-primary" />
            <div className="flex-1 text-[10px]">
              <span className="text-foreground font-semibold">Model: </span>
              <span className="text-primary font-bold">{data.config.model_version}</span>
            </div>
            <div className="text-[10px] text-muted-foreground">
              Last trained: {data.config.last_retrained_at ? new Date(data.config.last_retrained_at).toLocaleDateString() : "Never"}
            </div>
          </motion.div>
        </GlassCard>
      )}

      {/* Training History Preview */}
      {data?.training_logs?.length > 0 && (
        <GlassCard title="🧠 Recent Training Runs" subtitle="Latest model training history" icon={RefreshCw} iconGradient="from-sky-500 to-indigo-500">
          <div className="space-y-2 max-h-48 overflow-y-auto scrollbar-thin">
            {data.training_logs.slice(0, 5).map((l: any, i: number) => (
              <motion.div
                key={l.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06 }}
                className="flex items-center gap-3 p-2.5 rounded-xl bg-background/40"
              >
                <div className={`w-7 h-7 rounded-lg flex items-center justify-center ${
                  l.status === "completed" ? "bg-emerald-500/15" : "bg-destructive/15"
                }`}>
                  {l.status === "completed" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-destructive" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold text-foreground">{l.model_version}</span>
                    <span className="text-[9px] text-muted-foreground">{l.exam_types_trained?.join(", ")}</span>
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                    <span>{l.data_points_processed} pts</span>
                    <span>•</span>
                    <span>{l.duration_ms}ms</span>
                    <span>•</span>
                    <span>{l.accuracy_after?.toFixed(1)}% conf</span>
                  </div>
                </div>
                <span className="text-[9px] text-muted-foreground/50 shrink-0">
                  {new Date(l.created_at).toLocaleDateString()}
                </span>
              </motion.div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

// =============================================
// FULL AUTO PIPELINE
// =============================================
const PIPELINE_STEPS = [
  { key: "syllabus", label: "Generate Syllabus", icon: Layers, description: "AI generates complete exam taxonomy", gradient: "from-violet-500 to-purple-600" },
  { key: "mining", label: "Question Mining", icon: Database, description: "AI mines question patterns per year/subject", gradient: "from-emerald-500 to-green-600" },
  { key: "tpi", label: "Compute TPI Scores", icon: Target, description: "Calculate Topic Probability Index", gradient: "from-rose-500 to-pink-600" },
  { key: "patterns", label: "Pattern Detection", icon: TrendingUp, description: "Detect exam trend evolution", gradient: "from-amber-500 to-orange-600" },
  { key: "training", label: "Model Training", icon: RefreshCw, description: "Retrain prediction model", gradient: "from-sky-500 to-indigo-600" },
];

function FullAutoPipeline({ examType }: { examType: string }) {
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2023, 2022, 2021, 2020]);
  const [skipSyllabus, setSkipSyllabus] = useState(false);
  const [pipelineResult, setPipelineResult] = useState<any>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
  const qc = useQueryClient();
  const availableSubjects = STQ_EXAM_SUBJECTS[examType] || [];
  const allYears = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];

  const { data: existingSyllabus } = useQuery({
    queryKey: ["stq-taxonomy-count", examType],
    queryFn: async () => {
      const { count } = await (supabase as any).from("syllabus_taxonomies").select("id", { count: "exact", head: true }).eq("exam_type", examType);
      return count || 0;
    },
  });

  const invokeStep = async (action: string, params: any) => {
    const { data, error } = await supabase.functions.invoke("stq-engine", {
      body: { action, ...params },
    });
    if (error) throw new Error(`Step "${action}" failed: ${error.message}`);
    if (data?.error) throw new Error(`Step "${action}": ${data.error}`);
    return data;
  };

  const runPipeline = useMutation({
    mutationFn: async () => {
      setPipelineResult(null);
      const steps: any[] = [];
      const startTime = Date.now();
      const params = {
        exam_type: examType,
        subjects: selectedSubjects.length ? selectedSubjects : undefined,
        years: selectedYears.length ? selectedYears : [2024, 2023, 2022, 2021, 2020],
      };

      setCurrentStep("syllabus");
      if (!skipSyllabus) {
        try {
          const d = await invokeStep("auto_generate_syllabus", { exam_type: examType, subjects: params.subjects });
          steps.push({ step: "syllabus", status: "completed", count: d.count || 0 });
        } catch (e: any) {
          steps.push({ step: "syllabus", status: "failed", error: e.message });
        }
      } else {
        steps.push({ step: "syllabus", status: "skipped" });
      }

      setCurrentStep("mining");
      try {
        const d = await invokeStep("auto_mine_questions", { exam_type: examType, years: params.years, subjects: params.subjects });
        steps.push({ step: "mining", status: "completed", total_mined: d.total_mined || 0 });
      } catch (e: any) {
        steps.push({ step: "mining", status: "failed", error: e.message });
      }

      setCurrentStep("tpi");
      try {
        const d = await invokeStep("compute_tpi", { exam_type: examType, prediction_year: new Date().getFullYear() + 1 });
        steps.push({ step: "tpi", status: "completed", topics_computed: d.topics_computed || 0 });
      } catch (e: any) {
        steps.push({ step: "tpi", status: "failed", error: e.message });
      }

      setCurrentStep("patterns");
      try {
        const d = await invokeStep("detect_patterns", { exam_type: examType });
        steps.push({ step: "patterns", status: "completed", detections: d.detections_count || 0 });
      } catch (e: any) {
        steps.push({ step: "patterns", status: "failed", error: e.message });
      }

      setCurrentStep("training");
      try {
        const d = await invokeStep("retrain", { exam_type: examType });
        steps.push({ step: "training", status: "completed", model_version: d.model_version });
      } catch (e: any) {
        steps.push({ step: "training", status: "failed", error: e.message });
      }

      const duration = Date.now() - startTime;
      return { success: true, exam_type: examType, duration_ms: duration, steps, engine_version: "v9.0-ultra" };
    },
    onSuccess: (d) => {
      setCurrentStep(null);
      setPipelineResult(d);
      const failedCount = d.steps.filter((s: any) => s.status === "failed").length;
      if (failedCount === 0) {
        toast.success(`🚀 Full pipeline completed in ${(d.duration_ms / 1000).toFixed(1)}s!`);
      } else {
        toast.warning(`Pipeline finished with ${failedCount} failed step(s) in ${(d.duration_ms / 1000).toFixed(1)}s`);
      }
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
      qc.invalidateQueries({ queryKey: ["stq-taxonomy"] });
      qc.invalidateQueries({ queryKey: ["stq-mining"] });
      qc.invalidateQueries({ queryKey: ["stq-tpi"] });
      qc.invalidateQueries({ queryKey: ["stq-patterns"] });
      qc.invalidateQueries({ queryKey: ["stq-training-logs"] });
    },
    onError: (e: any) => {
      setCurrentStep(null);
      toast.error(e.message);
    },
  });

  const getStepStatus = (stepKey: string) => {
    if (pipelineResult?.steps) {
      const step = pipelineResult.steps.find((s: any) => s.step === stepKey);
      if (step) return step.status;
    }
    if (!runPipeline.isPending) return "idle";
    const stepOrder = ["syllabus", "mining", "tpi", "patterns", "training"];
    const currentIdx = stepOrder.indexOf(currentStep || "");
    const thisIdx = stepOrder.indexOf(stepKey);
    if (thisIdx < currentIdx) return "completed";
    if (thisIdx === currentIdx) return "running";
    return "pending";
  };

  const getStepDetail = (stepKey: string) => {
    if (!pipelineResult?.steps) return null;
    return pipelineResult.steps.find((s: any) => s.step === stepKey);
  };

  const toggleSubject = (s: string) => setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  const toggleYear = (y: number) => setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);

  return (
    <div className="space-y-5">
      <GlassCard title="Full Auto Pipeline — One Click, Complete Setup" subtitle="Run the entire STQ pipeline automatically" icon={Rocket} iconGradient="from-orange-500 to-red-500">
        <p className="text-[10px] text-muted-foreground mb-4">
          Run the entire STQ pipeline for <span className="text-primary font-bold">{examType}</span> automatically:
          Syllabus → Question Mining → TPI → Pattern Detection → Training.
        </p>

        {(existingSyllabus || 0) > 0 && (
          <div className="flex items-center gap-2 mb-3 p-2.5 rounded-xl bg-secondary/30 border border-border/30">
            <button onClick={() => setSkipSyllabus(!skipSyllabus)} className="flex items-center gap-1.5 text-[11px]">
              {skipSyllabus ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5 text-muted-foreground" />}
              <span className={skipSyllabus ? "text-primary font-medium" : "text-muted-foreground"}>
                Skip syllabus (already have {existingSyllabus} items)
              </span>
            </button>
          </div>
        )}

        {availableSubjects.length > 0 && !skipSyllabus && (
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-foreground mb-1.5">Subjects (optional):</p>
            <div className="flex flex-wrap gap-1.5">
              {availableSubjects.map(s => (
                <button key={s} onClick={() => toggleSubject(s)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all border ${
                    selectedSubjects.includes(s) ? "bg-primary/15 border-primary/30 text-primary" : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                  }`}>
                  {selectedSubjects.includes(s) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-[10px] font-semibold text-foreground mb-1.5">Mining Years:</p>
          <div className="flex flex-wrap gap-1.5">
            {allYears.map(y => (
              <button key={y} onClick={() => toggleYear(y)}
                className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all border ${
                  selectedYears.includes(y) ? "bg-primary/15 border-primary/30 text-primary" : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                }`}>
                {y}
              </button>
            ))}
          </div>
          <div className="flex gap-2 mt-1.5">
            <button onClick={() => setSelectedYears(allYears)} className="text-[9px] text-primary hover:underline font-medium">All</button>
            <button onClick={() => setSelectedYears([2024, 2023, 2022, 2021, 2020])} className="text-[9px] text-muted-foreground hover:underline">Last 5</button>
          </div>
        </div>

        {/* Launch Button */}
        <motion.button
          onClick={() => runPipeline.mutate()}
          disabled={runPipeline.isPending || !selectedYears.length}
          className="w-full flex items-center justify-center gap-2.5 px-4 py-4 rounded-2xl text-sm font-black disabled:opacity-50 relative overflow-hidden"
          style={{
            background: "linear-gradient(135deg, hsl(15, 100%, 55%), hsl(330, 100%, 55%))",
            color: "white",
            boxShadow: "0 4px 25px hsla(15, 100%, 55%, 0.3)",
          }}
          whileHover={{ scale: 1.01, boxShadow: "0 6px 35px hsla(15, 100%, 55%, 0.4)" }}
          whileTap={{ scale: 0.99 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: "linear-gradient(105deg, transparent 40%, hsla(0,0%,100%,0.15) 50%, transparent 60%)" }}
            animate={{ x: ["-200%", "200%"] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear", repeatDelay: 3 }}
          />
          {runPipeline.isPending ? (
            <><Loader2 className="w-5 h-5 animate-spin relative z-10" /> <span className="relative z-10">Pipeline Running...</span></>
          ) : (
            <><Rocket className="w-5 h-5 relative z-10" /> <span className="relative z-10">Launch Full Pipeline for {examType}</span></>
          )}
        </motion.button>
      </GlassCard>

      {/* Pipeline Progress Steps */}
      <GlassCard title="Pipeline Progress" subtitle="Step-by-step execution tracking" icon={Zap} iconGradient="from-amber-500 to-orange-500">
        <div className="space-y-2">
          {PIPELINE_STEPS.map((step, i) => {
            const status = getStepStatus(step.key);
            const detail = getStepDetail(step.key);
            const StepIcon = step.icon;
            return (
              <motion.div key={step.key}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.06, type: "spring" }}
                className={`flex items-center gap-3 p-3.5 rounded-2xl border transition-all ${
                  status === "running" ? "bg-primary/5 border-primary/20 shadow-lg shadow-primary/5" :
                  status === "completed" ? "bg-emerald-500/5 border-emerald-500/15" :
                  status === "failed" ? "bg-destructive/5 border-destructive/15" :
                  status === "skipped" ? "bg-secondary/30 border-border/30" :
                  "bg-card/50 border-border/30"
                }`}
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                  status === "running" ? `bg-gradient-to-br ${step.gradient}` :
                  status === "completed" ? "bg-emerald-500/15" :
                  status === "failed" ? "bg-destructive/15" :
                  "bg-secondary/50"
                }`}>
                  {status === "running" ? (
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
                      <Loader2 className="w-4 h-4 text-white" />
                    </motion.div>
                  ) : status === "completed" ? (
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.5 }}>
                      <Check className="w-4 h-4 text-emerald-400" />
                    </motion.div>
                  ) : status === "failed" ? (
                    <X className="w-4 h-4 text-destructive" />
                  ) : status === "skipped" ? (
                    <Check className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <StepIcon className="w-4 h-4 text-muted-foreground/40" />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={`text-xs font-bold ${
                      status === "running" ? "text-primary" :
                      status === "completed" ? "text-emerald-400" :
                      status === "failed" ? "text-destructive" :
                      "text-foreground"
                    }`}>{step.label}</p>
                    {status === "skipped" && <span className="text-[9px] text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-md">skipped</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground">{step.description}</p>
                  {detail && status === "completed" && (
                    <p className="text-[10px] text-emerald-400 mt-0.5 font-medium">
                      {detail.count != null && `${detail.count} items`}
                      {detail.total_mined != null && `${detail.total_mined} questions mined`}
                      {detail.topics_computed != null && `${detail.topics_computed} topics`}
                      {detail.detections != null && `${detail.detections} patterns found`}
                      {detail.model_version && `${detail.model_version}`}
                    </p>
                  )}
                  {detail && status === "failed" && (
                    <p className="text-[10px] text-destructive mt-0.5">{detail.error}</p>
                  )}
                </div>

                <span className="text-[10px] text-muted-foreground/40 font-mono shrink-0 tabular-nums">{i + 1}/5</span>
              </motion.div>
            );
          })}
        </div>

        {runPipeline.isPending && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-3 rounded-2xl p-4 border border-primary/15"
            style={{ background: "linear-gradient(135deg, hsla(var(--primary), 0.05), transparent)" }}
          >
            <div className="flex items-center gap-2 mb-2">
              <motion.div className="w-2 h-2 rounded-full bg-primary" animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
              <p className="text-[11px] font-bold text-primary">Full pipeline running for {examType}...</p>
            </div>
            <p className="text-[9px] text-muted-foreground mb-2">This may take 1-3 minutes depending on the number of years and subjects.</p>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(175, 80%, 50%))" }}
                initial={{ width: "2%" }}
                animate={{ width: "95%" }}
                transition={{ duration: 120, ease: "linear" }}
              />
            </div>
          </motion.div>
        )}

        {pipelineResult && !runPipeline.isPending && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="mt-3 rounded-2xl p-4 bg-emerald-500/5 border border-emerald-500/15"
          >
            <div className="flex items-center gap-2 mb-1">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", bounce: 0.6 }}>
                <Check className="w-5 h-5 text-emerald-400" />
              </motion.div>
              <p className="text-sm font-black text-emerald-400">Pipeline Complete!</p>
            </div>
            <p className="text-[10px] text-muted-foreground">
              {examType} • {(pipelineResult.duration_ms / 1000).toFixed(1)}s total •
              {pipelineResult.steps?.filter((s: any) => s.status === "completed").length}/{pipelineResult.steps?.length} steps succeeded
            </p>
          </motion.div>
        )}
      </GlassCard>
    </div>
  );
}

// =============================================
// SYLLABUS PARSER
// =============================================
function SyllabusParser({ examType }: { examType: string }) {
  const [text, setText] = useState("");
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [editingItem, setEditingItem] = useState<any>(null);
  const [editForm, setEditForm] = useState({ subject: "", topic: "", subtopic: "", weightage_pct: "" });
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);
  const qc = useQueryClient();

  const availableSubjects = STQ_EXAM_SUBJECTS[examType] || [];

  const autoGenerate = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "auto_generate_syllabus", exam_type: examType, subjects: selectedSubjects },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`🎉 Generated ${d.count} taxonomy items across ${Object.keys(d.subjects || {}).length} subjects`);
      qc.invalidateQueries({ queryKey: ["stq-taxonomy"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const parse = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Enter syllabus text");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "parse_syllabus", exam_type: examType, syllabus_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Parsed ${d.count} taxonomy items`); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); setText(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteItems = useMutation({
    mutationFn: async (ids: string[]) => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_taxonomy", ids },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Items deleted"); setSelectedIds(new Set()); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_taxonomy", exam_type: examType, delete_all: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success(`All ${examType} taxonomy cleared`); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const updateItem = useMutation({
    mutationFn: async () => {
      if (!editingItem) throw new Error("No item selected");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: {
          action: "update_taxonomy", id: editingItem.id,
          updates: { subject: editForm.subject, topic: editForm.topic, subtopic: editForm.subtopic || null, weightage_pct: editForm.weightage_pct ? parseFloat(editForm.weightage_pct) : null },
        },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Item updated"); setEditingItem(null); qc.invalidateQueries({ queryKey: ["stq-taxonomy"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: taxonomy, isLoading } = useQuery({
    queryKey: ["stq-taxonomy", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("syllabus_taxonomies").select("*").eq("exam_type", examType).order("subject").order("topic");
      return data || [];
    },
  });

  const subjects = useMemo(() => {
    const s = new Set((taxonomy || []).map((t: any) => t.subject));
    return ["all", ...Array.from(s)];
  }, [taxonomy]);

  const filtered = useMemo(() => {
    let items = taxonomy || [];
    if (subjectFilter !== "all") items = items.filter((t: any) => t.subject === subjectFilter);
    if (search) {
      const q = search.toLowerCase();
      items = items.filter((t: any) => t.topic?.toLowerCase().includes(q) || t.subtopic?.toLowerCase().includes(q) || t.subject?.toLowerCase().includes(q));
    }
    return items;
  }, [taxonomy, subjectFilter, search]);

  const subjectStats = useMemo(() => {
    const stats: Record<string, { count: number; avgWeight: number }> = {};
    (taxonomy || []).forEach((t: any) => {
      if (!stats[t.subject]) stats[t.subject] = { count: 0, avgWeight: 0 };
      stats[t.subject].count++;
      if (t.weightage_pct) stats[t.subject].avgWeight += t.weightage_pct;
    });
    Object.values(stats).forEach(s => { if (s.count) s.avgWeight = Math.round(s.avgWeight / s.count * 10) / 10; });
    return stats;
  }, [taxonomy]);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };
  const toggleSelectAll = () => {
    if (selectedIds.size === filtered.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(filtered.map((t: any) => t.id)));
  };
  const startEdit = (item: any) => {
    setEditingItem(item);
    setEditForm({ subject: item.subject, topic: item.topic, subtopic: item.subtopic || "", weightage_pct: item.weightage_pct?.toString() || "" });
  };
  const exportCSV = () => {
    const rows = (taxonomy || []).map((t: any) => `${t.subject},${t.topic},${t.subtopic || ""},${t.hierarchy_level},${t.weightage_pct || ""},${t.source}`);
    const csv = "Subject,Topic,Subtopic,Level,Weightage%,Source\n" + rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `${examType}_syllabus_taxonomy.csv`; a.click();
    URL.revokeObjectURL(url); toast.success("Exported CSV");
  };
  const toggleSubject = (s: string) => {
    setSelectedSubjects(prev => prev.includes(s) ? prev.filter(x => x !== s) : [...prev, s]);
  };

  return (
    <div className="space-y-5">
      {/* Mode Toggle */}
      <div className="flex gap-1 p-1 rounded-2xl border border-border/30" style={{ background: "hsla(var(--secondary), 0.3)" }}>
        <button onClick={() => setMode("auto")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${mode === "auto" ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm border border-primary/15" : "text-muted-foreground"}`}>
          <Sparkles className="w-3.5 h-3.5" /> Auto Generate with AI
        </button>
        <button onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${mode === "manual" ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm border border-primary/15" : "text-muted-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> Manual Input
        </button>
      </div>

      {mode === "auto" && (
        <GlassCard title="AI Auto Syllabus Generation" subtitle={`Generate complete taxonomy for ${examType}`} icon={Sparkles} iconGradient="from-violet-500 to-purple-500">
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-foreground mb-1.5">Select Subjects (optional — leave empty for all):</p>
            <div className="flex flex-wrap gap-1.5">
              {(availableSubjects.length > 0 ? availableSubjects : ["General"]).map((s: string) => (
                <button key={s} onClick={() => toggleSubject(s)}
                  className={`flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-[11px] font-medium transition-all border ${
                    selectedSubjects.includes(s) ? "bg-primary/15 border-primary/30 text-primary" : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                  }`}>
                  {selectedSubjects.includes(s) ? <CheckSquare className="w-3 h-3" /> : <Square className="w-3 h-3" />}
                  {s}
                </button>
              ))}
            </div>
          </div>
          <motion.button onClick={() => autoGenerate.mutate()} disabled={autoGenerate.isPending}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-xs font-black disabled:opacity-50 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(270, 80%, 55%), hsl(250, 90%, 60%))", color: "white", boxShadow: "0 4px 20px hsla(270, 80%, 55%, 0.3)" }}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          >
            {autoGenerate.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Generating Full Syllabus with AI...</> : <><GraduationCap className="w-4 h-4" /> Generate Complete {examType} Syllabus</>}
          </motion.button>
          {autoGenerate.isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl p-3 bg-violet-500/5 border border-violet-500/15 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <motion.div className="w-2 h-2 rounded-full bg-violet-500" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                <p className="text-[10px] font-bold text-violet-400">AI is analyzing {examType} exam patterns...</p>
              </div>
              <div className="space-y-1 text-[9px] text-muted-foreground">
                <p>• Extracting complete subject hierarchy</p>
                <p>• Mapping all topics & subtopics</p>
                <p>• Calculating weightages from historical data</p>
                <p>• Assigning importance ratings</p>
              </div>
              <div className="mt-2 h-1.5 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, hsl(270, 80%, 55%), hsl(250, 90%, 60%))" }} initial={{ width: "5%" }} animate={{ width: "90%" }} transition={{ duration: 45, ease: "linear" }} />
              </div>
            </motion.div>
          )}
        </GlassCard>
      )}

      {mode === "manual" && (
        <GlassCard title="Parse Syllabus Text" subtitle="Paste raw syllabus text for AI parsing" icon={Upload} iconGradient="from-blue-500 to-cyan-500">
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={`Paste ${examType} syllabus text here...\n\nExample:\nPhysics:\n- Mechanics: Kinematics, Laws of Motion\n- Electrodynamics: Current Electricity, Magnetism`}
            className="w-full h-40 p-3 rounded-xl bg-background/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground resize-none focus:ring-2 focus:ring-primary/20 focus:border-primary/30 transition-all" />
          <motion.button onClick={() => parse.mutate()} disabled={parse.isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 mt-2"
            style={{ background: "linear-gradient(135deg, hsl(200, 80%, 50%), hsl(175, 80%, 50%))", color: "white" }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          >
            {parse.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Brain className="w-3.5 h-3.5" />}
            {parse.isPending ? "AI Parsing..." : "Parse & Extract Topics"}
          </motion.button>
        </GlassCard>
      )}

      {/* Taxonomy Browser */}
      {!isLoading && (taxonomy || []).length > 0 && (
        <GlassCard title={`📚 Taxonomy Browser (${(taxonomy || []).length} items)`} subtitle="Search, filter, edit and manage taxonomy" icon={BookOpen} iconGradient="from-emerald-500 to-green-500">
          {/* Toolbar */}
          <div className="flex flex-wrap gap-2 mb-3">
            <div className="relative flex-1 min-w-[120px]">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50" />
              <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search topics..."
                className="w-full pl-8 pr-3 py-2 rounded-xl bg-background/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-primary/20" />
            </div>
            <select value={subjectFilter} onChange={e => setSubjectFilter(e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-background/50 border border-border/30 text-xs text-foreground">
              {subjects.map((s: string) => <option key={s} value={s}>{s === "all" ? "All Subjects" : s}</option>)}
            </select>
            <button onClick={exportCSV} className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-secondary/50 text-muted-foreground text-[10px] font-medium hover:bg-secondary transition-all">
              <Download className="w-3 h-3" /> CSV
            </button>
            {selectedIds.size > 0 && (
              <button onClick={() => deleteItems.mutate(Array.from(selectedIds))} disabled={deleteItems.isPending}
                className="flex items-center gap-1 px-2.5 py-2 rounded-xl bg-destructive/10 text-destructive text-[10px] font-medium hover:bg-destructive/20 transition-all">
                <Trash2 className="w-3 h-3" /> Delete {selectedIds.size}
              </button>
            )}
          </div>

          {/* Subject Stats */}
          {Object.keys(subjectStats).length > 1 && (
            <div className="flex gap-2 flex-wrap mb-3">
              {Object.entries(subjectStats).map(([sub, st]) => (
                <div key={sub} className="px-2.5 py-1.5 rounded-xl bg-secondary/30 border border-border/20 text-[10px]">
                  <span className="font-semibold text-foreground">{sub}</span>
                  <span className="text-muted-foreground ml-1">({st.count})</span>
                </div>
              ))}
            </div>
          )}

          {/* Items List */}
          <div className="space-y-1 max-h-[400px] overflow-y-auto scrollbar-thin">
            <button onClick={toggleSelectAll} className="text-[10px] text-primary hover:underline font-medium mb-1">
              {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
            </button>
            {filtered.map((item: any) => (
              <motion.div key={item.id} layout className="flex items-center gap-2 p-2.5 rounded-xl bg-background/30 hover:bg-background/50 transition-all text-xs group">
                <button onClick={() => toggleSelect(item.id)}>
                  {selectedIds.has(item.id) ? <CheckSquare className="w-3.5 h-3.5 text-primary" /> : <Square className="w-3.5 h-3.5 text-muted-foreground/40" />}
                </button>
                <div className="flex-1 min-w-0">
                  <p className="text-foreground font-medium truncate">{item.topic}</p>
                  <p className="text-[10px] text-muted-foreground truncate">{item.subject} {item.subtopic ? `• ${item.subtopic}` : ""}</p>
                </div>
                {item.weightage_pct && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold tabular-nums">{item.weightage_pct}%</span>
                )}
                <button onClick={() => startEdit(item)} className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-secondary">
                  <Pencil className="w-3 h-3 text-muted-foreground" />
                </button>
              </motion.div>
            ))}
          </div>

          {/* Delete All */}
          <button onClick={() => { if (confirm(`Delete ALL ${examType} taxonomy?`)) deleteAll.mutate(); }}
            disabled={deleteAll.isPending}
            className="flex items-center justify-center gap-1 w-full mt-3 px-3 py-2 rounded-xl text-[10px] text-destructive/60 hover:text-destructive border border-destructive/10 hover:border-destructive/30 transition-colors">
            <Trash2 className="w-3 h-3" /> Clear All Taxonomy
          </button>
        </GlassCard>
      )}

      {/* Edit Modal */}
      <AnimatePresence>
        {editingItem && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setEditingItem(null)}>
            <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9, y: 20 }}
              className="w-full max-w-md rounded-2xl p-5 border border-border/50" style={{ background: "hsl(var(--card))" }} onClick={e => e.stopPropagation()}>
              <h4 className="text-sm font-bold text-foreground mb-3">Edit Taxonomy Item</h4>
              <div className="space-y-2">
                {(["subject", "topic", "subtopic", "weightage_pct"] as const).map(f => (
                  <div key={f}>
                    <label className="text-[10px] text-muted-foreground font-medium capitalize">{f.replace("_", " ")}</label>
                    <input value={editForm[f]} onChange={e => setEditForm(p => ({ ...p, [f]: e.target.value }))}
                      className="w-full px-3 py-2 rounded-xl bg-background border border-border text-xs text-foreground mt-0.5" />
                  </div>
                ))}
              </div>
              <div className="flex gap-2 mt-4">
                <button onClick={() => updateItem.mutate()} disabled={updateItem.isPending}
                  className="flex-1 px-3 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold disabled:opacity-50">
                  {updateItem.isPending ? "Saving..." : "Save Changes"}
                </button>
                <button onClick={() => setEditingItem(null)} className="px-3 py-2 rounded-xl bg-secondary text-muted-foreground text-xs font-medium">Cancel</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty State */}
      {!isLoading && (taxonomy || []).length === 0 && (
        <EmptyState icon={Layers} message="No taxonomy items yet" hint="Use AI Auto Generate or paste syllabus text to populate" />
      )}
    </div>
  );
}

// =============================================
// QUESTION MINING
// =============================================
function QuestionMining({ examType }: { examType: string }) {
  const [text, setText] = useState("");
  const [year, setYear] = useState(2024);
  const [mode, setMode] = useState<"auto" | "manual">("auto");
  const [selectedYears, setSelectedYears] = useState<number[]>([2024, 2023, 2022, 2021, 2020]);
  const [autoProgress, setAutoProgress] = useState<{ running: boolean; current: string; completed: string[] }>({ running: false, current: "", completed: [] });
  const qc = useQueryClient();
  const allYears = [2024, 2023, 2022, 2021, 2020, 2019, 2018, 2017, 2016, 2015];
  const availableSubjects = STQ_EXAM_SUBJECTS[examType] || [];

  const autoMine = useMutation({
    mutationFn: async () => {
      setAutoProgress({ running: true, current: "Starting...", completed: [] });
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "auto_mine_questions", exam_type: examType, years: selectedYears },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      setAutoProgress(prev => ({ ...prev, running: false }));
      toast.success(`⛏️ Mined ${d.total_mined} questions across ${selectedYears.length} years`);
      qc.invalidateQueries({ queryKey: ["stq-mining"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => { setAutoProgress(prev => ({ ...prev, running: false })); toast.error(e.message); },
  });

  const mine = useMutation({
    mutationFn: async () => {
      if (!text.trim()) throw new Error("Enter question paper text");
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "mine_questions", exam_type: examType, year, questions_text: text },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => { toast.success(`Mined ${d.count} questions`); qc.invalidateQueries({ queryKey: ["stq-mining"] }); setText(""); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteYear = useMutation({
    mutationFn: async (y: number) => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_mining", exam_type: examType, year: y },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("Year data deleted"); qc.invalidateQueries({ queryKey: ["stq-mining"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteAll = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "delete_mining", exam_type: examType, delete_all: true },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: () => { toast.success("All mining data cleared"); qc.invalidateQueries({ queryKey: ["stq-mining"] }); },
    onError: (e: any) => toast.error(e.message),
  });

  const { data: stats, isLoading } = useQuery({
    queryKey: ["stq-mining", examType],
    queryFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "get_mining_stats", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
  });

  const toggleYear = (y: number) => {
    setSelectedYears(prev => prev.includes(y) ? prev.filter(x => x !== y) : [...prev, y]);
  };

  return (
    <div className="space-y-5">
      {/* Mode Toggle */}
      <div className="flex gap-1 p-1 rounded-2xl border border-border/30" style={{ background: "hsla(var(--secondary), 0.3)" }}>
        <button onClick={() => setMode("auto")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${mode === "auto" ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm border border-primary/15" : "text-muted-foreground"}`}>
          <Sparkles className="w-3.5 h-3.5" /> Auto Mine with AI
        </button>
        <button onClick={() => setMode("manual")}
          className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-all ${mode === "manual" ? "bg-gradient-to-r from-primary/20 to-primary/10 text-primary shadow-sm border border-primary/15" : "text-muted-foreground"}`}>
          <Upload className="w-3.5 h-3.5" /> Manual Input
        </button>
      </div>

      {mode === "auto" && (
        <GlassCard title="AI Auto Question Mining" subtitle={`Mine historical exam patterns for ${examType}`} icon={Sparkles} iconGradient="from-emerald-500 to-green-500">
          <div className="mb-3">
            <p className="text-[10px] font-semibold text-foreground mb-1.5">Select Years to Mine:</p>
            <div className="flex flex-wrap gap-1.5">
              {allYears.map(y => (
                <button key={y} onClick={() => toggleYear(y)}
                  className={`px-2.5 py-1.5 rounded-xl text-[10px] font-medium transition-all border ${
                    selectedYears.includes(y) ? "bg-primary/15 border-primary/30 text-primary" : "border-border/40 text-muted-foreground hover:bg-secondary/50"
                  }`}>
                  {y}
                </button>
              ))}
            </div>
            <div className="flex gap-2 mt-1.5">
              <button onClick={() => setSelectedYears(allYears)} className="text-[9px] text-primary hover:underline font-medium">All</button>
              <button onClick={() => setSelectedYears([])} className="text-[9px] text-muted-foreground hover:underline">Clear</button>
              <button onClick={() => setSelectedYears([2024, 2023, 2022, 2021, 2020])} className="text-[9px] text-muted-foreground hover:underline">Last 5</button>
            </div>
          </div>

          {availableSubjects.length > 0 && (
            <div className="rounded-xl p-2.5 bg-secondary/20 border border-border/20 mb-3 text-[10px] text-muted-foreground">
              Mining: <span className="text-foreground font-medium">{availableSubjects.join(", ")}</span>
              <span className="block text-[9px] mt-0.5">~{selectedYears.length * availableSubjects.length * 10} questions estimated</span>
            </div>
          )}

          <motion.button onClick={() => autoMine.mutate()} disabled={autoMine.isPending || !selectedYears.length}
            className="w-full flex items-center justify-center gap-2 px-4 py-3.5 rounded-2xl text-xs font-black disabled:opacity-50 relative overflow-hidden"
            style={{ background: "linear-gradient(135deg, hsl(155, 80%, 45%), hsl(175, 80%, 50%))", color: "white", boxShadow: "0 4px 20px hsla(155, 80%, 45%, 0.3)" }}
            whileHover={{ scale: 1.01 }} whileTap={{ scale: 0.99 }}
          >
            {autoMine.isPending ? <><Loader2 className="w-4 h-4 animate-spin" /> Mining Questions with AI...</> : <><Zap className="w-4 h-4" /> Mine {selectedYears.length} Years of {examType}</>}
          </motion.button>

          {autoMine.isPending && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl p-3 bg-emerald-500/5 border border-emerald-500/15 mt-3">
              <div className="flex items-center gap-2 mb-2">
                <motion.div className="w-2 h-2 rounded-full bg-emerald-500" animate={{ scale: [1, 1.5, 1] }} transition={{ duration: 1, repeat: Infinity }} />
                <p className="text-[10px] font-bold text-emerald-400">AI is mining {examType} question patterns...</p>
              </div>
              <div className="h-1.5 rounded-full bg-secondary overflow-hidden mt-2">
                <motion.div className="h-full rounded-full" style={{ background: "linear-gradient(90deg, hsl(155, 80%, 45%), hsl(175, 80%, 50%))" }} initial={{ width: "5%" }} animate={{ width: "85%" }} transition={{ duration: 30, ease: "linear" }} />
              </div>
            </motion.div>
          )}
        </GlassCard>
      )}

      {mode === "manual" && (
        <GlassCard title="Mine from Question Paper" subtitle="Paste exam questions for AI classification" icon={Database} iconGradient="from-blue-500 to-cyan-500">
          <div className="flex gap-2 mb-2">
            <select value={year} onChange={e => setYear(+e.target.value)}
              className="px-2.5 py-2 rounded-xl bg-background/50 border border-border/30 text-xs text-foreground">
              {allYears.map(y => <option key={y}>{y}</option>)}
            </select>
            <span className="text-xs text-muted-foreground self-center">Paper Year</span>
          </div>
          <textarea value={text} onChange={e => setText(e.target.value)}
            placeholder={`Paste ${examType} ${year} exam questions here...`}
            className="w-full h-40 p-3 rounded-xl bg-background/50 border border-border/30 text-xs text-foreground placeholder:text-muted-foreground resize-none" />
          <motion.button onClick={() => mine.mutate()} disabled={mine.isPending}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold disabled:opacity-50 mt-2"
            style={{ background: "linear-gradient(135deg, hsl(200, 80%, 50%), hsl(175, 80%, 50%))", color: "white" }}
            whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          >
            {mine.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
            {mine.isPending ? "AI Mining..." : "Mine & Classify"}
          </motion.button>
        </GlassCard>
      )}

      {/* Stats Dashboard */}
      {!isLoading && stats && stats.total > 0 && (
        <>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Total Mined", value: stats.total, gradient: "from-blue-500 to-cyan-500" },
              { label: "Years Covered", value: Object.keys(stats.by_year || {}).length, gradient: "from-violet-500 to-purple-500" },
              { label: "Subjects", value: Object.keys(stats.by_subject || {}).length, gradient: "from-emerald-500 to-green-500" },
            ].map((s, i) => (
              <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08 }}
                className="rounded-2xl p-3 border border-border/30 text-center" style={{ background: "hsl(var(--card))" }}>
                <p className="text-xl font-black text-foreground tabular-nums"><AnimatedCounter value={s.value} /></p>
                <p className="text-[10px] text-muted-foreground font-medium">{s.label}</p>
              </motion.div>
            ))}
          </div>

          <GlassCard title="Questions by Year" subtitle="Distribution across exam years" icon={BarChart3} iconGradient="from-sky-500 to-blue-500">
            <div className="space-y-2">
              {Object.entries(stats.by_year || {}).sort(([a], [b]) => +b - +a).map(([y, count]: [string, any]) => (
                <div key={y} className="flex items-center gap-2 group">
                  <span className="text-xs font-bold text-foreground w-10 tabular-nums">{y}</span>
                  <div className="flex-1 h-6 rounded-xl bg-secondary/30 overflow-hidden">
                    <motion.div className="h-full rounded-xl" style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(175, 80%, 50%))" }}
                      initial={{ width: 0 }} animate={{ width: `${Math.min(100, (count / Math.max(...Object.values(stats.by_year as Record<string, number>))) * 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }} />
                  </div>
                  <span className="text-[10px] text-muted-foreground w-8 text-right tabular-nums font-medium">{count}</span>
                  <button onClick={() => { if (confirm(`Delete all ${examType} ${y} mining data?`)) deleteYear.mutate(+y); }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-lg hover:bg-destructive/10">
                    <Trash2 className="w-3 h-3 text-destructive/50 hover:text-destructive" />
                  </button>
                </div>
              ))}
            </div>
          </GlassCard>

          {Object.keys(stats.by_subject || {}).length > 0 && (
            <GlassCard title="Questions by Subject" subtitle="Subject-wise distribution" icon={Layers} iconGradient="from-violet-500 to-purple-500">
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(stats.by_subject || {}).map(([subject, count]: [string, any], i) => (
                  <motion.div key={subject} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: i * 0.05 }}
                    className="rounded-xl p-2.5 bg-background/40 border border-border/20">
                    <p className="text-sm font-black text-foreground tabular-nums"><AnimatedCounter value={count} /></p>
                    <p className="text-[10px] text-muted-foreground truncate">{subject}</p>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          )}

          {Object.keys(stats.by_difficulty || {}).length > 0 && (
            <GlassCard title="Difficulty Distribution" subtitle="Question difficulty breakdown" icon={Target} iconGradient="from-rose-500 to-pink-500">
              <div className="flex gap-2">
                {Object.entries(stats.by_difficulty || {}).map(([diff, count]: [string, any]) => {
                  const colors: Record<string, { bg: string; text: string; glow: string }> = {
                    easy: { bg: "bg-emerald-500/10", text: "text-emerald-400", glow: "shadow-emerald-500/10" },
                    medium: { bg: "bg-amber-500/10", text: "text-amber-400", glow: "shadow-amber-500/10" },
                    hard: { bg: "bg-red-500/10", text: "text-red-400", glow: "shadow-red-500/10" },
                    very_hard: { bg: "bg-purple-500/10", text: "text-purple-400", glow: "shadow-purple-500/10" },
                  };
                  const c = colors[diff] || colors.medium;
                  return (
                    <div key={diff} className={`flex-1 rounded-xl p-2.5 text-center ${c.bg} border border-border/20 ${c.glow} shadow-lg`}>
                      <p className={`text-sm font-black ${c.text}`}>{count}</p>
                      <p className={`text-[9px] capitalize ${c.text} opacity-70`}>{diff.replace("_", " ")}</p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          )}

          {stats.top_topics?.length > 0 && (
            <GlassCard title="Most Frequent Topics" subtitle="Topics appearing most across years" icon={TrendingUp} iconGradient="from-amber-500 to-orange-500">
              <div className="space-y-1 max-h-48 overflow-y-auto scrollbar-thin">
                {stats.top_topics.map((t: any, i: number) => (
                  <motion.div key={t.topic} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-2 p-2 rounded-xl bg-background/30 text-xs">
                    <span className="w-5 h-5 rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 flex items-center justify-center text-[9px] font-black text-primary">{i + 1}</span>
                    <span className="flex-1 text-foreground truncate font-medium">{t.topic}</span>
                    <span className="text-muted-foreground tabular-nums">{t.count}×</span>
                  </motion.div>
                ))}
              </div>
            </GlassCard>
          )}

          <button onClick={() => { if (confirm(`Delete ALL ${examType} mining data?`)) deleteAll.mutate(); }}
            disabled={deleteAll.isPending}
            className="flex items-center justify-center gap-1 w-full px-3 py-2.5 rounded-xl text-[10px] text-destructive/60 hover:text-destructive border border-destructive/10 hover:border-destructive/30 transition-colors">
            <Trash2 className="w-3 h-3" /> Clear All Mining Data
          </button>
        </>
      )}

      {!isLoading && (!stats || stats.total === 0) && (
        <EmptyState icon={Database} message="No questions mined yet" hint="Use AI Auto Mine or paste question papers to populate" />
      )}
    </div>
  );
}

// =============================================
// TPI SCORES
// =============================================
function TPIScores({ examType }: { examType: string }) {
  const qc = useQueryClient();

  const { data: tpiScores, isLoading } = useQuery({
    queryKey: ["stq-tpi", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("topic_probability_index")
        .select("*").eq("exam_type", examType).order("tpi_score", { ascending: false }).limit(50);
      return data || [];
    },
  });

  const computeTPI = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "compute_tpi", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Computed TPI for ${d.topics_computed} topics`);
      qc.invalidateQueries({ queryKey: ["stq-tpi"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Topic Probability Index</h4>
          <p className="text-[10px] text-muted-foreground">AI-computed probability of topic appearing in next exam</p>
        </div>
        <motion.button onClick={() => computeTPI.mutate()} disabled={computeTPI.isPending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, hsla(var(--primary), 0.15), hsla(var(--primary), 0.05))", color: "hsl(var(--primary))", border: "1px solid hsla(var(--primary), 0.2)" }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        >
          {computeTPI.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          Recompute TPI
        </motion.button>
      </div>

      {isLoading ? <LoadingState /> : tpiScores?.length === 0 ? (
        <EmptyState icon={Target} message="No TPI data yet" hint="Mine questions first, then compute TPI" />
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto scrollbar-thin">
          {tpiScores?.map((t: any, i: number) => (
            <motion.div key={t.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.03 }}
              className="rounded-2xl p-3.5 border border-border/30 hover:border-border/50 transition-all"
              style={{ background: "hsl(var(--card))" }}
            >
              <div className="flex items-center gap-2.5 mb-2.5">
                <TPIBadge score={t.tpi_score} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{t.topic}</p>
                  <p className="text-[10px] text-muted-foreground">{t.subject}</p>
                </div>
                <span className="text-[10px] text-muted-foreground tabular-nums">{t.confidence?.toFixed(0)}% conf</span>
              </div>
              {/* Score Breakdown */}
              <div className="grid grid-cols-5 gap-1.5">
                {[
                  { label: "Freq", value: t.frequency_score, color: "hsl(200, 80%, 55%)" },
                  { label: "Recent", value: t.recency_score, color: "hsl(155, 80%, 50%)" },
                  { label: "Trend", value: t.trend_momentum_score, color: "hsl(30, 90%, 55%)" },
                  { label: "Volatile", value: t.volatility_score, color: "hsl(330, 80%, 55%)" },
                  { label: "Diff", value: t.difficulty_score, color: "hsl(270, 80%, 60%)" },
                ].map(s => (
                  <div key={s.label} className="text-center">
                    <div className="h-1.5 rounded-full bg-secondary/50 overflow-hidden mb-0.5">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ background: s.color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${s.value || 0}%` }}
                        transition={{ duration: 0.8, delay: 0.2 }}
                      />
                    </div>
                    <p className="text-[8px] text-muted-foreground/60">{s.label}</p>
                  </div>
                ))}
              </div>
              {t.appearance_years?.length > 0 && (
                <p className="text-[9px] text-muted-foreground mt-2">
                  Years: {t.appearance_years.join(", ")} · {t.data_points_used} data points
                </p>
              )}
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// PATTERN EVOLUTION
// =============================================
function PatternEvolution({ examType }: { examType: string }) {
  const qc = useQueryClient();

  const { data: patterns, isLoading } = useQuery({
    queryKey: ["stq-patterns", examType],
    queryFn: async () => {
      const { data } = await (supabase as any).from("pattern_evolution_logs")
        .select("*").eq("exam_type", examType).order("detected_at", { ascending: false }).limit(30);
      return data || [];
    },
  });

  const detectPatterns = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "detect_patterns", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Detected ${d.detections_count} patterns`);
      qc.invalidateQueries({ queryKey: ["stq-patterns"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  const severityStyles: Record<string, { bg: string; text: string; border: string; icon: string }> = {
    high: { bg: "bg-red-500/5", text: "text-red-400", border: "border-red-500/15", icon: "🔴" },
    moderate: { bg: "bg-amber-500/5", text: "text-amber-400", border: "border-amber-500/15", icon: "🟡" },
    low: { bg: "bg-emerald-500/5", text: "text-emerald-400", border: "border-emerald-500/15", icon: "🟢" },
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Pattern Evolution Detection</h4>
          <p className="text-[10px] text-muted-foreground">AI-detected shifts in exam question patterns</p>
        </div>
        <motion.button onClick={() => detectPatterns.mutate()} disabled={detectPatterns.isPending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, hsla(30, 90%, 55%, 0.15), hsla(30, 90%, 55%, 0.05))", color: "hsl(30, 90%, 55%)", border: "1px solid hsla(30, 90%, 55%, 0.2)" }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        >
          {detectPatterns.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <AlertTriangle className="w-3.5 h-3.5" />}
          Run Detection
        </motion.button>
      </div>

      {isLoading ? <LoadingState /> : patterns?.length === 0 ? (
        <EmptyState icon={TrendingUp} message="No patterns detected yet" hint="Mine questions and run detection to find trends" />
      ) : (
        <div className="space-y-2">
          {patterns?.map((p: any, i: number) => {
            const style = severityStyles[p.severity] || severityStyles.moderate;
            return (
              <motion.div key={p.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                className={`rounded-2xl p-3.5 ${style.bg} border ${style.border}`}
              >
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-xs">{style.icon}</span>
                  <span className={`px-2 py-0.5 rounded-lg text-[10px] font-bold ${style.text} bg-current/10`}>
                    {p.severity}
                  </span>
                  <span className="text-[10px] text-muted-foreground capitalize">{p.detection_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-xs text-foreground font-medium">{p.description}</p>
                {p.recommendation && <p className="text-[10px] text-primary mt-1.5 font-medium">💡 {p.recommendation}</p>}
                {p.affected_topics?.length > 0 && (
                  <p className="text-[9px] text-muted-foreground mt-1">Topics: {p.affected_topics.join(", ")}</p>
                )}
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================
// MODEL TRAINING
// =============================================
function ModelTraining({ examType }: { examType: string }) {
  const qc = useQueryClient();

  const { data: logs, isLoading } = useQuery({
    queryKey: ["stq-training-logs"],
    queryFn: async () => {
      const { data } = await (supabase as any).from("stq_training_logs")
        .select("*").order("created_at", { ascending: false }).limit(15);
      return data || [];
    },
  });

  const retrain = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase.functions.invoke("stq-engine", {
        body: { action: "retrain", exam_type: examType },
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (d) => {
      toast.success(`Model ${d.model_version} trained on ${d.data_points} data points (${d.duration_ms}ms)`);
      qc.invalidateQueries({ queryKey: ["stq-training-logs"] });
      qc.invalidateQueries({ queryKey: ["stq-dashboard"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-bold text-foreground">Model Training</h4>
          <p className="text-[10px] text-muted-foreground">12-factor ensemble model training & history</p>
        </div>
        <motion.button onClick={() => retrain.mutate()} disabled={retrain.isPending}
          className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-[11px] font-bold disabled:opacity-50 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsla(15, 100%, 55%, 0.15), hsla(15, 100%, 55%, 0.05))", color: "hsl(15, 100%, 55%)", border: "1px solid hsla(15, 100%, 55%, 0.2)" }}
          whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        >
          {retrain.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
          {retrain.isPending ? "Training..." : `Retrain (${examType})`}
        </motion.button>
      </div>

      {isLoading ? <LoadingState /> : logs?.length === 0 ? (
        <EmptyState icon={RefreshCw} message="No training history yet" hint="Run model training to see history" />
      ) : (
        <div className="space-y-2">
          {logs?.map((l: any, i: number) => (
            <motion.div key={l.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-2xl p-4 border border-border/30"
              style={{ background: "hsl(var(--card))" }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-xl flex items-center justify-center ${
                    l.status === "completed" ? "bg-emerald-500/15" : "bg-destructive/15"
                  }`}>
                    {l.status === "completed" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <X className="w-3.5 h-3.5 text-destructive" />}
                  </div>
                  <span className="text-xs font-black text-foreground">{l.model_version}</span>
                </div>
                <span className={`text-[10px] px-2 py-0.5 rounded-lg font-bold ${
                  l.status === "completed" ? "bg-emerald-500/10 text-emerald-400" : "bg-destructive/10 text-destructive"
                }`}>{l.status}</span>
              </div>
              <div className="grid grid-cols-3 gap-3 text-[10px]">
                <div className="rounded-xl p-2 bg-background/40 text-center">
                  <p className="font-bold text-foreground tabular-nums">{l.data_points_processed}</p>
                  <p className="text-muted-foreground">Data Points</p>
                </div>
                <div className="rounded-xl p-2 bg-background/40 text-center">
                  <p className="font-bold text-foreground tabular-nums">{l.duration_ms}ms</p>
                  <p className="text-muted-foreground">Duration</p>
                </div>
                <div className="rounded-xl p-2 bg-background/40 text-center">
                  <p className="font-bold text-foreground tabular-nums">{l.exam_types_trained?.join(", ")}</p>
                  <p className="text-muted-foreground">Exam</p>
                </div>
              </div>
              {l.accuracy_before != null && l.accuracy_after != null && (
                <div className="flex items-center gap-2 mt-2 text-[10px]">
                  <span className="text-muted-foreground">Confidence:</span>
                  <span className="text-muted-foreground tabular-nums">{l.accuracy_before?.toFixed(1)}%</span>
                  <span className="text-primary">→</span>
                  <span className="text-primary font-bold tabular-nums">{l.accuracy_after?.toFixed(1)}%</span>
                  {l.accuracy_after > l.accuracy_before && (
                    <motion.span
                      className="text-emerald-400 font-bold"
                      initial={{ opacity: 0, scale: 0 }}
                      animate={{ opacity: 1, scale: 1 }}
                    >
                      ↑ {(l.accuracy_after - l.accuracy_before).toFixed(1)}%
                    </motion.span>
                  )}
                </div>
              )}
              <p className="text-[9px] text-muted-foreground/50 mt-2">
                {new Date(l.created_at).toLocaleString()} • {l.triggered_by}
              </p>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// =============================================
// SHARED COMPONENTS
// =============================================
function GlassCard({ title, subtitle, icon: Icon, iconGradient = "from-primary to-primary/60", children }: {
  title: string; subtitle?: string; icon: any; iconGradient?: string; children: React.ReactNode
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl p-4 space-y-3 border border-border/30 relative overflow-hidden"
      style={{ background: "hsl(var(--card))" }}
    >
      <div className="flex items-center gap-2.5">
        <div className={`w-8 h-8 rounded-xl bg-gradient-to-br ${iconGradient} flex items-center justify-center shrink-0`}>
          <Icon className="w-4 h-4 text-white" />
        </div>
        <div>
          <h4 className="text-xs font-bold text-foreground">{title}</h4>
          {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
        </div>
      </div>
      {children}
    </motion.div>
  );
}

function TPIBadge({ score }: { score: number }) {
  const config = score >= 85
    ? { bg: "from-red-500 to-rose-500", glow: "shadow-red-500/20", text: "text-white" }
    : score >= 60
    ? { bg: "from-orange-500 to-amber-500", glow: "shadow-orange-500/20", text: "text-white" }
    : score >= 40
    ? { bg: "from-yellow-500 to-amber-400", glow: "shadow-yellow-500/20", text: "text-white" }
    : { bg: "from-emerald-500 to-green-500", glow: "shadow-emerald-500/20", text: "text-white" };

  return (
    <span className={`px-2 py-0.5 rounded-lg text-[10px] font-black tabular-nums bg-gradient-to-r ${config.bg} ${config.text} shadow-lg ${config.glow}`}>
      {score?.toFixed(0)}
    </span>
  );
}

function EmptyState({ icon: Icon, message, hint }: { icon: any; message: string; hint: string }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="text-center py-12 space-y-3"
    >
      <motion.div
        className="w-14 h-14 mx-auto rounded-2xl bg-secondary/30 flex items-center justify-center"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
      >
        <Icon className="w-7 h-7 text-muted-foreground/30" />
      </motion.div>
      <p className="text-sm font-semibold text-muted-foreground/60">{message}</p>
      <p className="text-[10px] text-muted-foreground/40">{hint}</p>
    </motion.div>
  );
}

function LoadingState() {
  return (
    <div className="flex flex-col items-center justify-center py-12 gap-3">
      <motion.div
        className="relative w-12 h-12"
        animate={{ rotate: 360 }}
        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
      >
        <div className="absolute inset-0 rounded-full border-2 border-primary/20" />
        <div className="absolute inset-0 rounded-full border-2 border-transparent border-t-primary" />
      </motion.div>
      <p className="text-[10px] text-muted-foreground animate-pulse">Loading STQ Engine data...</p>
    </div>
  );
}
