import { useEffect, useState, useRef } from "react";
import { motion, useScroll, useTransform, useMotionValue, useSpring, animate, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Rocket, Brain, Target, Zap, Sparkles, TrendingUp, Shield, ChevronRight, Play, Star, ArrowRight, Activity, BarChart3, Trophy } from "lucide-react";
import SplashScreen from "@/components/splash/SplashScreen";
import ACRYLogo from "./ACRYLogo";

const SPLASH_KEY = "acry_mobile_splash_seen_v1";

// ─── Animated counter ────────────────────────────────────
const useCounter = (end: number, duration = 2, delay = 0) => {
  const [val, setVal] = useState(0);
  const mv = useMotionValue(0);
  useEffect(() => {
    const u = mv.on("change", (v) => setVal(Math.round(v)));
    const c = animate(mv, end, { duration, delay, ease: "easeOut" });
    return () => { c.stop(); u(); };
  }, [end, duration, delay, mv]);
  return val;
};

// ─── Live activity ticker ────────────────────────────────
const ACTIVITIES = [
  { name: "Priya R.", action: "rank jumped", value: "+1,247", color: "#00FF94" },
  { name: "Arjun M.", action: "memory locked", value: "98%", color: "#00E5FF" },
  { name: "Riya S.", action: "streak hit", value: "47 days", color: "#FFD60A" },
  { name: "Karan P.", action: "predicted Q", value: "12/15", color: "#7C4DFF" },
  { name: "Neha T.", action: "rescue saved", value: "3 topics", color: "#FF3B30" },
];

const LiveTicker = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ACTIVITIES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const a = ACTIVITIES[idx];
  return (
    <div className="flex items-center gap-2.5 rounded-full px-3.5 py-1.5 backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: a.color }} />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: a.color }} />
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.3 }}
          className="flex items-center gap-1.5 text-[10px] whitespace-nowrap"
        >
          <span style={{ color: "#ffffff90" }} className="font-semibold">{a.name}</span>
          <span style={{ color: "#ffffff50" }}>{a.action}</span>
          <span style={{ color: a.color }} className="font-bold">{a.value}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Brain ring (hero centerpiece) ───────────────────────
const BrainRing = () => {
  const score = useCounter(94, 2.2, 0.4);
  const circ = 2 * Math.PI * 56;
  const offset = useMotionValue(circ);
  useEffect(() => {
    const c = animate(offset, circ * 0.06, { duration: 2.2, delay: 0.4, ease: "easeOut" });
    return c.stop;
  }, [circ, offset]);

  return (
    <div className="relative w-[200px] h-[200px] mx-auto">
      {/* Pulse rings */}
      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full pointer-events-none"
          style={{ border: "1px solid #00E5FF" }}
          animate={{ scale: [1, 1.4], opacity: [0.4, 0] }}
          transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.8, ease: "easeOut" }}
        />
      ))}

      {/* Glow */}
      <motion.div
        className="absolute inset-0 rounded-full"
        animate={{
          boxShadow: [
            "0 0 40px #00E5FF20, 0 0 80px #7C4DFF15, inset 0 0 30px #00E5FF10",
            "0 0 70px #00E5FF35, 0 0 130px #7C4DFF20, inset 0 0 50px #00E5FF15",
            "0 0 40px #00E5FF20, 0 0 80px #7C4DFF15, inset 0 0 30px #00E5FF10",
          ],
        }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {/* Glass disc */}
      <div
        className="absolute inset-3 rounded-full backdrop-blur-xl"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(0,229,255,0.06), rgba(11,15,26,0.6))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      <svg viewBox="0 0 130 130" className="w-full h-full -rotate-90 relative">
        <circle cx="65" cy="65" r="56" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <motion.circle
          cx="65" cy="65" r="56" fill="none"
          stroke="url(#brainGrad)" strokeWidth="3" strokeLinecap="round"
          strokeDasharray={circ} style={{ strokeDashoffset: offset }}
          filter="url(#brainGlow)"
        />
        <defs>
          <linearGradient id="brainGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00E5FF" />
            <stop offset="50%" stopColor="#7C4DFF" />
            <stop offset="100%" stopColor="#00FF94" />
          </linearGradient>
          <filter id="brainGlow">
            <feGaussianBlur stdDeviation="2" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center content */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.div initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.3, type: "spring" }}>
          <Brain className="w-5 h-5 mb-1.5" style={{ color: "#00E5FF" }} />
        </motion.div>
        <div className="text-[40px] font-bold leading-none tabular-nums" style={{ color: "#ffffffee" }}>
          {score}<span className="text-[18px]" style={{ color: "#00E5FF" }}>%</span>
        </div>
        <div className="text-[8px] uppercase tracking-[0.2em] mt-1.5 font-semibold" style={{ color: "#ffffff50" }}>
          Brain Stability
        </div>
      </div>

      {/* Orbiting badges */}
      {[
        { angle: -30, delay: 1.4, icon: TrendingUp, color: "#00FF94", label: "+24%" },
        { angle: 90, delay: 1.6, icon: Shield, color: "#00E5FF", label: "Protected" },
        { angle: 210, delay: 1.8, icon: Trophy, color: "#FFD60A", label: "Top 3%" },
      ].map((b, i) => {
        const rad = (b.angle * Math.PI) / 180;
        const x = Math.cos(rad) * 110;
        const y = Math.sin(rad) * 110;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: b.delay, type: "spring", bounce: 0.5 }}
            className="absolute top-1/2 left-1/2"
            style={{ transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))` }}
          >
            <motion.div
              animate={{ y: [0, -3, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, delay: i * 0.4 }}
              className="flex items-center gap-1 rounded-full px-2 py-1 backdrop-blur-md whitespace-nowrap"
              style={{
                background: "rgba(11,15,26,0.85)",
                border: `1px solid ${b.color}40`,
                boxShadow: `0 0 12px ${b.color}30`,
              }}
            >
              <b.icon className="w-2.5 h-2.5" style={{ color: b.color }} />
              <span className="text-[9px] font-bold" style={{ color: b.color }}>{b.label}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ─── Particle field ─────────────────────────────────────
const ParticleField = () => {
  const particles = Array.from({ length: 18 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.5 + 0.5,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 4,
    color: ["#00E5FF", "#7C4DFF", "#00FF94"][i % 3],
  }));
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {particles.map((p) => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            width: p.size, height: p.size,
            left: `${p.x}%`, top: `${p.y}%`,
            background: p.color,
            boxShadow: `0 0 ${p.size * 4}px ${p.color}60`,
          }}
          animate={{ y: [0, -25, 0], opacity: [0.1, 0.4, 0.1] }}
          transition={{ duration: p.duration, delay: p.delay, repeat: Infinity, ease: "easeInOut" }}
        />
      ))}
    </div>
  );
};

// ─── Animated stat card ─────────────────────────────────
const StatCard = ({ icon: Icon, value, label, color, delay = 0 }: any) => {
  const num = typeof value === "number" ? useCounter(value, 1.8, delay) : null;
  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ delay, duration: 0.5, type: "spring" }}
      whileTap={{ scale: 0.97 }}
      className="relative rounded-2xl p-3.5 overflow-hidden"
      style={{
        background: "rgba(255,255,255,0.025)",
        border: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(20px)",
      }}
    >
      <motion.div
        className="absolute -top-8 -right-8 w-20 h-20 rounded-full pointer-events-none"
        style={{ background: `${color}15`, filter: "blur(20px)" }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 4, repeat: Infinity }}
      />
      <div className="relative">
        <Icon className="w-3.5 h-3.5 mb-2" style={{ color }} />
        <div className="text-[20px] font-bold leading-none tabular-nums" style={{ color: "#ffffffee" }}>
          {num !== null ? num : value}
        </div>
        <div className="text-[9px] uppercase tracking-wider mt-1 font-medium" style={{ color: "#ffffff55" }}>
          {label}
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main mobile landing ────────────────────────────────
const MobileLanding = () => {
  const [showSplash, setShowSplash] = useState(false);
  const [ready, setReady] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { scrollY } = useScroll({ container: scrollRef });
  const heroOpacity = useTransform(scrollY, [0, 200], [1, 0.3]);
  const heroScale = useTransform(scrollY, [0, 200], [1, 0.95]);
  const heroY = useSpring(useTransform(scrollY, [0, 200], [0, -30]), { stiffness: 100, damping: 30 });

  useEffect(() => {
    const seen = sessionStorage.getItem(SPLASH_KEY);
    if (!seen) setShowSplash(true);
    else setReady(true);
  }, []);

  const handleSplashComplete = () => {
    sessionStorage.setItem(SPLASH_KEY, "1");
    setShowSplash(false);
    setReady(true);
  };

  if (showSplash) return <SplashScreen onComplete={handleSplashComplete} />;
  if (!ready) return null;

  return (
    <div
      ref={scrollRef}
      className="fixed inset-0 z-0 overflow-y-auto overflow-x-hidden"
      style={{
        background: "linear-gradient(180deg, #060912 0%, #0B0F1A 50%, #0F1424 100%)",
        WebkitOverflowScrolling: "touch",
      }}
    >
      <ParticleField />

      {/* Ambient orbs */}
      <div className="pointer-events-none fixed inset-0 z-0">
        <motion.div
          className="absolute top-[-15%] left-[-25%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, #00E5FF20, transparent 70%)", filter: "blur(80px)" }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-[5%] right-[-25%] w-[500px] h-[500px] rounded-full"
          style={{ background: "radial-gradient(circle, #7C4DFF20, transparent 70%)", filter: "blur(80px)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity }}
        />
      </div>

      {/* Top bar */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="sticky top-0 z-40 backdrop-blur-2xl border-b"
        style={{
          background: "rgba(6,9,18,0.7)",
          borderColor: "rgba(255,255,255,0.04)",
        }}
      >
        <div className="flex items-center justify-between px-5 py-3">
          <ACRYLogo variant="navbar" animate={false} />
          <Link
            to="/auth?splash=1"
            className="relative inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-xs font-bold overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: "0 4px 20px #00E5FF40",
            }}
          >
            <span className="absolute inset-0 bg-white/30 -translate-x-full group-active:translate-x-full transition-transform duration-700" />
            <Rocket className="w-3 h-3 relative" />
            <span className="relative">Start Free</span>
          </Link>
        </div>
      </motion.header>

      {/* HERO */}
      <motion.section
        style={{ opacity: heroOpacity, scale: heroScale, y: heroY }}
        className="relative px-6 pt-8 pb-10 z-10"
      >
        {/* Live ticker */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex justify-center mb-6"
        >
          <LiveTicker />
        </motion.div>

        {/* Brain ring centerpiece */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3, duration: 0.7, type: "spring" }}
        >
          <BrainRing />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="text-center text-[34px] leading-[1.05] font-bold tracking-tight mt-8"
        >
          <span style={{ color: "#ffffffee" }}>Your AI</span>
          <br />
          <span style={{ color: "#ffffffee" }}>Second Brain</span>
          <br />
          <motion.span
            initial={{ backgroundPosition: "0% 50%" }}
            animate={{ backgroundPosition: "100% 50%" }}
            transition={{ duration: 4, repeat: Infinity, repeatType: "reverse" }}
            style={{
              background: "linear-gradient(90deg, #00E5FF, #7C4DFF, #00FF94, #7C4DFF, #00E5FF)",
              backgroundSize: "200% auto",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            for Every Exam
          </motion.span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
          className="mt-4 text-center text-[14px] leading-relaxed px-2"
          style={{ color: "#ffffff75" }}
        >
          ACRY learns how <span style={{ color: "#00E5FF" }} className="font-semibold">you</span> learn.
          Remember more. Forget less. Outperform.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.9 }}
          className="mt-7 space-y-2.5"
        >
          <Link
            to="/auth?splash=1"
            className="relative w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[15px] overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: "0 10px 40px #00E5FF35, 0 0 80px #7C4DFF20",
            }}
          >
            <motion.div
              className="absolute inset-0"
              animate={{ background: ["linear-gradient(135deg, #00E5FF, #7C4DFF)", "linear-gradient(135deg, #7C4DFF, #00FF94)", "linear-gradient(135deg, #00FF94, #00E5FF)", "linear-gradient(135deg, #00E5FF, #7C4DFF)"] }}
              transition={{ duration: 6, repeat: Infinity }}
            />
            <span className="absolute inset-0 bg-white/30 -translate-x-full group-active:translate-x-full transition-transform duration-700" />
            <Rocket className="w-4 h-4 relative" />
            <span className="relative">Start Free — It's Instant</span>
            <ArrowRight className="w-4 h-4 relative" />
          </Link>
          <button
            className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-2xl font-medium text-[13px] backdrop-blur-md"
            style={{
              background: "rgba(255,255,255,0.03)",
              border: "1px solid rgba(255,255,255,0.08)",
              color: "#ffffffcc",
            }}
          >
            <Play className="w-3.5 h-3.5" style={{ color: "#00E5FF" }} />
            Watch 30s Demo
          </button>
        </motion.div>

        {/* Trust strip */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.1 }}
          className="mt-5 flex items-center justify-center gap-1.5"
        >
          <div className="flex">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="w-3 h-3 fill-current" style={{ color: "#FFD60A" }} />
            ))}
          </div>
          <span className="text-[10px] font-medium" style={{ color: "#ffffff70" }}>
            4.9 · 12,400+ aspirants
          </span>
        </motion.div>
      </motion.section>

      {/* LIVE STATS */}
      <section className="px-5 pb-10 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center mb-4"
        >
          <div className="inline-flex items-center gap-1.5 text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "#00E5FF" }}>
            <Activity className="w-3 h-3" />
            Live Right Now
          </div>
        </motion.div>
        <div className="grid grid-cols-3 gap-2.5">
          <StatCard icon={Sparkles} value={12847} label="Active Now" color="#00E5FF" delay={0} />
          <StatCard icon={Zap} value={847} label="Brain Updates/hr" color="#FFD60A" delay={0.1} />
          <StatCard icon={TrendingUp} value="+34%" label="Avg Boost" color="#00FF94" delay={0.2} />
        </div>
      </section>

      {/* FEATURE CARDS */}
      <section className="px-5 pb-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="mb-5"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1.5" style={{ color: "#7C4DFF" }}>
            Built for You
          </div>
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: "#ffffffee" }}>
            Five engines.
            <br />
            One unstoppable brain.
          </h2>
        </motion.div>

        <div className="space-y-3">
          {[
            { icon: Brain, title: "Memory Engine", desc: "Defeats the forgetting curve with AI-timed recalls", color: "#00E5FF", stat: "94% retention" },
            { icon: Target, title: "SureShot Predictor", desc: "Predicts exam questions with 8-factor model", color: "#FF3B30", stat: "12/15 hit rate" },
            { icon: Zap, title: "Auto-Pilot AI", desc: "Plans your day, rescues weak topics automatically", color: "#FFD60A", stat: "Zero planning" },
            { icon: BarChart3, title: "MyRank Live", desc: "Real-time rank prediction across India", color: "#00FF94", stat: "Updated hourly" },
            { icon: Shield, title: "Decay Shield", desc: "Catches forgotten topics before they hurt your rank", color: "#7C4DFF", stat: "Auto-protect" },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.08, duration: 0.5 }}
              whileTap={{ scale: 0.98 }}
              className="relative rounded-2xl p-4 overflow-hidden"
              style={{
                background: "rgba(255,255,255,0.025)",
                border: "1px solid rgba(255,255,255,0.06)",
                backdropFilter: "blur(20px)",
              }}
            >
              <div className="absolute inset-0 opacity-30 pointer-events-none"
                style={{ background: `radial-gradient(circle at 0% 50%, ${f.color}15, transparent 60%)` }} />
              <div className="relative flex items-center gap-3.5">
                <motion.div
                  whileHover={{ rotate: 10, scale: 1.1 }}
                  className="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0"
                  style={{
                    background: `${f.color}15`,
                    border: `1px solid ${f.color}30`,
                    boxShadow: `0 0 20px ${f.color}20`,
                  }}
                >
                  <f.icon className="w-5 h-5" style={{ color: f.color }} />
                </motion.div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="text-[14px] font-bold" style={{ color: "#ffffffee" }}>
                      {f.title}
                    </div>
                    <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: `${f.color}15`, color: f.color, border: `1px solid ${f.color}30` }}>
                      {f.stat}
                    </div>
                  </div>
                  <div className="text-[11px] mt-0.5 leading-snug" style={{ color: "#ffffff65" }}>
                    {f.desc}
                  </div>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="px-5 pb-10 relative z-10">
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="mb-5"
        >
          <div className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1.5" style={{ color: "#00FF94" }}>
            How it works
          </div>
          <h2 className="text-[22px] font-bold leading-tight" style={{ color: "#ffffffee" }}>
            Three steps to a sharper brain.
          </h2>
        </motion.div>

        <div className="relative">
          {/* Connecting line */}
          <div className="absolute left-[18px] top-2 bottom-2 w-px"
            style={{ background: "linear-gradient(to bottom, #00E5FF, #7C4DFF, #00FF94)" }} />

          {[
            { n: "01", t: "Tell ACRY your exam", d: "30 second onboarding. Pick UPSC, NEET, JEE, anything.", color: "#00E5FF" },
            { n: "02", t: "Practice & explore", d: "AI silently watches every signal — speed, accuracy, hesitation.", color: "#7C4DFF" },
            { n: "03", t: "Brain auto-revives", d: "Forgotten? ACRY brings it back at the exact right moment.", color: "#00FF94" },
          ].map((step, i) => (
            <motion.div
              key={step.n}
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-50px" }}
              transition={{ delay: i * 0.15, duration: 0.5 }}
              className="relative flex gap-4 pb-5 last:pb-0"
            >
              <motion.div
                whileInView={{ scale: [0, 1.2, 1] }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.15 + 0.2, duration: 0.5 }}
                className="relative w-9 h-9 rounded-full flex items-center justify-center shrink-0 z-10"
                style={{
                  background: "rgba(11,15,26,0.95)",
                  border: `2px solid ${step.color}`,
                  boxShadow: `0 0 16px ${step.color}50`,
                }}
              >
                <span className="text-[10px] font-bold" style={{ color: step.color }}>{step.n}</span>
              </motion.div>
              <div className="flex-1 pt-0.5">
                <div className="text-[14px] font-bold" style={{ color: "#ffffffee" }}>{step.t}</div>
                <div className="text-[12px] mt-0.5 leading-snug" style={{ color: "#ffffff65" }}>{step.d}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* TESTIMONIAL */}
      <section className="px-5 pb-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="relative rounded-3xl p-5 overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(0,229,255,0.06), rgba(124,77,255,0.06))",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <motion.div
            className="absolute -top-10 -right-10 w-32 h-32 rounded-full pointer-events-none"
            style={{ background: "#00E5FF20", filter: "blur(40px)" }}
            animate={{ scale: [1, 1.3, 1] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
          <div className="relative">
            <div className="flex items-center gap-2 mb-3">
              <div className="flex -space-x-2">
                {["#00E5FF", "#7C4DFF", "#00FF94", "#FFD60A"].map((c) => (
                  <div key={c} className="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{ background: `linear-gradient(135deg, ${c}, ${c}80)`, border: "2px solid #0B0F1A", color: "#0B0F1A" }}>
                    {c[1].toUpperCase()}
                  </div>
                ))}
              </div>
              <div className="flex">
                {[0, 1, 2, 3, 4].map((i) => (
                  <Star key={i} className="w-3 h-3 fill-current" style={{ color: "#FFD60A" }} />
                ))}
              </div>
            </div>
            <p className="text-[14px] leading-relaxed font-medium" style={{ color: "#ffffffee" }}>
              "Went from rank <span style={{ color: "#FF3B30" }}>8,247</span> to <span style={{ color: "#00FF94" }}>1,184</span> in 4 months. ACRY genuinely understands what I forget."
            </p>
            <div className="flex items-center justify-between mt-4">
              <div>
                <div className="text-[12px] font-bold" style={{ color: "#ffffffee" }}>Priya R.</div>
                <div className="text-[10px]" style={{ color: "#ffffff55" }}>NEET 2024 · AIIMS Delhi</div>
              </div>
              <div className="text-right">
                <div className="text-[18px] font-bold tabular-nums" style={{ color: "#00FF94" }}>+7,063</div>
                <div className="text-[9px] uppercase tracking-wider" style={{ color: "#ffffff45" }}>Rank jump</div>
              </div>
            </div>
          </div>
        </motion.div>
      </section>

      {/* FINAL CTA */}
      <section className="px-5 pb-10 relative z-10">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true }}
          className="relative rounded-3xl p-6 text-center overflow-hidden"
          style={{
            background: "linear-gradient(135deg, rgba(0,229,255,0.12), rgba(124,77,255,0.12), rgba(0,255,148,0.08))",
            border: "1px solid rgba(0,229,255,0.2)",
          }}
        >
          {/* Animated gradient bg */}
          <motion.div
            className="absolute inset-0 opacity-40 pointer-events-none"
            style={{ background: "radial-gradient(circle at 50% 50%, #00E5FF20, transparent 70%)" }}
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 4, repeat: Infinity }}
          />

          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity }}
            className="relative inline-flex w-12 h-12 rounded-2xl items-center justify-center mb-4"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              boxShadow: "0 0 30px #00E5FF50",
            }}
          >
            <Brain className="w-6 h-6" style={{ color: "#0B0F1A" }} />
          </motion.div>

          <div className="relative text-[22px] font-bold leading-tight mb-1.5" style={{ color: "#ffffffee" }}>
            Ready to outperform?
          </div>
          <div className="relative text-[12px] mb-5" style={{ color: "#ffffff70" }}>
            Free forever · No credit card · 60 second setup
          </div>
          <Link
            to="/auth?splash=1"
            className="relative w-full inline-flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-[14px] overflow-hidden group"
            style={{
              background: "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              color: "#0B0F1A",
              boxShadow: "0 10px 40px #00E5FF40",
            }}
          >
            <span className="absolute inset-0 bg-white/30 -translate-x-full group-active:translate-x-full transition-transform duration-700" />
            <Rocket className="w-4 h-4 relative" />
            <span className="relative">Build My Second Brain</span>
            <ArrowRight className="w-4 h-4 relative" />
          </Link>

          <div className="relative mt-4 flex items-center justify-center gap-3 text-[9px] uppercase tracking-wider" style={{ color: "#ffffff50" }}>
            <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> Private</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>SOC 2 ready</span>
            <span className="w-1 h-1 rounded-full bg-white/20" />
            <span>India hosted</span>
          </div>
        </motion.div>
      </section>

      {/* Footer */}
      <footer className="px-5 pb-10 pt-2 text-center relative z-10">
        <ACRYLogo variant="navbar" animate={false} className="justify-center mb-3 opacity-40" />
        <div className="text-[9px] uppercase tracking-[0.2em]" style={{ color: "#ffffff30" }}>
          © ACRY · AI for every exam
        </div>
      </footer>
    </div>
  );
};

export default MobileLanding;
