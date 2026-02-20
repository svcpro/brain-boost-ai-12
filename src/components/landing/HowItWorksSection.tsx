import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Mic, Brain, TrendingUp, Zap } from "lucide-react";

const steps = [
  {
    icon: Mic,
    title: "Feed Your Brain",
    desc: "Voice, text, images — ACRY absorbs anything you throw at it with AI auto-extraction.",
    accent: "from-primary/20 to-primary/5",
    glow: "glow-primary",
  },
  {
    icon: Brain,
    title: "AI Optimizes Your Study",
    desc: "Predicts what you'll forget, schedules perfect review timing, builds your cognitive twin.",
    accent: "from-accent/20 to-accent/5",
    glow: "glow-accent",
  },
  {
    icon: TrendingUp,
    title: "Execute. Improve. Rank.",
    desc: "Watch your brain stability rise, mock scores climb, and predicted rank improve daily.",
    accent: "from-success/20 to-success/5",
    glow: "glow-success",
  },
];

const HowItWorksSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-80px" });

  return (
    <section ref={ref} className="relative py-28 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full neural-border neural-gradient text-xs text-primary uppercase tracking-wider mb-4">
            <Zap className="w-3 h-3" /> How It Works
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            3 Steps to a <span className="gradient-text">Smarter Brain</span>
          </h2>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {steps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 40 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.2 + i * 0.15, duration: 0.6 }}
              className={`glass rounded-2xl p-8 neural-border relative overflow-hidden group hover:${step.glow} transition-all duration-500`}
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${step.accent} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
              <div className="relative z-10">
                <div className="text-xs font-bold text-muted-foreground mb-4 tracking-widest">0{i + 1}</div>
                <div className="p-3 rounded-xl neural-gradient neural-border w-fit mb-5 group-hover:glow-primary transition-all duration-500">
                  <step.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-xl font-bold text-foreground mb-2">{step.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default HowItWorksSection;
