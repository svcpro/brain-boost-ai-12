import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, Play, Pause, X, ShieldCheck,
  SkipForward, Clock, BookOpen, Brain, TrendingUp,
  Sparkles, Loader2, Target, Volume2, VolumeX,
  Zap, Trophy, ArrowRight, Star, Flame, BarChart3,
  ChevronRight, CloudRain, Music, Radio, CheckCircle
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

type FocusStep = "preparing" | "summary" | "execution" | "complete" | "next-action";

interface AISessionPlan {
  subject: string;
  topic: string;
  subtopic: string;
  duration: number;
  difficulty: "easy" | "medium" | "hard";
  questionType: "mcq" | "recall" | "mixed";
  expectedGain: string;
  rankImpact: string;
  stability: number;
  phases: Array<{
    type: "concept" | "recall" | "mcq";
    title: string;
    description: string;
    duration: number;
    difficulty: "easy" | "medium" | "hard";
    completed: boolean;
  }>;
}

interface MCQQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

// Preparation animation messages
const PREP_MESSAGES = [
  { text: "Scanning your brain data...", icon: Brain },
  { text: "Analyzing weak topics...", icon: Target },
  { text: "Calculating optimal difficulty...", icon: BarChart3 },
  { text: "Building your session...", icon: Sparkles },
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
  const [stabilityBefore, setStabilityBefore] = useState<number>(0);
  const [stabilityAfter, setStabilityAfter] = useState<number | null>(null);
  const [focusQuality, setFocusQuality] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ═══ Reset on open → immediately start AI preparation ═══
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

  // ═══ Preparation animation ticker ═══
  useEffect(() => {
    if (step !== "preparing") return;
    const t = setInterval(() => {
      setPrepIndex(prev => {
        if (prev < PREP_MESSAGES.length - 1) return prev + 1;
        return prev;
      });
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

    try {
      // Fetch weakest topic
      const { data: weakTopic } = await (supabase as any)
        .from("topics")
        .select("id, name, memory_strength, subjects(name)")
        .eq("user_id", user.id)
        .eq("deleted", false)
        .order("memory_strength", { ascending: true })
        .limit(1)
        .maybeSingle();

      // Fetch recent exam performance for difficulty calibration
      const { data: recentExams } = await supabase
        .from("exam_results")
        .select("score, total_questions, difficulty")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(5);

      // Fetch user features for personalization
      const { data: features } = await (supabase as any)
        .from("user_features")
        .select("recall_success_rate, knowledge_stability, subject_strength_score")
        .eq("user_id", user.id)
        .maybeSingle();

      // ── Determine parameters ──
      const topicName = weakTopic?.name || "General Review";
      const subjectName = (weakTopic?.subjects as any)?.name || "General";
      const memoryStrength = weakTopic ? Math.round((weakTopic.memory_strength ?? 0) * 100) : 50;

      // Difficulty from performance
      const exams = recentExams || [];
      let avgAccuracy = 0.5;
      if (exams.length > 0) {
        avgAccuracy = exams.reduce((s: number, e: any) => s + (e.score / Math.max(1, e.total_questions)), 0) / exams.length;
      }
      const recallRate = features?.recall_success_rate ?? 0.5;
      const stability = features?.knowledge_stability ?? 50;

      const difficulty: "easy" | "medium" | "hard" =
        avgAccuracy > 0.75 && recallRate > 0.7 ? "hard" :
        avgAccuracy < 0.45 || recallRate < 0.35 ? "easy" : "medium";

      // Duration based on stability
      const duration = memoryStrength < 30 ? 25 : memoryStrength < 60 ? 20 : 15;

      // Expected gain
      const expectedGain = memoryStrength < 30 ? "+8-12%" : memoryStrength < 60 ? "+4-8%" : "+2-4%";

      // Rank impact
      const rankImpact = memoryStrength < 40 ? "+150-300 ranks" : memoryStrength < 70 ? "+50-150 ranks" : "+10-50 ranks";

      // Build phases
      const conceptTime = Math.max(3, Math.round(duration * 0.4));
      const recallTime = Math.max(2, Math.round(duration * 0.3));
      const mcqTime = Math.max(2, Math.round(duration * 0.3));

      const sessionPlan: AISessionPlan = {
        subject: subjectName,
        topic: topicName,
        subtopic: topicName, // Will be refined by AI if available
        duration,
        difficulty,
        questionType: difficulty === "easy" ? "recall" : "mixed",
        expectedGain,
        rankImpact,
        stability: memoryStrength,
        phases: [
          {
            type: "concept",
            title: "Concept Deep Dive",
            description: `Study and understand core concepts of ${topicName}. Build mental models and annotate key ideas.`,
            duration: conceptTime,
            completed: false,
            difficulty,
          },
          {
            type: "recall",
            title: "Active Recall Challenge",
            description: `Close materials and recall everything about ${topicName}. Write key points from memory.`,
            duration: recallTime,
            completed: false,
            difficulty,
          },
          {
            type: "mcq",
            title: "Adaptive Assessment",
            description: `AI-generated questions that adapt to your performance in real-time.`,
            duration: mcqTime,
            completed: false,
            difficulty,
          },
        ],
      };

      // Try to get AI-generated subtopic
      try {
        const { data: aiData } = await supabase.functions.invoke("ai-brain-agent", {
          body: {
            type: "study_plan",
            subject: subjectName,
            topic: topicName,
            duration,
            difficulty,
          },
        });
        if (aiData?.subtopic) sessionPlan.subtopic = aiData.subtopic;
      } catch { /* fallback to topic name */ }

      setPlan(sessionPlan);
      setStabilityBefore(memoryStrength);
      setAdaptiveDifficulty(difficulty);

      // Wait for prep animation to finish (minimum ~3.5s)
      const elapsed = Date.now();
      const minPrepTime = 3500;
      const remaining = minPrepTime - (Date.now() - elapsed);
      if (remaining > 0) await new Promise(r => setTimeout(r, remaining));

      setStep("summary");
    } catch (err) {
      console.error("AI preparation error:", err);
      // Fallback plan
      const fallbackPlan: AISessionPlan = {
        subject: "General",
        topic: "Quick Review",
        subtopic: "Mixed Topics",
        duration: 15,
        difficulty: "medium",
        questionType: "mixed",
        expectedGain: "+3-6%",
        rankImpact: "+50-100 ranks",
        stability: 50,
        phases: [
          { type: "concept", title: "Concept Review", description: "Review core concepts.", duration: 6, completed: false, difficulty: "medium" },
          { type: "recall", title: "Active Recall", description: "Recall key points.", duration: 5, completed: false, difficulty: "medium" },
          { type: "mcq", title: "Quick Assessment", description: "Test your understanding.", duration: 4, completed: false, difficulty: "medium" },
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
    if (secondsLeft === 0 && step === "execution" && !isPaused && plan) {
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
      setCurrentPhaseIndex(nextIndex);
      if (plan.phases[nextIndex].type === "mcq") generateMCQ();
      startCountdown(plan.phases[nextIndex].duration * 60);
    } else {
      handleSessionComplete();
    }
  };

  // ═══════════════════════════════════════════════════
  //  ADAPTIVE MCQ
  // ═══════════════════════════════════════════════════
  const generateMCQ = () => {
    const topic = plan?.topic || "this topic";
    const difficultyLabel = { easy: "basic", medium: "applied", hard: "advanced" };

    setCurrentMCQ({
      question: `[${difficultyLabel[adaptiveDifficulty]}] Which of the following best describes a key concept in ${topic}?`,
      options: [
        "A fundamental principle that forms the foundation",
        "A secondary concept with limited application",
        "An advanced theorem with no practical use",
        "A deprecated concept no longer relevant",
      ],
      correctIndex: 0,
      explanation: `The correct answer focuses on fundamental principles. Understanding foundations of ${topic} is critical for building deeper knowledge.`,
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

  // ═══════════════════════════════════════════════════
  //  COMPLETION
  // ═══════════════════════════════════════════════════
  const handleSessionComplete = async () => {
    if (!plan) return;
    clearTimer();
    ambient.stop();
    setStep("complete");

    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ["#22c55e", "#6366f1", "#f59e0b", "#14b8a6"] });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4, x: 0.3 } }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4, x: 0.7 } }), 500);

    const elapsedMs = Date.now() - startTimeRef.current;
    const elapsed = Math.max(1, Math.round(elapsedMs / 60000));
    const accuracy = totalAnswered > 0 ? correctAnswers / totalAnswered : 0.5;

    // Focus quality score (0-100)
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

    // Fetch updated stability
    if (user && plan.topic) {
      const { data } = await (supabase as any)
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id)
        .eq("name", plan.topic)
        .eq("deleted", false)
        .maybeSingle();
      setStabilityAfter(data ? Math.round((data.memory_strength ?? 0) * 100) : null);
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

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {/* Overall progress bar during execution */}
        {step === "execution" && (
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

          {/* ═══════════════════════════════════════════════════
              STEP 1: AI Preparation Animation
             ═══════════════════════════════════════════════════ */}
          {step === "preparing" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center gap-6">
              {/* Pulsing brain */}
              <motion.div
                animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.2)" }}
              >
                <Brain className="w-10 h-10 text-primary" />
              </motion.div>

              {/* Animated status messages */}
              <div className="space-y-3 w-full max-w-xs">
                {PREP_MESSAGES.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: i <= prepIndex ? 1 : 0.2,
                      x: i <= prepIndex ? 0 : -20,
                    }}
                    transition={{ duration: 0.4, delay: i <= prepIndex ? 0 : 0 }}
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
                    <span className={`text-sm ${i <= prepIndex ? "text-foreground" : "text-muted-foreground/40"}`}>
                      {msg.text}
                    </span>
                  </motion.div>
                ))}
              </div>

              <p className="text-[10px] text-muted-foreground">AI is optimizing your session — zero effort needed</p>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 2: Session Summary (AI-determined)
             ═══════════════════════════════════════════════════ */}
          {step === "summary" && plan && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <Crosshair className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">Your AI Session</h2>
                  <p className="text-xs text-muted-foreground">Optimized for maximum brain growth</p>
                </div>
              </div>

              {/* Topic & Subject card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="rounded-xl border border-primary/20 bg-primary/5 p-4 space-y-3"
              >
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-primary mb-1">AI Selected Topic</p>
                  <h3 className="text-lg font-bold text-foreground">{plan.topic}</h3>
                  <p className="text-xs text-muted-foreground">{plan.subject} · {plan.subtopic}</p>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg bg-background/50 p-2.5 text-center">
                    <Clock className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                    <p className="text-sm font-bold text-foreground">{plan.duration}m</p>
                    <p className="text-[9px] text-muted-foreground">Duration</p>
                  </div>
                  <div className="rounded-lg bg-background/50 p-2.5 text-center">
                    <Target className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                    <p className="text-sm font-bold text-foreground capitalize">{plan.difficulty}</p>
                    <p className="text-[9px] text-muted-foreground">Difficulty</p>
                  </div>
                </div>
              </motion.div>

              {/* Expected outcomes */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="space-y-2.5"
              >
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

              {/* Session structure */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2.5"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session Structure</span>
                {plan.phases.map((phase, i) => (
                  <div key={i} className="flex items-center gap-3">
                    {phase.type === "concept" ? <BookOpen className="w-4 h-4 text-primary" /> :
                     phase.type === "recall" ? <Brain className="w-4 h-4 text-warning" /> :
                     <Target className="w-4 h-4 text-success" />}
                    <span className="text-xs text-foreground flex-1">{phase.title}</span>
                    <span className="text-[10px] text-muted-foreground">{phase.duration}m</span>
                  </div>
                ))}
              </motion.div>

              {/* Enter Focus Mode CTA */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleEnterFocusMode}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.35)" }}
              >
                <Zap className="w-5 h-5" />
                Enter Focus Mode
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 3: Guided Execution (Distraction-free)
             ═══════════════════════════════════════════════════ */}
          {step === "execution" && currentPhase && plan && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Phase dots */}
              <div className="flex items-center gap-2">
                {plan.phases.map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < currentPhaseIndex ? "bg-primary" : i === currentPhaseIndex ? "bg-primary/60" : "bg-secondary"
                  }`} />
                ))}
              </div>

              {/* Phase header */}
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  currentPhase.type === "concept" ? "bg-primary/15" :
                  currentPhase.type === "recall" ? "bg-warning/15" : "bg-success/15"
                }`}>
                  {currentPhase.type === "concept" ? <BookOpen className="w-5 h-5 text-primary" /> :
                   currentPhase.type === "recall" ? <Brain className="w-5 h-5 text-warning" /> :
                   <Target className="w-5 h-5 text-success" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-sm">{currentPhase.title}</h3>
                  <p className="text-[10px] text-muted-foreground">Phase {currentPhaseIndex + 1}/{plan.phases.length} · {plan.topic}</p>
                </div>
                <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                  adaptiveDifficulty === "easy" ? "bg-success/15 text-success" :
                  adaptiveDifficulty === "medium" ? "bg-warning/15 text-warning" :
                  "bg-destructive/15 text-destructive"
                }`}>{adaptiveDifficulty}</span>
              </div>

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
                        <button onClick={generateMCQ} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                          Next <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Ambient sound (minimal) */}
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

          {/* ═══════════════════════════════════════════════════
              STEP 4: Completion — Stability, Rank, Quality
             ═══════════════════════════════════════════════════ */}
          {step === "complete" && plan && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              {/* Trophy */}
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

              {/* Stats */}
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

              {/* Animated reward bar */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="space-y-1.5"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-muted-foreground">Focus Quality Score</span>
                  <span className="text-sm font-bold text-primary">{focusQuality}%</span>
                </div>
                <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${focusQuality}%` }}
                    transition={{ delay: 1.2, duration: 1, ease: "easeOut" }}
                    className="h-full rounded-full bg-primary"
                  />
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.3 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("next-action")}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <ArrowRight className="w-4 h-4" /> See What's Next
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 5: Next Micro Action
             ═══════════════════════════════════════════════════ */}
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
                    action: () => { onClose(); setTimeout(() => { /* re-open fresh */ }, 300); } },
                  { icon: Star, title: "Start Another AI Session", desc: "Let AI pick your next optimal topic", time: "15-25 min",
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
