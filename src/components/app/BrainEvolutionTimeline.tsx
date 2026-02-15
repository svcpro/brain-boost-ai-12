import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { TrendingUp, ChevronDown, Calendar } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays } from "date-fns";

interface TimelinePoint {
  date: string;
  label: string;
  evolution: number | null;
  efficiency: number | null;
  capacity: number | null;
  memoryGrowth: number | null;
}

type Range = "2w" | "1m" | "3m";

export default function BrainEvolutionTimeline() {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<Range>("1m");
  const [data, setData] = useState<TimelinePoint[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user || !open) return;
    fetchTimeline();
  }, [user, open, range]);

  const fetchTimeline = async () => {
    if (!user) return;
    setLoading(true);

    const daysBack = range === "2w" ? 14 : range === "1m" ? 30 : 90;
    const since = subDays(new Date(), daysBack).toISOString();

    // Fetch from brain_reports and ml_training_logs in parallel
    const [reportsRes, logsRes] = await Promise.all([
      supabase
        .from("brain_reports")
        .select("metrics, created_at")
        .eq("user_id", user.id)
        .eq("report_type", "cognitive_snapshot")
        .gte("created_at", since)
        .order("created_at", { ascending: true }),
      supabase
        .from("ml_training_logs")
        .select("metrics, completed_at")
        .eq("training_type", "daily_self_improvement")
        .eq("status", "completed")
        .gte("started_at", since)
        .order("started_at", { ascending: true })
        .limit(100),
    ]);

    const points: TimelinePoint[] = [];
    const seen = new Set<string>();

    // brain_reports snapshots
    for (const r of reportsRes.data || []) {
      const m = r.metrics as Record<string, any> | null;
      if (!m) continue;
      const day = format(new Date(r.created_at), "MMM d");
      if (seen.has(day)) continue;
      seen.add(day);
      points.push({
        date: r.created_at,
        label: day,
        evolution: m.brain_evolution_score ?? null,
        efficiency: m.learning_efficiency_score ?? null,
        capacity: m.cognitive_capacity_score ?? null,
        memoryGrowth: m.memory_growth_rate != null ? Math.round(m.memory_growth_rate * 10) / 10 : null,
      });
    }

    // ml_training_logs as fallback data points
    for (const l of logsRes.data || []) {
      const m = l.metrics as Record<string, any> | null;
      if (!m || !l.completed_at) continue;
      const day = format(new Date(l.completed_at), "MMM d");
      if (seen.has(day)) continue;
      seen.add(day);
      points.push({
        date: l.completed_at,
        label: day,
        evolution: m.brain_evolution ?? null,
        efficiency: null,
        capacity: null,
        memoryGrowth: m.memory_growth ?? null,
      });
    }

    points.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    setData(points);
    setLoading(false);
  };

  const hasData = data.length > 0;
  const latestEvolution = hasData ? data[data.length - 1].evolution : null;
  const firstEvolution = hasData ? data[0].evolution : null;
  const trend = latestEvolution != null && firstEvolution != null ? latestEvolution - firstEvolution : null;

  return (
    <Card className="p-4 overflow-hidden">
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center justify-between w-full text-left"
      >
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Calendar className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Brain Evolution Timeline</h3>
            <p className="text-[10px] text-muted-foreground">
              {trend != null
                ? `${trend >= 0 ? "+" : ""}${Math.round(trend)} pts over selected period`
                : "Track cognitive growth over time"}
            </p>
          </div>
        </div>
        <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-3">
              {/* Range selector */}
              <div className="flex gap-2">
                {(["2w", "1m", "3m"] as Range[]).map(r => (
                  <Button
                    key={r}
                    size="sm"
                    variant={range === r ? "default" : "outline"}
                    onClick={() => setRange(r)}
                    className="flex-1 text-xs"
                  >
                    {r === "2w" ? "2 Weeks" : r === "1m" ? "1 Month" : "3 Months"}
                  </Button>
                ))}
              </div>

              {loading ? (
                <div className="flex items-center justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : hasData ? (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
                  <ResponsiveContainer width="100%" height={220}>
                    <LineChart data={data} margin={{ top: 5, right: 10, left: -15, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="label"
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                        interval={Math.max(0, Math.floor(data.length / 7))}
                      />
                      <YAxis
                        domain={[0, 100]}
                        tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                        tickLine={false}
                        axisLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                          color: "hsl(var(--foreground))",
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: "11px" }} />
                      <Line
                        type="monotone"
                        dataKey="evolution"
                        name="Evolution"
                        stroke="hsl(var(--primary))"
                        strokeWidth={2}
                        dot={{ r: 3, fill: "hsl(var(--primary))" }}
                        activeDot={{ r: 5 }}
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="efficiency"
                        name="Efficiency"
                        stroke="hsl(var(--accent-foreground))"
                        strokeWidth={1.5}
                        dot={{ r: 2 }}
                        strokeDasharray="4 2"
                        connectNulls
                      />
                      <Line
                        type="monotone"
                        dataKey="capacity"
                        name="Capacity"
                        stroke="hsl(var(--muted-foreground))"
                        strokeWidth={1.5}
                        dot={{ r: 2 }}
                        strokeDasharray="2 2"
                        connectNulls
                      />
                    </LineChart>
                  </ResponsiveContainer>

                  {/* Trend summary */}
                  <div className="flex items-center gap-3 mt-2">
                    {trend != null && (
                      <Badge variant={trend >= 0 ? "default" : "destructive"} className="text-[10px] gap-1">
                        <TrendingUp className={`w-3 h-3 ${trend < 0 ? "rotate-180" : ""}`} />
                        {trend >= 0 ? "+" : ""}{Math.round(trend)} evolution
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground">
                      {data.length} snapshots
                    </span>
                  </div>
                </motion.div>
              ) : (
                <div className="text-center py-6">
                  <Calendar className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
                  <p className="text-xs text-muted-foreground">No evolution data yet</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    Build your Digital Twin regularly to track cognitive growth
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </Card>
  );
}
