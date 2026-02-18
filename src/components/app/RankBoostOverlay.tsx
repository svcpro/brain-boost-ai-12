import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Clock, Zap, CheckCircle2, XCircle, Sparkles, Loader2, X,
  TrendingUp, ArrowRight, ChevronUp, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";

interface RankBoostQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  topic_name: string;
  rank_weight: string;
}

interface RankBoostOverlayProps {
  onClose: () => void;
}

type Phase = "intro" | "question" | "result";

export default function RankBoostOverlay({ onClose }: RankBoostOverlayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [phase, setPhase] = useState<Phase>("intro");
  const [question, setQuestion] = useState<RankBoostQuestion | null>(null);
  const [loading, setLoading] = useState(false);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [isCorrect, setIsCorrect] = useState<boolean | null>(null);
  const [timer, setTimer] = useState(60);
  const [timerActive, setTimerActive] = useState(false);
  const [rankDelta, setRankDelta] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(Date.now());

  // Countdown timer
  useEffect(() => {
    if (!timerActive) return;
    timerRef.current = setInterval(() => {
      setTimer(prev => {
        if (prev <= 1) {
          // Time's up — auto-submit wrong
          clearInterval(timerRef.current!);
          setTimerActive(false);
          handleTimeout();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive]);

  const handleTimeout = () => {
    if (selectedAnswer !== null) return; // already answered
    setIsCorrect(false);
    setSelectedAnswer(-1);
    setRankDelta(0);
    triggerHaptic([50]);
    setPhase("result");
    logResult(false, 60);
  };

  const fetchQuestion = async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "mission_questions",
          difficulty: "hard",
          count: 1,
        },
      });
      if (error) throw error;
      const q = data?.questions?.[0];
      if (!q) throw new Error("No question");
      setQuestion({
        ...q,
        topic_name: q.topic_name || "High-weight topic",
        rank_weight: q.rank_weight || "High",
      });
      setPhase("question");
      setTimerActive(true);
      startTimeRef.current = Date.now();
    } catch (e) {
      console.error("Rank boost question failed:", e);
      toast({ title: "Couldn't load challenge", variant: "destructive" });
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleAnswer = (index: number) => {
    if (selectedAnswer !== null) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setTimerActive(false);

    const correct = index === question!.correct_index;
    setSelectedAnswer(index);
    setIsCorrect(correct);
    triggerHaptic(correct ? [20, 40, 20, 60] : [50]);

    // Calculate rank delta based on speed + correctness
    const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
    const speedBonus = Math.max(0, Math.round((60 - elapsed) / 20)); // 0-3
    const delta = correct ? 1 + speedBonus : 0;
    setRankDelta(delta);

    setPhase("result");
    logResult(correct, elapsed);

    if (correct) {
      try {
        import("canvas-confetti").then(({ default: confetti }) => {
          confetti({ particleCount: 80, spread: 60, origin: { y: 0.5 }, colors: ["#FFD700", "#FF6B6B", "hsl(175,80%,50%)"] });
        });
      } catch {}
    }
  };

  const logResult = async (correct: boolean, elapsed: number) => {
    if (!user) return;
    try {
      await (supabase as any).from("study_logs").insert({
        user_id: user.id,
        duration_minutes: 1,
        study_mode: "rank_boost",
        confidence_level: correct ? "100" : "0",
      });

      // Update rank prediction slightly
      if (correct) {
        const { data: rank } = await (supabase as any)
          .from("rank_predictions")
          .select("id, predicted_rank, percentile")
          .eq("user_id", user.id)
          .order("recorded_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        if (rank) {
          const speedBonus = Math.max(0, Math.round((60 - elapsed) / 20));
          const newRank = Math.max(1, rank.predicted_rank - (1 + speedBonus));
          const newPercentile = Math.min(100, (rank.percentile || 50) + 0.5 + speedBonus * 0.3);
          await (supabase as any).from("rank_predictions").insert({
            user_id: user.id,
            predicted_rank: newRank,
            percentile: Math.round(newPercentile * 10) / 10,
            recorded_at: new Date().toISOString(),
          });
        }
      }

      // Extend streak
      await (supabase as any).from("study_streaks").upsert({
        user_id: user.id,
        last_study_date: new Date().toISOString().slice(0, 10),
      }, { onConflict: "user_id" });
    } catch (e) {
      console.error("Rank boost log failed:", e);
    }
  };

  const timerPercent = (timer / 60) * 100;
  const timerColor = timer > 30 ? "text-primary" : timer > 10 ? "text-warning" : "text-destructive";
  const timerBg = timer > 30 ? "stroke-primary" : timer > 10 ? "stroke-warning" : "stroke-destructive";

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
          <Trophy className="w-4 h-4 text-accent" />
          <span className="text-xs font-semibold text-foreground">Rank Boost</span>
        </div>
        {phase !== "result" && (
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        )}
      </div>

      <div className="flex-1 flex items-center justify-center px-5">
        <AnimatePresence mode="wait">
          {/* ─── INTRO ─── */}
          {phase === "intro" && (
            <motion.div
              key="intro"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center max-w-xs"
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 1 }}
                className="w-20 h-20 rounded-2xl bg-accent/15 flex items-center justify-center mb-5"
              >
                <Trophy className="w-10 h-10 text-accent" />
              </motion.div>

              <h2 className="text-lg font-bold text-foreground mb-2">Competitive Challenge</h2>
              <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                1 exam-level question. 60 seconds. Answer fast for bonus rank points.
              </p>

              <div className="flex items-center gap-3 mb-6">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full">
                  <Clock className="w-3.5 h-3.5" />
                  60s limit
                </div>
                <div className="flex items-center gap-1.5 text-xs text-accent bg-accent/10 px-3 py-1.5 rounded-full font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +1–4 rank
                </div>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={fetchQuestion}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-accent text-accent-foreground text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all disabled:opacity-60"
                style={{ boxShadow: "0 4px 20px hsl(var(--accent) / 0.3)" }}
              >
                {loading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <>
                    <Zap className="w-4 h-4" />
                    Accept Challenge
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </motion.button>
            </motion.div>
          )}

          {/* ─── QUESTION + TIMER ─── */}
          {phase === "question" && question && (
            <motion.div
              key="question"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full max-w-sm"
            >
              {/* Timer ring */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-[10px] text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full">
                  {question.topic_name}
                </span>
                <div className="flex items-center gap-2">
                  <div className="relative w-9 h-9">
                    <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
                      <circle cx="18" cy="18" r="15" fill="none" strokeWidth="3" className="stroke-secondary" />
                      <motion.circle
                        cx="18" cy="18" r="15" fill="none" strokeWidth="3" strokeLinecap="round"
                        className={timerBg}
                        strokeDasharray={`${2 * Math.PI * 15}`}
                        animate={{ strokeDashoffset: 2 * Math.PI * 15 * (1 - timerPercent / 100) }}
                        transition={{ duration: 0.5 }}
                      />
                    </svg>
                    <span className={`absolute inset-0 flex items-center justify-center text-[10px] font-bold ${timerColor}`}>
                      {timer}
                    </span>
                  </div>
                </div>
              </div>

              {/* Urgency pulse when low */}
              {timer <= 10 && (
                <motion.div
                  animate={{ opacity: [0.3, 0.6, 0.3] }}
                  transition={{ duration: 0.8, repeat: Infinity }}
                  className="h-0.5 bg-destructive/40 rounded-full mb-3"
                />
              )}

              <h3 className="text-sm font-semibold text-foreground leading-relaxed mb-5">
                {question.question}
              </h3>

              <div className="space-y-2.5">
                {question.options.map((opt, i) => (
                  <motion.button
                    key={i}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleAnswer(i)}
                    disabled={selectedAnswer !== null}
                    className="w-full text-left p-3.5 rounded-xl border border-border bg-card hover:border-accent/40 transition-all text-sm"
                  >
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0">
                        {String.fromCharCode(65 + i)}
                      </span>
                      <span className="text-foreground flex-1">{opt}</span>
                    </div>
                  </motion.button>
                ))}
              </div>
            </motion.div>
          )}

          {/* ─── RESULT ─── */}
          {phase === "result" && (
            <motion.div
              key="result"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center max-w-xs"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className={`w-16 h-16 rounded-2xl flex items-center justify-center mb-4 ${
                  isCorrect ? "bg-success/15" : "bg-destructive/15"
                }`}
              >
                {isCorrect ? (
                  <CheckCircle2 className="w-8 h-8 text-success" />
                ) : (
                  <XCircle className="w-8 h-8 text-destructive" />
                )}
              </motion.div>

              <motion.h3
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="text-base font-bold text-foreground mb-1"
              >
                {isCorrect
                  ? timer === 0 ? "Close call! ⏱️" : "Nailed it! 🏆"
                  : selectedAnswer === -1 ? "Time's up! ⏰" : "Not this time 💪"}
              </motion.h3>

              {/* Explanation */}
              {question && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className={`w-full p-3 rounded-xl border text-xs leading-relaxed mb-4 text-left ${
                    isCorrect ? "bg-success/5 border-success/20" : "bg-destructive/5 border-destructive/20"
                  }`}
                >
                  <div className="flex items-start gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                    <div>
                      <p className="text-foreground/80">{question.explanation}</p>
                      {!isCorrect && selectedAnswer !== -1 && (
                        <p className="mt-1.5 font-semibold text-foreground">
                          Correct: {question.options[question.correct_index]}
                        </p>
                      )}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* Rank impact */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="flex items-center gap-3 mb-5"
              >
                <div className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border ${
                  isCorrect ? "bg-accent/10 border-accent/15" : "bg-secondary border-border/50"
                }`}>
                  {isCorrect ? (
                    <ChevronUp className="w-3.5 h-3.5 text-accent" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
                  )}
                  <span className={`text-xs font-bold ${isCorrect ? "text-accent" : "text-muted-foreground"}`}>
                    {isCorrect ? `+${rankDelta} rank` : "No change"}
                  </span>
                </div>

                {isCorrect && timer > 30 && (
                  <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-warning/10 border border-warning/15">
                    <Zap className="w-3 h-3 text-warning" />
                    <span className="text-[10px] font-bold text-warning">Speed bonus!</span>
                  </div>
                )}
              </motion.div>

              {/* Motivational text */}
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-[11px] text-muted-foreground italic mb-5"
              >
                {isCorrect
                  ? "Every correct answer moves you closer to the top."
                  : "Champions learn from every attempt. Try again tomorrow."}
              </motion.p>

              <motion.button
                whileTap={{ scale: 0.97 }}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 1 }}
                onClick={onClose}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-all"
              >
                Back to Dashboard
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}