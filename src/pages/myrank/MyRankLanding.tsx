import { useEffect, useMemo, useState, lazy, Suspense } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prefetchTest, preloadTestChunk } from "@/pages/myrank/prefetchTest";
import {
  Trophy, Zap, Users, TrendingUp, Sparkles, Search, Flame,
  GraduationCap, Stethoscope, Rocket, Scale, Briefcase, Shield,
  Globe2, BookOpen, Brain, ChevronRight,
} from "lucide-react";

const MyRankRewards = lazy(() => import("@/components/myrank/MyRankRewards"));

const setSeo = (title: string, desc: string) => {
  document.title = title;
  let m = document.querySelector('meta[name="description"]');
  if (!m) { m = document.createElement("meta"); m.setAttribute("name", "description"); document.head.appendChild(m); }
  m.setAttribute("content", desc);
};

type ExamCard = {
  key: string;
  label: string;
  group: string;
  icon: typeof Trophy;
  gradient: string;
  glow: string;
  hot?: boolean;
};

// All exam types from onboarding, grouped & visually styled
const EXAMS: ExamCard[] = [
  // Featured / IQ
  { key: "IQ", label: "IQ Test", group: "Featured", icon: Brain, gradient: "from-fuchsia-500 via-pink-500 to-rose-500", glow: "shadow-[0_0_40px_-10px_rgba(236,72,153,0.6)]", hot: true },

  // Civil Services
  { key: "UPSC CSE", label: "UPSC CSE", group: "Civil Services", icon: Shield, gradient: "from-orange-500 via-red-500 to-rose-600", glow: "shadow-[0_0_40px_-10px_rgba(249,115,22,0.6)]", hot: true },
  { key: "UPSC IES", label: "UPSC IES", group: "Civil Services", icon: Shield, gradient: "from-orange-400 to-red-500", glow: "shadow-[0_0_30px_-10px_rgba(249,115,22,0.5)]" },
  { key: "UPSC CMS", label: "UPSC CMS", group: "Civil Services", icon: Shield, gradient: "from-amber-500 to-orange-600", glow: "shadow-[0_0_30px_-10px_rgba(245,158,11,0.5)]" },
  { key: "UPSC CAPF", label: "UPSC CAPF", group: "Civil Services", icon: Shield, gradient: "from-red-500 to-orange-600", glow: "shadow-[0_0_30px_-10px_rgba(239,68,68,0.5)]" },
  { key: "State PSC", label: "State PSC", group: "Civil Services", icon: Shield, gradient: "from-orange-600 to-amber-700", glow: "shadow-[0_0_30px_-10px_rgba(234,88,12,0.5)]" },

  // Medical & Engineering
  { key: "NEET UG", label: "NEET UG", group: "Medical & Engineering", icon: Stethoscope, gradient: "from-emerald-500 via-green-500 to-teal-500", glow: "shadow-[0_0_40px_-10px_rgba(16,185,129,0.6)]", hot: true },
  { key: "NEET PG", label: "NEET PG", group: "Medical & Engineering", icon: Stethoscope, gradient: "from-green-500 to-emerald-600", glow: "shadow-[0_0_30px_-10px_rgba(34,197,94,0.5)]" },
  { key: "JEE Main", label: "JEE Main", group: "Medical & Engineering", icon: Rocket, gradient: "from-blue-500 via-cyan-500 to-sky-500", glow: "shadow-[0_0_40px_-10px_rgba(14,165,233,0.6)]", hot: true },
  { key: "JEE Advanced", label: "JEE Advanced", group: "Medical & Engineering", icon: Rocket, gradient: "from-indigo-500 via-blue-600 to-cyan-600", glow: "shadow-[0_0_40px_-10px_rgba(59,130,246,0.6)]", hot: true },
  { key: "GATE", label: "GATE", group: "Medical & Engineering", icon: Rocket, gradient: "from-cyan-500 to-blue-600", glow: "shadow-[0_0_30px_-10px_rgba(6,182,212,0.5)]" },
  { key: "BITSAT", label: "BITSAT", group: "Medical & Engineering", icon: Rocket, gradient: "from-sky-500 to-indigo-600", glow: "shadow-[0_0_30px_-10px_rgba(14,165,233,0.5)]" },

  // MBA & Law
  { key: "CAT", label: "CAT", group: "MBA & Law", icon: Briefcase, gradient: "from-purple-500 via-violet-500 to-indigo-500", glow: "shadow-[0_0_40px_-10px_rgba(139,92,246,0.6)]", hot: true },
  { key: "XAT", label: "XAT", group: "MBA & Law", icon: Briefcase, gradient: "from-violet-500 to-purple-600", glow: "shadow-[0_0_30px_-10px_rgba(139,92,246,0.5)]" },
  { key: "NMAT", label: "NMAT", group: "MBA & Law", icon: Briefcase, gradient: "from-purple-600 to-fuchsia-600", glow: "shadow-[0_0_30px_-10px_rgba(168,85,247,0.5)]" },
  { key: "CLAT", label: "CLAT", group: "MBA & Law", icon: Scale, gradient: "from-pink-500 via-rose-500 to-red-500", glow: "shadow-[0_0_40px_-10px_rgba(244,63,94,0.6)]" },
  { key: "AILET", label: "AILET", group: "MBA & Law", icon: Scale, gradient: "from-rose-500 to-pink-600", glow: "shadow-[0_0_30px_-10px_rgba(244,63,94,0.5)]" },
  { key: "LSAT", label: "LSAT", group: "MBA & Law", icon: Scale, gradient: "from-fuchsia-500 to-pink-600", glow: "shadow-[0_0_30px_-10px_rgba(217,70,239,0.5)]" },

  // Government Jobs
  { key: "SSC CGL", label: "SSC CGL", group: "Government Jobs", icon: Briefcase, gradient: "from-yellow-500 via-amber-500 to-orange-500", glow: "shadow-[0_0_40px_-10px_rgba(245,158,11,0.6)]", hot: true },
  { key: "SSC CHSL", label: "SSC CHSL", group: "Government Jobs", icon: Briefcase, gradient: "from-amber-500 to-yellow-600", glow: "shadow-[0_0_30px_-10px_rgba(245,158,11,0.5)]" },
  { key: "SSC MTS", label: "SSC MTS", group: "Government Jobs", icon: Briefcase, gradient: "from-yellow-600 to-amber-700", glow: "shadow-[0_0_30px_-10px_rgba(202,138,4,0.5)]" },
  { key: "IBPS PO", label: "IBPS PO", group: "Government Jobs", icon: Briefcase, gradient: "from-emerald-600 to-teal-700", glow: "shadow-[0_0_30px_-10px_rgba(5,150,105,0.5)]" },
  { key: "IBPS Clerk", label: "IBPS Clerk", group: "Government Jobs", icon: Briefcase, gradient: "from-teal-500 to-emerald-700", glow: "shadow-[0_0_30px_-10px_rgba(20,184,166,0.5)]" },
  { key: "SBI PO", label: "SBI PO", group: "Government Jobs", icon: Briefcase, gradient: "from-blue-600 to-indigo-700", glow: "shadow-[0_0_30px_-10px_rgba(37,99,235,0.5)]" },
  { key: "SBI Clerk", label: "SBI Clerk", group: "Government Jobs", icon: Briefcase, gradient: "from-indigo-500 to-blue-700", glow: "shadow-[0_0_30px_-10px_rgba(99,102,241,0.5)]" },
  { key: "RBI Grade B", label: "RBI Grade B", group: "Government Jobs", icon: Briefcase, gradient: "from-slate-600 to-zinc-700", glow: "shadow-[0_0_30px_-10px_rgba(71,85,105,0.5)]" },
  { key: "RRB NTPC", label: "RRB NTPC", group: "Government Jobs", icon: Briefcase, gradient: "from-stone-500 to-amber-700", glow: "shadow-[0_0_30px_-10px_rgba(120,113,108,0.5)]" },
  { key: "RRB Group D", label: "RRB Group D", group: "Government Jobs", icon: Briefcase, gradient: "from-amber-600 to-stone-700", glow: "shadow-[0_0_30px_-10px_rgba(217,119,6,0.5)]" },

  // Defence
  { key: "NDA", label: "NDA", group: "Defence", icon: Shield, gradient: "from-green-700 via-emerald-700 to-teal-800", glow: "shadow-[0_0_40px_-10px_rgba(21,128,61,0.6)]", hot: true },
  { key: "CDS", label: "CDS", group: "Defence", icon: Shield, gradient: "from-emerald-700 to-green-800", glow: "shadow-[0_0_30px_-10px_rgba(4,120,87,0.5)]" },
  { key: "AFCAT", label: "AFCAT", group: "Defence", icon: Shield, gradient: "from-sky-600 to-blue-800", glow: "shadow-[0_0_30px_-10px_rgba(2,132,199,0.5)]" },

  // International
  { key: "GRE", label: "GRE", group: "International", icon: Globe2, gradient: "from-cyan-400 via-blue-500 to-purple-600", glow: "shadow-[0_0_40px_-10px_rgba(34,211,238,0.6)]" },
  { key: "GMAT", label: "GMAT", group: "International", icon: Globe2, gradient: "from-blue-500 to-purple-700", glow: "shadow-[0_0_30px_-10px_rgba(59,130,246,0.5)]" },
  { key: "SAT", label: "SAT", group: "International", icon: Globe2, gradient: "from-indigo-500 to-purple-700", glow: "shadow-[0_0_30px_-10px_rgba(99,102,241,0.5)]" },
  { key: "TOEFL", label: "TOEFL", group: "International", icon: Globe2, gradient: "from-cyan-500 to-teal-600", glow: "shadow-[0_0_30px_-10px_rgba(6,182,212,0.5)]" },
  { key: "IELTS", label: "IELTS", group: "International", icon: Globe2, gradient: "from-teal-500 to-cyan-700", glow: "shadow-[0_0_30px_-10px_rgba(20,184,166,0.5)]" },

  // Teaching & Research
  { key: "UGC NET", label: "UGC NET", group: "Teaching & Research", icon: GraduationCap, gradient: "from-rose-500 to-purple-600", glow: "shadow-[0_0_30px_-10px_rgba(244,63,94,0.5)]" },
  { key: "CSIR NET", label: "CSIR NET", group: "Teaching & Research", icon: GraduationCap, gradient: "from-purple-500 to-indigo-700", glow: "shadow-[0_0_30px_-10px_rgba(168,85,247,0.5)]" },
  { key: "CTET", label: "CTET", group: "Teaching & Research", icon: BookOpen, gradient: "from-pink-500 to-rose-600", glow: "shadow-[0_0_30px_-10px_rgba(236,72,153,0.5)]" },

  // Other
  { key: "CUET", label: "CUET", group: "Other", icon: GraduationCap, gradient: "from-fuchsia-500 to-violet-700", glow: "shadow-[0_0_30px_-10px_rgba(217,70,239,0.5)]" },
  { key: "KVPY", label: "KVPY", group: "Other", icon: BookOpen, gradient: "from-violet-500 to-fuchsia-700", glow: "shadow-[0_0_30px_-10px_rgba(139,92,246,0.5)]" },
];

const GROUPS = [
  "All", "Featured", "Civil Services", "Medical & Engineering",
  "MBA & Law", "Government Jobs", "Defence", "International",
  "Teaching & Research", "Other",
];

const MyRankLanding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const [stats, setStats] = useState({ total_tests: 234567, total_shares: 0 });
  const [liveCount, setLiveCount] = useState(234567);
  const [activeGroup, setActiveGroup] = useState<string>("All");
  const [search, setSearch] = useState("");

  const ref = searchParams.get("ref");

  useEffect(() => {
    setSeo("MyRank — Check Your Rank in 60 Seconds | 40+ Exams", "Take a 60-second AI-powered test for UPSC, JEE, NEET, CAT, SSC, GATE, GRE, IELTS & 30+ exams. Get your India rank instantly.");
    if (ref) sessionStorage.setItem("myrank_ref", ref);

    // Preload the test page chunk so navigation is instant
    preloadTestChunk();

    supabase.functions.invoke("myrank-engine", { body: { action: "stats" } })
      .then(({ data }) => {
        if (data?.total_tests) {
          setStats(data);
          setLiveCount(data.total_tests);
        }
      });

    const interval = setInterval(() => {
      setLiveCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [ref]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return EXAMS.filter((e) => {
      const groupMatch = activeGroup === "All" || e.group === activeGroup;
      const searchMatch = !q || e.label.toLowerCase().includes(q) || e.group.toLowerCase().includes(q);
      return groupMatch && searchMatch;
    });
  }, [activeGroup, search]);

  // Fire AI question generation as soon as the user even touches the card
  const warmStart = (category: string) => {
    prefetchTest(category, user?.id);
  };

  const startTest = (category: string) => {
    prefetchTest(category, user?.id); // ensure cached even if pointerdown missed
    navigate(`/myrank/test?category=${encodeURIComponent(category)}`);
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-foreground">
      {/* Animated cosmic background */}
      <AuroraBackground />

      <div className="relative z-10 max-w-md mx-auto px-4 py-6 space-y-6">
        {/* Hero */}
        <header className="text-center space-y-3 pt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/10 bg-white/[0.03] backdrop-blur-md text-[11px] font-semibold tracking-wide">
            <Sparkles className="w-3 h-3 text-fuchsia-400" />
            <span className="bg-gradient-to-r from-fuchsia-400 via-cyan-400 to-emerald-400 bg-clip-text text-transparent">
              India's #1 AI Rank Engine
            </span>
          </div>
          <h1 className="text-[40px] leading-[1.05] font-extrabold tracking-tight">
            <span className="block bg-gradient-to-br from-white via-white to-white/60 bg-clip-text text-transparent">
              Check Your Rank
            </span>
            <span className="block mt-1 bg-gradient-to-r from-fuchsia-400 via-pink-400 to-amber-300 bg-clip-text text-transparent animate-[shimmer_3s_ease-in-out_infinite]" style={{ backgroundSize: "200% 100%" }}>
              in 60 Seconds
            </span>
          </h1>
          <p className="text-sm text-white/60">
            40+ exams · AI-powered · Brutally honest
          </p>
        </header>

        {/* ─── ULTRA ADVANCED LEADERBOARD HERO ─── */}
        <button
          onClick={() => navigate("/myrank/leaderboard")}
          className="group relative w-full overflow-hidden rounded-3xl p-[2px] active:scale-[0.99] transition-transform duration-200 isolate"
          style={{ background: "#0a0b1a" }}
        >
          {/* Spinning conic-gradient border */}
          <span
            aria-hidden
            className="absolute -inset-[60%] z-0 pointer-events-none"
            style={{
              background:
                "conic-gradient(from 0deg, #f59e0b, #ec4899, #06b6d4, #10b981, #f59e0b)",
              animation: "myrank-rotate 4s linear infinite",
            }}
          />
          <div className="relative z-10 rounded-[calc(1.5rem-2px)] overflow-hidden bg-[#0a0b1a]">
            {/* Animated mesh gradient */}
            <div
              className="absolute inset-0 opacity-90"
              style={{
                background:
                  "radial-gradient(circle at 15% 20%, rgba(245,158,11,0.45), transparent 45%), radial-gradient(circle at 85% 80%, rgba(236,72,153,0.40), transparent 45%), radial-gradient(circle at 50% 50%, rgba(6,182,212,0.30), transparent 60%)",
              }}
            />
            {/* Animated grid */}
            <div
              className="absolute inset-0 opacity-[0.08]"
              style={{
                backgroundImage:
                  "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
                backgroundSize: "24px 24px",
                animation: "spin 60s linear infinite reverse",
              }}
            />
            {/* Scanning beam */}
            <div
              className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
              style={{
                background: "linear-gradient(180deg, transparent, rgba(252,211,77,0.95), transparent)",
                boxShadow: "0 0 16px rgba(252,211,77,0.9), 0 0 32px rgba(252,211,77,0.5)",
                animation: "myrank-beam 3.5s linear infinite",
              }}
            />
            {/* Floating spark particles */}
            {Array.from({ length: 12 }).map((_, i) => (
              <span
                key={i}
                className="absolute w-1 h-1 rounded-full bg-white animate-pulse"
                style={{
                  top: `${(i * 47 + 10) % 90}%`,
                  left: `${(i * 31 + 5) % 95}%`,
                  opacity: 0.5 + (i % 4) * 0.12,
                  boxShadow: "0 0 8px rgba(255,255,255,0.9), 0 0 16px rgba(252,211,77,0.6)",
                  animationDuration: `${2 + (i % 4)}s`,
                  animationDelay: `${(i % 5) * 0.25}s`,
                }}
              />
            ))}

            {/* CONTENT */}
            <div className="relative z-10 px-4 py-4 flex items-center gap-3.5">
              {/* 3D Trophy podium */}
              <div className="relative shrink-0">
                {/* Outer pulse ring */}
                <span className="absolute -inset-2 rounded-2xl bg-gradient-to-br from-amber-400 to-orange-600 opacity-30 blur-md animate-pulse" />
                {/* Trophy box */}
                <div className="relative w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-300 via-amber-500 to-orange-600 flex items-center justify-center shadow-[0_8px_24px_-4px_rgba(245,158,11,0.7),inset_0_1px_0_rgba(255,255,255,0.4)] border border-amber-200/50">
                  <Trophy className="w-7 h-7 text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.4)]" strokeWidth={2.4} />
                  {/* Inner shine sweep */}
                  <span
                    className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none"
                  >
                    <span
                      className="absolute top-0 bottom-0 w-1/2"
                      style={{
                        background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.55), transparent)",
                        animation: "myrank-shine 2.6s ease-in-out infinite",
                      }}
                    />
                  </span>
                </div>
                {/* Rank #1 medal */}
                <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 border-[1.5px] border-white text-[9px] font-black text-white flex items-center justify-center shadow-lg">
                  1
                </span>
              </div>

              {/* Text block */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-400/20 border border-amber-300/40 text-amber-200 text-[8px] font-black uppercase tracking-widest animate-pulse">
                    🔥 Live
                  </span>
                  <span className="text-[9px] font-bold text-white/50 uppercase tracking-wider">
                    Updated every 60s
                  </span>
                </div>
                <h2 className="text-base font-extrabold leading-tight tracking-tight bg-gradient-to-r from-amber-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                  Top 100 India Leaderboard
                </h2>
                <div className="flex items-center gap-2 mt-1">
                  {/* Mini avatars */}
                  <div className="flex -space-x-1.5">
                    {["from-fuchsia-400 to-pink-600", "from-cyan-400 to-blue-600", "from-emerald-400 to-teal-600"].map((g, i) => (
                      <span
                        key={i}
                        className={`w-4 h-4 rounded-full bg-gradient-to-br ${g} border-[1.5px] border-[#0a0b1a] shadow`}
                      />
                    ))}
                  </div>
                  <span className="text-[10px] text-white/70 font-semibold">
                    See where you stand
                  </span>
                </div>
              </div>

              {/* CTA arrow */}
              <div className="shrink-0 w-9 h-9 rounded-full bg-white/10 backdrop-blur border border-white/20 flex items-center justify-center group-hover:bg-amber-400/30 group-hover:border-amber-300/50 transition-colors">
                <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-0.5 transition-transform" />
              </div>
            </div>

            {/* Bottom rainbow bar */}
            <div
              className="absolute bottom-0 left-0 right-0 h-[2px]"
              style={{
                background:
                  "linear-gradient(90deg, transparent, #f59e0b, #ec4899, #06b6d4, #10b981, transparent)",
                backgroundSize: "200% 100%",
                animation: "myrank-shimmer 3s linear infinite",
              }}
            />
          </div>

          {/* Local keyframes */}
          <style>{`
            @keyframes myrank-beam { 0% { left: -2px; } 100% { left: 100%; } }
            @keyframes myrank-shine { 0% { left: -60%; } 100% { left: 120%; } }
            @keyframes myrank-shimmer { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
          `}</style>
        </button>

        {/* Live counter card */}
        <Card className="relative overflow-hidden p-4 border-white/10 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.15),transparent_60%)] pointer-events-none" />
          <div className="relative flex items-center justify-between">
            <div>
              <div className="text-[10px] uppercase tracking-widest text-white/40">Tests taken today</div>
              <div className="text-3xl font-extrabold tabular-nums bg-gradient-to-r from-cyan-300 to-fuchsia-300 bg-clip-text text-transparent">
                {liveCount.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="flex items-center gap-1.5 text-emerald-400 text-xs font-bold">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-400" />
              </span>
              LIVE
            </div>
          </div>
        </Card>

        {/* Referral rewards — Premium Test + AI Study Plan */}
        <Suspense fallback={null}>
          <MyRankRewards />
        </Suspense>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search any exam… UPSC, JEE, IELTS"
            className="pl-9 h-11 bg-white/[0.04] border-white/10 text-white placeholder:text-white/30 focus-visible:ring-fuchsia-500/50"
          />
        </div>

        {/* Group chips */}
        <div className="-mx-4 px-4 overflow-x-auto scrollbar-hide">
          <div className="flex gap-2 pb-1">
            {GROUPS.map((g) => {
              const active = activeGroup === g;
              return (
                <button
                  key={g}
                  onClick={() => setActiveGroup(g)}
                  className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-all duration-300 border ${
                    active
                      ? "bg-gradient-to-r from-fuchsia-500 to-cyan-500 border-transparent text-white shadow-[0_0_20px_-5px_rgba(236,72,153,0.6)]"
                      : "bg-white/[0.03] border-white/10 text-white/60 hover:text-white hover:border-white/20"
                  }`}
                >
                  {g}
                </button>
              );
            })}
          </div>
        </div>

        {/* Battleground header */}
        <div className="flex items-center justify-between px-1">
          <div className="text-xs font-bold uppercase tracking-widest text-white/40">
            Pick your battleground
          </div>
          <div className="text-[10px] text-white/30 tabular-nums">
            {filtered.length} exams
          </div>
        </div>

        {/* Exam grid — 2 columns of dense cards */}
        <div className="grid grid-cols-2 gap-2.5">
          {filtered.map((exam, i) => {
            const Icon = exam.icon;
            return (
              <button
                key={exam.key}
                onClick={() => startTest(exam.key)}
                onPointerDown={() => warmStart(exam.key)}
                onMouseEnter={() => warmStart(exam.key)}
                onTouchStart={() => warmStart(exam.key)}
                style={{ animationDelay: `${Math.min(i, 20) * 30}ms` }}
                className={`group relative overflow-hidden p-3 rounded-2xl text-left animate-fade-in active:scale-[0.97] transition-transform duration-200 ${exam.glow}`}
              >
                {/* Gradient surface */}
                <div className={`absolute inset-0 bg-gradient-to-br ${exam.gradient} opacity-90`} />
                {/* Glass overlay */}
                <div className="absolute inset-0 bg-gradient-to-tr from-black/30 via-transparent to-white/10" />
                {/* Animated sheen */}
                <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                {/* Border */}
                <div className="absolute inset-0 rounded-2xl border border-white/15" />

                {/* Content */}
                <div className="relative">
                  <div className="flex items-start justify-between mb-3">
                    <div className="w-9 h-9 rounded-xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center">
                      <Icon className="w-4 h-4 text-white" />
                    </div>
                    {exam.hot && (
                      <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-black/40 backdrop-blur-sm text-[9px] font-bold text-amber-300 border border-amber-300/30">
                        <Flame className="w-2.5 h-2.5" />
                        HOT
                      </span>
                    )}
                  </div>
                  <div className="text-white font-extrabold text-sm leading-tight drop-shadow">
                    {exam.label}
                  </div>
                  <div className="text-[10px] text-white/80 font-medium mt-0.5">
                    7 Q · 90 sec
                  </div>
                  <div className="mt-2.5 flex items-center gap-1 text-[10px] font-bold text-white">
                    Start
                    <ChevronRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {filtered.length === 0 && (
          <Card className="p-6 text-center border-white/10 bg-white/[0.03]">
            <div className="text-sm text-white/60">No exam matches "{search}"</div>
          </Card>
        )}

        {/* Social proof tiles */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[
            { icon: Trophy, label: "Top 1%", sub: "Daily", from: "from-amber-400", to: "to-orange-500" },
            { icon: Users, label: "5M+", sub: "Players", from: "from-cyan-400", to: "to-blue-500" },
            { icon: TrendingUp, label: "Live", sub: "Ranks", from: "from-emerald-400", to: "to-teal-500" },
          ].map((s, i) => (
            <Card key={i} className="relative overflow-hidden p-3 text-center border-white/10 bg-white/[0.03] backdrop-blur">
              <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full blur-xl bg-gradient-to-br ${s.from} ${s.to} opacity-30`} />
              <s.icon className={`relative w-4 h-4 mx-auto mb-1 bg-gradient-to-br ${s.from} ${s.to} bg-clip-text`} style={{ color: "transparent", stroke: "url(#g)" }} />
              <div className={`relative text-sm font-extrabold bg-gradient-to-br ${s.from} ${s.to} bg-clip-text text-transparent`}>
                {s.label}
              </div>
              <div className="relative text-[10px] text-white/50">{s.sub}</div>
            </Card>
          ))}
        </div>

        {/* Leaderboard CTA moved to top — see hero section */}

        {ref && (
          <div className="text-center text-xs font-medium text-white/70 bg-gradient-to-r from-fuchsia-500/10 to-cyan-500/10 border border-white/10 p-2.5 rounded-xl backdrop-blur">
            🎯 Invited by a friend — beat their rank!
          </div>
        )}

        <div className="h-4" />
      </div>
    </div>
  );
};

/* ===== Animated Aurora / Cosmic Background ===== */
const AuroraBackground = () => {
  return (
    <div className="absolute inset-0 overflow-hidden">
      {/* Base gradient */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.15),transparent_60%)]" />

      {/* Animated orbs */}
      <div className="absolute -top-32 -left-32 w-80 h-80 rounded-full bg-fuchsia-600/30 blur-3xl animate-pulse" style={{ animationDuration: "6s" }} />
      <div className="absolute top-1/3 -right-32 w-96 h-96 rounded-full bg-cyan-500/25 blur-3xl animate-pulse" style={{ animationDuration: "8s", animationDelay: "1s" }} />
      <div className="absolute bottom-0 left-1/4 w-72 h-72 rounded-full bg-amber-500/20 blur-3xl animate-pulse" style={{ animationDuration: "7s", animationDelay: "2s" }} />
      <div className="absolute top-2/3 right-1/4 w-64 h-64 rounded-full bg-emerald-500/20 blur-3xl animate-pulse" style={{ animationDuration: "9s", animationDelay: "3s" }} />

      {/* Grid overlay */}
      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {/* Floating particles */}
      {Array.from({ length: 18 }).map((_, i) => {
        const colors = ["bg-fuchsia-400", "bg-cyan-400", "bg-amber-400", "bg-emerald-400", "bg-violet-400"];
        const c = colors[i % colors.length];
        return (
          <span
            key={i}
            className={`absolute w-1 h-1 rounded-full ${c} animate-pulse`}
            style={{
              top: `${(i * 53) % 100}%`,
              left: `${(i * 37) % 100}%`,
              opacity: 0.4 + (i % 4) * 0.1,
              boxShadow: `0 0 8px currentColor`,
              animationDuration: `${3 + (i % 5)}s`,
              animationDelay: `${(i % 6) * 0.3}s`,
            }}
          />
        );
      })}

      {/* Vignette */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,transparent_40%,rgba(0,0,0,0.5)_100%)]" />
    </div>
  );
};

export default MyRankLanding;
