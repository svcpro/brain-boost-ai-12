import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ShieldAlert, Brain, Lock, CheckCircle2, X, Zap, AlertTriangle } from "lucide-react";
import { triggerHaptic } from "@/lib/feedback";

interface FocusShieldOverlayProps {
  type: "warning" | "freeze";
  microRecallRequired: boolean;
  freezeDurationSeconds?: number;
  onDismiss: (recallPassed?: boolean) => void;
}

// Simple recall questions
const RECALL_QUESTIONS = [
  { q: "What is the capital of France?", a: "paris" },
  { q: "What is 17 × 3?", a: "51" },
  { q: "Which planet is closest to the Sun?", a: "mercury" },
  { q: "What is the square root of 144?", a: "12" },
  { q: "Who wrote 'Romeo and Juliet'?", a: "shakespeare" },
  { q: "What is H₂O commonly known as?", a: "water" },
  { q: "How many states does India have?", a: "28" },
  { q: "What is 256 ÷ 16?", a: "16" },
];

export default function FocusShieldOverlay({
  type,
  microRecallRequired,
  freezeDurationSeconds = 300,
  onDismiss,
}: FocusShieldOverlayProps) {
  const [phase, setPhase] = useState<"warning" | "recall" | "freeze_timer">(
    type === "freeze" ? "freeze_timer" : "warning"
  );
  const [recallQuestion] = useState(
    () => RECALL_QUESTIONS[Math.floor(Math.random() * RECALL_QUESTIONS.length)]
  );
  const [answer, setAnswer] = useState("");
  const [recallResult, setRecallResult] = useState<"pending" | "correct" | "wrong">("pending");
  const [freezeRemaining, setFreezeRemaining] = useState(freezeDurationSeconds);

  // Freeze countdown
  useEffect(() => {
    if (phase !== "freeze_timer") return;
    triggerHaptic([40, 60, 40]);
    const timer = setInterval(() => {
      setFreezeRemaining(prev => {
        if (prev <= 1) {
          clearInterval(timer);
          onDismiss(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [phase, onDismiss]);

  const handleGoBack = useCallback(() => {
    if (microRecallRequired && type === "warning") {
      setPhase("recall");
      triggerHaptic([15, 20]);
    } else {
      onDismiss(false);
    }
  }, [microRecallRequired, type, onDismiss]);

  const handleRecallSubmit = useCallback(() => {
    const correct = answer.trim().toLowerCase() === recallQuestion.a.toLowerCase();
    setRecallResult(correct ? "correct" : "wrong");
    triggerHaptic(correct ? [10, 15, 10] : [30, 50, 30, 50]);
    setTimeout(() => {
      onDismiss(correct);
    }, correct ? 800 : 1500);
  }, [answer, recallQuestion, onDismiss]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, "0")}`;
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[60] bg-background/98 backdrop-blur-md flex items-center justify-center"
    >
      <div className="w-full max-w-xs px-5">
        <AnimatePresence mode="wait">
          {/* ─── Warning Phase ─── */}
          {phase === "warning" && (
            <motion.div
              key="warning"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    "0 0 0 0 hsl(var(--warning) / 0)",
                    "0 0 0 24px hsl(var(--warning) / 0.12)",
                    "0 0 0 0 hsl(var(--warning) / 0)",
                  ],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
                className="w-20 h-20 rounded-full bg-warning/15 flex items-center justify-center mb-5"
              >
                <ShieldAlert className="w-10 h-10 text-warning" />
              </motion.div>

              <h3 className="text-lg font-bold text-foreground mb-1">Focus Shield Active</h3>
              <p className="text-xs text-muted-foreground mb-6 leading-relaxed">
                You left your study session. Distractions reduce retention by up to 40%.
              </p>

              {/* Stats */}
              <div className="w-full flex gap-2 mb-6">
                <div className="flex-1 rounded-xl bg-destructive/10 border border-destructive/15 p-3">
                  <AlertTriangle className="w-4 h-4 text-destructive mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Focus breaks</p>
                  <p className="text-sm font-bold text-destructive">This session</p>
                </div>
                <div className="flex-1 rounded-xl bg-primary/10 border border-primary/15 p-3">
                  <Brain className="w-4 h-4 text-primary mx-auto mb-1" />
                  <p className="text-[10px] text-muted-foreground">Memory at risk</p>
                  <p className="text-sm font-bold text-primary">-12% decay</p>
                </div>
              </div>

              {/* Actions */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => { triggerHaptic([10]); onDismiss(); }}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm mb-2.5"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                ← Return to Study
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleGoBack}
                className="w-full py-3 rounded-xl bg-secondary text-muted-foreground text-xs font-medium border border-border/50"
              >
                {microRecallRequired ? "Unlock with Recall Challenge" : "Dismiss Warning"}
              </motion.button>
            </motion.div>
          )}

          {/* ─── Micro Recall Challenge ─── */}
          {phase === "recall" && (
            <motion.div
              key="recall"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="flex flex-col items-center text-center"
            >
              <div className="w-16 h-16 rounded-full bg-accent/15 flex items-center justify-center mb-4">
                <Zap className="w-8 h-8 text-accent" />
              </div>

              <h3 className="text-base font-bold text-foreground mb-1">Micro Recall Challenge</h3>
              <p className="text-[11px] text-muted-foreground mb-5">
                Answer correctly to unlock. This trains your recall even when distracted.
              </p>

              <div className="w-full rounded-xl bg-secondary/50 border border-border/50 p-4 mb-4">
                <p className="text-sm font-semibold text-foreground">{recallQuestion.q}</p>
              </div>

              <input
                type="text"
                value={answer}
                onChange={e => setAnswer(e.target.value)}
                onKeyDown={e => e.key === "Enter" && handleRecallSubmit()}
                placeholder="Type your answer..."
                autoFocus
                className="w-full px-4 py-3 rounded-xl bg-secondary border border-border/50 text-foreground text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/30 mb-4"
              />

              {recallResult === "correct" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-2 text-success mb-3"
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span className="text-sm font-bold">Correct! Unlocking...</span>
                </motion.div>
              )}

              {recallResult === "wrong" && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="text-xs text-destructive mb-3"
                >
                  Incorrect. Returning to study...
                </motion.div>
              )}

              {recallResult === "pending" && (
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleRecallSubmit}
                  disabled={!answer.trim()}
                  className="w-full py-3 rounded-xl bg-accent text-accent-foreground font-bold text-sm disabled:opacity-40"
                >
                  Submit Answer
                </motion.button>
              )}
            </motion.div>
          )}

          {/* ─── Freeze Timer ─── */}
          {phase === "freeze_timer" && (
            <motion.div
              key="freeze"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-20 h-20 rounded-full bg-destructive/15 flex items-center justify-center mb-5"
              >
                <Lock className="w-10 h-10 text-destructive" />
              </motion.div>

              <h3 className="text-lg font-bold text-foreground mb-1">Focus Lock Engaged</h3>
              <p className="text-xs text-muted-foreground mb-5">
                Too many distractions detected. Take a breath and refocus.
              </p>

              {/* Countdown */}
              <motion.div
                animate={{ scale: [1, 1.03, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
                className="w-28 h-28 rounded-full bg-destructive/10 border-2 border-destructive/20 flex items-center justify-center mb-6"
              >
                <span className="text-2xl font-mono font-bold text-destructive">
                  {formatTime(freezeRemaining)}
                </span>
              </motion.div>

              <p className="text-[10px] text-muted-foreground italic">
                Auto-unlocks when timer ends. Use this time to breathe and refocus.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
