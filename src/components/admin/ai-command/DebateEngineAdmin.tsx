import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Swords, Brain, FileText, BarChart3, Plus, Play, Eye,
  ChevronRight, Loader2, CheckCircle2, Lightbulb, Scale,
  Globe, BookOpen, Landmark, TrendingUp, PenTool, Zap,
  Target, Sparkles, Activity, Shield, ArrowRight, Cpu,
  Flame, Award, Clock, Users, Send, Timer, Star,
  AlertTriangle, ThumbsUp, ArrowDown, RotateCcw, BookMarked,
  Wand2, RefreshCw
} from "lucide-react";
import {
  useDebateDashboard, useDebateAnalyses, useDebateAnalysisDetail,
  useGenerateAnalysis, useApplyFrameworks, useEvaluateWriting, useWritingEvaluations,
  useGenerateAITopic, useGenerateAIAnswer
} from "@/hooks/useDebateEngine";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

type Tab = "dashboard" | "analyses" | "detail" | "create" | "writing_lab" | "evaluations" | "eval_detail";

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

const PESTLE_KEYS = ["political", "economic", "social", "technological", "legal", "environmental"];
const PESTLE_COLORS: Record<string, string> = {
  political: "from-red-500 to-rose-500",
  economic: "from-blue-500 to-cyan-500",
  social: "from-purple-500 to-pink-500",
  technological: "from-cyan-500 to-teal-500",
  legal: "from-amber-500 to-yellow-500",
  environmental: "from-emerald-500 to-green-500",
};

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

function OrbitingParticle({ delay = 0, size = 3, radius = 20, color = "bg-primary" }: { delay?: number; size?: number; radius?: number; color?: string }) {
  return (
    <motion.div
      className={`absolute rounded-full ${color}`}
      style={{ width: size, height: size }}
      animate={{ x: [radius, 0, -radius, 0, radius], y: [0, radius, 0, -radius, 0], opacity: [0.3, 0.8, 0.3, 0.8, 0.3] }}
      transition={{ duration: 4, delay, repeat: Infinity, ease: "linear" }}
    />
  );
}

// Score ring component
// Stat card component to avoid hooks-in-loop
function StatCard({ label, value, suffix, icon: Icon, gradient, index }: { label: string; value: number; suffix?: string; icon: any; gradient: string; index: number }) {
  const animatedVal = useAnimatedCount(Math.round(value));
  return (
    <motion.div initial={{ opacity: 0, y: 30, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay: index * 0.1, type: "spring", stiffness: 200 }}
      whileHover={{ y: -4, scale: 1.02 }} className="relative group">
      <div className="relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-5 overflow-hidden hover:border-primary/30 transition-all duration-300">
        <motion.div className={`absolute -top-10 -right-10 w-24 h-24 rounded-full bg-gradient-to-br ${gradient} blur-2xl opacity-0 group-hover:opacity-40 transition-opacity duration-500`} />
        <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center mb-3 shadow-lg`}>
          <Icon className="w-5 h-5 text-white" />
        </div>
        <p className="text-xs text-muted-foreground font-medium mb-1">{label}</p>
        <div className="flex items-baseline gap-1">
          <span className="text-3xl font-black text-foreground tabular-nums">{animatedVal}</span>
          {suffix && <span className="text-sm text-muted-foreground font-bold">{suffix}</span>}
        </div>
        <motion.div className={`absolute bottom-0 left-0 h-0.5 bg-gradient-to-r ${gradient}`} initial={{ width: "0%" }} animate={{ width: "100%" }} transition={{ delay: index * 0.15 + 0.3, duration: 0.8 }} />
      </div>
    </motion.div>
  );
}

function ScoreRing({ score, maxScore = 10, label, color, delay = 0, size = 64 }: { score: number; maxScore?: number; label: string; color: string; delay?: number; size?: number }) {
  const pct = (score / maxScore) * 100;
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }} className="text-center">
      <div className="relative mx-auto mb-2" style={{ width: size, height: size }}>
        <svg viewBox="0 0 36 36" className="-rotate-90" style={{ width: size, height: size }}>
          <circle cx="18" cy="18" r="15.9" fill="none" strokeWidth="2" className="stroke-border" />
          <motion.circle
            cx="18" cy="18" r="15.9" fill="none" strokeWidth="2.5" strokeLinecap="round"
            className={color}
            strokeDasharray="100"
            initial={{ strokeDashoffset: 100 }}
            animate={{ strokeDashoffset: 100 - pct }}
            transition={{ delay: delay + 0.3, duration: 1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-black text-foreground">{score}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold text-muted-foreground">{label}</span>
    </motion.div>
  );
}

// Severity badge
function SeverityBadge({ level }: { level: string }) {
  const cfg: Record<string, string> = {
    high: "bg-red-500/15 text-red-400 border-red-500/20",
    medium: "bg-amber-500/15 text-amber-400 border-amber-500/20",
    low: "bg-emerald-500/15 text-emerald-400 border-emerald-500/20",
  };
  return <span className={`text-[9px] px-2 py-0.5 rounded-full font-bold border ${cfg[level] || cfg.medium}`}>{level?.toUpperCase()}</span>;
}

// PESTLE renderer
function PestleRenderer({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {PESTLE_KEYS.map((key, i) => {
        const item = data[key];
        if (!item) return null;
        return (
          <motion.div key={key} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}
            className="bg-secondary/30 border border-border/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-6 h-6 rounded-lg bg-gradient-to-br ${PESTLE_COLORS[key]} flex items-center justify-center`}>
                <span className="text-[9px] font-black text-white">{key[0].toUpperCase()}</span>
              </div>
              <span className="text-xs font-bold text-foreground capitalize">{key}</span>
              {item.severity && <SeverityBadge level={item.severity} />}
            </div>
            <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{item.impact}</p>
            {item.exam_angle && (
              <div className="flex items-start gap-1.5 bg-primary/5 rounded-lg p-2 border border-primary/10">
                <Target className="w-3 h-3 text-primary mt-0.5 shrink-0" />
                <span className="text-[10px] text-primary/80">{item.exam_angle}</span>
              </div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

// Stakeholder renderer
function StakeholderRenderer({ data }: { data: any }) {
  const stakeholders = data?.stakeholders || [];
  if (!stakeholders.length) return null;
  const influenceColor: Record<string, string> = { high: "border-red-500/30 bg-red-500/5", medium: "border-amber-500/30 bg-amber-500/5", low: "border-emerald-500/30 bg-emerald-500/5" };
  const impactIcon: Record<string, any> = { positive: ThumbsUp, negative: AlertTriangle, neutral: Activity };
  return (
    <div className="space-y-2">
      {stakeholders.map((s: any, i: number) => {
        const ImpIcon = impactIcon[s.impact] || Activity;
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className={`flex items-start gap-3 p-3 rounded-xl border ${influenceColor[s.influence] || influenceColor.medium}`}>
            <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center shrink-0 border border-border">
              <ImpIcon className={`w-4 h-4 ${s.impact === 'positive' ? 'text-emerald-400' : s.impact === 'negative' ? 'text-red-400' : 'text-muted-foreground'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs font-bold text-foreground">{s.name}</span>
                <SeverityBadge level={s.influence} />
              </div>
              <p className="text-[11px] text-muted-foreground leading-relaxed">{s.interest}</p>
              {s.exam_relevance && <p className="text-[10px] text-primary/70 mt-1 italic">📝 {s.exam_relevance}</p>}
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}

// Cost-Benefit renderer
function CostBenefitRenderer({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-red-500/5 border border-red-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <ArrowDown className="w-4 h-4 text-red-400" />
            <span className="text-xs font-bold text-red-400">Costs</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 font-bold ml-auto">{(data.costs || []).length}</span>
          </div>
          <div className="space-y-2">
            {(data.costs || []).map((c: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="bg-card/60 rounded-lg p-2.5 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-foreground">{c.item}</span>
                  {c.magnitude && <SeverityBadge level={c.magnitude} />}
                </div>
                <p className="text-[10px] text-muted-foreground">{c.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
        <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Benefits</span>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 font-bold ml-auto">{(data.benefits || []).length}</span>
          </div>
          <div className="space-y-2">
            {(data.benefits || []).map((b: any, i: number) => (
              <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                className="bg-card/60 rounded-lg p-2.5 border border-border/50">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-foreground">{b.item}</span>
                  {b.magnitude && <SeverityBadge level={b.magnitude} />}
                </div>
                <p className="text-[10px] text-muted-foreground">{b.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
      {data.net_assessment && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-primary">Net Assessment</span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.net_assessment}</p>
          {data.recommendation && <p className="text-xs text-foreground font-medium mt-2">💡 {data.recommendation}</p>}
        </div>
      )}
    </div>
  );
}

// Long vs Short Term renderer
function LongShortTermRenderer({ data }: { data: any }) {
  if (!data) return null;
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[
          { key: "short_term", label: "Short Term", icon: Zap, color: "amber", items: data.short_term || [] },
          { key: "long_term", label: "Long Term", icon: TrendingUp, color: "blue", items: data.long_term || [] },
        ].map((section) => (
          <div key={section.key} className={`bg-${section.color}-500/5 border border-${section.color}-500/20 rounded-xl p-4`}
            style={{ backgroundColor: `hsl(var(--${section.color === 'amber' ? 'warning' : 'primary'}) / 0.05)` }}>
            <div className="flex items-center gap-2 mb-3">
              <section.icon className={`w-4 h-4 text-${section.color}-400`} />
              <span className="text-xs font-bold text-foreground">{section.label}</span>
            </div>
            <div className="space-y-2">
              {section.items.map((item: any, i: number) => (
                <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}
                  className="bg-card/60 rounded-lg p-2.5 border border-border/50">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[11px] font-bold text-foreground">{item.effect}</span>
                    {item.certainty && <SeverityBadge level={item.certainty === 'high' ? 'low' : item.certainty === 'low' ? 'high' : 'medium'} />}
                  </div>
                  {item.timeframe && <p className="text-[10px] text-muted-foreground">⏱ {item.timeframe}</p>}
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>
      {data.trade_offs && (
        <div className="bg-secondary/30 border border-border/50 rounded-xl p-4">
          <span className="text-xs font-bold text-foreground block mb-1">Trade-offs</span>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.trade_offs}</p>
        </div>
      )}
      {data.strategic_recommendation && (
        <div className="bg-primary/5 border border-primary/20 rounded-xl p-4">
          <span className="text-xs font-bold text-primary block mb-1">Strategic Recommendation</span>
          <p className="text-xs text-muted-foreground leading-relaxed">{data.strategic_recommendation}</p>
        </div>
      )}
    </div>
  );
}

// Framework renderer dispatch
function FrameworkContent({ type, data }: { type: string; data: any }) {
  switch (type) {
    case "pestle": return <PestleRenderer data={data} />;
    case "stakeholder": return <StakeholderRenderer data={data} />;
    case "cost_benefit": return <CostBenefitRenderer data={data} />;
    case "long_short_term": return <LongShortTermRenderer data={data} />;
    default: return <pre className="text-xs text-muted-foreground whitespace-pre-wrap overflow-auto max-h-56 bg-secondary/30 rounded-xl p-3 border border-border/50 font-mono">{JSON.stringify(data, null, 2)}</pre>;
  }
}

export default function DebateEngineAdmin() {
  const [tab, setTab] = useState<Tab>("dashboard");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedEvalId, setSelectedEvalId] = useState<string | null>(null);
  const [newTopic, setNewTopic] = useState({ title: "", context: "", event_id: "" });
  const [activePipelineStage, setActivePipelineStage] = useState(0);
  const [autoGenStep, setAutoGenStep] = useState<"idle" | "generating_topic" | "topic_ready" | "generating_analysis" | "done">("idle");

  // Writing lab state
  const [writingTopic, setWritingTopic] = useState("");
  const [writingContext, setWritingContext] = useState("");
  const [writingAnswer, setWritingAnswer] = useState("");
  const [writingLinkedAnalysis, setWritingLinkedAnalysis] = useState<string>("");
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [evalResult, setEvalResult] = useState<any>(null);
  const [writingStep, setWritingStep] = useState<"idle" | "generating_topic" | "topic_ready" | "generating_answer" | "answer_ready" | "evaluating">("idle");
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const dashboard = useDebateDashboard();
  const analyses = useDebateAnalyses();
  const detail = useDebateAnalysisDetail(selectedId);
  const generateAnalysis = useGenerateAnalysis();
  const applyFrameworks = useApplyFrameworks();
  const evaluateWriting = useEvaluateWriting();
  const evaluations = useWritingEvaluations();
  const generateAITopic = useGenerateAITopic();
  const generateAIAnswer = useGenerateAIAnswer();

  // Pipeline animation
  useEffect(() => {
    const timer = setInterval(() => setActivePipelineStage(prev => (prev + 1) % PIPELINE_STAGES.length), 2000);
    return () => clearInterval(timer);
  }, []);

  // Timer
  useEffect(() => {
    if (isTimerRunning) {
      timerRef.current = setInterval(() => setElapsedSeconds(p => p + 1), 1000);
    } else if (timerRef.current) {
      clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTimerRunning]);

  const formatTime = (s: number) => `${Math.floor(s / 60).toString().padStart(2, "0")}:${(s % 60).toString().padStart(2, "0")}`;

  // FULLY AUTOMATED: Generate Topic → Generate Analysis → Apply Frameworks
  const handleAutoGenerate = async () => {
    try {
      // Step 1: AI generates topic
      setAutoGenStep("generating_topic");
      const topicResult = await generateAITopic.mutateAsync();
      setNewTopic({ title: topicResult.topic_title || "", context: topicResult.topic_context || "", event_id: "" });
      setAutoGenStep("topic_ready");
      toast.success("AI generated a debate topic!");

      // Brief pause for visual feedback
      await new Promise(r => setTimeout(r, 800));

      // Step 2: Generate multi-angle analysis
      setAutoGenStep("generating_analysis");
      const analysisResult = await generateAnalysis.mutateAsync({
        topic_title: topicResult.topic_title,
        topic_context: topicResult.topic_context,
      });
      toast.success("6-dimension analysis generated!");

      // Step 3: Auto-apply frameworks
      await applyFrameworks.mutateAsync(analysisResult.id);
      toast.success("All 4 frameworks applied!");

      setAutoGenStep("done");
      setSelectedId(analysisResult.id);

      // Auto-navigate to detail after brief celebration
      await new Promise(r => setTimeout(r, 1200));
      setTab("detail");
      setAutoGenStep("idle");
      setNewTopic({ title: "", context: "", event_id: "" });
    } catch (e: any) {
      toast.error(e.message || "AI generation failed");
      setAutoGenStep("idle");
    }
  };

  const handleApplyFrameworks = (id: string) => {
    applyFrameworks.mutate(id, {
      onSuccess: () => {
        toast.success("All 4 frameworks applied!");
        detail.refetch();
      },
      onError: (e: any) => toast.error(e.message || "Failed to apply frameworks"),
    });
  };

  // FULLY AUTOMATED: AI generates topic → AI writes answer → AI evaluates
  const handleAutoWritingLab = async () => {
    try {
      // Step 1: AI generates topic
      setWritingStep("generating_topic");
      const topicResult = await generateAITopic.mutateAsync();
      setWritingTopic(topicResult.topic_title || "");
      setWritingContext(topicResult.topic_context || "");
      setWritingStep("topic_ready");
      toast.success("AI picked a writing topic!");

      await new Promise(r => setTimeout(r, 600));

      // Step 2: AI writes an answer
      setWritingStep("generating_answer");
      const answerResult = await generateAIAnswer.mutateAsync({
        topic_title: topicResult.topic_title,
        topic_context: topicResult.topic_context,
      });
      setWritingAnswer(answerResult.answer || "");
      setWritingStep("answer_ready");
      toast.success("AI wrote the answer!");

      await new Promise(r => setTimeout(r, 600));

      // Step 3: AI evaluates the answer
      setWritingStep("evaluating");
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast.error("Please log in first"); setWritingStep("idle"); return; }

      const evalData2 = await evaluateWriting.mutateAsync({
        user_id: user.id,
        topic_title: topicResult.topic_title,
        user_answer: answerResult.answer,
        time_taken_seconds: 0,
      });
      setEvalResult(evalData2);
      evaluations.refetch();
      setWritingStep("idle");
      toast.success("AI evaluation complete!");
    } catch (e: any) {
      toast.error(e.message || "Writing lab failed");
      setWritingStep("idle");
    }
  };

  const handleStartWritingFromAnalysis = (analysis: any) => {
    setWritingTopic(analysis.topic_title);
    setWritingContext(analysis.topic_context || "");
    setWritingLinkedAnalysis(analysis.id);
    setWritingAnswer("");
    setElapsedSeconds(0);
    setEvalResult(null);
    setWritingStep("idle");
    setTab("writing_lab");
  };

  const stats = dashboard.data || {};

  const STAT_CARDS = [
    { label: "Total Analyses", value: stats.totalAnalyses || 0, icon: Brain, gradient: "from-cyan-500 to-blue-600", glow: "cyan" },
    { label: "Frameworks Applied", value: stats.totalFrameworks || 0, icon: BarChart3, gradient: "from-purple-500 to-violet-600", glow: "purple" },
    { label: "Writing Evaluations", value: stats.totalEvaluations || 0, icon: PenTool, gradient: "from-emerald-500 to-green-600", glow: "green" },
    { label: "Avg Writing Score", value: parseFloat(String(stats.avgWritingScore || 0)), suffix: "/10", icon: Award, gradient: "from-orange-500 to-red-500", glow: "orange" },
  ];

  const TABS_CONFIG = [
    { key: "dashboard" as Tab, label: "Command Center", icon: Cpu, gradient: "from-cyan-500 to-blue-500" },
    { key: "analyses" as Tab, label: "Analysis Lab", icon: Brain, gradient: "from-purple-500 to-pink-500" },
    { key: "create" as Tab, label: "Generate New", icon: Sparkles, gradient: "from-orange-500 to-red-500" },
    { key: "writing_lab" as Tab, label: "Writing Lab", icon: PenTool, gradient: "from-emerald-500 to-cyan-500" },
    { key: "evaluations" as Tab, label: "Evaluations", icon: Award, gradient: "from-violet-500 to-purple-500" },
  ];

  // Get real avg scores from evaluations
  const evalData = evaluations.data || [];
  const avgScores = evalData.length > 0 ? {
    structure: +(evalData.reduce((s: number, e: any) => s + (e.structure_score || 0), 0) / evalData.length).toFixed(1),
    depth: +(evalData.reduce((s: number, e: any) => s + (e.depth_score || 0), 0) / evalData.length).toFixed(1),
    evidence: +(evalData.reduce((s: number, e: any) => s + (e.evidence_score || 0), 0) / evalData.length).toFixed(1),
    clarity: +(evalData.reduce((s: number, e: any) => s + (e.clarity_score || 0), 0) / evalData.length).toFixed(1),
    logic: +(evalData.reduce((s: number, e: any) => s + (e.logical_flow_score || 0), 0) / evalData.length).toFixed(1),
  } : { structure: 0, depth: 0, evidence: 0, clarity: 0, logic: 0 };

  return (
    <div className="space-y-6 relative">
      {/* Animated background orbs */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none -z-10">
        <motion.div className="absolute top-10 right-20 w-64 h-64 rounded-full bg-gradient-to-br from-orange-500/5 to-red-500/5 blur-3xl"
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 6, repeat: Infinity }} />
        <motion.div className="absolute bottom-20 left-10 w-48 h-48 rounded-full bg-gradient-to-br from-cyan-500/5 to-blue-500/5 blur-3xl"
          animate={{ scale: [1.1, 0.9, 1.1], opacity: [0.2, 0.4, 0.2] }} transition={{ duration: 8, repeat: Infinity }} />
      </div>

      {/* ═══════ HEADER ═══════ */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} className="relative">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <motion.div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-orange-500/20 via-red-500/20 to-pink-500/20 flex items-center justify-center border border-orange-500/20 backdrop-blur-sm"
                animate={{ boxShadow: ["0 0 20px rgba(249,115,22,0.1)", "0 0 40px rgba(249,115,22,0.2)", "0 0 20px rgba(249,115,22,0.1)"] }}
                transition={{ duration: 3, repeat: Infinity }}>
                <motion.div animate={{ rotate: [0, 5, -5, 0] }} transition={{ duration: 4, repeat: Infinity }}>
                  <Swords className="w-7 h-7 text-orange-400" />
                </motion.div>
              </motion.div>
              <OrbitingParticle delay={0} size={4} radius={28} color="bg-orange-400" />
              <OrbitingParticle delay={1.3} size={3} radius={24} color="bg-red-400" />
            </div>
            <div>
              <div className="flex items-center gap-3">
                <h2 className="text-2xl font-black text-foreground tracking-tight">CA 4.0</h2>
                <motion.span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500/20 to-red-500/20 text-orange-400 text-[10px] font-black uppercase tracking-widest border border-orange-500/20"
                  animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}>AI Powered</motion.span>
                <motion.span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-purple-500/20 to-pink-500/20 text-purple-400 text-[10px] font-black uppercase tracking-widest border border-purple-500/20"
                  animate={{ opacity: [0.6, 1, 0.6] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}>Debate Engine</motion.span>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">Multi-angle analysis • Structured frameworks • Writing evaluation</p>
            </div>
          </div>
          <motion.div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20"
            animate={{ opacity: [0.7, 1, 0.7] }} transition={{ duration: 2, repeat: Infinity }}>
            <motion.div className="w-2 h-2 rounded-full bg-emerald-400" animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 1.5, repeat: Infinity }} />
            <span className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">System Active</span>
          </motion.div>
        </div>
      </motion.div>

      {/* ═══════ TAB NAVIGATION ═══════ */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="flex gap-2 flex-wrap">
        {TABS_CONFIG.map((t, i) => (
          <motion.button key={t.key} onClick={() => setTab(t.key)} whileHover={{ scale: 1.03, y: -1 }} whileTap={{ scale: 0.97 }}
            initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.08 }}
            className={`relative flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-bold transition-all overflow-hidden ${
              tab === t.key ? "bg-gradient-to-r " + t.gradient + " text-white shadow-lg" : "bg-card/50 border border-border text-muted-foreground hover:text-foreground hover:border-primary/30"
            }`}>
            {tab === t.key && <motion.div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }} />}
            <t.icon className="w-4 h-4 relative z-10" />
            <span className="relative z-10">{t.label}</span>
          </motion.button>
        ))}
      </motion.div>

      {/* ═══════ TAB CONTENT ═══════ */}
      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 20, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -20, scale: 0.98 }} transition={{ duration: 0.3 }}>

          {/* ═══════ DASHBOARD TAB ═══════ */}
          {tab === "dashboard" && (
            <div className="space-y-6">
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                {STAT_CARDS.map((s, i) => (
                  <StatCard key={i} label={s.label} value={typeof s.value === "number" ? s.value : parseFloat(String(s.value)) || 0} suffix={s.suffix} icon={s.icon} gradient={s.gradient} index={i} />
                ))}
              </div>

              {/* Pipeline */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="relative bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-6 overflow-hidden">
                <div className="flex items-center gap-2 mb-5">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}>
                    <Cpu className="w-5 h-5 text-primary" />
                  </motion.div>
                  <h3 className="text-sm font-bold text-foreground">CA 4.0 Intelligence Pipeline</h3>
                  <motion.span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-bold" animate={{ opacity: [0.5, 1, 0.5] }} transition={{ duration: 1.5, repeat: Infinity }}>LIVE</motion.span>
                </div>
                <div className="flex items-center gap-1 overflow-x-auto pb-2">
                  {PIPELINE_STAGES.map((stage, i) => (
                    <div key={i} className="flex items-center gap-1 shrink-0">
                      <motion.div
                        animate={i === activePipelineStage ? { scale: [1, 1.08, 1], boxShadow: ["0 0 0px transparent", "0 0 20px rgba(var(--primary), 0.3)", "0 0 0px transparent"] } : {}}
                        transition={{ duration: 1, repeat: Infinity }}
                        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all duration-500 ${
                          i === activePipelineStage ? `bg-gradient-to-r ${stage.color} text-white shadow-lg` :
                          i < activePipelineStage ? "bg-primary/10 text-primary border border-primary/20" : "bg-secondary/50 text-muted-foreground border border-border"
                        }`}>
                        <stage.icon className="w-3.5 h-3.5" />
                        <span className="text-[11px] font-bold whitespace-nowrap">{stage.label}</span>
                      </motion.div>
                      {i < PIPELINE_STAGES.length - 1 && (
                        <motion.div animate={i === activePipelineStage ? { opacity: [0.3, 1, 0.3], x: [0, 3, 0] } : {}} transition={{ duration: 0.8, repeat: Infinity }}>
                          <ArrowRight className={`w-3.5 h-3.5 shrink-0 ${i < activePipelineStage ? "text-primary" : "text-muted-foreground/30"}`} />
                        </motion.div>
                      )}
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Modules overview */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {[
                  { title: "Module 1: Multi-Angle", desc: "6-dimension analysis with pro/counter arguments", icon: Swords, gradient: "from-orange-500 to-red-500",
                    features: ["Pro Arguments", "Counter Arguments", "Ethical", "Economic", "Constitutional", "International"], action: () => setTab("create") },
                  { title: "Module 2: Frameworks", desc: "4 structured reasoning frameworks applied by AI", icon: BarChart3, gradient: "from-blue-500 to-purple-500",
                    features: ["PESTLE", "Stakeholder Map", "Cost-Benefit", "Long/Short Term"], action: () => setTab("analyses") },
                  { title: "Module 3: Writing Eval", desc: "AI evaluates your answer on 5 dimensions + model answer", icon: PenTool, gradient: "from-emerald-500 to-cyan-500",
                    features: ["Structure", "Depth", "Evidence", "Clarity", "Logic Flow"], action: () => setTab("writing_lab") },
                ].map((mod, i) => (
                  <motion.div key={i} initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 + i * 0.12 }}
                    whileHover={{ y: -4 }} onClick={mod.action}
                    className="group relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl overflow-hidden hover:border-primary/30 transition-all duration-300 cursor-pointer">
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
                          <span key={fi} className="px-2 py-0.5 rounded-md bg-secondary/80 text-muted-foreground text-[10px] font-medium border border-border/50">{f}</span>
                        ))}
                      </div>
                    </div>
                    <motion.div className={`absolute -bottom-8 -right-8 w-24 h-24 rounded-full bg-gradient-to-br ${mod.gradient} blur-2xl opacity-0 group-hover:opacity-20 transition-opacity duration-700`} />
                  </motion.div>
                ))}
              </div>

              {/* Scoring Radar with REAL data */}
              <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                className="bg-card/60 backdrop-blur-sm border border-border rounded-2xl p-6">
                <div className="flex items-center gap-2 mb-4">
                  <Target className="w-5 h-5 text-primary" />
                  <h3 className="text-sm font-bold text-foreground">Writing Evaluation Averages</h3>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground font-medium ml-auto">{evalData.length} evaluations</span>
                </div>
                {evalData.length > 0 ? (
                  <div className="grid grid-cols-5 gap-3">
                    <ScoreRing score={avgScores.structure} label="Structure" color="stroke-cyan-500" delay={0} />
                    <ScoreRing score={avgScores.depth} label="Depth" color="stroke-purple-500" delay={0.08} />
                    <ScoreRing score={avgScores.evidence} label="Evidence" color="stroke-orange-500" delay={0.16} />
                    <ScoreRing score={avgScores.clarity} label="Clarity" color="stroke-emerald-500" delay={0.24} />
                    <ScoreRing score={avgScores.logic} label="Logic Flow" color="stroke-amber-500" delay={0.32} />
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground text-center py-4">No evaluations yet. Use the Writing Lab to get AI-evaluated scores.</p>
                )}
              </motion.div>
            </div>
          )}

          {/* ═══════ ANALYSES TAB ═══════ */}
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
              {!analyses.isLoading && analyses.data?.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-orange-500/20 to-red-500/20 flex items-center justify-center">
                    <Swords className="w-8 h-8 text-orange-400" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground font-medium">No analyses yet</p>
                  <button onClick={() => setTab("create")} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold"><Plus className="w-3.5 h-3.5 inline mr-1.5" />Create Analysis</button>
                </motion.div>
              )}
              {analyses.data?.map((a: any, i: number) => (
                <motion.div key={a.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.06 }}
                  whileHover={{ x: 4, scale: 1.005 }}
                  className="group relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-5 hover:border-orange-500/30 transition-all duration-300 cursor-pointer overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0" onClick={() => { setSelectedId(a.id); setTab("detail"); }}>
                      <div className="flex items-center gap-2 mb-1">
                        <Swords className="w-4 h-4 text-orange-400 shrink-0" />
                        <h4 className="font-bold text-foreground text-sm truncate">{a.topic_title}</h4>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-1 ml-6">{a.topic_context}</p>
                      <div className="flex items-center gap-3 mt-2.5 ml-6">
                        <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                          a.status === "frameworks_applied" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                        }`}>{a.status === "frameworks_applied" ? "✓ Complete" : "⚡ Generated"}</span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Target className="w-3 h-3" />Relevance: <span className="font-bold text-foreground">{a.exam_relevance_score}%</span></span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-3">
                      <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={(e) => { e.stopPropagation(); handleStartWritingFromAnalysis(a); }}
                        className="p-2 rounded-lg bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors" title="Write answer for this topic">
                        <PenTool className="w-3.5 h-3.5" />
                      </motion.button>
                      <motion.button whileHover={{ x: 3 }} onClick={() => { setSelectedId(a.id); setTab("detail"); }}>
                        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-orange-400 transition-colors" />
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}

          {/* ═══════ DETAIL VIEW ═══════ */}
          {tab === "detail" && selectedId && (
            <div className="space-y-5">
              {detail.isLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}><Brain className="w-8 h-8 text-primary" /></motion.div>
                  <span className="text-xs text-muted-foreground">Decoding analysis...</span>
                </div>
              )}
              {detail.data?.analysis && (
                <>
                  {/* Action bar */}
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <motion.button whileHover={{ x: -3 }} onClick={() => setTab("analyses")} className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-primary transition-colors font-medium">
                      <ChevronRight className="w-3.5 h-3.5 rotate-180" />Back to Analysis Lab
                    </motion.button>
                    <div className="flex items-center gap-2">
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={() => handleStartWritingFromAnalysis(detail.data.analysis)}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-bold shadow-lg">
                        <PenTool className="w-3.5 h-3.5" />Write Answer
                      </motion.button>
                      {detail.data.analysis.status !== "frameworks_applied" && (
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                          onClick={() => handleApplyFrameworks(selectedId)} disabled={applyFrameworks.isPending}
                          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-r from-blue-500 to-purple-500 text-white text-xs font-bold shadow-lg disabled:opacity-50">
                          {applyFrameworks.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Zap className="w-3.5 h-3.5" />}
                          Apply All Frameworks
                        </motion.button>
                      )}
                    </div>
                  </div>

                  {/* Topic card */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="relative bg-gradient-to-br from-orange-500/10 via-card to-red-500/5 border border-orange-500/20 rounded-2xl p-6 overflow-hidden">
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
                          <span className={`text-[10px] px-2.5 py-0.5 rounded-full font-bold ${
                            detail.data.analysis.status === "frameworks_applied" ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/20" : "bg-blue-500/15 text-blue-400 border border-blue-500/20"
                          }`}>{detail.data.analysis.status === "frameworks_applied" ? "✓ Fully Analyzed" : "⚡ Analysis Generated"}</span>
                        </div>
                      </div>
                    </div>
                  </motion.div>

                  {/* Pro vs Counter */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { label: "Pro Arguments", icon: CheckCircle2, items: detail.data.analysis.pro_arguments || [], border: "border-emerald-500/20", color: "text-emerald-400", bg: "bg-emerald-500/20", gradient: "from-emerald-500 to-green-500" },
                      { label: "Counter Arguments", icon: Swords, items: detail.data.analysis.counter_arguments || [], border: "border-red-500/20", color: "text-red-400", bg: "bg-red-500/20", gradient: "from-red-500 to-orange-500" },
                    ].map((side, si) => (
                      <motion.div key={si} initial={{ opacity: 0, x: si === 0 ? -20 : 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + si * 0.05 }}
                        className={`bg-card/80 border ${side.border} rounded-2xl overflow-hidden`}>
                        <div className={`h-1 bg-gradient-to-r ${side.gradient}`} />
                        <div className="p-5">
                          <div className="flex items-center gap-2 mb-4">
                            <div className={`w-7 h-7 rounded-lg ${side.bg} flex items-center justify-center`}><side.icon className={`w-4 h-4 ${side.color}`} /></div>
                            <h4 className="text-sm font-bold text-foreground">{side.label}</h4>
                            <span className={`ml-auto text-[10px] px-2 py-0.5 rounded-full ${side.bg.replace('/20', '/10')} ${side.color} font-bold`}>{side.items.length}</span>
                          </div>
                          <div className="space-y-3">
                            {side.items.map((arg: any, i: number) => (
                              <motion.div key={i} initial={{ opacity: 0, x: si === 0 ? -10 : 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.2 + i * 0.06 }}
                                className={`pl-3 border-l-2 ${side.border}`}>
                                <span className={`text-xs font-bold ${side.color}`}>{arg.point || arg}</span>
                                {arg.explanation && <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{arg.explanation}</p>}
                              </motion.div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    ))}
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
                            <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${dim.gradient} flex items-center justify-center`}><dim.icon className="w-4 h-4 text-white" /></div>
                            <h4 className="text-sm font-bold text-foreground">{dim.label}</h4>
                          </div>
                          <p className="text-xs text-muted-foreground whitespace-pre-line leading-relaxed">{dim.content || "Not generated yet"}</p>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Frameworks - STRUCTURED rendering */}
                  {detail.data.frameworks.length > 0 && (
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Scale className="w-5 h-5 text-primary" />
                        <h3 className="text-sm font-bold text-foreground">Applied Reasoning Frameworks</h3>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">{detail.data.frameworks.length}</span>
                      </div>
                      {detail.data.frameworks.map((fw: any, i: number) => {
                        const meta = FRAMEWORK_LABELS[fw.framework_type] || { label: fw.framework_type, icon: FileText, gradient: "from-gray-500/20 to-gray-600/20", glow: "" };
                        return (
                          <motion.div key={fw.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.08 }}
                            className="bg-card/80 border border-border rounded-2xl overflow-hidden">
                            <div className={`h-1 bg-gradient-to-r ${meta.gradient.replace(/\/20/g, "")}`} />
                            <div className="p-5">
                              <div className="flex items-center gap-2 mb-4">
                                <meta.icon className="w-5 h-5 text-primary" />
                                <h4 className="text-sm font-bold text-foreground">{meta.label}</h4>
                                {fw.quality_score && <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">Quality: {fw.quality_score}%</span>}
                              </div>
                              <FrameworkContent type={fw.framework_type} data={fw.framework_data} />
                              {fw.ai_summary && (
                                <div className="mt-4 bg-primary/5 border border-primary/10 rounded-xl p-3">
                                  <span className="text-[10px] font-bold text-primary block mb-1">AI Summary</span>
                                  <p className="text-xs text-muted-foreground leading-relaxed">{fw.ai_summary}</p>
                                </div>
                              )}
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

          {/* ═══════ CREATE TAB — FULLY AUTOMATED ═══════ */}
          {tab === "create" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="relative bg-card/80 backdrop-blur-sm border border-border rounded-2xl p-8 max-w-2xl overflow-hidden">
              <motion.div className="absolute top-0 right-0 w-48 h-48 bg-gradient-to-bl from-orange-500/10 to-transparent rounded-bl-full"
                animate={{ opacity: [0.3, 0.5, 0.3] }} transition={{ duration: 4, repeat: Infinity }} />
              <div className="relative space-y-6">
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shadow-lg"><Wand2 className="w-5 h-5 text-white" /></div>
                  <div>
                <h3 className="text-sm font-bold text-foreground">🤖 Fully Automated AI Analysis</h3>
                    <p className="text-[10px] text-muted-foreground">Zero manual work → AI picks topic → generates 6D analysis → applies 4 frameworks automatically</p>
                  </div>
                </div>

                {/* Auto-generation progress steps */}
                <div className="space-y-3">
                  {[
                    { step: "generating_topic", label: "AI Generating Debate Topic", icon: Sparkles, gradient: "from-cyan-500 to-blue-500" },
                    { step: "topic_ready", label: "Topic Generated", icon: CheckCircle2, gradient: "from-emerald-500 to-green-500" },
                    { step: "generating_analysis", label: "Generating 6-Dimension Analysis + 4 Frameworks", icon: Brain, gradient: "from-purple-500 to-pink-500" },
                    { step: "done", label: "Complete! Full Analysis Ready", icon: Award, gradient: "from-orange-500 to-red-500" },
                  ].map((s, i) => {
                    const isActive = autoGenStep === s.step;
                    const isPast = ["generating_topic", "topic_ready", "generating_analysis", "done"].indexOf(autoGenStep) > i;
                    return (
                      <motion.div key={s.step} initial={{ opacity: 0.4, x: -10 }} animate={{ opacity: isActive || isPast ? 1 : 0.4, x: 0 }} transition={{ delay: i * 0.05 }}
                        className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                          isActive ? `bg-gradient-to-r ${s.gradient} text-white border-transparent shadow-lg` :
                          isPast ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-secondary/30 border-border/50 text-muted-foreground"
                        }`}>
                        {isActive && !isPast ? (
                          <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader2 className="w-4 h-4" /></motion.div>
                        ) : isPast ? (
                          <CheckCircle2 className="w-4 h-4" />
                        ) : (
                          <s.icon className="w-4 h-4" />
                        )}
                        <span className="text-xs font-bold">{s.label}</span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Show generated topic if available */}
                {newTopic.title && autoGenStep !== "idle" && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                    <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">AI Selected Topic</span>
                    <h4 className="text-sm font-bold text-foreground">{newTopic.title}</h4>
                    {newTopic.context && <p className="text-xs text-muted-foreground mt-2 leading-relaxed line-clamp-3">{newTopic.context}</p>}
                  </motion.div>
                )}

                {/* Main CTA */}
                <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleAutoGenerate}
                  disabled={autoGenStep !== "idle"}
                  className="relative flex items-center justify-center gap-2 w-full px-4 py-4 rounded-xl bg-gradient-to-r from-orange-500 to-red-500 text-white text-sm font-bold shadow-lg disabled:opacity-50 overflow-hidden">
                  {autoGenStep !== "idle" ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /><span>AI Pipeline Running...</span></>
                  ) : (
                    <><Wand2 className="w-4 h-4" /><span>🚀 One-Click Full AI Analysis</span></>
                  )}
                  {autoGenStep === "idle" && <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }} />}
                </motion.button>

                <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                  <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Fully Automated Pipeline:</p>
                  <div className="flex flex-wrap gap-2">
                    {["1. AI Picks Debate Topic", "2. 6-Dimension Analysis", "3. Apply PESTLE + Stakeholder + Cost-Benefit + Long/Short", "4. Ready for Review"].map((item, i) => (
                      <span key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card/50 px-2.5 py-1 rounded-lg border border-border/50">
                        <Zap className="w-3 h-3 text-orange-400 shrink-0" />{item}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══════ WRITING LAB TAB ═══════ */}
          {tab === "writing_lab" && (
            <div className="space-y-5 max-w-3xl">
              {!evalResult ? (
                <>
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-card/80 border border-border rounded-2xl p-6 space-y-5">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center shadow-lg"><PenTool className="w-5 h-5 text-white" /></div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">Fully Automated AI Writing Lab</h3>
                        <p className="text-[10px] text-muted-foreground">One click → AI picks topic → AI writes answer → AI evaluates & scores</p>
                      </div>
                    </div>

                    {/* Auto-writing progress steps */}
                    <div className="space-y-3">
                      {[
                        { step: "generating_topic", label: "AI Picking Writing Topic", icon: Sparkles, gradient: "from-cyan-500 to-blue-500" },
                        { step: "topic_ready", label: "Topic Selected", icon: CheckCircle2, gradient: "from-emerald-500 to-green-500" },
                        { step: "generating_answer", label: "AI Writing Mains-Quality Answer", icon: PenTool, gradient: "from-purple-500 to-pink-500" },
                        { step: "answer_ready", label: "Answer Written", icon: CheckCircle2, gradient: "from-emerald-500 to-green-500" },
                        { step: "evaluating", label: "AI Evaluating on 5 Dimensions", icon: Award, gradient: "from-orange-500 to-red-500" },
                      ].map((s, i) => {
                        const steps = ["generating_topic", "topic_ready", "generating_answer", "answer_ready", "evaluating"];
                        const isActive = writingStep === s.step;
                        const isPast = steps.indexOf(writingStep) > i;
                        return (
                          <motion.div key={s.step} initial={{ opacity: 0.4, x: -10 }} animate={{ opacity: isActive || isPast ? 1 : 0.4, x: 0 }} transition={{ delay: i * 0.05 }}
                            className={`flex items-center gap-3 px-4 py-3 rounded-xl border transition-all ${
                              isActive ? `bg-gradient-to-r ${s.gradient} text-white border-transparent shadow-lg` :
                              isPast ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-400" : "bg-secondary/30 border-border/50 text-muted-foreground"
                            }`}>
                            {isActive ? (
                              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}><Loader2 className="w-4 h-4" /></motion.div>
                            ) : isPast ? (
                              <CheckCircle2 className="w-4 h-4" />
                            ) : (
                              <s.icon className="w-4 h-4" />
                            )}
                            <span className="text-xs font-bold">{s.label}</span>
                          </motion.div>
                        );
                      })}
                    </div>

                    {/* Show generated topic */}
                    {writingTopic && writingStep !== "idle" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-primary/5 border border-primary/20 rounded-xl p-4">
                        <span className="text-[10px] font-bold text-primary uppercase tracking-wider block mb-1">AI Selected Topic</span>
                        <h4 className="text-sm font-bold text-foreground">{writingTopic}</h4>
                      </motion.div>
                    )}

                    {/* Show AI-generated answer */}
                    {writingAnswer && writingStep !== "idle" && (
                      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                        className="bg-secondary/30 border border-border/50 rounded-xl p-4">
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">AI Written Answer</span>
                          <span className="text-[10px] text-muted-foreground">{writingAnswer.split(/\s+/).filter(Boolean).length} words</span>
                        </div>
                        <p className="text-xs text-foreground leading-relaxed whitespace-pre-line max-h-48 overflow-y-auto">{writingAnswer}</p>
                      </motion.div>
                    )}

                    {/* Main CTA */}
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} onClick={handleAutoWritingLab}
                      disabled={writingStep !== "idle"}
                      className="relative flex items-center justify-center gap-2 w-full px-4 py-4 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-sm font-bold shadow-lg disabled:opacity-50 overflow-hidden">
                      {writingStep !== "idle" ? (
                        <><Loader2 className="w-4 h-4 animate-spin" /><span>AI Writing Pipeline Running...</span></>
                      ) : (
                        <><Wand2 className="w-4 h-4" /><span>🚀 One-Click AI Write & Evaluate</span></>
                      )}
                      {writingStep === "idle" && <motion.div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent" animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4 }} />}
                    </motion.button>

                    <div className="bg-secondary/30 rounded-xl p-4 border border-border/50">
                      <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider mb-2">Fully Automated Pipeline:</p>
                      <div className="flex flex-wrap gap-2">
                        {["1. AI Picks Topic", "2. AI Writes Answer", "3. AI Evaluates 5 Dimensions", "4. Score + Feedback + Model Answer"].map((item, i) => (
                          <span key={i} className="flex items-center gap-1.5 text-[10px] text-muted-foreground bg-card/50 px-2.5 py-1 rounded-lg border border-border/50">
                            <Zap className="w-3 h-3 text-emerald-400 shrink-0" />{item}
                          </span>
                        ))}
                      </div>
                    </div>
                  </motion.div>
                </>
              ) : (
                /* ═══════ EVALUATION RESULT ═══════ */
                <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
                  {/* Overall Score Hero */}
                  <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
                    className="bg-gradient-to-br from-emerald-500/10 via-card to-cyan-500/5 border border-emerald-500/20 rounded-2xl p-8 text-center">
                    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.2 }}>
                      <ScoreRing score={evalResult.overall_score || 0} label="Overall Score" color="stroke-emerald-500" size={96} />
                    </motion.div>
                    <h3 className="text-lg font-black text-foreground mt-3">{evalResult.topic_title}</h3>
                    <div className="flex items-center justify-center gap-4 mt-2 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{evalResult.word_count} words</span>
                      {evalResult.time_taken_seconds && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(evalResult.time_taken_seconds)}</span>}
                    </div>
                  </motion.div>

                  {/* 5 Score Dimensions */}
                  <div className="bg-card/80 border border-border rounded-2xl p-6">
                    <h4 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Score Breakdown</h4>
                    <div className="grid grid-cols-5 gap-3">
                      <ScoreRing score={evalResult.structure_score || 0} label="Structure" color="stroke-cyan-500" delay={0.1} />
                      <ScoreRing score={evalResult.depth_score || 0} label="Depth" color="stroke-purple-500" delay={0.2} />
                      <ScoreRing score={evalResult.evidence_score || 0} label="Evidence" color="stroke-orange-500" delay={0.3} />
                      <ScoreRing score={evalResult.clarity_score || 0} label="Clarity" color="stroke-emerald-500" delay={0.4} />
                      <ScoreRing score={evalResult.logical_flow_score || 0} label="Logic Flow" color="stroke-amber-500" delay={0.5} />
                    </div>
                  </div>

                  {/* AI Feedback */}
                  <div className="bg-card/80 border border-border rounded-2xl p-6">
                    <h4 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2"><Brain className="w-4 h-4 text-primary" />AI Feedback</h4>
                    <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{evalResult.ai_feedback}</p>
                  </div>

                  {/* Strengths & Improvements */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                      <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2"><ThumbsUp className="w-4 h-4" />Strengths</h4>
                      <div className="space-y-2">
                        {(evalResult.strengths || []).map((s: string, i: number) => (
                          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                            className="flex items-start gap-2 text-xs text-muted-foreground">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 mt-0.5 shrink-0" /><span>{s}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                    <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                      <h4 className="text-sm font-bold text-amber-400 mb-3 flex items-center gap-2"><AlertTriangle className="w-4 h-4" />Areas to Improve</h4>
                      <div className="space-y-2">
                        {(evalResult.improvement_areas || []).map((s: string, i: number) => (
                          <motion.div key={i} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.05 }}
                            className="flex items-start gap-2 text-xs text-muted-foreground">
                            <ArrowRight className="w-3.5 h-3.5 text-amber-400 mt-0.5 shrink-0" /><span>{s}</span>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Model Answer */}
                  {evalResult.model_answer && (
                    <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6">
                      <h4 className="text-sm font-bold text-primary mb-3 flex items-center gap-2"><BookMarked className="w-4 h-4" />Model Answer</h4>
                      <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-line">{evalResult.model_answer}</p>
                    </div>
                  )}

                  {/* Actions */}
                  <div className="flex gap-3">
                    <motion.button whileHover={{ scale: 1.02 }} onClick={() => { setEvalResult(null); setWritingAnswer(""); setWritingTopic(""); setWritingContext(""); setElapsedSeconds(0); setWritingStep("idle"); }}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-bold shadow-lg">
                      <RotateCcw className="w-3.5 h-3.5" />Try Again
                    </motion.button>
                    <motion.button whileHover={{ scale: 1.02 }} onClick={() => setTab("evaluations")}
                      className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-card border border-border text-foreground text-xs font-bold hover:border-primary/30 transition-colors">
                      <Award className="w-3.5 h-3.5" />View All Evaluations
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </div>
          )}

          {/* ═══════ EVALUATIONS HISTORY TAB ═══════ */}
          {tab === "evaluations" && (
            <div className="space-y-3">
              {evaluations.isLoading && (
                <div className="flex flex-col items-center justify-center py-16 gap-3">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}><Loader2 className="w-8 h-8 text-primary" /></motion.div>
                  <span className="text-xs text-muted-foreground font-medium">Loading evaluations...</span>
                </div>
              )}
              {!evaluations.isLoading && evalData.length === 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center py-16">
                  <motion.div animate={{ y: [0, -8, 0] }} transition={{ duration: 3, repeat: Infinity }}
                    className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-cyan-500/20 flex items-center justify-center">
                    <PenTool className="w-8 h-8 text-emerald-400" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground font-medium">No evaluations yet</p>
                  <button onClick={() => setTab("writing_lab")} className="mt-4 px-4 py-2 rounded-xl bg-gradient-to-r from-emerald-500 to-cyan-500 text-white text-xs font-bold">
                    <PenTool className="w-3.5 h-3.5 inline mr-1.5" />Start Writing
                  </button>
                </motion.div>
              )}
              {evalData.map((ev: any, i: number) => (
                <motion.div key={ev.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
                  whileHover={{ x: 4, scale: 1.005 }}
                  onClick={() => { setEvalResult(ev); setWritingTopic(ev.topic_title); setWritingAnswer(ev.user_answer); setElapsedSeconds(ev.time_taken_seconds || 0); setTab("writing_lab"); }}
                  className="group bg-card/80 border border-border rounded-2xl p-5 hover:border-emerald-500/30 transition-all duration-300 cursor-pointer overflow-hidden">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Award className="w-4 h-4 text-emerald-400 shrink-0" />
                        <h4 className="font-bold text-foreground text-sm truncate">{ev.topic_title}</h4>
                      </div>
                      <div className="flex items-center gap-3 mt-2 ml-6">
                        <span className="text-[10px] px-2.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 font-bold border border-emerald-500/20">
                          Score: {ev.overall_score}/10
                        </span>
                        <span className="text-[10px] text-muted-foreground flex items-center gap-1"><BookOpen className="w-3 h-3" />{ev.word_count} words</span>
                        {ev.time_taken_seconds && <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Clock className="w-3 h-3" />{formatTime(ev.time_taken_seconds)}</span>}
                        <span className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 ml-3">
                      <div className="flex gap-1">
                        {[ev.structure_score, ev.depth_score, ev.evidence_score, ev.clarity_score, ev.logical_flow_score].map((s: number, si: number) => (
                          <div key={si} className="w-6 h-6 rounded-md bg-secondary/50 flex items-center justify-center">
                            <span className={`text-[9px] font-bold ${s >= 7 ? 'text-emerald-400' : s >= 5 ? 'text-amber-400' : 'text-red-400'}`}>{s}</span>
                          </div>
                        ))}
                      </div>
                      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-emerald-400 transition-colors" />
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
