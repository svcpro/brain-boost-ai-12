import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Zap, Brain, Loader2, CheckCircle,
  ShieldAlert, Shield, HeartPulse, Trophy, ArrowRight,
  Clock, Target, TrendingUp, Sparkles, Wind,
  Calendar, Flame, Volume2, VolumeX
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

// ─── Types ───
interface EmergencyRecoverySessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
}

interface CrisisTarget {
  id: string;
  name: string;
  subject: string;
  memory_strength: number;
  risk_level: "critical" | "high" | "medium";
}

interface MCQOption { text: string; isCorrect: boolean }
interface MCQQuestion {
  question: string;
  options: MCQOption[];
  explanation: string;
  difficulty: string;
}

type Stage =
  | "detection"
  | "emotional-reset"
  | "phase1-recall"
  | "phase2-mcq"
  | "phase3-confidence"
  | "stability-recovery"
  | "recovery-plan";

// ─── Constants ───
const RECALL_DURATION_SEC = 45;
const MCQ_PER_TOPIC = 2;

const STAGE_META: Record<Stage, { label: string; color: string }> = {
  detection: { label: "Crisis Detection", color: "text-destructive" },
  "emotional-reset": { label: "Emotional Reset", color: "text-primary" },
  "phase1-recall": { label: "Phase 1 · Critical Recall", color: "text-warning" },
  "phase2-mcq": { label: "Phase 2 · High-Impact MCQ", color: "text-destructive" },
  "phase3-confidence": { label: "Phase 3 · Confidence Lock", color: "text-primary" },
  "stability-recovery": { label: "Stability Recovery", color: "text-success" },
  "recovery-plan": { label: "Mission Complete", color: "text-success" },
};

const STAGE_ORDER: Stage[] = [
  "detection", "emotional-reset", "phase1-recall",
  "phase2-mcq", "phase3-confidence", "stability-recovery", "recovery-plan",
];

const BREATHING_STEPS = ["Breathe in...", "Hold...", "Breathe out...", "Relax..."];

// ─── Helpers ───
const norm = (s: number) => (s > 1 ? s / 100 : s);
const pct = (s: number) => Math.round(norm(s) * 100);

const getCrisisIntensity = (targets: CrisisTarget[]): "severe" | "moderate" | "mild" => {
  const avg = targets.reduce((a, t) => a + t.memory_strength, 0) / (targets.length || 1);
  if (avg < 20) return "severe";
  if (avg < 40) return "moderate";
  return "mild";
};

// ─── Component ───
const EmergencyRecoverySession = ({ open, onClose, onSessionComplete }: EmergencyRecoverySessionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("detection");
  const [targets, setTargets] = useState<CrisisTarget[]>([]);
  const [crisisIntensity, setCrisisIntensity] = useState<"severe" | "moderate" | "mild">("moderate");

  // Emotional reset
  const [breathIdx, setBreathIdx] = useState(0);

  // Recall state
  const [currentRecallIdx, setCurrentRecallIdx] = useState(0);
  const [recallTimer, setRecallTimer] = useState(RECALL_DURATION_SEC);
  const recallIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // MCQ state
  const [mcqQuestions, setMcqQuestions] = useState<MCQQuestion[]>([]);
  const [currentMcqIdx, setCurrentMcqIdx] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [mcqResults, setMcqResults] = useState<{ correct: boolean; topic: string; explanation: string }[]>([]);
  const [mcqLoading, setMcqLoading] = useState(false);

  // Confidence lock
  const [confidenceLocked, setConfidenceLocked] = useState(false);
  const [lockingConfidence, setLockingConfidence] = useState(false);

  // Stability animation
  const [stabilityBefore, setStabilityBefore] = useState(0);
  const [stabilityAfter, setStabilityAfter] = useState(0);
  const [stabilityAnimValue, setStabilityAnimValue] = useState(0);

  // Recovery plan
  const [recoveryPlan, setRecoveryPlan] = useState<string[]>([]);
  const [rescueStreak, setRescueStreak] = useState(0);

  // Voice
  const [voiceEnabled, setVoiceEnabled] = useState(false);

  // Progress
  const stageProgress = ((STAGE_ORDER.indexOf(stage) + 1) / STAGE_ORDER.length) * 100;

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || typeof speechSynthesis === "undefined") return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 0.9;
    u.pitch = 0.95;
    speechSynthesis.speak(u);
  }, [voiceEnabled]);

  // ─── Reset on open ───
  useEffect(() => {
    if (open) {
      setStage("detection");
      setTargets([]);
      setCurrentRecallIdx(0);
      setRecallTimer(RECALL_DURATION_SEC);
      setMcqQuestions([]);
      setCurrentMcqIdx(0);
      setSelectedAnswer(null);
      setAnswerRevealed(false);
      setMcqResults([]);
      setStabilityBefore(0);
      setStabilityAfter(0);
      setStabilityAnimValue(0);
      setConfidenceLocked(false);
      setLockingConfidence(false);
      setRecoveryPlan([]);
      setBreathIdx(0);
      beginDetection();
    }
    return () => { if (recallIntervalRef.current) clearInterval(recallIntervalRef.current); };
  }, [open]);

  // ─── Stage 1: Crisis Detection ───
  const beginDetection = async () => {
    setStage("detection");
    setTimeout(() => scanCrisisTopics(), 2500);
  };

  const scanCrisisTopics = async () => {
    if (!user) return;
    try {
      const { data } = await (supabase as any)
        .from("topics")
        .select("id, name, memory_strength, subjects(name)")
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("memory_strength", { ascending: true })
        .limit(3);

      const crisisTargets: CrisisTarget[] = (data || []).map((t: any) => {
        const ms = pct(t.memory_strength ?? 0);
        return {
          id: t.id,
          name: t.name,
          subject: (t.subjects as any)?.name || "General",
          memory_strength: ms,
          risk_level: ms < 25 ? "critical" as const : ms < 45 ? "high" as const : "medium" as const,
        };
      });

      if (crisisTargets.length === 0) {
        toast({ title: "No topics found", description: "Add topics first to use Crisis Stabilization.", variant: "destructive" });
        onClose();
        return;
      }

      setTargets(crisisTargets);
      const avg = crisisTargets.reduce((s, t) => s + t.memory_strength, 0) / crisisTargets.length;
      setStabilityBefore(Math.round(avg));
      setCrisisIntensity(getCrisisIntensity(crisisTargets));

      // Fetch rescue streak
      try {
        const today = new Date();
        const weekAgo = new Date(today);
        weekAgo.setDate(weekAgo.getDate() - 7);
        const { data: sessions } = await (supabase as any)
          .from("study_sessions")
          .select("created_at")
          .eq("user_id", user.id)
          .eq("session_type", "emergency")
          .gte("created_at", weekAgo.toISOString())
          .order("created_at", { ascending: false });
        setRescueStreak(sessions?.length || 0);
      } catch { /* ignore */ }

      speak("Crisis detected. Let's stabilize your memory.");
      setStage("emotional-reset");
    } catch {
      toast({ title: "Failed to scan topics", variant: "destructive" });
      onClose();
    }
  };

  // ─── Stage 2: Emotional Reset ───
  useEffect(() => {
    if (stage !== "emotional-reset") return;
    setBreathIdx(0);
    const interval = setInterval(() => {
      setBreathIdx(prev => {
        if (prev >= BREATHING_STEPS.length * 2 - 1) {
          clearInterval(interval);
          return prev;
        }
        return prev + 1;
      });
    }, 2000);
    return () => clearInterval(interval);
  }, [stage]);

  const skipReset = () => {
    speak("Starting critical recall phase.");
    startRecallPhase();
  };

  // ─── Phase 1: Critical Recall ───
  const startRecallPhase = () => {
    setCurrentRecallIdx(0);
    setRecallTimer(RECALL_DURATION_SEC);
    setStage("phase1-recall");
  };

  useEffect(() => {
    if (stage !== "phase1-recall") return;
    if (recallIntervalRef.current) clearInterval(recallIntervalRef.current);
    setRecallTimer(RECALL_DURATION_SEC);
    recallIntervalRef.current = setInterval(() => {
      setRecallTimer(prev => {
        if (prev <= 1) {
          clearInterval(recallIntervalRef.current!);
          advanceRecall();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (recallIntervalRef.current) clearInterval(recallIntervalRef.current); };
  }, [stage, currentRecallIdx]);

  const advanceRecall = () => {
    if (currentRecallIdx < targets.length - 1) {
      setCurrentRecallIdx(prev => prev + 1);
    } else {
      if (recallIntervalRef.current) clearInterval(recallIntervalRef.current);
      speak("Moving to high-impact questions.");
      startMcqPhase();
    }
  };

  const skipRecall = () => {
    if (recallIntervalRef.current) clearInterval(recallIntervalRef.current);
    advanceRecall();
  };

  // ─── Phase 2: High-Impact MCQ ───
  const startMcqPhase = async () => {
    setStage("phase2-mcq");
    setMcqLoading(true);
    setCurrentMcqIdx(0);
    setMcqResults([]);
    setSelectedAnswer(null);
    setAnswerRevealed(false);

    try {
      const allQuestions: MCQQuestion[] = [];
      for (const target of targets) {
        let gotAI = false;
        try {
          const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
            body: {
              action: "generate_mcq",
              topic: target.name,
              subject: target.subject,
              difficulty: target.memory_strength < 30 ? "easy" : "medium",
              count: MCQ_PER_TOPIC,
            },
          });
          if (!error && data?.questions?.length > 0) {
            allQuestions.push(...data.questions.map((q: any) => ({
              question: q.question || `Question about ${target.name}`,
              options: q.options?.length >= 2 ? q.options : getFallbackOptions(target.name),
              explanation: q.explanation || `Review ${target.name} for better retention.`,
              difficulty: q.difficulty || "medium",
            })));
            gotAI = true;
          }
        } catch (e) { console.error("AI MCQ fail:", target.name, e); }
        if (!gotAI) {
          for (let i = 0; i < MCQ_PER_TOPIC; i++) {
            allQuestions.push({
              question: i === 0
                ? `Which concept is most critical for "${target.name}"?`
                : `What is a key principle of "${target.name}" in ${target.subject}?`,
              options: getFallbackOptions(target.name),
              explanation: `Understanding the core principle of ${target.name} is essential for retention.`,
              difficulty: "medium",
            });
          }
        }
      }
      setMcqQuestions(allQuestions);
    } catch {
      toast({ title: "Failed to load questions", variant: "destructive" });
    } finally {
      setMcqLoading(false);
    }
  };

  const getFallbackOptions = (name: string): MCQOption[] => [
    { text: "Core foundational principle", isCorrect: true },
    { text: "Secondary application", isCorrect: false },
    { text: "Unrelated concept", isCorrect: false },
    { text: "Advanced extension", isCorrect: false },
  ];

  const handleMcqAnswer = (optionIdx: number) => {
    if (answerRevealed) return;
    setSelectedAnswer(optionIdx);
    setAnswerRevealed(true);
    const q = mcqQuestions[currentMcqIdx];
    const correct = q.options[optionIdx]?.isCorrect ?? false;
    const topicIdx = Math.floor(currentMcqIdx / MCQ_PER_TOPIC);
    setMcqResults(prev => [...prev, {
      correct,
      topic: targets[topicIdx]?.name || "Unknown",
      explanation: q.explanation,
    }]);
    if (correct) speak("Correct!");
    else speak("Let's review that.");
  };

  const nextMcq = () => {
    if (currentMcqIdx < mcqQuestions.length - 1) {
      setCurrentMcqIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswerRevealed(false);
    } else {
      setStage("phase3-confidence");
    }
  };

  // ─── Phase 3: Confidence Lock ───
  const lockConfidence = async () => {
    setLockingConfidence(true);
    const correctCount = mcqResults.filter(r => r.correct).length;
    const accuracy = mcqResults.length > 0 ? correctCount / mcqResults.length : 0;
    const gain = Math.round(accuracy * 15 + 5);
    const after = Math.min(100, stabilityBefore + gain);
    setStabilityAfter(after);

    // Log session
    if (user) {
      try {
        await (supabase as any).from("study_sessions").insert({
          user_id: user.id,
          session_type: "emergency",
          duration_minutes: crisisIntensity === "severe" ? 8 : crisisIntensity === "moderate" ? 6 : 5,
          questions_answered: mcqResults.length,
          correct_answers: correctCount,
          confidence_level: accuracy >= 0.8 ? "confident" : accuracy >= 0.5 ? "moderate" : "uncertain",
        });
      } catch { /* ignore */ }
    }

    await new Promise(r => setTimeout(r, 1500));
    setConfidenceLocked(true);
    setLockingConfidence(false);
    speak("Confidence locked. Viewing recovery.");

    // Generate recovery plan
    const plan: string[] = [];
    for (const t of targets) {
      if (t.memory_strength < 30) plan.push(`Deep review: ${t.name} (${t.subject})`);
      else if (t.memory_strength < 50) plan.push(`Quick recall: ${t.name}`);
      else plan.push(`Maintenance check: ${t.name}`);
    }
    plan.push("Run 1 Focus Session on weakest topic");
    plan.push("Complete daily Brain Mission");
    setRecoveryPlan(plan);

    setTimeout(() => {
      setStabilityAnimValue(stabilityBefore);
      setStage("stability-recovery");
    }, 800);
  };

  // ─── Stability Recovery Animation ───
  useEffect(() => {
    if (stage !== "stability-recovery") return;
    let current = stabilityBefore;
    const target = stabilityAfter;
    const step = () => {
      current += 1;
      if (current >= target) {
        setStabilityAnimValue(target);
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.55 } });
        return;
      }
      setStabilityAnimValue(current);
      requestAnimationFrame(step);
    };
    setTimeout(step, 700);
  }, [stage]);

  const goToRecoveryPlan = () => {
    speak("Your recovery plan is ready.");
    setStage("recovery-plan");
    confetti({ particleCount: 140, spread: 100, origin: { y: 0.45 } });
  };

  // ─── Finish ───
  const handleClose = () => {
    if (recallIntervalRef.current) clearInterval(recallIntervalRef.current);
    speechSynthesis?.cancel?.();
    onSessionComplete?.();
    onClose();
  };

  if (!open) return null;

  const correctCount = mcqResults.filter(r => r.correct).length;
  const accuracy = mcqResults.length > 0 ? Math.round((correctCount / mcqResults.length) * 100) : 0;
  const currentStageMeta = STAGE_META[stage];

  // ─── Render Helpers ───
  const renderProgressBar = () => (
    <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
      <motion.div
        className="h-full bg-gradient-to-r from-destructive via-warning to-success"
        animate={{ width: `${stageProgress}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      />
    </div>
  );

  const renderHeader = () => (
    <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-5">
      <span className={`text-[10px] font-semibold uppercase tracking-widest ${currentStageMeta.color}`}>
        {currentStageMeta.label}
      </span>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setVoiceEnabled(v => !v)}
          className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          aria-label="Toggle voice"
        >
          {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
        </button>
        <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {renderProgressBar()}
        {renderHeader()}

        <div className="w-full max-w-sm mx-4 max-h-[85vh] overflow-y-auto pt-10">

          {/* ═══ Stage: Crisis Detection ═══ */}
          {stage === "detection" && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center text-center py-16 gap-6"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 1.8, repeat: Infinity }}
                className="relative p-5 rounded-2xl bg-destructive/10 border border-destructive/25"
              >
                <ShieldAlert className="w-12 h-12 text-destructive" />
                {/* Pulse rings */}
                <motion.div
                  className="absolute inset-0 rounded-2xl border-2 border-destructive/20"
                  animate={{ scale: [1, 1.4], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Crisis Stabilization</h2>
                <p className="text-sm text-muted-foreground mt-2">Scanning memory for critical risks...</p>
              </div>
              <div className="flex items-center gap-2 text-destructive">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Analyzing cognitive patterns</span>
              </div>
            </motion.div>
          )}

          {/* ═══ Stage: Emotional Reset ═══ */}
          {stage === "emotional-reset" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center py-10 gap-8">
              {/* Intensity badge */}
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider border ${
                  crisisIntensity === "severe"
                    ? "border-destructive/30 bg-destructive/10 text-destructive"
                    : crisisIntensity === "moderate"
                    ? "border-warning/30 bg-warning/10 text-warning"
                    : "border-primary/30 bg-primary/10 text-primary"
                }`}
              >
                {crisisIntensity} intensity
              </motion.div>

              <div>
                <h2 className="text-lg font-bold text-foreground mb-1">Take a breath</h2>
                <p className="text-xs text-muted-foreground">Let's calm your mind before we begin.</p>
              </div>

              {/* Breathing circle */}
              <div className="relative">
                <motion.div
                  animate={{
                    scale: breathIdx % 4 === 0 ? 1.3 : breathIdx % 4 === 2 ? 0.8 : 1,
                  }}
                  transition={{ duration: 1.8, ease: "easeInOut" }}
                  className="w-28 h-28 rounded-full bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center"
                >
                  <Wind className="w-8 h-8 text-primary/60" />
                </motion.div>
                <motion.p
                  key={breathIdx}
                  initial={{ opacity: 0, y: 5 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm font-medium text-primary mt-4"
                >
                  {BREATHING_STEPS[breathIdx % BREATHING_STEPS.length]}
                </motion.p>
              </div>

              {/* Crisis targets preview */}
              <div className="w-full space-y-2">
                {targets.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.1 }}
                    className="flex items-center gap-3 p-3 rounded-xl border border-border bg-card"
                  >
                    <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                      t.risk_level === "critical" ? "bg-destructive animate-pulse" : t.risk_level === "high" ? "bg-warning" : "bg-primary"
                    }`} />
                    <span className="text-sm text-foreground flex-1 truncate">{t.name}</span>
                    <span className="text-xs font-bold text-destructive">{t.memory_strength}%</span>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={skipReset}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                <Zap className="w-4 h-4" /> Begin Stabilization
              </motion.button>
            </motion.div>
          )}

          {/* ═══ Phase 1: Critical Recall ═══ */}
          {stage === "phase1-recall" && targets[currentRecallIdx] && (
            <motion.div
              key={`recall-${currentRecallIdx}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-8 space-y-6"
            >
              <div className="text-center">
                <span className="text-[10px] text-warning font-semibold uppercase tracking-wider">
                  Recall {currentRecallIdx + 1}/{targets.length}
                </span>
                <h3 className="text-lg font-bold text-foreground mt-1">{targets[currentRecallIdx].name}</h3>
                <p className="text-xs text-muted-foreground">{targets[currentRecallIdx].subject}</p>
              </div>

              {/* Timer arc */}
              <div className="flex justify-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-secondary" />
                    <motion.circle
                      cx="50" cy="50" r="44" fill="none" strokeWidth="6"
                      className="stroke-warning"
                      strokeLinecap="round"
                      strokeDasharray={276.5}
                      animate={{ strokeDashoffset: 276.5 * (1 - recallTimer / RECALL_DURATION_SEC) }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-foreground">{recallTimer}</span>
                    <span className="text-[10px] text-muted-foreground">seconds</span>
                  </div>
                </div>
              </div>

              <div className="rounded-xl border border-warning/20 bg-warning/5 p-4 text-center">
                <p className="text-sm text-foreground font-medium">Recall everything you know about this topic.</p>
                <p className="text-xs text-muted-foreground mt-1">Key concepts, formulas, connections.</p>
              </div>

              <button
                onClick={skipRecall}
                className="w-full py-3 rounded-xl border border-border bg-card text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Done — Next →
              </button>
            </motion.div>
          )}

          {/* ═══ Phase 2: High-Impact MCQ ═══ */}
          {stage === "phase2-mcq" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 space-y-5">
              {mcqLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="w-8 h-8 text-destructive animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating crisis questions...</p>
                </div>
              ) : mcqQuestions[currentMcqIdx] ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider">
                      Q{currentMcqIdx + 1}/{mcqQuestions.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {correctCount}/{mcqResults.length} correct
                    </span>
                  </div>

                  {/* Progress dots */}
                  <div className="flex gap-1.5 justify-center flex-wrap">
                    {mcqQuestions.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                        i < mcqResults.length
                          ? mcqResults[i]?.correct ? "bg-success" : "bg-destructive"
                          : i === currentMcqIdx ? "bg-warning animate-pulse" : "bg-secondary"
                      }`} />
                    ))}
                  </div>

                  <div className="rounded-xl border border-border bg-card p-4">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {mcqQuestions[currentMcqIdx].question}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {mcqQuestions[currentMcqIdx].options.map((opt, oIdx) => {
                      const isSelected = selectedAnswer === oIdx;
                      const isCorrect = opt.isCorrect;
                      let cls = "border-border bg-card hover:border-primary/30";
                      if (answerRevealed) {
                        if (isCorrect) cls = "border-success/50 bg-success/10";
                        else if (isSelected && !isCorrect) cls = "border-destructive/50 bg-destructive/10";
                        else cls = "border-border bg-card opacity-40";
                      }
                      return (
                        <motion.button
                          key={oIdx}
                          whileTap={!answerRevealed ? { scale: 0.98 } : {}}
                          onClick={() => handleMcqAnswer(oIdx)}
                          disabled={answerRevealed}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${cls}`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                              answerRevealed && isCorrect ? "bg-success text-success-foreground"
                                : answerRevealed && isSelected ? "bg-destructive text-destructive-foreground"
                                : "bg-secondary text-muted-foreground"
                            }`}>
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <span className={`text-sm ${answerRevealed && !isCorrect && !isSelected ? "text-muted-foreground" : "text-foreground"}`}>
                              {opt.text}
                            </span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {answerRevealed && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div className="rounded-xl border border-primary/20 bg-primary/5 p-3.5">
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {mcqQuestions[currentMcqIdx].explanation}
                        </p>
                      </div>
                      <button
                        onClick={nextMcq}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                      >
                        {currentMcqIdx < mcqQuestions.length - 1 ? <>Next <ArrowRight className="w-3.5 h-3.5" /></> : <>Lock Confidence <Shield className="w-3.5 h-3.5" /></>}
                      </button>
                    </motion.div>
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No questions available.</p>
              )}
            </motion.div>
          )}

          {/* ═══ Phase 3: Confidence Lock ═══ */}
          {stage === "phase3-confidence" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-8 space-y-6">
              <div className="text-center">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/20 mb-3">
                  <Shield className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Confidence Lock</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {correctCount}/{mcqResults.length} correct · {accuracy}% accuracy
                </p>
              </div>

              {/* Results summary */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {mcqResults.map((r, i) => (
                  <div key={i} className={`flex items-center gap-3 p-3 rounded-xl border ${
                    r.correct ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
                  }`}>
                    {r.correct ? <CheckCircle className="w-4 h-4 text-success shrink-0" /> : <X className="w-4 h-4 text-destructive shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{r.topic}</p>
                    </div>
                  </div>
                ))}
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={lockConfidence}
                disabled={lockingConfidence || confidenceLocked}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm disabled:opacity-60"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                {lockingConfidence ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Locking...</>
                ) : confidenceLocked ? (
                  <><CheckCircle className="w-4 h-4" /> Locked!</>
                ) : (
                  <><Shield className="w-4 h-4" /> Lock Confidence</>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ═══ Stability Recovery Animation ═══ */}
          {stage === "stability-recovery" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground">Stability Recovering</h2>
                <p className="text-xs text-muted-foreground mt-1">Your memory is being reinforced</p>
              </div>

              {/* Animated stability arc */}
              <div className="flex justify-center">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="7" className="stroke-secondary" />
                    {/* Before (ghost) */}
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="7"
                      className="stroke-destructive/15"
                      strokeDasharray={264}
                      strokeDashoffset={264 * (1 - stabilityBefore / 100)}
                    />
                    {/* Animated recovery */}
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="7"
                      strokeLinecap="round"
                      className="stroke-success"
                      strokeDasharray={264}
                      animate={{ strokeDashoffset: 264 * (1 - stabilityAnimValue / 100) }}
                      transition={{ duration: 0.05 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-foreground">{stabilityAnimValue}%</span>
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-xs font-semibold text-success"
                    >
                      +{stabilityAfter - stabilityBefore}%
                    </motion.span>
                  </div>
                </div>
              </div>

              {/* Before/After cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Before</p>
                  <p className="text-lg font-bold text-destructive">{stabilityBefore}%</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">After</p>
                  <p className="text-lg font-bold text-success">{stabilityAfter}%</p>
                </div>
              </div>

              <button
                onClick={goToRecoveryPlan}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-success to-primary text-primary-foreground font-semibold text-sm"
              >
                <Sparkles className="w-4 h-4" /> View Recovery Plan
              </button>
            </motion.div>
          )}

          {/* ═══ Recovery Plan (Mission Complete) ═══ */}
          {stage === "recovery-plan" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 space-y-6">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.08, 1] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                  className="inline-flex p-4 rounded-2xl bg-success/10 border border-success/20 mb-4"
                >
                  <Trophy className="w-8 h-8 text-success" />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Crisis Stabilized</h2>
                <p className="text-sm text-muted-foreground mt-1">Your memory has been rescued and reinforced.</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{crisisIntensity === "severe" ? 8 : crisisIntensity === "moderate" ? 6 : 5}m</p>
                  <p className="text-[10px] text-muted-foreground">Duration</p>
                </div>
                <div className="rounded-xl border border-border bg-card p-3 text-center">
                  <Target className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{accuracy}%</p>
                  <p className="text-[10px] text-muted-foreground">Accuracy</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-center">
                  <TrendingUp className="w-4 h-4 text-success mx-auto mb-1" />
                  <p className="text-sm font-bold text-success">+{stabilityAfter - stabilityBefore}%</p>
                  <p className="text-[10px] text-muted-foreground">Stability</p>
                </div>
              </div>

              {/* Rescue Shield Streak */}
              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10">
                  <Flame className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold text-foreground">Rescue Shield Streak</p>
                  <p className="text-xs text-muted-foreground">{rescueStreak + 1} rescue{rescueStreak > 0 ? "s" : ""} this week</p>
                </div>
                <span className="text-xl font-bold text-primary">{rescueStreak + 1}</span>
              </div>

              {/* Next-day Recovery Plan */}
              <div className="rounded-xl border border-border bg-card p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-primary" />
                  <p className="text-sm font-semibold text-foreground">Tomorrow's Recovery Plan</p>
                </div>
                <div className="space-y-2">
                  {recoveryPlan.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-2.5"
                    >
                      <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* AI note */}
              <div className="rounded-xl border border-border bg-secondary/30 p-3.5">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  <Brain className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  {accuracy >= 80
                    ? "Excellent rescue! Your at-risk topics are now stabilized. Tomorrow's plan will reinforce today's gains."
                    : accuracy >= 50
                    ? "Good recovery. Review the missed concepts tomorrow—your plan is auto-scheduled."
                    : "You've begun recovery. Consistency is key. Come back tomorrow to complete stabilization."
                  }
                </p>
              </div>

              <button
                onClick={handleClose}
                className="w-full py-3.5 rounded-xl bg-gradient-to-r from-success to-primary text-primary-foreground font-semibold text-sm transition-all"
              >
                Done
              </button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmergencyRecoverySession;
