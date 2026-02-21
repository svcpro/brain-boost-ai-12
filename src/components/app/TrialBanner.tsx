import { useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, ChevronRight, Zap, Star } from "lucide-react";
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
        initial={{ opacity: 0, y: -14, scale: 0.94 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ type: "spring", stiffness: 420, damping: 26, delay: 0.1 }}
        onClick={() => setShowPlanModal(true)}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative cursor-pointer group"
        whileHover={{ scale: 1.018 }}
        whileTap={{ scale: 0.982 }}
      >
        {/* Outer animated gradient border */}
        <motion.div
          className="absolute -inset-[1px] rounded-2xl overflow-hidden"
          animate={{ opacity: isHovered ? 1 : 0.5 }}
          transition={{ duration: 0.4 }}
        >
          <motion.div
            className="absolute inset-0"
            style={{
              background: isUrgent
                ? "conic-gradient(from 0deg, hsl(40 100% 50% / 0.3), hsl(0 72% 51% / 0.2), hsl(330 100% 60% / 0.25), hsl(40 100% 50% / 0.3))"
                : "conic-gradient(from 0deg, hsl(var(--primary) / 0.3), hsl(var(--accent) / 0.25), hsl(155 100% 50% / 0.2), hsl(var(--primary) / 0.3))",
            }}
            animate={{ rotate: [0, 360] }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
          />
          {/* Inner mask to keep it as a border */}
          <div className="absolute inset-[1px] rounded-[15px] bg-card" />
        </motion.div>

        {/* Dual-layer travelling shimmer */}
        <motion.div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <motion.div
            className="absolute inset-0"
            style={{
              background: isUrgent
                ? "linear-gradient(110deg, transparent 20%, hsl(40 100% 50% / 0.06) 40%, hsl(330 100% 60% / 0.05) 60%, transparent 80%)"
                : "linear-gradient(110deg, transparent 20%, hsl(var(--primary) / 0.06) 40%, hsl(var(--accent) / 0.05) 60%, transparent 80%)",
            }}
            animate={{ x: ["-120%", "220%"] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", repeatDelay: 5 }}
          />
          <motion.div
            className="absolute inset-0"
            style={{
              background: "linear-gradient(110deg, transparent 30%, hsl(155 100% 50% / 0.04) 50%, transparent 70%)",
            }}
            animate={{ x: ["220%", "-120%"] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 6, delay: 2 }}
          />
        </motion.div>

        {/* Floating sparkles on hover */}
        <AnimatePresence>
          {isHovered && (
            <>
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.div
                  key={i}
                  className="absolute pointer-events-none"
                  style={{ left: `${15 + i * 18}%`, bottom: "50%" }}
                  initial={{ opacity: 0, y: 0, scale: 0 }}
                  animate={{
                    opacity: [0, 0.8, 0],
                    y: [0, -18 - i * 3],
                    scale: [0, 1, 0.3],
                    rotate: [0, 90 + i * 30],
                  }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 1 + i * 0.1, delay: i * 0.08, ease: "easeOut" }}
                >
                  <Star className={`w-2 h-2 ${i % 2 === 0 ? "text-primary/50" : "text-accent/50"}`} fill="currentColor" />
                </motion.div>
              ))}
            </>
          )}
        </AnimatePresence>

        <div className="relative flex items-center gap-3 px-4 py-3 rounded-2xl bg-card/60 backdrop-blur-md transition-all duration-300">
          {/* Crown with multi-ring glow */}
          <div className="relative shrink-0">
            {/* Outermost ring */}
            <motion.div
              className="absolute -inset-1.5 rounded-2xl"
              style={{
                background: isUrgent
                  ? "radial-gradient(circle, hsl(40 100% 50% / 0.15), transparent 70%)"
                  : "radial-gradient(circle, hsl(var(--primary) / 0.15), transparent 70%)",
              }}
              animate={{
                scale: [1, 1.3, 1],
                opacity: [0.4, 0.7, 0.4],
              }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            />
            {/* Inner glow */}
            <motion.div
              className="absolute inset-0 rounded-xl blur-sm"
              style={{
                background: isUrgent
                  ? "hsl(40 100% 50% / 0.25)"
                  : "hsl(var(--primary) / 0.2)",
              }}
              animate={{
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut", delay: 0.5 }}
            />
            <motion.div
              className={`relative w-8 h-8 rounded-xl flex items-center justify-center overflow-hidden ${
                isUrgent
                  ? "bg-gradient-to-br from-warning/20 to-destructive/15"
                  : "bg-gradient-to-br from-primary/15 to-accent/10"
              }`}
              animate={isUrgent ? { rotate: [0, -2, 2, 0] } : {}}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            >
              {/* Internal shine */}
              <motion.div
                className="absolute inset-0 bg-gradient-to-tr from-transparent via-white/10 to-transparent"
                animate={{ opacity: [0, 0.6, 0] }}
                transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              />
              <motion.div
                animate={{
                  rotate: [0, 8, -8, 0],
                  scale: [1, 1.12, 1],
                  y: [0, -1, 0],
                }}
                transition={{ duration: 3.5, repeat: Infinity, ease: "easeInOut" }}
              >
                <Crown
                  className={`w-3.5 h-3.5 ${
                    isUrgent ? "text-warning drop-shadow-[0_0_4px_hsl(40_100%_50%/0.6)]" : "text-primary drop-shadow-[0_0_4px_hsl(var(--primary)/0.5)]"
                  }`}
                />
              </motion.div>
            </motion.div>
          </div>

          {/* Text content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <motion.p
                className="text-xs font-bold text-foreground truncate"
                animate={isTrialExpired ? { opacity: [1, 0.7, 1] } : {}}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {isTrialExpired ? "Trial ended" : "Premium Trial"}
              </motion.p>
              {!isTrialExpired && (
                <motion.span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap ${
                    isUrgent
                      ? "text-warning-foreground bg-gradient-to-r from-warning/20 to-destructive/15 border border-warning/25"
                      : "text-primary bg-gradient-to-r from-primary/10 to-accent/8 border border-primary/15"
                  }`}
                  animate={isUrgent ? { scale: [1, 1.06, 1] } : {}}
                  transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <span className={isUrgent ? "text-warning" : "text-primary"}>
                    {trialDaysLeft}d left
                  </span>
                </motion.span>
              )}
              {isTrialExpired && (
                <motion.span
                  className="text-[10px] font-bold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full border border-destructive/20"
                  animate={{ opacity: [1, 0.6, 1], scale: [1, 1.03, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  Upgrade Now
                </motion.span>
              )}
            </div>

            {/* Multi-layer progress bar */}
            {!isTrialExpired && (
              <div className="mt-1.5 relative">
                {/* Track with subtle gradient */}
                <div
                  className="h-[5px] w-full rounded-full overflow-hidden"
                  style={{
                    background: isUrgent
                      ? "linear-gradient(90deg, hsl(40 100% 50% / 0.08), hsl(0 72% 51% / 0.06))"
                      : "linear-gradient(90deg, hsl(var(--primary) / 0.08), hsl(var(--accent) / 0.06))",
                  }}
                >
                  {/* Background subtle pulse */}
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{
                      background: isUrgent
                        ? "hsl(40 100% 50% / 0.04)"
                        : "hsl(var(--primary) / 0.04)",
                    }}
                    animate={{ opacity: [0, 1, 0] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                  />
                  {/* Main progress fill with tri-color gradient */}
                  <motion.div
                    className="h-full rounded-full relative overflow-hidden"
                    style={{
                      background: isUrgent
                        ? "linear-gradient(90deg, hsl(40 100% 55%), hsl(25 100% 50%), hsl(0 72% 51%))"
                        : "linear-gradient(90deg, hsl(155 100% 45%), hsl(var(--primary)), hsl(var(--accent)))",
                    }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  >
                    {/* Double shimmer wave */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                      animate={{ x: ["-150%", "250%"] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut", repeatDelay: 4 }}
                    />
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent"
                      animate={{ x: ["250%", "-150%"] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeInOut", repeatDelay: 5, delay: 1 }}
                    />
                  </motion.div>
                </div>

                {/* Glowing dot at progress tip */}
                <motion.div
                  className="absolute top-1/2 -translate-y-1/2"
                  initial={{ left: "0%" }}
                  animate={{ left: `${progress}%` }}
                  transition={{ duration: 1.6, ease: [0.22, 1, 0.36, 1], delay: 0.4 }}
                  style={{ marginLeft: "-4px" }}
                >
                  <motion.div
                    className={`w-2 h-2 rounded-full ${
                      isUrgent ? "bg-warning" : "bg-primary"
                    }`}
                    animate={{
                      boxShadow: isUrgent
                        ? [
                            "0 0 4px hsl(40 100% 50% / 0.5), 0 0 10px hsl(40 100% 50% / 0.3)",
                            "0 0 8px hsl(40 100% 50% / 0.8), 0 0 16px hsl(40 100% 50% / 0.4)",
                            "0 0 4px hsl(40 100% 50% / 0.5), 0 0 10px hsl(40 100% 50% / 0.3)",
                          ]
                        : [
                            "0 0 4px hsl(187 100% 50% / 0.5), 0 0 10px hsl(187 100% 50% / 0.2)",
                            "0 0 8px hsl(187 100% 50% / 0.8), 0 0 16px hsl(262 100% 65% / 0.3)",
                            "0 0 4px hsl(187 100% 50% / 0.5), 0 0 10px hsl(187 100% 50% / 0.2)",
                          ],
                    }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                  />
                </motion.div>
              </div>
            )}
          </div>

          {/* CTA */}
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
                  <Zap className={`w-3 h-3 ${isUrgent ? "text-warning/70" : "text-accent/60"}`} />
                </motion.div>
              )}
            </AnimatePresence>
            <ChevronRight
              className={`w-4 h-4 transition-colors duration-300 ${
                isUrgent
                  ? "text-warning/40 group-hover:text-warning/80"
                  : "text-primary/40 group-hover:text-primary/80"
              }`}
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
