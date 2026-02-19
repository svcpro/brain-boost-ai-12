import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, Play, Pause, X, ShieldCheck,
  SkipForward, Clock, BookOpen, Brain, TrendingUp,
  Sparkles, Loader2, Target, Volume2, VolumeX,
  Zap, Trophy, ArrowRight, Star, Flame, BarChart3,
  ChevronRight, CloudRain, Music, Radio, CheckCircle,
  RefreshCw, Award, Rocket
} from "lucide-react";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/useAmbientSound";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { emitEvent } from "@/lib/eventBus";

interface FocusModeSessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
  initialSubject?: string;
  initialTopic?: string;
  autoStart?: boolean;
}

type FocusStep = "preparing" | "summary" | "execution" | "phase-reward" | "complete" | "next-action";

interface SessionPhase {
  type: "recall" | "reinforcement" | "mcq" | "review";
  title: string;
  description: string;
  duration: number;
  difficulty: "easy" | "medium" | "hard";
  completed: boolean;
}

interface AISessionPlan {
  subject: string;
  topic: string;
  subtopic: string;
  duration: number;
  difficulty: "easy" | "medium" | "hard";
  expectedGain: string;
  rankImpact: string;
  stability: number;
  phases: SessionPhase[];
}

interface MCQQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const PREP_MESSAGES = [
  { text: "Scanning your brain data...", icon: Brain },
  { text: "Selecting optimal topic...", icon: Target },
  { text: "Calibrating difficulty...", icon: BarChart3 },
  { text: "Designing session structure...", icon: Sparkles },
];

const PHASE_ICONS = {
  recall: Brain,
  reinforcement: RefreshCw,
  mcq: Target,
  review: BookOpen,
};

const PHASE_COLORS = {
  recall: { bg: "bg-primary/15", text: "text-primary" },
  reinforcement: { bg: "bg-warning/15", text: "text-warning" },
  mcq: { bg: "bg-success/15", text: "text-success" },
  review: { bg: "bg-accent/15", text: "text-accent-foreground" },
};

const MICRO_REWARDS = [
  { emoji: "🧠", title: "Recall Mastered!", subtitle: "Memory pathways activated" },
  { emoji: "💪", title: "Concepts Locked In!", subtitle: "Neural connections strengthened" },
  { emoji: "🎯", title: "Assessment Cleared!", subtitle: "Knowledge validated" },
  { emoji: "⭐", title: "Review Complete!", subtitle: "Long-term retention secured" },
];

const FocusModeSession = ({ open, onClose, onSessionComplete }: FocusModeSessionProps) => {
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const ambient = useAmbientSound();
  const { user } = useAuth();

  const [step, setStep] = useState<FocusStep>("preparing");
  const [prepIndex, setPrepIndex] = useState(0);
  const [plan, setPlan] = useState<AISessionPlan | null>(null);

  // Execution state
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [currentMCQ, setCurrentMCQ] = useState<MCQQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // Completion state
  const [stabilityBefore, setStabilityBefore] = useState(0);
  const [stabilityAfter, setStabilityAfter] = useState<number | null>(null);
  const [focusQuality, setFocusQuality] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ═══ Reset on open ═══
  useEffect(() => {
    if (open) {
      setStep("preparing");
      setPrepIndex(0);
      setPlan(null);
      setCurrentPhaseIndex(0);
      setCorrectAnswers(0);
      setTotalAnswered(0);
      setCurrentMCQ(null);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAdaptiveDifficulty("medium");
      setStabilityAfter(null);
      setFocusQuality(0);
      startAIPreparation();
    } else {
      clearTimer();
      ambient.stop();
    }
  }, [open]);

  // ═══ Prep animation ═══
  useEffect(() => {
    if (step !== "preparing") return;
    const t = setInterval(() => {
      setPrepIndex(prev => prev < PREP_MESSAGES.length - 1 ? prev + 1 : prev);
    }, 900);
    return () => clearInterval(t);
  }, [step]);

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  const startCountdown = (secs: number) => {
    clearTimer();
    setSecondsLeft(secs);
    intervalRef.current = setInterval(() => {
      setSecondsLeft(prev => {
        if (prev <= 1) { clearTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  useEffect(() => () => clearTimer(), []);

  // ═══════════════════════════════════════════════════
  //  AI PREPARATION — Zero manual input
  // ═══════════════════════════════════════════════════
  const startAIPreparation = async () => {
    if (!user) return;
    const prepStart = Date.now();

    try {
      const [topicRes, examRes, featuresRes] = await Promise.all([
        (supabase as any)
          .from("topics")
          .select("id, name, memory_strength, subjects(name)")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("memory_strength", { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("exam_results")
          .select("score, total_questions, difficulty")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
        (supabase as any)
          .from("user_features")
          .select("recall_success_rate, knowledge_stability, subject_strength_score")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const weakTopic = topicRes.data;
      const recentExams = examRes.data || [];
      const features = featuresRes.data;

      const topicName = weakTopic?.name || "General Review";
      const subjectName = (weakTopic?.subjects as any)?.name || "General";
      const memoryStrength = weakTopic ? Math.round(Number(weakTopic.memory_strength ?? 0) * 100) : 50;

      // Difficulty calibration
      let avgAccuracy = 0.5;
      if (recentExams.length > 0) {
        avgAccuracy = recentExams.reduce((s: number, e: any) => s + (e.score / Math.max(1, e.total_questions)), 0) / recentExams.length;
      }
      const recallRate = features?.recall_success_rate ?? 0.5;

      const difficulty: "easy" | "medium" | "hard" =
        avgAccuracy > 0.75 && recallRate > 0.7 ? "hard" :
        avgAccuracy < 0.45 || recallRate < 0.35 ? "easy" : "medium";

      // Duration: 20–30 min based on stability
      const duration = memoryStrength < 30 ? 30 : memoryStrength < 50 ? 25 : 20;

      const expectedGain = memoryStrength < 30 ? "+8-12%" : memoryStrength < 60 ? "+5-8%" : "+2-4%";
      const rankImpact = memoryStrength < 40 ? "+150-300 ranks" : memoryStrength < 70 ? "+50-150 ranks" : "+10-50 ranks";

      // 4-phase structure: Recall → Reinforcement → MCQ → Review
      const recallTime = Math.round(duration * 0.25);
      const reinforceTime = Math.round(duration * 0.3);
      const mcqTime = Math.round(duration * 0.3);
      const reviewTime = duration - recallTime - reinforceTime - mcqTime;

      const sessionPlan: AISessionPlan = {
        subject: subjectName,
        topic: topicName,
        subtopic: topicName,
        duration,
        difficulty,
        expectedGain,
        rankImpact,
        stability: memoryStrength,
        phases: [
          {
            type: "recall",
            title: "Active Recall",
            description: `Close all materials. Write down everything you remember about ${topicName}. Activate memory pathways.`,
            duration: recallTime,
            difficulty,
            completed: false,
          },
          {
            type: "reinforcement",
            title: "Concept Reinforcement",
            description: `Review and strengthen the concepts of ${topicName}. Fill gaps from the recall phase.`,
            duration: reinforceTime,
            difficulty,
            completed: false,
          },
          {
            type: "mcq",
            title: "Adaptive Assessment",
            description: `AI-generated questions that adapt to your performance in real-time.`,
            duration: mcqTime,
            difficulty,
            completed: false,
          },
          {
            type: "review",
            title: "Consolidation Review",
            description: `Quick review of key takeaways. Lock in what you've learned for long-term retention.`,
            duration: reviewTime,
            difficulty,
            completed: false,
          },
        ],
      };

      setPlan(sessionPlan);
      setStabilityBefore(memoryStrength);
      setAdaptiveDifficulty(difficulty);

      // Ensure minimum prep animation time
      const elapsed = Date.now() - prepStart;
      if (elapsed < 3500) await new Promise(r => setTimeout(r, 3500 - elapsed));

      setStep("summary");
    } catch (err) {
      console.error("AI preparation error:", err);
      const fallbackPlan: AISessionPlan = {
        subject: "General", topic: "Quick Review", subtopic: "Mixed Topics",
        duration: 20, difficulty: "medium", expectedGain: "+3-6%",
        rankImpact: "+50-100 ranks", stability: 50,
        phases: [
          { type: "recall", title: "Active Recall", description: "Recall key points from memory.", duration: 5, difficulty: "medium", completed: false },
          { type: "reinforcement", title: "Reinforcement", description: "Review and strengthen concepts.", duration: 6, difficulty: "medium", completed: false },
          { type: "mcq", title: "Assessment", description: "Test your understanding.", duration: 6, difficulty: "medium", completed: false },
          { type: "review", title: "Review", description: "Consolidate your learning.", duration: 3, difficulty: "medium", completed: false },
        ],
      };
      setPlan(fallbackPlan);
      setStabilityBefore(50);
      setStep("summary");
    }
  };

  // ═══════════════════════════════════════════════════
  //  EXECUTION
  // ═══════════════════════════════════════════════════
  const handleEnterFocusMode = () => {
    setStep("execution");
    setCurrentPhaseIndex(0);
    startTimeRef.current = Date.now();
    const firstDuration = plan?.phases[0]?.duration || 5;
    startCountdown(firstDuration * 60);
  };

  useEffect(() => {
    if (secondsLeft === 0 && step === "execution" && !isPaused && plan && startTimeRef.current > 0) {
      handlePhaseComplete();
    }
  }, [secondsLeft, step, isPaused]);

  const handlePhaseComplete = () => {
    if (!plan) return;
    clearTimer();

    const updated = { ...plan, phases: plan.phases.map((p, i) => i === currentPhaseIndex ? { ...p, completed: true } : p) };
    setPlan(updated);

    const nextIndex = currentPhaseIndex + 1;
    if (nextIndex < plan.phases.length) {
      // Show micro reward before next phase
      setStep("phase-reward");

      // Mini confetti burst
      confetti({ particleCount: 40, spread: 60, origin: { y: 0.6 }, colors: ["#22c55e", "#6366f1", "#f59e0b"] });
    } else {
      handleSessionComplete();
    }
  };

  const continueToNextPhase = () => {
    if (!plan) return;
    const nextIndex = currentPhaseIndex + 1;
    setCurrentPhaseIndex(nextIndex);
    setStep("execution");
    if (plan.phases[nextIndex].type === "mcq") fetchAIMCQ();
    startCountdown(plan.phases[nextIndex].duration * 60);
  };

  // ═══════════════════════════════════════════════════
  //  ADAPTIVE MCQ — AI-generated
  // ═══════════════════════════════════════════════════
  const fetchAIMCQ = async () => {
    const topic = plan?.topic || "this topic";
    try {
      const { data } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "mission_questions",
          topic_name: topic,
          subject_name: plan?.subject,
          difficulty: adaptiveDifficulty,
          count: 1,
        },
      });
      const q = data?.questions?.[0];
      if (q) {
        setCurrentMCQ({
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          explanation: q.explanation,
        });
        setSelectedAnswer(null);
        setShowExplanation(false);
        return;
      }
    } catch { /* fallback */ }
    generateFallbackMCQ();
  };

  const generateFallbackMCQ = () => {
    const topic = plan?.topic || "this topic";
    setCurrentMCQ({
      question: `Which of the following best describes a key concept in ${topic}?`,
      options: [
        "A fundamental principle that forms the foundation",
        "A secondary concept with limited application",
        "An advanced theorem with no practical use",
        "A deprecated concept no longer relevant",
      ],
      correctIndex: 0,
      explanation: `Understanding the fundamental principles of ${topic} is critical for building deeper knowledge.`,
    });
    setSelectedAnswer(null);
    setShowExplanation(false);
  };

  const handleAnswerSelect = (index: number) => {
    if (showExplanation) return;
    setSelectedAnswer(index);
    setShowExplanation(true);
    setTotalAnswered(prev => prev + 1);

    if (currentMCQ && index === currentMCQ.correctIndex) {
      setCorrectAnswers(prev => prev + 1);
      if (adaptiveDifficulty === "easy") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("hard");
    } else {
      if (adaptiveDifficulty === "hard") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("easy");
    }
  };

  const nextMCQ = () => fetchAIMCQ();

  // ═══════════════════════════════════════════════════
  //  COMPLETION
  // ═══════════════════════════════════════════════════
  const handleSessionComplete = async () => {
    if (!plan) return;
    clearTimer();
    ambient.stop();
    setStep("complete");

    confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, colors: ["#22c55e", "#6366f1", "#f59e0b", "#14b8a6"] });
    setTimeout(() => confetti({ particleCount: 80, spread: 110, origin: { y: 0.4, x: 0.25 } }), 400);
    setTimeout(() => confetti({ particleCount: 80, spread: 110, origin: { y: 0.4, x: 0.75 } }), 700);

    const elapsedMs = Date.now() - startTimeRef.current;
    const elapsed = Math.max(1, Math.round(elapsedMs / 60000));
    const accuracy = totalAnswered > 0 ? correctAnswers / totalAnswered : 0.5;

    const quality = Math.round(
      (accuracy * 40) +
      (Math.min(elapsed / plan.duration, 1) * 35) +
      (plan.phases.filter(p => p.completed).length / plan.phases.length * 25)
    );
    setFocusQuality(quality);

    await logStudy({
      subjectName: plan.subject,
      topicName: plan.topic,
      durationMinutes: elapsed,
      confidenceLevel: accuracy > 0.7 ? "high" : accuracy > 0.4 ? "medium" : "low",
      studyMode: "focus",
    });

    if (user && plan.topic) {
      const { data } = await (supabase as any)
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id)
        .eq("name", plan.topic)
        .is("deleted_at", null)
        .maybeSingle();
      setStabilityAfter(data ? Math.round(Number(data.memory_strength ?? 0) * 100) : null);
    }

    onSessionComplete?.();

    emitEvent("study_session_end", {
      mode: "deep_focus",
      duration: elapsed,
      topic: plan.topic,
      accuracy: totalAnswered > 0 ? Math.round(accuracy * 100) : null,
    }, {
      title: "Deep Focus Complete! 🧠",
      body: `${elapsed} min on ${plan.topic}`,
    });

    import("@/lib/eventBus").then(({ emitDynamicReward }) =>
      emitDynamicReward({
        session_duration: elapsed,
        topics_reviewed: 1,
        confidence_delta: accuracy > 0.5 ? 10 : -5,
      })
    );
  };

  // ═══ Computed ═══
  const currentPhase = plan?.phases[currentPhaseIndex];
  const totalPlanSecs = (currentPhase?.duration || 1) * 60;
  const phaseProgress = totalPlanSecs > 0 ? ((totalPlanSecs - secondsLeft) / totalPlanSecs) * 100 : 0;
  const overallProgress = plan ? ((currentPhaseIndex + (phaseProgress / 100)) / plan.phases.length) * 100 : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const completedPhases = plan?.phases.filter(p => p.completed).length || 0;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {/* Overall progress bar */}
        {(step === "execution" || step === "phase-reward") && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-[60]">
            <motion.div className="h-full bg-primary" style={{ width: `${overallProgress}%` }} transition={{ duration: 0.5 }} />
          </div>
        )}

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-5 relative"
          style={{ boxShadow: "0 0 60px hsl(var(--primary) / 0.08)" }}
        >
          {/* Close — only on summary */}
          {step === "summary" && (
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* ═══ STEP 1: AI Preparation Animation ═══ */}
          {step === "preparing" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center gap-6">
              <motion.div
                animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.2)" }}
              >
                <Brain className="w-10 h-10 text-primary" />
              </motion.div>

              <div className="space-y-3 w-full max-w-xs">
                {PREP_MESSAGES.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: i <= prepIndex ? 1 : 0.2, x: i <= prepIndex ? 0 : -20 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    {i < prepIndex ? (
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    ) : i === prepIndex ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <Loader2 className="w-4 h-4 text-primary shrink-0" />
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                    )}
                    <span className={`text-sm ${i <= prepIndex ? "text-foreground" : "text-muted-foreground/40"}`}>{msg.text}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">AI is building your optimal session — zero setup needed</p>
            </motion.div>
          )}

          {/* ═══ STEP 2: AI Session Blueprint ═══ */}
          {step === "summary" && plan && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <Crosshair className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">Your AI Session</h2>
                  <p className="text-xs text-muted-foreground">4-phase deep work blueprint</p>
                </div>
              </div>

              {/* Topic card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">AI Selected Topic</p>
                  <h3 className="text-lg font-bold text-foreground">{plan.topic}</h3>
                  <p className="text-xs text-muted-foreground">{plan.subject}</p>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-background/50 p-2 text-center">
                    <Clock className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-foreground">{plan.duration}m</p>
                    <p className="text-[9px] text-muted-foreground">Duration</p>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2 text-center">
                    <Target className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-foreground capitalize">{plan.difficulty}</p>
                    <p className="text-[9px] text-muted-foreground">Difficulty</p>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2 text-center">
                    <Zap className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                    <p className="text-sm font-bold text-foreground">4</p>
                    <p className="text-[9px] text-muted-foreground">Phases</p>
                  </div>
                </div>
              </motion.div>

              {/* Expected outcomes */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="space-y-2">
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Expected Outcomes</p>
                {[
                  { icon: TrendingUp, label: "Stability Gain", value: plan.expectedGain, color: "text-success" },
                  { icon: Flame, label: "Rank Impact", value: plan.rankImpact, color: "text-primary" },
                  { icon: Brain, label: "Current Stability", value: `${plan.stability}%`, color: plan.stability < 40 ? "text-destructive" : plan.stability < 70 ? "text-warning" : "text-success" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-secondary/30 border border-border/50">
                    <item.icon className={`w-4 h-4 ${item.color} shrink-0`} />
                    <span className="text-xs text-muted-foreground flex-1">{item.label}</span>
                    <span className={`text-sm font-bold ${item.color}`}>{item.value}</span>
                  </div>
                ))}
              </motion.div>

              {/* 4-phase structure */}
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2.5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session Phases</span>
                {plan.phases.map((phase, i) => {
                  const Icon = PHASE_ICONS[phase.type];
                  const colors = PHASE_COLORS[phase.type];
                  return (
                    <div key={i} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-lg ${colors.bg} flex items-center justify-center`}>
                        <Icon className={`w-3.5 h-3.5 ${colors.text}`} />
                      </div>
                      <span className="text-xs text-foreground flex-1">{phase.title}</span>
                      <span className="text-[10px] text-muted-foreground">{phase.duration}m</span>
                    </div>
                  );
                })}
              </motion.div>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleEnterFocusMode}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.35)" }}
              >
                <Rocket className="w-5 h-5" />
                Enter Focus Mode
              </motion.button>
            </motion.div>
          )}

          {/* ═══ STEP 3: Guided Execution ═══ */}
          {step === "execution" && currentPhase && plan && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Phase dots */}
              <div className="flex items-center gap-1.5">
                {plan.phases.map((p, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    p.completed ? "bg-primary" : i === currentPhaseIndex ? "bg-primary/60" : "bg-secondary"
                  }`} />
                ))}
              </div>

              {/* Phase header */}
              {(() => {
                const Icon = PHASE_ICONS[currentPhase.type];
                const colors = PHASE_COLORS[currentPhase.type];
                return (
                  <div className="flex items-center gap-3">
                    <div className={`p-2.5 rounded-xl ${colors.bg}`}>
                      <Icon className={`w-5 h-5 ${colors.text}`} />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-foreground text-sm">{currentPhase.title}</h3>
                      <p className="text-[10px] text-muted-foreground">Phase {currentPhaseIndex + 1}/4 · {plan.topic}</p>
                    </div>
                    <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                      adaptiveDifficulty === "easy" ? "bg-success/15 text-success" :
                      adaptiveDifficulty === "medium" ? "bg-warning/15 text-warning" :
                      "bg-destructive/15 text-destructive"
                    }`}>{adaptiveDifficulty}</span>
                  </div>
                );
              })()}

              {/* Focus banner */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-medium">Deep focus — stay in the zone</span>
              </div>

              {/* Timer */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                    <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--primary))" strokeWidth="6"
                      strokeLinecap="round" strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - phaseProgress / 100)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-mono font-bold text-foreground tabular-nums">{mm}:{ss}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">{isPaused ? "paused" : "focusing..."}</span>
                  </div>
                </div>
                <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-xs">{currentPhase.description}</p>
              </div>

              {/* MCQ section */}
              {currentPhase.type === "mcq" && currentMCQ && (
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3"
                >
                  <p className="text-sm font-medium text-foreground leading-snug">{currentMCQ.question}</p>
                  <div className="space-y-2">
                    {currentMCQ.options.map((opt, i) => (
                      <button key={i} onClick={() => handleAnswerSelect(i)} disabled={showExplanation}
                        className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${
                          showExplanation
                            ? i === currentMCQ.correctIndex ? "border-success/50 bg-success/10 text-success"
                            : i === selectedAnswer ? "border-destructive/50 bg-destructive/10 text-destructive"
                            : "border-border bg-secondary/30 text-muted-foreground"
                            : selectedAnswer === i ? "border-primary/50 bg-primary/10 text-foreground"
                            : "border-border bg-secondary/30 text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>{opt}
                      </button>
                    ))}
                  </div>
                  {showExplanation && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{currentMCQ.explanation}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">Score: {correctAnswers}/{totalAnswered} · {adaptiveDifficulty}</span>
                        <button onClick={nextMCQ} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                          Next <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Ambient sound */}
              <div className="flex items-center gap-2">
                {([
                  { type: "rain" as AmbientSoundType, icon: CloudRain },
                  { type: "lo-fi" as AmbientSoundType, icon: Music },
                  { type: "white-noise" as AmbientSoundType, icon: Radio },
                ]).map((s) => (
                  <button key={s.type} onClick={() => ambient.toggle(s.type)}
                    className={`p-2 rounded-lg transition-all ${
                      ambient.active === s.type ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <s.icon className="w-4 h-4" />
                  </button>
                ))}
                {ambient.active && (
                  <input type="range" min="0" max="1" step="0.05" value={ambient.volume}
                    onChange={(e) => ambient.setVolume(parseFloat(e.target.value))} className="flex-1 h-1 accent-primary" />
                )}
              </div>

              {/* Controls */}
              <div className="flex items-center gap-2">
                {!isPaused ? (
                  <button onClick={() => { setIsPaused(true); clearTimer(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-warning/15 text-warning font-semibold border border-warning/30 transition-all active:scale-95"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                ) : (
                  <button onClick={() => { setIsPaused(false); startCountdown(secondsLeft); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
                  >
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )}
                <button onClick={handlePhaseComplete}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border text-muted-foreground font-medium text-sm transition-all active:scale-95 hover:text-foreground"
                >
                  <SkipForward className="w-4 h-4" />
                  {currentPhaseIndex < plan.phases.length - 1 ? "Next" : "Finish"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ PHASE REWARD (micro-reward between phases) ═══ */}
          {step === "phase-reward" && plan && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="py-8 flex flex-col items-center gap-5"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 300, damping: 12, delay: 0.1 }}
                className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.25)" }}
              >
                <span className="text-4xl">{MICRO_REWARDS[currentPhaseIndex]?.emoji || "✅"}</span>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-center space-y-1"
              >
                <h3 className="text-lg font-bold text-foreground">{MICRO_REWARDS[currentPhaseIndex]?.title || "Phase Complete!"}</h3>
                <p className="text-xs text-muted-foreground">{MICRO_REWARDS[currentPhaseIndex]?.subtitle || "Keep going!"}</p>
              </motion.div>

              {/* Phase completion meter */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="w-full space-y-2"
              >
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Session Progress</span>
                  <span className="font-semibold text-primary">{completedPhases}/4 phases</span>
                </div>
                <div className="flex gap-1.5">
                  {plan.phases.map((p, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-full transition-all ${p.completed ? "bg-primary" : "bg-secondary"}`} />
                  ))}
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                whileTap={{ scale: 0.97 }}
                onClick={continueToNextPhase}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <ArrowRight className="w-4 h-4" />
                Continue to {plan.phases[currentPhaseIndex + 1]?.title || "Next Phase"}
              </motion.button>
            </motion.div>
          )}

          {/* ═══ STEP 5: Completion ═══ */}
          {step === "complete" && plan && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              <div className="flex flex-col items-center gap-3 pt-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                  style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.25)" }}
                >
                  <Trophy className="w-10 h-10 text-primary" />
                </motion.div>
                <motion.h2 initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                  className="text-xl font-bold text-foreground">Deep Focus Complete! 🎉</motion.h2>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="text-xs text-muted-foreground">{plan.topic} — outstanding execution</motion.p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: Brain, label: "Stability", value: stabilityAfter !== null ? `${stabilityAfter}%` : `${stabilityBefore}%`, color: "text-primary" },
                  { icon: TrendingUp, label: "Stability Gain", value: stabilityAfter !== null ? `+${Math.max(0, stabilityAfter - stabilityBefore)}%` : plan.expectedGain, color: "text-success" },
                  { icon: Flame, label: "Rank Impact", value: plan.rankImpact, color: "text-primary" },
                  { icon: Star, label: "Focus Quality", value: `${focusQuality}%`, color: focusQuality > 70 ? "text-success" : focusQuality > 40 ? "text-warning" : "text-destructive" },
                  { icon: Target, label: "Accuracy", value: totalAnswered > 0 ? `${Math.round((correctAnswers / totalAnswered) * 100)}%` : "N/A", color: "text-success" },
                  { icon: Clock, label: "Time Focused", value: `${Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000))}m`, color: "text-primary" },
                ].map((stat, i) => (
                  <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.07 }}
                    className="rounded-xl border border-border bg-secondary/20 p-3 text-center"
                  >
                    <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1`} />
                    <p className="text-lg font-bold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Focus Quality bar */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Focus Quality Score</span>
                  <span className="text-sm font-bold text-primary">{focusQuality}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div initial={{ width: 0 }} animate={{ width: `${focusQuality}%` }}
                    transition={{ delay: 1.2, duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </motion.div>

              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("next-action")}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <ArrowRight className="w-4 h-4" /> See What's Next
              </motion.button>
            </motion.div>
          )}

          {/* ═══ STEP 6: Next Micro Action ═══ */}
          {step === "next-action" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15"><Zap className="w-5 h-5 text-primary" /></div>
                <div>
                  <h2 className="font-bold text-foreground">Keep the Momentum</h2>
                  <p className="text-xs text-muted-foreground">AI-suggested next actions</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  { icon: Brain, title: "Quick Recall Test", desc: "5-min recall on what you just studied", time: "5 min",
                    action: () => { onClose(); toast({ title: "🧠 Quick Recall", description: "Opening AI Revision Mode..." }); } },
                  { icon: BookOpen, title: "Review Weak Areas", desc: "Focus on topics below 40% stability", time: "10 min",
                    action: () => { onClose(); } },
                  { icon: Star, title: "Start Another AI Session", desc: "Let AI pick your next optimal topic", time: "20-30 min",
                    action: () => { setStep("preparing"); setPrepIndex(0); setPlan(null); startAIPreparation(); } },
                  { icon: BarChart3, title: "Check Your Progress", desc: "View brain health and stability trends", time: "2 min",
                    action: onClose },
                ].map((item, i) => (
                  <motion.button key={i} initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }} onClick={item.action}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0"><item.icon className="w-4 h-4 text-primary" /></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">{item.title}</h4>
                      <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-muted-foreground">{item.time}</span>
                      <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/40 group-hover:text-primary transition-colors" />
                    </div>
                  </motion.button>
                ))}
              </div>

              <button onClick={onClose}
                className="w-full py-3 rounded-xl bg-secondary border border-border text-foreground font-medium text-sm hover:bg-secondary/80 transition-all"
              >
                Done for Now
              </button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FocusModeSession;
