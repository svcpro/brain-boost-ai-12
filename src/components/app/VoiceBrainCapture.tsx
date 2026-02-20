import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Brain, CheckCircle, Loader2, Zap,
  BookOpen, Target, PenLine, ThumbsUp, MessageCircle, Sparkles,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";

interface ExtractedResult {
  subject: string;
  topics: string[];
}

type Phase = "idle" | "recording" | "transcribing" | "extracting" | "mapping" | "done" | "clarify";

const MAX_DURATION = 60;

const SPEAKING_STEPS = [
  { icon: BookOpen, label: "Subject", example: "Physics" },
  { icon: Target, label: "Topic", example: "Newton's Laws" },
  { icon: PenLine, label: "Activity", example: "Revised 3rd law" },
  { icon: ThumbsUp, label: "Confidence", example: "Optional", optional: true },
];

const RECORDING_HINTS = [
  "💡 \"I studied Organic Chemistry, Alkenes, revision, feeling good\"",
  "🇮🇳 Hindi में बोलो! \"मैंने Physics पढ़ा, Newton's Laws revise किया\"",
  "🎯 Mention the subject first, then the specific topic",
  "📝 Say what you did — revised, practiced, read, solved",
  "⭐ Add how confident you feel — optional but helpful",
  "🧠 Speak in Hindi or English — AI auto-translates to English",
  "📚 You can mention multiple topics at once",
];

const STUDY_TYPES = ["Revision", "Practice", "Reading", "Solving", "Lecture"];
const CONFIDENCE_LEVELS = ["Low", "Medium", "High"];

/* ── Orbital ring that spins around the mic ── */
const OrbitalRing = ({ delay = 0, size = 80, duration = 8 }: { delay?: number; size?: number; duration?: number }) => (
  <motion.div
    className="absolute rounded-full border border-primary/15"
    style={{ width: size, height: size, top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2 }}
    animate={{ rotate: 360 }}
    transition={{ duration, repeat: Infinity, ease: "linear", delay }}
  >
    <motion.div
      className="absolute w-1.5 h-1.5 rounded-full bg-primary/40"
      style={{ top: -3, left: "50%", marginLeft: -3 }}
      animate={{ scale: [1, 1.6, 1], opacity: [0.4, 1, 0.4] }}
      transition={{ duration: 2, repeat: Infinity, delay }}
    />
  </motion.div>
);

const VoiceBrainCapture = ({ onSuccess }: { onSuccess?: () => void }) => {
  const { user } = useAuth();
  const { toast } = useToast();
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
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (hintTimerRef.current) clearInterval(hintTimerRef.current);
      if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
      if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
      if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    };
  }, []);

  useEffect(() => {
    if (phase === "recording") {
      hintTimerRef.current = setInterval(() => setHintIndex((i) => (i + 1) % RECORDING_HINTS.length), 3500);
    } else {
      if (hintTimerRef.current) clearInterval(hintTimerRef.current);
    }
    return () => { if (hintTimerRef.current) clearInterval(hintTimerRef.current); };
  }, [phase]);

  const startRecording = useCallback(async () => {
    if (!user) return;
    setError(null); setResults([]); setTotalTopics(0); setStabilityBoost(0); setShowGuide(false); setClarifyText("");
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream, { mimeType: "audio/webm" });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];
      recorder.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        if (timerRef.current) clearInterval(timerRef.current);
        if (silenceCheckRef.current) clearInterval(silenceCheckRef.current);
        if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current);
        processAudio();
      };
      recorder.start();
      startTimeRef.current = Date.now();
      setPhase("recording"); setElapsed(0); setHintIndex(0);
      triggerHaptic([15]);
      timerRef.current = setInterval(() => { const secs = Math.floor((Date.now() - startTimeRef.current) / 1000); setElapsed(secs); if (secs >= MAX_DURATION) recorder.stop(); }, 250);

      // Silence detection: auto-stop after 5s of silence (only after at least 3s of recording)
      try {
        const audioCtx = new AudioContext();
        const source = audioCtx.createMediaStreamSource(stream);
        const analyser = audioCtx.createAnalyser();
        analyser.fftSize = 2048;
        analyser.smoothingTimeConstant = 0.3;
        source.connect(analyser);
        analyserRef.current = analyser;
        const dataArray = new Uint8Array(analyser.fftSize);
        let silentSince: number | null = null;
        const SILENCE_THRESHOLD = 5; // RMS threshold for silence
        const SILENCE_DURATION_MS = 5000;
        const MIN_RECORD_MS = 3000;

        silenceCheckRef.current = setInterval(() => {
          if (mediaRecorderRef.current?.state !== "recording") return;
          // Use time-domain data for reliable volume detection
          analyser.getByteTimeDomainData(dataArray);
          // Calculate RMS (root mean square) for accurate volume level
          let sumSquares = 0;
          for (let i = 0; i < dataArray.length; i++) {
            const normalized = (dataArray[i] - 128) / 128;
            sumSquares += normalized * normalized;
          }
          const rms = Math.sqrt(sumSquares / dataArray.length) * 100;
          const recordedMs = Date.now() - startTimeRef.current;

          if (rms < SILENCE_THRESHOLD && recordedMs > MIN_RECORD_MS) {
            if (!silentSince) silentSince = Date.now();
            else if (Date.now() - silentSince >= SILENCE_DURATION_MS) {
              console.log("Auto-stopping: 5s silence detected");
              recorder.stop();
              audioCtx.close();
            }
          } else {
            silentSince = null;
          }
        }, 150);
      } catch (e) {
        console.warn("Silence detection not available:", e);
      }
    } catch {
      setError("Microphone access denied"); setPhase("idle");
    }
  }, [user]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") { mediaRecorderRef.current.stop(); triggerHaptic([10]); }
  }, []);

  const processAudio = useCallback(async () => {
    if (!user) return;
    const blob = new Blob(chunksRef.current, { type: "audio/webm" });
    if (blob.size < 1000) { setError("Recording too short"); setPhase("idle"); return; }
    setPhase("transcribing"); triggerHaptic([8]);
    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-capture.webm");
      setPhase("extracting");
      const { data, error: fnError } = await supabase.functions.invoke("extract-voice-topics", { body: formData });
      if (fnError || !data?.success) {
        if (data?.totalTopicsCreated === 0 && data?.success) { handleDoneWithResults(data); return; }
        const errMsg = data?.error || fnError?.message || "Failed to process";
        if (errMsg.includes("could not extract") || errMsg.includes("Could not")) { setPhase("clarify"); return; }
        setError(errMsg); setPhase("idle"); return;
      }
      if (data.totalTopicsCreated === 0) { handleDoneWithResults(data); return; }
      await handleDoneWithResults(data);
    } catch (e: any) {
      console.error("Voice capture error:", e); setError("Something went wrong"); setPhase("idle");
    }
  }, [user, elapsed, selectedStudyType, selectedConfidence]);

  const handleDoneWithResults = async (data: any) => {
    if (!user) return;
    setResults(data.results || []); setTotalTopics(data.totalTopicsCreated || 0);
    setPhase("mapping"); triggerHaptic([10, 20]);
    let boost = 0;
    if (data.totalTopicsCreated > 0) {
      // Find or create subject for the first extracted result
      let subjectId: string | null = null;
      const firstSubject = data.results?.[0]?.subject;
      if (firstSubject) {
        const { data: subRow } = await supabase.from("subjects").select("id").eq("user_id", user.id).eq("name", firstSubject).maybeSingle();
        if (subRow) {
          subjectId = subRow.id;
        } else {
          const { data: newSub } = await supabase.from("subjects").insert({ user_id: user.id, name: firstSubject }).select("id").single();
          subjectId = newSub?.id || null;
        }
      }

      for (const res of data.results || []) {
        for (const topicName of res.topics) {
          // Boost memory_strength by at least +15, capped at 99; never decrease it
          const { data: existing } = await supabase.from("topics").select("memory_strength").eq("user_id", user.id).eq("name", topicName).maybeSingle();
          const current = Number(existing?.memory_strength) || 0;
          const boosted = Math.min(99, Math.max(current + 15, 50));
          await supabase.from("topics").update({ memory_strength: boosted, last_revision_date: new Date().toISOString(), next_predicted_drop_date: new Date(Date.now() + 86400000).toISOString() }).eq("user_id", user.id).eq("name", topicName);
        }
      }
      boost = Math.min(8, data.totalTopicsCreated * 2);

      // Insert study log for each extracted topic so they appear in Recently Studied
      const confLevel = selectedConfidence === "High" ? "high" : selectedConfidence === "Medium" ? "medium" : selectedConfidence === "Low" ? "low" : "medium";
      for (const res of data.results || []) {
        // Find or create subject per result
        let resSubjectId = subjectId;
        if (res.subject && res.subject !== firstSubject) {
          const { data: sRow } = await supabase.from("subjects").select("id").eq("user_id", user.id).eq("name", res.subject).maybeSingle();
          if (sRow) resSubjectId = sRow.id;
          else {
            const { data: ns } = await supabase.from("subjects").insert({ user_id: user.id, name: res.subject }).select("id").single();
            resSubjectId = ns?.id || null;
          }
        }
        for (const topicName of res.topics) {
          // Get topic_id for this topic
          const { data: topicRow } = await supabase.from("topics").select("id").eq("user_id", user.id).eq("name", topicName).maybeSingle();
          const topicId = topicRow?.id || null;

          const logPayload: any = {
            user_id: user.id,
            duration_minutes: Math.max(1, Math.ceil(elapsed / 60)),
            confidence_level: confLevel,
            study_mode: selectedStudyType?.toLowerCase() || "focus",
            notes: `Voice capture: ${topicName}`,
          };
          if (resSubjectId) logPayload.subject_id = resSubjectId;
          if (topicId) logPayload.topic_id = topicId;
          const { error: logErr } = await supabase.from("study_logs").insert(logPayload);
          if (logErr) console.error("Study log insert failed:", logErr, logPayload);
        }
      }

      // Fire confetti + toast
      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
      toast({ title: "🧠 Brain Updated!", description: `${data.totalTopicsCreated} topic${data.totalTopicsCreated > 1 ? "s" : ""} mapped successfully!` });
    } else {
      toast({ title: "✅ Brain Synced", description: "Topics already exist in your brain." });
    }
    setStabilityBoost(boost); setPhase("done"); triggerHaptic([15, 30, 15]);
    // Trigger parent refresh so Topic Stability list updates immediately
    if (boost > 0) onSuccess?.();
    setTimeout(() => { setPhase("idle"); setSelectedStudyType(null); setSelectedConfidence(null); }, 4500);
  };

  const handleClarifySubmit = async () => {
    if (!clarifyText.trim() || !user) return;
    setPhase("extracting");
    try {
      const { data, error: fnError } = await supabase.functions.invoke("extract-voice-topics", { body: { transcript: clarifyText.trim() } });
      if (fnError || !data?.success) { setError("Still couldn't extract. Be more specific."); setPhase("idle"); return; }
      await handleDoneWithResults(data);
    } catch { setError("Something went wrong."); setPhase("idle"); }
  };

  const isProcessing = phase === "transcribing" || phase === "extracting" || phase === "mapping";
  const progressPct = phase === "transcribing" ? 20 : phase === "extracting" ? 55 : phase === "mapping" ? 85 : 0;

  return (
    <motion.div layout className="relative">
      {/* ── Background aura ── */}
      <div className="absolute inset-0 -m-4 rounded-3xl pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.08) 0%, transparent 70%)" }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.9, 0.6] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ── Glass card ── */}
      <motion.div
        layout
        className="relative glass rounded-2xl overflow-hidden"
      >
        {/* Shimmer line at top */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[1px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.5) 50%, transparent 100%)" }}
          animate={{ opacity: [0.3, 0.8, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        <AnimatePresence mode="wait">
          {/* ════════ IDLE ════════ */}
          {phase === "idle" && !error && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-5 flex flex-col items-center text-center space-y-4">
              {/* Central mic button with orbital rings */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                <OrbitalRing size={100} duration={12} delay={0} />
                <OrbitalRing size={80} duration={8} delay={0.5} />
                <OrbitalRing size={60} duration={10} delay={1} />

                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={startRecording}
                  className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center glow-primary"
                  style={{ background: "linear-gradient(145deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.08))", border: "1.5px solid hsl(var(--primary) / 0.3)" }}
                >
                  <Mic className="w-6 h-6 text-primary" />
                  {/* Inner pulse */}
                  <motion.div
                    className="absolute inset-0 rounded-full border border-primary/20"
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0, 0.5] }}
                    transition={{ duration: 2.5, repeat: Infinity }}
                  />
                </motion.button>
              </div>

              <div>
                <p className="text-sm font-display font-semibold text-foreground flex items-center justify-center gap-1.5">
                  <Brain className="w-4 h-4 text-primary" />
                  What I Studied ?
                </p>
                <p className="text-[10px] text-muted-foreground mt-1 max-w-[220px] leading-relaxed">
                  Tap to speak in Hindi or English — AI auto-translates & maps your memory
                </p>
              </div>

              {/* How-to toggle */}
              <button
                onClick={() => setShowGuide(!showGuide)}
                className="text-[10px] px-3 py-1 rounded-full bg-secondary/40 text-muted-foreground border border-border/30 hover:border-primary/20 hover:text-foreground transition-all"
              >
                {showGuide ? "Hide guide" : "How to speak?"}
              </button>

              {/* Expandable guide */}
              <AnimatePresence>
                {showGuide && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    className="w-full overflow-hidden"
                  >
                    <div className="space-y-3 pt-1">
                      {/* 4-step pills */}
                      <div className="flex justify-center gap-2">
                        {SPEAKING_STEPS.map((step, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.07 }}
                            className="flex flex-col items-center gap-1"
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${step.optional ? "bg-secondary/50 border border-border/40" : "bg-primary/10 border border-primary/20"}`}>
                              <step.icon className={`w-3.5 h-3.5 ${step.optional ? "text-muted-foreground" : "text-primary"}`} />
                            </div>
                            <span className="text-[9px] font-medium text-foreground">{step.label}</span>
                            <span className="text-[8px] text-muted-foreground">{step.example}</span>
                          </motion.div>
                        ))}
                      </div>

                      {/* English example */}
                      <div className="rounded-xl bg-secondary/20 border border-border/20 px-3 py-2.5 mx-auto max-w-[280px]">
                        <p className="text-[9px] text-muted-foreground mb-1">🇬🇧 English example:</p>
                        <p className="text-[10px] text-foreground italic leading-relaxed">
                          "I revised <span className="text-primary font-medium">Physics</span>, <span className="text-primary font-medium">Newton's Third Law</span>, did practice problems, feeling <span className="text-primary font-medium">confident</span>"
                        </p>
                      </div>

                      {/* Hindi example */}
                      <div className="rounded-xl bg-primary/5 border border-primary/15 px-3 py-2.5 mx-auto max-w-[280px]">
                        <p className="text-[9px] text-muted-foreground mb-1">🇮🇳 Hindi / हिंदी example:</p>
                        <p className="text-[10px] text-foreground italic leading-relaxed">
                          "मैंने <span className="text-primary font-medium">Chemistry</span> पढ़ा, <span className="text-primary font-medium">Organic Reactions</span> revise किया, practice भी की"
                        </p>
                        <p className="text-[8px] text-muted-foreground mt-1">
                          ↑ AI will auto-translate this to English
                        </p>
                      </div>

                      {/* Quick-tap context */}
                      <div className="space-y-2 text-left px-2">
                        <div>
                          <p className="text-[9px] text-muted-foreground mb-1.5 text-center">Study type</p>
                          <div className="flex flex-wrap justify-center gap-1.5">
                            {STUDY_TYPES.map((st) => (
                              <button
                                key={st}
                                onClick={() => setSelectedStudyType(selectedStudyType === st ? null : st)}
                                className={`text-[9px] px-2.5 py-1 rounded-full border transition-all ${
                                  selectedStudyType === st
                                    ? "bg-primary/15 border-primary/30 text-primary font-medium shadow-sm shadow-primary/10"
                                    : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/20"
                                }`}
                              >
                                {st}
                              </button>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[9px] text-muted-foreground mb-1.5 text-center">Confidence</p>
                          <div className="flex justify-center gap-1.5">
                            {CONFIDENCE_LEVELS.map((cl) => (
                              <button
                                key={cl}
                                onClick={() => setSelectedConfidence(selectedConfidence === cl ? null : cl)}
                                className={`text-[9px] px-3 py-1 rounded-full border transition-all ${
                                  selectedConfidence === cl
                                    ? "bg-primary/15 border-primary/30 text-primary font-medium shadow-sm shadow-primary/10"
                                    : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/20"
                                }`}
                              >
                                {cl}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* ════════ ERROR ════════ */}
          {phase === "idle" && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col items-center text-center space-y-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setError(null); startRecording(); }}
                className="w-14 h-14 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center"
              >
                <Mic className="w-6 h-6 text-destructive" />
              </motion.button>
              <p className="text-xs text-destructive font-medium">{error}</p>
              <p className="text-[10px] text-muted-foreground">Tap to try again</p>
            </motion.div>
          )}

          {/* ════════ RECORDING ════════ */}
          {phase === "recording" && (
            <motion.div key="recording" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col items-center text-center space-y-4">
              {/* Pulsing mic */}
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Sound wave rings */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full border border-destructive/20"
                    style={{ width: 60 + i * 24, height: 60 + i * 24 }}
                    animate={{ scale: [1, 1.15, 1], opacity: [0.4, 0.1, 0.4] }}
                    transition={{ duration: 1.5, repeat: Infinity, delay: i * 0.3 }}
                  />
                ))}

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={stopRecording}
                  className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
                  style={{ background: "linear-gradient(145deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.08))", border: "1.5px solid hsl(var(--destructive) / 0.35)" }}
                >
                  <MicOff className="w-6 h-6 text-destructive" />
                </motion.button>
              </div>

              {/* Timer */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-center gap-2">
                  <motion.div className="w-2 h-2 rounded-full bg-destructive" animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: 0.8, repeat: Infinity }} />
                  <span className="text-sm font-display font-semibold text-foreground">Listening</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">{elapsed}s / {MAX_DURATION}s</span>
              </div>

              {/* Progress arc */}
              <div className="w-full max-w-[200px] h-1 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full bg-destructive/50" style={{ width: `${(elapsed / MAX_DURATION) * 100}%` }} />
              </div>

              {/* Rotating hints */}
              <AnimatePresence mode="wait">
                <motion.p
                  key={hintIndex}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="text-[10px] text-muted-foreground max-w-[250px] leading-relaxed"
                >
                  {RECORDING_HINTS[hintIndex]}
                </motion.p>
              </AnimatePresence>

              <p className="text-[9px] text-muted-foreground">Tap mic to stop · auto-stops after 5s silence</p>
            </motion.div>
          )}

          {/* ════════ PROCESSING ════════ */}
          {isProcessing && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-6 flex flex-col items-center text-center space-y-4">
              {/* Animated brain */}
              <div className="relative w-20 h-20 flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "conic-gradient(from 0deg, hsl(var(--primary) / 0.3), transparent, hsl(var(--primary) / 0.3))" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-[3px] rounded-full bg-card" />
                <motion.div
                  className="relative z-10"
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  <Brain className="w-8 h-8 text-primary" />
                </motion.div>
              </div>

              <div className="space-y-1">
                <p className="text-sm font-display font-semibold text-foreground">
                  {phase === "transcribing" ? "Transcribing…" : phase === "extracting" ? "Extracting topics…" : "Mapping to brain…"}
                </p>
                <p className="text-[10px] text-muted-foreground">
                  {phase === "transcribing" ? "Converting voice to text" : phase === "extracting" ? "AI is identifying concepts" : "Updating your memory model"}
                </p>
              </div>

              {/* Progress bar */}
              <div className="w-full max-w-[180px] h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-primary/60"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>

              {/* Step dots */}
              <div className="flex items-center gap-2">
                {(["transcribing", "extracting", "mapping"] as Phase[]).map((p, i) => {
                  const steps: Phase[] = ["transcribing", "extracting", "mapping"];
                  const ci = steps.indexOf(phase);
                  return (
                    <motion.div
                      key={p}
                      className={`rounded-full transition-all ${
                        i < ci ? "w-2 h-2 bg-primary" : i === ci ? "w-4 h-2 bg-primary" : "w-2 h-2 bg-border"
                      }`}
                      animate={i === ci ? { opacity: [0.6, 1, 0.6] } : {}}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                  );
                })}
              </div>
            </motion.div>
          )}

          {/* ════════ CLARIFY ════════ */}
          {phase === "clarify" && (
            <motion.div key="clarify" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="p-5 flex flex-col items-center text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center">
                <MessageCircle className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-sm font-display font-semibold text-foreground">Help me understand</p>
                <p className="text-[10px] text-muted-foreground mt-1 max-w-[250px] leading-relaxed">
                  Couldn't identify topics clearly. Type what you studied below.
                </p>
              </div>
              <div className="flex gap-2 w-full max-w-[280px]">
                <input
                  type="text"
                  value={clarifyText}
                  onChange={(e) => setClarifyText(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleClarifySubmit()}
                  placeholder="e.g., Chemistry — Organic Reactions"
                  className="flex-1 text-xs bg-secondary/30 border border-border/30 rounded-xl px-3 py-2 text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40 transition-colors"
                />
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleClarifySubmit}
                  disabled={!clarifyText.trim()}
                  className="px-3 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-medium disabled:opacity-40"
                >
                  Go
                </motion.button>
              </div>
              <button onClick={() => { setPhase("idle"); setClarifyText(""); }} className="text-[9px] text-muted-foreground hover:text-foreground transition-colors">
                Skip & record again
              </button>
            </motion.div>
          )}

          {/* ════════ DONE ════════ */}
          {phase === "done" && (
            <motion.div key="done" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col items-center text-center space-y-3">
              {/* Success burst */}
              <div className="relative w-16 h-16 flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full bg-primary/10"
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 1.8, 1.4], opacity: [0.4, 0.1, 0] }}
                  transition={{ duration: 0.8 }}
                />
                <motion.div initial={{ scale: 0, rotate: -180 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 300, delay: 0.1 }}>
                  <CheckCircle className="w-8 h-8 text-primary" />
                </motion.div>
              </div>

              <div>
                <p className="text-sm font-display font-bold text-foreground flex items-center justify-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-primary" />
                  Brain Updated
                </p>
                {stabilityBoost > 0 && (
                  <motion.p
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-xs font-bold text-primary mt-1 flex items-center justify-center gap-1"
                  >
                    <Zap className="w-3.5 h-3.5" />+{stabilityBoost}% stability
                  </motion.p>
                )}
              </div>

              {/* Extracted topics */}
              {results.length > 0 && (
                <div className="space-y-2 w-full max-w-[280px]">
                  {results.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20"
                      >
                        {r.subject}
                      </motion.span>
                      <div className="flex flex-wrap justify-center gap-1">
                        {r.topics.map((t, j) => (
                          <motion.span
                            key={j}
                            initial={{ opacity: 0, y: 6, scale: 0.9 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            transition={{ delay: 0.2 + j * 0.06 }}
                            className="text-[9px] px-2 py-0.5 rounded-lg bg-secondary/40 text-muted-foreground border border-border/30"
                          >
                            {t}
                          </motion.span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {totalTopics === 0 && (
                <p className="text-[10px] text-muted-foreground">Topics already exist in your brain.</p>
              )}

              {totalTopics > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.4 }}
                  className="flex items-center gap-1.5 text-[9px] text-muted-foreground"
                >
                  <Brain className="w-3 h-3 text-primary/60" />
                  <span>First recall in 24h · {totalTopics} topic{totalTopics > 1 ? "s" : ""} mapped</span>
                </motion.div>
              )}

              {/* Auto-dismiss bar */}
              <div className="w-full max-w-[180px] h-0.5 rounded-full bg-secondary overflow-hidden">
                <motion.div
                  className="h-full bg-primary/30 rounded-full"
                  initial={{ width: "100%" }}
                  animate={{ width: "0%" }}
                  transition={{ duration: 4.5, ease: "linear" }}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.div>
  );
};

export default VoiceBrainCapture;
