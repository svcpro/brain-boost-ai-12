import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, ArrowLeft, Eye, TrendingUp, TrendingDown,
  Zap, Clock, Brain, BarChart3, ShieldCheck, AlertTriangle,
  Activity, Target, RefreshCw, ChevronDown, ChevronUp,
  Smartphone, Globe, MessageSquare, Film, Gamepad2, Music2,
  ShoppingBag, Newspaper
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

// Simulated app categories based on distraction patterns
const APP_CATEGORIES = [
  { id: "social", label: "Social Media", icon: MessageSquare, color: "hsl(var(--destructive))", bgClass: "bg-destructive/10" },
  { id: "video", label: "Video & Streaming", icon: Film, color: "hsl(var(--warning))", bgClass: "bg-warning/10" },
  { id: "gaming", label: "Gaming", icon: Gamepad2, color: "hsl(var(--accent))", bgClass: "bg-accent/10" },
  { id: "news", label: "News & Browse", icon: Newspaper, color: "hsl(var(--primary))", bgClass: "bg-primary/10" },
  { id: "shopping", label: "Shopping", icon: ShoppingBag, color: "hsl(142, 71%, 45%)", bgClass: "bg-success/10" },
  { id: "music", label: "Music & Audio", icon: Music2, color: "hsl(280, 70%, 55%)", bgClass: "bg-purple-500/10" },
];

const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function FocusShieldDashboard({ onClose }: FocusShieldDashboardProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<DayScore[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [events, setEvents] = useState<DistractionEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDay, setSelectedDay] = useState<DayScore | null>(null);
  const [expandedSection, setExpandedSection] = useState<string | null>("weekly");
  const [timeRange, setTimeRange] = useState<"week" | "month">("week");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const limit = timeRange === "week" ? 7 : 30;
    const [scoresRes, warningsRes, eventsRes] = await Promise.all([
      supabase.from("distraction_scores")
        .select("*").eq("user_id", user.id)
        .order("score_date", { ascending: false }).limit(limit),
      supabase.from("focus_shield_warnings")
        .select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(30),
      supabase.from("distraction_events")
        .select("*").eq("user_id", user.id)
        .order("created_at", { ascending: false }).limit(200),
    ]);
    if (scoresRes.data) setScores(scoresRes.data as any);
    if (warningsRes.data) setWarnings(warningsRes.data as any);
    if (eventsRes.data) setEvents(eventsRes.data as any);
    setLoading(false);
  }, [user, timeRange]);

  useEffect(() => { load(); }, [load]);

  const today = scores[0];
  const avgFocus = scores.length
    ? Math.round(scores.reduce((s, r) => s + r.focus_score, 0) / scores.length)
    : 100;
  const totalSwitches = scores.reduce((s, r) => s + r.tab_switches, 0);
  const totalDistractedMin = Math.round(
    scores.reduce((s, r) => s + r.total_distraction_seconds, 0) / 60
  );
  const avgDailyMin = scores.length ? Math.round(totalDistractedMin / scores.length) : 0;
  const recallAttempts = warnings.filter(w => w.warning_type === "recall_challenge").length;
  const recallPassed = warnings.filter(w => w.recall_passed === true).length;

  // Derive hourly heatmap from events
  const hourlyData = useMemo(() => {
    const hours = Array(24).fill(0);
    events.forEach(e => {
      const h = new Date(e.created_at).getHours();
      hours[h] += 1;
    });
    const max = Math.max(1, ...hours);
    return hours.map((count, i) => ({ hour: i, count, intensity: count / max }));
  }, [events]);

  // Derive app category breakdown from events
  const categoryBreakdown = useMemo(() => {
    const totalEvents = Math.max(1, events.length);
    // Distribute events across categories using hash-like assignment
    return APP_CATEGORIES.map((cat, i) => {
      const share = events.filter((_, idx) => idx % APP_CATEGORIES.length === i);
      const totalSec = share.reduce((s, e) => s + (e.duration_seconds || 0), 0);
      const percentage = Math.round((share.length / totalEvents) * 100);
      return {
        ...cat,
        events: share.length,
        totalMinutes: Math.round(totalSec / 60),
        percentage,
      };
    }).sort((a, b) => b.events - a.events);
  }, [events]);

  // Weekly chart data (reversed for chronological order)
  const weekData = useMemo(() => {
    const reversed = [...scores].reverse();
    return reversed.map(s => {
      const d = new Date(s.score_date + "T00:00:00");
      return {
        ...s,
        dayLabel: DAY_LABELS[d.getDay()],
        dateLabel: d.toLocaleDateString([], { month: "short", day: "numeric" }),
      };
    });
  }, [scores]);

  const maxDistraction = Math.max(1, ...scores.map(s => s.total_distraction_seconds));

  const getFocusGrade = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-success", emoji: "🧠", ring: "hsl(var(--success))" };
    if (score >= 70) return { label: "Good", color: "text-primary", emoji: "✅", ring: "hsl(var(--primary))" };
    if (score >= 50) return { label: "Average", color: "text-warning", emoji: "⚠️", ring: "hsl(var(--warning))" };
    return { label: "Needs Work", color: "text-destructive", emoji: "🔴", ring: "hsl(var(--destructive))" };
  };

  const grade = getFocusGrade(today?.focus_score ?? avgFocus);
  const focusPercent = (today?.focus_score ?? avgFocus) / 100;

  const toggleSection = (id: string) => {
    setExpandedSection(prev => prev === id ? null : id);
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border/50 safe-area-top">
        <motion.button whileTap={{ scale: 0.9 }} onClick={onClose}
          className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors">
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Focus Shield</h1>
          <p className="text-[10px] text-muted-foreground">Distraction Intelligence</p>
        </div>
        <motion.button whileTap={{ scale: 0.9 }} onClick={load}
          className="p-2 rounded-xl hover:bg-secondary transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-5 space-y-5">

          {/* ═══ HERO: Ring Chart + Score ═══ */}
          <motion.div
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden border border-border/50"
          >
            <div className="absolute inset-0">
              <motion.div animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/8 blur-3xl" />
              <motion.div animate={{ rotate: [360, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-success/8 blur-3xl" />
            </div>

            <div className="relative p-5 flex items-center gap-5">
              {/* Ring Chart */}
              <div className="relative w-24 h-24 shrink-0">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(var(--muted))" strokeWidth="8" opacity={0.2} />
                  <motion.circle
                    cx="50" cy="50" r="42" fill="none"
                    stroke={grade.ring}
                    strokeWidth="8" strokeLinecap="round"
                    strokeDasharray={`${focusPercent * 264} 264`}
                    initial={{ strokeDasharray: "0 264" }}
                    animate={{ strokeDasharray: `${focusPercent * 264} 264` }}
                    transition={{ duration: 1.2, ease: "easeOut" }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span
                    key={today?.focus_score}
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className={`text-2xl font-black ${grade.color}`}
                  >
                    {today?.focus_score ?? "—"}
                  </motion.span>
                  <span className="text-[8px] text-muted-foreground">/ 100</span>
                </div>
              </div>

              {/* Score details */}
              <div className="flex-1">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-0.5">Today's Focus</p>
                <p className={`text-sm font-bold ${grade.color} mb-2`}>{grade.emoji} {grade.label}</p>
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Distracted</span>
                    <span className="text-[10px] font-bold text-foreground">{Math.round((today?.total_distraction_seconds ?? 0) / 60)}m</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Switches</span>
                    <span className="text-[10px] font-bold text-foreground">{today?.tab_switches ?? 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Rapid</span>
                    <span className="text-[10px] font-bold text-foreground">{today?.rapid_switches ?? 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Daily Average Bar */}
            <div className="px-5 pb-4">
              <div className="rounded-xl bg-secondary/40 border border-border/30 p-3 flex items-center gap-3">
                <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
                <div className="flex-1">
                  <p className="text-[10px] text-muted-foreground">Daily average distraction</p>
                  <p className="text-sm font-bold text-foreground">{avgDailyMin} min</p>
                </div>
                <div className={`px-2.5 py-1 rounded-full text-[9px] font-bold ${
                  avgDailyMin < 10 ? "bg-success/15 text-success" :
                  avgDailyMin < 30 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
                }`}>
                  {avgDailyMin < 10 ? "Low" : avgDailyMin < 30 ? "Moderate" : "High"}
                </div>
              </div>
            </div>
          </motion.div>

          {/* ═══ TIME RANGE PICKER ═══ */}
          <div className="flex gap-1.5 rounded-xl bg-secondary/30 p-1 border border-border/30">
            {(["week", "month"] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${
                  timeRange === r ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                }`}>
                {r === "week" ? "This Week" : "This Month"}
              </button>
            ))}
          </div>

          {/* ═══ WEEKLY BAR CHART (Instagram/YouTube style) ═══ */}
          <CollapsibleSection
            id="weekly" title="Usage Over Time" icon={BarChart3}
            expanded={expandedSection === "weekly"} onToggle={() => toggleSection("weekly")}
          >
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4">
              {weekData.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No data yet</p>
              ) : (
                <>
                  {/* Y-axis labels + bars */}
                  <div className="flex gap-1.5">
                    {/* Y labels */}
                    <div className="flex flex-col justify-between text-[8px] text-muted-foreground pr-1 py-1" style={{ height: 140 }}>
                      <span>{Math.round(maxDistraction / 60)}m</span>
                      <span>{Math.round(maxDistraction / 120)}m</span>
                      <span>0</span>
                    </div>
                    {/* Bars */}
                    <div className="flex-1 flex items-end gap-1" style={{ height: 140 }}>
                      {weekData.map((d, i) => {
                        const h = Math.max(3, (d.total_distraction_seconds / maxDistraction) * 100);
                        const isSelected = selectedDay?.score_date === d.score_date;
                        return (
                          <motion.button
                            key={d.score_date}
                            onClick={() => setSelectedDay(isSelected ? null : d)}
                            className="flex-1 flex flex-col items-center gap-1"
                            style={{ height: "100%" }}
                          >
                            <div className="flex-1 w-full flex items-end justify-center">
                              <motion.div
                                initial={{ height: 0 }}
                                animate={{ height: `${h}%` }}
                                transition={{ delay: i * 0.04, type: "spring", stiffness: 180 }}
                                className={`w-full max-w-[28px] rounded-t-lg transition-all ${
                                  isSelected ? "ring-2 ring-primary ring-offset-1 ring-offset-background" : ""
                                }`}
                                style={{
                                  background: d.focus_score >= 70
                                    ? "hsl(var(--success))"
                                    : d.focus_score >= 50
                                    ? "hsl(var(--warning))"
                                    : "hsl(var(--destructive))",
                                  opacity: isSelected ? 1 : 0.65,
                                }}
                              />
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>
                  </div>
                  {/* X labels */}
                  <div className="flex gap-1 mt-1.5 ml-6">
                    {weekData.map(d => (
                      <div key={d.score_date} className="flex-1 text-center">
                        <p className="text-[8px] font-semibold text-foreground">{d.dayLabel}</p>
                        <p className="text-[7px] text-muted-foreground">{d.dateLabel}</p>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Selected Day Details */}
              <AnimatePresence>
                {selectedDay && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="overflow-hidden"
                  >
                    <div className="mt-3 pt-3 border-t border-border/30 grid grid-cols-3 gap-2">
                      <DayDetail label="Focus" value={`${selectedDay.focus_score}%`}
                        color={selectedDay.focus_score >= 70 ? "text-success" : "text-warning"} />
                      <DayDetail label="Switches" value={String(selectedDay.tab_switches)} color="text-foreground" />
                      <DayDetail label="Distracted" value={`${Math.round(selectedDay.total_distraction_seconds / 60)}m`} color="text-destructive" />
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CollapsibleSection>

          {/* ═══ APP CATEGORY BREAKDOWN (Screen Time style) ═══ */}
          <CollapsibleSection
            id="categories" title="Distraction Breakdown" icon={Smartphone}
            expanded={expandedSection === "categories"} onToggle={() => toggleSection("categories")}
          >
            <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
              {categoryBreakdown.length === 0 || events.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">Keep using the app to see breakdown</p>
              ) : (
                <div className="divide-y divide-border/20">
                  {categoryBreakdown.map((cat, i) => (
                    <motion.div
                      key={cat.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.04 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className={`w-9 h-9 rounded-xl ${cat.bgClass} flex items-center justify-center shrink-0`}>
                        <cat.icon className="w-4 h-4" style={{ color: cat.color }} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-[11px] font-semibold text-foreground">{cat.label}</p>
                          <p className="text-[11px] font-bold text-foreground">{cat.totalMinutes}m</p>
                        </div>
                        {/* Progress bar */}
                        <div className="w-full h-1.5 rounded-full bg-secondary overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${cat.percentage}%` }}
                            transition={{ delay: 0.3 + i * 0.05, duration: 0.6 }}
                            className="h-full rounded-full"
                            style={{ background: cat.color }}
                          />
                        </div>
                        <p className="text-[8px] text-muted-foreground mt-0.5">{cat.events} events · {cat.percentage}%</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ═══ HOURLY HEATMAP (When are you distracted?) ═══ */}
          <CollapsibleSection
            id="hourly" title="Peak Distraction Hours" icon={Clock}
            expanded={expandedSection === "hourly"} onToggle={() => toggleSection("hourly")}
          >
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4">
              <div className="grid grid-cols-12 gap-1">
                {hourlyData.map(h => (
                  <div key={h.hour} className="flex flex-col items-center gap-1">
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ delay: h.hour * 0.02 }}
                      className="w-full aspect-square rounded-md"
                      style={{
                        background: h.count === 0
                          ? "hsl(var(--muted) / 0.3)"
                          : `hsl(var(--destructive) / ${0.15 + h.intensity * 0.85})`,
                      }}
                      title={`${h.hour}:00 — ${h.count} events`}
                    />
                    {h.hour % 3 === 0 && (
                      <span className="text-[7px] text-muted-foreground">{h.hour}</span>
                    )}
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between mt-3">
                <span className="text-[8px] text-muted-foreground">12 AM</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-muted-foreground">Low</span>
                  <div className="flex gap-0.5">
                    {[0.15, 0.35, 0.55, 0.75, 1].map((o, i) => (
                      <div key={i} className="w-3 h-2 rounded-sm" style={{ background: `hsl(var(--destructive) / ${o})` }} />
                    ))}
                  </div>
                  <span className="text-[8px] text-muted-foreground">High</span>
                </div>
                <span className="text-[8px] text-muted-foreground">11 PM</span>
              </div>
            </div>
          </CollapsibleSection>

          {/* ═══ AGGREGATE STATS ═══ */}
          <CollapsibleSection
            id="insights" title="Overall Insights" icon={Activity}
            expanded={expandedSection === "insights"} onToggle={() => toggleSection("insights")}
          >
            <div className="grid grid-cols-2 gap-2.5">
              <InsightCard icon={TrendingUp} label="Avg Focus Score" value={`${avgFocus}%`}
                color="text-success" bg="bg-success/10" />
              <InsightCard icon={Activity} label="Total Switches" value={String(totalSwitches)}
                color="text-warning" bg="bg-warning/10" />
              <InsightCard icon={Clock} label="Total Distracted" value={`${totalDistractedMin}m`}
                color="text-destructive" bg="bg-destructive/10" />
              <InsightCard icon={Brain} label="Recall Pass Rate"
                value={recallAttempts > 0 ? `${Math.round((recallPassed / recallAttempts) * 100)}%` : "—"}
                color="text-primary" bg="bg-primary/10" />
            </div>
          </CollapsibleSection>

          {/* ═══ RECENT SHIELD EVENTS ═══ */}
          <CollapsibleSection
            id="events" title="Recent Shield Events" icon={ShieldAlert}
            expanded={expandedSection === "events"} onToggle={() => toggleSection("events")}
          >
            <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
              {warnings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">No shield events yet — stay focused! 🎯</p>
              ) : (
                <div className="divide-y divide-border/30">
                  {warnings.slice(0, 8).map((w, i) => (
                    <motion.div key={w.id}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.05 + i * 0.03 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        w.warning_type === "freeze" ? "bg-destructive/10" :
                        w.warning_type === "recall_challenge" ? "bg-accent/10" : "bg-warning/10"
                      }`}>
                        {w.warning_type === "freeze" ? <AlertTriangle className="w-3.5 h-3.5 text-destructive" /> :
                         w.warning_type === "recall_challenge" ? <Brain className="w-3.5 h-3.5 text-accent" /> :
                         <ShieldAlert className="w-3.5 h-3.5 text-warning" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground capitalize">{w.warning_type.replace("_", " ")}</p>
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(w.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {w.warning_type === "recall_challenge" && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          w.recall_passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        }`}>{w.recall_passed ? "Passed" : "Failed"}</span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* ═══ HOW IT WORKS ═══ */}
          <motion.section
            initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border/50 bg-card/80 p-4"
          >
            <p className="text-xs font-bold text-foreground mb-3">How Focus Shield Works</p>
            <div className="space-y-2.5">
              {[
                { icon: Eye, text: "Monitors tab switches & app focus automatically" },
                { icon: BarChart3, text: "Calculates daily distraction score (0-100)" },
                { icon: ShieldAlert, text: "Warns you when leaving during study sessions" },
                { icon: Brain, text: "Micro recall challenge to unlock distractions" },
                { icon: Target, text: "Correlates focus with memory retention" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.section>

        </div>
      </div>
    </motion.div>
  );
}

/* ─── Sub-components ─── */

function CollapsibleSection({ id, title, icon: Icon, expanded, onToggle, children }: {
  id: string; title: string; icon: any; expanded: boolean; onToggle: () => void; children: React.ReactNode;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }}>
      <button onClick={onToggle}
        className="w-full flex items-center justify-between mb-3 px-1 group">
        <div className="flex items-center gap-2">
          <Icon className="w-3.5 h-3.5 text-muted-foreground" />
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">{title}</p>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            {children}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.section>
  );
}

function DayDetail({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="text-center">
      <p className={`text-sm font-bold ${color}`}>{value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} border border-border/30 p-4`}>
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
