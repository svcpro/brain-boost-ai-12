import { useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { X, Camera, FileText, Link, Type, Brain, Loader2, CheckCircle, Zap, BookOpen, Target, Lightbulb } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import ReactMarkdown from "react-markdown";

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
  { key: "scan" as InputMode, icon: Camera, label: "Scan" },
  { key: "text" as InputMode, icon: Type, label: "Type" },
  { key: "upload" as InputMode, icon: FileText, label: "PDF" },
  { key: "url" as InputMode, icon: Link, label: "URL" },
];

export default function BrainLensModal({ onClose }: { onClose: () => void }) {
  const [mode, setMode] = useState<InputMode>("text");
  const [content, setContent] = useState("");
  const [imageBase64, setImageBase64] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BrainLensResult | null>(null);
  const [activeSection, setActiveSection] = useState<string | null>("answer");
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

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

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 pt-4 pb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-accent/20 flex items-center justify-center">
            <Brain className="w-5 h-5 text-accent" />
          </div>
          <div>
            <h2 className="text-base font-display font-bold gradient-text">BrainLens</h2>
            <p className="text-[10px] text-muted-foreground">AI Query Resolver</p>
          </div>
        </div>
        <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full">
          <X className="w-5 h-5" />
        </Button>
      </div>

      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-4">
        {!result ? (
          <>
            {/* Input Mode Tabs */}
            <div className="grid grid-cols-4 gap-2">
              {INPUT_MODES.map(({ key, icon: Icon, label }) => (
                <button
                  key={key}
                  onClick={() => { setMode(key); setImageBase64(null); setContent(""); }}
                  className={`flex flex-col items-center gap-1 py-3 rounded-xl text-xs font-medium transition-all ${
                    mode === key
                      ? "glass neural-border text-primary glow-primary"
                      : "glass text-muted-foreground"
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  {label}
                </button>
              ))}
            </div>

            {/* Input Area */}
            <div className="glass rounded-2xl p-4 space-y-3">
              {mode === "scan" && (
                <div className="space-y-3">
                  <input
                    ref={cameraRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    onChange={handleImageCapture}
                  />
                  <Button
                    onClick={() => cameraRef.current?.click()}
                    variant="outline"
                    className="w-full h-24 border-dashed border-2 border-primary/30 rounded-xl"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <Camera className="w-8 h-8 text-primary" />
                      <span className="text-sm">{imageBase64 ? "Image captured ✓" : "Tap to scan question"}</span>
                    </div>
                  </Button>
                </div>
              )}

              {mode === "upload" && (
                <div className="space-y-3">
                  <input
                    ref={fileRef}
                    type="file"
                    accept=".pdf,image/*"
                    className="hidden"
                    onChange={handleImageCapture}
                  />
                  <Button
                    onClick={() => fileRef.current?.click()}
                    variant="outline"
                    className="w-full h-24 border-dashed border-2 border-primary/30 rounded-xl"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <FileText className="w-8 h-8 text-primary" />
                      <span className="text-sm">{imageBase64 ? content : "Upload PDF or Image"}</span>
                    </div>
                  </Button>
                </div>
              )}

              {mode === "url" && (
                <Input
                  placeholder="Paste question URL..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="bg-secondary/50"
                />
              )}

              {mode === "text" && (
                <Textarea
                  placeholder="Type or paste your question here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={5}
                  className="bg-secondary/50 resize-none"
                />
              )}
            </div>

            {/* Solve Button */}
            <Button
              onClick={solve}
              disabled={loading || (!content && !imageBase64)}
              className="w-full h-14 rounded-2xl text-base font-bold relative overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(262 100% 65%), hsl(187 100% 50%))" }}
            >
              {loading ? (
                <div className="flex items-center gap-3">
                  <BrainScanAnimation />
                  <span>Analyzing...</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Zap className="w-5 h-5" />
                  <span>Solve with BrainLens</span>
                </div>
              )}
            </Button>
          </>
        ) : (
          /* Result View */
          <div className="space-y-3">
            {/* Meta Tags */}
            <div className="flex flex-wrap gap-2">
              {result.detected_topic && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-primary/15 text-primary border border-primary/20">
                  {result.detected_topic}
                </span>
              )}
              {result.detected_subtopic && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-accent/15 text-accent border border-accent/20">
                  {result.detected_subtopic}
                </span>
              )}
              {result.detected_difficulty && (
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-semibold border ${
                  result.detected_difficulty === "hard"
                    ? "bg-destructive/15 text-destructive border-destructive/20"
                    : result.detected_difficulty === "medium"
                    ? "bg-warning/15 text-warning border-warning/20"
                    : "bg-success/15 text-success border-success/20"
                }`}>
                  {result.detected_difficulty}
                </span>
              )}
              {result.detected_exam_type && (
                <span className="px-2.5 py-1 rounded-full text-[10px] font-semibold bg-secondary text-secondary-foreground border border-border">
                  {result.detected_exam_type}
                </span>
              )}
            </div>

            {/* Direct Answer */}
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-2xl p-4 neural-border"
            >
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="w-4 h-4 text-success" />
                <span className="text-xs font-bold text-success uppercase tracking-wider">Direct Answer</span>
              </div>
              <p className="text-sm font-medium text-foreground leading-relaxed">{result.short_answer}</p>
            </motion.div>

            {/* Collapsible Sections */}
            <ResultSection
              icon={BookOpen}
              title="Step-by-Step"
              color="primary"
              active={activeSection === "steps"}
              onToggle={() => setActiveSection(activeSection === "steps" ? null : "steps")}
            >
              <ol className="space-y-2 text-sm text-muted-foreground">
                {result.step_by_step.map((step, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-primary font-bold text-xs mt-0.5">{i + 1}.</span>
                    <span className="leading-relaxed">{step}</span>
                  </li>
                ))}
              </ol>
            </ResultSection>

            <ResultSection
              icon={Lightbulb}
              title="Concept Clarity"
              color="accent"
              active={activeSection === "concept"}
              onToggle={() => setActiveSection(activeSection === "concept" ? null : "concept")}
            >
              <p className="text-sm text-muted-foreground leading-relaxed">{result.concept_clarity}</p>
            </ResultSection>

            {result.option_elimination && (
              <ResultSection
                icon={Target}
                title="Option Elimination"
                color="destructive"
                active={activeSection === "elimination"}
                onToggle={() => setActiveSection(activeSection === "elimination" ? null : "elimination")}
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{result.option_elimination}</p>
              </ResultSection>
            )}

            {result.shortcut_tricks && (
              <ResultSection
                icon={Zap}
                title="Shortcut Tricks"
                color="warning"
                active={activeSection === "tricks"}
                onToggle={() => setActiveSection(activeSection === "tricks" ? null : "tricks")}
              >
                <p className="text-sm text-muted-foreground leading-relaxed">{result.shortcut_tricks}</p>
              </ResultSection>
            )}

            {/* Processing info */}
            <p className="text-[10px] text-muted-foreground text-center">
              Solved in {(result.processing_time_ms / 1000).toFixed(1)}s • Confidence {Math.round(result.confidence * 100)}%
            </p>

            {/* Ask Another */}
            <Button
              onClick={() => { setResult(null); setContent(""); setImageBase64(null); }}
              variant="outline"
              className="w-full rounded-xl"
            >
              Ask Another Question
            </Button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function ResultSection({
  icon: Icon,
  title,
  color,
  active,
  onToggle,
  children,
}: {
  icon: any;
  title: string;
  color: string;
  active: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl overflow-hidden"
    >
      <button onClick={onToggle} className="w-full flex items-center gap-2 p-4">
        <Icon className={`w-4 h-4 text-${color}`} />
        <span className="text-xs font-bold uppercase tracking-wider flex-1 text-left">{title}</span>
        <motion.span animate={{ rotate: active ? 180 : 0 }} className="text-muted-foreground text-xs">▼</motion.span>
      </button>
      {active && <div className="px-4 pb-4">{children}</div>}
    </motion.div>
  );
}

function BrainScanAnimation() {
  return (
    <div className="relative w-8 h-8">
      <motion.div
        className="absolute inset-0 rounded-full border-2 border-primary-foreground/40"
        animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
        transition={{ duration: 1.5, repeat: Infinity }}
      />
      <motion.div
        className="absolute inset-1 rounded-full border border-primary-foreground/60"
        animate={{ scale: [1, 1.2, 1], opacity: [0.8, 0.2, 0.8] }}
        transition={{ duration: 1.5, repeat: Infinity, delay: 0.3 }}
      />
      <Brain className="w-5 h-5 absolute inset-0 m-auto text-primary-foreground" />
    </div>
  );
}
