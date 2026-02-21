import React, { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Brain, CheckCircle, Loader2, Zap,
  BookOpen, Target, PenLine, ThumbsUp, MessageCircle, Sparkles,
  Clock, ChevronRight, Star, History, Volume2,
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

/* ── Animated gradient ring ── */
const GradientRing = ({ size = 80, duration = 8, delay = 0, isRecording = false }: { size?: number; duration?: number; delay?: number; isRecording?: boolean }) => (
  <motion.div
    className="absolute rounded-full"
    style={{
      width: size, height: size, top: "50%", left: "50%", marginTop: -size / 2, marginLeft: -size / 2,
      background: isRecording
        ? `conic-gradient(from ${delay * 90}deg, hsl(var(--destructive) / 0.3), transparent, hsl(var(--destructive) / 0.15), transparent)`
        : `conic-gradient(from ${delay * 90}deg, hsl(var(--primary) / 0.25), hsl(var(--accent) / 0.15), transparent, hsl(var(--primary) / 0.1))`,
      padding: 1,
    }}
    animate={{ rotate: 360 }}
    transition={{ duration, repeat: Infinity, ease: "linear", delay }}
  >
    <div className="w-full h-full rounded-full bg-card" />
  </motion.div>
);

/* ── Floating particle ── */
const FloatingParticle = ({ delay = 0, x = 0 }: { delay?: number; x?: number }) => (
  <motion.div
    className="absolute w-1 h-1 rounded-full bg-primary/40"
    style={{ left: `${50 + x}%`, bottom: "20%" }}
    animate={{ y: [-10, -40, -60], opacity: [0, 0.8, 0], scale: [0.5, 1, 0.3] }}
    transition={{ duration: 2.5, repeat: Infinity, delay, ease: "easeOut" }}
  />
);

interface RecentSubject {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

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
  const [recentSubjects, setRecentSubjects] = useState<RecentSubject[]>([]);
  const [quickMode, setQuickMode] = useState(false);
  const [selectedQuickSubject, setSelectedQuickSubject] = useState<string | null>(null);
  const [selectedQuickTopics, setSelectedQuickTopics] = useState<string[]>([]);
  const [quickLogging, setQuickLogging] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef(0);
  const hintTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const silenceCheckRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Load recent subjects & topics for quick-tap
  useEffect(() => {
    if (!user) return;
    const loadRecent = async () => {
      const { data: subjects } = await supabase.from("subjects").select("id, name").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6);
      if (!subjects?.length) return;
      const enriched: RecentSubject[] = [];
      for (const sub of subjects) {
        const { data: topics } = await supabase.from("topics").select("id, name").eq("user_id", user.id).eq("subject_id", sub.id).order("last_revision_date", { ascending: false }).limit(8);
        enriched.push({ id: sub.id, name: sub.name, topics: topics || [] });
      }
      setRecentSubjects(enriched);
    };
    loadRecent();
  }, [user]);

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

  // ── Quick-tap log ──
  const handleQuickLog = async () => {
    if (!user || !selectedQuickSubject || selectedQuickTopics.length === 0) return;
    setQuickLogging(true);
    triggerHaptic([10]);
    try {
      const confLevel = selectedConfidence === "High" ? "high" : selectedConfidence === "Medium" ? "medium" : "low";
      const sub = recentSubjects.find(s => s.name === selectedQuickSubject);
      for (const topicName of selectedQuickTopics) {
        const topic = sub?.topics.find(t => t.name === topicName);
        // Boost memory
        const { data: existing } = await supabase.from("topics").select("memory_strength").eq("user_id", user.id).eq("name", topicName).maybeSingle();
        const current = Number(existing?.memory_strength) || 0;
        const boosted = Math.min(99, Math.max(current + 15, 50));
        await supabase.from("topics").update({ memory_strength: boosted, last_revision_date: new Date().toISOString(), next_predicted_drop_date: new Date(Date.now() + 86400000).toISOString() }).eq("user_id", user.id).eq("name", topicName);
        // Study log
        await supabase.from("study_logs").insert({
          user_id: user.id,
          subject_id: sub?.id || null,
          topic_id: topic?.id || null,
          duration_minutes: 5,
          confidence_level: confLevel,
          study_mode: selectedStudyType?.toLowerCase() || "focus",
          notes: `Quick log: ${topicName}`,
        });
      }
      confetti({ particleCount: 100, spread: 60, origin: { y: 0.6 }, zIndex: 9999 });
      toast({ title: "🧠 Brain Updated!", description: `${selectedQuickTopics.length} topic${selectedQuickTopics.length > 1 ? "s" : ""} logged!` });
      triggerHaptic([15, 30, 15]);
      onSuccess?.();
      // Reset
      setSelectedQuickSubject(null);
      setSelectedQuickTopics([]);
      setQuickMode(false);
      setSelectedStudyType(null);
      setSelectedConfidence(null);
    } catch (e) {
      console.error("Quick log error:", e);
      toast({ title: "Failed to log", variant: "destructive" });
    } finally {
      setQuickLogging(false);
    }
  };

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
        const SILENCE_THRESHOLD = 5;
        const SILENCE_DURATION_MS = 5000;
        const MIN_RECORD_MS = 3000;

        silenceCheckRef.current = setInterval(() => {
          if (mediaRecorderRef.current?.state !== "recording") return;
          analyser.getByteTimeDomainData(dataArray);
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
          const { data: existing } = await supabase.from("topics").select("memory_strength").eq("user_id", user.id).eq("name", topicName).maybeSingle();
          const current = Number(existing?.memory_strength) || 0;
          const boosted = Math.min(99, Math.max(current + 15, 50));
          await supabase.from("topics").update({ memory_strength: boosted, last_revision_date: new Date().toISOString(), next_predicted_drop_date: new Date(Date.now() + 86400000).toISOString() }).eq("user_id", user.id).eq("name", topicName);
        }
      }
      boost = Math.min(8, data.totalTopicsCreated * 2);

      const confLevel = selectedConfidence === "High" ? "high" : selectedConfidence === "Medium" ? "medium" : selectedConfidence === "Low" ? "low" : "medium";
      for (const res of data.results || []) {
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

      confetti({ particleCount: 120, spread: 70, origin: { y: 0.6 }, zIndex: 9999 });
      toast({ title: "🧠 Brain Updated!", description: `${data.totalTopicsCreated} topic${data.totalTopicsCreated > 1 ? "s" : ""} mapped successfully!` });
    } else {
      toast({ title: "✅ Brain Synced", description: "Topics already exist in your brain." });
    }
    setStabilityBoost(boost); setPhase("done"); triggerHaptic([15, 30, 15]);
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
  const selectedSubjectData = recentSubjects.find(s => s.name === selectedQuickSubject);
  const hasRecent = recentSubjects.length > 0;

  return (
    <motion.div layout className="relative">
      {/* ── Background gradient aura ── */}
      <div className="absolute inset-0 -m-4 rounded-3xl pointer-events-none overflow-hidden">
        <motion.div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-3xl"
          style={{ background: "radial-gradient(circle, hsl(var(--primary) / 0.06) 0%, hsl(var(--accent) / 0.04) 40%, transparent 70%)" }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.5, 0.8, 0.5] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
        />
      </div>

      {/* ── Glass card ── */}
      <motion.div
        layout
        className="relative rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(145deg, hsl(var(--card)) 0%, hsl(var(--secondary) / 0.3) 50%, hsl(var(--card)) 100%)",
          border: "1px solid hsl(var(--border) / 0.6)",
        }}
      >
        {/* Animated gradient top border */}
        <motion.div
          className="absolute top-0 left-0 right-0 h-[2px]"
          style={{ background: "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.6) 30%, hsl(var(--accent) / 0.5) 50%, hsl(var(--primary) / 0.6) 70%, transparent 100%)" }}
          animate={{ opacity: [0.3, 0.9, 0.3] }}
          transition={{ duration: 3, repeat: Infinity }}
        />

        <AnimatePresence mode="wait">
          {/* ════════ IDLE ════════ */}
          {phase === "idle" && !error && (
            <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="p-5">
              {/* Title row */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))" }}>
                    <Brain className="w-4 h-4 text-primary" />
                  </div>
                  <div>
                    <p className="text-sm font-display font-bold text-foreground">What I Studied ?</p>
                    <p className="text-[9px] text-muted-foreground">Voice or Quick-tap to log</p>
                  </div>
                </div>
                {hasRecent && (
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => setQuickMode(!quickMode)}
                    className={`text-[9px] px-2.5 py-1.5 rounded-full border transition-all flex items-center gap-1 ${
                      quickMode
                        ? "bg-primary/15 border-primary/30 text-primary font-semibold"
                        : "bg-secondary/40 border-border/40 text-muted-foreground hover:border-primary/20"
                    }`}
                  >
                    <Zap className="w-3 h-3" />
                    {quickMode ? "Voice mode" : "Quick tap"}
                  </motion.button>
                )}
              </div>

              {/* ── Quick-tap mode ── */}
              <AnimatePresence mode="wait">
                {quickMode && hasRecent ? (
                  <motion.div
                    key="quick"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    {/* Subject chips */}
                    <div>
                      <p className="text-[9px] text-muted-foreground mb-1.5 flex items-center gap-1">
                        <BookOpen className="w-3 h-3" /> Select Subject
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {recentSubjects.map((sub, i) => (
                          <motion.button
                            key={sub.id}
                            initial={{ opacity: 0, scale: 0.9 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: i * 0.04 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => {
                              setSelectedQuickSubject(selectedQuickSubject === sub.name ? null : sub.name);
                              setSelectedQuickTopics([]);
                            }}
                            className={`text-[10px] px-3 py-1.5 rounded-xl border transition-all ${
                              selectedQuickSubject === sub.name
                                ? "border-primary/40 text-primary font-semibold shadow-sm"
                                : "border-border/30 text-muted-foreground hover:border-primary/20"
                            }`}
                            style={{
                              background: selectedQuickSubject === sub.name
                                ? "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.06))"
                                : "hsl(var(--secondary) / 0.3)",
                            }}
                          >
                            {sub.name}
                          </motion.button>
                        ))}
                      </div>
                    </div>

                    {/* Topic chips (only when subject selected) */}
                    <AnimatePresence>
                      {selectedSubjectData && selectedSubjectData.topics.length > 0 && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <p className="text-[9px] text-muted-foreground mb-1.5 flex items-center gap-1">
                            <Target className="w-3 h-3" /> Select Topics <span className="text-primary/60">(multi-select)</span>
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {selectedSubjectData.topics.map((topic, j) => {
                              const isSelected = selectedQuickTopics.includes(topic.name);
                              return (
                                <motion.button
                                  key={topic.id}
                                  initial={{ opacity: 0, y: 6 }}
                                  animate={{ opacity: 1, y: 0 }}
                                  transition={{ delay: j * 0.03 }}
                                  whileTap={{ scale: 0.95 }}
                                  onClick={() => {
                                    setSelectedQuickTopics(prev =>
                                      isSelected ? prev.filter(t => t !== topic.name) : [...prev, topic.name]
                                    );
                                  }}
                                  className={`text-[9px] px-2.5 py-1 rounded-lg border transition-all flex items-center gap-1 ${
                                    isSelected
                                      ? "border-primary/40 text-primary font-medium"
                                      : "border-border/30 text-muted-foreground hover:border-primary/20"
                                  }`}
                                  style={{
                                    background: isSelected
                                      ? "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.05))"
                                      : "hsl(var(--secondary) / 0.2)",
                                  }}
                                >
                                  {isSelected && <CheckCircle className="w-2.5 h-2.5" />}
                                  {topic.name}
                                </motion.button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Study type + confidence (compact row) */}
                    {selectedQuickTopics.length > 0 && (
                      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-1">
                        <div className="flex gap-3">
                          <div className="flex-1">
                            <p className="text-[8px] text-muted-foreground mb-1">Study type</p>
                            <div className="flex flex-wrap gap-1">
                              {STUDY_TYPES.map((st) => (
                                <button key={st} onClick={() => setSelectedStudyType(selectedStudyType === st ? null : st)}
                                  className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${
                                    selectedStudyType === st ? "bg-primary/12 border-primary/30 text-primary font-medium" : "bg-secondary/30 border-border/30 text-muted-foreground"
                                  }`}
                                >{st}</button>
                              ))}
                            </div>
                          </div>
                          <div>
                            <p className="text-[8px] text-muted-foreground mb-1">Confidence</p>
                            <div className="flex gap-1">
                              {CONFIDENCE_LEVELS.map((cl) => (
                                <button key={cl} onClick={() => setSelectedConfidence(selectedConfidence === cl ? null : cl)}
                                  className={`text-[8px] px-2 py-0.5 rounded-full border transition-all ${
                                    selectedConfidence === cl ? "bg-primary/12 border-primary/30 text-primary font-medium" : "bg-secondary/30 border-border/30 text-muted-foreground"
                                  }`}
                                >{cl}</button>
                              ))}
                            </div>
                          </div>
                        </div>

                        {/* Log button */}
                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          onClick={handleQuickLog}
                          disabled={quickLogging}
                          className="w-full py-2.5 rounded-xl text-xs font-bold text-primary-foreground flex items-center justify-center gap-2 disabled:opacity-50"
                          style={{
                            background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent) / 0.8), hsl(var(--primary)))",
                            boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)",
                          }}
                        >
                          {quickLogging ? (
                            <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Logging...</>
                          ) : (
                            <><Zap className="w-3.5 h-3.5" /> Log {selectedQuickTopics.length} topic{selectedQuickTopics.length > 1 ? "s" : ""}</>
                          )}
                        </motion.button>
                      </motion.div>
                    )}

                    {/* Empty state for no topics */}
                    {selectedSubjectData && selectedSubjectData.topics.length === 0 && (
                      <p className="text-[9px] text-muted-foreground text-center py-2">No topics yet — use voice to add new ones</p>
                    )}
                  </motion.div>
                ) : (
                  /* ── Voice mode (original) ── */
                  <motion.div
                    key="voice"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="flex flex-col items-center text-center space-y-4"
                  >
                    {/* Central mic with gradient rings */}
                    <div className="relative w-28 h-28 flex items-center justify-center">
                      <GradientRing size={110} duration={12} delay={0} />
                      <GradientRing size={88} duration={8} delay={0.5} />
                      <GradientRing size={66} duration={10} delay={1} />
                      <FloatingParticle delay={0} x={-8} />
                      <FloatingParticle delay={0.8} x={6} />
                      <FloatingParticle delay={1.5} x={-3} />

                      <motion.button
                        whileHover={{ scale: 1.08 }}
                        whileTap={{ scale: 0.92 }}
                        onClick={startRecording}
                        className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
                        style={{
                          background: "linear-gradient(145deg, hsl(var(--primary) / 0.2), hsl(var(--accent) / 0.1), hsl(var(--primary) / 0.08))",
                          border: "1.5px solid hsl(var(--primary) / 0.3)",
                          boxShadow: "0 0 30px hsl(var(--primary) / 0.15), inset 0 1px 0 hsl(var(--primary) / 0.1)",
                        }}
                      >
                        <Mic className="w-6 h-6 text-primary" />
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ border: "1px solid hsl(var(--primary) / 0.2)" }}
                          animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0, 0.5] }}
                          transition={{ duration: 2.5, repeat: Infinity }}
                        />
                      </motion.button>
                    </div>

                    <p className="text-[10px] text-muted-foreground max-w-[220px] leading-relaxed">
                      Tap to speak in <span className="text-primary font-medium">Hindi</span> or <span className="text-primary font-medium">English</span> — AI auto-translates & maps your memory
                    </p>

                    {/* How-to toggle */}
                    <button
                      onClick={() => setShowGuide(!showGuide)}
                      className="text-[9px] px-3 py-1 rounded-full border border-border/30 hover:border-primary/20 text-muted-foreground hover:text-foreground transition-all flex items-center gap-1"
                      style={{ background: "hsl(var(--secondary) / 0.3)" }}
                    >
                      {showGuide ? "Hide guide" : "How to speak?"}
                      <ChevronRight className={`w-3 h-3 transition-transform ${showGuide ? "rotate-90" : ""}`} />
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
                                  <div
                                    className="w-8 h-8 rounded-full flex items-center justify-center"
                                    style={{
                                      background: step.optional
                                        ? "hsl(var(--secondary) / 0.5)"
                                        : "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.08))",
                                      border: step.optional ? "1px solid hsl(var(--border) / 0.4)" : "1px solid hsl(var(--primary) / 0.25)",
                                    }}
                                  >
                                    <step.icon className={`w-3.5 h-3.5 ${step.optional ? "text-muted-foreground" : "text-primary"}`} />
                                  </div>
                                  <span className="text-[9px] font-medium text-foreground">{step.label}</span>
                                  <span className="text-[8px] text-muted-foreground">{step.example}</span>
                                </motion.div>
                              ))}
                            </div>

                            {/* English example */}
                            <div className="rounded-xl px-3 py-2.5 mx-auto max-w-[280px]" style={{ background: "linear-gradient(135deg, hsl(var(--secondary) / 0.3), hsl(var(--card)))", border: "1px solid hsl(var(--border) / 0.3)" }}>
                              <p className="text-[9px] text-muted-foreground mb-1">🇬🇧 English example:</p>
                              <p className="text-[10px] text-foreground italic leading-relaxed">
                                "I revised <span className="text-primary font-medium">Physics</span>, <span className="text-primary font-medium">Newton's Third Law</span>, did practice problems, feeling <span className="text-primary font-medium">confident</span>"
                              </p>
                            </div>

                            {/* Hindi example */}
                            <div className="rounded-xl px-3 py-2.5 mx-auto max-w-[280px]" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.05), hsl(var(--accent) / 0.03))", border: "1px solid hsl(var(--primary) / 0.15)" }}>
                              <p className="text-[9px] text-muted-foreground mb-1">🇮🇳 Hindi / हिंदी example:</p>
                              <p className="text-[10px] text-foreground italic leading-relaxed">
                                "मैंने <span className="text-primary font-medium">Chemistry</span> पढ़ा, <span className="text-primary font-medium">Organic Reactions</span> revise किया, practice भी की"
                              </p>
                              <p className="text-[8px] text-muted-foreground mt-1">↑ AI will auto-translate this to English</p>
                            </div>

                            {/* Quick-tap context */}
                            <div className="space-y-2 text-left px-2">
                              <div>
                                <p className="text-[9px] text-muted-foreground mb-1.5 text-center">Study type</p>
                                <div className="flex flex-wrap justify-center gap-1.5">
                                  {STUDY_TYPES.map((st) => (
                                    <button key={st} onClick={() => setSelectedStudyType(selectedStudyType === st ? null : st)}
                                      className={`text-[9px] px-2.5 py-1 rounded-full border transition-all ${
                                        selectedStudyType === st ? "bg-primary/15 border-primary/30 text-primary font-medium shadow-sm shadow-primary/10" : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/20"
                                      }`}
                                    >{st}</button>
                                  ))}
                                </div>
                              </div>
                              <div>
                                <p className="text-[9px] text-muted-foreground mb-1.5 text-center">Confidence</p>
                                <div className="flex justify-center gap-1.5">
                                  {CONFIDENCE_LEVELS.map((cl) => (
                                    <button key={cl} onClick={() => setSelectedConfidence(selectedConfidence === cl ? null : cl)}
                                      className={`text-[9px] px-3 py-1 rounded-full border transition-all ${
                                        selectedConfidence === cl ? "bg-primary/15 border-primary/30 text-primary font-medium shadow-sm shadow-primary/10" : "bg-secondary/30 border-border/30 text-muted-foreground hover:border-primary/20"
                                      }`}
                                    >{cl}</button>
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
              </AnimatePresence>
            </motion.div>
          )}

          {/* ════════ ERROR ════════ */}
          {phase === "idle" && error && (
            <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-5 flex flex-col items-center text-center space-y-3">
              <motion.button whileTap={{ scale: 0.9 }} onClick={() => { setError(null); startRecording(); }}
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, hsl(var(--destructive) / 0.1), hsl(var(--destructive) / 0.05))", border: "1px solid hsl(var(--destructive) / 0.2)" }}
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
              <div className="relative w-28 h-28 flex items-center justify-center">
                {/* Gradient recording rings */}
                <GradientRing size={110} duration={6} delay={0} isRecording />
                <GradientRing size={88} duration={4} delay={0.3} isRecording />
                <GradientRing size={66} duration={5} delay={0.6} isRecording />

                {/* Sound wave pulses */}
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="absolute rounded-full"
                    style={{
                      width: 60 + i * 24, height: 60 + i * 24,
                      border: "1px solid hsl(var(--destructive) / 0.15)",
                    }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.05, 0.3] }}
                    transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.25 }}
                  />
                ))}

                <motion.button
                  whileTap={{ scale: 0.9 }}
                  onClick={stopRecording}
                  className="relative z-10 w-16 h-16 rounded-full flex items-center justify-center"
                  style={{
                    background: "linear-gradient(145deg, hsl(var(--destructive) / 0.2), hsl(var(--destructive) / 0.08))",
                    border: "1.5px solid hsl(var(--destructive) / 0.35)",
                    boxShadow: "0 0 30px hsl(var(--destructive) / 0.15)",
                  }}
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
              <div className="w-full max-w-[200px] h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{
                    width: `${(elapsed / MAX_DURATION) * 100}%`,
                    background: "linear-gradient(90deg, hsl(var(--destructive) / 0.4), hsl(var(--destructive) / 0.7))",
                  }}
                />
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
              <div className="relative w-20 h-20 flex items-center justify-center">
                <motion.div
                  className="absolute inset-0 rounded-full"
                  style={{ background: "conic-gradient(from 0deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.2), transparent, hsl(var(--primary) / 0.3))" }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                />
                <div className="absolute inset-[3px] rounded-full bg-card" />
                <motion.div className="relative z-10" animate={{ scale: [1, 1.1, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>
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

              <div className="w-full max-w-[180px] h-1.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
                <motion.div
                  className="h-full rounded-full"
                  animate={{ width: `${progressPct}%` }}
                  transition={{ duration: 0.5 }}
                  style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.5), hsl(var(--accent) / 0.6), hsl(var(--primary) / 0.7))" }}
                />
              </div>

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
              <div className="w-12 h-12 rounded-full flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.06))", border: "1px solid hsl(var(--primary) / 0.2)" }}>
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
                  className="px-3 py-2 rounded-xl text-primary text-xs font-medium disabled:opacity-40"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--accent) / 0.06))", border: "1px solid hsl(var(--primary) / 0.2)" }}
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
                  className="absolute inset-0 rounded-full"
                  style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))" }}
                  initial={{ scale: 0 }}
                  animate={{ scale: [0, 2, 1.6], opacity: [0.5, 0.1, 0] }}
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
                    className="text-xs font-bold mt-1 flex items-center justify-center gap-1"
                    style={{ color: "hsl(var(--primary))" }}
                  >
                    <Zap className="w-3.5 h-3.5" />+{stabilityBoost}% stability
                  </motion.p>
                )}
              </div>

              {/* Extracted topics with gradient badges */}
              {results.length > 0 && (
                <div className="space-y-2 w-full max-w-[280px]">
                  {results.map((r, i) => (
                    <div key={i} className="space-y-1">
                      <motion.span
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.15 }}
                        className="inline-block text-[10px] font-semibold px-2.5 py-0.5 rounded-full text-primary"
                        style={{
                          background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--accent) / 0.06))",
                          border: "1px solid hsl(var(--primary) / 0.2)",
                        }}
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
                            className="text-[9px] px-2 py-0.5 rounded-lg text-muted-foreground"
                            style={{
                              background: "linear-gradient(135deg, hsl(var(--secondary) / 0.4), hsl(var(--card)))",
                              border: "1px solid hsl(var(--border) / 0.3)",
                            }}
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
              <div className="w-full max-w-[180px] h-0.5 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary))" }}>
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.4))" }}
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
