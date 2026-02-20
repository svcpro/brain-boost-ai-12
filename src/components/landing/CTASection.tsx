import { motion, useInView } from "framer-motion";
import { useRef } from "react";
import { Rocket, ArrowDown } from "lucide-react";
import { Link } from "react-router-dom";

const CTASection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-32 px-6 overflow-hidden">
      {/* Background glow */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[400px] rounded-full bg-primary/8 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="max-w-3xl mx-auto text-center relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={isInView ? { opacity: 1, scale: 1 } : {}}
          transition={{ duration: 0.8 }}
        >
          <h2 className="text-3xl md:text-5xl lg:text-6xl font-bold mb-6 text-foreground leading-tight">
            Stop Studying Blindly.
            <br />
            <span className="gradient-text text-glow">Start Training Your Brain.</span>
          </h2>
          <p className="text-lg text-muted-foreground mb-10 max-w-lg mx-auto">
            Join thousands of students who let AI handle their memory, revision, and exam strategy.
          </p>

          {/* Animated arrow */}
          <motion.div
            animate={{ y: [0, 8, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="mb-6"
          >
            <ArrowDown className="w-6 h-6 text-primary/50 mx-auto" />
          </motion.div>

          <Link
            to="/auth"
            className="inline-flex items-center gap-3 px-10 py-5 rounded-xl bg-primary text-primary-foreground font-bold text-lg glow-primary-strong hover:scale-105 transition-all duration-300"
          >
            <Rocket className="w-5 h-5" />
            Activate My AI Brain Now
          </Link>
        </motion.div>
      </div>
    </section>
  );
};

export default CTASection;
