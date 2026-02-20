import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Focus, Brain, ClipboardCheck, Siren, Sparkles } from "lucide-react";

const modes = [
  {
    icon: Focus,
    title: "Focus Mode",
    desc: "Deep work sessions with Pomodoro + ambient audio for peak concentration.",
    gradient: "from-primary/20 to-transparent",
  },
  {
    icon: Brain,
    title: "AI Revision",
    desc: "Smart spaced repetition powered by your cognitive twin's memory model.",
    gradient: "from-accent/20 to-transparent",
  },
  {
    icon: ClipboardCheck,
    title: "Mock Practice",
    desc: "AI-generated exam simulations that adapt to your weak areas in real-time.",
    gradient: "from-success/20 to-transparent",
  },
  {
    icon: Siren,
    title: "Emergency Rescue",
    desc: "Last-minute crash sessions targeting highest-impact topics for tomorrow's exam.",
    gradient: "from-warning/20 to-transparent",
  },
];

const StudyModesSection = () => {
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
            <Sparkles className="w-3 h-3" /> Study Modes
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-foreground">
            Every Situation. <span className="gradient-text">One Brain.</span>
          </h2>
        </motion.div>

        <div className="grid sm:grid-cols-2 gap-5">
          {modes.map((mode, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 30 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.6 }}
              className="glass rounded-2xl p-7 neural-border group relative overflow-hidden cursor-pointer hover:glow-primary transition-all duration-500"
            >
              <div className={`absolute inset-0 bg-gradient-to-br ${mode.gradient} opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none`} />
              <div className="relative z-10">
                <div className="p-3 rounded-xl neural-gradient neural-border w-fit mb-4 group-hover:scale-110 transition-transform duration-300">
                  <mode.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-bold text-foreground mb-2">{mode.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{mode.desc}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default StudyModesSection;
