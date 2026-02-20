import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Minus, BarChart3, Trophy, Zap,
  Play, ChevronRight, Shield, Star, Target, ArrowUpRight,
  Sparkles, Crown, Award, Flame, Eye
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, format, startOfDay } from "date-fns";

/* ── Types ── */
interface DayPoint {
  date: string;
  label: string;
  stability: number;
  rank: number | null;
  focus: number | null;
}

interface Milestone {
  date: string;
  label: string;
  icon: "streak" | "level" | "shield" | "star";
  description: string;
}

type Range = "7d" | "30d" | "90d";

const BRAIN_LEVELS = [
  { level: 1, name: "Beginner", min: 0, max: 20, icon: Zap },
  { level: 2, name: "Learner", min: 20, max: 35, icon: Target },
  { level: 3, name: "Scholar", min: 35, max: 50, icon: Star },
  { level: 4, name: "Expert", min: 50, max: 65, icon: Award },
  { level: 5, name: "Master", min: 65, max: 80, icon: Trophy },
  { level: 6, name: "Genius", min: 80, max: 95, icon: Crown },
  { level: 7, name: "Legend", min: 95, max: 100, icon: Flame },
];

function getBrainLevel(stability: number) {
  return BRAIN_LEVELS.find(l => stability >= l.min && stability < l.max) || BRAIN_LEVELS[BRAIN_LEVELS.length - 1];
}

/* ── Component ── */
export default function GrowthIdentitySystem() {
  const { user } = useAuth();
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<Range>("7d");
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [replayActive, setReplayActive] = useState(false);
  const [replayIdx, setReplayIdx] = useState(0);
  const [showProjection, setShowProjection] = useState(true);

  const daysBack = range === "7d" ? 7 : range === "30d" ? 30 : 90;

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setSelectedPoint(null);
    try {
      const now = new Date();
      const since = subDays(startOfDay(now), daysBack - 1).toISOString();

      const [scoresRes, rankRes, logsRes] = await Promise.all([
        supabase.from("memory_scores").select("score, recorded_at").eq("user_id", user.id).gte("recorded_at", since).order("recorded_at", { ascending: true }),
        supabase.from("brain_reports").select("metrics, created_at").eq("user_id", user.id).eq("report_type", "cognitive_snapshot").gte("created_at", since).order("created_at", { ascending: true }),
        supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", user.id).gte("created_at", since).order("created_at", { ascending: true }),
      ]);

      const dayMap = new Map<string, { scores: number[]; rank: number | null; focus: number }>();
      for (let i = daysBack - 1; i >= 0; i--) {
        dayMap.set(format(subDays(now, i), "yyyy-MM-dd"), { scores: [], rank: null, focus: 0 });
      }

      scoresRes.data?.forEach(s => {
        const key = format(new Date(s.recorded_at), "yyyy-MM-dd");
        dayMap.get(key)?.scores.push(Number(s.score));
      });

      rankRes.data?.forEach(r => {
        const m = r.metrics as Record<string, any> | null;
        if (!m) return;
        const key = format(new Date(r.created_at), "yyyy-MM-dd");
        const entry = dayMap.get(key);
        if (entry && m.brain_evolution_score != null) entry.rank = Math.round(m.brain_evolution_score);
      });

      logsRes.data?.forEach(l => {
        const key = format(new Date(l.created_at), "yyyy-MM-dd");
        const entry = dayMap.get(key);
        if (entry) entry.focus += Number(l.duration_minutes || 0);
      });

      let lastStab = 0;
      const result: DayPoint[] = [];
      for (const [key, val] of dayMap) {
        const avg = val.scores.length > 0
          ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length)
          : lastStab;
        if (val.scores.length > 0) lastStab = avg;
        const fmt = daysBack <= 7 ? "EEE" : daysBack <= 30 ? "MMM d" : "M/d";
        result.push({ date: key, label: format(new Date(key), fmt), stability: avg, rank: val.rank, focus: Math.min(val.focus, 120) });
      }
      setPoints(result);

      // Generate milestones
      const ms: Milestone[] = [];
      let prevLevel = 0;
      result.forEach((p, i) => {
        const lvl = getBrainLevel(p.stability).level;
        if (lvl > prevLevel && prevLevel > 0) {
          ms.push({ date: p.date, label: format(new Date(p.date), "MMM d"), icon: "level", description: `Reached ${getBrainLevel(p.stability).name}` });
        }
        prevLevel = lvl;
        if (p.stability >= 80 && (i === 0 || result[i - 1].stability < 80)) {
          ms.push({ date: p.date, label: format(new Date(p.date), "MMM d"), icon: "star", description: "Stability hit 80%+" });
        }
      });
      setMilestones(ms);
    } catch (e) {
      console.error("Growth load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user, daysBack]);

  useEffect(() => { load(); }, [load]);

  // Replay animation
  useEffect(() => {
    if (!replayActive) return;
    if (replayIdx >= points.length) { setReplayActive(false); return; }
    const t = setTimeout(() => setReplayIdx(i => i + 1), 150);
    return () => clearTimeout(t);
  }, [replayActive, replayIdx, points.length]);

  const hasData = points.some(p => p.stability > 0);
  const values = points.map(p => p.stability);
  const first = values.find(v => v > 0) ?? 0;
  const last = values[values.length - 1] ?? 0;
  const diff = last - first;
  const currentLevel = getBrainLevel(last);
  const nextLevel = BRAIN_LEVELS.find(l => l.level === currentLevel.level + 1);
  const levelProgress = nextLevel ? ((last - currentLevel.min) / (nextLevel.min - currentLevel.min)) * 100 : 100;

  // Projection (linear extrapolation)
  const projection = useMemo(() => {
    if (points.length < 3) return [];
    const recent = points.slice(-7);
    const avgGain = recent.length > 1 ? (recent[recent.length - 1].stability - recent[0].stability) / recent.length : 0;
    const projDays = 7;
    const proj: { label: string; stability: number }[] = [];
    for (let i = 1; i <= projDays; i++) {
      proj.push({
        label: `+${i}d`,
        stability: Math.min(100, Math.max(0, Math.round(last + avgGain * i))),
      });
    }
    return proj;
  }, [points, last]);

  // SVG dimensions
  const W = 320;
  const H = 130;
  const padX = 12;
  const padY = 15;
  const chartW = W - padX * 2;
  const chartH = H - padY * 2;

  const displayPoints = replayActive ? points.slice(0, replayIdx) : points;
  const allPoints = showProjection && !replayActive ? [...displayPoints, ...projection.map(p => ({ ...p, date: "", rank: null, focus: null }))] : displayPoints;

  const maxVal = 100;
  const toX = (i: number) => padX + (i / Math.max(allPoints.length - 1, 1)) * chartW;
  const toY = (v: number) => padY + chartH - (v / maxVal) * chartH;

  const stabilityPath = allPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(p.stability)}`).join(" ");
  const rankPath = displayPoints.filter(p => p.rank != null).map((p, i) => {
    const idx = displayPoints.indexOf(p);
    return `${i === 0 ? "M" : "L"} ${toX(idx)} ${toY(p.rank!)}`;
  }).join(" ");
  const focusMax = Math.max(...displayPoints.map(p => p.focus ?? 0), 30);
  const focusPath = displayPoints.map((p, i) => `${i === 0 ? "M" : "L"} ${toX(i)} ${toY(((p.focus ?? 0) / focusMax) * 100)}`).join(" ");

  const LevelIcon = currentLevel.icon;
  const TrendIcon = diff > 2 ? TrendingUp : diff < -2 ? TrendingDown : Minus;
  const trendColor = diff > 2 ? "text-emerald-400" : diff < -2 ? "text-red-400" : "text-muted-foreground";

  if (loading) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Growth Identity</h3>
            <p className="text-[10px] text-muted-foreground">Your brain evolution journey</p>
          </div>
        </div>
        <div className="rounded-2xl p-8 animate-pulse" style={{ background: "hsl(var(--card) / 0.6)", border: "1px solid hsl(var(--border))" }}>
          <div className="h-40 bg-secondary/30 rounded-xl" />
        </div>
      </motion.section>
    );
  }

  if (!hasData) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Growth Identity</h3>
            <p className="text-[10px] text-muted-foreground">Your brain evolution journey</p>
          </div>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))", border: "1px solid hsl(var(--border))" }}>
          <BarChart3 className="w-8 h-8 text-primary/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Study to see your growth identity</p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Growth Identity</h3>
            <p className="text-[10px] text-muted-foreground">Your brain evolution journey</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {diff > 0 ? "+" : ""}{diff}%
        </div>
      </div>

      <div className="space-y-3">
        {/* ── Brain Level Card ── */}
        <motion.div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--primary) / 0.08))", border: "1px solid hsl(var(--border))" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        >
          <div className="absolute top-0 right-0 w-24 h-24 rounded-full opacity-[0.04]" style={{ background: "radial-gradient(circle, hsl(var(--primary)), transparent)", transform: "translate(30%, -30%)" }} />
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.2), hsl(var(--primary) / 0.05))", boxShadow: "0 0 20px hsl(var(--primary) / 0.15)" }}>
                <LevelIcon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">Level {currentLevel.level} · {currentLevel.name}</p>
                <p className="text-[10px] text-muted-foreground">{last}% brain stability</p>
              </div>
            </div>
            {nextLevel && (
              <div className="text-right">
                <p className="text-[9px] text-muted-foreground">Next: {nextLevel.name}</p>
                <p className="text-[10px] font-semibold text-primary">{nextLevel.min - last}% to go</p>
              </div>
            )}
          </div>
          {/* Progression bar */}
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
            <motion.div
              className="h-full rounded-full"
              style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary) / 0.6))", boxShadow: "0 0 8px hsl(var(--primary) / 0.4)" }}
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(levelProgress, 100)}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </div>
          <div className="flex justify-between mt-1.5">
            <span className="text-[8px] text-muted-foreground">{currentLevel.min}%</span>
            <span className="text-[8px] text-muted-foreground">{nextLevel?.min ?? 100}%</span>
          </div>
        </motion.div>

        {/* ── Range Selector + Controls ── */}
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5">
            {(["7d", "30d", "90d"] as Range[]).map(r => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all ${
                  range === r
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                }`}
              >
                {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
              </button>
            ))}
          </div>
          <div className="flex gap-1.5">
            <button
              onClick={() => setShowProjection(v => !v)}
              className={`p-1.5 rounded-lg transition-all ${showProjection ? "bg-primary/15 text-primary" : "bg-secondary/50 text-muted-foreground"}`}
              title="Toggle prediction"
            >
              <Eye className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => { setReplayActive(true); setReplayIdx(0); }}
              className="p-1.5 rounded-lg bg-secondary/50 text-muted-foreground hover:text-primary hover:bg-primary/15 transition-all"
              title="Replay growth"
            >
              <Play className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* ── Interactive Graph ── */}
        <motion.div
          className="rounded-2xl p-4 relative overflow-hidden"
          style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))", border: "1px solid hsl(var(--border))" }}
        >
          <div className="relative">
            <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 130 }} preserveAspectRatio="xMidYMid meet">
              <defs>
                <linearGradient id="growthFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                </linearGradient>
                <linearGradient id="projGrad" x1="0" y1="0" x2="1" y2="0">
                  <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                </linearGradient>
              </defs>

              {/* Grid lines */}
              {[25, 50, 75].map(v => (
                <line key={v} x1={padX} x2={W - padX} y1={toY(v)} y2={toY(v)} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4 4" opacity="0.4" />
              ))}

              {/* Area fill */}
              {stabilityPath && (
                <path d={`${stabilityPath} L ${toX(allPoints.length - 1)} ${H - padY} L ${toX(0)} ${H - padY} Z`} fill="url(#growthFill)" />
              )}

              {/* Focus trend */}
              {focusPath && <path d={focusPath} fill="none" stroke="hsl(var(--muted-foreground))" strokeWidth="1" strokeDasharray="3 3" opacity="0.4" />}

              {/* Rank trend */}
              {rankPath && <path d={rankPath} fill="none" stroke="hsl(var(--accent-foreground))" strokeWidth="1.2" strokeDasharray="4 2" opacity="0.6" />}

              {/* Stability line */}
              {stabilityPath && (
                <motion.path
                  d={stabilityPath}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: replayActive ? 0.3 : 1.2, ease: "easeOut" }}
                />
              )}

              {/* Projection zone indicator */}
              {showProjection && !replayActive && projection.length > 0 && (
                <line
                  x1={toX(displayPoints.length - 1)} y1={padY}
                  x2={toX(displayPoints.length - 1)} y2={H - padY}
                  stroke="hsl(var(--primary))" strokeWidth="0.5" strokeDasharray="2 2" opacity="0.3"
                />
              )}

              {/* Interactive dots */}
              {displayPoints.map((p, i) => (
                <g key={p.date} onClick={() => setSelectedPoint(selectedPoint === i ? null : i)} style={{ cursor: "pointer" }}>
                  <circle cx={toX(i)} cy={toY(p.stability)} r={selectedPoint === i ? 5 : 3} fill="hsl(var(--primary))" opacity={selectedPoint === i ? 1 : 0.8} />
                  {selectedPoint === i && (
                    <circle cx={toX(i)} cy={toY(p.stability)} r={8} fill="none" stroke="hsl(var(--primary))" strokeWidth="1" opacity="0.3" />
                  )}
                </g>
              ))}

              {/* Projection dots */}
              {showProjection && !replayActive && projection.map((p, i) => (
                <circle key={`proj-${i}`} cx={toX(displayPoints.length + i)} cy={toY(p.stability)} r={2} fill="hsl(var(--primary))" opacity="0.3" />
              ))}

              {/* Milestone markers */}
              {milestones.map((m, i) => {
                const pIdx = points.findIndex(p => p.date === m.date);
                if (pIdx < 0) return null;
                return (
                  <g key={`ms-${i}`}>
                    <circle cx={toX(pIdx)} cy={padY + 4} r={4} fill="hsl(var(--primary) / 0.3)" stroke="hsl(var(--primary))" strokeWidth="1" />
                    <text x={toX(pIdx)} y={padY} textAnchor="middle" fontSize="6" fill="hsl(var(--primary))">★</text>
                  </g>
                );
              })}
            </svg>

            {/* Legend */}
            <div className="flex items-center gap-3 mt-2">
              <span className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <span className="w-3 h-0.5 rounded-full bg-primary inline-block" /> Stability
              </span>
              <span className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <span className="w-3 h-0.5 rounded-full inline-block" style={{ background: "hsl(var(--accent-foreground))", opacity: 0.6 }} /> Rank
              </span>
              <span className="flex items-center gap-1 text-[8px] text-muted-foreground">
                <span className="w-3 h-0.5 rounded-full bg-muted-foreground/40 inline-block" style={{ borderTop: "1px dashed" }} /> Focus
              </span>
              {showProjection && (
                <span className="flex items-center gap-1 text-[8px] text-primary/50">
                  <span className="w-3 h-0.5 rounded-full bg-primary/30 inline-block" /> Projected
                </span>
              )}
            </div>
          </div>

          {/* Selected point action panel */}
          <AnimatePresence>
            {selectedPoint !== null && points[selectedPoint] && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-3 pt-3 border-t overflow-hidden"
                style={{ borderColor: "hsl(var(--border) / 0.3)" }}
              >
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold text-foreground">
                      {format(new Date(points[selectedPoint].date), "EEEE, MMM d")}
                    </p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">Stability: <span className="text-foreground font-semibold">{points[selectedPoint].stability}%</span></span>
                      {points[selectedPoint].rank != null && (
                        <span className="text-[9px] text-muted-foreground">Rank: <span className="text-foreground font-semibold">{points[selectedPoint].rank}</span></span>
                      )}
                      {points[selectedPoint].focus != null && points[selectedPoint].focus! > 0 && (
                        <span className="text-[9px] text-muted-foreground">Focus: <span className="text-foreground font-semibold">{points[selectedPoint].focus}m</span></span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 text-[9px]">
                    {selectedPoint > 0 && (
                      <span className={`px-1.5 py-0.5 rounded-md font-semibold ${points[selectedPoint].stability >= points[selectedPoint - 1].stability ? "bg-emerald-500/15 text-emerald-400" : "bg-red-500/15 text-red-400"}`}>
                        {points[selectedPoint].stability >= points[selectedPoint - 1].stability ? "+" : ""}{points[selectedPoint].stability - points[selectedPoint - 1].stability}%
                      </span>
                    )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* ── Before vs Now ── */}
        <motion.div
          className="rounded-2xl p-4"
          style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))", border: "1px solid hsl(var(--border))" }}
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        >
          <p className="text-[10px] font-bold text-foreground mb-3 flex items-center gap-1.5">
            <ArrowUpRight className="w-3.5 h-3.5 text-primary" />
            Before vs Now
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Stability", before: first, now: last, suffix: "%" },
              { label: "Avg Focus", before: Math.round((points.slice(0, 3).reduce((a, p) => a + (p.focus ?? 0), 0)) / Math.max(points.slice(0, 3).length, 1)), now: Math.round((points.slice(-3).reduce((a, p) => a + (p.focus ?? 0), 0)) / Math.max(points.slice(-3).length, 1)), suffix: "m" },
              { label: "Brain Level", before: getBrainLevel(first).level, now: currentLevel.level, suffix: "" },
            ].map((m, i) => {
              const change = m.now - m.before;
              return (
                <div key={m.label} className="text-center">
                  <p className="text-[8px] text-muted-foreground mb-1">{m.label}</p>
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground/60 line-through">{m.before}{m.suffix}</span>
                    <ChevronRight className="w-2.5 h-2.5 text-muted-foreground/40" />
                    <span className="text-xs font-bold text-foreground">{m.now}{m.suffix}</span>
                  </div>
                  <span className={`text-[8px] font-semibold ${change > 0 ? "text-emerald-400" : change < 0 ? "text-red-400" : "text-muted-foreground"}`}>
                    {change > 0 ? "+" : ""}{change}{m.suffix}
                  </span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* ── Milestone Timeline ── */}
        {milestones.length > 0 && (
          <motion.div
            className="rounded-2xl p-4"
            style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))", border: "1px solid hsl(var(--border))" }}
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          >
            <p className="text-[10px] font-bold text-foreground mb-3 flex items-center gap-1.5">
              <Trophy className="w-3.5 h-3.5 text-primary" />
              Milestones
            </p>
            <div className="space-y-2">
              {milestones.slice(-4).map((m, i) => (
                <motion.div
                  key={`${m.date}-${i}`}
                  className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
                  style={{ background: "hsl(var(--secondary) / 0.3)" }}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.25 + i * 0.05 }}
                >
                  <div className="w-6 h-6 rounded-lg bg-primary/15 flex items-center justify-center">
                    {m.icon === "level" ? <Zap className="w-3 h-3 text-primary" /> :
                     m.icon === "star" ? <Star className="w-3 h-3 text-primary" /> :
                     m.icon === "shield" ? <Shield className="w-3 h-3 text-primary" /> :
                     <Flame className="w-3 h-3 text-primary" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-semibold text-foreground truncate">{m.description}</p>
                    <p className="text-[8px] text-muted-foreground">{m.label}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── Summary Stats ── */}
        <div className="flex items-center justify-between px-1">
          <div className="text-center flex-1">
            <p className="text-xs font-bold text-foreground tabular-nums">{Math.round(values.reduce((a, b) => a + b, 0) / values.length)}%</p>
            <p className="text-[8px] text-muted-foreground">Avg Stability</p>
          </div>
          <div className="w-px h-6" style={{ background: "hsl(var(--border) / 0.3)" }} />
          <div className="text-center flex-1">
            <p className="text-xs font-bold text-foreground tabular-nums">{Math.max(...values)}%</p>
            <p className="text-[8px] text-muted-foreground">Peak</p>
          </div>
          <div className="w-px h-6" style={{ background: "hsl(var(--border) / 0.3)" }} />
          <div className="text-center flex-1">
            <p className={`text-xs font-bold tabular-nums ${trendColor}`}>{diff > 0 ? "+" : ""}{diff}%</p>
            <p className="text-[8px] text-muted-foreground">{range} Change</p>
          </div>
          <div className="w-px h-6" style={{ background: "hsl(var(--border) / 0.3)" }} />
          <div className="text-center flex-1">
            <p className="text-xs font-bold text-foreground tabular-nums">{points.length}</p>
            <p className="text-[8px] text-muted-foreground">Snapshots</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
