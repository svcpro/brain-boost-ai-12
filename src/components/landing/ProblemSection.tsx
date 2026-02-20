import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { AlertTriangle, Brain, Zap } from "lucide-react";

const problems = [
  "You forget what you study.",
  "You don't know what to revise.",
  "You feel behind before exams.",
];

const ProblemSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-28 px-6 overflow-hidden" id="features">
      <div className="max-w-6xl mx-auto">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* Left – Problem */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8 }}
          >
            <div className="glass rounded-2xl p-8 neural-border relative overflow-hidden">
              <div className="absolute inset-0 bg-destructive/5 pointer-events-none" />
              <div className="relative z-10 flex flex-col items-center gap-6">
                <AlertTriangle className="w-12 h-12 text-destructive/60" />
                <div className="space-y-4 w-full">
                  {problems.map((text, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, x: -20 }}
                      animate={isInView ? { opacity: 1, x: 0 } : {}}
                      transition={{ delay: 0.4 + i * 0.25 }}
                      className="glass rounded-xl px-5 py-4 border border-destructive/10"
                    >
                      <p className="text-base text-muted-foreground font-medium">{text}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>

          {/* Right – Solution */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-center lg:text-left"
          >
            <motion.div
              initial={{ scale: 0 }}
              animate={isInView ? { scale: 1 } : {}}
              transition={{ delay: 1, type: "spring" }}
              className="inline-flex items-center justify-center w-16 h-16 rounded-2xl neural-gradient neural-border mb-6 glow-primary"
            >
              <Brain className="w-8 h-8 text-primary" />
            </motion.div>

            <h2 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
              ACRY <span className="gradient-text">Predicts.</span>
              <br />
              <span className="gradient-text">Stabilizes.</span>
              <br />
              <span className="gradient-text">Optimizes.</span>
            </h2>
            <p className="text-muted-foreground text-lg max-w-md mx-auto lg:mx-0">
              Let AI detect memory drops before they happen and intervene automatically so you stay ahead.
            </p>
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ProblemSection;
