import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Crosshair, AlertOctagon, FileText, Mic, Camera, X, Square, CheckCircle2, Loader2, Brain, Eye, ArrowRight, Edit3, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import StudyPlanGenerator from "./StudyPlanGenerator";
import AITopicManager from "./AITopicManager";
import { useToast } from "@/hooks/use-toast";

import LazyModeSession from "./LazyModeSession";
import FocusModeSession from "./FocusModeSession";
import EmergencyRecoverySession from "./EmergencyRecoverySession";
import FocusSessionHistory from "./FocusSessionHistory";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";

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

interface ActionTabProps {
  onNavigateToBrain?: () => void;
}

const ActionTab = ({ onNavigateToBrain }: ActionTabProps) => {
  const { isEnabled } = useFeatureFlagContext();
  const [lazyModeOpen, setLazyModeOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [recording, setRecording] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<string | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [extractionProgress, setExtractionProgress] = useState(0);
  const extractionProgressRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [extractionResult, setExtractionResult] = useState<{ subject: string; topics: string[] }[] | null>(null);
  const [voiceTranscript, setVoiceTranscript] = useState<string | null>(null);
  const [editingTranscript, setEditingTranscript] = useState(false);
  const [editedTranscript, setEditedTranscript] = useState("");
  const [transcribing, setTranscribing] = useState(false);
  const [voiceBlob, setVoiceBlob] = useState<Blob | null>(null);
  const { toast } = useToast();
  const { user } = useAuth();

  const [liveTranscript, setLiveTranscript] = useState("");
  const [interimText, setInterimText] = useState("");
  const [voiceLang, setVoiceLang] = useState("en-US");


  const pdfInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null);
  const finalTranscriptRef = useRef("");
  const extractionAbortRef = useRef<AbortController | null>(null);
  const [lastExtraction, setLastExtraction] = useState<{ type: "pdf" | "scan" | "voice-transcribe" | "voice-extract"; file?: File; blob?: Blob; transcript?: string } | null>(null);
  const [extractionFailed, setExtractionFailed] = useState(false);
  const extractionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExtractionTimeout = useCallback(() => {
    if (extractionTimeoutRef.current) { clearTimeout(extractionTimeoutRef.current); extractionTimeoutRef.current = null; }
  }, []);

  const startExtractionProgress = useCallback(() => {
    setExtractionProgress(0);
    if (extractionProgressRef.current) clearInterval(extractionProgressRef.current);
    extractionProgressRef.current = setInterval(() => {
      setExtractionProgress((prev) => {
        if (prev >= 85) { if (extractionProgressRef.current) clearInterval(extractionProgressRef.current); return 85; }
        return prev + Math.random() * 12 + 3;
      });
    }, 300);
    // Auto-cancel after 60 seconds
    clearExtractionTimeout();
    extractionTimeoutRef.current = setTimeout(() => {
      extractionAbortRef.current?.abort();
      extractionAbortRef.current = null;
      if (extractionProgressRef.current) clearInterval(extractionProgressRef.current);
      setExtractionProgress(0);
      setExtracting(false);
      setTranscribing(false);
      setExtractionFailed(true);
      toast({ title: "Timed out", description: "Extraction took too long and was auto-cancelled. You can retry." });
    }, 60000);
  }, [clearExtractionTimeout, toast]);

  const stopExtractionProgress = useCallback((success: boolean) => {
    if (extractionProgressRef.current) clearInterval(extractionProgressRef.current);
    clearExtractionTimeout();
    if (success) {
      setExtractionProgress(100);
      setTimeout(() => setExtractionProgress(0), 1500);
    } else {
      setExtractionProgress(0);
    }
  }, [clearExtractionTimeout]);

  const cancelExtraction = useCallback(() => {
    extractionAbortRef.current?.abort();
    extractionAbortRef.current = null;
    stopExtractionProgress(false);
    setExtracting(false);
    setTranscribing(false);
    setExtractionFailed(true);
    toast({ title: "Cancelled", description: "Extraction was cancelled." });
  }, [stopExtractionProgress, toast]);

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
    setExtractionFailed(false);
    setLastExtraction({ type: "pdf", file });
    startExtractionProgress();
    const abortController = new AbortController();
    extractionAbortRef.current = abortController;

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
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.totalTopicsCreated > 0) {
        setExtractionResult(data.results);
        setLastExtraction(null);
        toast({
          title: `🧠 ${data.totalTopicsCreated} topics extracted!`,
          description: `Added to ${data.results.length} subject(s). Check your Brain tab!`,
        });
      } else if (data.success && data.totalTopicsCreated === 0) {
        setLastExtraction(null);
        toast({
          title: "No new topics found",
          description: "All topics from this PDF are already in your library.",
        });
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err: any) {
      stopExtractionProgress(false);
      setExtractionFailed(true);
      toast({
        title: "Extraction failed",
        description: err?.message || "Could not extract topics from this PDF.",
        variant: "destructive",
      });
    } finally {
      setExtracting(false);
      stopExtractionProgress(true);
      if (e?.target) e.target.value = "";
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
    setExtractionFailed(false);
    setLastExtraction({ type: "scan", file });
    startExtractionProgress();
    const abortController = new AbortController();
    extractionAbortRef.current = abortController;

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
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.totalTopicsCreated > 0) {
        setExtractionResult(data.results);
        setLastExtraction(null);
        toast({
          title: `🧠 ${data.totalTopicsCreated} topics extracted!`,
          description: `Added to ${data.results.length} subject(s). Check your Brain tab!`,
        });
      } else if (data.success && data.totalTopicsCreated === 0) {
        setLastExtraction(null);
        toast({ title: "No new topics found", description: "All topics from this image are already in your library." });
      } else {
        throw new Error(data.error || "Extraction failed");
      }
    } catch (err: any) {
      stopExtractionProgress(false);
      setExtractionFailed(true);
      toast({ title: "Extraction failed", description: err?.message || "Could not extract topics from this image.", variant: "destructive" });
    } finally {
      setExtracting(false);
      stopExtractionProgress(true);
      if (e?.target) e.target.value = "";
    }
  }, [toast]);

  const processVoiceRecording = useCallback(async (blob: Blob) => {
    setTranscribing(true);
    setVoiceTranscript(null);
    setLiveTranscript("");
    setInterimText("");
    setExtractionResult(null);
    setExtractionFailed(false);
    setLastExtraction({ type: "voice-transcribe", blob });
    setVoiceBlob(blob);
    toast({ title: "🎙️ Transcribing...", description: "Converting your voice note to text." });
    const abortController = new AbortController();
    extractionAbortRef.current = abortController;

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
          signal: abortController.signal,
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
        setLastExtraction(null);
        setExtractionFailed(false);
        toast({ title: "✅ Transcription ready!", description: "Review the text, then confirm to extract topics." });
      } else {
        throw new Error(data.error || "No transcription returned");
      }
    } catch (err: any) {
      setExtractionFailed(true);
      toast({ title: "Transcription failed", description: err?.message || "Could not transcribe recording.", variant: "destructive" });
    } finally {
      setTranscribing(false);
    }
  }, [toast]);

  const confirmVoiceExtraction = useCallback(async () => {
    const transcript = editedTranscript.trim() || voiceTranscript;
    if (!transcript) return;
    setExtracting(true);
    setExtractionResult(null);
    setExtractionFailed(false);
    setLastExtraction({ type: "voice-extract", transcript });
    startExtractionProgress();
    const abortController = new AbortController();
    extractionAbortRef.current = abortController;

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
          signal: abortController.signal,
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: "Processing failed" }));
        throw new Error(err.error || `Failed with status ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.totalTopicsCreated > 0) {
        setExtractionResult(data.results);
        setLastExtraction(null);
        toast({
          title: `🧠 ${data.totalTopicsCreated} topics extracted!`,
          description: `Added to ${data.results.length} subject(s). Check your Brain tab!`,
        });
      } else if (data.success && data.totalTopicsCreated === 0) {
        setLastExtraction(null);
        toast({ title: "No new topics found", description: "All topics from this recording are already in your library." });
      } else {
        throw new Error(data.error || "Extraction failed");
      }
      setVoiceTranscript(null);
      setVoiceBlob(null);
    } catch (err: any) {
      stopExtractionProgress(false);
      setExtractionFailed(true);
      toast({ title: "Extraction failed", description: err?.message || "Could not extract topics.", variant: "destructive" });
    } finally {
      setExtracting(false);
      stopExtractionProgress(true);
    }
  }, [editedTranscript, voiceTranscript, toast]);

  const retryLastExtraction = useCallback(() => {
    if (!lastExtraction) return;
    setExtractionFailed(false);
    switch (lastExtraction.type) {
      case "pdf":
        if (lastExtraction.file) {
          const fakeEvent = { target: { value: "" } } as any;
          setUploadedFile(lastExtraction.file.name);
          // Re-run PDF extraction directly
          const runPdf = async () => {
            setExtracting(true);
            setExtractionResult(null);
            startExtractionProgress();
            const abortController = new AbortController();
            extractionAbortRef.current = abortController;
            try {
              const formData = new FormData();
              formData.append("pdf", lastExtraction.file!);
              const { data: { session } } = await supabase.auth.getSession();
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-pdf-topics`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: formData, signal: abortController.signal });
              if (!response.ok) { const err = await response.json().catch(() => ({ error: "Processing failed" })); throw new Error(err.error); }
              const data = await response.json();
              if (data.success && data.totalTopicsCreated > 0) { setExtractionResult(data.results); setLastExtraction(null); toast({ title: `🧠 ${data.totalTopicsCreated} topics extracted!`, description: `Added to ${data.results.length} subject(s).` }); }
              else if (data.success) { setLastExtraction(null); toast({ title: "No new topics found" }); }
              else throw new Error(data.error);
            } catch (err: any) { stopExtractionProgress(false); setExtractionFailed(true); toast({ title: "Extraction failed", description: err?.message, variant: "destructive" }); }
            finally { setExtracting(false); stopExtractionProgress(true); }
          };
          runPdf();
        }
        break;
      case "scan":
        if (lastExtraction.file) {
          const runScan = async () => {
            setExtracting(true);
            setExtractionResult(null);
            startExtractionProgress();
            const abortController = new AbortController();
            extractionAbortRef.current = abortController;
            try {
              const formData = new FormData();
              formData.append("image", lastExtraction.file!);
              const { data: { session } } = await supabase.auth.getSession();
              const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-image-topics`, { method: "POST", headers: { Authorization: `Bearer ${session?.access_token}` }, body: formData, signal: abortController.signal });
              if (!response.ok) { const err = await response.json().catch(() => ({ error: "Processing failed" })); throw new Error(err.error); }
              const data = await response.json();
              if (data.success && data.totalTopicsCreated > 0) { setExtractionResult(data.results); setLastExtraction(null); toast({ title: `🧠 ${data.totalTopicsCreated} topics extracted!`, description: `Added to ${data.results.length} subject(s).` }); }
              else if (data.success) { setLastExtraction(null); toast({ title: "No new topics found" }); }
              else throw new Error(data.error);
            } catch (err: any) { stopExtractionProgress(false); setExtractionFailed(true); toast({ title: "Extraction failed", description: err?.message, variant: "destructive" }); }
            finally { setExtracting(false); stopExtractionProgress(true); }
          };
          runScan();
        }
        break;
      case "voice-transcribe":
        if (lastExtraction.blob) processVoiceRecording(lastExtraction.blob);
        break;
      case "voice-extract":
        if (lastExtraction.transcript) confirmVoiceExtraction();
        break;
    }
  }, [lastExtraction, toast, startExtractionProgress, stopExtractionProgress, processVoiceRecording, confirmVoiceExtraction]);

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
        recognition.lang = voiceLang;
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
  }, [recording, toast, processVoiceRecording, voiceLang]);


  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <h1 className="text-2xl font-bold text-foreground">Action Center</h1>
        <p className="text-muted-foreground text-sm mt-1">Choose your study mode or upload content.</p>
      </motion.div>

      {/* Study Modes */}
      {isEnabled("action_study_modes") && (
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
      )}

      {/* Focus Session History */}
      {isEnabled("action_focus_history") && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
        <FocusSessionHistory />
      </motion.div>
      )}

      {/* AI Study Plan */}
      {isEnabled("action_study_planner") && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}>
        <h2 className="font-semibold text-foreground text-sm mb-3">AI Study Planner</h2>
        <StudyPlanGenerator />
      </motion.div>
      )}

      {/* Upload Content */}
      {isEnabled("action_upload") && (
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
            className={`glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95 disabled:opacity-50 relative ${recording ? "ring-2 ring-destructive animate-pulse" : ""}`}
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
            {recording && (
              <span className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground text-[9px] font-bold leading-none shadow-sm">
                {voiceLang.split("-")[0].toUpperCase()}
              </span>
            )}
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

              {/* Extraction progress bar */}
              <AnimatePresence>
                {extracting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: `${extractionProgress}%` }}
                        transition={{ duration: 0.3, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1">
                      <p className="text-[10px] text-muted-foreground">
                        {extractionProgress >= 100 ? "✅ Done!" : "AI is extracting topics..."}
                      </p>
                      {extractionProgress < 100 && (
                        <button
                          onClick={cancelExtraction}
                          className="text-[10px] text-destructive font-medium hover:underline"
                        >
                          Cancel
                        </button>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Retry button after failure/cancel */}
              <AnimatePresence>
                {extractionFailed && lastExtraction && !extracting && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                  >
                    <button
                      onClick={retryLastExtraction}
                      className="w-full py-2 rounded-lg border border-primary/30 bg-primary/10 text-primary text-xs font-semibold flex items-center justify-center gap-1.5 hover:bg-primary/20 transition-colors"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      Retry {lastExtraction.type === "pdf" ? "PDF" : lastExtraction.type === "scan" ? "Scan" : lastExtraction.type === "voice-transcribe" ? "Transcription" : "Voice"} Extraction
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

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
                  <div className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <span className="text-xs text-muted-foreground">Transcribing your voice note...</span>
                    </div>
                    <button
                      onClick={cancelExtraction}
                      className="text-[10px] text-destructive font-medium hover:underline"
                    >
                      Cancel
                    </button>
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
      )}

      {/* AI Topic Manager Section */}
      {isEnabled("action_ai_topic_manager") && (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <div className="flex items-center gap-2 mb-3">
          <Sparkles className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI Topic Manager</h2>
        </div>
        <div className="glass rounded-xl neural-border p-4">
          <AITopicManager mode="user" onDone={() => {}} />
        </div>
      </motion.div>
      )}

      <LazyModeSession open={lazyModeOpen} onClose={() => setLazyModeOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <FocusModeSession open={focusModeOpen} onClose={() => setFocusModeOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <EmergencyRecoverySession open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
};

export default ActionTab;
