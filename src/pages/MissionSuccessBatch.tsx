import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import {
  BadgeCheck, Sparkles, Rocket, ShieldCheck, Clock, Zap, PlayCircle,
  BookOpen, Trophy, Brain, Target, GraduationCap, MessageCircle,
  FileText, Users, LineChart, Smartphone, CheckCircle2, ArrowRight,
  Award, Timer, Lock, Star, ChevronDown, X, Phone, Mail,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SEO from "@/components/SEO";

const PRICE = 999;
const ORIGINAL = 4999;

declare global {
  interface Window { Razorpay: any }
}

function useRazorpay() {
  useEffect(() => {
    if (document.querySelector('script[data-razorpay]')) return;
    const s = document.createElement("script");
    s.src = "https://checkout.razorpay.com/v1/checkout.js";
    s.async = true;
    s.setAttribute("data-razorpay", "1");
    document.body.appendChild(s);
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
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(i);
  }, []);
  const diff = Math.max(0, target - now);
  const h = Math.floor(diff / 3.6e6);
  const m = Math.floor((diff % 3.6e6) / 6e4);
  const s = Math.floor((diff % 6e4) / 1000);
  return { h, m, s };
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

const trustBar = [
  "Live Classes", "Recorded Lectures", "AI Learning", "Mock Tests",
  "Doubt Support", "Revision Plan", "Mobile App", "Affordable Fee",
];

const whyChoose = [
  { icon: Brain, t: "AI Powered Learning" },
  { icon: Target, t: "Personalized Study Plan" },
  { icon: Zap, t: "Daily Practice Questions" },
  { icon: LineChart, t: "Mock Test Analysis" },
  { icon: Users, t: "Live Faculty Sessions" },
  { icon: PlayCircle, t: "Recorded Classes" },
  { icon: BookOpen, t: "Exam Strategy Sessions" },
  { icon: Sparkles, t: "Current Affairs" },
  { icon: FileText, t: "PDF Notes" },
  { icon: Timer, t: "Revision Tracker" },
  { icon: MessageCircle, t: "Doubt Solving" },
  { icon: Trophy, t: "Performance Dashboard" },
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
  "Enroll", "Instant Dashboard Access", "Watch Classes", "Practice Questions",
  "Take Mock Tests", "AI Performance Analysis", "Revision", "Selection",
];

const benefits = [
  "Increase Accuracy", "Improve Speed", "Daily Study Discipline",
  "Reduce Revision Stress", "AI Progress Tracking", "Structured Preparation",
  "Affordable Learning", "Expert Guidance",
];

const faqs = [
  ["Is this course live?", "Yes, with recorded backups you can re-watch anytime."],
  ["Will recordings be available?", "Yes, every live class is recorded and added to your dashboard."],
  ["Can beginners join?", "Absolutely — the curriculum starts from foundations."],
  ["Is it mobile friendly?", "Yes, fully optimized for the Akrai AI mobile app."],
  ["Will mock tests be included?", "Yes — topic, chapter, and full-length mocks with AI analysis."],
  ["Will I receive notes?", "Yes, downloadable PDF notes for every subject."],
  ["Can I ask doubts?", "Yes, unlimited doubt solving with faculty + AI."],
  ["How long is access?", "Full 12 months of access from the day you enroll."],
];

const AkraiLogo = () => (
  <div className="flex items-center gap-2">
    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-600 to-orange-500 flex items-center justify-center shadow-lg shadow-blue-500/30">
      <Sparkles className="w-5 h-5 text-white" />
    </div>
    <div className="leading-tight">
      <div className="font-extrabold text-slate-900 tracking-tight">Akrai AI</div>
      <div className="text-[10px] text-slate-500 uppercase tracking-widest">Mission Success</div>
    </div>
  </div>
);

const Section: React.FC<{ id?: string; className?: string; children: React.ReactNode }> = ({ id, className = "", children }) => (
  <section id={id} className={`py-16 md:py-24 px-5 md:px-8 ${className}`}>
    <div className="max-w-6xl mx-auto">{children}</div>
  </section>
);

const MissionSuccessBatch = () => {
  useRazorpay();
  const { toast } = useToast();
  const { h, m, s } = useCountdown();

  const enrolled = useCounter(1247);
  const hours = useCounter(5200);
  const sessions = useCounter(128);
  const questions = useCounter(10450);

  const [form, setForm] = useState({ name: "", mobile: "", email: "" });
  const [loading, setLoading] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(0);
  const [showExitPopup, setShowExitPopup] = useState(false);
  const [showEnrollModal, setShowEnrollModal] = useState(false);
  const [thankYou, setThankYou] = useState(false);
  const [leadForm, setLeadForm] = useState({ name: "", mobile: "", email: "" });

  // Exit intent
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
      toast({ title: "Enter valid name and mobile", variant: "destructive" });
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      toast({ title: "Enter a valid email", variant: "destructive" });
      return;
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
        theme: { color: "#2563eb" },
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
            setShowEnrollModal(false);
            setThankYou(true);
          } catch {
            toast({ title: "Payment received. Confirming…" });
            setShowEnrollModal(false);
            setThankYou(true);
          }
        },
        modal: { ondismiss: () => setLoading(false) },
      });
      rzp.open();
    } catch (e: any) {
      toast({ title: e.message || "Something went wrong", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const submitLead = async (source: string) => {
    if (!leadForm.name.trim() || !/^[6-9]\d{9}$/.test(leadForm.mobile.replace(/\D/g, "").slice(-10))) {
      toast({ title: "Enter valid name and mobile", variant: "destructive" });
      return;
    }
    try {
      await supabase.functions.invoke("mission-batch-checkout", {
        body: { action: "capture_lead", ...leadForm, source },
      });
      toast({ title: "Your free SSC Study Kit is on the way 🎉" });
      setShowExitPopup(false);
    } catch {
      toast({ title: "Saved locally. We'll reach out soon." });
      setShowExitPopup(false);
    }
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 antialiased selection:bg-blue-600 selection:text-white">
      <SEO
        title="Akrai AI · Mission Success Batch 2026 – SSC CGL AI Coaching ₹999"
        description="India's smart AI-powered SSC CGL preparation. Live classes, recorded lectures, AI study support, mock tests, doubt solving. 12 months access at ₹999."
        path="/mission-success-batch"
      />

      {/* NAV */}
      <nav className="sticky top-0 z-40 bg-white/85 backdrop-blur-lg border-b border-slate-200">
        <div className="max-w-6xl mx-auto px-5 py-3 flex items-center justify-between">
          <AkraiLogo />
          <button
            onClick={() => setShowEnrollModal(true)}
            className="hidden sm:inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-gradient-to-r from-blue-600 to-blue-700 text-white font-semibold text-sm shadow-lg shadow-blue-600/30 hover:shadow-xl hover:scale-[1.02] transition"
          >
            <Rocket className="w-4 h-4" /> Enroll ₹{PRICE}
          </button>
        </div>
      </nav>

      {/* HERO */}
      <Section className="!py-12 md:!py-20 relative overflow-hidden">
        <div className="absolute inset-0 -z-10 bg-gradient-to-br from-blue-50 via-white to-orange-50" />
        <div className="absolute top-20 -right-20 w-72 h-72 bg-blue-200/40 rounded-full blur-3xl -z-10" />
        <div className="absolute bottom-0 -left-20 w-72 h-72 bg-orange-200/40 rounded-full blur-3xl -z-10" />

        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">
              <Sparkles className="w-3.5 h-3.5" /> Mission Success Batch 2026
            </span>
            <h1 className="mt-4 text-4xl md:text-6xl font-extrabold leading-[1.05] tracking-tight">
              Crack <span className="text-blue-600">SSC CGL 2026</span> with India's Smart{" "}
              <span className="bg-gradient-to-r from-blue-600 to-orange-500 bg-clip-text text-transparent">AI-Powered</span> Preparation System
            </h1>
            <p className="mt-5 text-lg text-slate-600 leading-relaxed">
              Join the Mission Success Batch — Live Classes, Recorded Courses, AI Study Support, Mock Tests, Doubt Solving and Personalized Learning. All in one place.
            </p>

            <div className="mt-6 inline-flex items-center gap-3 px-4 py-3 rounded-2xl bg-white border-2 border-orange-300 shadow-lg">
              <div>
                <div className="text-xs font-bold text-orange-600 uppercase">Limited Time Offer</div>
                <div className="flex items-baseline gap-2">
                  <span className="text-3xl font-black text-slate-900">₹{PRICE}</span>
                  <span className="text-slate-400 line-through text-sm">₹{ORIGINAL}</span>
                  <span className="text-orange-600 font-bold text-sm">80% OFF</span>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-col sm:flex-row gap-3">
              <button
                onClick={() => setShowEnrollModal(true)}
                className="group inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-xl shadow-orange-500/30 hover:shadow-2xl hover:scale-[1.02] transition"
              >
                <Rocket className="w-5 h-5" /> Enroll Now
                <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition" />
              </button>
              <a href="#includes" className="inline-flex items-center justify-center gap-2 px-7 py-4 rounded-full bg-blue-600 text-white font-bold shadow-lg hover:bg-blue-700 transition">
                <PlayCircle className="w-5 h-5" /> Start Learning Today
              </a>
            </div>

            <div className="mt-5 flex flex-wrap items-center gap-4 text-xs text-slate-600">
              <span className="inline-flex items-center gap-1.5"><Lock className="w-4 h-4 text-blue-600" /> Secure Payment</span>
              <span className="inline-flex items-center gap-1.5"><Smartphone className="w-4 h-4 text-blue-600" /> 100% Online</span>
              <span className="inline-flex items-center gap-1.5">
                <span className="text-orange-500">★★★★★</span> Trusted by Government Exam Aspirants
              </span>
            </div>
          </div>

          {/* Hero visual */}
          <div className="relative">
            <div className="relative rounded-3xl bg-gradient-to-br from-blue-600 via-blue-700 to-slate-900 p-6 shadow-2xl shadow-blue-600/30 overflow-hidden">
              <div className="absolute -top-10 -right-10 w-40 h-40 bg-orange-500/30 rounded-full blur-3xl" />
              <div className="flex items-center justify-between text-white/90 text-xs mb-4">
                <div className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" /> AI Dashboard</div>
                <div className="opacity-70">Live · Rank #142</div>
              </div>
              <div className="rounded-2xl bg-white/10 backdrop-blur p-4 border border-white/20 text-white">
                <div className="text-sm opacity-80">Today's Study Plan</div>
                <div className="mt-2 text-2xl font-bold">Reasoning · Blood Relations</div>
                <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                  {[["Speed", "94%"], ["Accuracy", "88%"], ["Streak", "12d"]].map(([k, v]) => (
                    <div key={k} className="rounded-xl bg-white/10 py-2">
                      <div className="text-xs opacity-70">{k}</div>
                      <div className="font-bold">{v}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full w-3/4 bg-gradient-to-r from-orange-400 to-orange-500 rounded-full" />
                </div>
                <div className="mt-1 text-xs opacity-70">Mock #14 — 75% completed</div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-white">
                <GraduationCap className="w-5 h-5 text-orange-300" />
                <span className="text-sm font-semibold">SSC · Railway · Banking · Govt Jobs</span>
              </div>
            </div>
            <div className="absolute -bottom-6 -left-6 rounded-2xl bg-white shadow-xl p-4 border border-slate-100 hidden sm:block">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-white" />
                </div>
                <div>
                  <div className="text-xs text-slate-500">Selected</div>
                  <div className="font-bold text-sm">SSC CGL 2025 Toppers</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Section>

      {/* TRUST BAR */}
      <div className="border-y border-slate-200 bg-slate-50/60">
        <div className="max-w-6xl mx-auto px-5 py-5 flex flex-wrap items-center justify-center gap-x-6 gap-y-2">
          {trustBar.map((t) => (
            <span key={t} className="inline-flex items-center gap-1.5 text-xs md:text-sm font-medium text-slate-700">
              <CheckCircle2 className="w-4 h-4 text-blue-600" /> {t}
            </span>
          ))}
        </div>
      </div>

      {/* WHY CHOOSE */}
      <Section>
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">Why Akrai AI</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">
            Why Thousands of Students Choose <span className="text-blue-600">Akrai AI</span>
          </h2>
          <p className="mt-3 text-slate-600">Everything a serious aspirant needs — engineered by educators, powered by AI.</p>
        </div>
        <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
          {whyChoose.map(({ icon: Icon, t }) => (
            <div key={t} className="group rounded-2xl border border-slate-200 bg-white p-5 hover:border-blue-400 hover:-translate-y-0.5 hover:shadow-lg transition">
              <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-600 to-blue-700 text-white flex items-center justify-center shadow-md group-hover:scale-110 transition">
                <Icon className="w-5 h-5" />
              </div>
              <div className="mt-3 font-semibold text-sm text-slate-900">{t}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* INCLUDES */}
      <Section id="includes" className="bg-gradient-to-b from-slate-50 to-white">
        <div className="text-center max-w-2xl mx-auto">
          <span className="inline-block px-3 py-1 rounded-full bg-orange-100 text-orange-700 text-xs font-bold uppercase tracking-wider">What's Included</span>
          <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Mission Success Batch Includes</h2>
        </div>
        <div className="mt-10 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {includes.map((it) => (
            <div key={it} className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-4">
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
              <span className="text-sm font-medium text-slate-800">{it}</span>
            </div>
          ))}
        </div>

        {/* Course details card */}
        <div className="mt-10 rounded-3xl bg-white border-2 border-blue-100 p-6 md:p-8 shadow-xl shadow-blue-100/50">
          <div className="grid md:grid-cols-2 gap-8">
            <div>
              <div className="text-xs font-bold uppercase tracking-widest text-blue-600">Course Details</div>
              <h3 className="mt-2 text-2xl font-extrabold">Mission Success Batch</h3>
              <ul className="mt-4 space-y-2 text-sm text-slate-700">
                <li><b className="text-slate-900">Mode:</b> 100% Online</li>
                <li><b className="text-slate-900">Duration:</b> 12 Months Access</li>
                <li><b className="text-slate-900">Language:</b> Hindi + English</li>
                <li><b className="text-slate-900">Suitable For:</b> SSC CGL, CHSL, MTS, CPO, Railway, Banking & Govt Exams</li>
              </ul>
            </div>
            <div className="rounded-2xl bg-gradient-to-br from-blue-600 to-blue-800 text-white p-6 flex flex-col justify-between">
              <div>
                <div className="text-xs uppercase font-bold text-orange-300 tracking-widest">Special Price</div>
                <div className="mt-1 flex items-baseline gap-3">
                  <span className="text-5xl font-black">₹{PRICE}</span>
                  <span className="line-through opacity-70">₹{ORIGINAL}</span>
                </div>
                <div className="mt-2 text-sm opacity-90">One-time payment · 12 months access</div>
              </div>
              <button
                onClick={() => setShowEnrollModal(true)}
                className="mt-6 inline-flex items-center justify-center gap-2 px-6 py-3.5 rounded-full bg-orange-500 hover:bg-orange-600 text-white font-bold shadow-lg transition"
              >
                <Rocket className="w-5 h-5" /> Enroll Now
              </button>
            </div>
          </div>
        </div>
      </Section>

      {/* WHO SHOULD JOIN */}
      <Section>
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Who Should Join?</h2>
          <p className="mt-3 text-slate-600">Built for anyone chasing a government job — beginner or repeater.</p>
        </div>
        <div className="mt-8 grid grid-cols-2 md:grid-cols-4 gap-3">
          {["College Students","Working Professionals","Freshers","Govt Job Aspirants","SSC Beginners","Repeat Aspirants","Railway Aspirants","Banking Aspirants"].map((t) => (
            <div key={t} className="rounded-2xl border border-slate-200 bg-white p-4 text-center hover:border-orange-400 transition">
              <BadgeCheck className="w-5 h-5 text-orange-500 mx-auto" />
              <div className="mt-2 text-sm font-semibold">{t}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* LEARNING JOURNEY */}
      <Section className="bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 -z-0 opacity-20 bg-[radial-gradient(circle_at_20%_10%,#3b82f6,transparent_40%),radial-gradient(circle_at_80%_80%,#f97316,transparent_40%)]" />
        <div className="relative">
          <div className="text-center max-w-2xl mx-auto">
            <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-orange-300 text-xs font-bold uppercase tracking-wider">Your Journey</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">From Enrollment to Selection</h2>
          </div>
          <div className="mt-10 grid grid-cols-2 md:grid-cols-4 gap-4">
            {steps.map((st, i) => (
              <div key={st} className="rounded-2xl bg-white/5 backdrop-blur border border-white/10 p-5">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-black">
                  {i + 1}
                </div>
                <div className="mt-3 font-bold">{st}</div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* BENEFITS */}
      <Section>
        <div className="grid md:grid-cols-2 gap-8 items-center">
          <div>
            <span className="inline-block px-3 py-1 rounded-full bg-blue-100 text-blue-700 text-xs font-bold uppercase tracking-wider">Student Benefits</span>
            <h2 className="mt-3 text-3xl md:text-4xl font-extrabold tracking-tight">Study Smarter. Score Higher.</h2>
            <p className="mt-3 text-slate-600">Every feature is designed to give you a measurable edge on exam day.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {benefits.map((b) => (
              <div key={b} className="flex items-center gap-2 rounded-xl bg-blue-50 border border-blue-100 p-3">
                <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />
                <span className="text-sm font-semibold text-slate-800">{b}</span>
              </div>
            ))}
          </div>
        </div>
      </Section>

      {/* NUMBERS */}
      <Section className="bg-gradient-to-r from-blue-600 to-blue-700 text-white">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 text-center">
          {[
            { n: enrolled, l: "Students Enrolled" },
            { n: hours, l: "Hours of Learning" },
            { n: sessions, l: "Live Sessions" },
            { n: questions, l: "Practice Questions" },
          ].map((x) => (
            <div key={x.l}>
              <div className="text-4xl md:text-5xl font-black tracking-tight">{x.n}+</div>
              <div className="mt-1 text-sm opacity-90 font-medium">{x.l}</div>
            </div>
          ))}
        </div>
      </Section>

      {/* LIMITED OFFER */}
      <Section>
        <div className="rounded-3xl bg-gradient-to-br from-orange-500 via-orange-600 to-red-600 p-8 md:p-12 text-white text-center shadow-2xl shadow-orange-500/30 relative overflow-hidden">
          <div className="absolute inset-0 opacity-20 bg-[radial-gradient(circle_at_center,white,transparent_60%)]" />
          <div className="relative">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/20 backdrop-blur text-xs font-bold uppercase tracking-widest">
              <Clock className="w-4 h-4" /> Offer Ending Soon
            </div>
            <h2 className="mt-4 text-3xl md:text-5xl font-black">Mission Success Batch · ₹{PRICE}</h2>
            <p className="mt-2 opacity-90">Limited seats. Price increases after the timer ends.</p>

            <div className="mt-6 flex items-center justify-center gap-3">
              {[["Hours", h], ["Mins", m], ["Secs", s]].map(([l, v]) => (
                <div key={l as string} className="min-w-[80px] rounded-2xl bg-white/15 backdrop-blur px-4 py-3">
                  <div className="text-3xl md:text-4xl font-black tabular-nums">{String(v).padStart(2, "0")}</div>
                  <div className="text-[10px] uppercase tracking-widest opacity-80">{l}</div>
                </div>
              ))}
            </div>

            <button
              onClick={() => setShowEnrollModal(true)}
              className="mt-8 inline-flex items-center gap-2 px-8 py-4 rounded-full bg-white text-orange-600 font-black text-lg shadow-xl hover:scale-[1.03] transition"
            >
              <Rocket className="w-5 h-5" /> Enroll Now for ₹{PRICE}
            </button>
          </div>
        </div>
      </Section>

      {/* FAQ */}
      <Section className="bg-slate-50">
        <div className="text-center max-w-2xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-extrabold tracking-tight">Frequently Asked Questions</h2>
        </div>
        <div className="mt-8 max-w-3xl mx-auto space-y-3">
          {faqs.map(([q, a], i) => (
            <div key={q} className="rounded-2xl bg-white border border-slate-200 overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left"
              >
                <span className="font-semibold text-slate-900">{q}</span>
                <ChevronDown className={`w-5 h-5 text-slate-500 transition ${openFaq === i ? "rotate-180" : ""}`} />
              </button>
              {openFaq === i && (
                <div className="px-5 pb-4 text-slate-600 text-sm">{a}</div>
              )}
            </div>
          ))}
        </div>
      </Section>

      {/* FOOTER */}
      <footer className="bg-slate-900 text-slate-300">
        <div className="max-w-6xl mx-auto px-5 py-12 grid md:grid-cols-3 gap-8">
          <div>
            <AkraiLogo />
            <p className="mt-3 text-sm text-slate-400">
              AI Powered Government Exam Preparation Platform. Live · Recorded · AI · Mocks.
            </p>
          </div>
          <div>
            <div className="text-white font-bold mb-3">Contact</div>
            <div className="text-sm space-y-1.5">
              <div className="flex items-center gap-2"><Mail className="w-4 h-4" /> support@akrai.ai</div>
              <div className="flex items-center gap-2"><Phone className="w-4 h-4" /> +91 98218 30895</div>
            </div>
          </div>
          <div>
            <div className="text-white font-bold mb-3">Legal</div>
            <div className="text-sm space-y-1.5">
              <Link to="/privacy" className="block hover:text-orange-400">Privacy Policy</Link>
              <Link to="/terms" className="block hover:text-orange-400">Terms & Conditions</Link>
              <Link to="/refund-policy" className="block hover:text-orange-400">Refund Policy</Link>
              <Link to="/contact" className="block hover:text-orange-400">Contact Us</Link>
            </div>
          </div>
        </div>
        <div className="border-t border-white/10">
          <div className="max-w-6xl mx-auto px-5 py-4 text-xs text-slate-500 text-center">
            © {new Date().getFullYear()} Akrai AI · All Rights Reserved
          </div>
        </div>
      </footer>

      {/* STICKY MOBILE CTA */}
      <div className="fixed bottom-0 inset-x-0 z-40 sm:hidden p-3 bg-white/95 backdrop-blur border-t border-slate-200">
        <button
          onClick={() => setShowEnrollModal(true)}
          className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-lg"
        >
          <Rocket className="w-5 h-5" /> Enroll Now · ₹{PRICE}
        </button>
      </div>

      {/* ENROLL MODAL */}
      {showEnrollModal && !thankYou && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-5 flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-80">Mission Success Batch</div>
                <div className="text-2xl font-black">Enroll for ₹{PRICE}</div>
              </div>
              <button onClick={() => setShowEnrollModal(false)} className="p-1 rounded-full hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                type="text" placeholder="Your Full Name"
                value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="tel" placeholder="Mobile Number (10 digits)"
                value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <input
                type="email" placeholder="Email Address"
                value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
              />
              <button
                disabled={loading}
                onClick={openCheckout}
                className="w-full inline-flex items-center justify-center gap-2 py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-lg disabled:opacity-60"
              >
                {loading ? "Opening Secure Checkout…" : (<><ShieldCheck className="w-5 h-5" /> Pay ₹{PRICE} Securely</>)}
              </button>
              <div className="text-center text-xs text-slate-500 flex items-center justify-center gap-1">
                <Lock className="w-3 h-3" /> Razorpay · UPI · Cards · NetBanking
              </div>
            </div>
          </div>
        </div>
      )}

      {/* THANK YOU */}
      {thankYou && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-8 text-center shadow-2xl">
            <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500 flex items-center justify-center shadow-lg shadow-emerald-500/40">
              <Award className="w-8 h-8 text-white" />
            </div>
            <h3 className="mt-4 text-2xl font-black">Congratulations! 🎉</h3>
            <p className="mt-2 text-slate-600">Welcome to Mission Success Batch. Your payment has been received successfully.</p>
            <div className="mt-6 space-y-2 text-left text-sm">
              {["Download the Akrai AI mobile app","Login to your dashboard","Join our WhatsApp community","Attend the orientation session","Start your first class"].map((t, i) => (
                <div key={t} className="flex items-center gap-2"><Star className="w-4 h-4 text-orange-500" />{i + 1}. {t}</div>
              ))}
            </div>
            <div className="mt-6 grid grid-cols-1 gap-2">
              <a href="https://wa.me/919821830895" target="_blank" rel="noreferrer" className="py-3 rounded-full bg-emerald-500 text-white font-bold">Join WhatsApp</a>
              <Link to="/auth" className="py-3 rounded-full bg-blue-600 text-white font-bold">Login to Dashboard</Link>
              <button onClick={() => setThankYou(false)} className="py-2 text-slate-500 text-sm">Close</button>
            </div>
          </div>
        </div>
      )}

      {/* EXIT INTENT POPUP */}
      {showExitPopup && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur p-4">
          <div className="w-full max-w-md rounded-3xl bg-white shadow-2xl overflow-hidden">
            <div className="bg-gradient-to-r from-orange-500 to-red-500 p-5 text-white flex items-center justify-between">
              <div>
                <div className="text-xs uppercase tracking-widest opacity-90">Wait!</div>
                <div className="text-xl font-black">Grab Your Free SSC Study Kit</div>
              </div>
              <button onClick={() => setShowExitPopup(false)} className="p-1 rounded-full hover:bg-white/10">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input type="text" placeholder="Name" value={leadForm.name}
                onChange={(e) => setLeadForm({ ...leadForm, name: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:border-orange-500" />
              <input type="tel" placeholder="Mobile" value={leadForm.mobile}
                onChange={(e) => setLeadForm({ ...leadForm, mobile: e.target.value.replace(/\D/g, "").slice(0, 10) })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:border-orange-500" />
              <input type="email" placeholder="Email (optional)" value={leadForm.email}
                onChange={(e) => setLeadForm({ ...leadForm, email: e.target.value })}
                className="w-full rounded-xl border border-slate-200 px-4 py-3 focus:outline-none focus:border-orange-500" />
              <button onClick={() => submitLead("exit_popup")}
                className="w-full py-3.5 rounded-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold shadow-lg">
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
