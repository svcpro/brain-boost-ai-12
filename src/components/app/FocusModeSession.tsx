import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Play, Pause, RotateCcw, CheckCircle, X, ShieldCheck, Eye, EyeOff, Plus, Minus, Volume2, VolumeX, CloudRain, Music, Radio, Timer, Coffee, SkipForward } from "lucide-react";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { useAmbientSound, type AmbientSoundType } from "@/hooks/useAmbientSound";

const PRESETS = [15, 25, 45, 60];
const POMODORO_WORK = 25;
const POMODORO_SHORT_BREAK = 5;
const POMODORO_LONG_BREAK = 15;
const POMODORO_CYCLES_BEFORE_LONG = 4;

interface FocusModeSessionProps {
  open: boolean;
  onClose: () => void;
}

type SessionState = "setup" | "running" | "paused" | "done";
type PomodoroPhase = "work" | "short-break" | "long-break";

const FocusModeSession = ({ open, onClose }: FocusModeSessionProps) => {
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const ambient = useAmbientSound();

  const [state, setState] = useState<SessionState>("setup");
  const [totalMinutes, setTotalMinutes] = useState(25);
  const [secondsLeft, setSecondsLeft] = useState(25 * 60);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [distractionsBlocked, setDistractionsBlocked] = useState(true);
  const [pomodoroEnabled, setPomodoroEnabled] = useState(false);
  const [pomodoroPhase, setPomodoroPhase] = useState<PomodoroPhase>("work");
  const [pomodoroCycle, setPomodoroCycle] = useState(1);
  const [totalCyclesCompleted, setTotalCyclesCompleted] = useState(0);
  const [logging, setLogging] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);

  useEffect(() => {
    if (open) {
      setState("setup");
      setTotalMinutes(25);
      setSecondsLeft(25 * 60);
      setSubject("");
      setTopic("");
      setPomodoroEnabled(false);
      setPomodoroPhase("work");
      setPomodoroCycle(1);
      setTotalCyclesCompleted(0);
    } else {
      clearTimer();
      ambient.stop();
    }
  }, [open]);

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

  const handleComplete = async () => {
    setLogging(true);
    const elapsedMs = Date.now() - startTimeRef.current;
    const elapsed = Math.max(1, Math.round(elapsedMs / 60000));
    await logStudy({
      subjectName: subject,
      topicName: topic || undefined,
      durationMinutes: elapsed,
      confidenceLevel: "high",
      studyMode: "focus",
    });
    toast({ title: "Deep focus session logged! 🎯", description: `${elapsed} min on ${subject}` });
    setLogging(false);
    ambient.stop();
    onClose();
  };

  useEffect(() => () => clearTimer(), []);

  const totalSecs = totalMinutes * 60;
  const mm = String(Math.floor(secondsLeft / 60)).padStart(2, "0");
  const ss = String(secondsLeft % 60).padStart(2, "0");
  const progress = state === "setup" ? 0 : ((totalSecs - secondsLeft) / totalSecs) * 100;

  if (!open) return null;

  return (
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
          {state !== "setup" && (
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
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default FocusModeSession;
