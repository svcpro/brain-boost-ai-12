import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import {
  Rocket, Sparkles, TrendingUp, Users, Trophy, Zap, Crown, Flame,
  IndianRupee, Share2, Target, Award, ChevronRight, Star, CheckCircle2,
  ArrowRight, Play, Instagram, MessageCircle, Gift, Shield, Brain,
  BarChart3, Globe2, Briefcase, GraduationCap, Heart, Quote,
} from "lucide-react";

/**
 * /campus-ambassador — Ultra-premium conversion-optimized landing page.
 * Dark dopamine theme, electric cyan + neon purple, glassmorphism, animated
 * counters, live leaderboard, earnings calculator, social proof, FAQ, sticky CTA.
 */

// ───────── Hooks ─────────
const useCountUp = (target: number, duration = 1600, start = false) => {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!start) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      const eased = 1 - Math.pow(1 - p, 3);
      setVal(Math.floor(target * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration, start]);
  return val;
};

const useInView = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(([e]) => e.isIntersecting && setSeen(true), { threshold: 0.2 });
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);
  return { ref, seen };
};

// ───────── Reusable bits ─────────
const Pill = ({ children, className = "" }: any) => (
  <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider ${className}`}>
    {children}
  </span>
);

const GlassCard = ({ children, className = "", glow = "cyan" }: any) => {
  const glowMap: any = {
    cyan: "before:bg-cyan-400/20",
    purple: "before:bg-purple-500/20",
    pink: "before:bg-pink-500/20",
    amber: "before:bg-amber-400/20",
  };
  return (
    <div
      className={`relative rounded-3xl bg-white/[0.04] backdrop-blur-2xl border border-white/10 overflow-hidden
        before:absolute before:-inset-px before:rounded-3xl before:opacity-0 hover:before:opacity-100 before:transition-opacity before:blur-xl before:-z-10 ${glowMap[glow]} ${className}`}
    >
      {children}
    </div>
  );
};

// ───────── HERO ─────────
const Hero = () => {
  const { ref, seen } = useInView<HTMLDivElement>();
  const earnings = useCountUp(127400, 1800, seen);
  const ambassadors = useCountUp(8400, 1800, seen);
  const campuses = useCountUp(312, 1800, seen);

  return (
    <section ref={ref} className="relative pt-24 pb-20 md:pt-32 md:pb-32 overflow-hidden">
      {/* radial glows */}
      <div className="absolute inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[800px] rounded-full bg-cyan-500/20 blur-[120px] animate-pulse" />
        <div className="absolute bottom-0 right-0 w-[500px] h-[500px] rounded-full bg-purple-600/20 blur-[100px]" />
        <div className="absolute top-1/3 left-0 w-[400px] h-[400px] rounded-full bg-pink-500/10 blur-[100px]" />
      </div>

      {/* grid lines */}
      <div className="absolute inset-0 -z-10 opacity-[0.04]"
        style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)", backgroundSize: "60px 60px" }} />

      <div className="max-w-7xl mx-auto px-4 md:px-6 text-center">
        {/* live badge */}
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur border border-cyan-400/30 mb-8 animate-fade-in">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
          </span>
          <span className="text-xs font-semibold text-white">
            <span className="text-emerald-400">312 ambassadors</span> earning right now across India
          </span>
        </div>

        <h1 className="text-5xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.95] mb-6">
          Turn your <span className="relative inline-block">
            <span className="bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">campus</span>
            <svg className="absolute -bottom-2 left-0 w-full" viewBox="0 0 300 12" fill="none">
              <path d="M2 9 Q 75 1, 150 6 T 298 4" stroke="url(#g)" strokeWidth="3" strokeLinecap="round" />
              <defs><linearGradient id="g"><stop stopColor="#22d3ee" /><stop offset="1" stopColor="#a855f7" /></linearGradient></defs>
            </svg>
          </span>
          <br />into your <span className="italic font-serif text-cyan-300">ATM.</span>
        </h1>

        <p className="max-w-2xl mx-auto text-lg md:text-xl text-slate-400 leading-relaxed mb-10">
          Join India's #1 student growth program. Refer friends, climb leaderboards, unlock cash,
          internships, and a verified ACRY credential. <span className="text-white font-semibold">Top earners make ₹40K/month.</span>
        </p>

        {/* CTAs */}
        <div className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-12">
          <button className="group relative w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-black text-base overflow-hidden transition-transform hover:scale-105 shadow-[0_0_40px_rgba(34,211,238,0.4)]">
            <span className="relative z-10 flex items-center gap-2 justify-center">
              Apply in 60 seconds <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </span>
            <div className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
          <button className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-white/5 backdrop-blur border border-white/10 text-white font-semibold text-sm hover:bg-white/10 transition flex items-center gap-2 justify-center">
            <Play className="w-4 h-4" /> Watch 90-sec demo
          </button>
        </div>

        {/* trust strip */}
        <div className="flex flex-wrap justify-center items-center gap-4 md:gap-8 text-xs text-slate-500 mb-16">
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> Instant UPI payouts</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> No targets, no pressure</span>
          <span className="flex items-center gap-1.5"><CheckCircle2 className="w-4 h-4 text-emerald-400" /> ISB & IIT alumni mentors</span>
        </div>

        {/* live counters */}
        <div className="grid grid-cols-3 gap-3 md:gap-6 max-w-4xl mx-auto">
          {[
            { icon: IndianRupee, label: "Paid out this month", val: earnings, prefix: "₹", suffix: "+" },
            { icon: Users, label: "Active ambassadors", val: ambassadors, suffix: "+" },
            { icon: GraduationCap, label: "Colleges live", val: campuses, suffix: "+" },
          ].map((s, i) => (
            <GlassCard key={i} className="p-4 md:p-6" glow={["cyan","purple","pink"][i] as any}>
              <s.icon className="w-5 h-5 md:w-6 md:h-6 text-cyan-300 mx-auto mb-2" />
              <div className="text-2xl md:text-4xl font-black text-white tabular-nums">
                {s.prefix || ""}{s.val.toLocaleString("en-IN")}{s.suffix || ""}
              </div>
              <div className="text-[10px] md:text-xs text-slate-400 mt-1 font-medium">{s.label}</div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── EARNINGS CALCULATOR ─────────
const Calculator = () => {
  const [referrals, setReferrals] = useState(20);
  const perReferral = 150;
  const monthlyBase = referrals * perReferral;
  const bonus = referrals >= 50 ? 5000 : referrals >= 25 ? 2000 : referrals >= 10 ? 500 : 0;
  const total = monthlyBase + bonus;
  const annual = total * 12;

  return (
    <section className="py-20 md:py-28 relative">
      <div className="max-w-6xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <Pill className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/30 mb-4">
            <IndianRupee className="w-3 h-3" /> EARNINGS CALCULATOR
          </Pill>
          <h2 className="text-4xl md:text-6xl font-black tracking-tight">
            See how much <span className="bg-gradient-to-r from-emerald-300 to-cyan-400 bg-clip-text text-transparent">you'll earn</span>
          </h2>
          <p className="text-slate-400 mt-3">Drag the slider. Real numbers from real ambassadors.</p>
        </div>

        <GlassCard className="p-6 md:p-10" glow="cyan">
          <div className="grid md:grid-cols-2 gap-8 items-center">
            <div>
              <div className="text-xs uppercase tracking-wider text-slate-400 font-bold mb-2">Monthly referrals</div>
              <div className="text-6xl md:text-7xl font-black bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent mb-4">
                {referrals}
              </div>
              <input
                type="range"
                min={1}
                max={100}
                value={referrals}
                onChange={(e) => setReferrals(Number(e.target.value))}
                className="w-full h-2 rounded-full bg-white/10 appearance-none cursor-pointer accent-cyan-400"
                style={{ background: `linear-gradient(to right, #22d3ee 0%, #a855f7 ${referrals}%, rgba(255,255,255,0.1) ${referrals}%)` }}
              />
              <div className="flex justify-between text-[10px] text-slate-500 mt-2 font-mono">
                <span>1</span><span>25</span><span>50</span><span>75</span><span>100</span>
              </div>

              <div className="mt-6 space-y-2 text-sm">
                <div className="flex justify-between text-slate-400">
                  <span>Base (₹150 × {referrals})</span>
                  <span className="text-white font-semibold">₹{monthlyBase.toLocaleString("en-IN")}</span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Tier bonus</span>
                  <span className={`font-semibold ${bonus > 0 ? "text-emerald-400" : "text-slate-500"}`}>
                    {bonus > 0 ? `+₹${bonus.toLocaleString("en-IN")}` : "Unlock at 10"}
                  </span>
                </div>
              </div>
            </div>

            <div className="relative">
              <div className="absolute inset-0 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 blur-3xl rounded-full" />
              <div className="relative bg-gradient-to-br from-white/10 to-white/5 rounded-3xl p-8 border border-white/10 text-center">
                <div className="text-xs uppercase tracking-wider text-cyan-300 font-bold mb-2">You earn / month</div>
                <div className="text-5xl md:text-6xl font-black text-white tabular-nums">
                  ₹{total.toLocaleString("en-IN")}
                </div>
                <div className="mt-4 pt-4 border-t border-white/10">
                  <div className="text-xs uppercase tracking-wider text-slate-400 font-bold">Per year</div>
                  <div className="text-2xl font-black bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                    ₹{annual.toLocaleString("en-IN")}
                  </div>
                </div>
                <div className="mt-6 text-[11px] text-slate-500">
                  Paid weekly via UPI · No targets · No deductions
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      </div>
    </section>
  );
};

// ───────── HOW IT WORKS ─────────
const HowItWorks = () => {
  const steps = [
    { n: "01", icon: Rocket, title: "Apply", desc: "60-second phone OTP. Upload college ID. Auto-approved in 12 hrs.", color: "cyan" },
    { n: "02", icon: Share2, title: "Share", desc: "AI writes your captions, DMs, reels. One tap to WhatsApp.", color: "purple" },
    { n: "03", icon: TrendingUp, title: "Track", desc: "Live dashboard. See every click, signup & ₹ in real-time.", color: "pink" },
    { n: "04", icon: IndianRupee, title: "Get Paid", desc: "UPI within 24 hours. No minimum. No drama.", color: "emerald" },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <Pill className="bg-purple-500/10 text-purple-300 border border-purple-500/30 mb-4">
            <Zap className="w-3 h-3" /> ZERO-FRICTION FLOW
          </Pill>
          <h2 className="text-4xl md:text-6xl font-black">From signup to first ₹ in <span className="italic font-serif text-cyan-300">48 hours</span></h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <div key={i} className="relative group">
              {i < 3 && (
                <div className="hidden md:block absolute top-12 -right-2 z-0 text-slate-700">
                  <ChevronRight className="w-6 h-6" />
                </div>
              )}
              <GlassCard className="p-6 h-full hover:-translate-y-1 transition-transform" glow={s.color as any}>
                <div className="text-xs font-mono text-slate-500 mb-3">{s.n}</div>
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 bg-gradient-to-br ${
                  s.color === "cyan" ? "from-cyan-400/20 to-cyan-500/10" :
                  s.color === "purple" ? "from-purple-400/20 to-purple-500/10" :
                  s.color === "pink" ? "from-pink-400/20 to-pink-500/10" :
                  "from-emerald-400/20 to-emerald-500/10"
                }`}>
                  <s.icon className={`w-6 h-6 ${
                    s.color === "cyan" ? "text-cyan-300" :
                    s.color === "purple" ? "text-purple-300" :
                    s.color === "pink" ? "text-pink-300" : "text-emerald-300"
                  }`} />
                </div>
                <div className="font-black text-xl mb-2">{s.title}</div>
                <div className="text-sm text-slate-400 leading-relaxed">{s.desc}</div>
              </GlassCard>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── PERKS ─────────
const Perks = () => {
  const perks = [
    { icon: IndianRupee, title: "Up to ₹40K/month", desc: "Weekly UPI payouts. Top 10% earn full-time salary.", glow: "emerald" },
    { icon: Briefcase, title: "Verified credential", desc: "ACRY Ambassador badge on your resume + LinkedIn endorsement.", glow: "cyan" },
    { icon: Brain, title: "AI growth toolkit", desc: "Caption gen, DM writer, reel maker — Pro-tier free.", glow: "purple" },
    { icon: Trophy, title: "City leaderboards", desc: "Win ₹50K monthly prizes. Public glory. College pride.", glow: "amber" },
    { icon: Crown, title: "Founder access", desc: "Monthly AMA + private Slack with the team & investors.", glow: "pink" },
    { icon: Gift, title: "Free Premium forever", desc: "Unlock all ACRY features. ₹149/mo plan, on the house.", glow: "cyan" },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <Pill className="bg-amber-500/10 text-amber-300 border border-amber-500/30 mb-4">
            <Gift className="w-3 h-3" /> WHAT YOU GET
          </Pill>
          <h2 className="text-4xl md:text-6xl font-black">Perks that <span className="bg-gradient-to-r from-amber-300 to-pink-400 bg-clip-text text-transparent">actually matter</span></h2>
        </div>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {perks.map((p, i) => (
            <GlassCard key={i} className="p-6 hover:-translate-y-1 transition-transform group" glow={p.glow as any}>
              <p.icon className={`w-8 h-8 mb-4 ${
                p.glow === "emerald" ? "text-emerald-300" :
                p.glow === "cyan" ? "text-cyan-300" :
                p.glow === "purple" ? "text-purple-300" :
                p.glow === "amber" ? "text-amber-300" : "text-pink-300"
              } group-hover:scale-110 transition-transform`} />
              <div className="font-black text-lg mb-2 text-white">{p.title}</div>
              <div className="text-sm text-slate-400 leading-relaxed">{p.desc}</div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── LIVE LEADERBOARD ─────────
const Leaderboard = () => {
  const rows = [
    { rank: 1, name: "Rahul K.", campus: "IIT Patna", xp: 14820, earn: 38400, trend: "up", flame: 47 },
    { rank: 2, name: "Priya S.", campus: "BITS Pilani", xp: 14210, earn: 36100, trend: "up", flame: 41 },
    { rank: 3, name: "Aman G.", campus: "NIT Trichy", xp: 13540, earn: 32800, trend: "same", flame: 38 },
    { rank: 4, name: "Sneha M.", campus: "DU North", xp: 12100, earn: 28400, trend: "up", flame: 29 },
    { rank: 5, name: "Karthik R.", campus: "IIT Madras", xp: 11420, earn: 25600, trend: "down", flame: 24 },
  ];
  const medal = ["🥇", "🥈", "🥉"];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-5xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <Pill className="bg-pink-500/10 text-pink-300 border border-pink-500/30 mb-4">
            <Flame className="w-3 h-3" /> LIVE · UPDATED EVERY MINUTE
          </Pill>
          <h2 className="text-4xl md:text-6xl font-black">This month's <span className="bg-gradient-to-r from-pink-400 to-amber-300 bg-clip-text text-transparent">top earners</span></h2>
        </div>
        <GlassCard className="overflow-hidden" glow="pink">
          <div className="divide-y divide-white/5">
            {rows.map((r) => (
              <div key={r.rank} className={`flex items-center gap-4 p-4 md:p-5 transition hover:bg-white/[0.03] ${r.rank === 1 ? "bg-gradient-to-r from-amber-500/10 to-transparent" : ""}`}>
                <div className="w-10 md:w-12 text-center text-2xl md:text-3xl">
                  {r.rank <= 3 ? medal[r.rank - 1] : <span className="text-slate-500 font-black">#{r.rank}</span>}
                </div>
                <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center font-black text-black flex-shrink-0">
                  {r.name[0]}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-white truncate">{r.name}</span>
                    <span className="flex items-center gap-0.5 text-xs text-amber-400">🔥 {r.flame}</span>
                  </div>
                  <div className="text-xs text-slate-400 truncate">{r.campus}</div>
                </div>
                <div className="text-right hidden sm:block">
                  <div className="text-xs text-slate-500">XP</div>
                  <div className="font-bold tabular-nums text-cyan-300">{r.xp.toLocaleString("en-IN")}</div>
                </div>
                <div className="text-right">
                  <div className="text-xs text-slate-500">Earned</div>
                  <div className="font-black tabular-nums text-emerald-400">₹{r.earn.toLocaleString("en-IN")}</div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
        <div className="text-center mt-6 text-sm text-slate-500">
          Your name here next month. <span className="text-cyan-300 underline cursor-pointer">Apply now →</span>
        </div>
      </div>
    </section>
  );
};

// ───────── TESTIMONIALS ─────────
const Testimonials = () => {
  const stories = [
    { name: "Ananya R.", role: "3rd yr · IIT Bombay", quote: "Paid my hostel mess fees for 4 months from ACRY referrals alone. The AI caption tool is unreal — I just hit share.", earn: "₹18,400", color: "cyan" },
    { name: "Vivek M.", role: "Final yr · NIT Surat", quote: "Started in October as a side hustle. Now I'm Regional Lead for Gujarat. ACRY is on my resume and HR teams know it.", earn: "₹42,100", color: "purple" },
    { name: "Tanvi K.", role: "Drop yr · Kota", quote: "Got 87 friends to sign up in 3 weeks. Used the money for my own NEET coaching. Full circle.", earn: "₹13,050", color: "pink" },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <Pill className="bg-cyan-500/10 text-cyan-300 border border-cyan-500/30 mb-4">
            <Heart className="w-3 h-3" /> REAL STUDENTS · REAL CHEQUES
          </Pill>
          <h2 className="text-4xl md:text-6xl font-black">Stories from <span className="italic font-serif text-cyan-300">your future self</span></h2>
        </div>
        <div className="grid md:grid-cols-3 gap-4">
          {stories.map((s, i) => (
            <GlassCard key={i} className="p-6 md:p-7 relative" glow={s.color as any}>
              <Quote className="absolute top-4 right-4 w-8 h-8 text-white/5" />
              <div className="flex items-center gap-3 mb-4">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center font-black text-black bg-gradient-to-br ${
                  s.color === "cyan" ? "from-cyan-300 to-blue-400" :
                  s.color === "purple" ? "from-purple-300 to-pink-400" : "from-pink-300 to-amber-400"
                }`}>{s.name[0]}</div>
                <div>
                  <div className="font-bold text-white">{s.name}</div>
                  <div className="text-xs text-slate-400">{s.role}</div>
                </div>
              </div>
              <p className="text-sm text-slate-300 leading-relaxed italic mb-5">"{s.quote}"</p>
              <div className="flex items-center justify-between pt-4 border-t border-white/5">
                <span className="text-xs text-slate-500">Last month</span>
                <span className="font-black text-emerald-400 tabular-nums">{s.earn}</span>
              </div>
              <div className="flex gap-1 mt-3">
                {[...Array(5)].map((_, i) => <Star key={i} className="w-3 h-3 fill-amber-400 text-amber-400" />)}
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── LEVELS ─────────
const Levels = () => {
  const levels = [
    { name: "Bronze", min: 0, mult: "1×", color: "from-orange-700 to-amber-600", perks: ["Base ₹150/referral", "Dashboard access", "Daily missions"] },
    { name: "Silver", min: 1500, mult: "1.5×", color: "from-slate-300 to-slate-500", perks: ["+ Streak rewards", "+ Campus stats", "+ Free Premium"] },
    { name: "Gold", min: 5000, mult: "2×", color: "from-amber-300 to-yellow-500", perks: ["+ Founder access", "+ Sponsored missions", "+ Priority payouts"] },
    { name: "Legend", min: 25000, mult: "3×", color: "from-purple-400 via-pink-400 to-cyan-300", perks: ["+ ₹50K signing bonus", "+ Full-time offer track", "+ Equity options"] },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-7xl mx-auto px-4 md:px-6">
        <div className="text-center mb-16">
          <Pill className="bg-gradient-to-r from-amber-500/10 to-purple-500/10 text-amber-300 border border-amber-500/30 mb-4">
            <Crown className="w-3 h-3" /> 4-TIER PROGRESSION
          </Pill>
          <h2 className="text-4xl md:text-6xl font-black">Level up. <span className="bg-gradient-to-r from-amber-300 via-pink-400 to-purple-400 bg-clip-text text-transparent">Earn more.</span></h2>
        </div>
        <div className="grid md:grid-cols-4 gap-4">
          {levels.map((l, i) => (
            <GlassCard key={i} className="p-6 relative overflow-hidden">
              <div className={`absolute top-0 left-0 right-0 h-1 bg-gradient-to-r ${l.color}`} />
              <div className={`text-3xl font-black bg-gradient-to-br ${l.color} bg-clip-text text-transparent mb-1`}>{l.name}</div>
              <div className="text-xs text-slate-500 mb-4">{l.min}+ XP · {l.mult} payout</div>
              <ul className="space-y-2">
                {l.perks.map((p, j) => (
                  <li key={j} className="flex items-start gap-2 text-sm text-slate-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── FAQ ─────────
const FAQ = () => {
  const [open, setOpen] = useState<number | null>(0);
  const faqs = [
    { q: "Do I need to be from a top college?", a: "Nope. We've got ambassadors from 312+ colleges including tier-2/3. We measure hustle, not pedigree." },
    { q: "How and when do I get paid?", a: "Weekly UPI transfers (Razorpay). Minimum threshold: ₹100. No taxes deducted at source under ₹50K/year." },
    { q: "Is there a target or deadline?", a: "Zero targets. Zero penalties. Earn ₹0 or ₹40K — entirely your call. Streaks reward consistency, not pressure." },
    { q: "Will this look good on my resume?", a: "Yes. ACRY Ambassador is a verified credential. We provide LinkedIn endorsement, recommendation letter, and a public profile URL." },
    { q: "What if my friends don't subscribe?", a: "You still earn for free signups + onboarding. Paid subscriptions just multiply your reward. Every action counts." },
    { q: "Can I lose my account?", a: "Only for fraud (fake signups, bot referrals). We use device fingerprinting + AI detection. Legit hustlers are safe." },
  ];
  return (
    <section className="py-20 md:py-28">
      <div className="max-w-3xl mx-auto px-4 md:px-6">
        <div className="text-center mb-12">
          <Pill className="bg-white/5 text-white border border-white/10 mb-4">FAQ</Pill>
          <h2 className="text-4xl md:text-5xl font-black">Real questions. <span className="text-cyan-300">Straight answers.</span></h2>
        </div>
        <div className="space-y-3">
          {faqs.map((f, i) => (
            <GlassCard key={i} className="overflow-hidden">
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full p-5 flex items-center justify-between text-left hover:bg-white/[0.02] transition"
              >
                <span className="font-bold text-white pr-4">{f.q}</span>
                <ChevronRight className={`w-5 h-5 text-cyan-300 flex-shrink-0 transition-transform ${open === i ? "rotate-90" : ""}`} />
              </button>
              {open === i && (
                <div className="px-5 pb-5 text-sm text-slate-400 leading-relaxed animate-fade-in">{f.a}</div>
              )}
            </GlassCard>
          ))}
        </div>
      </div>
    </section>
  );
};

// ───────── FINAL CTA ─────────
const FinalCTA = () => (
  <section className="py-24 md:py-32 relative overflow-hidden">
    <div className="absolute inset-0 -z-10">
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full bg-gradient-radial from-cyan-500/20 via-purple-500/10 to-transparent blur-3xl" />
    </div>
    <div className="max-w-4xl mx-auto px-4 md:px-6 text-center">
      <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/30 mb-6">
        <span className="relative flex h-2 w-2">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
          <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
        </span>
        <span className="text-xs font-bold text-emerald-300">Cohort closes in 7 days · 412 spots left</span>
      </div>
      <h2 className="text-5xl md:text-7xl font-black tracking-tight leading-[1.05] mb-6">
        Your campus is waiting.<br />
        <span className="bg-gradient-to-r from-cyan-300 via-purple-400 to-pink-400 bg-clip-text text-transparent">So is your first ₹.</span>
      </h2>
      <p className="text-lg text-slate-400 max-w-xl mx-auto mb-10">
        60 seconds to apply. 12 hours to get approved. A lifetime of earning, glory, and a credential
        that opens doors.
      </p>
      <button className="group relative px-10 py-5 rounded-2xl bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 text-black font-black text-lg overflow-hidden transition-transform hover:scale-105 shadow-[0_0_60px_rgba(168,85,247,0.5)]">
        <span className="relative z-10 flex items-center gap-3">
          Become an Ambassador <ArrowRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
        </span>
      </button>
      <div className="mt-6 flex flex-wrap justify-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5"><Shield className="w-3.5 h-3.5" /> Free forever</span>
        <span className="flex items-center gap-1.5"><CheckCircle2 className="w-3.5 h-3.5" /> Cancel anytime</span>
        <span className="flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> No credit card</span>
      </div>
    </div>
  </section>
);

// ───────── STICKY MOBILE CTA ─────────
const StickyCTA = () => {
  const [show, setShow] = useState(false);
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 800);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);
  if (!show) return null;
  return (
    <div className="fixed bottom-0 inset-x-0 z-40 md:hidden p-3 bg-gradient-to-t from-[#070912] via-[#070912]/95 to-transparent animate-fade-in">
      <button className="w-full px-6 py-4 rounded-2xl bg-gradient-to-r from-cyan-400 to-purple-500 text-black font-black text-sm flex items-center justify-center gap-2 shadow-[0_0_40px_rgba(34,211,238,0.5)]">
        Apply now <ArrowRight className="w-4 h-4" />
      </button>
    </div>
  );
};

// ───────── NAV ─────────
const Nav = () => (
  <header className="fixed top-0 inset-x-0 z-30 backdrop-blur-xl bg-black/40 border-b border-white/5">
    <div className="max-w-7xl mx-auto px-4 md:px-6 py-3 flex items-center justify-between">
      <Link to="/" className="flex items-center gap-2 font-black">
        <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500" />
        <span className="bg-gradient-to-r from-cyan-300 to-purple-400 bg-clip-text text-transparent text-lg">ACRY.ai</span>
      </Link>
      <nav className="hidden md:flex items-center gap-6 text-sm text-slate-300">
        <a href="#how" className="hover:text-white transition">How it works</a>
        <a href="#calc" className="hover:text-white transition">Earnings</a>
        <a href="#leaderboard" className="hover:text-white transition">Leaderboard</a>
        <a href="#faq" className="hover:text-white transition">FAQ</a>
      </nav>
      <button className="px-4 py-2 rounded-xl bg-white text-black font-bold text-sm hover:bg-cyan-300 transition">
        Apply
      </button>
    </div>
  </header>
);

// ───────── FOOTER ─────────
const Footer = () => (
  <footer className="border-t border-white/5 py-10 text-center text-xs text-slate-500">
    <div className="max-w-4xl mx-auto px-4">
      <div className="mb-3 font-black text-white text-lg">ACRY.ai</div>
      <p className="mb-4">India's #1 AI-powered student growth program.</p>
      <div className="flex justify-center gap-4 mb-4">
        <Instagram className="w-4 h-4 hover:text-cyan-300 cursor-pointer" />
        <MessageCircle className="w-4 h-4 hover:text-cyan-300 cursor-pointer" />
        <Globe2 className="w-4 h-4 hover:text-cyan-300 cursor-pointer" />
      </div>
      <div className="flex justify-center gap-4 text-[11px]">
        <Link to="/blueprint/campus-ambassador" className="hover:text-cyan-300">Blueprint (internal)</Link>
        <Link to="/privacy" className="hover:text-cyan-300">Privacy</Link>
        <Link to="/terms" className="hover:text-cyan-300">Terms</Link>
      </div>
      <div className="mt-4 text-slate-600">© 2026 ACRY.ai · Built with ❤️ in India</div>
    </div>
  </footer>
);

// ───────── MAIN ─────────
const CampusAmbassadorBlueprint = () => {
  useEffect(() => {
    document.title = "Campus Ambassador · Earn up to ₹40K/month — ACRY.ai";
    const meta = document.querySelector('meta[name="description"]') || (() => {
      const m = document.createElement("meta");
      m.setAttribute("name", "description");
      document.head.appendChild(m);
      return m;
    })();
    meta.setAttribute("content", "Join ACRY's Campus Ambassador program. Refer friends, climb leaderboards, earn up to ₹40K/month with instant UPI payouts. India's #1 student growth engine.");
  }, []);

  return (
    <div className="min-h-screen bg-[#070912] text-white overflow-x-hidden">
      <Nav />
      <main>
        <Hero />
        <div id="how"><HowItWorks /></div>
        <div id="calc"><Calculator /></div>
        <Perks />
        <div id="leaderboard"><Leaderboard /></div>
        <Levels />
        <Testimonials />
        <div id="faq"><FAQ /></div>
        <FinalCTA />
      </main>
      <Footer />
      <StickyCTA />
    </div>
  );
};

export default CampusAmbassadorBlueprint;
