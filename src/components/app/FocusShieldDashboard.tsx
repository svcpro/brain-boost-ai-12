import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from "framer-motion";
import {
  ShieldAlert, ArrowLeft, Eye, TrendingUp, TrendingDown,
  Zap, Clock, Brain, BarChart3, ShieldCheck, AlertTriangle,
  Activity, Target, RefreshCw, ChevronDown, ChevronRight,
  Smartphone, Globe, MessageSquare, Film, Gamepad2, Music2,
  ShoppingBag, Newspaper, Flame, Shield, Lock, Unlock,
  Sparkles, CheckCircle2, XCircle, Timer, Wifi
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FocusShieldDashboardProps {
  onClose: () => void;
}

interface DayScore {
  score_date: string;
  distraction_score: number;
  focus_score: number;
  tab_switches: number;
  blur_events: number;
  total_distraction_seconds: number;
  rapid_switches: number;
  late_night_minutes: number;
}

interface WarningRow {
  id: string;
  warning_type: string;
  was_dismissed: boolean;
  recall_passed: boolean | null;
  created_at: string;
}

interface DistractionEvent {
  event_type: string;
  duration_seconds: number;
  context: any;
  created_at: string;
}

const APP_CATEGORIES = [
  { id: "social", label: "Social Media", icon: MessageSquare, gradient: "from-pink-500 to-rose-600", accent: "hsl(var(--destructive))" },
  { id: "video", label: "Video & Streaming", icon: Film, gradient: "from-red-500 to-orange-500", accent: "hsl(var(--warning))" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, gradient: "from-violet-500 to-purple-600", accent: "hsl(var(--accent))" },
  { id: "news", label: "News & Browse", icon: Newspaper, gradient: "from-cyan-400 to-blue-500", accent: "hsl(var(--primary))" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, gradient: "from-emerald-400 to-green-500", accent: "hsl(var(--success))" },
  { id: "music", label: "Music & Audio", icon: Music2, gradient: "from-amber-400 to-orange-500", accent: "hsl(40, 100%, 50%)" },
];

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

// Animated counter hook
function useAnimatedNumber(target: number, duration = 1200) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const startTime = Date.now();
    const tick = () => {
      const elapsed = Date.now() - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setVal(Math.round(eased * target));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [target, duration]);
  return val;
}

// Particle system for hero
function HeroParticles() {
  const particles = useMemo(() =>
    Array.from({ length: 20 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 4,
      duration: 3 + Math.random() * 4,
    })), []);

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute rounded-full"
          style={{
            left: `${p.x}%`,
            top: `${p.y}%`,
            width: p.size,
            height: p.size,
            background: `hsl(var(--primary) / 0.6)`,
          }}
          animate={{
            y: [0, -30, 0],
            opacity: [0, 0.8, 0],
            scale: [0.5, 1.2, 0.5],
          }}
          transition={{
            duration: p.duration,
            delay: p.delay,
            repeat: Infinity,
            ease: "easeInOut",
          }}
        />
      ))}
    </div>
  );
}

export default function FocusShieldDashboard({ onClose }: FocusShieldDashboardProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<DayScore[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [events, setEvents] = useState<DistractionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "apps" | "timeline">("overview");
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const limit = timeRange === "week" ? 7 : 30;
    const [scoresRes, warningsRes, eventsRes] = await Promise.all([
      supabase.from("distraction_scores").select("*").eq("user_id", user.id)
        .order("score_date", { ascending: false }).limit(limit),
      supabase.from("focus_shield_warnings").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("distraction_events").select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(200),
    ]);
    if (scoresRes.data) setScores(scoresRes.data as any);
    if (warningsRes.data) setWarnings(warningsRes.data as any);
    if (eventsRes.data) setEvents(eventsRes.data as any);
    setLoading(false);
  }, [user, timeRange]);

  useEffect(() => { load(); }, [load]);

  const today = scores[0];
  const todayFocus = today?.focus_score ?? 0;
  const avgFocus = scores.length ? Math.round(scores.reduce((s, r) => s + r.focus_score, 0) / scores.length) : 0;
  const totalSwitches = scores.reduce((s, r) => s + r.tab_switches, 0);
  const totalDistractedMin = Math.round(scores.reduce((s, r) => s + r.total_distraction_seconds, 0) / 60);
  const avgDailyMin = scores.length ? Math.round(totalDistractedMin / scores.length) : 0;
  const recallAttempts = warnings.filter(w => w.warning_type === "recall_challenge").length;
  const recallPassed = warnings.filter(w => w.recall_passed === true).length;

  const animatedFocus = useAnimatedNumber(todayFocus);

  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0);
    events.forEach(e => { hours[new Date(e.created_at).getHours()] += 1; });
    const max = Math.max(1, ...hours);
    return hours.map((count, i) => ({ hour: i, count, intensity: count / max }));
  }, [events]);

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

  const getFocusGrade = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-success", ringColor: "hsl(var(--success))", bgGlow: "hsl(155, 100%, 50%)" };
    if (score >= 70) return { label: "Good", color: "text-primary", ringColor: "hsl(var(--primary))", bgGlow: "hsl(187, 100%, 50%)" };
    if (score >= 50) return { label: "Average", color: "text-warning", ringColor: "hsl(var(--warning))", bgGlow: "hsl(40, 100%, 50%)" };
    return { label: "Needs Work", color: "text-destructive", ringColor: "hsl(var(--destructive))", bgGlow: "hsl(0, 72%, 51%)" };
  };

  const grade = getFocusGrade(todayFocus);
  const focusPercent = todayFocus / 100;
  const circumference = 2 * Math.PI * 54;

  const peakHour = hourlyData.reduce((max, h) => h.count > max.count ? h : max, hourlyData[0]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 30 }}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      {/* Backdrop */}
      <div className="absolute inset-0 app-shell-bg" />

      {/* Device Frame – mirrors home tab layout */}
      <div className="relative w-full max-w-[430px] h-[100dvh] md:h-[min(95dvh,920px)] md:rounded-[2.5rem] md:border md:border-border/40 md:shadow-[0_25px_80px_-12px_hsl(0_0%_0%/0.6),0_0_120px_hsl(var(--primary)/0.06)] bg-background flex flex-col overflow-hidden">
      {/* ═══ HEADER ═══ */}
      <header className="relative flex items-center gap-3 px-5 pt-4 pb-3 z-10">
        <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
          className="w-9 h-9 rounded-xl bg-secondary/60 backdrop-blur-sm border border-border/40 flex items-center justify-center">
          <ArrowLeft className="w-4 h-4 text-foreground" />
        </motion.button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <ShieldAlert className="w-4 h-4 text-primary" />
            <h1 className="text-sm font-bold text-foreground">Focus Shield</h1>
          </div>
          <p className="text-[9px] text-muted-foreground mt-0.5">AI Distraction Intelligence</p>
        </div>
        <motion.div
          animate={{ scale: [1, 1.15, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
          className={`w-2.5 h-2.5 rounded-full ${todayFocus >= 70 ? "bg-success" : todayFocus >= 50 ? "bg-warning" : "bg-destructive"}`}
          style={{ boxShadow: `0 0 8px ${grade.bgGlow}` }}
        />
        <motion.button whileTap={{ scale: 0.85 }} onClick={load}
          className="w-9 h-9 rounded-xl bg-secondary/60 backdrop-blur-sm border border-border/40 flex items-center justify-center">
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </header>

      {/* ═══ SCROLLABLE CONTENT ═══ */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-4 space-y-4">

          {/* ═══ HERO RING CARD ═══ */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="relative rounded-3xl overflow-hidden border border-border/40"
          >
            {/* Animated background */}
            <div className="absolute inset-0">
              <motion.div
                animate={{ scale: [1, 1.3, 1], opacity: [0.08, 0.15, 0.08] }}
                transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
                className="absolute top-[-30%] left-[-20%] w-[70%] h-[70%] rounded-full blur-3xl"
                style={{ background: grade.bgGlow }}
              />
              <motion.div
                animate={{ scale: [1.2, 1, 1.2], opacity: [0.05, 0.1, 0.05] }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut", delay: 1 }}
                className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full blur-3xl"
                style={{ background: "hsl(var(--accent))" }}
              />
              <HeroParticles />
            </div>

            <div className="relative p-5">
              {/* Ring + Score */}
              <div className="flex items-center gap-5">
                <div className="relative w-28 h-28 shrink-0">
                  {/* Outer glow ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 12, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-[-4px] rounded-full"
                    style={{
                      background: `conic-gradient(from 0deg, ${grade.ringColor}, transparent 60%, ${grade.ringColor})`,
                      opacity: 0.2,
                    }}
                  />
                  <svg viewBox="0 0 120 120" className="w-full h-full">
                    {/* Track */}
                    <circle cx="60" cy="60" r="54" fill="none"
                      stroke="hsl(var(--muted))" strokeWidth="6" opacity={0.15} />
                    {/* Secondary arc for visual depth */}
                    <circle cx="60" cy="60" r="48" fill="none"
                      stroke="hsl(var(--muted))" strokeWidth="2" opacity={0.08}
                      strokeDasharray="4 8" />
                    {/* Main progress */}
                    <motion.circle
                      cx="60" cy="60" r="54" fill="none"
                      stroke={grade.ringColor}
                      strokeWidth="7" strokeLinecap="round"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference}
                      animate={{ strokeDashoffset: circumference * (1 - focusPercent) }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                      transform="rotate(-90 60 60)"
                      style={{ filter: `drop-shadow(0 0 6px ${grade.bgGlow})` }}
                    />
                    {/* Glow endpoint */}
                    <motion.circle
                      cx="60" cy="6" r="4" fill={grade.ringColor}
                      animate={{ opacity: [0.5, 1, 0.5] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      style={{ filter: `drop-shadow(0 0 4px ${grade.bgGlow})` }}
                      transform={`rotate(${focusPercent * 360 - 90} 60 60)`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span
                      className={`text-3xl font-black tabular-nums ${grade.color}`}
                      style={{ textShadow: `0 0 20px ${grade.bgGlow}` }}
                    >
                      {animatedFocus}
                    </motion.span>
                    <span className="text-[9px] text-muted-foreground font-medium mt-[-2px]">Focus Score</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2.5">
                  <div>
                    <div className="flex items-center gap-1.5 mb-0.5">
                      <motion.div
                        animate={{ scale: [1, 1.2, 1] }}
                        transition={{ duration: 1.5, repeat: Infinity }}
                        className={`w-1.5 h-1.5 rounded-full`}
                        style={{ background: grade.ringColor }}
                      />
                      <p className={`text-xs font-bold ${grade.color}`}>{grade.label}</p>
                    </div>
                    <p className="text-[9px] text-muted-foreground">Today's Performance</p>
                  </div>

                  {/* Mini stats */}
                  <div className="space-y-1.5">
                    {[
                      { icon: Timer, label: "Distracted", value: `${Math.round((today?.total_distraction_seconds ?? 0) / 60)}m`, warn: (today?.total_distraction_seconds ?? 0) > 1800 },
                      { icon: Zap, label: "Tab Switches", value: String(today?.tab_switches ?? 0), warn: (today?.tab_switches ?? 0) > 20 },
                      { icon: Flame, label: "Rapid Switches", value: String(today?.rapid_switches ?? 0), warn: (today?.rapid_switches ?? 0) > 5 },
                    ].map((stat, i) => (
                      <motion.div key={stat.label}
                        initial={{ opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.5 + i * 0.1 }}
                        className="flex items-center gap-2"
                      >
                        <stat.icon className={`w-3 h-3 ${stat.warn ? "text-destructive" : "text-muted-foreground"}`} />
                        <span className="text-[9px] text-muted-foreground flex-1">{stat.label}</span>
                        <span className={`text-[10px] font-bold ${stat.warn ? "text-destructive" : "text-foreground"}`}>{stat.value}</span>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shield Status Banner */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-4 rounded-2xl p-3 flex items-center gap-3 border border-border/30"
                style={{ background: `linear-gradient(135deg, hsl(var(--secondary) / 0.5), hsl(var(--secondary) / 0.3))` }}
              >
                <motion.div
                  animate={{ rotate: [0, 5, -5, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: `linear-gradient(135deg, ${grade.ringColor}22, ${grade.ringColor}44)`, border: `1px solid ${grade.ringColor}33` }}
                >
                  <Shield className="w-5 h-5" style={{ color: grade.ringColor }} />
                </motion.div>
                <div className="flex-1">
                  <p className="text-[10px] font-bold text-foreground">Shield {todayFocus >= 70 ? "Active" : "Weak"}</p>
                  <p className="text-[8px] text-muted-foreground">
                    {todayFocus >= 70 ? "Your focus is protected" : "Distraction levels are elevated"}
                  </p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[8px] font-bold border`}
                  style={{
                    background: `${grade.ringColor}15`,
                    color: grade.ringColor,
                    borderColor: `${grade.ringColor}30`,
                  }}
                >
                  {avgDailyMin < 10 ? "LOW RISK" : avgDailyMin < 30 ? "MODERATE" : "HIGH RISK"}
                </div>
              </motion.div>
            </div>
          </motion.div>

          {/* ═══ TAB SWITCHER ═══ */}
          <div className="flex gap-1 rounded-2xl bg-secondary/30 p-1 border border-border/30">
            {(["overview", "apps", "timeline"] as const).map(tab => (
              <motion.button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all relative ${
                  activeTab === tab ? "text-primary-foreground" : "text-muted-foreground"
                }`}
                whileTap={{ scale: 0.97 }}
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="focus-tab-bg"
                    className="absolute inset-0 rounded-xl bg-primary"
                    style={{ boxShadow: `0 0 15px hsl(var(--primary) / 0.3)` }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span className="relative z-10">{tab}</span>
              </motion.button>
            ))}
          </div>

          {/* ═══ TIME RANGE ═══ */}
          <div className="flex gap-1.5">
            {(["week", "month"] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={`px-4 py-1.5 rounded-full text-[9px] font-bold transition-all border ${
                  timeRange === r
                    ? "bg-primary/15 text-primary border-primary/30"
                    : "text-muted-foreground border-border/30 bg-secondary/20"
                }`}>
                {r === "week" ? "7 Days" : "30 Days"}
              </button>
            ))}
          </div>

          <AnimatePresence mode="wait">
            {activeTab === "overview" && (
              <motion.div key="overview" initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 10 }} className="space-y-4">

                {/* ═══ FOCUS TREND CHART ═══ */}
                <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-primary/10 flex items-center justify-center">
                        <BarChart3 className="w-3 h-3 text-primary" />
                      </div>
                      <p className="text-[11px] font-bold text-foreground">Focus Trend</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-3 h-3 text-success" />
                      <span className="text-[9px] font-bold text-success">+{Math.max(0, (scores[0]?.focus_score ?? 0) - (scores[scores.length - 1]?.focus_score ?? 0))}%</span>
                    </div>
                  </div>

                  {/* Chart */}
                  <div className="px-3 pb-4">
                    {weekData.length === 0 ? (
                      <p className="text-[10px] text-muted-foreground text-center py-10">No data yet — start studying!</p>
                    ) : (
                      <div className="flex items-end gap-[3px]" style={{ height: 130 }}>
                        {weekData.map((d, i) => {
                          const h = Math.max(8, d.focus_score);
                          const isSelected = selectedDay === i;
                          const barColor = d.focus_score >= 90 ? "hsl(var(--success))"
                            : d.focus_score >= 70 ? "hsl(var(--primary))"
                            : d.focus_score >= 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
                          return (
                            <motion.button
                              key={d.score_date}
                              onClick={() => setSelectedDay(isSelected ? null : i)}
                              className="flex-1 flex flex-col items-center gap-1 h-full"
                            >
                              <div className="flex-1 w-full flex items-end justify-center">
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: `${h}%`, opacity: 1 }}
                                  transition={{ delay: 0.1 + i * 0.05, type: "spring", stiffness: 200, damping: 20 }}
                                  className="w-full max-w-[24px] rounded-lg relative overflow-hidden"
                                  style={{
                                    background: isSelected ? barColor : `${barColor}`,
                                    opacity: isSelected ? 1 : 0.55,
                                    boxShadow: isSelected ? `0 0 12px ${barColor}` : "none",
                                  }}
                                >
                                  {/* Shimmer effect on selected */}
                                  {isSelected && (
                                    <motion.div
                                      className="absolute inset-0"
                                      animate={{ x: ["-100%", "100%"] }}
                                      transition={{ duration: 1.5, repeat: Infinity, repeatDelay: 2 }}
                                      style={{ background: "linear-gradient(90deg, transparent, hsla(0,0%,100%,0.25), transparent)" }}
                                    />
                                  )}
                                </motion.div>
                              </div>
                              <span className={`text-[8px] font-bold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                                {d.dayLabel}
                              </span>
                            </motion.button>
                          );
                        })}
                      </div>
                    )}

                    {/* Selected day detail */}
                    <AnimatePresence>
                      {selectedDay !== null && weekData[selectedDay] && (
                        <motion.div
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-3 pt-3 border-t border-border/20 grid grid-cols-4 gap-1.5">
                            {[
                              { l: "Focus", v: `${weekData[selectedDay].focus_score}%`, c: "text-primary" },
                              { l: "Switches", v: String(weekData[selectedDay].tab_switches), c: "text-warning" },
                              { l: "Distracted", v: `${Math.round(weekData[selectedDay].total_distraction_seconds / 60)}m`, c: "text-destructive" },
                              { l: "Rapid", v: String(weekData[selectedDay].rapid_switches), c: "text-accent" },
                            ].map(stat => (
                              <div key={stat.l} className="text-center rounded-xl bg-secondary/30 py-2">
                                <p className={`text-[11px] font-black ${stat.c}`}>{stat.v}</p>
                                <p className="text-[7px] text-muted-foreground mt-0.5">{stat.l}</p>
                              </div>
                            ))}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                </div>

                {/* ═══ HOURLY HEATMAP ═══ */}
                <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="w-6 h-6 rounded-lg bg-destructive/10 flex items-center justify-center">
                      <Flame className="w-3 h-3 text-destructive" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[11px] font-bold text-foreground">Peak Distraction Hours</p>
                      <p className="text-[8px] text-muted-foreground">Worst hour: {peakHour?.hour ?? 0}:00 ({peakHour?.count ?? 0} events)</p>
                    </div>
                  </div>

                  <div className="grid grid-cols-12 gap-[3px]">
                    {hourlyData.map((h, i) => (
                      <motion.div
                        key={h.hour}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.02 * i, type: "spring", stiffness: 300 }}
                        className="aspect-square rounded-[4px] relative group"
                        style={{
                          background: h.count === 0
                            ? "hsl(var(--muted) / 0.2)"
                            : `hsl(var(--destructive) / ${0.12 + h.intensity * 0.88})`,
                          boxShadow: h.intensity > 0.7 ? `0 0 6px hsl(var(--destructive) / ${h.intensity * 0.4})` : "none",
                        }}
                      />
                    ))}
                  </div>
                  {/* Labels */}
                  <div className="flex justify-between mt-2">
                    {[0, 6, 12, 18, 23].map(h => (
                      <span key={h} className="text-[7px] text-muted-foreground">{h === 0 ? "12AM" : h === 12 ? "12PM" : h > 12 ? `${h - 12}PM` : `${h}AM`}</span>
                    ))}
                  </div>
                  <div className="flex items-center justify-center gap-1 mt-2">
                    <span className="text-[7px] text-muted-foreground">Low</span>
                    {[0.12, 0.3, 0.5, 0.7, 1].map((o, i) => (
                      <div key={i} className="w-4 h-2.5 rounded-sm" style={{ background: `hsl(var(--destructive) / ${o})` }} />
                    ))}
                    <span className="text-[7px] text-muted-foreground">High</span>
                  </div>
                </div>

                {/* ═══ STATS GRID ═══ */}
                <div className="grid grid-cols-2 gap-2.5">
                  {[
                    { icon: Target, label: "Avg Focus", value: `${avgFocus}%`, color: "text-success", glow: "hsl(var(--success))", bg: "bg-success/8" },
                    { icon: Activity, label: "Total Switches", value: String(totalSwitches), color: "text-warning", glow: "hsl(var(--warning))", bg: "bg-warning/8" },
                    { icon: Clock, label: "Time Lost", value: `${totalDistractedMin}m`, color: "text-destructive", glow: "hsl(var(--destructive))", bg: "bg-destructive/8" },
                    { icon: Brain, label: "Recall Rate", value: recallAttempts > 0 ? `${Math.round((recallPassed / recallAttempts) * 100)}%` : "—", color: "text-primary", glow: "hsl(var(--primary))", bg: "bg-primary/8" },
                  ].map((stat, i) => (
                    <motion.div
                      key={stat.label}
                      initial={{ opacity: 0, y: 15 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.15 + i * 0.06 }}
                      className={`rounded-2xl border border-border/30 ${stat.bg} p-4 relative overflow-hidden`}
                    >
                      <motion.div
                        className="absolute top-0 right-0 w-16 h-16 rounded-full blur-2xl opacity-10"
                        style={{ background: stat.glow }}
                        animate={{ scale: [1, 1.3, 1] }}
                        transition={{ duration: 4, repeat: Infinity, delay: i * 0.5 }}
                      />
                      <stat.icon className={`w-4 h-4 ${stat.color} mb-2 relative z-10`} />
                      <p className="text-[9px] text-muted-foreground relative z-10">{stat.label}</p>
                      <p className={`text-xl font-black ${stat.color} relative z-10`}>{stat.value}</p>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            )}

            {activeTab === "apps" && (
              <motion.div key="apps" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">

                {/* ═══ APP CATEGORY BREAKDOWN ═══ */}
                <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-accent/10 flex items-center justify-center">
                      <Smartphone className="w-3 h-3 text-accent" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">Distraction Sources</p>
                  </div>

                  {events.length === 0 ? (
                    <p className="text-[10px] text-muted-foreground text-center py-10 px-4">Keep studying to see app breakdown</p>
                  ) : (
                    <div className="px-4 pb-4 space-y-2.5">
                      {categoryBreakdown.map((cat, i) => (
                        <motion.div
                          key={cat.id}
                          initial={{ opacity: 0, x: -15 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.08 * i }}
                          className="rounded-xl border border-border/20 bg-secondary/20 p-3"
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${cat.gradient} flex items-center justify-center shadow-lg`}>
                              <cat.icon className="w-4 h-4 text-white" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between mb-1">
                                <p className="text-[11px] font-bold text-foreground">{cat.label}</p>
                                <p className="text-[11px] font-black text-foreground">{cat.totalMinutes}m</p>
                              </div>
                              <div className="w-full h-2 rounded-full bg-muted/30 overflow-hidden">
                                <motion.div
                                  initial={{ width: 0 }}
                                  animate={{ width: `${cat.percentage}%` }}
                                  transition={{ delay: 0.3 + i * 0.06, duration: 0.8, ease: "easeOut" }}
                                  className={`h-full rounded-full bg-gradient-to-r ${cat.gradient} relative overflow-hidden`}
                                >
                                  <motion.div
                                    className="absolute inset-0"
                                    animate={{ x: ["-100%", "200%"] }}
                                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3, delay: i * 0.3 }}
                                    style={{ background: "linear-gradient(90deg, transparent, hsla(0,0%,100%,0.3), transparent)" }}
                                  />
                                </motion.div>
                              </div>
                              <p className="text-[8px] text-muted-foreground mt-1">{cat.events} events · {cat.percentage}% of total</p>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                </div>

                {/* ═══ TOTAL SCREEN TIME CARD ═══ */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 }}
                  className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-border/30 flex items-center justify-center">
                      <Clock className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Total Wasted Time</p>
                      <p className="text-2xl font-black text-foreground">{totalDistractedMin}<span className="text-sm text-muted-foreground ml-1">min</span></p>
                    </div>
                    <div className={`px-3 py-1.5 rounded-full text-[9px] font-bold ${
                      avgDailyMin < 10 ? "bg-success/15 text-success border border-success/20" :
                      avgDailyMin < 30 ? "bg-warning/15 text-warning border border-warning/20" :
                      "bg-destructive/15 text-destructive border border-destructive/20"
                    }`}>
                      {avgDailyMin}m/day avg
                    </div>
                  </div>
                </motion.div>
              </motion.div>
            )}

            {activeTab === "timeline" && (
              <motion.div key="timeline" initial={{ opacity: 0, x: 10 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -10 }} className="space-y-4">

                {/* ═══ SHIELD EVENTS TIMELINE ═══ */}
                <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm overflow-hidden">
                  <div className="px-4 pt-4 pb-2 flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-warning/10 flex items-center justify-center">
                      <ShieldAlert className="w-3 h-3 text-warning" />
                    </div>
                    <p className="text-[11px] font-bold text-foreground">Shield Events</p>
                    <span className="ml-auto text-[9px] font-bold text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-full">
                      {warnings.length} total
                    </span>
                  </div>

                  {warnings.length === 0 ? (
                    <div className="text-center py-10 px-4">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      >
                        <ShieldCheck className="w-10 h-10 text-success/40 mx-auto mb-2" />
                      </motion.div>
                      <p className="text-[11px] text-muted-foreground">No shield events — stay focused! 🎯</p>
                    </div>
                  ) : (
                    <div className="px-4 pb-4 space-y-1.5">
                      {warnings.slice(0, 10).map((w, i) => {
                        const isFreeze = w.warning_type === "freeze";
                        const isRecall = w.warning_type === "recall_challenge";
                        return (
                          <motion.div
                            key={w.id}
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.04 * i }}
                            className="flex items-center gap-3 p-2.5 rounded-xl bg-secondary/20 border border-border/20"
                          >
                            {/* Timeline dot */}
                            <div className="flex flex-col items-center gap-0.5">
                              <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                                isFreeze ? "bg-destructive/15" : isRecall ? "bg-accent/15" : "bg-warning/15"
                              }`}>
                                {isFreeze ? <Lock className="w-3.5 h-3.5 text-destructive" /> :
                                 isRecall ? <Brain className="w-3.5 h-3.5 text-accent" /> :
                                 <AlertTriangle className="w-3.5 h-3.5 text-warning" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-[10px] font-bold text-foreground capitalize">
                                {w.warning_type.replace(/_/g, " ")}
                              </p>
                              <p className="text-[8px] text-muted-foreground">
                                {new Date(w.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                              </p>
                            </div>
                            {isRecall && (
                              <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${
                                w.recall_passed ? "bg-success/15" : "bg-destructive/15"
                              }`}>
                                {w.recall_passed ? <CheckCircle2 className="w-3 h-3 text-success" /> : <XCircle className="w-3 h-3 text-destructive" />}
                                <span className={`text-[8px] font-bold ${w.recall_passed ? "text-success" : "text-destructive"}`}>
                                  {w.recall_passed ? "Passed" : "Failed"}
                                </span>
                              </div>
                            )}
                          </motion.div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* ═══ HOW IT WORKS ═══ */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-sm p-4"
                >
                  <p className="text-[11px] font-bold text-foreground mb-3 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-primary" /> How Focus Shield Works
                  </p>
                  <div className="space-y-2">
                    {[
                      { icon: Eye, text: "Monitors tab switches & app focus", color: "text-primary" },
                      { icon: BarChart3, text: "AI calculates real-time distraction score", color: "text-accent" },
                      { icon: ShieldAlert, text: "Warns when leaving during study", color: "text-warning" },
                      { icon: Brain, text: "Micro recall challenge to unlock", color: "text-success" },
                      { icon: Target, text: "Correlates focus with memory retention", color: "text-destructive" },
                    ].map((item, i) => (
                      <motion.div key={i}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.4 + i * 0.06 }}
                        className="flex items-center gap-3"
                      >
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
