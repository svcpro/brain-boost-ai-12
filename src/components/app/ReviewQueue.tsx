import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Clock, AlertTriangle, ChevronDown, ChevronUp, Zap, Play, X, Brain, CheckCircle2, ThumbsUp, ThumbsDown, Minus } from "lucide-react";
import { useReviewQueue, ReviewItem } from "@/hooks/useReviewQueue";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const urgencyConfig = {
  overdue: {
    label: "Overdue",
    dot: "bg-destructive animate-pulse",
    icon: AlertTriangle,
  },
  due_now: {
    label: "Due Now",
    dot: "bg-warning",
    icon: Zap,
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-muted-foreground",
    icon: Clock,
  },
};

const ReviewQueue = () => {
  const { queue, dueCount, loading, loadQueue } = useReviewQueue();
  const [expanded, setExpanded] = useState(false);
  const [activeReview, setActiveReview] = useState<ReviewItem | null>(null);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const displayItems = expanded ? queue.slice(0, 15) : queue.filter((i) => i.urgency !== "upcoming").slice(0, 5);
  const hasUpcoming = queue.some((i) => i.urgency === "upcoming");

  if (loading) {
    return (
      <div className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Loading review queue...</span>
        </div>
      </div>
    );
  }

  if (queue.length === 0) return null;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <RotateCcw className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Review Queue</h2>
            {dueCount > 0 && (
              <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
                {dueCount} due
              </span>
            )}
          </div>
          <button
            onClick={() => loadQueue()}
            className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
          >
            Refresh
          </button>
        </div>

        {displayItems.length > 0 ? (
          <div className="space-y-2">
            <AnimatePresence>
              {displayItems.map((item, i) => (
                <ReviewItemCard
                  key={item.id}
                  item={item}
                  index={i}
                  onStartReview={() => setActiveReview(item)}
                />
              ))}
            </AnimatePresence>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-3">
            No reviews due right now! 🎉
          </p>
        )}

        {(hasUpcoming || displayItems.length < queue.filter((i) => i.urgency !== "upcoming").length) && (
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
          >
            {expanded ? (
              <>Show less <ChevronUp className="w-3 h-3" /></>
            ) : (
              <>Show all ({queue.length}) <ChevronDown className="w-3 h-3" /></>
            )}
          </button>
        )}
      </motion.div>

      {/* Review Session Modal */}
      <AnimatePresence>
        {activeReview && (
          <ReviewSessionModal
            item={activeReview}
            onClose={() => setActiveReview(null)}
            onComplete={() => {
              setActiveReview(null);
              loadQueue();
            }}
          />
        )}
      </AnimatePresence>
    </>
  );
};

const ReviewItemCard = ({
  item,
  index,
  onStartReview,
}: {
  item: ReviewItem;
  index: number;
  onStartReview: () => void;
}) => {
  const config = urgencyConfig[item.urgency];
  const Icon = config.icon;

  const timeLabel =
    item.urgency === "overdue"
      ? `${Math.round(item.hours_overdue)}h overdue`
      : item.urgency === "due_now"
      ? "Review now"
      : `in ${formatDistanceToNow(new Date(item.next_review_date))}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.subject_name && (
            <span className="text-[10px] text-muted-foreground">{item.subject_name}</span>
          )}
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-muted-foreground">{item.memory_strength}%</span>
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-muted-foreground">
            #{item.review_count} → {item.interval_days}d interval
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1">
          <Icon className={`w-3 h-3 ${item.urgency === "overdue" ? "text-destructive" : item.urgency === "due_now" ? "text-warning" : "text-muted-foreground"}`} />
          <span className={`text-[10px] font-medium ${item.urgency === "overdue" ? "text-destructive" : item.urgency === "due_now" ? "text-warning" : "text-muted-foreground"}`}>
            {timeLabel}
          </span>
        </div>
        <button
          onClick={onStartReview}
          className="p-1.5 rounded-lg bg-primary/15 border border-primary/30 hover:bg-primary/25 transition-all group"
          title="Start Review"
        >
          <Play className="w-3 h-3 text-primary group-hover:scale-110 transition-transform" />
        </button>
      </div>
    </motion.div>
  );
};

// ─── Review Session Modal ─────────────────────────────────────
interface ReviewSessionProps {
  item: ReviewItem;
  onClose: () => void;
  onComplete: () => void;
}

type SessionStep = "focus" | "rate" | "done";

const ReviewSessionModal = ({ item, onClose, onComplete }: ReviewSessionProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [step, setStep] = useState<SessionStep>("focus");
  const [elapsed, setElapsed] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  // Timer
  useEffect(() => {
    if (step !== "focus") return;
    const interval = setInterval(() => setElapsed((e) => e + 1), 1000);
    return () => clearInterval(interval);
  }, [step]);

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m.toString().padStart(2, "0")}:${sec.toString().padStart(2, "0")}`;
  };

  const handleRate = useCallback(async (confidence: "low" | "medium" | "high") => {
    if (!user || submitting) return;
    setSubmitting(true);
    try {
      const durationMinutes = Math.max(1, Math.round(elapsed / 60));

      // Log the study session
      await supabase.from("study_logs").insert({
        user_id: user.id,
        topic_id: item.id,
        subject_id: null, // We don't have subject_id on ReviewItem directly
        duration_minutes: durationMinutes,
        confidence_level: confidence,
        study_mode: "review",
      });

      // Update topic's last_revision_date and memory_strength
      const strengthBoost = confidence === "high" ? 25 : confidence === "medium" ? 15 : 5;
      const newStrength = Math.min(100, item.memory_strength + strengthBoost);

      await supabase
        .from("topics")
        .update({
          last_revision_date: new Date().toISOString(),
          memory_strength: newStrength,
        })
        .eq("id", item.id);

      setStep("done");
      toast({ title: "✅ Review complete!", description: `${item.name} reviewed for ${durationMinutes} min.` });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  }, [user, elapsed, item, submitting, toast]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-background/80 backdrop-blur-sm" onClick={step === "done" ? onComplete : undefined} />

      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="relative w-full max-w-sm glass-strong rounded-2xl neural-border overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-border">
          <div className="flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            <span className="font-semibold text-foreground text-sm">Review Session</span>
          </div>
          <button
            onClick={step === "done" ? onComplete : onClose}
            className="p-1 rounded-lg hover:bg-secondary transition-colors"
          >
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6">
          <AnimatePresence mode="wait">
            {step === "focus" && (
              <motion.div
                key="focus"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-center"
              >
                <div>
                  <h3 className="text-lg font-bold text-foreground">{item.name}</h3>
                  {item.subject_name && (
                    <p className="text-xs text-muted-foreground mt-1">{item.subject_name}</p>
                  )}
                </div>

                {/* Timer ring */}
                <div className="flex justify-center">
                  <div className="relative w-32 h-32">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--secondary))" strokeWidth="6" />
                      <motion.circle
                        cx="50" cy="50" r="42" fill="none"
                        stroke="hsl(var(--primary))"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray={264}
                        animate={{ strokeDashoffset: 264 - (Math.min(elapsed / 300, 1) * 264) }}
                        transition={{ duration: 0.5 }}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold font-display gradient-text">{formatTime(elapsed)}</span>
                      <span className="text-[10px] text-muted-foreground">reviewing</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Review this topic thoroughly, then rate your recall.
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Current strength: {item.memory_strength}% • Reviews: {item.review_count}
                  </p>
                </div>

                <button
                  onClick={() => setStep("rate")}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all"
                >
                  Done Reviewing — Rate Recall
                </button>
              </motion.div>
            )}

            {step === "rate" && (
              <motion.div
                key="rate"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="space-y-6 text-center"
              >
                <div>
                  <h3 className="text-lg font-bold text-foreground">How well do you recall?</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.name} • {formatTime(elapsed)} spent
                  </p>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  {[
                    { level: "low" as const, icon: ThumbsDown, label: "Struggled", desc: "Barely remembered", color: "text-destructive", bg: "bg-destructive/10 border-destructive/30 hover:bg-destructive/20" },
                    { level: "medium" as const, icon: Minus, label: "Okay", desc: "Partial recall", color: "text-warning", bg: "bg-warning/10 border-warning/30 hover:bg-warning/20" },
                    { level: "high" as const, icon: ThumbsUp, label: "Nailed It", desc: "Full recall", color: "text-success", bg: "bg-success/10 border-success/30 hover:bg-success/20" },
                  ].map((opt) => (
                    <button
                      key={opt.level}
                      onClick={() => handleRate(opt.level)}
                      disabled={submitting}
                      className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all disabled:opacity-50 ${opt.bg}`}
                    >
                      <opt.icon className={`w-6 h-6 ${opt.color}`} />
                      <span className={`text-xs font-semibold ${opt.color}`}>{opt.label}</span>
                      <span className="text-[10px] text-muted-foreground">{opt.desc}</span>
                    </button>
                  ))}
                </div>

                <button
                  onClick={() => setStep("focus")}
                  className="text-xs text-muted-foreground hover:text-primary transition-colors"
                >
                  ← Back to reviewing
                </button>
              </motion.div>
            )}

            {step === "done" && (
              <motion.div
                key="done"
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-5 text-center py-4"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 300, delay: 0.1 }}
                >
                  <CheckCircle2 className="w-16 h-16 text-success mx-auto" />
                </motion.div>
                <div>
                  <h3 className="text-lg font-bold text-foreground">Review Complete!</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {item.name} has been marked as reviewed.
                  </p>
                </div>
                <button
                  onClick={onComplete}
                  className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold glow-primary hover:glow-primary-strong transition-all"
                >
                  Back to Queue
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </motion.div>
  );
};

export default ReviewQueue;
