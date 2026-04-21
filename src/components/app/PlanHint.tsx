import { Crown, Lock, Sparkles, Check } from "lucide-react";
import { motion } from "framer-motion";
import { usePlanGatingContext } from "@/hooks/usePlanGating";

interface PlanHintProps {
  featureKey: string;
  variant?: "badge" | "inline" | "ribbon";
  label?: string;
  onUpgrade?: () => void;
}

const PLAN_META: Record<string, { name: string; price: string; color: string; bg: string }> = {
  starter: {
    name: "Starter",
    price: "₹149/mo",
    color: "#00E5FF",
    bg: "linear-gradient(90deg, #00E5FF22, #7C4DFF22)",
  },
  premium: {
    name: "Premium",
    price: "₹499/mo",
    color: "#FFD700",
    bg: "linear-gradient(90deg, #FFD70022, #FF850022)",
  },
};

/**
 * Shows a small contextual hint indicating which plan is required for a feature.
 * - If user already has access: shows nothing (or a tiny ✓ in `inline` mode)
 * - If locked: shows the required plan name + price as a tappable badge
 */
const PlanHint = ({ featureKey, variant = "badge", label, onUpgrade }: PlanHintProps) => {
  const { canAccess, getRequiredPlan, currentPlan, loading } = usePlanGatingContext();

  if (loading) return null;
  const allowed = canAccess(featureKey);

  // Already unlocked — show subtle confirmation only in inline mode
  if (allowed) {
    if (variant !== "inline") return null;
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-medium text-emerald-400">
        <Check className="w-3 h-3" />
        <span>Included in {PLAN_META[currentPlan]?.name || "your plan"}</span>
      </span>
    );
  }

  const required = getRequiredPlan(featureKey) || "premium";
  const meta = PLAN_META[required] || PLAN_META.premium;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onUpgrade?.();
  };

  if (variant === "ribbon") {
    return (
      <motion.button
        type="button"
        onClick={handleClick}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        className="w-full flex items-center justify-between gap-3 px-3 py-2 rounded-xl text-left"
        style={{
          background: meta.bg,
          border: `1px solid ${meta.color}33`,
        }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Lock className="w-3.5 h-3.5 shrink-0" style={{ color: meta.color }} />
          <div className="min-w-0">
            <div className="text-[11px] font-bold text-foreground truncate">
              {label || "Unlock this feature"}
            </div>
            <div className="text-[9px] text-muted-foreground">
              Requires {meta.name} · {meta.price}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1 px-2 py-1 rounded-md" style={{ background: meta.color }}>
          <Crown className="w-3 h-3" style={{ color: "#0B0F1A" }} />
          <span className="text-[10px] font-bold" style={{ color: "#0B0F1A" }}>
            Upgrade
          </span>
        </div>
      </motion.button>
    );
  }

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={handleClick}
        className="inline-flex items-center gap-1 text-[10px] font-semibold transition-opacity hover:opacity-80"
        style={{ color: meta.color }}
      >
        <Lock className="w-3 h-3" />
        <span>{meta.name} · {meta.price}</span>
      </button>
    );
  }

  // Default: compact badge
  return (
    <motion.button
      type="button"
      onClick={handleClick}
      whileTap={{ scale: 0.95 }}
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
      style={{
        background: meta.bg,
        border: `1px solid ${meta.color}40`,
        color: meta.color,
      }}
    >
      <Sparkles className="w-2.5 h-2.5" />
      <span>{meta.name.toUpperCase()}</span>
    </motion.button>
  );
};

export default PlanHint;
