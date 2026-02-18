import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, CheckCircle2, XCircle, Sparkles, Loader2, X, ChevronRight, TrendingUp, Zap
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";

interface RecallQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

interface SmartRecallOverlayProps {
  topicName?: string;
  subjectName?: string;
  onClose: () => void;
}

type Step = "loading" | "question" | "feedback" | "reward";

export default function SmartRecallOverlay({ topicName, subjectName, onClose }: SmartRecallOverlayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>("loading");
  const [questions, setQuestions] = useState<RecallQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [results, setResults] = useState<boolean[]>([]);
  const [resolvedTopic, setResolvedTopic] = useState(topicName || "");
  const [startTime] = useState(Date.now());

  // Fetch questions on mount
  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    (async () => {
      try {
        const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
          body: {
            action: "mission_questions",
            topic_name: topicName || undefined,
            subject_name: subjectName || undefined,
            difficulty: "medium",
            count: 2,
          },
        });
        if (cancelled) return;
        if (error) throw error;
        if (data?.questions?.length) {
          setQuestions(data.questions);
          // Use the topic from props or infer from question context
          if (!topicName && data.topic_name) setResolvedTopic(data.topic_name);
          setStep("question");
        } else {
          throw new Error("No questions");
        }
      } catch (e) {
        console.error("Smart recall question fetch failed:", e);
        if (!cancelled) {
          toast({ title: "Couldn't load recall", variant: "destructive" });
          onClose();
        }
      }
    })();

    return () => { cancelled = true; };
  }, [user, topicName, subjectName, toast, onClose]);

  const handleAnswer = (index: number) => {
    if (step !== "question") return;
    setSelectedAnswer(index);
    const isCorrect = index === questions[currentQ].correct_index;
    setResults(prev => [...prev, isCorrect]);
    triggerHaptic(isCorrect ? [20, 40] : [50]);
    setStep("feedback");
  };

  const handleNext = async () => {
    setSelectedAnswer(null);
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
      setStep("question");
    } else {
      // Done — show reward then auto-close
      setStep("reward");
      await logCompletion();
      // Auto-close after 2.5s
      setTimeout(() => onClose(), 2800);
    }
  };

  const logCompletion = async () => {
    if (!user) return;
    const correctCount = results.filter(r => r).length;
    const total = questions.length;
    const boost = Math.round(3 * (correctCount / Math.max(1, total)));

    try {
      await (supabase as any).from("study_logs").insert({
        user_id: user.id,
        duration_minutes: 1,
        study_mode: "smart_recall",
        confidence_level: String(Math.round((correctCount / total) * 100)),
      });

      if (resolvedTopic) {
        const { data: topic } = await (supabase as any)
          .from("topics")
          .select("id, memory_strength")
          .eq("user_id", user.id)
          .eq("name", resolvedTopic)
          .is("deleted_at", null)
          .maybeSingle();
        if (topic) {
          const newStrength = Math.min(100, Number(topic.memory_strength) + boost);
          await (supabase as any).from("topics").update({
            memory_strength: newStrength,
            last_revision_date: new Date().toISOString(),
          }).eq("id", topic.id);
        }
      }

      // Extend streak
      await (supabase as any).from("study_streaks").upsert({
        user_id: user.id,
        last_study_date: new Date().toISOString().slice(0, 10),
      }, { onConflict: "user_id" });
    } catch (e) {
      console.error("Log failed:", e);
    }

    // Confetti
    try {
      const { default: confetti } = await import("canvas-confetti");
      confetti({ particleCount: 60, spread: 55, origin: { y: 0.6 }, colors: ["hsl(175,80%,50%)", "#FFD700"] });
    } catch {}
  };

  const correctCount = results.filter(r => r).length;
  const total = questions.length || 2;
  const boost = Math.round(3 * (correctCount / Math.max(1, total)));
  const q = questions[currentQ];

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
    >
      {/* Minimal header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Brain className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Smart Recall</span>
          {resolvedTopic && (
            <span className="text-[10px] text-muted-foreground">· {resolvedTopic}</span>
          )}
        </div>
        {step !== "reward" && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Progress dots */}
      {questions.length > 0 && step !== "reward" && (
        <div className="flex items-center justify-center gap-2 py-2">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < currentQ ? (results[i] ? "bg-success" : "bg-destructive") :
                i === currentQ ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 flex items-center justify-center px-5">
        <AnimatePresence mode="wait">
          {/* Loading */}
          {step === "loading" && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin" />
              <p className="text-xs text-muted-foreground">Finding your weakest spot...</p>
            </motion.div>
          )}

          {/* Question */}
          {step === "question" && q && (
            <motion.div
              key={`q-${currentQ}`}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm"
            >
              <h3 className="text-sm font-semibold text-foreground leading-relaxed mb-5">
                {q.question}
              </h3>
              <div className="space-y-2">
                {q.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnswer(i)}
                    className="w-full text-left p-3 rounded-xl border border-border bg-card hover:border-primary/40 transition-all text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-5 h-5 rounded-full border border-border flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-foreground">{opt}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* Feedback */}
          {step === "feedback" && q && (
            <motion.div
              key={`fb-${currentQ}`}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="w-full max-w-sm"
            >
              <div className="text-center mb-4">
                {results[results.length - 1] ? (
                  <CheckCircle2 className="w-12 h-12 text-success mx-auto mb-2" />
                ) : (
                  <XCircle className="w-12 h-12 text-destructive mx-auto mb-2" />
                )}
                <p className="text-sm font-bold text-foreground">
                  {results[results.length - 1] ? "Correct! 🎯" : "Not quite 💡"}
                </p>
              </div>

              <div className={`p-3 rounded-xl border text-xs leading-relaxed mb-5 ${
                results[results.length - 1]
                  ? "bg-success/5 border-success/20"
                  : "bg-destructive/5 border-destructive/20"
              }`}>
                <div className="flex items-start gap-2">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-foreground/80">{q.explanation}</p>
                </div>
              </div>

              {/* Show correct answer if wrong */}
              {!results[results.length - 1] && (
                <p className="text-[11px] text-muted-foreground text-center mb-4">
                  Correct: <span className="font-semibold text-foreground">{q.options[q.correct_index]}</span>
                </p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleNext}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
              >
                {currentQ + 1 < questions.length ? (
                  <>Next <ChevronRight className="w-4 h-4" /></>
                ) : (
                  <>Done <Sparkles className="w-4 h-4" /></>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* Reward */}
          {step === "reward" && (
            <motion.div
              key="reward"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center max-w-xs"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-16 h-16 rounded-2xl bg-primary/15 flex items-center justify-center mb-4"
              >
                <Brain className="w-8 h-8 text-primary" />
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-base font-bold text-foreground mb-1"
              >
                {correctCount === total ? "Perfect! 🎉" : correctCount > 0 ? "Nice work! 💪" : "Keep going! 🌱"}
              </motion.h3>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.4 }}
                className="text-xs text-muted-foreground mb-4"
              >
                {correctCount}/{total} correct · {Math.max(1, Math.round((Date.now() - startTime) / 60000))} min
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-3"
              >
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/15">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary">+{boost}% memory</span>
                </div>
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-success/10 border border-success/15">
                  <Zap className="w-3.5 h-3.5 text-success" />
                  <span className="text-xs font-bold text-success">Streak ✓</span>
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                className="text-[10px] text-muted-foreground mt-4 italic"
              >
                Returning to dashboard...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}