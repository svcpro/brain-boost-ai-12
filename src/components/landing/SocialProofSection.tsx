import { motion, useInView, useMotionValue, useTransform, animate } from "framer-motion";
import { useRef, useEffect } from "react";

const AnimatedCounter = ({ target, suffix, label, delay }: { target: number; suffix: string; label: string; delay: number }) => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true });
  const count = useMotionValue(0);
  const rounded = useTransform(count, (v) => {
    if (target >= 1000) return Math.round(v).toLocaleString();
    return Math.round(v).toString();
  });

  useEffect(() => {
    if (!isInView) return;
    const controls = animate(count, target, { duration: 2, delay, ease: "easeOut" });
    return controls.stop;
  }, [isInView, target, delay, count]);

  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 30 }}
      animate={isInView ? { opacity: 1, y: 0 } : {}}
      transition={{ delay, duration: 0.6 }}
      className="text-center"
    >
      <div className="text-4xl md:text-5xl font-bold text-foreground mb-2">
        <motion.span>{rounded}</motion.span>
        <span className="gradient-text">{suffix}</span>
      </div>
      <p className="text-sm text-muted-foreground">{label}</p>
    </motion.div>
  );
};

const SocialProofSection = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: "-100px" });

  return (
    <section ref={ref} className="relative py-20 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0 }}
          animate={isInView ? { opacity: 1 } : {}}
          className="glass rounded-3xl neural-border p-10 md:p-16"
        >
          <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
            <AnimatedCounter target={10000} suffix="+" label="Sessions Completed" delay={0.1} />
            <AnimatedCounter target={87} suffix="%" label="Avg Stability Growth" delay={0.3} />
            <AnimatedCounter target={92} suffix="%" label="Students Improved Mock Scores" delay={0.5} />
          </div>
        </motion.div>
      </div>
    </section>
  );
};

export default SocialProofSection;
