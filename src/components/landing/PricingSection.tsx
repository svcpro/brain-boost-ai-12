import { motion, useInView } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { Crown, Check, Sparkles, Shield, Brain, Zap, Star } from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

const FEATURES = [
  "AI Second Brain",
  "Focus Study Mode",
  "AI Revision Mode",
  "Mock Practice Mode",
  "Emergency Rescue Mode",
  "Neural Memory Map",
  "Decay Forecast Engine",
  "AI Strategy Optimization",
  "Voice + Push Notifications",
  "Community Access",
  "Unlimited Usage",
];

const PricingSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });
  const [yearly, setYearly] = useState(false);
  const [plan, setPlan] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("subscription_plans")
        .select("*")
        .eq("plan_key", "premium")
        .eq("is_active", true)
        .maybeSingle();
      setPlan(data);
    })();
  }, []);

  const monthlyPrice = plan?.price || 149;
  const yearlyPrice = plan?.yearly_price || 1499;
  const monthlySavings = Math.round(((monthlyPrice * 12 - yearlyPrice) / (monthlyPrice * 12)) * 100);

  return (
    <section ref={ref} className="relative py-32 px-6" id="pricing">
      <div className="max-w-2xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-12"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            One Plan. <span className="gradient-text">Full Power.</span>
          </h2>
          <p className="text-muted-foreground text-lg mb-8">
            No tiers. No confusion. Everything unlocked.
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
                Save {monthlySavings}%
              </span>
            </button>
          </div>
        </motion.div>

        {/* Single Premium Plan Card */}
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.2 }}
          className="glass rounded-3xl p-8 md:p-10 neural-border glow-primary relative overflow-hidden"
        >
          {/* Badge */}
          <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-5 py-1.5 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center gap-1.5">
            <Crown className="w-3.5 h-3.5" />
            ACRY Premium
          </div>

          {/* Trial badge */}
          <div className="absolute top-4 right-4 px-3 py-1 rounded-xl bg-success/20 text-success text-[10px] font-bold">
            15-DAY FREE TRIAL
          </div>

          <div className="text-center mt-4 mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl neural-gradient neural-border mb-5">
              <Crown className="w-8 h-8 text-primary" />
            </div>

            <div className="mb-2">
              <span className="text-5xl md:text-6xl font-bold text-foreground">
                ₹{yearly ? yearlyPrice : monthlyPrice}
              </span>
              <span className="text-muted-foreground text-lg">/{yearly ? "year" : "mo"}</span>
            </div>

            {yearly && (
              <p className="text-sm text-success font-medium">
                That's ₹{Math.round(yearlyPrice / 12)}/mo · Save {monthlySavings}%
              </p>
            )}
          </div>

          {/* Features grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-8">
            {FEATURES.map((f, i) => (
              <motion.div
                key={f}
                initial={{ opacity: 0, x: -10 }}
                animate={isInView ? { opacity: 1, x: 0 } : {}}
                transition={{ delay: 0.3 + i * 0.04 }}
                className="flex items-center gap-2.5 text-sm text-foreground/90"
              >
                <div className="w-5 h-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                  <Check className="w-3 h-3 text-primary" />
                </div>
                {f}
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <Link
            to="/auth?splash=1"
            className="block text-center py-4 rounded-2xl font-bold text-lg bg-primary text-primary-foreground glow-primary hover:glow-primary-strong hover:scale-[1.02] transition-all duration-300"
          >
            Start 15-Day Free Trial
          </Link>

          <p className="text-center text-xs text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
            <Shield className="w-3 h-3" />
            No credit card required · Cancel anytime
          </p>
        </motion.div>

        {/* Trust elements */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          transition={{ delay: 0.6 }}
          className="flex items-center justify-center gap-6 mt-8 text-muted-foreground"
        >
          {[
            { icon: Shield, text: "Secure Payments" },
            { icon: Star, text: "Premium Support" },
            { icon: Zap, text: "Instant Access" },
          ].map(t => (
            <div key={t.text} className="flex items-center gap-1.5 text-xs">
              <t.icon className="w-3.5 h-3.5" />
              {t.text}
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};

export default PricingSection;
