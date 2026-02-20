import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Loader2, Clock, Shield, Sparkles, Zap, Brain, Star, X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SubscriptionPlanProps {
  onClose: () => void;
  currentPlan?: string;
  onPlanChanged?: () => void;
}

/* ── floating particle field ── */
const FloatingParticles = () => {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: 1 + Math.random() * 2.5,
    dur: 6 + Math.random() * 8,
    delay: Math.random() * 3,
    color: i % 4 === 0 ? "#00E5FF" : i % 4 === 1 ? "#7C4DFF" : i % 4 === 2 ? "#00FF94" : "#FFD700",
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-3xl">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{ width: p.size, height: p.size, left: `${p.x}%`, top: `${p.y}%`, background: p.color, boxShadow: `0 0 ${p.size * 4}px ${p.color}40` }}
          animate={{ y: [0, -15, 0], opacity: [0.1, 0.5, 0.1] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

/* ── animated crown icon ── */
const AnimatedCrown = () => (
  <motion.div
    className="relative w-20 h-20 mx-auto mb-2 flex items-center justify-center"
    initial={{ scale: 0, rotate: -30 }}
    animate={{ scale: 1, rotate: 0 }}
    transition={{ type: "spring", damping: 12, stiffness: 200, delay: 0.2 }}
  >
    {/* Outer ring pulse */}
    <motion.div
      className="absolute inset-0 rounded-full"
      style={{ border: "2px solid #FFD70030" }}
      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
      transition={{ duration: 2, repeat: Infinity }}
    />
    <motion.div
      className="absolute inset-1 rounded-full"
      style={{ background: "radial-gradient(circle, #FFD70015 0%, transparent 70%)" }}
      animate={{ scale: [1, 1.15, 1] }}
      transition={{ duration: 2.5, repeat: Infinity }}
    />
    <motion.div
      className="w-14 h-14 rounded-2xl flex items-center justify-center"
      style={{ background: "linear-gradient(135deg, #FFD70020, #FF850020)", border: "1px solid #FFD70025" }}
      animate={{ rotate: [0, 3, -3, 0] }}
      transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
    >
      <Crown className="w-7 h-7" style={{ color: "#FFD700", filter: "drop-shadow(0 0 8px #FFD70060)" }} />
    </motion.div>
  </motion.div>
);

/* ── feature row with stagger ── */
const FeatureRow = ({ text, icon: Icon, index }: { text: string; icon: any; index: number }) => (
  <motion.div
    className="flex items-center gap-2.5 py-1.5"
    initial={{ opacity: 0, x: -20 }}
    animate={{ opacity: 1, x: 0 }}
    transition={{ delay: 0.5 + index * 0.06, duration: 0.3 }}
  >
    <motion.div
      className="w-5 h-5 rounded-md flex items-center justify-center shrink-0"
      style={{ background: "linear-gradient(135deg, #00FF9415, #00E5FF15)", border: "1px solid #00FF9420" }}
      whileHover={{ scale: 1.2, rotate: 10 }}
    >
      <Icon className="w-2.5 h-2.5" style={{ color: "#00FF94" }} />
    </motion.div>
    <span className="text-[11px] text-foreground/80 font-medium">{text}</span>
  </motion.div>
);

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
    if (plan.trial_days > 0 && !subscription?.trial_start_date) {
      setLoading(true);
      try {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + plan.trial_days);
        const { error } = await supabase.from("user_subscriptions").insert({
          user_id: user.id, plan_id: "premium", billing_cycle: billingCycle, status: "active",
          is_trial: true, trial_start_date: new Date().toISOString(), trial_end_date: trialEnd.toISOString(),
          expires_at: trialEnd.toISOString(), amount: 0, currency: "INR",
        } as any);
        if (error) throw error;
        toast({ title: "Trial Started! 🎉", description: `Your ${plan.trial_days}-day free trial is active.` });
        onPlanChanged?.(); onClose();
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally { setLoading(false); }
      return;
    }
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
        key: key_id, amount: order.amount, currency: order.currency,
        name: "ACRY – AI Second Brain",
        description: `ACRY Premium ${billingCycle === "yearly" ? "Yearly" : "Monthly"} Subscription`,
        order_id: order.id,
        handler: async (response: any) => {
          const { data: verifyData, error: verifyError } = await supabase.functions.invoke("razorpay-order", {
            body: { action: "verify_payment", plan_id: "premium", amount: price, billing_cycle: billingCycle,
              order_id: response.razorpay_order_id, payment_id: response.razorpay_payment_id, signature: response.razorpay_signature },
          });
          if (verifyError || verifyData?.error) {
            toast({ title: "Verification failed", description: verifyData?.error || verifyError?.message, variant: "destructive" }); return;
          }
          toast({ title: "Welcome to ACRY Premium! 🎉", description: "All features are now unlocked." });
          import("@/lib/eventBus").then(({ emitEvent }) =>
            emitEvent("subscription_activated", { plan: "ACRY Premium", amount: price, billing_cycle: billingCycle }, { title: "Subscription Activated!", body: "Welcome to ACRY Premium!" })
          );
          onPlanChanged?.(); onClose();
        },
        prefill: { email: user.email }, theme: { color: "#14b8a6" },
        modal: { ondismiss: () => setLoading(false) },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Payment Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const handleCancel = async () => {
    if (!user || !subscription) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("user_subscriptions").update({ status: "cancelled" } as any).eq("id", subscription.id);
      if (error) throw error;
      toast({ title: "Subscription Cancelled", description: "Your subscription has been cancelled." });
      onPlanChanged?.(); onClose();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally { setLoading(false); }
  };

  const isTrialActive = subscription?.is_trial && subscription?.status === "active" && subscription?.trial_end_date && new Date(subscription.trial_end_date) > new Date();
  const trialDaysLeft = isTrialActive ? Math.ceil((new Date(subscription.trial_end_date).getTime() - Date.now()) / 86400000) : 0;
  const isPaid = subscription?.status === "active" && !subscription?.is_trial;
  const isExpired = subscription?.status === "expired" || subscription?.status === "cancelled" ||
    (subscription?.is_trial && subscription?.trial_end_date && new Date(subscription.trial_end_date) < new Date());

  const features = [
    { text: "AI Second Brain Engine", icon: Brain },
    { text: "Focus & Deep Study Mode", icon: Zap },
    { text: "AI Revision & Mock Practice", icon: Star },
    { text: "Emergency Rescue Mode", icon: Shield },
    { text: "Neural Memory Map", icon: Sparkles },
    { text: "Decay Forecast Engine", icon: Clock },
    { text: "AI Strategy Optimization", icon: Crown },
    { text: "Voice + Push Notifications", icon: Zap },
    { text: "Community Access", icon: Star },
    { text: "Unlimited AI Usage", icon: Sparkles },
  ];

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        {/* Backdrop with blur */}
        <motion.div
          className="absolute inset-0"
          style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(12px)" }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        {/* Card */}
        <motion.div
          className="relative w-full max-w-[380px] max-h-[90vh] overflow-y-auto rounded-3xl"
          style={{
            background: "linear-gradient(180deg, #0F1629 0%, #0B0F1A 100%)",
            border: "1px solid rgba(255,255,255,0.06)",
            boxShadow: "0 40px 100px -20px rgba(0,0,0,0.8), 0 0 80px rgba(0,229,255,0.06), 0 0 80px rgba(124,77,255,0.04)",
          }}
          initial={{ opacity: 0, scale: 0.85, y: 40 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: 20 }}
          transition={{ type: "spring", damping: 20, stiffness: 260 }}
          onClick={(e) => e.stopPropagation()}
        >
          <FloatingParticles />

          {/* Close button */}
          <motion.button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full flex items-center justify-center"
            style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)" }}
            whileHover={{ scale: 1.1, background: "rgba(255,255,255,0.1)" }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.button>

          {/* Top gradient accent line */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[2px] rounded-t-3xl"
            style={{ background: "linear-gradient(90deg, #00E5FF, #7C4DFF, #FFD700, #00FF94)" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.8, delay: 0.1 }}
          />

          <div className="relative z-10 p-6 pt-8">
            {/* Crown */}
            <AnimatedCrown />

            {/* Title */}
            <motion.div className="text-center mb-5" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
              <h2 className="text-xl font-bold mb-1">
                <span style={{ background: "linear-gradient(135deg, #FFD700, #FF8500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  ACRY Premium
                </span>
              </h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium">
                Unlock Your Full Potential
              </p>
            </motion.div>

            {/* Trial / Active / Expired banners */}
            {isTrialActive && (
              <motion.div
                className="flex items-center gap-2 p-3 rounded-xl mb-4"
                style={{ background: "#00FF9410", border: "1px solid #00FF9425" }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              >
                <Clock className="w-4 h-4 shrink-0" style={{ color: "#00FF94" }} />
                <span className="text-xs font-semibold" style={{ color: "#00FF94" }}>
                  Trial Active — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} remaining
                </span>
              </motion.div>
            )}

            {isPaid && (
              <motion.div
                className="flex items-center gap-2 p-3 rounded-xl mb-4"
                style={{ background: "#00E5FF10", border: "1px solid #00E5FF25" }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              >
                <Check className="w-4 h-4 shrink-0" style={{ color: "#00E5FF" }} />
                <span className="text-xs font-semibold" style={{ color: "#00E5FF" }}>
                  Premium Active{subscription.expires_at && ` · Renews ${format(new Date(subscription.expires_at), "MMM d, yyyy")}`}
                </span>
              </motion.div>
            )}

            {isExpired && (
              <motion.div
                className="p-4 rounded-xl mb-4 text-center"
                style={{ background: "#FF445510", border: "1px solid #FF445525" }}
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
              >
                <p className="text-sm font-bold text-foreground">Your Trial Has Ended</p>
                <p className="text-[10px] text-muted-foreground mt-1">Subscribe to unlock all features again.</p>
              </motion.div>
            )}

            {plansLoading ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Billing Toggle */}
                <motion.div
                  className="flex items-center justify-center gap-1 p-1 rounded-full mx-auto w-fit mb-5"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.38 }}
                >
                  {(["monthly", "yearly"] as const).map((cycle) => (
                    <motion.button
                      key={cycle}
                      onClick={() => setBillingCycle(cycle)}
                      className="relative px-5 py-2 rounded-full text-xs font-semibold transition-colors"
                      style={{
                        color: billingCycle === cycle ? "#0B0F1A" : "rgba(255,255,255,0.4)",
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      {billingCycle === cycle && (
                        <motion.div
                          className="absolute inset-0 rounded-full"
                          style={{ background: "linear-gradient(135deg, #00E5FF, #7C4DFF)" }}
                          layoutId="billing-pill"
                          transition={{ type: "spring", damping: 20, stiffness: 300 }}
                        />
                      )}
                      <span className="relative z-10 flex items-center gap-1">
                        {cycle === "monthly" ? "Monthly" : "Yearly"}
                        {cycle === "yearly" && savings > 0 && (
                          <span className="text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: "#00FF9420", color: "#00FF94" }}>
                            -{savings}%
                          </span>
                        )}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>

                {/* Price */}
                <motion.div
                  className="text-center mb-5"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.4, type: "spring", damping: 15 }}
                  key={billingCycle}
                >
                  <div className="flex items-baseline justify-center gap-1">
                    <span className="text-lg text-muted-foreground/60 font-medium">₹</span>
                    <motion.span
                      className="text-5xl font-black tabular-nums"
                      style={{ background: "linear-gradient(180deg, #ffffff, #ffffff80)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}
                      key={price}
                      initial={{ y: 20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{ type: "spring", damping: 15 }}
                    >
                      {price}
                    </motion.span>
                    <span className="text-sm text-muted-foreground/50 font-medium">
                      /{billingCycle === "yearly" ? "yr" : "mo"}
                    </span>
                  </div>
                  {billingCycle === "yearly" && (
                    <motion.p className="text-[10px] mt-1 font-medium" style={{ color: "#00FF94" }}
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.1 }}>
                      ₹{Math.round(yearlyPrice / 12)}/mo · Save {savings}%
                    </motion.p>
                  )}
                </motion.div>

                {/* Divider */}
                <motion.div
                  className="h-px mb-4"
                  style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
                  initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ delay: 0.45, duration: 0.5 }}
                />

                {/* Features */}
                <div className="space-y-0.5 mb-5">
                  <motion.p className="text-[9px] uppercase tracking-[0.2em] text-muted-foreground/50 font-semibold mb-2"
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.48 }}>
                    Everything Included
                  </motion.p>
                  {features.map((f, i) => (
                    <FeatureRow key={i} text={f.text} icon={f.icon} index={i} />
                  ))}
                </div>

                {/* CTA Button */}
                {!isPaid && (
                  <motion.div
                    className="relative"
                    initial={{ opacity: 0, y: 15 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 1.1 }}
                  >
                    {/* Ripple effect */}
                    <motion.div
                      className="absolute inset-[-4px] rounded-2xl pointer-events-none"
                      animate={{ boxShadow: ["0 0 0 0px #00E5FF20", "0 0 0 8px #00E5FF00"] }}
                      transition={{ duration: 1.5, delay: 1.5, repeat: 3 }}
                    />
                    <motion.button
                      onClick={handleSubscribe}
                      disabled={loading}
                      className="relative w-full py-4 rounded-2xl text-sm font-bold tracking-wide disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden"
                      style={{
                        background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                        color: "#0B0F1A",
                        boxShadow: "0 0 30px #00E5FF20, 0 0 60px #7C4DFF10",
                      }}
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.97 }}
                      animate={{
                        boxShadow: [
                          "0 0 20px #00E5FF15, 0 0 40px #7C4DFF08",
                          "0 0 35px #00E5FF25, 0 0 70px #7C4DFF15",
                          "0 0 20px #00E5FF15, 0 0 40px #7C4DFF08",
                        ],
                      }}
                      transition={{ duration: 3, repeat: Infinity }}
                    >
                      {/* Shine sweep */}
                      <motion.div
                        className="absolute inset-0 pointer-events-none"
                        style={{ background: "linear-gradient(105deg, transparent 40%, rgba(255,255,255,0.25) 50%, transparent 60%)" }}
                        animate={{ x: ["-100%", "200%"] }}
                        transition={{ duration: 2.5, delay: 2, repeat: Infinity, repeatDelay: 3 }}
                      />
                      {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span className="relative z-10">
                        {loading
                          ? "Processing..."
                          : !subscription?.trial_start_date && plan?.trial_days > 0
                            ? "Start 15-Day Free Trial"
                            : `Upgrade Now · ₹${price}/${billingCycle === "yearly" ? "yr" : "mo"}`}
                      </span>
                      {!loading && <Sparkles className="w-4 h-4 relative z-10" />}
                    </motion.button>
                  </motion.div>
                )}

                {/* Security badge */}
                <motion.p
                  className="text-center text-[9px] text-muted-foreground/40 flex items-center justify-center gap-1.5 mt-3"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.3 }}
                >
                  <Shield className="w-3 h-3" />
                  Secure payment · Cancel anytime · Instant access
                </motion.p>
              </>
            )}

            {/* Cancel link */}
            {(isPaid || isTrialActive) && (
              <motion.button
                onClick={handleCancel}
                disabled={loading}
                className="w-full py-2.5 mt-2 text-[10px] text-muted-foreground/40 hover:text-destructive/70 transition-colors font-medium"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1.4 }}
              >
                Cancel Subscription
              </motion.button>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default SubscriptionPlan;
