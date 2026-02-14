import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { TrendingUp, X, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays } from "date-fns";

interface ScorePoint {
  date: string;
  score: number;
}

interface BrainEvolutionProps {
  onClose: () => void;
}

const BrainEvolution = ({ onClose }: BrainEvolutionProps) => {
  const { user } = useAuth();
  const [data, setData] = useState<ScorePoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<"7d" | "30d" | "90d">("30d");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const days = range === "7d" ? 7 : range === "30d" ? 30 : 90;
    const since = subDays(new Date(), days).toISOString();

    const { data: scores } = await supabase
      .from("memory_scores")
      .select("score, recorded_at")
      .eq("user_id", user.id)
      .gte("recorded_at", since)
      .order("recorded_at", { ascending: true });

    if (scores && scores.length > 0) {
      // Group by date, average scores per day
      const byDate = new Map<string, number[]>();
      for (const s of scores) {
        const day = format(new Date(s.recorded_at), "yyyy-MM-dd");
        if (!byDate.has(day)) byDate.set(day, []);
        byDate.get(day)!.push(Number(s.score));
      }
      const points: ScorePoint[] = [];
      byDate.forEach((vals, date) => {
        points.push({ date, score: Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) });
      });
      setData(points);
    } else {
      // Fallback: use topics' current memory_strength as a single data point
      const { data: topics } = await supabase
        .from("topics")
        .select("memory_strength, updated_at")
        .eq("user_id", user.id);

      if (topics && topics.length > 0) {
        const avg = Math.round(topics.reduce((s, t) => s + Number(t.memory_strength), 0) / topics.length);
        setData([{ date: format(new Date(), "yyyy-MM-dd"), score: avg }]);
      } else {
        setData([]);
      }
    }
    setLoading(false);
  }, [user, range]);

  useEffect(() => { load(); }, [load]);

  const maxScore = Math.max(...data.map(d => d.score), 100);
  const minScore = Math.min(...data.map(d => d.score), 0);
  const scoreRange = maxScore - minScore || 1;

  // Build SVG path
  const chartWidth = 300;
  const chartHeight = 120;
  const points = data.map((d, i) => ({
    x: data.length > 1 ? (i / (data.length - 1)) * chartWidth : chartWidth / 2,
    y: chartHeight - ((d.score - minScore) / scoreRange) * (chartHeight - 10) - 5,
  }));
  const pathD = points.length > 1
    ? `M ${points.map(p => `${p.x},${p.y}`).join(" L ")}`
    : "";
  const areaD = points.length > 1
    ? `${pathD} L ${chartWidth},${chartHeight} L 0,${chartHeight} Z`
    : "";

  const latestScore = data.length > 0 ? data[data.length - 1].score : null;
  const firstScore = data.length > 0 ? data[0].score : null;
  const change = latestScore !== null && firstScore !== null ? latestScore - firstScore : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Brain Evolution</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Range selector */}
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as const).map(r => (
            <button
              key={r}
              onClick={() => setRange(r)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                range === r
                  ? "border-primary bg-primary/15 text-primary"
                  : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
              }`}
            >
              {r === "7d" ? "7 Days" : r === "30d" ? "30 Days" : "90 Days"}
            </button>
          ))}
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : data.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No evolution data yet. Study more to see your brain grow! 🧠
          </p>
        ) : (
          <>
            {/* Stats */}
            <div className="flex gap-4">
              <div className="flex-1 glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold gradient-text">{latestScore}%</p>
                <p className="text-[10px] text-muted-foreground">Current</p>
              </div>
              <div className="flex-1 glass rounded-xl p-3 neural-border text-center">
                <p className={`text-2xl font-bold ${change >= 0 ? "text-success" : "text-destructive"}`}>
                  {change >= 0 ? "+" : ""}{change}%
                </p>
                <p className="text-[10px] text-muted-foreground">Change</p>
              </div>
              <div className="flex-1 glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold text-foreground">{data.length}</p>
                <p className="text-[10px] text-muted-foreground">Data Points</p>
              </div>
            </div>

            {/* Chart */}
            <div className="glass rounded-xl p-4 neural-border">
              <svg viewBox={`-10 -5 ${chartWidth + 20} ${chartHeight + 20}`} className="w-full h-32">
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map(v => {
                  const y = chartHeight - ((v - minScore) / scoreRange) * (chartHeight - 10) - 5;
                  return (
                    <g key={v}>
                      <line x1="0" y1={y} x2={chartWidth} y2={y} stroke="hsl(var(--border))" strokeWidth="0.5" strokeDasharray="4" />
                      <text x="-8" y={y + 3} fontSize="7" fill="hsl(var(--muted-foreground))" textAnchor="end">{v}</text>
                    </g>
                  );
                })}
                {/* Area fill */}
                {areaD && <path d={areaD} fill="hsl(var(--primary) / 0.1)" />}
                {/* Line */}
                {pathD && (
                  <motion.path
                    d={pathD}
                    fill="none"
                    stroke="hsl(var(--primary))"
                    strokeWidth="2"
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: 1 }}
                    transition={{ duration: 1.5 }}
                  />
                )}
                {/* Dots */}
                {points.map((p, i) => (
                  <circle key={i} cx={p.x} cy={p.y} r="3" fill="hsl(var(--primary))" />
                ))}
              </svg>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">{data[0]?.date ? format(new Date(data[0].date), "MMM d") : ""}</span>
                <span className="text-[9px] text-muted-foreground">{data[data.length - 1]?.date ? format(new Date(data[data.length - 1].date), "MMM d") : ""}</span>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default BrainEvolution;
