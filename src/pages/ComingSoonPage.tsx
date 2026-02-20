import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Rocket, CheckCircle2, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import ACRYLogo from "@/components/landing/ACRYLogo";

/* ── Particle field (canvas) ── */
const ParticleField = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;
    let particles: { x: number; y: number; vx: number; vy: number; r: number; o: number }[] = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const count = Math.min(90, Math.floor(window.innerWidth / 14));
    for (let i = 0; i < count; i++) {
      particles.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.4,
        vy: (Math.random() - 0.5) * 0.4,
        r: Math.random() * 1.6 + 0.4,
        o: Math.random() * 0.5 + 0.15,
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      // connections
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 150) {
            ctx.beginPath();
            ctx.strokeStyle = `rgba(0,229,255,${0.08 * (1 - dist / 150)})`;
            ctx.lineWidth = 0.5;
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
      // dots
      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > canvas.width) p.vx *= -1;
        if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,229,255,${p.o})`;
        ctx.fill();
      }
      animId = requestAnimationFrame(draw);
    };
    draw();
    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="fixed inset-0 z-0 pointer-events-none" />;
};

/* ── Floating status text ── */
const FloatingStatus = () => {
  const texts = useMemo(
    () => ["Stability Loading...", "Memory Map Initializing...", "Optimization Engine Starting..."],
    []
  );
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx((i) => (i + 1) % texts.length), 3000);
    return () => clearInterval(t);
  }, [texts]);

  return (
    <AnimatePresence mode="wait">
      <motion.p
        key={idx}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 0.5, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.6 }}
        className="text-xs text-[hsl(var(--primary))] font-mono tracking-widest"
      >
        {texts[idx]}
      </motion.p>
    </AnimatePresence>
  );
};

/* ── Countdown timer ── */
const CountdownTimer = ({ launchDate }: { launchDate: string }) => {
  const [time, setTime] = useState({ d: 0, h: 0, m: 0, s: 0 });

  useEffect(() => {
    const target = new Date(launchDate).getTime();
    const tick = () => {
      const diff = Math.max(0, target - Date.now());
      setTime({
        d: Math.floor(diff / 86400000),
        h: Math.floor((diff % 86400000) / 3600000),
        m: Math.floor((diff % 3600000) / 60000),
        s: Math.floor((diff % 60000) / 1000),
      });
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [launchDate]);

  const units = [
    { label: "Days", value: time.d },
    { label: "Hours", value: time.h },
    { label: "Minutes", value: time.m },
    { label: "Seconds", value: time.s },
  ];

  return (
    <div className="flex gap-3 md:gap-5 justify-center">
      {units.map((u) => (
        <div key={u.label} className="flex flex-col items-center">
          <div className="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-[hsl(var(--card))]/60 backdrop-blur-xl border border-[hsl(var(--border))]/40 flex items-center justify-center">
            <AnimatePresence mode="wait">
              <motion.span
                key={u.value}
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -10, opacity: 0 }}
                transition={{ duration: 0.3 }}
                className="text-2xl md:text-3xl font-bold text-[hsl(var(--foreground))] tabular-nums"
              >
                {String(u.value).padStart(2, "0")}
              </motion.span>
            </AnimatePresence>
          </div>
          <span className="text-[10px] md:text-xs text-[hsl(var(--muted-foreground))] mt-1.5 uppercase tracking-wider font-medium">
            {u.label}
          </span>
        </div>
      ))}
    </div>
  );
};

/* ── Animated stat counter ── */
const AnimatedStat = ({ target, label, suffix = "" }: { target: number; label: string; suffix?: string }) => {
  const [val, setVal] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          let start = 0;
          const dur = 2000;
          const startTime = Date.now();
          const animate = () => {
            const elapsed = Date.now() - startTime;
            const progress = Math.min(elapsed / dur, 1);
            const eased = 1 - Math.pow(1 - progress, 3);
            setVal(Math.floor(eased * target));
            if (progress < 1) requestAnimationFrame(animate);
          };
          animate();
          observer.disconnect();
        }
      },
      { threshold: 0.5 }
    );
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [target]);

  return (
    <div ref={ref} className="text-center">
      <p className="text-2xl md:text-3xl font-bold text-[hsl(var(--foreground))]">
        {val.toLocaleString()}{suffix}
      </p>
      <p className="text-xs text-[hsl(var(--muted-foreground))] mt-1">{label}</p>
    </div>
  );
};

/* ── Main Page ── */
const ComingSoonPage = () => {
  const [config, setConfig] = useState<any>(null);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailError, setEmailError] = useState("");
  const [pulseGlow, setPulseGlow] = useState(false);

  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from("coming_soon_config")
        .select("*")
        .limit(1)
        .maybeSingle();
      if (data) setConfig(data);
    };
    load();
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setEmailError("");
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError("Please enter a valid email address.");
      return;
    }
    setSubmitting(true);
    const { error } = await supabase.from("coming_soon_emails").insert({ email: email.trim().toLowerCase() });
    setSubmitting(false);
    if (error) {
      if (error.code === "23505") {
        setEmailError("You're already on the list!");
        setSubmitted(true);
      } else {
        setEmailError("Something went wrong. Try again.");
      }
      return;
    }
    setSubmitted(true);
    setPulseGlow(true);
    setTimeout(() => setPulseGlow(false), 1500);
  }, [email]);

  return (
    <div className="relative min-h-screen bg-gradient-to-b from-[#0B0F1A] to-[#111827] overflow-hidden flex flex-col">
      {/* SEO */}
      <title>ACRY – AI Second Brain | Coming Soon</title>

      <ParticleField />

      {/* Neural grid overlay */}
      <div className="fixed inset-0 z-0 pointer-events-none opacity-[0.03]"
        style={{
          backgroundImage: "linear-gradient(rgba(0,229,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,229,255,0.3) 1px, transparent 1px)",
          backgroundSize: "60px 60px",
        }}
      />

      {/* Content */}
      <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-4 py-12 gap-10">

        {/* Hero Logo */}
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 1, ease: "easeOut" }}
          className="relative"
        >
          {/* Glow ring */}
          <motion.div
            animate={pulseGlow ? { scale: [1, 1.6, 1], opacity: [0.4, 0, 0] } : { scale: [1, 1.15, 1], opacity: [0.15, 0.05, 0.15] }}
            transition={pulseGlow ? { duration: 1 } : { duration: 4, repeat: Infinity }}
            className="absolute inset-0 rounded-full bg-[#00E5FF]/20 blur-3xl -z-10"
            style={{ width: "200%", height: "200%", left: "-50%", top: "-50%" }}
          />
          <ACRYLogo variant="icon" animate={true} className="w-24 h-24 md:w-32 md:h-32" />
        </motion.div>

        {/* Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.8 }}
          className="text-center space-y-3"
        >
          <h1 className="text-3xl md:text-5xl font-bold text-[hsl(var(--foreground))] tracking-tight">
            {config?.hero_text || "ACRY – AI Second Brain"}
          </h1>
          <p className="text-base md:text-lg text-[hsl(var(--muted-foreground))]">
            {config?.sub_text || "Launching Soon."}
          </p>
        </motion.div>

        {/* Floating status */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
        >
          <FloatingStatus />
        </motion.div>

        {/* Countdown */}
        {config?.countdown_enabled && config?.launch_date && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
          >
            <CountdownTimer launchDate={config.launch_date} />
          </motion.div>
        )}

        {/* Email Capture */}
        {config?.email_capture_enabled && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.2 }}
            className="w-full max-w-md"
          >
            <div className="rounded-2xl bg-[hsl(var(--card))]/40 backdrop-blur-2xl border border-[hsl(var(--border))]/30 p-6 md:p-8 space-y-5">
              <div className="text-center space-y-1">
                <h2 className="text-lg font-semibold text-[hsl(var(--foreground))]">
                  Be First to Activate Your AI Brain.
                </h2>
              </div>

              {submitted ? (
                <motion.div
                  initial={{ scale: 0.9, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  className="flex flex-col items-center gap-2 py-4"
                >
                  <CheckCircle2 className="w-10 h-10 text-[#00FF94]" />
                  <p className="text-sm font-medium text-[#00FF94]">
                    ✓ You're on the priority list.
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSubmit} className="space-y-3">
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[hsl(var(--muted-foreground))]" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => { setEmail(e.target.value); setEmailError(""); }}
                      placeholder="Enter your email"
                      maxLength={255}
                      className="w-full pl-10 pr-4 py-3 rounded-xl bg-[hsl(var(--background))]/60 border border-[hsl(var(--border))]/40 text-sm text-[hsl(var(--foreground))] placeholder:text-[hsl(var(--muted-foreground))] focus:outline-none focus:ring-2 focus:ring-[#00E5FF]/40 focus:border-[#00E5FF]/40 transition-all"
                    />
                  </div>
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                  <motion.button
                    whileTap={{ scale: 0.97 }}
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-xl bg-gradient-to-r from-[#00E5FF] to-[#7C4DFF] text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#00E5FF]/20 hover:shadow-[#00E5FF]/40 transition-shadow relative overflow-hidden"
                  >
                    {/* Glow pulse */}
                    <motion.div
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12"
                    />
                    <Rocket className="w-4 h-4 relative z-10" />
                    <span className="relative z-10">{submitting ? "Submitting..." : "Notify Me at Launch"}</span>
                  </motion.button>
                </form>
              )}
            </div>
          </motion.div>
        )}

        {/* Hype Stats */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1.6 }}
          className="flex gap-8 md:gap-14 flex-wrap justify-center"
        >
          <AnimatedStat target={10000} label="Early Users Joined" suffix="+" />
          <AnimatedStat target={87} label="Mock Improvement Rate" suffix="%" />
          <AnimatedStat target={92} label="Retention Boost" suffix="%" />
        </motion.div>
      </div>

      {/* Footer */}
      <div className="relative z-10 text-center pb-6">
        <p className="text-[10px] text-[hsl(var(--muted-foreground))]/50 tracking-wider uppercase">
          © {new Date().getFullYear()} ACRY. All rights reserved.
        </p>
      </div>
    </div>
  );
};

export default ComingSoonPage;
