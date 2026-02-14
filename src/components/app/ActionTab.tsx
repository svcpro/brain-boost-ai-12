import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Coffee, Crosshair, AlertOctagon, Upload, FileText, Mic, Camera, CloudOff, Clock, RefreshCw, X, Square, CheckCircle2 } from "lucide-react";
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
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();
  const { syncAll } = useOfflineSync();

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const scanInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const handlePdfUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.type !== "application/pdf") {
      toast({ title: "Invalid file", description: "Please select a PDF file.", variant: "destructive" });
      return;
    }
    setUploadedFile(file.name);
    toast({ title: "📄 PDF uploaded!", description: `"${file.name}" ready for processing.` });
    // Reset input so same file can be re-selected
    e.target.value = "";
  }, [toast]);

  const handleScanUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadedFile(file.name);
    toast({ title: "📸 Image captured!", description: `"${file.name}" ready for processing.` });
    e.target.value = "";
  }, [toast]);

  const handleVoiceRecord = useCallback(async () => {
    if (recording) {
      // Stop recording
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach((t) => t.stop());
        const blob = new Blob(audioChunksRef.current, { type: "audio/webm" });
        const sizeMB = (blob.size / (1024 * 1024)).toFixed(1);
        setUploadedFile(`Voice recording (${sizeMB}MB)`);
        toast({ title: "🎙️ Voice recorded!", description: `Recording saved (${sizeMB}MB). Ready for processing.` });
      };

      mediaRecorder.start();
      setRecording(true);
      toast({ title: "🎙️ Recording...", description: "Tap Voice again to stop recording." });
    } catch (err: any) {
      toast({ title: "Microphone access denied", description: "Please allow microphone access to record voice notes.", variant: "destructive" });
    }
  }, [recording, toast]);

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
            className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95"
          >
            <FileText className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">PDF</span>
          </button>
          <button
            type="button"
            onClick={() => scanInputRef.current?.click()}
            className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95"
          >
            <Camera className="w-5 h-5 text-primary" />
            <span className="text-xs text-muted-foreground">Scan</span>
          </button>
          <button
            type="button"
            onClick={handleVoiceRecord}
            className={`glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 cursor-pointer active:scale-95 ${recording ? "ring-2 ring-destructive animate-pulse" : ""}`}
          >
            {recording ? <Square className="w-5 h-5 text-destructive" /> : <Mic className="w-5 h-5 text-primary" />}
            <span className={`text-xs ${recording ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
              {recording ? "Stop" : "Voice"}
            </span>
          </button>
        </div>

        {/* Uploaded file indicator */}
        <AnimatePresence>
          {uploadedFile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-3 flex items-center gap-2 p-2.5 rounded-lg bg-success/10 border border-success/30"
            >
              <CheckCircle2 className="w-4 h-4 text-success shrink-0" />
              <span className="text-xs text-foreground truncate flex-1">{uploadedFile}</span>
              <button onClick={() => setUploadedFile(null)} className="p-0.5 rounded hover:bg-destructive/20 transition-colors">
                <X className="w-3 h-3 text-muted-foreground" />
              </button>
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
