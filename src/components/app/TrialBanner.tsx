import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ChevronRight, Zap, Flame } from "lucide-react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

/* SureShot palette: Deep Red → Neon Orange → Electric Pink */
const SS = {
  red: "0 85% 45%",
  orange: "25 100% 55%",
  pink: "330 100% 60%",
  glow: "25 100% 55%",
};

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
        initial={{ opacity: 0, y: -8, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 500, damping: 28, delay: 0.05 }}
        onClick={() => setShowPlanModal(true)}
        className="relative cursor-pointer group"
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
      >
        {/* Rotating conic gradient border — SureShot colors */}
        <motion.div className="absolute -inset-[1px] rounded-xl overflow-hidden">
          <motion.div
            className="absolute inset-0"
            style={{
              background: `conic-gradient(from 0deg, hsl(${SS.red} / 0.35), hsl(${SS.orange} / 0.3), hsl(${SS.pink} / 0.25), hsl(${SS.red} / 0.35))`,
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
          />
          <div className="absolute inset-[1px] rounded-[11px] bg-card" />
        </motion.div>

        {/* Single subtle shimmer */}
        <motion.div className="absolute inset-0 rounded-xl overflow-hidden pointer-events-none">
          <motion.div
            className="absolute inset-0"
            style={{
              background: `linear-gradient(110deg, transparent 25%, hsl(${SS.orange} / 0.06) 45%, hsl(${SS.pink} / 0.04) 55%, transparent 75%)`,
            }}
            animate={{ x: ["-120%", "220%"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 6 }}
          />
        </motion.div>

        {/* Main content — compact single row */}
        <div
          className="relative flex items-center gap-2.5 px-3 py-2.5 rounded-xl"
          style={{
            background: `linear-gradient(135deg, hsl(${SS.red} / 0.06), hsl(${SS.orange} / 0.04), hsl(${SS.pink} / 0.03))`,
          }}
        >
          {/* Flame icon with warm glow */}
          <div className="relative shrink-0">
            <motion.div
              className="absolute -inset-1 rounded-lg"
              style={{ background: `radial-gradient(circle, hsl(${SS.orange} / 0.12), transparent 70%)` }}
              animate={{ scale: [1, 1.25, 1], opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className="relative w-7 h-7 rounded-lg flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, hsl(${SS.red} / 0.15), hsl(${SS.orange} / 0.12), hsl(${SS.pink} / 0.08))`,
                border: `1px solid hsl(${SS.orange} / 0.15)`,
              }}
              animate={{ rotate: [0, -3, 3, 0] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ scale: [1, 1.15, 1], y: [0, -0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              >
                {isTrialExpired ? (
                  <Crown className="w-3.5 h-3.5" style={{ color: `hsl(${SS.orange})`, filter: `drop-shadow(0 0 3px hsl(${SS.orange} / 0.5))` }} />
                ) : (
                  <Flame className="w-3.5 h-3.5" style={{ color: `hsl(${SS.orange})`, filter: `drop-shadow(0 0 3px hsl(${SS.orange} / 0.5))` }} />
                )}
              </motion.div>
            </motion.div>
          </div>

          {/* Text + progress */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-[11px] font-bold text-foreground truncate">
                {isTrialExpired ? "Trial ended" : "Premium Trial"}
              </p>
              {!isTrialExpired && (
                <motion.span
                  className="text-[9px] font-bold px-1.5 py-[1px] rounded-full whitespace-nowrap"
                  style={{
                    background: isUrgent
                      ? `linear-gradient(135deg, hsl(${SS.red} / 0.18), hsl(${SS.orange} / 0.12))`
                      : `linear-gradient(135deg, hsl(${SS.orange} / 0.12), hsl(${SS.pink} / 0.08))`,
                    color: `hsl(${isUrgent ? SS.red : SS.orange})`,
                    border: `1px solid hsl(${isUrgent ? SS.red : SS.orange} / 0.2)`,
                  }}
                  animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.8, repeat: Infinity }}
                >
                  {trialDaysLeft}d left
                </motion.span>
              )}
              {isTrialExpired && (
                <motion.span
                  className="text-[9px] font-bold px-1.5 py-[1px] rounded-full"
                  style={{
                    background: `linear-gradient(135deg, hsl(${SS.red} / 0.15), hsl(${SS.pink} / 0.1))`,
                    color: `hsl(${SS.red})`,
                    border: `1px solid hsl(${SS.red} / 0.2)`,
                  }}
                  animate={{ opacity: [1, 0.6, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Upgrade
                </motion.span>
              )}
            </div>

            {/* Compact progress bar */}
            {!isTrialExpired && (
              <div className="mt-1 relative">
                <div
                  className="h-[3px] w-full rounded-full overflow-hidden"
                  style={{ background: `hsl(${SS.orange} / 0.06)` }}
                >
                  <motion.div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      background: `linear-gradient(90deg, hsl(${SS.red}), hsl(${SS.orange}), hsl(${SS.pink}))`,
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  >
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      animate={{ x: ["-150%", "250%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 5 }}
                    />
                  </motion.div>
                </div>
                {/* Glowing tip dot */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  initial={{ left: "0%" }}
                  animate={{ left: `${progress}%` }}
                  transition={{ duration: 1.4, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}
                  style={{ marginLeft: "-3px" }}
                >
                  <motion.div
                    className="w-1.5 h-1.5 rounded-full"
                    style={{ background: `hsl(${SS.orange})` }}
                    animate={{
                      boxShadow: [
                        `0 0 3px hsl(${SS.orange} / 0.5), 0 0 8px hsl(${SS.orange} / 0.2)`,
                        `0 0 6px hsl(${SS.orange} / 0.8), 0 0 14px hsl(${SS.orange} / 0.3)`,
                        `0 0 3px hsl(${SS.orange} / 0.5), 0 0 8px hsl(${SS.orange} / 0.2)`,
                      ],
                    }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </motion.div>
              </div>
            )}
          </div>

          {/* Subtle CTA arrow */}
          <motion.div
            className="shrink-0 flex items-center"
            animate={{ x: [0, 2, 0] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 2 }}
          >
            <ChevronRight
              className="w-3.5 h-3.5 transition-colors duration-300"
              style={{ color: `hsl(${SS.orange} / 0.35)` }}
            />
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
