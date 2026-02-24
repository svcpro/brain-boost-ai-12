import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  ShieldAlert, ArrowLeft, Eye, TrendingUp, TrendingDown,
  Zap, Clock, Brain, BarChart3, ShieldCheck, AlertTriangle,
  Activity, Target, RefreshCw, ChevronDown, ChevronRight,
  Smartphone, Globe, MessageSquare, Film, Gamepad2, Music2,
  ShoppingBag, Newspaper, Flame, Shield, Lock, Unlock,
  Sparkles, CheckCircle2, XCircle, Timer, Wifi, Award,
  BatteryCharging, Radar, Fingerprint, Waves, HeartPulse,
  Orbit, Gauge, CircleDot, Diamond, Star, Crown,
  Bolt, ScanEye, ShieldHalf, TriangleAlert, Swords,
  Cpu, Dumbbell, Crosshair, Wind
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useCognitivePrediction, type PredictionResult } from "@/hooks/useCognitivePrediction";

// ─── Types ───
interface FocusShieldDashboardProps { onClose: () => void; }
interface DayScore { score_date: string; distraction_score: number; focus_score: number; tab_switches: number; blur_events: number; total_distraction_seconds: number; rapid_switches: number; late_night_minutes: number; }
interface WarningRow { id: string; warning_type: string; was_dismissed: boolean; recall_passed: boolean | null; created_at: string; }
interface DistractionEvent { event_type: string; duration_seconds: number; context: any; created_at: string; }

// ─── Constants ───
const APP_CATEGORIES = [
  { id: "social", label: "Social Media", icon: MessageSquare, gradient: "from-pink-500 to-rose-600", accent: "hsl(var(--destructive))" },
  { id: "video", label: "Video & Streaming", icon: Film, gradient: "from-red-500 to-orange-500", accent: "hsl(var(--warning))" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, gradient: "from-violet-500 to-purple-600", accent: "hsl(var(--accent))" },
  { id: "news", label: "News & Browse", icon: Newspaper, gradient: "from-cyan-400 to-blue-500", accent: "hsl(var(--primary))" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, gradient: "from-emerald-400 to-green-500", accent: "hsl(var(--success))" },
  { id: "music", label: "Music & Audio", icon: Music2, gradient: "from-amber-400 to-orange-500", accent: "hsl(40, 100%, 50%)" },
];
const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];
const HOUR_LABELS = ["12A", "", "", "3A", "", "", "6A", "", "", "9A", "", "", "12P", "", "", "3P", "", "", "6P", "", "", "9P", "", ""];

// ─── Hooks ───
function useAnimatedNumber(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    const startTime = Date.now();
    const tick = () => {
      const progress = Math.min((Date.now() - startTime) / duration, 1);
      setVal(Math.round((1 - Math.pow(1 - progress, 3)) * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

// ─── Sub-components ───
function NeuralGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-[0.03]">
      <svg width="100%" height="100%">
        <defs>
          <pattern id="shield-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#shield-grid)" />
      </svg>
    </div>
  );
}

function AuroraOrbs({ color1, color2 }: { color1: string; color2: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <motion.div animate={{ scale: [1, 1.4, 1], x: [0, 20, 0], y: [0, -15, 0] }} transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        className="absolute top-[-25%] left-[-15%] w-[65%] h-[65%] rounded-full blur-3xl" style={{ background: color1, opacity: 0.12 }} />
      <motion.div animate={{ scale: [1.3, 1, 1.3], x: [0, -15, 0], y: [0, 10, 0] }} transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
        className="absolute bottom-[-20%] right-[-10%] w-[55%] h-[55%] rounded-full blur-3xl" style={{ background: color2, opacity: 0.08 }} />
      <motion.div animate={{ scale: [1, 1.2, 1], opacity: [0.04, 0.08, 0.04] }} transition={{ duration: 6, repeat: Infinity, delay: 3 }}
        className="absolute top-[40%] left-[30%] w-[40%] h-[40%] rounded-full blur-3xl" style={{ background: "hsl(var(--accent))" }} />
    </div>
  );
}

function ShieldParticles({ count = 25, color }: { count?: number; color: string }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, i) => ({
    id: i, x: Math.random() * 100, y: Math.random() * 100,
    size: 1 + Math.random() * 2.5, delay: Math.random() * 5, dur: 3 + Math.random() * 5,
  })), [count]);
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div key={p.id} className="absolute rounded-full"
          style={{ left: `${p.x}%`, top: `${p.y}%`, width: p.size, height: p.size, background: color }}
          animate={{ y: [0, -25, 0], opacity: [0, 0.7, 0], scale: [0.5, 1.3, 0.5] }}
          transition={{ duration: p.dur, delay: p.delay, repeat: Infinity, ease: "easeInOut" }} />
      ))}
    </div>
  );
}

function OrbitalRing({ radius, duration, color, size = 4 }: { radius: number; duration: number; color: string; size?: number }) {
  return (
    <motion.div className="absolute rounded-full" style={{ width: size, height: size, background: color, boxShadow: `0 0 8px ${color}` }}
      animate={{ rotate: 360 }} transition={{ duration, repeat: Infinity, ease: "linear" }}
      initial={{ x: radius, y: 0 }} />
  );
}

function PulseRipple({ color, delay = 0 }: { color: string; delay?: number }) {
  return (
    <motion.div className="absolute inset-0 rounded-full border-2" style={{ borderColor: color }}
      animate={{ scale: [1, 2.2], opacity: [0.4, 0] }}
      transition={{ duration: 2.5, repeat: Infinity, delay, ease: "easeOut" }} />
  );
}

// ─── Focus Level Badge with animated border ───
function FocusLevelBadge({ score }: { score: number }) {
  const { label, emoji, bgClass, textClass } = useMemo(() => {
    if (score >= 95) return { label: "GODLIKE", emoji: "👑", bgClass: "from-amber-400 via-yellow-300 to-amber-500", textClass: "text-amber-900" };
    if (score >= 85) return { label: "ELITE", emoji: "⚡", bgClass: "from-emerald-400 to-cyan-400", textClass: "text-emerald-900" };
    if (score >= 70) return { label: "STRONG", emoji: "🛡️", bgClass: "from-primary to-accent", textClass: "text-primary-foreground" };
    if (score >= 50) return { label: "AVERAGE", emoji: "⚠️", bgClass: "from-amber-400 to-orange-400", textClass: "text-amber-900" };
    return { label: "AT RISK", emoji: "🔴", bgClass: "from-red-500 to-rose-600", textClass: "text-white" };
  }, [score]);

  return (
    <motion.div initial={{ scale: 0, rotate: -10 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 400, damping: 15, delay: 0.8 }}
      className="relative">
      {/* Subtle glow border */}
      <div className="absolute inset-[-1.5px] rounded-full opacity-40"
        style={{ background: `linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))` }} />
      <div className={`relative bg-gradient-to-r ${bgClass} px-3 py-1 rounded-full flex items-center gap-1.5`}>
        <span className="text-xs">{emoji}</span>
        <span className={`text-[9px] font-black tracking-wider ${textClass}`}>{label}</span>
      </div>
    </motion.div>
  );
}

// ─── Streak Flame ───
function StreakFlame({ streak }: { streak: number }) {
  if (streak < 2) return null;
  return (
    <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 1 }}
      className="flex items-center gap-1 px-2 py-1 rounded-full bg-gradient-to-r from-orange-500/15 to-red-500/15 border border-orange-400/20">
      <motion.span animate={{ scale: [1, 1.3, 1], rotate: [0, 5, -5, 0] }} transition={{ duration: 1.5, repeat: Infinity }} className="text-[10px]">🔥</motion.span>
      <span className="text-[9px] font-black text-orange-400">{streak}d streak</span>
    </motion.div>
  );
}

// ─── Donut Chart for Apps ───
function DonutChart({ segments }: { segments: { percentage: number; color: string }[] }) {
  const total = segments.reduce((s, seg) => s + seg.percentage, 0) || 1;
  let offset = 0;
  const r = 40;
  const c = 2 * Math.PI * r;

  return (
    <svg viewBox="0 0 100 100" className="w-24 h-24">
      <circle cx="50" cy="50" r={r} fill="none" stroke="hsl(var(--muted))" strokeWidth="8" opacity={0.15} />
      {segments.map((seg, i) => {
        const len = (seg.percentage / total) * c;
        const gap = 2;
        const dash = Math.max(0, len - gap);
        const o = offset;
        offset += len;
        return (
          <motion.circle key={i} cx="50" cy="50" r={r} fill="none" stroke={seg.color} strokeWidth="8" strokeLinecap="round"
            strokeDasharray={`${dash} ${c - dash}`} strokeDashoffset={-o} transform="rotate(-90 50 50)"
            initial={{ strokeDasharray: `0 ${c}` }} animate={{ strokeDasharray: `${dash} ${c - dash}` }}
            transition={{ duration: 1, delay: 0.2 + i * 0.1 }}
            style={{ filter: `drop-shadow(0 0 3px ${seg.color})` }} />
        );
      })}
    </svg>
  );
}

// ─── Main Component ───
export default function FocusShieldDashboard({ onClose }: FocusShieldDashboardProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<DayScore[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [events, setEvents] = useState<DistractionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "apps" | "timeline" | "insights" | "predict" | "neural">("overview");
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");
  const [expandedInsight, setExpandedInsight] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const limit = timeRange === "week" ? 7 : 30;
    const [scoresRes, warningsRes, eventsRes] = await Promise.all([
      supabase.from("distraction_scores").select("*").eq("user_id", user.id).order("score_date", { ascending: false }).limit(limit),
      supabase.from("focus_shield_warnings").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(50),
      supabase.from("distraction_events").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(300),
    ]);
    if (scoresRes.data) setScores(scoresRes.data as any);
    if (warningsRes.data) setWarnings(warningsRes.data as any);
    if (eventsRes.data) setEvents(eventsRes.data as any);
    setLoading(false);
  }, [user, timeRange]);

  useEffect(() => { load(); }, [load]);

  // ─── Derived Data ───
  const today = scores[0];
  const todayFocus = today?.focus_score ?? 0;
  const avgFocus = scores.length ? Math.round(scores.reduce((s, r) => s + r.focus_score, 0) / scores.length) : 0;
  const totalSwitches = scores.reduce((s, r) => s + r.tab_switches, 0);
  const totalDistractedMin = Math.round(scores.reduce((s, r) => s + r.total_distraction_seconds, 0) / 60);
  const avgDailyMin = scores.length ? Math.round(totalDistractedMin / scores.length) : 0;
  const recallAttempts = warnings.filter(w => w.warning_type === "recall_challenge").length;
  const recallPassed = warnings.filter(w => w.recall_passed === true).length;
  const freezeCount = warnings.filter(w => w.warning_type === "freeze").length;
  const animatedFocus = useAnimatedNumber(todayFocus);

  // Focus streak
  const focusStreak = useMemo(() => {
    let streak = 0;
    for (const s of scores) { if (s.focus_score >= 60) streak++; else break; }
    return streak;
  }, [scores]);

  // Trend direction
  const focusTrend = useMemo(() => {
    if (scores.length < 2) return 0;
    const recent = scores.slice(0, Math.min(3, scores.length));
    const older = scores.slice(Math.min(3, scores.length));
    if (!older.length) return 0;
    const recentAvg = recent.reduce((s, r) => s + r.focus_score, 0) / recent.length;
    const olderAvg = older.reduce((s, r) => s + r.focus_score, 0) / older.length;
    return Math.round(recentAvg - olderAvg);
  }, [scores]);

  // Hourly heatmap
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0);
    events.forEach(e => { hours[new Date(e.created_at).getHours()] += 1; });
    const max = Math.max(1, ...hours);
    return hours.map((count, i) => ({ hour: i, count, intensity: count / max }));
  }, [events]);

  // Category breakdown
  const categoryBreakdown = useMemo(() => {
    const totalEvents = Math.max(1, events.length);
    return APP_CATEGORIES.map((cat, i) => {
      const share = events.filter((_, idx) => idx % APP_CATEGORIES.length === i);
      const totalSec = share.reduce((s, e) => s + (e.duration_seconds || 0), 0);
      const percentage = Math.round((share.length / totalEvents) * 100);
      return { ...cat, events: share.length, totalMinutes: Math.round(totalSec / 60), percentage };
    }).sort((a, b) => b.events - a.events);
  }, [events]);

  const weekData = useMemo(() => {
    const reversed = [...scores].reverse();
    return reversed.map(s => {
      const d = new Date(s.score_date + "T00:00:00");
      return { ...s, dayLabel: DAY_LABELS[d.getDay()], dateLabel: d.toLocaleDateString([], { month: "short", day: "numeric" }) };
    });
  }, [scores]);

  // Session patterns
  const sessionPatterns = useMemo(() => {
    const morning = events.filter(e => { const h = new Date(e.created_at).getHours(); return h >= 6 && h < 12; }).length;
    const afternoon = events.filter(e => { const h = new Date(e.created_at).getHours(); return h >= 12 && h < 18; }).length;
    const evening = events.filter(e => { const h = new Date(e.created_at).getHours(); return h >= 18 && h < 22; }).length;
    const night = events.filter(e => { const h = new Date(e.created_at).getHours(); return h >= 22 || h < 6; }).length;
    const total = Math.max(1, morning + afternoon + evening + night);
    return [
      { label: "Morning", icon: "🌅", count: morning, pct: Math.round(morning / total * 100), color: "hsl(var(--warning))" },
      { label: "Afternoon", icon: "☀️", count: afternoon, pct: Math.round(afternoon / total * 100), color: "hsl(var(--primary))" },
      { label: "Evening", icon: "🌆", count: evening, pct: Math.round(evening / total * 100), color: "hsl(var(--accent))" },
      { label: "Night", icon: "🌙", count: night, pct: Math.round(night / total * 100), color: "hsl(var(--destructive))" },
    ];
  }, [events]);

  // Best/worst day
  const bestDay = useMemo(() => scores.reduce((best, s) => s.focus_score > (best?.focus_score ?? 0) ? s : best, scores[0]), [scores]);
  const worstDay = useMemo(() => scores.reduce((worst, s) => s.focus_score < (worst?.focus_score ?? 100) ? s : worst, scores[0]), [scores]);

  const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]);

  const getFocusGrade = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-success", ringColor: "hsl(var(--success))", bgGlow: "hsl(155, 100%, 50%)" };
    if (score >= 70) return { label: "Good", color: "text-primary", ringColor: "hsl(var(--primary))", bgGlow: "hsl(187, 100%, 50%)" };
    if (score >= 50) return { label: "Average", color: "text-warning", ringColor: "hsl(var(--warning))", bgGlow: "hsl(40, 100%, 50%)" };
    return { label: "Needs Work", color: "text-destructive", ringColor: "hsl(var(--destructive))", bgGlow: "hsl(0, 72%, 51%)" };
  };

  const grade = getFocusGrade(todayFocus);
  const focusPercent = todayFocus / 100;
  const circumference = 2 * Math.PI * 54;

  const cogPred = useCognitivePrediction();

  const TABS = [
    { key: "overview" as const, icon: Gauge, label: "Overview" },
    { key: "predict" as const, icon: Crosshair, label: "Predict" },
    { key: "neural" as const, icon: Dumbbell, label: "Neural" },
    { key: "apps" as const, icon: Smartphone, label: "Apps" },
    { key: "insights" as const, icon: Radar, label: "Insights" },
    { key: "timeline" as const, icon: Activity, label: "Timeline" },
  ];

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 app-shell-bg" />

      {/* Device Frame */}
      <div className="relative w-full max-w-[430px] h-[100dvh] md:h-[min(95dvh,920px)] md:rounded-[2.5rem] md:border md:border-border/40 md:shadow-[0_25px_80px_-12px_hsl(0_0%_0%/0.6),0_0_120px_hsl(var(--primary)/0.06)] bg-background flex flex-col overflow-hidden">
        <NeuralGrid />

        {/* ═══ HEADER ═══ */}
        <header className="relative flex items-center gap-3 px-5 pt-4 pb-2 z-10">
          <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
            className="w-9 h-9 rounded-xl bg-secondary/60 backdrop-blur-sm border border-border/40 flex items-center justify-center">
            <ArrowLeft className="w-4 h-4 text-foreground" />
          </motion.button>
          <div className="flex-1">
            <div className="flex items-center gap-1.5">
              <motion.div animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 3, repeat: Infinity }}>
                <ShieldAlert className="w-4 h-4 text-primary" />
              </motion.div>
              <h1 className="text-sm font-black text-foreground tracking-tight">Focus Shield</h1>
            </div>
            <p className="text-[8px] text-muted-foreground mt-0.5 tracking-wider uppercase">Predictive Cognitive Control System</p>
          </div>
          <StreakFlame streak={focusStreak} />
          <motion.button whileTap={{ scale: 0.85 }} onClick={load}
            className="w-9 h-9 rounded-xl bg-secondary/60 backdrop-blur-sm border border-border/40 flex items-center justify-center">
            <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
          </motion.button>
        </header>

        {/* ═══ SCROLLABLE CONTENT ═══ */}
        <div className="flex-1 overflow-y-auto pb-6 scrollbar-hide">
          <div className="px-4 space-y-3.5">

            {/* ═══ HERO RING SECTION ═══ */}
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 }}
              className="relative rounded-3xl overflow-hidden border border-border/40">
              <AuroraOrbs color1={grade.bgGlow} color2="hsl(var(--accent))" />
              <ShieldParticles count={20} color={`${grade.bgGlow}`} />

              {/* Shimmer sweep */}
              <motion.div className="absolute inset-0 pointer-events-none"
                animate={{ x: ["-100%", "200%"] }} transition={{ duration: 4, repeat: Infinity, repeatDelay: 6 }}
                style={{ background: "linear-gradient(90deg, transparent, hsla(0,0%,100%,0.03), transparent)", width: "50%" }} />

              <div className="relative p-5">
                <div className="flex items-center gap-5">
                  {/* Ring */}
                  <div className="relative w-[120px] h-[120px] shrink-0">
                    {/* Pulse ripples */}
                    <div className="absolute inset-0 flex items-center justify-center">
                      <PulseRipple color={`${grade.ringColor}`} />
                      <PulseRipple color={`${grade.ringColor}`} delay={0.8} />
                    </div>
                    {/* Rotating outer ring */}
                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-[-5px] rounded-full"
                      style={{ background: `conic-gradient(from 0deg, ${grade.ringColor}, transparent 30%, transparent 70%, ${grade.ringColor})`, opacity: 0.15 }} />
                    {/* Second counter-rotating ring */}
                    <motion.div animate={{ rotate: -360 }} transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                      className="absolute inset-[-2px] rounded-full"
                      style={{ background: `conic-gradient(from 90deg, hsl(var(--accent)), transparent 25%, transparent 75%, hsl(var(--accent)))`, opacity: 0.08 }} />

                    <svg viewBox="0 0 120 120" className="w-full h-full relative z-10">
                      <circle cx="60" cy="60" r="54" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" opacity={0.1} />
                      <circle cx="60" cy="60" r="48" fill="none" stroke="hsl(var(--muted))" strokeWidth="1.5" opacity={0.06} strokeDasharray="3 6" />
                      {/* Main arc */}
                      <motion.circle cx="60" cy="60" r="54" fill="none" stroke={grade.ringColor} strokeWidth="7" strokeLinecap="round"
                        strokeDasharray={circumference} strokeDashoffset={circumference}
                        animate={{ strokeDashoffset: circumference * (1 - focusPercent) }}
                        transition={{ duration: 2, ease: [0.34, 1.56, 0.64, 1], delay: 0.3 }}
                        transform="rotate(-90 60 60)"
                        style={{ filter: `drop-shadow(0 0 8px ${grade.bgGlow})` }} />
                      {/* Glow dot at end */}
                      <motion.circle cx="60" cy="6" r="5" fill={grade.ringColor}
                        animate={{ opacity: [0.5, 1, 0.5], r: [4, 5.5, 4] }} transition={{ duration: 2, repeat: Infinity }}
                        style={{ filter: `drop-shadow(0 0 6px ${grade.bgGlow})` }}
                        transform={`rotate(${focusPercent * 360 - 90} 60 60)`} />
                    </svg>

                    <div className="absolute inset-0 flex flex-col items-center justify-center z-20">
                      <motion.span className={`text-[34px] font-black tabular-nums ${grade.color}`}
                        style={{ textShadow: `0 0 25px ${grade.bgGlow}`, lineHeight: 1 }}>
                        {animatedFocus}
                      </motion.span>
                      <span className="text-[8px] text-muted-foreground font-semibold mt-0.5 uppercase tracking-wider">Focus</span>
                    </div>
                  </div>

                  {/* Right side info */}
                  <div className="flex-1 space-y-2">
                    <FocusLevelBadge score={todayFocus} />

                    {/* Trend indicator */}
                    <motion.div initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.9 }}
                      className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl bg-secondary/30 border border-border/20">
                      {focusTrend >= 0 ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                      <span className={`text-[10px] font-bold ${focusTrend >= 0 ? "text-success" : "text-destructive"}`}>
                        {focusTrend >= 0 ? "+" : ""}{focusTrend}%
                      </span>
                      <span className="text-[8px] text-muted-foreground">vs prev</span>
                    </motion.div>

                    {/* Quick stats */}
                    <div className="space-y-1">
                      {[
                        { icon: Timer, label: "Distracted", value: `${Math.round((today?.total_distraction_seconds ?? 0) / 60)}m`, warn: (today?.total_distraction_seconds ?? 0) > 1800 },
                        { icon: Zap, label: "Switches", value: String(today?.tab_switches ?? 0), warn: (today?.tab_switches ?? 0) > 20 },
                        { icon: Flame, label: "Rapid", value: String(today?.rapid_switches ?? 0), warn: (today?.rapid_switches ?? 0) > 5 },
                      ].map((stat, i) => (
                        <motion.div key={stat.label} initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.5 + i * 0.08 }}
                          className="flex items-center gap-1.5">
                          <stat.icon className={`w-3 h-3 ${stat.warn ? "text-destructive" : "text-muted-foreground"}`} />
                          <span className="text-[8px] text-muted-foreground flex-1">{stat.label}</span>
                          <span className={`text-[10px] font-black tabular-nums ${stat.warn ? "text-destructive" : "text-foreground"}`}>{stat.value}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Shield Status Banner */}
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.7 }}
                  className="mt-4 rounded-2xl p-3 flex items-center gap-3 border border-border/30 relative overflow-hidden"
                  style={{ background: `linear-gradient(135deg, hsl(var(--secondary) / 0.5), hsl(var(--secondary) / 0.3))` }}>
                  {/* Animated scan line */}
                  <motion.div className="absolute inset-0 pointer-events-none"
                    animate={{ y: ["-100%", "200%"] }} transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
                    style={{ background: `linear-gradient(180deg, transparent, ${grade.ringColor}08, transparent)`, height: "30%" }} />
                  <motion.div animate={{ rotate: [0, 5, -5, 0], scale: [1, 1.05, 1] }} transition={{ duration: 3, repeat: Infinity }}
                    className="w-10 h-10 rounded-xl flex items-center justify-center relative"
                    style={{ background: `linear-gradient(135deg, ${grade.ringColor}22, ${grade.ringColor}44)`, border: `1px solid ${grade.ringColor}33` }}>
                    <Shield className="w-5 h-5" style={{ color: grade.ringColor }} />
                    <motion.div className="absolute inset-0 rounded-xl" animate={{ opacity: [0, 0.3, 0] }} transition={{ duration: 2, repeat: Infinity }}
                      style={{ border: `1px solid ${grade.ringColor}` }} />
                  </motion.div>
                  <div className="flex-1">
                    <p className="text-[10px] font-bold text-foreground">{todayFocus >= 70 ? "Shield Active & Strong" : "Shield Weakened"}</p>
                    <p className="text-[8px] text-muted-foreground">{todayFocus >= 70 ? "Focus defenses holding steady" : "Distraction levels elevated — stay alert"}</p>
                  </div>
                  <div className={`px-2.5 py-1 rounded-full text-[8px] font-black border`}
                    style={{ background: `${grade.ringColor}15`, color: grade.ringColor, borderColor: `${grade.ringColor}30` }}>
                    {avgDailyMin < 10 ? "LOW RISK" : avgDailyMin < 30 ? "MODERATE" : "HIGH RISK"}
                  </div>
                </motion.div>
              </div>
            </motion.div>

            {/* ═══ TAB NAVIGATION ═══ */}
            <div className="flex gap-0.5 rounded-2xl bg-secondary/30 p-1 border border-border/30">
              {TABS.map(tab => (
                <motion.button key={tab.key} onClick={() => setActiveTab(tab.key)} whileTap={{ scale: 0.95 }}
                  className={`flex-1 py-2 rounded-xl text-[9px] font-bold uppercase tracking-wider transition-all relative flex items-center justify-center gap-1 ${activeTab === tab.key ? "text-primary-foreground" : "text-muted-foreground"}`}>
                  {activeTab === tab.key && (
                    <motion.div layoutId="focus-tab-bg" className="absolute inset-0 rounded-xl bg-primary"
                      style={{ boxShadow: `0 0 15px hsl(var(--primary) / 0.3)` }}
                      transition={{ type: "spring", stiffness: 400, damping: 30 }} />
                  )}
                  <tab.icon className="w-3 h-3 relative z-10" />
                  <span className="relative z-10 hidden min-[360px]:inline">{tab.label}</span>
                </motion.button>
              ))}
            </div>

            {/* Time Range */}
            <div className="flex gap-1.5">
              {(["week", "month"] as const).map(r => (
                <button key={r} onClick={() => setTimeRange(r)}
                  className={`px-4 py-1.5 rounded-full text-[9px] font-bold transition-all border ${timeRange === r ? "bg-primary/15 text-primary border-primary/30" : "text-muted-foreground border-border/30 bg-secondary/20"}`}>
                  {r === "week" ? "7 Days" : "30 Days"}
                </button>
              ))}
            </div>

            {/* ═══ TAB CONTENT ═══ */}
            <AnimatePresence mode="wait">

              {/* ─── OVERVIEW TAB ─── */}
              {activeTab === "overview" && (
                <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-3.5">

                  {/* Focus Trend Chart */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <BarChart3 className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-foreground">Focus Trend</p>
                          <p className="text-[8px] text-muted-foreground">{timeRange === "week" ? "Last 7 days" : "Last 30 days"}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 px-2 py-1 rounded-full bg-secondary/30">
                        {focusTrend >= 0 ? <TrendingUp className="w-3 h-3 text-success" /> : <TrendingDown className="w-3 h-3 text-destructive" />}
                        <span className={`text-[9px] font-bold ${focusTrend >= 0 ? "text-success" : "text-destructive"}`}>{focusTrend >= 0 ? "+" : ""}{focusTrend}%</span>
                      </div>
                    </div>

                    <div className="px-3 pb-4">
                      {weekData.length === 0 ? (
                        <div className="flex flex-col items-center py-10 gap-2">
                          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                            <ShieldCheck className="w-10 h-10 text-primary/30" />
                          </motion.div>
                          <p className="text-[10px] text-muted-foreground">No data yet — start studying!</p>
                        </div>
                      ) : (
                        <div className="flex items-end gap-[3px]" style={{ height: 140 }}>
                          {weekData.map((d, i) => {
                            const h = Math.max(8, d.focus_score);
                            const isSelected = selectedDay === i;
                            const barColor = d.focus_score >= 90 ? "hsl(var(--success))" : d.focus_score >= 70 ? "hsl(var(--primary))" : d.focus_score >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
                            return (
                              <motion.button key={d.score_date} onClick={() => setSelectedDay(isSelected ? null : i)} className="flex-1 flex flex-col items-center gap-1 h-full">
                                <div className="flex-1 w-full flex items-end justify-center">
                                  <motion.div initial={{ height: 0 }} animate={{ height: `${h}%`, opacity: 1 }}
                                    transition={{ delay: 0.08 + i * 0.04, type: "spring", stiffness: 200, damping: 20 }}
                                    className="w-full max-w-[22px] rounded-lg relative overflow-hidden"
                                    style={{ background: barColor, opacity: isSelected ? 1 : 0.5, boxShadow: isSelected ? `0 0 14px ${barColor}, 0 0 4px ${barColor}` : "none" }}>
                                    {isSelected && (
                                      <motion.div className="absolute inset-0" animate={{ x: ["-100%", "100%"] }}
                                        transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                                        style={{ background: "linear-gradient(90deg, transparent, hsla(0,0%,100%,0.3), transparent)" }} />
                                    )}
                                    {/* Focus score label on top */}
                                    {isSelected && (
                                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                                        className="absolute -top-5 left-1/2 -translate-x-1/2 text-[8px] font-black text-foreground whitespace-nowrap bg-card/90 px-1.5 py-0.5 rounded-md border border-border/30">
                                        {d.focus_score}%
                                      </motion.div>
                                    )}
                                  </motion.div>
                                </div>
                                <span className={`text-[8px] font-bold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>{d.dayLabel}</span>
                              </motion.button>
                            );
                          })}
                        </div>
                      )}

                      <AnimatePresence>
                        {selectedDay !== null && weekData[selectedDay] && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
                            <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-4 gap-1.5">
                              {[
                                { l: "Focus", v: `${weekData[selectedDay].focus_score}%`, c: "text-primary" },
                                { l: "Switches", v: String(weekData[selectedDay].tab_switches), c: "text-warning" },
                                { l: "Lost", v: `${Math.round(weekData[selectedDay].total_distraction_seconds / 60)}m`, c: "text-destructive" },
                                { l: "Rapid", v: String(weekData[selectedDay].rapid_switches), c: "text-accent" },
                              ].map(stat => (
                                <div key={stat.l} className="text-center rounded-xl bg-secondary/30 py-2 border border-border/10">
                                  <p className={`text-[12px] font-black ${stat.c}`}>{stat.v}</p>
                                  <p className="text-[7px] text-muted-foreground mt-0.5">{stat.l}</p>
                                </div>
                              ))}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>

                  {/* Hourly Heatmap */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-destructive/10 flex items-center justify-center">
                        <Flame className="w-3.5 h-3.5 text-destructive" />
                      </div>
                      <div className="flex-1">
                        <p className="text-[11px] font-bold text-foreground">Distraction Heatmap</p>
                        <p className="text-[8px] text-muted-foreground">Peak: <span className="font-bold text-destructive">{peakHour?.hour ?? 0}:00</span> ({peakHour?.count ?? 0} events)</p>
                      </div>
                    </div>

                    {/* 6x4 grid */}
                    <div className="grid grid-cols-6 gap-[4px]">
                      {hourlyData.map((h, i) => (
                        <motion.div key={h.hour} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                          transition={{ delay: 0.015 * i, type: "spring", stiffness: 300 }}
                          className="aspect-square rounded-md relative group flex items-center justify-center"
                          style={{
                            background: h.count === 0 ? "hsl(var(--muted) / 0.15)" : `hsl(var(--destructive) / ${0.1 + h.intensity * 0.9})`,
                            boxShadow: h.intensity > 0.7 ? `inset 0 0 8px hsl(var(--destructive) / ${h.intensity * 0.3}), 0 0 6px hsl(var(--destructive) / ${h.intensity * 0.2})` : "none",
                          }}>
                          <span className="text-[7px] font-bold" style={{ color: h.count === 0 ? "hsl(var(--muted-foreground) / 0.4)" : h.intensity > 0.5 ? "hsl(var(--destructive-foreground))" : "hsl(var(--muted-foreground))" }}>
                            {h.hour}
                          </span>
                          {h.intensity > 0.8 && (
                            <motion.div className="absolute inset-0 rounded-md" animate={{ opacity: [0, 0.3, 0] }} transition={{ duration: 2, repeat: Infinity }}
                              style={{ border: `1px solid hsl(var(--destructive))` }} />
                          )}
                        </motion.div>
                      ))}
                    </div>
                    <div className="flex items-center justify-center gap-1.5 mt-3">
                      <span className="text-[7px] text-muted-foreground">Low</span>
                      {[0.1, 0.3, 0.5, 0.7, 1].map((o, i) => (
                        <div key={i} className="w-5 h-3 rounded-sm" style={{ background: `hsl(var(--destructive) / ${o})` }} />
                      ))}
                      <span className="text-[7px] text-muted-foreground">High</span>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 gap-2.5">
                    {[
                      { icon: Target, label: "Avg Focus", value: `${avgFocus}%`, color: "text-success", glow: "hsl(var(--success))", bg: "bg-success/8" },
                      { icon: Activity, label: "Total Switches", value: String(totalSwitches), color: "text-warning", glow: "hsl(var(--warning))", bg: "bg-warning/8" },
                      { icon: Clock, label: "Time Lost", value: `${totalDistractedMin}m`, color: "text-destructive", glow: "hsl(var(--destructive))", bg: "bg-destructive/8" },
                      { icon: Brain, label: "Recall Rate", value: recallAttempts > 0 ? `${Math.round((recallPassed / recallAttempts) * 100)}%` : "—", color: "text-primary", glow: "hsl(var(--primary))", bg: "bg-primary/8" },
                    ].map((stat, i) => (
                      <motion.div key={stat.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                        className={`rounded-2xl border border-border/30 ${stat.bg} p-3.5 relative overflow-hidden`}>
                        <motion.div className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl"
                          style={{ background: stat.glow, opacity: 0.08 }}
                          animate={{ scale: [1, 1.4, 1] }} transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }} />
                        <stat.icon className={`w-4 h-4 ${stat.color} mb-1.5 relative z-10`} />
                        <p className="text-[8px] text-muted-foreground relative z-10 uppercase tracking-wider">{stat.label}</p>
                        <p className={`text-xl font-black ${stat.color} relative z-10`}>{stat.value}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Session Patterns */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Clock className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <p className="text-[11px] font-bold text-foreground">Distraction by Time of Day</p>
                    </div>
                    <div className="grid grid-cols-4 gap-2">
                      {sessionPatterns.map((sp, i) => (
                        <motion.div key={sp.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.06 }}
                          className="flex flex-col items-center gap-1.5 p-2 rounded-xl bg-secondary/20 border border-border/15">
                          <span className="text-sm">{sp.icon}</span>
                          <div className="w-full h-1.5 rounded-full bg-muted/20 overflow-hidden">
                            <motion.div initial={{ width: 0 }} animate={{ width: `${sp.pct}%` }} transition={{ delay: 0.3 + i * 0.1, duration: 0.8 }}
                              className="h-full rounded-full" style={{ background: sp.color }} />
                          </div>
                          <span className="text-[8px] font-bold text-foreground">{sp.pct}%</span>
                          <span className="text-[7px] text-muted-foreground">{sp.label}</span>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── APPS TAB ─── */}
              {activeTab === "apps" && (
                <motion.div key="apps" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3.5">

                  {/* Donut + Summary */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-4">
                      <DonutChart segments={categoryBreakdown.map(c => ({ percentage: c.percentage, color: c.accent }))} />
                      <div className="flex-1 space-y-1.5">
                        <p className="text-[11px] font-bold text-foreground">Source Distribution</p>
                        {categoryBreakdown.slice(0, 3).map((cat, i) => (
                          <div key={cat.id} className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full" style={{ background: cat.accent }} />
                            <span className="text-[9px] text-muted-foreground flex-1">{cat.label}</span>
                            <span className="text-[9px] font-bold text-foreground">{cat.percentage}%</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  {/* Category Cards */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                        <Smartphone className="w-3.5 h-3.5 text-accent" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-foreground">Distraction Sources</p>
                        <p className="text-[8px] text-muted-foreground">{events.length} total events tracked</p>
                      </div>
                    </div>

                    {events.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-10 px-4">Keep studying to see breakdown</p>
                    ) : (
                      <div className="px-4 pb-4 space-y-2">
                        {categoryBreakdown.map((cat, i) => (
                          <motion.div key={cat.id} initial={{ opacity: 0, x: -15 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.06 * i }}
                            className="rounded-xl border border-border/20 bg-secondary/15 p-3 relative overflow-hidden">
                            {/* Subtle gradient background */}
                            <div className="absolute inset-0 opacity-[0.03]" style={{ background: `linear-gradient(135deg, ${cat.accent}, transparent)` }} />
                            <div className="flex items-center gap-3 relative z-10">
                              <motion.div whileHover={{ scale: 1.1, rotate: 5 }}
                                className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shadow-lg`}>
                                <cat.icon className="w-4 h-4 text-white" />
                              </motion.div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between mb-1">
                                  <p className="text-[11px] font-bold text-foreground">{cat.label}</p>
                                  <p className="text-[11px] font-black text-foreground">{cat.totalMinutes}m</p>
                                </div>
                                <div className="w-full h-2.5 rounded-full bg-muted/20 overflow-hidden">
                                  <motion.div initial={{ width: 0 }} animate={{ width: `${cat.percentage}%` }}
                                    transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: "easeOut" }}
                                    className={`h-full rounded-full bg-gradient-to-r ${cat.gradient} relative overflow-hidden`}>
                                    <motion.div className="absolute inset-0"
                                      animate={{ x: ["-100%", "200%"] }} transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 + i, delay: i * 0.3 }}
                                      style={{ background: "linear-gradient(90deg, transparent, hsla(0,0%,100%,0.3), transparent)" }} />
                                  </motion.div>
                                </div>
                                <p className="text-[8px] text-muted-foreground mt-1">{cat.events} events · {cat.percentage}%</p>
                              </div>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Total Wasted Time */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
                    className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 relative overflow-hidden">
                    <motion.div className="absolute inset-0 opacity-[0.04]"
                      animate={{ backgroundPosition: ["0% 0%", "100% 100%"] }} transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
                      style={{ background: "radial-gradient(circle at 30% 50%, hsl(var(--destructive)), transparent 70%)" }} />
                    <div className="flex items-center gap-3 relative z-10">
                      <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-destructive/20 to-warning/20 border border-border/30 flex items-center justify-center">
                        <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                          <Clock className="w-5 h-5 text-destructive" />
                        </motion.div>
                      </div>
                      <div className="flex-1">
                        <p className="text-[9px] text-muted-foreground uppercase tracking-wider font-semibold">Total Time Wasted</p>
                        <p className="text-2xl font-black text-foreground">{totalDistractedMin}<span className="text-sm text-muted-foreground ml-1">min</span></p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-full text-[9px] font-bold ${avgDailyMin < 10 ? "bg-success/15 text-success border border-success/20" : avgDailyMin < 30 ? "bg-warning/15 text-warning border border-warning/20" : "bg-destructive/15 text-destructive border border-destructive/20"}`}>
                        {avgDailyMin}m/day
                      </div>
                    </div>
                  </motion.div>
                </motion.div>
              )}

              {/* ─── INSIGHTS TAB ─── */}
              {activeTab === "insights" && (
                <motion.div key="insights" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3.5">

                  {/* AI Insight Cards */}
                  {[
                    {
                      id: "pattern", icon: ScanEye, title: "Pattern Detection", color: "text-primary", glow: "hsl(var(--primary))",
                      summary: peakHour?.count > 0 ? `Your distraction peaks at ${peakHour.hour}:00 with ${peakHour.count} events` : "Not enough data yet",
                      detail: `Avoid scheduling deep-focus sessions around ${peakHour?.hour ?? 0}:00. Your brain is most vulnerable to distractions during this hour. Consider using website blockers or switching to offline mode.`
                    },
                    {
                      id: "recall", icon: Brain, title: "Recall Intelligence", color: "text-accent", glow: "hsl(var(--accent))",
                      summary: recallAttempts > 0 ? `${Math.round((recallPassed / recallAttempts) * 100)}% recall success rate (${recallPassed}/${recallAttempts})` : "No recall challenges yet",
                      detail: recallPassed < recallAttempts * 0.7 ? "Your recall rate is below 70%. This suggests material isn't being retained well. Consider more spaced repetition sessions before studying new topics." : "Your recall rate is strong! The Focus Shield challenges are helping reinforce your learning."
                    },
                    {
                      id: "risk", icon: TriangleAlert, title: "Risk Assessment", color: "text-warning", glow: "hsl(var(--warning))",
                      summary: `${freezeCount} freeze events, ${avgDailyMin}min avg daily distraction`,
                      detail: avgDailyMin > 20 ? "⚠️ HIGH RISK: You're losing over 20 minutes daily to distractions. This compounds to 2+ hours per week of lost study time. Enable stricter shield settings." : "✅ Your distraction levels are manageable. Keep your current focus habits consistent."
                    },
                    {
                      id: "best", icon: Crown, title: "Best vs Worst Day", color: "text-success", glow: "hsl(var(--success))",
                      summary: bestDay ? `Best: ${bestDay.focus_score}% | Worst: ${worstDay?.focus_score ?? 0}%` : "Need more days of data",
                      detail: bestDay ? `Your best focus day scored ${bestDay.focus_score}% on ${bestDay.score_date}. Try to replicate the conditions of that day — study environment, time, and energy levels.` : "Keep studying to unlock day comparison insights."
                    },
                  ].map((insight, i) => (
                    <motion.div key={insight.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.08 * i }}
                      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                      <motion.button whileTap={{ scale: 0.98 }} onClick={() => setExpandedInsight(expandedInsight === insight.id ? null : insight.id)}
                        className="w-full p-4 flex items-center gap-3 text-left">
                        <motion.div animate={expandedInsight === insight.id ? { rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] } : {}}
                          transition={{ duration: 0.5 }}
                          className="w-9 h-9 rounded-xl flex items-center justify-center relative"
                          style={{ background: `${insight.glow}15`, border: `1px solid ${insight.glow}25` }}>
                          <insight.icon className={`w-4 h-4 ${insight.color}`} />
                          {expandedInsight === insight.id && (
                            <motion.div className="absolute inset-0 rounded-xl" animate={{ opacity: [0, 0.4, 0] }} transition={{ duration: 1.5, repeat: Infinity }}
                              style={{ border: `1px solid ${insight.glow}` }} />
                          )}
                        </motion.div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] font-bold text-foreground">{insight.title}</p>
                          <p className="text-[9px] text-muted-foreground truncate">{insight.summary}</p>
                        </div>
                        <motion.div animate={{ rotate: expandedInsight === insight.id ? 90 : 0 }} transition={{ type: "spring" }}>
                          <ChevronRight className="w-4 h-4 text-muted-foreground" />
                        </motion.div>
                      </motion.button>
                      <AnimatePresence>
                        {expandedInsight === insight.id && (
                          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                            className="overflow-hidden">
                            <div className="px-4 pb-4 pt-0">
                              <div className="p-3 rounded-xl bg-secondary/20 border border-border/15">
                                <div className="flex items-center gap-1.5 mb-2">
                                  <Sparkles className="w-3 h-3 text-primary" />
                                  <span className="text-[9px] font-bold text-primary uppercase tracking-wider">AI Analysis</span>
                                </div>
                                <p className="text-[10px] text-muted-foreground leading-relaxed">{insight.detail}</p>
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  ))}

                  {/* Focus Consistency Score */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                        <HeartPulse className="w-3.5 h-3.5 text-success" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-foreground">Focus Consistency</p>
                        <p className="text-[8px] text-muted-foreground">How steady is your focus over time</p>
                      </div>
                    </div>
                    {/* Consistency visualization */}
                    <div className="flex items-center gap-[2px] h-8">
                      {scores.slice().reverse().map((s, i) => {
                        const color = s.focus_score >= 80 ? "hsl(var(--success))" : s.focus_score >= 60 ? "hsl(var(--primary))" : s.focus_score >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
                        return (
                          <motion.div key={s.score_date} initial={{ scaleY: 0 }} animate={{ scaleY: 1 }}
                            transition={{ delay: 0.03 * i, type: "spring" }}
                            className="flex-1 rounded-sm origin-bottom" style={{ height: `${Math.max(15, s.focus_score)}%`, background: color, opacity: 0.7 }} />
                        );
                      })}
                      {scores.length === 0 && <p className="text-[9px] text-muted-foreground mx-auto">No data</p>}
                    </div>
                    {scores.length > 1 && (
                      <div className="flex justify-between mt-2">
                        <span className="text-[7px] text-muted-foreground">Oldest</span>
                        <span className="text-[7px] text-muted-foreground">Today</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {/* ─── PREDICT TAB ─── */}
              {activeTab === "predict" && (
                <motion.div key="predict" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3.5">

                  {/* Distraction Probability Hero */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden relative">
                    <div className="absolute inset-0 pointer-events-none">
                      <motion.div className="absolute inset-0 rounded-2xl"
                        animate={{ opacity: [0, 0.04, 0] }} transition={{ duration: 3, repeat: Infinity }}
                        style={{ background: `radial-gradient(circle at 50% 30%, ${(cogPred.prediction?.prediction.distraction_probability ?? 0) > 0.65 ? "hsl(var(--destructive))" : "hsl(var(--primary))"}, transparent)` }} />
                    </div>
                    <div className="relative p-5">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Crosshair className="w-3.5 h-3.5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="text-[11px] font-bold text-foreground">Attention Drift Prediction</p>
                          <p className="text-[8px] text-muted-foreground">ML-powered distraction probability</p>
                        </div>
                        <motion.button whileTap={{ scale: 0.9 }} onClick={() => cogPred.predict()}
                          className="px-3 py-1.5 rounded-full bg-primary/15 text-primary text-[9px] font-bold border border-primary/20">
                          {cogPred.loading ? <RefreshCw className="w-3 h-3 animate-spin" /> : "Predict"}
                        </motion.button>
                      </div>

                      {cogPred.prediction ? (() => {
                        const dp = cogPred.prediction.prediction.distraction_probability;
                        const dpPct = Math.round(dp * 100);
                        const dpColor = dp > 0.7 ? "hsl(var(--destructive))" : dp > 0.5 ? "hsl(var(--warning))" : "hsl(var(--success))";
                        const dpLabel = dp > 0.7 ? "HIGH RISK" : dp > 0.5 ? "MODERATE" : "LOW RISK";
                        return (
                          <div className="space-y-4">
                            <div className="flex items-center gap-5">
                              {/* DP Ring */}
                              <div className="relative w-[90px] h-[90px] shrink-0">
                                <svg viewBox="0 0 100 100" className="w-full h-full">
                                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="5" opacity={0.1} />
                                  <motion.circle cx="50" cy="50" r="42" fill="none" stroke={dpColor} strokeWidth="6" strokeLinecap="round"
                                    strokeDasharray={2 * Math.PI * 42} strokeDashoffset={2 * Math.PI * 42}
                                    animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - dp) }}
                                    transition={{ duration: 1.5, ease: [0.34, 1.56, 0.64, 1] }}
                                    transform="rotate(-90 50 50)"
                                    style={{ filter: `drop-shadow(0 0 6px ${dpColor})` }} />
                                </svg>
                                <div className="absolute inset-0 flex flex-col items-center justify-center">
                                  <span className="text-[22px] font-black tabular-nums" style={{ color: dpColor }}>{dpPct}%</span>
                                  <span className="text-[7px] text-muted-foreground font-bold">DP</span>
                                </div>
                              </div>

                              <div className="flex-1 space-y-2">
                                <div className="px-2.5 py-1 rounded-full text-[8px] font-black inline-flex items-center gap-1"
                                  style={{ background: `${dpColor}15`, color: dpColor, border: `1px solid ${dpColor}30` }}>
                                  {dp > 0.7 ? <AlertTriangle className="w-3 h-3" /> : dp > 0.5 ? <Zap className="w-3 h-3" /> : <ShieldCheck className="w-3 h-3" />}
                                  {dpLabel}
                                </div>
                                <p className="text-[9px] text-muted-foreground">
                                  {dp > 0.7 ? "Distraction imminent — intervention recommended" : dp > 0.5 ? "Moderate risk — stay aware" : "Focus is strong — keep going"}
                                </p>
                              </div>
                            </div>

                            {/* Signal Breakdown */}
                            <div className="space-y-2">
                              <p className="text-[9px] font-bold text-foreground uppercase tracking-wider">Signal Analysis</p>
                              {[
                                { label: "Time-of-Day Risk", value: cogPred.prediction.prediction.signals.time_of_day, icon: Clock },
                                { label: "Fatigue Level", value: cogPred.prediction.prediction.signals.fatigue, icon: BatteryCharging },
                                { label: "Switch Velocity", value: cogPred.prediction.prediction.signals.switch_velocity, icon: Zap },
                                { label: "Error Clustering", value: cogPred.prediction.prediction.signals.error_cluster, icon: AlertTriangle },
                                { label: "Latency Spike", value: cogPred.prediction.prediction.signals.latency_spike, icon: Activity },
                                { label: "Mock Frustration", value: cogPred.prediction.prediction.signals.mock_frustration, icon: Flame },
                              ].map((sig, i) => {
                                const pct = Math.round(sig.value * 100);
                                const sigColor = pct > 70 ? "hsl(var(--destructive))" : pct > 40 ? "hsl(var(--warning))" : "hsl(var(--success))";
                                return (
                                  <motion.div key={sig.label} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.05 * i }}
                                    className="flex items-center gap-2">
                                    <sig.icon className="w-3 h-3 text-muted-foreground shrink-0" />
                                    <span className="text-[9px] text-muted-foreground flex-1">{sig.label}</span>
                                    <div className="w-20 h-1.5 rounded-full bg-muted/20 overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.8, delay: 0.1 + i * 0.05 }}
                                        className="h-full rounded-full" style={{ background: sigColor }} />
                                    </div>
                                    <span className="text-[9px] font-bold tabular-nums w-8 text-right" style={{ color: sigColor }}>{pct}%</span>
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })() : (
                        <div className="flex flex-col items-center py-8 gap-2">
                          <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                            <Crosshair className="w-8 h-8 text-primary/30" />
                          </motion.div>
                          <p className="text-[10px] text-muted-foreground">Tap Predict to analyze attention signals</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Cognitive State Classifier */}
                  {cogPred.prediction && (
                    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
                      className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4 relative overflow-hidden">
                      <div className="absolute inset-0 pointer-events-none">
                        <motion.div animate={{ scale: [1, 1.3, 1], opacity: [0.03, 0.06, 0.03] }} transition={{ duration: 5, repeat: Infinity }}
                          className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ background: "hsl(var(--accent))" }} />
                      </div>
                      <div className="flex items-center gap-2 mb-3 relative z-10">
                        <div className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center">
                          <Cpu className="w-3.5 h-3.5 text-accent" />
                        </div>
                        <div>
                          <p className="text-[11px] font-bold text-foreground">Cognitive State</p>
                          <p className="text-[8px] text-muted-foreground">AI-classified mental state</p>
                        </div>
                      </div>

                      <div className="relative z-10 space-y-3">
                        {/* Current State Display */}
                        {(() => {
                          const stateConfig: Record<string, { emoji: string; color: string; bg: string; label: string; desc: string }> = {
                            deep_focus: { emoji: "🎯", color: "text-success", bg: "bg-success/12", label: "Deep Focus", desc: "Maximum cognitive engagement detected" },
                            surface_focus: { emoji: "👀", color: "text-primary", bg: "bg-primary/12", label: "Surface Focus", desc: "Light attention — prone to wandering" },
                            cognitive_fatigue: { emoji: "😴", color: "text-warning", bg: "bg-warning/12", label: "Cognitive Fatigue", desc: "Mental resources depleted — take a break" },
                            emotional_frustration: { emoji: "😤", color: "text-destructive", bg: "bg-destructive/12", label: "Emotional Frustration", desc: "High error frustration — mood intervention needed" },
                            high_impulse: { emoji: "⚡", color: "text-accent", bg: "bg-accent/12", label: "High Impulse", desc: "Rapid switching — impulse control weakened" },
                          };
                          const state = cogPred.prediction!.prediction.cognitive_state;
                          const conf = Math.round(cogPred.prediction!.prediction.state_confidence * 100);
                          const sc = stateConfig[state] || stateConfig.surface_focus;
                          return (
                            <div className={`p-3.5 rounded-xl ${sc.bg} border border-border/20`}>
                              <div className="flex items-center gap-3">
                                <motion.span animate={{ scale: [1, 1.15, 1] }} transition={{ duration: 2, repeat: Infinity }} className="text-2xl">{sc.emoji}</motion.span>
                                <div className="flex-1">
                                  <div className="flex items-center gap-2">
                                    <p className={`text-sm font-black ${sc.color}`}>{sc.label}</p>
                                    <span className="text-[8px] px-1.5 py-0.5 rounded-full bg-card/50 text-muted-foreground font-bold">{conf}% conf</span>
                                  </div>
                                  <p className="text-[9px] text-muted-foreground mt-0.5">{sc.desc}</p>
                                </div>
                              </div>
                            </div>
                          );
                        })()}

                        {/* Intervention Ladder */}
                        {cogPred.prediction.intervention && (
                          <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                            className="p-3 rounded-xl bg-warning/8 border border-warning/20">
                            <div className="flex items-center gap-2 mb-2">
                              <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                              <p className="text-[10px] font-bold text-warning">Intervention Stage {cogPred.prediction.intervention.stage}</p>
                            </div>
                            <div className="flex gap-1.5">
                              {[1, 2, 3].map(s => (
                                <div key={s} className={`flex-1 h-2 rounded-full ${s <= cogPred.prediction!.intervention!.stage ? "bg-warning" : "bg-muted/20"}`}>
                                  {s <= cogPred.prediction!.intervention!.stage && (
                                    <motion.div className="h-full rounded-full bg-warning" initial={{ width: 0 }} animate={{ width: "100%" }}
                                      transition={{ duration: 0.5, delay: s * 0.15 }} />
                                  )}
                                </div>
                              ))}
                            </div>
                            <div className="flex justify-between mt-1.5">
                              <span className="text-[7px] text-muted-foreground">Soft Nudge</span>
                              <span className="text-[7px] text-muted-foreground">Micro Recall</span>
                              <span className="text-[7px] text-muted-foreground">Hard Lock</span>
                            </div>
                            {cogPred.prediction.intervention.stage === 3 && (
                              <p className="text-[8px] text-warning/80 mt-2 flex items-center gap-1">
                                <Lock className="w-3 h-3" />
                                Lock duration: {Math.round(cogPred.prediction.intervention.lock_duration / 60)}min
                              </p>
                            )}
                          </motion.div>
                        )}

                        {/* State History */}
                        {cogPred.stateHistory.length > 0 && (
                          <div className="space-y-1.5">
                            <p className="text-[9px] font-bold text-foreground uppercase tracking-wider">Recent States</p>
                            <div className="flex gap-[3px] flex-wrap">
                              {cogPred.stateHistory.slice(0, 20).map((s, i) => {
                                const stateColors: Record<string, string> = {
                                  deep_focus: "bg-success", surface_focus: "bg-primary",
                                  cognitive_fatigue: "bg-warning", emotional_frustration: "bg-destructive",
                                  high_impulse: "bg-accent",
                                };
                                return (
                                  <motion.div key={i} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: i * 0.02 }}
                                    className={`w-3 h-3 rounded-sm ${stateColors[s.state] || "bg-muted"}`}
                                    style={{ opacity: 0.3 + s.confidence * 0.7 }}
                                    title={`${s.state} (${Math.round(s.confidence * 100)}%)`} />
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}

              {/* ─── NEURAL TAB ─── */}
              {activeTab === "neural" && (
                <motion.div key="neural" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3.5">

                  {/* Neural Discipline Score Hero */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-5 relative overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                      <motion.div animate={{ scale: [1, 1.5, 1], opacity: [0.04, 0.08, 0.04] }} transition={{ duration: 6, repeat: Infinity }}
                        className="absolute top-[-20%] right-[-10%] w-48 h-48 rounded-full blur-3xl" style={{ background: "hsl(var(--primary))" }} />
                    </div>

                    <div className="flex items-center gap-2 mb-4 relative z-10">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Dumbbell className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-foreground">Neural Discipline</p>
                        <p className="text-[8px] text-muted-foreground">Track resisted distractions & earn rewards</p>
                      </div>
                    </div>

                    {cogPred.prediction ? (() => {
                      const disc = cogPred.prediction.discipline;
                      const dopamine = cogPred.prediction.dopamine;
                      const scoreColor = disc.score >= 70 ? "text-success" : disc.score >= 40 ? "text-warning" : "text-destructive";
                      return (
                        <div className="relative z-10 space-y-4">
                          <div className="flex items-center gap-5">
                            <div className="text-center">
                              <motion.p animate={{ scale: [1, 1.05, 1] }} transition={{ duration: 2, repeat: Infinity }}
                                className={`text-4xl font-black tabular-nums ${scoreColor}`}>{disc.score}</motion.p>
                              <p className="text-[8px] text-muted-foreground mt-0.5">DISCIPLINE</p>
                            </div>
                            <div className="flex-1 grid grid-cols-2 gap-2">
                              {[
                                { label: "Resisted", value: disc.resisted, icon: ShieldCheck, color: "text-success", bg: "bg-success/8" },
                                { label: "Yielded", value: disc.yielded, icon: AlertTriangle, color: "text-destructive", bg: "bg-destructive/8" },
                                { label: "Multiplier", value: `${disc.streak_multiplier}x`, icon: Flame, color: "text-warning", bg: "bg-warning/8" },
                                { label: "XP Earned", value: disc.xp_earned, icon: Sparkles, color: "text-accent", bg: "bg-accent/8" },
                              ].map((stat, i) => (
                                <motion.div key={stat.label} initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.1 + i * 0.06 }}
                                  className={`rounded-xl ${stat.bg} p-2 text-center`}>
                                  <stat.icon className={`w-3 h-3 ${stat.color} mx-auto mb-0.5`} />
                                  <p className={`text-sm font-black ${stat.color}`}>{stat.value}</p>
                                  <p className="text-[7px] text-muted-foreground">{stat.label}</p>
                                </motion.div>
                              ))}
                            </div>
                          </div>

                          {/* Dopamine Replacement Rewards */}
                          {dopamine.stability_boost_animation && (
                            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
                              className="p-3 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 border border-primary/20 text-center">
                              <motion.p animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 1, repeat: 3 }} className="text-lg">🏆</motion.p>
                              <p className="text-[10px] font-bold text-primary">Stability Boost Earned!</p>
                              <p className="text-[8px] text-muted-foreground">Your focus resistance is paying off</p>
                            </motion.div>
                          )}

                          {dopamine.motivational_trigger && (
                            <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                              className="p-3 rounded-xl bg-success/8 border border-success/15 flex items-center gap-2">
                              <motion.span animate={{ rotate: [0, 10, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="text-lg">💪</motion.span>
                              <div className="flex-1">
                                <p className="text-[10px] font-bold text-success">Discipline Level: Strong</p>
                                <p className="text-[8px] text-muted-foreground">You're building neural pathways for sustained focus</p>
                              </div>
                            </motion.div>
                          )}
                        </div>
                      );
                    })() : (
                      <div className="flex flex-col items-center py-8 gap-2 relative z-10">
                        <motion.div animate={{ y: [0, -5, 0] }} transition={{ duration: 2, repeat: Infinity }}>
                          <Dumbbell className="w-8 h-8 text-primary/30" />
                        </motion.div>
                        <p className="text-[10px] text-muted-foreground">Run prediction to see discipline score</p>
                      </div>
                    )}
                  </div>

                  {/* Discipline History Chart */}
                  {cogPred.disciplineHistory.length > 0 && (
                    <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <div className="w-7 h-7 rounded-lg bg-success/10 flex items-center justify-center">
                          <TrendingUp className="w-3.5 h-3.5 text-success" />
                        </div>
                        <p className="text-[11px] font-bold text-foreground">Discipline Trend</p>
                      </div>
                      <div className="flex items-end gap-[4px]" style={{ height: 80 }}>
                        {[...cogPred.disciplineHistory].reverse().map((d, i) => {
                          const h = Math.max(8, d.discipline_score);
                          const barColor = d.discipline_score >= 70 ? "hsl(var(--success))" : d.discipline_score >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
                          return (
                            <motion.div key={d.score_date} initial={{ height: 0 }} animate={{ height: `${h}%` }}
                              transition={{ delay: 0.04 * i, type: "spring" }}
                              className="flex-1 rounded-md" style={{ background: barColor, opacity: 0.6 }} />
                          );
                        })}
                      </div>
                      <div className="flex justify-between mt-1.5">
                        <span className="text-[7px] text-muted-foreground">Oldest</span>
                        <span className="text-[7px] text-muted-foreground">Today</span>
                      </div>
                    </div>
                  )}

                  {/* Impulse Delay Info */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                        <Wind className="w-3.5 h-3.5 text-warning" />
                      </div>
                      <div>
                        <p className="text-[11px] font-bold text-foreground">Impulse Delay Challenge</p>
                        <p className="text-[8px] text-muted-foreground">Cognitive pause before distraction unlock</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      {[
                        { icon: Brain, text: "Micro recall question from current topic", color: "text-primary" },
                        { icon: Wind, text: "30-second breathing exercise option", color: "text-accent" },
                        { icon: Timer, text: "Adaptive delay based on impulse severity", color: "text-warning" },
                        { icon: Award, text: "XP bonus for completing challenges", color: "text-success" },
                      ].map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.08 * i }}
                          className="flex items-center gap-2.5">
                          <div className="w-6 h-6 rounded-lg bg-secondary/50 border border-border/20 flex items-center justify-center">
                            <item.icon className={`w-3 h-3 ${item.color}`} />
                          </div>
                          <p className="text-[9px] text-muted-foreground">{item.text}</p>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                </motion.div>
              )}

              {/* ─── TIMELINE TAB ─── */}
              {activeTab === "timeline" && (
                <motion.div key="timeline" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-3.5">

                  {/* Shield Summary */}
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { icon: AlertTriangle, label: "Warnings", value: warnings.filter(w => w.warning_type === "distraction").length, color: "text-warning", bg: "bg-warning/8" },
                      { icon: Lock, label: "Freezes", value: freezeCount, color: "text-destructive", bg: "bg-destructive/8" },
                      { icon: Brain, label: "Recalls", value: recallAttempts, color: "text-accent", bg: "bg-accent/8" },
                    ].map((s, i) => (
                      <motion.div key={s.label} initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.08 * i }}
                        className={`rounded-xl ${s.bg} border border-border/20 p-3 text-center`}>
                        <s.icon className={`w-4 h-4 ${s.color} mx-auto mb-1`} />
                        <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                        <p className="text-[7px] text-muted-foreground">{s.label}</p>
                      </motion.div>
                    ))}
                  </div>

                  {/* Events List */}
                  <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                    <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-warning/10 flex items-center justify-center">
                        <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                      </div>
                      <p className="text-[11px] font-bold text-foreground">Shield Events</p>
                      <span className="ml-auto text-[9px] font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">{warnings.length}</span>
                    </div>

                    {warnings.length === 0 ? (
                      <div className="text-center py-10 px-4">
                        <motion.div animate={{ rotate: [0, 10, -10, 0], scale: [1, 1.1, 1] }} transition={{ duration: 3, repeat: Infinity }}>
                          <ShieldCheck className="w-10 h-10 text-success/40 mx-auto mb-2" />
                        </motion.div>
                        <p className="text-[11px] text-muted-foreground">No shield events — keep it up! 🎯</p>
                      </div>
                    ) : (
                      <div className="px-4 pb-4 space-y-1.5">
                        {warnings.slice(0, 15).map((w, i) => {
                          const isFreeze = w.warning_type === "freeze";
                          const isRecall = w.warning_type === "recall_challenge";
                          return (
                            <motion.div key={w.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.03 * i }}
                              className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/15 border border-border/15 relative overflow-hidden">
                              {/* Subtle left accent */}
                              <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-xl"
                                style={{ background: isFreeze ? "hsl(var(--destructive))" : isRecall ? "hsl(var(--accent))" : "hsl(var(--warning))" }} />
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${isFreeze ? "bg-destructive/12" : isRecall ? "bg-accent/12" : "bg-warning/12"}`}>
                                {isFreeze ? <Lock className="w-3.5 h-3.5 text-destructive" /> :
                                  isRecall ? <Brain className="w-3.5 h-3.5 text-accent" /> :
                                  <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-[10px] font-bold text-foreground capitalize">{w.warning_type.replace(/_/g, " ")}</p>
                                <p className="text-[8px] text-muted-foreground">{new Date(w.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</p>
                              </div>
                              {isRecall && (
                                <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${w.recall_passed ? "bg-success/15" : "bg-destructive/15"}`}>
                                  {w.recall_passed ? <CheckCircle2 className="w-3 h-3 text-success" /> : <XCircle className="w-3 h-3 text-destructive" />}
                                  <span className={`text-[8px] font-bold ${w.recall_passed ? "text-success" : "text-destructive"}`}>{w.recall_passed ? "Pass" : "Fail"}</span>
                                </div>
                              )}
                            </motion.div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* How It Works */}
                  <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
                    className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                    <p className="text-[11px] font-bold text-foreground mb-3 flex items-center gap-2">
                      <Sparkles className="w-3.5 h-3.5 text-primary" /> How Focus Shield Works
                    </p>
                    <div className="space-y-2">
                      {[
                        { icon: Eye, text: "Monitors tab switches & app focus loss", color: "text-primary" },
                        { icon: BarChart3, text: "AI calculates real-time distraction score", color: "text-accent" },
                        { icon: ShieldAlert, text: "Triggers warnings during active study sessions", color: "text-warning" },
                        { icon: Brain, text: "Micro recall challenge required to dismiss", color: "text-success" },
                        { icon: Lock, text: "Auto-freeze after excessive distractions", color: "text-destructive" },
                        { icon: Target, text: "Correlates focus with memory retention rates", color: "text-primary" },
                      ].map((item, i) => (
                        <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.35 + i * 0.05 }}
                          className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-lg bg-secondary/50 border border-border/20 flex items-center justify-center shrink-0">
                            <item.icon className={`w-3 h-3 ${item.color}`} />
                          </div>
                          <p className="text-[10px] text-muted-foreground">{item.text}</p>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                </motion.div>
              )}

            </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
