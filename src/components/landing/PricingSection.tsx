import { useRef, useState, useEffect } from "react";
import { Brain, Zap, Crown, Check } from "lucide-react";
import { Link } from "react-router-dom";

const useInView = (ref: React.RefObject<HTMLElement>) => {
  const [inView, setInView] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setInView(true); obs.disconnect(); } }, { rootMargin: "-100px" });
    obs.observe(el);
    return () => obs.disconnect();
  }, [ref]);
  return inView;
};

const plans = [
  {
    name: "Free Brain",
    price: "₹0",
    icon: Brain,
    features: ["5 subjects & 20 topics", "Basic memory tracking", "Daily study reminders", "Community leaderboard"],
    cta: "Start Free",
    highlight: false,
  },
  {
    name: "Pro Brain",
    price: "₹199",
    period: "/mo",
    icon: Zap,
    features: ["Unlimited subjects & topics", "AI exam simulator", "Advanced analytics", "Voice notifications", "Priority support", "Weekly AI reports"],
    cta: "Upgrade to Pro",
    highlight: true,
  },
  {
    name: "Ultra Brain",
    price: "₹499",
    period: "/mo",
    icon: Crown,
    features: ["Everything in Pro", "AI study coach (1-on-1)", "Custom study plans", "Peer competition insights", "Offline mode", "Data export & backup"],
    cta: "Go Ultra",
    highlight: false,
  },
];

const PricingSection = () => {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref);

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-6xl mx-auto">
        <div className={`text-center mb-16 transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"}`}>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Choose Your <span className="gradient-text">Brain Level</span>
          </h2>
          <p className="text-muted-foreground text-lg">Unlock the full power of your AI Second Brain.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          {plans.map((plan, i) => (
            <div
              key={i}
              className={`glass rounded-2xl p-8 relative transition-all duration-700 ${isInView ? "opacity-100 translate-y-0" : "opacity-0 translate-y-10"} ${
                plan.highlight ? "neural-border glow-primary" : "border border-border"
              }`}
              style={{ transitionDelay: `${0.2 + i * 0.15}s` }}
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
                to="/auth"
                className={`block text-center py-3 rounded-xl font-semibold transition-all duration-300 ${
                  plan.highlight
                    ? "bg-primary text-primary-foreground glow-primary hover:glow-primary-strong hover:scale-105"
                    : "glass neural-border text-foreground hover:bg-secondary/50"
                }`}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default PricingSection;
