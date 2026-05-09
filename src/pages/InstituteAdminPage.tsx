import { useEffect, useState, useMemo, lazy, Suspense } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from "framer-motion";
import { useNavigate } from "react-router-dom";
import {
  Building2, Users, GraduationCap, Loader2, IndianRupee,
  TrendingUp, LogOut, BookOpen, Crown, Sparkles, Activity,
  ArrowUpRight, Wallet, Zap, Target, Eye, Trophy, Flame,
  Rocket, Shield, BarChart3, Gauge, Radio, ChevronRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

const InstituteStudentsTab = lazy(() => import("@/components/admin/institution/InstituteStudentsTab"));
const InstituteOnboardingTab = lazy(() => import("@/components/admin/institution/InstituteOnboardingTab"));

interface Institution {
  id: string;
  name: string;
  slug: string;
  type: string;
  logo_url: string | null;
  primary_color: string;
  is_active: boolean;
  student_count: number;
  teacher_count: number;
  city: string | null;
  branch: string | null;
  max_students: number | null;
}

type Tab = "command" | "students" | "earnings";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "command", label: "Command", icon: Activity },
  { key: "students", label: "Students", icon: GraduationCap },
  { key: "earnings", label: "Earnings", icon: IndianRupee },
];

const TYPE_ICON: Record<string, any> = {
  coaching: BookOpen, school: GraduationCap, university: Crown, enterprise: Building2,
};

const Loader = () => (
  <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
);

const fmtINR = (n: number) =>
  n >= 10000000 ? `₹${(n / 10000000).toFixed(2)}Cr` :
  n >= 100000 ? `₹${(n / 100000).toFixed(2)}L` :
  n >= 1000 ? `₹${(n / 1000).toFixed(1)}K` : `₹${Math.round(n)}`;

/* ---------- animated number ---------- */
function AnimatedNumber({ value, format = (v: number) => Math.round(v).toLocaleString() }: { value: number; format?: (v: number) => string }) {
  const motionVal = useMotionValue(0);
  const display = useTransform(motionVal, (v) => format(v));
  const [text, setText] = useState(format(0));
  useEffect(() => {
    const controls = animate(motionVal, value, { duration: 1.1, ease: [0.16, 1, 0.3, 1] });
    const unsub = display.on("change", setText);
    return () => { controls.stop(); unsub(); };
  }, [value]);
  return <span className="tabular-nums">{text}</span>;
}

/* ---------- progress ring ---------- */
function ProgressRing({ percent, size = 64, stroke = 6, color }: { percent: number; size?: number; stroke?: number; color: string }) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(percent, 100) / 100) * c;
  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={r} stroke="hsl(var(--border))" strokeWidth={stroke} fill="none" opacity={0.4} />
      <motion.circle
        cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
        strokeLinecap="round" strokeDasharray={c}
        initial={{ strokeDashoffset: c }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
      />
    </svg>
  );
}

/* ---------- mini sparkline ---------- */
function Sparkline({ points, color, height = 36 }: { points: number[]; color: string; height?: number }) {
  if (!points.length) return <div style={{ height }} />;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const w = 100;
  const step = w / Math.max(points.length - 1, 1);
  const pts = points.map((p, i) => `${i * step},${height - ((p - min) / range) * height}`).join(" ");
  const area = `0,${height} ${pts} ${w},${height}`;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
      <defs>
        <linearGradient id={`spark-${color.replace(/[^a-z0-9]/gi, "")}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.4} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={area} fill={`url(#spark-${color.replace(/[^a-z0-9]/gi, "")})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export default function InstituteAdminPage() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [institution, setInstitution] = useState<Institution | null>(null);
  const [tab, setTab] = useState<Tab>("command");
  const [livePulse, setLivePulse] = useState(0);
  const [now, setNow] = useState(Date.now());
  const [recentEvents, setRecentEvents] = useState<any[]>([]);
  const [trend7d, setTrend7d] = useState<{ joins: number[]; earnings: number[] }>({ joins: [], earnings: [] });
  const [metrics, setMetrics] = useState({
    totalStudents: 0,
    activeStudents7d: 0,
    paidStudents: 0,
    earnedTotal: 0,
    earnedPending: 0,
    earnedPaid: 0,
    earned30d: 0,
    earned7d: 0,
    earnedToday: 0,
    commissionCount: 0,
    studentsToday: 0,
  });

  useEffect(() => {
    if (!user) { navigate("/institute/login"); return; }
    loadAll();
  }, [user]);

  // ticking clock for relative times
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, []);

  const refreshMetrics = async (instId: string) => {
    const [{ data: members }, { data: commissions }] = await Promise.all([
      supabase.from("institution_members")
        .select("user_id, joined_at, is_active")
        .eq("institution_id", instId)
        .eq("role", "student"),
      supabase.from("institution_commissions")
        .select("commission_amount, status, created_at, user_id")
        .eq("institution_id", instId),
    ]);

    const nowMs = Date.now();
    const dayMs = 24 * 3600 * 1000;
    const cutoff7 = nowMs - 7 * dayMs;
    const cutoff30 = nowMs - 30 * dayMs;
    const cutoffToday = new Date(); cutoffToday.setHours(0, 0, 0, 0);
    const startToday = cutoffToday.getTime();

    const list = (members || []) as any[];
    const cms = (commissions || []) as any[];

    const paidUserIds = new Set(cms.filter(c => c.status !== "reversed").map(c => c.user_id));
    const earnedTotal = cms.filter(c => c.status !== "reversed").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earnedPaid = cms.filter(c => c.status === "paid").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earnedPending = cms.filter(c => c.status === "pending" || c.status === "approved").reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earned30d = cms.filter(c => c.status !== "reversed" && new Date(c.created_at).getTime() > cutoff30)
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earned7d = cms.filter(c => c.status !== "reversed" && new Date(c.created_at).getTime() > cutoff7)
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const earnedToday = cms.filter(c => c.status !== "reversed" && new Date(c.created_at).getTime() > startToday)
      .reduce((s, c) => s + Number(c.commission_amount || 0), 0);
    const studentsToday = list.filter(m => m.joined_at && new Date(m.joined_at).getTime() > startToday).length;

    // 7-day trend buckets
    const joins = Array.from({ length: 7 }, () => 0);
    const earns = Array.from({ length: 7 }, () => 0);
    list.forEach(m => {
      if (!m.joined_at) return;
      const diff = Math.floor((nowMs - new Date(m.joined_at).getTime()) / dayMs);
      if (diff >= 0 && diff < 7) joins[6 - diff] += 1;
    });
    cms.forEach(c => {
      if (c.status === "reversed") return;
      const diff = Math.floor((nowMs - new Date(c.created_at).getTime()) / dayMs);
      if (diff >= 0 && diff < 7) earns[6 - diff] += Number(c.commission_amount || 0);
    });

    // Recent events (mix joins + commissions)
    const events = [
      ...list.filter(m => m.joined_at).map(m => ({ kind: "join" as const, at: new Date(m.joined_at).getTime(), value: 1 })),
      ...cms.filter(c => c.status !== "reversed").map(c => ({ kind: "earn" as const, at: new Date(c.created_at).getTime(), value: Number(c.commission_amount || 0), status: c.status })),
    ].sort((a, b) => b.at - a.at).slice(0, 6);

    setMetrics({
      totalStudents: list.length,
      activeStudents7d: list.filter(m => m.joined_at && new Date(m.joined_at).getTime() > cutoff7).length,
      paidStudents: paidUserIds.size,
      earnedTotal, earnedPending, earnedPaid, earned30d, earned7d, earnedToday,
      commissionCount: cms.length,
      studentsToday,
    });
    setTrend7d({ joins, earnings: earns });
    setRecentEvents(events);
  };

  const loadAll = async () => {
    if (!user) return;
    setLoading(true);
    const { data: inst } = await supabase
      .from("institutions")
      .select("*")
      .eq("admin_user_id", user.id)
      .maybeSingle();

    if (!inst) { setInstitution(null); setLoading(false); return; }
    setInstitution(inst as any);
    await refreshMetrics((inst as any).id);
    setLoading(false);
  };

  // Realtime
  useEffect(() => {
    if (!institution?.id) return;
    let debounce: any;
    const trigger = () => {
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        refreshMetrics(institution.id);
        setLivePulse((p) => p + 1);
      }, 350);
    };
    const channel = supabase
      .channel(`inst-kpi-${institution.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "institution_members", filter: `institution_id=eq.${institution.id}` }, trigger)
      .on("postgres_changes", { event: "*", schema: "public", table: "institution_commissions", filter: `institution_id=eq.${institution.id}` }, trigger)
      .subscribe();
    return () => { clearTimeout(debounce); supabase.removeChannel(channel); };
  }, [institution?.id]);

  const conversionRate = useMemo(() => {
    if (!metrics.totalStudents) return 0;
    return Math.round((metrics.paidStudents / metrics.totalStudents) * 100);
  }, [metrics]);

  const capacityPct = useMemo(() => {
    if (!institution?.max_students) return 0;
    return Math.min(100, Math.round((metrics.totalStudents / institution.max_students) * 100));
  }, [institution, metrics.totalStudents]);

  const handleSignOut = async () => { await signOut(); navigate("/institute/login"); };

  if (loading) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!institution) {
    return (
      <div className="min-h-[100dvh] bg-background flex items-center justify-center px-6">
        <div className="max-w-sm w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-secondary mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-xl font-bold text-foreground">No Institute Linked</h1>
          <p className="text-sm text-muted-foreground">
            Your account isn't linked to any institute yet. Onboard your coaching, school or university in under a minute.
          </p>
          <button onClick={() => navigate("/institute/signup")} className="w-full py-2.5 rounded-xl bg-primary text-sm font-bold text-primary-foreground hover:opacity-90">
            Onboard My Institute
          </button>
          <button onClick={handleSignOut} className="w-full py-2.5 rounded-xl bg-secondary text-sm font-medium text-foreground hover:bg-secondary/80">
            Sign out
          </button>
        </div>
      </div>
    );
  }

  const TypeIcon = TYPE_ICON[institution.type] || Building2;
  const brand = institution.primary_color || "#7C4DFF";
  const accent = "#00E5FF";

  return (
    <div className="min-h-[100dvh] bg-background relative overflow-x-hidden">
      {/* Ambient orbs + grid */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div
          className="absolute -top-40 -left-32 w-[32rem] h-[32rem] rounded-full opacity-30 blur-[120px] animate-pulse"
          style={{ background: `radial-gradient(circle, ${brand}, transparent 70%)`, animationDuration: "7s" }}
        />
        <div
          className="absolute top-20 -right-20 w-[28rem] h-[28rem] rounded-full opacity-25 blur-[120px] animate-pulse"
          style={{ background: `radial-gradient(circle, ${accent}, transparent 70%)`, animationDuration: "9s" }}
        />
        <div
          className="absolute top-[55%] left-1/2 -translate-x-1/2 w-[24rem] h-[24rem] rounded-full opacity-20 blur-[110px] animate-pulse"
          style={{ background: "radial-gradient(circle, #10B981, transparent 70%)", animationDuration: "11s" }}
        />
        <div
          className="absolute inset-0 opacity-[0.04]"
          style={{
            backgroundImage:
              "linear-gradient(hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(90deg, hsl(var(--foreground)) 1px, transparent 1px)",
            backgroundSize: "40px 40px",
          }}
        />
      </div>

      {/* Header */}
      <div className="relative z-10 border-b border-border/40 backdrop-blur-xl bg-background/50">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center gap-3">
          <motion.div
            initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-2xl ring-2 ring-white/10 relative overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${brand}, ${brand}88)` }}
          >
            <div className="absolute inset-0 bg-gradient-to-tr from-white/30 to-transparent" />
            {institution.logo_url ? (
              <img src={institution.logo_url} alt={institution.name} className="w-full h-full object-cover relative z-10" />
            ) : (
              <TypeIcon className="w-6 h-6 text-white relative z-10" />
            )}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-base font-extrabold text-foreground truncate tracking-tight">{institution.name}</h1>
              <span className="text-[9px] font-bold px-2 py-0.5 rounded-md bg-primary/15 text-primary capitalize">{institution.type}</span>
              <span
                key={livePulse}
                className="flex items-center gap-1 text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 animate-fade-in"
                title="Realtime sync active"
              >
                <span className="relative flex w-1.5 h-1.5">
                  <span className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                  <span className="relative w-1.5 h-1.5 rounded-full bg-emerald-400" />
                </span>
                LIVE
              </span>
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Radio className="w-2.5 h-2.5 text-emerald-400" />
              <span>Mission Control</span>
              <span className="opacity-50">·</span>
              <span>{institution.city || "Global"}</span>
              <span className="opacity-50">·</span>
              <span className="font-mono">{new Date(now).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}</span>
            </p>
          </div>
          <button
            onClick={handleSignOut}
            className="p-2 rounded-xl hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Tabs */}
        <div className="max-w-6xl mx-auto px-4 pb-3">
          <div className="flex gap-1 p-1 rounded-2xl bg-secondary/40 backdrop-blur border border-border/50 w-fit">
            {TABS.map(t => (
              <button
                key={t.key}
                onClick={() => setTab(t.key)}
                className={cn(
                  "relative flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all",
                  tab === t.key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {tab === t.key && (
                  <motion.div
                    layoutId="tabPill"
                    className="absolute inset-0 rounded-xl shadow-lg"
                    style={{ background: `linear-gradient(135deg, ${brand}33, ${brand}15)`, border: `1px solid ${brand}55` }}
                    transition={{ type: "spring", duration: 0.4 }}
                  />
                )}
                <t.icon className="w-3.5 h-3.5 relative z-10" />
                <span className="relative z-10">{t.label}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-4 py-5">
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
          >
            {tab === "command" && (
              <div className="space-y-4">
                {/* HERO: Earnings holographic card */}
                <motion.div
                  initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
                  className="relative overflow-hidden rounded-3xl p-6 border border-border/50"
                  style={{
                    background: `linear-gradient(135deg, hsl(var(--card)) 0%, ${brand}10 100%)`,
                    boxShadow: `0 30px 80px -30px ${brand}40, inset 0 1px 0 rgba(255,255,255,0.08)`,
                  }}
                >
                  {/* shimmer sweep */}
                  <motion.div
                    className="absolute inset-y-0 -left-1/2 w-1/2 pointer-events-none"
                    style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)" }}
                    animate={{ x: ["0%", "400%"] }}
                    transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
                  />
                  <div className="absolute -top-24 -right-24 w-72 h-72 rounded-full opacity-40 blur-3xl"
                    style={{ background: `radial-gradient(circle, ${brand}, transparent 70%)` }} />
                  <div className="absolute -bottom-20 -left-16 w-56 h-56 rounded-full opacity-30 blur-3xl"
                    style={{ background: "radial-gradient(circle, #10B981, transparent 70%)" }} />

                  <div className="relative flex items-start justify-between gap-4 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Trophy className="w-3.5 h-3.5" style={{ color: brand }} />
                        <span className="text-[10px] font-black tracking-[0.2em] uppercase" style={{ color: brand }}>
                          Lifetime Commission
                        </span>
                      </div>
                      <div
                        className="text-[44px] sm:text-5xl md:text-6xl font-black tracking-tight leading-none"
                        style={{
                          backgroundImage: `linear-gradient(135deg, ${brand}, ${accent} 60%, #10B981)`,
                          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
                          filter: "drop-shadow(0 0 20px rgba(124,77,255,0.25))",
                        }}
                      >
                        <AnimatedNumber value={metrics.earnedTotal} format={fmtINR} />
                      </div>
                      <div className="flex items-center gap-3 mt-3 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] font-bold text-emerald-400">
                          <TrendingUp className="w-3 h-3" />
                          {fmtINR(metrics.earned30d)} <span className="text-muted-foreground font-medium">/ 30d</span>
                        </span>
                        <span className="text-muted-foreground text-[10px]">·</span>
                        <span className="flex items-center gap-1 text-[11px] font-bold text-amber-400">
                          <Flame className="w-3 h-3" />
                          {fmtINR(metrics.earnedToday)} <span className="text-muted-foreground font-medium">today</span>
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <ProgressRing percent={conversionRate} size={84} stroke={7} color={brand} />
                        <div className="absolute inset-0 flex flex-col items-center justify-center">
                          <span className="text-xl font-black text-foreground tabular-nums">{conversionRate}%</span>
                          <span className="text-[8px] uppercase tracking-widest text-muted-foreground font-bold">Conv.</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* trend mini chart */}
                  <div className="relative mt-5 grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-background/40 backdrop-blur border border-border/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Earnings · 7d</span>
                        <span className="text-[10px] font-extrabold" style={{ color: brand }}>{fmtINR(metrics.earned7d)}</span>
                      </div>
                      <Sparkline points={trend7d.earnings} color={brand} />
                    </div>
                    <div className="rounded-xl bg-background/40 backdrop-blur border border-border/30 p-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">Joins · 7d</span>
                        <span className="text-[10px] font-extrabold text-emerald-400">+{metrics.activeStudents7d}</span>
                      </div>
                      <Sparkline points={trend7d.joins} color="#10B981" />
                    </div>
                  </div>
                </motion.div>

                {/* KPI grid */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <KpiTile
                    icon={GraduationCap} label="Students" sub="Total enrolled"
                    value={metrics.totalStudents} color="#10B981"
                    onClick={() => setTab("students")}
                    badge={metrics.studentsToday > 0 ? `+${metrics.studentsToday} today` : undefined}
                  />
                  <KpiTile
                    icon={Wallet} label="Paid Out" sub="Settled commission"
                    value={metrics.earnedPaid} color={brand}
                    formatter={fmtINR}
                  />
                  <KpiTile
                    icon={Gauge} label="Pending" sub="Awaiting payout"
                    value={metrics.earnedPending} color="#F59E0B"
                    formatter={fmtINR}
                    onClick={() => setTab("earnings")}
                  />
                  <KpiTile
                    icon={Target} label="Conversions" sub="Paid students"
                    value={metrics.paidStudents} color={accent}
                  />
                </div>

                {/* Capacity + Live Pulse row */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  {/* Capacity */}
                  <div className="md:col-span-2 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-4">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] uppercase tracking-widest font-bold text-foreground">Capacity</span>
                      </div>
                      {institution.max_students ? (
                        <span className="text-[10px] font-extrabold text-foreground tabular-nums">
                          {metrics.totalStudents}<span className="text-muted-foreground"> / {institution.max_students}</span>
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold text-muted-foreground">Unlimited</span>
                      )}
                    </div>
                    <div className="relative h-2.5 rounded-full bg-secondary/50 overflow-hidden">
                      <motion.div
                        className="absolute inset-y-0 left-0 rounded-full"
                        style={{ background: `linear-gradient(90deg, ${brand}, ${accent})` }}
                        initial={{ width: 0 }}
                        animate={{ width: `${institution.max_students ? capacityPct : 100}%` }}
                        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
                      />
                      <motion.div
                        className="absolute inset-y-0 w-12 -skew-x-12 opacity-50"
                        style={{ background: "linear-gradient(90deg, transparent, rgba(255,255,255,0.4), transparent)" }}
                        animate={{ x: [-50, 400] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: "linear" }}
                      />
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-[9px] text-muted-foreground">
                        {institution.max_students ? `${capacityPct}% of seats filled` : "No seat cap configured"}
                      </span>
                      <button
                        onClick={() => setTab("students")}
                        className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                      >
                        Manage <ChevronRight className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Pulse summary */}
                  <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="relative">
                        <div className="w-2 h-2 rounded-full bg-emerald-400" />
                        <div className="absolute inset-0 rounded-full bg-emerald-400 animate-ping" />
                      </div>
                      <span className="text-[10px] uppercase tracking-widest font-bold text-foreground">Live</span>
                    </div>
                    <div className="space-y-1.5">
                      <PulseRow icon={Zap} label="30d revenue" value={fmtINR(metrics.earned30d)} accent="text-amber-400" />
                      <PulseRow icon={Rocket} label="Transactions" value={String(metrics.commissionCount)} accent="text-primary" />
                      <PulseRow icon={Eye} label="Active 7d" value={String(metrics.activeStudents7d)} accent="text-emerald-400" />
                    </div>
                  </div>
                </div>

                {/* Activity feed */}
                <div className="rounded-2xl border border-border/50 bg-card/60 backdrop-blur-xl p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-3.5 h-3.5 text-accent" />
                      <span className="text-[10px] uppercase tracking-widest font-bold text-foreground">Recent Activity</span>
                    </div>
                    <span className="text-[9px] text-muted-foreground">Auto-refresh</span>
                  </div>
                  {recentEvents.length === 0 ? (
                    <div className="text-center py-6">
                      <Sparkles className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                      <p className="text-[11px] text-muted-foreground">No activity yet — share your join link to begin.</p>
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {recentEvents.map((e, i) => (
                        <motion.div
                          key={i}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.04 }}
                          className="flex items-center gap-3 p-2 rounded-xl bg-background/40 border border-border/30"
                        >
                          <div
                            className={cn(
                              "w-7 h-7 rounded-lg flex items-center justify-center shrink-0",
                              e.kind === "join" ? "bg-emerald-500/15 ring-1 ring-emerald-500/30" : "bg-primary/15 ring-1 ring-primary/30",
                            )}
                          >
                            {e.kind === "join"
                              ? <GraduationCap className="w-3.5 h-3.5 text-emerald-400" />
                              : <IndianRupee className="w-3.5 h-3.5 text-primary" />}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[11px] font-bold text-foreground">
                              {e.kind === "join" ? "New student joined" : `Commission ${e.status || "earned"}`}
                            </p>
                            <p className="text-[9px] text-muted-foreground">{relTime(e.at, now)}</p>
                          </div>
                          {e.kind === "earn" && (
                            <span className="text-[11px] font-extrabold text-emerald-400 tabular-nums">
                              +{fmtINR(e.value)}
                            </span>
                          )}
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            <Suspense fallback={<Loader />}>
              {tab === "command" && <InstituteOnboardingTab institutionId={institution.id} institutionName={institution.name} view="share" />}
              {tab === "students" && <InstituteStudentsTab institutionId={institution.id} institutionName={institution.name} />}
              {tab === "earnings" && <InstituteOnboardingTab institutionId={institution.id} institutionName={institution.name} view="earnings" />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}

/* ---------- subcomponents ---------- */
function KpiTile({
  icon: Icon, label, sub, value, color, formatter, onClick, badge,
}: {
  icon: any; label: string; sub: string; value: number; color: string;
  formatter?: (v: number) => string; onClick?: () => void; badge?: string;
}) {
  const Comp: any = onClick ? motion.button : motion.div;
  return (
    <Comp
      onClick={onClick}
      whileHover={onClick ? { y: -2, scale: 1.01 } : undefined}
      whileTap={onClick ? { scale: 0.99 } : undefined}
      className={cn(
        "relative overflow-hidden rounded-2xl p-4 text-left border border-border/50 bg-card/60 backdrop-blur-xl group",
        onClick && "cursor-pointer",
      )}
    >
      <div
        className="absolute -top-12 -right-12 w-32 h-32 rounded-full opacity-25 blur-2xl group-hover:opacity-40 transition-opacity"
        style={{ background: `radial-gradient(circle, ${color}, transparent 70%)` }}
      />
      <div className="relative">
        <div className="flex items-center justify-between mb-2">
          <div
            className="w-8 h-8 rounded-lg flex items-center justify-center ring-1"
            style={{ background: `${color}1F`, borderColor: `${color}55` }}
          >
            <Icon className="w-4 h-4" style={{ color }} />
          </div>
          {badge && (
            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              {badge}
            </span>
          )}
        </div>
        <div className="text-[9px] uppercase tracking-widest font-bold text-muted-foreground">{label}</div>
        <div className="text-2xl font-black text-foreground tabular-nums leading-tight mt-0.5">
          {formatter
            ? <AnimatedNumber value={value} format={formatter} />
            : <AnimatedNumber value={value} />}
        </div>
        <div className="text-[9px] text-muted-foreground mt-0.5">{sub}</div>
      </div>
    </Comp>
  );
}

function PulseRow({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent: string }) {
  return (
    <div className="flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg bg-background/40 border border-border/20">
      <div className="flex items-center gap-1.5 min-w-0">
        <Icon className={cn("w-3 h-3", accent)} />
        <span className="text-[10px] text-muted-foreground truncate">{label}</span>
      </div>
      <span className="text-[11px] font-extrabold text-foreground tabular-nums">{value}</span>
    </div>
  );
}

function relTime(ts: number, now: number) {
  const diff = Math.max(0, now - ts);
  const s = Math.floor(diff / 1000);
  if (s < 60) return `${s}s ago`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(ts).toLocaleDateString();
}
