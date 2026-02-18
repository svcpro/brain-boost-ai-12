import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2, ChevronDown } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import confetti from "canvas-confetti";

interface SubjectOption {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

interface QuickStudySignalModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  initialSubject?: string;
  initialTopic?: string;
  initialMinutes?: number;
}

const QuickStudySignalModal = ({ open, onClose, onSuccess, initialSubject, initialTopic, initialMinutes }: QuickStudySignalModalProps) => {
  const { user } = useAuth();
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [customSubject, setCustomSubject] = useState("");
  const [customTopic, setCustomTopic] = useState("");
  const [minutes, setMinutes] = useState("");
  const [confidence, setConfidence] = useState("medium");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [loaded, setLoaded] = useState(false);
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();

  const loadSubjects = useCallback(async () => {
    if (!user || loaded) return;
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name");

    if (!subs || subs.length === 0) { setLoaded(true); return; }

    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, subject_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name");

    setSubjects(subs.map((s) => ({
      ...s,
      topics: (topics || []).filter((t: any) => t.subject_id === s.id).map((t) => ({ id: t.id, name: t.name })),
    })));
    setLoaded(true);
  }, [user, loaded]);

  useEffect(() => {
    if (open) {
      setLoaded(false); // reload each time modal opens
    }
  }, [open]);

  // Auto-fill from initial props when modal opens
  useEffect(() => {
    if (!open || !loaded || subjects.length === 0) return;
    if (initialSubject) {
      const match = subjects.find((s) => s.name === initialSubject);
      if (match) {
        setSubject(match.id);
        if (initialTopic) {
          const topicMatch = match.topics.find((t) => t.name === initialTopic);
          if (topicMatch) setTopic(topicMatch.id);
        }
      } else {
        setSubject("__custom");
        setCustomSubject(initialSubject);
        if (initialTopic) {
          setTopic("__custom");
          setCustomTopic(initialTopic);
        }
      }
    }
    if (initialMinutes) setMinutes(String(initialMinutes));
  }, [open, loaded, subjects, initialSubject, initialTopic, initialMinutes]);

  useEffect(() => {
    if (open && !loaded) loadSubjects();
  }, [open, loaded, loadSubjects]);

  const selectedSubject = subjects.find((s) => s.id === subject);
  const subjectName = subject === "__custom" ? customSubject : (selectedSubject?.name || "");
  const topicName = topic === "__custom" ? customTopic : (selectedSubject?.topics.find((t) => t.id === topic)?.name || "");

  const handleSubjectChange = (val: string) => {
    setSubject(val);
    setTopic("");
    setCustomTopic("");
    if (val !== "__custom") setCustomSubject("");
  };

  const handleSubmit = async () => {
    const finalSubject = subjectName;
    const finalTopic = topicName;
    if (!finalSubject || !minutes || !confidence) {
      toast({ title: "Missing fields", description: "Please fill subject, time, and confidence.", variant: "destructive" });
      return;
    }
    setSubmitting(true);
    setSubmitProgress(0);

    const progressInterval = setInterval(() => {
      setSubmitProgress((prev) => {
        if (prev >= 85) { clearInterval(progressInterval); return 85; }
        return prev + Math.random() * 15 + 5;
      });
    }, 200);

    try {
      const success = await logStudy({
        subjectName: finalSubject,
        topicName: finalTopic || undefined,
        durationMinutes: parseInt(minutes),
        confidenceLevel: confidence as "low" | "medium" | "high",
        studyMode: "lazy",
        notes: notes || undefined,
      });

      clearInterval(progressInterval);

      if (success) {
        setSubmitProgress(100);
        notifyFeedback();
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, zIndex: 9999 });
        toast({ title: "🧠 Brain updated!", description: "Your study signal has been logged." });
        import("@/lib/eventBus").then(({ emitEvent }) =>
          emitEvent("study_session_end", {
            mode: "brain_update", duration: parseInt(minutes), topic: finalTopic || finalSubject, confidence,
          }, { title: "Brain Updated!", body: `${minutes} min on ${finalTopic || finalSubject}` })
        );
        setTimeout(() => {
          setSubject("");
          setTopic("");
          setCustomSubject("");
          setCustomTopic("");
          setNotes("");
          setMinutes("");
          setConfidence("");
          setSubmitting(false);
          setSubmitProgress(0);
          onClose();
          onSuccess?.();
        }, 800);
        return;
      }
    } catch (e: any) {
      clearInterval(progressInterval);
      toast({ title: "Error logging study", description: e?.message || "Please try again.", variant: "destructive" });
    }
    setSubmitting(false);
    setSubmitProgress(0);
  };

  const renderSubjectInput = () => {
    if (subjects.length === 0) {
      return (
        <input
          type="text"
          placeholder="Subject (e.g. Physics)"
          value={customSubject}
          onChange={(e) => { setCustomSubject(e.target.value); setSubject("__custom"); }}
          className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      );
    }
    return (
      <div className="space-y-2">
        <div className="relative">
          <select
            value={subject}
            onChange={(e) => handleSubjectChange(e.target.value)}
            className="w-full appearance-none rounded-lg bg-secondary border border-border px-4 py-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Select subject</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
            <option value="__custom">+ New subject</option>
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {subject === "__custom" && (
          <input
            type="text"
            placeholder="Enter new subject name"
            value={customSubject}
            onChange={(e) => setCustomSubject(e.target.value)}
            className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        )}
      </div>
    );
  };

  const renderTopicInput = () => {
    if (subjects.length === 0 || subject === "__custom") {
      return (
        <input
          type="text"
          placeholder="Topic (optional, e.g. Electrostatics)"
          value={customTopic}
          onChange={(e) => { setCustomTopic(e.target.value); setTopic("__custom"); }}
          className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
        />
      );
    }
    const topicOptions = selectedSubject?.topics || [];
    return (
      <div className="space-y-2">
        <div className="relative">
          <select
            value={topic}
            onChange={(e) => { setTopic(e.target.value); if (e.target.value !== "__custom") setCustomTopic(""); }}
            className="w-full appearance-none rounded-lg bg-secondary border border-border px-4 py-3 pr-8 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary"
          >
            <option value="">Topic (optional)</option>
            {topicOptions.map((t) => (
              <option key={t.id} value={t.id}>{t.name}</option>
            ))}
            <option value="__custom">+ New topic</option>
          </select>
          <ChevronDown className="w-4 h-4 text-muted-foreground absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        </div>
        {topic === "__custom" && (
          <input
            type="text"
            placeholder="Enter new topic name"
            value={customTopic}
            onChange={(e) => setCustomTopic(e.target.value)}
            className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            autoFocus
          />
        )}
      </div>
    );
  };

  return (
    <Sheet open={open} onOpenChange={(v) => { if (!v) onClose(); }}>
      <SheetContent side="bottom" className="rounded-t-2xl px-6 pb-8 pt-4 max-h-[85vh] overflow-y-auto">
        <SheetHeader className="mb-4">
          <SheetTitle className="flex items-center gap-2 text-lg">
            <Upload className="w-5 h-5 text-primary" />
            Quick Study Signal
          </SheetTitle>
        </SheetHeader>

        <div className="space-y-3">
          {renderSubjectInput()}
          {renderTopicInput()}

          {/* Duration presets */}
          <div className="flex gap-2">
            {[10, 25, 45].map((m) => (
              <motion.button
                key={m}
                type="button"
                onClick={() => setMinutes(String(m))}
                whileTap={{ scale: 0.93 }}
                animate={minutes === String(m) ? { scale: [1, 1.08, 1.03] } : { scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex-1 py-2 rounded-lg border text-xs font-semibold transition-colors ${
                  minutes === String(m)
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
                    : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                {m} min
              </motion.button>
            ))}
          </div>

          <div className="flex gap-3">
            <input
              type="number"
              placeholder="Custom mins"
              value={[10, 25, 45].includes(Number(minutes)) ? "" : minutes}
              onChange={(e) => setMinutes(e.target.value)}
              min="1"
              max="480"
              className="flex-1 rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
            />
          </div>

          {/* Confidence quick-select */}
          <div className="flex gap-2">
            {([
              { value: "low", emoji: "😟", label: "Low" },
              { value: "medium", emoji: "😐", label: "Medium" },
              { value: "high", emoji: "😎", label: "High" },
            ] as const).map((c) => (
              <motion.button
                key={c.value}
                type="button"
                onClick={() => setConfidence(c.value)}
                whileTap={{ scale: 0.93 }}
                animate={confidence === c.value ? { scale: [1, 1.08, 1.03] } : { scale: 1 }}
                transition={{ duration: 0.25, ease: "easeOut" }}
                className={`flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors ${
                  confidence === c.value
                    ? "bg-primary text-primary-foreground border-primary shadow-[0_0_12px_hsl(var(--primary)/0.35)]"
                    : "bg-secondary/50 border-border text-muted-foreground hover:border-primary/50"
                }`}
              >
                <motion.span
                  className="text-lg"
                  animate={confidence === c.value ? { scale: [1, 1.3, 1] } : {}}
                  transition={{ duration: 0.3 }}
                >
                  {c.emoji}
                </motion.span>
                {c.label}
              </motion.button>
            ))}
          </div>

          {/* Notes */}
          <textarea
            placeholder="What did you learn? (optional)"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            maxLength={500}
            className="w-full rounded-lg bg-secondary border border-border px-4 py-3 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary resize-none"
          />

          <div className="space-y-2">
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all disabled:opacity-50"
            >
              {submitting ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {submitProgress >= 100 ? "Done! 🧠" : "Updating..."}
                </span>
              ) : (
                "Update My Brain"
              )}
            </button>

            <AnimatePresence>
              {submitting && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-primary"
                      initial={{ width: "0%" }}
                      animate={{ width: `${submitProgress}%` }}
                      transition={{ duration: 0.3, ease: "easeOut" }}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground text-center mt-1">
                    {submitProgress >= 100 ? "✅ Brain updated!" : "Syncing with your Brain..."}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default QuickStudySignalModal;
