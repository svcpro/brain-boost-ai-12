import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Brain, Target, Calendar, ChevronDown,
  BarChart3, Clock, Zap, Shield, AlertTriangle, ArrowUpRight, Sparkles,
} from "lucide-react";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays, differenceInDays, isPast } from "date-fns";

interface MemoryForecast {
  id: string;
  name: string;
  currentStrength: number;
  predictedDropDate: string | null;
  daysUntilDrop: number | null;
  decayRate: number;
  subjectName: string;
}

interface RankPoint {
  date: string;
  rank: number;
  percentile: number;
}

interface StrategyItem {
  label: string;
  description: string;
  impact: "high" | "medium" | "low";
  timeframe: string;
  icon: typeof Brain;
}

const PredictionDashboard = ({ onClose }: { onClose: () => void }) => {
  const { user } = useAuth();
  const [rankHistory, setRankHistory] = useState<RankPoint[]>([]);
  const [forecasts, setForecasts] = useState<MemoryForecast[]>([]);
  const [strategies, setStrategies] = useState<StrategyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"rank" | "memory" | "strategy">("rank");

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [rankRes, topicsRes, subjectsRes, twinRes] = await Promise.all([
        supabase.from("rank_predictions")
          .select("predicted_rank, percentile, recorded_at")
          .eq("user_id", user.id)
          .gte("recorded_at", thirtyDaysAgo)
          .order("recorded_at", { ascending: true }),
        supabase.from("topics")
          .select("id, name, memory_strength, next_predicted_drop_date, subject_id")
          .eq("user_id", user.id)
          .is("deleted_at", null)
          .order("memory_strength", { ascending: true }),
        supabase.from("subjects")
          .select("id, name")
          .eq("user_id", user.id)
          .is("deleted_at", null),
        supabase.from("cognitive_twins")
          .select("avg_decay_rate, optimal_study_hour, optimal_session_duration")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      // Rank history
      const ranks: RankPoint[] = (rankRes.data || []).map(r => ({
        date: format(new Date(r.recorded_at), "MMM d"),
        rank: r.predicted_rank,
        percentile: r.percentile || 0,
      }));
      setRankHistory(ranks);

      // Memory forecasts
      const subjectMap = new Map((subjectsRes.data || []).map(s => [s.id, s.name]));
      const now = new Date();
      const memForecasts: MemoryForecast[] = (topicsRes.data || []).map(t => {
        const dropDate = t.next_predicted_drop_date;
        const daysUntilDrop = dropDate ? differenceInDays(new Date(dropDate), now) : null;
        const strength = Number(t.memory_strength);
        const decayRate = strength > 80 ? 2 : strength > 60 ? 5 : strength > 40 ? 8 : 12;

        return {
          id: t.id,
          name: t.name,
          currentStrength: strength,
          predictedDropDate: dropDate,
          daysUntilDrop,
          decayRate,
          subjectName: subjectMap.get(t.subject_id) || "Unknown",
        };
      });
      setForecasts(memForecasts);

      // Build strategies from data
      const strats: StrategyItem[] = [];
      const atRisk = memForecasts.filter(f => f.daysUntilDrop !== null && f.daysUntilDrop <= 2);
      const weak = memForecasts.filter(f => f.currentStrength < 40);
      const twin = twinRes.data;

      if (atRisk.length > 0) {
        strats.push({
          label: "Urgent Review",
          description: `${atRisk.length} topic${atRisk.length > 1 ? "s" : ""} about to decay — review ${atRisk.slice(0, 3).map(t => t.name).join(", ")} immediately`,
          impact: "high",
          timeframe: "Today",
          icon: AlertTriangle,
        });
      }

      if (weak.length > 0) {
        strats.push({
          label: "Strengthen Foundations",
          description: `${weak.length} weak topic${weak.length > 1 ? "s" : ""} below 40% — intensive revision sessions recommended`,
          impact: "high",
          timeframe: "This week",
          icon: Shield,
        });
      }

      if (twin) {
        if (twin.optimal_study_hour !== null) {
          const hour = twin.optimal_study_hour;
          const period = hour >= 12 ? "PM" : "AM";
          const displayHour = hour > 12 ? hour - 12 : hour === 0 ? 12 : hour;
          strats.push({
            label: "Optimal Study Window",
            description: `Your brain performs best around ${displayHour}:00 ${period} — schedule critical topics here`,
            impact: "medium",
            timeframe: "Daily",
            icon: Clock,
          });
        }
        if (twin.optimal_session_duration) {
          strats.push({
            label: "Session Length",
            description: `Aim for ${twin.optimal_session_duration}-minute sessions for peak retention based on your patterns`,
            impact: "medium",
            timeframe: "Each session",
            icon: Zap,
          });
        }
      }

      if (ranks.length >= 2) {
        const latest = ranks[ranks.length - 1].rank;
        const prev = ranks[Math.max(0, ranks.length - 3)].rank;
        if (latest < prev) {
          strats.push({
            label: "Rank Momentum",
            description: `You've climbed ${(prev - latest).toLocaleString()} positions — maintain this trajectory with consistent daily sessions`,
            impact: "medium",
            timeframe: "Next 2 weeks",
            icon: TrendingUp,
          });
        } else if (latest > prev) {
          strats.push({
            label: "Rank Recovery",
            description: `Your rank dropped ${(latest - prev).toLocaleString()} positions — increase study volume and focus on weak topics`,
            impact: "high",
            timeframe: "Next 7 days",
            icon: TrendingDown,
          });
        }
      }

      if (strats.length === 0) {
        strats.push({
          label: "Keep Going",
          description: "You're on a solid path — continue your current study routine for steady improvement",
          impact: "low",
          timeframe: "Ongoing",
          icon: Sparkles,
        });
      }

      setStrategies(strats);
    } catch (e) {
      console.error("PredictionDashboard load error:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { loadData(); }, [loadData]);

  const impactColor = (impact: string) =>
    impact === "high" ? "text-destructive" : impact === "medium" ? "text-warning" : "text-success";
  const impactBg = (impact: string) =>
    impact === "high" ? "bg-destructive/10" : impact === "medium" ? "bg-warning/10" : "bg-success/10";

  // Generate 14-day memory forecast chart data
  const forecastChartData = (() => {
    if (forecasts.length === 0) return [];
    const now = new Date();
    const points = [];
    for (let d = 0; d <= 14; d++) {
      const date = addDays(now, d);
      const avgStrength = forecasts.reduce((sum, f) => {
        const projected = Math.max(0, f.currentStrength - f.decayRate * d);
        return sum + projected;
      }, 0) / forecasts.length;
      points.push({
        day: d === 0 ? "Now" : `+${d}d`,
        strength: Math.round(avgStrength),
      });
    }
    return points;
  })();

  const sections = [
    { key: "rank" as const, label: "Rank Projections", icon: TrendingUp },
    { key: "memory" as const, label: "Memory Forecast", icon: Brain },
    { key: "strategy" as const, label: "Optimal Strategy", icon: Target },
  ];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-end sm:items-center justify-center">
      <motion.div
        initial={{ y: "100%", opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: "100%", opacity: 0 }}
        transition={{ type: "spring", damping: 25, stiffness: 300 }}
        className="w-full max-w-lg max-h-[92vh] overflow-y-auto glass rounded-t-2xl sm:rounded-2xl neural-border"
      >
        {/* Header */}
        <div className="sticky top-0 z-10 bg-background/90 backdrop-blur-md px-5 pt-5 pb-3 border-b border-border/50">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-primary/10">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-foreground">Prediction Dashboard</h2>
                <p className="text-[10px] text-muted-foreground">AI-powered forecasts & strategy</p>
              </div>
            </div>
            <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors">
              Close
            </button>
          </div>

          {/* Tab selector */}
          <div className="flex gap-1 bg-secondary/30 rounded-lg p-1">
            {sections.map(s => (
              <button
                key={s.key}
                onClick={() => setActiveSection(s.key)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${
                  activeSection === s.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <s.icon className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{s.label}</span>
                <span className="sm:hidden">{s.label.split(" ")[0]}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-5 space-y-5">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {/* === RANK PROJECTIONS === */}
              {activeSection === "rank" && (
                <motion.div
                  key="rank"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {rankHistory.length > 1 ? (
                    <>
                      <div className="glass rounded-xl p-4 neural-border">
                        <div className="flex items-center justify-between mb-1">
                          <p className="text-xs font-semibold text-foreground">30-Day Rank Trajectory</p>
                          <span className="text-[10px] text-muted-foreground">{rankHistory.length} data points</span>
                        </div>
                        <div className="h-48 mt-2">
                          <ResponsiveContainer width="100%" height="100%">
                            <LineChart data={rankHistory}>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="date" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis reversed tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={45} />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--popover))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  color: "hsl(var(--foreground))",
                                }}
                                formatter={(value: number) => [`#${value.toLocaleString()}`, "Rank"]}
                              />
                              <Line
                                type="monotone"
                                dataKey="rank"
                                stroke="hsl(var(--primary))"
                                strokeWidth={2}
                                dot={{ r: 3, fill: "hsl(var(--primary))" }}
                                activeDot={{ r: 5, fill: "hsl(var(--primary))" }}
                              />
                            </LineChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Key metrics */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          {
                            label: "Current Rank",
                            value: `#${rankHistory[rankHistory.length - 1].rank.toLocaleString()}`,
                            sub: `Top ${(100 - rankHistory[rankHistory.length - 1].percentile).toFixed(1)}%`,
                          },
                          {
                            label: "Best Rank",
                            value: `#${Math.min(...rankHistory.map(r => r.rank)).toLocaleString()}`,
                            sub: "30-day best",
                          },
                          {
                            label: "Trend",
                            value: rankHistory[rankHistory.length - 1].rank < rankHistory[0].rank ? "↑ Rising" : rankHistory[rankHistory.length - 1].rank > rankHistory[0].rank ? "↓ Falling" : "→ Stable",
                            sub: `${Math.abs(rankHistory[rankHistory.length - 1].rank - rankHistory[0].rank).toLocaleString()} pos`,
                          },
                        ].map((m, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.1 + i * 0.05 }}
                            className="glass rounded-xl p-3 neural-border text-center"
                          >
                            <p className="text-[10px] text-muted-foreground">{m.label}</p>
                            <p className="text-sm font-bold text-foreground mt-1">{m.value}</p>
                            <p className="text-[9px] text-muted-foreground">{m.sub}</p>
                          </motion.div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="glass rounded-xl p-8 neural-border text-center">
                      <TrendingUp className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-foreground font-medium">Not enough rank data yet</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Keep studying to generate rank projections over time</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* === MEMORY FORECAST === */}
              {activeSection === "memory" && (
                <motion.div
                  key="memory"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {forecastChartData.length > 0 ? (
                    <>
                      <div className="glass rounded-xl p-4 neural-border">
                        <p className="text-xs font-semibold text-foreground mb-1">14-Day Memory Forecast</p>
                        <p className="text-[10px] text-muted-foreground mb-3">Projected average retention across all topics</p>
                        <div className="h-44">
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={forecastChartData}>
                              <defs>
                                <linearGradient id="memGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="day" tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={30} />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--popover))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  color: "hsl(var(--foreground))",
                                }}
                                formatter={(value: number) => [`${value}%`, "Avg Retention"]}
                              />
                              <Area type="monotone" dataKey="strength" stroke="hsl(var(--primary))" fill="url(#memGrad)" strokeWidth={2} />
                            </AreaChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* At-risk topics */}
                      <div>
                        <p className="text-xs font-semibold text-foreground mb-2 flex items-center gap-1.5">
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                          Topics Forecast to Decay
                        </p>
                        <div className="space-y-2">
                          {forecasts
                            .filter(f => f.daysUntilDrop !== null && f.daysUntilDrop <= 7)
                            .slice(0, 8)
                            .map((f, i) => {
                              const urgency = f.daysUntilDrop !== null && f.daysUntilDrop <= 0
                                ? "destructive"
                                : f.daysUntilDrop !== null && f.daysUntilDrop <= 2
                                ? "warning"
                                : "muted-foreground";

                              return (
                                <motion.div
                                  key={f.id}
                                  initial={{ opacity: 0, x: -10 }}
                                  animate={{ opacity: 1, x: 0 }}
                                  transition={{ delay: i * 0.04 }}
                                  className="glass rounded-lg p-3 neural-border flex items-center gap-3"
                                >
                                  <div className={`w-9 h-9 rounded-lg bg-${urgency}/10 flex items-center justify-center shrink-0`}>
                                    <span className={`text-xs font-bold text-${urgency}`}>{f.currentStrength}%</span>
                                  </div>
                                  <div className="flex-1 min-w-0">
                                    <p className="text-xs font-medium text-foreground truncate">{f.name}</p>
                                    <p className="text-[10px] text-muted-foreground">{f.subjectName}</p>
                                  </div>
                                  <div className="text-right shrink-0">
                                    <p className={`text-[10px] font-semibold text-${urgency}`}>
                                      {f.daysUntilDrop !== null && f.daysUntilDrop <= 0
                                        ? "Overdue"
                                        : `${f.daysUntilDrop}d left`}
                                    </p>
                                    <p className="text-[9px] text-muted-foreground">-{f.decayRate}%/day</p>
                                  </div>
                                </motion.div>
                              );
                            })}
                          {forecasts.filter(f => f.daysUntilDrop !== null && f.daysUntilDrop <= 7).length === 0 && (
                            <div className="text-center py-4">
                              <Shield className="w-6 h-6 text-success/40 mx-auto mb-2" />
                              <p className="text-xs text-muted-foreground">No topics at immediate risk — great retention!</p>
                            </div>
                          )}
                        </div>
                      </div>
                    </>
                  ) : (
                    <div className="glass rounded-xl p-8 neural-border text-center">
                      <Brain className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-foreground font-medium">No topics to forecast</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Add topics to see memory decay predictions</p>
                    </div>
                  )}
                </motion.div>
              )}

              {/* === OPTIMAL STRATEGY === */}
              {activeSection === "strategy" && (
                <motion.div
                  key="strategy"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-3"
                >
                  <p className="text-xs text-muted-foreground">AI-generated strategies based on your data patterns</p>
                  {strategies.map((s, i) => (
                    <motion.div
                      key={i}
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="glass rounded-xl p-4 neural-border"
                    >
                      <div className="flex items-start gap-3">
                        <div className={`p-2 rounded-lg ${impactBg(s.impact)} shrink-0`}>
                          <s.icon className={`w-4 h-4 ${impactColor(s.impact)}`} />
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold text-foreground">{s.label}</p>
                            <span className={`text-[9px] font-medium px-2 py-0.5 rounded-full ${impactBg(s.impact)} ${impactColor(s.impact)}`}>
                              {s.impact} impact
                            </span>
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{s.description}</p>
                          <div className="flex items-center gap-1 mt-2">
                            <Calendar className="w-3 h-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">{s.timeframe}</span>
                          </div>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </div>
  );
};

export default PredictionDashboard;
