import { ReactNode, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Lock, Crown, Sparkles, Zap } from "lucide-react";
import { usePlanGatingContext } from "@/hooks/usePlanGating";

interface PlanGateWrapperProps {
  featureKey: string;
  children: ReactNode;
  /** If true, shows a blurred preview instead of hiding entirely */
  showPreview?: boolean;
  onUpgrade?: () => void;
}

const PLAN_ICONS: Record<string, typeof Zap> = { pro: Zap, ultra: Sparkles };
const PLAN_LABELS: Record<string, string> = { pro: "Pro Brain", ultra: "Ultra Brain" };

const PlanGateWrapper = ({ featureKey, children, showPreview = true, onUpgrade }: PlanGateWrapperProps) => {
  const { canAccess, getRequiredPlan, loading } = usePlanGatingContext();
  const [showTooltip, setShowTooltip] = useState(false);

  if (loading) return <>{children}</>;
  
  const allowed = canAccess(featureKey);
  if (allowed) return <>{children}</>;

  const requiredPlan = getRequiredPlan(featureKey);
  const PlanIcon = PLAN_ICONS[requiredPlan || "pro"] || Zap;
  const planLabel = PLAN_LABELS[requiredPlan || "pro"] || "Pro Brain";

  if (!showPreview) return null;

  return (
    <div className="relative group">
      <div className="pointer-events-none select-none opacity-40 blur-[2px] saturate-50">
        {children}
      </div>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className="absolute inset-0 flex items-center justify-center z-10"
      >
        <button
          onClick={() => { setShowTooltip(!showTooltip); onUpgrade?.(); }}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary/90 text-primary-foreground text-xs font-semibold shadow-lg hover:bg-primary transition-colors backdrop-blur-sm"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>Upgrade to {planLabel}</span>
          <PlanIcon className="w-3.5 h-3.5" />
        </button>
      </motion.div>
    </div>
  );
};

export default PlanGateWrapper;
