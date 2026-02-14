import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, format, startOfDay } from "date-fns";

interface DayPoint {
  date: string;
  label: string;
  value: number;
}

const BrainHealthSparkline = () => {
  const { user } = useAuth();
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const now = new Date();
      const days: DayPoint[] = [];

      // Get all memory scores from last 7 days
      const since = subDays(startOfDay(now), 6).toISOString();
      const { data: scores } = await supabase
        .from("memory_scores")
        .select("score, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });

      // Also get current topic strengths for today's value
      const { data: topics } = await supabase
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id);

      // Group scores by day
      const dayMap = new Map<string, number[]>();
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        const key = format(d, "yyyy-MM-dd");
        dayMap.set(key, []);
      }

      scores?.forEach((s) => {
        const key = format(new Date(s.recorded_at), "yyyy-MM-dd");
        if (dayMap.has(key)) {
          dayMap.get(key)!.push(Number(s.score));
        }
      });

      // For today, use current topic strengths if no scores yet
      const todayKey = format(now, "yyyy-MM-dd");
      if (dayMap.get(todayKey)?.length === 0 && topics && topics.length > 0) {
        const avg = Math.round(
          topics.reduce((sum, t) => sum + Number(t.memory_strength), 0) / topics.length
        );
        dayMap.get(todayKey)!.push(avg);
      }

      // Build points — carry forward last known value for empty days
      let lastVal = 0;
      for (const [key, vals] of dayMap) {
        const avg = vals.length > 0
          ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length)
          : lastVal;
        if (vals.length > 0) lastVal = avg;
        days.push({
          date: key,
          label: format(new Date(key), "EEE"),
          value: avg,
        });
      }

      setPoints(days);
    } catch (e) {
      console.error("Sparkline load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading || points.length === 0) return null;

  const hasData = points.some((p) => p.value > 0);
  if (!hasData) return null;

  const max = Math.max(...points.map((p) => p.value), 100);
  const min = Math.min(...points.filter((p) => p.value > 0).map((p) => p.value), 0);
  const range = Math.max(max - min, 10);

  // SVG dimensions
  const W = 260;
  const H = 56;
  const padX = 4;
  const padY = 6;

  const xStep = (W - padX * 2) / (points.length - 1);
  const toY = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);

  const pathParts = points.map((p, i) => {
    const x = padX + i * xStep;
    const y = toY(p.value);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  });
  const linePath = pathParts.join(" ");

  // Gradient area
  const areaPath = `${linePath} L${padX + (points.length - 1) * xStep},${H} L${padX},${H} Z`;

  // Trend
  const first = points.find((p) => p.value > 0)?.value ?? 0;
  const last = points[points.length - 1].value;
  const diff = last - first;
  const TrendIcon = diff > 2 ? TrendingUp : diff < -2 ? TrendingDown : Minus;
  const trendColor = diff > 2 ? "text-success" : diff < -2 ? "text-destructive" : "text-muted-foreground";

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 1.2 }}
      className="mt-5 pt-4 border-t border-border/40"
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
          7-Day Trend
        </p>
        <div className={`flex items-center gap-1 text-[10px] font-semibold ${trendColor}`}>
          <TrendIcon className="w-3 h-3" />
          {diff > 0 ? "+" : ""}{diff}%
        </div>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full"
          style={{ height: 56 }}
          preserveAspectRatio="none"
        >
          <defs>
            <linearGradient id="sparkGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.25" />
              <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
            </linearGradient>
          </defs>

          {/* Area fill */}
          <motion.path
            d={areaPath}
            fill="url(#sparkGrad)"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.4, duration: 0.6 }}
          />

          {/* Line */}
          <motion.path
            d={linePath}
            fill="none"
            stroke="hsl(var(--primary))"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ delay: 1.3, duration: 1, ease: "easeOut" }}
          />

          {/* Dots with hover areas */}
          {points.map((p, i) => {
            const cx = padX + i * xStep;
            const cy = toY(p.value);
            return (
              <g key={i}>
                {/* Invisible larger hit area */}
                <circle
                  cx={cx}
                  cy={cy}
                  r="12"
                  fill="transparent"
                  onMouseEnter={() => setHovered(i)}
                  onMouseLeave={() => setHovered(null)}
                  onTouchStart={() => setHovered(i)}
                  onTouchEnd={() => setHovered(null)}
                  style={{ cursor: "pointer" }}
                />
                <motion.circle
                  cx={cx}
                  cy={cy}
                  r={hovered === i ? 5 : 3}
                  fill={hovered === i ? "hsl(var(--primary))" : "hsl(var(--background))"}
                  stroke="hsl(var(--primary))"
                  strokeWidth="1.5"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 1.5 + i * 0.08, type: "spring", stiffness: 300 }}
                />
              </g>
            );
          })}
        </svg>

        {/* Tooltip */}
        {hovered !== null && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute pointer-events-none z-10 px-2.5 py-1.5 rounded-lg bg-popover border border-border shadow-lg"
            style={{
              left: `${((padX + hovered * xStep) / W) * 100}%`,
              top: -6,
              transform: `translateX(-50%) translateY(-100%)`,
            }}
          >
            <p className="text-[10px] font-bold text-foreground">{points[hovered].value}%</p>
            <p className="text-[8px] text-muted-foreground">{format(new Date(points[hovered].date), "MMM d")}</p>
          </motion.div>
        )}
      </div>

      {/* Day labels */}
      <div className="flex justify-between mt-1 px-0.5">
        {points.map((p) => (
          <span key={p.date} className="text-[8px] text-muted-foreground">
            {p.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
};

export default BrainHealthSparkline;
