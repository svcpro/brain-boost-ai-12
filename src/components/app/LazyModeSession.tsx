import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Play, Pause, RotateCcw, CheckCircle, X, Brain } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { emitEvent } from "@/lib/eventBus";

const TOTAL_SECONDS = 5 * 60; // 5 minutes

interface LazyModeSessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
}

type SessionState = "ready" | "running" | "paused" | "done";

const LazyModeSession = ({ open, onClose, onSessionComplete }: LazyModeSessionProps) => {
  const { prediction, predict } = useMemoryEngine();
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();

  const [state, setState] = useState<SessionState>("ready");
  const [secondsLeft, setSecondsLeft] = useState(TOTAL_SECONDS);
  const [suggestedTopic, setSuggestedTopic] = useState<TopicPrediction | null>(null);
  const [logging, setLogging] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Pick weakest topic when opened
  useEffect(() => {
    if (open) {
      setState("ready");
      setSecondsLeft(TOTAL_SECONDS);
      const pickTopic = async () => {
        let pred = prediction;
        if (!pred) {
          pred = await predict();
        }
        if (pred?.at_risk?.length) {
          setSuggestedTopic(pred.at_risk[0]);
        } else if (pred?.topics?.length) {
          // pick lowest strength topic
          const sorted = [...pred.topics].sort((a, b) => a.memory_strength - b.memory_strength);
          setSuggestedTopic(sorted[0]);
        } else {
          setSuggestedTopic(null);
        }
      };
      pickTopic();
    } else {
      clearTimer();
    }
  }, [open]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startTimer = useCallback(() => {
    setState("running");
    clearTimer();
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          setState("done");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  const pauseTimer = () => {
    setState("paused");
    clearTimer();
  };

  const resetTimer = () => {
    clearTimer();
    setState("ready");
    setSecondsLeft(TOTAL_SECONDS);
  };

  const handleComplete = async () => {
    if (!suggestedTopic) {
      toast({ title: "Session complete! 🎉" });
      onClose();
      return;
    }
    setLogging(true);
    const elapsed = Math.max(1, Math.round((TOTAL_SECONDS - secondsLeft) / 60));
    await logStudy({
      subjectName: suggestedTopic.subject_name || "General",
      topicName: suggestedTopic.name,
      durationMinutes: elapsed,
      confidenceLevel: "medium",
      studyMode: "lazy",
    });
    toast({ title: "Lazy session logged! 🧠", description: `${elapsed} min on ${suggestedTopic.name}` });
    emitEvent("study_session_end", {
      mode: "lazy", duration: elapsed, topic: suggestedTopic.name,
    }, { title: "Lazy Session Done!", body: `${elapsed} min on ${suggestedTopic.name}` });
    setLogging(false);
    onSessionComplete?.();
    onClose();
  };

  // Cleanup on unmount
  useEffect(() => () => clearTimer(), []);

  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = ((TOTAL_SECONDS - secondsLeft) / TOTAL_SECONDS) * 100;

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm glass rounded-2xl neural-border p-6 space-y-6 relative"
        >
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl neural-gradient neural-border">
              <Coffee className="w-5 h-5 text-primary" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Lazy Mode</h2>
              <p className="text-xs text-muted-foreground">5-min micro session</p>
            </div>
          </div>

          {/* Suggested topic */}
          {suggestedTopic ? (
            <div className="rounded-xl bg-secondary/50 border border-border p-4">
              <div className="flex items-center gap-2 mb-1">
                <Brain className="w-3.5 h-3.5 text-primary" />
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-medium">AI picked for you</span>
              </div>
              <p className="text-sm font-semibold text-foreground">{suggestedTopic.name}</p>
              {suggestedTopic.subject_name && (
                <p className="text-xs text-muted-foreground mt-0.5">{suggestedTopic.subject_name}</p>
              )}
              <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 h-1.5 rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-warning to-destructive"
                    style={{ width: `${100 - suggestedTopic.memory_strength}%` }}
                  />
                </div>
                <span className="text-[10px] text-destructive font-medium">{Math.round(100 - suggestedTopic.memory_strength)}% risk</span>
              </div>
            </div>
          ) : (
            <div className="rounded-xl bg-secondary/50 border border-border p-4 text-center">
              <p className="text-sm text-muted-foreground">No topics tracked yet. Study anything for 5 minutes!</p>
            </div>
          )}

          {/* Timer */}
          <div className="flex flex-col items-center gap-4">
            <div className="relative w-40 h-40">
              {/* Background circle */}
              <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                <circle
                  cx="60" cy="60" r="54" fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 54}`}
                  strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
                  className="transition-all duration-1000 ease-linear"
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-mono font-bold text-foreground">{mm}:{ss}</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-3">
              {state === "ready" && (
                <button onClick={startTimer} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all active:scale-95">
                  <Play className="w-4 h-4" /> Start
                </button>
              )}
              {state === "running" && (
                <button onClick={pauseTimer} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-warning/20 text-warning font-semibold border border-warning/30 transition-all active:scale-95">
                  <Pause className="w-4 h-4" /> Pause
                </button>
              )}
              {state === "paused" && (
                <>
                  <button onClick={startTimer} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-primary text-primary-foreground font-semibold transition-all active:scale-95">
                    <Play className="w-4 h-4" /> Resume
                  </button>
                  <button onClick={resetTimer} className="p-3 rounded-xl bg-secondary border border-border transition-all active:scale-95">
                    <RotateCcw className="w-4 h-4 text-muted-foreground" />
                  </button>
                </>
              )}
              {state === "done" && (
                <button
                  onClick={handleComplete}
                  disabled={logging}
                  className="flex items-center gap-2 px-6 py-3 rounded-xl bg-success/20 text-success font-semibold border border-success/30 transition-all active:scale-95 disabled:opacity-50"
                >
                  <CheckCircle className="w-4 h-4" />
                  {logging ? "Logging..." : "Complete & Log"}
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default LazyModeSession;
