import { motion, useMotionValue, useTransform, animate, useMotionValueEvent } from "framer-motion";
import { Brain, Rocket, Play } from "lucide-react";
import { Link } from "react-router-dom";
import { useEffect, useRef, useState } from "react";

const BrainStabilityRing = () => {
  const progress = useMotionValue(0);
  const [displayPercent, setDisplayPercent] = useState(72);

  useEffect(() => {
    const unsubscribe = progress.on("change", (v) => {
      setDisplayPercent(Math.round(72 + v * 9));
    });
    const controls = animate(progress, 1, {
      duration: 3,
      delay: 1.5,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "reverse",
      repeatDelay: 2,
    });
    return () => {
      controls.stop();
      unsubscribe();
    };
  }, [progress]);

  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = useTransform(progress, [0, 1], [circumference * 0.28, circumference * 0.19]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 1, duration: 0.8 }}
      className="relative w-40 h-40 md:w-52 md:h-52"
    >
      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(228, 30%, 16%)" strokeWidth="6" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke="url(#ringGrad)" strokeWidth="6" strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
        <defs>
          <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(187, 100%, 50%)" />
            <stop offset="100%" stopColor="hsl(262, 100%, 65%)" />
          </linearGradient>
        </defs>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
        <motion.span className="text-3xl md:text-4xl font-bold text-foreground">
          {displayPercent}
          <span className="text-lg text-primary">%</span>
        </motion.span>
        <span className="text-[10px] text-muted-foreground uppercase tracking-widest mt-1">Brain Stability</span>
      </div>
      {/* Orbiting particle */}
      <motion.div
        className="absolute top-1/2 left-1/2 w-2 h-2 rounded-full bg-primary glow-primary"
        style={{ marginTop: -4, marginLeft: -4 }}
        animate={{ rotate: 360 }}
        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
      >
        <div className="w-2 h-2 rounded-full bg-primary" style={{ transform: "translateX(70px)" }} />
      </motion.div>
    </motion.div>
  );
};

const HeroSection = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 gradient-bg-hero">
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-primary/5 blur-[120px]" />
        <div className="absolute bottom-1/4 right-1/4 w-[300px] h-[300px] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto w-full grid lg:grid-cols-5 gap-10 items-center">
        {/* Left content – 3 cols */}
        <div className="lg:col-span-3 text-center lg:text-left">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full neural-border neural-gradient mb-6"
          >
            <span className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-xs font-medium text-primary tracking-wider uppercase">AI-Powered Cognitive OS</span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6 leading-[1.1]"
          >
            <span className="text-foreground">Your AI Second Brain</span>
            <br />
            <span className="text-foreground">for </span>
            <span className="gradient-text text-glow">Every Exam.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            className="text-lg md:text-xl text-muted-foreground max-w-xl mb-8 mx-auto lg:mx-0"
          >
            Study Less. Remember More. Rank Higher.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start"
          >
            <Link
              to="/auth"
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-semibold text-lg glow-primary hover:glow-primary-strong transition-all duration-300 hover:scale-105"
            >
              <Rocket className="w-5 h-5" />
              Start Your AI Brain
            </Link>
            <button
              className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass neural-border font-medium text-foreground hover:bg-secondary/50 transition-all duration-300 group"
            >
              <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors">
                <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
              </div>
              Watch 30s Demo
            </button>
          </motion.div>
        </div>

        {/* Right – Brain Ring – 2 cols */}
        <div className="lg:col-span-2 flex justify-center">
          <BrainStabilityRing />
        </div>
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:block"
      >
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-6 h-10 rounded-full neural-border flex justify-center pt-2"
        >
          <div className="w-1.5 h-3 rounded-full bg-primary/60" />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
