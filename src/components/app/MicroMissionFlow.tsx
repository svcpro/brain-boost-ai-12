import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, Zap, ArrowRight, CheckCircle2, XCircle,
  TrendingUp, Sparkles, X, Target, ChevronRight
} from "lucide-react";
import AIProgressBar from "./AIProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";

interface MissionQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

interface MicroMissionFlowProps {
  missionTitle: string;
  topicName?: string;
  subjectName?: string;
  estimatedMinutes: number;
  brainImprovementPct: number;
  onComplete: () => void;
  onClose: () => void;
}

type FlowStep = "intro" | "questions" | "reward";

export default function MicroMissionFlow({
  missionTitle,
  topicName,
  subjectName,
  estimatedMinutes,
  brainImprovementPct,
  onComplete,
  onClose,
}: MicroMissionFlowProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<FlowStep>("intro");
  const [questions, setQuestions] = useState<MissionQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [startTime] = useState(Date.now());

  // Adaptive difficulty: if user gets 2 wrong in a row, simplify
  const consecutiveWrong = results.slice(-2).filter(r => !r).length;

  const fetchQuestions = useCallback(async (diff: "easy" | "medium" | "hard") => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "mission_questions",
          topic_name: topicName,
          subject_name: subjectName,
          difficulty: diff,
          count: 4,
        },
      });
      if (error) throw error;
      if (data?.questions?.length) {
        setQuestions(data.questions);
      } else {
        throw new Error("No questions returned");
      }
    } catch (e: any) {
      console.error("Failed to generate questions:", e);
      toast({ title: "Couldn't generate questions", description: "Please try again.", variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  }, [user, topicName, subjectName, toast, onClose]);

  const handleStartMission = () => {
    triggerHaptic(30);
    setStep("questions");
    fetchQuestions(difficulty);
  };

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    const isCorrect = index === questions[currentQ].correct_index;
    const newResults = [...results, isCorrect];
    setResults(newResults);
    triggerHaptic(isCorrect ? [20, 40] : [50]);

    // Adaptive difficulty adjustment
    const recentWrong = newResults.slice(-2).filter(r => !r).length;
    if (recentWrong >= 2 && difficulty !== "easy") {
      setDifficulty("easy");
    } else if (newResults.slice(-2).every(r => r) && difficulty !== "hard") {
      setDifficulty("hard");
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      setStep("reward");
      handleMissionComplete();
    }
  };

  const handleMissionComplete = async () => {
    triggerHaptic([30, 60, 30, 80]);
    const timeUsedSec = Math.round((Date.now() - startTime) / 1000);
    const correctCount = results.filter(r => r).length;

    // Log study session
    try {
      if (user) {
        await (supabase as any).from("study_logs").insert({
          user_id: user.id,
          duration_minutes: Math.max(1, Math.round(timeUsedSec / 60)),
          study_mode: "mission",
          confidence_level: String(Math.round((correctCount / results.length) * 100)),
        });

        // Update topic memory strength if topic exists
        if (topicName) {
          const boost = Math.round(brainImprovementPct * (correctCount / results.length));
          const { data: topic } = await (supabase as any)
            .from("topics")
            .select("id, memory_strength")
            .eq("user_id", user.id)
            .eq("name", topicName)
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

        // Update streak
        await (supabase as any).from("study_streaks").upsert({
          user_id: user.id,
          last_study_date: new Date().toISOString().slice(0, 10),
        }, { onConflict: "user_id" });
      }
    } catch (e) {
      console.error("Failed to log mission:", e);
    }

    // Confetti
    try {
      const { default: confetti } = await import("canvas-confetti");
      confetti({
        particleCount: 120,
        spread: 80,
        origin: { y: 0.5 },
        colors: ["hsl(175,80%,50%)", "#FFD700", "#4ECDC4", "#FF6B6B"],
      });
    } catch {}

    onComplete();
  };

  const correctCount = results.filter(r => r).length;
  const totalQ = questions.length || 4;
  const scorePercent = totalQ > 0 ? Math.round((correctCount / totalQ) * 100) : 0;
  const brainBoost = Math.round(brainImprovementPct * (correctCount / Math.max(1, totalQ)));

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">Mission</span>
        </div>
        {step !== "reward" && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Progress bar */}
      {step === "questions" && questions.length > 0 && (
        <div className="h-1 bg-secondary">
          <motion.div
            className="h-full bg-primary"
            initial={{ width: 0 }}
            animate={{ width: `${((currentQ + (showFeedback ? 1 : 0)) / totalQ) * 100}%` }}
            transition={{ duration: 0.3 }}
          />
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <AnimatePresence mode="wait">
          {/* ─── STEP 1: INTRO ─── */}
          {step === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center max-w-sm mx-auto pt-10"
            >
              <motion.div
                animate={{ scale: [1, 1.1, 1], rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity, repeatDelay: 2 }}
                className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-6"
              >
                <Brain className="w-10 h-10 text-primary" />
              </motion.div>

              <h2 className="text-lg font-bold text-foreground mb-2">{missionTitle}</h2>
              {topicName && (
                <p className="text-xs text-muted-foreground mb-1">
                  {subjectName ? `${subjectName} → ` : ""}{topicName}
                </p>
              )}

              <div className="flex items-center gap-4 mt-4 mb-6">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  ~{estimatedMinutes} min
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{brainImprovementPct}% brain
                </div>
              </div>

              <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
                Answer {totalQ} quick recall questions. Your brain stability will update instantly after completion.
              </p>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStartMission}
                className="w-full max-w-xs py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                <Zap className="w-4 h-4" />
                Begin Mission
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}

          {/* ─── STEP 2 & 3: QUESTIONS + FEEDBACK ─── */}
          {step === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-sm mx-auto"
            >
              {loading ? (
                <div className="py-12 px-4">
                  <AIProgressBar
                    label="AI is crafting your questions"
                    sublabel={difficulty !== "medium" ? `Adapting difficulty: ${difficulty}` : "Personalizing to your level"}
                    estimatedSeconds={8}
                  />
                </div>
              ) : questions.length > 0 ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={currentQ}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                  >
                    {/* Question counter */}
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Question {currentQ + 1} of {totalQ}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                        difficulty === "easy" ? "bg-success/15 text-success" :
                        difficulty === "hard" ? "bg-warning/15 text-warning" :
                        "bg-secondary text-muted-foreground"
                      }`}>
                        {difficulty}
                      </span>
                    </div>

                    {/* Question text */}
                    <h3 className="text-sm font-semibold text-foreground leading-relaxed mb-5">
                      {questions[currentQ].question}
                    </h3>

                    {/* Options */}
                    <div className="space-y-2.5">
                      {questions[currentQ].options.map((opt, i) => {
                        const isCorrect = i === questions[currentQ].correct_index;
                        const isSelected = selectedAnswer === i;
                        let optStyle = "border-border bg-card hover:border-primary/40";
                        if (showFeedback) {
                          if (isCorrect) optStyle = "border-success bg-success/10";
                          else if (isSelected && !isCorrect) optStyle = "border-destructive bg-destructive/10";
                          else optStyle = "border-border bg-card opacity-50";
                        }

                        return (
                          <motion.button
                            key={i}
                            whileTap={!showFeedback ? { scale: 0.98 } : undefined}
                            onClick={() => handleAnswer(i)}
                            disabled={showFeedback}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all text-sm ${optStyle}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="flex-1 text-foreground">{opt}</span>
                              {showFeedback && isCorrect && (
                                <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
                              )}
                              {showFeedback && isSelected && !isCorrect && (
                                <XCircle className="w-5 h-5 text-destructive shrink-0" />
                              )}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    {/* Feedback explanation */}
                    <AnimatePresence>
                      {showFeedback && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="mt-4"
                        >
                          <div className={`p-3 rounded-xl border text-xs leading-relaxed ${
                            results[results.length - 1]
                              ? "bg-success/5 border-success/20 text-success"
                              : "bg-destructive/5 border-destructive/20 text-destructive"
                          }`}>
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold mb-1">
                                  {results[results.length - 1] ? "Correct! 🎯" : "Not quite 💡"}
                                </p>
                                <p className="text-foreground/80">
                                  {questions[currentQ].explanation}
                                </p>
                              </div>
                            </div>
                          </div>

                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleNext}
                            className="w-full mt-3 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
                          >
                            {currentQ + 1 < questions.length ? (
                              <>Next <ChevronRight className="w-4 h-4" /></>
                            ) : (
                              <>See Results <Sparkles className="w-4 h-4" /></>
                            )}
                          </motion.button>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                </AnimatePresence>
              ) : null}
            </motion.div>
          )}

          {/* ─── STEP 4: REWARD ─── */}
          {step === "reward" && (
            <motion.div
              key="reward"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center max-w-sm mx-auto pt-8"
            >
              {/* Animated brain boost circle */}
              <motion.div className="relative w-28 h-28 mb-6">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-secondary" />
                  <motion.circle
                    cx="50" cy="50" r="44" fill="none" strokeWidth="6"
                    strokeLinecap="round"
                    className="stroke-primary"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - scorePercent / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-2xl font-bold text-foreground"
                  >
                    {correctCount}/{totalQ}
                  </motion.span>
                  <span className="text-[10px] text-muted-foreground">correct</span>
                </div>
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-lg font-bold text-foreground mb-1"
              >
                {scorePercent >= 75 ? "Excellent! 🎉" : scorePercent >= 50 ? "Good job! 💪" : "Keep going! 🌱"}
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-xs text-muted-foreground mb-5"
              >
                Mission complete in {Math.max(1, Math.round((Date.now() - startTime) / 60000))} min
              </motion.p>

              {/* Brain improvement animation */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="w-full space-y-2 mb-6"
              >
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <div className="flex items-center gap-2">
                    <Brain className="w-4 h-4 text-primary" />
                    <span className="text-xs text-foreground font-medium">Brain Stability</span>
                  </div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1 }}
                    className="text-xs font-bold text-primary"
                  >
                    +{brainBoost}% ↑
                  </motion.span>
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl bg-success/5 border border-success/15">
                  <div className="flex items-center gap-2">
                    <Zap className="w-4 h-4 text-success" />
                    <span className="text-xs text-foreground font-medium">Streak Extended</span>
                  </div>
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 1.2 }}
                    className="text-xs font-bold text-success"
                  >
                    ✓
                  </motion.span>
                </div>
              </motion.div>

              {/* Positive reinforcement */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.4 }}
                className="px-4 py-2.5 rounded-xl bg-secondary/50 border border-border/50 mb-6"
              >
                <p className="text-[11px] text-muted-foreground italic leading-relaxed">
                  {scorePercent >= 75
                    ? "Your memory is getting stronger. Consistency is building real neural pathways."
                    : "Every attempt strengthens your brain. Tomorrow will be easier."}
                </p>
              </motion.div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1.6 }}
                onClick={onClose}
                className="w-full max-w-xs py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all"
              >
                Done
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}