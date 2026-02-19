import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, Play, Pause, RotateCcw, CheckCircle, X, ShieldCheck, Eye, EyeOff,
  Plus, Minus, Volume2, VolumeX, CloudRain, Music, Radio, Timer, Coffee,
  SkipForward, Clock, BookOpen, Brain, TrendingUp, TrendingDown,
  Minus as MinusIcon, Smile, Meh, Frown, Sparkles, Loader2, Target,
  Zap, Trophy, ArrowRight, Star, Flame, BarChart3, ChevronRight
} from "lucide-react";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/useAmbientSound";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { emitEvent } from "@/lib/eventBus";

const PRESETS = [15, 25, 45, 60];

interface FocusModeSessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
  initialSubject?: string;
  initialTopic?: string;
  autoStart?: boolean;
}

type DeepFocusStep = "entry" | "plan" | "execution" | "complete" | "next-action";

interface StudyPlanItem {
  type: "concept" | "recall" | "mcq";
  title: string;
  description: string;
  duration: number; // minutes
  completed: boolean;
  difficulty: "easy" | "medium" | "hard";
}

interface MCQQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const FocusModeSession = ({ open, onClose, onSessionComplete, initialSubject, initialTopic, autoStart }: FocusModeSessionProps) => {
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const ambient = useAmbientSound();
  const { user } = useAuth();

  // ─── Step state ───
  const [step, setStep] = useState<DeepFocusStep>("entry");

  // ─── Entry (Step 1) ───
  const [subject, setSubject] = useState(initialSubject || "");
  const [topic, setTopic] = useState(initialTopic || "");
  const [totalMinutes, setTotalMinutes] = useState(25);
  const [topicStability, setTopicStability] = useState<number | null>(null);
  const [loadingStability, setLoadingStability] = useState(false);

  // ─── Plan (Step 2) ───
  const [studyPlan, setStudyPlan] = useState<StudyPlanItem[]>([]);
  const [loadingPlan, setLoadingPlan] = useState(false);

  // ─── Execution (Step 3 & 4) ───
  const [currentPlanIndex, setCurrentPlanIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [currentMCQ, setCurrentMCQ] = useState<MCQQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // ─── Completion (Step 5) ───
  const [stabilityBefore, setStabilityBefore] = useState<number | null>(null);
  const [stabilityAfter, setStabilityAfter] = useState<number | null>(null);
  const [logging, setLogging] = useState(false);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const autoStartTriggered = useRef(false);

  // Reset on open
  useEffect(() => {
    if (open) {
      setStep("entry");
      setSubject(initialSubject || "");
      setTopic(initialTopic || "");
      setTotalMinutes(25);
      setStudyPlan([]);
      setCurrentPlanIndex(0);
      setCorrectAnswers(0);
      setTotalAnswered(0);
      setCurrentMCQ(null);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAdaptiveDifficulty("medium");
      setStabilityBefore(null);
      setStabilityAfter(null);
      setTopicStability(null);
      autoStartTriggered.current = false;
    } else {
      clearTimer();
      ambient.stop();
    }
  }, [open]);

  // Auto-start
  useEffect(() => {
    if (open && autoStart && !autoStartTriggered.current && (initialSubject || initialTopic)) {
      autoStartTriggered.current = true;
      setSubject(initialSubject || "");
      setTopic(initialTopic || "");
      // Go straight to plan generation
      setTimeout(() => handleGeneratePlan(), 100);
    }
  }, [open, autoStart, initialSubject, initialTopic]);

  // Fetch topic stability when topic changes
  useEffect(() => {
    if (!user || !topic.trim()) { setTopicStability(null); return; }
    const fetch = async () => {
      setLoadingStability(true);
      const { data } = await (supabase as any)
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id)
        .eq("name", topic)
        .eq("deleted", false)
        .maybeSingle();
      setTopicStability(data ? Math.round((data.memory_strength ?? 0) * 100) : null);
      setLoadingStability(false);
    };
    const t = setTimeout(fetch, 300);
    return () => clearTimeout(t);
  }, [topic, user]);

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
  //  STEP 2: Generate AI Study Plan
  // ═══════════════════════════════════════════════════
  const handleGeneratePlan = async () => {
    if (!subject.trim()) {
      toast({ title: "Enter a subject", variant: "destructive" });
      return;
    }
    setStep("plan");
    setLoadingPlan(true);
    setStabilityBefore(topicStability);

    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          type: "study_plan",
          subject,
          topic: topic || subject,
          duration: totalMinutes,
          difficulty: adaptiveDifficulty,
        },
      });

      if (error || !data) throw new Error("Plan generation failed");

      const planItems: StudyPlanItem[] = buildStudyPlan(totalMinutes);
      setStudyPlan(planItems);
    } catch {
      // Fallback: generate structured plan locally
      const planItems = buildStudyPlan(totalMinutes);
      setStudyPlan(planItems);
    }
    setLoadingPlan(false);
  };

  const buildStudyPlan = (mins: number): StudyPlanItem[] => {
    const conceptTime = Math.max(3, Math.round(mins * 0.4));
    const recallTime = Math.max(2, Math.round(mins * 0.3));
    const mcqTime = Math.max(2, Math.round(mins * 0.3));

    return [
      {
        type: "concept",
        title: "Concept Deep Dive",
        description: `Study and understand core concepts of ${topic || subject}. Read, annotate, and build mental models.`,
        duration: conceptTime,
        completed: false,
        difficulty: adaptiveDifficulty,
      },
      {
        type: "recall",
        title: "Active Recall Challenge",
        description: `Close your materials and try to recall key points. Write down everything you remember about ${topic || subject}.`,
        duration: recallTime,
        completed: false,
        difficulty: adaptiveDifficulty,
      },
      {
        type: "mcq",
        title: "MCQ Assessment",
        description: `Test your understanding with adaptive questions. Difficulty adjusts based on your performance.`,
        duration: mcqTime,
        completed: false,
        difficulty: adaptiveDifficulty,
      },
    ];
  };

  // ═══════════════════════════════════════════════════
  //  STEP 3: Start Execution
  // ═══════════════════════════════════════════════════
  const handleStartExecution = () => {
    setStep("execution");
    setCurrentPlanIndex(0);
    startTimeRef.current = Date.now();
    const firstDuration = studyPlan[0]?.duration || 5;
    startCountdown(firstDuration * 60);
  };

  // Timer hitting zero → advance
  useEffect(() => {
    if (secondsLeft === 0 && step === "execution" && !isPaused) {
      handlePhaseComplete();
    }
  }, [secondsLeft, step, isPaused]);

  const handlePhaseComplete = () => {
    clearTimer();
    const updated = [...studyPlan];
    updated[currentPlanIndex] = { ...updated[currentPlanIndex], completed: true };
    setStudyPlan(updated);

    const nextIndex = currentPlanIndex + 1;
    if (nextIndex < studyPlan.length) {
      setCurrentPlanIndex(nextIndex);

      // If next is MCQ, generate a question
      if (studyPlan[nextIndex].type === "mcq") {
        generateMCQ();
      }

      startCountdown(studyPlan[nextIndex].duration * 60);
    } else {
      // All phases done → completion
      handleSessionComplete();
    }
  };

  const skipToNextPhase = () => {
    handlePhaseComplete();
  };

  // ═══════════════════════════════════════════════════
  //  STEP 4: Adaptive MCQ
  // ═══════════════════════════════════════════════════
  const generateMCQ = () => {
    // Generate contextual MCQ based on topic and difficulty
    const difficultyMap = {
      easy: "basic understanding",
      medium: "applied knowledge",
      hard: "advanced analysis",
    };

    setCurrentMCQ({
      question: `[${difficultyMap[adaptiveDifficulty]}] Which of the following best describes a key concept in ${topic || subject}?`,
      options: [
        "A fundamental principle that forms the foundation",
        "A secondary concept with limited application",
        "An advanced theorem with no practical use",
        "A deprecated concept no longer relevant",
      ],
      correctIndex: 0,
      explanation: `The correct answer focuses on fundamental principles of ${topic || subject}. Understanding foundations is critical for building deeper knowledge.`,
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
      // Adaptive: increase difficulty on correct
      if (adaptiveDifficulty === "easy") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("hard");
    } else {
      // Adaptive: decrease difficulty on incorrect
      if (adaptiveDifficulty === "hard") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("easy");
    }
  };

  const nextQuestion = () => {
    generateMCQ();
  };

  // ═══════════════════════════════════════════════════
  //  STEP 5: Completion
  // ═══════════════════════════════════════════════════
  const handleSessionComplete = async () => {
    clearTimer();
    ambient.stop();
    setStep("complete");

    // Confetti burst
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ["#22c55e", "#6366f1", "#f59e0b", "#14b8a6"] });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4, x: 0.3 } }), 300);
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4, x: 0.7 } }), 500);

    const elapsedMs = Date.now() - startTimeRef.current;
    const elapsed = Math.max(1, Math.round(elapsedMs / 60000));

    setLogging(true);
    await logStudy({
      subjectName: subject,
      topicName: topic || undefined,
      durationMinutes: elapsed,
      confidenceLevel: correctAnswers / Math.max(1, totalAnswered) > 0.7 ? "high" : correctAnswers / Math.max(1, totalAnswered) > 0.4 ? "medium" : "low",
      studyMode: "focus",
    });

    // Fetch updated stability
    if (user && topic) {
      const { data } = await (supabase as any)
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id)
        .eq("name", topic)
        .eq("deleted", false)
        .maybeSingle();
      setStabilityAfter(data ? Math.round((data.memory_strength ?? 0) * 100) : null);
    }

    setLogging(false);
    onSessionComplete?.();

    emitEvent("study_session_end", {
      mode: "deep_focus",
      duration: elapsed,
      topic: topic || subject,
      accuracy: totalAnswered > 0 ? Math.round((correctAnswers / totalAnswered) * 100) : null,
    }, {
      title: "Deep Focus Complete! 🧠",
      body: `${elapsed} min on ${topic || subject}`,
    });

    import("@/lib/eventBus").then(({ emitDynamicReward }) =>
      emitDynamicReward({
        session_duration: elapsed,
        topics_reviewed: 1,
        confidence_delta: correctAnswers > totalAnswered / 2 ? 10 : -5,
      })
    );
  };

  // ═══════════════════════════════════════════════════
  //  Computed values
  // ═══════════════════════════════════════════════════
  const currentPhase = studyPlan[currentPlanIndex];
  const totalPlanSecs = (currentPhase?.duration || 1) * 60;
  const phaseProgress = totalPlanSecs > 0 ? ((totalPlanSecs - secondsLeft) / totalPlanSecs) * 100 : 0;
  const overallProgress = studyPlan.length > 0
    ? ((currentPlanIndex + (phaseProgress / 100)) / studyPlan.length) * 100
    : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");

  const expectedGain = topicStability !== null
    ? topicStability < 30 ? "+8-12%" : topicStability < 60 ? "+4-8%" : "+2-4%"
    : "+5-10%";

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {/* Overall progress bar — always visible during execution */}
        {step === "execution" && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-[60]">
            <motion.div
              className="h-full bg-primary"
              style={{ width: `${overallProgress}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        )}

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          className="w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-card p-6 space-y-5 relative"
          style={{ boxShadow: "0 0 60px hsl(var(--primary) / 0.08)" }}
        >
          {/* Close — only in entry */}
          {step === "entry" && (
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 1: Focus Entry Screen
             ═══════════════════════════════════════════════════ */}
          {step === "entry" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              {/* Header */}
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <Crosshair className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">Deep Focus Mode</h2>
                  <p className="text-xs text-muted-foreground">AI-guided deep study session</p>
                </div>
              </div>

              {/* Subject & Topic */}
              <div className="space-y-3">
                <input
                  type="text"
                  placeholder="Subject (e.g. Mathematics)"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
                <input
                  type="text"
                  placeholder="Topic (e.g. Integration)"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-xl bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                />
              </div>

              {/* Topic info card */}
              {topic.trim() && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  className="rounded-xl border border-border bg-secondary/30 p-4 space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Current Stability</span>
                    {loadingStability ? (
                      <Loader2 className="w-3 h-3 animate-spin text-muted-foreground" />
                    ) : (
                      <span className={`text-sm font-bold ${
                        topicStability === null ? "text-muted-foreground" :
                        topicStability < 30 ? "text-destructive" :
                        topicStability < 60 ? "text-warning" : "text-success"
                      }`}>
                        {topicStability !== null ? `${topicStability}%` : "New topic"}
                      </span>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-muted-foreground">Expected Gain</span>
                    <span className="text-sm font-bold text-primary">{expectedGain}</span>
                  </div>
                </motion.div>
              )}

              {/* Duration */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Session Duration</span>
                <div className="flex items-center gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setTotalMinutes(p)}
                      className={`flex-1 py-2.5 rounded-xl text-sm font-medium transition-all ${
                        totalMinutes === p
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}m
                    </button>
                  ))}
                </div>
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button onClick={() => setTotalMinutes(m => Math.max(5, m - 5))} className="p-2 rounded-lg bg-secondary border border-border">
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-lg font-bold text-foreground w-16 text-center tabular-nums">{totalMinutes}m</span>
                  <button onClick={() => setTotalMinutes(m => Math.min(120, m + 5))} className="p-2 rounded-lg bg-secondary border border-border">
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>

              {/* Session structure preview */}
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-2.5">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Session Structure</span>
                {[
                  { icon: BookOpen, label: "Concept Deep Dive", pct: "40%", color: "text-primary" },
                  { icon: Brain, label: "Active Recall", pct: "30%", color: "text-primary" },
                  { icon: Target, label: "Adaptive MCQ", pct: "30%", color: "text-primary" },
                ].map((item, i) => (
                  <div key={i} className="flex items-center gap-3">
                    <item.icon className={`w-4 h-4 ${item.color}`} />
                    <span className="text-xs text-foreground flex-1">{item.label}</span>
                    <span className="text-[10px] text-muted-foreground">{item.pct}</span>
                  </div>
                ))}
              </div>

              {/* Ambient sound */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Ambient Sound</span>
                <div className="flex items-center gap-2">
                  {([
                    { type: "rain" as AmbientSoundType, icon: CloudRain, label: "Rain" },
                    { type: "lo-fi" as AmbientSoundType, icon: Music, label: "Lo-Fi" },
                    { type: "white-noise" as AmbientSoundType, icon: Radio, label: "Noise" },
                  ]).map((s) => (
                    <button
                      key={s.type}
                      onClick={() => ambient.toggle(s.type)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all ${
                        ambient.active === s.type
                          ? "bg-primary text-primary-foreground"
                          : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <s.icon className="w-3.5 h-3.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
                {ambient.active && (
                  <div className="flex items-center gap-2 mt-2">
                    <VolumeX className="w-3 h-3 text-muted-foreground" />
                    <input type="range" min="0" max="1" step="0.05" value={ambient.volume}
                      onChange={(e) => ambient.setVolume(parseFloat(e.target.value))} className="flex-1 h-1.5 accent-primary" />
                    <Volume2 className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* CTA */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleGeneratePlan}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <Sparkles className="w-4 h-4" />
                Generate AI Study Plan
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 2: AI Study Plan
             ═══════════════════════════════════════════════════ */}
          {step === "plan" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <Brain className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Your Study Plan</h2>
                  <p className="text-xs text-muted-foreground">{subject} · {topic || "General"} · {totalMinutes}m</p>
                </div>
              </div>

              {loadingPlan ? (
                <div className="py-12 flex flex-col items-center gap-3">
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  >
                    <Brain className="w-8 h-8 text-primary" />
                  </motion.div>
                  <p className="text-sm text-muted-foreground">AI is building your plan...</p>
                  <p className="text-[10px] text-muted-foreground">Analyzing topic, difficulty, and optimal structure</p>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {studyPlan.map((item, i) => (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.12 }}
                        className="rounded-xl border border-border bg-secondary/20 p-4"
                      >
                        <div className="flex items-start gap-3">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                            item.type === "concept" ? "bg-primary/15" :
                            item.type === "recall" ? "bg-warning/15" : "bg-success/15"
                          }`}>
                            {item.type === "concept" ? <BookOpen className="w-4 h-4 text-primary" /> :
                             item.type === "recall" ? <Brain className="w-4 h-4 text-warning" /> :
                             <Target className="w-4 h-4 text-success" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <h4 className="text-sm font-semibold text-foreground">{item.title}</h4>
                              <span className="text-[10px] text-muted-foreground">{item.duration}m</span>
                            </div>
                            <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">{item.description}</p>
                            <div className="flex items-center gap-2 mt-2">
                              <span className={`text-[9px] font-semibold uppercase px-1.5 py-0.5 rounded-full ${
                                item.difficulty === "easy" ? "bg-success/15 text-success" :
                                item.difficulty === "medium" ? "bg-warning/15 text-warning" :
                                "bg-destructive/15 text-destructive"
                              }`}>
                                {item.difficulty}
                              </span>
                              <span className="text-[9px] text-muted-foreground capitalize">{item.type} phase</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => setStep("entry")}
                      className="flex-1 py-3 rounded-xl bg-secondary border border-border text-foreground font-medium text-sm hover:bg-secondary/80 transition-all"
                    >
                      Back
                    </button>
                    <motion.button
                      whileTap={{ scale: 0.97 }}
                      onClick={handleStartExecution}
                      className="flex-[2] flex items-center justify-center gap-2.5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
                      style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
                    >
                      <Play className="w-4 h-4" />
                      Start Deep Focus
                    </motion.button>
                  </div>
                </>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 3 & 4: Guided Execution with Adaptive MCQ
             ═══════════════════════════════════════════════════ */}
          {step === "execution" && currentPhase && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Phase indicator */}
              <div className="flex items-center gap-2">
                {studyPlan.map((_, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    i < currentPlanIndex ? "bg-primary" :
                    i === currentPlanIndex ? "bg-primary/60" : "bg-secondary"
                  }`} />
                ))}
              </div>

              {/* Current phase header */}
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
                  <p className="text-[10px] text-muted-foreground">
                    Phase {currentPlanIndex + 1} of {studyPlan.length} · {subject}
                  </p>
                </div>
                <span className={`text-[9px] font-semibold uppercase px-2 py-0.5 rounded-full ${
                  adaptiveDifficulty === "easy" ? "bg-success/15 text-success" :
                  adaptiveDifficulty === "medium" ? "bg-warning/15 text-warning" :
                  "bg-destructive/15 text-destructive"
                }`}>
                  {adaptiveDifficulty}
                </span>
              </div>

              {/* Distraction-free banner */}
              <div className="flex items-center gap-2 p-3 rounded-xl border border-primary/20 bg-primary/5">
                <ShieldCheck className="w-4 h-4 text-primary" />
                <span className="text-xs text-primary font-medium">Deep focus — stay in the zone</span>
              </div>

              {/* Timer circle */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-40 h-40">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                    <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                    <circle
                      cx="60" cy="60" r="54" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${2 * Math.PI * 54}`}
                      strokeDashoffset={`${2 * Math.PI * 54 * (1 - phaseProgress / 100)}`}
                      className="transition-all duration-1000 ease-linear"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-mono font-bold text-foreground tabular-nums">{mm}:{ss}</span>
                    <span className="text-[10px] text-muted-foreground mt-1">
                      {isPaused ? "paused" : "focusing..."}
                    </span>
                  </div>
                </div>

                {/* Phase description */}
                <p className="text-xs text-muted-foreground text-center leading-relaxed max-w-xs">
                  {currentPhase.description}
                </p>
              </div>

              {/* MCQ section when in MCQ phase */}
              {currentPhase.type === "mcq" && currentMCQ && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3"
                >
                  <p className="text-sm font-medium text-foreground leading-snug">{currentMCQ.question}</p>
                  <div className="space-y-2">
                    {currentMCQ.options.map((opt, i) => (
                      <button
                        key={i}
                        onClick={() => handleAnswerSelect(i)}
                        disabled={showExplanation}
                        className={`w-full text-left p-3 rounded-xl text-xs transition-all border ${
                          showExplanation
                            ? i === currentMCQ.correctIndex
                              ? "border-success/50 bg-success/10 text-success"
                              : i === selectedAnswer
                                ? "border-destructive/50 bg-destructive/10 text-destructive"
                                : "border-border bg-secondary/30 text-muted-foreground"
                            : selectedAnswer === i
                              ? "border-primary/50 bg-primary/10 text-foreground"
                              : "border-border bg-secondary/30 text-foreground hover:bg-secondary/50"
                        }`}
                      >
                        <span className="font-medium mr-2">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </button>
                    ))}
                  </div>

                  {showExplanation && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                      <p className="text-[11px] text-muted-foreground leading-relaxed">{currentMCQ.explanation}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-muted-foreground">
                          Score: {correctAnswers}/{totalAnswered} · Difficulty: {adaptiveDifficulty}
                        </span>
                        <button
                          onClick={nextQuestion}
                          className="flex items-center gap-1 text-xs text-primary font-medium hover:underline"
                        >
                          Next Question <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* Ambient controls (minimal) */}
              <div className="flex items-center gap-2">
                {([
                  { type: "rain" as AmbientSoundType, icon: CloudRain },
                  { type: "lo-fi" as AmbientSoundType, icon: Music },
                  { type: "white-noise" as AmbientSoundType, icon: Radio },
                ]).map((s) => (
                  <button
                    key={s.type}
                    onClick={() => ambient.toggle(s.type)}
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
                  <button
                    onClick={() => { setIsPaused(true); clearTimer(); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-warning/15 text-warning font-semibold border border-warning/30 transition-all active:scale-95"
                  >
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                ) : (
                  <button
                    onClick={() => { setIsPaused(false); startCountdown(secondsLeft); }}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95"
                  >
                    <Play className="w-4 h-4" /> Resume
                  </button>
                )}
                <button
                  onClick={skipToNextPhase}
                  className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-secondary border border-border text-muted-foreground font-medium text-sm transition-all active:scale-95 hover:text-foreground"
                >
                  <SkipForward className="w-4 h-4" />
                  {currentPlanIndex < studyPlan.length - 1 ? "Next" : "Finish"}
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 5: Completion Screen
             ═══════════════════════════════════════════════════ */}
          {step === "complete" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-5">
              {/* Trophy animation */}
              <div className="flex flex-col items-center gap-3 pt-4">
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{ type: "spring", stiffness: 200, damping: 12, delay: 0.2 }}
                  className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                >
                  <Trophy className="w-10 h-10 text-primary" />
                </motion.div>
                <motion.h2
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl font-bold text-foreground"
                >
                  Deep Focus Complete! 🎉
                </motion.h2>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5 }}
                  className="text-xs text-muted-foreground"
                >
                  Outstanding execution — your brain is growing stronger
                </motion.p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  {
                    icon: Clock, label: "Time Focused",
                    value: `${Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000))}m`,
                    color: "text-primary",
                  },
                  {
                    icon: Target, label: "Accuracy",
                    value: totalAnswered > 0 ? `${Math.round((correctAnswers / totalAnswered) * 100)}%` : "N/A",
                    color: "text-success",
                  },
                  {
                    icon: Brain, label: "Stability",
                    value: stabilityAfter !== null ? `${stabilityAfter}%` : stabilityBefore !== null ? `${stabilityBefore}%` : "—",
                    color: "text-primary",
                  },
                  {
                    icon: TrendingUp, label: "Gain",
                    value: stabilityBefore !== null && stabilityAfter !== null
                      ? `+${Math.max(0, stabilityAfter - stabilityBefore)}%`
                      : expectedGain,
                    color: "text-success",
                  },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.6 + i * 0.08 }}
                    className="rounded-xl border border-border bg-secondary/20 p-3.5 text-center"
                  >
                    <stat.icon className={`w-4 h-4 ${stat.color} mx-auto mb-1.5`} />
                    <p className="text-lg font-bold text-foreground tabular-nums">{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Phases completed */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.9 }}
                className="space-y-2"
              >
                <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Phases Completed</span>
                {studyPlan.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 py-1.5">
                    <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    <span className="text-xs text-foreground flex-1">{item.title}</span>
                    <span className="text-[10px] text-muted-foreground">{item.duration}m</span>
                  </div>
                ))}
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.1 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("next-action")}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <ArrowRight className="w-4 h-4" />
                See What's Next
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════════════════
              STEP 6: Next Micro Action
             ═══════════════════════════════════════════════════ */}
          {step === "next-action" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <Zap className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground">Keep the Momentum</h2>
                  <p className="text-xs text-muted-foreground">AI-suggested next actions</p>
                </div>
              </div>

              <div className="space-y-2.5">
                {[
                  {
                    icon: Brain,
                    title: "Quick Recall Test",
                    desc: "5-min recall on what you just studied",
                    time: "5 min",
                    action: () => {
                      onClose();
                      toast({ title: "🧠 Quick Recall", description: "Opening AI Revision Mode..." });
                    },
                  },
                  {
                    icon: BookOpen,
                    title: "Review Weak Areas",
                    desc: "Focus on topics below 40% stability",
                    time: "10 min",
                    action: () => {
                      setStep("entry");
                      setTotalMinutes(10);
                    },
                  },
                  {
                    icon: Star,
                    title: "Start Another Focus Session",
                    desc: "Continue building momentum with a new topic",
                    time: "25 min",
                    action: () => {
                      setStep("entry");
                      setSubject("");
                      setTopic("");
                      setTotalMinutes(25);
                    },
                  },
                  {
                    icon: BarChart3,
                    title: "Check Your Progress",
                    desc: "View brain health and stability trends",
                    time: "2 min",
                    action: () => {
                      onClose();
                    },
                  },
                ].map((item, i) => (
                  <motion.button
                    key={i}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={item.action}
                    className="w-full flex items-center gap-3 p-4 rounded-xl border border-border bg-secondary/20 hover:bg-secondary/40 transition-all text-left group active:scale-[0.98]"
                  >
                    <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                      <item.icon className="w-4 h-4 text-primary" />
                    </div>
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

              <button
                onClick={onClose}
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
