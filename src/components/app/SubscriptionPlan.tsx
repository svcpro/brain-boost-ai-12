import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap, Brain, Loader2, Calendar, Clock, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

const ICON_MAP: Record<string, any> = { pro: Zap, ultra: Sparkles };

interface SubscriptionPlanProps {
  onClose: () => void;
  currentPlan?: string;
  onPlanChanged?: () => void;
}

const SubscriptionPlan = ({ onClose, currentPlan = "free", onPlanChanged }: SubscriptionPlanProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(currentPlan === "free" ? "pro" : currentPlan);
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setPlans(data || []);
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

  const getPrice = (plan: any) => billingCycle === "yearly" ? (plan?.yearly_price || 0) : (plan?.price || 0);

  const getSavings = (plan: any) => {
    if (!plan) return 0;
    const monthlyTotal = plan.price * 12;
    return monthlyTotal > 0 ? Math.round(((monthlyTotal - plan.yearly_price) / monthlyTotal) * 100) : 0;
  };

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

  const handleSubscribe = async (planKey: string) => {
    if (!user) return;
    const plan = plans.find((p) => p.plan_key === planKey);
    if (!plan) return;

    const price = getPrice(plan);

    // If Pro plan has trial and user hasn't had one, start trial
    if (planKey === "pro" && plan.trial_days > 0 && !subscription?.trial_start_date) {
      setLoading(true);
      try {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + plan.trial_days);

        const { error } = await supabase.from("user_subscriptions").insert({
          user_id: user.id,
          plan_id: planKey,
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
        toast({ title: "Trial Started! 🎉", description: `Your ${plan.trial_days}-day Pro trial is active.` });
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
        body: { action: "create_order", plan_id: planKey, amount: price, billing_cycle: billingCycle },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      const { order, key_id } = data;

      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: "ACRY – AI Second Brain",
        description: `${plan.name} ${billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("razorpay-order", {
            body: {
              action: "verify_payment",
              plan_id: planKey,
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

          toast({ title: "Upgrade Successful! 🎉", description: `You're now on ${plan.name}. Enjoy premium features!` });
          // Emit subscription activated event
          import("@/lib/eventBus").then(({ emitEvent }) =>
            emitEvent("subscription_activated", { plan: plan.name, amount: price, billing_cycle: billingCycle }, { title: "Subscription Activated!", body: `Welcome to ${plan.name}!` })
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

  const isTrialActive = subscription?.is_trial && subscription?.status === "active" && new Date(subscription?.trial_end_date) > new Date();
  const trialDaysLeft = isTrialActive ? Math.ceil((new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Subscription Plans</h2>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Close</button>
        </div>

        {/* Trial Banner */}
        {isTrialActive && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-success/10 border border-success/30">
            <Clock className="w-4 h-4 text-success" />
            <span className="text-xs text-success font-medium">
              Pro Trial Active — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
            </span>
          </div>
        )}

        {/* Subscription Status */}
        {subscription && subscription.status === "active" && !subscription.is_trial && (
          <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/10 border border-primary/30">
            <Check className="w-4 h-4 text-primary" />
            <span className="text-xs text-primary font-medium">
              {currentPlan === "ultra" ? "Ultra" : "Pro"} Brain Active
              {subscription.expires_at && ` · Expires ${format(new Date(subscription.expires_at), "MMM d, yyyy")}`}
            </span>
          </div>
        )}

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
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-all ${
              billingCycle === "yearly" ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            }`}
          >
            Yearly
          </button>
        </div>

        {plansLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const IconComp = ICON_MAP[plan.plan_key] || Zap;
              const price = getPrice(plan);
              const savings = getSavings(plan);
              return (
                <motion.button
                  key={plan.id}
                  onClick={() => setSelectedPlan(plan.plan_key)}
                  className={`w-full text-left p-4 rounded-xl transition-all border relative ${
                    selectedPlan === plan.plan_key
                      ? "border-primary bg-primary/5"
                      : "border-border bg-secondary/20 hover:border-primary/50"
                  }`}
                  whileTap={{ scale: 0.98 }}
                >
                  {plan.is_popular && (
                    <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                      RECOMMENDED
                    </span>
                  )}
                  {plan.trial_days > 0 && (
                    <span className="absolute -top-2 left-3 px-2 py-0.5 rounded-full bg-success/20 text-success text-[9px] font-bold">
                      {plan.trial_days}-DAY TRIAL
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-3 mt-1">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      plan.plan_key === currentPlan ? "bg-secondary" : "neural-gradient neural-border"
                    }`}>
                      <IconComp className={`w-5 h-5 ${plan.plan_key === currentPlan ? "text-muted-foreground" : "text-primary"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                      <p className="text-xs">
                        <span className="text-foreground font-bold">₹{price}</span>
                        <span className="text-muted-foreground">/{billingCycle === "yearly" ? "year" : "mo"}</span>
                        {billingCycle === "yearly" && savings > 0 && (
                          <span className="ml-1.5 text-success text-[10px]">Save {savings}%</span>
                        )}
                      </p>
                    </div>
                    {plan.plan_key === currentPlan && (
                      <span className="ml-auto px-2 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-medium">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="space-y-1.5">
                    {(plan.features as string[])?.map((f: string, i: number) => (
                      <div key={i} className="flex items-center gap-2">
                        <Check className={`w-3 h-3 ${plan.plan_key === currentPlan ? "text-muted-foreground" : "text-success"}`} />
                        <span className="text-[11px] text-muted-foreground">{f}</span>
                      </div>
                    ))}
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}

        {/* Subscribe Button */}
        {selectedPlan !== currentPlan && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleSubscribe(selectedPlan)}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading
              ? "Processing..."
              : selectedPlan === "pro" && plans.find(p => p.plan_key === "pro")?.trial_days > 0 && !subscription?.trial_start_date
              ? "Start 15-Day Free Trial"
              : `Upgrade to ${plans.find(p => p.plan_key === selectedPlan)?.name}`}
          </motion.button>
        )}

        {/* Cancel Button */}
        {subscription && subscription.status === "active" && (
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
