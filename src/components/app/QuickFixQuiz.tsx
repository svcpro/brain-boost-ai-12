import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, X, Zap, Target, Clock, CheckCircle, XCircle,
  Sparkles, Loader2, Trophy, ArrowRight, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface QuickFixQuizProps {
  open: boolean;
  onClose: () => void;
  topicName: string;
  subjectName: string;
  retentionPct: number;
}

interface MCQ {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
}

type Phase = "analyzing" | "quiz" | "result";

const ANALYZE_MESSAGES = [
  { text: "Scanning topic memory...", icon: Brain },
  { text: "Identifying weak points...", icon: Target },
  { text: "Generating targeted questions...", icon: Sparkles },
  { text: "Calibrating difficulty...", icon: BarChart3 },
];

const QUIZ_DURATION = 180; // 3 minutes

export default function QuickFixQuiz({ open, onClose, topicName, subjectName, retentionPct }: QuickFixQuizProps) {
  const { user } = useAuth();
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();

  const [phase, setPhase] = useState<Phase>("analyzing");
  const [analyzeStep, setAnalyzeStep] = useState(0);
  const [questions, setQuestions] = useState<MCQ[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [showExplanation, setShowExplanation] = useState(false);
  const [score, setScore] = useState(0);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [timeLeft, setTimeLeft] = useState(QUIZ_DURATION);
  const [error, setError] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Reset state when opened
  useEffect(() => {
    if (open) {
      setPhase("analyzing");
      setAnalyzeStep(0);
      setQuestions([]);
      setCurrentQ(0);
      setSelected(null);
      setShowExplanation(false);
      setScore(0);
      setAnswers([]);
      setTimeLeft(QUIZ_DURATION);
      setError(null);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [open]);

  // Analyze animation
  useEffect(() => {
    if (phase !== "analyzing") return;
    const interval = setInterval(() => {
      setAnalyzeStep(prev => {
        if (prev < ANALYZE_MESSAGES.length - 1) return prev + 1;
        return prev;
      });
    }, 800);
    return () => clearInterval(interval);
  }, [phase]);

  // Fetch questions
  useEffect(() => {
    if (!open || phase !== "analyzing" || !user) return;
    let cancelled = false;

    const fetchQuestions = async () => {
      try {
        // Step 1: Init - analyze topic
        const { data: initData, error: initErr } = await supabase.functions.invoke("quick-fix", {
          body: { action: "init", topic_name: topicName, subject_name: subjectName, retention_pct: retentionPct },
        });
        if (cancelled) return;
        if (initErr) throw initErr;

        // Step 2: Questions - generate AI MCQs
        const config = initData?.data?.session_config || {};
        const { data: qData, error: qErr } = await supabase.functions.invoke("quick-fix", {
          body: {
            action: "questions",
            topic_name: topicName,
            subject_name: subjectName,
            retention_pct: retentionPct,
            count: config.question_count || 5,
            difficulty: config.difficulty,
          },
        });

        if (cancelled) return;
        if (qErr) throw qErr;

        const qs: MCQ[] = (qData?.data?.questions || []).map((q: any) => ({
          question: q.question,
          options: q.options || [],
          correct_index: typeof q.correct_index === "number" ? q.correct_index : 0,
          explanation: q.explanation || "",
        }));

        if (qs.length === 0) throw new Error("No questions generated");

        setQuestions(qs);
        setAnswers(new Array(qs.length).fill(null));
        setTimeout(() => { if (!cancelled) setPhase("quiz"); }, 600);
      } catch (e: any) {
        console.error("QuickFixQuiz fetch error:", e);
        if (!cancelled) setError(e?.message || "Failed to generate questions");
      }
    };

    fetchQuestions();
    return () => { cancelled = true; };
  }, [open, phase, user, topicName, subjectName, retentionPct]);

  // Timer
  useEffect(() => {
    if (phase !== "quiz") return;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          finishQuiz();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [phase]);

  const finishQuiz = useCallback(async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setPhase("result");

    // Determine confidence from score
    const finalScore = answers.filter((a, i) => a === questions[i]?.correct_index).length;
    setScore(finalScore);
    const pct = questions.length > 0 ? finalScore / questions.length : 0;
    const confidence: "low" | "medium" | "high" = pct >= 0.8 ? "high" : pct >= 0.5 ? "medium" : "low";

    // Log study & update memory
    try {
      await logStudy({
        subjectName,
        topicName,
        durationMinutes: 3,
        confidenceLevel: confidence,
        studyMode: "fix",
      });

      // Directly update memory_strength based on quiz performance
      if (user) {
        const strengthBoost = Math.round(pct * 30); // up to +30
        const { data: topicRow } = await supabase
          .from("topics")
          .select("id, memory_strength")
          .eq("user_id", user.id)
          .eq("name", topicName)
          .maybeSingle();

        if (topicRow) {
          const currentStrength = Number(topicRow.memory_strength) || 0;
          const newStrength = Math.min(100, currentStrength + strengthBoost);
          await supabase.from("topics").update({
            memory_strength: newStrength,
            last_revision_date: new Date().toISOString(),
          }).eq("id", topicRow.id);
        }
      }
    } catch (e) {
      console.error("QuickFixQuiz log error:", e);
    }

    // Confetti on good score
    if (pct >= 0.6) {
      confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 } });
    }
  }, [answers, questions, logStudy, subjectName, topicName, user]);

  const handleSelect = (optIndex: number) => {
    if (selected !== null) return;
    setSelected(optIndex);
    setShowExplanation(true);

    const newAnswers = [...answers];
    newAnswers[currentQ] = optIndex;
    setAnswers(newAnswers);

    if (optIndex === questions[currentQ].correct_index) {
      setScore(prev => prev + 1);
    }
  };

  const handleNext = () => {
    if (currentQ < questions.length - 1) {
      setCurrentQ(prev => prev + 1);
      setSelected(null);
      setShowExplanation(false);
    } else {
      finishQuiz();
    }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 bg-background/85 backdrop-blur-md flex items-end sm:items-center justify-center"
        onClick={(e) => { if (e.target === e.currentTarget && phase !== "quiz") onClose(); }}
      >
        <motion.div
          initial={{ y: 40, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 40, opacity: 0 }}
          className="w-full max-w-md max-h-[92vh] overflow-y-auto rounded-t-3xl sm:rounded-2xl border border-border bg-card shadow-2xl"
        >
          {/* Header */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-sm border-b border-border/50 px-5 py-3.5 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                <Zap className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="text-sm font-bold text-foreground">Quick Fix</p>
                <p className="text-[10px] text-muted-foreground truncate max-w-[180px]">{topicName}</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {phase === "quiz" && (
                <div className={`flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold ${timeLeft <= 30 ? "bg-destructive/15 text-destructive animate-pulse" : "bg-secondary text-foreground"}`}>
                  <Clock className="w-3 h-3" />
                  {formatTime(timeLeft)}
                </div>
              )}
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          <div className="p-5">
            {/* ═══ PHASE: ANALYZING ═══ */}
            {phase === "analyzing" && !error && (
              <div className="py-8 space-y-6">
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ repeat: Infinity, duration: 2, ease: "linear" }}
                  className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center"
                >
                  <Brain className="w-8 h-8 text-primary" />
                </motion.div>

                <div className="space-y-3">
                  {ANALYZE_MESSAGES.map((msg, i) => {
                    const Icon = msg.icon;
                    const isActive = i <= analyzeStep;
                    return (
                      <motion.div
                        key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: isActive ? 1 : 0.3, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="flex items-center gap-3"
                      >
                        <div className={`w-6 h-6 rounded-lg flex items-center justify-center ${isActive ? "bg-primary/15" : "bg-secondary/50"}`}>
                          {i < analyzeStep ? (
                            <CheckCircle className="w-3.5 h-3.5 text-primary" />
                          ) : i === analyzeStep ? (
                            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                          ) : (
                            <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                          )}
                        </div>
                        <span className={`text-xs ${isActive ? "text-foreground font-medium" : "text-muted-foreground"}`}>{msg.text}</span>
                      </motion.div>
                    );
                  })}
                </div>

                <div className="text-center">
                  <p className="text-[10px] text-muted-foreground">
                    Preparing 5 targeted questions • 3 min session
                  </p>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="py-8 text-center space-y-3">
                <XCircle className="w-10 h-10 text-destructive mx-auto" />
                <p className="text-sm text-foreground font-medium">Failed to load quiz</p>
                <p className="text-xs text-muted-foreground">{error}</p>
                <button
                  onClick={() => { setError(null); setPhase("analyzing"); setAnalyzeStep(0); }}
                  className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                >
                  Retry
                </button>
              </div>
            )}

            {/* ═══ PHASE: QUIZ ═══ */}
            {phase === "quiz" && questions.length > 0 && (
              <div className="space-y-5">
                {/* Progress */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: 0 }}
                      animate={{ width: `${((currentQ + (selected !== null ? 1 : 0)) / questions.length) * 100}%` }}
                    />
                  </div>
                  <span className="text-[10px] text-muted-foreground font-medium">{currentQ + 1}/{questions.length}</span>
                </div>

                {/* Question */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQ}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -20 }}
                    className="space-y-4"
                  >
                    <p className="text-sm font-semibold text-foreground leading-relaxed">
                      {questions[currentQ].question}
                    </p>

                    <div className="space-y-2">
                      {questions[currentQ].options.map((opt, i) => {
                        const isCorrect = i === questions[currentQ].correct_index;
                        const isSelected = selected === i;
                        let optStyle = "bg-secondary/40 border-border/50 hover:border-primary/30 hover:bg-secondary/60";
                        if (showExplanation) {
                          if (isCorrect) optStyle = "bg-chart-2/10 border-chart-2/40";
                          else if (isSelected && !isCorrect) optStyle = "bg-destructive/10 border-destructive/40";
                          else optStyle = "bg-secondary/20 border-border/30 opacity-50";
                        }

                        return (
                          <motion.button
                            key={i}
                            whileTap={!showExplanation ? { scale: 0.98 } : undefined}
                            onClick={() => handleSelect(i)}
                            disabled={showExplanation}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl border text-left transition-all ${optStyle}`}
                          >
                            <div className={`w-6 h-6 rounded-lg flex items-center justify-center shrink-0 text-[10px] font-bold ${
                              showExplanation && isCorrect ? "bg-chart-2/20 text-chart-2" :
                              showExplanation && isSelected && !isCorrect ? "bg-destructive/20 text-destructive" :
                              "bg-secondary text-muted-foreground"
                            }`}>
                              {showExplanation && isCorrect ? <CheckCircle className="w-3.5 h-3.5" /> :
                               showExplanation && isSelected && !isCorrect ? <XCircle className="w-3.5 h-3.5" /> :
                               String.fromCharCode(65 + i)}
                            </div>
                            <span className="text-xs text-foreground flex-1">{opt}</span>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Explanation */}
                    {showExplanation && (
                      <motion.div
                        initial={{ opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-3"
                      >
                        <div className="px-3 py-2.5 rounded-xl bg-primary/5 border border-primary/10">
                          <p className="text-[10px] text-muted-foreground font-medium mb-0.5">Explanation</p>
                          <p className="text-xs text-foreground leading-relaxed">{questions[currentQ].explanation}</p>
                        </div>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleNext}
                          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                        >
                          {currentQ < questions.length - 1 ? (
                            <>Next <ArrowRight className="w-4 h-4" /></>
                          ) : (
                            <>Finish Quiz <Trophy className="w-4 h-4" /></>
                          )}
                        </motion.button>
                      </motion.div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>
            )}

            {/* ═══ PHASE: RESULT ═══ */}
            {phase === "result" && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-6 space-y-5"
              >
                {/* Score circle */}
                <div className="text-center space-y-2">
                  <div className="w-20 h-20 mx-auto rounded-full flex items-center justify-center"
                    style={{
                      background: `conic-gradient(hsl(var(--primary)) ${(score / Math.max(questions.length, 1)) * 360}deg, hsl(var(--secondary)) 0deg)`,
                    }}
                  >
                    <div className="w-16 h-16 rounded-full bg-card flex items-center justify-center">
                      <span className="text-xl font-black text-foreground">{score}/{questions.length}</span>
                    </div>
                  </div>
                  <div>
                    <p className="text-base font-bold text-foreground">
                      {score === questions.length ? "Perfect! 🎉" :
                       score >= questions.length * 0.6 ? "Great job! 💪" :
                       "Keep practicing! 📚"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{topicName} • {subjectName}</p>
                  </div>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-3 gap-2">
                  <div className="text-center p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <p className="text-lg font-bold text-foreground">{Math.round((score / Math.max(questions.length, 1)) * 100)}%</p>
                    <p className="text-[9px] text-muted-foreground">Accuracy</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <p className="text-lg font-bold text-chart-2">+{Math.round((score / Math.max(questions.length, 1)) * 30)}</p>
                    <p className="text-[9px] text-muted-foreground">Memory Boost</p>
                  </div>
                  <div className="text-center p-3 rounded-xl bg-secondary/30 border border-border/30">
                    <p className="text-lg font-bold text-primary">3m</p>
                    <p className="text-[9px] text-muted-foreground">Session</p>
                  </div>
                </div>

                {/* Memory update indicator */}
                <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-chart-2/10 border border-chart-2/20">
                  <CheckCircle className="w-4 h-4 text-chart-2" />
                  <div>
                    <p className="text-xs font-semibold text-foreground">Memory Updated</p>
                    <p className="text-[10px] text-muted-foreground">Retention & rank recalculated</p>
                  </div>
                </div>

                {/* Close */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={onClose}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors"
                >
                  Done
                </motion.button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
