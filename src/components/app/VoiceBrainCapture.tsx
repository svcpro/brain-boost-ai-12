import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Brain, CheckCircle, Volume2, Loader2, Zap,
  BookOpen, Target, PenLine, ThumbsUp, MessageCircle,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";

interface ExtractedResult {
  subject: string;
  topics: string[];
}

type Phase = "idle" | "recording" | "transcribing" | "extracting" | "mapping" | "done" | "clarify";

const PHASE_LABELS: Record<Phase, string> = {
  idle: "",
  recording: "Listening…",
  transcribing: "Transcribing voice…",
  extracting: "Extracting topics…",
  mapping: "Mapping to brain…",
  done: "Brain updated!",
  clarify: "",
};

const MAX_DURATION = 60;

const SPEAKING_STEPS = [
  { icon: BookOpen, label: "Subject", example: "Physics" },
  { icon: Target, label: "Topic", example: "Newton's Laws" },
  { icon: PenLine, label: "What you did", example: "Revised 3rd law" },
  { icon: ThumbsUp, label: "Confidence", example: "Optional", optional: true },
];

const RECORDING_HINTS = [
  "💡 Try: \"I studied Organic Chemistry, Alkenes, revision, feeling good\"",
  "🎯 Mention the subject first, then the specific topic",
  "📝 Say what you did: revised, practiced, read, solved",
  "⭐ Add confidence: \"feeling confident\" or \"need more practice\"",
  "🧠 Keep it natural — AI understands everyday language",
  "📚 You can mention multiple topics in one go",
];

const STUDY_TYPES = ["Revision", "Practice", "Reading", "Solving", "Lecture"];
const CONFIDENCE_LEVELS = ["Low", "Medium", "High"];

const VoiceBrainCapture = () => {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [results, setResults] = useState<ExtractedResult[]>([]);
  const [totalTopics, setTotalTopics] = useState(0);
  const [stabilityBoost, setStabilityBoost] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [hintIndex, setHintIndex] = useState(0);
  const [showGuide, setShowGuide] = useState(false);
  const [selectedStudyType, setSelectedStudyType] = useState<string | null>(null);
  const [selectedConfidence, setSelectedConfidence] = useState<string | null>(null);
  const [clarifyText, setClarifyText] = useState("");

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (hintTimerRef.current) clearInterval(hintTimerRef.current);
      if (mediaRecorderRef.current?.state === "recording") {
        mediaRecorderRef.current.stop();
      }
    };
  }, []);

  // Rotate hints during recording
  useEffect(() => {
    if (phase === "recording") {
      hintTimerRef.current = setInterval(() => {
        setHintIndex((i) => (i + 1) % RECORDING_HINTS.length);
      }, 3500);
    } else {
      if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    }
    return () => { if (hintTimerRef.current) clearInterval(hintTimerRef.current); };
  }, [phase]);

  const startRecording = useCallback(async () => {
    if (!user) return;
    setError(null);
    setResults([]);
    setTotalTopics(0);
    setStabilityBoost(0);
    setShowGuide(false);
    setClarifyText("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        processAudio();
      };

      recorder.start();
      startTimeRef.current = Date.now();
      setPhase("recording");
      setElapsed(0);
      setHintIndex(0);
      triggerHaptic([15]);

      timerRef.current = setInterval(() => {
        const secs = Math.floor((Date.now() - startTimeRef.current) / 1000);
        setElapsed(secs);
        if (secs >= MAX_DURATION) recorder.stop();
      }, 250);
    } catch {
      setError("Microphone access denied");
      setPhase("idle");
    }
  }, [user]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
      triggerHaptic([10]);
    }
  }, []);

  const processAudio = useCallback(async () => {
    if (!user) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1000) {
      setError("Recording too short. Try again.");
      setPhase("idle");
      return;
    }

    setPhase("transcribing");
    triggerHaptic([8]);

    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-capture.webm");

      setPhase("extracting");
      const { data, error: fnError } = await supabase.functions.invoke(
        "extract-voice-topics",
        { body: formData }
      );

      if (fnError || !data?.success) {
        // If zero topics extracted, ask for clarification gently
        if (data?.totalTopicsCreated === 0 && data?.success) {
          handleDoneWithResults(data);
          return;
        }
        const errMsg = data?.error || fnError?.message || "Failed to process voice";
        if (errMsg.includes("could not extract") || errMsg.includes("Could not")) {
          setPhase("clarify");
          return;
        }
        setError(errMsg);
        setPhase("idle");
        return;
      }

      if (data.totalTopicsCreated === 0) {
        handleDoneWithResults(data);
        return;
      }

      await handleDoneWithResults(data);
    } catch (e: any) {
      console.error("Voice capture error:", e);
      setError("Something went wrong. Try again.");
      setPhase("idle");
    }
  }, [user, elapsed, selectedStudyType, selectedConfidence]);

  const handleDoneWithResults = async (data: any) => {
    if (!user) return;
    setResults(data.results || []);
    setTotalTopics(data.totalTopicsCreated || 0);

    setPhase("mapping");
    triggerHaptic([10, 20]);

    let boost = 0;
    if (data.totalTopicsCreated > 0) {
      for (const res of data.results || []) {
        for (const topicName of res.topics) {
          await supabase
            .from("topics")
            .update({
              memory_strength: 25,
              next_predicted_drop_date: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
            })
            .eq("user_id", user.id)
            .eq("name", topicName);
        }
      }
      boost = Math.min(8, data.totalTopicsCreated * 2);

      await supabase.from("study_logs").insert({
        user_id: user.id,
        subject: data.results?.[0]?.subject || "Voice Capture",
        topic: `${data.totalTopicsCreated} topics extracted`,
        study_mode: selectedStudyType?.toLowerCase() || "voice_capture",
        duration_minutes: Math.max(1, Math.ceil(elapsed / 60)),
        quality_score: selectedConfidence === "High" ? 5 : selectedConfidence === "Medium" ? 3 : selectedConfidence === "Low" ? 2 : 4,
      });

      const today = new Date().toISOString().split("T")[0];
      await (supabase as any).from("study_streaks").upsert(
        { user_id: user.id, streak_date: today, minutes_studied: Math.max(1, Math.ceil(elapsed / 60)) },
        { onConflict: "user_id,streak_date" }
      );
    }

    setStabilityBoost(boost);
    setPhase("done");
    triggerHaptic([15, 30, 15]);
    setTimeout(() => { setPhase("idle"); setSelectedStudyType(null); setSelectedConfidence(null); }, 4000);
  };

  const handleClarifySubmit = async () => {
    if (!clarifyText.trim() || !user) return;
    setPhase("extracting");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("extract-voice-topics", {
        body: { transcript: clarifyText.trim() },
      });
      if (fnError || !data?.success) {
        setError("Still couldn't extract topics. Try being more specific.");
        setPhase("idle");
        return;
      }
      await handleDoneWithResults(data);
    } catch {
      setError("Something went wrong.");
      setPhase("idle");
    }
  };

  return (
    <div className="space-y-2">
      {/* Header */}
      <div className="flex items-center gap-2 px-1">
        <Volume2 className="w-3.5 h-3.5 text-primary" />
        <span className="text-xs font-semibold text-foreground">Voice Brain Capture</span>
        <span className="text-[9px] text-muted-foreground ml-auto">Speak to learn</span>
      </div>

      {/* Main Card */}
      <motion.div
        layout
        className="relative rounded-2xl border border-border bg-card overflow-hidden"
        style={{ background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--secondary) / 0.5) 100%)" }}
      >
        <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-10 blur-2xl pointer-events-none bg-primary" />

        <AnimatePresence mode="wait">
          {/* ──── IDLE ──── */}
          {phase === "idle" && !error && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, y: -10 }} className="p-4 space-y-3">
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={startRecording}
                  className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 hover:bg-primary/20 transition-colors"
                >
                  <Mic className="w-5 h-5 text-primary" />
                </motion.button>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">Tap to capture</p>
                  <p className="text-[10px] text-muted-foreground leading-tight">
                    Speak about any topic — AI extracts & maps automatically
                  </p>
                </div>
                <button
                  onClick={() => setShowGuide(!showGuide)}
                  className="text-[9px] px-2 py-1 rounded-full bg-secondary/50 text-muted-foreground border border-border/30 hover:bg-secondary transition-colors shrink-0"
                >
                  {showGuide ? "Hide" : "How?"}
                </button>
              </div>

              {/* Speaking guide */}
              <AnimatePresence>
                {showGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="overflow-hidden"
                  >
                    {/* 4-step guide */}
                    <div className="grid grid-cols-4 gap-1.5 mb-2.5">
                      {SPEAKING_STEPS.map((step, i) => (
                        <div key={i} className="text-center">
                          <div className={`w-7 h-7 rounded-full mx-auto flex items-center justify-center ${step.optional ? "bg-secondary/50 border border-border/30" : "bg-primary/10 border border-primary/20"}`}>
                            <step.icon className={`w-3.5 h-3.5 ${step.optional ? "text-muted-foreground" : "text-primary"}`} />
                          </div>
                          <p className="text-[9px] font-medium text-foreground mt-1">{step.label}</p>
                          <p className="text-[8px] text-muted-foreground">{step.example}</p>
                        </div>
                      ))}
                    </div>

                    {/* Example speech */}
                    <div className="rounded-lg bg-secondary/30 border border-border/20 px-3 py-2 mb-2.5">
                      <p className="text-[9px] text-muted-foreground mb-0.5">Example:</p>
                      <p className="text-[10px] text-foreground italic leading-relaxed">
                        "I revised <span className="text-primary font-medium">Physics</span>, <span className="text-primary font-medium">Newton's Third Law</span>, did practice problems, feeling <span className="text-primary font-medium">confident</span>"
                      </p>
                    </div>

                    {/* Quick tap buttons */}
                    <div className="space-y-2">
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-1">Quick study type:</p>
                        <div className="flex flex-wrap gap-1">
                          {STUDY_TYPES.map((st) => (
                            <button
                              key={st}
                              onClick={() => setSelectedStudyType(selectedStudyType === st ? null : st)}
                              className={`text-[9px] px-2 py-0.5 rounded-full border transition-colors ${
                                selectedStudyType === st
                                  ? "bg-primary/15 border-primary/30 text-primary font-medium"
                                  : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/20"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div>
                        <p className="text-[9px] text-muted-foreground mb-1">Confidence:</p>
                        <div className="flex gap-1">
                          {CONFIDENCE_LEVELS.map((cl) => (
                            <button
                              key={cl}
                              onClick={() => setSelectedConfidence(selectedConfidence === cl ? null : cl)}
                              className={`text-[9px] px-2.5 py-0.5 rounded-full border transition-colors ${
                                selectedConfidence === cl
                                  ? "bg-primary/15 border-primary/30 text-primary font-medium"
                                  : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/20"
                              }`}
                            >
                              {cl}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ──── ERROR ──── */}
          {phase === "idle" && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center gap-3 p-4">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setError(null); startRecording(); }} className="w-12 h-12 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center shrink-0">
                <Mic className="w-5 h-5 text-destructive" />
              </motion.button>
              <div className="flex-1 min-w-0">
                <p className="text-xs text-destructive font-medium">{error}</p>
                <p className="text-[10px] text-muted-foreground">Tap to try again</p>
              </div>
            </motion.div>
          )}

          {/* ──── RECORDING ──── */}
          {phase === "recording" && (
            <motion.div key="recording" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4 space-y-2.5">
              <div className="flex items-center gap-3">
                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={stopRecording}
                  className="relative w-12 h-12 rounded-full bg-destructive/15 border border-destructive/30 flex items-center justify-center shrink-0"
                >
                  <motion.div
                    className="absolute inset-0 rounded-full border-2 border-destructive/40"
                    animate={{ scale: [1, 1.3, 1], opacity: [0.6, 0, 0.6] }}
                    transition={{ duration: 1.5, repeat: Infinity }}
                  />
                  <MicOff className="w-5 h-5 text-destructive" />
                </motion.button>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <motion.div className="w-2 h-2 rounded-full bg-destructive" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                    <span className="text-xs font-semibold text-foreground">Recording</span>
                    <span className="text-[10px] text-muted-foreground ml-auto font-mono">{elapsed}s / {MAX_DURATION}s</span>
                  </div>
                  <div className="mt-2 h-1 rounded-full bg-secondary overflow-hidden">
                    <motion.div className="h-full rounded-full bg-destructive/60" style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }} transition={{ duration: 0.3 }} />
                  </div>
                </div>
              </div>

              {/* Rotating hints */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={hintIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  transition={{ duration: 0.3 }}
                  className="text-[10px] text-muted-foreground text-center leading-relaxed"
                >
                  {RECORDING_HINTS[hintIndex]}
                </motion.p>
              </AnimatePresence>

              <p className="text-[9px] text-muted-foreground text-center">Tap mic to stop & process</p>
            </motion.div>
          )}

          {/* ──── PROCESSING ──── */}
          {(phase === "transcribing" || phase === "extracting" || phase === "mapping") && (
            <motion.div key="processing" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}>
                    <Loader2 className="w-5 h-5 text-primary" />
                  </motion.div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground">{PHASE_LABELS[phase]}</p>
                  <div className="flex items-center gap-1.5 mt-2">
                    {(["transcribing", "extracting", "mapping"] as Phase[]).map((p, i) => {
                      const steps: Phase[] = ["transcribing", "extracting", "mapping"];
                      const currentIdx = steps.indexOf(phase);
                      return (
                        <div key={p} className={`rounded-full transition-all duration-300 ${
                          i < currentIdx ? "w-1.5 h-1.5 bg-primary" : i === currentIdx ? "w-3 h-1.5 bg-primary animate-pulse" : "w-1.5 h-1.5 bg-border"
                        }`} />
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {/* ──── CLARIFY ──── */}
          {phase === "clarify" && (
            <motion.div key="clarify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <MessageCircle className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">Help me understand</span>
              </div>
              <p className="text-[10px] text-muted-foreground leading-relaxed">
                I couldn't clearly identify the topics. Could you type what you studied? For example: <span className="text-foreground italic">"Physics — Newton's Laws"</span>
              </p>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={clarifyText}
                  onChange={(e) => setClarifyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClarifySubmit()}
                  placeholder="e.g., Chemistry — Organic Reactions"
                  className="flex-1 text-xs bg-secondary/30 border border-border/30 rounded-lg px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClarifySubmit}
                  disabled={!clarifyText.trim()}
                  className="px-3 py-2 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium disabled:opacity-40"
                >
                  Go
                </motion.button>
              </div>
              <button onClick={() => { setPhase("idle"); setClarifyText(""); }} className="text-[9px] text-muted-foreground hover:text-foreground transition-colors">
                Skip & try recording again
              </button>
            </motion.div>
          )}

          {/* ──── DONE ──── */}
          {phase === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-4 space-y-3">
              <div className="flex items-center gap-2">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 400 }}>
                  <CheckCircle className="w-5 h-5 text-primary" />
                </motion.div>
                <span className="text-sm font-semibold text-foreground">Brain Updated</span>
                {stabilityBoost > 0 && (
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-bold text-primary">
                    <Zap className="w-3 h-3" />+{stabilityBoost}% stability
                  </span>
                )}
              </div>

              {results.length > 0 && (
                <div className="space-y-1.5">
                  {results.map((r, i) => (
                    <div key={i}>
                      <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">{r.subject}</span>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {r.topics.map((t, j) => (
                          <motion.span key={j} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: j * 0.08 }} className="text-[9px] px-1.5 py-0.5 rounded-md bg-secondary/50 text-muted-foreground border border-border/30">
                            {t}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalTopics === 0 && (
                <p className="text-[10px] text-muted-foreground">All mentioned topics already exist in your brain.</p>
              )}

              {totalTopics > 0 && (
                <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                  <Brain className="w-3 h-3" />
                  <span>First recall in 24h · {totalTopics} topic{totalTopics > 1 ? "s" : ""} mapped</span>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
};

export default VoiceBrainCapture;
