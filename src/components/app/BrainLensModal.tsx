import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Camera, FileText, Link, Type, Brain, CheckCircle, Zap, BookOpen, Target, Lightbulb, ArrowLeft, Sparkles, Activity, Network, BarChart3, Shield, Layers, GraduationCap, Eye, Crosshair, TrendingUp, RefreshCw, Cpu, Gauge, ChevronDown, Atom, Radar, Fingerprint, Orbit } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import AIProgressBar from "./AIProgressBar";

type InputMode = "scan" | "upload" | "url" | "text";

interface CognitiveGap {
  type: string;
  code: string;
  explanation: string;
  severity: string;
}

interface MicroConcepts {
  core: string;
  adjacent_nodes: string[];
  reinforcement_questions: { question: string; difficulty: string }[];
}

interface ExamImpact {
  topic_probability_index: number;
  estimated_mastery_boost: string;
  readiness_impact: string;
  related_pyq_patterns: string[];
}

interface PreQueryPredictions {
  weak_concepts: string[];
  preventive_challenge: string | null;
  prediction_confidence: number;
}

interface SilentRepairPlan {
  stealth_questions: string[];
  unstable_nodes: string[];
  repair_strategy: string;
}

interface FutureQuestion {
  question: string;
  question_dna: string;
  difficulty: string;
  topic_momentum: string;
  exam_probability: number;
}

interface CognitiveDrift {
  drift_detected: boolean;
  drift_magnitude: number;
  drift_direction?: string;
  recalibration: string;
  spacing_adjustment?: string;
}

interface PersonalExaminer {
  trap_questions: { question: string; trap_type: string }[];
  conceptual_depth_score: number;
  robustness_rating: string;
}

interface StrategicMasteryIndex {
  smi_score: number;
  multi_step_reasoning: number;
  transfer_learning: number;
  trap_resistance: number;
  mastery_verdict?: string;
}

interface StrategySwitch {
  recommended_mode: string;
  reasoning: string;
  urgency: string;
}

interface ALISResult {
  short_answer: string;
  step_by_step: string[];
  concept_clarity: string;
  option_elimination: string;
  shortcut_tricks: string;
  detected_topic: string;
  detected_subtopic: string;
  detected_difficulty: string;
  detected_exam_type: string;
  confidence: number;
  processing_time_ms: number;
  cognitive_gap: CognitiveGap;
  micro_concepts: MicroConcepts;
  exam_impact: ExamImpact;
  explanation_depth: string;
  cross_validation_note: string;
  pre_query_predictions: PreQueryPredictions;
  silent_repair_plan: SilentRepairPlan;
  future_style_questions: FutureQuestion[];
  cognitive_drift: CognitiveDrift;
  personal_examiner: PersonalExaminer;
  strategic_mastery_index: StrategicMasteryIndex;
  strategy_switch: StrategySwitch;
}

const INPUT_MODES = [
  { key: "scan" as InputMode, icon: Camera, label: "Scan", accent: "187 100% 50%" },
  { key: "text" as InputMode, icon: Type, label: "Type", accent: "262 100% 65%" },
  { key: "upload" as InputMode, icon: FileText, label: "PDF", accent: "155 100% 50%" },
  { key: "url" as InputMode, icon: Link, label: "URL", accent: "40 100% 50%" },
];

const GAP_ICONS: Record<string, string> = {
  conceptual_gap: "🧠", retrieval_failure: "🔄", interference_confusion: "⚡",
  speed_weakness: "⏱️", pattern_unfamiliarity: "🔍",
};

const SEVERITY_STYLES: Record<string, string> = {
  high: "bg-destructive/20 text-destructive border-destructive/30",
  medium: "bg-warning/20 text-warning border-warning/30",
  low: "bg-success/20 text-success border-success/30",
};

export default function BrainLensModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ALISResult | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(["answer"]));
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = document.querySelector(".app-device-inner") as HTMLElement;
    if (el) setPortalTarget(el);
  }, []);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleImageCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = (reader.result as string).split(",")[1];
      setImageBase64(base64);
      setContent(file.name);
    };
    reader.readAsDataURL(file);
  }, []);

  const solve = async () => {
    if (!content && !imageBase64) { toast.error("Please enter a question or upload an image"); return; }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("brainlens-solve", {
        body: { input_type: mode, content: content || undefined, image_base64: imageBase64 || undefined },
      });
      if (error) throw error;
      setResult(data);
      setExpandedCards(new Set(["answer", "concepts", "future", "examiner"]));
    } catch (e: any) {
      toast.error(e.message || "Failed to solve");
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 30, stiffness: 280 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(165deg, hsl(240 15% 6%), hsl(250 20% 8%) 40%, hsl(240 15% 6%))" }}
    >
      {/* Layered ambient mesh */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 120% 80% at 20% 10%, hsl(262 100% 65% / 0.07), transparent 60%)" }} />
        <div className="absolute inset-0" style={{ background: "radial-gradient(ellipse 100% 60% at 80% 90%, hsl(187 100% 50% / 0.05), transparent 50%)" }} />
        <motion.div className="absolute w-[500px] h-[500px] rounded-full opacity-30" style={{ background: "conic-gradient(from 0deg, hsl(262 100% 65% / 0.08), hsl(187 100% 50% / 0.06), transparent, hsl(0 72% 51% / 0.04), hsl(262 100% 65% / 0.08))", top: "-200px", left: "-150px", filter: "blur(80px)" }} animate={{ rotate: 360 }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }} />
        {/* Grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: "linear-gradient(hsl(0 0% 100%) 1px, transparent 1px), linear-gradient(90deg, hsl(0 0% 100%) 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
      </div>

      {/* Header */}
      <header className="relative px-4 py-3 flex items-center gap-3 z-50" style={{ borderBottom: "1px solid hsl(262 100% 65% / 0.12)" }}>
        <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, hsl(262 100% 65% / 0.06), transparent)" }} />
        <motion.button onClick={onClose} className="relative z-10 w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: "hsl(0 0% 100% / 0.04)", border: "1px solid hsl(0 0% 100% / 0.06)" }} whileTap={{ scale: 0.9 }}>
          <ArrowLeft className="w-4 h-4 text-foreground/70" />
        </motion.button>
        <div className="flex items-center gap-3 flex-1 relative z-10">
          <ALISLogo />
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className="text-sm font-black tracking-[0.15em] uppercase font-display" style={{ background: "linear-gradient(135deg, hsl(187 100% 60%), hsl(262 100% 75%), hsl(0 72% 60%))", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>ALIS</h1>
              <span className="text-[7px] font-bold px-1.5 py-0.5 rounded-md uppercase tracking-wider" style={{ background: "hsl(0 72% 51% / 0.15)", color: "hsl(0 72% 65%)", border: "1px solid hsl(0 72% 51% / 0.2)" }}>Ω</span>
            </div>
            <p className="text-[8px] text-foreground/30 tracking-wider uppercase">Autonomous Learning Intervention</p>
          </div>
        </div>
        <ConfidenceBadge value={result?.confidence} />
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
        <div className="px-4 py-4 space-y-4 pb-8">
          {!result ? (
            <InputView
              mode={mode} setMode={setMode} content={content} setContent={setContent}
              imageBase64={imageBase64} setImageBase64={setImageBase64}
              loading={loading} solve={solve}
              fileRef={fileRef} cameraRef={cameraRef} handleImageCapture={handleImageCapture}
            />
          ) : (
            <ResultView result={result} expandedCards={expandedCards} toggleCard={toggleCard}
              onReset={() => { setResult(null); setContent(""); setImageBase64(null); setExpandedCards(new Set(["answer"])); }}
            />
          )}
        </div>
      </div>
    </motion.div>
  );

  if (portalTarget) return createPortal(modalContent, portalTarget);
  return modalContent;
}

/* ═══════════════════════════════════════════════════
   INPUT VIEW
   ═══════════════════════════════════════════════════ */

function InputView({ mode, setMode, content, setContent, imageBase64, setImageBase64, loading, solve, fileRef, cameraRef, handleImageCapture }: any) {
  return (
    <>
      {/* Mode Selector — horizontal pill bar */}
      <div className="flex gap-1.5 p-1 rounded-2xl" style={{ background: "hsl(0 0% 100% / 0.03)", border: "1px solid hsl(0 0% 100% / 0.05)" }}>
        {INPUT_MODES.map(({ key, icon: Icon, label, accent }) => {
          const active = mode === key;
          return (
            <motion.button key={key} onClick={() => { setMode(key); setImageBase64(null); setContent(""); }}
              className="flex-1 relative flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-bold transition-all"
              whileTap={{ scale: 0.95 }}
            >
              {active && (
                <motion.div layoutId="alis-mode-pill" className="absolute inset-0 rounded-xl"
                  style={{ background: `hsl(${accent} / 0.12)`, border: `1px solid hsl(${accent} / 0.25)`, boxShadow: `0 0 20px hsl(${accent} / 0.1)` }}
                  transition={{ type: "spring", stiffness: 400, damping: 30 }} />
              )}
              <Icon className={`w-3.5 h-3.5 relative z-10 ${active ? "text-foreground" : "text-foreground/30"}`} />
              <span className={`relative z-10 ${active ? "text-foreground" : "text-foreground/30"}`}>{label}</span>
            </motion.button>
          );
        })}
      </div>

      {/* Input Area */}
      <motion.div layout className="rounded-2xl p-4 space-y-3 relative overflow-hidden" style={{ background: "hsl(0 0% 100% / 0.02)", border: "1px solid hsl(0 0% 100% / 0.06)" }}>
        <ScanlineEffect />
        <div className="flex items-center gap-2 mb-1 relative z-10">
          <div className="w-1.5 h-4 rounded-full" style={{ background: "linear-gradient(180deg, hsl(187 100% 50%), hsl(262 100% 65%))" }} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/40">
            {mode === "scan" ? "Scan Question" : mode === "upload" ? "Upload File" : mode === "url" ? "Paste URL" : "Your Question"}
          </span>
        </div>

        {mode === "scan" && (
          <>
            <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
            <button onClick={() => cameraRef.current?.click()} className="w-full h-28 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-colors relative z-10" style={{ border: "1px dashed hsl(187 100% 50% / 0.25)", background: "hsl(187 100% 50% / 0.02)" }}>
              <motion.div animate={imageBase64 ? {} : { y: [0, -4, 0] }} transition={{ duration: 2, repeat: Infinity }} className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "hsl(187 100% 50% / 0.1)" }}>
                {imageBase64 ? <CheckCircle className="w-6 h-6 text-success" /> : <Camera className="w-6 h-6" style={{ color: "hsl(187 100% 50%)" }} />}
              </motion.div>
              <span className="text-[11px] text-foreground/40">{imageBase64 ? "Image captured ✓" : "Tap to open camera"}</span>
            </button>
          </>
        )}
        {mode === "upload" && (
          <>
            <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleImageCapture} />
            <button onClick={() => fileRef.current?.click()} className="w-full h-28 rounded-2xl flex flex-col items-center justify-center gap-2.5 transition-colors relative z-10" style={{ border: "1px dashed hsl(155 100% 50% / 0.25)", background: "hsl(155 100% 50% / 0.02)" }}>
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ background: "hsl(155 100% 50% / 0.1)" }}>
                {imageBase64 ? <CheckCircle className="w-6 h-6 text-success" /> : <FileText className="w-6 h-6" style={{ color: "hsl(155 100% 50%)" }} />}
              </div>
              <span className="text-[11px] text-foreground/40">{imageBase64 ? content : "Upload PDF or Image"}</span>
            </button>
          </>
        )}
        {mode === "url" && <Input placeholder="https://..." value={content} onChange={(e: any) => setContent(e.target.value)} className="bg-transparent border-foreground/10 rounded-xl h-12 text-sm placeholder:text-foreground/20 relative z-10 focus:border-primary/40" />}
        {mode === "text" && <Textarea placeholder="Type or paste your question here..." value={content} onChange={(e: any) => setContent(e.target.value)} rows={5} className="bg-transparent border-foreground/10 resize-none rounded-xl text-sm placeholder:text-foreground/20 relative z-10 focus:border-primary/40" />}
      </motion.div>

      {/* Solve Button */}
      <motion.button whileTap={{ scale: 0.97 }} whileHover={{ scale: 1.01 }} onClick={solve} disabled={loading || (!content && !imageBase64)}
        className="w-full h-14 rounded-2xl text-sm font-bold text-white relative overflow-hidden disabled:opacity-30 disabled:cursor-not-allowed group"
        style={{ background: "linear-gradient(135deg, hsl(262 100% 55%), hsl(262 80% 45%))" }}
      >
        <div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "linear-gradient(135deg, hsl(262 100% 60%), hsl(187 100% 45%))" }} />
        <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent 20%, hsl(0 0% 100% / 0.08) 50%, transparent 80%)" }} animate={{ x: ["-200%", "200%"] }} transition={{ duration: 3, repeat: Infinity, ease: "linear" }} />
        {loading ? (
          <div className="flex items-center justify-center gap-3 relative z-10"><LoadingOrb /><span className="tracking-wider">ALIS Processing...</span></div>
        ) : (
          <div className="flex items-center justify-center gap-2.5 relative z-10">
            <Zap className="w-4.5 h-4.5" />
            <span className="tracking-wider uppercase text-[13px]">Analyze with ALIS</span>
          </div>
        )}
      </motion.button>

      {/* Animated Progress Bar during analysis */}
      <AnimatePresence>
        {loading && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-2xl"
            style={{ background: "hsl(0 0% 100% / 0.02)", border: "1px solid hsl(262 100% 65% / 0.12)" }}
          >
            <AIProgressBar
              label="ALIS Ω analyzing your question"
              sublabel="Deep cognitive scan in progress"
              estimatedSeconds={6}
            />
          </motion.div>
        )}
      </AnimatePresence>

      <p className="text-[9px] text-foreground/20 text-center tracking-widest uppercase">Powered by ACRY ALIS Ω • Cognitive Intelligence Engine</p>
    </>
  );
}

/* ═══════════════════════════════════════════════════
   RESULT VIEW
   ═══════════════════════════════════════════════════ */

function ResultView({ result, expandedCards, toggleCard, onReset }: { result: ALISResult; expandedCards: Set<string>; toggleCard: (id: string) => void; onReset: () => void }) {
  return (
    <div className="space-y-3">
      {/* Topic Meta Bar */}
      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-1.5">
        {result.detected_topic && <TopicTag text={result.detected_topic} accent="262 100% 65%" />}
        {result.detected_subtopic && <TopicTag text={result.detected_subtopic} accent="187 100% 50%" />}
        {result.detected_difficulty && (
          <TopicTag text={result.detected_difficulty} accent={result.detected_difficulty === "hard" ? "0 72% 51%" : result.detected_difficulty === "medium" ? "40 100% 50%" : "155 100% 50%"} />
        )}
        {result.detected_exam_type && <TopicTag text={result.detected_exam_type} accent="0 0% 50%" />}
      </motion.div>

      {/* ── COMMAND CENTER: SMI + Confidence ── */}
      {result.strategic_mastery_index?.smi_score > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "linear-gradient(145deg, hsl(262 40% 12%), hsl(240 20% 10%))", border: "1px solid hsl(262 100% 65% / 0.15)" }}
        >
          <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(circle at 30% 20%, hsl(262 100% 65% / 0.08), transparent 60%)" }} />
          <motion.div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, hsl(262 100% 65% / 0.4), hsl(187 100% 50% / 0.3), transparent)" }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 3, repeat: Infinity }} />

          <div className="flex items-center justify-between mb-3 relative z-10">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "hsl(262 100% 65% / 0.15)" }}>
                <Gauge className="w-3.5 h-3.5" style={{ color: "hsl(262 100% 75%)" }} />
              </div>
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-foreground/50">Strategic Mastery</span>
            </div>
            {result.strategic_mastery_index.mastery_verdict && (
              <span className="text-[9px] font-bold uppercase px-2 py-0.5 rounded-md" style={{
                background: result.strategic_mastery_index.mastery_verdict === "master" ? "hsl(262 100% 65% / 0.15)" : result.strategic_mastery_index.mastery_verdict === "advanced" ? "hsl(155 100% 50% / 0.15)" : "hsl(40 100% 50% / 0.15)",
                color: result.strategic_mastery_index.mastery_verdict === "master" ? "hsl(262 100% 75%)" : result.strategic_mastery_index.mastery_verdict === "advanced" ? "hsl(155 100% 60%)" : "hsl(40 100% 60%)",
              }}>{result.strategic_mastery_index.mastery_verdict}</span>
            )}
          </div>

          {/* Ring gauges */}
          <div className="grid grid-cols-4 gap-2 relative z-10">
            <RingGauge label="SMI" value={result.strategic_mastery_index.smi_score} color="262 100% 65%" />
            <RingGauge label="Reason" value={result.strategic_mastery_index.multi_step_reasoning} color="187 100% 50%" />
            <RingGauge label="Transfer" value={result.strategic_mastery_index.transfer_learning} color="155 100% 50%" />
            <RingGauge label="Trap Res" value={result.strategic_mastery_index.trap_resistance} color="0 72% 51%" />
          </div>
        </motion.div>
      )}

      {/* ── COGNITIVE GAP DIAGNOSIS ── */}
      {result.cognitive_gap && (
        <ALISCard id="gap" title="Cognitive Diagnosis" icon={<Activity className="w-3.5 h-3.5" />}
          accent="262 100% 65%" badge={result.cognitive_gap.code}
          expanded={expandedCards.has("gap")} onToggle={() => toggleCard("gap")} delay={0.08}
        >
          <div className="space-y-2.5">
            <div className="flex items-center gap-2">
              <span className="text-base">{GAP_ICONS[result.cognitive_gap.type] || "🧠"}</span>
              <span className="text-xs font-bold text-foreground/90 capitalize">{result.cognitive_gap.type.replace(/_/g, " ")}</span>
              <span className={`text-[9px] px-2 py-0.5 rounded-md font-bold border ${SEVERITY_STYLES[result.cognitive_gap.severity] || SEVERITY_STYLES.low}`}>
                {result.cognitive_gap.severity}
              </span>
            </div>
            <p className="text-[11px] text-foreground/50 leading-[1.7]">{result.cognitive_gap.explanation}</p>
          </div>
        </ALISCard>
      )}

      {/* ── DIRECT ANSWER ── */}
      <ALISCard id="answer" title="Answer" icon={<CheckCircle className="w-3.5 h-3.5" />}
        accent="155 100% 50%" badge={`${Math.round(result.confidence * 100)}%`}
        expanded={expandedCards.has("answer")} onToggle={() => toggleCard("answer")} delay={0.1}
      >
        <p className="text-[13px] font-medium text-foreground/90 leading-[1.8]">{result.short_answer}</p>
        {result.cross_validation_note && (
          <div className="mt-2.5 px-3 py-2 rounded-xl" style={{ background: "hsl(40 100% 50% / 0.06)", border: "1px solid hsl(40 100% 50% / 0.12)" }}>
            <p className="text-[10px] text-foreground/40 italic">⚠️ {result.cross_validation_note}</p>
          </div>
        )}
      </ALISCard>

      {/* ── EXAM IMPACT ── */}
      {result.exam_impact && (
        <ALISCard id="impact" title="Exam Impact" icon={<BarChart3 className="w-3.5 h-3.5" />}
          accent="40 100% 50%" expanded={expandedCards.has("impact")} onToggle={() => toggleCard("impact")} delay={0.13}
        >
          <div className="grid grid-cols-3 gap-2">
            <StatBlock label="TPI" value={`${(result.exam_impact.topic_probability_index * 100).toFixed(0)}%`} accent="262 100% 65%" />
            <StatBlock label="Boost" value={result.exam_impact.estimated_mastery_boost} accent="155 100% 50%" />
            <StatBlock label="Impact" value={result.exam_impact.readiness_impact} accent={result.exam_impact.readiness_impact === "critical" ? "0 72% 51%" : result.exam_impact.readiness_impact === "high" ? "40 100% 50%" : "155 100% 50%"} />
          </div>
        </ALISCard>
      )}

      {/* ── COGNITIVE DRIFT ── */}
      {result.cognitive_drift?.drift_detected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-2xl p-3.5 relative overflow-hidden"
          style={{ background: "hsl(0 72% 51% / 0.04)", border: "1px solid hsl(0 72% 51% / 0.15)" }}
        >
          <motion.div className="absolute top-0 left-0 right-0 h-[1px]" style={{ background: "linear-gradient(90deg, transparent, hsl(0 72% 51% / 0.5), transparent)" }} animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
          <div className="flex items-center gap-2 mb-2 relative z-10">
            <motion.div animate={{ rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
              <RefreshCw className="w-3.5 h-3.5" style={{ color: "hsl(0 72% 60%)" }} />
            </motion.div>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em]" style={{ color: "hsl(0 72% 65%)" }}>Drift Alert</span>
            <span className="ml-auto text-[9px] font-mono px-1.5 py-0.5 rounded-md" style={{ background: "hsl(0 72% 51% / 0.12)", color: "hsl(0 72% 65%)" }}>
              {(result.cognitive_drift.drift_magnitude * 100).toFixed(0)}%
            </span>
          </div>
          {result.cognitive_drift.drift_direction && (
            <p className="text-[10px] font-semibold mb-1 relative z-10" style={{ color: "hsl(0 72% 65%)" }}>↗ {result.cognitive_drift.drift_direction.replace(/_/g, " ")}</p>
          )}
          <p className="text-[11px] text-foreground/45 leading-[1.6] relative z-10">{result.cognitive_drift.recalibration}</p>
          {result.cognitive_drift.spacing_adjustment && (
            <p className="text-[9px] text-foreground/30 mt-1.5 relative z-10">📐 <span className="font-bold text-foreground/60">{result.cognitive_drift.spacing_adjustment}</span></p>
          )}
        </motion.div>
      )}

      {/* ── STRATEGY SWITCH ── */}
      {result.strategy_switch?.recommended_mode && (
        <ALISCard id="strategy" title="Strategy Switch" icon={<Cpu className="w-3.5 h-3.5" />}
          accent="187 100% 50%" badge={result.strategy_switch.urgency}
          expanded={expandedCards.has("strategy")} onToggle={() => toggleCard("strategy")} delay={0.18}
        >
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-foreground/80 capitalize">{result.strategy_switch.recommended_mode.replace(/_/g, " ")}</span>
            </div>
            <p className="text-[11px] text-foreground/45 leading-[1.7]">{result.strategy_switch.reasoning}</p>
          </div>
        </ALISCard>
      )}

      {/* ── STEP BY STEP ── */}
      <ALISCard id="steps" title="Step-by-Step" icon={<BookOpen className="w-3.5 h-3.5" />}
        accent="187 100% 50%" expanded={expandedCards.has("steps")} onToggle={() => toggleCard("steps")} delay={0.2}
      >
        <div className="space-y-2">
          {result.step_by_step.map((step, i) => (
            <motion.div key={i} className="flex gap-3 items-start" initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}>
              <div className="w-6 h-6 rounded-lg flex items-center justify-center shrink-0 mt-0.5" style={{ background: "hsl(187 100% 50% / 0.1)", border: "1px solid hsl(187 100% 50% / 0.15)" }}>
                <span className="text-[9px] font-bold" style={{ color: "hsl(187 100% 60%)" }}>{i + 1}</span>
              </div>
              <span className="text-[11px] text-foreground/55 leading-[1.7] flex-1">{step}</span>
            </motion.div>
          ))}
        </div>
      </ALISCard>

      {/* ── CONCEPT CLARITY ── */}
      <ALISCard id="concept" title="Concept Clarity" icon={<Lightbulb className="w-3.5 h-3.5" />}
        accent="262 100% 65%" expanded={expandedCards.has("concept")} onToggle={() => toggleCard("concept")} delay={0.22}
      >
        <p className="text-[11px] text-foreground/50 leading-[1.8]">{result.concept_clarity}</p>
      </ALISCard>

      {/* ── OPTION ELIMINATION ── */}
      {result.option_elimination && (
        <ALISCard id="elim" title="Option Elimination" icon={<Target className="w-3.5 h-3.5" />}
          accent="0 72% 51%" expanded={expandedCards.has("elim")} onToggle={() => toggleCard("elim")} delay={0.24}
        >
          <p className="text-[11px] text-foreground/50 leading-[1.8]">{result.option_elimination}</p>
        </ALISCard>
      )}

      {/* ── SHORTCUT TRICKS ── */}
      {result.shortcut_tricks && (
        <ALISCard id="tricks" title="Shortcut Tricks" icon={<Zap className="w-3.5 h-3.5" />}
          accent="40 100% 50%" expanded={expandedCards.has("tricks")} onToggle={() => toggleCard("tricks")} delay={0.26}
        >
          <p className="text-[11px] text-foreground/50 leading-[1.8]">{result.shortcut_tricks}</p>
        </ALISCard>
      )}

      {/* ── KNOWLEDGE GRAPH ── */}
      {result.micro_concepts?.core && (
        <ALISCard id="graph" title="Knowledge Graph" icon={<Network className="w-3.5 h-3.5" />}
          accent="187 100% 50%" expanded={expandedCards.has("graph")} onToggle={() => toggleCard("graph")} delay={0.28}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-1" style={{ color: "hsl(187 100% 55%)" }}>Core Node</p>
              <p className="text-xs text-foreground/70 font-medium">{result.micro_concepts.core}</p>
            </div>
            {result.micro_concepts.adjacent_nodes?.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-foreground/30 mb-1.5">Adjacent Nodes</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.micro_concepts.adjacent_nodes.map((n, i) => (
                    <span key={i} className="px-2.5 py-1 rounded-lg text-[9px] font-medium" style={{ background: "hsl(187 100% 50% / 0.08)", color: "hsl(187 100% 60%)", border: "1px solid hsl(187 100% 50% / 0.15)" }}>{n}</span>
                  ))}
                </div>
              </div>
            )}
            {result.micro_concepts.reinforcement_questions?.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-2" style={{ color: "hsl(262 100% 70%)" }}>🎯 Reinforcement</p>
                {result.micro_concepts.reinforcement_questions.map((rq, i) => (
                  <div key={i} className="rounded-xl p-2.5 mb-1.5 flex items-start gap-2.5" style={{ background: "hsl(0 0% 100% / 0.02)", border: "1px solid hsl(0 0% 100% / 0.05)" }}>
                    <div className="w-5 h-5 rounded-md shrink-0 mt-0.5 flex items-center justify-center text-[8px] font-bold" style={{
                      background: rq.difficulty === "hard" ? "hsl(0 72% 51% / 0.12)" : rq.difficulty === "medium" ? "hsl(40 100% 50% / 0.12)" : "hsl(155 100% 50% / 0.12)",
                      color: rq.difficulty === "hard" ? "hsl(0 72% 60%)" : rq.difficulty === "medium" ? "hsl(40 100% 60%)" : "hsl(155 100% 60%)",
                    }}>{i + 1}</div>
                    <p className="text-[11px] text-foreground/50 leading-[1.6]">{rq.question}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ALISCard>
      )}

      {/* ── PRE-QUERY PREDICTIONS ── */}
      {result.pre_query_predictions?.weak_concepts?.length > 0 && (
        <ALISCard id="predict" title="Pre-Query Prediction" icon={<Eye className="w-3.5 h-3.5" />}
          accent="0 72% 51%" expanded={expandedCards.has("predict")} onToggle={() => toggleCard("predict")} delay={0.3}
        >
          <div className="space-y-2.5">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.15em] mb-1.5" style={{ color: "hsl(0 72% 60%)" }}>Predicted Weak Concepts</p>
              <div className="flex flex-wrap gap-1.5">
                {result.pre_query_predictions.weak_concepts.map((c, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-[9px] font-medium" style={{ background: "hsl(0 72% 51% / 0.08)", color: "hsl(0 72% 65%)", border: "1px solid hsl(0 72% 51% / 0.15)" }}>{c}</span>
                ))}
              </div>
            </div>
            {result.pre_query_predictions.preventive_challenge && (
              <div className="rounded-xl p-3" style={{ background: "hsl(40 100% 50% / 0.04)", border: "1px solid hsl(40 100% 50% / 0.12)" }}>
                <p className="text-[9px] font-bold uppercase mb-1" style={{ color: "hsl(40 100% 60%)" }}>⚡ Preventive Challenge</p>
                <p className="text-[11px] text-foreground/60 leading-[1.6]">{result.pre_query_predictions.preventive_challenge}</p>
              </div>
            )}
          </div>
        </ALISCard>
      )}

      {/* ── PERSONAL EXAMINER ── */}
      {result.personal_examiner?.trap_questions?.length > 0 && (
        <ALISCard id="examiner" title="Personal Examiner" icon={<Crosshair className="w-3.5 h-3.5" />}
          accent="262 100% 65%" expanded={expandedCards.has("examiner")} onToggle={() => toggleCard("examiner")} delay={0.32}
        >
          <div className="space-y-2.5">
            <div className="flex items-center gap-4 mb-2">
              <div className="text-center">
                <div className="text-lg font-bold font-display" style={{ color: "hsl(262 100% 75%)" }}>{result.personal_examiner.conceptual_depth_score}</div>
                <div className="text-[8px] text-foreground/30 uppercase">Depth</div>
              </div>
              <span className="text-[9px] font-bold px-2.5 py-1 rounded-lg" style={{
                background: result.personal_examiner.robustness_rating === "bulletproof" ? "hsl(262 100% 65% / 0.12)" : result.personal_examiner.robustness_rating === "robust" ? "hsl(155 100% 50% / 0.12)" : result.personal_examiner.robustness_rating === "developing" ? "hsl(40 100% 50% / 0.12)" : "hsl(0 72% 51% / 0.12)",
                color: result.personal_examiner.robustness_rating === "bulletproof" ? "hsl(262 100% 75%)" : result.personal_examiner.robustness_rating === "robust" ? "hsl(155 100% 60%)" : result.personal_examiner.robustness_rating === "developing" ? "hsl(40 100% 60%)" : "hsl(0 72% 60%)",
              }}>{result.personal_examiner.robustness_rating}</span>
            </div>
            {result.personal_examiner.trap_questions.map((tq, i) => (
              <div key={i} className="rounded-xl p-2.5" style={{ background: "hsl(0 0% 100% / 0.02)", border: "1px solid hsl(0 0% 100% / 0.05)" }}>
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md" style={{ background: "hsl(0 72% 51% / 0.12)", color: "hsl(0 72% 60%)" }}>TRAP</span>
                  <span className="text-[8px] text-foreground/30">{tq.trap_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[11px] text-foreground/60 leading-[1.6]">{tq.question}</p>
              </div>
            ))}
          </div>
        </ALISCard>
      )}

      {/* ── FUTURE-STYLE QUESTIONS ── */}
      {result.future_style_questions?.length > 0 && (
        <ALISCard id="future" title="Future Questions" icon={<TrendingUp className="w-3.5 h-3.5" />}
          accent="155 100% 50%" expanded={expandedCards.has("future")} onToggle={() => toggleCard("future")} delay={0.34}
        >
          <div className="space-y-2">
            {result.future_style_questions.map((fq, i) => (
              <div key={i} className="rounded-xl p-2.5" style={{ background: "hsl(0 0% 100% / 0.02)", border: "1px solid hsl(0 0% 100% / 0.05)" }}>
                <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
                  <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-md" style={{ background: "hsl(187 100% 50% / 0.1)", color: "hsl(187 100% 60%)" }}>{fq.question_dna}</span>
                  <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-md" style={{
                    background: fq.topic_momentum === "rising" ? "hsl(155 100% 50% / 0.1)" : fq.topic_momentum === "declining" ? "hsl(0 72% 51% / 0.1)" : "hsl(0 0% 50% / 0.1)",
                    color: fq.topic_momentum === "rising" ? "hsl(155 100% 60%)" : fq.topic_momentum === "declining" ? "hsl(0 72% 60%)" : "hsl(0 0% 60%)",
                  }}>{fq.topic_momentum === "rising" ? "↑" : fq.topic_momentum === "declining" ? "↓" : "→"} {fq.topic_momentum}</span>
                  <span className="text-[8px] text-foreground/25">P: {(fq.exam_probability * 100).toFixed(0)}%</span>
                </div>
                <p className="text-[11px] text-foreground/60 leading-[1.6]">{fq.question}</p>
              </div>
            ))}
          </div>
        </ALISCard>
      )}

      {/* ── SILENT REPAIR ── */}
      {result.silent_repair_plan?.repair_strategy && (
        <ALISCard id="repair" title="Silent Repair Plan" icon={<Shield className="w-3.5 h-3.5" />}
          accent="0 0% 50%" expanded={expandedCards.has("repair")} onToggle={() => toggleCard("repair")} delay={0.36}
        >
          <div className="space-y-2">
            <p className="text-[11px] text-foreground/50 leading-[1.7]">{result.silent_repair_plan.repair_strategy}</p>
            {result.silent_repair_plan.unstable_nodes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.silent_repair_plan.unstable_nodes.map((n, i) => (
                  <span key={i} className="px-2.5 py-1 rounded-lg text-[9px] font-medium" style={{ background: "hsl(40 100% 50% / 0.08)", color: "hsl(40 100% 55%)", border: "1px solid hsl(40 100% 50% / 0.12)" }}>⚠ {n}</span>
                ))}
              </div>
            )}
          </div>
        </ALISCard>
      )}

      {/* Footer Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }} className="flex items-center justify-center gap-4 py-2">
        <FooterStat icon="⚡" text={`${(result.processing_time_ms / 1000).toFixed(1)}s`} />
        <div className="w-1 h-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.08)" }} />
        <FooterStat icon="🎯" text={`${Math.round(result.confidence * 100)}%`} />
        <div className="w-1 h-1 rounded-full" style={{ background: "hsl(0 0% 100% / 0.08)" }} />
        <FooterStat icon="Ω" text="ALIS v3.0" />
      </motion.div>

      {/* Ask Another */}
      <motion.button whileTap={{ scale: 0.97 }} onClick={onReset}
        className="w-full h-12 rounded-2xl text-sm font-semibold flex items-center justify-center gap-2 relative overflow-hidden"
        style={{ background: "hsl(0 0% 100% / 0.03)", border: "1px solid hsl(0 0% 100% / 0.06)" }}
      >
        <motion.div className="absolute inset-0" style={{ background: "linear-gradient(90deg, transparent, hsl(262 100% 65% / 0.04), transparent)" }} animate={{ x: ["-100%", "200%"] }} transition={{ duration: 4, repeat: Infinity }} />
        <Sparkles className="w-4 h-4 relative z-10" style={{ color: "hsl(262 100% 70%)" }} />
        <span className="relative z-10 text-foreground/60">Ask Another Question</span>
      </motion.button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════ */

function ALISCard({ id, title, icon, accent, badge, expanded, onToggle, delay = 0, children }: {
  id: string; title: string; icon: React.ReactNode; accent: string; badge?: string;
  expanded: boolean; onToggle: () => void; delay?: number; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-2xl overflow-hidden relative"
      style={{ background: "hsl(0 0% 100% / 0.02)", border: `1px solid hsl(${accent} / ${expanded ? 0.15 : 0.06})`, transition: "border-color 0.3s" }}
    >
      {expanded && <motion.div className="absolute top-0 left-0 right-0 h-[1px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ background: `linear-gradient(90deg, transparent, hsl(${accent} / 0.4), transparent)` }} />}
      <button onClick={onToggle} className="w-full flex items-center gap-2.5 px-3.5 py-3 relative z-10">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: `hsl(${accent} / 0.1)`, color: `hsl(${accent})` }}>
          {icon}
        </div>
        <span className="text-[11px] font-bold uppercase tracking-[0.12em] flex-1 text-left text-foreground/70">{title}</span>
        {badge && (
          <span className="text-[8px] font-mono px-1.5 py-0.5 rounded-md" style={{ background: `hsl(${accent} / 0.08)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.15)` }}>{badge}</span>
        )}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
          <ChevronDown className="w-4 h-4 text-foreground/20" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25, ease: "easeOut" }} className="overflow-hidden">
            <div className="px-3.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function RingGauge({ label, value, color }: { label: string; value: number; color: string }) {
  const r = 22, c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(value, 100) / 100);
  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative w-[52px] h-[52px]">
        <svg viewBox="0 0 56 56" className="w-full h-full -rotate-90">
          <circle cx="28" cy="28" r={r} fill="none" stroke="hsl(0 0% 100% / 0.04)" strokeWidth="3" />
          <motion.circle cx="28" cy="28" r={r} fill="none" stroke={`hsl(${color})`} strokeWidth="3" strokeLinecap="round"
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
            style={{ filter: `drop-shadow(0 0 4px hsl(${color} / 0.4))` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[11px] font-bold font-display" style={{ color: `hsl(${color})` }}>{value}</span>
        </div>
      </div>
      <span className="text-[7px] font-bold uppercase tracking-wider text-foreground/25">{label}</span>
    </div>
  );
}

function StatBlock({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="text-center rounded-xl p-2.5" style={{ background: "hsl(0 0% 100% / 0.02)", border: "1px solid hsl(0 0% 100% / 0.05)" }}>
      <div className="text-sm font-bold capitalize font-display" style={{ color: `hsl(${accent})` }}>{value}</div>
      <div className="text-[7px] text-foreground/25 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

function TopicTag({ text, accent }: { text: string; accent: string }) {
  return (
    <motion.span initial={{ opacity: 0, scale: 0.85 }} animate={{ opacity: 1, scale: 1 }}
      className="px-2.5 py-1 rounded-lg text-[9px] font-bold capitalize"
      style={{ background: `hsl(${accent} / 0.08)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.15)` }}
    >{text}</motion.span>
  );
}

function FooterStat({ icon, text }: { icon: string; text: string }) {
  return <span className="text-[9px] text-foreground/20">{icon} {text}</span>;
}

function ALISLogo() {
  return (
    <motion.div className="w-10 h-10 rounded-xl flex items-center justify-center relative"
      style={{ background: "linear-gradient(135deg, hsl(262 50% 15%), hsl(240 30% 12%))", border: "1px solid hsl(262 100% 65% / 0.2)" }}
    >
      {/* Rotating border */}
      <motion.div className="absolute -inset-[1px] rounded-xl"
        style={{ background: "conic-gradient(from 0deg, hsl(262 100% 65% / 0.4), hsl(187 100% 50% / 0.3), transparent 40%, transparent 60%, hsl(0 72% 51% / 0.3), hsl(262 100% 65% / 0.4))", mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", maskComposite: "exclude", WebkitMaskComposite: "xor", padding: "1px" }}
        animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
      />
      <Brain className="w-5 h-5 relative z-10" style={{ color: "hsl(262 100% 75%)" }} />
    </motion.div>
  );
}

function ConfidenceBadge({ value }: { value?: number }) {
  if (!value) return (
    <div className="flex items-center gap-1 px-2.5 py-1 rounded-lg" style={{ background: "hsl(0 0% 100% / 0.03)", border: "1px solid hsl(0 0% 100% / 0.06)" }}>
      <div className="w-1.5 h-1.5 rounded-full" style={{ background: "hsl(155 100% 50%)" }} />
      <span className="text-[8px] font-bold text-foreground/30 uppercase tracking-wider">Ready</span>
    </div>
  );
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "155 100% 50%" : pct >= 50 ? "40 100% 50%" : "0 72% 51%";
  return (
    <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg" style={{ background: `hsl(${color} / 0.06)`, border: `1px solid hsl(${color} / 0.15)` }}>
      <span className="text-[9px] font-bold font-display" style={{ color: `hsl(${color})` }}>{pct}%</span>
    </div>
  );
}

function ScanlineEffect() {
  return (
    <motion.div className="absolute left-0 right-0 h-[1px] pointer-events-none z-0"
      style={{ background: "linear-gradient(90deg, transparent 10%, hsl(262 100% 65% / 0.15) 50%, transparent 90%)" }}
      animate={{ top: ["0%", "100%", "0%"] }}
      transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
    />
  );
}

function LoadingOrb() {
  return (
    <div className="relative w-8 h-8">
      <motion.div className="absolute inset-0 rounded-full" style={{ border: "2px solid hsl(0 0% 100% / 0.1)" }} />
      <motion.div className="absolute inset-0 rounded-full" style={{ border: "2px solid transparent", borderTopColor: "hsl(262 100% 75%)", borderRightColor: "hsl(187 100% 60%)" }} animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }} />
      <motion.div className="absolute inset-1.5 rounded-full" style={{ border: "1.5px solid transparent", borderBottomColor: "hsl(0 72% 60%)" }} animate={{ rotate: -360 }} transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }} />
      <Brain className="w-3 h-3 absolute inset-0 m-auto text-white/80" />
    </div>
  );
}
