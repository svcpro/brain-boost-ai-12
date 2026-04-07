import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Shield, CheckCircle2, TrendingUp, Brain, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import type { TopicPrediction } from "@/hooks/useMemoryEngine";

interface RiskShieldOverlayProps {
  atRisk: TopicPrediction[];
  onClose: () => void;
}

type Phase = "activating" | "analyzing" | "protecting" | "done";

export default function RiskShieldOverlay({ atRisk, onClose }: RiskShieldOverlayProps) {
  const { user } = useAuth();
  const [phase, setPhase] = useState<Phase>("activating");
  const [protectedTopics, setProtectedTopics] = useState<{ topic_name: string; boost: number }[]>([]);
  const [totalBoost, setTotalBoost] = useState(0);

  useEffect(() => {
    if (!user) return;
    let cancelled = false;

    const run = async () => {
      // Phase 1: Shield activation (800ms visual)
      triggerHaptic([20, 30, 20]);
      await delay(800);
      if (cancelled) return;

      // Phase 2: Analyzing — call init API
      setPhase("analyzing");
      try {
        await supabase.functions.invoke("risk-shield", {
          body: { action: "init" },
        });
      } catch {}
      await delay(600);
      if (cancelled) return;

      // Phase 3: Protecting — call activate API
      setPhase("protecting");

      try {
        const { data: result, error } = await supabase.functions.invoke("risk-shield", {
          body: { action: "activate" },
        });

        if (cancelled) return;

        if (!error && result?.success) {
          const d = result.data;
          setProtectedTopics(d.protected_topics || []);
          setTotalBoost(d.total_boost || 0);
        } else {
          // Fallback: show at least a summary
          setProtectedTopics([]);
          setTotalBoost(0);
        }
      } catch (e) {
        console.error("Risk Shield activate error:", e);
        setProtectedTopics([]);
        setTotalBoost(0);
      }

      if (cancelled) return;

      triggerHaptic([30, 60, 30, 80]);
      // Confetti
      try {
        const { default: confetti } = await import("canvas-confetti");
        confetti({ particleCount: 50, spread: 50, origin: { y: 0.55 }, colors: ["hsl(175,80%,50%)", "#FFD700", "#4ECDC4"] });
      } catch {}

      setPhase("done");

      // Auto-close after 2.5s
      await delay(2500);
      if (!cancelled) onClose();
    };

    run();
    return () => { cancelled = true; };
  }, [user, atRisk, onClose]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm flex items-center justify-center"
    >
      <div className="w-full max-w-xs px-5">
        <AnimatePresence mode="wait">
          {/* Phase 1: Activating */}
          {phase === "activating" && (
            <motion.div
              key="activating"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{
                  scale: [1, 1.3, 1],
                  boxShadow: [
                    "0 0 0 0 hsl(var(--warning) / 0)",
                    "0 0 0 20px hsl(var(--warning) / 0.15)",
                    "0 0 0 0 hsl(var(--warning) / 0)",
                  ],
                }}
                transition={{ duration: 0.8, ease: "easeOut" }}
                className="w-20 h-20 rounded-full bg-warning/15 flex items-center justify-center mb-4"
              >
                <Shield className="w-10 h-10 text-warning" />
              </motion.div>
              <p className="text-sm font-bold text-foreground">Activating Shield...</p>
            </motion.div>
          )}

          {/* Phase 2: Analyzing */}
          {phase === "analyzing" && (
            <motion.div
              key="analyzing"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4"
              >
                <Brain className="w-8 h-8 text-primary" />
              </motion.div>
              <p className="text-sm font-semibold text-foreground">Scanning memory risks...</p>
              <p className="text-[10px] text-muted-foreground mt-1">Identifying non-critical decay patterns</p>
            </motion.div>
          )}

          {/* Phase 3: Protecting */}
          {phase === "protecting" && (
            <motion.div
              key="protecting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center text-center"
            >
              <Loader2 className="w-8 h-8 text-primary animate-spin mb-3" />
              <p className="text-sm font-semibold text-foreground">Rebalancing revision schedule...</p>
              <p className="text-[10px] text-muted-foreground mt-1">Extending memory protection windows</p>
            </motion.div>
          )}

          {/* Phase 4: Done */}
          {phase === "done" && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", stiffness: 200 }}
                className="w-16 h-16 rounded-full bg-success/15 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="w-8 h-8 text-success" />
              </motion.div>

              <h3 className="text-base font-bold text-foreground mb-1">Shield Active 🛡️</h3>
              <p className="text-xs text-muted-foreground mb-4">
                {protectedTopics.length} topic{protectedTopics.length !== 1 ? "s" : ""} protected
              </p>

              {/* Protected topics list */}
              <div className="w-full space-y-1.5 mb-4">
                {protectedTopics.map((t, i) => (
                  <motion.div
                    key={t.topic_name}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center justify-between px-3 py-2 rounded-lg bg-secondary/50 border border-border/50"
                  >
                    <span className="text-[11px] text-foreground truncate flex-1 text-left">{t.topic_name}</span>
                    <span className="text-[10px] font-bold text-primary ml-2">+{t.boost}%</span>
                  </motion.div>
                ))}
              </div>

              {/* Total boost badge */}
              <motion.div
                initial={{ opacity: 0, y: 5 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex items-center gap-2"
              >
                <div className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/10 border border-primary/15">
                  <TrendingUp className="w-3.5 h-3.5 text-primary" />
                  <span className="text-xs font-bold text-primary">+{totalBoost}% stability</span>
                </div>
              </motion.div>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.8 }}
                className="text-[10px] text-muted-foreground mt-3 italic"
              >
                Streak preserved · Returning...
              </motion.p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

function delay(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
