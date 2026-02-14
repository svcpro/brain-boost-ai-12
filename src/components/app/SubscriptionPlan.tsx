import { useState } from "react";
import { motion } from "framer-motion";
import { Crown, Check, Sparkles, Zap, Brain } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const plans = [
  {
    id: "free",
    name: "Free Brain",
    price: "₹0",
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
  const [selectedPlan, setSelectedPlan] = useState("free");

  const handleSubscribe = async (planId: string) => {
    if (planId === "free") return;
    toast({
      title: "Razorpay Integration Coming Soon 🚀",
      description: "Payment gateway is being set up. You'll be able to upgrade shortly!",
    });
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
            className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors active:scale-95"
          >
            Upgrade to {plans.find(p => p.id === selectedPlan)?.name}
          </motion.button>
        )}
      </motion.div>
    </div>
  );
};

export default SubscriptionPlan;
