import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  X, Brain, CheckCircle2, Loader2, ArrowRight,
  Sparkles, Trophy, Zap, Clock
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";

type Stage = "intro" | "questions" | "feedback" | "reward";

interface Question {
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

interface Props {
  task: {
    id: string;
    title: string;
    description: string | null;
    estimatedMinutes: number;
    impactLevel: "high" | "medium" | "low";
    topic_id: string | null;
  };
  open: boolean;
  onClose: () => void;
  onComplete: (taskId: string) => void;
}

const FALLBACK_QUESTIONS: Question[] = [
  {
    question: "Which study method is most effective for long-term retention?",
    options: ["Cramming", "Spaced repetition", "Highlighting", "Re-reading"],
    correctIndex: 1,
    explanation: "Spaced repetition strengthens neural pathways over time, leading to durable memory.",
  },
  {
    question: "What is the optimal study session length for focused learning?",
    options: ["10 minutes", "25-30 minutes", "2 hours", "4 hours"],
    correctIndex: 1,
    explanation: "25-30 minute sessions align with natural attention cycles and prevent fatigue.",
  },
  {
    question: "Active recall is more effective than passive review because it:",
    options: ["Is faster", "Requires less effort", "Strengthens retrieval pathways", "Feels easier"],
    correctIndex: 2,
    explanation: "Active recall forces your brain to retrieve information, strengthening the memory trace.",
  },
];

const ActiveTaskMiniSession = ({ task, open, onClose, onComplete }: Props) => {
  const { user } = useAuth();
  const [stage, setStage] = useState<Stage>("intro");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [loadingQuestions, setLoadingQuestions] = useState(false);
  const [answered, setAnswered] = useState(false);
  const [timer, setTimer] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Start timer on questions stage
  useEffect(() => {
    if (stage === "questions") {
      timerRef.current = setInterval(() => setTimer((t) => t + 1), 1000);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [stage]);

  const generateQuestions = async () => {
    setLoadingQuestions(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          type: "task_micro_session",
          userId: user?.id,
          taskTitle: task.title,
          taskDescription: task.description,
          topicId: task.topic_id,
          questionCount: 3,
        },
      });

      if (!error && data?.questions && Array.isArray(data.questions) && data.questions.length > 0) {
        const parsed = data.questions.map((q: any) => ({
          question: q.question || "Practice question",
          options: Array.isArray(q.options) && q.options.length >= 2 ? q.options : FALLBACK_QUESTIONS[0].options,
          correctIndex: typeof q.correctIndex === "number" ? q.correctIndex : 0,
          explanation: q.explanation || "Great job working through this!",
        }));
        setQuestions(parsed.slice(0, 3));
      } else {
        setQuestions(FALLBACK_QUESTIONS);
      }
    } catch {
      setQuestions(FALLBACK_QUESTIONS);
    }
    setLoadingQuestions(false);
    setStage("questions");
  };

  const handleAnswer = (idx: number) => {
    if (answered) return;
    setSelectedAnswer(idx);
    setAnswered(true);
    if (idx === questions[currentQ].correctIndex) {
      setScore((s) => s + 1);
    }
  };

  const nextQuestion = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ((q) => q + 1);
      setSelectedAnswer(null);
      setAnswered(false);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
      setStage("feedback");
    }
  };

  const finishSession = () => {
    confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, colors: ["#2dd4bf", "#fbbf24", "#a855f7"] });
    setStage("reward");
    setTimeout(() => {
      onComplete(task.id);
    }, 2000);
  };

  if (!open) return null;

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const accuracy = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/95 backdrop-blur-xl flex flex-col"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-foreground">Micro Task</span>
          </div>
          <div className="flex items-center gap-3">
            {stage === "questions" && (
              <span className="flex items-center gap-1 text-[11px] text-muted-foreground font-mono tabular-nums">
                <Clock className="w-3 h-3" />
                {formatTime(timer)}
              </span>
            )}
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-5 h-5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-6 max-w-lg mx-auto w-full">
          <AnimatePresence mode="wait">
            {/* ── INTRO ── */}
            {stage === "intro" && (
              <motion.div
                key="intro"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center space-y-5 pt-8"
              >
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center"
                >
                  <Zap className="w-10 h-10 text-primary" />
                </motion.div>

                <div className="space-y-2">
                  <h2 className="text-xl font-bold text-foreground">{task.title}</h2>
                  {task.description && (
                    <p className="text-sm text-muted-foreground leading-relaxed">{task.description}</p>
                  )}
                </div>

                <div className="flex items-center gap-4 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5" />
                    ~{task.estimatedMinutes} min
                  </span>
                  <span className="flex items-center gap-1">
                    <Brain className="w-3.5 h-3.5" />
                    3 questions
                  </span>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={generateQuestions}
                  disabled={loadingQuestions}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2.5 disabled:opacity-60"
                  style={{ boxShadow: "0 6px 24px hsl(var(--primary) / 0.3)" }}
                >
                  {loadingQuestions ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      AI is preparing...
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      Begin Task
                    </>
                  )}
                </motion.button>
              </motion.div>
            )}

            {/* ── QUESTIONS ── */}
            {stage === "questions" && questions.length > 0 && (
              <motion.div
                key={`q-${currentQ}`}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                className="space-y-5"
              >
                {/* Progress dots */}
                <div className="flex items-center gap-2 justify-center">
                  {questions.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-300 ${
                        i === currentQ ? "w-8 bg-primary" : i < currentQ ? "w-4 bg-primary/50" : "w-4 bg-secondary"
                      }`}
                    />
                  ))}
                </div>

                <p className="text-[11px] text-muted-foreground text-center">
                  Question {currentQ + 1} of {questions.length}
                </p>

                <h3 className="text-base font-semibold text-foreground leading-snug text-center">
                  {questions[currentQ].question}
                </h3>

                <div className="space-y-2.5">
                  {questions[currentQ].options.map((opt, idx) => {
                    const isCorrect = idx === questions[currentQ].correctIndex;
                    const isSelected = idx === selectedAnswer;
                    let optionStyle = "border-border bg-card hover:bg-secondary/40";
                    if (answered) {
                      if (isCorrect) optionStyle = "border-success bg-success/10";
                      else if (isSelected && !isCorrect) optionStyle = "border-destructive bg-destructive/10";
                    }

                    return (
                      <motion.button
                        key={idx}
                        whileTap={!answered ? { scale: 0.98 } : {}}
                        onClick={() => handleAnswer(idx)}
                        disabled={answered}
                        className={`w-full p-4 rounded-xl border-2 text-left transition-all duration-200 ${optionStyle}`}
                      >
                        <div className="flex items-center gap-3">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold shrink-0 ${
                            answered && isCorrect
                              ? "bg-success text-success-foreground"
                              : answered && isSelected && !isCorrect
                              ? "bg-destructive text-destructive-foreground"
                              : "bg-secondary text-muted-foreground"
                          }`}>
                            {String.fromCharCode(65 + idx)}
                          </div>
                          <span className="text-sm text-foreground">{opt}</span>
                          {answered && isCorrect && (
                            <CheckCircle2 className="w-5 h-5 text-success ml-auto shrink-0" />
                          )}
                        </div>
                      </motion.button>
                    );
                  })}
                </div>

                {/* Explanation + Next */}
                <AnimatePresence>
                  {answered && (
                    <motion.div
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      className="space-y-3"
                    >
                      <div className="rounded-xl bg-secondary/50 border border-border p-3.5">
                        <p className="text-[11px] text-muted-foreground leading-relaxed">
                          <span className="font-semibold text-foreground">💡 </span>
                          {questions[currentQ].explanation}
                        </p>
                      </div>

                      <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={nextQuestion}
                        className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2"
                      >
                        {currentQ < questions.length - 1 ? (
                          <>
                            Next Question
                            <ArrowRight className="w-4 h-4" />
                          </>
                        ) : (
                          <>
                            See Results
                            <Sparkles className="w-4 h-4" />
                          </>
                        )}
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )}

            {/* ── FEEDBACK ── */}
            {stage === "feedback" && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                className="flex flex-col items-center text-center space-y-5 pt-6"
              >
                <div className="w-20 h-20 rounded-full bg-primary/15 flex items-center justify-center">
                  <Trophy className="w-10 h-10 text-primary" />
                </div>

                <div className="space-y-1">
                  <h2 className="text-2xl font-bold text-foreground">{accuracy}% Accuracy</h2>
                  <p className="text-sm text-muted-foreground">
                    {score}/{questions.length} correct · {formatTime(timer)}
                  </p>
                </div>

                {/* Score breakdown */}
                <div className="grid grid-cols-3 gap-3 w-full">
                  {[
                    { label: "Correct", value: score, color: "text-success" },
                    { label: "Wrong", value: questions.length - score, color: "text-destructive" },
                    { label: "Time", value: formatTime(timer), color: "text-primary" },
                  ].map((s) => (
                    <div key={s.label} className="rounded-xl border border-border bg-card p-3">
                      <p className={`text-lg font-bold ${s.color} tabular-nums`}>{s.value}</p>
                      <p className="text-[10px] text-muted-foreground">{s.label}</p>
                    </div>
                  ))}
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={finishSession}
                  className="w-full py-4 rounded-xl bg-primary text-primary-foreground font-bold text-base flex items-center justify-center gap-2.5"
                  style={{ boxShadow: "0 6px 24px hsl(var(--primary) / 0.3)" }}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  Complete Task
                </motion.button>
              </motion.div>
            )}

            {/* ── REWARD ── */}
            {stage === "reward" && (
              <motion.div
                key="reward"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="flex flex-col items-center text-center space-y-4 pt-12"
              >
                <motion.div
                  animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.2, 1] }}
                  transition={{ duration: 0.6 }}
                  className="text-6xl"
                >
                  🎯
                </motion.div>
                <h2 className="text-xl font-bold text-foreground">Task Crushed!</h2>
                <p className="text-sm text-muted-foreground">+1 Execution Point · Brain updated</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default ActiveTaskMiniSession;
