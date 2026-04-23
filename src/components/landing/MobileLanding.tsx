import { useEffect, useState } from "react";
import { motion, useMotionValue, animate, AnimatePresence } from "framer-motion";
import { Link } from "react-router-dom";
import { Rocket, Brain, Target, Zap, Shield, Star, ArrowRight, TrendingUp, Trophy, Activity } from "lucide-react";
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

// ─── Live activity rotator ───────────────────────────────
const ACTIVITIES = [
  { name: "Priya R.", action: "rank jumped", value: "+1,247", color: "#00FF94" },
  { name: "Arjun M.", action: "memory locked", value: "98%", color: "#00E5FF" },
  { name: "Riya S.", action: "streak hit", value: "47 days", color: "#FFD60A" },
  { name: "Karan P.", action: "predicted Q", value: "12/15", color: "#7C4DFF" },
];

const LiveTicker = () => {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % ACTIVITIES.length), 2400);
    return () => clearInterval(t);
  }, []);
  const a = ACTIVITIES[idx];
  return (
    <div
      className="flex items-center gap-2 rounded-full px-3 py-1 backdrop-blur-md"
      style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}
    >
      <span className="relative flex h-1.5 w-1.5 shrink-0">
        <span className="animate-ping absolute inline-flex h-full w-full rounded-full opacity-75" style={{ background: a.color }} />
        <span className="relative inline-flex rounded-full h-1.5 w-1.5" style={{ background: a.color }} />
      </span>
      <AnimatePresence mode="wait">
        <motion.div
          key={idx}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.25 }}
          className="flex items-center gap-1 text-[9px] whitespace-nowrap"
        >
          <span style={{ color: "#ffffff90" }} className="font-semibold">{a.name}</span>
          <span style={{ color: "#ffffff50" }}>{a.action}</span>
          <span style={{ color: a.color }} className="font-bold">{a.value}</span>
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Brain ring centerpiece ──────────────────────────────
const BrainRing = () => {
  const score = useCounter(94, 2.2, 0.4);
  const circ = 2 * Math.PI * 50;
  const offset = useMotionValue(circ);
  useEffect(() => {
    const c = animate(offset, circ * 0.06, { duration: 2.2, delay: 0.4, ease: "easeOut" });
    return c.stop;
  }, [circ, offset]);

  return (
    <div className="relative w-[150px] h-[150px] mx-auto">
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
            "0 0 30px #00E5FF20, 0 0 60px #7C4DFF15",
            "0 0 50px #00E5FF35, 0 0 100px #7C4DFF20",
            "0 0 30px #00E5FF20, 0 0 60px #7C4DFF15",
          ],
        }}
        transition={{ duration: 3.5, repeat: Infinity }}
      />

      {/* Glass disc */}
      <div
        className="absolute inset-2 rounded-full backdrop-blur-xl"
        style={{
          background: "radial-gradient(circle at 30% 30%, rgba(0,229,255,0.08), rgba(11,15,26,0.7))",
          border: "1px solid rgba(255,255,255,0.06)",
        }}
      />

      <svg viewBox="0 0 120 120" className="w-full h-full -rotate-90 relative">
        <circle cx="60" cy="60" r="50" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3" />
        <motion.circle
          cx="60" cy="60" r="50" fill="none"
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
            <feGaussianBlur stdDeviation="1.5" />
            <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
      </svg>

      {/* Center */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <Brain className="w-3.5 h-3.5 mb-1" style={{ color: "#00E5FF" }} />
        <div className="text-[28px] font-bold leading-none tabular-nums" style={{ color: "#ffffffee" }}>
          {score}<span className="text-[14px]" style={{ color: "#00E5FF" }}>%</span>
        </div>
        <div className="text-[7px] uppercase tracking-[0.2em] mt-1 font-semibold" style={{ color: "#ffffff50" }}>
          Brain Stability
        </div>
      </div>

      {/* Orbiting badges */}
      {[
        { angle: -45, delay: 1.4, icon: TrendingUp, color: "#00FF94", label: "+24%" },
        { angle: 90, delay: 1.6, icon: Shield, color: "#00E5FF", label: "Safe" },
        { angle: 225, delay: 1.8, icon: Trophy, color: "#FFD60A", label: "Top 3%" },
      ].map((b, i) => {
        const rad = (b.angle * Math.PI) / 180;
        const x = Math.cos(rad) * 88;
        const y = Math.sin(rad) * 88;
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
              className="flex items-center gap-1 rounded-full px-1.5 py-0.5 backdrop-blur-md whitespace-nowrap"
              style={{
                background: "rgba(11,15,26,0.85)",
                border: `1px solid ${b.color}40`,
                boxShadow: `0 0 10px ${b.color}30`,
              }}
            >
              <b.icon className="w-2 h-2" style={{ color: b.color }} />
              <span className="text-[8px] font-bold" style={{ color: b.color }}>{b.label}</span>
            </motion.div>
          </motion.div>
        );
      })}
    </div>
  );
};

// ─── Particle field ─────────────────────────────────────
const ParticleField = () => {
  const particles = Array.from({ length: 14 }, (_, i) => ({
    id: i,
    x: Math.random() * 100,
    y: Math.random() * 100,
    size: Math.random() * 1.2 + 0.4,
    duration: 6 + Math.random() * 8,
    delay: Math.random() * 4,
    color: ["#00E5FF", "#7C4DFF", "#00FF94"][i % 3],
  }));
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden z-0">
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

// ─── Main mobile landing ─────────────────────────────────
const MobileLanding = () => {
  const [showSplash, setShowSplash] = useState(false);
  const [ready, setReady] = useState(false);

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

  const features = [
    { icon: Brain, color: "#00E5FF" },
    { icon: Target, color: "#FF3B30" },
    { icon: Zap, color: "#FFD60A" },
    { icon: Shield, color: "#7C4DFF" },
  ];

  return (
    <div
      className="fixed inset-0 z-0 flex flex-col overflow-hidden"
      style={{
        background: "linear-gradient(180deg, #060912 0%, #0B0F1A 50%, #0F1424 100%)",
      }}
    >
      <ParticleField />

      {/* Ambient orbs */}
      <div className="pointer-events-none absolute inset-0 z-0">
        <motion.div
          className="absolute top-[-15%] left-[-25%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, #00E5FF20, transparent 70%)", filter: "blur(80px)" }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 12, repeat: Infinity }}
        />
        <motion.div
          className="absolute bottom-[5%] right-[-25%] w-[400px] h-[400px] rounded-full"
          style={{ background: "radial-gradient(circle, #7C4DFF20, transparent 70%)", filter: "blur(80px)" }}
          animate={{ x: [0, -30, 0], y: [0, -20, 0] }}
          transition={{ duration: 14, repeat: Infinity }}
        />
      </div>

      {/* ─── HERO (centered, no scroll) ─── */}
      <main
        className="relative z-10 flex-1 flex flex-col items-center justify-center px-6 min-h-0"
        style={{ paddingTop: "max(env(safe-area-inset-top, 0px), 12px)" }}
      >
        {/* Live ticker above brain ring */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.4 }}
          className="mb-4"
        >
          <LiveTicker />
        </motion.div>

        {/* Brain ring */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
        >
          <BrainRing />
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="text-center text-[26px] leading-[1.05] font-bold tracking-tight mt-5"
        >
          <span style={{ color: "#ffffffee" }}>Your AI Second Brain</span>
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

        {/* Subhead */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="mt-2 text-center text-[12px] leading-snug px-4"
          style={{ color: "#ffffff70" }}
        >
          Remember more · Forget less · Outperform
        </motion.p>

        {/* Feature dots row */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="flex items-center gap-2.5 mt-4"
        >
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.8 + i * 0.08, type: "spring", bounce: 0.5 }}
              className="w-9 h-9 rounded-xl flex items-center justify-center backdrop-blur-md"
              style={{
                background: `${f.color}12`,
                border: `1px solid ${f.color}30`,
                boxShadow: `0 0 14px ${f.color}25`,
              }}
            >
              <f.icon className="w-4 h-4" style={{ color: f.color }} />
            </motion.div>
          ))}
        </motion.div>

        {/* Inline live stats */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.0 }}
          className="flex items-center gap-3 mt-4 text-[10px]"
        >
          <div className="flex items-center gap-1" style={{ color: "#ffffff70" }}>
            <Activity className="w-2.5 h-2.5" style={{ color: "#00FF94" }} />
            <span className="font-semibold tabular-nums" style={{ color: "#ffffffdd" }}>12,847</span>
            <span style={{ color: "#ffffff45" }}>active</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <div className="flex items-center gap-1" style={{ color: "#ffffff70" }}>
            <TrendingUp className="w-2.5 h-2.5" style={{ color: "#FFD60A" }} />
            <span className="font-semibold tabular-nums" style={{ color: "#ffffffdd" }}>+34%</span>
            <span style={{ color: "#ffffff45" }}>boost</span>
          </div>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <div className="flex items-center gap-0.5">
            {[0, 1, 2, 3, 4].map((i) => (
              <Star key={i} className="w-2.5 h-2.5 fill-current" style={{ color: "#FFD60A" }} />
            ))}
          </div>
        </motion.div>
      </main>

      {/* ─── BOTTOM CTA (fixed, no scroll) ─── */}
      <motion.div
        initial={{ y: 30, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 1.1, duration: 0.5 }}
        className="relative z-10 shrink-0 px-5 pt-2"
        style={{ paddingBottom: "max(env(safe-area-inset-bottom, 0px), 16px)" }}
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
            animate={{
              background: [
                "linear-gradient(135deg, #00E5FF, #7C4DFF)",
                "linear-gradient(135deg, #7C4DFF, #00FF94)",
                "linear-gradient(135deg, #00FF94, #00E5FF)",
                "linear-gradient(135deg, #00E5FF, #7C4DFF)",
              ],
            }}
            transition={{ duration: 6, repeat: Infinity }}
          />
          <span className="absolute inset-0 bg-white/30 -translate-x-full group-active:translate-x-full transition-transform duration-700" />
          <Rocket className="w-4 h-4 relative" />
          <span className="relative">Start Free — It's Instant</span>
          <ArrowRight className="w-4 h-4 relative" />
        </Link>

        <div className="mt-2.5 flex items-center justify-center gap-2 text-[9px] uppercase tracking-wider" style={{ color: "#ffffff45" }}>
          <span className="flex items-center gap-1"><Shield className="w-2.5 h-2.5" /> Free forever</span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span>No card</span>
          <span className="w-1 h-1 rounded-full bg-white/15" />
          <span>60s setup</span>
        </div>
      </motion.div>
    </div>
  );
};

export default MobileLanding;
