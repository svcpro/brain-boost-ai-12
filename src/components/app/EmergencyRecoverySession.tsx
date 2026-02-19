import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertOctagon, X, Zap, Brain, Loader2, CheckCircle,
  ShieldAlert, Shield, HeartPulse, Trophy, ArrowRight,
  Clock, Target, TrendingUp
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
  risk_level: string;
}

interface MCQOption { text: string; isCorrect: boolean }
interface MCQQuestion {
  question: string;
  options: MCQOption[];
  explanation: string;
  difficulty: string;
}

type Stage =
  | "activation"
  | "crisis-summary"
  | "recall-burst"
  | "mcq-sprint"
  | "correction-summary"
  | "stability-recovery"
  | "reinforcement";

// ─── Constants ───
const RECALL_DURATION_SEC = 60;
const MCQ_PER_TOPIC = 2;

const STAGE_LABELS: Record<Stage, string> = {
  activation: "Emergency Detected",
  "crisis-summary": "Crisis Analysis",
  "recall-burst": "Rapid Recall",
  "mcq-sprint": "MCQ Sprint",
  "correction-summary": "AI Correction",
  "stability-recovery": "Stability Recovery",
  reinforcement: "Mission Complete",
};

// ─── Component ───
const EmergencyRecoverySession = ({ open, onClose, onSessionComplete }: EmergencyRecoverySessionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [stage, setStage] = useState<Stage>("activation");
  const [targets, setTargets] = useState<CrisisTarget[]>([]);
  const [rescueDuration, setRescueDuration] = useState(5);

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

  // Stability animation
  const [stabilityBefore, setStabilityBefore] = useState(0);
  const [stabilityAfter, setStabilityAfter] = useState(0);
  const [stabilityAnimValue, setStabilityAnimValue] = useState(0);

  // Progress
  const stageOrder: Stage[] = ["activation", "crisis-summary", "recall-burst", "mcq-sprint", "correction-summary", "stability-recovery", "reinforcement"];
  const stageProgress = ((stageOrder.indexOf(stage) + 1) / stageOrder.length) * 100;

  // ─── Reset on open ───
  useEffect(() => {
    if (open) {
      setStage("activation");
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
      beginActivation();
    }
    return () => { if (recallIntervalRef.current) clearInterval(recallIntervalRef.current); };
  }, [open]);

  // ─── Stage 1: Activation + auto scan ───
  const beginActivation = async () => {
    setStage("activation");
    // Auto-advance after dramatic pause
    setTimeout(() => scanCrisisTopics(), 2200);
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

      const crisisTargets: CrisisTarget[] = (data || []).map((t: any) => ({
        id: t.id,
        name: t.name,
        subject: (t.subjects as any)?.name || "General",
        memory_strength: Math.round((t.memory_strength ?? 0) * 100),
        risk_level: (t.memory_strength ?? 0) < 0.3 ? "critical" : (t.memory_strength ?? 0) < 0.5 ? "high" : "medium",
      }));

      if (crisisTargets.length === 0) {
        toast({ title: "No topics found", description: "Add topics first to use Emergency Rescue.", variant: "destructive" });
        onClose();
        return;
      }

      setTargets(crisisTargets);
      const avgStrength = crisisTargets.reduce((s, t) => s + t.memory_strength, 0) / crisisTargets.length;
      setStabilityBefore(Math.round(avgStrength));
      setRescueDuration(avgStrength < 25 ? 8 : avgStrength < 40 ? 6 : 5);
      setStage("crisis-summary");
    } catch {
      toast({ title: "Failed to scan topics", variant: "destructive" });
      onClose();
    }
  };

  // ─── Stage 3: Recall burst ───
  const startRecallBurst = () => {
    setCurrentRecallIdx(0);
    setRecallTimer(RECALL_DURATION_SEC);
    setStage("recall-burst");
  };

  useEffect(() => {
    if (stage !== "recall-burst") return;
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
      startMcqSprint();
    }
  };

  const skipRecall = () => {
    if (recallIntervalRef.current) clearInterval(recallIntervalRef.current);
    advanceRecall();
  };

  // ─── Stage 4: MCQ Sprint ───
  const startMcqSprint = async () => {
    setStage("mcq-sprint");
    setMcqLoading(true);
    setCurrentMcqIdx(0);
    setMcqResults([]);
    setSelectedAnswer(null);
    setAnswerRevealed(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const allQuestions: MCQQuestion[] = [];
      for (const target of targets) {
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
          if (!error && data?.questions) {
            allQuestions.push(...data.questions.map((q: any) => ({ ...q, _topic: target.name })));
          }
        } catch {
          // Fallback question
          allQuestions.push({
            question: `Which concept is most critical for "${target.name}"?`,
            options: [
              { text: "Core foundational principle", isCorrect: true },
              { text: "Secondary application", isCorrect: false },
              { text: "Unrelated concept", isCorrect: false },
              { text: "Advanced extension", isCorrect: false },
            ],
            explanation: `Understanding the core principle of ${target.name} is essential for retention.`,
            difficulty: "medium",
          });
        }
      }
      setMcqQuestions(allQuestions);
    } catch {
      toast({ title: "Failed to load questions", variant: "destructive" });
    } finally {
      setMcqLoading(false);
    }
  };

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
  };

  const nextMcq = () => {
    if (currentMcqIdx < mcqQuestions.length - 1) {
      setCurrentMcqIdx(prev => prev + 1);
      setSelectedAnswer(null);
      setAnswerRevealed(false);
    } else {
      setStage("correction-summary");
    }
  };

  // ─── Stage 6: Stability recovery ───
  const startStabilityRecovery = () => {
    const correctCount = mcqResults.filter(r => r.correct).length;
    const accuracy = mcqResults.length > 0 ? correctCount / mcqResults.length : 0;
    const gain = Math.round(accuracy * 15 + 5);
    setStabilityAfter(Math.min(100, stabilityBefore + gain));
    setStabilityAnimValue(stabilityBefore);
    setStage("stability-recovery");

    // Animate the value up
    let current = stabilityBefore;
    const target = Math.min(100, stabilityBefore + gain);
    const step = () => {
      current += 1;
      if (current >= target) {
        setStabilityAnimValue(target);
        confetti({ particleCount: 80, spread: 70, origin: { y: 0.6 } });
        return;
      }
      setStabilityAnimValue(current);
      requestAnimationFrame(step);
    };
    setTimeout(step, 600);
  };

  // ─── Stage 7: Reinforcement ───
  const finishSession = () => {
    setStage("reinforcement");
    confetti({ particleCount: 120, spread: 90, origin: { y: 0.5 } });
  };

  const handleClose = () => {
    if (recallIntervalRef.current) clearInterval(recallIntervalRef.current);
    onSessionComplete?.();
    onClose();
  };

  if (!open) return null;

  const correctCount = mcqResults.filter(r => r.correct).length;
  const accuracy = mcqResults.length > 0 ? Math.round((correctCount / mcqResults.length) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {/* Progress bar */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-secondary">
          <motion.div
            className="h-full bg-gradient-to-r from-destructive to-warning"
            animate={{ width: `${stageProgress}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>

        {/* Stage label */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2">
          <span className="text-[10px] font-semibold text-destructive/70 uppercase tracking-widest">
            {STAGE_LABELS[stage]}
          </span>
        </div>

        {/* Close */}
        <button onClick={handleClose} className="absolute top-4 right-4 p-2 rounded-lg hover:bg-secondary/50 transition-colors z-10">
          <X className="w-4 h-4 text-muted-foreground" />
        </button>

        <div className="w-full max-w-sm mx-4 max-h-[85vh] overflow-y-auto">
          {/* ═══ Stage 1: Activation ═══ */}
          {stage === "activation" && (
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="flex flex-col items-center justify-center text-center py-16 gap-6"
            >
              <motion.div
                animate={{ scale: [1, 1.2, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="p-5 rounded-2xl bg-destructive/15 border border-destructive/30"
              >
                <ShieldAlert className="w-12 h-12 text-destructive" />
              </motion.div>
              <div>
                <h2 className="text-xl font-bold text-foreground">Emergency Mode</h2>
                <p className="text-sm text-muted-foreground mt-2">Scanning your brain for critical risks...</p>
              </div>
              <div className="flex items-center gap-2 text-destructive">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-xs font-medium">Analyzing memory patterns</span>
              </div>
            </motion.div>
          )}

          {/* ═══ Stage 2: Crisis Summary ═══ */}
          {stage === "crisis-summary" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-5 py-6">
              <div className="text-center">
                <div className="inline-flex p-3 rounded-xl bg-destructive/10 border border-destructive/20 mb-3">
                  <AlertOctagon className="w-6 h-6 text-destructive" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Crisis Detected</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {targets.length} topic{targets.length > 1 ? "s" : ""} at risk • ~{rescueDuration} min rescue
                </p>
              </div>

              <div className="space-y-2.5">
                {targets.map((t, i) => (
                  <motion.div
                    key={t.id}
                    initial={{ opacity: 0, x: -15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.15 }}
                    className="flex items-center gap-3 p-3.5 rounded-xl border border-destructive/20 bg-destructive/5"
                  >
                    <div className={`w-3 h-3 rounded-full shrink-0 ${
                      t.risk_level === "critical" ? "bg-destructive animate-pulse" : "bg-warning"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{t.name}</p>
                      <p className="text-[10px] text-muted-foreground">{t.subject}</p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-bold text-destructive">{t.memory_strength}%</span>
                      <p className="text-[10px] text-destructive/70 uppercase font-semibold">{t.risk_level}</p>
                    </div>
                  </motion.div>
                ))}
              </div>

              <div className="rounded-xl border border-border bg-secondary/30 p-3.5">
                <p className="text-xs text-muted-foreground text-center">
                  <Brain className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  AI will run rapid recall bursts followed by high-impact MCQ sprints to stabilize these topics.
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={startRecallBurst}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-destructive to-warning text-destructive-foreground font-semibold transition-all"
              >
                <Zap className="w-4 h-4" /> Begin Rescue
              </motion.button>
            </motion.div>
          )}

          {/* ═══ Stage 3: Recall Burst ═══ */}
          {stage === "recall-burst" && targets[currentRecallIdx] && (
            <motion.div
              key={`recall-${currentRecallIdx}`}
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              className="py-8 space-y-6"
            >
              <div className="text-center">
                <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider">
                  Recall {currentRecallIdx + 1}/{targets.length}
                </span>
                <h3 className="text-lg font-bold text-foreground mt-1">{targets[currentRecallIdx].name}</h3>
                <p className="text-xs text-muted-foreground">{targets[currentRecallIdx].subject}</p>
              </div>

              {/* Timer ring */}
              <div className="flex justify-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-secondary" />
                    <motion.circle
                      cx="50" cy="50" r="44" fill="none" strokeWidth="6"
                      className="stroke-destructive"
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
                <p className="text-sm text-foreground font-medium">Try to recall everything you know about this topic.</p>
                <p className="text-xs text-muted-foreground mt-1">Think of key concepts, formulas, and connections.</p>
              </div>

              <button
                onClick={skipRecall}
                className="w-full py-3 rounded-xl border border-border bg-secondary/30 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                Done — Next →
              </button>
            </motion.div>
          )}

          {/* ═══ Stage 4: MCQ Sprint ═══ */}
          {stage === "mcq-sprint" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-6 space-y-5">
              {mcqLoading ? (
                <div className="flex flex-col items-center justify-center py-16 gap-4">
                  <Loader2 className="w-8 h-8 text-destructive animate-spin" />
                  <p className="text-sm text-muted-foreground">Generating crisis MCQs...</p>
                </div>
              ) : mcqQuestions[currentMcqIdx] ? (
                <>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-destructive font-semibold uppercase tracking-wider">
                      Sprint {currentMcqIdx + 1}/{mcqQuestions.length}
                    </span>
                    <span className="text-[10px] text-muted-foreground font-medium">
                      {correctCount}/{mcqResults.length} correct
                    </span>
                  </div>

                  {/* Progress dots */}
                  <div className="flex gap-1.5 justify-center">
                    {mcqQuestions.map((_, i) => (
                      <div key={i} className={`w-2 h-2 rounded-full transition-colors ${
                        i < mcqResults.length
                          ? mcqResults[i]?.correct ? "bg-success" : "bg-destructive"
                          : i === currentMcqIdx ? "bg-warning animate-pulse" : "bg-secondary"
                      }`} />
                    ))}
                  </div>

                  <div className="rounded-xl border border-border bg-secondary/20 p-4">
                    <p className="text-sm font-medium text-foreground leading-relaxed">
                      {mcqQuestions[currentMcqIdx].question}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {mcqQuestions[currentMcqIdx].options.map((opt, oIdx) => {
                      const isSelected = selectedAnswer === oIdx;
                      const isCorrect = opt.isCorrect;
                      let optionClass = "border-border bg-secondary/20 hover:border-warning/50";
                      if (answerRevealed) {
                        if (isCorrect) optionClass = "border-success/50 bg-success/10";
                        else if (isSelected && !isCorrect) optionClass = "border-destructive/50 bg-destructive/10";
                        else optionClass = "border-border bg-secondary/10 opacity-50";
                      }

                      return (
                        <motion.button
                          key={oIdx}
                          whileTap={!answerRevealed ? { scale: 0.98 } : {}}
                          onClick={() => handleMcqAnswer(oIdx)}
                          disabled={answerRevealed}
                          className={`w-full text-left p-3.5 rounded-xl border transition-all ${optionClass}`}
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
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-destructive to-warning text-destructive-foreground font-semibold text-sm"
                      >
                        {currentMcqIdx < mcqQuestions.length - 1 ? (
                          <>Next <ArrowRight className="w-3.5 h-3.5" /></>
                        ) : (
                          <>View Results <ArrowRight className="w-3.5 h-3.5" /></>
                        )}
                      </button>
                    </motion.div>
                  )}
                </>
              ) : (
                <p className="text-center text-sm text-muted-foreground py-8">No questions available.</p>
              )}
            </motion.div>
          )}

          {/* ═══ Stage 5: Correction Summary ═══ */}
          {stage === "correction-summary" && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="py-6 space-y-5">
              <div className="text-center">
                <div className="inline-flex p-3 rounded-xl bg-primary/10 border border-primary/20 mb-3">
                  <Target className="w-6 h-6 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">AI Correction Report</h2>
                <p className="text-xs text-muted-foreground mt-1">
                  {correctCount}/{mcqResults.length} correct • {accuracy}% accuracy
                </p>
              </div>

              <div className="space-y-2">
                {mcqResults.map((r, i) => (
                  <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border ${
                    r.correct ? "border-success/20 bg-success/5" : "border-destructive/20 bg-destructive/5"
                  }`}>
                    {r.correct ? (
                      <CheckCircle className="w-4 h-4 text-success shrink-0 mt-0.5" />
                    ) : (
                      <AlertOctagon className="w-4 h-4 text-destructive shrink-0 mt-0.5" />
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground">{r.topic}</p>
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{r.explanation}</p>
                    </div>
                  </div>
                ))}
              </div>

              <button
                onClick={startStabilityRecovery}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-destructive to-warning text-destructive-foreground font-semibold text-sm"
              >
                <HeartPulse className="w-4 h-4" /> View Recovery
              </button>
            </motion.div>
          )}

          {/* ═══ Stage 6: Stability Recovery Animation ═══ */}
          {stage === "stability-recovery" && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="py-8 space-y-6">
              <div className="text-center">
                <h2 className="text-lg font-bold text-foreground">Stability Recovering</h2>
                <p className="text-xs text-muted-foreground mt-1">Your memory is being reinforced</p>
              </div>

              {/* Animated stability gauge */}
              <div className="flex justify-center">
                <div className="relative w-36 h-36">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="8" className="stroke-secondary" />
                    <circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                      className="stroke-destructive/20"
                      strokeDasharray={264}
                      strokeDashoffset={264 * (1 - stabilityBefore / 100)}
                    />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none" strokeWidth="8"
                      strokeLinecap="round"
                      className="stroke-success"
                      strokeDasharray={264}
                      animate={{ strokeDashoffset: 264 * (1 - stabilityAnimValue / 100) }}
                      transition={{ duration: 0.05 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-foreground">{stabilityAnimValue}%</span>
                    <span className="text-[10px] text-success font-semibold">
                      +{stabilityAfter - stabilityBefore}% gained
                    </span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">Before</p>
                  <p className="text-lg font-bold text-destructive">{stabilityBefore}%</p>
                </div>
                <div className="rounded-xl border border-success/20 bg-success/5 p-3 text-center">
                  <p className="text-[10px] text-muted-foreground">After</p>
                  <p className="text-lg font-bold text-success">{stabilityAfter}%</p>
                </div>
              </div>

              <button
                onClick={finishSession}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-gradient-to-r from-success to-primary text-primary-foreground font-semibold text-sm"
              >
                <Shield className="w-4 h-4" /> Complete Rescue
              </button>
            </motion.div>
          )}

          {/* ═══ Stage 7: Reinforcement ═══ */}
          {stage === "reinforcement" && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="py-8 space-y-6">
              <div className="text-center">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="inline-flex p-4 rounded-2xl bg-success/10 border border-success/20 mb-4"
                >
                  <Trophy className="w-8 h-8 text-success" />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Crisis Averted!</h2>
                <p className="text-sm text-muted-foreground mt-1">Your memory has been rescued and reinforced.</p>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
                  <Clock className="w-4 h-4 text-muted-foreground mx-auto mb-1" />
                  <p className="text-sm font-bold text-foreground">{rescueDuration}m</p>
                  <p className="text-[10px] text-muted-foreground">Duration</p>
                </div>
                <div className="rounded-xl border border-border bg-secondary/30 p-3 text-center">
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

              <div className="rounded-xl border border-primary/20 bg-primary/5 p-4">
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
                  <Brain className="w-3.5 h-3.5 inline mr-1 text-primary" />
                  {accuracy >= 80
                    ? "Excellent rescue! Your at-risk topics have been stabilized. Keep this momentum going."
                    : accuracy >= 50
                    ? "Good effort! Consider reviewing the missed concepts soon for deeper retention."
                    : "You've started the recovery. Run another session tomorrow to fully stabilize these topics."
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
