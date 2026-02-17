import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Play, Pause, RotateCcw, CheckCircle, X, ShieldCheck, Eye, EyeOff, Plus, Minus, Volume2, VolumeX, CloudRain, Music, Radio, Timer, Coffee, SkipForward, Clock, BookOpen, Brain, TrendingUp, TrendingDown, Minus as MinusIcon, Smile, Meh, Frown } from "lucide-react";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/useAmbientSound";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";
import { useWhatsAppPreview } from "@/hooks/useWhatsAppPreview";
import WhatsAppPreviewModal from "@/components/app/WhatsAppPreviewModal";

const PRESETS = [15, 25, 45, 60];
const POMODORO_WORK = 25;
const POMODORO_SHORT_BREAK = 5;
const POMODORO_LONG_BREAK = 15;
const POMODORO_CYCLES_BEFORE_LONG = 4;

interface FocusModeSessionProps {
  open: boolean;
  onClose: () => void;
  onSessionComplete?: () => void;
  initialSubject?: string;
  initialTopic?: string;
  autoStart?: boolean;
}

type SessionState = "setup" | "running" | "paused" | "done" | "summary";
type PomodoroPhase = "work" | "short-break" | "long-break";

interface SessionSummary {
  elapsedMinutes: number;
  subject: string;
  topic: string;
  strengthBefore: number | null;
  strengthAfter: number | null;
  pomodoroEnabled: boolean;
  cyclesCompleted: number;
}

const FocusModeSession = ({ open, onClose, onSessionComplete, initialSubject, initialTopic, autoStart }: FocusModeSessionProps) => {
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const ambient = useAmbientSound();
  const { user } = useAuth();

  const [state, setState] = useState<SessionState>("setup");
  const [summary, setSummary] = useState<SessionSummary | null>(null);
  const [totalMinutes, setTotalMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [subject, setSubject] = useState(initialSubject || "");
  const [topic, setTopic] = useState(initialTopic || "");
  const [distractionsBlocked, setDistractionsBlocked] = useState(true);
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("work");
  const [pomodoroCycle, setPomodoroCycle] = useState(1);
  const [totalCyclesCompleted, setTotalCyclesCompleted] = useState(0);
  const [logging, setLogging] = useState(false);
  const { previewState, showPreview, confirmSend, cancelSend } = useWhatsAppPreview();
  const [confidence, setConfidence] = useState<"low" | "medium" | "high">("high");
  const [sessionNotes, setSessionNotes] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  const autoStartTriggered = useRef(false);

  useEffect(() => {
    if (open) {
      setState("setup");
      setTotalMinutes(25);
      setSecondsLeft(25 * 60);
      setSubject(initialSubject || "");
      setTopic(initialTopic || "");
      setPomodoroEnabled(false);
      setPomodoroPhase("work");
      setPomodoroCycle(1);
      setTotalCyclesCompleted(0);
      autoStartTriggered.current = false;
    } else {
      clearTimer();
      ambient.stop();
    }
  }, [open]);

  // Auto-start session when autoStart is true and subject is available
  useEffect(() => {
    if (open && autoStart && !autoStartTriggered.current && (initialSubject || initialTopic)) {
      autoStartTriggered.current = true;
      const sub = initialSubject || initialTopic || "General";
      const top = initialTopic || "";
      setSubject(sub);
      setTopic(top);
      setTotalMinutes(25);
      setSecondsLeft(25 * 60);
      startTimeRef.current = Date.now();
      setState("running");
      // Start countdown in next tick after state is set
      setTimeout(() => startCountdown(), 0);
    }
  }, [open, autoStart, initialSubject, initialTopic]);

  const clearTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  const startSession = () => {
    if (!subject.trim()) {
      toast({ title: "Enter a subject", description: "What are you studying?", variant: "destructive" });
      return;
    }
    const duration = pomodoroEnabled ? POMODORO_WORK : totalMinutes;
    setSecondsLeft(duration * 60);
    if (pomodoroEnabled) {
      setTotalMinutes(duration);
      setPomodoroPhase("work");
      setPomodoroCycle(1);
      setTotalCyclesCompleted(0);
    }
    startTimeRef.current = Date.now();
    setState("running");
    startCountdown();
  };

  const startCountdown = () => {
    clearTimer();
    intervalRef.current = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearTimer();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  // Handle timer reaching zero
  useEffect(() => {
    if (secondsLeft === 0 && state === "running") {
      clearTimer();
      if (pomodoroEnabled) {
        handlePomodoroTransition();
      } else {
        setState("done");
      }
    }
  }, [secondsLeft, state]);

  const handlePomodoroTransition = () => {
    if (pomodoroPhase === "work") {
      const newCompleted = totalCyclesCompleted + 1;
      setTotalCyclesCompleted(newCompleted);
      if (newCompleted % POMODORO_CYCLES_BEFORE_LONG === 0) {
        setPomodoroPhase("long-break");
        setSecondsLeft(POMODORO_LONG_BREAK * 60);
        setTotalMinutes(POMODORO_LONG_BREAK);
        toast({ title: "Long break! 🎉", description: `${POMODORO_LONG_BREAK} min — you've earned it after ${POMODORO_CYCLES_BEFORE_LONG} cycles.` });
      } else {
        setPomodoroPhase("short-break");
        setSecondsLeft(POMODORO_SHORT_BREAK * 60);
        setTotalMinutes(POMODORO_SHORT_BREAK);
        toast({ title: "Short break ☕", description: `${POMODORO_SHORT_BREAK} min — stretch & relax.` });
      }
      setState("running");
      startCountdown();
    } else {
      // Break ended → next work phase
      setPomodoroPhase("work");
      setPomodoroCycle((c) => c + 1);
      setSecondsLeft(POMODORO_WORK * 60);
      setTotalMinutes(POMODORO_WORK);
      toast({ title: "Back to work! 🎯", description: `Cycle ${pomodoroCycle + 1} — let's go.` });
      setState("running");
      startCountdown();
    }
  };

  const skipPomodoroPhase = () => {
    clearTimer();
    setSecondsLeft(0);
    // The useEffect will handle the transition
    handlePomodoroTransition();
  };

  const pauseTimer = () => {
    setState("paused");
    clearTimer();
  };

  const resumeTimer = () => {
    setState("running");
    startCountdown();
  };

  const resetTimer = () => {
    clearTimer();
    setState("setup");
    setSecondsLeft(totalMinutes * 60);
  };

  // Fetch topic memory strength before logging
  const getTopicStrength = async (topicName: string): Promise<number | null> => {
    if (!user || !topicName) return null;
    const { data } = await supabase
      .from("topics")
      .select("memory_strength")
      .eq("user_id", user.id)
      .eq("name", topicName)
      .is("deleted_at", null)
      .maybeSingle();
    return data ? Number(data.memory_strength) : null;
  };

  const handleComplete = async () => {
    const elapsedMs = Date.now() - startTimeRef.current;
    const elapsed = Math.max(1, Math.round(elapsedMs / 60000));

    // Capture strength before logging
    const strengthBefore = await getTopicStrength(topic);

    ambient.stop();

    // Fire confetti
    confetti({ particleCount: 60, spread: 70, origin: { y: 0.6 }, colors: ["#22c55e", "#6366f1", "#f59e0b"] });

    setSummary({
      elapsedMinutes: elapsed,
      subject,
      topic,
      strengthBefore,
      strengthAfter: null,
      pomodoroEnabled,
      cyclesCompleted: totalCyclesCompleted,
    });
    setConfidence("high");
    setSessionNotes("");
    setState("summary");
  };

  const logAndFinish = async (callback: () => void) => {
    if (!summary) return;
    setLogging(true);

    await logStudy({
      subjectName: summary.subject,
      topicName: summary.topic || undefined,
      durationMinutes: summary.elapsedMinutes,
      confidenceLevel: confidence,
      studyMode: "focus",
      notes: sessionNotes || undefined,
    });

    const strengthAfter = await getTopicStrength(summary.topic);
    setSummary((prev) => prev ? { ...prev, strengthAfter } : prev);

    setLogging(false);
    onSessionComplete?.();
    
    // WhatsApp notification preview for focus session completion
    if (user && summary) {
      showPreview("focus_session_completed", {
        user_id: user.id,
        data: { minutes: summary.elapsedMinutes, topic_name: summary.topic || summary.subject },
      });
    }
    
    callback();
  };

  const handleCloseSummary = () => {
    logAndFinish(() => {
      setSummary(null);
      onClose();
    });
  };

  const handleStartAnother = () => {
    const prevSubject = summary?.subject || "";
    const prevTopic = summary?.topic || "";
    logAndFinish(() => {
      setSummary(null);
      setState("setup");
      setTotalMinutes(25);
      setSecondsLeft(25 * 60);
      setSubject(prevSubject);
      setTopic(prevTopic);
      setPomodoroEnabled(false);
      setPomodoroPhase("work");
      setPomodoroCycle(1);
      setTotalCyclesCompleted(0);
    });
  };

  useEffect(() => () => clearTimer(), []);

  const totalSecs = totalMinutes * 60;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = state === "setup" ? 0 : ((totalSecs - secondsLeft) / totalSecs) * 100;

  if (!open) return null;

  return (
    <>
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-6"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm glass rounded-2xl neural-border p-6 space-y-5 relative"
        >
          {/* Close — only in setup */}
          {state === "setup" && (
            <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}

          {/* Header */}
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-success/10 neural-border">
              <Crosshair className="w-5 h-5 text-success" />
            </div>
            <div>
              <h2 className="font-bold text-foreground">Focus Mode</h2>
              <p className="text-xs text-muted-foreground">Deep study · distraction-free</p>
            </div>
          </div>

          {/* Setup screen */}
          {state === "setup" && (
            <div className="space-y-4">
              {/* Subject & Topic */}
              <input
                type="text"
                placeholder="Subject (e.g. Mathematics)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-success"
              />
              <input
                type="text"
                placeholder="Topic (optional)"
                value={topic}
                onChange={(e) => setTopic(e.target.value)}
                className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-success"
              />

              {/* Pomodoro toggle */}
              <button
                onClick={() => {
                  setPomodoroEnabled((v) => !v);
                  if (!pomodoroEnabled) setTotalMinutes(POMODORO_WORK);
                }}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  pomodoroEnabled
                    ? "border-accent/30 bg-accent/5"
                    : "border-border bg-secondary/30"
                }`}
              >
                <Timer className={`w-4 h-4 ${pomodoroEnabled ? "text-accent-foreground" : "text-muted-foreground"}`} />
                <div className="flex-1 text-left">
                  <span className="text-sm text-foreground block">Pomodoro Mode</span>
                  <span className="text-[10px] text-muted-foreground">25m work · 5m break · 15m long break</span>
                </div>
                <div className={`w-8 h-5 rounded-full transition-all flex items-center px-0.5 ${pomodoroEnabled ? "bg-success justify-end" : "bg-muted justify-start"}`}>
                  <div className="w-4 h-4 rounded-full bg-background shadow-sm" />
                </div>
              </button>

              {/* Duration presets — hidden when Pomodoro is on */}
              {!pomodoroEnabled && (
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Duration (minutes)</span>
                <div className="flex items-center gap-2">
                  {PRESETS.map((p) => (
                    <button
                      key={p}
                      onClick={() => setTotalMinutes(p)}
                      className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                        totalMinutes === p
                          ? "bg-success text-success-foreground"
                          : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      {p}
                    </button>
                  ))}
                </div>
                {/* Custom adjuster */}
                <div className="flex items-center justify-center gap-3 mt-3">
                  <button
                    onClick={() => setTotalMinutes((m) => Math.max(5, m - 5))}
                    className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/80 transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <span className="text-lg font-bold text-foreground w-16 text-center">{totalMinutes}m</span>
                  <button
                    onClick={() => setTotalMinutes((m) => Math.min(180, m + 5))}
                    className="p-2 rounded-lg bg-secondary border border-border hover:bg-secondary/80 transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                </div>
              </div>
              )}

              {/* Distraction blocking toggle */}
              <button
                onClick={() => setDistractionsBlocked((v) => !v)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border transition-all ${
                  distractionsBlocked
                    ? "border-success/30 bg-success/5"
                    : "border-border bg-secondary/30"
                }`}
              >
                <ShieldCheck className={`w-4 h-4 ${distractionsBlocked ? "text-success" : "text-muted-foreground"}`} />
                <span className="flex-1 text-sm text-foreground text-left">Distraction Blocking</span>
                {distractionsBlocked ? (
                  <EyeOff className="w-4 h-4 text-success" />
                ) : (
                  <Eye className="w-4 h-4 text-muted-foreground" />
                )}
              </button>

              {/* Ambient Sounds */}
              <div>
                <span className="text-xs text-muted-foreground mb-2 block">Ambient Sound</span>
                <div className="flex items-center gap-2">
                  {([
                    { type: "rain" as AmbientSoundType, icon: CloudRain, label: "Rain" },
                    { type: "lo-fi" as AmbientSoundType, icon: Music, label: "Lo-Fi" },
                    { type: "white-noise" as AmbientSoundType, icon: Radio, label: "Noise" },
                  ]).map((s) => (
                    <button
                      key={s.type}
                      onClick={() => ambient.toggle(s.type)}
                      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-medium transition-all ${
                        ambient.active === s.type
                          ? "bg-success text-success-foreground"
                          : "bg-secondary border border-border text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <s.icon className="w-3.5 h-3.5" />
                      {s.label}
                    </button>
                  ))}
                </div>
                {ambient.active && (
                  <div className="flex items-center gap-2 mt-2">
                    <VolumeX className="w-3 h-3 text-muted-foreground" />
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.05"
                      value={ambient.volume}
                      onChange={(e) => ambient.setVolume(parseFloat(e.target.value))}
                      className="flex-1 h-1.5 accent-success"
                    />
                    <Volume2 className="w-3 h-3 text-muted-foreground" />
                  </div>
                )}
              </div>

              {/* Start */}
              <button
                onClick={startSession}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all hover:brightness-110 active:scale-95"
              >
                <Play className="w-4 h-4" /> Begin Focus Session
              </button>
            </div>
          )}

          {/* Active / Paused / Done */}
          {state !== "setup" && state !== "summary" && (
            <div className="flex flex-col items-center gap-5">
              {/* Distraction blocker banner */}
              {distractionsBlocked && state === "running" && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full flex items-center gap-2 p-3 rounded-xl border border-success/20 bg-success/5"
                >
                  <ShieldCheck className="w-4 h-4 text-success" />
                  <span className="text-xs text-success font-medium">Distractions blocked — stay in the zone</span>
                </motion.div>
              )}

              {/* Ambient sound controls (compact) */}
              <div className="w-full flex items-center gap-2">
                {([
                  { type: "rain" as AmbientSoundType, icon: CloudRain },
                  { type: "lo-fi" as AmbientSoundType, icon: Music },
                  { type: "white-noise" as AmbientSoundType, icon: Radio },
                ]).map((s) => (
                  <button
                    key={s.type}
                    onClick={() => ambient.toggle(s.type)}
                    className={`p-2 rounded-lg transition-all ${
                      ambient.active === s.type
                        ? "bg-success/20 text-success"
                        : "bg-secondary/50 text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    <s.icon className="w-4 h-4" />
                  </button>
                ))}
                {ambient.active && (
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={ambient.volume}
                    onChange={(e) => ambient.setVolume(parseFloat(e.target.value))}
                    className="flex-1 h-1 accent-success"
                  />
                )}
              </div>

              {/* Pomodoro phase indicator */}
              {pomodoroEnabled && (
                <motion.div
                  key={pomodoroPhase}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className={`w-full flex items-center justify-between p-3 rounded-xl border ${
                    pomodoroPhase === "work"
                      ? "border-success/20 bg-success/5"
                      : "border-warning/20 bg-warning/5"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    {pomodoroPhase === "work" ? (
                      <Crosshair className="w-4 h-4 text-success" />
                    ) : (
                      <Coffee className="w-4 h-4 text-warning" />
                    )}
                    <span className={`text-xs font-semibold ${pomodoroPhase === "work" ? "text-success" : "text-warning"}`}>
                      {pomodoroPhase === "work" ? `Work · Cycle ${pomodoroCycle}` : pomodoroPhase === "short-break" ? "Short Break" : "Long Break"}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] text-muted-foreground">{totalCyclesCompleted} done</span>
                    {pomodoroPhase !== "work" && state === "running" && (
                      <button onClick={skipPomodoroPhase} className="p-1 rounded-md hover:bg-secondary transition-colors" title="Skip break">
                        <SkipForward className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Subject display */}
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">{subject}</p>
                {topic && <p className="text-xs text-muted-foreground">{topic}</p>}
              </div>

              {/* Timer */}
              <div className="relative w-44 h-44">
                <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                  <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                  <circle
                    cx="60" cy="60" r="54" fill="none"
                    stroke={pomodoroEnabled && pomodoroPhase !== "work" ? "hsl(var(--warning))" : "hsl(var(--success))"}
                    strokeWidth="8"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 54}`}
                    strokeDashoffset={`${2 * Math.PI * 54 * (1 - progress / 100)}`}
                    className="transition-all duration-1000 ease-linear"
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-3xl font-mono font-bold text-foreground">{mm}:{ss}</span>
                  <span className="text-[10px] text-muted-foreground mt-1">
                    {state === "running"
                      ? pomodoroEnabled && pomodoroPhase !== "work" ? "on break..." : "focusing..."
                      : state === "paused" ? "paused" : "complete!"}
                  </span>
                </div>
              </div>

              {/* Controls */}
              <div className="flex items-center gap-3">
                {state === "running" && (
                  <button onClick={pauseTimer} className="flex items-center gap-2 px-6 py-3 rounded-xl bg-warning/20 text-warning font-semibold border border-warning/30 transition-all active:scale-95">
                    <Pause className="w-4 h-4" /> Pause
                  </button>
                )}
                {state === "paused" && (
                  <>
                    <button onClick={resumeTimer} className="flex items-center gap-2 px-5 py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all active:scale-95">
                      <Play className="w-4 h-4" /> Resume
                    </button>
                    <button onClick={resetTimer} className="p-3 rounded-xl bg-secondary border border-border transition-all active:scale-95">
                      <RotateCcw className="w-4 h-4 text-muted-foreground" />
                    </button>
                    <button
                      onClick={handleComplete}
                      disabled={logging}
                      className="flex items-center gap-2 px-5 py-3 rounded-xl bg-success/20 text-success font-semibold border border-success/30 transition-all active:scale-95 disabled:opacity-50"
                    >
                      <CheckCircle className="w-4 h-4" /> End Early
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
          )}

          {/* Session Summary */}
          {state === "summary" && summary && (
            <div className="flex flex-col items-center gap-5">
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200, damping: 15 }}
                className="w-16 h-16 rounded-full bg-success/20 flex items-center justify-center"
              >
                <CheckCircle className="w-8 h-8 text-success" />
              </motion.div>

              <div className="text-center">
                <h3 className="text-lg font-bold text-foreground">Session Complete!</h3>
                <p className="text-xs text-muted-foreground mt-1">Great focus — here's your recap</p>
              </div>

              <div className="w-full grid grid-cols-2 gap-3">
                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
                  className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <Clock className="w-4 h-4 text-primary mb-1.5" />
                  <span className="text-lg font-bold text-foreground">
                    {summary.elapsedMinutes >= 60
                      ? `${Math.floor(summary.elapsedMinutes / 60)}h ${summary.elapsedMinutes % 60}m`
                      : `${summary.elapsedMinutes}m`}
                  </span>
                  <span className="text-[10px] text-muted-foreground">Time Studied</span>
                </motion.div>

                <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
                  className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <BookOpen className="w-4 h-4 text-primary mb-1.5" />
                  <span className="text-sm font-bold text-foreground truncate max-w-full px-1">{summary.subject}</span>
                  <span className="text-[10px] text-muted-foreground truncate max-w-full px-1">{summary.topic || "General"}</span>
                </motion.div>

                {summary.strengthAfter !== null && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                    className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <Brain className="w-4 h-4 text-primary mb-1.5" />
                    <span className="text-lg font-bold text-foreground">{Math.round(summary.strengthAfter)}%</span>
                    <span className="text-[10px] text-muted-foreground">Memory Strength</span>
                  </motion.div>
                )}

                {summary.strengthBefore !== null && summary.strengthAfter !== null && (() => {
                  const delta = Math.round(summary.strengthAfter! - summary.strengthBefore!);
                  const isPositive = delta > 0;
                  const isZero = delta === 0;
                  return (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
                      className="flex flex-col items-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                      {isPositive ? (
                        <TrendingUp className="w-4 h-4 text-success mb-1.5" />
                      ) : isZero ? (
                        <MinusIcon className="w-4 h-4 text-muted-foreground mb-1.5" />
                      ) : (
                        <TrendingDown className="w-4 h-4 text-warning mb-1.5" />
                      )}
                      <span className={`text-lg font-bold ${isPositive ? "text-success" : isZero ? "text-foreground" : "text-warning"}`}>
                        {isPositive ? "+" : ""}{delta}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">Change</span>
                    </motion.div>
                  );
                })()}

                {summary.pomodoroEnabled && (
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="col-span-2 flex flex-col items-center p-3 rounded-xl bg-secondary/30 border border-border/50">
                    <Timer className="w-4 h-4 text-primary mb-1.5" />
                    <span className="text-lg font-bold text-foreground">{summary.cyclesCompleted}</span>
                    <span className="text-[10px] text-muted-foreground">Pomodoro Cycles</span>
                  </motion.div>
                )}
              </div>

              {/* Confidence picker */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35 }}
                className="w-full"
              >
                <span className="text-xs text-muted-foreground mb-2 block text-center">How confident do you feel?</span>
                <div className="flex gap-2">
                  {([
                    { level: "low" as const, icon: Frown, label: "Low", color: "border-destructive/30 bg-destructive/10 text-destructive" },
                    { level: "medium" as const, icon: Meh, label: "Medium", color: "border-warning/30 bg-warning/10 text-warning" },
                    { level: "high" as const, icon: Smile, label: "High", color: "border-success/30 bg-success/10 text-success" },
                  ]).map((opt) => (
                    <button
                      key={opt.level}
                      onClick={() => setConfidence(opt.level)}
                      className={`flex-1 flex flex-col items-center gap-1.5 py-2.5 rounded-xl border transition-all active:scale-95 ${
                        confidence === opt.level
                          ? opt.color + " ring-1 ring-current"
                          : "border-border bg-secondary/30 text-muted-foreground"
                      }`}
                    >
                      <opt.icon className="w-4 h-4" />
                      <span className="text-[10px] font-medium">{opt.label}</span>
                    </button>
                  ))}
                </div>
              </motion.div>

              {/* Notes field */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.38 }}
                className="w-full"
              >
                <textarea
                  value={sessionNotes}
                  onChange={(e) => setSessionNotes(e.target.value.slice(0, 500))}
                  placeholder="Key takeaways or notes (optional)"
                  rows={2}
                  className="w-full rounded-xl bg-secondary/40 border border-border px-3 py-2.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 resize-none"
                />
                <span className="text-[10px] text-muted-foreground mt-0.5 block text-right">{sessionNotes.length}/500</span>
              </motion.div>

              <div className="w-full flex gap-2">
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  onClick={handleStartAnother}
                  disabled={logging}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary border border-border text-foreground font-semibold transition-all hover:bg-secondary/80 active:scale-95 disabled:opacity-50"
                >
                  <RotateCcw className="w-4 h-4" /> {logging ? "Logging..." : "New Session"}
                </motion.button>
                <motion.button
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.45 }}
                  onClick={handleCloseSummary}
                  disabled={logging}
                  className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-success text-success-foreground font-semibold transition-all hover:brightness-110 active:scale-95 disabled:opacity-50"
                >
                  {logging ? "Logging..." : "Done"}
                </motion.button>
              </div>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
    <WhatsAppPreviewModal
      open={previewState.open}
      message={previewState.message}
      eventType={previewState.eventType}
      onConfirm={confirmSend}
      onCancel={cancelSend}
      sending={previewState.sending}
    />
    </>
  );
};

export default FocusModeSession;
