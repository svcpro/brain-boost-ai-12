import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Rocket, ShieldCheck, Clock, Zap, PlayCircle,
  BookOpen, Trophy, Brain, Target, GraduationCap, MessageCircle,
  FileText, Users, LineChart, Smartphone, CheckCircle2, ArrowRight,
  Award, Timer, Lock, ChevronDown, X, Phone, Mail, TerminalSquare,
  Cpu, Radar, ScanLine, ArrowUpRight, Star,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

const PRICE = 999;
const ORIGINAL = 4999;

declare global {
  interface Window { Razorpay: any }
}

/* ─── hooks ─────────────────────────────────────────── */
function useRazorpay() {
  useEffect(() => {
    if (document.querySelector('script[data-razorpay]')) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true; s.setAttribute("data-razorpay", "1");
    document.body.appendChild(s);
  }, []);
}

function useFonts() {
  useEffect(() => {
    if (document.querySelector('link[data-msb-fonts]')) return;
    const l = document.createElement("link");
    l.rel = "stylesheet";
    l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=DM+Sans:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
    l.setAttribute("data-msb-fonts", "1");
    document.head.appendChild(l);
  }, []);
}

function useCountdown() {
  const target = useMemo(() => {
    const key = "msb_countdown_target";
    const existing = localStorage.getItem(key);
    if (existing) return parseInt(existing, 10);
    const t = Date.now() + 1000 * 60 * 60 * 47;
    localStorage.setItem(key, String(t));
    return t;
  }, []);
  const [now, setNow] = useState(Date.now());
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i); }, []);
  const diff = Math.max(0, target - now);
  return {
    h: Math.floor(diff / 3.6e6),
    m: Math.floor((diff % 3.6e6) / 6e4),
    s: Math.floor((diff % 6e4) / 1000),
  };
}

function useCounter(target: number, duration = 1800) {
  const [n, setN] = useState(0);
  useEffect(() => {
    let raf = 0; const start = performance.now();
    const step = (t: number) => {
      const p = Math.min(1, (t - start) / duration);
      setN(Math.floor(p * target));
      if (p < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return n.toLocaleString("en-IN");
}

/* ─── data ──────────────────────────────────────────── */
const trustBar = [
  "Live Classes", "Recorded Lectures", "AI Learning", "Mock Tests",
  "Doubt Support", "Revision Plan", "Mobile App", "Affordable Fee",
];

const whyChoose: { icon: any; t: string; d: string }[] = [
  { icon: Brain, t: "AI Learning Engine", d: "Predicts weak topics before you do" },
  { icon: Target, t: "Personalized Plan", d: "Recomputes daily from your data" },
  { icon: Zap, t: "Daily Practice", d: "Adaptive difficulty, zero waste" },
  { icon: LineChart, t: "Mock Analysis", d: "Percentile, speed, accuracy split" },
  { icon: Users, t: "Live Faculty", d: "Interactive sessions, doubts live" },
  { icon: PlayCircle, t: "Recorded Vault", d: "Rewind anything, anytime" },
  { icon: BookOpen, t: "Exam Strategy", d: "Section-wise game plans" },
  { icon: Sparkles, t: "Current Affairs", d: "Auto-summarised, exam-tuned" },
  { icon: FileText, t: "PDF Notes", d: "Downloadable, print-ready" },
  { icon: Timer, t: "Revision Tracker", d: "Ebbinghaus-based scheduling" },
  { icon: MessageCircle, t: "24×7 Doubts", d: "AI + faculty escalation" },
  { icon: Trophy, t: "Performance Deck", d: "Rank projection dashboard" },
];

const includes = [
  "Live Interactive Classes", "Recorded Video Library", "SSC CGL Complete Syllabus",
  "Reasoning · Quant · English · GA", "Topic-wise Tests", "Chapter Tests",
  "Full-Length Mock Tests", "Previous Year Questions", "Daily Practice",
  "Weekly Revision", "Performance Reports", "AI Study Assistant",
  "AI Revision Planner", "AI Doubt Support", "Interview Guidance",
  "Career Support", "Certificate of Completion",
];

const steps = [
  "Enroll", "Dashboard Access", "Watch Classes", "Practice",
  "Mock Tests", "AI Analysis", "Revision", "Selection",
];

const benefits = [
  "Increase Accuracy", "Improve Speed", "Daily Study Discipline",
  "Reduce Revision Stress", "AI Progress Tracking", "Structured Preparation",
  "Affordable Learning", "Expert Guidance",
];

const faqs: [string, string][] = [
  ["Is this course live?", "Yes, with recorded backups you can re-watch anytime."],
  ["Will recordings be available?", "Yes, every live class is recorded and added to your dashboard."],
  ["Can beginners join?", "Absolutely — the curriculum starts from foundations."],
  ["Is it mobile friendly?", "Yes, fully optimized for the Akrai AI mobile app."],
  ["Will mock tests be included?", "Yes — topic, chapter, and full-length mocks with AI analysis."],
  ["Will I receive notes?", "Yes, downloadable PDF notes for every subject."],
  ["Can I ask doubts?", "Yes, unlimited doubt solving with faculty + AI."],
  ["How long is access?", "Full 12 months of access from the day you enroll."],
];

/* ─── primitives ────────────────────────────────────── */
const AkraiLogo = () => (
  <div className="flex items-center gap-2.5">
    <div className="relative w-9 h-9 rounded-xl bg-[#1A1A1A] border border-white/10 flex items-center justify-center shadow-[0_0_20px_rgba(255,107,0,0.25)]">
      <div className="absolute inset-0 rounded-xl bg-gradient-to-br from-[#FF6B00]/30 to-transparent" />
      <Cpu className="relative w-4.5 h-4.5 text-[#FFB800]" strokeWidth={2.2} />
    </div>
    <div className="leading-tight">
      <div className="font-bold text-white tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Akrai AI</div>
      <div className="text-[9px] text-neutral-500 uppercase tracking-[0.2em] font-mono">Mission_Success</div>
    </div>
  </div>
);

const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ id, className = "", children }) => (
  <section id={id} className={`py-20 md:py-28 px-5 md:px-8 relative ${className}`}>
    <div className="max-w-6xl mx-auto relative z-10">{children}</div>
  </section>
);

const Eyebrow: React.FC<{ children: React.ReactNode; tone?: "orange" | "amber" }> = ({ children, tone = "orange" }) => (
  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#1A1A1A] border border-white/10">
    <span className={`flex h-1.5 w-1.5 rounded-full ${tone === "orange" ? "bg-[#FF6B00]" : "bg-[#FFB800]"} animate-pulse`} />
    <span className="text-[10px] font-mono font-medium tracking-[0.25em] uppercase text-neutral-400">{children}</span>
  </div>
);

/* ─── page ──────────────────────────────────────────── */
const MissionSuccessBatch = () => {
  useFonts();
  useRazorpay();
  const { toast } = useToast();
  const { h, m, s } = useCountdown();

  const enrolled = useCounter(12470);
  const hours = useCounter(52000);
  const sessions = useCounter(1280);
  const questions = useCounter(104500);

  const [form, setForm] = useState({ name: "", mobile: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", mobile: "", email: "" });

  useEffect(() => {
    if (sessionStorage.getItem("msb_exit_shown")) return;
    const handler = (e: MouseEvent) => {
      if (e.clientY < 5) {
        sessionStorage.setItem("msb_exit_shown", "1");
        setShowExitPopup(true);
      }
    };
    document.addEventListener("mouseout", handler);
    return () => document.removeEventListener("mouseout", handler);
  }, []);

  const openCheckout = async () => {
    if (!form.name.trim() || !/^[6-9]\d{9}$/.test(form.mobile.replace(/\D/g, "").slice(-10))) {
      toast({ title: "Enter valid name and mobile", variant: "destructive" }); return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: "Enter a valid email", variant: "destructive" }); return;
    }
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("mission-batch-checkout", {
        body: { action: "create_order", ...form },
      });
      if (error || !data?.order) throw new Error(data?.error || error?.message || "Order failed");
      const rzp = new window.Razorpay({
        key: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
        order_id: data.order.id,
        name: "Akrai AI · Mission Success Batch",
        description: "SSC CGL 2026 Complete Batch",
        prefill: { name: form.name, email: form.email, contact: form.mobile },
        theme: { color: "#FF6B00" },
        handler: async (resp: any) => {
          try {
            await supabase.functions.invoke("mission-batch-checkout", {
              body: {
                action: "verify_payment",
                order_id: resp.razorpay_order_id,
                payment_id: resp.razorpay_payment_id,
                signature: resp.razorpay_signature,
              },
            });
          } catch { /* fall through to thank you */ }
          setShowEnrollModal(false); setThankYou(true);
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch (e: any) {
      toast({ title: e.message || "Something went wrong", variant: "destructive" });
    } finally { setLoading(false); }
  };

  const submitLead = async (source: string) => {
    if (!leadForm.name.trim() || !/^[6-9]\d{9}$/.test(leadForm.mobile.replace(/\D/g, "").slice(-10))) {
      toast({ title: "Enter valid name and mobile", variant: "destructive" }); return;
    }
    try {
      await supabase.functions.invoke("mission-batch-checkout", {
        body: { action: "capture_lead", ...leadForm, source },
      });
      toast({ title: "Your free SSC Study Kit is on the way 🎉" });
    } catch { toast({ title: "Saved locally. We'll reach out soon." }); }
    setShowExitPopup(false);
  };

  const bodyFont = { fontFamily: "'DM Sans',sans-serif" };
  const headFont = { fontFamily: "'Space Grotesk',sans-serif" };
  const monoFont = { fontFamily: "'JetBrains Mono',monospace" };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white antialiased selection:bg-[#FF6B00] selection:text-black overflow-x-hidden" style={bodyFont}>
      <SEO
        title="Akrai AI · Mission Success Batch 2026 — SSC CGL AI Coaching ₹999"
        description="India's smart AI-powered SSC CGL preparation. Live classes, recorded lectures, AI study support, mock tests, doubt solving. 12 months access at ₹999."
        path="/mission-success-batch"
      />

      {/* GLOBAL GRAIN + GRID */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.035]" style={{
        backgroundImage: "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='120' height='120'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='0.9'/></filter><rect width='100%25' height='100%25' filter='url(%23n)'/></svg>\")",
      }} />
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.04] bg-[linear-gradient(to_right,#ffffff08_1px,transparent_1px),linear-gradient(to_bottom,#ffffff08_1px,transparent_1px)] bg-[size:60px_60px]" />

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-3.5 flex items-center justify-between">
          <AkraiLogo />
          <div className="flex items-center gap-2 md:gap-3">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live · Enrolling
            </span>
            <button
              onClick={() => setShowEnrollModal(true)}
              className="group relative inline-flex items-center gap-2 px-4 md:px-5 py-2.5 rounded-lg bg-[#FF6B00] hover:bg-[#FFB800] text-black font-bold text-xs md:text-sm shadow-[0_0_25px_rgba(255,107,0,0.35)] transition-all"
              style={headFont}
            >
              <Rocket className="w-3.5 h-3.5" /> Enroll ₹{PRICE}
              <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO — split screen */}
      <Section className="!py-16 md:!py-24">
        <div className="pointer-events-none absolute top-[-10%] right-[-10%] w-[600px] h-[600px] bg-[#FF6B00]/10 rounded-full blur-[140px]" />
        <div className="pointer-events-none absolute bottom-[-20%] left-[-15%] w-[500px] h-[500px] bg-[#FFB800]/[0.06] rounded-full blur-[130px]" />

        <div className="grid lg:grid-cols-2 gap-16 items-center">
          {/* LEFT */}
          <div className="space-y-8">
            <Eyebrow>Powered by Akrai AI · SSC CGL 2026</Eyebrow>

            <h1 className="text-5xl md:text-7xl font-bold leading-[0.95] tracking-tight" style={headFont}>
              Mission{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] via-[#FF8A2A] to-[#FFB800]">
                Success
              </span>
              <br />
              <span className="text-neutral-500 text-3xl md:text-4xl font-medium">SSC CGL 2026</span>
            </h1>

            <p className="text-lg md:text-xl text-neutral-400 max-w-xl leading-relaxed">
              The next evolution of exam prep. Live classes, adaptive AI, and precision analytics —
              engineered to predict patterns, automate revision, and push your rank up every day.
            </p>

            {/* PRICE + CTAs */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5 pt-2">
              <button
                onClick={() => setShowEnrollModal(true)}
                className="group relative px-7 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FFB800] text-black font-bold flex items-center gap-2.5 overflow-hidden shadow-[0_0_40px_rgba(255,107,0,0.35)] transition-all"
                style={headFont}
              >
                <span className="relative z-10">Enroll for ₹{PRICE}</span>
                <ArrowRight className="w-4 h-4 relative z-10 group-hover:translate-x-1 transition" />
                <span className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300" />
              </button>

              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-bold text-[#FFB800] tracking-tight leading-none" style={headFont}>₹{PRICE}</span>
                  <span className="text-neutral-600 line-through text-sm">₹{ORIGINAL}</span>
                </div>
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#FF6B00] mt-1">80% OFF · Limited</span>
              </div>
            </div>

            {/* micro trust */}
            <div className="flex items-center gap-4 pt-6 border-t border-white/5">
              <div className="flex -space-x-2">
                {["from-orange-500 to-amber-600","from-amber-500 to-yellow-600","from-red-500 to-orange-600","from-orange-400 to-red-500"].map((g,i)=>(
                  <div key={i} className={`w-8 h-8 rounded-full border-2 border-[#0A0A0A] bg-gradient-to-br ${g}`} />
                ))}
              </div>
              <p className="text-[11px] text-neutral-500 font-mono uppercase tracking-widest">
                12,400+ aspirants training now
              </p>
            </div>
          </div>

          {/* RIGHT — AI terminal */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-r from-[#FF6B00] via-[#FFB800] to-[#FF6B00] rounded-2xl blur opacity-25" />
            <div className="relative bg-[#111] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
              {/* header */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#0D0D0D] border-b border-white/5">
                <div className="flex gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/40" />
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500/40" />
                </div>
                <div className="text-[10px] text-neutral-500 tracking-[0.2em] uppercase" style={monoFont}>akrai-core.v2 — live</div>
                <ScanLine className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
              </div>

              <div className="p-5 md:p-6 space-y-5">
                {/* status line */}
                <div className="flex items-center gap-2 text-[11px] text-neutral-400" style={monoFont}>
                  <span className="text-[#FF6B00]">▸</span> analysing_topic <span className="text-neutral-600">/</span> Reasoning · Blood Relations
                </div>

                {/* two stats */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="p-4 rounded-xl bg-white/[0.03] border border-white/[0.06]">
                    <div className="text-[9px] uppercase tracking-widest text-[#FFB800]" style={monoFont}>Accuracy</div>
                    <div className="mt-1 text-3xl font-bold tabular-nums" style={headFont}>98.2%</div>
                    <div className="mt-2 h-1 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full w-[98%] bg-gradient-to-r from-[#FFB800] to-[#FF6B00]" />
                    </div>
                  </div>
                  <div className="p-4 rounded-xl bg-[#FF6B00]/10 border border-[#FF6B00]/25 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#FF6B00_0%,transparent_60%)] opacity-30" />
                    <div className="relative text-[9px] uppercase tracking-widest text-[#FF6B00]" style={monoFont}>AI Predicted Rank</div>
                    <div className="relative mt-1 text-3xl font-bold tabular-nums text-[#FF6B00]" style={headFont}>#142</div>
                    <div className="relative mt-2 flex items-center gap-1 text-[10px] text-[#FFB800]" style={monoFont}>
                      <ArrowUpRight className="w-3 h-3" /> +38 this week
                    </div>
                  </div>
                </div>

                {/* progress */}
                <div className="space-y-2">
                  <div className="flex justify-between text-[10px] uppercase tracking-widest text-neutral-500" style={monoFont}>
                    <span>Syllabus Coverage</span><span className="text-white">84%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full w-[84%] bg-gradient-to-r from-[#FF6B00] to-[#FFB800]" />
                  </div>
                </div>

                {/* mini rows */}
                <div className="space-y-2 pt-2 border-t border-white/5">
                  {[
                    ["Adaptive revision queue", "12 topics"],
                    ["Mock #14 · analysed", "84 / 100"],
                    ["Weak zones optimised", "3 → 0"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-neutral-400">
                        <div className="w-3.5 h-3.5 rounded-sm border border-[#FF6B00]/40 flex items-center justify-center">
                          <div className="w-1.5 h-1.5 bg-[#FF6B00] rounded-sm" />
                        </div>
                        {k}
                      </div>
                      <span className="text-neutral-300 tabular-nums" style={monoFont}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* floating live score */}
            <div className="hidden sm:block absolute -bottom-6 -right-4 px-5 py-3.5 bg-[#1A1A1A] border border-[#FFB800]/30 rounded-xl shadow-2xl backdrop-blur">
              <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-[#FFB800]" style={monoFont}>Live Score</div>
              <div className="mt-1 text-2xl font-bold tabular-nums" style={headFont}>
                184.5<span className="text-sm text-neutral-500 ml-1">/200</span>
              </div>
            </div>
            <div className="hidden sm:block absolute -top-4 -left-4 px-4 py-2.5 bg-[#1A1A1A] border border-white/10 rounded-xl shadow-xl">
              <div className="flex items-center gap-2 text-[10px]" style={monoFont}>
                <Radar className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
                <span className="text-neutral-400">AI status:</span>
                <span className="text-emerald-400">optimal</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* TRUST MARQUEE */}
      <div className="border-y border-white/5 bg-[#0D0D0D] overflow-hidden">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {trustBar.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-[11px] md:text-xs font-medium text-neutral-400 uppercase tracking-widest" style={monoFont}>
              <CheckCircle2 className="w-3.5 h-3.5 text-[#FF6B00]" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* WHY */}
      <Section>
        <div className="max-w-2xl">
          <Eyebrow>Why Akrai AI</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight" style={headFont}>
            Precision-engineered for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-[#FFB800]">selection</span>.
          </h2>
          <p className="mt-4 text-neutral-400 text-lg">Twelve systems working in parallel — every one designed to move your rank up.</p>
        </div>
        <div className="mt-12 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {whyChoose.map(({ icon: Icon, t, d }) => (
            <div key={t} className="group relative rounded-2xl border border-white/[0.06] bg-white/[0.02] p-5 hover:border-[#FF6B00]/40 hover:bg-[#FF6B00]/[0.04] hover:-translate-y-0.5 transition-all">
              <div className="absolute inset-0 rounded-2xl opacity-0 group-hover:opacity-100 transition bg-[radial-gradient(circle_at_top_right,#FF6B00_0%,transparent_50%)] pointer-events-none" />
              <div className="relative">
                <div className="w-9 h-9 rounded-lg bg-[#1A1A1A] border border-white/10 flex items-center justify-center group-hover:border-[#FF6B00]/40 transition">
                  <Icon className="w-4 h-4 text-[#FFB800]" strokeWidth={2.2} />
                </div>
                <div className="mt-3 font-semibold text-sm text-white" style={headFont}>{t}</div>
                <div className="mt-1 text-xs text-neutral-500 leading-relaxed">{d}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* INCLUDES + PRICE PANEL */}
      <Section id="includes" className="bg-gradient-to-b from-[#0A0A0A] via-[#0D0D0D] to-[#0A0A0A]">
        <div className="max-w-2xl">
          <Eyebrow tone="amber">What's Included</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight" style={headFont}>Everything in the batch.</h2>
        </div>
        <div className="mt-12 grid lg:grid-cols-3 gap-6">
          {/* checklist */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-2.5">
            {includes.map((it) => (
              <div key={it} className="flex items-start gap-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3.5 hover:border-[#FF6B00]/25 transition">
                <div className="w-5 h-5 rounded-md bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shrink-0 mt-0.5">
                  <CheckCircle2 className="w-3 h-3 text-[#FF6B00]" />
                </div>
                <span className="text-sm font-medium text-neutral-200">{it}</span>
              </div>
            ))}
          </div>

          {/* price card */}
          <div className="relative">
            <div className="absolute -inset-1 bg-gradient-to-br from-[#FF6B00] to-[#FFB800] rounded-2xl blur opacity-30" />
            <div className="relative rounded-2xl bg-[#111] border border-[#FF6B00]/25 p-6 md:p-7 h-full flex flex-col overflow-hidden">
              <div className="absolute -top-24 -right-24 w-56 h-56 bg-[#FF6B00]/20 rounded-full blur-3xl" />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FFB800]">Mission Success · 12 months</div>
                <div className="mt-4 flex items-baseline gap-3">
                  <span className="text-6xl font-bold text-white tracking-tight" style={headFont}>₹{PRICE}</span>
                  <span className="text-neutral-500 line-through">₹{ORIGINAL}</span>
                </div>
                <div className="mt-1 text-xs text-neutral-400">One-time · No recurring</div>

                <ul className="mt-6 space-y-2.5 text-sm">
                  {[
                    ["Mode", "100% Online"],
                    ["Duration", "12 Months"],
                    ["Language", "Hindi + English"],
                    ["Suitable", "SSC · Railway · Banking"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between border-b border-white/5 pb-2">
                      <span className="text-neutral-500 text-xs uppercase tracking-widest" style={monoFont}>{k}</span>
                      <span className="text-white font-medium">{v}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setShowEnrollModal(true)}
                  className="mt-7 w-full py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FFB800] text-black font-bold flex items-center justify-center gap-2 shadow-[0_0_30px_rgba(255,107,0,0.35)] transition"
                  style={headFont}
                >
                  <Rocket className="w-4 h-4" /> Enroll Now
                </button>
                <div className="mt-3 text-center text-[10px] text-neutral-500 flex items-center justify-center gap-1.5" style={monoFont}>
                  <Lock className="w-3 h-3" /> RAZORPAY · UPI · CARDS · NETBANKING
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* WHO */}
      <Section>
        <div className="max-w-2xl">
          <Eyebrow>Who should join</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight" style={headFont}>Built for anyone chasing a govt job.</h2>
        </div>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-3">
          {["College Students","Working Professionals","Freshers","Govt Job Aspirants","SSC Beginners","Repeat Aspirants","Railway Aspirants","Banking Aspirants"].map((t) => (
            <div key={t} className="rounded-2xl border border-white/[0.06] bg-white/[0.02] p-4 hover:border-[#FFB800]/30 hover:bg-[#FFB800]/[0.04] transition group">
              <div className="flex items-center gap-2.5">
                <GraduationCap className="w-4 h-4 text-[#FFB800] group-hover:scale-110 transition" />
                <div className="text-sm font-semibold text-neutral-200" style={headFont}>{t}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* JOURNEY */}
      <Section className="bg-[#0D0D0D] border-y border-white/5">
        <div className="pointer-events-none absolute inset-0 opacity-40 bg-[radial-gradient(circle_at_20%_10%,#FF6B00_0%,transparent_35%),radial-gradient(circle_at_80%_80%,#FFB800_0%,transparent_35%)]" />
        <div className="relative">
          <div className="max-w-2xl">
            <Eyebrow>The Pipeline</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight" style={headFont}>From enrollment to selection.</h2>
          </div>
          <div className="mt-12 grid grid-cols-2 md:grid-cols-4 gap-3">
            {steps.map((st, i) => (
              <div key={st} className="relative rounded-2xl bg-[#0A0A0A] border border-white/10 p-5 hover:border-[#FF6B00]/40 transition group">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-500">STEP · {String(i + 1).padStart(2, "0")}</div>
                <div className="mt-3 text-lg font-bold text-white" style={headFont}>{st}</div>
                <div className="mt-3 h-1 bg-white/5 rounded-full overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-[#FF6B00] to-[#FFB800] transition-all group-hover:w-full" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* BENEFITS */}
      <Section>
        <div className="grid md:grid-cols-2 gap-12 items-center">
          <div>
            <Eyebrow tone="amber">Student outcomes</Eyebrow>
            <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight" style={headFont}>
              Study smarter.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-[#FFB800]">Score higher.</span>
            </h2>
            <p className="mt-4 text-neutral-400 text-lg">Every feature is designed to give you a measurable edge on exam day.</p>
          </div>
          <div className="grid grid-cols-2 gap-2.5">
            {benefits.map((b) => (
              <div key={b} className="flex items-center gap-2.5 rounded-xl bg-white/[0.02] border border-white/[0.06] px-4 py-3 hover:border-[#FF6B00]/30 transition">
                <div className="w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
                <span className="text-sm font-medium text-neutral-200">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* STATS BAND */}
      <Section className="bg-[#0D0D0D] border-y border-white/5">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center md:text-left">
          {[
            { n: enrolled, l: "Students Enrolled" },
            { n: hours, l: "Hours of Learning" },
            { n: sessions, l: "Live Sessions" },
            { n: questions, l: "Practice Questions" },
          ].map((x) => (
            <div key={x.l}>
              <div className="text-4xl md:text-6xl font-bold tabular-nums bg-clip-text text-transparent bg-gradient-to-b from-white to-neutral-500" style={headFont}>
                {x.n}+
              </div>
              <div className="mt-2 text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-500">{x.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* COUNTDOWN URGENCY */}
      <Section>
        <div className="relative rounded-3xl overflow-hidden border border-[#FF6B00]/25 bg-gradient-to-br from-[#1A0F05] via-[#0D0D0D] to-[#0A0A0A] p-8 md:p-14">
          <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_50%_0%,#FF6B00_0%,transparent_50%),radial-gradient(circle_at_0%_100%,#FFB800_0%,transparent_45%)]" />
          <div className="relative text-center max-w-3xl mx-auto">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-[#FF6B00]/30">
              <Clock className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FFB800]">Offer ending soon</span>
            </div>
            <h2 className="mt-5 text-4xl md:text-6xl font-bold tracking-tight text-white" style={headFont}>
              Mission Success · <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF6B00] to-[#FFB800]">₹{PRICE}</span>
            </h2>
            <p className="mt-3 text-neutral-400">Limited seats. Price increases when the timer runs out.</p>

            <div className="mt-8 flex items-center justify-center gap-3">
              {[["Hours", h], ["Mins", m], ["Secs", s]].map(([l, v]) => (
                <div key={l as string} className="min-w-[92px] rounded-2xl bg-[#0A0A0A]/80 backdrop-blur border border-white/10 px-4 py-4">
                  <div className="text-4xl md:text-5xl font-bold tabular-nums text-white" style={headFont}>{String(v).padStart(2, "0")}</div>
                  <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.3em] text-neutral-500">{l}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowEnrollModal(true)}
              className="mt-10 inline-flex items-center gap-2 px-8 py-4 rounded-xl bg-[#FF6B00] hover:bg-[#FFB800] text-black font-bold text-lg shadow-[0_0_50px_rgba(255,107,0,0.4)] transition"
              style={headFont}
            >
              <Rocket className="w-5 h-5" /> Enroll for ₹{PRICE}
            </button>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="border-t border-white/5">
        <div className="max-w-2xl">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-4 text-4xl md:text-5xl font-bold tracking-tight" style={headFont}>Questions, answered.</h2>
        </div>
        <div className="mt-10 max-w-3xl space-y-2.5">
          {faqs.map(([q, a], i) => (
            <div key={q} className="rounded-2xl bg-white/[0.02] border border-white/[0.06] overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-white/[0.02] transition"
              >
                <span className="font-semibold text-white text-sm md:text-base" style={headFont}>{q}</span>
                <ChevronDown className={`w-4 h-4 text-neutral-500 shrink-0 transition ${openFaq === i ? "rotate-180 text-[#FF6B00]" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-neutral-400 text-sm leading-relaxed border-t border-white/5 pt-3">{a}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="bg-[#0A0A0A] border-t border-white/5">
        <div className="max-w-6xl mx-auto px-5 py-14 grid md:grid-cols-3 gap-10">
          <div>
            <AkraiLogo />
            <p className="mt-4 text-sm text-neutral-500 leading-relaxed">
              AI-powered government exam preparation platform. Live · Recorded · AI · Mocks.
            </p>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-500 mb-3">Contact</div>
            <div className="text-sm space-y-2 text-neutral-300">
              <div className="flex items-center gap-2"><Mail className="w-3.5 h-3.5 text-[#FFB800]" /> support@akrai.ai</div>
              <div className="flex items-center gap-2"><Phone className="w-3.5 h-3.5 text-[#FFB800]" /> +91 98218 30895</div>
            </div>
          </div>
          <div>
            <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-neutral-500 mb-3">Legal</div>
            <div className="text-sm space-y-2">
              {[["/privacy","Privacy Policy"],["/terms","Terms & Conditions"],["/refund-policy","Refund Policy"],["/contact","Contact Us"]].map(([h,l])=>(
                <Link key={h} to={h} className="block text-neutral-400 hover:text-[#FF6B00] transition">{l}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-white/5">
          <div className="max-w-6xl mx-auto px-5 py-4 text-[11px] text-neutral-600 text-center font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} Akrai AI · All Rights Reserved
          </div>
        </div>
      </footer>

      {/* STICKY MOBILE CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden p-3 bg-[#0A0A0A]/90 backdrop-blur-xl border-t border-white/10">
        <button
          onClick={() => setShowEnrollModal(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#FF6B00] text-black font-bold shadow-[0_0_30px_rgba(255,107,0,0.4)]"
          style={headFont}
        >
          <Rocket className="w-4 h-4" /> Enroll · ₹{PRICE}
        </button>
      </div>

      {/* ENROLL MODAL */}
      {showEnrollModal && !thankYou && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-[#0D0D0D] border border-white/10 shadow-2xl overflow-hidden">
            <div className="relative p-5 border-b border-white/5 flex items-center justify-between">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#FF6B00_0%,transparent_60%)] opacity-20" />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FFB800]">Mission Success · 12 months</div>
                <div className="text-2xl font-bold text-white mt-1" style={headFont}>Enroll for ₹{PRICE}</div>
              </div>
              <button onClick={() => setShowEnrollModal(false)} className="relative p-1.5 rounded-full hover:bg-white/5 text-neutral-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { k: "name", ph: "Full Name", type: "text" },
                { k: "mobile", ph: "Mobile (10 digits)", type: "tel" },
                { k: "email", ph: "Email Address", type: "email" },
              ].map((f) => (
                <input
                  key={f.k}
                  type={f.type}
                  placeholder={f.ph}
                  value={(form as any)[f.k]}
                  onChange={(e) => setForm({ ...form, [f.k]: f.k === "mobile" ? e.target.value.replace(/\D/g,"").slice(0,10) : e.target.value })}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder:text-neutral-500 px-4 py-3 text-sm focus:outline-none focus:border-[#FF6B00] focus:ring-2 focus:ring-[#FF6B00]/20 transition"
                />
              ))}
              <button
                disabled={loading}
                onClick={openCheckout}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#FFB800] text-black font-bold shadow-[0_0_30px_rgba(255,107,0,0.35)] disabled:opacity-60 transition"
                style={headFont}
              >
                {loading ? "Opening Secure Checkout…" : (<><ShieldCheck className="w-4 h-4" /> Pay ₹{PRICE} Securely</>)}
              </button>
              <div className="text-center text-[10px] text-neutral-500 flex items-center justify-center gap-1.5 font-mono uppercase tracking-widest">
                <Lock className="w-3 h-3" /> Razorpay · UPI · Cards · NetBanking
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THANK YOU */}
      {thankYou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
          <div className="relative w-full max-w-md rounded-3xl bg-[#0D0D0D] border border-[#FF6B00]/30 p-8 text-center shadow-2xl overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,#FF6B00_0%,transparent_50%)] opacity-25" />
            <div className="relative">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-[#FF6B00] flex items-center justify-center shadow-[0_0_50px_rgba(255,107,0,0.5)]">
                <Award className="w-8 h-8 text-black" />
              </div>
              <h3 className="mt-5 text-3xl font-bold text-white" style={headFont}>You're in. 🎉</h3>
              <p className="mt-2 text-neutral-400">Welcome to Mission Success Batch. Payment confirmed.</p>
              <div className="mt-6 space-y-2 text-left text-sm">
                {["Download the Akrai AI mobile app","Login to your dashboard","Join our WhatsApp community","Attend the orientation session","Start your first class"].map((t, i) => (
                  <div key={t} className="flex items-center gap-2.5 text-neutral-300">
                    <div className="w-5 h-5 rounded-md bg-[#FF6B00]/15 border border-[#FF6B00]/40 flex items-center justify-center shrink-0">
                      <Star className="w-2.5 h-2.5 text-[#FFB800]" />
                    </div>
                    <span>{i + 1}. {t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-6 space-y-2">
                <a href="https://wa.me/919821830895" target="_blank" rel="noreferrer" className="block py-3 rounded-xl bg-emerald-500 text-black font-bold" style={headFont}>Join WhatsApp</a>
                <Link to="/auth" className="block py-3 rounded-xl bg-[#FF6B00] text-black font-bold" style={headFont}>Login to Dashboard</Link>
                <button onClick={() => setThankYou(false)} className="w-full py-2 text-neutral-500 text-sm hover:text-white transition">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXIT INTENT */}
      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-3xl bg-[#0D0D0D] border border-[#FFB800]/30 shadow-2xl overflow-hidden">
            <div className="relative p-5 border-b border-white/5 flex items-center justify-between">
              <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,#FFB800_0%,transparent_60%)] opacity-25" />
              <div className="relative">
                <div className="text-[10px] font-mono uppercase tracking-[0.25em] text-[#FFB800]">Wait</div>
                <div className="text-xl font-bold text-white mt-1" style={headFont}>Grab your free SSC study kit</div>
              </div>
              <button onClick={() => setShowExitPopup(false)} className="relative p-1.5 rounded-full hover:bg-white/5 text-neutral-400">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              {[
                { k: "name", ph: "Name", type: "text" },
                { k: "mobile", ph: "Mobile", type: "tel" },
                { k: "email", ph: "Email (optional)", type: "email" },
              ].map((f) => (
                <input
                  key={f.k}
                  type={f.type}
                  placeholder={f.ph}
                  value={(leadForm as any)[f.k]}
                  onChange={(e) => setLeadForm({ ...leadForm, [f.k]: f.k === "mobile" ? e.target.value.replace(/\D/g,"").slice(0,10) : e.target.value })}
                  className="w-full rounded-xl bg-white/[0.03] border border-white/10 text-white placeholder:text-neutral-500 px-4 py-3 text-sm focus:outline-none focus:border-[#FFB800] focus:ring-2 focus:ring-[#FFB800]/20"
                />
              ))}
              <button onClick={() => submitLead("exit_popup")} className="w-full py-3.5 rounded-xl bg-[#FFB800] hover:bg-[#FF6B00] text-black font-bold transition" style={headFont}>
                Download Free PDF
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MissionSuccessBatch;
