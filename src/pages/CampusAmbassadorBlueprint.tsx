import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useScroll, useTransform } from "framer-motion";
import {
  Rocket, Sparkles, Shield, Trophy, Users, GraduationCap, Award, Network,
  Briefcase, Star, MessageCircle, ArrowRight, Check, ChevronDown, MapPin,
  Calendar, Brain, Mic, Globe, Send, User, Phone, Mail, School, BookOpen,
  Instagram, Linkedin, Heart, Crown, Target, Zap, Play,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { z } from "zod";

/* ═════════════════════════════════════════════════════════════════════
   ACRY.ai CAMPUS AMBASSADOR — Midnight Indigo Edition
   Palette: #0a0a1a · #141432 · #1e1e5a · #4f46e5
   Type:    Space Grotesk (display) · DM Sans (body)
   Layout:  Hero + Card Grid · user-focused, conversion-led
   ═════════════════════════════════════════════════════════════════════ */

const INDIGO = {
  base: "#0a0a1a",
  surface: "#141432",
  mid: "#1e1e5a",
  accent: "#4f46e5",
  accentSoft: "#6366f1",
  glow: "#818cf8",
};

/* Load DM Sans + Space Grotesk once */
const useFonts = () => {
  useEffect(() => {
    if (document.getElementById("ca-fonts")) return;
    const l = document.createElement("link");
    l.id = "ca-fonts";
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&display=swap";
    document.head.appendChild(l);
  }, []);
};

const fontHead = { fontFamily: "'Space Grotesk', system-ui, sans-serif" };
const fontBody = { fontFamily: "'DM Sans', system-ui, sans-serif" };

/* ─── Atmospheric backdrop: drifting indigo orbs + soft grid ────────── */
const Atmosphere = () => (
  <div className="fixed inset-0 pointer-events-none overflow-hidden" style={{ background: INDIGO.base, zIndex: 0 }}>
    {/* Grid */}
    <div
      className="absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage:
          "linear-gradient(rgba(99,102,241,1) 1px, transparent 1px), linear-gradient(90deg, rgba(99,102,241,1) 1px, transparent 1px)",
        backgroundSize: "72px 72px",
        maskImage: "radial-gradient(ellipse at center, black 30%, transparent 75%)",
      }}
    />
    {/* Orbs */}
    <motion.div
      animate={{ x: [0, 60, -30, 0], y: [0, -40, 30, 0] }}
      transition={{ duration: 26, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-40 -left-40 w-[44rem] h-[44rem] rounded-full"
      style={{ background: `radial-gradient(circle, ${INDIGO.accent}33, transparent 60%)`, filter: "blur(60px)" }}
    />
    <motion.div
      animate={{ x: [0, -70, 40, 0], y: [0, 50, -30, 0] }}
      transition={{ duration: 30, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-1/3 -right-40 w-[40rem] h-[40rem] rounded-full"
      style={{ background: `radial-gradient(circle, ${INDIGO.mid}55, transparent 60%)`, filter: "blur(60px)" }}
    />
    <motion.div
      animate={{ x: [0, 40, -50, 0], y: [0, 50, -60, 0] }}
      transition={{ duration: 34, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-40 left-1/3 w-[36rem] h-[36rem] rounded-full"
      style={{ background: `radial-gradient(circle, ${INDIGO.glow}25, transparent 60%)`, filter: "blur(60px)" }}
    />
    {/* Top vignette */}
    <div
      className="absolute inset-x-0 top-0 h-[60vh]"
      style={{ background: `linear-gradient(to bottom, ${INDIGO.surface}80, transparent)` }}
    />
  </div>
);

/* Cursor light follow (desktop only) */
const CursorLight = () => {
  const x = useMotionValue(-9999);
  const y = useMotionValue(-9999);
  const sx = useSpring(x, { stiffness: 80, damping: 20 });
  const sy = useSpring(y, { stiffness: 80, damping: 20 });
  useEffect(() => {
    if (window.matchMedia("(pointer: coarse)").matches) return;
    const on = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", on, { passive: true });
    return () => window.removeEventListener("mousemove", on);
  }, [x, y]);
  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-[1] hidden md:block"
      style={{
        x: sx, y: sy, translateX: "-50%", translateY: "-50%",
        width: 520, height: 520,
        background: `radial-gradient(circle, ${INDIGO.accent}1f, transparent 65%)`,
        filter: "blur(40px)",
      }}
    />
  );
};

/* Animated count-up */
const Counter = ({ end, suffix = "" }: { end: number; suffix?: string }) => {
  const [v, setV] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  useEffect(() => {
    if (!inView) return;
    const dur = 1800, t0 = performance.now();
    let id = 0;
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / dur);
      setV(Math.floor(end * (1 - Math.pow(1 - p, 3))));
      if (p < 1) id = requestAnimationFrame(step);
    };
    id = requestAnimationFrame(step);
    return () => cancelAnimationFrame(id);
  }, [inView, end]);
  return <span ref={ref}>{v.toLocaleString()}{suffix}</span>;
};

/* Magnetic CTA */
const Magnetic = ({ children, strength = 0.22 }: { children: React.ReactNode; strength?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 200, damping: 18 });
  const y = useSpring(0, { stiffness: 200, damping: 18 });
  return (
    <motion.div
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current!.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onMouseLeave={() => { x.set(0); y.set(0); }}
      style={{ x, y }}
      className="inline-block"
    >
      {children}
    </motion.div>
  );
};

/* Primary CTA button */
const PrimaryCTA = ({ children, onClick, large = false }: { children: React.ReactNode; onClick: () => void; large?: boolean }) => (
  <Magnetic>
    <button
      onClick={onClick}
      className={`group relative inline-flex items-center justify-center gap-2 rounded-full font-semibold text-white overflow-hidden transition-transform active:scale-[0.98] ${
        large ? "px-8 py-4 text-base" : "px-6 py-3 text-sm"
      }`}
      style={{
        background: `linear-gradient(135deg, ${INDIGO.accent} 0%, ${INDIGO.accentSoft} 100%)`,
        boxShadow: `0 10px 40px ${INDIGO.accent}66, inset 0 1px 0 rgba(255,255,255,0.2)`,
        ...fontBody,
      }}
    >
      <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
      <span className="relative z-10 flex items-center gap-2">{children}</span>
    </button>
  </Magnetic>
);

/* Glass surface */
const Card = ({ children, className = "", interactive = false }: { children: React.ReactNode; className?: string; interactive?: boolean }) => (
  <div
    className={`relative rounded-2xl border backdrop-blur-xl ${interactive ? "transition-all duration-300 hover:-translate-y-1" : ""} ${className}`}
    style={{
      background: `linear-gradient(180deg, ${INDIGO.surface}b3, ${INDIGO.surface}66)`,
      borderColor: `${INDIGO.accent}26`,
      boxShadow: `0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px ${INDIGO.accent}40`,
    }}
  >
    {children}
  </div>
);

/* Section wrapper */
const Section = ({ children, id, className = "" }: { children: React.ReactNode; id?: string; className?: string }) => (
  <section id={id} className={`relative py-20 md:py-28 px-6 ${className}`}>
    <div className="max-w-6xl mx-auto relative z-10">{children}</div>
  </section>
);

const Eyebrow = ({ children }: { children: React.ReactNode }) => (
  <div
    className="inline-flex items-center gap-2 px-3 py-1 rounded-full mb-5"
    style={{ background: `${INDIGO.accent}1a`, border: `1px solid ${INDIGO.accent}40`, ...fontBody }}
  >
    <span className="w-1.5 h-1.5 rounded-full" style={{ background: INDIGO.glow }} />
    <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: INDIGO.glow }}>{children}</span>
  </div>
);

const Heading = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <h2
    className={`text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white leading-[1.05] ${className}`}
    style={fontHead}
  >
    {children}
  </h2>
);

/* ═════════════════════════════════════════════════════════════════════
   NAVBAR
   ═════════════════════════════════════════════════════════════════════ */
const Nav = ({ scrollToForm }: { scrollToForm: () => void }) => {
  const [s, setS] = useState(false);
  useEffect(() => {
    const on = () => setS(window.scrollY > 24);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <nav
      className={`fixed top-0 inset-x-0 z-50 transition-all duration-300 ${s ? "py-2.5" : "py-4"}`}
      style={s ? { background: `${INDIGO.base}cc`, backdropFilter: "blur(20px)", borderBottom: `1px solid ${INDIGO.accent}1a` } : {}}
    >
      <div className="max-w-6xl mx-auto px-6 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white text-base"
            style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`, boxShadow: `0 6px 20px ${INDIGO.accent}66`, ...fontHead }}
          >A</div>
          <div className="leading-tight">
            <div className="text-white font-semibold text-sm" style={fontHead}>ACRY.ai</div>
            <div className="text-[10px] tracking-[0.18em] uppercase" style={{ color: INDIGO.glow, ...fontBody }}>Ambassadors</div>
          </div>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm text-white/70" style={fontBody}>
          <a href="#benefits" className="hover:text-white transition-colors">Benefits</a>
          <a href="#role" className="hover:text-white transition-colors">The Role</a>
          <a href="#community" className="hover:text-white transition-colors">Community</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <PrimaryCTA onClick={scrollToForm}><Rocket className="w-3.5 h-3.5" /> Apply</PrimaryCTA>
      </div>
    </nav>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   HERO — centered, ultra-clean, conversion-focused
   ═════════════════════════════════════════════════════════════════════ */
const TRUST_BADGES = [
  { icon: Brain, label: "AI Workshops" },
  { icon: Users, label: "Student Community" },
  { icon: Crown, label: "Leadership Program" },
  { icon: Zap, label: "Future Skills" },
];

const FLOATING_CARDS = [
  { icon: Sparkles, label: "Live AI Lab", sub: "Hands-on", className: "hidden md:flex top-[14%] left-[3%]", delay: 0.2, float: [0, -10, 0] },
  { icon: Trophy, label: "Top 1% Cohort", sub: "Batch 2026", className: "hidden lg:flex top-[22%] right-[4%]", delay: 0.35, float: [0, 12, 0] },
  { icon: Network, label: "50K+ Network", sub: "120+ cities", className: "hidden md:flex bottom-[18%] left-[5%]", delay: 0.5, float: [0, 10, 0] },
  { icon: Award, label: "Certified", sub: "ACRY x Industry", className: "hidden lg:flex bottom-[24%] right-[5%]", delay: 0.65, float: [0, -12, 0] },
];

const Hero = ({ scrollToForm }: { scrollToForm: () => void }) => {
  const { scrollY } = useScroll();
  const y = useTransform(scrollY, [0, 600], [0, -80]);
  const op = useTransform(scrollY, [0, 500], [1, 0.4]);
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="relative min-h-[100dvh] flex items-center justify-center px-6 pt-32 pb-24 overflow-hidden">
      {/* ───── AI-themed glowing backdrop ───── */}
      <div aria-hidden className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[120%] h-[120%]"
          style={{
            background: `radial-gradient(ellipse 60% 50% at 50% 40%, ${INDIGO.accent}33, transparent 60%), radial-gradient(circle at 20% 80%, ${INDIGO.glow}22, transparent 50%), radial-gradient(circle at 80% 20%, ${INDIGO.accentSoft}26, transparent 55%)`,
            filter: "blur(20px)",
          }}
        />
        {/* Grid mesh */}
        <div
          className="absolute inset-0 opacity-[0.07]"
          style={{
            backgroundImage: `linear-gradient(${INDIGO.glow} 1px, transparent 1px), linear-gradient(90deg, ${INDIGO.glow} 1px, transparent 1px)`,
            backgroundSize: "56px 56px",
            maskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent 75%)",
            WebkitMaskImage: "radial-gradient(ellipse 70% 60% at 50% 50%, black, transparent 75%)",
          }}
        />
        {/* Orbiting AI nodes */}
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            className="absolute top-1/2 left-1/2 rounded-full"
            style={{
              width: 6 + i * 2,
              height: 6 + i * 2,
              background: INDIGO.glow,
              boxShadow: `0 0 18px ${INDIGO.accent}`,
            }}
            animate={{
              x: [Math.cos(i) * (140 + i * 40), Math.cos(i + Math.PI) * (140 + i * 40), Math.cos(i) * (140 + i * 40)],
              y: [Math.sin(i) * (140 + i * 40), Math.sin(i + Math.PI) * (140 + i * 40), Math.sin(i) * (140 + i * 40)],
              opacity: [0.4, 1, 0.4],
            }}
            transition={{ duration: 14 + i * 3, repeat: Infinity, ease: "easeInOut" }}
          />
        ))}
      </div>

      {/* ───── Floating UI cards ───── */}
      {FLOATING_CARDS.map((c, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, y: 20, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.8, delay: c.delay, ease: [0.22, 1, 0.36, 1] }}
          className={`absolute z-10 ${c.className}`}
        >
          <motion.div
            animate={{ y: c.float }}
            transition={{ duration: 5 + i, repeat: Infinity, ease: "easeInOut" }}
            className="flex items-center gap-3 px-4 py-3 rounded-2xl backdrop-blur-xl"
            style={{
              background: `linear-gradient(135deg, ${INDIGO.surface}cc, ${INDIGO.base}cc)`,
              border: `1px solid ${INDIGO.accent}40`,
              boxShadow: `0 20px 60px -20px ${INDIGO.accent}55, inset 0 1px 0 ${INDIGO.glow}22`,
            }}
          >
            <div
              className="w-9 h-9 rounded-xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.accentSoft})`,
                boxShadow: `0 0 18px ${INDIGO.accent}88`,
              }}
            >
              <c.icon className="w-4 h-4 text-white" />
            </div>
            <div className="text-left">
              <div className="text-[13px] font-semibold text-white whitespace-nowrap" style={fontHead}>{c.label}</div>
              <div className="text-[10px] uppercase tracking-[0.15em] text-white/55" style={fontBody}>{c.sub}</div>
            </div>
          </motion.div>
        </motion.div>
      ))}

      <motion.div style={{ y, opacity: op }} className="relative z-20 max-w-4xl mx-auto text-center">
        {/* Live status pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full mb-8"
          style={{ background: `${INDIGO.accent}1a`, border: `1px solid ${INDIGO.accent}40` }}
        >
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative rounded-full bg-emerald-400 w-2 h-2" />
          </span>
          <span className="text-[11px] font-semibold tracking-[0.18em] uppercase" style={{ color: INDIGO.glow, ...fontBody }}>
            Batch 2026 · Applications Open
          </span>
        </motion.div>

        {/* Headline */}
        <motion.h1
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
          className="relative text-[2.5rem] sm:text-5xl md:text-6xl lg:text-[4.75rem] font-bold tracking-[-0.035em] leading-[1.04] text-white mb-6"
          style={fontHead}
        >
          <span
            aria-hidden
            className="absolute left-1/2 -translate-x-1/2 -top-10 w-[80%] h-[120%] pointer-events-none opacity-70"
            style={{
              background: `radial-gradient(ellipse at center, ${INDIGO.accent}33, transparent 65%)`,
              filter: "blur(50px)",
            }}
          />
          <span
            className="bg-clip-text text-transparent"
            style={{ backgroundImage: `linear-gradient(180deg, #ffffff 0%, #e0e7ff 60%, ${INDIGO.glow} 100%)` }}
          >
            Become an{" "}
          </span>
          <span className="relative inline-block">
            <span
              className="bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(110deg, ${INDIGO.glow} 0%, #ffffff 30%, ${INDIGO.accentSoft} 60%, ${INDIGO.glow} 100%)`,
                backgroundSize: "250% 100%",
                WebkitBackgroundClip: "text",
                animation: "ca-hero-shimmer 5.5s linear infinite",
              }}
            >
              ACRY AI
            </span>
            <motion.span
              aria-hidden
              className="absolute -inset-3 rounded-full pointer-events-none -z-10"
              animate={{ opacity: [0.4, 0.85, 0.4] }}
              transition={{ duration: 3, repeat: Infinity }}
              style={{
                background: `radial-gradient(circle, ${INDIGO.accent}66, transparent 70%)`,
                filter: "blur(20px)",
              }}
            />
          </span>
          <br />
          <span className="relative inline-block">
            <span
              className="relative bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(110deg, #ffffff 0%, ${INDIGO.accentSoft} 35%, ${INDIGO.glow} 65%, #ffffff 100%)`,
                backgroundSize: "300% 100%",
                WebkitBackgroundClip: "text",
                animation: "ca-hero-shimmer 6s linear infinite",
              }}
            >
              Campus Ambassador
            </span>
            <motion.span
              aria-hidden
              initial={{ scaleX: 0, opacity: 0 }}
              animate={{ scaleX: 1, opacity: 1 }}
              transition={{ duration: 1.2, delay: 0.7, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -bottom-2 sm:-bottom-3 left-0 right-0 h-[3px] sm:h-[4px] origin-left rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${INDIGO.accent}, ${INDIGO.glow}, ${INDIGO.accent}, transparent)`,
                boxShadow: `0 0 22px ${INDIGO.accent}, 0 0 40px ${INDIGO.glow}66`,
              }}
            />
            <motion.span
              aria-hidden
              className="absolute -bottom-2 sm:-bottom-3 w-3 h-3 rounded-full"
              animate={{ left: ["-2%", "100%"] }}
              transition={{ duration: 3.2, repeat: Infinity, ease: "easeInOut", delay: 1.6 }}
              style={{
                background: "#ffffff",
                boxShadow: `0 0 14px #ffffff, 0 0 28px ${INDIGO.glow}`,
                transform: "translateY(-35%)",
              }}
            />
          </span>

          <style>{`
            @keyframes ca-hero-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
          `}</style>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10 leading-relaxed"
          style={fontBody}
        >
          Lead the AI revolution in your campus and become part of India's fastest-growing
          AI student network.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <PrimaryCTA onClick={scrollToForm} large>
            <Rocket className="w-4 h-4" /> Apply Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </PrimaryCTA>
          <button
            onClick={() => setVideoOpen(true)}
            className="group inline-flex items-center gap-3 px-6 py-4 rounded-full text-white/85 hover:text-white border border-white/15 hover:border-white/35 transition-all text-sm font-medium backdrop-blur-sm"
            style={{ background: `${INDIGO.surface}55`, ...fontBody }}
          >
            <span
              className="relative flex items-center justify-center w-7 h-7 rounded-full"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.accentSoft})`,
                boxShadow: `0 0 14px ${INDIGO.accent}88`,
              }}
            >
              <Play className="w-3 h-3 text-white fill-white ml-0.5" />
              <span
                className="absolute inset-0 rounded-full animate-ping"
                style={{ background: `${INDIGO.accent}55` }}
              />
            </span>
            Watch Intro Video
          </button>
        </motion.div>

        {/* Trust badges */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="mt-12 flex flex-wrap items-center justify-center gap-2.5 sm:gap-3"
        >
          {TRUST_BADGES.map((b, i) => (
            <motion.div
              key={b.label}
              whileHover={{ y: -3, scale: 1.04 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full backdrop-blur-md"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.surface}aa, ${INDIGO.base}aa)`,
                border: `1px solid ${INDIGO.accent}33`,
                boxShadow: `0 8px 24px -10px ${INDIGO.accent}55`,
              }}
            >
              <span
                className="flex items-center justify-center w-6 h-6 rounded-full"
                style={{ background: `${INDIGO.accent}33`, color: INDIGO.glow }}
              >
                <b.icon className="w-3.5 h-3.5" />
              </span>
              <span className="text-[12px] font-semibold text-white/85 tracking-wide" style={fontBody}>
                {b.label}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </motion.div>

      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/35 flex flex-col items-center gap-1 z-20"
      >
        <ChevronDown className="w-5 h-5" />
      </motion.div>

      {/* ───── Intro Video Modal ───── */}
      <AnimatePresence>
        {videoOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setVideoOpen(false)}
            className="fixed inset-0 z-[100] flex items-center justify-center p-4 backdrop-blur-lg"
            style={{ background: `${INDIGO.base}d9` }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.92, opacity: 0, y: 20 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-4xl aspect-video rounded-2xl overflow-hidden"
              style={{
                border: `1px solid ${INDIGO.accent}55`,
                boxShadow: `0 30px 80px -20px ${INDIGO.accent}88`,
              }}
            >
              <button
                onClick={() => setVideoOpen(false)}
                className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center text-white/80 hover:text-white"
                style={{ background: `${INDIGO.base}cc`, border: `1px solid ${INDIGO.accent}55` }}
                aria-label="Close video"
              >
                ✕
              </button>
              <iframe
                src="https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1"
                title="ACRY AI Campus Ambassador Intro"
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                className="w-full h-full"
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   TRUSTED CAMPUSES MARQUEE
   ═════════════════════════════════════════════════════════════════════ */
const Trusted = () => {
  const items = ["IIT Delhi", "BITS Pilani", "NIT Trichy", "VIT Vellore", "IIM Bangalore", "DTU", "SRM", "Manipal", "Christ", "Amity", "IIIT Hyderabad"];
  return (
    <div className="relative py-12 overflow-hidden border-y" style={{ borderColor: `${INDIGO.accent}1a` }}>
      <div className="absolute inset-y-0 left-0 w-24 z-10" style={{ background: `linear-gradient(to right, ${INDIGO.base}, transparent)` }} />
      <div className="absolute inset-y-0 right-0 w-24 z-10" style={{ background: `linear-gradient(to left, ${INDIGO.base}, transparent)` }} />
      <div className="text-center text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold mb-6" style={fontBody}>
        Ambassadors from across India
      </div>
      <div className="flex overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 36, repeat: Infinity, ease: "linear" }}
          className="flex gap-14 whitespace-nowrap pr-14"
        >
          {[...items, ...items, ...items].map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-white/45" style={fontHead}>
              <GraduationCap className="w-4 h-4" style={{ color: INDIGO.glow }} />
              <span className="text-sm font-semibold tracking-wide">{c}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   BENEFITS — Card Grid (the user's core value section)
   ═════════════════════════════════════════════════════════════════════ */
const Benefits = () => {
  const items = [
    { icon: Brain, title: "AI Training", desc: "Hands-on workshops in prompt engineering, applied ML & modern AI tools." },
    { icon: Crown, title: "Leadership Identity", desc: "Real responsibility on your campus — résumé-defining, not symbolic." },
    { icon: Award, title: "Official Certificate", desc: "Verified completion & performance certificate recognised by recruiters." },
    { icon: Network, title: "National Network", desc: "Connect with 10,000+ ambassadors, founders & industry mentors." },
    { icon: Briefcase, title: "Internship Pipeline", desc: "Top performers unlock paid internships & full-time roles at ACRY AI." },
    { icon: Sparkles, title: "Founder Mentorship", desc: "Direct 1:1 sessions with our founders and senior leadership." },
    { icon: Mic, title: "Lifetime Workshops", desc: "Free lifetime access to all premium ACRY AI workshops & summits." },
    { icon: Star, title: "Personal Brand", desc: "Build your authority as the AI voice of your campus & city." },
  ];
  return (
    <Section id="benefits">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <Eyebrow>What You Get</Eyebrow>
        <Heading>Eight reasons students join.</Heading>
        <p className="mt-5 text-white/60 text-lg" style={fontBody}>
          Not a sticker on your CV — a 6-month leadership identity built on AI, community, and real-world impact.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {items.map((b, i) => (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-60px" }}
            transition={{ duration: 0.5, delay: (i % 4) * 0.06 }}
          >
            <Card interactive className="p-6 h-full group">
              <div
                className="w-11 h-11 rounded-xl flex items-center justify-center mb-5 transition-transform group-hover:scale-110"
                style={{ background: `linear-gradient(135deg, ${INDIGO.accent}33, ${INDIGO.mid}55)`, border: `1px solid ${INDIGO.accent}40` }}
              >
                <b.icon className="w-5 h-5" style={{ color: INDIGO.glow }} />
              </div>
              <h4 className="font-semibold text-white text-base mb-1.5" style={fontHead}>{b.title}</h4>
              <p className="text-sm text-white/55 leading-relaxed" style={fontBody}>{b.desc}</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   THE ROLE — what you'll do
   ═════════════════════════════════════════════════════════════════════ */
const Role = () => {
  const items = [
    { icon: Mic, title: "Run AI Workshops", desc: "Host flagship workshops on your campus — fully supported by ACRY." },
    { icon: Users, title: "Grow Community", desc: "Build your own AI club, study circles & ambassador network." },
    { icon: Calendar, title: "Conduct Events", desc: "Host hackathons, meetups, demo days & AI challenges." },
    { icon: Sparkles, title: "Create Content", desc: "Build a personal brand through reels, posts & tutorials." },
    { icon: Globe, title: "Spread AI Awareness", desc: "Become the trusted voice of AI in your campus and city." },
    { icon: Target, title: "Bridge to Careers", desc: "Connect students to real-world AI tools, jobs and opportunities." },
  ];
  return (
    <Section id="role">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <Eyebrow>The Role</Eyebrow>
        <Heading>What you'll actually do.</Heading>
        <p className="mt-5 text-white/60 text-lg" style={fontBody}>A clear playbook, not vague tasks. ~4–6 hours a week.</p>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((it, i) => (
          <motion.div
            key={it.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.06 }}
          >
            <Card interactive className="p-6 h-full">
              <div className="flex items-start gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${INDIGO.accent}33, ${INDIGO.mid}55)`, border: `1px solid ${INDIGO.accent}40` }}
                >
                  <it.icon className="w-5 h-5" style={{ color: INDIGO.glow }} />
                </div>
                <div>
                  <div className="text-[10px] font-bold tracking-[0.18em] uppercase mb-1" style={{ color: INDIGO.glow, ...fontBody }}>
                    Step {String(i + 1).padStart(2, "0")}
                  </div>
                  <h4 className="text-base font-semibold text-white mb-1.5" style={fontHead}>{it.title}</h4>
                  <p className="text-sm text-white/55 leading-relaxed" style={fontBody}>{it.desc}</p>
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   METRICS
   ═════════════════════════════════════════════════════════════════════ */
const Metrics = () => {
  const m = [
    { v: 50000, s: "+", label: "Students Joined" },
    { v: 120, s: "+", label: "Cities" },
    { v: 850, s: "+", label: "Workshops" },
    { v: 320, s: "+", label: "Communities" },
  ];
  return (
    <Section className="py-16 md:py-20">
      <Card className="p-10 md:p-14">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
          {m.map((x) => (
            <div key={x.label}>
              <div
                className="text-4xl md:text-6xl font-bold tracking-tight mb-2"
                style={{
                  background: `linear-gradient(135deg, #fff, ${INDIGO.glow})`,
                  WebkitBackgroundClip: "text",
                  WebkitTextFillColor: "transparent",
                  ...fontHead,
                }}
              >
                <Counter end={x.v} suffix={x.s} />
              </div>
              <div className="text-xs uppercase tracking-[0.2em] text-white/50 font-semibold" style={fontBody}>{x.label}</div>
            </div>
          ))}
        </div>
      </Card>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   TESTIMONIALS
   ═════════════════════════════════════════════════════════════════════ */
const Testimonials = () => {
  const t = [
    { name: "Aarav Sharma", role: "IIT Delhi", text: "From curious student to leading 8 AI workshops in 4 months. ACRY made me the person I wanted to be." },
    { name: "Ishita Verma", role: "BITS Pilani", text: "I built a 600-member AI community on my campus. The mentorship and brand backing is unreal." },
    { name: "Rohan Mehta", role: "NIT Trichy", text: "Not just an ambassador program — a launchpad. Got my AI internship through this network." },
    { name: "Priya Iyer", role: "VIT Vellore", text: "Founder mentorship sessions changed how I think about AI, leadership and my career." },
    { name: "Karan Singh", role: "DTU", text: "Best decision of my college life. Period." },
    { name: "Ananya Kapoor", role: "SRM", text: "I had zero leadership experience. Now I run my own AI club and speak at events." },
  ];
  return (
    <Section id="community">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <Eyebrow>Community</Eyebrow>
        <Heading>Voices from the network.</Heading>
      </div>
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {t.map((x, i) => (
          <motion.div
            key={x.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
          >
            <Card interactive className="p-6 h-full">
              <div className="flex items-center gap-3 mb-4">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold"
                  style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`, ...fontHead }}
                >
                  {x.name[0]}
                </div>
                <div>
                  <div className="text-white font-semibold text-sm" style={fontHead}>{x.name}</div>
                  <div className="text-xs text-white/45" style={fontBody}>Ambassador · {x.role}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, k) => <Star key={k} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-sm text-white/70 leading-relaxed" style={fontBody}>"{x.text}"</p>
            </Card>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   PATH — 4-step journey
   ═════════════════════════════════════════════════════════════════════ */
const Path = () => {
  const steps = [
    { icon: Send, title: "Apply", desc: "90-second form. No fee." },
    { icon: Users, title: "Onboard", desc: "Join the ambassador network & community." },
    { icon: Brain, title: "Train", desc: "AI bootcamp, mentorship & resources." },
    { icon: Crown, title: "Lead", desc: "Host events, build community, earn recognition." },
  ];
  return (
    <Section id="path">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <Eyebrow>The Path</Eyebrow>
        <Heading>Four steps to AI leadership.</Heading>
      </div>
      <div className="grid md:grid-cols-4 gap-4 relative">
        <div
          className="hidden md:block absolute top-12 left-[12%] right-[12%] h-px"
          style={{ background: `linear-gradient(90deg, transparent, ${INDIGO.accent}80, transparent)` }}
        />
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            className="relative text-center"
          >
            <div
              className="relative mx-auto w-16 h-16 rounded-2xl flex items-center justify-center mb-5"
              style={{
                background: INDIGO.surface,
                border: `1px solid ${INDIGO.accent}66`,
                boxShadow: `0 10px 30px -10px ${INDIGO.accent}80`,
              }}
            >
              <s.icon className="w-6 h-6" style={{ color: INDIGO.glow }} />
              <div
                className="absolute -top-2 -right-2 w-6 h-6 rounded-full text-[10px] font-bold flex items-center justify-center text-white"
                style={{ background: INDIGO.accent, ...fontHead }}
              >
                {i + 1}
              </div>
            </div>
            <h4 className="text-base font-semibold text-white mb-1" style={fontHead}>{s.title}</h4>
            <p className="text-sm text-white/55" style={fontBody}>{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   APPLICATION FORM
   ═════════════════════════════════════════════════════════════════════ */
const schema = z.object({
  full_name: z.string().trim().min(2, "Name too short").max(100),
  phone: z.string().trim().regex(/^[+]?[\d\s-]{10,15}$/, "Invalid phone"),
  email: z.string().trim().email("Invalid email").max(255),
  college: z.string().trim().min(2).max(150),
  city: z.string().trim().min(2).max(80),
  course: z.string().trim().max(100).optional().or(z.literal("")),
  instagram: z.string().trim().max(150).optional().or(z.literal("")),
  linkedin: z.string().trim().max(200).optional().or(z.literal("")),
  why_join: z.string().trim().max(1000).optional().or(z.literal("")),
  leadership_experience: z.string().trim().max(1000).optional().or(z.literal("")),
});

/* Per-field validity using the master schema (live) */
const fieldSchemas: Record<string, z.ZodTypeAny> = (schema as any).shape ?? {};
const isFieldValid = (name: string, value: string) => {
  const s = fieldSchemas[name];
  if (!s) return value.trim().length > 0;
  const r = s.safeParse(value);
  return r.success && (value ?? "").trim().length > 0;
};

type FieldDef = {
  name: string; label: string; icon: any; placeholder: string;
  required?: boolean; type?: string; multiline?: boolean;
};

const FORM_STEPS: { title: string; fields: FieldDef[] }[] = [
  { title: "About You", fields: [
    { name: "full_name", label: "Full Name", icon: User, placeholder: "Your full name", required: true },
    { name: "phone", label: "Phone Number", icon: Phone, placeholder: "+91 98765 43210", required: true },
    { name: "email", label: "Email", icon: Mail, placeholder: "you@email.com", required: true, type: "email" },
  ]},
  { title: "Your Campus", fields: [
    { name: "college", label: "College / Coaching", icon: School, placeholder: "e.g. IIT Delhi", required: true },
    { name: "city", label: "City", icon: MapPin, placeholder: "e.g. Bengaluru", required: true },
    { name: "course", label: "Course / Year", icon: BookOpen, placeholder: "e.g. B.Tech CS · 2nd Year" },
  ]},
  { title: "Your Presence", fields: [
    { name: "instagram", label: "Instagram", icon: Instagram, placeholder: "@yourhandle" },
    { name: "linkedin", label: "LinkedIn", icon: Linkedin, placeholder: "linkedin.com/in/you" },
  ]},
  { title: "Your Story", fields: [
    { name: "why_join", label: "Why do you want to join?", icon: Heart, placeholder: "Tell us your motivation...", multiline: true },
    { name: "leadership_experience", label: "Leadership Experience", icon: Crown, placeholder: "Any past roles (optional)...", multiline: true },
  ]},
];

/* ─── Live Progress Widget ────────────────────────────────────────────
   Real-time per-field tracker. Auto-detects required vs optional fields,
   shows step-by-step completion, and exposes a "Submit Now" CTA that
   activates the moment every required field is valid.
   ──────────────────────────────────────────────────────────────────── */
const LiveProgress = ({
  data, currentStep, onJumpStep, onSubmit, submitting, allValid, requiredValid,
}: {
  data: Record<string, string>;
  currentStep: number;
  onJumpStep: (i: number) => void;
  onSubmit: () => void;
  submitting: boolean;
  allValid: boolean;
  requiredValid: boolean;
}) => {
  const totalFields = FORM_STEPS.reduce((n, s) => n + s.fields.length, 0);
  const filledFields = FORM_STEPS.reduce(
    (n, s) => n + s.fields.filter((f) => isFieldValid(f.name, data[f.name] || "")).length, 0,
  );
  const pct = Math.round((filledFields / totalFields) * 100);
  const C = 2 * Math.PI * 36; // circle circumference (r=36)

  return (
    <Card className="p-5 md:p-6 lg:sticky lg:top-24 self-start">
      {/* Live header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
            <span className="relative rounded-full bg-emerald-400 w-2 h-2" />
          </span>
          <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-white/60" style={fontBody}>
            Live Progress
          </span>
        </div>
        <span className="text-[10px] text-white/40" style={fontBody}>
          {filledFields}/{totalFields}
        </span>
      </div>

      {/* Ring */}
      <div className="flex items-center gap-5 mb-6">
        <div className="relative w-[88px] h-[88px] flex-shrink-0">
          <svg viewBox="0 0 88 88" className="w-full h-full -rotate-90">
            <circle cx="44" cy="44" r="36" fill="none" stroke={`${INDIGO.accent}22`} strokeWidth="6" />
            <motion.circle
              cx="44" cy="44" r="36" fill="none"
              stroke="url(#prog-grad)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={C}
              animate={{ strokeDashoffset: C - (C * pct) / 100 }}
              transition={{ type: "spring", stiffness: 80, damping: 18 }}
            />
            <defs>
              <linearGradient id="prog-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor={INDIGO.accent} />
                <stop offset="100%" stopColor={INDIGO.glow} />
              </linearGradient>
            </defs>
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              key={pct}
              initial={{ scale: 0.85, opacity: 0.6 }}
              animate={{ scale: 1, opacity: 1 }}
              className="text-xl font-bold text-white tabular-nums"
              style={fontHead}
            >
              {pct}%
            </motion.span>
          </div>
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-white mb-0.5" style={fontHead}>
            {pct === 100 ? "All set!" : pct >= 50 ? "Almost there." : pct > 0 ? "Great start." : "Let's begin."}
          </div>
          <div className="text-xs text-white/55 leading-snug" style={fontBody}>
            {requiredValid
              ? "Required fields done — you can submit anytime."
              : "Fill required fields to unlock submit."}
          </div>
        </div>
      </div>

      {/* Per-field checklist */}
      <div className="space-y-3 mb-5 max-h-[280px] overflow-y-auto pr-1" style={{ scrollbarWidth: "thin" }}>
        {FORM_STEPS.map((s, si) => {
          const stepFilled = s.fields.filter((f) => isFieldValid(f.name, data[f.name] || "")).length;
          const stepTotal = s.fields.length;
          const stepDone = stepFilled === stepTotal;
          const isCurrent = si === currentStep;
          return (
            <button
              key={s.title}
              type="button"
              onClick={() => onJumpStep(si)}
              className="w-full text-left rounded-xl p-3 transition-all"
              style={{
                background: isCurrent ? `${INDIGO.accent}1f` : `${INDIGO.base}66`,
                border: `1px solid ${isCurrent ? INDIGO.glow : INDIGO.accent + "1f"}`,
              }}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <div
                    className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold"
                    style={{
                      background: stepDone
                        ? `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`
                        : `${INDIGO.accent}33`,
                      color: "#fff",
                      ...fontHead,
                    }}
                  >
                    {stepDone ? <Check className="w-3 h-3" strokeWidth={3} /> : si + 1}
                  </div>
                  <span className="text-xs font-semibold text-white" style={fontHead}>{s.title}</span>
                </div>
                <span className="text-[10px] text-white/50 tabular-nums" style={fontBody}>
                  {stepFilled}/{stepTotal}
                </span>
              </div>
              <div className="space-y-1 pl-7">
                {s.fields.map((f) => {
                  const v = data[f.name] || "";
                  const ok = isFieldValid(f.name, v);
                  return (
                    <div key={f.name} className="flex items-center gap-1.5 text-[11px]" style={fontBody}>
                      {ok ? (
                        <Check className="w-3 h-3 flex-shrink-0" style={{ color: INDIGO.glow }} strokeWidth={3} />
                      ) : (
                        <div
                          className="w-3 h-3 rounded-full border flex-shrink-0"
                          style={{ borderColor: f.required ? `${INDIGO.glow}66` : `${INDIGO.accent}33` }}
                        />
                      )}
                      <span className={ok ? "text-white/75" : "text-white/40"}>
                        {f.label}
                      </span>
                      {f.required && !ok && <span className="text-[9px] text-white/30">required</span>}
                    </div>
                  );
                })}
              </div>
            </button>
          );
        })}
      </div>

      {/* Submit Now */}
      <motion.button
        onClick={onSubmit}
        disabled={!requiredValid || submitting}
        whileHover={requiredValid ? { scale: 1.02 } : {}}
        whileTap={requiredValid ? { scale: 0.98 } : {}}
        className="relative w-full inline-flex items-center justify-center gap-2 rounded-full py-3 font-semibold text-white text-sm overflow-hidden disabled:opacity-40 disabled:cursor-not-allowed"
        style={{
          background: requiredValid
            ? `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.accentSoft})`
            : `${INDIGO.surface}`,
          boxShadow: requiredValid ? `0 10px 30px ${INDIGO.accent}66` : "none",
          border: requiredValid ? "none" : `1px solid ${INDIGO.accent}33`,
          ...fontBody,
        }}
      >
        {requiredValid && (
          <span className="absolute inset-0 bg-gradient-to-r from-transparent via-white/25 to-transparent -translate-x-full animate-shimmer" />
        )}
        <Zap className="w-4 h-4 relative z-10" />
        <span className="relative z-10">
          {submitting ? "Submitting…" : allValid ? "Submit — All Complete" : requiredValid ? "Submit Application" : "Complete required fields"}
        </span>
      </motion.button>
      <p className="text-[10px] text-white/40 text-center mt-2.5" style={fontBody}>
        Auto-saved locally · Reviewed in 48 hours
      </p>
    </Card>
  );
};

const Form = ({ formRef }: { formRef: React.RefObject<HTMLDivElement> }) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [data, setData] = useState<Record<string, string>>({
    full_name: "", phone: "", email: "", college: "", city: "", course: "",
    instagram: "", linkedin: "", why_join: "", leadership_experience: "",
  });

  /* Persist between reloads */
  useEffect(() => {
    try {
      const raw = localStorage.getItem("acry_ca_draft");
      if (raw) setData((d) => ({ ...d, ...JSON.parse(raw) }));
    } catch {}
  }, []);
  useEffect(() => {
    try { localStorage.setItem("acry_ca_draft", JSON.stringify(data)); } catch {}
  }, [data]);

  const steps = FORM_STEPS;
  const progress = ((step + 1) / steps.length) * 100;

  /* Live validity */
  const requiredFields = steps.flatMap((s) => s.fields.filter((f) => f.required));
  const requiredValid = requiredFields.every((f) => isFieldValid(f.name, data[f.name] || ""));
  const allValid = steps
    .flatMap((s) => s.fields)
    .every((f) => f.required ? isFieldValid(f.name, data[f.name] || "") : true);

  const validateCurrentStep = () => {
    for (const f of steps[step].fields) {
      const v = data[f.name];
      if (f.required && !isFieldValid(f.name, v || "")) {
        toast.error(`${f.label} is required`);
        return false;
      }
    }
    return true;
  };

  const submit = async () => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      // jump to step containing the bad field
      const badField = parsed.error.issues[0].path[0] as string;
      const badStep = steps.findIndex((s) => s.fields.some((f) => f.name === badField));
      if (badStep >= 0) setStep(badStep);
      return;
    }
    setSubmitting(true);
    try {
      const applicationId =
        typeof crypto !== "undefined" && "randomUUID" in crypto
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
      const payload: any = { id: applicationId, ...parsed.data, user_agent: navigator.userAgent.slice(0, 500) };
      const { error } = await supabase.from("campus_ambassador_applications").insert(payload);
      if (error) throw error;
      setDone(true);
      try { localStorage.removeItem("acry_ca_draft"); } catch {}
      toast.success("Application submitted!");

      // Fire-and-forget: send branded instant confirmation email
      if (parsed.data.email) {
        supabase.functions.invoke("send-transactional-email", {
          body: {
            templateName: "campus-ambassador-confirmation",
            recipientEmail: parsed.data.email,
            idempotencyKey: `ca-confirm-${applicationId}`,
            templateData: {
              name: parsed.data.full_name,
              college: parsed.data.college,
              city: parsed.data.city,
            },
          },
        }).catch((err) => console.warn("[CA] confirmation email failed", err));
      }
    } catch (e: any) {
      toast.error(e.message || "Submission failed. Try again.");
    } finally { setSubmitting(false); }
  };


  return (
    <Section id="apply">
      <div ref={formRef} />
      {/* ───── Ultra Advanced "Start your journey" intro ───── */}
      <div className="relative text-center mb-16 max-w-3xl mx-auto">
        {/* Halo */}
        <div
          aria-hidden
          className="absolute left-1/2 -translate-x-1/2 -top-24 w-[44rem] h-[44rem] rounded-full pointer-events-none opacity-70"
          style={{
            background: `radial-gradient(circle, ${INDIGO.accent}33 0%, ${INDIGO.mid}1a 35%, transparent 65%)`,
            filter: "blur(40px)",
          }}
        />
        {/* Orbiting particles */}
        <div aria-hidden className="absolute left-1/2 -translate-x-1/2 top-2 w-[28rem] h-[28rem] pointer-events-none">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <motion.span
              key={i}
              className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full"
              style={{
                background: i % 2 ? INDIGO.glow : INDIGO.accentSoft,
                boxShadow: `0 0 12px ${INDIGO.glow}`,
              }}
              animate={{
                x: [Math.cos((i / 6) * Math.PI * 2) * 180, Math.cos((i / 6) * Math.PI * 2 + Math.PI * 2) * 180],
                y: [Math.sin((i / 6) * Math.PI * 2) * 80, Math.sin((i / 6) * Math.PI * 2 + Math.PI * 2) * 80],
                opacity: [0.2, 1, 0.2],
              }}
              transition={{ duration: 14 + i * 2, repeat: Infinity, ease: "linear" }}
            />
          ))}
        </div>

        {/* Live status pill */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-7 backdrop-blur-xl"
          style={{
            background: `linear-gradient(135deg, ${INDIGO.accent}1f, ${INDIGO.mid}1a)`,
            border: `1px solid ${INDIGO.accent}55`,
            boxShadow: `0 8px 32px -8px ${INDIGO.accent}55, inset 0 1px 0 rgba(255,255,255,0.08)`,
          }}
        >
          <span className="relative flex w-2 h-2">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-75 animate-ping" style={{ background: "#34d399" }} />
            <span className="relative inline-flex rounded-full h-2 w-2" style={{ background: "#34d399", boxShadow: "0 0 10px #34d399" }} />
          </span>
          <span className="text-xs font-semibold tracking-[0.18em] text-white/85 uppercase" style={fontBody}>
            Applications · Live Now
          </span>
          <span className="text-xs text-white/45" style={fontBody}>·</span>
          <Sparkles className="w-3.5 h-3.5" style={{ color: INDIGO.glow }} />
          <span className="text-xs text-white/70" style={fontBody}>Batch 2026</span>
        </motion.div>

        {/* Holographic heading */}
        <motion.h2
          initial={{ opacity: 0, y: 18 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
          className="relative text-5xl md:text-7xl font-bold tracking-[-0.04em] leading-[0.95]"
          style={fontHead}
        >
          <span
            className="relative inline-block bg-clip-text text-transparent"
            style={{
              backgroundImage: `linear-gradient(180deg, #ffffff 0%, #e0e7ff 55%, ${INDIGO.glow} 100%)`,
            }}
          >
            Start your
          </span>{" "}
          <span className="relative inline-block">
            <span
              className="relative bg-clip-text text-transparent"
              style={{
                backgroundImage: `linear-gradient(110deg, ${INDIGO.glow} 0%, #ffffff 30%, ${INDIGO.accentSoft} 60%, ${INDIGO.glow} 100%)`,
                backgroundSize: "250% 100%",
                WebkitBackgroundClip: "text",
                animation: "ca-shimmer 5.5s linear infinite",
              }}
            >
              journey
            </span>
            {/* Underline beam */}
            <motion.span
              aria-hidden
              initial={{ scaleX: 0 }}
              whileInView={{ scaleX: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 1.1, delay: 0.5, ease: [0.22, 1, 0.36, 1] }}
              className="absolute -bottom-2 left-0 right-0 h-[3px] origin-left rounded-full"
              style={{
                background: `linear-gradient(90deg, transparent, ${INDIGO.accent}, ${INDIGO.glow}, transparent)`,
                boxShadow: `0 0 18px ${INDIGO.accent}`,
              }}
            />
          </span>
          <span className="text-white/85">.</span>
        </motion.h2>

        <style>{`
          @keyframes ca-shimmer { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
        `}</style>

        {/* Subcopy */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7, delay: 0.25 }}
          className="mt-6 text-white/65 text-lg md:text-xl leading-relaxed max-w-xl mx-auto"
          style={fontBody}
        >
          Takes <span className="text-white font-semibold">90 seconds</span>. No fee.
          Every application is <span className="text-white font-semibold">personally reviewed</span>.
        </motion.p>

        {/* Trust chips */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6, delay: 0.45 }}
          className="mt-7 flex flex-wrap justify-center gap-2.5"
        >
          {[
            { icon: Shield, label: "Encrypted" },
            { icon: Zap, label: "Instant draft save" },
            { icon: Award, label: "Merit-based" },
            { icon: Users, label: "5,800+ applied" },
          ].map(({ icon: Icon, label }) => (
            <span
              key={label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium text-white/75 backdrop-blur"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.surface}cc, ${INDIGO.mid}66)`,
                border: `1px solid ${INDIGO.accent}33`,
                fontFamily: "'DM Sans', system-ui, sans-serif",
              }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: INDIGO.glow }} />
              {label}
            </span>
          ))}
        </motion.div>
      </div>

      {done ? (
        <div className="max-w-2xl mx-auto relative">
          <div
            className="absolute -inset-2 rounded-[28px] opacity-60 blur-2xl"
            style={{ background: `linear-gradient(135deg, ${INDIGO.accent}66, ${INDIGO.mid}55)` }}
          />
          <Card className="relative p-10 text-center overflow-hidden">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
              style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`, boxShadow: `0 20px 50px ${INDIGO.accent}66` }}
            >
              <Check className="w-10 h-10 text-white" strokeWidth={3} />
            </motion.div>
            <h3 className="text-3xl font-bold text-white mb-3" style={fontHead}>Welcome to the movement.</h3>
            <p className="text-white/65 max-w-md mx-auto mb-7" style={fontBody}>
              We'll personally reach out within <span className="text-white font-semibold">48 hours</span> via WhatsApp & email.
            </p>
            <a
              href="https://wa.me/919999999999?text=Hi%20ACRY%20AI%2C%20I%20just%20applied%20for%20the%20Campus%20Ambassador%20Program."
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-green-500 hover:bg-green-600 text-white font-semibold transition-colors"
              style={fontBody}
            >
              <MessageCircle className="w-4 h-4" /> Connect on WhatsApp
            </a>
          </Card>
        </div>
      ) : (
        <div className="max-w-5xl mx-auto grid lg:grid-cols-[1fr_320px] gap-6 items-start">
          {/* Form card */}
          <div className="relative">
            <div
              className="absolute -inset-2 rounded-[28px] opacity-60 blur-2xl"
              style={{ background: `linear-gradient(135deg, ${INDIGO.accent}66, ${INDIGO.mid}55)` }}
            />
            <Card className="relative p-6 md:p-10 overflow-hidden">
              <div className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: INDIGO.glow, ...fontBody }}>
                    Step {step + 1} of {steps.length}
                  </span>
                  <span className="text-xs text-white/50" style={fontBody}>{steps[step].title}</span>
                </div>
                <div className="h-1 rounded-full overflow-hidden" style={{ background: `${INDIGO.accent}22` }}>
                  <motion.div
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.5 }}
                    className="h-full rounded-full"
                    style={{ background: `linear-gradient(90deg, ${INDIGO.accent}, ${INDIGO.glow})` }}
                  />
                </div>
              </div>
              <AnimatePresence mode="wait">
                <motion.div
                  key={step}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-4"
                >
                  {steps[step].fields.map((f) => {
                    const v = data[f.name] || "";
                    const ok = isFieldValid(f.name, v);
                    return (
                      <div key={f.name}>
                        <label className="flex items-center justify-between text-xs font-semibold uppercase tracking-wider text-white/60 mb-2" style={fontBody}>
                          <span className="flex items-center gap-2">
                            <f.icon className="w-3.5 h-3.5" style={{ color: INDIGO.glow }} />
                            {f.label} {f.required && <span style={{ color: INDIGO.glow }}>*</span>}
                          </span>
                          {ok && (
                            <motion.span
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              className="flex items-center gap-1 text-[10px] normal-case tracking-normal"
                              style={{ color: INDIGO.glow }}
                            >
                              <Check className="w-3 h-3" strokeWidth={3} /> looks good
                            </motion.span>
                          )}
                        </label>
                        <div className="relative">
                          {f.multiline ? (
                            <textarea
                              value={v}
                              onChange={(e) => setData({ ...data, [f.name]: e.target.value })}
                              placeholder={f.placeholder}
                              rows={4}
                              className="w-full rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none transition-all resize-none"
                              style={{
                                background: `${INDIGO.base}80`,
                                border: `1px solid ${ok ? INDIGO.glow + "80" : INDIGO.accent + "33"}`,
                                ...fontBody,
                              }}
                            />
                          ) : (
                            <input
                              type={f.type || "text"}
                              value={v}
                              onChange={(e) => setData({ ...data, [f.name]: e.target.value })}
                              placeholder={f.placeholder}
                              className="w-full rounded-xl px-4 py-3 pr-10 text-white placeholder:text-white/30 focus:outline-none transition-all"
                              style={{
                                background: `${INDIGO.base}80`,
                                border: `1px solid ${ok ? INDIGO.glow + "80" : INDIGO.accent + "33"}`,
                                ...fontBody,
                              }}
                            />
                          )}
                          {!f.multiline && ok && (
                            <motion.div
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})` }}
                            >
                              <Check className="w-3 h-3 text-white" strokeWidth={3} />
                            </motion.div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </motion.div>
              </AnimatePresence>
              <div className="flex items-center justify-between mt-8 gap-3">
                <button
                  onClick={() => setStep(Math.max(0, step - 1))}
                  disabled={step === 0}
                  className="px-5 py-3 rounded-full text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium text-sm"
                  style={fontBody}
                >
                  ← Back
                </button>
                <PrimaryCTA
                  onClick={() => {
                    if (!validateCurrentStep()) return;
                    if (step < steps.length - 1) setStep(step + 1);
                    else submit();
                  }}
                  large
                >
                  {submitting ? "Submitting..." : step === steps.length - 1 ? "Submit Application" : "Continue"}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </PrimaryCTA>
              </div>
            </Card>
          </div>

          {/* Live progress widget */}
          <LiveProgress
            data={data}
            currentStep={step}
            onJumpStep={setStep}
            onSubmit={submit}
            submitting={submitting}
            allValid={allValid}
            requiredValid={requiredValid}
          />
        </div>
      )}
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   FAQ
   ═════════════════════════════════════════════════════════════════════ */
const FAQ = () => {
  const faqs = [
    { q: "Who can apply?", a: "Any college, university or coaching student in India — UG, PG, JEE/NEET aspirants, AI enthusiasts. All streams welcome." },
    { q: "Is it free?", a: "100% free. No application fee, no hidden cost, ever." },
    { q: "Will I get a certificate?", a: "Yes — an official Campus Ambassador certificate and a verified performance certificate for top performers." },
    { q: "Remote or in-person?", a: "Hybrid. Training and community are remote. Workshops and meetups happen on your campus / city." },
    { q: "How much time?", a: "About 4–6 hours per week. Flexible around your studies." },
    { q: "Workshops & events?", a: "Yes — monthly AI workshops, quarterly summits, plus events you organise with our full support." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <Eyebrow>FAQ</Eyebrow>
        <Heading>Quick answers.</Heading>
      </div>
      <div className="max-w-2xl mx-auto space-y-3">
        {faqs.map((f, i) => (
          <Card key={f.q} className="overflow-hidden">
            <button onClick={() => setOpen(open === i ? null : i)} className="w-full px-6 py-5 flex items-center justify-between text-left">
              <span className="font-semibold text-white pr-4" style={fontHead}>{f.q}</span>
              <ChevronDown className={`w-5 h-5 flex-shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} style={{ color: INDIGO.glow }} />
            </button>
            <AnimatePresence>
              {open === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.25 }}
                  className="overflow-hidden"
                >
                  <p className="px-6 pb-5 text-white/65 leading-relaxed" style={fontBody}>{f.a}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </Card>
        ))}
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   FINAL CTA
   ═════════════════════════════════════════════════════════════════════ */
const FinalCTA = ({ scrollToForm }: { scrollToForm: () => void }) => (
  <Section className="overflow-hidden">
    <Card className="relative p-10 md:p-20 text-center overflow-hidden">
      <div
        className="absolute inset-0"
        style={{ background: `radial-gradient(ellipse at center, ${INDIGO.accent}33, transparent 65%)` }}
      />
      <div className="relative z-10">
        <Eyebrow>Your Move</Eyebrow>
        <Heading className="!text-5xl md:!text-7xl mb-5">
          The future belongs to{" "}
          <span style={{ background: `linear-gradient(135deg, ${INDIGO.glow}, ${INDIGO.accent})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            AI leaders.
          </span>
        </Heading>
        <p className="text-lg text-white/65 max-w-xl mx-auto mb-10" style={fontBody}>
          Join the movement. Build your future. Lead your campus.
        </p>
        <PrimaryCTA onClick={scrollToForm} large>
          <Rocket className="w-4 h-4" /> Apply Now <ArrowRight className="w-4 h-4" />
        </PrimaryCTA>
      </div>
    </Card>
  </Section>
);

/* ═════════════════════════════════════════════════════════════════════
   FOOTER
   ═════════════════════════════════════════════════════════════════════ */
const PageFooter = () => (
  <footer className="relative border-t py-12 px-6" style={{ borderColor: `${INDIGO.accent}1a`, background: `${INDIGO.base}cc` }}>
    <div className="max-w-6xl mx-auto grid md:grid-cols-4 gap-8">
      <div>
        <Link to="/" className="flex items-center gap-2.5 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center font-black text-white" style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`, ...fontHead }}>A</div>
          <span className="font-semibold text-white" style={fontHead}>ACRY.ai</span>
        </Link>
        <p className="text-sm text-white/50 leading-relaxed" style={fontBody}>India's largest AI Student Community & Leadership Ecosystem.</p>
      </div>
      {[
        { h: "Community", l: [["Ambassadors", "#community"], ["Workshops", "#role"], ["Path", "#path"]] },
        { h: "Company", l: [["About", "/about"], ["Contact", "/contact"], ["Privacy", "/privacy"], ["Terms", "/terms"]] },
      ].map((col) => (
        <div key={col.h}>
          <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4" style={{ color: INDIGO.glow, ...fontBody }}>{col.h}</div>
          <ul className="space-y-2 text-sm text-white/60" style={fontBody}>
            {col.l.map(([t, href]) => (
              <li key={t}><a href={href} className="hover:text-white transition-colors">{t}</a></li>
            ))}
          </ul>
        </div>
      ))}
      <div>
        <div className="text-xs uppercase tracking-[0.2em] font-bold mb-4" style={{ color: INDIGO.glow, ...fontBody }}>Connect</div>
        <ul className="space-y-2 text-sm text-white/60" style={fontBody}>
          <li><a href="mailto:ambassador@acry.ai" className="hover:text-white transition-colors">ambassador@acry.ai</a></li>
          <li><a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp Us</a></li>
        </ul>
        <div className="flex gap-2 mt-4">
          {[Instagram, Linkedin, MessageCircle].map((Icon, i) => (
            <a key={i} href="#" className="w-9 h-9 rounded-lg flex items-center justify-center transition-all hover:scale-110" style={{ border: `1px solid ${INDIGO.accent}33`, background: `${INDIGO.surface}80` }}>
              <Icon className="w-4 h-4 text-white/70" />
            </a>
          ))}
        </div>
      </div>
    </div>
    <div className="max-w-6xl mx-auto mt-10 pt-6 border-t text-center text-xs text-white/40" style={{ borderColor: `${INDIGO.accent}14`, ...fontBody }}>
      © {new Date().getFullYear()} AVC DOTFY LLP · ACRY.ai · All rights reserved.
    </div>
  </footer>
);

/* ═════════════════════════════════════════════════════════════════════
   FLOATING CTAs
   ═════════════════════════════════════════════════════════════════════ */
const FloatingCTAs = ({ scrollToForm }: { scrollToForm: () => void }) => (
  <>
    <a
      href="https://wa.me/919999999999?text=Hi%20ACRY%20AI%2C%20I%20want%20to%20know%20more%20about%20the%20Campus%20Ambassador%20Program."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 md:bottom-6 right-5 z-40 w-13 h-13 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-2xl shadow-green-500/40 transition-all hover:scale-110"
      style={{ width: 52, height: 52 }}
      aria-label="WhatsApp"
    >
      <MessageCircle className="w-6 h-6 text-white" />
      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-300 animate-ping" />
    </a>
    <div
      className="fixed bottom-0 inset-x-0 z-30 md:hidden p-3"
      style={{ background: `linear-gradient(to top, ${INDIGO.base}, ${INDIGO.base}cc, transparent)` }}
    >
      <button
        onClick={scrollToForm}
        className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-white"
        style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.accentSoft})`, boxShadow: `0 8px 24px ${INDIGO.accent}66`, ...fontBody }}
      >
        <Rocket className="w-4 h-4" /> Apply Now <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </>
);

/* ═════════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════════ */
const CampusAmbassadorBlueprint = () => {
  useFonts();
  const formRef = useRef<HTMLDivElement>(null);
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative min-h-screen text-white overflow-x-hidden" style={{ background: INDIGO.base, ...fontBody }}>
      <SEO
        title="ACRY AI Campus Ambassador Program | Lead the AI Revolution"
        description="Join India's largest AI student community. Become an ACRY AI Campus Ambassador — leadership, AI training, certificates, mentorship & internship opportunities. Apply now."
        path="/campus-ambassador"
      />
      <Atmosphere />
      <CursorLight />

      <div className="relative z-10">
        <Nav scrollToForm={scrollToForm} />
        <Hero scrollToForm={scrollToForm} />
        <Trusted />
        <Benefits />
        <Role />
        <Metrics />
        <Testimonials />
        <Path />
        <Form formRef={formRef} />
        <FAQ />
        <FinalCTA scrollToForm={scrollToForm} />
        <PageFooter />
        <FloatingCTAs scrollToForm={scrollToForm} />
      </div>
    </div>
  );
};

export default CampusAmbassadorBlueprint;
