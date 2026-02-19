import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Play, Pause, X, CheckCircle, Loader2,
  Target, TrendingUp, Clock, Sparkles, ArrowRight,
  ChevronRight, SkipForward, ShieldCheck, Star,
  BarChart3, Zap, Trophy, RefreshCw, BookOpen, Flame
} from "lucide-react";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { emitEvent } from "@/lib/eventBus";

interface LazyModeSessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
}

type RevisionStep = "scanning" | "plan" | "execution" | "cycle-reward" | "decay-animation" | "complete";

interface RevisionTopic {
  name: string;
  subject: string;
  stability: number;
  forgetRisk: number;
  daysToForget: number | null;
}

interface RevisionCycle {
  topic: RevisionTopic;
  phases: Array<{
    type: "recall" | "reinforcement" | "mcq";
    title: string;
    description: string;
    duration: number;
    completed: boolean;
  }>;
  completed: boolean;
}

interface MCQQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

const SCAN_MESSAGES = [
  { text: "Scanning memory decay curves...", icon: Brain },
  { text: "Identifying forget-risk topics...", icon: Target },
  { text: "Designing revision cycles...", icon: RefreshCw },
  { text: "Optimizing session duration...", icon: Clock },
];

const LazyModeSession = ({ open, onClose, onSessionComplete }: LazyModeSessionProps) => {
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState<RevisionStep>("scanning");
  const [scanIndex, setScanIndex] = useState(0);

  // Plan state
  const [cycles, setCycles] = useState<RevisionCycle[]>([]);
  const [totalDuration, setTotalDuration] = useState(0);
  const [currentCycleIndex, setCurrentCycleIndex] = useState(0);
  const [currentPhaseIndex, setCurrentPhaseIndex] = useState(0);

  // Execution state
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [currentMCQ, setCurrentMCQ] = useState<MCQQuestion | null>(null);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [correctAnswers, setCorrectAnswers] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);

  // Completion state
  const [stabilityGains, setStabilityGains] = useState<Record<string, number>>({});
  const [decayAnimProgress, setDecayAnimProgress] = useState(0);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ═══ Reset on open ═══
  useEffect(() => {
    if (open) {
      setStep("scanning");
      setScanIndex(0);
      setCycles([]);
      setCurrentCycleIndex(0);
      setCurrentPhaseIndex(0);
      setCorrectAnswers(0);
      setTotalAnswered(0);
      setCurrentMCQ(null);
      setSelectedAnswer(null);
      setShowExplanation(false);
      setAdaptiveDifficulty("medium");
      setStabilityGains({});
      setDecayAnimProgress(0);
      startAIScan();
    } else {
      clearTimer();
    }
  }, [open]);

  // Scan animation
  useEffect(() => {
    if (step !== "scanning") return;
    const t = setInterval(() => {
      setScanIndex(prev => prev < SCAN_MESSAGES.length - 1 ? prev + 1 : prev);
    }, 800);
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
  //  AI SCAN — Find topics near forget threshold
  // ═══════════════════════════════════════════════════
  const startAIScan = async () => {
    if (!user) return;
    const scanStart = Date.now();

    try {
      // Fetch topics near forget threshold (low memory strength, approaching predicted drop)
      const { data: topicsData } = await (supabase as any)
        .from("topics")
        .select("id, name, memory_strength, next_predicted_drop_date, last_revision_date, subjects(name)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("memory_strength", { ascending: true })
        .limit(10);

      const { data: features } = await (supabase as any)
        .from("user_features")
        .select("recall_success_rate, knowledge_stability")
        .eq("user_id", user.id)
        .maybeSingle();

      const topics = (topicsData || []).map((t: any) => {
        const stability = Math.round(Number(t.memory_strength ?? 0) * 100);
        const now = new Date();
        const dropDate = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
        const daysToForget = dropDate ? Math.max(0, Math.ceil((dropDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))) : null;
        return {
          name: t.name,
          subject: (t.subjects as any)?.name || "General",
          stability,
          forgetRisk: Math.max(0, 100 - stability),
          daysToForget,
        } as RevisionTopic;
      });

      // Select 2-3 topics with highest forget risk
      const revisionTargets = topics
        .filter((t: RevisionTopic) => t.stability < 70)
        .slice(0, 3);

      // If none below 70%, take the weakest 2
      const targets = revisionTargets.length > 0 ? revisionTargets : topics.slice(0, 2);

      // Determine difficulty
      const recallRate = features?.recall_success_rate ?? 0.5;
      const difficulty: "easy" | "medium" | "hard" =
        recallRate > 0.7 ? "hard" : recallRate < 0.35 ? "easy" : "medium";

      setAdaptiveDifficulty(difficulty);

      // Build revision cycles (each topic gets recall → reinforcement → mcq)
      const topicCount = targets.length || 1;
      const perTopicDuration = topicCount <= 2 ? 6 : 4; // 10-15 min total

      const revisionCycles: RevisionCycle[] = targets.map((topic: RevisionTopic) => ({
        topic,
        completed: false,
        phases: [
          {
            type: "recall" as const,
            title: `Recall: ${topic.name}`,
            description: `Close materials. Write everything you remember about ${topic.name}.`,
            duration: Math.max(1, Math.round(perTopicDuration * 0.35)),
            completed: false,
          },
          {
            type: "reinforcement" as const,
            title: `Reinforce: ${topic.name}`,
            description: `Review key concepts of ${topic.name}. Fill gaps from recall.`,
            duration: Math.max(1, Math.round(perTopicDuration * 0.3)),
            completed: false,
          },
          {
            type: "mcq" as const,
            title: `Test: ${topic.name}`,
            description: `Quick adaptive questions on ${topic.name}.`,
            duration: Math.max(1, Math.round(perTopicDuration * 0.35)),
            completed: false,
          },
        ],
      }));

      // Fallback if no topics
      if (revisionCycles.length === 0) {
        revisionCycles.push({
          topic: { name: "General Review", subject: "General", stability: 50, forgetRisk: 50, daysToForget: null },
          completed: false,
          phases: [
            { type: "recall", title: "Quick Recall", description: "Recall recent study material.", duration: 3, completed: false },
            { type: "reinforcement", title: "Reinforce", description: "Review core concepts.", duration: 3, completed: false },
            { type: "mcq", title: "Quick Test", description: "Test your understanding.", duration: 4, completed: false },
          ],
        });
      }

      const total = revisionCycles.reduce((s, c) => s + c.phases.reduce((ps, p) => ps + p.duration, 0), 0);

      setCycles(revisionCycles);
      setTotalDuration(total);

      // Ensure minimum scan animation
      const elapsed = Date.now() - scanStart;
      if (elapsed < 3200) await new Promise(r => setTimeout(r, 3200 - elapsed));

      setStep("plan");
    } catch (err) {
      console.error("AI scan error:", err);
      setCycles([{
        topic: { name: "Quick Review", subject: "General", stability: 50, forgetRisk: 50, daysToForget: null },
        completed: false,
        phases: [
          { type: "recall", title: "Quick Recall", description: "Recall key points.", duration: 4, completed: false },
          { type: "reinforcement", title: "Reinforce", description: "Review concepts.", duration: 3, completed: false },
          { type: "mcq", title: "Quick Test", description: "Test yourself.", duration: 3, completed: false },
        ],
      }]);
      setTotalDuration(10);
      setStep("plan");
    }
  };

  // ═══════════════════════════════════════════════════
  //  EXECUTION
  // ═══════════════════════════════════════════════════
  const handleStartRevision = () => {
    setStep("execution");
    setCurrentCycleIndex(0);
    setCurrentPhaseIndex(0);
    startTimeRef.current = Date.now();
    const firstDuration = cycles[0]?.phases[0]?.duration || 3;
    startCountdown(firstDuration * 60);
  };

  useEffect(() => {
    if (secondsLeft === 0 && step === "execution" && !isPaused && cycles.length > 0 && startTimeRef.current > 0) {
      handlePhaseComplete();
    }
  }, [secondsLeft, step, isPaused]);

  const handlePhaseComplete = () => {
    clearTimer();
    const updatedCycles = cycles.map((c, ci) => ({
      ...c,
      phases: c.phases.map((p, pi) =>
        ci === currentCycleIndex && pi === currentPhaseIndex ? { ...p, completed: true } : p
      ),
    }));

    const nextPhase = currentPhaseIndex + 1;
    const currentCycle = updatedCycles[currentCycleIndex];

    if (nextPhase < currentCycle.phases.length) {
      // Next phase in same cycle
      setCycles(updatedCycles);
      setCurrentPhaseIndex(nextPhase);
      if (currentCycle.phases[nextPhase].type === "mcq") fetchAIMCQ(currentCycle.topic.name, currentCycle.topic.subject);
      startCountdown(currentCycle.phases[nextPhase].duration * 60);
    } else {
      // Cycle complete
      updatedCycles[currentCycleIndex].completed = true;
      setCycles(updatedCycles);

      // Track stability gain for this topic
      const topicName = currentCycle.topic.name;
      const gain = currentCycle.topic.stability < 30 ? 8 : currentCycle.topic.stability < 60 ? 5 : 3;
      setStabilityGains(prev => ({ ...prev, [topicName]: gain }));

      const nextCycle = currentCycleIndex + 1;
      if (nextCycle < updatedCycles.length) {
        // Show cycle reward before next topic
        setStep("cycle-reward");
        confetti({ particleCount: 35, spread: 50, origin: { y: 0.6 }, colors: ["#22c55e", "#6366f1", "#14b8a6"] });
      } else {
        // All cycles done → show decay animation
        showDecayCurveAnimation();
      }
    }
  };

  const continueToNextCycle = () => {
    const nextCycle = currentCycleIndex + 1;
    setCurrentCycleIndex(nextCycle);
    setCurrentPhaseIndex(0);
    setStep("execution");
    const nextDuration = cycles[nextCycle]?.phases[0]?.duration || 3;
    startCountdown(nextDuration * 60);
  };

  // ═══ Decay Curve Animation ═══
  const showDecayCurveAnimation = () => {
    setStep("decay-animation");
    setDecayAnimProgress(0);
    let progress = 0;
    const animInterval = setInterval(() => {
      progress += 2;
      setDecayAnimProgress(progress);
      if (progress >= 100) {
        clearInterval(animInterval);
        setTimeout(() => handleSessionComplete(), 800);
      }
    }, 30);
  };

  // ═══ MCQ ═══
  const fetchAIMCQ = async (topicName: string, subjectName: string) => {
    try {
      const { data } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "mission_questions", topic_name: topicName, subject_name: subjectName, difficulty: adaptiveDifficulty, count: 1 },
      });
      const q = data?.questions?.[0];
      if (q) {
        setCurrentMCQ({ question: q.question, options: q.options, correctIndex: q.correct_index, explanation: q.explanation });
        setSelectedAnswer(null);
        setShowExplanation(false);
        return;
      }
    } catch { /* fallback */ }
    setCurrentMCQ({
      question: `Which concept is most critical for understanding ${topicName}?`,
      options: ["Core foundational principle", "Peripheral detail", "Unrelated concept", "Deprecated theory"],
      correctIndex: 0,
      explanation: `Core foundational principles of ${topicName} are essential for retention.`,
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

  const nextMCQ = () => {
    const cycle = cycles[currentCycleIndex];
    if (cycle) fetchAIMCQ(cycle.topic.name, cycle.topic.subject);
  };

  // ═══ COMPLETION ═══
  const handleSessionComplete = async () => {
    clearTimer();
    setStep("complete");
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ["#22c55e", "#6366f1", "#f59e0b", "#14b8a6"] });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4, x: 0.3 } }), 300);

    const elapsedMs = Date.now() - startTimeRef.current;
    const elapsed = Math.max(1, Math.round(elapsedMs / 60000));

    // Log study for each revised topic
    for (const cycle of cycles) {
      if (cycle.completed) {
        await logStudy({
          subjectName: cycle.topic.subject,
          topicName: cycle.topic.name,
          durationMinutes: Math.max(1, Math.round(elapsed / cycles.length)),
          confidenceLevel: totalAnswered > 0 && correctAnswers / totalAnswered > 0.6 ? "high" : "medium",
          studyMode: "lazy",
        });
      }
    }

    onSessionComplete?.();
    emitEvent("study_session_end", {
      mode: "ai_revision",
      duration: elapsed,
      topics: cycles.map(c => c.topic.name),
    }, {
      title: "AI Revision Complete! 🧠",
      body: `${elapsed} min · ${cycles.filter(c => c.completed).length} topics revised`,
    });
  };

  // ═══ Computed ═══
  const currentCycle = cycles[currentCycleIndex];
  const currentPhase = currentCycle?.phases[currentPhaseIndex];
  const totalPlanSecs = (currentPhase?.duration || 1) * 60;
  const phaseProgress = totalPlanSecs > 0 ? ((totalPlanSecs - secondsLeft) / totalPlanSecs) * 100 : 0;
  const totalPhases = cycles.reduce((s, c) => s + c.phases.length, 0);
  const completedPhases = cycles.reduce((s, c) => s + c.phases.filter(p => p.completed).length, 0);
  const overallProgress = totalPhases > 0 ? (completedPhases / totalPhases) * 100 : 0;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const totalStabilityGain = Object.values(stabilityGains).reduce((s, v) => s + v, 0);
  const completedCycles = cycles.filter(c => c.completed).length;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {/* Progress bar */}
        {(step === "execution" || step === "cycle-reward") && (
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
          {step === "plan" && (
            <button onClick={onClose} className="absolute top-4 right-4 p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* ═══ STAGE 1: AI Scanning Animation ═══ */}
          {step === "scanning" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-12 flex flex-col items-center gap-6">
              <motion.div
                animate={{ scale: [1, 1.1, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
                className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px hsl(var(--primary) / 0.2)" }}
              >
                <Brain className="w-10 h-10 text-primary" />
              </motion.div>

              <div className="space-y-3 w-full max-w-xs">
                {SCAN_MESSAGES.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: i <= scanIndex ? 1 : 0.2, x: i <= scanIndex ? 0 : -20 }}
                    transition={{ duration: 0.4 }}
                    className="flex items-center gap-3"
                  >
                    {i < scanIndex ? (
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    ) : i === scanIndex ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1, ease: "linear" }}>
                        <Loader2 className="w-4 h-4 text-primary shrink-0" />
                      </motion.div>
                    ) : (
                      <div className="w-4 h-4 rounded-full border border-border shrink-0" />
                    )}
                    <span className={`text-sm ${i <= scanIndex ? "text-foreground" : "text-muted-foreground/40"}`}>{msg.text}</span>
                  </motion.div>
                ))}
              </div>
              <p className="text-[10px] text-muted-foreground">AI is finding your most at-risk memories</p>
            </motion.div>
          )}

          {/* ═══ STAGE 2: Revision Plan ═══ */}
          {step === "plan" && cycles.length > 0 && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/15">
                  <RefreshCw className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">AI Revision Plan</h2>
                  <p className="text-xs text-muted-foreground">{cycles.length} topics · {totalDuration} min · Smart cycles</p>
                </div>
              </div>

              {/* Topic cards with forget risk */}
              <div className="space-y-2.5">
                {cycles.map((cycle, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.1 }}
                    className="rounded-xl border border-border bg-secondary/20 p-4"
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        cycle.topic.forgetRisk > 60 ? "bg-destructive/15" : cycle.topic.forgetRisk > 30 ? "bg-warning/15" : "bg-success/15"
                      }`}>
                        <span className="text-sm font-bold">{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold text-foreground truncate">{cycle.topic.name}</h4>
                        <p className="text-[10px] text-muted-foreground">{cycle.topic.subject}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className={`text-xs font-bold ${
                          cycle.topic.forgetRisk > 60 ? "text-destructive" : cycle.topic.forgetRisk > 30 ? "text-warning" : "text-success"
                        }`}>{cycle.topic.forgetRisk}% risk</p>
                        {cycle.topic.daysToForget !== null && (
                          <p className="text-[9px] text-muted-foreground">
                            {cycle.topic.daysToForget === 0 ? "Forgetting today!" : `${cycle.topic.daysToForget}d to forget`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Decay risk bar */}
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${cycle.topic.forgetRisk}%` }}
                        transition={{ delay: 0.3 + i * 0.1, duration: 0.6 }}
                        className={`h-full rounded-full ${
                          cycle.topic.forgetRisk > 60 ? "bg-destructive" : cycle.topic.forgetRisk > 30 ? "bg-warning" : "bg-success"
                        }`}
                      />
                    </div>

                    {/* Cycle phases preview */}
                    <div className="flex items-center gap-2 mt-2">
                      {cycle.phases.map((p, pi) => (
                        <span key={pi} className="text-[9px] text-muted-foreground flex items-center gap-1">
                          {p.type === "recall" ? <Brain className="w-2.5 h-2.5" /> :
                           p.type === "reinforcement" ? <RefreshCw className="w-2.5 h-2.5" /> :
                           <Target className="w-2.5 h-2.5" />}
                          {p.duration}m
                        </span>
                      ))}
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Summary stats */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
                className="grid grid-cols-3 gap-2"
              >
                <div className="rounded-lg bg-background/50 border border-border/50 p-2.5 text-center">
                  <Clock className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-foreground">{totalDuration}m</p>
                  <p className="text-[9px] text-muted-foreground">Duration</p>
                </div>
                <div className="rounded-lg bg-background/50 border border-border/50 p-2.5 text-center">
                  <RefreshCw className="w-3.5 h-3.5 text-primary mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-foreground">{cycles.length}</p>
                  <p className="text-[9px] text-muted-foreground">Cycles</p>
                </div>
                <div className="rounded-lg bg-background/50 border border-border/50 p-2.5 text-center">
                  <TrendingUp className="w-3.5 h-3.5 text-success mx-auto mb-0.5" />
                  <p className="text-sm font-bold text-success">+{cycles.length * 5}%</p>
                  <p className="text-[9px] text-muted-foreground">Est. Gain</p>
                </div>
              </motion.div>

              {/* CTA */}
              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
                whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
                onClick={handleStartRevision}
                className="w-full flex items-center justify-center gap-2.5 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-sm hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.35)" }}
              >
                <Zap className="w-5 h-5" />
                Start Revision
              </motion.button>
            </motion.div>
          )}

          {/* ═══ STAGE 3: Execution ═══ */}
          {step === "execution" && currentCycle && currentPhase && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
              {/* Cycle indicator */}
              <div className="flex items-center gap-1.5">
                {cycles.map((c, i) => (
                  <div key={i} className={`flex-1 h-1.5 rounded-full transition-all ${
                    c.completed ? "bg-primary" : i === currentCycleIndex ? "bg-primary/50" : "bg-secondary"
                  }`} />
                ))}
              </div>

              {/* Phase header */}
              <div className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl ${
                  currentPhase.type === "recall" ? "bg-primary/15" :
                  currentPhase.type === "reinforcement" ? "bg-warning/15" : "bg-success/15"
                }`}>
                  {currentPhase.type === "recall" ? <Brain className="w-5 h-5 text-primary" /> :
                   currentPhase.type === "reinforcement" ? <RefreshCw className="w-5 h-5 text-warning" /> :
                   <Target className="w-5 h-5 text-success" />}
                </div>
                <div className="flex-1">
                  <h3 className="font-bold text-foreground text-sm">{currentPhase.title}</h3>
                  <p className="text-[10px] text-muted-foreground">
                    Topic {currentCycleIndex + 1}/{cycles.length} · Phase {currentPhaseIndex + 1}/3
                  </p>
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
                <span className="text-xs text-primary font-medium">Revision mode — strengthening memory</span>
              </div>

              {/* Timer */}
              <div className="flex flex-col items-center gap-4">
                <div className="relative w-36 h-36">
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
                    <span className="text-[10px] text-muted-foreground mt-1">{isPaused ? "paused" : "revising..."}</span>
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
                        <span className="text-[10px] text-muted-foreground">Score: {correctAnswers}/{totalAnswered}</span>
                        <button onClick={nextMCQ} className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
                          Next <ChevronRight className="w-3 h-3" />
                        </button>
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

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
                  <SkipForward className="w-4 h-4" /> Next
                </button>
              </div>
            </motion.div>
          )}

          {/* ═══ CYCLE REWARD (between topics) ═══ */}
          {step === "cycle-reward" && currentCycle && (
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
                className="w-20 h-20 rounded-full bg-success/15 flex items-center justify-center"
                style={{ boxShadow: "0 0 40px hsl(var(--success) / 0.2)" }}
              >
                <span className="text-4xl">🛡️</span>
              </motion.div>

              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                className="text-center space-y-1"
              >
                <h3 className="text-lg font-bold text-foreground">Memory Stabilized!</h3>
                <p className="text-xs text-muted-foreground">{currentCycle.topic.name} — forget risk reduced</p>
              </motion.div>

              {/* Mini stability gain */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-success/10 border border-success/20"
              >
                <TrendingUp className="w-4 h-4 text-success" />
                <span className="text-sm font-bold text-success">+{stabilityGains[currentCycle.topic.name] || 5}% stability</span>
              </motion.div>

              {/* Progress */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }} className="w-full space-y-2">
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Revision Progress</span>
                  <span className="font-semibold text-primary">{completedCycles}/{cycles.length} topics</span>
                </div>
                <div className="flex gap-1.5">
                  {cycles.map((c, i) => (
                    <div key={i} className={`flex-1 h-2 rounded-full transition-all ${c.completed ? "bg-primary" : "bg-secondary"}`} />
                  ))}
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                whileTap={{ scale: 0.97 }}
                onClick={continueToNextCycle}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <ArrowRight className="w-4 h-4" />
                Next: {cycles[currentCycleIndex + 1]?.topic.name || "Continue"}
              </motion.button>
            </motion.div>
          )}

          {/* ═══ STAGE 4: Decay Curve Extension Animation ═══ */}
          {step === "decay-animation" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 flex flex-col items-center gap-6">
              <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className="w-16 h-16 rounded-full bg-primary/15 flex items-center justify-center"
              >
                <Sparkles className="w-8 h-8 text-primary" />
              </motion.div>

              <div className="text-center space-y-1">
                <h3 className="text-lg font-bold text-foreground">Extending Memory Curves...</h3>
                <p className="text-xs text-muted-foreground">Your forgetting curves are being pushed further</p>
              </div>

              {/* Decay curve visualization */}
              <div className="w-full rounded-xl border border-border bg-secondary/20 p-4">
                <svg viewBox="0 0 300 100" className="w-full h-20">
                  {/* Old decay curve (red, fading) */}
                  <path
                    d={`M 10 20 Q 80 25, 120 60 T 280 90`}
                    fill="none"
                    stroke="hsl(var(--destructive))"
                    strokeWidth="2"
                    strokeDasharray="4 4"
                    opacity={Math.max(0.2, 1 - decayAnimProgress / 100)}
                  />
                  {/* New extended curve (green, growing) */}
                  <path
                    d={`M 10 20 Q 100 22, 160 35 T 290 55`}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeDasharray={300}
                    strokeDashoffset={300 - (decayAnimProgress / 100) * 300}
                    className="transition-all duration-100"
                  />
                  {/* Labels */}
                  <text x="10" y="14" fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.7">Memory</text>
                  <text x="250" y="98" fill="hsl(var(--muted-foreground))" fontSize="8" opacity="0.7">Time →</text>
                </svg>
                <div className="flex items-center justify-between mt-2">
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-destructive rounded-full opacity-50" />
                    <span className="text-[9px] text-muted-foreground">Before</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="w-3 h-0.5 bg-primary rounded-full" />
                    <span className="text-[9px] text-primary font-medium">After revision</span>
                  </div>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full space-y-1">
                <div className="h-2 rounded-full bg-secondary overflow-hidden">
                  <motion.div className="h-full rounded-full bg-primary" style={{ width: `${decayAnimProgress}%` }} />
                </div>
                <p className="text-[10px] text-muted-foreground text-center">Stabilizing neural pathways...</p>
              </div>
            </motion.div>
          )}

          {/* ═══ STAGE 5: Completion ═══ */}
          {step === "complete" && (
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
                  className="text-xl font-bold text-foreground">Revision Complete! 🛡️</motion.h2>
                <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                  className="text-xs text-muted-foreground">{completedCycles} topics stabilized</motion.p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { icon: TrendingUp, label: "Stability Gain", value: `+${totalStabilityGain}%`, color: "text-success" },
                  { icon: Target, label: "Risk Reduced", value: `${completedCycles} topics`, color: "text-primary" },
                  { icon: Star, label: "Accuracy", value: totalAnswered > 0 ? `${Math.round((correctAnswers / totalAnswered) * 100)}%` : "N/A", color: "text-success" },
                  { icon: Clock, label: "Time", value: `${Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000))}m`, color: "text-primary" },
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

              {/* Per-topic breakdown */}
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.9 }}
                className="space-y-2"
              >
                <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Topics Stabilized</p>
                {cycles.filter(c => c.completed).map((cycle, i) => (
                  <div key={i} className="flex items-center gap-3 py-2 px-3 rounded-xl bg-success/5 border border-success/20">
                    <CheckCircle className="w-4 h-4 text-success shrink-0" />
                    <span className="text-xs text-foreground flex-1">{cycle.topic.name}</span>
                    <span className="text-xs font-bold text-success">+{stabilityGains[cycle.topic.name] || 5}%</span>
                  </div>
                ))}
              </motion.div>

              <motion.button initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.1 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full flex items-center justify-center gap-2.5 py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm"
                style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.3)" }}
              >
                <CheckCircle className="w-4 h-4" /> Done
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LazyModeSession;
