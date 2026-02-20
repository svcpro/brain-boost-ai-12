import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Loader2, Clock, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SubscriptionPlanProps {
  onClose: () => void;
  currentPlan?: string;
  onPlanChanged?: () => void;
}

const SubscriptionPlan = ({ onClose, currentPlan = "none", onPlanChanged }: SubscriptionPlanProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [plan, setPlan] = useState<any>(null);
  const [plansLoading, setPlansLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("plan_key", "premium")
        .eq("is_active", true)
        .maybeSingle();
      setPlan(data);
      setPlansLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("user_subscriptions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      setSubscription(data);
    })();
  }, [user]);

  const monthlyPrice = plan?.price || 149;
  const yearlyPrice = plan?.yearly_price || 1499;
  const price = billingCycle === "yearly" ? yearlyPrice : monthlyPrice;
  const savings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if ((window as any).Razorpay) { resolve(true); return; }
      const script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  const handleSubscribe = async () => {
    if (!user || !plan) return;

    // Start trial if eligible
    if (plan.trial_days > 0 && !subscription?.trial_start_date) {
      setLoading(true);
      try {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + plan.trial_days);

        const { error } = await supabase.from("user_subscriptions").insert({
          user_id: user.id,
          plan_id: "premium",
          billing_cycle: billingCycle,
          status: "active",
          is_trial: true,
          trial_start_date: new Date().toISOString(),
          trial_end_date: trialEnd.toISOString(),
          expires_at: trialEnd.toISOString(),
          amount: 0,
          currency: "INR",
        } as any);
        if (error) throw error;
        toast({ title: "Trial Started! 🎉", description: `Your ${plan.trial_days}-day free trial is active.` });
        onPlanChanged?.();
        onClose();
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
      return;
    }

    // Payment flow
    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment SDK");

      const { data, error } = await supabase.functions.invoke("razorpay-order", {
        body: { action: "create_order", plan_id: "premium", amount: price, billing_cycle: billingCycle },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      const { order, key_id } = data;

      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: "ACRY – AI Second Brain",
        description: `ACRY Premium ${billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("razorpay-order", {
            body: {
              action: "verify_payment",
              plan_id: "premium",
              amount: price,
              billing_cycle: billingCycle,
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            },
          });

          if (verifyError || verifyData?.error) {
            toast({ title: "Verification failed", description: verifyData?.error || verifyError?.message, variant: "destructive" });
            return;
          }

          toast({ title: "Welcome to ACRY Premium! 🎉", description: "All features are now unlocked." });
          import("@/lib/eventBus").then(({ emitEvent }) =>
            emitEvent("subscription_activated", { plan: "ACRY Premium", amount: price, billing_cycle: billingCycle }, { title: "Subscription Activated!", body: "Welcome to ACRY Premium!" })
          );
          onPlanChanged?.();
          onClose();
        },
        prefill: { email: user.email },
        theme: { color: "#14b8a6" },
        modal: { ondismiss: () => setLoading(false) },
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Payment Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!user || !subscription) return;
    setLoading(true);
    try {
      const { error } = await supabase
        .from("user_subscriptions")
        .update({ status: "cancelled" } as any)
        .eq("id", subscription.id);
      if (error) throw error;
      toast({ title: "Subscription Cancelled", description: "Your subscription has been cancelled." });
      onPlanChanged?.();
      onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const isTrialActive = subscription?.is_trial && subscription?.status === "active" && subscription?.trial_end_date && new Date(subscription.trial_end_date) > new Date();
  const trialDaysLeft = isTrialActive ? Math.ceil((new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000) : 0;
  const isPaid = subscription?.status === "active" && !subscription?.is_trial;
  const isExpired = subscription?.status === "expired" || subscription?.status === "cancelled" || 
    (subscription?.is_trial && subscription?.trial_end_date && new Date(subscription.trial_end_date) < new Date());

  const features = (plan?.features as string[]) || [
    "AI Second Brain", "Focus Study Mode", "AI Revision Mode", "Mock Practice Mode",
    "Emergency Rescue Mode", "Neural Memory Map", "Decay Forecast Engine",
    "AI Strategy Optimization", "Voice + Push Notifications", "Community Access", "Unlimited Usage"
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">ACRY Premium</h2>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Close</button>
        </div>

        {/* Trial Banner */}
        {isTrialActive && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30">
            <Clock className="w-4 h-4 text-success" />
            <span className="text-xs text-success font-medium">
              Trial Active — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
            </span>
          </div>
        )}

        {/* Active Subscription Status */}
        {isPaid && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">
              ACRY Premium Active
              {subscription.expires_at && ` · Renews ${format(new Date(subscription.expires_at), "MMM d, yyyy")}`}
            </span>
          </div>
        )}

        {/* Expired notice */}
        {isExpired && (
          <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30 text-center space-y-2">
            <p className="text-sm font-bold text-foreground">Your AI Brain Trial Has Ended.</p>
            <p className="text-xs text-muted-foreground">Subscribe to unlock all features again.</p>
          </div>
        )}

        {plansLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <>
            {/* Billing Toggle */}
            <div className="flex items-center justify-center gap-2 p-1 rounded-full bg-secondary/50">
              <button
                onClick={() => setBillingCycle("monthly")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
                  billingCycle === "monthly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >Monthly</button>
              <button
                onClick={() => setBillingCycle("yearly")}
                className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all flex items-center gap-1 ${
                  billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
                }`}
              >
                Yearly
                {savings > 0 && <span className="text-[9px] text-success">-{savings}%</span>}
              </button>
            </div>

            {/* Price display */}
            <div className="text-center py-2">
              <span className="text-4xl font-bold text-foreground">₹{price}</span>
              <span className="text-muted-foreground">/{billingCycle === "yearly" ? "year" : "mo"}</span>
              {billingCycle === "yearly" && (
                <p className="text-xs text-success mt-1">₹{Math.round(yearlyPrice / 12)}/mo · Save {savings}%</p>
              )}
            </div>

            {/* Features */}
            <div className="space-y-2 py-2">
              {features.map((f: string, i: number) => (
                <div key={i} className="flex items-center gap-2">
                  <Check className="w-3.5 h-3.5 text-success shrink-0" />
                  <span className="text-xs text-muted-foreground">{f}</span>
                </div>
              ))}
            </div>

            {/* Subscribe Button */}
            {!isPaid && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleSubscribe}
                disabled={loading}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2 glow-primary"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading
                  ? "Processing..."
                  : !subscription?.trial_start_date && plan?.trial_days > 0
                  ? "Start 15-Day Free Trial"
                  : `Subscribe · ₹${price}/${billingCycle === "yearly" ? "yr" : "mo"}`}
              </motion.button>
            )}

            <p className="text-center text-[10px] text-muted-foreground flex items-center justify-center gap-1">
              <Shield className="w-3 h-3" />
              Secure payment · Cancel anytime
            </p>
          </>
        )}

        {/* Cancel Button */}
        {(isPaid || isTrialActive) && (
          <button
            onClick={handleCancel}
            disabled={loading}
            className="w-full py-2 text-xs text-destructive hover:text-destructive/80 transition-colors"
          >
            Cancel Subscription
          </button>
        )}
      </motion.div>
    </div>
  );
};

export default SubscriptionPlan;
