import { useEffect, useRef } from "react";
import { Bell, X, Undo2 } from "lucide-react";
import { motion } from "framer-motion";
import { nudgeFeedback } from "@/lib/feedback";

interface NudgeProps {
  ignoredCount: number;
  onDismiss: () => void;
}

export const NudgeWithFeedback = ({ ignoredCount, onDismiss }: NudgeProps) => {
  const firedRef = useRef(false);
  useEffect(() => {
    if (!firedRef.current) {
      firedRef.current = true;
      nudgeFeedback();
    }
  }, []);

  return (
    <div className="mt-2 px-2 py-1.5 rounded-lg bg-warning/10 border border-warning/20 text-[10px] text-warning flex items-center gap-1.5">
      <Bell className="w-3 h-3 shrink-0" />
      <span className="flex-1">You ignored {ignoredCount} reminders this week — try studying even 5 minutes after the next one! 💪</span>
      <button
        type="button"
        onClick={onDismiss}
        className="shrink-0 p-0.5 rounded hover:bg-warning/20 transition-colors"
        aria-label="Dismiss nudge"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
};

interface UndoProps {
  onUndo: () => void;
  onExpire: () => void;
}

export const UndoDismiss = ({ onUndo, onExpire }: UndoProps) => {
  useEffect(() => {
    const timer = setTimeout(onExpire, 4000);
    return () => clearTimeout(timer);
  }, [onExpire]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="mt-2 rounded-lg bg-secondary/40 border border-border overflow-hidden"
    >
      <div className="px-2 py-1.5 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>Nudge dismissed</span>
        <button
          type="button"
          onClick={onUndo}
          className="flex items-center gap-1 text-primary hover:text-primary/80 font-medium transition-colors"
        >
          <Undo2 className="w-3 h-3" />
          Undo
        </button>
      </div>
      <div className="h-0.5 w-full bg-muted">
        <motion.div
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: 4, ease: "linear" }}
          className="h-full bg-primary/60 rounded-full"
        />
      </div>
    </motion.div>
  );
};
