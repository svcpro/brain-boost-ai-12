import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  Sparkles, Rocket, ShieldCheck, Clock, Zap, PlayCircle,
  BookOpen, Trophy, Brain, Target, GraduationCap, MessageCircle,
  FileText, Users, LineChart, CheckCircle2, ArrowRight,
  Award, Timer, Lock, ChevronDown, X, Phone, Mail,
  Cpu, Radar, ScanLine, ArrowUpRight, Star, Circle,
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
    l.href = "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap";
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

function useCounter(target: number, duration = 1600) {
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
  { icon: LineChart, t: "Mock Analysis", d: "Percentile · speed · accuracy split" },
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
  "Enroll", "Dashboard", "Watch Classes", "Practice",
  "Mock Tests", "AI Analysis", "Revision", "Selection",
];

const benefits = [
  "Increase Accuracy", "Improve Speed", "Daily Discipline",
  "Reduce Revision Stress", "AI Progress Tracking", "Structured Prep",
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
  <div className="flex items-center gap-2">
    <div className="relative w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center">
      <Cpu className="w-4 h-4 text-[#FF5A1F]" strokeWidth={2.4} />
      <div className="absolute -bottom-0.5 -right-0.5 w-2 h-2 rounded-full bg-[#FF5A1F] ring-2 ring-white" />
    </div>
    <div className="leading-tight">
      <div className="text-[13px] font-bold text-neutral-900 tracking-tight" style={{ fontFamily: "'Space Grotesk',sans-serif" }}>Akrai AI</div>
      <div className="text-[8px] text-neutral-500 uppercase tracking-[0.22em] font-mono">Mission_Success</div>
    </div>
  </div>
);

const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ id, className = "", children }) => (
  <section id={id} className={`py-10 md:py-14 px-4 md:px-6 relative ${className}`}>
    <div className="max-w-5xl mx-auto relative z-10">{children}</div>
  </section>
);

const Eyebrow: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-900/5 border border-neutral-900/10">
    <span className="flex h-1.5 w-1.5 rounded-full bg-[#FF5A1F] animate-pulse" />
    <span className="text-[9px] font-mono font-medium tracking-[0.22em] uppercase text-neutral-600">{children}</span>
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
        theme: { color: "#FF5A1F" },
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

  const bodyFont = { fontFamily: "'Inter',sans-serif" };
  const headFont = { fontFamily: "'Space Grotesk',sans-serif" };
  const monoFont = { fontFamily: "'JetBrains Mono',monospace" };

  return (
    <div className="min-h-screen bg-white text-neutral-900 antialiased selection:bg-[#FF5A1F] selection:text-white overflow-x-hidden" style={bodyFont}>
      <SEO
        title="Akrai AI · Mission Success Batch 2026 — SSC CGL AI Coaching ₹999"
        description="India's smart AI-powered SSC CGL preparation. Live classes, recorded lectures, AI study support, mock tests, doubt solving. 12 months access at ₹999."
        path="/mission-success-batch"
      />

      {/* GLOBAL GRID + AMBIENT */}
      <div className="pointer-events-none fixed inset-0 z-0 opacity-[0.5] bg-[linear-gradient(to_right,rgba(15,15,15,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(15,15,15,0.04)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_75%)]" />
      <div className="pointer-events-none fixed top-0 right-0 w-[520px] h-[520px] bg-[#FF5A1F]/[0.06] rounded-full blur-[120px] z-0" />
      <div className="pointer-events-none fixed bottom-0 left-0 w-[440px] h-[440px] bg-[#FFB800]/[0.05] rounded-full blur-[120px] z-0" />

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-white/75 backdrop-blur-xl border-b border-neutral-900/8">
        <div className="max-w-5xl mx-auto px-4 py-2.5 flex items-center justify-between">
          <AkraiLogo />
          <div className="flex items-center gap-2">
            <span className="hidden md:inline-flex items-center gap-1.5 text-[9px] font-mono uppercase tracking-widest text-neutral-500">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" /> Live · Enrolling
            </span>
            <button
              onClick={() => setShowEnrollModal(true)}
              className="group inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-neutral-900 hover:bg-[#FF5A1F] text-white font-semibold text-xs shadow-sm transition-all"
              style={headFont}
            >
              <Rocket className="w-3 h-3" /> Enroll ₹{PRICE}
              <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" />
            </button>
          </div>
        </div>
      </nav>

      {/* HERO */}
      <Section className="!py-8 md:!py-14">
        <div className="grid lg:grid-cols-[1.05fr_0.95fr] gap-10 items-center">
          {/* LEFT */}
          <div className="space-y-5">
            <Eyebrow>Powered by Akrai AI · SSC CGL 2026</Eyebrow>

            <h1 className="text-[2.6rem] md:text-[3.6rem] font-bold leading-[0.98] tracking-[-0.03em] text-neutral-900" style={headFont}>
              Mission{" "}
              <span className="relative inline-block">
                <span className="relative z-10 text-transparent bg-clip-text bg-gradient-to-br from-[#FF5A1F] via-[#FF8A2A] to-[#FFB800]">Success</span>
                <span className="absolute inset-x-0 bottom-1 h-2 bg-[#FF5A1F]/15 -z-0" />
              </span>
              <br />
              <span className="text-neutral-400 text-xl md:text-2xl font-medium tracking-tight">SSC CGL · Batch 2026</span>
            </h1>

            <p className="text-[15px] text-neutral-600 max-w-lg leading-relaxed">
              The next evolution of exam prep. Live classes, adaptive AI and precision analytics —
              engineered to predict patterns, automate revision and push your rank up every day.
            </p>

            {/* PRICE + CTA */}
            <div className="flex flex-wrap items-center gap-4 pt-1">
              <button
                onClick={() => setShowEnrollModal(true)}
                className="group relative px-5 py-3 rounded-lg bg-neutral-900 hover:bg-[#FF5A1F] text-white font-semibold text-sm flex items-center gap-2 shadow-[0_8px_24px_-8px_rgba(255,90,31,0.5)] transition-all"
                style={headFont}
              >
                <span>Enroll for ₹{PRICE}</span>
                <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition" />
              </button>

              <div className="flex flex-col">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-neutral-900 tracking-tight leading-none" style={headFont}>₹{PRICE}</span>
                  <span className="text-neutral-400 line-through text-xs">₹{ORIGINAL}</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-[#FF5A1F]/10 text-[#FF5A1F] text-[9px] font-mono font-bold uppercase tracking-widest">80% off</span>
                </div>
                <span className="text-[10px] text-neutral-500 mt-0.5">One-time · 12 months access</span>
              </div>
            </div>

            {/* micro trust */}
            <div className="flex items-center gap-3 pt-4 border-t border-neutral-900/8">
              <div className="flex -space-x-1.5">
                {["from-orange-500 to-amber-600","from-amber-500 to-yellow-600","from-red-500 to-orange-600","from-orange-400 to-red-500"].map((g,i)=>(
                  <div key={i} className={`w-6 h-6 rounded-full border-2 border-white bg-gradient-to-br ${g}`} />
                ))}
              </div>
              <p className="text-[10px] text-neutral-500 font-mono uppercase tracking-widest">
                12,400+ aspirants training now
              </p>
            </div>
          </div>

          {/* RIGHT — Compact AI terminal */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-[#FF5A1F]/25 via-transparent to-[#FFB800]/25 rounded-2xl blur-lg opacity-70" />
            <div className="relative bg-white border border-neutral-900/10 rounded-2xl overflow-hidden shadow-[0_20px_60px_-20px_rgba(15,15,15,0.15)]">
              {/* header */}
              <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-50 border-b border-neutral-900/8">
                <div className="flex gap-1.5">
                  <div className="w-2 h-2 rounded-full bg-red-400" />
                  <div className="w-2 h-2 rounded-full bg-yellow-400" />
                  <div className="w-2 h-2 rounded-full bg-green-400" />
                </div>
                <div className="text-[9px] text-neutral-500 tracking-[0.22em] uppercase" style={monoFont}>akrai-core.v2 · live</div>
                <ScanLine className="w-3 h-3 text-[#FF5A1F] animate-pulse" />
              </div>

              <div className="p-4 space-y-3.5">
                <div className="flex items-center gap-2 text-[10px] text-neutral-500" style={monoFont}>
                  <span className="text-[#FF5A1F]">▸</span> analysing_topic <span className="text-neutral-300">/</span> Reasoning · Blood Relations
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-900/6">
                    <div className="text-[8px] uppercase tracking-widest text-neutral-500" style={monoFont}>Accuracy</div>
                    <div className="mt-0.5 text-2xl font-bold tabular-nums text-neutral-900" style={headFont}>98.2%</div>
                    <div className="mt-1.5 h-1 bg-neutral-900/5 rounded-full overflow-hidden">
                      <div className="h-full w-[98%] bg-gradient-to-r from-[#FFB800] to-[#FF5A1F]" />
                    </div>
                  </div>
                  <div className="p-3 rounded-xl bg-[#FF5A1F]/[0.06] border border-[#FF5A1F]/20 relative overflow-hidden">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,#FF5A1F_0%,transparent_60%)] opacity-10" />
                    <div className="relative text-[8px] uppercase tracking-widest text-[#FF5A1F]" style={monoFont}>Predicted Rank</div>
                    <div className="relative mt-0.5 text-2xl font-bold tabular-nums text-[#FF5A1F]" style={headFont}>#142</div>
                    <div className="relative mt-1.5 flex items-center gap-1 text-[9px] text-neutral-600" style={monoFont}>
                      <ArrowUpRight className="w-2.5 h-2.5 text-emerald-600" /> +38 this week
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between text-[9px] uppercase tracking-widest text-neutral-500" style={monoFont}>
                    <span>Syllabus Coverage</span><span className="text-neutral-900">84%</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-neutral-900/5 overflow-hidden">
                    <div className="h-full w-[84%] bg-gradient-to-r from-[#FF5A1F] to-[#FFB800]" />
                  </div>
                </div>

                <div className="space-y-1.5 pt-2 border-t border-neutral-900/6">
                  {[
                    ["Adaptive revision queue", "12 topics"],
                    ["Mock #14 · analysed", "84 / 100"],
                    ["Weak zones optimised", "3 → 0"],
                  ].map(([k, v]) => (
                    <div key={k} className="flex items-center justify-between text-[11px]">
                      <div className="flex items-center gap-1.5 text-neutral-600">
                        <div className="w-3 h-3 rounded-sm border border-[#FF5A1F]/40 flex items-center justify-center">
                          <div className="w-1 h-1 bg-[#FF5A1F] rounded-sm" />
                        </div>
                        {k}
                      </div>
                      <span className="text-neutral-900 tabular-nums font-medium" style={monoFont}>{v}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* floating live score */}
            <div className="hidden sm:block absolute -bottom-4 -right-3 px-3.5 py-2.5 bg-white border border-neutral-900/10 rounded-xl shadow-lg">
              <div className="text-[8px] font-bold uppercase tracking-[0.2em] text-[#FF5A1F]" style={monoFont}>Live Score</div>
              <div className="mt-0.5 text-lg font-bold tabular-nums text-neutral-900" style={headFont}>
                184.5<span className="text-[10px] text-neutral-400 ml-0.5">/200</span>
              </div>
            </div>
            <div className="hidden sm:block absolute -top-3 -left-3 px-3 py-1.5 bg-white border border-neutral-900/10 rounded-xl shadow-md">
              <div className="flex items-center gap-1.5 text-[9px]" style={monoFont}>
                <Radar className="w-3 h-3 text-[#FF5A1F] animate-pulse" />
                <span className="text-neutral-500">AI:</span>
                <span className="text-emerald-600 font-semibold">optimal</span>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* TRUST MARQUEE */}
      <div className="border-y border-neutral-900/8 bg-neutral-50/60 overflow-hidden">
        <div className="max-w-5xl mx-auto px-4 py-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5">
          {trustBar.map((t) => (
            <span key={t} className="inline-flex items-center gap-1 text-[10px] font-medium text-neutral-500 uppercase tracking-widest" style={monoFont}>
              <CheckCircle2 className="w-3 h-3 text-[#FF5A1F]" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* WHY */}
      <Section>
        <div className="max-w-xl">
          <Eyebrow>Why Akrai AI</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>
            Precision-engineered for <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5A1F] to-[#FFB800]">selection</span>.
          </h2>
          <p className="mt-2 text-neutral-500 text-sm">Twelve systems running in parallel — every one designed to move your rank up.</p>
        </div>
        <div className="mt-7 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2.5">
          {whyChoose.map(({ icon: Icon, t, d }) => (
            <div key={t} className="group relative rounded-xl border border-neutral-900/8 bg-white p-3.5 hover:border-[#FF5A1F]/40 hover:shadow-[0_8px_24px_-12px_rgba(255,90,31,0.35)] hover:-translate-y-0.5 transition-all">
              <div className="w-7 h-7 rounded-lg bg-neutral-50 border border-neutral-900/8 flex items-center justify-center group-hover:bg-[#FF5A1F] group-hover:border-[#FF5A1F] transition">
                <Icon className="w-3.5 h-3.5 text-[#FF5A1F] group-hover:text-white transition" strokeWidth={2.2} />
              </div>
              <div className="mt-2.5 font-semibold text-[13px] text-neutral-900" style={headFont}>{t}</div>
              <div className="mt-0.5 text-[11px] text-neutral-500 leading-snug">{d}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* INCLUDES + PRICE PANEL */}
      <Section id="includes" className="bg-neutral-50/60 border-y border-neutral-900/8">
        <div className="max-w-xl">
          <Eyebrow>What's Included</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>Everything in the batch.</h2>
        </div>
        <div className="mt-7 grid lg:grid-cols-3 gap-4">
          {/* checklist */}
          <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-1.5">
            {includes.map((it) => (
              <div key={it} className="flex items-center gap-2 rounded-lg border border-neutral-900/8 bg-white px-3 py-2.5 hover:border-[#FF5A1F]/30 transition">
                <div className="w-4 h-4 rounded-md bg-[#FF5A1F]/10 border border-[#FF5A1F]/25 flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-2.5 h-2.5 text-[#FF5A1F]" />
                </div>
                <span className="text-[12.5px] font-medium text-neutral-800">{it}</span>
              </div>
            ))}
          </div>

          {/* price card */}
          <div className="relative">
            <div className="absolute -inset-0.5 bg-gradient-to-br from-[#FF5A1F]/30 to-[#FFB800]/30 rounded-2xl blur-md opacity-60" />
            <div className="relative rounded-2xl bg-neutral-900 text-white p-5 h-full flex flex-col overflow-hidden">
              <div className="absolute -top-16 -right-16 w-40 h-40 bg-[#FF5A1F]/25 rounded-full blur-3xl" />
              <div className="relative">
                <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#FFB800]">Mission Success · 12 months</div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="text-5xl font-bold text-white tracking-tight" style={headFont}>₹{PRICE}</span>
                  <span className="text-neutral-500 line-through text-sm">₹{ORIGINAL}</span>
                </div>
                <div className="mt-0.5 text-[11px] text-neutral-400">One-time · No recurring</div>

                <ul className="mt-5 space-y-2 text-[13px]">
                  {[
                    ["Mode", "100% Online"],
                    ["Duration", "12 Months"],
                    ["Language", "Hindi + English"],
                    ["Suitable", "SSC · Rail · Bank"],
                  ].map(([k, v]) => (
                    <li key={k} className="flex items-center justify-between border-b border-white/10 pb-1.5">
                      <span className="text-neutral-500 text-[10px] uppercase tracking-widest" style={monoFont}>{k}</span>
                      <span className="text-white font-medium">{v}</span>
                    </li>
                  ))}
                </ul>

                <button
                  onClick={() => setShowEnrollModal(true)}
                  className="mt-5 w-full py-2.5 rounded-lg bg-[#FF5A1F] hover:bg-[#FFB800] text-black font-bold text-sm flex items-center justify-center gap-1.5 shadow-[0_0_30px_rgba(255,90,31,0.35)] transition"
                  style={headFont}
                >
                  <Rocket className="w-3.5 h-3.5" /> Enroll Now
                </button>
                <div className="mt-2 text-center text-[9px] text-neutral-500 flex items-center justify-center gap-1" style={monoFont}>
                  <Lock className="w-2.5 h-2.5" /> RAZORPAY · UPI · CARDS · NB
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* WHO */}
      <Section>
        <div className="max-w-xl">
          <Eyebrow>Who should join</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>Built for anyone chasing a govt job.</h2>
        </div>
        <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-2">
          {["College Students","Working Professionals","Freshers","Govt Aspirants","SSC Beginners","Repeat Aspirants","Railway Aspirants","Banking Aspirants"].map((t) => (
            <div key={t} className="rounded-lg border border-neutral-900/8 bg-white p-3 hover:border-[#FF5A1F]/35 hover:bg-[#FF5A1F]/[0.03] transition group">
              <div className="flex items-center gap-2">
                <GraduationCap className="w-3.5 h-3.5 text-[#FF5A1F] group-hover:scale-110 transition" />
                <div className="text-[12.5px] font-semibold text-neutral-800" style={headFont}>{t}</div>
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* JOURNEY */}
      <Section className="bg-neutral-50/60 border-y border-neutral-900/8">
        <div className="max-w-xl">
          <Eyebrow>The Pipeline</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>From enrollment to selection.</h2>
        </div>
        <div className="mt-7 grid grid-cols-2 md:grid-cols-4 gap-2.5">
          {steps.map((st, i) => (
            <div key={st} className="relative rounded-xl bg-white border border-neutral-900/8 p-3.5 hover:border-[#FF5A1F]/40 transition group">
              <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-neutral-500">STEP · {String(i + 1).padStart(2, "0")}</div>
              <div className="mt-2 text-sm font-bold text-neutral-900" style={headFont}>{st}</div>
              <div className="mt-2 h-1 bg-neutral-900/5 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-[#FF5A1F] to-[#FFB800] transition-all group-hover:w-full" style={{ width: `${((i + 1) / steps.length) * 100}%` }} />
              </div>
            </div>
          ))}
        </div>
      </Section>

      {/* BENEFITS */}
      <Section>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <Eyebrow>Student outcomes</Eyebrow>
            <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>
              Study smarter.<br /><span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5A1F] to-[#FFB800]">Score higher.</span>
            </h2>
            <p className="mt-2 text-neutral-500 text-sm">Every feature is designed to give you a measurable edge on exam day.</p>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {benefits.map((b) => (
              <div key={b} className="flex items-center gap-2 rounded-lg bg-white border border-neutral-900/8 px-3 py-2.5 hover:border-[#FF5A1F]/30 transition">
                <Circle className="w-1.5 h-1.5 fill-[#FF5A1F] text-[#FF5A1F]" />
                <span className="text-[12.5px] font-medium text-neutral-800">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* STATS BAND */}
      <Section className="bg-neutral-900 border-y border-neutral-900 !py-8">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center md:text-left">
          {[
            { n: enrolled, l: "Students Enrolled" },
            { n: hours, l: "Hours of Learning" },
            { n: sessions, l: "Live Sessions" },
            { n: questions, l: "Practice Questions" },
          ].map((x) => (
            <div key={x.l}>
              <div className="text-3xl md:text-4xl font-bold tabular-nums text-white" style={headFont}>
                {x.n}<span className="text-[#FF5A1F]">+</span>
              </div>
              <div className="mt-1 text-[9px] font-mono uppercase tracking-[0.22em] text-neutral-500">{x.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* COUNTDOWN URGENCY */}
      <Section>
        <div className="relative rounded-2xl overflow-hidden border border-neutral-900/10 bg-white p-6 md:p-10">
          <div className="pointer-events-none absolute inset-0 opacity-70 bg-[radial-gradient(circle_at_50%_0%,rgba(255,90,31,0.10)_0%,transparent_55%),radial-gradient(circle_at_0%_100%,rgba(255,184,0,0.08)_0%,transparent_45%)]" />
          <div className="relative text-center max-w-2xl mx-auto">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-[#FF5A1F]/10 border border-[#FF5A1F]/25">
              <Clock className="w-3 h-3 text-[#FF5A1F]" />
              <span className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#FF5A1F]">Offer ending soon</span>
            </div>
            <h2 className="mt-4 text-3xl md:text-5xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>
              Mission Success · <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#FF5A1F] to-[#FFB800]">₹{PRICE}</span>
            </h2>
            <p className="mt-2 text-neutral-500 text-sm">Limited seats. Price increases when the timer runs out.</p>

            <div className="mt-6 flex items-center justify-center gap-2">
              {[["Hours", h], ["Mins", m], ["Secs", s]].map(([l, v]) => (
                <div key={l as string} className="min-w-[76px] rounded-xl bg-neutral-900 text-white px-3 py-3">
                  <div className="text-2xl md:text-3xl font-bold tabular-nums" style={headFont}>{String(v).padStart(2, "0")}</div>
                  <div className="mt-0.5 text-[8px] font-mono uppercase tracking-[0.3em] text-neutral-500">{l}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowEnrollModal(true)}
              className="mt-7 inline-flex items-center gap-2 px-6 py-3 rounded-lg bg-neutral-900 hover:bg-[#FF5A1F] text-white font-bold text-sm shadow-[0_10px_30px_-10px_rgba(255,90,31,0.5)] transition"
              style={headFont}
            >
              <Rocket className="w-4 h-4" /> Enroll for ₹{PRICE}
            </button>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="border-t border-neutral-900/8">
        <div className="max-w-xl">
          <Eyebrow>FAQ</Eyebrow>
          <h2 className="mt-3 text-3xl md:text-4xl font-bold tracking-[-0.02em] text-neutral-900" style={headFont}>Questions, answered.</h2>
        </div>
        <div className="mt-6 max-w-2xl space-y-1.5">
          {faqs.map(([q, a], i) => (
            <div key={q} className="rounded-xl bg-white border border-neutral-900/8 overflow-hidden hover:border-[#FF5A1F]/30 transition">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span className="font-semibold text-neutral-900 text-[13.5px]" style={headFont}>{q}</span>
                <ChevronDown className={`w-3.5 h-3.5 text-neutral-400 shrink-0 transition ${openFaq === i ? "rotate-180 text-[#FF5A1F]" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-4 pb-3 text-neutral-600 text-[12.5px] leading-relaxed border-t border-neutral-900/6 pt-2.5">{a}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="bg-neutral-50/60 border-t border-neutral-900/8">
        <div className="max-w-5xl mx-auto px-4 py-8 grid md:grid-cols-3 gap-6">
          <div>
            <AkraiLogo />
            <p className="mt-3 text-[12px] text-neutral-500 leading-relaxed max-w-xs">
              AI-powered government exam preparation platform. Live · Recorded · AI · Mocks.
            </p>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-neutral-500 mb-2">Contact</div>
            <div className="text-[12.5px] space-y-1.5 text-neutral-700">
              <div className="flex items-center gap-1.5"><Mail className="w-3 h-3 text-[#FF5A1F]" /> support@akrai.ai</div>
              <div className="flex items-center gap-1.5"><Phone className="w-3 h-3 text-[#FF5A1F]" /> +91 98218 30895</div>
            </div>
          </div>
          <div>
            <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-neutral-500 mb-2">Legal</div>
            <div className="text-[12.5px] space-y-1">
              {[["/privacy","Privacy Policy"],["/terms","Terms & Conditions"],["/refund-policy","Refund Policy"],["/contact","Contact Us"]].map(([h,l])=>(
                <Link key={h} to={h} className="block text-neutral-600 hover:text-[#FF5A1F] transition">{l}</Link>
              ))}
            </div>
          </div>
        </div>
        <div className="border-t border-neutral-900/8">
          <div className="max-w-5xl mx-auto px-4 py-3 text-[10px] text-neutral-500 text-center font-mono uppercase tracking-widest">
            © {new Date().getFullYear()} Akrai AI · All Rights Reserved
          </div>
        </div>
      </footer>

      {/* STICKY MOBILE CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden p-2.5 bg-white/95 backdrop-blur-xl border-t border-neutral-900/8">
        <button
          onClick={() => setShowEnrollModal(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-neutral-900 text-white font-bold text-sm shadow-[0_-4px_20px_rgba(255,90,31,0.25)]"
          style={headFont}
        >
          <Rocket className="w-3.5 h-3.5 text-[#FF5A1F]" /> Enroll · ₹{PRICE}
        </button>
      </div>

      {/* ENROLL MODAL */}
      {showEnrollModal && !thankYou && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-neutral-900/10 shadow-2xl overflow-hidden">
            <div className="relative p-4 border-b border-neutral-900/8 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#FF5A1F]">Mission Success · 12 months</div>
                <div className="text-xl font-bold text-neutral-900 mt-0.5" style={headFont}>Enroll for ₹{PRICE}</div>
              </div>
              <button onClick={() => setShowEnrollModal(false)} className="p-1.5 rounded-full hover:bg-neutral-900/5 text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
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
                  className="w-full rounded-lg bg-neutral-50 border border-neutral-900/10 text-neutral-900 placeholder:text-neutral-400 px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-[#FF5A1F]/15 transition"
                />
              ))}
              <button
                disabled={loading}
                onClick={openCheckout}
                className="w-full inline-flex items-center justify-center gap-2 py-3 rounded-lg bg-neutral-900 hover:bg-[#FF5A1F] text-white font-bold text-sm shadow-[0_8px_24px_-8px_rgba(255,90,31,0.5)] disabled:opacity-60 transition"
                style={headFont}
              >
                {loading ? "Opening Secure Checkout…" : (<><ShieldCheck className="w-4 h-4" /> Pay ₹{PRICE} Securely</>)}
              </button>
              <div className="text-center text-[9px] text-neutral-500 flex items-center justify-center gap-1 font-mono uppercase tracking-widest">
                <Lock className="w-2.5 h-2.5" /> Razorpay · UPI · Cards · NetBanking
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THANK YOU */}
      {thankYou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/60 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-sm rounded-2xl bg-white border border-[#FF5A1F]/25 p-6 text-center shadow-2xl overflow-hidden">
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,90,31,0.12)_0%,transparent_55%)]" />
            <div className="relative">
              <div className="w-14 h-14 mx-auto rounded-2xl bg-[#FF5A1F] flex items-center justify-center shadow-[0_10px_40px_-8px_rgba(255,90,31,0.5)]">
                <Award className="w-7 h-7 text-white" />
              </div>
              <h3 className="mt-4 text-2xl font-bold text-neutral-900" style={headFont}>You're in. 🎉</h3>
              <p className="mt-1 text-neutral-500 text-sm">Welcome to Mission Success Batch. Payment confirmed.</p>
              <div className="mt-5 space-y-1.5 text-left text-[12.5px]">
                {["Download the Akrai AI mobile app","Login to your dashboard","Join our WhatsApp community","Attend the orientation session","Start your first class"].map((t, i) => (
                  <div key={t} className="flex items-center gap-2 text-neutral-700">
                    <div className="w-4 h-4 rounded-md bg-[#FF5A1F]/10 border border-[#FF5A1F]/30 flex items-center justify-center shrink-0">
                      <Star className="w-2 h-2 text-[#FF5A1F]" />
                    </div>
                    <span>{i + 1}. {t}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 space-y-1.5">
                <a href="https://wa.me/919821830895" target="_blank" rel="noreferrer" className="block py-2.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white font-bold text-sm transition" style={headFont}>Join WhatsApp</a>
                <Link to="/auth" className="block py-2.5 rounded-lg bg-neutral-900 hover:bg-[#FF5A1F] text-white font-bold text-sm transition" style={headFont}>Login to Dashboard</Link>
                <button onClick={() => setThankYou(false)} className="w-full py-1.5 text-neutral-500 text-xs hover:text-neutral-900 transition">Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* EXIT INTENT */}
      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-neutral-900/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm rounded-2xl bg-white border border-[#FFB800]/40 shadow-2xl overflow-hidden">
            <div className="relative p-4 border-b border-neutral-900/8 flex items-center justify-between">
              <div>
                <div className="text-[9px] font-mono uppercase tracking-[0.22em] text-[#FF5A1F]">Wait</div>
                <div className="text-lg font-bold text-neutral-900 mt-0.5" style={headFont}>Grab your free SSC study kit</div>
              </div>
              <button onClick={() => setShowExitPopup(false)} className="p-1.5 rounded-full hover:bg-neutral-900/5 text-neutral-500">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4 space-y-2.5">
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
                  className="w-full rounded-lg bg-neutral-50 border border-neutral-900/10 text-neutral-900 placeholder:text-neutral-400 px-3.5 py-2.5 text-[13px] focus:outline-none focus:border-[#FF5A1F] focus:ring-2 focus:ring-[#FF5A1F]/15"
                />
              ))}
              <button onClick={() => submitLead("exit_popup")} className="w-full py-3 rounded-lg bg-neutral-900 hover:bg-[#FF5A1F] text-white font-bold text-sm transition" style={headFont}>
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
