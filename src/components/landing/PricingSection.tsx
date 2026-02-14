import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Brain, Zap, Crown, Check } from "lucide-react";
import { Link } from "react-router-dom";

const plans = [
  {
    name: "Free Brain",
    price: "₹0",
    icon: Brain,
    features: ["Basic memory tracking", "3 fix sessions/day", "Single exam profile", "Basic analytics"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro Brain",
    price: "₹299",
    period: "/mo",
    icon: Zap,
    features: ["Full AI planning", "Unlimited fix sessions", "Knowledge Graph", "Strategy Simulator", "Rank prediction", "Multi-exam support"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Elite Brain",
    price: "₹599",
    period: "/mo",
    icon: Crown,
    features: ["Everything in Pro", "Competition Intelligence", "Advanced AI prediction", "Personalized exam strategy", "Priority support", "Brain coaching"],
    cta: "Go Elite",
    highlight: false,
  },
];

const PricingSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Choose Your <span className="gradient-text">Brain Level</span>
          </h2>
          <p className="text-muted-foreground text-lg">Unlock the full power of your AI Second Brain.</p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.15 }}
              className={`glass rounded-2xl p-8 relative ${
                plan.highlight
                  ? "neural-border glow-primary"
                  : "border border-border"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-primary text-primary-foreground text-xs font-semibold">
                  Most Popular
                </div>
              )}
              <div className="p-3 rounded-xl neural-gradient neural-border w-fit mb-6">
                <plan.icon className="w-6 h-6 text-primary" />
              </div>
              <h3 className="text-xl font-bold text-foreground mb-2">{plan.name}</h3>
              <div className="mb-6">
                <span className="text-4xl font-bold text-foreground">{plan.price}</span>
                {plan.period && <span className="text-muted-foreground">{plan.period}</span>}
              </div>
              <ul className="space-y-3 mb-8">
                {plan.features.map((f, j) => (
                  <li key={j} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="w-4 h-4 text-primary flex-shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                to="/app"
                className={`block text-center py-3 rounded-xl font-semibold transition-all duration-300 ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground glow-primary hover:glow-primary-strong hover:scale-105"
                    : "glass neural-border text-foreground hover:bg-secondary/50"
                }`}
              >
                {plan.cta}
              </Link>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
