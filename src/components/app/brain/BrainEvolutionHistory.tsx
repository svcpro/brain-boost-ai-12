import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, format, startOfDay } from "date-fns";

interface DayPoint {
  date: string;
  label: string;
  stability: number;
  rank: number | null;
}

export default function BrainEvolutionHistory() {
  const { user } = useAuth();
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);
  const [activeMetric, setActiveMetric] = useState<"stability" | "rank">("stability");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const since = subDays(startOfDay(now), 6).toISOString();

      const [scoresRes, topicsRes, rankRes] = await Promise.all([
        supabase.from("memory_scores").select("score, recorded_at").eq("user_id", user.id).gte("recorded_at", since).order("recorded_at", { ascending: true }),
        supabase.from("topics").select("memory_strength").eq("user_id", user.id),
        supabase.from("brain_reports").select("metrics, created_at").eq("user_id", user.id).eq("report_type", "cognitive_snapshot").gte("created_at", since).order("created_at", { ascending: true }),
      ]);

      const dayMap = new Map<string, { scores: number[]; rank: number | null }>();
      for (let i = 6; i >= 0; i--) {
        const key = format(subDays(now, i), "yyyy-MM-dd");
        dayMap.set(key, { scores: [], rank: null });
      }

      scoresRes.data?.forEach((s) => {
        const key = format(new Date(s.recorded_at), "yyyy-MM-dd");
        dayMap.get(key)?.scores.push(Number(s.score));
      });

      rankRes.data?.forEach((r) => {
        const m = r.metrics as Record<string, any> | null;
        if (!m) return;
        const key = format(new Date(r.created_at), "yyyy-MM-dd");
        const entry = dayMap.get(key);
        if (entry && m.brain_evolution_score != null) {
          entry.rank = Math.round(m.brain_evolution_score);
        }
      });

      // Today fallback from topics
      const todayKey = format(now, "yyyy-MM-dd");
      const todayEntry = dayMap.get(todayKey);
      if (todayEntry?.scores.length === 0 && topicsRes.data && topicsRes.data.length > 0) {
        const avg = Math.round(topicsRes.data.reduce((sum, t) => sum + Number(t.memory_strength), 0) / topicsRes.data.length);
        todayEntry.scores.push(avg);
      }

      let lastVal = 0;
      const result: DayPoint[] = [];
      for (const [key, val] of dayMap) {
        const avg = val.scores.length > 0
          ? Math.round(val.scores.reduce((a, b) => a + b, 0) / val.scores.length)
          : lastVal;
        if (val.scores.length > 0) lastVal = avg;
        result.push({
          date: key,
          label: format(new Date(key), "EEE"),
          stability: avg,
          rank: val.rank,
        });
      }

      setPoints(result);
    } catch (e) {
      console.error("Evolution load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Brain Evolution</h3>
            <p className="text-[10px] text-muted-foreground">7-day performance trend</p>
          </div>
        </div>
        <div className="rounded-2xl p-8 animate-pulse" style={{ background: "hsl(var(--card) / 0.6)", border: "1px solid hsl(var(--border))" }}>
          <div className="h-32 bg-secondary/30 rounded-xl" />
        </div>
      </motion.section>
    );
  }

  const hasData = points.some(p => p.stability > 0);
  if (!hasData) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Brain Evolution</h3>
            <p className="text-[10px] text-muted-foreground">7-day performance trend</p>
          </div>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
          border: "1px solid hsl(var(--border))",
        }}>
          <BarChart3 className="w-8 h-8 text-primary/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Study to see your brain evolution trend</p>
        </div>
      </motion.section>
    );
  }

  const values = points.map(p => p.stability);
  const max = Math.max(...values, 100);
  const min = Math.min(...values.filter(v => v > 0), 0);
  const first = values.find(v => v > 0) ?? 0;
  const last = values[values.length - 1];
  const diff = last - first;
  const TrendIcon = diff > 2 ? TrendingUp : diff < -2 ? TrendingDown : Minus;
  const trendColor = diff > 2 ? "text-success" : diff < -2 ? "text-destructive" : "text-muted-foreground";

  // SVG chart
  const W = 280;
  const H = 100;
  const padX = 8;
  const padY = 10;
  const barW = (W - padX * 2) / points.length - 4;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.45 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Brain Evolution</h3>
            <p className="text-[10px] text-muted-foreground">7-day performance trend</p>
          </div>
        </div>
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${trendColor}`}>
          <TrendIcon className="w-3.5 h-3.5" />
          {diff > 0 ? "+" : ""}{diff}%
        </div>
      </div>

      {/* Chart card */}
      <div
        className="rounded-2xl p-4 overflow-hidden"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Bar chart */}
        <div className="relative">
          <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 100 }} preserveAspectRatio="none">
            <defs>
              <linearGradient id="barGradStability" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.9" />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
              </linearGradient>
            </defs>

            {points.map((p, i) => {
              const barH = ((p.stability - 0) / (max - 0 + 10)) * (H - padY * 2);
              const x = padX + i * ((W - padX * 2) / points.length) + 2;
              const y = H - padY - barH;
              const isHov = hovered === i;

              return (
                <g key={p.date}>
                  {/* Hover area */}
                  <rect
                    x={x - 2} y={0} width={barW + 4} height={H}
                    fill="transparent"
                    onMouseEnter={() => setHovered(i)}
                    onMouseLeave={() => setHovered(null)}
                    onTouchStart={() => setHovered(i)}
                    onTouchEnd={() => setHovered(null)}
                    style={{ cursor: "pointer" }}
                  />
                  {/* Bar */}
                  <motion.rect
                    x={x} y={y} width={barW} rx={4}
                    fill={isHov ? "hsl(var(--primary))" : "url(#barGradStability)"}
                    initial={{ height: 0, y: H - padY }}
                    animate={{ height: barH, y }}
                    transition={{ duration: 0.6, delay: 0.5 + i * 0.07 }}
                    style={{ filter: isHov ? "drop-shadow(0 0 8px hsl(var(--primary) / 0.5))" : undefined }}
                  />
                  {/* Glow on hover */}
                  {isHov && (
                    <rect
                      x={x} y={y} width={barW} height={barH} rx={4}
                      fill="hsl(var(--primary))"
                      opacity={0.15}
                      style={{ filter: "blur(8px)" }}
                    />
                  )}
                </g>
              );
            })}
          </svg>

          {/* Tooltip */}
          {hovered !== null && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-lg"
              style={{
                left: `${((padX + hovered * ((W - padX * 2) / points.length) + barW / 2) / W) * 100}%`,
                top: -8,
                transform: "translateX(-50%) translateY(-100%)",
              }}
            >
              <p className="text-[10px] font-bold text-foreground">{points[hovered].stability}%</p>
              <p className="text-[8px] text-muted-foreground">{format(new Date(points[hovered].date), "MMM d")}</p>
            </motion.div>
          )}
        </div>

        {/* Day labels */}
        <div className="flex justify-between mt-2 px-1">
          {points.map((p) => (
            <span key={p.date} className="text-[9px] text-muted-foreground font-medium">
              {p.label}
            </span>
          ))}
        </div>

        {/* Summary stats */}
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/30">
          <div className="text-center flex-1">
            <p className="text-xs font-bold text-foreground tabular-nums">{Math.round(values.reduce((a, b) => a + b, 0) / values.length)}%</p>
            <p className="text-[8px] text-muted-foreground">Avg Stability</p>
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div className="text-center flex-1">
            <p className="text-xs font-bold text-foreground tabular-nums">{Math.max(...values)}%</p>
            <p className="text-[8px] text-muted-foreground">Peak</p>
          </div>
          <div className="w-px h-6 bg-border/30" />
          <div className="text-center flex-1">
            <p className={`text-xs font-bold tabular-nums ${trendColor}`}>
              {diff > 0 ? "+" : ""}{diff}%
            </p>
            <p className="text-[8px] text-muted-foreground">7d Change</p>
          </div>
        </div>
      </div>
    </motion.section>
  );
}
