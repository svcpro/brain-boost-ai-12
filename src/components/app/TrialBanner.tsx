import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, XCircle, Crown, ChevronRight } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

const TrialBanner = () => {
  const { isTrialActive, trialDaysLeft, currentPlan, subscription, refetch } = usePlanGatingContext();
  const [showPlanModal, setShowPlanModal] = useState(false);

  const isTrialExpired =
    subscription?.is_trial &&
    subscription?.trial_end_date &&
    new Date(subscription.trial_end_date) < new Date();

  if (!isTrialActive && !isTrialExpired) return null;

  const totalDays = 15;
  const elapsed = totalDays - trialDaysLeft;
  const progress = isTrialExpired ? 100 : Math.min(100, (elapsed / totalDays) * 100);

  const urgency: "normal" | "warning" | "urgent" | "expired" = isTrialExpired
    ? "expired"
    : trialDaysLeft <= 1
      ? "urgent"
      : trialDaysLeft <= 3
        ? "warning"
        : "normal";

  const config = {
    normal: {
      bg: "from-primary/10 via-primary/5 to-transparent",
      border: "border-primary/20",
      icon: Clock,
      iconColor: "text-primary",
      title: `Premium Trial – ${trialDaysLeft} days left`,
      subtitle: "You have full AI access unlocked.",
    },
    warning: {
      bg: "from-amber-500/15 via-amber-500/5 to-transparent",
      border: "border-amber-500/30",
      icon: AlertTriangle,
      iconColor: "text-amber-500",
      title: `⚠️ Trial ending in ${trialDaysLeft} day${trialDaysLeft > 1 ? "s" : ""}!`,
      subtitle: "Don't lose your study progress. Subscribe now.",
    },
    urgent: {
      bg: "from-destructive/15 via-destructive/5 to-transparent",
      border: "border-destructive/30",
      icon: XCircle,
      iconColor: "text-destructive",
      title: "🔴 Last day of your trial!",
      subtitle: "Features lock tomorrow. Subscribe to keep access.",
    },
    expired: {
      bg: "from-destructive/20 via-destructive/10 to-transparent",
      border: "border-destructive/40",
      icon: XCircle,
      iconColor: "text-destructive",
      title: "Your AI Brain Trial Has Ended",
      subtitle: "Subscribe to ACRY Premium to continue.",
    },
  }[urgency];

  const Icon = config.icon;

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`rounded-2xl border ${config.border} bg-gradient-to-r ${config.bg} p-4 space-y-3`}
      >
        <div className="flex items-center gap-3">
          <motion.div
            animate={urgency === "urgent" || urgency === "expired" ? { scale: [1, 1.15, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
              urgency === "expired" || urgency === "urgent"
                ? "bg-destructive/20"
                : urgency === "warning"
                  ? "bg-amber-500/20"
                  : "bg-primary/20"
            }`}
          >
            <Icon className={`w-4.5 h-4.5 ${config.iconColor}`} />
          </motion.div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-foreground">{config.title}</p>
            <p className="text-xs text-muted-foreground">{config.subtitle}</p>
          </div>
        </div>

        {!isTrialExpired && (
          <div className="space-y-1">
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>Day {elapsed} of {totalDays}</span>
              <span>{trialDaysLeft} days remaining</span>
            </div>
            <Progress value={progress} className="h-2 bg-secondary/60" />
          </div>
        )}

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowPlanModal(true)}
          className={`w-full py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition-all ${
            urgency === "expired" || urgency === "urgent"
              ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
              : urgency === "warning"
                ? "bg-amber-500 text-white hover:bg-amber-600"
                : "bg-primary text-primary-foreground hover:bg-primary/90"
          }`}
        >
          <Crown className="w-3.5 h-3.5" />
          {isTrialExpired ? "Subscribe to ACRY Premium" : "Subscribe Now · ₹149/mo"}
          <ChevronRight className="w-3.5 h-3.5" />
        </motion.button>
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
