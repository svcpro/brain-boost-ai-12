import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Rocket, Play, Sparkles, Zap, Shield, TrendingUp } from "lucide-react";
import ACRYLogo from "./ACRYLogo";
import { Link } from "react-router-dom";
import { useEffect, useState, useCallback, useMemo, useRef } from "react";

// ─── Custom Hooks ───────────────────────────────────────────

/** Typewriter hook – cycles through words with a blinking cursor */
const useTypewriter = (words: string[], typingSpeed = 80, deletingSpeed = 50, pauseDelay = 2000) => {
  const [text, setText] = useState("");
  const [wordIndex, setWordIndex] = useState(0);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    const current = words[wordIndex];
    let timeout: ReturnType<typeof setTimeout>;

    if (!isDeleting && text === current) {
      timeout = setTimeout(() => setIsDeleting(true), pauseDelay);
    } else if (isDeleting && text === "") {
      setIsDeleting(false);
      setWordIndex((prev) => (prev + 1) % words.length);
    } else {
      timeout = setTimeout(() => {
        setText(current.substring(0, text.length + (isDeleting ? -1 : 1)));
      }, isDeleting ? deletingSpeed : typingSpeed);
    }

    return () => clearTimeout(timeout);
  }, [text, isDeleting, wordIndex, words, typingSpeed, deletingSpeed, pauseDelay]);

  return text;
};

/** Animated counter hook – smoothly counts from start → end */
const useAnimatedCounter = (end: number, start: number, duration = 3, delay = 1.5) => {
  const [value, setValue] = useState(start);
  const motionVal = useMotionValue(start);

  useEffect(() => {
    const unsub = motionVal.on("change", (v) => setValue(Math.round(v)));
    const controls = animate(motionVal, end, {
      duration,
      delay,
      ease: "easeInOut",
      repeat: Infinity,
      repeatType: "reverse",
      repeatDelay: 2,
    });
    return () => { controls.stop(); unsub(); };
  }, [motionVal, end, duration, delay, start]);

  return value;
};

/** Particle system hook – generates floating particles */
const useParticles = (count: number) => {
  return useMemo(() =>
    Array.from({ length: count }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: Math.random() * 3 + 1,
      duration: Math.random() * 8 + 6,
      delay: Math.random() * 4,
      opacity: Math.random() * 0.4 + 0.1,
    })),
  [count]);
};

/** Mouse parallax hook */
const useMouseParallax = (intensity = 0.02) => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);

  useEffect(() => {
    const handleMove = (e: MouseEvent) => {
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      x.set((e.clientX - cx) * intensity);
      y.set((e.clientY - cy) * intensity);
    };
    window.addEventListener("mousemove", handleMove, { passive: true });
    return () => window.removeEventListener("mousemove", handleMove);
  }, [x, y, intensity]);

  return { x, y };
};

// ─── Sub-components ─────────────────────────────────────────

const ParticleField = () => {
  const particles = useParticles(20);
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full bg-primary"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, opacity: p.opacity }}
          animate={{ y: [0, -30, 0], x: [0, 10, -10, 0], opacity: [p.opacity, p.opacity * 2, p.opacity] }}
          transition={{ duration: p.duration, repeat: Infinity, delay: p.delay, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

const BrainStabilityRing = () => {
  const percent = useAnimatedCounter(81, 72, 3, 1.5);
  const progress = useMotionValue(0);
  const circumference = 2 * Math.PI * 54;
  const strokeDashoffset = useTransform(progress, [0, 1], [circumference * 0.28, circumference * 0.19]);

  useEffect(() => {
    const controls = animate(progress, 1, {
      duration: 3, delay: 1.5, ease: "easeInOut",
      repeat: Infinity, repeatType: "reverse", repeatDelay: 2,
    });
    return controls.stop;
  }, [progress]);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.6, rotate: -20 }}
      animate={{ opacity: 1, scale: 1, rotate: 0 }}
      transition={{ delay: 0.8, duration: 1.2, type: "spring", bounce: 0.3 }}
      className="relative w-48 h-48 md:w-64 md:h-64"
    >
      {/* Outer glow ring */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{ boxShadow: [
          "0 0 40px hsl(187 100% 50% / 0.15), 0 0 80px hsl(262 100% 65% / 0.1)",
          "0 0 60px hsl(187 100% 50% / 0.25), 0 0 120px hsl(262 100% 65% / 0.15)",
          "0 0 40px hsl(187 100% 50% / 0.15), 0 0 80px hsl(262 100% 65% / 0.1)",
        ]}}
        transition={{ duration: 4, repeat: Infinity }}
      />

      {/* Background glass circle */}
      <div className="absolute inset-2 rounded-full glass neural-border" />

      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 relative z-10">
        <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(228, 30%, 14%)" strokeWidth="5" />
        <motion.circle
          cx="60" cy="60" r="54" fill="none"
          stroke="url(#ringGradHero)" strokeWidth="5" strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
          filter="url(#glowFilter)"
        />
        <defs>
          <linearGradient id="ringGradHero" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="hsl(187, 100%, 50%)" />
            <stop offset="50%" stopColor="hsl(262, 100%, 65%)" />
            <stop offset="100%" stopColor="hsl(155, 100%, 50%)" />
          </linearGradient>
          <filter id="glowFilter">
            <feGaussianBlur stdDeviation="2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
        <span className="text-4xl md:text-5xl font-bold text-foreground tabular-nums">
          {percent}<span className="text-xl text-primary">%</span>
        </span>
        <span className="text-[9px] text-muted-foreground uppercase tracking-[0.2em] mt-1">Brain Stability</span>
      </div>

      {/* Orbiting dots */}
      {[0, 120, 240].map((deg, i) => (
        <motion.div
          key={i}
          className="absolute top-1/2 left-1/2"
          style={{ marginTop: -3, marginLeft: -3 }}
          animate={{ rotate: [deg, deg + 360] }}
          transition={{ duration: 10 + i * 2, repeat: Infinity, ease: "linear" }}
        >
          <div
            className="w-1.5 h-1.5 rounded-full"
            style={{
              transform: `translateX(${88 + i * 6}px)`,
              background: i === 0 ? "hsl(187, 100%, 50%)" : i === 1 ? "hsl(262, 100%, 65%)" : "hsl(155, 100%, 50%)",
              boxShadow: `0 0 8px ${i === 0 ? "hsl(187, 100%, 50%)" : i === 1 ? "hsl(262, 100%, 65%)" : "hsl(155, 100%, 50%)"}`,
            }}
          />
        </motion.div>
      ))}

      {/* Floating stat badges */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2 }}
        className="absolute -right-4 top-4 md:-right-8"
      >
        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 3, repeat: Infinity }}>
          <div className="glass rounded-lg px-2.5 py-1.5 neural-border flex items-center gap-1.5">
            <TrendingUp className="w-3 h-3 text-success" />
            <span className="text-[10px] font-bold text-success">+2.4%</span>
          </div>
        </motion.div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ delay: 2.3 }}
        className="absolute -left-4 bottom-8 md:-left-10"
      >
        <motion.div animate={{ y: [0, -4, 0] }} transition={{ duration: 2.5, repeat: Infinity, delay: 0.5 }}>
          <div className="glass rounded-lg px-2.5 py-1.5 neural-border flex items-center gap-1.5">
            <Shield className="w-3 h-3 text-primary" />
            <span className="text-[10px] font-bold text-primary">Protected</span>
          </div>
        </motion.div>
      </motion.div>
    </motion.div>
  );
};

const LiveStatBar = () => {
  const stats = [
    { label: "Active Learners", value: "10K+", icon: Sparkles },
    { label: "Brain Updates/hr", value: "847", icon: Zap },
    { label: "Avg Score Boost", value: "+34%", icon: TrendingUp },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2, duration: 0.6 }}
      className="flex flex-wrap justify-center gap-5 mt-10"
    >
      {stats.map((stat, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 1.4 + i * 0.15 }}
          className="flex items-center gap-2.5 glass rounded-xl px-4 py-2.5 neural-border"
        >
          <stat.icon className="w-4 h-4 text-primary" />
          <div>
            <div className="text-sm font-bold text-foreground">{stat.value}</div>
            <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{stat.label}</div>
          </div>
        </motion.div>
      ))}
    </motion.div>
  );
};

// ─── Main Hero ──────────────────────────────────────────────

const HeroSection = () => {
  const examWord = useTypewriter(
    ["Every Exam.", "NEET.", "JEE.", "UPSC.", "CAT.", "GATE.", "Every Exam."],
    90, 60, 1800
  );
  const { x: mouseX, y: mouseY } = useMouseParallax(0.015);

  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden px-6 gradient-bg-hero pt-20">
      {/* Particle field */}
      <ParticleField />

      {/* Ambient glows with parallax */}
      <motion.div className="absolute inset-0 pointer-events-none" style={{ x: mouseX, y: mouseY }}>
        <div className="absolute top-1/4 left-1/6 w-[500px] h-[500px] rounded-full bg-primary/6 blur-[140px]" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] rounded-full bg-accent/5 blur-[120px]" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full bg-success/3 blur-[100px]" />
      </motion.div>

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(hsl(187 100% 50%) 1px, transparent 1px), linear-gradient(90deg, hsl(187 100% 50%) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      <div className="relative z-10 max-w-4xl mx-auto w-full flex flex-col items-center text-center">
        {/* Animated Logo */}
        <ACRYLogo variant="full" animate={true} />

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full neural-border neural-gradient mb-6"
        >
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
          </span>
          <span className="text-xs font-semibold text-primary tracking-wider uppercase">AI-Powered Cognitive OS</span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, delay: 0.4, type: "spring", bounce: 0.2 }}
          className="text-[2.5rem] md:text-6xl lg:text-[4.5rem] font-bold tracking-tight mb-4 leading-[1.08]"
        >
          <span className="text-foreground">Your AI Second Brain</span>
          <br />
          <span className="text-foreground">for </span>
          <span className="gradient-text text-glow inline-block min-w-[140px] md:min-w-[200px]">
            {examWord}
            <motion.span
              animate={{ opacity: [1, 0] }}
              transition={{ duration: 0.6, repeat: Infinity }}
              className="inline-block w-[3px] h-[0.85em] bg-primary ml-0.5 align-middle rounded-full"
            />
          </span>
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          className="text-lg md:text-xl text-muted-foreground max-w-xl mb-10 leading-relaxed"
        >
          Study Less. Remember More. <span className="text-foreground font-semibold">Rank Higher.</span>
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          className="flex flex-col sm:flex-row gap-4 justify-center"
        >
          <Link
            to="/auth"
            className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl bg-primary text-primary-foreground font-bold text-lg overflow-hidden transition-all duration-300 hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
            <Rocket className="w-5 h-5 relative z-10" />
            <span className="relative z-10">Start Your AI Brain</span>
            <div className="absolute inset-0 glow-primary-strong opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-xl" />
          </Link>
          <button className="inline-flex items-center justify-center gap-2 px-8 py-4 rounded-xl glass neural-border font-medium text-foreground hover:bg-secondary/50 transition-all duration-300 group">
            <motion.div
              animate={{ scale: [1, 1.15, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center group-hover:bg-primary/30 transition-colors"
            >
              <Play className="w-3.5 h-3.5 text-primary ml-0.5" />
            </motion.div>
            Watch 30s Demo
          </button>
        </motion.div>

        {/* Live stats */}
        <LiveStatBar />
      </div>

      {/* Scroll indicator */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 2.5 }}
        className="absolute bottom-8 left-1/2 -translate-x-1/2 hidden md:flex flex-col items-center gap-2"
      >
        <span className="text-[9px] text-muted-foreground uppercase tracking-widest">Scroll to explore</span>
        <motion.div
          animate={{ y: [0, 8, 0] }}
          transition={{ duration: 2, repeat: Infinity }}
          className="w-5 h-9 rounded-full neural-border flex justify-center pt-2"
        >
          <motion.div
            animate={{ height: [6, 12, 6], opacity: [0.4, 1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-1 rounded-full bg-primary/60"
          />
        </motion.div>
      </motion.div>
    </section>
  );
};

export default HeroSection;
