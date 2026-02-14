import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Crosshair, AlertOctagon, Upload, FileText, Mic, Camera, CloudOff, Clock, RefreshCw, X, Square, CheckCircle2, Loader2, Brain, Eye, ArrowRight, Edit3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import StudyPlanGenerator from "./StudyPlanGenerator";
import { useToast } from "@/hooks/use-toast";
import { peekAll, removeFromQueue, type QueuedStudyLog } from "@/lib/offlineQueue";
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import LazyModeSession from "./LazyModeSession";
import FocusModeSession from "./FocusModeSession";
import EmergencyRecoverySession from "./EmergencyRecoverySession";
import FocusSessionHistory from "./FocusSessionHistory";

const modes = [
  {
    icon: Coffee,
    title: "Lazy Mode",
    desc: "Quick 5-min micro sessions. AI picks your weakest spots.",
    color: "text-primary",
    bg: "neural-gradient",
  },
  {
    icon: Crosshair,
    title: "Focus Mode",
    desc: "Deep study with distraction blocking. Maximum retention.",
    color: "text-success",
    bg: "bg-success/10",
  },
  {
    icon: AlertOctagon,
    title: "Emergency Recovery",
    desc: "Exam in <7 days? AI creates rapid rescue plan.",
    color: "text-destructive",
    bg: "bg-destructive/10",
  },
];

const ActionTab = () => {
  const [lazyModeOpen, setLazyModeOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState("");
  const [confidence, setConfidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [pendingEntries, setPendingEntries] = useState<QueuedStudyLog[]>(peekAll());
  const [syncing, setSyncing] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionResult, setExtractionResult] = useState<{ subject: string; topics: string[] }[] | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const { syncAll } = useOfflineSync();

  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimText, setInterimText] = useState("");

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");

  const handlePdfUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please select a PDF file.", variant: "destructive" });
      return;
    }

    // Check file size (max 10MB for AI processing)
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload a PDF under 10MB.", variant: "destructive" });
      return;
    }

    setUploadedFile(file.name);
    setExtracting(true);
    setExtractionResult(null);
    toast({ title: "📄 Processing PDF...", description: `Extracting topics from "${file.name}" with AI.` });

    try {
      const formData = new FormData();
      formData.append("pdf", file);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-pdf-topics`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
          },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.totalTopicsCreated > 0) {
        setExtractionResult(data.results);
        toast({
          title: `🧠 ${data.totalTopicsCreated} topics extracted!`,
          description: `Added to ${data.results.length} subject(s). Check your Brain tab!`,
        });
      } else if (data.success && data.totalTopicsCreated === 0) {
        toast({
          title: "No new topics found",
          description: "All topics from this PDF are already in your library.",
        });
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err: any) {
      toast({
        title: "Extraction failed",
        description: err?.message || "Could not extract topics from this PDF.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }, [toast]);

  const handleScanUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Please upload an image under 10MB.", variant: "destructive" });
      return;
    }

    setUploadedFile(file.name);
    setExtracting(true);
    setExtractionResult(null);
    toast({ title: "📸 Processing image...", description: `Extracting topics from "${file.name}" with AI.` });

    try {
      const formData = new FormData();
      formData.append("image", file);

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-image-topics`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.totalTopicsCreated > 0) {
        setExtractionResult(data.results);
        toast({
          title: `🧠 ${data.totalTopicsCreated} topics extracted!`,
          description: `Added to ${data.results.length} subject(s). Check your Brain tab!`,
        });
      } else if (data.success && data.totalTopicsCreated === 0) {
        toast({ title: "No new topics found", description: "All topics from this image are already in your library." });
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err?.message || "Could not extract topics from this image.", variant: "destructive" });
    } finally {
      setExtracting(false);
      e.target.value = "";
    }
  }, [toast]);

  const processVoiceRecording = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    setVoiceTranscript(null);
    setLiveTranscript("");
    setInterimText("");
    setExtractionResult(null);
    setVoiceBlob(blob);
    toast({ title: "🎙️ Transcribing...", description: "Converting your voice note to text." });

    try {
      const formData = new FormData();
      formData.append("audio", blob, "voice-note.webm");

      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/transcribe-voice`,
        {
          method: "POST",
          headers: { Authorization: `Bearer ${session?.access_token}` },
          body: formData,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Transcription failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.transcription) {
        setVoiceTranscript(data.transcription);
        setEditedTranscript(data.transcription);
        toast({ title: "✅ Transcription ready!", description: "Review the text, then confirm to extract topics." });
      } else {
        throw new Error(data.error || "No transcription returned");
      }
    } catch (err: any) {
      toast({ title: "Transcription failed", description: err?.message || "Could not transcribe recording.", variant: "destructive" });
      setVoiceBlob(null);
    } finally {
      setTranscribing(false);
    }
  }, [toast]);

  const confirmVoiceExtraction = useCallback(async () => {
    const transcript = editedTranscript.trim() || voiceTranscript;
    if (!transcript) return;
    setExtracting(true);
    setExtractionResult(null);
    toast({ title: "🧠 Extracting topics...", description: "AI is analyzing your transcript." });

    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-voice-topics`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session?.access_token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ transcript }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.totalTopicsCreated > 0) {
        setExtractionResult(data.results);
        toast({
          title: `🧠 ${data.totalTopicsCreated} topics extracted!`,
          description: `Added to ${data.results.length} subject(s). Check your Brain tab!`,
        });
      } else if (data.success && data.totalTopicsCreated === 0) {
        toast({ title: "No new topics found", description: "All topics from this recording are already in your library." });
      } else {
        throw new Error(data.error || "Extraction failed");
      }
      setVoiceTranscript(null);
      setVoiceBlob(null);
    } catch (err: any) {
      toast({ title: "Extraction failed", description: err?.message || "Could not extract topics.", variant: "destructive" });
    } finally {
      setExtracting(false);
    }
  }, [editedTranscript, voiceTranscript, toast]);

  const handleVoiceRecord = useCallback(async () => {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      if (recognitionRef.current) {
        recognitionRef.current.stop();
        recognitionRef.current = null;
      }
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];
      setLiveTranscript("");
      setInterimText("");
      finalTranscriptRef.current = "";

      // Start Web Speech API for real-time transcription
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = "en-US";
        let finalText = "";

        recognition.onresult = (event: any) => {
          let interim = "";
          for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
              finalText += transcript + " ";
              finalTranscriptRef.current = finalText.trim();
              setLiveTranscript(finalText.trim());
            } else {
              interim += transcript;
            }
          }
          setInterimText(interim);
        };

        recognition.onerror = (event: any) => {
          console.warn("Speech recognition error:", event.error);
        };

        recognition.onend = () => {
          // If still recording, restart (browser may stop it after silence)
          if (mediaRecorderRef.current?.state === "recording") {
            try { recognition.start(); } catch {}
          }
        };

        recognition.start();
        recognitionRef.current = recognition;
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        setUploadedFile(`Voice recording (${sizeMB}MB)`);

        // Use live transcript if available, otherwise fall back to server transcription
        const currentLiveTranscript = finalTranscriptRef.current;
        if (currentLiveTranscript.trim()) {
          setVoiceTranscript(currentLiveTranscript.trim());
          setEditedTranscript(currentLiveTranscript.trim());
          setVoiceBlob(blob);
          setLiveTranscript("");
          setInterimText("");
          toast({ title: "✅ Transcription ready!", description: "Review the text, then confirm to extract topics." });
        } else {
          // Fallback to server-side transcription
          processVoiceRecording(blob);
        }
      };

      mediaRecorder.start();
      setRecording(true);
      toast({ title: "🎙️ Recording...", description: "Speak now — live transcription is active." });
    } catch (err: any) {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice notes.", variant: "destructive" });
    }
  }, [recording, toast, processVoiceRecording]);

  const handleSyncNow = async () => {
    setSyncing(true);
    await syncAll();
    setPendingEntries(peekAll());
    setSyncing(false);
  };

  // Refresh pending queue periodically
  useEffect(() => {
    const interval = setInterval(() => setPendingEntries(peekAll()), 2000);
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async () => {
    if (!subject || !minutes || !confidence) {
      toast({ title: "Missing fields", description: "Please fill subject, time, and confidence.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    try {
      const success = await logStudy({
        subjectName: subject,
        topicName: topic || undefined,
        durationMinutes: parseInt(minutes),
        confidenceLevel: confidence as "low" | "medium" | "high",
        studyMode: "lazy",
      });
      if (success) {
        setSubject("");
        setTopic("");
        setMinutes("");
        setConfidence("");
      }
    } catch (e: any) {
      toast({ title: "Error logging study", description: e?.message || "Please try again.", variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Action Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose your study mode or upload content.</p>
      </motion.div>

      {/* Study Modes */}
      <div className="space-y-3">
        {modes.map((mode, i) => (
          <motion.button
            key={i}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1 + i * 0.1 }}
            onClick={() => {
              if (mode.title === "Lazy Mode") {
                setLazyModeOpen(true);
              } else if (mode.title === "Focus Mode") {
                setFocusModeOpen(true);
              } else if (mode.title === "Emergency Recovery") {
                setEmergencyOpen(true);
              } else {
                toast({ title: `${mode.title} activated! 🚀`, description: mode.desc });
              }
            }}
            className="w-full glass rounded-xl p-5 neural-border hover:glow-primary transition-all duration-300 text-left group active:scale-[0.98]"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-xl ${mode.bg} neural-border`}>
                <mode.icon className={`w-6 h-6 ${mode.color}`} />
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">{mode.title}</h3>
                <p className="text-sm text-muted-foreground">{mode.desc}</p>
              </div>
            </div>
          </motion.button>
        ))}
      </div>

      {/* Focus Session History */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <FocusSessionHistory />
      </motion.div>

      {/* AI Study Plan */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <h2 className="font-semibold text-foreground text-sm mb-3">AI Study Planner</h2>
        <StudyPlanGenerator />
      </motion.div>

      {/* Upload Content */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="relative z-10">
        <h2 className="font-semibold text-foreground text-sm mb-3">Upload Content</h2>

        {/* Hidden file inputs */}
        <input ref={pdfInputRef} type="file" accept="application/pdf" className="hidden" onChange={handlePdfUpload} />
        <input ref={scanInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleScanUpload} />

        <div className="grid grid-cols-3 gap-3">
          <button
            type="button"
            onClick={() => pdfInputRef.current?.click()}
            disabled={extracting}
            className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <FileText className="w-5 h-5 text-primary" />}
            <span className="text-xs text-muted-foreground">{extracting ? "Extracting..." : "PDF"}</span>
          </button>
          <button
            type="button"
            onClick={() => scanInputRef.current?.click()}
            disabled={extracting}
            className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50"
          >
            {extracting ? <Loader2 className="w-5 h-5 text-primary animate-spin" /> : <Camera className="w-5 h-5 text-primary" />}
            <span className="text-xs text-muted-foreground">{extracting ? "Extracting..." : "Scan"}</span>
          </button>
          <button
            type="button"
            onClick={handleVoiceRecord}
            disabled={extracting}
            className={`glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 ${recording ? "ring-2 ring-destructive animate-pulse" : ""}`}
          >
            {extracting && !recording ? (
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            ) : recording ? (
              <Square className="w-5 h-5 text-destructive" />
            ) : (
              <Mic className="w-5 h-5 text-primary" />
            )}
            <span className={`text-xs ${recording ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {extracting && !recording ? "Extracting..." : recording ? "Stop" : "Voice"}
            </span>
          </button>
        </div>

        {/* Live Transcription while recording */}
        <AnimatePresence>
          {recording && (liveTranscript || interimText) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-2">
                <div className="flex items-center gap-2">
                  <Mic className="w-4 h-4 text-destructive animate-pulse" />
                  <span className="text-xs font-semibold text-foreground">Live Transcription</span>
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {liveTranscript}
                  {interimText && <span className="text-primary/60 italic"> {interimText}</span>}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Uploaded file indicator */}
        <AnimatePresence>
          {uploadedFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 space-y-2"
            >
              <div className="flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/30">
                {extracting ? (
                  <Loader2 className="w-4 h-4 text-primary animate-spin shrink-0" />
                ) : (
                  <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
                )}
                <span className="text-xs text-foreground truncate flex-1">{uploadedFile}</span>
                <button onClick={() => { setUploadedFile(null); setExtractionResult(null); setVoiceTranscript(null); setVoiceBlob(null); }} className="p-0.5 rounded hover:bg-destructive/20 transition-colors">
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              </div>

              {/* Extraction results */}
              {extractionResult && extractionResult.length > 0 && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="p-3 rounded-lg bg-primary/5 border border-primary/20"
                >
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Topics Added to Brain</span>
                  </div>
                  <div className="space-y-2">
                    {extractionResult.map((res, i) => (
                      <div key={i}>
                        <p className="text-[11px] font-medium text-primary">{res.subject}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {res.topics.map((t, j) => (
                            <span key={j} className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-foreground border border-border/50">
                              {t}
                            </span>
                          ))}
                          {res.topics.length === 0 && (
                            <span className="text-[10px] text-muted-foreground italic">All topics already existed</span>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Transcript Preview */}
        <AnimatePresence>
          {(voiceTranscript || transcribing) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3"
            >
              <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Eye className="w-4 h-4 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Transcript Preview</span>
                  </div>
                  {voiceTranscript && (
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => { setEditingTranscript(!editingTranscript); }}
                        className="p-1 rounded-md hover:bg-secondary transition-colors"
                        title="Edit transcript"
                      >
                        <Edit3 className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                      <button
                        onClick={() => { setVoiceTranscript(null); setVoiceBlob(null); setUploadedFile(null); }}
                        className="p-1 rounded-md hover:bg-destructive/20 transition-colors"
                      >
                        <X className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </div>
                  )}
                </div>

                {transcribing ? (
                  <div className="flex items-center gap-2 py-3">
                    <Loader2 className="w-4 h-4 text-primary animate-spin" />
                    <span className="text-xs text-muted-foreground">Transcribing your voice note...</span>
                  </div>
                ) : editingTranscript ? (
                  <textarea
                    value={editedTranscript}
                    onChange={(e) => setEditedTranscript(e.target.value)}
                    className="w-full min-h-[100px] rounded-lg bg-secondary border border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-y"
                  />
                ) : (
                  <p className="text-xs text-muted-foreground leading-relaxed max-h-[150px] overflow-y-auto">
                    {voiceTranscript}
                  </p>
                )}

                {voiceTranscript && (
                  <button
                    onClick={confirmVoiceExtraction}
                    disabled={extracting}
                    className="w-full py-2.5 rounded-lg bg-primary text-primary-foreground text-xs font-semibold flex items-center justify-center gap-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  >
                    {extracting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Extracting topics...
                      </>
                    ) : (
                      <>
                        <ArrowRight className="w-3.5 h-3.5" />
                        Extract Topics to Brain
                      </>
                    )}
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* Quick Study Log */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }} className="glass rounded-xl p-5 neural-border">
        <h2 className="font-semibold text-foreground text-sm mb-4 flex items-center gap-2">
          <Upload className="w-4 h-4 text-primary" />
          Quick Study Signal
        </h2>
        <div className="space-y-3">
          <input
            type="text"
            placeholder="Subject (e.g. Physics)"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <input
            type="text"
            placeholder="Topic (optional, e.g. Electrostatics)"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          />
          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Minutes"
              value={minutes}
              onChange={(e) => setMinutes(e.target.value)}
              min="1"
              max="480"
              className="flex-1 rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <select
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
              className="flex-1 rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            >
              <option value="">Confidence</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </div>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all disabled:opacity-50"
          >
            {submitting ? "Updating..." : "Update My Brain"}
          </button>

          {/* Pending offline entries */}
          <AnimatePresence>
            {pendingEntries.length > 0 && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="rounded-lg border border-warning/30 bg-warning/5 p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <CloudOff className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-semibold text-warning">
                      {pendingEntries.length} session{pendingEntries.length > 1 ? "s" : ""} waiting to sync
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    {pendingEntries.map((entry) => (
                      <div key={entry.id} className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Clock className="w-3 h-3 shrink-0" />
                        <span className="flex-1 truncate">
                          {entry.subjectName}{entry.topicName ? ` › ${entry.topicName}` : ""} — {entry.durationMinutes}m
                        </span>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <button className="p-0.5 rounded hover:bg-destructive/20 transition-colors shrink-0">
                              <X className="w-3 h-3 text-muted-foreground hover:text-destructive" />
                            </button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remove queued session?</AlertDialogTitle>
                              <AlertDialogDescription>
                                This will permanently discard "{entry.subjectName}{entry.topicName ? ` › ${entry.topicName}` : ""}" ({entry.durationMinutes}m). It won't be synced.
                              </AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancel</AlertDialogCancel>
                              <AlertDialogAction
                                onClick={() => { removeFromQueue(entry.id); setPendingEntries(peekAll()); }}
                                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                              >
                                Remove
                              </AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    ))}
                  </div>
                  <button
                    onClick={handleSyncNow}
                    disabled={syncing}
                    className="w-full mt-2.5 py-2 rounded-lg border border-warning/30 bg-warning/10 text-warning text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-warning/20 transition-colors disabled:opacity-50"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${syncing ? "animate-spin" : ""}`} />
                    {syncing ? "Syncing..." : "Sync Now"}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
      <LazyModeSession open={lazyModeOpen} onClose={() => setLazyModeOpen(false)} />
      <FocusModeSession open={focusModeOpen} onClose={() => setFocusModeOpen(false)} />
      <EmergencyRecoverySession open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
};

export default ActionTab;
