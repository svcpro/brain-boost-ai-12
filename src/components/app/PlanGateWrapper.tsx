import { ReactNode, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { Lock, Crown } from "lucide-react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import SubscriptionPlan from "@/components/app/SubscriptionPlan";

interface PlanGateWrapperProps {
  featureKey: string;
  children: ReactNode;
  showPreview?: boolean;
  onUpgrade?: () => void;
}

const PlanGateWrapper = ({ featureKey, children, showPreview = true, onUpgrade }: PlanGateWrapperProps) => {
  const { canAccess, loading, currentPlan, refetch } = usePlanGatingContext();
  const [showPlanModal, setShowPlanModal] = useState(false);

  if (loading) return <>{children}</>;

  const allowed = canAccess(featureKey);
  if (allowed) return <>{children}</>;

  if (!showPreview) return null;

  return (
    <>
      <div className="relative group" style={{ position: "relative" }}>
        <div className="pointer-events-none select-none opacity-40 blur-[2px] saturate-50">
          {children}
        </div>
        <div className="absolute inset-0 flex items-center justify-center" style={{ zIndex: 20 }}>
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={(e) => {
              e.stopPropagation();
              e.preventDefault();
              setShowPlanModal(true);
              onUpgrade?.();
            }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg hover:bg-primary transition-colors backdrop-blur-sm cursor-pointer pointer-events-auto"
            type="button"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Upgrade to ACRY Premium</span>
            <Crown className="w-3.5 h-3.5" />
          </motion.button>
        </div>
      </div>
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

export default PlanGateWrapper;
