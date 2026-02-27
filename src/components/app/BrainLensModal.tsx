import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Camera, FileText, Link, Type, Brain, CheckCircle, Zap, BookOpen, Target, Lightbulb, ArrowLeft, Sparkles } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createPortal } from "react-dom";

type InputMode = "scan" | "upload" | "url" | "text";

interface BrainLensResult {
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
}

const INPUT_MODES = [
  { key: "scan" as InputMode, icon: Camera, label: "Scan", desc: "Camera OCR", gradient: "from-[hsl(187,100%,50%)] to-[hsl(200,100%,60%)]", glow: "187 100% 50%", particleColor: "#00E5FF" },
  { key: "text" as InputMode, icon: Type, label: "Type", desc: "Text input", gradient: "from-[hsl(262,100%,65%)] to-[hsl(280,100%,70%)]", glow: "262 100% 65%", particleColor: "#7C4DFF" },
  { key: "upload" as InputMode, icon: FileText, label: "PDF", desc: "Upload file", gradient: "from-[hsl(155,100%,50%)] to-[hsl(170,100%,55%)]", glow: "155 100% 50%", particleColor: "#00E676" },
  { key: "url" as InputMode, icon: Link, label: "URL", desc: "Paste link", gradient: "from-[hsl(40,100%,50%)] to-[hsl(30,100%,55%)]", glow: "40 100% 50%", particleColor: "#FFD600" },
];

export default function BrainLensModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BrainLensResult | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>("steps");
  const [portalTarget, setPortalTarget] = useState<HTMLElement | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const el = document.querySelector(".app-device-inner") as HTMLElement;
    if (el) setPortalTarget(el);
  }, []);

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
    if (!content && !imageBase64) {
      toast.error("Please enter a question or upload an image");
      return;
    }
    setLoading(true);
    setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("brainlens-solve", {
        body: {
          input_type: mode,
          content: content || undefined,
          image_base64: imageBase64 || undefined,
        },
      });
      if (error) throw error;
      setResult(data);
    } catch (e: any) {
      toast.error(e.message || "Failed to solve");
    } finally {
      setLoading(false);
    }
  };

  const modalContent = (
    <motion.div
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "spring", damping: 28, stiffness: 300 }}
      className="absolute inset-0 z-50 bg-background flex flex-col overflow-hidden"
    >
      {/* Layered ambient background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="gradient-bg-hero opacity-40" style={{ position: "absolute", inset: 0 }} />
        <motion.div
          className="absolute w-[300px] h-[300px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(262 100% 65% / 0.12), transparent 70%)",
            top: "-80px", right: "-60px",
          }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.4, 0.7, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-[250px] h-[250px] rounded-full"
          style={{
            background: "radial-gradient(circle, hsl(187 100% 50% / 0.1), transparent 70%)",
            bottom: "100px", left: "-80px",
          }}
          animate={{ scale: [1.1, 1, 1.1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* Header */}
      <header className="glass-strong border-b border-border px-4 py-3 flex items-center gap-3 sticky top-0 z-50 relative">
        <button onClick={onClose} className="p-1.5 rounded-xl hover:bg-secondary/80 transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>
        <div className="flex items-center gap-2.5 flex-1">
          <HeaderBrainIcon />
          <div>
            <h1 className="text-sm font-bold gradient-text leading-tight" style={{ fontFamily: "'Orbitron', sans-serif", letterSpacing: "0.08em" }}>BrainLens</h1>
            <p className="text-[9px] text-muted-foreground leading-tight">AI Query Resolver</p>
          </div>
        </div>
        <motion.div
          className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-accent/30 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(262 100% 65% / 0.15), hsl(187 100% 50% / 0.1))" }}
        >
          <motion.div
            className="absolute inset-0"
            style={{ background: "linear-gradient(90deg, transparent, hsl(262 100% 65% / 0.1), transparent)" }}
            animate={{ x: ["-100%", "100%"] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
          />
          <Sparkles className="w-3 h-3 text-accent relative z-10" />
          <span className="text-[9px] font-bold text-accent relative z-10">AI</span>
        </motion.div>
      </header>

      {/* Content */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
        <div className="px-4 py-4 space-y-4 pb-8">
          {!result ? (
            <>
              {/* Input Mode Selector — premium animated cards */}
              <div className="grid grid-cols-4 gap-2">
                {INPUT_MODES.map(({ key, icon: Icon, label, gradient, glow, particleColor }, idx) => (
                  <motion.button
                    key={key}
                    whileTap={{ scale: 0.92 }}
                    whileHover={{ scale: 1.03 }}
                    onClick={() => { setMode(key); setImageBase64(null); setContent(""); }}
                    className={`relative flex flex-col items-center gap-1.5 py-3.5 rounded-2xl text-[10px] font-semibold transition-all overflow-hidden ${
                      mode === key
                        ? "glass-strong neural-border"
                        : "glass border border-border/30"
                    }`}
                  >
                    {/* Active glow background */}
                    {mode === key && (
                      <motion.div
                        layoutId="brainlens-mode-glow"
                        className="absolute inset-0 rounded-2xl"
                        style={{ background: `radial-gradient(circle at 50% 30%, hsl(${glow} / 0.15), transparent 70%)` }}
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}

                    {/* Orbiting particles for active mode */}
                    {mode === key && <ModeOrbit color={particleColor} />}

                    {/* Icon with animated gradient ring */}
                    <div className="relative">
                      <motion.div
                        className={`w-9 h-9 rounded-xl flex items-center justify-center bg-gradient-to-br ${gradient}`}
                        style={{ opacity: mode === key ? 1 : 0.5 }}
                        animate={mode === key ? {
                          boxShadow: [
                            `0 0 8px hsl(${glow} / 0.3)`,
                            `0 0 20px hsl(${glow} / 0.5)`,
                            `0 0 8px hsl(${glow} / 0.3)`,
                          ],
                        } : { boxShadow: "0 0 0px transparent" }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Icon className="w-4 h-4 text-primary-foreground" />
                      </motion.div>

                      {/* Conic ring */}
                      {mode === key && (
                        <motion.div
                          className="absolute -inset-1 rounded-xl"
                          style={{
                            background: `conic-gradient(from 0deg, hsl(${glow} / 0.6), transparent 30%, transparent 70%, hsl(${glow} / 0.6))`,
                            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
                            maskComposite: "exclude",
                            WebkitMaskComposite: "xor",
                            padding: "1.5px",
                          }}
                          animate={{ rotate: 360 }}
                          transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                        />
                      )}
                    </div>

                    <span className={`relative z-10 ${mode === key ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                  </motion.button>
                ))}
              </div>

              {/* Input Area */}
              <div className="glass rounded-2xl p-4 space-y-3 neural-border relative overflow-hidden">
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(187 100% 50% / 0.03), transparent)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                />

                <div className="flex items-center gap-2 mb-1 relative z-10">
                  <div className="w-1 h-4 rounded-full bg-primary" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                    {mode === "scan" ? "Scan Question" : mode === "upload" ? "Upload File" : mode === "url" ? "Paste URL" : "Your Question"}
                  </span>
                </div>

                {mode === "scan" && (
                  <>
                    <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleImageCapture} />
                    <button
                      onClick={() => cameraRef.current?.click()}
                      className="w-full h-28 border border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors relative z-10"
                    >
                      <motion.div
                        animate={imageBase64 ? {} : { scale: [1, 1.1, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                        className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center"
                      >
                        {imageBase64 ? <CheckCircle className="w-6 h-6 text-success" /> : <Camera className="w-6 h-6 text-primary" />}
                      </motion.div>
                      <span className="text-xs text-muted-foreground">
                        {imageBase64 ? "Image captured ✓" : "Tap to open camera"}
                      </span>
                    </button>
                  </>
                )}

                {mode === "upload" && (
                  <>
                    <input ref={fileRef} type="file" accept=".pdf,image/*" className="hidden" onChange={handleImageCapture} />
                    <button
                      onClick={() => fileRef.current?.click()}
                      className="w-full h-28 border border-dashed border-primary/30 rounded-2xl flex flex-col items-center justify-center gap-2 hover:bg-primary/5 transition-colors relative z-10"
                    >
                      <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                        {imageBase64 ? <CheckCircle className="w-6 h-6 text-success" /> : <FileText className="w-6 h-6 text-primary" />}
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {imageBase64 ? content : "Upload PDF or Image"}
                      </span>
                    </button>
                  </>
                )}

                {mode === "url" && (
                  <Input
                    placeholder="https://example.com/question..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="bg-secondary/30 border-border/50 rounded-xl h-12 relative z-10"
                  />
                )}

                {mode === "text" && (
                  <Textarea
                    placeholder="Type or paste your question here..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    rows={5}
                    className="bg-secondary/30 border-border/50 resize-none rounded-xl relative z-10"
                  />
                )}
              </div>

              {/* Solve Button — premium with layered effects */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={solve}
                disabled={loading || (!content && !imageBase64)}
                className="w-full h-14 rounded-2xl text-sm font-display font-bold text-primary-foreground relative overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed group"
                style={{ background: "linear-gradient(135deg, hsl(262 100% 65%), hsl(187 100% 50%))" }}
              >
                {/* Shimmer sweep */}
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(90deg, transparent 30%, hsl(0 0% 100% / 0.2) 50%, transparent 70%)", backgroundSize: "200% 100%" }}
                  animate={{ backgroundPosition: ["-200% center", "200% center"] }}
                  transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                />
                {/* Border glow */}
                <motion.div
                  className="absolute inset-0 rounded-2xl"
                  animate={{
                    boxShadow: [
                      "0 0 15px hsl(262 100% 65% / 0.4), 0 4px 30px hsl(187 100% 50% / 0.2)",
                      "0 0 30px hsl(262 100% 65% / 0.6), 0 4px 50px hsl(187 100% 50% / 0.35)",
                      "0 0 15px hsl(262 100% 65% / 0.4), 0 4px 30px hsl(187 100% 50% / 0.2)",
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                />
                {loading ? (
                  <div className="flex items-center justify-center gap-3 relative z-10">
                    <BrainScanAnimation />
                    <span>Analyzing...</span>
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2 relative z-10">
                    <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2 }}>
                      <Zap className="w-5 h-5" />
                    </motion.div>
                    <span>Solve with BrainLens</span>
                  </div>
                )}
              </motion.button>

              <p className="text-[10px] text-muted-foreground text-center">
                Powered by ACRY AI • Supports all competitive exams
              </p>
            </>
          ) : (
            /* ═══ Result View ═══ */
            <div className="space-y-3">
              {/* Meta Tags */}
              <div className="flex flex-wrap gap-1.5">
                {result.detected_topic && <MetaPill text={result.detected_topic} colorClass="bg-primary/10 text-primary border-primary/20" />}
                {result.detected_subtopic && <MetaPill text={result.detected_subtopic} colorClass="bg-accent/10 text-accent border-accent/20" />}
                {result.detected_difficulty && (
                  <MetaPill
                    text={result.detected_difficulty}
                    colorClass={
                      result.detected_difficulty === "hard"
                        ? "bg-destructive/10 text-destructive border-destructive/20"
                        : result.detected_difficulty === "medium"
                        ? "bg-warning/10 text-warning border-warning/20"
                        : "bg-success/10 text-success border-success/20"
                    }
                  />
                )}
                {result.detected_exam_type && <MetaPill text={result.detected_exam_type} colorClass="bg-secondary text-secondary-foreground border-border" />}
              </div>

              {/* Direct Answer — hero card */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="glass-strong rounded-2xl p-4 neural-border relative overflow-hidden"
              >
                <div className="absolute inset-0 pointer-events-none" style={{
                  background: "radial-gradient(ellipse 80% 60% at 50% 0%, hsl(155 100% 50% / 0.08), transparent 60%)"
                }} />
                <motion.div
                  className="absolute inset-0 pointer-events-none"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(155 100% 50% / 0.04), transparent)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <div className="flex items-center gap-2 mb-2.5 relative z-10">
                  <motion.div
                    className="w-7 h-7 rounded-lg bg-success/15 flex items-center justify-center"
                    animate={{ boxShadow: ["0 0 6px hsl(155 100% 50% / 0.2)", "0 0 16px hsl(155 100% 50% / 0.4)", "0 0 6px hsl(155 100% 50% / 0.2)"] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  >
                    <CheckCircle className="w-4 h-4 text-success" />
                  </motion.div>
                  <span className="text-[10px] font-bold text-success uppercase tracking-widest">Direct Answer</span>
                </div>
                <p className="text-sm font-medium text-foreground leading-relaxed relative z-10">{result.short_answer}</p>
              </motion.div>

              {/* Collapsible Sections */}
              <ResultSection
                icon={BookOpen} title="Step-by-Step"
                colorClass="text-primary" glow="187 100% 50%" bgClass="bg-primary/15"
                active={activeSection === "steps"} onToggle={() => setActiveSection(activeSection === "steps" ? null : "steps")}
                delay={0.1}
              >
                <ol className="space-y-2.5">
                  {result.step_by_step.map((step, i) => (
                    <motion.li key={i} className="flex gap-2.5" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 * i }}>
                      <div className="w-5 h-5 rounded-lg bg-primary/10 flex items-center justify-center shrink-0 mt-0.5">
                        <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                      </div>
                      <span className="text-xs text-muted-foreground leading-relaxed">{step}</span>
                    </motion.li>
                  ))}
                </ol>
              </ResultSection>

              <ResultSection
                icon={Lightbulb} title="Concept Clarity"
                colorClass="text-accent" glow="262 100% 65%" bgClass="bg-accent/15"
                active={activeSection === "concept"} onToggle={() => setActiveSection(activeSection === "concept" ? null : "concept")}
                delay={0.15}
              >
                <p className="text-xs text-muted-foreground leading-relaxed">{result.concept_clarity}</p>
              </ResultSection>

              {result.option_elimination && (
                <ResultSection
                  icon={Target} title="Option Elimination"
                  colorClass="text-destructive" glow="0 72% 51%" bgClass="bg-destructive/15"
                  active={activeSection === "elimination"} onToggle={() => setActiveSection(activeSection === "elimination" ? null : "elimination")}
                  delay={0.2}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">{result.option_elimination}</p>
                </ResultSection>
              )}

              {result.shortcut_tricks && (
                <ResultSection
                  icon={Zap} title="Shortcut Tricks"
                  colorClass="text-warning" glow="40 100% 50%" bgClass="bg-warning/15"
                  active={activeSection === "tricks"} onToggle={() => setActiveSection(activeSection === "tricks" ? null : "tricks")}
                  delay={0.25}
                >
                  <p className="text-xs text-muted-foreground leading-relaxed">{result.shortcut_tricks}</p>
                </ResultSection>
              )}

              {/* Processing info */}
              <div className="flex items-center justify-center gap-3 py-1">
                <span className="text-[9px] text-muted-foreground">⚡ {(result.processing_time_ms / 1000).toFixed(1)}s</span>
                <span className="w-1 h-1 rounded-full bg-border" />
                <span className="text-[9px] text-muted-foreground">🎯 {Math.round(result.confidence * 100)}% confidence</span>
              </div>

              {/* Ask Another */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { setResult(null); setContent(""); setImageBase64(null); setActiveSection("steps"); }}
                className="w-full h-12 rounded-2xl glass neural-border text-sm font-semibold text-primary flex items-center justify-center gap-2 relative overflow-hidden"
              >
                <motion.div
                  className="absolute inset-0"
                  style={{ background: "linear-gradient(90deg, transparent, hsl(187 100% 50% / 0.04), transparent)" }}
                  animate={{ x: ["-100%", "200%"] }}
                  transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
                <Sparkles className="w-4 h-4 relative z-10" />
                <span className="relative z-10">Ask Another Question</span>
              </motion.button>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );

  if (portalTarget) return createPortal(modalContent, portalTarget);
  return modalContent;
}

/* ═══════════════════════════════════════════
   Sub-components
   ═══════════════════════════════════════════ */

function HeaderBrainIcon() {
  return (
    <motion.div
      className="w-9 h-9 rounded-xl flex items-center justify-center relative"
      style={{ background: "linear-gradient(135deg, hsl(262 100% 65% / 0.2), hsl(187 100% 50% / 0.2))" }}
    >
      {/* Orbiting ring */}
      <motion.div
        className="absolute -inset-0.5 rounded-xl"
        style={{
          background: "conic-gradient(from 0deg, hsl(262 100% 65% / 0.5), transparent 25%, transparent 75%, hsl(187 100% 50% / 0.5))",
          mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
          maskComposite: "exclude",
          WebkitMaskComposite: "xor",
          padding: "1px",
        }}
        animate={{ rotate: 360 }}
        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
      />
      {/* Pulse */}
      <motion.div
        className="absolute inset-0 rounded-xl"
        animate={{ boxShadow: ["0 0 8px hsl(262 100% 65% / 0.3)", "0 0 18px hsl(187 100% 50% / 0.5)", "0 0 8px hsl(262 100% 65% / 0.3)"] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <Brain className="w-4.5 h-4.5 text-accent relative z-10" />
    </motion.div>
  );
}

function ModeOrbit({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 pointer-events-none">
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute w-1 h-1 rounded-full"
          style={{ background: color, top: "50%", left: "50%", filter: `blur(0.5px) drop-shadow(0 0 3px ${color})` }}
          animate={{
            x: [0, 20, 0, -20, 0],
            y: [-20, 0, 20, 0, -20],
            opacity: [0.4, 0.9, 0.4],
            scale: [0.8, 1.2, 0.8],
          }}
          transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
}

function MetaPill({ text, colorClass }: { text: string; colorClass: string }) {
  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`px-2.5 py-1 rounded-full text-[9px] font-bold border ${colorClass}`}
    >
      {text}
    </motion.span>
  );
}

function ResultSection({
  icon: Icon, title, colorClass, glow, bgClass, active, onToggle, delay = 0, children,
}: {
  icon: any; title: string; colorClass: string; glow: string; bgClass: string;
  active: boolean; onToggle: () => void; delay?: number; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="glass rounded-2xl overflow-hidden relative"
    >
      {/* Active section glow */}
      {active && (
        <motion.div
          className="absolute inset-0 pointer-events-none rounded-2xl"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          style={{ background: `radial-gradient(ellipse 80% 40% at 50% 0%, hsl(${glow} / 0.06), transparent 60%)` }}
        />
      )}

      <button onClick={onToggle} className="w-full flex items-center gap-2.5 p-3.5 relative z-10">
        <motion.div
          className={`w-7 h-7 rounded-lg ${bgClass} flex items-center justify-center`}
          animate={active ? {
            boxShadow: [`0 0 6px hsl(${glow} / 0.2)`, `0 0 14px hsl(${glow} / 0.4)`, `0 0 6px hsl(${glow} / 0.2)`],
          } : { boxShadow: "0 0 0 transparent" }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Icon className={`w-3.5 h-3.5 ${colorClass}`} />
        </motion.div>
        <span className="text-[11px] font-bold uppercase tracking-wider flex-1 text-left text-foreground">{title}</span>
        <motion.div
          animate={{ rotate: active ? 180 : 0 }}
          transition={{ duration: 0.2 }}
          className="w-5 h-5 rounded-lg bg-secondary/50 flex items-center justify-center"
        >
          <span className="text-[10px] text-muted-foreground">▼</span>
        </motion.div>
      </button>
      <AnimatePresence>
        {active && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-3.5 pb-3.5">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function BrainScanAnimation() {
  return (
    <div className="relative w-8 h-8">
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary-foreground/40"
        animate={{ scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 1.2, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-0.5 rounded-full border border-primary-foreground/50"
        animate={{ scale: [1, 1.3, 1], opacity: [0.8, 0.1, 0.8] }}
        transition={{ duration: 1.2, repeat: Infinity, delay: 0.2 }}
      />
      <motion.div
        className="absolute inset-1 rounded-full"
        style={{ background: "conic-gradient(from 0deg, hsl(187 100% 50% / 0.4), transparent 30%, transparent 70%, hsl(262 100% 65% / 0.4))" }}
        animate={{ rotate: 360 }}
        transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
      />
      <Brain className="w-4 h-4 absolute inset-0 m-auto text-primary-foreground" />
    </div>
  );
}
