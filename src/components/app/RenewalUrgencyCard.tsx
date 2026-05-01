import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Crown, Zap, Clock, ChevronRight, Sparkles } from "lucide-react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

/**
 * Renewal Urgency Card — shown on the Home tab when:
 *  - Trial has expired (highest urgency), OR
 *  - Trial has ≤ 2 days left (final-stretch urgency)
 *
 * Distinct from TrialBanner (slim status). This is a full attention-grabbing
 * conversion card that appears INSIDE the home feed, near the top.
 */
const RenewalUrgencyCard = () => {
  const { isTrialActive, trialDaysLeft, currentPlan, subscription, refetch } = usePlanGatingContext();
  const [showPlan, setShowPlan] = useState(false);

  const isTrialExpired =
    !!subscription?.is_trial &&
    !!subscription?.trial_end_date &&
    new Date(subscription.trial_end_date) < new Date();

  const isFinalStretch = isTrialActive && trialDaysLeft <= 2 && trialDaysLeft >= 0;

  // Don't show if user already paid (premium without trial), or if trial has plenty of time
  if (currentPlan === "premium" && !subscription?.is_trial) return null;
  if (!isTrialExpired && !isFinalStretch) return null;

  const isUrgent = isTrialExpired;
  const headline = isTrialExpired ? "Your Free Trial Has Ended" : `Only ${trialDaysLeft} Day${trialDaysLeft !== 1 ? "s" : ""} Left!`;
  const subline = isTrialExpired
    ? "Don't lose your progress — renew now to keep your AI brain, predictions and study plans active."
    : "Lock in Premium before your trial ends to keep all AI features without interruption.";
  const ctaLabel = isTrialExpired ? "Renew Now" : "Upgrade & Save";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26 }}
        onClick={() => setShowPlan(true)}
        whileTap={{ scale: 0.985 }}
        className="relative cursor-pointer rounded-2xl overflow-hidden mx-1"
        style={{
          background: isUrgent
            ? "linear-gradient(135deg, hsl(0 85% 45% / 0.18), hsl(25 100% 55% / 0.14), hsl(330 100% 60% / 0.10))"
            : "linear-gradient(135deg, hsl(45 100% 55% / 0.16), hsl(25 100% 55% / 0.12), hsl(330 100% 60% / 0.10))",
          border: `1px solid hsl(${isUrgent ? "0 85% 50%" : "45 100% 55%"} / 0.35)`,
          boxShadow: `0 12px 36px -12px hsl(${isUrgent ? "0 85% 45%" : "25 100% 55%"} / 0.4)`,
        }}
      >
        {/* Animated shimmer */}
        <motion.div
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{
            background:
              "linear-gradient(110deg, transparent 30%, hsl(25 100% 65% / 0.10) 50%, transparent 70%)",
          }}
          animate={{ x: ["-110%", "210%"] }}
          transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
        />

        {/* Pulsing glow when urgent */}
        {isUrgent && (
          <motion.div
            aria-hidden
            className="absolute -inset-px rounded-2xl pointer-events-none"
            style={{ boxShadow: "inset 0 0 24px hsl(0 85% 50% / 0.25)" }}
            animate={{ opacity: [0.4, 0.9, 0.4] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
          />
        )}

        <div className="relative px-4 py-4 flex items-center gap-3">
          {/* Icon */}
          <div className="relative shrink-0">
            <motion.div
              className="absolute -inset-1.5 rounded-2xl"
              style={{
                background: `radial-gradient(circle, hsl(${isUrgent ? "0 85% 55%" : "45 100% 60%"} / 0.30), transparent 70%)`,
              }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.5, 0.9, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />
            <div
              className="relative w-12 h-12 rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, hsl(${isUrgent ? "0 85% 50%" : "45 100% 55%"}), hsl(25 100% 55%))`,
              }}
            >
              {isUrgent ? (
                <Clock className="w-6 h-6 text-white drop-shadow" />
              ) : (
                <Zap className="w-6 h-6 text-white drop-shadow" />
              )}
            </div>
          </div>

          {/* Text */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-0.5">
              <Crown className="w-3 h-3" style={{ color: isUrgent ? "hsl(0 85% 60%)" : "hsl(45 100% 60%)" }} />
              <span
                className="text-[9px] font-extrabold tracking-wider"
                style={{ color: isUrgent ? "hsl(0 85% 60%)" : "hsl(45 100% 60%)" }}
              >
                {isUrgent ? "TRIAL ENDED" : "TRIAL ENDING"}
              </span>
            </div>
            <h3 className="text-sm font-bold text-foreground leading-tight">{headline}</h3>
            <p className="text-[10.5px] text-muted-foreground mt-0.5 leading-snug line-clamp-2">{subline}</p>
          </div>

          {/* CTA */}
          <motion.button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowPlan(true);
            }}
            whileTap={{ scale: 0.94 }}
            className="shrink-0 inline-flex items-center gap-1 px-3 py-2 rounded-xl text-[11px] font-bold text-white"
            style={{
              background: `linear-gradient(135deg, hsl(${isUrgent ? "0 85% 50%" : "25 100% 55%"}), hsl(330 100% 60%))`,
              boxShadow: `0 6px 18px -6px hsl(${isUrgent ? "0 85% 45%" : "25 100% 55%"} / 0.6)`,
            }}
          >
            <Sparkles className="w-3 h-3" />
            <span>{ctaLabel}</span>
            <ChevronRight className="w-3 h-3" />
          </motion.button>
        </div>
      </motion.div>

      {showPlan &&
        createPortal(
          <SubscriptionPlan
            currentPlan={currentPlan}
            onClose={() => setShowPlan(false)}
            onPlanChanged={() => {
              refetch();
              setShowPlan(false);
            }}
          />,
          document.body
        )}
    </>
  );
};

export default RenewalUrgencyCard;
