import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Upload, Loader2 } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useStudyLogger } from "@/hooks/useStudyLogger";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";

interface QuickStudySignalModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const QuickStudySignalModal = ({ open, onClose, onSuccess }: QuickStudySignalModalProps) => {
  const [subject, setSubject] = useState("");
  const [topic, setTopic] = useState("");
  const [minutes, setMinutes] = useState("");
  const [confidence, setConfidence] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const { logStudy } = useStudyLogger();
  const { toast } = useToast();

  const handleSubmit = async () => {
    if (!subject || !minutes || !confidence) {
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
        subjectName: subject,
        topicName: topic || undefined,
        durationMinutes: parseInt(minutes),
        confidenceLevel: confidence as "low" | "medium" | "high",
        studyMode: "lazy",
      });

      clearInterval(progressInterval);

      if (success) {
        setSubmitProgress(100);
        notifyFeedback();
        toast({ title: "🧠 Brain updated!", description: "Your study signal has been logged." });
        setTimeout(() => {
          setSubject("");
          setTopic("");
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
