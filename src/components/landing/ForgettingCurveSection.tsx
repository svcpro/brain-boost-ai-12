import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { AlertTriangle, Shield } from "lucide-react";

const ForgettingCurveSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section id="features" ref={ref} className="relative py-32 px-6 overflow-hidden">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 40 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8 }}
          className="text-center mb-16"
        >
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full neural-border neural-gradient text-xs text-primary uppercase tracking-wider mb-4">
            <AlertTriangle className="w-3 h-3" /> Memory Intelligence
          </span>
          <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
            Your Memory is <span className="gradient-text">Fading</span>
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            ACRY detects memory drops before they happen and intervenes automatically.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-12 items-center">
          {/* Animated forgetting curve */}
          <motion.div
            initial={{ opacity: 0, x: -40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="relative"
          >
            <div className="glass rounded-2xl p-8 neural-border">
              <svg viewBox="0 0 400 200" className="w-full">
                {/* Grid lines */}
                {[0.25, 0.5, 0.75].map((y) => (
                  <line
                    key={y}
                    x1="40" y1={y * 180}
                    x2="380" y2={y * 180}
                    stroke="hsl(222, 30%, 16%)"
                    strokeWidth="0.5"
                  />
                ))}
                {/* Forgetting curve */}
                <motion.path
                  d="M 40 20 Q 100 20, 150 80 Q 200 140, 300 160 Q 350 170, 380 175"
                  fill="none"
                  stroke="hsl(0, 72%, 51%)"
                  strokeWidth="2"
                  strokeDasharray="1000"
                  initial={{ strokeDashoffset: 1000, opacity: 0.6 }}
                  animate={isInView ? { strokeDashoffset: 0, opacity: 0.6 } : {}}
                  transition={{ duration: 2, delay: 0.5 }}
                />
                {/* AI intervention line */}
                <motion.path
                  d="M 40 20 Q 100 20, 150 60 Q 180 75, 200 50 Q 230 25, 260 40 Q 290 55, 320 35 Q 350 20, 380 25"
                  fill="none"
                  stroke="hsl(175, 80%, 50%)"
                  strokeWidth="2.5"
                  strokeDasharray="1000"
                  initial={{ strokeDashoffset: 1000 }}
                  animate={isInView ? { strokeDashoffset: 0 } : {}}
                  transition={{ duration: 2, delay: 1 }}
                />
                {/* Warning point */}
                <motion.circle
                  cx="150" cy="60" r="6"
                  fill="hsl(175, 80%, 50%)"
                  initial={{ scale: 0 }}
                  animate={isInView ? { scale: 1 } : {}}
                  transition={{ duration: 0.5, delay: 1.5 }}
                />
                <motion.circle
                  cx="150" cy="60" r="12"
                  fill="none"
                  stroke="hsl(175, 80%, 50%)"
                  strokeWidth="1"
                  initial={{ scale: 0, opacity: 0 }}
                  animate={isInView ? { scale: [1, 1.5, 1], opacity: [0.6, 0, 0.6] } : {}}
                  transition={{ duration: 2, delay: 1.5, repeat: Infinity }}
                />
                {/* Labels */}
                <text x="42" y="195" fill="hsl(215, 20%, 55%)" fontSize="10">Day 1</text>
                <text x="350" y="195" fill="hsl(215, 20%, 55%)" fontSize="10">Day 30</text>
                <text x="42" y="15" fill="hsl(215, 20%, 55%)" fontSize="10">100%</text>
              </svg>
              <div className="flex gap-6 mt-4 justify-center">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-destructive/60" />
                  <span className="text-xs text-muted-foreground">Without ACRY</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-0.5 bg-primary" />
                  <span className="text-xs text-muted-foreground">With ACRY</span>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Feature cards */}
          <motion.div
            initial={{ opacity: 0, x: 40 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="space-y-4"
          >
            {[
              { icon: AlertTriangle, title: "Forget Risk Detection", desc: "AI predicts exactly when you'll forget a topic" },
              { icon: Shield, title: "Auto Intervention", desc: "Precision review sessions triggered before memory drops" },
            ].map((item, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 20 }}
                animate={isInView ? { opacity: 1, y: 0 } : {}}
                transition={{ delay: 0.6 + i * 0.2 }}
                className="glass rounded-xl p-6 neural-border hover:glow-primary transition-all duration-500 group"
              >
                <div className="flex items-start gap-4">
                  <div className="p-2 rounded-lg neural-gradient neural-border">
                    <item.icon className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground mb-1">{item.title}</h3>
                    <p className="text-sm text-muted-foreground">{item.desc}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
};

export default ForgettingCurveSection;
