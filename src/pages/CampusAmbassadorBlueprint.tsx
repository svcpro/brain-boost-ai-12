import { useEffect, useRef, useState, useMemo } from "react";
import { motion, AnimatePresence, useScroll, useTransform, useInView, useMotionValue, useSpring } from "framer-motion";
import {
  Rocket, Play, Sparkles, Zap, Shield, Trophy, Users, GraduationCap,
  Award, Network, Briefcase, Star, MessageCircle, ArrowRight, Check,
  ChevronDown, MapPin, Calendar, TrendingUp, Brain, Mic, Globe,
  Send, User, Phone, Mail, School, BookOpen, Instagram, Linkedin,
  Heart, Crown, Flame, Target, Cpu, Terminal, Atom, Wand2,
} from "lucide-react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import SEO from "@/components/SEO";
import { z } from "zod";

/* ═══════════════════════════════════════════════════════════
   ULTRA-ADVANCED VISUAL LAYER
   ═══════════════════════════════════════════════════════════ */

/* Live neural network — canvas, particles + auto-connecting lines */
const NeuralNetCanvas = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current!;
    const ctx = c.getContext("2d")!;
    let raf = 0;
    let w = 0, h = 0, dpr = Math.min(window.devicePixelRatio || 1, 2);
    const resize = () => {
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.scale(dpr, dpr);
    };
    resize();
    window.addEventListener("resize", () => { dpr = Math.min(window.devicePixelRatio || 1, 2); resize(); });

    const count = Math.max(40, Math.min(90, Math.floor((w * h) / 22000)));
    const nodes = Array.from({ length: count }, () => ({
      x: Math.random() * w,
      y: Math.random() * h,
      vx: (Math.random() - 0.5) * 0.3,
      vy: (Math.random() - 0.5) * 0.3,
      r: Math.random() * 1.6 + 0.6,
      hue: Math.random() > 0.5 ? 280 : 190, // purple / cyan
    }));
    const mouse = { x: -9999, y: -9999 };
    const onMove = (e: MouseEvent) => {
      const rect = c.getBoundingClientRect();
      mouse.x = e.clientX - rect.left;
      mouse.y = e.clientY - rect.top;
    };
    window.addEventListener("mousemove", onMove);

    const loop = () => {
      ctx.clearRect(0, 0, w, h);
      for (const n of nodes) {
        n.x += n.vx; n.y += n.vy;
        if (n.x < 0 || n.x > w) n.vx *= -1;
        if (n.y < 0 || n.y > h) n.vy *= -1;
        // mouse repel
        const dx = n.x - mouse.x, dy = n.y - mouse.y, d = Math.hypot(dx, dy);
        if (d < 120) { n.x += (dx / d) * 0.7; n.y += (dy / d) * 0.7; }
      }
      // connections
      for (let i = 0; i < nodes.length; i++) {
        for (let j = i + 1; j < nodes.length; j++) {
          const a = nodes[i], b = nodes[j];
          const d = Math.hypot(a.x - b.x, a.y - b.y);
          if (d < 130) {
            const alpha = (1 - d / 130) * 0.35;
            const hue = (a.hue + b.hue) / 2;
            ctx.strokeStyle = `hsla(${hue}, 90%, 60%, ${alpha})`;
            ctx.lineWidth = 0.6;
            ctx.beginPath();
            ctx.moveTo(a.x, a.y);
            ctx.lineTo(b.x, b.y);
            ctx.stroke();
          }
        }
      }
      // nodes
      for (const n of nodes) {
        const g = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r * 6);
        g.addColorStop(0, `hsla(${n.hue}, 100%, 70%, 0.9)`);
        g.addColorStop(1, `hsla(${n.hue}, 100%, 70%, 0)`);
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r * 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = `hsla(${n.hue}, 100%, 80%, 0.95)`;
        ctx.beginPath();
        ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(loop);
    };
    loop();
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("mousemove", onMove);
    };
  }, []);
  return <canvas ref={ref} className="absolute inset-0 w-full h-full pointer-events-none" />;
};

/* Aurora mesh background — slow drifting blobs */
const AuroraMesh = () => (
  <div className="absolute inset-0 overflow-hidden pointer-events-none">
    <motion.div
      animate={{ x: [0, 80, -40, 0], y: [0, -60, 40, 0] }}
      transition={{ duration: 24, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -top-40 -left-40 w-[60rem] h-[60rem] rounded-full"
      style={{ background: "radial-gradient(circle, rgba(168,85,247,0.18), transparent 60%)", filter: "blur(40px)" }}
    />
    <motion.div
      animate={{ x: [0, -100, 60, 0], y: [0, 80, -40, 0] }}
      transition={{ duration: 28, repeat: Infinity, ease: "easeInOut" }}
      className="absolute top-1/3 -right-40 w-[55rem] h-[55rem] rounded-full"
      style={{ background: "radial-gradient(circle, rgba(34,211,238,0.15), transparent 60%)", filter: "blur(40px)" }}
    />
    <motion.div
      animate={{ x: [0, 60, -60, 0], y: [0, 60, -80, 0] }}
      transition={{ duration: 32, repeat: Infinity, ease: "easeInOut" }}
      className="absolute -bottom-40 left-1/4 w-[50rem] h-[50rem] rounded-full"
      style={{ background: "radial-gradient(circle, rgba(59,130,246,0.18), transparent 60%)", filter: "blur(40px)" }}
    />
  </div>
);

/* Cursor spotlight */
const Spotlight = () => {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  useEffect(() => {
    const on = (e: MouseEvent) => { x.set(e.clientX); y.set(e.clientY); };
    window.addEventListener("mousemove", on, { passive: true });
    return () => window.removeEventListener("mousemove", on);
  }, [x, y]);
  return (
    <motion.div
      className="pointer-events-none fixed top-0 left-0 z-[1] mix-blend-screen"
      style={{
        x, y,
        translateX: "-50%", translateY: "-50%",
        width: 480, height: 480,
        background: "radial-gradient(circle, rgba(168,85,247,0.18), rgba(34,211,238,0.06) 40%, transparent 70%)",
        filter: "blur(20px)",
      }}
    />
  );
};

/* 3D-tilt holographic card */
const TiltCard = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => {
  const ref = useRef<HTMLDivElement>(null);
  const rx = useMotionValue(0), ry = useMotionValue(0);
  const mx = useMotionValue(50), my = useMotionValue(50);
  const sx = useSpring(rx, { stiffness: 200, damping: 20 });
  const sy = useSpring(ry, { stiffness: 200, damping: 20 });
  const onMove = (e: React.MouseEvent) => {
    const el = ref.current!;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    ry.set((px - 0.5) * 14);
    rx.set(-(py - 0.5) * 14);
    mx.set(px * 100); my.set(py * 100);
  };
  const onLeave = () => { rx.set(0); ry.set(0); };
  return (
    <motion.div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={onLeave}
      style={{ rotateX: sx, rotateY: sy, transformStyle: "preserve-3d", transformPerspective: 900 }}
      className={`relative ${className}`}
    >
      {children}
      <motion.div
        className="absolute inset-0 rounded-2xl pointer-events-none opacity-0 group-hover:opacity-100 transition-opacity"
        style={{
          background: "radial-gradient(400px circle at var(--mx) var(--my), rgba(255,255,255,0.12), transparent 50%)",
          ["--mx" as any]: useTransform(mx, (v) => `${v}%`),
          ["--my" as any]: useTransform(my, (v) => `${v}%`),
        } as any}
      />
    </motion.div>
  );
};

/* Magnetic button wrapper */
const Magnetic = ({ children, strength = 0.25 }: { children: React.ReactNode; strength?: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const x = useSpring(0, { stiffness: 200, damping: 15 });
  const y = useSpring(0, { stiffness: 200, damping: 15 });
  const onMove = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    x.set((e.clientX - (r.left + r.width / 2)) * strength);
    y.set((e.clientY - (r.top + r.height / 2)) * strength);
  };
  const onLeave = () => { x.set(0); y.set(0); };
  return (
    <motion.div ref={ref} onMouseMove={onMove} onMouseLeave={onLeave} style={{ x, y }} className="inline-block">
      {children}
    </motion.div>
  );
};

/* Animated counter */
const Counter = ({ end, suffix = "", duration = 2 }: { end: number; suffix?: string; duration?: number }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-50px" });
  useEffect(() => {
    if (!inView) return;
    let start = 0; const steps = 60; const inc = end / steps;
    const id = setInterval(() => {
      start += inc;
      if (start >= end) { setVal(end); clearInterval(id); } else setVal(Math.floor(start));
    }, (duration * 1000) / steps);
    return () => clearInterval(id);
  }, [inView, end, duration]);
  return <span ref={ref}>{val.toLocaleString()}{suffix}</span>;
};

/* AI typing terminal */
const AITerminal = () => {
  const lines = [
    "> initializing acry.neural_network...",
    "> connecting to campus_ambassador_grid",
    "> 50,000+ students online · 120 cities",
    "> mission: build india's ai generation ✓",
    "> ambassador_slots: open ▒▒▒▒▒▒",
  ];
  const [shown, setShown] = useState<string[]>([]);
  const [cursor, setCursor] = useState(0);
  useEffect(() => {
    if (cursor >= lines.length) return;
    const t = setTimeout(() => {
      setShown((s) => [...s, lines[cursor]]);
      setCursor(cursor + 1);
    }, 700);
    return () => clearTimeout(t);
  }, [cursor]);
  return (
    <div className="relative rounded-2xl border border-white/10 bg-black/60 backdrop-blur-xl overflow-hidden shadow-2xl shadow-purple-500/20">
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-white/10 bg-white/[0.02]">
        <div className="w-2.5 h-2.5 rounded-full bg-red-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/80" />
        <div className="w-2.5 h-2.5 rounded-full bg-green-500/80" />
        <div className="ml-3 flex items-center gap-1.5 text-[10px] text-white/40 font-mono">
          <Terminal className="w-3 h-3" /> acry@ai · ~/ambassador
        </div>
      </div>
      <div className="p-4 font-mono text-[11px] md:text-xs space-y-1 min-h-[140px]">
        {shown.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={i === shown.length - 1 ? "text-cyan-300" : "text-white/60"}
          >
            {l}
          </motion.div>
        ))}
        <motion.span
          animate={{ opacity: [1, 0, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
          className="inline-block w-1.5 h-3 bg-cyan-400 align-middle ml-0.5"
        />
      </div>
    </div>
  );
};

/* Glass + section heading helpers */
const Glass = ({ children, className = "" }: { children: React.ReactNode; className?: string }) => (
  <div
    className={`relative rounded-2xl border border-white/10 bg-white/[0.03] backdrop-blur-xl ${className}`}
    style={{ boxShadow: "0 8px 32px rgba(168, 85, 247, 0.08)" }}
  >
    {children}
  </div>
);

const Section = ({ children, className = "", id }: { children: React.ReactNode; className?: string; id?: string }) => (
  <section id={id} className={`relative py-20 md:py-28 px-6 ${className}`}>
    <div className="max-w-7xl mx-auto relative z-10">{children}</div>
  </section>
);

const SectionHead = ({ eyebrow, title, sub }: { eyebrow?: string; title: string; sub?: string }) => (
  <motion.div
    initial={{ opacity: 0, y: 30 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-80px" }}
    transition={{ duration: 0.7 }}
    className="text-center mb-14 md:mb-20"
  >
    {eyebrow && (
      <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/5 mb-5">
        <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
        <span className="text-xs font-semibold tracking-widest uppercase text-cyan-300">{eyebrow}</span>
      </div>
    )}
    <h2 className="text-4xl md:text-6xl font-bold tracking-tight mb-4 text-white">
      {title.split("|").map((part, i) =>
        i % 2 === 1 ? (
          <span key={i} className="bg-gradient-to-r from-cyan-400 via-purple-400 to-blue-500 bg-clip-text text-transparent">
            {part}
          </span>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </h2>
    {sub && <p className="text-base md:text-lg text-white/60 max-w-2xl mx-auto leading-relaxed">{sub}</p>}
  </motion.div>
);

/* ═══════════════════════════════════════════════════════════
   HERO — cinematic, AI-driven
   ═══════════════════════════════════════════════════════════ */
const Hero = ({ scrollToForm }: { scrollToForm: () => void }) => {
  const { scrollY } = useScroll();
  const yBg = useTransform(scrollY, [0, 800], [0, -200]);
  const yContent = useTransform(scrollY, [0, 800], [0, -60]);
  const opacity = useTransform(scrollY, [0, 600], [1, 0.3]);

  const badges = [
    { icon: Brain, label: "AI Workshops" },
    { icon: Users, label: "Student Community" },
    { icon: Crown, label: "Leadership" },
    { icon: Rocket, label: "Future Skills" },
  ];

  return (
    <section className="relative min-h-[100dvh] flex items-center overflow-hidden pt-28 pb-24 px-6">
      {/* Layered backdrop */}
      <motion.div style={{ y: yBg }} className="absolute inset-1">
        <AuroraMesh />
        <NeuralNetCanvas />
      </motion.div>

      {/* Grid */}
      <div
        className="absolute inset-0 opacity-[0.05] pointer-events-none"
        style={{
          backgroundImage:
            "linear-gradient(rgba(34,211,238,1) 1px, transparent 1px), linear-gradient(90deg, rgba(34,211,238,1) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
          maskImage: "radial-gradient(ellipse at center, black 30%, transparent 80%)",
        }}
      />

      <motion.div style={{ y: yContent, opacity }} className="relative z-10 max-w-4xl mx-auto w-full flex flex-col items-center text-center">
        <div className="text-center">
          {/* Live badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-purple-500/30 bg-purple-500/5 backdrop-blur-sm mb-7"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75 animate-ping" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-400" />
            </span>
            <span className="text-xs font-semibold tracking-wider uppercase text-purple-200">
              Applications Open · Batch 2026
            </span>
            <span className="px-1.5 py-0.5 rounded-md bg-gradient-to-r from-purple-500 to-cyan-400 text-[9px] font-black text-black uppercase">
              Limited
            </span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.1 }}
            className="text-[2.6rem] sm:text-5xl md:text-7xl lg:text-[5.2rem] font-bold tracking-tight leading-[1.02] mb-6"
          >
            <span className="text-white">Become an </span>
            <span className="bg-gradient-to-r from-cyan-300 via-purple-400 to-blue-500 bg-clip-text text-transparent">
              ACRY AI
            </span>
            <br />
            <span className="text-white">Campus </span>
            <span className="bg-gradient-to-r from-purple-400 to-cyan-300 bg-clip-text text-transparent">Ambassador.</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="text-base md:text-xl text-white/70 max-w-xl mb-9 leading-relaxed mx-auto"
          >
            Lead the AI revolution in your campus and become part of India's
            <span className="text-white font-semibold"> fastest-growing AI student network.</span>
          </motion.p>

          {/* CTAs */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5 }}
            className="flex flex-col sm:flex-row gap-4 justify-center mb-12"
          >
            <Magnetic>
              <button
                onClick={scrollToForm}
                className="group relative inline-flex items-center justify-center gap-2 px-8 py-4 rounded-2xl font-bold text-base text-white overflow-hidden"
                style={{
                  background: "linear-gradient(135deg, #a855f7, #3b82f6 50%, #22d3ee)",
                  boxShadow: "0 0 40px rgba(168,85,247,0.5), 0 10px 40px rgba(34,211,238,0.25)",
                }}
              >
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                <span
                  className="absolute -inset-1 rounded-2xl opacity-50 blur-xl"
                  style={{ background: "linear-gradient(135deg, #a855f7, #22d3ee)" }}
                />
                <Rocket className="w-5 h-5 relative z-10" />
                <span className="relative z-10">Apply Now — It's Free</span>
                <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />
              </button>
            </Magnetic>
            <Magnetic strength={0.15}>
              <a
                href="#intro-video"
                className="group inline-flex items-center justify-center gap-2.5 px-8 py-4 rounded-2xl font-semibold text-white/90 border border-white/15 bg-white/[0.03] backdrop-blur-md hover:bg-white/[0.08] hover:border-cyan-400/40 transition-all"
              >
                <span className="relative w-7 h-7 rounded-full bg-white/10 flex items-center justify-center group-hover:bg-cyan-400/20 transition-colors">
                  <Play className="w-3 h-3 fill-current text-cyan-300" />
                </span>
                Watch Intro
              </a>
            </Magnetic>
          </motion.div>

          {/* Trust badges */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-2.5 max-w-2xl mx-auto"
          >
            {badges.map((b, i) => (
              <motion.div
                key={b.label}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.9 + i * 0.1 }}
                whileHover={{ y: -3, scale: 1.03 }}
                className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] backdrop-blur-md hover:border-cyan-400/30 transition-colors"
              >
                <b.icon className="w-4 h-4 text-cyan-300 flex-shrink-0" />
                <span className="text-xs sm:text-sm font-medium text-white/80 truncate">{b.label}</span>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </motion.div>

      {/* Scroll cue */}
      <motion.div
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 2, repeat: Infinity }}
        className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/40 flex flex-col items-center gap-1"
      >
        <span className="text-[9px] uppercase tracking-widest">Scroll</span>
        <ChevronDown className="w-4 h-4" />
      </motion.div>
    </section>
  );
};

/* Marquee — "trusted by" campus row */
const CampusMarquee = () => {
  const campuses = ["IIT Delhi", "BITS Pilani", "NIT Trichy", "VIT Vellore", "IIM Bangalore", "DTU", "SRM", "Manipal", "Christ University", "Amity"];
  return (
    <div className="relative py-10 overflow-hidden border-y border-white/5 bg-white/[0.01]">
      <div className="absolute inset-y-0 left-0 w-32 bg-gradient-to-r from-[#05070d] to-transparent z-10" />
      <div className="absolute inset-y-0 right-0 w-32 bg-gradient-to-l from-[#05070d] to-transparent z-10" />
      <div className="text-center mb-5 text-[10px] uppercase tracking-[0.3em] text-white/40 font-bold">
        Ambassadors from across India
      </div>
      <div className="flex overflow-hidden">
        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          className="flex gap-12 whitespace-nowrap pr-12"
        >
          {[...campuses, ...campuses, ...campuses].map((c, i) => (
            <div key={i} className="flex items-center gap-2 text-white/40 hover:text-white transition-colors">
              <GraduationCap className="w-4 h-4 text-cyan-400/60" />
              <span className="text-sm font-semibold tracking-wide">{c}</span>
            </div>
          ))}
        </motion.div>
      </div>
    </div>
  );
};

/* Founder message */
const FounderMessage = () => (
  <Section id="founder">
    <div className="grid md:grid-cols-2 gap-12 items-center">
      <motion.div
        initial={{ opacity: 0, x: -40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="relative aspect-square max-w-md mx-auto">
          {/* Pulsing rings */}
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 1, ease: "easeOut" }}
              className="absolute inset-0 rounded-full border border-purple-400/30"
            />
          ))}
          <div className="absolute inset-0 rounded-3xl bg-gradient-to-br from-purple-500/40 via-blue-500/30 to-cyan-400/40 blur-2xl" />
          <TiltCard className="relative aspect-square">
            <Glass className="relative aspect-square overflow-hidden flex items-center justify-center">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_30%,_rgba(168,85,247,0.3),_transparent_50%)]" />
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_70%,_rgba(34,211,238,0.3),_transparent_50%)]" />
              <div className="relative z-10 flex flex-col items-center text-center p-8">
                <motion.div
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                  className="absolute inset-8 rounded-full border border-cyan-400/20"
                />
                <div className="w-32 h-32 rounded-full bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center text-5xl font-black text-white mb-4 shadow-2xl shadow-purple-500/40 relative">
                  A
                  <motion.div
                    animate={{ scale: [1, 1.2, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                    className="absolute inset-0 rounded-full border-2 border-cyan-300/40"
                  />
                </div>
                <div className="text-white font-bold text-lg">Founder, ACRY AI</div>
                <div className="text-cyan-300 text-sm mt-1">Building India's AI generation</div>
                <motion.div
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-1.5"
                >
                  <Flame className="w-3 h-3 text-orange-400" />
                  <span className="text-[10px] font-bold text-white">LIVE MISSION</span>
                </motion.div>
              </div>
            </Glass>
          </TiltCard>
        </div>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, x: 40 }}
        whileInView={{ opacity: 1, x: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.8 }}
      >
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-400/30 bg-purple-400/5 mb-5">
          <Heart className="w-3 h-3 text-purple-300" />
          <span className="text-[10px] font-bold tracking-widest uppercase text-purple-200">A Message From The Founder</span>
        </div>
        <h3 className="text-3xl md:text-5xl font-bold text-white mb-6 leading-tight">
          We're building India's
          <span className="block bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent">
            AI-ready student generation.
          </span>
        </h3>
        <p className="text-white/70 text-lg leading-relaxed mb-6">
          The next decade belongs to those who understand AI — not as users, but as builders, leaders, and visionaries.
          ACRY AI exists to put that power in the hands of every Indian student, regardless of city, college, or background.
        </p>
        <div className="relative pl-6 border-l-2 border-cyan-400/60 my-8">
          <p className="text-xl md:text-2xl font-semibold text-white italic">
            "Students who learn AI today will lead tomorrow."
          </p>
        </div>
        <p className="text-white/60 leading-relaxed">
          As a Campus Ambassador, you don't just join a program — you join a movement. You become the face of AI
          on your campus, with the mentorship, network, and tools to actually make it real.
        </p>
      </motion.div>
    </div>
  </Section>
);

/* WHY JOIN — holographic grid */
const WhyJoin = () => {
  const benefits = [
    { icon: Brain, title: "AI Training", desc: "Hands-on training in modern AI tools, prompt engineering, and applied ML." },
    { icon: Crown, title: "Leadership Experience", desc: "Real responsibility leading your campus — résumé-defining, not symbolic." },
    { icon: Award, title: "Official Certificates", desc: "Verified completion + performance certificates recognised by recruiters." },
    { icon: Network, title: "Networking", desc: "Connect with 10,000+ ambassadors, founders, and industry mentors." },
    { icon: Star, title: "Personal Branding", desc: "Build your authority as the AI leader of your campus." },
    { icon: Briefcase, title: "Internship Opportunities", desc: "Top performers unlock internship & full-time roles at ACRY AI." },
    { icon: Sparkles, title: "Founder Mentorship", desc: "Direct 1:1 mentor sessions with our founders & senior leaders." },
    { icon: Trophy, title: "Campus Recognition", desc: "Become an officially recognised AI leader of your institution." },
    { icon: Mic, title: "Workshops Access", desc: "Free lifetime access to all premium ACRY AI workshops & summits." },
    { icon: Users, title: "Real Community", desc: "Build something that outlasts you — a real AI community on your campus." },
  ];
  return (
    <Section id="why-join" className="bg-gradient-to-b from-transparent via-purple-950/10 to-transparent">
      <SectionHead
        eyebrow="Why Join"
        title="Built to make you a |real AI leader|."
        sub="Not a sticker on your CV. A 6-month leadership identity — built on AI, community, and real-world impact."
      />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
        {benefits.map((b, i) => (
          <motion.div
            key={b.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-50px" }}
            transition={{ duration: 0.5, delay: (i % 5) * 0.06 }}
            className="group relative"
          >
            <TiltCard>
              <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-purple-500/0 via-cyan-400/0 to-blue-500/0 group-hover:from-purple-500/40 group-hover:via-cyan-400/30 group-hover:to-blue-500/40 transition-all duration-500 blur-md" />
              <Glass className="relative p-5 h-full">
                <div className="relative w-11 h-11 rounded-xl bg-gradient-to-br from-purple-500/20 to-cyan-400/20 border border-white/10 flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                  <b.icon className="w-5 h-5 text-cyan-300" />
                  <motion.div
                    className="absolute inset-0 rounded-xl border border-cyan-400/0 group-hover:border-cyan-400/50"
                    animate={{ scale: [1, 1.15, 1] }}
                    transition={{ duration: 2, repeat: Infinity }}
                  />
                </div>
                <h4 className="font-bold text-white mb-1.5">{b.title}</h4>
                <p className="text-xs text-white/60 leading-relaxed">{b.desc}</p>
              </Glass>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* WHAT YOU DO */
const WhatYouDo = () => {
  const items = [
    { icon: Mic, title: "Organize AI Workshops", desc: "Run flagship AI workshops on your campus — fully supported by ACRY." },
    { icon: Users, title: "Build Student Communities", desc: "Grow your own AI club, study groups, and ambassador network." },
    { icon: Globe, title: "Spread AI Awareness", desc: "Become the trusted voice of AI in your campus & city." },
    { icon: Calendar, title: "Conduct Campus Activities", desc: "Host hackathons, meetups, demos, and AI challenges." },
    { icon: Sparkles, title: "Create AI Content", desc: "Build a personal brand through reels, posts, and tutorials." },
    { icon: Target, title: "Connect Future Skills", desc: "Bridge students to real-world AI tools, jobs, and careers." },
  ];
  return (
    <Section id="responsibilities">
      <SectionHead eyebrow="The Role" title="What you'll |actually do|." sub="A clear, exciting playbook — not vague tasks." />
      <div className="relative">
        <div className="hidden md:block absolute left-1/2 top-0 bottom-0 w-px bg-gradient-to-b from-transparent via-purple-500/40 to-transparent -translate-x-1/2" />
        <div className="space-y-6 md:space-y-12">
          {items.map((it, i) => {
            const left = i % 2 === 0;
            return (
              <motion.div
                key={it.title}
                initial={{ opacity: 0, x: left ? -40 : 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.6 }}
                className="md:grid md:grid-cols-2 md:gap-12 items-center"
              >
                <div className={`${left ? "md:order-1" : "md:order-2"}`}>
                  <TiltCard>
                    <Glass className="p-6 group hover:border-cyan-400/30 transition-colors">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-cyan-400/30 border border-white/10 flex items-center justify-center flex-shrink-0">
                          <it.icon className="w-6 h-6 text-cyan-300" />
                        </div>
                        <div>
                          <div className="text-[10px] font-bold tracking-widest uppercase text-purple-300 mb-1">
                            Step {String(i + 1).padStart(2, "0")}
                          </div>
                          <h4 className="text-xl font-bold text-white mb-2">{it.title}</h4>
                          <p className="text-sm text-white/60 leading-relaxed">{it.desc}</p>
                        </div>
                      </div>
                    </Glass>
                  </TiltCard>
                </div>
                <div className={`hidden md:flex items-center justify-center ${left ? "md:order-2" : "md:order-1"}`}>
                  <motion.div
                    whileInView={{ scale: [0, 1.2, 1] }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.6, type: "spring" }}
                    className="relative w-20 h-20 rounded-full bg-gradient-to-br from-purple-500/20 to-cyan-400/20 border border-white/10 flex items-center justify-center backdrop-blur-md"
                  >
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.5, 0, 0.5] }}
                      transition={{ duration: 2.5, repeat: Infinity }}
                      className="absolute inset-0 rounded-full border border-cyan-400/40"
                    />
                    <div className="text-2xl font-black bg-gradient-to-br from-cyan-300 to-purple-400 bg-clip-text text-transparent">
                      {String(i + 1).padStart(2, "0")}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </Section>
  );
};

/* SHOWCASE */
const Showcase = () => {
  const metrics = [
    { label: "Students Joined", value: 50000, suffix: "+" },
    { label: "Cities Covered", value: 120, suffix: "+" },
    { label: "Workshops Conducted", value: 850, suffix: "+" },
    { label: "Active Communities", value: 320, suffix: "+" },
  ];
  const events = [
    { icon: Brain, title: "AI Workshops", color: "from-purple-500 to-pink-500" },
    { icon: Users, title: "Student Meetups", color: "from-cyan-400 to-blue-500" },
    { icon: Mic, title: "AI Summits", color: "from-blue-500 to-purple-500" },
    { icon: Trophy, title: "Competitions", color: "from-amber-400 to-orange-500" },
    { icon: GraduationCap, title: "Campus Sessions", color: "from-emerald-400 to-cyan-400" },
    { icon: Globe, title: "Online Bootcamps", color: "from-fuchsia-500 to-purple-500" },
  ];
  return (
    <Section id="showcase" className="bg-gradient-to-b from-transparent via-blue-950/20 to-transparent">
      <SectionHead eyebrow="The Movement" title="From classrooms to |cities|." sub="Real events. Real impact. Real momentum." />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <TiltCard>
              <Glass className="p-6 text-center group hover:border-cyan-400/30 transition-colors">
                <div className="text-3xl md:text-5xl font-black bg-gradient-to-br from-cyan-300 to-purple-400 bg-clip-text text-transparent mb-1">
                  <Counter end={m.value} suffix={m.suffix} />
                </div>
                <div className="text-xs uppercase tracking-widest text-white/50 font-semibold">{m.label}</div>
              </Glass>
            </TiltCard>
          </motion.div>
        ))}
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {events.map((e, i) => (
          <motion.div
            key={e.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
            whileHover={{ scale: 1.02 }}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden border border-white/10"
          >
            <div className={`absolute inset-0 bg-gradient-to-br ${e.color} opacity-30 group-hover:opacity-50 transition-opacity`} />
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_transparent_30%,_rgba(0,0,0,0.6)_100%)]" />
            {/* Scan line */}
            <motion.div
              animate={{ y: ["-100%", "200%"] }}
              transition={{ duration: 3, repeat: Infinity, ease: "linear", delay: i * 0.5 }}
              className="absolute inset-x-0 h-1 bg-gradient-to-b from-transparent via-cyan-400/60 to-transparent opacity-50"
            />
            <div className="relative h-full flex flex-col justify-end p-6">
              <e.icon className="w-10 h-10 text-white/90 mb-3" />
              <h4 className="text-xl font-bold text-white">{e.title}</h4>
              <div className="mt-3 flex items-center gap-2 text-xs text-white/60">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
                Live across India
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* SOCIAL PROOF */
const SocialProof = () => {
  const testimonials = [
    { name: "Aarav Sharma", role: "Ambassador · IIT Delhi", text: "Going from a curious student to leading 8 AI workshops in 4 months — ACRY made me the person I always wanted to be.", color: "from-purple-500 to-pink-500" },
    { name: "Ishita Verma", role: "Ambassador · BITS Pilani", text: "I built a 600-member AI community on my campus. The mentorship + brand backing is unreal.", color: "from-cyan-400 to-blue-500" },
    { name: "Rohan Mehta", role: "Ambassador · NIT Trichy", text: "This isn't just an ambassador program — it's a launchpad. I got my AI internship through this network.", color: "from-amber-400 to-orange-500" },
    { name: "Priya Iyer", role: "Ambassador · VIT Vellore", text: "The founder mentorship sessions changed how I think about AI, leadership, and my career.", color: "from-emerald-400 to-cyan-400" },
    { name: "Karan Singh", role: "Ambassador · DTU", text: "Best decision of my college life. Period.", color: "from-fuchsia-500 to-purple-500" },
    { name: "Ananya Kapoor", role: "Ambassador · SRM", text: "I had 0 leadership experience. Now I run my own AI club & speak at events.", color: "from-blue-500 to-indigo-500" },
  ];
  return (
    <Section id="community">
      <SectionHead eyebrow="The Community" title="Join India's |next-generation| AI student movement." sub="Real voices from real campuses." />
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
        {testimonials.map((t, i) => (
          <motion.div
            key={t.name}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: (i % 3) * 0.1 }}
          >
            <TiltCard>
              <Glass className="p-6 h-full">
                <div className="flex items-center gap-3 mb-4">
                  <div className={`w-11 h-11 rounded-full bg-gradient-to-br ${t.color} flex items-center justify-center text-white font-bold shadow-lg`}>
                    {t.name[0]}
                  </div>
                  <div>
                    <div className="font-bold text-white text-sm">{t.name}</div>
                    <div className="text-xs text-white/50">{t.role}</div>
                  </div>
                </div>
                <div className="flex gap-0.5 mb-3">
                  {[...Array(5)].map((_, k) => (
                    <Star key={k} className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm text-white/75 leading-relaxed">"{t.text}"</p>
              </Glass>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* HOW IT WORKS */
const HowItWorks = () => {
  const steps = [
    { icon: Send, title: "Apply Online", desc: "Fill the application below." },
    { icon: Users, title: "Join Community", desc: "Onboard into the ACRY ambassador network." },
    { icon: Brain, title: "Get AI Training", desc: "Hands-on AI bootcamps & resources." },
    { icon: Crown, title: "Become Campus Leader", desc: "Get officially recognised." },
    { icon: Mic, title: "Organize Workshops", desc: "Lead real events with full support." },
    { icon: Network, title: "Grow Your Network", desc: "Build for life — career, brand, friendships." },
  ];
  return (
    <Section id="how-it-works" className="bg-gradient-to-b from-transparent via-cyan-950/10 to-transparent">
      <SectionHead eyebrow="The Path" title="6 steps to becoming an |AI campus leader|." />
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {steps.map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.08 }}
          >
            <TiltCard>
              <Glass className="p-6 h-full group hover:border-purple-400/30 transition-colors">
                <div className="flex items-center justify-between mb-4">
                  <div className="relative w-12 h-12 rounded-xl bg-gradient-to-br from-purple-500/30 to-cyan-400/30 border border-white/10 flex items-center justify-center">
                    <s.icon className="w-5 h-5 text-cyan-300" />
                    <motion.div
                      animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0, 0.4] }}
                      transition={{ duration: 2, repeat: Infinity, delay: i * 0.2 }}
                      className="absolute inset-0 rounded-xl border border-cyan-400/40"
                    />
                  </div>
                  <div className="text-4xl font-black text-white/5">{String(i + 1).padStart(2, "0")}</div>
                </div>
                <h4 className="text-lg font-bold text-white mb-1">{s.title}</h4>
                <p className="text-sm text-white/60">{s.desc}</p>
              </Glass>
            </TiltCard>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* LEADERBOARD */
const Leaderboard = () => {
  const top = [
    { rank: 1, name: "Aarav S.", city: "Delhi", points: 9840, badge: "👑" },
    { rank: 2, name: "Ishita V.", city: "Pilani", points: 9210, badge: "🥈" },
    { rank: 3, name: "Rohan M.", city: "Trichy", points: 8870, badge: "🥉" },
    { rank: 4, name: "Priya I.", city: "Vellore", points: 8450, badge: "⭐" },
    { rank: 5, name: "Karan S.", city: "Delhi", points: 8120, badge: "⭐" },
  ];
  const cities = [
    { city: "Bengaluru", ambassadors: 420 },
    { city: "Delhi NCR", ambassadors: 380 },
    { city: "Mumbai", ambassadors: 310 },
    { city: "Hyderabad", ambassadors: 270 },
  ];
  return (
    <Section id="leaderboard">
      <SectionHead eyebrow="The Game" title="Climb the |leaderboard|. Get recognised." sub="Top ambassadors get rewards, opportunities, and the spotlight." />
      <div className="grid lg:grid-cols-2 gap-6">
        <TiltCard>
          <Glass className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-white flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" /> Top Ambassadors
              </h4>
              <div className="text-xs text-white/50 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" /> Live
              </div>
            </div>
            <div className="space-y-2">
              {top.map((u) => (
                <motion.div
                  key={u.rank}
                  initial={{ opacity: 0, x: -20 }}
                  whileInView={{ opacity: 1, x: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: u.rank * 0.05 }}
                  whileHover={{ x: 4 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-purple-400/30 transition-colors"
                >
                  <div className="text-xl w-8 text-center">{u.badge}</div>
                  <div className="flex-1">
                    <div className="font-semibold text-white text-sm">{u.name}</div>
                    <div className="text-xs text-white/40">{u.city}</div>
                  </div>
                  <div className="text-cyan-300 font-bold tabular-nums">{u.points.toLocaleString()}</div>
                  <div className="text-[10px] uppercase text-white/40">pts</div>
                </motion.div>
              ))}
            </div>
          </Glass>
        </TiltCard>

        <TiltCard>
          <Glass className="p-6">
            <div className="flex items-center justify-between mb-5">
              <h4 className="font-bold text-white flex items-center gap-2">
                <MapPin className="w-4 h-4 text-cyan-400" /> Top Cities
              </h4>
              <div className="text-xs text-white/50">Live ranks</div>
            </div>
            <div className="space-y-4">
              {cities.map((c, i) => {
                const pct = (c.ambassadors / 420) * 100;
                return (
                  <div key={c.city}>
                    <div className="flex items-center justify-between mb-1.5 text-sm">
                      <span className="text-white font-medium">{c.city}</span>
                      <span className="text-white/60 tabular-nums">{c.ambassadors} ambassadors</span>
                    </div>
                    <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        initial={{ width: 0 }}
                        whileInView={{ width: `${pct}%` }}
                        viewport={{ once: true }}
                        transition={{ duration: 1.2, delay: i * 0.15, ease: "easeOut" }}
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 relative overflow-hidden"
                      >
                        <motion.div
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/50 to-transparent"
                        />
                      </motion.div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-6 pt-5 border-t border-white/5">
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { icon: Crown, label: "Founder", c: "text-amber-300" },
                  { icon: Shield, label: "Pioneer", c: "text-purple-300" },
                  { icon: Flame, label: "Igniter", c: "text-orange-300" },
                ].map((b) => (
                  <div key={b.label} className="p-3 rounded-xl bg-white/[0.02] border border-white/5 hover:border-cyan-400/30 transition-colors">
                    <b.icon className={`w-5 h-5 mx-auto mb-1 ${b.c}`} />
                    <div className="text-[10px] uppercase tracking-wider text-white/60 font-semibold">{b.label}</div>
                  </div>
                ))}
              </div>
            </div>
          </Glass>
        </TiltCard>
      </div>
    </Section>
  );
};

/* APPLICATION FORM */
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

const ApplicationForm = ({ formRef }: { formRef: React.RefObject<HTMLDivElement> }) => {
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [data, setData] = useState({
    full_name: "", phone: "", email: "", college: "", city: "", course: "",
    instagram: "", linkedin: "", why_join: "", leadership_experience: "",
  });

  const steps = [
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
      { name: "instagram", label: "Instagram Profile", icon: Instagram, placeholder: "@yourhandle" },
      { name: "linkedin", label: "LinkedIn Profile", icon: Linkedin, placeholder: "linkedin.com/in/you" },
    ]},
    { title: "Your Story", fields: [
      { name: "why_join", label: "Why do you want to join?", icon: Heart, placeholder: "Tell us your motivation...", multiline: true },
      { name: "leadership_experience", label: "Leadership Experience", icon: Crown, placeholder: "Any past leadership roles (optional)...", multiline: true },
    ]},
  ];
  const progress = ((step + 1) / steps.length) * 100;

  const validateStep = () => {
    const fields = steps[step].fields as any[];
    for (const f of fields) {
      const v = (data as any)[f.name];
      if (f.required && (!v || !v.trim())) { toast.error(`${f.label} is required`); return false; }
    }
    return true;
  };
  const next = () => {
    if (!validateStep()) return;
    if (step < steps.length - 1) setStep(step + 1); else submit();
  };
  const submit = async () => {
    const parsed = schema.safeParse(data);
    if (!parsed.success) { toast.error(parsed.error.issues[0].message); return; }
    setSubmitting(true);
    try {
      const payload: any = { ...parsed.data, user_agent: navigator.userAgent.slice(0, 500) };
      const { error } = await supabase.from("campus_ambassador_applications").insert(payload);
      if (error) throw error;
      setSubmitted(true);
      toast.success("Application submitted! 🎉");
    } catch (e: any) {
      toast.error(e.message || "Submission failed. Try again.");
    } finally { setSubmitting(false); }
  };

  return (
    <Section id="apply" className="bg-gradient-to-b from-transparent via-purple-950/20 to-transparent">
      <div ref={formRef} />
      <SectionHead eyebrow="Apply Now" title="Become an |AI Leader|." sub="Takes 90 seconds. No fee. We review every application personally." />
      <div className="max-w-2xl mx-auto">
        <div className="relative">
          {/* Glow */}
          <div className="absolute -inset-2 rounded-3xl bg-gradient-to-r from-purple-500/30 via-blue-500/30 to-cyan-400/30 blur-2xl" />
          <Glass className="relative p-6 md:p-10 overflow-hidden">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,_rgba(168,85,247,0.15),_transparent_50%)] pointer-events-none" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_bottom_left,_rgba(34,211,238,0.1),_transparent_50%)] pointer-events-none" />
            <div className="relative z-10">
              {submitted ? (
                <div className="text-center py-10">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: "spring", bounce: 0.5 }}
                    className="w-20 h-20 rounded-full bg-gradient-to-br from-green-400 to-cyan-400 flex items-center justify-center mx-auto mb-6 shadow-2xl shadow-green-400/40"
                  >
                    <Check className="w-10 h-10 text-white" strokeWidth={3} />
                  </motion.div>
                  <h3 className="text-3xl font-bold text-white mb-3">Welcome to the movement! 🎉</h3>
                  <p className="text-white/70 max-w-md mx-auto mb-6">
                    Your application is in. Our team will personally review and reach out within
                    <span className="text-cyan-300 font-semibold"> 48 hours</span> via WhatsApp & email.
                  </p>
                  <a
                    href="https://wa.me/919999999999?text=Hi%20ACRY%20AI%2C%20I%20just%20applied%20for%20the%20Campus%20Ambassador%20Program."
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-green-500 text-white font-semibold hover:bg-green-600 transition-colors"
                  >
                    <MessageCircle className="w-4 h-4" /> Connect on WhatsApp
                  </a>
                </div>
              ) : (
                <>
                  <div className="mb-8">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs uppercase tracking-widest text-cyan-300 font-bold">
                        Step {step + 1} of {steps.length}
                      </span>
                      <span className="text-xs text-white/50">{steps[step].title}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <motion.div
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 0.5 }}
                        className="h-full rounded-full bg-gradient-to-r from-purple-500 via-blue-500 to-cyan-400 relative overflow-hidden"
                      >
                        <motion.div
                          animate={{ x: ["-100%", "200%"] }}
                          transition={{ duration: 1.5, repeat: Infinity }}
                          className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent"
                        />
                      </motion.div>
                    </div>
                  </div>
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={step}
                      initial={{ opacity: 0, x: 30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: -30 }}
                      transition={{ duration: 0.3 }}
                      className="space-y-4"
                    >
                      {steps[step].fields.map((f: any) => (
                        <div key={f.name}>
                          <label className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-white/60 mb-2">
                            <f.icon className="w-3.5 h-3.5 text-cyan-300" />
                            {f.label} {f.required && <span className="text-purple-400">*</span>}
                          </label>
                          {f.multiline ? (
                            <textarea
                              value={(data as any)[f.name]}
                              onChange={(e) => setData({ ...data, [f.name]: e.target.value })}
                              placeholder={f.placeholder}
                              rows={4}
                              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all resize-none"
                            />
                          ) : (
                            <input
                              type={f.type || "text"}
                              value={(data as any)[f.name]}
                              onChange={(e) => setData({ ...data, [f.name]: e.target.value })}
                              placeholder={f.placeholder}
                              className="w-full rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-cyan-400/50 focus:ring-2 focus:ring-cyan-400/20 transition-all"
                            />
                          )}
                        </div>
                      ))}
                    </motion.div>
                  </AnimatePresence>
                  <div className="flex items-center justify-between mt-8 gap-3">
                    <button
                      onClick={() => setStep(Math.max(0, step - 1))}
                      disabled={step === 0}
                      className="px-5 py-3 rounded-xl text-white/60 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors font-medium"
                    >
                      ← Back
                    </button>
                    <Magnetic>
                      <button
                        onClick={next}
                        disabled={submitting}
                        className="group relative inline-flex items-center justify-center gap-2 px-7 py-3 rounded-xl font-bold text-white overflow-hidden disabled:opacity-60"
                        style={{
                          background: "linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #22d3ee 100%)",
                          boxShadow: "0 8px 24px rgba(168, 85, 247, 0.35)",
                        }}
                      >
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
                        <span className="relative z-10">
                          {submitting ? "Submitting..." : step === steps.length - 1 ? "Apply Now & Become an AI Leader" : "Continue"}
                        </span>
                        {!submitting && <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition-transform" />}
                      </button>
                    </Magnetic>
                  </div>
                </>
              )}
            </div>
          </Glass>
        </div>
      </div>
    </Section>
  );
};

/* FAQ */
const FAQ = () => {
  const faqs = [
    { q: "Who can apply?", a: "Any college, university, or coaching student in India — UG, PG, JEE/NEET aspirants, AI enthusiasts. All streams welcome." },
    { q: "Is it free to join?", a: "Yes. 100% free. No application fee, no hidden cost, ever." },
    { q: "Will I get a certificate?", a: "Yes — both an official Campus Ambassador certificate and a verified performance certificate for top performers." },
    { q: "What are the real benefits?", a: "AI training, founder mentorship, internship pipeline, certificates, leadership identity, exclusive workshops, and a powerful national network." },
    { q: "Is this remote or in-person?", a: "Hybrid. Training and community are remote. Workshops and meetups happen on your campus / city." },
    { q: "How much time does it need?", a: "About 4–6 hours per week. Flexible around your studies — designed for serious students." },
    { q: "Will there be workshops and events?", a: "Yes — monthly AI workshops, quarterly summits, plus the events you organise on your campus with our full support." },
  ];
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section id="faq">
      <SectionHead eyebrow="FAQ" title="Quick |answers|." />
      <div className="max-w-3xl mx-auto space-y-3">
        {faqs.map((f, i) => (
          <motion.div
            key={f.q}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05 }}
          >
            <Glass className="overflow-hidden">
              <button onClick={() => setOpen(open === i ? null : i)} className="w-full px-6 py-5 flex items-center justify-between text-left">
                <span className="font-semibold text-white pr-4">{f.q}</span>
                <ChevronDown className={`w-5 h-5 text-cyan-300 flex-shrink-0 transition-transform ${open === i ? "rotate-180" : ""}`} />
              </button>
              <AnimatePresence>
                {open === i && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    className="overflow-hidden"
                  >
                    <p className="px-6 pb-5 text-white/70 leading-relaxed">{f.a}</p>
                  </motion.div>
                )}
              </AnimatePresence>
            </Glass>
          </motion.div>
        ))}
      </div>
    </Section>
  );
};

/* FINAL CTA */
const FinalCTA = ({ scrollToForm }: { scrollToForm: () => void }) => (
  <Section id="final" className="overflow-hidden">
    <div className="relative">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(168,85,247,0.3),_transparent_60%)]" />
      <div className="relative rounded-3xl border border-white/10 bg-white/[0.03] backdrop-blur-xl p-10 md:p-20 text-center overflow-hidden">
        <div className="absolute inset-0">
          <NeuralNetCanvas />
        </div>
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-black/30 pointer-events-none" />
        <div className="relative z-10">
          <motion.div
            initial={{ opacity: 0, scale: 0.8 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full border border-cyan-400/30 bg-cyan-400/5 mb-6"
          >
            <Cpu className="w-3 h-3 text-cyan-300" />
            <span className="text-xs font-semibold tracking-widest uppercase text-cyan-300">Your Move</span>
          </motion.div>
          <motion.h2
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8 }}
            className="text-4xl md:text-7xl font-bold tracking-tight text-white mb-5 leading-[1.05]"
          >
            The Future Belongs to
            <span className="block bg-gradient-to-r from-cyan-300 via-purple-400 to-blue-500 bg-clip-text text-transparent">
              AI Leaders.
            </span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.8, delay: 0.2 }}
            className="text-lg md:text-xl text-white/70 max-w-2xl mx-auto mb-10"
          >
            Join the movement. Build your future. Lead your campus.
          </motion.p>
          <Magnetic>
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              whileInView={{ opacity: 1, scale: 1 }}
              viewport={{ once: true }}
              transition={{ duration: 0.6, delay: 0.4 }}
              onClick={scrollToForm}
              className="group relative inline-flex items-center justify-center gap-2 px-10 py-5 rounded-2xl font-bold text-lg text-white overflow-hidden"
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #22d3ee 100%)",
                boxShadow: "0 20px 60px rgba(168, 85, 247, 0.5)",
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700" />
              <Rocket className="w-5 h-5 relative z-10" />
              <span className="relative z-10">Apply Now</span>
              <ArrowRight className="w-5 h-5 relative z-10 group-hover:translate-x-1 transition-transform" />
            </motion.button>
          </Magnetic>
          <div className="mt-12 inline-flex items-center gap-3 text-white/40 text-sm">
            <div className="h-px w-12 bg-white/20" />
            <span className="italic font-serif text-white/60">— Founder, ACRY AI</span>
            <div className="h-px w-12 bg-white/20" />
          </div>
        </div>
      </div>
    </div>
  </Section>
);

/* Top Nav */
const TopNav = ({ scrollToForm }: { scrollToForm: () => void }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 30);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? "bg-black/70 backdrop-blur-xl border-b border-white/10" : "bg-transparent"}`}>
      <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2.5 group">
          <motion.div
            whileHover={{ rotate: 360 }}
            transition={{ duration: 0.6 }}
            className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center font-black text-white text-sm shadow-lg shadow-purple-500/30"
          >
            A
          </motion.div>
          <div className="leading-tight">
            <div className="font-bold text-white text-sm">ACRY.ai</div>
            <div className="text-[9px] uppercase tracking-widest text-cyan-300">Campus Ambassador</div>
          </div>
        </Link>
        <div className="hidden md:flex items-center gap-7 text-sm text-white/70">
          <a href="#why-join" className="hover:text-white transition-colors">Why Join</a>
          <a href="#how-it-works" className="hover:text-white transition-colors">How It Works</a>
          <a href="#community" className="hover:text-white transition-colors">Community</a>
          <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
        </div>
        <Magnetic strength={0.2}>
          <button
            onClick={scrollToForm}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold text-white"
            style={{
              background: "linear-gradient(135deg, #a855f7 0%, #22d3ee 100%)",
              boxShadow: "0 4px 16px rgba(168, 85, 247, 0.4)",
            }}
          >
            <Rocket className="w-3.5 h-3.5" /> Apply Now
          </button>
        </Magnetic>
      </div>
    </nav>
  );
};

const PageFooter = () => (
  <footer className="relative border-t border-white/10 py-12 px-6 bg-black/60">
    <div className="max-w-7xl mx-auto grid md:grid-cols-4 gap-8">
      <div>
        <Link to="/" className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-purple-500 to-cyan-400 flex items-center justify-center font-black text-white">A</div>
          <span className="font-bold text-white">ACRY.ai</span>
        </Link>
        <p className="text-sm text-white/50 leading-relaxed">India's largest AI Student Community & Leadership Ecosystem.</p>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300 font-bold mb-4">Community</div>
        <ul className="space-y-2 text-sm text-white/60">
          <li><a href="#community" className="hover:text-white transition-colors">Ambassadors</a></li>
          <li><a href="#showcase" className="hover:text-white transition-colors">Workshops</a></li>
          <li><a href="#leaderboard" className="hover:text-white transition-colors">Leaderboard</a></li>
        </ul>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300 font-bold mb-4">Company</div>
        <ul className="space-y-2 text-sm text-white/60">
          <li><Link to="/about" className="hover:text-white transition-colors">About</Link></li>
          <li><Link to="/contact" className="hover:text-white transition-colors">Contact</Link></li>
          <li><Link to="/privacy" className="hover:text-white transition-colors">Privacy Policy</Link></li>
          <li><Link to="/terms" className="hover:text-white transition-colors">Terms</Link></li>
        </ul>
      </div>
      <div>
        <div className="text-xs uppercase tracking-widest text-cyan-300 font-bold mb-4">Connect</div>
        <ul className="space-y-2 text-sm text-white/60">
          <li><a href="mailto:ambassador@acry.ai" className="hover:text-white transition-colors">ambassador@acry.ai</a></li>
          <li><a href="https://wa.me/919999999999" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">WhatsApp Us</a></li>
        </ul>
        <div className="flex gap-3 mt-4">
          {[Instagram, Linkedin, MessageCircle].map((Icon, i) => (
            <a key={i} href="#" className="w-9 h-9 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/[0.08] hover:border-cyan-400/30 flex items-center justify-center transition-all">
              <Icon className="w-4 h-4 text-white/70" />
            </a>
          ))}
        </div>
      </div>
    </div>
    <div className="max-w-7xl mx-auto mt-10 pt-6 border-t border-white/5 text-center text-xs text-white/40">
      © {new Date().getFullYear()} AVC DOTFY LLP · ACRY.ai · All rights reserved.
    </div>
  </footer>
);

const FloatingCTAs = ({ scrollToForm }: { scrollToForm: () => void }) => (
  <>
    <a
      href="https://wa.me/919999999999?text=Hi%20ACRY%20AI%2C%20I%20want%20to%20know%20more%20about%20the%20Campus%20Ambassador%20Program."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-20 md:bottom-6 right-5 z-50 rounded-full bg-green-500 hover:bg-green-600 flex items-center justify-center shadow-2xl shadow-green-500/40 transition-all hover:scale-110"
      style={{ width: 52, height: 52 }}
      aria-label="WhatsApp"
    >
      <MessageCircle className="w-6 h-6 text-white" />
      <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-green-300 animate-ping" />
    </a>
    <div className="fixed bottom-0 left-0 right-0 z-40 md:hidden p-3 bg-gradient-to-t from-black via-black/90 to-transparent">
      <button
        onClick={scrollToForm}
        className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl font-bold text-white"
        style={{
          background: "linear-gradient(135deg, #a855f7 0%, #3b82f6 50%, #22d3ee 100%)",
          boxShadow: "0 8px 24px rgba(168, 85, 247, 0.5)",
        }}
      >
        <Rocket className="w-4 h-4" /> Apply Now <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  </>
);

/* PAGE */
const CampusAmbassadorBlueprint = () => {
  const formRef = useRef<HTMLDivElement>(null);
  const scrollToForm = () => formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="relative min-h-screen bg-[#05070d] text-white overflow-x-hidden font-sans">
      <SEO
        title="ACRY AI Campus Ambassador Program | Lead the AI Revolution"
        description="Join India's largest AI student community. Become an ACRY AI Campus Ambassador — leadership, AI training, certificates, mentorship & internship opportunities. Apply now."
        path="/campus-ambassador"
      />

      {/* Global backdrop */}
      <div className="fixed inset-0 pointer-events-none">
        <div className="absolute inset-0 bg-[#05070d]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,_rgba(59,130,246,0.08),_transparent_50%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_right,_rgba(168,85,247,0.08),_transparent_50%)]" />
      </div>

      <Spotlight />

      <div className="relative z-10">
        <TopNav scrollToForm={scrollToForm} />
        <Hero scrollToForm={scrollToForm} />
        <CampusMarquee />
        <FounderMessage />
        <WhyJoin />
        <WhatYouDo />
        <Showcase />
        <SocialProof />
        <HowItWorks />
        <Leaderboard />
        <ApplicationForm formRef={formRef} />
        <FAQ />
        <FinalCTA scrollToForm={scrollToForm} />
        <PageFooter />
        <FloatingCTAs scrollToForm={scrollToForm} />
      </div>
    </div>
  );
};

export default CampusAmbassadorBlueprint;
