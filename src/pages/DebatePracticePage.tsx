import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Swords, Brain, Sparkles, PenTool, Eye, Layers, ArrowLeft, Loader2, Clock, CheckCircle2, AlertCircle, BookOpen, Target, BarChart3, ChevronDown, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  useDebateAnalyses, useDebateAnalysisDetail,
  useGenerateAITopic, useGenerateAIAnswer, useEvaluateWriting,
  useWritingEvaluations
} from "@/hooks/useDebateEngine";
import { toast } from "sonner";
import ACRYLogo from "@/components/landing/ACRYLogo";

type Tab = "practice" | "analyses" | "history";

// ─── Writing Practice Tab ───
function WritingPracticeTab({ userId }: { userId: string }) {
  const [step, setStep] = useState<"idle" | "loading_topic" | "topic_ready" | "writing" | "evaluating" | "done">("idle");
  const [topic, setTopic] = useState<{ title: string; context: string } | null>(null);
  const [answer, setAnswer] = useState("");
  const [timer, setTimer] = useState(0);
  const [timerInterval, setTimerInterval] = useState<NodeJS.Timeout | null>(null);
  const [result, setResult] = useState<any>(null);
  const [showModel, setShowModel] = useState(false);

  const generateTopic = useGenerateAITopic();
  const evaluateWriting = useEvaluateWriting();

  const handleGetTopic = async () => {
    setStep("loading_topic");
    setResult(null);
    setAnswer("");
    setShowModel(false);
    try {
      const res = await generateTopic.mutateAsync();
      setTopic({ title: res.topic_title, context: res.topic_context });
      setStep("topic_ready");
    } catch (e: any) {
      toast.error("Failed to generate topic: " + (e.message || "Unknown error"));
      setStep("idle");
    }
  };

  const handleStartWriting = () => {
    setStep("writing");
    setTimer(0);
    const interval = setInterval(() => setTimer(t => t + 1), 1000);
    setTimerInterval(interval);
  };

  const handleSubmit = async () => {
    if (!topic || answer.trim().length < 50) {
      toast.error("Please write at least 50 characters");
      return;
    }
    if (timerInterval) clearInterval(timerInterval);
    setStep("evaluating");
    try {
      const res = await evaluateWriting.mutateAsync({
        user_id: userId,
        topic_title: topic.title,
        user_answer: answer,
        time_taken_seconds: timer,
      });
      setResult(res);
      setStep("done");
    } catch (e: any) {
      toast.error("Evaluation failed: " + (e.message || "Unknown error"));
      setStep("writing");
    }
  };

  const wordCount = answer.trim().split(/\s+/).filter(Boolean).length;
  const minutes = Math.floor(timer / 60);
  const seconds = timer % 60;

  return (
    <div className="space-y-4">
      {/* Idle / Get Topic */}
      {step === "idle" && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="text-center py-8 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
            <PenTool className="w-8 h-8 text-primary" />
          </div>
          <h3 className="text-lg font-bold text-foreground">UPSC Answer Writing Practice</h3>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            AI generates a debate topic, you write your answer, and get instant evaluation with scores & feedback.
          </p>
          <button onClick={handleGetTopic} className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
            <Sparkles className="w-4 h-4 inline mr-2" />
            Generate AI Topic
          </button>
        </motion.div>
      )}

      {/* Loading topic */}
      {step === "loading_topic" && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">AI is generating a debate topic...</p>
        </div>
      )}

      {/* Topic Ready */}
      {step === "topic_ready" && topic && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-4 space-y-3">
            <div className="flex items-start gap-2">
              <Target className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <div>
                <h3 className="font-bold text-foreground text-sm">{topic.title}</h3>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">{topic.context}</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3">
            <button onClick={handleStartWriting} className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors">
              <PenTool className="w-4 h-4 inline mr-2" />
              Start Writing
            </button>
            <button onClick={handleGetTopic} className="px-4 py-3 rounded-xl border border-border text-muted-foreground text-sm hover:bg-secondary/50 transition-colors">
              New Topic
            </button>
          </div>
        </motion.div>
      )}

      {/* Writing */}
      {step === "writing" && topic && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <div className="rounded-xl border border-primary/30 bg-primary/5 p-3">
            <p className="text-xs font-bold text-primary">{topic.title}</p>
          </div>
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {minutes}:{seconds.toString().padStart(2, "0")}</span>
            <span>{wordCount} words</span>
          </div>
          <textarea
            value={answer}
            onChange={e => setAnswer(e.target.value)}
            placeholder="Write your answer here... (minimum 50 characters)"
            className="w-full h-64 p-4 rounded-xl border border-border bg-background text-foreground text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
            autoFocus
          />
          <div className="flex gap-3">
            <button onClick={handleSubmit} disabled={answer.trim().length < 50} className="flex-1 px-4 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              Submit for Evaluation
            </button>
          </div>
        </motion.div>
      )}

      {/* Evaluating */}
      {step === "evaluating" && (
        <div className="text-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">AI is evaluating your answer...</p>
        </div>
      )}

      {/* Results */}
      {step === "done" && result && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
          {/* Score Overview */}
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 mb-3">
              <BarChart3 className="w-4 h-4 text-primary" />
              <h3 className="font-bold text-foreground text-sm">Your Scores</h3>
              <div className="ml-auto px-3 py-1 rounded-full bg-primary/10 text-primary font-bold text-lg">
                {result.overall_score}/10
              </div>
            </div>
            <div className="grid grid-cols-5 gap-2">
              {[
                { label: "Structure", score: result.structure_score },
                { label: "Depth", score: result.depth_score },
                { label: "Evidence", score: result.evidence_score },
                { label: "Clarity", score: result.clarity_score },
                { label: "Logic", score: result.logical_flow_score },
              ].map(s => (
                <div key={s.label} className="text-center">
                  <div className={`text-lg font-bold ${(s.score ?? 0) >= 7 ? "text-emerald-500" : (s.score ?? 0) >= 5 ? "text-amber-500" : "text-destructive"}`}>
                    {s.score ?? 0}
                  </div>
                  <div className="text-[9px] text-muted-foreground">{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Feedback */}
          <div className="rounded-xl border border-border bg-card p-4 space-y-2">
            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> AI Feedback
            </h4>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">{result.ai_feedback}</p>
          </div>

          {/* Strengths & Improvements */}
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-xl border border-border bg-card p-3">
              <h4 className="text-xs font-bold text-emerald-500 mb-2 flex items-center gap-1"><CheckCircle2 className="w-3 h-3" /> Strengths</h4>
              <ul className="space-y-1">
                {(result.strengths || []).map((s: string, i: number) => (
                  <li key={i} className="text-[10px] text-muted-foreground">• {s}</li>
                ))}
              </ul>
            </div>
            <div className="rounded-xl border border-border bg-card p-3">
              <h4 className="text-xs font-bold text-amber-500 mb-2 flex items-center gap-1"><AlertCircle className="w-3 h-3" /> Improve</h4>
              <ul className="space-y-1">
                {(result.improvement_areas || []).map((s: string, i: number) => (
                  <li key={i} className="text-[10px] text-muted-foreground">• {s}</li>
                ))}
              </ul>
            </div>
          </div>

          {/* Model Answer */}
          {result.model_answer && (
            <div className="rounded-xl border border-border bg-card p-4">
              <button onClick={() => setShowModel(!showModel)} className="flex items-center gap-2 w-full text-left">
                <BookOpen className="w-4 h-4 text-primary" />
                <span className="text-sm font-semibold text-foreground">Model Answer</span>
                {showModel ? <ChevronDown className="w-4 h-4 ml-auto text-muted-foreground" /> : <ChevronRight className="w-4 h-4 ml-auto text-muted-foreground" />}
              </button>
              {showModel && (
                <p className="text-xs text-muted-foreground leading-relaxed mt-3 whitespace-pre-wrap">{result.model_answer}</p>
              )}
            </div>
          )}

          {/* Try Again */}
          <button onClick={() => { setStep("idle"); setTopic(null); setAnswer(""); setResult(null); }} className="w-full px-4 py-3 rounded-xl border border-border text-foreground font-semibold text-sm hover:bg-secondary/50 transition-colors">
            Practice Again
          </button>
        </motion.div>
      )}
    </div>
  );
}

// ─── Analyses Browser Tab ───
function AnalysesBrowserTab() {
  const analyses = useDebateAnalyses();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const detail = useDebateAnalysisDetail(selectedId);

  if (analyses.isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" /></div>;

  if (selectedId && detail.data?.analysis) {
    const a = detail.data.analysis;
    const frameworks = detail.data.frameworks || [];
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
        <button onClick={() => setSelectedId(null)} className="flex items-center gap-1 text-xs text-primary hover:underline">
          <ArrowLeft className="w-3 h-3" /> Back to list
        </button>
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          <h3 className="font-bold text-foreground text-sm">{a.topic_title}</h3>
          <p className="text-xs text-muted-foreground">{a.topic_context}</p>
          {a.exam_relevance_score && (
            <span className="inline-block px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
              Exam Relevance: {a.exam_relevance_score}/100
            </span>
          )}
        </div>

        {/* Pro & Counter Arguments */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ArgumentList title="Pro Arguments" items={a.pro_arguments || []} color="emerald" />
          <ArgumentList title="Counter Arguments" items={a.counter_arguments || []} color="rose" />
        </div>

        {/* Dimensions */}
        {[
          { label: "Ethical Dimension", value: a.ethical_dimension },
          { label: "Economic Dimension", value: a.economic_dimension },
          { label: "Constitutional Link", value: a.constitutional_link },
          { label: "International Perspective", value: a.international_perspective },
        ].filter(d => d.value).map(d => (
          <div key={d.label} className="rounded-xl border border-border bg-card p-3">
            <h4 className="text-xs font-bold text-foreground mb-1">{d.label}</h4>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{d.value}</p>
          </div>
        ))}

        {/* Frameworks */}
        {frameworks.length > 0 && (
          <div className="space-y-3">
            <h4 className="text-xs font-bold text-foreground flex items-center gap-1"><Layers className="w-3 h-3 text-primary" /> Applied Frameworks</h4>
            {frameworks.map((fw: any) => (
              <FrameworkCard key={fw.id} fw={fw} />
            ))}
          </div>
        )}
      </motion.div>
    );
  }

  return (
    <div className="space-y-2">
      {(analyses.data || []).length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No analyses available yet.</p>
      ) : (
        (analyses.data || []).map((a: any) => (
          <motion.button
            key={a.id}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedId(a.id)}
            className="w-full text-left rounded-xl border border-border bg-card p-3 hover:bg-secondary/30 transition-colors"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{a.topic_title}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{new Date(a.created_at).toLocaleDateString()}</p>
              </div>
              {a.exam_relevance_score && (
                <span className="shrink-0 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                  {a.exam_relevance_score}%
                </span>
              )}
            </div>
          </motion.button>
        ))
      )}
    </div>
  );
}

function ArgumentList({ title, items, color }: { title: string; items: any[]; color: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <h4 className={`text-xs font-bold mb-2 ${color === "emerald" ? "text-emerald-500" : "text-rose-500"}`}>{title}</h4>
      <ul className="space-y-1.5">
        {items.map((item: any, i: number) => (
          <li key={i}>
            <p className="text-[11px] font-medium text-foreground">{item.point || item}</p>
            {item.explanation && <p className="text-[10px] text-muted-foreground">{item.explanation}</p>}
          </li>
        ))}
      </ul>
    </div>
  );
}

function FrameworkCard({ fw }: { fw: any }) {
  const [open, setOpen] = useState(false);
  const labels: Record<string, string> = { pestle: "PESTLE", stakeholder: "Stakeholder Mapping", cost_benefit: "Cost-Benefit", long_short_term: "Long vs Short Term" };
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <button onClick={() => setOpen(!open)} className="flex items-center gap-2 w-full text-left">
        <Layers className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">{labels[fw.framework_type] || fw.framework_type}</span>
        {open ? <ChevronDown className="w-3 h-3 ml-auto text-muted-foreground" /> : <ChevronRight className="w-3 h-3 ml-auto text-muted-foreground" />}
      </button>
      {open && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          {fw.ai_summary && <p className="mb-2 italic">{fw.ai_summary}</p>}
          <pre className="whitespace-pre-wrap bg-secondary/30 rounded-lg p-2 text-[9px] max-h-40 overflow-y-auto">
            {JSON.stringify(fw.framework_data, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
}

// ─── History Tab ───
function HistoryTab({ userId }: { userId: string }) {
  const evaluations = useWritingEvaluations(userId);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (evaluations.isLoading) return <div className="text-center py-8"><Loader2 className="w-6 h-6 text-primary animate-spin mx-auto" /></div>;

  return (
    <div className="space-y-2">
      {(evaluations.data || []).length === 0 ? (
        <p className="text-center text-sm text-muted-foreground py-8">No writing evaluations yet. Start practicing!</p>
      ) : (
        (evaluations.data || []).map((ev: any) => (
          <motion.div key={ev.id} className="rounded-xl border border-border bg-card p-3">
            <button onClick={() => setExpandedId(expandedId === ev.id ? null : ev.id)} className="flex items-center justify-between w-full text-left">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-foreground truncate">{ev.topic_title}</p>
                <p className="text-[10px] text-muted-foreground">{new Date(ev.created_at).toLocaleDateString()} • {ev.word_count} words</p>
              </div>
              <div className={`px-2 py-0.5 rounded-full text-xs font-bold ${(ev.overall_score ?? 0) >= 7 ? "bg-emerald-500/10 text-emerald-500" : (ev.overall_score ?? 0) >= 5 ? "bg-amber-500/10 text-amber-500" : "bg-destructive/10 text-destructive"}`}>
                {ev.overall_score}/10
              </div>
            </button>
            {expandedId === ev.id && (
              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} className="mt-3 space-y-2 border-t border-border pt-3">
                <div className="grid grid-cols-5 gap-1 text-center">
                  {[
                    { l: "Struct", v: ev.structure_score },
                    { l: "Depth", v: ev.depth_score },
                    { l: "Evidence", v: ev.evidence_score },
                    { l: "Clarity", v: ev.clarity_score },
                    { l: "Logic", v: ev.logical_flow_score },
                  ].map(s => (
                    <div key={s.l}>
                      <div className="text-sm font-bold text-foreground">{s.v ?? "-"}</div>
                      <div className="text-[8px] text-muted-foreground">{s.l}</div>
                    </div>
                  ))}
                </div>
                {ev.ai_feedback && <p className="text-[10px] text-muted-foreground leading-relaxed">{ev.ai_feedback}</p>}
              </motion.div>
            )}
          </motion.div>
        ))
      )}
    </div>
  );
}

// ─── Main Page ───
export default function DebatePracticePage() {
  const [tab, setTab] = useState<Tab>("practice");
  const navigate = useNavigate();
  const { user, loading } = useAuth();

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <ACRYLogo variant="icon" animate className="w-10 h-10 animate-pulse" />
    </div>
  );

  const tabs: { id: Tab; label: string; icon: any }[] = [
    { id: "practice", label: "Practice", icon: PenTool },
    { id: "analyses", label: "Analyses", icon: Eye },
    { id: "history", label: "My History", icon: BarChart3 },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 glass-strong border-b border-border px-4 py-3 flex items-center gap-3">
        <button onClick={() => navigate("/app")} className="p-2 rounded-lg hover:bg-secondary/50 transition-colors">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </button>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center">
            <Swords className="w-4 h-4 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-foreground">Debate & Writing Lab</h1>
            <p className="text-[10px] text-muted-foreground">AI-powered UPSC answer practice</p>
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.id ? "bg-primary/10 text-primary" : "text-muted-foreground hover:bg-secondary/50"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <main className="px-4 py-4 max-w-2xl mx-auto">
        <AnimatePresence mode="wait">
          <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            {tab === "practice" && <WritingPracticeTab userId={user?.id || ""} />}
            {tab === "analyses" && <AnalysesBrowserTab />}
            {tab === "history" && <HistoryTab userId={user?.id || ""} />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
