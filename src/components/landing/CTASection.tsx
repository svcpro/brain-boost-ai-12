import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Brain } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6">
      <div className="max-w-3xl mx-auto text-center">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8 }}
          className="glass rounded-3xl p-12 md:p-16 neural-border relative overflow-hidden"
        >
          <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-primary/5 pointer-events-none" />
          <div className="relative z-10">
            <Brain className="w-16 h-16 text-primary mx-auto mb-6 animate-pulse-glow" />
            <h2 className="text-4xl md:text-5xl font-bold mb-4 text-foreground">
              Install ACRY.
            </h2>
            <p className="text-xl text-muted-foreground mb-8">
              Let AI Handle Your Brain.
            </p>
            <Link
              to="/auth"
              className="inline-flex items-center gap-2 px-10 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg glow-primary-strong hover:scale-105 transition-all duration-300"
            >
              <Brain className="w-5 h-5" />
              Get Started Now
            </Link>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
