import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertTriangle, Coffee, X, Brain, Heart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FatigueAlertProps {
  fatigueScore: number;
  boostMessage?: string;
  rescueTriggered?: boolean;
  onDismiss: () => void;
  onTakeBreak: () => void;
}

export default function FatigueAlert({ fatigueScore, boostMessage, rescueTriggered, onDismiss, onTakeBreak }: FatigueAlertProps) {
  const { session } = useAuth();
  const isCritical = fatigueScore > 80;
  const isRescue = rescueTriggered;

  const logAction = async (action: string) => {
    if (!session?.user?.id) return;
    try {
      await supabase.from("fatigue_events").insert({
        user_id: session.user.id,
        event_type: action === "break" ? "break_taken" : "break_skipped",
        fatigue_score: fatigueScore,
        trigger_reason: action,
      });
    } catch {}
  };

  return (
    <AnimatePresence>
      {/* Overlay for critical / rescue */}
      {(isCritical || isRescue) && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={() => { logAction("skip"); onDismiss(); }}
        >
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.9, opacity: 0 }}
            onClick={e => e.stopPropagation()}
            className="glass rounded-2xl neural-border p-6 max-w-sm w-full space-y-4"
          >
            <div className="text-center">
              <div className={`w-16 h-16 rounded-full mx-auto mb-3 flex items-center justify-center ${isRescue ? "bg-destructive/20" : "bg-warning/20"}`}>
                {isRescue ? <Heart className="w-8 h-8 text-destructive animate-pulse" /> : <AlertTriangle className="w-8 h-8 text-warning animate-bounce" />}
              </div>
              <h3 className="text-lg font-bold text-foreground">
                {isRescue ? "🫂 Rescue Mode Activated" : "⚠️ Fatigue Detected"}
              </h3>
              <p className="text-sm text-muted-foreground mt-1">
                {isRescue
                  ? "You've been struggling. Let's pause and reset."
                  : `Your fatigue score is ${fatigueScore}%. Your brain needs rest.`}
              </p>
            </div>

            {boostMessage && (
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-xl bg-primary/10 p-3 text-center"
              >
                <p className="text-sm text-primary font-medium">{boostMessage}</p>
              </motion.div>
            )}

            <div className="space-y-2">
              <button
                onClick={() => { logAction("break"); onTakeBreak(); }}
                className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2"
              >
                <Coffee className="w-4 h-4" /> Take a Break
              </button>
              <button
                onClick={() => { logAction("skip"); onDismiss(); }}
                className="w-full py-2.5 rounded-xl bg-secondary text-foreground text-xs"
              >
                Continue Anyway
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}

      {/* Inline banner for moderate fatigue */}
      {!isCritical && !isRescue && fatigueScore > 40 && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          className="glass rounded-xl neural-border p-3 flex items-center gap-3"
        >
          <div className="w-8 h-8 rounded-lg bg-warning/20 flex items-center justify-center shrink-0">
            <Brain className="w-4 h-4 text-warning" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-bold text-foreground">Mild fatigue detected ({fatigueScore}%)</p>
            <p className="text-[10px] text-muted-foreground">Consider a short break soon</p>
          </div>
          <button onClick={onDismiss} className="p-1 rounded-lg hover:bg-secondary/50 shrink-0">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
