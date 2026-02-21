import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ChevronRight, Sparkles } from "lucide-react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

const TrialBanner = () => {
  const { isTrialActive, trialDaysLeft, currentPlan, subscription, refetch } = usePlanGatingContext();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  const isTrialExpired =
    subscription?.is_trial &&
    subscription?.trial_end_date &&
    new Date(subscription.trial_end_date) < new Date();

  if ((!isTrialActive && !isTrialExpired) || dismissed) return null;

  const totalDays = 15;
  const elapsed = totalDays - trialDaysLeft;
  const progress = isTrialExpired ? 100 : Math.min(100, (elapsed / totalDays) * 100);

  const isUrgent = trialDaysLeft <= 3;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -8, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 300, damping: 24 }}
        onClick={() => setShowPlanModal(true)}
        className="relative cursor-pointer group"
      >
        {/* Glowing background layer */}
        <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-primary/8 via-primary/4 to-primary/8 group-hover:from-primary/12 group-hover:via-primary/6 group-hover:to-primary/12 transition-all duration-500" />
        
        {/* Subtle animated shimmer */}
        <motion.div
          className="absolute inset-0 rounded-2xl overflow-hidden"
          initial={false}
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-r from-transparent via-primary/6 to-transparent"
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
          />
        </motion.div>

        <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/10 group-hover:border-primary/20 transition-colors duration-300">
          {/* Crown icon with subtle pulse */}
          <motion.div
            className="w-8 h-8 rounded-xl bg-primary/10 flex items-center justify-center shrink-0"
            animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <Crown className="w-3.5 h-3.5 text-primary" />
          </motion.div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground truncate">
                {isTrialExpired ? "Trial ended" : `Premium Trial`}
              </p>
              {!isTrialExpired && (
                <span className="text-[10px] font-medium text-primary/80 bg-primary/8 px-1.5 py-0.5 rounded-full whitespace-nowrap">
                  {trialDaysLeft}d left
                </span>
              )}
            </div>

            {/* Micro progress bar */}
            {!isTrialExpired && (
              <div className="mt-1.5 h-1 w-full rounded-full bg-primary/8 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${
                    isUrgent
                      ? "bg-gradient-to-r from-amber-400 to-amber-500"
                      : "bg-gradient-to-r from-primary/60 to-primary"
                  }`}
                  initial={{ width: 0 }}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 1.2, ease: "easeOut", delay: 0.3 }}
                />
              </div>
            )}
          </div>

          {/* CTA arrow */}
          <motion.div
            className="flex items-center gap-1 shrink-0"
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
          >
            <Sparkles className="w-3 h-3 text-primary/50 hidden group-hover:block" />
            <ChevronRight className="w-4 h-4 text-primary/40 group-hover:text-primary/70 transition-colors" />
          </motion.div>
        </div>
      </motion.div>

      {showPlanModal &&
        createPortal(
          <SubscriptionPlan
            currentPlan={currentPlan}
            onClose={() => setShowPlanModal(false)}
            onPlanChanged={() => {
              refetch();
              setShowPlanModal(false);
            }}
          />,
          document.body
        )}
    </>
  );
};

export default TrialBanner;
