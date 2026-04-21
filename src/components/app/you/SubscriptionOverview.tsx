import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Check, ChevronRight, Shield, Loader2, Calendar, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";

interface SubscriptionOverviewProps {
  currentPlan: string;
  onManagePlan: () => void;
}

const SubscriptionOverview = ({ currentPlan, onManagePlan }: SubscriptionOverviewProps) => {
  const { user } = useAuth();
  const [isTrial, setIsTrial] = useState(false);
  const [daysLeft, setDaysLeft] = useState<number | null>(null);
  const [expiresAt, setExpiresAt] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);

  useEffect(() => {
    if (!user) return;
    supabase.from("user_subscriptions")
      .select("plan_id, is_trial, trial_end_date, expires_at, status")
      .eq("user_id", user.id)
      .eq("status", "active")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        setIsTrial(data.is_trial || false);
        setIsActive(data.status === "active");
        setExpiresAt(data.expires_at);
        const endDate = data.is_trial ? data.trial_end_date : data.expires_at;
        if (endDate) {
          const days = Math.ceil((new Date(endDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setDaysLeft(days > 0 ? days : 0);
        }
      });
  }, [user, currentPlan]);

  const isPremium = currentPlan === "premium";
  const isStarter = currentPlan === "starter";
  const planName = isPremium ? "ACRY Premium" : isStarter ? "ACRY Starter" : "ACRY";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.28 }}
      className="space-y-3"
    >
      <div className="glass rounded-2xl neural-border overflow-hidden">
        <div className="p-5 bg-gradient-to-r from-primary/10 via-transparent to-transparent">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-xl bg-primary/15 neural-border flex items-center justify-center">
              <Crown className="w-5 h-5 text-primary" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-foreground">{planName}</h3>
                {isActive && !isTrial && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-success/20 text-success border border-success/30 uppercase tracking-wider">
                    Active
                  </span>
                )}
                {isTrial && (
                  <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/20 text-primary border border-primary/30 uppercase tracking-wider">
                    Trial
                  </span>
                )}
              </div>
              <p className="text-[10px] text-muted-foreground">
                {isTrial && daysLeft !== null
                  ? `Trial · ${daysLeft} days left`
                  : expiresAt
                    ? `Next billing: ${format(new Date(expiresAt), "MMM d, yyyy")}`
                    : "Active"}
              </p>
            </div>
          </div>

          {/* Reinforcement message */}
          {isPremium && (
            <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/10 mb-3">
              <Zap className="w-4 h-4 text-primary shrink-0" />
              <p className="text-xs text-foreground/80 font-medium">You have full AI access unlocked.</p>
            </div>
          )}

          {/* Feature summary */}
          <div className="grid grid-cols-2 gap-1.5">
            {["AI Second Brain", "Focus Study Mode", "Neural Memory Map", "AI Strategy", "Voice Notifications", "Unlimited Usage"].map(f => (
              <div key={f} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Check className="w-3 h-3 text-success shrink-0" />
                {f}
              </div>
            ))}
          </div>
        </div>

        {/* Actions */}
        <div className="px-5 pb-4 pt-2 space-y-2">
          <motion.button
            whileTap={{ scale: 0.97 }}
            onClick={onManagePlan}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary text-sm font-semibold transition-all border border-primary/20"
          >
            <Shield className="w-4 h-4" />
            Manage Subscription
            <ChevronRight className="w-4 h-4" />
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default SubscriptionOverview;
