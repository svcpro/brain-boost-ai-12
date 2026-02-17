import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Zap, Crown, Check, X, Sparkles, Shield, Brain } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const PricingSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [yearly, setYearly] = useState(false);
  const [plans, setPlans] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("is_active", true)
        .order("sort_order");
      setPlans(data || []);
    })();
  }, []);

  const proPlan = plans.find((p) => p.plan_key === "pro");
  const ultraPlan = plans.find((p) => p.plan_key === "ultra");

  const getPrice = (plan: any) => (yearly ? plan?.yearly_price : plan?.price) || 0;
  const getSavings = (plan: any) => {
    if (!plan) return 0;
    const monthlyTotal = plan.price * 12;
    const yearlyTotal = plan.yearly_price;
    return monthlyTotal > 0 ? Math.round(((monthlyTotal - yearlyTotal) / monthlyTotal) * 100) : 0;
  };

  const comparison = [
    { feature: "Subjects & Topics", pro: "Unlimited", ultra: "Unlimited" },
    { feature: "AI Exam Simulator", pro: true, ultra: true },
    { feature: "Advanced Analytics", pro: true, ultra: true },
    { feature: "Voice Notifications", pro: true, ultra: true },
    { feature: "Weekly AI Reports", pro: true, ultra: true },
    { feature: "AI Study Coach (1-on-1)", pro: false, ultra: true },
    { feature: "Custom Study Plans", pro: false, ultra: true },
    { feature: "Peer Competition Insights", pro: false, ultra: true },
    { feature: "Full Community Access", pro: false, ultra: true },
    { feature: "Full WhatsApp Notifications", pro: false, ultra: true },
    { feature: "Knowledge Graph", pro: false, ultra: true },
    { feature: "Cognitive Twin", pro: false, ultra: true },
    { feature: "Data Export & Backup", pro: false, ultra: true },
    { feature: "Early Access Features", pro: false, ultra: true },
    { feature: "15-Day Free Trial", pro: true, ultra: false },
  ];

  return (
    <section ref={ref} className="relative py-32 px-6" id="pricing">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Choose Your <span className="gradient-text">Brain Level</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            Unlock the full power of your AI Second Brain.
          </p>

          {/* Billing toggle */}
          <div className="inline-flex items-center gap-3 p-1.5 rounded-full glass neural-border">
            <button
              onClick={() => setYearly(false)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all ${
                !yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setYearly(true)}
              className={`px-5 py-2 rounded-full text-sm font-semibold transition-all flex items-center gap-1.5 ${
                yearly ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Yearly
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-success/20 text-success">
                Save {getSavings(ultraPlan)}%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Plan Cards */}
        <div className="grid md:grid-cols-2 gap-6 max-w-3xl mx-auto mb-20">
          {/* Pro Plan */}
          {proPlan && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 }}
              className="glass rounded-2xl p-8 border border-border relative overflow-hidden"
            >
              <div className="absolute top-0 right-0 px-3 py-1 rounded-bl-xl bg-success/20 text-success text-[10px] font-bold">
                15-DAY FREE TRIAL
              </div>
              <div className="p-3 rounded-xl neural-gradient neural-border w-fit mb-6">
                <Zap className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">{proPlan.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">For serious learners</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">₹{getPrice(proPlan)}</span>
                <span className="text-muted-foreground">/{yearly ? "year" : "mo"}</span>
                {yearly && (
                  <p className="text-xs text-success mt-1">
                    Save {getSavings(proPlan)}% vs monthly
                  </p>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {(proPlan.features as string[])?.map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="block text-center py-3 rounded-xl font-semibold glass neural-border text-foreground hover:bg-secondary/50 transition-all duration-300"
              >
                Start Free Trial
              </Link>
            </motion.div>
          )}

          {/* Ultra Plan */}
          {ultraPlan && (
            <motion.div
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.35 }}
              className="glass rounded-2xl p-8 neural-border glow-primary relative overflow-hidden"
            >
              <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                Recommended
              </div>
              <div className="p-3 rounded-xl neural-gradient neural-border w-fit mb-6 mt-2">
                <Crown className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-1">{ultraPlan.name}</h3>
              <p className="text-xs text-muted-foreground mb-4">Maximum brain power</p>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">₹{getPrice(ultraPlan)}</span>
                <span className="text-muted-foreground">/{yearly ? "year" : "mo"}</span>
                {yearly && (
                  <p className="text-xs text-success mt-1">
                    Save {getSavings(ultraPlan)}% vs monthly
                  </p>
                )}
              </div>
              <ul className="space-y-3 mb-8">
                {(ultraPlan.features as string[])?.map((f: string, j: number) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/auth"
                className="block text-center py-3 rounded-xl font-semibold bg-primary text-primary-foreground glow-primary hover:glow-primary-strong hover:scale-105 transition-all duration-300"
              >
                Subscribe Now
              </Link>
            </motion.div>
          )}
        </div>

        {/* Comparison Table */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.5 }}
        >
          <h3 className="text-2xl font-bold text-center text-foreground mb-8">
            Plan Comparison
          </h3>
          <div className="glass rounded-2xl neural-border overflow-hidden">
            <div className="grid grid-cols-3 gap-0">
              <div className="p-4 border-b border-border font-semibold text-muted-foreground text-sm">Feature</div>
              <div className="p-4 border-b border-border text-center font-semibold text-foreground text-sm">Pro Brain</div>
              <div className="p-4 border-b border-border text-center font-semibold text-primary text-sm">Ultra Brain</div>
              {comparison.map((row, i) => (
                <>
                  <div key={`f-${i}`} className="p-3.5 border-b border-border/50 text-sm text-muted-foreground">{row.feature}</div>
                  <div key={`p-${i}`} className="p-3.5 border-b border-border/50 text-center">
                    {typeof row.pro === "string" ? (
                      <span className="text-sm text-foreground">{row.pro}</span>
                    ) : row.pro ? (
                      <Check className="w-4 h-4 text-success mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                    )}
                  </div>
                  <div key={`u-${i}`} className="p-3.5 border-b border-border/50 text-center">
                    {typeof row.ultra === "string" ? (
                      <span className="text-sm text-primary font-medium">{row.ultra}</span>
                    ) : row.ultra ? (
                      <Check className="w-4 h-4 text-primary mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-muted-foreground/40 mx-auto" />
                    )}
                  </div>
                </>
              ))}
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
