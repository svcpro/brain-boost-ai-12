import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crown, Check, Loader2, Clock, Shield, Sparkles, X, Zap } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";

interface SubscriptionPlanProps {
  onClose: () => void;
  currentPlan?: string;
  onPlanChanged?: () => void;
  forcePaymentOnly?: boolean;
}

interface PlanRow {
  id: string;
  plan_key: string;
  name: string;
  description: string | null;
  price: number;
  yearly_price: number;
  trial_days: number;
  tier_level: number;
  features: any;
}

const SubscriptionPlan = ({ onClose, currentPlan = "none", onPlanChanged, forcePaymentOnly = false }: SubscriptionPlanProps) => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [loading, setLoading] = useState(false);
  const [loadingKey, setLoadingKey] = useState<string | null>(null);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [hasUsedTrial, setHasUsedTrial] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string>("starter");

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("id, plan_key, name, description, price, yearly_price, trial_days, tier_level, features")
        .eq("is_active", true)
        .in("plan_key", ["starter", "premium"])
        .order("tier_level");
      setPlans((data as PlanRow[]) || []);
      setPlansLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: latestSubscription }, { data: trialHistory }] = await Promise.all([
        supabase
          .from("user_subscriptions")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("user_subscriptions")
          .select("id")
          .eq("user_id", user.id)
          .or("trial_start_date.not.is.null,is_trial.eq.true")
          .limit(1),
      ]);
      setSubscription(latestSubscription);
      setHasUsedTrial((trialHistory?.length || 0) > 0);
    })();
  }, [user]);

  const selectedPlan = useMemo(
    () => plans.find(p => p.plan_key === selectedKey) || plans[0],
    [plans, selectedKey]
  );

  const priceFor = (p: PlanRow) => billingCycle === "yearly" ? p.yearly_price : p.price;
  const savingsFor = (p: PlanRow) => p.price > 0
    ? Math.round(((p.price * 12 - p.yearly_price) / (p.price * 12)) * 100)
    : 0;

  const canStartTrial = (p: PlanRow | undefined) =>
    !!p && !forcePaymentOnly && !hasUsedTrial && p.trial_days > 0;

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

  const handleSubscribe = async (plan: PlanRow) => {
    if (!user || !plan) return;
    setSelectedKey(plan.plan_key);
    const price = priceFor(plan);

    // Trial path (only Starter has trial_days > 0)
    if (canStartTrial(plan)) {
      setLoading(true);
      setLoadingKey(plan.plan_key);
      try {
        const trialEnd = new Date();
        trialEnd.setDate(trialEnd.getDate() + plan.trial_days);
        // Cancel any prior active subs
        await supabase.from("user_subscriptions")
          .update({ status: "superseded" } as any)
          .eq("user_id", user.id)
          .eq("status", "active");
        const { error } = await supabase.from("user_subscriptions").insert({
          user_id: user.id, plan_id: plan.id, billing_cycle: billingCycle, status: "active",
          is_trial: true, trial_start_date: new Date().toISOString(), trial_end_date: trialEnd.toISOString(),
          expires_at: trialEnd.toISOString(), amount: 0, currency: "INR",
        } as any);
        if (error) throw error;
        toast({ title: "Trial Started! 🎉", description: `Your ${plan.trial_days}-day free trial is active.` });
        onPlanChanged?.();
        onClose();
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
        setLoadingKey(null);
      }
      return;
    }

    setLoading(true);
    setLoadingKey(plan.plan_key);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error("Failed to load payment SDK");
      const { data, error } = await supabase.functions.invoke("razorpay-order", {
        body: { action: "create_order", plan_id: plan.id, amount: price, billing_cycle: billingCycle },
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
              plan_id: plan.id,
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
          toast({ title: `Welcome to ${plan.name}! 🎉`, description: "All features are now unlocked." });
          import("@/lib/eventBus").then(({ emitEvent }) =>
            emitEvent("subscription_activated", { plan: plan.name, amount: price, billing_cycle: billingCycle }, { title: "Subscription Activated!", body: `Welcome to ${plan.name}!` })
          );
          onPlanChanged?.();
          onClose();
        },
        prefill: { email: user.email },
        theme: { color: "#14b8a6" },
        modal: { ondismiss: () => { setLoading(false); setLoadingKey(null); } },
      };
      const rzp = new (window as any).Razorpay(options);
      rzp.open();
    } catch (err: any) {
      toast({ title: "Payment Error", description: err.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
      setLoadingKey(null);
    }
  };

  const handleCancel = async () => {
    if (!user || !subscription) return;
    setLoading(true);
    try {
      const { error } = await supabase.from("user_subscriptions").update({ status: "cancelled" } as any).eq("id", subscription.id);
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

  const featureList = (p: PlanRow): string[] => {
    if (Array.isArray(p.features)) return p.features as string[];
    return [];
  };

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
        />

        <motion.div
          className="relative w-full sm:max-w-[420px] max-h-[92vh] overflow-y-auto rounded-t-[28px] sm:rounded-[28px]"
          style={{
            background: "linear-gradient(180deg, hsl(230 40% 10%) 0%, hsl(230 50% 6%) 100%)",
            border: "1px solid hsl(0 0% 100% / 0.06)",
            boxShadow: "0 -20px 60px -10px rgba(0,0,0,0.6), 0 0 60px rgba(0,229,255,0.05)",
          }}
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 100 }}
          transition={{ type: "spring", damping: 25, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
        >
          <motion.div
            className="sticky top-0 left-0 right-0 h-[2px] z-30"
            style={{ background: "linear-gradient(90deg, #00E5FF, #7C4DFF, #FFD700)" }}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.6, delay: 0.1 }}
          />

          <div className="flex justify-center pt-3 sm:hidden">
            <div className="w-10 h-1 rounded-full bg-white/10" />
          </div>

          <motion.button
            onClick={onClose}
            className="absolute top-4 right-4 z-50 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10"
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.button>

          <div className="relative z-10 px-5 pt-4 pb-6 sm:pt-6">
            <motion.div
              className="flex flex-col items-center mb-4"
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 }}
            >
              <motion.div
                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-2"
                style={{ background: "linear-gradient(135deg, #FFD70018, #FF850018)", border: "1px solid #FFD70020" }}
                animate={{ rotate: [0, 3, -3, 0] }}
                transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
              >
                <Crown className="w-6 h-6" style={{ color: "#FFD700", filter: "drop-shadow(0 0 6px #FFD70060)" }} />
              </motion.div>
              <h2 className="text-lg font-bold">
                <span style={{ background: "linear-gradient(135deg, #FFD700, #FF8500)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
                  Choose Your Plan
                </span>
              </h2>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground font-medium mt-0.5">
                Unlock Your Full Potential
              </p>
            </motion.div>

            {isTrialActive && (
              <motion.div className="flex items-center gap-2 p-2.5 rounded-xl mb-3" style={{ background: "#00FF9410", border: "1px solid #00FF9420" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                <Clock className="w-3.5 h-3.5 shrink-0" style={{ color: "#00FF94" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#00FF94" }}>
                  Trial Active — {trialDaysLeft} day{trialDaysLeft !== 1 ? "s" : ""} left
                </span>
              </motion.div>
            )}
            {isPaid && (
              <motion.div className="flex items-center gap-2 p-2.5 rounded-xl mb-3" style={{ background: "#00E5FF10", border: "1px solid #00E5FF20" }}
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}>
                <Check className="w-3.5 h-3.5 shrink-0" style={{ color: "#00E5FF" }} />
                <span className="text-[11px] font-semibold" style={{ color: "#00E5FF" }}>
                  Active{subscription.expires_at && ` · Renews ${format(new Date(subscription.expires_at), "MMM d, yyyy")}`}
                </span>
              </motion.div>
            )}

            {plansLoading ? (
              <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
            ) : (
              <>
                {/* Billing toggle */}
                <motion.div
                  className="flex items-center justify-center gap-1 p-1 rounded-full mx-auto w-fit mb-4"
                  style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.06)" }}
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                >
                  {(["monthly", "yearly"] as const).map((cycle) => (
                    <motion.button
                      key={cycle}
                      onClick={() => setBillingCycle(cycle)}
                      className="relative px-5 py-2 rounded-full text-xs font-semibold transition-colors"
                      style={{ color: billingCycle === cycle ? "#0B0F1A" : "rgba(255,255,255,0.4)" }}
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
                        {cycle === "yearly" && (
                          <span
                            className="relative overflow-hidden text-[8px] px-1.5 py-0.5 rounded-full font-bold"
                            style={{ background: "#00FF9420", color: "#00FF94" }}
                          >
                            <span className="relative z-10">2 MO FREE</span>
                            <motion.span
                              className="absolute inset-0 pointer-events-none"
                              style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.65) 50%, transparent 70%)" }}
                              animate={{ x: ["-120%", "120%"] }}
                              transition={{ duration: 1.6, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.span
                              className="absolute inset-0 pointer-events-none rounded-full"
                              style={{ boxShadow: "0 0 10px rgba(0,255,148,0.5)" }}
                              animate={{ opacity: [0.3, 0.8, 0.3] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </span>
                        )}
                      </span>
                    </motion.button>
                  ))}
                </motion.div>

                {/* Yearly savings banner */}
                <AnimatePresence>
                  {billingCycle === "yearly" && plans.length > 0 && (
                    <motion.div
                      key="yearly-savings-banner"
                      initial={{ opacity: 0, y: -8, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: "auto" }}
                      exit={{ opacity: 0, y: -8, height: 0 }}
                      transition={{ type: "spring", damping: 20, stiffness: 280 }}
                      className="overflow-hidden mb-4"
                    >
                      <div
                        className="relative rounded-2xl p-3.5 overflow-hidden"
                        style={{
                          background: "linear-gradient(135deg, rgba(0,255,148,0.16), rgba(0,229,255,0.10))",
                          border: "1px solid rgba(0,255,148,0.40)",
                          boxShadow: "0 0 24px rgba(0,255,148,0.12), inset 0 1px 0 rgba(255,255,255,0.06)",
                        }}
                      >
                        <motion.div
                          className="absolute inset-0 pointer-events-none"
                          style={{ background: "linear-gradient(110deg, transparent 30%, rgba(0,255,148,0.20) 50%, transparent 70%)" }}
                          initial={{ x: "-100%" }}
                          animate={{ x: "100%" }}
                          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
                        />
                        <div className="relative z-10 flex items-center gap-3">
                          <div
                            className="w-9 h-9 rounded-xl flex items-center justify-center shrink-0"
                            style={{
                              background: "linear-gradient(135deg, rgba(0,255,148,0.28), rgba(0,229,255,0.18))",
                              border: "1px solid rgba(0,255,148,0.45)",
                              boxShadow: "0 0 12px rgba(0,255,148,0.35)",
                            }}
                          >
                            <Sparkles className="w-4 h-4" style={{ color: "#00FF94" }} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-baseline gap-1.5 flex-wrap">
                              <span className="text-[10px] font-bold uppercase tracking-[0.08em]" style={{ color: "#00FF94", textShadow: "0 0 8px rgba(0,255,148,0.4)" }}>
                                You save
                              </span>
                              <span
                                className="text-[15px] font-black tabular-nums leading-none"
                                style={{ color: "#FFFFFF", textShadow: "0 0 10px rgba(0,255,148,0.5)" }}
                              >
                                ₹{plans.reduce((sum, p) => sum + Math.max(0, p.price * 12 - p.yearly_price), 0).toLocaleString("en-IN")}
                              </span>
                              <span className="text-[10px] font-semibold text-white/70">this year</span>
                            </div>
                            <div className="text-[10px] mt-1 tabular-nums leading-snug text-white/75">
                              {plans.map((p, i) => (
                                <span key={p.id}>
                                  {i > 0 && <span className="text-white/30 mx-1.5">·</span>}
                                  <span className="font-semibold text-white/85">{p.name}</span>
                                  <span className="text-white/55">: </span>
                                  <span className="font-bold" style={{ color: "#00FF94" }}>−₹{(p.price * 12 - p.yearly_price).toLocaleString("en-IN")}</span>
                                </span>
                              ))}
                            </div>
                          </div>
                          <div
                            className="relative overflow-hidden text-[9px] font-black px-2.5 py-1.5 rounded-full shrink-0 tracking-wider"
                            style={{
                              background: "linear-gradient(135deg, #00FF94, #00E5B0)",
                              color: "#001A0E",
                              boxShadow: "0 2px 12px rgba(0,255,148,0.45), inset 0 1px 0 rgba(255,255,255,0.4)",
                            }}
                          >
                            <span className="relative z-10">2 MO FREE</span>
                            <motion.span
                              className="absolute inset-0 pointer-events-none"
                              style={{ background: "linear-gradient(110deg, transparent 30%, rgba(255,255,255,0.85) 50%, transparent 70%)" }}
                              animate={{ x: ["-120%", "120%"] }}
                              transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
                            />
                            <motion.span
                              className="absolute inset-0 pointer-events-none rounded-full"
                              style={{ boxShadow: "0 0 12px rgba(0,255,148,0.7)" }}
                              animate={{ opacity: [0.4, 1, 0.4] }}
                              transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* Plan cards */}
                <div className="space-y-3">
                  {plans.map((p, idx) => {
                    const price = priceFor(p);
                    const savings = savingsFor(p);
                    const isPremiumTier = p.tier_level >= 2;
                    const trialAvail = canStartTrial(p);
                    const isThisLoading = loadingKey === p.plan_key && loading;
                    const features = featureList(p);
                    return (
                      <motion.div
                        key={p.id}
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.35 + idx * 0.08 }}
                        className="relative rounded-2xl p-4 overflow-hidden"
                        style={{
                          background: isPremiumTier
                            ? "linear-gradient(135deg, rgba(255,215,0,0.08), rgba(124,77,255,0.06))"
                            : "rgba(255,255,255,0.03)",
                          border: isPremiumTier
                            ? "1px solid rgba(255,215,0,0.25)"
                            : "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        {isPremiumTier && (
                          <div className="absolute top-3 right-3 text-[8px] font-bold px-2 py-0.5 rounded-full"
                            style={{ background: "linear-gradient(135deg,#FFD700,#FF8500)", color: "#0B0F1A" }}>
                            BEST VALUE
                          </div>
                        )}

                        <div className="flex items-center gap-2 mb-1">
                          {isPremiumTier
                            ? <Crown className="w-4 h-4" style={{ color: "#FFD700" }} />
                            : <Zap className="w-4 h-4" style={{ color: "#00E5FF" }} />}
                          <h3 className="text-sm font-bold text-foreground">{p.name}</h3>
                        </div>
                        {p.description && (
                          <p className="text-[10px] text-muted-foreground mb-3 leading-snug">{p.description}</p>
                        )}

                        <div className="flex items-baseline gap-1 mb-1">
                          <span className="text-xs text-muted-foreground/60">₹</span>
                          <motion.span
                            key={`${p.plan_key}-${billingCycle}`}
                            initial={{ y: 8, opacity: 0 }}
                            animate={{ y: 0, opacity: 1 }}
                            className="text-3xl font-black tabular-nums text-foreground"
                          >
                            {price}
                          </motion.span>
                          <span className="text-[11px] text-muted-foreground/60">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                          {billingCycle === "yearly" && savings > 0 && (
                            <span
                              className="ml-2 relative overflow-hidden text-[9px] font-bold px-1.5 py-0.5 rounded-full"
                              style={{ background: "#00FF9420", color: "#00FF94" }}
                            >
                              <span className="relative z-10">SAVE {savings}%</span>
                              <motion.span
                                className="absolute inset-0 pointer-events-none"
                                style={{ background: "linear-gradient(110deg, transparent 30%, rgba(0,255,148,0.45) 50%, transparent 70%)" }}
                                animate={{ x: ["-120%", "120%"] }}
                                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
                              />
                            </span>
                          )}
                        </div>

                        {/* Monthly vs Yearly comparison row — always visible */}
                        {p.yearly_price > 0 && p.price > 0 && (() => {
                          const monthlyEq = Math.round(p.yearly_price / 12);
                          const absSave = p.price * 12 - p.yearly_price;
                          const isYearly = billingCycle === "yearly";
                          const accent = isPremiumTier ? "#FFD700" : "#00E5FF";
                          return (
                            <div className="grid grid-cols-2 gap-2 mb-3">
                              {/* Monthly cell */}
                              <button
                                type="button"
                                onClick={() => setBillingCycle("monthly")}
                                className="text-left rounded-lg p-2 transition-all"
                                style={{
                                  background: !isYearly ? `${accent}14` : "rgba(255,255,255,0.025)",
                                  border: !isYearly ? `1px solid ${accent}55` : "1px solid rgba(255,255,255,0.05)",
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: !isYearly ? accent : "rgba(255,255,255,0.45)" }}>Monthly</span>
                                  {!isYearly && <Check className="w-2.5 h-2.5" style={{ color: accent }} />}
                                </div>
                                <div className="mt-0.5 text-[12px] font-bold tabular-nums text-foreground">
                                  ₹{p.price.toLocaleString("en-IN")}<span className="text-[9px] font-normal text-muted-foreground/70">/mo</span>
                                </div>
                                <div className="text-[8.5px] text-muted-foreground/60 tabular-nums">
                                  ₹{(p.price * 12).toLocaleString("en-IN")}/yr total
                                </div>
                              </button>

                              {/* Yearly cell */}
                              <button
                                type="button"
                                onClick={() => setBillingCycle("yearly")}
                                className="relative text-left rounded-lg p-2 transition-all overflow-hidden"
                                style={{
                                  background: isYearly ? "rgba(0,255,148,0.10)" : "rgba(0,255,148,0.04)",
                                  border: isYearly ? "1px solid rgba(0,255,148,0.5)" : "1px solid rgba(0,255,148,0.18)",
                                }}
                              >
                                <div className="flex items-center justify-between">
                                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color: "#00FF94" }}>Yearly</span>
                                  {isYearly ? (
                                    <Check className="w-2.5 h-2.5" style={{ color: "#00FF94" }} />
                                  ) : (
                                    <span className="text-[8px] font-black px-1 py-0 rounded" style={{ background: "#00FF9433", color: "#00FF94" }}>−₹{absSave.toLocaleString("en-IN")}</span>
                                  )}
                                </div>
                                <div className="mt-0.5 text-[12px] font-bold tabular-nums text-foreground">
                                  ₹{monthlyEq.toLocaleString("en-IN")}<span className="text-[9px] font-normal text-muted-foreground/70">/mo</span>
                                </div>
                                <div className="text-[8.5px] tabular-nums flex items-center gap-1">
                                  <span className="text-muted-foreground/40 line-through">₹{(p.price * 12).toLocaleString("en-IN")}</span>
                                  <span className="font-bold" style={{ color: "#00FF94" }}>₹{p.yearly_price.toLocaleString("en-IN")}/yr</span>
                                </div>
                              </button>
                            </div>
                          );
                        })()}

                        {features.length > 0 && (
                          <ul className="space-y-1 mb-3">
                            {features.slice(0, 5).map((f) => (
                              <li key={f} className="flex items-start gap-1.5 text-[11px] text-foreground/85">
                                <Check className="w-3 h-3 shrink-0 mt-0.5" style={{ color: isPremiumTier ? "#FFD700" : "#00E5FF" }} />
                                <span>{f}</span>
                              </li>
                            ))}
                          </ul>
                        )}

                        {/* Explicit access note — clarifies what each plan unlocks */}
                        <div
                          className="mb-3 rounded-lg p-2.5 flex items-start gap-2"
                          style={{
                            background: isPremiumTier ? "rgba(255,215,0,0.06)" : "rgba(0,229,255,0.05)",
                            border: isPremiumTier ? "1px solid rgba(255,215,0,0.18)" : "1px solid rgba(0,229,255,0.15)",
                          }}
                        >
                          {isPremiumTier ? (
                            <Crown className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#FFD700" }} />
                          ) : (
                            <Shield className="w-3 h-3 shrink-0 mt-0.5" style={{ color: "#00E5FF" }} />
                          )}
                          <div className="flex-1 min-w-0">
                            {isPremiumTier ? (
                              <>
                                <p className="text-[10px] font-bold leading-tight" style={{ color: "#FFD700" }}>
                                  Full access · everything unlocked
                                </p>
                                <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">
                                  Includes <span className="text-foreground/85 font-semibold">Exam Practice + SureShot</span>, AI Mentor, all study modes &amp; priority support.
                                </p>
                              </>
                            ) : (
                              <>
                                <p className="text-[10px] font-bold leading-tight" style={{ color: "#00E5FF" }}>
                                  Core access · most features included
                                </p>
                                <p className="text-[9px] text-muted-foreground mt-0.5 leading-snug">
                                  All study tools &amp; AI modes — <span className="font-semibold" style={{ color: "#FFD700" }}>Exam Practice &amp; SureShot are Premium-only</span>.
                                </p>
                              </>
                            )}
                          </div>
                        </div>

                        <motion.button
                          onClick={() => handleSubscribe(p)}
                          disabled={loading || isPaid}
                          className="relative w-full py-3 rounded-xl text-xs font-bold disabled:opacity-50 flex items-center justify-center gap-2 overflow-hidden"
                          style={{
                            background: isPremiumTier
                              ? "linear-gradient(135deg, #FFD700, #FF8500)"
                              : "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                            color: "#0B0F1A",
                          }}
                          whileTap={{ scale: 0.97 }}
                        >
                          {isThisLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                          <span>
                            {isThisLoading
                              ? "Processing..."
                              : trialAvail
                                ? `Start ${p.trial_days}-Day Free Trial`
                                : `Get ${p.name} · ₹${price}/${billingCycle === "yearly" ? "yr" : "mo"}`}
                          </span>
                          {!isThisLoading && <Sparkles className="w-3.5 h-3.5" />}
                        </motion.button>
                      </motion.div>
                    );
                  })}
                </div>

                <motion.p className="text-center text-[9px] text-muted-foreground/40 flex items-center justify-center gap-1.5 mt-4"
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
                  <Shield className="w-3 h-3" /> Secure Razorpay payment · Cancel anytime · Instant access
                </motion.p>
              </>
            )}

            {(isPaid || isTrialActive) && (
              <motion.button
                onClick={handleCancel}
                disabled={loading}
                className="w-full py-2 mt-1 text-[10px] text-muted-foreground/40 hover:text-destructive/70 transition-colors font-medium"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }}
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
