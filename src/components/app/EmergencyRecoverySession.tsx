import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Zap, Brain, Loader2, CheckCircle,
  ShieldAlert, Shield, HeartPulse, Trophy, ArrowRight,
  Clock, Target, TrendingUp, Sparkles, Wind,
  Calendar, Flame, Volume2, VolumeX, Activity
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

const STAGE_META: Record<Stage, { label: string; emoji: string }> = {
  detection: { label: "Crisis Detection", emoji: "🔴" },
  "emotional-reset": { label: "Emotional Reset", emoji: "🧘" },
  "phase1-recall": { label: "Phase 1 · Critical Recall", emoji: "⚡" },
  "phase2-mcq": { label: "Phase 2 · High-Impact MCQ", emoji: "🎯" },
  "phase3-confidence": { label: "Phase 3 · Confidence Lock", emoji: "🛡️" },
  "stability-recovery": { label: "Stability Recovery", emoji: "💚" },
  "recovery-plan": { label: "Mission Complete", emoji: "🏆" },
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

// ─── Animated Background ───
const EmergencyBackground = ({ stage }: { stage: Stage }) => {
  const isRecovery = stage === "stability-recovery" || stage === "recovery-plan";
  const isCalm = stage === "emotional-reset";

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {/* Base gradient */}
      <div
        className="absolute inset-0 transition-all duration-1000"
        style={{
          background: isRecovery
            ? "radial-gradient(ellipse at 50% 30%, hsl(142 40% 8% / 0.6) 0%, transparent 70%)"
            : isCalm
            ? "radial-gradient(ellipse at 50% 50%, hsl(220 40% 10% / 0.4) 0%, transparent 70%)"
            : "radial-gradient(ellipse at 50% 20%, hsl(0 60% 12% / 0.5) 0%, transparent 60%)",
        }}
      />

      {/* Pulsing danger glow - only in active crisis stages */}
      {!isRecovery && !isCalm && (
        <>
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[300px]"
            style={{
              background: "radial-gradient(ellipse, hsl(0 80% 50% / 0.06) 0%, transparent 70%)",
            }}
            animate={{ opacity: [0.3, 0.7, 0.3], scale: [1, 1.05, 1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          {/* Scan line effect */}
          <motion.div
            className="absolute left-0 right-0 h-px"
            style={{ background: "linear-gradient(90deg, transparent, hsl(0 70% 50% / 0.15), transparent)" }}
            animate={{ top: ["0%", "100%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
          />
        </>
      )}

      {/* Recovery glow */}
      {isRecovery && (
        <motion.div
          className="absolute bottom-0 left-1/2 -translate-x-1/2 w-[500px] h-[400px]"
          style={{
            background: "radial-gradient(ellipse, hsl(142 60% 40% / 0.08) 0%, transparent 70%)",
          }}
          animate={{ opacity: [0.4, 0.8, 0.4] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      )}
    </div>
  );
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
        .is("deleted_at", null)
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
        confetti({ particleCount: 100, spread: 80, origin: { y: 0.55 }, colors: ["#22c55e", "#10b981", "#059669"] });
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
    confetti({ particleCount: 140, spread: 100, origin: { y: 0.45 }, colors: ["#22c55e", "#f59e0b", "#3b82f6"] });
  };

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
  const isRecoveryPhase = stage === "stability-recovery" || stage === "recovery-plan";

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        style={{ background: "hsl(var(--background))" }}
      >
        <EmergencyBackground stage={stage} />

        {/* ── Progress bar ── */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-secondary/50">
          <motion.div
            className="h-full"
            style={{
              background: isRecoveryPhase
                ? "linear-gradient(90deg, hsl(142 70% 45%), hsl(160 60% 40%))"
                : "linear-gradient(90deg, hsl(0 75% 55%), hsl(35 90% 55%), hsl(142 70% 45%))",
            }}
            animate={{ width: `${stageProgress}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />
          {/* Glow on tip */}
          <motion.div
            className="absolute top-0 h-1 w-8 blur-sm"
            style={{
              background: isRecoveryPhase ? "hsl(142 80% 50%)" : "hsl(35 90% 55%)",
              left: `calc(${stageProgress}% - 16px)`,
            }}
            animate={{ opacity: [0.5, 1, 0.5] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        </div>

        {/* ── Header ── */}
        <div className="absolute top-4 left-0 right-0 flex items-center justify-between px-5 z-10">
          <div className="flex items-center gap-2">
            <motion.span
              animate={{ opacity: [0.6, 1, 0.6] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-sm"
            >
              {currentStageMeta.emoji}
            </motion.span>
            <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-destructive">
              {currentStageMeta.label}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setVoiceEnabled(v => !v)}
              className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors"
              aria-label="Toggle voice"
            >
              {voiceEnabled ? <Volume2 className="w-3.5 h-3.5 text-destructive" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground/50" />}
            </button>
            <button onClick={handleClose} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
              <X className="w-4 h-4 text-muted-foreground/50" />
            </button>
          </div>
        </div>

        <div className="relative w-full max-w-sm mx-4 max-h-[85vh] overflow-y-auto pt-10 z-10">

          {/* ═══ STAGE: CRISIS DETECTION ═══ */}
          {stage === "detection" && (
            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 20 }}
              className="flex flex-col items-center justify-center text-center py-16 gap-7"
            >
              {/* Danger icon with triple pulse rings */}
              <div className="relative">
                <motion.div
                  animate={{ scale: [1, 1.12, 1], rotate: [0, 2, -2, 0] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="relative p-6 rounded-2xl"
                  style={{
                    background: "linear-gradient(135deg, hsl(0 60% 15% / 0.6), hsl(0 50% 10% / 0.4))",
                    border: "1px solid hsl(0 60% 40% / 0.3)",
                    boxShadow: "0 0 40px hsl(0 70% 50% / 0.15), inset 0 1px 0 hsl(0 60% 60% / 0.1)",
                  }}
                >
                  <ShieldAlert className="w-14 h-14" style={{ color: "hsl(0 75% 60%)" }} />
                </motion.div>
                {/* Triple expanding rings */}
                {[0, 0.5, 1].map((delay, i) => (
                  <motion.div
                    key={i}
                    className="absolute inset-0 rounded-2xl"
                    style={{ border: "2px solid hsl(0 60% 50% / 0.2)" }}
                    animate={{ scale: [1, 1.6], opacity: [0.4, 0] }}
                    transition={{ duration: 2, repeat: Infinity, delay }}
                  />
                ))}
              </div>

              <div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">CRISIS STABILIZATION</h2>
                <p className="text-sm text-muted-foreground mt-2">Scanning your brain for critical memory risks...</p>
              </div>

              {/* Loading indicators */}
              <div className="space-y-3 w-full max-w-[200px]">
                <div className="flex items-center gap-2.5 justify-center" style={{ color: "hsl(0 70% 60%)" }}>
                  <Activity className="w-4 h-4 animate-pulse" />
                  <span className="text-xs font-semibold tracking-wide">Analyzing patterns</span>
                </div>
                <div className="h-1 rounded-full bg-secondary/50 overflow-hidden">
                  <motion.div
                    className="h-full rounded-full"
                    style={{ background: "linear-gradient(90deg, hsl(0 70% 55%), hsl(35 80% 55%))" }}
                    animate={{ width: ["0%", "70%", "100%"] }}
                    transition={{ duration: 2.5, ease: "easeInOut" }}
                  />
                </div>
              </div>
            </motion.div>
          )}

          {/* ═══ STAGE: EMOTIONAL RESET ═══ */}
          {stage === "emotional-reset" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center text-center py-8 gap-7">
              {/* Intensity badge */}
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring" }}
                className="px-5 py-2 rounded-full text-xs font-black uppercase tracking-[0.2em]"
                style={{
                  background: crisisIntensity === "severe"
                    ? "linear-gradient(135deg, hsl(0 60% 15% / 0.8), hsl(0 50% 20% / 0.6))"
                    : crisisIntensity === "moderate"
                    ? "linear-gradient(135deg, hsl(35 60% 15% / 0.8), hsl(35 50% 20% / 0.6))"
                    : "linear-gradient(135deg, hsl(220 40% 15% / 0.8), hsl(220 30% 20% / 0.6))",
                  border: `1px solid ${crisisIntensity === "severe" ? "hsl(0 60% 40% / 0.4)" : crisisIntensity === "moderate" ? "hsl(35 60% 40% / 0.4)" : "hsl(220 40% 40% / 0.4)"}`,
                  color: crisisIntensity === "severe" ? "hsl(0 80% 65%)" : crisisIntensity === "moderate" ? "hsl(35 90% 60%)" : "hsl(220 70% 65%)",
                  boxShadow: `0 0 20px ${crisisIntensity === "severe" ? "hsl(0 70% 50% / 0.15)" : "hsl(35 70% 50% / 0.15)"}`,
                }}
              >
                {crisisIntensity} intensity
              </motion.div>

              <div>
                <h2 className="text-xl font-bold text-foreground mb-1">Take a breath</h2>
                <p className="text-xs text-muted-foreground">Let's calm your mind before we begin.</p>
              </div>

              {/* Breathing orb */}
              <div className="relative">
                <motion.div
                  animate={{
                    scale: breathIdx % 4 === 0 ? 1.35 : breathIdx % 4 === 2 ? 0.75 : 1.05,
                  }}
                  transition={{ duration: 2, ease: "easeInOut" }}
                  className="w-32 h-32 rounded-full flex items-center justify-center"
                  style={{
                    background: "radial-gradient(circle, hsl(220 50% 25% / 0.5), hsl(220 40% 15% / 0.3))",
                    border: "1px solid hsl(220 50% 40% / 0.2)",
                    boxShadow: "0 0 50px hsl(220 60% 50% / 0.1), inset 0 0 30px hsl(220 50% 50% / 0.05)",
                  }}
                >
                  <Wind className="w-8 h-8" style={{ color: "hsl(220 50% 60% / 0.7)" }} />
                </motion.div>
                <motion.p
                  key={breathIdx}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-sm font-semibold mt-5"
                  style={{ color: "hsl(220 50% 65%)" }}
                >
                  {BREATHING_STEPS[breathIdx % BREATHING_STEPS.length]}
                </motion.p>
              </div>

              {/* Crisis targets */}
              <div className="w-full space-y-2">
                {targets.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.12, type: "spring" }}
                    className="flex items-center gap-3 p-3.5 rounded-xl"
                    style={{
                      background: "hsl(var(--card) / 0.6)",
                      border: `1px solid ${t.risk_level === "critical" ? "hsl(0 50% 40% / 0.3)" : "hsl(var(--border))"}`,
                      boxShadow: t.risk_level === "critical" ? "0 0 15px hsl(0 60% 50% / 0.05)" : "none",
                    }}
                  >
                    <motion.div
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{
                        background: t.risk_level === "critical" ? "hsl(0 75% 55%)" : t.risk_level === "high" ? "hsl(35 85% 55%)" : "hsl(var(--primary))",
                      }}
                      animate={t.risk_level === "critical" ? { scale: [1, 1.4, 1], opacity: [1, 0.6, 1] } : {}}
                      transition={{ duration: 1.5, repeat: Infinity }}
                    />
                    <span className="text-sm text-foreground flex-1 truncate font-medium">{t.name}</span>
                    <span className="text-xs font-black" style={{ color: "hsl(0 70% 60%)" }}>{t.memory_strength}%</span>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={skipReset}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(0 65% 50%), hsl(25 80% 50%))",
                  boxShadow: "0 4px 25px hsl(0 70% 50% / 0.3), 0 0 0 1px hsl(0 60% 55% / 0.2)",
                }}
              >
                <Zap className="w-4.5 h-4.5" /> Begin Stabilization
              </motion.button>
            </motion.div>
          )}

          {/* ═══ PHASE 1: CRITICAL RECALL ═══ */}
          {stage === "phase1-recall" && targets[currentRecallIdx] && (
            <motion.div
              key={`recall-${currentRecallIdx}`}
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="py-8 space-y-6"
            >
              <div className="text-center">
                <motion.span
                  animate={{ opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="text-[10px] font-black uppercase tracking-[0.2em]"
                  style={{ color: "hsl(35 90% 55%)" }}
                >
                  ⚡ Recall {currentRecallIdx + 1}/{targets.length}
                </motion.span>
                <h3 className="text-xl font-black text-foreground mt-2 tracking-tight">{targets[currentRecallIdx].name}</h3>
                <p className="text-xs text-muted-foreground mt-0.5">{targets[currentRecallIdx].subject}</p>
              </div>

              {/* Timer arc */}
              <div className="flex justify-center">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" strokeWidth="5" stroke="hsl(var(--secondary))" strokeOpacity="0.3" />
                    <motion.circle
                      cx="50" cy="50" r="44" fill="none" strokeWidth="5"
                      stroke={recallTimer < 10 ? "hsl(0 75% 55%)" : "hsl(35 90% 55%)"}
                      strokeLinecap="round"
                      strokeDasharray={276.5}
                      animate={{ strokeDashoffset: 276.5 * (1 - recallTimer / RECALL_DURATION_SEC) }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className={`text-3xl font-black ${recallTimer < 10 ? "text-destructive" : "text-foreground"}`}>{recallTimer}</span>
                    <span className="text-[9px] text-muted-foreground uppercase tracking-wider">seconds</span>
                  </div>
                  {/* Timer glow */}
                  {recallTimer < 10 && (
                    <motion.div
                      className="absolute inset-0 rounded-full"
                      style={{ boxShadow: "0 0 20px hsl(0 70% 50% / 0.2)" }}
                      animate={{ opacity: [0, 0.6, 0] }}
                      transition={{ duration: 0.8, repeat: Infinity }}
                    />
                  )}
                </div>
              </div>

              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: "hsl(35 50% 12% / 0.3)",
                  border: "1px solid hsl(35 50% 40% / 0.15)",
                }}
              >
                <p className="text-sm text-foreground font-semibold">Recall everything about this topic.</p>
                <p className="text-xs text-muted-foreground mt-1">Key concepts, formulas, connections.</p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={skipRecall}
                className="w-full py-3.5 rounded-xl font-semibold text-sm transition-colors"
                style={{
                  background: "hsl(var(--card) / 0.6)",
                  border: "1px solid hsl(35 50% 40% / 0.2)",
                  color: "hsl(35 90% 60%)",
                }}
              >
                Done — Next →
              </motion.button>
            </motion.div>
          )}

          {/* ═══ PHASE 2: HIGH-IMPACT MCQ ═══ */}
          {stage === "phase2-mcq" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 space-y-5">
              {mcqLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-5">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="w-10 h-10" style={{ color: "hsl(0 70% 55%)" }} />
                  </motion.div>
                  <p className="text-sm text-muted-foreground font-medium">Generating crisis questions...</p>
                  <div className="h-1 w-32 rounded-full bg-secondary/40 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: "linear-gradient(90deg, hsl(0 70% 55%), hsl(35 80% 55%))" }}
                      animate={{ width: ["20%", "80%", "60%", "100%"] }}
                      transition={{ duration: 3, repeat: Infinity }}
                    />
                  </div>
                </div>
              ) : mcqQuestions[currentMcqIdx] ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black uppercase tracking-[0.15em]" style={{ color: "hsl(0 70% 60%)" }}>
                      🎯 Q{currentMcqIdx + 1}/{mcqQuestions.length}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-bold text-muted-foreground">
                        {correctCount}/{mcqResults.length}
                      </span>
                      <CheckCircle className="w-3 h-3 text-success" />
                    </div>
                  </div>

                  {/* Progress dots */}
                  <div className="flex gap-1.5 justify-center flex-wrap">
                    {mcqQuestions.map((_, i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full transition-all"
                        style={{
                          background: i < mcqResults.length
                            ? mcqResults[i]?.correct ? "hsl(142 70% 50%)" : "hsl(0 70% 55%)"
                            : i === currentMcqIdx ? "hsl(35 90% 55%)" : "hsl(var(--secondary))",
                          boxShadow: i === currentMcqIdx ? "0 0 8px hsl(35 90% 55% / 0.5)" : "none",
                        }}
                        animate={i === currentMcqIdx ? { scale: [1, 1.3, 1] } : {}}
                        transition={{ duration: 1.5, repeat: Infinity }}
                      />
                    ))}
                  </div>

                  <div
                    className="rounded-xl p-5"
                    style={{
                      background: "hsl(var(--card) / 0.7)",
                      border: "1px solid hsl(0 40% 40% / 0.15)",
                      boxShadow: "0 2px 15px hsl(0 50% 50% / 0.05)",
                    }}
                  >
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      {mcqQuestions[currentMcqIdx].question}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {mcqQuestions[currentMcqIdx].options.map((opt, oIdx) => {
                      const isSelected = selectedAnswer === oIdx;
                      const isCorrect = opt.isCorrect;
                      let bg = "hsl(var(--card) / 0.5)";
                      let border = "hsl(var(--border))";
                      let opacity = "1";

                      if (answerRevealed) {
                        if (isCorrect) {
                          bg = "hsl(142 50% 15% / 0.4)";
                          border = "hsl(142 60% 40% / 0.4)";
                        } else if (isSelected) {
                          bg = "hsl(0 50% 15% / 0.4)";
                          border = "hsl(0 60% 40% / 0.4)";
                        } else {
                          opacity = "0.35";
                        }
                      }

                      return (
                        <motion.button
                          key={oIdx}
                          whileTap={!answerRevealed ? { scale: 0.98 } : {}}
                          onClick={() => handleMcqAnswer(oIdx)}
                          disabled={answerRevealed}
                          className="w-full text-left p-4 rounded-xl transition-all"
                          style={{ background: bg, border: `1px solid ${border}`, opacity }}
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-black shrink-0"
                              style={{
                                background: answerRevealed && isCorrect
                                  ? "hsl(142 60% 45%)"
                                  : answerRevealed && isSelected
                                  ? "hsl(0 60% 50%)"
                                  : "hsl(var(--secondary))",
                                color: answerRevealed && (isCorrect || isSelected) ? "white" : "hsl(var(--muted-foreground))",
                              }}
                            >
                              {String.fromCharCode(65 + oIdx)}
                            </div>
                            <span className="text-sm text-foreground font-medium">{opt.text}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {answerRevealed && (
                    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                      <div
                        className="rounded-xl p-4"
                        style={{
                          background: "hsl(var(--card) / 0.4)",
                          border: "1px solid hsl(var(--border) / 0.5)",
                        }}
                      >
                        <p className="text-xs text-muted-foreground leading-relaxed">
                          {mcqQuestions[currentMcqIdx].explanation}
                        </p>
                      </div>
                      <motion.button
                        whileTap={{ scale: 0.97 }}
                        onClick={nextMcq}
                        className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-sm text-white"
                        style={{
                          background: currentMcqIdx < mcqQuestions.length - 1
                            ? "linear-gradient(135deg, hsl(0 65% 50%), hsl(25 80% 50%))"
                            : "linear-gradient(135deg, hsl(220 60% 50%), hsl(250 60% 55%))",
                          boxShadow: "0 4px 20px hsl(0 60% 50% / 0.2)",
                        }}
                      >
                        {currentMcqIdx < mcqQuestions.length - 1
                          ? <>Next <ArrowRight className="w-3.5 h-3.5" /></>
                          : <>Lock Confidence <Shield className="w-3.5 h-3.5" /></>
                        }
                      </motion.button>
                    </motion.div>
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No questions available.</p>
              )}
            </motion.div>
          )}

          {/* ═══ PHASE 3: CONFIDENCE LOCK ═══ */}
          {stage === "phase3-confidence" && (
            <motion.div initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ type: "spring" }} className="py-8 space-y-6">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-flex p-4 rounded-2xl mb-4"
                  style={{
                    background: "linear-gradient(135deg, hsl(220 50% 15% / 0.6), hsl(250 40% 12% / 0.4))",
                    border: "1px solid hsl(220 50% 40% / 0.25)",
                    boxShadow: "0 0 30px hsl(220 60% 50% / 0.1)",
                  }}
                >
                  <Shield className="w-7 h-7" style={{ color: "hsl(220 70% 65%)" }} />
                </motion.div>
                <h2 className="text-xl font-black text-foreground tracking-tight">Confidence Lock</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {correctCount}/{mcqResults.length} correct · {accuracy}% accuracy
                </p>
              </div>

              {/* Results */}
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {mcqResults.map((r, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center gap-3 p-3 rounded-xl"
                    style={{
                      background: r.correct ? "hsl(142 40% 12% / 0.3)" : "hsl(0 40% 12% / 0.3)",
                      border: `1px solid ${r.correct ? "hsl(142 50% 40% / 0.2)" : "hsl(0 50% 40% / 0.2)"}`,
                    }}
                  >
                    {r.correct
                      ? <CheckCircle className="w-4 h-4 shrink-0" style={{ color: "hsl(142 70% 50%)" }} />
                      : <X className="w-4 h-4 shrink-0" style={{ color: "hsl(0 70% 55%)" }} />
                    }
                    <p className="text-xs font-medium text-foreground truncate flex-1">{r.topic}</p>
                  </motion.div>
                ))}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={lockConfidence}
                disabled={lockingConfidence || confidenceLocked}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm text-white disabled:opacity-50"
                style={{
                  background: confidenceLocked
                    ? "linear-gradient(135deg, hsl(142 60% 40%), hsl(160 50% 35%))"
                    : "linear-gradient(135deg, hsl(220 60% 50%), hsl(250 60% 55%))",
                  boxShadow: "0 4px 25px hsl(220 60% 50% / 0.25)",
                }}
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

          {/* ═══ STABILITY RECOVERY ═══ */}
          {stage === "stability-recovery" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 space-y-7">
              <div className="text-center">
                <h2 className="text-xl font-black text-foreground tracking-tight">Stability Recovering</h2>
                <p className="text-xs text-muted-foreground mt-1">Your memory is being reinforced</p>
              </div>

              {/* Animated stability arc */}
              <div className="flex justify-center">
                <div className="relative w-44 h-44">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="6" stroke="hsl(var(--secondary))" strokeOpacity="0.2" />
                    {/* Ghost (before) */}
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                      stroke="hsl(0 60% 50%)" strokeOpacity="0.12"
                      strokeDasharray={264}
                      strokeDashoffset={264 * (1 - stabilityBefore / 100)}
                    />
                    {/* Recovery arc */}
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="6"
                      strokeLinecap="round"
                      stroke="hsl(142 70% 50%)"
                      strokeDasharray={264}
                      animate={{ strokeDashoffset: 264 * (1 - stabilityAnimValue / 100) }}
                      transition={{ duration: 0.05 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-4xl font-black text-foreground">{stabilityAnimValue}%</span>
                    <motion.span
                      initial={{ opacity: 0, y: 5 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="text-sm font-bold"
                      style={{ color: "hsl(142 70% 50%)" }}
                    >
                      +{stabilityAfter - stabilityBefore}%
                    </motion.span>
                  </div>
                  {/* Glow ring */}
                  <motion.div
                    className="absolute inset-2 rounded-full"
                    style={{ boxShadow: "0 0 30px hsl(142 60% 50% / 0.15)" }}
                    animate={{ opacity: [0.3, 0.7, 0.3] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
              </div>

              {/* Before/After */}
              <div className="grid grid-cols-2 gap-3">
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: "hsl(0 40% 12% / 0.3)",
                    border: "1px solid hsl(0 50% 40% / 0.15)",
                  }}
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Before</p>
                  <p className="text-xl font-black mt-1" style={{ color: "hsl(0 70% 60%)" }}>{stabilityBefore}%</p>
                </div>
                <div
                  className="rounded-xl p-4 text-center"
                  style={{
                    background: "hsl(142 40% 12% / 0.3)",
                    border: "1px solid hsl(142 50% 40% / 0.15)",
                  }}
                >
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">After</p>
                  <p className="text-xl font-black mt-1" style={{ color: "hsl(142 70% 50%)" }}>{stabilityAfter}%</p>
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={goToRecoveryPlan}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl font-bold text-sm text-white"
                style={{
                  background: "linear-gradient(135deg, hsl(142 60% 40%), hsl(160 50% 35%))",
                  boxShadow: "0 4px 25px hsl(142 60% 40% / 0.25)",
                }}
              >
                <Sparkles className="w-4 h-4" /> View Recovery Plan
              </motion.button>
            </motion.div>
          )}

          {/* ═══ RECOVERY PLAN (MISSION COMPLETE) ═══ */}
          {stage === "recovery-plan" && (
            <motion.div initial={{ opacity: 0, scale: 0.93 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" }} className="py-8 space-y-6">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="inline-flex p-5 rounded-2xl mb-4"
                  style={{
                    background: "linear-gradient(135deg, hsl(142 40% 15% / 0.5), hsl(50 40% 15% / 0.3))",
                    border: "1px solid hsl(142 50% 40% / 0.2)",
                    boxShadow: "0 0 40px hsl(142 60% 50% / 0.1)",
                  }}
                >
                  <Trophy className="w-9 h-9" style={{ color: "hsl(45 90% 55%)" }} />
                </motion.div>
                <h2 className="text-2xl font-black text-foreground tracking-tight">Crisis Stabilized</h2>
                <p className="text-sm text-muted-foreground mt-1">Your memory has been rescued and reinforced.</p>
              </div>

              {/* Stats row */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Clock, value: `${crisisIntensity === "severe" ? 8 : crisisIntensity === "moderate" ? 6 : 5}m`, label: "Duration", color: "hsl(var(--muted-foreground))" },
                  { icon: Target, value: `${accuracy}%`, label: "Accuracy", color: "hsl(var(--muted-foreground))" },
                  { icon: TrendingUp, value: `+${stabilityAfter - stabilityBefore}%`, label: "Stability", color: "hsl(142 70% 50%)" },
                ].map((stat, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="rounded-xl p-3 text-center"
                    style={{
                      background: i === 2 ? "hsl(142 40% 12% / 0.3)" : "hsl(var(--card) / 0.5)",
                      border: `1px solid ${i === 2 ? "hsl(142 50% 40% / 0.15)" : "hsl(var(--border) / 0.5)"}`,
                    }}
                  >
                    <stat.icon className="w-4 h-4 mx-auto mb-1" style={{ color: stat.color }} />
                    <p className="text-sm font-black" style={{ color: stat.color }}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Rescue Shield Streak */}
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl p-4 flex items-center gap-3"
                style={{
                  background: "linear-gradient(135deg, hsl(25 50% 12% / 0.4), hsl(0 40% 10% / 0.3))",
                  border: "1px solid hsl(25 60% 40% / 0.2)",
                  boxShadow: "0 0 20px hsl(25 60% 50% / 0.05)",
                }}
              >
                <motion.div
                  animate={{ scale: [1, 1.15, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                  className="p-2.5 rounded-lg"
                  style={{ background: "hsl(25 50% 20% / 0.5)", border: "1px solid hsl(25 60% 40% / 0.2)" }}
                >
                  <Flame className="w-5 h-5" style={{ color: "hsl(25 90% 55%)" }} />
                </motion.div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-foreground">Rescue Shield Streak</p>
                  <p className="text-xs text-muted-foreground">{rescueStreak + 1} rescue{rescueStreak > 0 ? "s" : ""} this week</p>
                </div>
                <span className="text-2xl font-black" style={{ color: "hsl(25 90% 55%)" }}>{rescueStreak + 1}</span>
              </motion.div>

              {/* Next-day Recovery Plan */}
              <div
                className="rounded-xl p-4 space-y-3"
                style={{
                  background: "hsl(var(--card) / 0.5)",
                  border: "1px solid hsl(var(--border) / 0.5)",
                }}
              >
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4" style={{ color: "hsl(220 60% 60%)" }} />
                  <p className="text-sm font-bold text-foreground">Tomorrow's Recovery Plan</p>
                </div>
                <div className="space-y-2">
                  {recoveryPlan.map((item, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.4 + i * 0.08 }}
                      className="flex items-center gap-2.5"
                    >
                      <div
                        className="w-5 h-5 rounded-full flex items-center justify-center shrink-0"
                        style={{ background: "hsl(220 50% 20% / 0.5)", border: "1px solid hsl(220 50% 40% / 0.2)" }}
                      >
                        <span className="text-[9px] font-black" style={{ color: "hsl(220 60% 65%)" }}>{i + 1}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{item}</p>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* AI note */}
              <div
                className="rounded-xl p-4"
                style={{
                  background: "hsl(var(--card) / 0.3)",
                  border: "1px solid hsl(var(--border) / 0.3)",
                }}
              >
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  <Brain className="w-3.5 h-3.5 inline mr-1" style={{ color: "hsl(220 60% 60%)" }} />
                  {accuracy >= 80
                    ? "Excellent rescue! Your at-risk topics are now stabilized. Tomorrow's plan will reinforce today's gains."
                    : accuracy >= 50
                    ? "Good recovery. Review the missed concepts tomorrow—your plan is auto-scheduled."
                    : "You've begun recovery. Consistency is key. Come back tomorrow to complete stabilization."
                  }
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                className="w-full py-4 rounded-xl font-bold text-sm text-white transition-all"
                style={{
                  background: "linear-gradient(135deg, hsl(142 60% 40%), hsl(160 50% 35%))",
                  boxShadow: "0 4px 25px hsl(142 60% 40% / 0.25)",
                }}
              >
                Done
              </motion.button>
            </motion.div>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmergencyRecoverySession;
