import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap, Brain, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const ICON_MAP: Record<string, any> = { free: Brain, pro: Zap, ultra: Sparkles };

interface SubscriptionPlanProps {
  onClose: () => void;
  currentPlan?: string;
  onPlanChanged?: () => void;
}

const SubscriptionPlan = ({ onClose, currentPlan = "free", onPlanChanged }: SubscriptionPlanProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState(currentPlan);
  const [loading, setLoading] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("subscription_plans").select("*").eq("is_active", true).order("sort_order");
      setPlans(data || []);
      setPlansLoading(false);
    })();
  }, []);

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
    if (planKey === "free" || !user) return;
    const plan = plans.find((p) => p.plan_key === planKey);
    if (!plan) return;

    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment SDK");

      const { data, error } = await supabase.functions.invoke("razorpay-order", {
        body: { action: "create_order", plan_id: planKey, amount: plan.price },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      const { order, key_id } = data;

      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Second Brain AI",
        description: `${plan.name} Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("razorpay-order", {
            body: {
              action: "verify_payment",
              plan_id: planKey,
              amount: plan.price,
              order_id: response.razorpay_order_id,
              payment_id: response.razorpay_payment_id,
              signature: response.razorpay_signature,
            },
          });

          if (verifyError || verifyData?.error) {
            toast({ title: "Payment verification failed", description: verifyData?.error || verifyError?.message, variant: "destructive" });
            return;
          }

          toast({ title: "Upgrade Successful! 🎉", description: `You're now on ${plan.name}. Enjoy premium features!` });
          onPlanChanged?.();
          onClose();
        },
        prefill: { email: user.email },
        theme: { color: "#7c3aed" },
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

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Crown className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Subscription Plans</h2>
          </div>
          <button onClick={onClose} className="text-sm text-muted-foreground hover:text-foreground transition-colors">
            Close
          </button>
        </div>

        <p className="text-xs text-muted-foreground">Upgrade your brain to unlock premium AI features.</p>

        {plansLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {plans.map((plan) => {
              const IconComp = ICON_MAP[plan.plan_key] || Zap;
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
                      POPULAR
                    </span>
                  )}
                  <div className="flex items-center gap-3 mb-3">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                      plan.plan_key === currentPlan ? "bg-secondary" : "neural-gradient neural-border"
                    }`}>
                      <IconComp className={`w-5 h-5 ${plan.plan_key === currentPlan ? "text-muted-foreground" : "text-primary"}`} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                      <p className="text-xs">
                        <span className="text-foreground font-bold">₹{plan.price}</span>
                        <span className="text-muted-foreground">/{plan.billing_period}</span>
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

        {selectedPlan !== "free" && selectedPlan !== currentPlan && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleSubscribe(selectedPlan)}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Processing..." : `Upgrade to ${plans.find(p => p.plan_key === selectedPlan)?.name}`}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default SubscriptionPlan;
