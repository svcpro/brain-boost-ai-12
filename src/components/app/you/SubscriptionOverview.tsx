import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Check, ChevronRight, Sparkles, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface SubscriptionOverviewProps {
  currentPlan: string;
  onManagePlan: () => void;
}

const PLAN_FEATURES: Record<string, string[]> = {
  pro: ["AI Brain Agent", "Smart Recall", "Study Insights", "Voice Notifications", "Data Backup"],
  ultra: ["Everything in Pro", "Cognitive Twin", "ML Dashboard", "Priority Support", "Advanced Analytics", "Deep Focus Mode"],
};

const SubscriptionOverview = ({ currentPlan, onManagePlan }: SubscriptionOverviewProps) => {
  const { user } = useAuth();
  const [isTrial, setIsTrial] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [resolvedPlan, setResolvedPlan] = useState(currentPlan);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_subscriptions")
      .select("plan_id, is_trial, trial_end_date, expires_at")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(async ({ data }) => {
        if (!data) return;
        setIsTrial(data.is_trial || false);
        
        let planKey = data.plan_id;
        if (planKey?.includes("-") && planKey.length > 10) {
          const { data: planData } = await supabase.from("subscription_plans").select("plan_key").eq("id", planKey).maybeSingle();
          planKey = planData?.plan_key || "none";
        }
        setResolvedPlan(planKey || "none");

        const endDate = data.is_trial ? data.trial_end_date : data.expires_at;
        if (endDate) {
          const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDaysLeft(days > 0 ? days : 0);
        }
      });
  }, [user, currentPlan]);

  const planLabel = resolvedPlan === "ultra" ? "Ultra Brain" : resolvedPlan === "pro" ? "Pro Brain" : "No Active Plan";
  const PlanIcon = resolvedPlan === "ultra" ? Sparkles : resolvedPlan === "pro" ? Zap : Crown;
  const features = PLAN_FEATURES[resolvedPlan] || [];
  const isUpgradeable = resolvedPlan !== "ultra";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="glass rounded-2xl neural-border overflow-hidden"
    >
      {/* Plan Header */}
      <div className={`p-5 ${resolvedPlan === "ultra" ? "bg-gradient-to-r from-warning/10 via-primary/5 to-transparent" : "bg-gradient-to-r from-primary/10 via-transparent to-transparent"}`}>
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${resolvedPlan === "ultra" ? "bg-warning/15" : "bg-primary/15"}`}>
            <PlanIcon className={`w-5 h-5 ${resolvedPlan === "ultra" ? "text-warning" : "text-primary"}`} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">{planLabel}</h3>
            <p className="text-[10px] text-muted-foreground">
              {isTrial && daysLeft !== null ? `Trial · ${daysLeft} days left` : daysLeft !== null ? `${daysLeft} days remaining` : "Active"}
            </p>
          </div>
        </div>
      </div>

      {/* Features */}
      {features.length > 0 && (
        <div className="px-5 py-3 space-y-2">
          {features.slice(0, 4).map(f => (
            <div key={f} className="flex items-center gap-2">
              <Check className="w-3 h-3 text-success shrink-0" />
              <span className="text-[11px] text-foreground">{f}</span>
            </div>
          ))}
          {features.length > 4 && (
            <span className="text-[10px] text-muted-foreground">+{features.length - 4} more features</span>
          )}
        </div>
      )}

      {/* CTA */}
      <div className="px-5 pb-5 pt-2">
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={onManagePlan}
          className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all ${
            isUpgradeable
              ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
              : "bg-secondary/50 text-foreground border border-border hover:bg-secondary"
          }`}
        >
          <span>{isUpgradeable ? "Upgrade Plan" : "Manage Plan"}</span>
          <ChevronRight className="w-4 h-4" />
        </motion.button>
      </div>
    </motion.div>
  );
};

export default SubscriptionOverview;
