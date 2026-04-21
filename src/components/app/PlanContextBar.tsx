import { motion, AnimatePresence } from "framer-motion";
import { Crown, Sparkles, ChevronRight, Lock } from "lucide-react";
import { useState } from "react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";

interface PlanContextBarProps {
  /** Feature keys relevant on this screen — used to compute "next unlock" preview */
  relevantFeatures?: { key: string; label: string }[];
  onUpgrade?: () => void;
}

const PLAN_META: Record<string, { name: string; color: string; gradient: string }> = {
  none: { name: "No Plan", color: "#94a3b8", gradient: "linear-gradient(90deg, #64748b, #94a3b8)" },
  starter: { name: "Starter", color: "#00E5FF", gradient: "linear-gradient(90deg, #00E5FF, #7C4DFF)" },
  premium: { name: "Premium", color: "#FFD700", gradient: "linear-gradient(90deg, #FFD700, #FF8500)" },
};

/**
 * Slim contextual bar shown at the top of feature screens.
 * Tells the user which plan they're on and surfaces the next locked feature on this screen.
 */
const PlanContextBar = ({ relevantFeatures = [], onUpgrade }: PlanContextBarProps) => {
  const { currentPlan, canAccess, loading, isTrialActive, trialDaysLeft } = usePlanGatingContext();
  const [dismissed, setDismissed] = useState(false);

  if (loading || dismissed) return null;

  const meta = PLAN_META[currentPlan] || PLAN_META.none;
  const lockedHere = relevantFeatures.filter(f => !canAccess(f.key));
  const isPremium = currentPlan === "premium";

  // On Premium and nothing locked → don't show anything (zero noise)
  if (isPremium && lockedHere.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        className="mx-5 mt-3 rounded-2xl overflow-hidden"
        style={{
          background: "linear-gradient(180deg, hsl(230 40% 12% / 0.6), hsl(230 50% 8% / 0.6))",
          border: `1px solid ${meta.color}33`,
          backdropFilter: "blur(12px)",
        }}
      >
        <div className="px-3 py-2.5 flex items-center gap-3">
          {/* Plan dot */}
          <div className="relative shrink-0">
            <div
              className="w-2 h-2 rounded-full"
              style={{ background: meta.color, boxShadow: `0 0 8px ${meta.color}` }}
            />
            <motion.div
              className="absolute inset-0 rounded-full"
              style={{ border: `1px solid ${meta.color}` }}
              animate={{ scale: [1, 2.2], opacity: [0.6, 0] }}
              transition={{ duration: 2, repeat: Infinity }}
            />
          </div>

          {/* Status text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold" style={{ color: meta.color }}>
                {meta.name.toUpperCase()}
              </span>
              {isTrialActive && (
                <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-foreground/10 text-foreground/70">
                  Trial · {trialDaysLeft}d left
                </span>
              )}
            </div>
            {lockedHere.length > 0 ? (
              <div className="text-[10px] text-muted-foreground truncate">
                <Lock className="w-2.5 h-2.5 inline mr-0.5 -mt-0.5" />
                {lockedHere.length === 1
                  ? `${lockedHere[0].label} requires Premium`
                  : `${lockedHere.length} features need Premium on this screen`}
              </div>
            ) : (
              <div className="text-[10px] text-muted-foreground truncate">
                Everything on this screen is unlocked
              </div>
            )}
          </div>

          {/* CTA */}
          {(currentPlan === "none" || lockedHere.length > 0) && (
            <button
              type="button"
              onClick={onUpgrade}
              className="shrink-0 inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold transition-transform active:scale-95"
              style={{
                background: meta.gradient,
                color: currentPlan === "premium" ? "#fff" : "#0B0F1A",
              }}
            >
              {currentPlan === "none" ? (
                <>
                  <Sparkles className="w-3 h-3" />
                  <span>Choose Plan</span>
                </>
              ) : (
                <>
                  <Crown className="w-3 h-3" />
                  <span>Upgrade</span>
                </>
              )}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default PlanContextBar;
