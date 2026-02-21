import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ChevronRight, Sparkles, Zap } from "lucide-react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

const TrialBanner = () => {
  const { isTrialActive, trialDaysLeft, currentPlan, subscription, refetch } = usePlanGatingContext();
  const [showPlanModal, setShowPlanModal] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [isHovered, setIsHovered] = useState(false);

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
        initial={{ opacity: 0, y: -12, scale: 0.96 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 400, damping: 28, delay: 0.1 }}
        onClick={() => setShowPlanModal(true)}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative cursor-pointer group"
        whileHover={{ scale: 1.015 }}
        whileTap={{ scale: 0.985 }}
      >
        {/* Animated glow ring behind the card */}
        <motion.div
          className="absolute -inset-[1px] rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          style={{
            background: isUrgent
              ? "linear-gradient(135deg, hsl(40 100% 50% / 0.15), hsl(0 72% 51% / 0.1))"
              : "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))",
          }}
        />

        {/* Travelling light beam */}
        <motion.div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <motion.div
            className="absolute inset-0"
            style={{
              background: isUrgent
                ? "linear-gradient(90deg, transparent 0%, hsl(40 100% 50% / 0.08) 50%, transparent 100%)"
                : "linear-gradient(90deg, transparent 0%, hsl(var(--primary) / 0.08) 50%, transparent 100%)",
            }}
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
          />
        </motion.div>

        {/* Floating particles on hover */}
        <AnimatePresence>
          {isHovered && (
            <>
              {[...Array(3)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full bg-primary/40"
                  initial={{ opacity: 0, scale: 0, x: 20 + i * 30, y: 20 }}
                  animate={{
                    opacity: [0, 1, 0],
                    scale: [0, 1.2, 0],
                    y: [20, -10],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl border border-primary/10 group-hover:border-primary/25 bg-card/40 backdrop-blur-sm transition-colors duration-300">
          {/* Crown icon with layered glow */}
          <div className="relative shrink-0">
            <motion.div
              className="absolute inset-0 rounded-xl bg-primary/20 blur-md"
              animate={isUrgent
                ? { scale: [1, 1.4, 1], opacity: [0.3, 0.6, 0.3] }
                : { scale: [1, 1.2, 1], opacity: [0.2, 0.4, 0.2] }
              }
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            />
            <motion.div
              className={`relative w-8 h-8 rounded-xl flex items-center justify-center ${
                isUrgent ? "bg-warning/15" : "bg-primary/10"
              }`}
              animate={isUrgent ? { rotate: [0, -3, 3, 0] } : {}}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            >
              <motion.div
                animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.08, 1] }}
                transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              >
                <Crown className={`w-3.5 h-3.5 ${isUrgent ? "text-warning" : "text-primary"}`} />
              </motion.div>
            </motion.div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <p className="text-xs font-semibold text-foreground truncate">
                {isTrialExpired ? "Trial ended" : "Premium Trial"}
              </p>
              {!isTrialExpired && (
                <motion.span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
                    isUrgent
                      ? "text-warning bg-warning/12 border border-warning/20"
                      : "text-primary/90 bg-primary/8 border border-primary/10"
                  }`}
                  animate={isUrgent ? { scale: [1, 1.05, 1] } : {}}
                  transition={{ duration: 1.5, repeat: Infinity }}
                >
                  {trialDaysLeft}d left
                </motion.span>
              )}
              {isTrialExpired && (
                <motion.span
                  className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full border border-destructive/20"
                  animate={{ opacity: [1, 0.7, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Expired
                </motion.span>
              )}
            </div>

            {/* Animated progress bar */}
            {!isTrialExpired && (
              <div className="mt-1.5 relative">
                <div className="h-[5px] w-full rounded-full bg-primary/8 overflow-hidden">
                  <motion.div
                    className={`h-full rounded-full relative overflow-hidden ${
                      isUrgent
                        ? "bg-gradient-to-r from-warning/80 via-warning to-destructive/70"
                        : "bg-gradient-to-r from-primary/50 via-primary to-accent/60"
                    }`}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  >
                    {/* Inner shimmer on the progress fill */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
                    />
                  </motion.div>
                </div>
                {/* Glowing dot at progress tip */}
                <motion.div
                  className={`absolute top-1/2 -translate-y-1/2 w-[7px] h-[7px] rounded-full ${
                    isUrgent ? "bg-warning shadow-[0_0_6px_hsl(40_100%_50%/0.6)]" : "bg-primary shadow-[0_0_6px_hsl(var(--primary)/0.5)]"
                  }`}
                  initial={{ left: "0%" }}
                  animate={{ left: `${progress}%` }}
                  transition={{ duration: 1.5, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  style={{ marginLeft: "-3.5px" }}
                />
              </div>
            )}
          </div>

          {/* CTA with animated icons */}
          <motion.div
            className="flex items-center gap-0.5 shrink-0"
            animate={{ x: [0, 3, 0] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", repeatDelay: 1.5 }}
          >
            <AnimatePresence>
              {isHovered && (
                <motion.div
                  initial={{ opacity: 0, scale: 0, width: 0 }}
                  animate={{ opacity: 1, scale: 1, width: "auto" }}
                  exit={{ opacity: 0, scale: 0, width: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <Zap className="w-3 h-3 text-primary/60" />
                </motion.div>
              )}
            </AnimatePresence>
            <ChevronRight className="w-4 h-4 text-primary/40 group-hover:text-primary/80 transition-colors duration-300" />
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
