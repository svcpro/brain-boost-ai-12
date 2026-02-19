import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Target, X, Loader2, Brain, TrendingUp, Clock,
  Sparkles, ArrowRight, BarChart3, Zap, Trophy,
  CheckCircle, Star, Flame, Award, Swords,
  ChevronRight, Timer, Users, Crown, Medal
} from "lucide-react";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { emitEvent } from "@/lib/eventBus";

interface MockPracticeSessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
}

type MockStep = "preparing" | "blueprint" | "exam" | "scoring" | "results" | "summary";

interface MockBlueprint {
  subjects: Array<{ name: string; topicCount: number }>;
  topics: Array<{ name: string; subject: string; stability: number }>;
  totalQuestions: number;
  timeLimit: number; // minutes
  difficulty: "easy" | "medium" | "hard";
  expectedPercentile: number;
}

interface MCQQuestion {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  topic: string;
  subject: string;
  difficulty: "easy" | "medium" | "hard";
}

interface QuestionResult {
  question: MCQQuestion;
  selectedIndex: number | null;
  correct: boolean;
  timeSpent: number; // seconds
}

const PREP_MESSAGES = [
  { text: "Analyzing your performance history...", icon: Brain },
  { text: "Selecting competitive topics...", icon: Target },
  { text: "Calibrating difficulty curve...", icon: BarChart3 },
  { text: "Generating exam blueprint...", icon: Sparkles },
  { text: "Simulating competitive field...", icon: Users },
];

const MockPracticeSession = ({ open, onClose, onSessionComplete }: MockPracticeSessionProps) => {
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const { user } = useAuth();

  const [step, setStep] = useState<MockStep>("preparing");
  const [prepIndex, setPrepIndex] = useState(0);

  // Blueprint
  const [blueprint, setBlueprint] = useState<MockBlueprint | null>(null);

  // Exam state
  const [questions, setQuestions] = useState<MCQQuestion[]>([]);
  const [currentQIndex, setCurrentQIndex] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [results, setResults] = useState<QuestionResult[]>([]);
  const [examSecondsLeft, setExamSecondsLeft] = useState(0);
  const [questionStartTime, setQuestionStartTime] = useState(0);
  const [adaptiveDifficulty, setAdaptiveDifficulty] = useState<"easy" | "medium" | "hard">("medium");

  // Results
  const [finalScore, setFinalScore] = useState(0);
  const [finalPercentile, setFinalPercentile] = useState(0);
  const [avgSpeed, setAvgSpeed] = useState(0);
  const [aiSummary, setAiSummary] = useState("");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  // ═══ Reset on open ═══
  useEffect(() => {
    if (open) {
      setStep("preparing");
      setPrepIndex(0);
      setBlueprint(null);
      setQuestions([]);
      setCurrentQIndex(0);
      setSelectedAnswer(null);
      setResults([]);
      setAdaptiveDifficulty("medium");
      setFinalScore(0);
      setFinalPercentile(0);
      setAvgSpeed(0);
      setAiSummary("");
      startAIPreparation();
    } else {
      clearTimer();
    }
  }, [open]);

  // ═══ Prep animation ═══
  useEffect(() => {
    if (step !== "preparing") return;
    const t = setInterval(() => {
      setPrepIndex(prev => prev < PREP_MESSAGES.length - 1 ? prev + 1 : prev);
    }, 800);
    return () => clearInterval(t);
  }, [step]);

  const clearTimer = () => {
    if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; }
  };

  useEffect(() => () => clearTimer(), []);

  // ═══ Exam timer ═══
  const startExamTimer = (seconds: number) => {
    clearTimer();
    setExamSecondsLeft(seconds);
    intervalRef.current = setInterval(() => {
      setExamSecondsLeft(prev => {
        if (prev <= 1) { clearTimer(); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  // Time's up
  useEffect(() => {
    if (examSecondsLeft === 0 && step === "exam" && startTimeRef.current > 0) {
      handleExamComplete();
    }
  }, [examSecondsLeft, step]);

  // ═══════════════════════════════════════════════════
  //  AI PREPARATION
  // ═══════════════════════════════════════════════════
  const startAIPreparation = async () => {
    if (!user) return;
    const prepStart = Date.now();

    try {
      const [topicsRes, examRes, featuresRes] = await Promise.all([
        (supabase as any)
          .from("topics")
          .select("id, name, memory_strength, subjects(name)")
          .eq("user_id", user.id)
          .eq("deleted", false)
          .order("memory_strength", { ascending: true })
          .limit(6),
        supabase
          .from("exam_results")
          .select("score, total_questions, difficulty")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(10),
        (supabase as any)
          .from("user_features")
          .select("recall_success_rate, knowledge_stability, subject_strength_score")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      const allTopics = topicsRes.data || [];
      const recentExams = examRes.data || [];
      const features = featuresRes.data;

      // Pick 3-5 topics across subjects
      const selectedTopics = allTopics.slice(0, Math.min(5, Math.max(3, allTopics.length)));
      const subjectMap = new Map<string, number>();
      const topicList = selectedTopics.map((t: any) => {
        const subj = (t.subjects as any)?.name || "General";
        subjectMap.set(subj, (subjectMap.get(subj) || 0) + 1);
        return {
          name: t.name,
          subject: subj,
          stability: Math.round(Number(t.memory_strength ?? 0) * 100),
        };
      });

      const subjects = Array.from(subjectMap.entries()).map(([name, topicCount]) => ({ name, topicCount }));

      // Difficulty from history
      let avgAccuracy = 0.5;
      if (recentExams.length > 0) {
        avgAccuracy = recentExams.reduce((s: number, e: any) => s + (e.score / Math.max(1, e.total_questions)), 0) / recentExams.length;
      }
      const recallRate = features?.recall_success_rate ?? 0.5;

      const difficulty: "easy" | "medium" | "hard" =
        avgAccuracy > 0.75 && recallRate > 0.7 ? "hard" :
        avgAccuracy < 0.45 || recallRate < 0.35 ? "easy" : "medium";

      // Questions: 8-12 based on topic count
      const totalQuestions = Math.min(12, Math.max(8, topicList.length * 2 + 2));

      // Time: 10-20 min
      const timeLimit = difficulty === "hard" ? 12 : difficulty === "easy" ? 18 : 15;

      // Percentile estimate
      const avgStability = topicList.length > 0
        ? topicList.reduce((s: number, t: any) => s + t.stability, 0) / topicList.length
        : 50;
      const expectedPercentile = Math.min(99, Math.round(avgStability * 0.6 + avgAccuracy * 30 + 10));

      const mockBlueprint: MockBlueprint = {
        subjects: subjects.length > 0 ? subjects : [{ name: "General", topicCount: 1 }],
        topics: topicList.length > 0 ? topicList : [{ name: "General Review", subject: "General", stability: 50 }],
        totalQuestions,
        timeLimit,
        difficulty,
        expectedPercentile,
      };

      setBlueprint(mockBlueprint);
      setAdaptiveDifficulty(difficulty);

      const elapsed = Date.now() - prepStart;
      if (elapsed < 4000) await new Promise(r => setTimeout(r, 4000 - elapsed));

      setStep("blueprint");
    } catch (err) {
      console.error("Mock prep error:", err);
      const fallback: MockBlueprint = {
        subjects: [{ name: "General", topicCount: 1 }],
        topics: [{ name: "Mixed Review", subject: "General", stability: 50 }],
        totalQuestions: 10,
        timeLimit: 15,
        difficulty: "medium",
        expectedPercentile: 60,
      };
      setBlueprint(fallback);
      setStep("blueprint");
    }
  };

  // ═══════════════════════════════════════════════════
  //  START EXAM
  // ═══════════════════════════════════════════════════
  const handleStartExam = async () => {
    if (!blueprint) return;
    setStep("exam");
    startTimeRef.current = Date.now();
    startExamTimer(blueprint.timeLimit * 60);
    setQuestionStartTime(Date.now());
    await fetchQuestion(0);
  };

  const fetchQuestion = async (index: number) => {
    if (!blueprint) return;
    const topicIdx = index % blueprint.topics.length;
    const topic = blueprint.topics[topicIdx];

    try {
      const { data } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "mission_questions",
          topic_name: topic.name,
          subject_name: topic.subject,
          difficulty: adaptiveDifficulty,
          count: 1,
        },
      });
      const q = data?.questions?.[0];
      if (q) {
        const mcq: MCQQuestion = {
          question: q.question,
          options: q.options,
          correctIndex: q.correct_index,
          explanation: q.explanation,
          topic: topic.name,
          subject: topic.subject,
          difficulty: adaptiveDifficulty,
        };
        setQuestions(prev => {
          const updated = [...prev];
          updated[index] = mcq;
          return updated;
        });
        setSelectedAnswer(null);
        return;
      }
    } catch { /* fallback */ }

    // Fallback
    const mcq: MCQQuestion = {
      question: `Which of the following best applies to ${topic.name}?`,
      options: [
        "A core principle fundamental to understanding",
        "A secondary concept with limited scope",
        "An advanced theorem rarely applied",
        "A historical concept no longer relevant",
      ],
      correctIndex: 0,
      explanation: `Understanding the core principles of ${topic.name} builds a strong foundation.`,
      topic: topic.name,
      subject: topic.subject,
      difficulty: adaptiveDifficulty,
    };
    setQuestions(prev => {
      const updated = [...prev];
      updated[index] = mcq;
      return updated;
    });
    setSelectedAnswer(null);
  };

  const handleAnswerSelect = (index: number) => {
    if (selectedAnswer !== null) return;
    setSelectedAnswer(index);

    const currentQ = questions[currentQIndex];
    if (!currentQ) return;

    const correct = index === currentQ.correctIndex;
    const timeSpent = Math.round((Date.now() - questionStartTime) / 1000);

    // Adaptive difficulty
    if (correct) {
      if (adaptiveDifficulty === "easy") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("hard");
    } else {
      if (adaptiveDifficulty === "hard") setAdaptiveDifficulty("medium");
      else if (adaptiveDifficulty === "medium") setAdaptiveDifficulty("easy");
    }

    setResults(prev => [...prev, { question: currentQ, selectedIndex: index, correct, timeSpent }]);
  };

  const handleNextQuestion = async () => {
    if (!blueprint) return;
    const nextIdx = currentQIndex + 1;

    if (nextIdx >= blueprint.totalQuestions) {
      handleExamComplete();
      return;
    }

    setCurrentQIndex(nextIdx);
    setSelectedAnswer(null);
    setQuestionStartTime(Date.now());
    await fetchQuestion(nextIdx);
  };

  // ═══════════════════════════════════════════════════
  //  EXAM COMPLETE + SCORING
  // ═══════════════════════════════════════════════════
  const handleExamComplete = async () => {
    clearTimer();
    setStep("scoring");

    // Scoring animation delay
    await new Promise(r => setTimeout(r, 2500));

    const totalAnswered = results.length;
    const correctCount = results.filter(r => r.correct).length;
    const score = totalAnswered > 0 ? Math.round((correctCount / totalAnswered) * 100) : 0;
    const avgTime = totalAnswered > 0 ? Math.round(results.reduce((s, r) => s + r.timeSpent, 0) / totalAnswered) : 0;

    // Simulate percentile
    const basePercentile = blueprint?.expectedPercentile || 60;
    const performanceBonus = score > 80 ? 15 : score > 60 ? 8 : score > 40 ? 0 : -10;
    const speedBonus = avgTime < 20 ? 5 : avgTime < 40 ? 2 : -3;
    const percentile = Math.min(99, Math.max(5, basePercentile + performanceBonus + speedBonus));

    setFinalScore(score);
    setFinalPercentile(percentile);
    setAvgSpeed(avgTime);

    // Generate AI summary
    const strengths = results.filter(r => r.correct).map(r => r.question.topic);
    const weaknesses = results.filter(r => !r.correct).map(r => r.question.topic);
    const uniqueStrengths = [...new Set(strengths)];
    const uniqueWeaknesses = [...new Set(weaknesses)];

    let summary = "";
    if (score >= 80) {
      summary = `Excellent performance! You demonstrated strong command across ${uniqueStrengths.slice(0, 2).join(" and ")}. `;
    } else if (score >= 60) {
      summary = `Solid attempt with room for growth. `;
    } else {
      summary = `This mock revealed key areas to strengthen. `;
    }
    if (uniqueWeaknesses.length > 0) {
      summary += `Focus your next session on ${uniqueWeaknesses.slice(0, 2).join(" and ")} for maximum rank improvement.`;
    } else {
      summary += `All topics handled well — increase difficulty next time for continued growth.`;
    }
    setAiSummary(summary);

    // Confetti
    confetti({ particleCount: 120, spread: 80, origin: { y: 0.5 }, colors: ["#6366f1", "#f59e0b", "#22c55e", "#ef4444"] });
    setTimeout(() => confetti({ particleCount: 60, spread: 100, origin: { y: 0.4, x: 0.3 } }), 500);

    setStep("results");

    // Log study
    const elapsedMin = Math.max(1, Math.round((Date.now() - startTimeRef.current) / 60000));
    await logStudy({
      subjectName: blueprint?.subjects[0]?.name || "General",
      topicName: blueprint?.topics[0]?.name || "Mock Practice",
      durationMinutes: elapsedMin,
      confidenceLevel: score > 70 ? "high" : score > 40 ? "medium" : "low",
      studyMode: "focus",
    });

    onSessionComplete?.();

    emitEvent("study_session_end", {
      mode: "mock_practice",
      duration: elapsedMin,
      score,
      percentile,
    }, {
      title: "Mock Complete! 🎯",
      body: `Score: ${score}% · Percentile: ${percentile}th`,
    });
  };

  // ═══ Computed ═══
  const currentQ = questions[currentQIndex];
  const examMM = String(Math.floor(examSecondsLeft / 60)).padStart(2, "0");
  const examSS = String(examSecondsLeft % 60).padStart(2, "0");
  const examProgress = blueprint ? ((currentQIndex + (selectedAnswer !== null ? 1 : 0)) / blueprint.totalQuestions) * 100 : 0;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/98 backdrop-blur-xl"
      >
        {/* Exam progress bar */}
        {step === "exam" && (
          <div className="fixed top-0 left-0 right-0 h-1 bg-secondary z-[60]">
            <motion.div className="h-full bg-primary" style={{ width: `${examProgress}%` }} transition={{ duration: 0.4 }} />
          </div>
        )}

        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.92, opacity: 0 }}
          transition={{ type: "spring", damping: 28, stiffness: 300 }}
          className="relative w-full max-w-md mx-4 max-h-[92vh] overflow-y-auto rounded-3xl border border-border bg-card p-6 shadow-2xl"
        >
          {/* Close button */}
          {step !== "exam" && (
            <button onClick={onClose} className="absolute top-4 right-4 p-2 rounded-full bg-secondary/50 hover:bg-secondary text-muted-foreground z-10">
              <X className="w-4 h-4" />
            </button>
          )}

          {/* ═══════════════════════════════════════
              STAGE 1: COMPETITIVE PREPARATION
          ═══════════════════════════════════════ */}
          {step === "preparing" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-10 space-y-8"
            >
              {/* Pulsing icon */}
              <motion.div
                animate={{ scale: [1, 1.12, 1], opacity: [0.7, 1, 0.7] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                className="w-20 h-20 rounded-2xl bg-primary/15 mx-auto flex items-center justify-center"
              >
                <Swords className="w-10 h-10 text-primary" />
              </motion.div>

              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground">Preparing Mock Exam</h2>
                <p className="text-xs text-muted-foreground">Building your competitive challenge...</p>
              </div>

              <div className="space-y-3 max-w-[260px] mx-auto">
                {PREP_MESSAGES.map((msg, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: i <= prepIndex ? 1 : 0.2, x: 0 }}
                    transition={{ delay: i * 0.15, duration: 0.4 }}
                    className={`flex items-center gap-3 text-left ${i <= prepIndex ? 'text-foreground' : 'text-muted-foreground/40'}`}
                  >
                    {i < prepIndex ? (
                      <CheckCircle className="w-4 h-4 text-primary shrink-0" />
                    ) : i === prepIndex ? (
                      <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                    ) : (
                      <msg.icon className="w-4 h-4 shrink-0" />
                    )}
                    <span className="text-xs font-medium">{msg.text}</span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STAGE 2: AI BLUEPRINT
          ═══════════════════════════════════════ */}
          {step === "blueprint" && blueprint && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 mx-auto flex items-center justify-center">
                  <Target className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">Mock Exam Blueprint</h2>
                <p className="text-xs text-muted-foreground">AI-generated competitive challenge</p>
              </div>

              {/* Stats grid */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: BarChart3, label: "Questions", value: `${blueprint.totalQuestions}` },
                  { icon: Timer, label: "Time Limit", value: `${blueprint.timeLimit}m` },
                  { icon: Zap, label: "Difficulty", value: blueprint.difficulty.charAt(0).toUpperCase() + blueprint.difficulty.slice(1) },
                ].map((s, i) => (
                  <motion.div
                    key={s.label}
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.1 + i * 0.08 }}
                    className="rounded-xl border border-border bg-secondary/30 p-3 text-center"
                  >
                    <s.icon className="w-4 h-4 text-primary mx-auto mb-1" />
                    <p className="text-sm font-bold text-foreground">{s.value}</p>
                    <p className="text-[10px] text-muted-foreground">{s.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Topics */}
              <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Topics Selected</p>
                <div className="space-y-1.5">
                  {blueprint.topics.map((t, i) => (
                    <motion.div
                      key={t.name}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.2 + i * 0.06 }}
                      className="flex items-center justify-between"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 rounded-full bg-primary" />
                        <span className="text-xs font-medium text-foreground">{t.name}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{t.stability}% stable</span>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Expected percentile */}
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Crown className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Target: Top {100 - blueprint.expectedPercentile}%</p>
                  <p className="text-[10px] text-muted-foreground">Based on your current brain data</p>
                </div>
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleStartExam}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2.5"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                <Swords className="w-4 h-4" />
                Begin Mock Exam
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STAGE 3: IMMERSIVE EXAM
          ═══════════════════════════════════════ */}
          {step === "exam" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Timer + Progress */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground font-medium">
                    Q{currentQIndex + 1}/{blueprint?.totalQuestions}
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded-full ${
                    adaptiveDifficulty === "hard" ? "bg-destructive/15 text-destructive" :
                    adaptiveDifficulty === "medium" ? "bg-warning/15 text-warning" :
                    "bg-primary/15 text-primary"
                  }`}>
                    {adaptiveDifficulty}
                  </span>
                </div>
                <div className={`flex items-center gap-1.5 font-mono text-sm font-bold ${
                  examSecondsLeft < 60 ? "text-destructive" : examSecondsLeft < 180 ? "text-warning" : "text-foreground"
                }`}>
                  <Clock className="w-3.5 h-3.5" />
                  {examMM}:{examSS}
                </div>
              </div>

              {/* Question */}
              {currentQ ? (
                <motion.div
                  key={currentQIndex}
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ duration: 0.35 }}
                  className="space-y-4"
                >
                  <div className="text-xs text-muted-foreground">{currentQ.subject} · {currentQ.topic}</div>
                  <p className="text-sm font-semibold text-foreground leading-relaxed">{currentQ.question}</p>

                  <div className="space-y-2">
                    {currentQ.options.map((opt, i) => {
                      const isSelected = selectedAnswer === i;
                      const isCorrect = i === currentQ.correctIndex;
                      const showResult = selectedAnswer !== null;

                      let optionClass = "border-border bg-secondary/20 hover:bg-secondary/40";
                      if (showResult && isCorrect) optionClass = "border-primary bg-primary/10";
                      else if (showResult && isSelected && !isCorrect) optionClass = "border-destructive bg-destructive/10";

                      return (
                        <motion.button
                          key={i}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: i * 0.06 }}
                          onClick={() => handleAnswerSelect(i)}
                          disabled={selectedAnswer !== null}
                          className={`w-full p-3.5 rounded-xl border text-left transition-all ${optionClass}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className={`w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0 ${
                              showResult && isCorrect ? "bg-primary text-primary-foreground" :
                              showResult && isSelected && !isCorrect ? "bg-destructive text-destructive-foreground" :
                              "bg-secondary text-muted-foreground"
                            }`}>
                              {String.fromCharCode(65 + i)}
                            </span>
                            <span className="text-xs text-foreground leading-relaxed">{opt}</span>
                          </div>
                        </motion.button>
                      );
                    })}
                  </div>

                  {/* Explanation */}
                  {selectedAnswer !== null && (
                    <motion.div
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="rounded-xl border border-border bg-secondary/30 p-3">
                        <p className="text-[10px] font-semibold text-muted-foreground uppercase mb-1">Explanation</p>
                        <p className="text-xs text-foreground leading-relaxed">{currentQ.explanation}</p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={handleNextQuestion}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        {currentQIndex + 1 < (blueprint?.totalQuestions || 0) ? (
                          <>Next Question <ChevronRight className="w-4 h-4" /></>
                        ) : (
                          <>Finish Exam <Trophy className="w-4 h-4" /></>
                        )}
                      </motion.button>
                    </motion.div>
                  )}
                </motion.div>
              ) : (
                <div className="py-10 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 text-primary animate-spin" />
                </div>
              )}
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STAGE 4: SCORING ANIMATION
          ═══════════════════════════════════════ */}
          {step === "scoring" && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="text-center py-16 space-y-6"
            >
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-2xl bg-primary/15 mx-auto flex items-center justify-center"
              >
                <BarChart3 className="w-8 h-8 text-primary" />
              </motion.div>
              <div className="space-y-2">
                <h2 className="text-lg font-bold text-foreground">Calculating Results</h2>
                <p className="text-xs text-muted-foreground">Analyzing performance & computing rank...</p>
              </div>
              <div className="flex justify-center gap-1.5">
                {[0, 1, 2].map(i => (
                  <motion.div
                    key={i}
                    animate={{ scale: [1, 1.5, 1] }}
                    transition={{ duration: 0.6, repeat: Infinity, delay: i * 0.2 }}
                    className="w-2 h-2 rounded-full bg-primary"
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STAGE 5: RESULTS
          ═══════════════════════════════════════ */}
          {step === "results" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="text-center space-y-2">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", damping: 12 }}
                  className="w-16 h-16 rounded-2xl bg-primary/15 mx-auto flex items-center justify-center"
                >
                  <Trophy className="w-8 h-8 text-primary" />
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Mock Complete!</h2>
              </div>

              {/* Score ring */}
              <div className="flex justify-center">
                <div className="relative w-28 h-28">
                  <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                    <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                    <motion.circle
                      cx="50" cy="50" r="42" fill="none"
                      stroke="hsl(var(--primary))"
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={264}
                      initial={{ strokeDashoffset: 264 }}
                      animate={{ strokeDashoffset: 264 - (264 * finalScore / 100) }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: 0.5 }}
                      className="text-2xl font-bold text-foreground"
                    >
                      {finalScore}%
                    </motion.span>
                    <span className="text-[10px] text-muted-foreground">Score</span>
                  </div>
                </div>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                {[
                  { icon: Crown, label: "Percentile", value: `${finalPercentile}th`, color: finalPercentile > 80 ? "text-primary" : "text-warning" },
                  { icon: Timer, label: "Avg Speed", value: `${avgSpeed}s`, color: avgSpeed < 30 ? "text-primary" : "text-muted-foreground" },
                  { icon: Target, label: "Accuracy", value: `${results.filter(r => r.correct).length}/${results.length}`, color: "text-foreground" },
                ].map((stat, i) => (
                  <motion.div
                    key={stat.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.8 + i * 0.1 }}
                    className="rounded-xl border border-border bg-secondary/30 p-3 text-center"
                  >
                    <stat.icon className={`w-4 h-4 mx-auto mb-1 ${stat.color}`} />
                    <p className={`text-sm font-bold ${stat.color}`}>{stat.value}</p>
                    <p className="text-[10px] text-muted-foreground">{stat.label}</p>
                  </motion.div>
                ))}
              </div>

              {/* Rank impact */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 1.2 }}
                className="rounded-xl border border-primary/30 bg-primary/5 p-3 flex items-center gap-3"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <TrendingUp className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-foreground">Rank Probability Updated</p>
                  <p className="text-[10px] text-muted-foreground">
                    {finalPercentile > 75 ? "Strong competitive standing" : finalPercentile > 50 ? "Above average performance" : "Focus on weak topics to improve"}
                  </p>
                </div>
              </motion.div>

              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.5 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => setStep("summary")}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
              >
                View AI Analysis <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}

          {/* ═══════════════════════════════════════
              STAGE 6: AI PERFORMANCE SUMMARY
          ═══════════════════════════════════════ */}
          {step === "summary" && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              <div className="text-center space-y-2">
                <div className="w-14 h-14 rounded-2xl bg-primary/15 mx-auto flex items-center justify-center">
                  <Brain className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-lg font-bold text-foreground">AI Performance Analysis</h2>
              </div>

              {/* AI Summary */}
              <div className="rounded-xl border border-border bg-secondary/20 p-4 space-y-3">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-primary" />
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">AI Insight</span>
                </div>
                <p className="text-xs text-foreground leading-relaxed">{aiSummary}</p>
              </div>

              {/* Topic breakdown */}
              <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-2">
                <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Topic Performance</p>
                {(() => {
                  const topicMap = new Map<string, { correct: number; total: number }>();
                  results.forEach(r => {
                    const key = r.question.topic;
                    const existing = topicMap.get(key) || { correct: 0, total: 0 };
                    topicMap.set(key, { correct: existing.correct + (r.correct ? 1 : 0), total: existing.total + 1 });
                  });
                  return Array.from(topicMap.entries()).map(([topic, stats]) => {
                    const pct = Math.round((stats.correct / stats.total) * 100);
                    return (
                      <div key={topic} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-foreground font-medium">{topic}</span>
                          <span className={`text-[10px] font-bold ${pct >= 70 ? "text-primary" : pct >= 40 ? "text-warning" : "text-destructive"}`}>
                            {pct}%
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${pct}%` }}
                            transition={{ duration: 1, delay: 0.3 }}
                            className={`h-full rounded-full ${pct >= 70 ? "bg-primary" : pct >= 40 ? "bg-warning" : "bg-destructive"}`}
                          />
                        </div>
                      </div>
                    );
                  });
                })()}
              </div>

              {/* Performance tags */}
              <div className="flex flex-wrap gap-2">
                {finalScore >= 80 && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                    <Star className="w-3 h-3" /> High Performer
                  </span>
                )}
                {avgSpeed < 25 && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                    <Zap className="w-3 h-3" /> Speed Demon
                  </span>
                )}
                {finalPercentile > 85 && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                    <Crown className="w-3 h-3" /> Top 15%
                  </span>
                )}
                {results.length > 0 && results.every(r => r.correct) && (
                  <span className="text-[10px] font-semibold px-2.5 py-1 rounded-full bg-primary/15 text-primary flex items-center gap-1">
                    <Award className="w-3 h-3" /> Perfect Score
                  </span>
                )}
              </div>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
              >
                Done <CheckCircle className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default MockPracticeSession;
