import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Camera, FileText, Link, Type, Brain, CheckCircle, Zap, BookOpen, Target,
  Lightbulb, ArrowLeft, Sparkles, Activity, Network, BarChart3, Shield,
  GraduationCap, Eye, Crosshair, TrendingUp, RefreshCw, Cpu, Gauge,
  ChevronDown, Wand2, Send, ImageIcon, Globe, PenTool, Atom, Star,
  Trophy, Flame, CircleDot, Layers
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom";
import AIProgressBar from "./AIProgressBar";

interface Suggestion {
  question: string;
  subject: string;
  topic: string;
  difficulty: string;
}

type InputMode = "scan" | "upload" | "url" | "text";

interface CognitiveGap { type: string; code: string; explanation: string; severity: string; }
interface MicroConcepts { core: string; adjacent_nodes: string[]; reinforcement_questions: { question: string; difficulty: string }[]; }
interface ExamImpact { topic_probability_index: number; estimated_mastery_boost: string; readiness_impact: string; related_pyq_patterns: string[]; }
interface PreQueryPredictions { weak_concepts: string[]; preventive_challenge: string | null; prediction_confidence: number; }
interface SilentRepairPlan { stealth_questions: string[]; unstable_nodes: string[]; repair_strategy: string; }
interface FutureQuestion { question: string; question_dna: string; difficulty: string; topic_momentum: string; exam_probability: number; }
interface CognitiveDrift { drift_detected: boolean; drift_magnitude: number; drift_direction?: string; recalibration: string; spacing_adjustment?: string; }
interface PersonalExaminer { trap_questions: { question: string; trap_type: string }[]; conceptual_depth_score: number; robustness_rating: string; }
interface StrategicMasteryIndex { smi_score: number; multi_step_reasoning: number; transfer_learning: number; trap_resistance: number; mastery_verdict?: string; }
interface StrategySwitch { recommended_mode: string; reasoning: string; urgency: string; }

interface ALISResult {
  short_answer: string; step_by_step: string[]; concept_clarity: string; option_elimination: string;
  shortcut_tricks: string; detected_topic: string; detected_subtopic: string; detected_difficulty: string;
  detected_exam_type: string; confidence: number; processing_time_ms: number; cognitive_gap: CognitiveGap;
  micro_concepts: MicroConcepts; exam_impact: ExamImpact; explanation_depth: string; cross_validation_note: string;
  pre_query_predictions: PreQueryPredictions; silent_repair_plan: SilentRepairPlan; future_style_questions: FutureQuestion[];
  cognitive_drift: CognitiveDrift; personal_examiner: PersonalExaminer; strategic_mastery_index: StrategicMasteryIndex;
  strategy_switch: StrategySwitch;
}

const INPUT_MODES = [
  { key: "scan" as InputMode, icon: Camera, label: "Scan", gradient: "from-primary to-primary/60" },
  { key: "text" as InputMode, icon: PenTool, label: "Type", gradient: "from-accent to-accent/60" },
  { key: "upload" as InputMode, icon: ImageIcon, label: "PDF", gradient: "from-success to-success/60" },
  { key: "url" as InputMode, icon: Globe, label: "URL", gradient: "from-warning to-warning/60" },
];

const GAP_ICONS: Record<string, string> = {
  conceptual_gap: "🧠", retrieval_failure: "🔄", interference_confusion: "⚡",
  speed_weakness: "⏱️", pattern_unfamiliarity: "🔍",
};

export default function BrainLensModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ALISResult | null>(null);
  const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set(["answer"]));
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = document.querySelector(".app-device-inner") as HTMLElement;
    if (el) setPortalTarget(el);
  }, []);

  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("brainlens-solve", { body: { action: "suggest" } });
      if (error) throw error;
      setSuggestions(data?.suggestions || []);
    } catch { /* Silent */ } finally { setSuggestionsLoading(false); }
  }, []);

  useEffect(() => { fetchSuggestions(); }, [fetchSuggestions]);

  const toggleCard = (id: string) => {
    setExpandedCards(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const handleImageCapture = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => { setImageBase64((reader.result as string).split(",")[1]); setContent(file.name); };
    reader.readAsDataURL(file);
  }, []);

  const solve = async () => {
    if (!content && !imageBase64) { toast.error("Please enter a question or upload an image"); return; }
    setLoading(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("brainlens-solve", {
        body: { input_type: mode, content: content || undefined, image_base64: imageBase64 || undefined },
      });
      if (error) throw error;
      setResult(data);
      setExpandedCards(new Set(["answer", "concepts", "future", "examiner"]));
    } catch (e: any) { toast.error(e.message || "Failed to solve"); } finally { setLoading(false); }
  };

  const modalContent = (
    <motion.div
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 260 }}
      className="absolute inset-0 z-50 flex flex-col overflow-hidden"
      style={{ background: "linear-gradient(180deg, hsl(var(--background)), hsl(var(--background) / 0.97))" }}
    >
      {/* ═══ Cinematic Ambient Background ═══ */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div className="absolute w-96 h-96 rounded-full blur-[120px]"
          style={{ background: "hsl(var(--primary) / 0.12)", top: "-20%", left: "-25%" }}
          animate={{ opacity: [0.08, 0.2, 0.08], scale: [1, 1.2, 1], x: [0, 30, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div className="absolute w-80 h-80 rounded-full blur-[100px]"
          style={{ background: "hsl(var(--accent) / 0.1)", bottom: "-15%", right: "-20%" }}
          animate={{ opacity: [0.06, 0.16, 0.06], scale: [1, 1.15, 1], y: [0, -20, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 3 }}
        />
        <motion.div className="absolute w-64 h-64 rounded-full blur-[80px]"
          style={{ background: "hsl(var(--success) / 0.06)", top: "40%", left: "50%" }}
          animate={{ opacity: [0.04, 0.1, 0.04] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 5 }}
        />
      </div>

      {/* ═══ Premium Header ═══ */}
      <header className="relative px-4 pt-3 pb-3 z-50">
        <div className="absolute inset-0 glass-strong" style={{ borderBottom: "1px solid hsl(var(--border) / 0.3)" }} />
        <div className="relative flex items-center gap-3">
          <motion.button onClick={onClose} whileTap={{ scale: 0.85 }}
            className="w-10 h-10 rounded-2xl flex items-center justify-center bg-secondary/60 border border-border/40 backdrop-blur-xl"
          >
            <ArrowLeft className="w-4.5 h-4.5 text-muted-foreground" />
          </motion.button>

          <div className="flex items-center gap-3 flex-1">
            <HeroLogo />
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-base font-black tracking-[0.2em] uppercase font-display gradient-text">ALIS</h1>
                <motion.span className="text-[7px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-widest border"
                  style={{ background: "hsl(var(--accent) / 0.12)", color: "hsl(var(--accent))", borderColor: "hsl(var(--accent) / 0.25)" }}
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                >Ω</motion.span>
              </div>
              <p className="text-[8px] tracking-[0.25em] uppercase text-muted-foreground/70 font-medium">Cognitive Intelligence</p>
            </div>
          </div>

          <StatusPill result={result} />
        </div>
      </header>

      {/* ═══ Content ═══ */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative z-10">
        <div className="px-4 py-4 space-y-5 pb-10">
          {!result ? (
            <InputView
              mode={mode} setMode={setMode} content={content} setContent={setContent}
              imageBase64={imageBase64} setImageBase64={setImageBase64}
              loading={loading} solve={solve}
              fileRef={fileRef} cameraRef={cameraRef} handleImageCapture={handleImageCapture}
              suggestions={suggestions} suggestionsLoading={suggestionsLoading} onRefreshSuggestions={fetchSuggestions}
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

/* ═══════════════════════════════════════════════════════════════
   INPUT VIEW – Focus-centric, immersive design
   ═══════════════════════════════════════════════════════════════ */

function InputView({ mode, setMode, content, setContent, imageBase64, setImageBase64, loading, solve, fileRef, cameraRef, handleImageCapture, suggestions, suggestionsLoading, onRefreshSuggestions }: any) {
  const [activePanel, setActivePanel] = useState<InputMode | null>(null);

  const openMode = (key: InputMode) => {
    setMode(key);
    setImageBase64(null);
    setContent("");
    setActivePanel(key);
  };

  const closePanel = () => setActivePanel(null);

  const MODE_CARDS: { key: InputMode; icon: typeof Camera; label: string; desc: string; accentVar: string }[] = [
    { key: "scan", icon: Camera, label: "Scan", desc: "Capture with camera", accentVar: "var(--primary)" },
    { key: "text", icon: PenTool, label: "Type", desc: "Type your question", accentVar: "var(--accent)" },
    { key: "upload", icon: ImageIcon, label: "PDF", desc: "Upload document", accentVar: "var(--success)" },
    { key: "url", icon: Globe, label: "URL", desc: "Paste a link", accentVar: "var(--warning)" },
  ];

  return (
    <>
      {/* ── Welcome Hero ── */}
      <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="text-center space-y-2 py-2">
        <motion.div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-accent/10 border border-accent/20"
          animate={{ boxShadow: ["0 0 0px hsl(var(--accent) / 0)", "0 0 20px hsl(var(--accent) / 0.15)", "0 0 0px hsl(var(--accent) / 0)"] }}
          transition={{ duration: 4, repeat: Infinity }}
        >
          <motion.div animate={{ rotate: 360 }} transition={{ duration: 6, repeat: Infinity, ease: "linear" }}>
            <Atom className="w-3.5 h-3.5 text-accent" />
          </motion.div>
          <span className="text-[10px] font-bold tracking-widest uppercase text-accent">Ask anything</span>
        </motion.div>
        <h2 className="text-lg font-black font-display text-foreground">What would you like to solve?</h2>
        <p className="text-xs text-muted-foreground/70 max-w-[280px] mx-auto leading-relaxed">
          Choose how you want to ask — ALIS analyzes instantly
        </p>
      </motion.div>

      {/* ── Mode Selection Grid ── */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="grid grid-cols-2 gap-3"
      >
        {MODE_CARDS.map(({ key, icon: Icon, label, desc, accentVar }, i) => (
          <motion.button key={key} onClick={() => openMode(key)}
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 + i * 0.06 }}
            whileTap={{ scale: 0.95 }}
            whileHover={{ y: -3 }}
            className="relative rounded-3xl p-5 flex flex-col items-center gap-3 text-center overflow-hidden group"
            style={{
              background: "hsl(var(--card) / 0.5)",
              border: `1px solid hsl(${accentVar} / 0.15)`,
              backdropFilter: "blur(20px)",
            }}
          >
            {/* Hover glow */}
            <motion.div className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
              style={{ background: `radial-gradient(circle at 50% 50%, hsl(${accentVar} / 0.08), transparent 70%)` }}
            />
            {/* Animated icon container */}
            <motion.div className="w-14 h-14 rounded-2xl flex items-center justify-center relative z-10"
              style={{ background: `hsl(${accentVar} / 0.1)`, border: `1px solid hsl(${accentVar} / 0.2)` }}
              animate={{ scale: [1, 1.06, 1] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.4 }}
            >
              <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.3 }}>
                <Icon className="w-6 h-6" style={{ color: `hsl(${accentVar})` }} />
              </motion.div>
            </motion.div>
            <div className="relative z-10">
              <p className="text-xs font-bold text-foreground tracking-wider uppercase">{label}</p>
              <p className="text-[9px] text-muted-foreground/60 mt-0.5">{desc}</p>
            </div>
          </motion.button>
        ))}
      </motion.div>

      {/* ── AI Suggestions Carousel ── */}
      {(suggestionsLoading || suggestions.length > 0) && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }} className="space-y-2.5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <motion.div animate={{ y: [0, -2, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                <Wand2 className="w-3.5 h-3.5 text-warning" />
              </motion.div>
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Suggested for you</span>
            </div>
            <motion.button onClick={onRefreshSuggestions} disabled={suggestionsLoading}
              className="w-7 h-7 rounded-xl flex items-center justify-center bg-secondary/50 border border-border/40"
              whileTap={{ scale: 0.85 }}
              animate={suggestionsLoading ? { rotate: 360 } : {}}
              transition={suggestionsLoading ? { duration: 1, repeat: Infinity, ease: "linear" } : {}}
            >
              <RefreshCw className="w-3 h-3 text-muted-foreground" />
            </motion.button>
          </div>
          {suggestionsLoading && suggestions.length === 0 ? (
            <div className="flex gap-3 overflow-x-auto pb-2">
              {[1, 2, 3].map(i => (
                <div key={i} className="min-w-[220px] h-[90px] rounded-2xl bg-secondary/30 border border-border/30 animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {suggestions.map((s: Suggestion, i: number) => (
                <SuggestionCard key={i} s={s} i={i} onClick={() => { setActivePanel("text"); setMode("text"); setContent(s.question); setImageBase64(null); }} />
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Footer */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="flex items-center justify-center gap-2 py-1">
        <motion.div animate={{ opacity: [0.3, 0.7, 0.3] }} transition={{ duration: 3, repeat: Infinity }}>
          <CircleDot className="w-2.5 h-2.5 text-primary/50" />
        </motion.div>
        <span className="text-[8px] tracking-[0.3em] uppercase text-muted-foreground/40 font-medium">ACRY ALIS Ω • Cognitive Engine</span>
      </motion.div>

      {/* ═══ Input Panel Overlay ═══ */}
      <AnimatePresence>
        {activePanel && (
          <InputPanel
            mode={activePanel} content={content} setContent={setContent}
            imageBase64={imageBase64} setImageBase64={setImageBase64}
            loading={loading} solve={() => { closePanel(); solve(); }}
            fileRef={fileRef} cameraRef={cameraRef} handleImageCapture={handleImageCapture}
            onClose={closePanel}
          />
        )}
      </AnimatePresence>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════
   INPUT PANEL – Slide-up overlay for each mode
   ═══════════════════════════════════════════════════════════════ */

function InputPanel({ mode, content, setContent, imageBase64, setImageBase64, loading, solve, fileRef, cameraRef, handleImageCapture, onClose }: any) {
  const modeConfig: Record<InputMode, { icon: typeof Camera; title: string; accentVar: string }> = {
    scan: { icon: Camera, title: "Scan Question", accentVar: "var(--primary)" },
    text: { icon: PenTool, title: "Type Question", accentVar: "var(--accent)" },
    upload: { icon: ImageIcon, title: "Upload Document", accentVar: "var(--success)" },
    url: { icon: Globe, title: "Paste URL", accentVar: "var(--warning)" },
  };

  const cfg = modeConfig[mode as InputMode];
  const ModeIcon = cfg.icon;

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] flex items-end justify-center"
      style={{ background: "hsl(0 0% 0% / 0.5)", backdropFilter: "blur(8px)" }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
        transition={{ type: "spring", damping: 28, stiffness: 280 }}
        className="w-full max-w-[430px] rounded-t-[2rem] overflow-hidden flex flex-col"
        style={{
          background: "hsl(var(--background))",
          border: "1px solid hsl(var(--border) / 0.3)",
          borderBottom: "none",
          maxHeight: "85vh",
          boxShadow: "0 -10px 60px hsl(0 0% 0% / 0.3)",
        }}
      >
        {/* Panel Header */}
        <div className="px-5 pt-4 pb-3 flex items-center gap-3">
          {/* Drag handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/20" />

          <motion.div className="w-10 h-10 rounded-2xl flex items-center justify-center"
            style={{ background: `hsl(${cfg.accentVar} / 0.1)`, border: `1px solid hsl(${cfg.accentVar} / 0.2)` }}
            animate={{ scale: [1, 1.08, 1] }} transition={{ duration: 3, repeat: Infinity }}
          >
            <ModeIcon className="w-5 h-5" style={{ color: `hsl(${cfg.accentVar})` }} />
          </motion.div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">{cfg.title}</h3>
            <p className="text-[9px] text-muted-foreground/60 uppercase tracking-widest">ALIS Ω Analysis</p>
          </div>
          <motion.button onClick={onClose} whileTap={{ scale: 0.85 }}
            className="w-9 h-9 rounded-xl flex items-center justify-center bg-secondary/60 border border-border/40"
          >
            <ArrowLeft className="w-4 h-4 text-muted-foreground" />
          </motion.button>
        </div>

        {/* Panel Content */}
        <div className="flex-1 overflow-y-auto px-5 pb-5 space-y-4">
          {/* Input fields per mode */}
          {mode === "scan" && (
            <>
              <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
              <motion.button onClick={() => cameraRef.current?.click()} whileTap={{ scale: 0.97 }}
                className="w-full h-40 rounded-2xl flex flex-col items-center justify-center gap-3 group"
                style={{ border: "2px dashed hsl(var(--primary) / 0.25)", background: "hsl(var(--primary) / 0.04)" }}
              >
                <motion.div animate={imageBase64 ? {} : { y: [0, -6, 0], scale: [1, 1.08, 1] }} transition={{ duration: 2.5, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: imageBase64 ? "hsl(var(--success) / 0.12)" : "hsl(var(--primary) / 0.1)", border: `1px solid ${imageBase64 ? "hsl(var(--success) / 0.3)" : "hsl(var(--primary) / 0.2)"}` }}
                >
                  {imageBase64 ? <CheckCircle className="w-7 h-7 text-success" /> : <Camera className="w-7 h-7 text-primary" />}
                </motion.div>
                <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                  {imageBase64 ? "✓ Image captured" : "Tap to open camera"}
                </span>
              </motion.button>
            </>
          )}

          {mode === "upload" && (
            <>
              <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleImageCapture} />
              <motion.button onClick={() => fileRef.current?.click()} whileTap={{ scale: 0.97 }}
                className="w-full h-40 rounded-2xl flex flex-col items-center justify-center gap-3 group"
                style={{ border: "2px dashed hsl(var(--success) / 0.25)", background: "hsl(var(--success) / 0.04)" }}
              >
                <motion.div animate={imageBase64 ? {} : { rotate: [0, 5, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}
                  className="w-16 h-16 rounded-2xl flex items-center justify-center"
                  style={{ background: "hsl(var(--success) / 0.1)", border: "1px solid hsl(var(--success) / 0.25)" }}
                >
                  {imageBase64 ? <CheckCircle className="w-7 h-7 text-success" /> : <FileText className="w-7 h-7 text-success" />}
                </motion.div>
                <span className="text-sm font-medium text-muted-foreground">{imageBase64 ? content : "Upload PDF or Image"}</span>
              </motion.button>
            </>
          )}

          {mode === "url" && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Enter URL</label>
              <Input placeholder="https://example.com/question..." value={content} onChange={(e: any) => setContent(e.target.value)}
                className="bg-secondary/40 border-border/40 rounded-2xl h-14 text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-warning/40 focus:ring-warning/20"
              />
            </div>
          )}

          {mode === "text" && (
            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Your question</label>
              <Textarea placeholder="Type or paste your question here..." value={content} onChange={(e: any) => setContent(e.target.value)} rows={6}
                className="bg-secondary/40 border-border/40 resize-none rounded-2xl text-sm text-foreground placeholder:text-muted-foreground/40 focus:border-accent/40 focus:ring-accent/20 leading-relaxed"
                autoFocus
              />
            </div>
          )}

          {/* Solve Button inside panel */}
          <motion.button whileTap={{ scale: 0.96 }} onClick={solve} disabled={loading || (!content && !imageBase64)}
            className="w-full h-[56px] rounded-2xl text-sm font-bold text-primary-foreground relative overflow-hidden disabled:opacity-30 disabled:cursor-not-allowed"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent) / 0.9), hsl(var(--primary)))",
              backgroundSize: "200% 200%",
              boxShadow: "0 6px 30px hsl(var(--primary) / 0.25), 0 0 60px hsl(var(--accent) / 0.1)",
            }}
          >
            <motion.div className="absolute inset-0"
              style={{ background: "linear-gradient(90deg, transparent 20%, hsl(0 0% 100% / 0.1) 50%, transparent 80%)" }}
              animate={{ x: ["-200%", "200%"] }} transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
            />
            {loading ? (
              <div className="flex items-center justify-center gap-3 relative z-10">
                <PremiumSpinner />
                <span className="tracking-[0.15em] uppercase text-[13px]">Analyzing...</span>
              </div>
            ) : (
              <div className="flex items-center justify-center gap-3 relative z-10">
                <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                  <Zap className="w-5 h-5" />
                </motion.div>
                <span className="tracking-[0.15em] uppercase text-[13px]">Analyze with ALIS</span>
                <Send className="w-4 h-4 opacity-60" />
              </div>
            )}
          </motion.button>

          {loading && (
            <div className="rounded-2xl overflow-hidden"
              style={{ background: "hsl(var(--card) / 0.5)", border: "1px solid hsl(var(--border) / 0.3)" }}
            >
              <AIProgressBar label="ALIS Ω deep analysis" sublabel="Cognitive scan in progress" estimatedSeconds={6} />
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   SUGGESTION CARD
   ═══════════════════════════════════════════════════════════════ */

function SuggestionCard({ s, i, onClick }: { s: Suggestion; i: number; onClick: () => void }) {
  const diffColor = s.difficulty === "hard" ? "var(--destructive)" : s.difficulty === "medium" ? "var(--warning)" : "var(--success)";
  return (
    <motion.button
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: i * 0.08, type: "spring", stiffness: 300 }}
      onClick={onClick}
      className="min-w-[230px] max-w-[260px] shrink-0 rounded-2xl p-4 text-left group relative overflow-hidden"
      style={{
        background: "hsl(var(--card) / 0.5)",
        border: "1px solid hsl(var(--border) / 0.3)",
        backdropFilter: "blur(20px)",
      }}
      whileHover={{ y: -2, boxShadow: "0 8px 30px hsl(0 0% 0% / 0.2)" }}
      whileTap={{ scale: 0.97 }}
    >
      {/* Accent dot */}
      <motion.div className="absolute top-3 right-3 w-2 h-2 rounded-full"
        style={{ background: `hsl(${diffColor})` }}
        animate={{ scale: [1, 1.3, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
      />

      <div className="flex items-center gap-2 mb-2">
        <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-lg uppercase tracking-wider"
          style={{ background: `hsl(${diffColor} / 0.12)`, color: `hsl(${diffColor})`, border: `1px solid hsl(${diffColor} / 0.2)` }}
        >{s.difficulty}</span>
        {s.subject && <span className="text-[8px] text-muted-foreground/70 truncate font-medium">{s.subject}</span>}
      </div>
      {s.topic && <p className="text-[8px] text-primary/60 font-semibold mb-1.5 truncate">{s.topic}</p>}
      <p className="text-[10px] leading-[1.6] text-foreground/75 line-clamp-2 group-hover:text-foreground transition-colors">{s.question}</p>
    </motion.button>
  );
}

/* ═══════════════════════════════════════════════════════════════
   RESULT VIEW
   ═══════════════════════════════════════════════════════════════ */

function ResultView({ result, expandedCards, toggleCard, onReset }: { result: ALISResult; expandedCards: Set<string>; toggleCard: (id: string) => void; onReset: () => void }) {
  return (
    <div className="space-y-4">
      {/* Topic Tags */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex flex-wrap gap-2">
        {result.detected_topic && <PillTag text={result.detected_topic} accent="var(--accent)" icon={<Layers className="w-2.5 h-2.5" />} />}
        {result.detected_subtopic && <PillTag text={result.detected_subtopic} accent="var(--primary)" />}
        {result.detected_difficulty && (
          <PillTag text={result.detected_difficulty}
            accent={result.detected_difficulty === "hard" ? "var(--destructive)" : result.detected_difficulty === "medium" ? "var(--warning)" : "var(--success)"}
            icon={<Flame className="w-2.5 h-2.5" />}
          />
        )}
        {result.detected_exam_type && <PillTag text={result.detected_exam_type} accent="var(--muted-foreground)" icon={<GraduationCap className="w-2.5 h-2.5" />} />}
      </motion.div>

      {/* ── SMI Command Center ── */}
      {result.strategic_mastery_index?.smi_score > 0 && (
        <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }}
          className="rounded-3xl p-5 relative overflow-hidden"
          style={{
            background: "hsl(var(--card) / 0.6)",
            border: "1px solid hsl(var(--accent) / 0.2)",
            backdropFilter: "blur(30px)",
            boxShadow: "0 0 40px hsl(var(--accent) / 0.06), inset 0 1px 0 hsl(0 0% 100% / 0.03)",
          }}
        >
          <motion.div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--accent) / 0.6), hsl(var(--primary) / 0.4), transparent)" }}
            animate={{ opacity: [0.4, 1, 0.4] }} transition={{ duration: 3, repeat: Infinity }}
          />

          <div className="flex items-center justify-between mb-4 relative z-10">
            <div className="flex items-center gap-2.5">
              <motion.div className="w-9 h-9 rounded-xl flex items-center justify-center"
                style={{ background: "hsl(var(--accent) / 0.12)", border: "1px solid hsl(var(--accent) / 0.25)" }}
                animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}
              >
                <Trophy className="w-4 h-4 text-accent" />
              </motion.div>
              <div>
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Strategic Mastery</span>
                {result.strategic_mastery_index.mastery_verdict && (
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <Star className="w-2.5 h-2.5" style={{ color: `hsl(${result.strategic_mastery_index.mastery_verdict === "master" ? "var(--accent)" : result.strategic_mastery_index.mastery_verdict === "advanced" ? "var(--success)" : "var(--warning)"})` }} />
                    <span className="text-[9px] font-bold capitalize" style={{
                      color: `hsl(${result.strategic_mastery_index.mastery_verdict === "master" ? "var(--accent)" : result.strategic_mastery_index.mastery_verdict === "advanced" ? "var(--success)" : "var(--warning)"})`,
                    }}>{result.strategic_mastery_index.mastery_verdict}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-3 relative z-10">
            <AnimatedGauge label="SMI" value={result.strategic_mastery_index.smi_score} color="var(--accent)" delay={0.1} />
            <AnimatedGauge label="Reason" value={result.strategic_mastery_index.multi_step_reasoning} color="var(--primary)" delay={0.2} />
            <AnimatedGauge label="Transfer" value={result.strategic_mastery_index.transfer_learning} color="var(--success)" delay={0.3} />
            <AnimatedGauge label="Trap Res" value={result.strategic_mastery_index.trap_resistance} color="var(--destructive)" delay={0.4} />
          </div>
        </motion.div>
      )}

      {/* ── Cognitive Gap ── */}
      {result.cognitive_gap && (
        <ResultCard id="gap" title="Cognitive Diagnosis" icon={<Activity />} accent="var(--accent)"
          badge={result.cognitive_gap.code} expanded={expandedCards.has("gap")} onToggle={() => toggleCard("gap")} delay={0.08}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <span className="text-lg">{GAP_ICONS[result.cognitive_gap.type] || "🧠"}</span>
              <span className="text-xs font-bold capitalize text-foreground">{result.cognitive_gap.type.replace(/_/g, " ")}</span>
              <SeverityBadge severity={result.cognitive_gap.severity} />
            </div>
            <p className="text-[11px] leading-[1.8] text-muted-foreground">{result.cognitive_gap.explanation}</p>
          </div>
        </ResultCard>
      )}

      {/* ── Answer ── */}
      <ResultCard id="answer" title="Answer" icon={<CheckCircle />} accent="var(--success)"
        badge={`${Math.round(result.confidence * 100)}%`}
        expanded={expandedCards.has("answer")} onToggle={() => toggleCard("answer")} delay={0.1}
      >
        <p className="text-[13px] font-medium leading-[1.9] text-foreground">{result.short_answer}</p>
        {result.cross_validation_note && (
          <div className="mt-3 px-3.5 py-2.5 rounded-2xl bg-warning/8 border border-warning/15">
            <p className="text-[10px] italic text-warning/80">⚠️ {result.cross_validation_note}</p>
          </div>
        )}
      </ResultCard>

      {/* ── Exam Impact ── */}
      {result.exam_impact && (
        <ResultCard id="impact" title="Exam Impact" icon={<BarChart3 />} accent="var(--warning)"
          expanded={expandedCards.has("impact")} onToggle={() => toggleCard("impact")} delay={0.13}
        >
          <div className="grid grid-cols-3 gap-2.5">
            <GlassStat label="TPI" value={`${(result.exam_impact.topic_probability_index * 100).toFixed(0)}%`} accent="var(--accent)" />
            <GlassStat label="Boost" value={result.exam_impact.estimated_mastery_boost} accent="var(--success)" />
            <GlassStat label="Impact" value={result.exam_impact.readiness_impact} accent={result.exam_impact.readiness_impact === "critical" ? "var(--destructive)" : result.exam_impact.readiness_impact === "high" ? "var(--warning)" : "var(--success)"} />
          </div>
        </ResultCard>
      )}

      {/* ── Cognitive Drift ── */}
      {result.cognitive_drift?.drift_detected && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="rounded-3xl p-4 relative overflow-hidden"
          style={{ background: "hsl(var(--destructive) / 0.06)", border: "1px solid hsl(var(--destructive) / 0.2)", backdropFilter: "blur(20px)" }}
        >
          <motion.div className="absolute top-0 left-0 right-0 h-[2px]"
            style={{ background: "linear-gradient(90deg, transparent, hsl(var(--destructive) / 0.6), transparent)" }}
            animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="flex items-center gap-2.5 mb-2.5 relative z-10">
            <motion.div animate={{ rotate: [0, 180, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
              <RefreshCw className="w-4 h-4 text-destructive" />
            </motion.div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-destructive">Drift Alert</span>
            <span className="ml-auto text-[9px] font-mono px-2 py-0.5 rounded-lg bg-destructive/12 text-destructive border border-destructive/20">
              {(result.cognitive_drift.drift_magnitude * 100).toFixed(0)}%
            </span>
          </div>
          {result.cognitive_drift.drift_direction && (
            <p className="text-[10px] font-semibold mb-1.5 relative z-10 text-destructive/80">↗ {result.cognitive_drift.drift_direction.replace(/_/g, " ")}</p>
          )}
          <p className="text-[11px] leading-[1.7] relative z-10 text-muted-foreground">{result.cognitive_drift.recalibration}</p>
          {result.cognitive_drift.spacing_adjustment && (
            <p className="text-[9px] mt-2 relative z-10 text-muted-foreground/70">📐 <span className="font-bold text-foreground/80">{result.cognitive_drift.spacing_adjustment}</span></p>
          )}
        </motion.div>
      )}

      {/* ── Strategy Switch ── */}
      {result.strategy_switch?.recommended_mode && (
        <ResultCard id="strategy" title="Strategy Switch" icon={<Cpu />} accent="var(--primary)"
          badge={result.strategy_switch.urgency} expanded={expandedCards.has("strategy")} onToggle={() => toggleCard("strategy")} delay={0.18}
        >
          <div className="space-y-2">
            <span className="text-xs font-bold capitalize text-foreground">{result.strategy_switch.recommended_mode.replace(/_/g, " ")}</span>
            <p className="text-[11px] leading-[1.8] text-muted-foreground">{result.strategy_switch.reasoning}</p>
          </div>
        </ResultCard>
      )}

      {/* ── Step by Step ── */}
      <ResultCard id="steps" title="Step-by-Step" icon={<BookOpen />} accent="var(--primary)"
        expanded={expandedCards.has("steps")} onToggle={() => toggleCard("steps")} delay={0.2}
      >
        <div className="space-y-2.5">
          {result.step_by_step.map((step, i) => (
            <motion.div key={i} className="flex gap-3 items-start" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}>
              <div className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5"
                style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}
              >
                <span className="text-[9px] font-bold text-primary">{i + 1}</span>
              </div>
              <span className="text-[11px] leading-[1.8] flex-1 text-foreground/80">{step}</span>
            </motion.div>
          ))}
        </div>
      </ResultCard>

      {/* ── Concept Clarity ── */}
      <ResultCard id="concept" title="Concept Clarity" icon={<Lightbulb />} accent="var(--accent)"
        expanded={expandedCards.has("concept")} onToggle={() => toggleCard("concept")} delay={0.22}
      >
        <p className="text-[11px] leading-[1.9] text-foreground/80">{result.concept_clarity}</p>
      </ResultCard>

      {/* ── Option Elimination ── */}
      {result.option_elimination && (
        <ResultCard id="elim" title="Option Elimination" icon={<Target />} accent="var(--destructive)"
          expanded={expandedCards.has("elim")} onToggle={() => toggleCard("elim")} delay={0.24}
        >
          <p className="text-[11px] leading-[1.9] text-foreground/80">{result.option_elimination}</p>
        </ResultCard>
      )}

      {/* ── Shortcut Tricks ── */}
      {result.shortcut_tricks && (
        <ResultCard id="tricks" title="Shortcut Tricks" icon={<Zap />} accent="var(--warning)"
          expanded={expandedCards.has("tricks")} onToggle={() => toggleCard("tricks")} delay={0.26}
        >
          <p className="text-[11px] leading-[1.9] text-foreground/80">{result.shortcut_tricks}</p>
        </ResultCard>
      )}

      {/* ── Knowledge Graph ── */}
      {result.micro_concepts?.core && (
        <ResultCard id="graph" title="Knowledge Graph" icon={<Network />} accent="var(--primary)"
          expanded={expandedCards.has("graph")} onToggle={() => toggleCard("graph")} delay={0.28}
        >
          <div className="space-y-3">
            <div>
              <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-1.5 text-primary">Core Node</p>
              <p className="text-xs font-semibold text-foreground">{result.micro_concepts.core}</p>
            </div>
            {result.micro_concepts.adjacent_nodes?.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-muted-foreground">Adjacent</p>
                <div className="flex flex-wrap gap-1.5">
                  {result.micro_concepts.adjacent_nodes.map((n, i) => (
                    <span key={i} className="px-2.5 py-1.5 rounded-xl text-[9px] font-semibold"
                      style={{ background: "hsl(var(--primary) / 0.08)", color: "hsl(var(--primary))", border: "1px solid hsl(var(--primary) / 0.15)" }}
                    >{n}</span>
                  ))}
                </div>
              </div>
            )}
            {result.micro_concepts.reinforcement_questions?.length > 0 && (
              <div>
                <p className="text-[9px] font-bold uppercase tracking-[0.2em] mb-2 text-accent">🎯 Reinforcement</p>
                {result.micro_concepts.reinforcement_questions.map((rq, i) => (
                  <div key={i} className="rounded-xl p-3 mb-2" style={{ background: "hsl(var(--secondary) / 0.5)", border: "1px solid hsl(var(--border) / 0.3)" }}>
                    <div className="flex items-center gap-2 mb-1.5">
                      <DifficultyDot difficulty={rq.difficulty} />
                      <span className="text-[8px] font-bold uppercase text-muted-foreground">{rq.difficulty}</span>
                    </div>
                    <p className="text-[11px] leading-[1.7] text-foreground/80">{rq.question}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </ResultCard>
      )}

      {/* ── Pre-Query Predictions ── */}
      {result.pre_query_predictions?.weak_concepts?.length > 0 && (
        <ResultCard id="predict" title="Pre-Query Prediction" icon={<Eye />} accent="var(--destructive)"
          expanded={expandedCards.has("predict")} onToggle={() => toggleCard("predict")} delay={0.3}
        >
          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              {result.pre_query_predictions.weak_concepts.map((c, i) => (
                <span key={i} className="px-2.5 py-1.5 rounded-xl text-[9px] font-semibold"
                  style={{ background: "hsl(var(--destructive) / 0.08)", color: "hsl(var(--destructive))", border: "1px solid hsl(var(--destructive) / 0.15)" }}
                >{c}</span>
              ))}
            </div>
            {result.pre_query_predictions.preventive_challenge && (
              <div className="rounded-xl p-3" style={{ background: "hsl(var(--warning) / 0.08)", border: "1px solid hsl(var(--warning) / 0.15)" }}>
                <p className="text-[9px] font-bold uppercase mb-1 text-warning">⚡ Preventive Challenge</p>
                <p className="text-[11px] leading-[1.7] text-foreground/80">{result.pre_query_predictions.preventive_challenge}</p>
              </div>
            )}
          </div>
        </ResultCard>
      )}

      {/* ── Personal Examiner ── */}
      {result.personal_examiner?.trap_questions?.length > 0 && (
        <ResultCard id="examiner" title="Personal Examiner" icon={<Crosshair />} accent="var(--accent)"
          expanded={expandedCards.has("examiner")} onToggle={() => toggleCard("examiner")} delay={0.32}
        >
          <div className="space-y-3">
            <div className="flex items-center gap-4 mb-2">
              <div className="text-center">
                <div className="text-xl font-bold font-display text-accent">{result.personal_examiner.conceptual_depth_score}</div>
                <div className="text-[7px] uppercase tracking-wider text-muted-foreground mt-0.5">Depth</div>
              </div>
              <RobustnessBadge rating={result.personal_examiner.robustness_rating} />
            </div>
            {result.personal_examiner.trap_questions.map((tq, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "hsl(var(--secondary) / 0.5)", border: "1px solid hsl(var(--border) / 0.3)" }}>
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[8px] font-extrabold px-2 py-0.5 rounded-lg bg-destructive/12 text-destructive border border-destructive/15">TRAP</span>
                  <span className="text-[8px] text-muted-foreground capitalize">{tq.trap_type?.replace(/_/g, " ")}</span>
                </div>
                <p className="text-[11px] leading-[1.7] text-foreground/80">{tq.question}</p>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {/* ── Future Questions ── */}
      {result.future_style_questions?.length > 0 && (
        <ResultCard id="future" title="Future Questions" icon={<TrendingUp />} accent="var(--success)"
          expanded={expandedCards.has("future")} onToggle={() => toggleCard("future")} delay={0.34}
        >
          <div className="space-y-2.5">
            {result.future_style_questions.map((fq, i) => (
              <div key={i} className="rounded-xl p-3" style={{ background: "hsl(var(--secondary) / 0.5)", border: "1px solid hsl(var(--border) / 0.3)" }}>
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span className="text-[8px] font-mono px-2 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/15">{fq.question_dna}</span>
                  <MomentumBadge momentum={fq.topic_momentum} />
                  <span className="text-[8px] text-muted-foreground ml-auto">P: {(fq.exam_probability * 100).toFixed(0)}%</span>
                </div>
                <p className="text-[11px] leading-[1.7] text-foreground/80">{fq.question}</p>
              </div>
            ))}
          </div>
        </ResultCard>
      )}

      {/* ── Silent Repair ── */}
      {result.silent_repair_plan?.repair_strategy && (
        <ResultCard id="repair" title="Silent Repair Plan" icon={<Shield />} accent="var(--muted-foreground)"
          expanded={expandedCards.has("repair")} onToggle={() => toggleCard("repair")} delay={0.36}
        >
          <div className="space-y-2.5">
            <p className="text-[11px] leading-[1.8] text-foreground/80">{result.silent_repair_plan.repair_strategy}</p>
            {result.silent_repair_plan.unstable_nodes?.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {result.silent_repair_plan.unstable_nodes.map((n, i) => (
                  <span key={i} className="px-2.5 py-1.5 rounded-xl text-[9px] font-semibold"
                    style={{ background: "hsl(var(--warning) / 0.08)", color: "hsl(var(--warning))", border: "1px solid hsl(var(--warning) / 0.15)" }}
                  >⚠ {n}</span>
                ))}
              </div>
            )}
          </div>
        </ResultCard>
      )}

      {/* Footer Stats */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
        className="flex items-center justify-center gap-5 py-3"
      >
        <FooterChip icon="⚡" text={`${(result.processing_time_ms / 1000).toFixed(1)}s`} />
        <div className="w-1 h-1 rounded-full bg-border" />
        <FooterChip icon="🎯" text={`${Math.round(result.confidence * 100)}%`} />
        <div className="w-1 h-1 rounded-full bg-border" />
        <FooterChip icon="Ω" text="ALIS v3.1" />
      </motion.div>

      {/* Ask Another */}
      <motion.button whileTap={{ scale: 0.96 }} onClick={onReset}
        className="w-full h-14 rounded-2xl text-sm font-bold flex items-center justify-center gap-2.5 relative overflow-hidden group"
        style={{
          background: "hsl(var(--secondary) / 0.5)",
          border: "1px solid hsl(var(--border) / 0.4)",
          backdropFilter: "blur(20px)",
        }}
      >
        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }}>
          <Sparkles className="w-4.5 h-4.5 text-accent" />
        </motion.div>
        <span className="text-foreground tracking-wider">Ask Another Question</span>
      </motion.button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════
   REUSABLE COMPONENTS
   ═══════════════════════════════════════════════════════════════ */

function ResultCard({ id, title, icon, accent, badge, expanded, onToggle, delay = 0, children }: {
  id: string; title: string; icon: React.ReactNode; accent: string; badge?: string;
  expanded: boolean; onToggle: () => void; delay?: number; children: React.ReactNode;
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}
      className="rounded-3xl overflow-hidden relative"
      style={{
        background: "hsl(var(--card) / 0.5)",
        border: `1px solid hsl(${accent} / ${expanded ? 0.25 : 0.1})`,
        backdropFilter: "blur(25px)",
        boxShadow: expanded ? `0 0 25px hsl(${accent} / 0.06)` : "none",
        transition: "border-color 0.4s, box-shadow 0.4s",
      }}
    >
      {expanded && (
        <motion.div className="absolute top-0 left-0 right-0 h-[2px]" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ background: `linear-gradient(90deg, transparent 10%, hsl(${accent} / 0.5) 50%, transparent 90%)` }}
        />
      )}
      <button onClick={onToggle} className="w-full flex items-center gap-3 px-4 py-3.5 relative z-10">
        <motion.div className="w-8 h-8 rounded-xl flex items-center justify-center"
          style={{ background: `hsl(${accent} / 0.1)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.15)` }}
          animate={expanded ? { scale: [1, 1.08, 1] } : {}}
          transition={{ duration: 3, repeat: Infinity }}
        >
          {React.cloneElement(icon as React.ReactElement, { className: "w-3.5 h-3.5" })}
        </motion.div>
        <span className="text-[11px] font-bold uppercase tracking-[0.15em] flex-1 text-left text-foreground/85">{title}</span>
        {badge && (
          <span className="text-[8px] font-mono font-bold px-2 py-0.5 rounded-lg"
            style={{ background: `hsl(${accent} / 0.1)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.15)` }}
          >{badge}</span>
        )}
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.3 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground/60" />
        </motion.div>
      </button>
      <AnimatePresence>
        {expanded && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.3, ease: "easeOut" }} className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

import React from "react";

function AnimatedGauge({ label, value, color, delay = 0 }: { label: string; value: number; color: string; delay?: number }) {
  const r = 24, c = 2 * Math.PI * r;
  const offset = c * (1 - Math.min(value, 100) / 100);
  return (
    <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay }}
      className="flex flex-col items-center gap-1.5"
    >
      <div className="relative w-[56px] h-[56px]">
        <svg viewBox="0 0 60 60" className="w-full h-full -rotate-90">
          <circle cx="30" cy="30" r={r} fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="3" />
          <motion.circle cx="30" cy="30" r={r} fill="none" stroke={`hsl(${color})`} strokeWidth="3.5" strokeLinecap="round"
            strokeDasharray={c} initial={{ strokeDashoffset: c }} animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1.5, ease: "easeOut", delay: delay + 0.3 }}
            style={{ filter: `drop-shadow(0 0 6px hsl(${color} / 0.4))` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-[12px] font-bold font-display" style={{ color: `hsl(${color})` }}>{value}</span>
        </div>
      </div>
      <span className="text-[7px] font-bold uppercase tracking-widest text-muted-foreground/70">{label}</span>
    </motion.div>
  );
}

function GlassStat({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className="text-center rounded-2xl p-3"
      style={{ background: "hsl(var(--secondary) / 0.4)", border: "1px solid hsl(var(--border) / 0.3)" }}
    >
      <div className="text-sm font-bold capitalize font-display" style={{ color: `hsl(${accent})` }}>{value}</div>
      <div className="text-[7px] uppercase tracking-widest mt-1 text-muted-foreground/70">{label}</div>
    </div>
  );
}

function PillTag({ text, accent, icon }: { text: string; accent: string; icon?: React.ReactNode }) {
  return (
    <motion.span initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[9px] font-bold capitalize"
      style={{ background: `hsl(${accent} / 0.1)`, color: `hsl(${accent})`, border: `1px solid hsl(${accent} / 0.15)` }}
    >
      {icon && React.cloneElement(icon as React.ReactElement, { style: { color: `hsl(${accent})` } })}
      {text}
    </motion.span>
  );
}

function SeverityBadge({ severity }: { severity: string }) {
  const styles: Record<string, { bg: string; color: string; border: string }> = {
    high: { bg: "hsl(var(--destructive) / 0.1)", color: "hsl(var(--destructive))", border: "hsl(var(--destructive) / 0.2)" },
    medium: { bg: "hsl(var(--warning) / 0.1)", color: "hsl(var(--warning))", border: "hsl(var(--warning) / 0.2)" },
    low: { bg: "hsl(var(--success) / 0.1)", color: "hsl(var(--success))", border: "hsl(var(--success) / 0.2)" },
  };
  const s = styles[severity] || styles.low;
  return (
    <span className="text-[9px] px-2 py-0.5 rounded-lg font-bold border" style={{ background: s.bg, color: s.color, borderColor: s.border }}>
      {severity}
    </span>
  );
}

function DifficultyDot({ difficulty }: { difficulty: string }) {
  const color = difficulty === "hard" ? "var(--destructive)" : difficulty === "medium" ? "var(--warning)" : "var(--success)";
  return <motion.div className="w-2 h-2 rounded-full" style={{ background: `hsl(${color})` }} animate={{ scale: [1, 1.3, 1] }} transition={{ duration: 2, repeat: Infinity }} />;
}

function MomentumBadge({ momentum }: { momentum: string }) {
  const cfg = momentum === "rising" ? { color: "var(--success)", arrow: "↑" } : momentum === "declining" ? { color: "var(--destructive)", arrow: "↓" } : { color: "var(--muted-foreground)", arrow: "→" };
  return (
    <span className="text-[8px] font-bold px-2 py-0.5 rounded-lg"
      style={{ background: `hsl(${cfg.color} / 0.1)`, color: `hsl(${cfg.color})`, border: `1px solid hsl(${cfg.color} / 0.15)` }}
    >{cfg.arrow} {momentum}</span>
  );
}

function RobustnessBadge({ rating }: { rating: string }) {
  const color = rating === "bulletproof" ? "var(--accent)" : rating === "robust" ? "var(--success)" : rating === "developing" ? "var(--warning)" : "var(--destructive)";
  return (
    <span className="text-[9px] font-bold px-3 py-1 rounded-xl"
      style={{ background: `hsl(${color} / 0.1)`, color: `hsl(${color})`, border: `1px solid hsl(${color} / 0.15)` }}
    >{rating}</span>
  );
}

function FooterChip({ icon, text }: { icon: string; text: string }) {
  return <span className="text-[9px] text-muted-foreground/60 font-medium">{icon} {text}</span>;
}

function HeroLogo() {
  return (
    <motion.div className="w-11 h-11 rounded-2xl flex items-center justify-center relative"
      style={{
        background: "linear-gradient(135deg, hsl(var(--accent) / 0.15), hsl(var(--primary) / 0.1))",
        border: "1px solid hsl(var(--accent) / 0.25)",
        boxShadow: "0 0 20px hsl(var(--accent) / 0.1)",
      }}
    >
      <motion.div className="absolute -inset-[1px] rounded-2xl"
        style={{
          background: "conic-gradient(from 0deg, hsl(var(--accent) / 0.5), hsl(var(--primary) / 0.4), transparent 40%, transparent 60%, hsl(var(--success) / 0.2), hsl(var(--accent) / 0.5))",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", maskComposite: "exclude", WebkitMaskComposite: "xor", padding: "1px",
        }}
        animate={{ rotate: 360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
      />
      <motion.div animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 4, repeat: Infinity }}>
        <Brain className="w-5 h-5 relative z-10 text-accent" />
      </motion.div>
    </motion.div>
  );
}

function StatusPill({ result }: { result: ALISResult | null }) {
  if (!result) return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
      style={{ background: "hsl(var(--success) / 0.08)", border: "1px solid hsl(var(--success) / 0.15)" }}
    >
      <motion.div className="w-1.5 h-1.5 rounded-full bg-success" animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }} transition={{ duration: 2, repeat: Infinity }} />
      <span className="text-[8px] font-bold uppercase tracking-widest text-success">Ready</span>
    </div>
  );
  const pct = Math.round(result.confidence * 100);
  const color = pct >= 80 ? "var(--success)" : pct >= 50 ? "var(--warning)" : "var(--destructive)";
  return (
    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl"
      style={{ background: `hsl(${color} / 0.08)`, border: `1px solid hsl(${color} / 0.15)` }}
    >
      <span className="text-[9px] font-bold font-display" style={{ color: `hsl(${color})` }}>{pct}%</span>
    </div>
  );
}

function PremiumSpinner() {
  return (
    <div className="relative w-8 h-8">
      <motion.div className="absolute inset-0 rounded-full" style={{ border: "2px solid hsl(0 0% 100% / 0.1)" }} />
      <motion.div className="absolute inset-0 rounded-full"
        style={{ border: "2px solid transparent", borderTopColor: "hsl(var(--accent))", borderRightColor: "hsl(var(--primary))" }}
        animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: "linear" }}
      />
      <motion.div className="absolute inset-1.5 rounded-full"
        style={{ border: "1.5px solid transparent", borderBottomColor: "hsl(0 0% 100% / 0.4)" }}
        animate={{ rotate: -360 }} transition={{ duration: 1.2, repeat: Infinity, ease: "linear" }}
      />
      <Brain className="w-3 h-3 absolute inset-0 m-auto text-white/90" />
    </div>
  );
}
