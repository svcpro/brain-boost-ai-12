import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useInView, useMotionValue, useSpring, useScroll, useTransform, MotionConfig } from "framer-motion";
import {
  Rocket, Sparkles, Shield, Trophy, Users, GraduationCap, Award, Network,
  Briefcase, Star, MessageCircle, ArrowRight, Check, ChevronDown, MapPin,
  Calendar, Brain, Mic, Globe, Send, User, Phone, Mail, School, BookOpen,
  Instagram, Linkedin, Heart, Crown, Target, Zap, Play,
  Medal, Flame, TrendingUp, Gift, Gem, Clock, HelpCircle,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { z } from "zod";

/* ═════════════════════════════════════════════════════════════════════
   ACRY.ai CAMPUS AMBASSADOR — Midnight Indigo Edition
   Palette: #031f1a · #064e3b · #0d7a5f · #10b981
   Type:    Space Grotesk (display) · DM Sans (body)
   Layout:  Hero + Card Grid · user-focused, conversion-led
   ═════════════════════════════════════════════════════════════════════ */

const INDIGO = {
  base: "#031f1a",
  surface: "#064e3b",
  mid: "#0d7a5f",
  accent: "#10b981",
  accentSoft: "#34d399",
  glow: "#c9a84c",
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
          "linear-gradient(rgba(16,185,129,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(16,185,129,0.6) 1px, transparent 1px)",
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

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.4 }}
          className="flex items-center justify-center"
        >
          <PrimaryCTA onClick={scrollToForm} large>
            <Rocket className="w-4 h-4" /> Apply Now
            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
          </PrimaryCTA>
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
   WHY JOIN — 10 animated feature cards (ultra-premium edition)
   ═════════════════════════════════════════════════════════════════════ */
const BenefitCard = ({ item, index }: { item: { icon: React.ElementType; title: string; desc: string }; index: number }) => {
  const [hover, setHover] = useState(false);

  return (
    <motion.div
      initial={{ opacity: 0, y: 35, scale: 0.96 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-50px" }}
      transition={{ duration: 0.7, delay: index * 0.07, ease: [0.22, 1, 0.36, 1] }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group relative h-full"
      style={{ perspective: 900 }}
    >
      <motion.div
        animate={{ rotateX: hover ? -3 : 0, rotateY: hover ? (index % 2 === 0 ? 2 : -2) : 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 24 }}
        className="relative h-full rounded-2xl p-6 overflow-hidden backdrop-blur-xl transition-all duration-500"
        style={{
          transformStyle: "preserve-3d",
          background: hover
            ? `linear-gradient(160deg, ${INDIGO.surface}e6, ${INDIGO.mid}99)`
            : `linear-gradient(180deg, ${INDIGO.surface}b3, ${INDIGO.surface}66)`,
          border: `1px solid ${hover ? INDIGO.accent + "aa" : INDIGO.accent + "26"}`,
          boxShadow: hover
            ? `0 28px 70px -24px ${INDIGO.accent}66, 0 0 50px ${INDIGO.accent}18, inset 0 1px 0 rgba(255,255,255,0.1)`
            : `0 1px 0 rgba(255,255,255,0.04) inset, 0 24px 60px -30px ${INDIGO.accent}40`,
        }}
      >
        {/* Animated border glow ring */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{
            padding: "1.5px",
            background: `linear-gradient(${135 + index * 30}deg, ${INDIGO.accent}00, ${INDIGO.accent}99, ${INDIGO.glow}cc, ${INDIGO.accent}00)`,
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            WebkitMaskComposite: "xor",
            maskComposite: "exclude",
          }}
        />

        {/* Shine sweep */}
        <div
          className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-[1200ms] ease-out pointer-events-none"
          style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.07), transparent)" }}
        />

        {/* Large index watermark */}
        <div
          className="absolute -top-1 right-2 text-[4.5rem] font-black tracking-tighter opacity-[0.035] group-hover:opacity-[0.1] transition-opacity duration-500 select-none leading-none"
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>

        {/* Icon */}
        <div className="relative mb-5">
          <motion.div
            animate={{ scale: hover ? 1.1 : 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 15 }}
            className="w-12 h-12 rounded-xl flex items-center justify-center relative z-10"
            style={{
              background: `linear-gradient(135deg, ${INDIGO.accent}44, ${INDIGO.mid}77)`,
              border: `1px solid ${INDIGO.accent}55`,
              boxShadow: hover ? `0 0 28px ${INDIGO.accent}55, 0 0 12px ${INDIGO.glow}33` : "none",
            }}
          >
            <item.icon className="w-5 h-5" style={{ color: INDIGO.glow }} />
          </motion.div>
          {/* Orbiting dot */}
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8 + index, repeat: Infinity, ease: "linear" }}
            className="absolute inset-0 w-12 h-12 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
          >
            <div
              className="absolute top-0 left-1/2 -translate-x-1/2 w-1.5 h-1.5 rounded-full"
              style={{ background: INDIGO.glow, boxShadow: `0 0 8px ${INDIGO.glow}` }}
            />
          </motion.div>
        </div>

        {/* Title */}
        <h4
          className="font-semibold text-white text-[15px] mb-2 transition-all duration-300 group-hover:translate-x-0.5"
          style={fontHead}
        >
          {item.title}
        </h4>

        {/* Description */}
        <p className="text-sm text-white/50 leading-relaxed group-hover:text-white/75 transition-colors duration-500" style={fontBody}>
          {item.desc}
        </p>

        {/* Bottom accent line */}
        <div
          className="absolute bottom-0 left-8 right-8 h-[2px] rounded-full opacity-0 group-hover:opacity-100 transition-all duration-700 scale-x-0 group-hover:scale-x-100"
          style={{
            background: `linear-gradient(90deg, transparent, ${INDIGO.accent}, ${INDIGO.glow}, ${INDIGO.accent}, transparent)`,
            transformOrigin: "center",
          }}
        />
      </motion.div>
    </motion.div>
  );
};

const Benefits = () => {
  const items = [
    { icon: Brain, title: "AI Training", desc: "Master prompt engineering, LLMs & real-world AI tools through hands-on workshops." },
    { icon: Crown, title: "Leadership Experience", desc: "Lead initiatives on your campus. Real responsibility, not symbolic titles." },
    { icon: Award, title: "Certificates", desc: "Earn verified, recruiter-recognised certificates that stand out on every profile." },
    { icon: Network, title: "Networking Opportunities", desc: "Join 10,000+ ambassadors, founders & industry mentors nationwide." },
    { icon: Star, title: "Personal Branding", desc: "Build authority as the AI voice of your campus and city." },
    { icon: Briefcase, title: "Internship Opportunities", desc: "Top performers unlock paid internships and full-time roles at ACRY AI." },
    { icon: Sparkles, title: "Founder Mentorship", desc: "Get direct 1:1 guidance from ACRY founders and senior leadership." },
    { icon: Trophy, title: "Campus Recognition", desc: "Be the face of AI on campus. Earn official badges, perks and visibility." },
    { icon: Mic, title: "AI Workshops Access", desc: "Lifetime free access to all premium ACRY AI workshops, bootcamps and summits." },
    { icon: Users, title: "Real Community Building", desc: "Create AI clubs, study circles and a lasting network of peers." },
  ];

  return (
    <Section id="benefits">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <Eyebrow>Why Join</Eyebrow>
        <Heading>10 reasons to become an ambassador.</Heading>
        <p className="mt-5 text-white/60 text-lg" style={fontBody}>
          Not a sticker on your CV — a transformational identity built on AI, leadership, and real-world impact.
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {items.map((b, i) => (
          <BenefitCard key={b.title} item={b} index={i} />
        ))}
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   WHAT WILL YOU DO — animated timeline
   ═════════════════════════════════════════════════════════════════════ */
const Role = () => {
  const items = [
    { icon: Mic, title: "Organize AI Workshops", desc: "Host flagship AI workshops on your campus — fully supported with playbooks, slides & swag from ACRY.", tag: "Lead" },
    { icon: Users, title: "Build Student Communities", desc: "Launch your own AI club, study circles & a thriving ambassador chapter.", tag: "Grow" },
    { icon: Globe, title: "Spread AI Awareness", desc: "Become the trusted voice of AI in your campus and city through talks, panels & live sessions.", tag: "Inspire" },
    { icon: Calendar, title: "Conduct Campus Activities", desc: "Run hackathons, meetups, demo days, AI challenges and ambassador-only events.", tag: "Activate" },
    { icon: Sparkles, title: "Create AI Content", desc: "Build a personal brand through reels, posts, tutorials & case studies amplified by ACRY.", tag: "Create" },
    { icon: Target, title: "Connect Students to Future Skills", desc: "Bridge peers to real-world AI tools, internships, jobs and the ACRY ecosystem.", tag: "Bridge" },
  ];
  const sectionRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: sectionRef, offset: ["start 70%", "end 30%"] });
  const lineScale = useTransform(scrollYProgress, [0, 1], [0, 1]);

  return (
    <Section id="role">
      <div className="text-center mb-16 max-w-2xl mx-auto">
        <Eyebrow>What You'll Do</Eyebrow>
        <Heading>Your ambassador playbook.</Heading>
        <p className="mt-5 text-white/60 text-lg" style={fontBody}>
          Six high-impact responsibilities. A clear timeline. ~4–6 hours a week to lead the AI movement on your campus.
        </p>
      </div>

      <div ref={sectionRef} className="relative max-w-5xl mx-auto">
        {/* Vertical timeline rail */}
        <div className="absolute left-6 md:left-1/2 top-0 bottom-0 w-px -translate-x-1/2">
          <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent, ${INDIGO.accent}22, ${INDIGO.accent}33, transparent)` }} />
          <motion.div
            className="absolute inset-x-0 top-0 origin-top"
            style={{
              scaleY: lineScale,
              background: `linear-gradient(to bottom, ${INDIGO.glow}, ${INDIGO.accent}, ${INDIGO.accentSoft})`,
              boxShadow: `0 0 20px ${INDIGO.accent}cc, 0 0 40px ${INDIGO.accent}66`,
              height: "100%",
              width: "2px",
              left: "-0.5px",
            }}
          />
        </div>

        <div className="flex flex-col gap-10 md:gap-14">
          {items.map((it, i) => {
            const isLeft = i % 2 === 0;
            return (
              <motion.div
                key={it.title}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-80px" }}
                transition={{ duration: 0.55, delay: 0.05, ease: [0.21, 0.6, 0.35, 1] }}
                className={`relative grid md:grid-cols-2 items-center gap-6 md:gap-12 ${isLeft ? "" : "md:[&>*:first-child]:order-2"}`}
              >
                {/* Timeline node */}
                <div className="absolute left-6 md:left-1/2 top-6 md:top-1/2 -translate-x-1/2 md:-translate-y-1/2 z-20">
                  <motion.div
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ type: "spring", stiffness: 260, damping: 18, delay: 0.15 }}
                    className="relative"
                  >
                    <div
                      className="w-5 h-5 rounded-full flex items-center justify-center"
                      style={{
                        background: `radial-gradient(circle at 30% 30%, ${INDIGO.glow}, ${INDIGO.accent})`,
                        boxShadow: `0 0 0 4px ${INDIGO.base}, 0 0 0 5px ${INDIGO.accent}66, 0 0 24px ${INDIGO.accent}aa`,
                      }}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-white" />
                    </div>
                    <motion.span
                      className="absolute inset-0 rounded-full"
                      style={{ border: `2px solid ${INDIGO.glow}` }}
                      animate={{ scale: [1, 2.2], opacity: [0.55, 0] }}
                      transition={{ duration: 2.2, repeat: Infinity, ease: "easeOut", delay: i * 0.25 }}
                    />
                  </motion.div>
                </div>

                {/* Card */}
                <div className={`pl-16 md:pl-0 ${isLeft ? "md:pr-12 md:text-right" : "md:pl-12"}`}>
                  <Card interactive className="p-6 md:p-7 relative overflow-hidden group">
                    <div
                      className="absolute -inset-px opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                      style={{ background: `radial-gradient(400px circle at 50% 0%, ${INDIGO.accent}22, transparent 60%)` }}
                    />
                    <div className={`flex items-start gap-4 ${isLeft ? "md:flex-row-reverse md:text-right" : ""}`}>
                      <div
                        className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 relative"
                        style={{ background: `linear-gradient(135deg, ${INDIGO.accent}33, ${INDIGO.mid}66)`, border: `1px solid ${INDIGO.accent}55` }}
                      >
                        <it.icon className="w-5 h-5" style={{ color: INDIGO.glow }} />
                        <span className="absolute -inset-2 rounded-2xl opacity-40" style={{ background: `radial-gradient(circle, ${INDIGO.accent}44, transparent 70%)` }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className={`flex items-center gap-2 mb-2 ${isLeft ? "md:justify-end" : ""}`}>
                          <span className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: INDIGO.glow, ...fontBody }}>
                            {String(i + 1).padStart(2, "0")} · {it.tag}
                          </span>
                        </div>
                        <h4 className="text-lg font-semibold text-white mb-2 leading-tight" style={fontHead}>{it.title}</h4>
                        <p className="text-sm text-white/60 leading-relaxed" style={fontBody}>{it.desc}</p>
                      </div>
                    </div>
                  </Card>
                </div>

                {/* Spacer on opposite side (desktop) */}
                <div className="hidden md:block" />
              </motion.div>
            );
          })}
        </div>

        {/* Timeline end cap */}
        <div className="relative mt-6 flex justify-start md:justify-center pl-6 md:pl-0">
          <div className="absolute left-6 md:left-1/2 -translate-x-1/2 -top-2">
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              whileInView={{ scale: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ type: "spring", stiffness: 220, damping: 16 }}
              className="px-4 py-1.5 rounded-full text-[11px] font-semibold tracking-wider uppercase whitespace-nowrap"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.accentSoft})`,
                color: "white",
                boxShadow: `0 8px 24px ${INDIGO.accent}66`,
                ...fontBody,
              }}
            >
              🚀 You become the AI leader of your campus
            </motion.div>
          </div>
        </div>
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
  const testimonials = [
    { name: "Aarav Sharma", role: "IIT Delhi", batch: "Batch '25", text: "From curious student to leading 8 AI workshops in 4 months. ACRY made me the person I wanted to be.", metric: "8 workshops · 1.2K reached" },
    { name: "Ishita Verma", role: "BITS Pilani", batch: "Batch '24", text: "I built a 600-member AI community on my campus. The mentorship and brand backing is unreal.", metric: "600 members · 24 events" },
    { name: "Rohan Mehta", role: "NIT Trichy", batch: "Batch '25", text: "Not just an ambassador program — a launchpad. Got my AI internship through this network.", metric: "Paid internship · Bengaluru" },
    { name: "Priya Iyer", role: "VIT Vellore", batch: "Batch '24", text: "Founder mentorship sessions changed how I think about AI, leadership and my career.", metric: "12 mentor calls" },
    { name: "Karan Singh", role: "DTU", batch: "Batch '25", text: "Best decision of my college life. Period.", metric: "AI Club founder" },
    { name: "Ananya Kapoor", role: "SRM", batch: "Batch '26", text: "I had zero leadership experience. Now I run my own AI club and speak at events.", metric: "5 talks · 2.4K followers" },
  ];

  const posts = [
    { handle: "@aarav.builds", college: "IIT Delhi", caption: "Hosted my first AI workshop — 240 students showed up. The future is now ⚡", likes: "2.4K", comments: "186", emoji: "🚀", grad: ["#10b981", "#c9a84c"] },
    { handle: "@ishita.codes", college: "BITS Pilani", caption: "Our AI club just crossed 600 members 🤯 Thank you @acry.ai for the playbook!", likes: "3.1K", comments: "312", emoji: "🧠", grad: ["#0d7a5f", "#06b6d4"] },
    { handle: "@rohan.ml", college: "NIT Trichy", caption: "From ambassador to AI intern in 90 days. Receipts in story 💼", likes: "1.8K", comments: "94", emoji: "💼", grad: ["#8b5cf6", "#f59e0b"] },
    { handle: "@priya.prompts", college: "VIT Vellore", caption: "Mentor call with the ACRY founders today. Wild how much you learn in 30 mins.", likes: "1.2K", comments: "76", emoji: "✨", grad: ["#ec4899", "#10b981"] },
  ];

  return (
    <Section id="community">
      <div className="text-center mb-14 max-w-2xl mx-auto">
        <Eyebrow>Community & Social Proof</Eyebrow>
        <Heading>Join India's next-generation AI student movement.</Heading>
        <p className="mt-5 text-white/60 text-lg" style={fontBody}>
          Real ambassadors. Real campuses. Real momentum — from IITs to Tier-3 colleges, the AI revolution is already in motion.
        </p>
      </div>

      {/* Community growth bar */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-5xl mx-auto mb-14"
      >
        <Card className="p-6 md:p-8 relative overflow-hidden">
          <div className="absolute inset-0 opacity-40" style={{ background: `radial-gradient(600px circle at 20% 50%, ${INDIGO.accent}33, transparent 60%), radial-gradient(500px circle at 90% 50%, ${INDIGO.glow}22, transparent 60%)` }} />
          <div className="relative grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-4">
            {[
              { v: "50K+", l: "Students", sub: "Across India" },
              { v: "120+", l: "Cities", sub: "Tier 1–3" },
              { v: "850+", l: "Workshops", sub: "This year" },
              { v: "98%", l: "Recommend", sub: "Net promoter" },
            ].map((s, i) => (
              <motion.div
                key={s.l}
                initial={{ opacity: 0, scale: 0.9 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.08, type: "spring", stiffness: 180 }}
                className="text-center md:text-left"
              >
                <div className="text-3xl md:text-4xl font-bold mb-1" style={{ background: `linear-gradient(135deg, ${INDIGO.glow}, white)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", ...fontHead }}>{s.v}</div>
                <div className="text-sm font-semibold text-white" style={fontBody}>{s.l}</div>
                <div className="text-[11px] text-white/45 tracking-wider uppercase" style={fontBody}>{s.sub}</div>
              </motion.div>
            ))}
          </div>
        </Card>
      </motion.div>

      {/* Testimonials grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-16">
        {testimonials.map((x, i) => (
          <motion.div
            key={x.name}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.08 }}
          >
            <Card interactive className="p-6 h-full relative overflow-hidden group">
              <div className="absolute top-4 right-4 text-5xl leading-none opacity-10 font-serif" style={{ color: INDIGO.glow }}>"</div>
              <div className="flex items-center gap-3 mb-4 relative">
                <div
                  className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold flex-shrink-0"
                  style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`, ...fontHead }}
                >
                  {x.name[0]}
                </div>
                <div className="min-w-0">
                  <div className="text-white font-semibold text-sm flex items-center gap-1.5" style={fontHead}>
                    {x.name}
                    <Check className="w-3.5 h-3.5 p-0.5 rounded-full text-white" style={{ background: INDIGO.accent }} />
                  </div>
                  <div className="text-xs text-white/45" style={fontBody}>Ambassador · {x.role} · {x.batch}</div>
                </div>
              </div>
              <div className="flex gap-0.5 mb-3">
                {[...Array(5)].map((_, k) => <Star key={k} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />)}
              </div>
              <p className="text-sm text-white/75 leading-relaxed mb-4" style={fontBody}>"{x.text}"</p>
              <div className="pt-3 border-t border-white/5">
                <div className="text-[10px] font-bold tracking-[0.18em] uppercase" style={{ color: INDIGO.glow, ...fontBody }}>Impact</div>
                <div className="text-xs text-white/65 mt-0.5" style={fontBody}>{x.metric}</div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Instagram-style community posts */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, #f59e0b, #ec4899, #8b5cf6)` }}>
              <Instagram className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-white font-semibold" style={fontHead}>Live from the community</div>
              <div className="text-xs text-white/50" style={fontBody}>What our ambassadors are posting right now</div>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs text-emerald-400" style={fontBody}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 1.4K posts this week
          </div>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {posts.map((p, i) => (
            <motion.div
              key={p.handle}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
            >
              <Card className="overflow-hidden h-full">
                {/* Post header */}
                <div className="flex items-center gap-2.5 p-3">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ background: `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})`, ...fontHead }}>
                    {p.handle[1].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-semibold text-white truncate" style={fontHead}>{p.handle}</div>
                    <div className="text-[10px] text-white/45 truncate" style={fontBody}>{p.college}</div>
                  </div>
                  <div className="text-white/40 text-xl leading-none">⋯</div>
                </div>
                {/* Post image */}
                <div className="relative aspect-square overflow-hidden" style={{ background: `linear-gradient(135deg, ${p.grad[0]}, ${p.grad[1]})` }}>
                  <div className="absolute inset-0" style={{ background: `radial-gradient(circle at 30% 30%, rgba(255,255,255,0.25), transparent 60%)` }} />
                  <div className="absolute inset-0 flex items-center justify-center text-7xl">{p.emoji}</div>
                  <div className="absolute top-2 right-2 px-2 py-0.5 rounded-full text-[9px] font-bold text-white backdrop-blur-md bg-black/30 border border-white/20" style={fontBody}>
                    ACRY · AMBASSADOR
                  </div>
                </div>
                {/* Post actions */}
                <div className="p-3">
                  <div className="flex items-center gap-3 mb-2 text-white">
                    <Heart className="w-4 h-4 fill-pink-500 text-pink-500" />
                    <MessageCircle className="w-4 h-4" />
                    <Send className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-semibold text-white mb-1" style={fontBody}>{p.likes} likes · {p.comments} comments</div>
                  <p className="text-xs text-white/65 leading-relaxed line-clamp-2" style={fontBody}>
                    <span className="font-semibold text-white">{p.handle}</span> {p.caption}
                  </p>
                </div>
              </Card>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Engagement screenshot mockup */}
      <div className="grid lg:grid-cols-2 gap-6 max-w-5xl mx-auto">
        {/* Workshop engagement */}
        <motion.div initial={{ opacity: 0, x: -20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <Card className="p-6 h-full">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${INDIGO.accent}33`, border: `1px solid ${INDIGO.accent}55` }}>
                  <Mic className="w-4 h-4" style={{ color: INDIGO.glow }} />
                </div>
                <div className="text-sm font-semibold text-white" style={fontHead}>Workshop Engagement</div>
              </div>
              <div className="text-[10px] tracking-wider uppercase text-emerald-400 font-bold" style={fontBody}>↑ 142%</div>
            </div>
            <div className="space-y-3">
              {[
                { c: "IIT Delhi", v: 92 },
                { c: "BITS Pilani", v: 88 },
                { c: "NIT Trichy", v: 81 },
                { c: "VIT Vellore", v: 76 },
                { c: "DTU", v: 71 },
              ].map((row, i) => (
                <div key={row.c}>
                  <div className="flex justify-between text-xs mb-1" style={fontBody}>
                    <span className="text-white/70">{row.c}</span>
                    <span className="text-white/50">{row.v}% attendance</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      whileInView={{ width: `${row.v}%` }}
                      viewport={{ once: true }}
                      transition={{ duration: 1, delay: i * 0.1, ease: "easeOut" }}
                      className="h-full rounded-full"
                      style={{ background: `linear-gradient(to right, ${INDIGO.accent}, ${INDIGO.glow})`, boxShadow: `0 0 12px ${INDIGO.accent}88` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>

        {/* Growth chart */}
        <motion.div initial={{ opacity: 0, x: 20 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <Card className="p-6 h-full relative overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: `${INDIGO.accent}33`, border: `1px solid ${INDIGO.accent}55` }}>
                  <Network className="w-4 h-4" style={{ color: INDIGO.glow }} />
                </div>
                <div className="text-sm font-semibold text-white" style={fontHead}>Community Growth</div>
              </div>
              <div className="text-[10px] tracking-wider uppercase text-emerald-400 font-bold" style={fontBody}>+12.4K this month</div>
            </div>
            <div className="relative h-48 mt-6">
              <svg viewBox="0 0 300 140" className="w-full h-full" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={INDIGO.accent} stopOpacity="0.5" />
                    <stop offset="100%" stopColor={INDIGO.accent} stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="growthLine" x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={INDIGO.accent} />
                    <stop offset="100%" stopColor={INDIGO.glow} />
                  </linearGradient>
                </defs>
                <motion.path
                  d="M0,120 L40,108 L80,95 L120,82 L160,68 L200,48 L240,30 L300,12 L300,140 L0,140 Z"
                  fill="url(#growthFill)"
                  initial={{ opacity: 0 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1, delay: 0.4 }}
                />
                <motion.path
                  d="M0,120 L40,108 L80,95 L120,82 L160,68 L200,48 L240,30 L300,12"
                  fill="none"
                  stroke="url(#growthLine)"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  whileInView={{ pathLength: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 1.4, ease: "easeOut" }}
                  style={{ filter: `drop-shadow(0 0 6px ${INDIGO.accent})` }}
                />
                {[[40,108],[80,95],[120,82],[160,68],[200,48],[240,30],[300,12]].map(([x,y], i) => (
                  <motion.circle
                    key={i}
                    cx={x} cy={y} r="3"
                    fill={INDIGO.glow}
                    initial={{ scale: 0 }}
                    whileInView={{ scale: 1 }}
                    viewport={{ once: true }}
                    transition={{ delay: 0.5 + i * 0.08, type: "spring", stiffness: 300 }}
                  />
                ))}
              </svg>
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-[10px] text-white/40 tracking-wider" style={fontBody}>
                {["J","F","M","A","M","J","J","A"].map((m) => <span key={m}>{m}</span>)}
              </div>
            </div>
            <div className="mt-4 flex items-center gap-4 text-xs text-white/55" style={fontBody}>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full" style={{ background: INDIGO.glow }} /> Ambassadors</span>
              <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400" /> 8 months · 4.2× growth</span>
            </div>
          </Card>
        </motion.div>
      </div>

      {/* Movement banner */}
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        whileInView={{ opacity: 1, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="max-w-3xl mx-auto mt-16 text-center"
      >
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-semibold tracking-wider uppercase mb-4"
          style={{ background: `linear-gradient(135deg, ${INDIGO.accent}22, ${INDIGO.glow}22)`, border: `1px solid ${INDIGO.accent}55`, color: INDIGO.glow, ...fontBody }}>
          <Sparkles className="w-3.5 h-3.5" /> The movement is here
        </div>
        <p className="text-2xl md:text-3xl font-semibold leading-tight" style={fontHead}>
          <span className="text-white">Join India's </span>
          <span style={{ background: `linear-gradient(135deg, ${INDIGO.glow}, ${INDIGO.accentSoft})`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>
            next-generation AI student movement.
          </span>
        </p>
      </motion.div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   HOW IT WORKS — 6-step premium flow
   ═════════════════════════════════════════════════════════════════════ */

interface StepItem {
  icon: React.ElementType;
  title: string;
  desc: string;
}

const StepCard = ({ step, index }: { step: StepItem; index: number }) => {
  const [hover, setHover] = useState(false);
  const rotateX = useSpring(0, { stiffness: 300, damping: 25 });
  const rotateY = useSpring(0, { stiffness: 300, damping: 25 });

  const handleMove = (e: React.MouseEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - 0.5;
    const y = (e.clientY - r.top) / r.height - 0.5;
    rotateX.set(y * -10);
    rotateY.set(x * 10);
  };

  const handleLeave = () => {
    rotateX.set(1);
    rotateY.set(0);
    setHover(false);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 40, scale: 0.95 }}
      whileInView={{ opacity: 1, y: 0, scale: 1 }}
      viewport={{ once: true, margin: "-60px" }}
      transition={{ duration: 0.65, delay: index * 0.1, ease: [0.22, 1, 0.36, 1] }}
      className="relative"
      style={{ perspective: 900 }}
      onMouseEnter={() => setHover(true)}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: "preserve-3d" }}
        className="relative rounded-2xl border backdrop-blur-xl p-6 md:p-7 overflow-hidden group"
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
      >
        {/* Glass surface */}
        <div
          className="absolute inset-_0 rounded-2xl"
          style={{
            background: `linear-gradient(145deg, ${INDIGO.surface}e6 0%, ${INDIGO.surface}99 100%)`,
            border: `1px solid ${INDIGO.accent}30`,
            boxShadow: `0 1px 0 rgba(255,255,255,0.03) inset, 0 24px 60px -30px ${INDIGO.accent}40`,
          }}
        />
        {/* Animated gradient border */}
        <div
          className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
          style={{
            padding: 1.5,
            background: `linear-gradient(135deg, ${INDIGO.accent}aa, ${INDIGO.glow}88, ${INDIGO.accent}aa)`,
            mask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)",
            maskComposite: "exclude",
            WebkitMaskComposite: "xor",
          }}
        />
        {/* Hover radial glow */}
        <div
          className="absolute inset-0 rounded-2xl opacity- 0 group-hover:opacity-100 transition-opacity duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(circle at 50% 0%, ${INDIGO.accent}22, transparent 70%)`,
          }}
        />
        {/* Shine sweep */}
        <motion.div
          className="absolute inset-0 opacity-0 group-hover:opacity-100 pointer-events-none"
          initial={{ x: "-100%" }}
          whileHover={{ x: "100%" }}
          transition={{ duration: 0.9, ease: "easeInOut" }}
          style={{
            background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)",
          }}
        />

        {/* Content */}
        <div className="relative z-10 flex flex-col items-center text-center">
          {/* Step number badge + icon container */}
          <div className="relative mb-5">
            <motion.div
              className="relative w-[72px] h-[72px] rounded-2xl flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.accent}30, ${INDIGO.mid}80)`,
                border: `1px solid ${INDIGO.accent}55`,
                boxShadow: hover
                  ? `0 12px 40px -12px ${INDIGO.accent}aa, 1nset 0 1px 0 rgba(255,255,255,0.08)`
                  : `0 8px 30px -10px ${INDIGO.accent}60`,
              }}
              animate={{ scale: hover ? 1.08 : 1 }}
              transition={{ type: "spring", stiffness: 300, damping: 18 }}
            >
              <step.icon className="w-7 h-7" style={{ color: INDIGO.glow }} />
              {/* Orbiting dot */}
              <motion.div
                className="absolute -top-1 -right-1 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white"
                style={{ background: INDIGO.accent, ...fontHead }}
                animate={{ scale: hover ? [1, 1.2, 1] : 1 }}
                transition={{ duration: 0.6 }}
              >
                {index + 1}
              </motion.div>
            </motion.div>
            {/* Glow ring on hover */}
            <motion.div
              className="absolute inset-0 rounded-2xl pointer-events-none"
              animate={{ opacity: hover ? 1 : 1 }}
              style={{
                boxShadow: `0 0 30px ${INDIGO.accent}66`,
              }}
            />
          </div>

          {/* Title */}
          <h4
            className="text-lg font-semibold text-white mb-2 tracking-tight"
            style={fontHead}
          >
            {step.title}
          </h4>

          {/* Description */}
          <p className="text-sm text-white/55 leading-relaxed max-w-[220px]" style={fontBody}>
            {step.desc}
          </p>
        </div>

        {/* Watermark step number */}
        <div
          className="absolute -bottom-2 -right-2 text-[5rem] font-bold leading-none pointer-events-none select-none opacity-[0.04]"
          style={{
            fontFamily: "'Space Grotesk', system-ui, sans-serif",
            background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`,
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
          }}
        >
          {String(index + 1).padStart(2, "0")}
        </div>
      </motion.div>
    </motion.div>
  );
};

const Path = () => {
  const steps: StepItem[] = [
    { icon: Send, title: "Apply Online", desc: "Complete the 90-second form. No application fee required." },
    { icon: Users, title: "Join Community", desc: "Get instant access to India's largest AI student network." },
    { icon: Brain, title: "Get AI Training", desc: "Attend exclusive AI bootcamps, mentorship sessions & workshops." },
    { icon: Crown, title: "Become Campus Leader", desc: "Get officially recognized as the AI leader on your campus." },
    { icon: Calendar, title: "Organize Workshops", desc: "Plan and host AI workshops, hackathons & awareness events." },
    { icon: Network, title: "Grow Your Network", desc: "Connect with founders, mentors & thousands of AI enthusiasts." },
  ];

  return (
    <Section id="how-it-works" className="py-24 md:py-32">
      {/* Background glow */}
      <div
        aria-hidden
        className="absolute left-1/2 -translate-x-1/2 top-1/3 w-[50rem] h-[30rem] rounded-full pointer-events-none opacity-40"
        style={{
          background: `radial-gradient(ellipse, ${INDIGO.accent}22 0%, transparent 70%)`,
          filter: "blur(60px)",
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-20 max-w-2xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <Eyebrow>How It Works</Eyebrow>
          </motion.div>
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.7, delay: 0.1 }}
          >
            <Heading>Your journey to AI leadership.</Heading>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 text-white/55 text-lg leading-relaxed"
            style={fontBody}
          >
            Six simple steps from application to running India's most impactful campus AI community.
          </motion.p>
        </div>

        {/* Desktop: Horizontal flow with connecting path */}
        <div className="hidden lg:block relative">
          {/* Animated connecting line */}
          <svg
            className="absolute top-[60px] left-[8%] right-[8%] h-[4px] w-[84%] pointer-events-none"
            preserveAspectRatio="none"
            viewBox="0 0 1000 4"
          >
            <defs>
              <linearGradient id="flowLine" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={`${INDIGO.accent}00`} />
                <stop offset="15%" stopColor={`${INDIGO.accent}88`} />
                <stop offset="50%" stopColor={`${INDIGO.glow}aa`} />
                <stop offset="85%" stopColor={`${INDIGO.accent}88`} />
                <stop offset="100%" stopColor={`${INDIGO.accent}00`} />
              </linearGradient>
            </defs>
            <motion.line
              x1="0" y1="2" x2="1000" y2="2"
              stroke="url(#flowLine)"
              strokeWidth="2"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 1 }}
              whileInView={{ pathLength: 1, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2, delay: 0.3, ease: "easeInOut" }}
            />
            {/* Animated pulse dot traveling along the line */}
            <motion.circle
              r="5"
              fill={INDIGO.glow}
              filter="url(#glow)"
              initial={{ cx: 0, opacity: 1 }}
              whileInView={{ cx: 1000, opacity: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 2.5, delay: 0.8, ease: "easeInOut" }}
            >
              <animate
                attributeName="opacity"
                values="0;1;0"
                dur="2.5s"
                begin="0.8s"
              />
            </motion.circle>
            <defs>
              <filter id="glow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
          </svg>

          {/* Steps grid */}
          <div className="grid grid-cols-6 gap-5">
            {steps.map((step, i) => (
              <StepCard key={step.title} step={step} index={i} />
            ))}
          </div>
        </div>

        {/* Tablet: 3x2 grid with staggered line */}
        <div className="hidden md:grid lg:hidden grid-cols-3 gap-6 relative">
          {/* Row 1 connector */}
          <div
            className="absolute top-[52px] left-[12%] right-[12%] h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${INDIGO.accent}66, transparent)` }}
          />
          {/* Row 2 connector */}
          <div
            className="absolute top-[calc(50%+52px)] left-[12%] right-[12%] h-[2px]"
            style={{ background: `linear-gradient(90deg, transparent, ${INDIGO.accent}66, transparent)` }}
          />
          {steps.map((step, i) => (
            <StepCard key={step.title} step={step} index={i} />
          ))}
        </div>

        {/* Mobile: Vertical timeline */}
        <div className="md:hidden relative">
          {/* Vertical line */}
          <motion.div
            className="absolute left-8 top-0 bottom-0 w-[2px]"
            style={{ background: `linear-gradient(to bottom, transparent, ${INDIGO.accent}aa, transparent)` }}
            initial={{ scaleY: 0 }}
            whileInView={{ scaleY: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
          <div className="space-y-6">
            {steps.map((step, i) => (
              <motion.div
                key={step.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                className="relative pl-20"
              >
                {/* Timeline node */}
                <motion.div
                  className="absolute left-6 top-5 w-5 h-5 rounded-full"
                  style={{
                    background: INDIGO.accent,
                    boxShadow: `0 0 20px ${INDIGO.accent}aa`,
                  }}
                  initial={{ scale: 1 }}
                  whileInView={{ scale: [1, 1.3, 1] }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: i * 0.1 + 0.2 }}
                />
                {/* Card */}
                <div
                  className="relative rounded-xl border backdrop-blur-xl p-5 overflow-hidden"
                  style={{
                    background: `linear-gradient(145deg, ${INDIGO.surface}e6, ${INDIGO.surface}99)`,
                    borderColor: `${INDIGO.accent}30`,
                    boxShadow: `0 1px 0 rgba(255,255,255,0.03) inset, 0 16px 40px -24px ${INDIGO.accent}35`,
                  }}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${INDIGO.accent}30, ${INDIGO.mid}80)`,
                        border: `1px solid ${INDIGO.accent}55`,
                      }}
                    >
                      <step.icon className="w-5 h-5" style={{ color: INDIGO.glow }} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white"
                          style={{ background: INDIGO.accent }}
                        >
                          Step {i + 1}
                        </span>
                      </div>
                      <h4 className="text-base font-semibold text-white" style={fontHead}>{step.title}</h4>
                    </div>
                  </div>
                  <p className="mt-2 text-sm text-white/50" style={fontBody}>{step.desc}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   LEADERBOARD & GAMIFICATION
   ═════════════════════════════════════════════════════════════════════ */
const TOP_AMBASSADORS = [
  { rank: 1, name: "Aarav Mehta", college: "IIT Delhi", city: "Delhi", xp: 9840, workshops: 14, reach: "3.2K", streak: 42, badge: "Legend", avatar: "AM", hue: "#fbbf24" },
  { rank: 2, name: "Ishita Rao", college: "BITS Pilani", city: "Pilani", xp: 8920, workshops: 12, reach: "2.8K", streak: 36, badge: "Pioneer", avatar: "IR", hue: "#e5e7eb" },
  { rank: 3, name: "Karthik Nair", college: "NIT Trichy", city: "Trichy", xp: 8410, workshops: 11, reach: "2.4K", streak: 31, badge: "Trailblazer", avatar: "KN", hue: "#f59e0b" },
  { rank: 4, name: "Sneha Kapoor", college: "DU North", city: "Delhi", xp: 7320, workshops: 9, reach: "1.9K", streak: 24, badge: "Rising Star", avatar: "SK", hue: "#a78bfa" },
  { rank: 5, name: "Rohan Iyer", college: "IIIT Hyderabad", city: "Hyderabad", xp: 6890, workshops: 8, reach: "1.7K", streak: 22, badge: "Catalyst", avatar: "RI", hue: "#60a5fa" },
];

const TOP_CITIES = [
  { city: "Bengaluru", ambassadors: 184, events: 92, growth: 38, color: "#10b981" },
  { city: "Delhi NCR", ambassadors: 162, events: 81, growth: 32, color: "#0d7a5f" },
  { city: "Hyderabad", ambassadors: 128, events: 64, growth: 41, color: "#34d399" },
  { city: "Mumbai", ambassadors: 119, events: 58, growth: 27, color: "#06b6d4" },
  { city: "Pune", ambassadors: 96, events: 47, growth: 33, color: "#c9a84c" },
];

const REWARDS = [
  { icon: Gift, title: "Swag Kit", desc: "ACRY hoodie, stickers & limited drop merch.", tier: "Tier 1 · 1K XP", glow: "#10b981" },
  { icon: Award, title: "Verified Certificate", desc: "LinkedIn-ready certificate + founder signature.", tier: "Tier 2 · 3K XP", glow: "#0d7a5f" },
  { icon: Briefcase, title: "Internship Track", desc: "Priority access to ACRY internship & roles.", tier: "Tier 3 · 5K XP", glow: "#c9a84c" },
  { icon: Gem, title: "Founder's Circle", desc: "1:1 mentorship, equity grants & alumni board.", tier: "Tier 4 · 8K XP", glow: "#fbbf24" },
];

const BADGES = [
  { icon: Flame, label: "Streak Master", color: "#f97316" },
  { icon: Brain, label: "AI Sensei", color: "#8b5cf6" },
  { icon: Users, label: "Community Hero", color: "#06b6d4" },
  { icon: Mic, label: "Workshop Pro", color: "#ec4899" },
  { icon: Rocket, label: "Launchpad", color: "#10b981" },
  { icon: Crown, label: "Campus King", color: "#fbbf24" },
];

const RankMedal = ({ rank }: { rank: number }) => {
  const palettes: Record<number, [string, string]> = {
    1: ["#fbbf24", "#f59e0b"],
    2: ["#e5e7eb", "#9ca3af"],
    3: ["#f59e0b", "#b45309"],
  };
  const [a, b] = palettes[rank] || [INDIGO.accent, INDIGO.glow];
  return (
    <div className="relative w-12 h-12 shrink-0">
      <motion.div
        className="absolute inset-0 rounded-xl"
        style={{ background: `radial-gradient(circle at 50% 50%, ${a}55, transparent 70%)` }}
        animate={{ scale: [1, 1.25, 1], opacity: [0.6, 1, 0.6] }}
        transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
      />
      <div
        className="relative w-full h-full rounded-xl flex items-center justify-center font-bold text-base"
        style={{
          background: `linear-gradient(135deg, ${a}, ${b})`,
          color: rank <= 3 ? "#1a1a1a" : "#fff",
          boxShadow: `0 8px 24px -8px ${a}99, inset 0 1px 0 rgba(255,255,255,0.35)`,
          fontFamily: fontHead.fontFamily,
        }}
      >
        {rank <= 3 ? <Trophy className="w-5 h-5" /> : `#${rank}`}
      </div>
    </div>
  );
};

const Leaderboard = () => {
  return (
    <Section id="leaderboard" className="relative overflow-hidden">
      {/* Futuristic backdrop */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute -top-32 left-1/2 -translate-x-1/2 w-[900px] h-[500px] rounded-full opacity-40 blur-3xl"
          style={{ background: `radial-gradient(circle, ${INDIGO.accent}55, transparent 65%)` }}
        />
        <div
          className="absolute inset-0 opacity-[0.08]"
          style={{
            backgroundImage: `linear-gradient(${INDIGO.glow}33 1px, transparent 1px), linear-gradient(90deg, ${INDIGO.glow}33 1px, transparent 1px)`,
            backgroundSize: "60px 60px",
            maskImage: "radial-gradient(ellipse 80% 60% at 50% 40%, black 30%, transparent 75%)",
          }}
        />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-6">
        {/* Header */}
        <div className="text-center mb-16 max-w-2xl mx-auto">
          <motion.div initial={{ opacity: 0, y: 12 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
            <Eyebrow>Leaderboard · Live Rankings</Eyebrow>
          </motion.div>
          <motion.div initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.7, delay: 0.1 }}>
            <Heading>Compete. Climb. Get crowned.</Heading>
          </motion.div>
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mt-5 text-white/55 text-lg leading-relaxed"
            style={fontBody}
          >
            Earn XP for every workshop, post and student onboarded. Climb tiers, unlock rewards and put your campus on the map.
          </motion.p>
        </div>

        {/* Top Ambassadors + Top Cities */}
        <div className="grid lg:grid-cols-3 gap-6 mb-12">
          {/* Top Ambassadors panel — spans 2 cols */}
          <div className="lg:col-span-2 relative">
            <div
              className="relative rounded-2xl border backdrop-blur-xl overflow-hidden"
              style={{
                background: `linear-gradient(145deg, ${INDIGO.surface}f0, ${INDIGO.surface}88)`,
                borderColor: `${INDIGO.accent}40`,
                boxShadow: `0 30px 80px -30px ${INDIGO.accent}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
              }}
            >
              {/* Animated top border */}
              <motion.div
                className="absolute top-0 left-0 h-[2px] w-full"
                style={{ background: `linear-gradient(90deg, transparent, ${INDIGO.glow}, transparent)` }}
                animate={{ x: ["-100%", "100%"] }}
                transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
              />

              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`, boxShadow: `0 6px 20px ${INDIGO.accent}66` }}
                  >
                    <Trophy className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white" style={fontHead}>Top Ambassadors</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/45" style={fontBody}>This Month</div>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="relative flex h-2 w-2">
                    <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping opacity-75" />
                    <span className="relative rounded-full bg-emerald-400 w-2 h-2" />
                  </span>
                  <span className="text-[10px] uppercase tracking-[0.2em] font-bold text-emerald-300" style={fontBody}>Live</span>
                </div>
              </div>

              <div className="px-3 pb-4 space-y-2">
                {TOP_AMBASSADORS.map((a, i) => (
                  <motion.div
                    key={a.name}
                    initial={{ opacity: 0, x: -12 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true, margin: "-40px" }}
                    transition={{ duration: 0.45, delay: i * 0.06 }}
                    whileHover={{ scale: 1.01, x: 2 }}
                    className="group relative flex items-center gap-4 px-3 py-3 rounded-xl border transition-colors"
                    style={{
                      background: a.rank === 1 ? `linear-gradient(90deg, ${a.hue}18, transparent 70%)` : "transparent",
                      borderColor: a.rank === 1 ? `${a.hue}55` : "transparent",
                    }}
                  >
                    <RankMedal rank={a.rank} />
                    {/* Avatar */}
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                      style={{
                        background: `linear-gradient(135deg, ${a.hue}, ${INDIGO.accent})`,
                        color: "#fff",
                        boxShadow: `0 4px 16px -4px ${a.hue}77`,
                        fontFamily: fontHead.fontFamily,
                      }}
                    >
                      {a.avatar}
                    </div>
                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <div className="text-sm font-semibold text-white truncate" style={fontHead}>{a.name}</div>
                        <span
                          className="text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider"
                          style={{ background: `${a.hue}22`, color: a.hue, border: `1px solid ${a.hue}44` }}
                        >
                          {a.badge}
                        </span>
                      </div>
                      <div className="text-[11px] text-white/45 truncate" style={fontBody}>
                        {a.college} · {a.city}
                      </div>
                    </div>
                    {/* Stats */}
                    <div className="hidden sm:flex items-center gap-4 text-right">
                      <div className="flex items-center gap-1 text-[11px] text-orange-300" style={fontBody}>
                        <Flame className="w-3 h-3" />{a.streak}d
                      </div>
                      <div className="hidden md:block text-[11px] text-white/50" style={fontBody}>
                        <span className="text-white font-semibold">{a.workshops}</span> events
                      </div>
                      <div className="hidden md:block text-[11px] text-white/50" style={fontBody}>
                        <span className="text-white font-semibold">{a.reach}</span> reach
                      </div>
                    </div>
                    {/* XP pill */}
                    <div
                      className="px-3 py-1.5 rounded-lg text-[11px] font-bold tabular-nums"
                      style={{
                        background: `linear-gradient(135deg, ${INDIGO.accent}33, ${INDIGO.glow}22)`,
                        border: `1px solid ${INDIGO.accent}55`,
                        color: INDIGO.glow,
                        fontFamily: fontHead.fontFamily,
                      }}
                    >
                      {a.xp.toLocaleString()} XP
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>

          {/* Top Cities panel */}
          <div className="relative">
            <div
              className="relative rounded-2xl border backdrop-blur-xl overflow-hidden h-full"
              style={{
                background: `linear-gradient(145deg, ${INDIGO.surface}f0, ${INDIGO.surface}88)`,
                borderColor: `${INDIGO.accent}40`,
                boxShadow: `0 30px 80px -30px ${INDIGO.accent}55, inset 0 1px 0 rgba(255,255,255,0.05)`,
              }}
            >
              <div className="flex items-center justify-between px-6 pt-6 pb-4">
                <div className="flex items-center gap-3">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center"
                    style={{ background: `linear-gradient(135deg, ${INDIGO.glow}, ${INDIGO.accent})`, boxShadow: `0 6px 20px ${INDIGO.accent}66` }}
                  >
                    <MapPin className="w-4 h-4 text-white" />
                  </div>
                  <div>
                    <div className="text-base font-semibold text-white" style={fontHead}>Top Cities</div>
                    <div className="text-[10px] uppercase tracking-[0.2em] text-white/45" style={fontBody}>By Activity</div>
                  </div>
                </div>
              </div>
              <div className="px-5 pb-5 space-y-4">
                {TOP_CITIES.map((c, i) => (
                  <motion.div
                    key={c.city}
                    initial={{ opacity: 0, y: 8 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.45, delay: i * 0.08 }}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-bold text-white/40 tabular-nums" style={fontHead}>0{i + 1}</span>
                        <span className="text-sm font-semibold text-white" style={fontHead}>{c.city}</span>
                      </div>
                      <div className="flex items-center gap-1 text-[10px] text-emerald-300" style={fontBody}>
                        <TrendingUp className="w-3 h-3" />+{c.growth}%
                      </div>
                    </div>
                    <div className="relative h-2 rounded-full overflow-hidden" style={{ background: `${INDIGO.accent}15` }}>
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: `linear-gradient(90deg, ${c.color}, ${INDIGO.glow})`, boxShadow: `0 0 12px ${c.color}88` }}
                        initial={{ width: 0 }}
                        whileInView={{ width: `${(c.ambassadors / TOP_CITIES[0].ambassadors) * 100}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1, delay: 0.2 + i * 0.08, ease: "easeOut" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-1.5 text-[10px] text-white/45" style={fontBody}>
                      <span><span className="text-white/80 font-semibold">{c.ambassadors}</span> ambassadors</span>
                      <span><span className="text-white/80 font-semibold">{c.events}</span> events</span>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Rewards tier */}
        <div className="mb-10 text-center">
          <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold mb-2" style={fontBody}>Unlock Rewards</div>
          <div className="text-2xl md:text-3xl font-bold text-white" style={fontHead}>Climb the tiers. Claim the loot.</div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-12">
          {REWARDS.map((r, i) => (
            <motion.div
              key={r.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: "-40px" }}
              transition={{ duration: 0.55, delay: i * 0.08 }}
              whileHover={{ y: -6 }}
              className="group relative rounded-2xl border backdrop-blur-xl p-5 overflow-hidden"
              style={{
                background: `linear-gradient(145deg, ${INDIGO.surface}e6, ${INDIGO.surface}77)`,
                borderColor: `${r.glow}40`,
                boxShadow: `0 20px 50px -20px ${r.glow}55`,
              }}
            >
              {/* Glow halo */}
              <div
                className="absolute -top-16 -right-16 w-40 h-40 rounded-full opacity-30 group-hover:opacity-60 blur-2xl transition-opacity duration-500"
                style={{ background: `radial-gradient(circle, ${r.glow}, transparent 70%)` }}
              />
              {/* Shine sweep */}
              <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none"
                style={{ background: `linear-gradient(115deg, transparent 30%, ${r.glow}33 50%, transparent 70%)` }}
                animate={{ x: ["-100%", "120%"] }}
                transition={{ duration: 1.8, repeat: Infinity, ease: "linear" }}
              />
              <div className="relative">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center mb-4"
                  style={{
                    background: `linear-gradient(135deg, ${r.glow}33, ${INDIGO.mid}99)`,
                    border: `1px solid ${r.glow}66`,
                    boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1), 0 8px 24px -8px ${r.glow}88`,
                  }}
                >
                  <r.icon className="w-5 h-5" style={{ color: r.glow }} />
                </div>
                <div className="text-base font-semibold text-white mb-1.5" style={fontHead}>{r.title}</div>
                <p className="text-[12px] text-white/55 leading-relaxed mb-4" style={fontBody}>{r.desc}</p>
                <div
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[10px] font-bold uppercase tracking-wider"
                  style={{ background: `${r.glow}1a`, color: r.glow, border: `1px solid ${r.glow}44` }}
                >
                  <Sparkles className="w-3 h-3" />{r.tier}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Recognition badges */}
        <div
          className="relative rounded-2xl border backdrop-blur-xl p-6 md:p-8 overflow-hidden"
          style={{
            background: `linear-gradient(145deg, ${INDIGO.surface}f0, ${INDIGO.surface}88)`,
            borderColor: `${INDIGO.accent}40`,
            boxShadow: `0 30px 80px -30px ${INDIGO.accent}55`,
          }}
        >
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 mb-6">
            <div>
              <div className="text-[10px] uppercase tracking-[0.3em] text-white/40 font-semibold mb-2" style={fontBody}>Recognition Badges</div>
              <div className="text-xl md:text-2xl font-bold text-white" style={fontHead}>Collect them all. Flex them everywhere.</div>
            </div>
            <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-wider self-start"
              style={{ background: `${INDIGO.accent}1a`, color: INDIGO.glow, border: `1px solid ${INDIGO.accent}44` }}
            >
              <Medal className="w-3 h-3" />24+ badges to unlock
            </div>
          </div>

          <div className="grid grid-cols-3 sm:grid-cols-6 gap-4">
            {BADGES.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, scale: 0.8 }}
                whileInView={{ opacity: 1, scale: 1 }}
                viewport={{ once: true, margin: "-40px" }}
                transition={{ duration: 0.4, delay: i * 0.06, type: "spring", stiffness: 220, damping: 16 }}
                whileHover={{ y: -4, scale: 1.05 }}
                className="group relative flex flex-col items-center text-center"
              >
                <div className="relative w-16 h-16 mb-2">
                  <motion.div
                    className="absolute inset-0 rounded-full"
                    style={{ background: `radial-gradient(circle, ${b.color}55, transparent 65%)` }}
                    animate={{ scale: [1, 1.2, 1], opacity: [0.5, 1, 0.5] }}
                    transition={{ duration: 2.5 + i * 0.2, repeat: Infinity, ease: "easeInOut" }}
                  />
                  <div
                    className="relative w-full h-full rounded-full flex items-center justify-center"
                    style={{
                      background: `conic-gradient(from 180deg, ${b.color}, ${INDIGO.accent}, ${b.color})`,
                      padding: "2px",
                    }}
                  >
                    <div
                      className="w-full h-full rounded-full flex items-center justify-center"
                      style={{
                        background: `linear-gradient(135deg, ${INDIGO.surface}, ${INDIGO.base})`,
                        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.1)`,
                      }}
                    >
                      <b.icon className="w-6 h-6" style={{ color: b.color }} />
                    </div>
                  </div>
                </div>
                <div className="text-[11px] font-semibold text-white/80" style={fontHead}>{b.label}</div>
              </motion.div>
            ))}
          </div>
        </div>
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
          {submitting ? "Submitting…" : requiredValid ? "Apply Now & Become an AI Leader" : "Complete required fields"}
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
              href="https://wa.me/919821830895?text=Hi%20ACRY%20AI%2C%20I%20just%20applied%20for%20the%20Campus%20Ambassador%20Program."
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
                          ) : f.name === "phone" ? (
                            <div
                              className="w-full rounded-xl flex items-center pr-10 transition-all overflow-hidden"
                              style={{
                                background: `${INDIGO.base}80`,
                                border: `1px solid ${ok ? INDIGO.glow + "80" : INDIGO.accent + "33"}`,
                              }}
                            >
                              <span
                                className="pl-4 pr-2 py-3 text-white/70 select-none border-r"
                                style={{ borderColor: INDIGO.accent + "33", ...fontBody }}
                              >
                                +91
                              </span>
                              <input
                                type="tel"
                                inputMode="numeric"
                                autoComplete="tel-national"
                                maxLength={10}
                                value={v.replace(/^\+?91/, "").replace(/\D/g, "").slice(0, 10)}
                                onChange={(e) => {
                                  const digits = e.target.value.replace(/\D/g, "").slice(0, 10);
                                  setData({ ...data, [f.name]: digits ? `+91${digits}` : "" });
                                }}
                                placeholder="98765 43210"
                                className="flex-1 bg-transparent px-3 py-3 text-white placeholder:text-white/30 focus:outline-none"
                                style={{ ...fontBody }}
                              />
                            </div>
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
                  {submitting
                    ? "Submitting..."
                    : step === steps.length - 1
                    ? "Apply Now & Become an AI Leader"
                    : "Continue"}
                  {!submitting && <ArrowRight className="w-4 h-4" />}
                </PrimaryCTA>
              </div>

              {/* WhatsApp alternative */}
              <div className="mt-6 pt-5 border-t flex flex-col sm:flex-row items-center justify-between gap-3" style={{ borderColor: `${INDIGO.accent}1f` }}>
                <div className="text-[11px] text-white/50 text-center sm:text-left" style={fontBody}>
                  Prefer chatting? Send your details over WhatsApp — same review queue.
                </div>
                <a
                  href={`https://wa.me/919821830895?text=${encodeURIComponent(
                    `Hi ACRY AI, I want to apply for the Campus Ambassador Program.\n\nName: ${data.full_name || "-"}\nPhone: ${data.phone || "-"}\nEmail: ${data.email || "-"}\nCollege: ${data.college || "-"}\nCity: ${data.city || "-"}\nCourse: ${data.course || "-"}\nInstagram: ${data.instagram || "-"}\nLinkedIn: ${data.linkedin || "-"}\n\nWhy join: ${data.why_join || "-"}\nLeadership: ${data.leadership_experience || "-"}`,
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-xs font-semibold text-white transition-transform hover:scale-[1.03] shrink-0"
                  style={{
                    background: "linear-gradient(135deg, #25D366, #128C7E)",
                    boxShadow: "0 8px 24px -8px rgba(37,211,102,0.55)",
                    ...fontBody,
                  }}
                >
                  <MessageCircle className="w-3.5 h-3.5" /> Apply via WhatsApp
                </a>
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
    {
      q: "Who can apply?",
      a: "Any college, university or coaching student in India — UG, PG, JEE/NEET aspirants, AI enthusiasts. All streams welcome.",
      icon: Users,
      color: "#c9a84c",
    },
    {
      q: "Is it free?",
      a: "100% free. No application fee, no hidden cost, ever.",
      icon: Gift,
      color: "#34d399",
    },
    {
      q: "Will I get certificates?",
      a: "Yes — an official Campus Ambassador certificate and a verified performance certificate for top performers.",
      icon: Award,
      color: "#fbbf24",
    },
    {
      q: "What are the benefits?",
      a: "AI training, leadership experience, certificates, networking, personal branding, internship opportunities, founder mentorship, campus recognition, and exclusive workshop access.",
      icon: Sparkles,
      color: "#8b5cf6",
    },
    {
      q: "Is this remote?",
      a: "Hybrid. Training and community are remote. Workshops and meetups happen on your campus or city.",
      icon: Globe,
      color: "#06b6d4",
    },
    {
      q: "How much time is needed?",
      a: "About 4–6 hours per week. Flexible around your studies and exams.",
      icon: Clock,
      color: "#fb923c",
    },
    {
      q: "Will there be workshops & events?",
      a: "Yes — monthly AI workshops, quarterly summits, plus events you organise with our full support and resources.",
      icon: Calendar,
      color: "#f472b6",
    },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq">
      <div className="text-center mb-12 max-w-2xl mx-auto">
        <Eyebrow>FAQ</Eyebrow>
        <Heading>Got questions?</Heading>
        <motion.p
          initial={{ opacity: 1 }}
          className="mt-3 text-white/55 text-sm"
          style={fontBody}
        >
          Everything you need to know before applying.
        </motion.p>
      </div>
      <div className="max-w-2xl mx-auto space-y-3">
        {faqs.map((f, i) => {
          const isOpen = open === i;
          const Icon = f.icon;
          return (
            <motion.div
              key={f.q}
              initial={{ opacity: 1, y: 0 }}
              whileInView={{ opacity: 1, y: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.3, delay: i * 0.06 }}
            >
              <Card
                className="overflow-hidden group"
                interactive={!isOpen}
              >
                {/* Active left border accent */}
                <div
                  className="absolute left-0 top-0 bottom-0 w-1 transition-opacity duration-300"
                  style={{
                    background: `linear-gradient(to bottom, ${f.color}, ${INDIGO.accent})`,
                    opacity: isOpen ? 1 :  0.2,
                  }}
                />
                <button
                  onClick={() => setOpen(isOpen ? null : i)}
                  className="w-full px-6 py-5 flex items-center gap-4 text-left"
                >
                  {/* Icon */}
                  <div
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all duration-300"
                    style={{
                      background: isOpen ? `${f.color}22` : `${INDIGO.accent}1a`,
                      border: `1px solid ${isOpen ? f.color + "44" : INDIGO.accent + "22"}`,
                    }}
                  >
                    <Icon
                      className="w-5 h-5 transition-colors duration-300"
                      style={{ color: isOpen ? f.color : INDIGO.glow }}
                    />
                  </div>
                  <span className="flex-1 font-semibold text-white pr-4" style={fontHead}>{f.q}</span>
                  <motion.div
                    animate={{ rotate: isOpen ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                  >
                    <ChevronDown className="w-5 h-5 flex-shrink-1" style={{ color: INDIGO.glow }} />
                  </motion.div>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="content"
                      initial={{ height: 1, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.35, ease: [0.25, 0.46, 0.45, 0.94] }}
                      className="overflow-hidden"
                    >
                      <div className="px-6 pb-5 flex items-start gap-4">
                        <div className="w-10 flex-shrink-0" />
                        <div>
                          <p className="text-white/70 leading-relaxed mb-3" style={fontBody}>{f.a}</p>
                          <div
                            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-medium"
                            style={{
                              background: `${f.color}15`,
                              color: f.color,
                              border: `1px solid ${f.color}30`,
                              ...fontBody,
                            }}
                          >
                            <Check className="w-3 h-3" strokeWidth={3} />
                            Verified answer
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </Card>
            </motion.div>
          );
        })}
      </div>
      {/* Bottom helper */}
      <motion.div
        initial={{ opacity: 1, y: 0 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="max-w-2xl mx-auto mt-8 text-center"
      >
        <div
          className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl"
          style={{
            background: `linear-gradient(135deg, ${INDIGO.surface}cc, ${INDIGO.mid}66)`,
            border: `1px solid ${INDIGO.accent}33`,
          }}
        >
          <HelpCircle className="w-5 h-5 flex-shrink-0" style={{ color: INDIGO.glow }} />
          <span className="text-sm text-white/60" style={fontBody}>
            Still have questions?{" "}
            <a
              href="https://wa.me/919821830895?text=Hi%20ACRY%20AI%2C%20I%20have%20a%20question%20about%20the%20Campus%20Ambassador%20Program."
              target="_blank"
              rel="noopener noreferrer"
              className="text-white font-semibold hover:underline"
              style={{ color: INDIGO.glow }}
            >
              Chat on WhatsApp
            </a>
          </span>
        </div>
      </motion.div>
    </Section>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   FINAL CTA — Emotional closer with founder signature
   ═════════════════════════════════════════════════════════════════════ */
const FinalCTA = ({ scrollToForm }: { scrollToForm: () => void }) => {
  const [hovered, setHovered] = useState(false);

  return (
    <Section className="overflow-hidden">
      <Card className="relative p-10 md:p-20 text-center overflow-hidden">
        {/* Animated radial backdrop */}
        <div
          className="absolute inset-0"
          style={{ background: `radial-gradient(ellipse at center, ${INDIGO.accent}33, transparent 65%)` }}
        />
        {/* Floating dust particles */}
        <div aria-hidden className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(12)].map((_, i) => (
            <motion.span
              key={i}
              className="absolute w-1 h-1 rounded-full"
              style={{
                background: i % 3 === 1 ? INDIGO.glow : i % 3 === 2 ? INDIGO.accentSoft : INDIGO.accent,
                left: `${10 + (i * 7) % 80}%`,
                top: `${15 + (i * 13) % 70}%`,
                boxShadow: `0 0 8px ${INDIGO.glow}`,
              }}
              animate={{
                y: [0, -20, 0],
                opacity: [1, 0.4, 1],
              }}
              transition={{
                duration: 8 + (i % 5),
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.4,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 flex flex-col items-center">
          <Eyebrow>The Movement Starts Here</Eyebrow>

          {/* Headline */}
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
          >
            <Heading className="!text-5xl md:!text-7xl mb-5">
              The Future Belongs to{" "}
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: `linear-gradient(135deg, ${INDIGO.glow}, ${INDIGO.accent})` }}
              >
                AI Leaders.
              </span>
            </Heading>
          </motion.div>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 12 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1 }}
            className="text-lg md:text-xl text-white/65 max-w-xl mx-auto mb-12 leading-relaxed"
            style={fontBody}
          >
            Join the movement. Build your future. Lead your campus.
          </motion.p>

          {/* CTA Button */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: 1 }}
            className="mb-14"
          >
            <PrimaryCTA onClick={scrollToForm} large>
              <Rocket className="w-5 h-5" /> Apply Now <ArrowRight className="w-5 h-5" />
            </PrimaryCTA>
          </motion.div>

          {/* Founder signature-style visual */}
          <motion.div
            initial={{ opacity: 1, y: 0 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 1 }}
            className="relative"
            onMouseEnter={() => setHovered(true)}
            onMouseLeave={() => setHovered(false)}
          >
            <div
              className="relative rounded-2xl p-6 md:p-8 backdrop-blur-xl border"
              style={{
                background: `linear-gradient(135deg, ${INDIGO.surface}99, ${INDIGO.surface}66)`,
                borderColor: `${INDIGO.accent}30`,
                boxShadow: `0 16px 48px -12px ${INDIGO.accent}40, inset 1px 1px 0 rgba(255,255,255,0.06)`,
              }}
            >
              {/* Glow halo behind signature */}
              <motion.div
                animate={{ scale: hovered ? 1.08 : 1, opacity: hovered ? 0.6 : 0.35 }}
                transition={{ duration: 0.6 }}
                className="absolute -top-8 left-1/2 -translate-x-1/2 w-64 h-32 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(ellipse at center, ${INDIGO.glow}40, transparent 70%)`,
                  filter: "blur(20px)",
                }}
              />

              {/* Quote */}
              <p className="text-sm md:text-base text-white/80 italic mb-6 max-w-md leading-relaxed" style={fontBody}>
                "We are not just building an AI platform. We are building the leaders who will shape India's AI future. This is your invitation to be one of them."
              </p>

              {/* Signature visual */}
              <div className="flex items-center justify-center gap-4">
                <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${INDIGO.accent}40)` }} />
                <div className="flex flex-col items-center">
                  {/* Hand-drawn signature SVG */}
                  <svg
                    width="160"
                    height="40"
                    viewBox="0 0 160 40"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                    className="mb-2"
                  >
                    <motion.path
                      d="M10 30 C 15 10, 25 5, 30 20 C 35 35, 40 25, 45 18 C 50 10, 55 30, 60 25 C 65 20, 70 8, 75 15 C 80 22, 85 30, 90 20 C 95 10, 100 5, 105 15 C 110 25, 115 30, 120 22 C 125 15, 130 10, 135 18 C 140 25, 145 28, 150 20"
                      stroke={INDIGO.glow}
                      strokeWidth="2"
                      strokeLinecap="round"
                      fill="none"
                      initial={{ pathLength: 0, opacity: 0 }}
                      whileInView={{ pathLength: 1, opacity: 1 }}
                      viewport={{ once: true }}
                      transition={{ duration: 1.5, ease: "easeInOut", delay: 0.2 }}
                    />
                  </svg>
                  <span className="text-xs font-semibold tracking-[0.2em] uppercase" style={{ color: INDIGO.glow, ...fontBody }}>
                    Santosh V Chandra
                  </span>
                  <span className="text-[11px] text-white/40 mt-1" style={fontBody}>
                    Founder & CEO, ACRY.ai
                  </span>
                </div>
                <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${INDIGO.accent}40)` }} />
              </div>

              {/* Small avatar / stamp */}
              <motion.div
                animate={{ rotate: hovered ? [0, -5, 5, 1] : 0 }}
                transition={{ duration: 0.6 }}
                className="absolute -top-4 -right-4 w-12 h-12 rounded-full flex items-center justify-center border"
                style={{
                  background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.glow})`,
                  borderColor: `${INDIGO.glow}50`,
                  boxShadow: `0 4px 16px ${INDIGO.accent}60`,
                }}
              >
                <Star className="w-5 h-5 text-white" fill="white" />
              </motion.div>
            </div>
          </motion.div>
        </div>
      </Card>
    </Section>
  );
};

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
          <li><a href="https://wa.me/919821830895" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp Us</a></li>
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
const FloatingCTAs = ({ scrollToForm }: { scrollToForm: () => void }) => {
  const [showWaTip, setShowWaTip] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShowWaTip(false), 6000);
    return () => clearTimeout(t);
  }, []);
  return (
    <>
      {/* WhatsApp floating button with tooltip */}
      <div className="fixed bottom-24 md:bottom-6 right-4 z-40 flex items-center gap-2">
        <AnimatePresence>
          {showWaTip && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              className="hidden sm:block px-3 py-2 rounded-xl text-xs font-medium text-white shadow-xl"
              style={{ background: "#0f172a", border: "1px solid rgba(34,197,94,0.4)", ...fontBody }}
            >
              Chat with us on WhatsApp
            </motion.div>
          )}
        </AnimatePresence>
        <a
          href="https://wa.me/919821830895?text=Hi%20ACRY%20AI%2C%20I%20want%20to%20know%20more%20about%20the%20Campus%20Ambassador%20Program."
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => setShowWaTip(false)}
          className="relative rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-2xl shadow-green-500/40 transition-all hover:scale-110"
          style={{ width: 56, height: 56 }}
          aria-label="WhatsApp"
        >
          <MessageCircle className="w-7 h-7 text-white" />
          <span className="absolute inset-0 rounded-full ring-2 ring-green-400/60 animate-ping" />
          <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-300" />
        </a>
      </div>

      {/* Sticky mobile CTA */}
      <div
        className="fixed bottom-0 inset-x-0 z-30 md:hidden px-3 pb-[max(env(safe-area-inset-bottom),12px)] pt-3"
        style={{ background: `linear-gradient(to top, ${INDIGO.base}, ${INDIGO.base}ee 60%, transparent)` }}
      >
        <motion.button
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 120 }}
          onClick={scrollToForm}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full font-semibold text-white relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${INDIGO.accent}, ${INDIGO.accentSoft})`, boxShadow: `0 8px 24px ${INDIGO.accent}66`, ...fontBody }}
        >
          <motion.span
            animate={{ x: ["-100%", "200%"] }}
            transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
            className="absolute inset-y-0 w-1/3"
            style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.25), transparent)" }}
          />
          <Rocket className="w-4 h-4" /> Apply Now & Lead Your Campus <ArrowRight className="w-4 h-4" />
        </motion.button>
      </div>
    </>
  );
};

/* ─── Scroll progress bar (top) ─────────────────────────────────────── */
const ScrollProgress = () => {
  const { scrollYProgress } = useScroll();
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 24, mass: 0.4 });
  return (
    <motion.div
      className="fixed top-0 left-0 right-0 h-[3px] z-[60] origin-left"
      style={{
        scaleX,
        background: `linear-gradient(90deg, ${INDIGO.glow}, ${INDIGO.accent}, ${INDIGO.accentSoft})`,
        boxShadow: `0 0 12px ${INDIGO.accent}99`,
      }}
    />
  );
};

/* ─── Performance & motion preference hook ──────────────────────────── */
const usePerfMode = () => {
  const [mode, setMode] = useState<{ reduced: boolean; lite: boolean }>(() => {
    if (typeof window === "undefined") return { reduced: false, lite: false };
    const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const nav: any = navigator;
    const cores = nav.hardwareConcurrency ?? 8;
    const mem = nav.deviceMemory ?? 8;
    const saveData = nav.connection?.saveData ?? false;
    const slowNet = /(^|-)2g$/.test(nav.connection?.effectiveType ?? "");
    const lite = reduced || saveData || slowNet || cores <= 4 || mem <= 4;
    return { reduced, lite };
  });
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setMode((m) => ({ ...m, reduced: mq.matches, lite: m.lite || mq.matches }));
    mq.addEventListener?.("change", onChange);
    return () => mq.removeEventListener?.("change", onChange);
  }, []);
  return mode;
};

/* ─── Floating AI particles (page-wide subtle layer) ────────────────── */
const AIParticles = () => {
  const { reduced, lite } = usePerfMode();
  if (reduced) return null;
  const count = lite ? 6 : 18;
  const particles = Array.from({ length: count });
  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-[1]" aria-hidden>
      {particles.map((_, i) => {
        const left = (i * 53) % 100;
        const size = 2 + (i % 4);
        const dur = 14 + (i % 9);
        const delay = (i % 7) * 0.6;
        return (
          <motion.span
            key={i}
            initial={{ y: "110vh", opacity: 0 }}
            animate={{ y: "-10vh", opacity: [0, 0.7, 0.7, 0] }}
            transition={{ duration: dur, delay, repeat: Infinity, ease: "linear" }}
            className="absolute rounded-full"
            style={{
              left: `${left}%`,
              width: size,
              height: size,
              background: i % 3 === 0 ? INDIGO.glow : INDIGO.accentSoft,
              boxShadow: `0 0 ${size * 3}px ${INDIGO.accent}`,
              willChange: "transform, opacity",
            }}
          />
        );
      })}
    </div>
  );
};


/* ─── First-paint loading overlay ───────────────────────────────────── */
const LoadingOverlay = () => {
  const [show, setShow] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setShow(false), 900);
    return () => clearTimeout(t);
  }, []);
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="fixed inset-0 z-[80] flex items-center justify-center"
          style={{ background: INDIGO.base }}
        >
          <div className="relative w-20 h-20">
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full"
              style={{ border: `2px solid ${INDIGO.accent}44`, borderTopColor: INDIGO.glow }}
            />
            <motion.div
              animate={{ scale: [1, 1.15, 1], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: 1.6, repeat: Infinity }}
              className="absolute inset-2 rounded-full flex items-center justify-center"
              style={{ background: `radial-gradient(circle, ${INDIGO.accent}, ${INDIGO.mid})`, boxShadow: `0 0 30px ${INDIGO.accent}` }}
            >
              <Brain className="w-7 h-7 text-white" />
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

/* ═════════════════════════════════════════════════════════════════════
   PAGE
   ═════════════════════════════════════════════════════════════════════ */
const CampusAmbassadorBlueprint = () => {
  useFonts();
  const formRef = useRef<HTMLDivElement>(null);
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <MotionConfig reducedMotion="user">
    <div className="relative min-h-screen text-white overflow-x-hidden" style={{ background: INDIGO.base, ...fontBody }}>

      <SEO
        title="ACRY AI Campus Ambassador Program | Lead the AI Revolution"
        description="Join India's largest AI student community. Become an ACRY AI Campus Ambassador — leadership, AI training, certificates, mentorship & internship opportunities. Apply now."
        path="/campus-ambassador"
      />
      {/* JSON-LD structured data for SEO */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "EducationalOccupationalProgram",
            name: "ACRY AI Campus Ambassador Program",
            description:
              "India's biggest AI student movement. Lead your campus, get AI training, certificates, mentorship and internship opportunities.",
            provider: {
              "@type": "Organization",
              name: "ACRY AI",
              url: "https://acry.ai",
            },
            url: "https://acry.ai/campus-ambassador",
            educationalProgramMode: "online",
            occupationalCategory: "Student Leadership",
          }),
        }}
      />
      <LoadingOverlay />
      <ScrollProgress />
      <Atmosphere />
      <AIParticles />
      <CursorLight />

      <div className="relative z-10" data-analytics-page="campus-ambassador">
        <Nav scrollToForm={scrollToForm} />
        <Hero scrollToForm={scrollToForm} />
        <Trusted />
        <Benefits />
        <Role />
        {/* <Metrics /> hidden — duplicated stats already shown elsewhere */}
        <Testimonials />
        <Path />
        <Leaderboard />
        <Form formRef={formRef} />
        <FAQ />
        <FinalCTA scrollToForm={scrollToForm} />
        <PageFooter />
        <FloatingCTAs scrollToForm={scrollToForm} />
      </div>
    </div>
    </MotionConfig>
  );
};


export default CampusAmbassadorBlueprint;
