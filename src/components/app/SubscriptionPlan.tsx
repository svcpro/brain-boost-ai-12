import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap, Brain, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

const plans = [
  {
    id: "free",
    name: "Free Brain",
    price: "₹0",
    priceNum: 0,
    period: "forever",
    icon: Brain,
    features: [
      "5 subjects & 20 topics",
      "Basic memory tracking",
      "Daily study reminders",
      "Community leaderboard",
    ],
    current: true,
  },
  {
    id: "pro",
    name: "Pro Brain",
    price: "₹199",
    priceNum: 199,
    period: "/month",
    icon: Zap,
    popular: true,
    features: [
      "Unlimited subjects & topics",
      "AI exam simulator",
      "Advanced analytics",
      "Voice notifications",
      "Priority support",
      "Weekly AI reports",
    ],
  },
  {
    id: "ultra",
    name: "Ultra Brain",
    price: "₹499",
    priceNum: 499,
    period: "/month",
    icon: Sparkles,
    features: [
      "Everything in Pro",
      "AI study coach (1-on-1)",
      "Custom study plans",
      "Peer competition insights",
      "Offline mode",
      "Data export & backup",
      "Early access to features",
    ],
  },
];

interface SubscriptionPlanProps {
  onClose: () => void;
}

const SubscriptionPlan = ({ onClose }: SubscriptionPlanProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [selectedPlan, setSelectedPlan] = useState("free");
  const [loading, setLoading] = useState(false);

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

  const handleSubscribe = async (planId: string) => {
    if (planId === "free" || !user) return;
    const plan = plans.find((p) => p.id === planId);
    if (!plan) return;

    setLoading(true);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment SDK");

      // Create order via edge function
      const { data, error } = await supabase.functions.invoke("razorpay-order", {
        body: { action: "create_order", plan_id: planId, amount: plan.priceNum },
      });

      if (error || data?.error) throw new Error(data?.error || error?.message);

      const { order, key_id } = data;

      // Open Razorpay checkout
      const options = {
        key: key_id,
        amount: order.amount,
        currency: order.currency,
        name: "Second Brain AI",
        description: `${plan.name} Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          // Verify payment
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("razorpay-order", {
            body: {
              action: "verify_payment",
              plan_id: planId,
              amount: plan.priceNum,
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

        <div className="space-y-3">
          {plans.map((plan) => (
            <motion.button
              key={plan.id}
              onClick={() => setSelectedPlan(plan.id)}
              className={`w-full text-left p-4 rounded-xl transition-all border relative ${
                selectedPlan === plan.id
                  ? "border-primary bg-primary/5"
                  : "border-border bg-secondary/20 hover:border-primary/50"
              }`}
              whileTap={{ scale: 0.98 }}
            >
              {plan.popular && (
                <span className="absolute -top-2 right-3 px-2 py-0.5 rounded-full bg-primary text-primary-foreground text-[9px] font-bold">
                  POPULAR
                </span>
              )}
              <div className="flex items-center gap-3 mb-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${
                  plan.current ? "bg-secondary" : "neural-gradient neural-border"
                }`}>
                  <plan.icon className={`w-5 h-5 ${plan.current ? "text-muted-foreground" : "text-primary"}`} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-foreground">{plan.name}</p>
                  <p className="text-xs">
                    <span className="text-foreground font-bold">{plan.price}</span>
                    <span className="text-muted-foreground">{plan.period}</span>
                  </p>
                </div>
                {plan.current && (
                  <span className="ml-auto px-2 py-0.5 rounded-full bg-success/20 text-success text-[10px] font-medium">
                    Current
                  </span>
                )}
              </div>
              <div className="space-y-1.5">
                {plan.features.map((f, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <Check className={`w-3 h-3 ${plan.current ? "text-muted-foreground" : "text-success"}`} />
                    <span className="text-[11px] text-muted-foreground">{f}</span>
                  </div>
                ))}
              </div>
            </motion.button>
          ))}
        </div>

        {selectedPlan !== "free" && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            onClick={() => handleSubscribe(selectedPlan)}
            disabled={loading}
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Processing..." : `Upgrade to ${plans.find(p => p.id === selectedPlan)?.name}`}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default SubscriptionPlan;
