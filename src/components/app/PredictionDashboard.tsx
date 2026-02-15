import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  TrendingUp, TrendingDown, Brain, Target, Calendar, ChevronDown,
  BarChart3, Clock, Zap, Shield, AlertTriangle, ArrowUpRight, Sparkles, Globe, Users, Share2, Download, Check, Copy, Layers, SlidersHorizontal, Info,
} from "lucide-react";
import { useHybridPrediction, HybridTopicPrediction } from "@/hooks/useHybridPrediction";
import { Slider } from "@/components/ui/slider";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { BarChart, Bar } from "recharts";
import { LineChart, Line, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, addDays, differenceInDays, isPast } from "date-fns";
import html2canvas from "html2canvas";
import { toast } from "@/hooks/use-toast";

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

interface ComparisonMetric {
  label: string;
  userValue: number;
  globalValue: number;
  unit: string;
  higherIsBetter: boolean;
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
  const [comparisons, setComparisons] = useState<ComparisonMetric[]>([]);
  const [globalSampleSize, setGlobalSampleSize] = useState(0);
  const [loading, setLoading] = useState(true);
  const [activeSection, setActiveSection] = useState<"rank" | "memory" | "strategy" | "global" | "hybrid" | "share">("rank");
  const { data: hybridData, loading: hybridLoading, predict: fetchHybrid } = useHybridPrediction();
  const [customPersonalWeight, setCustomPersonalWeight] = useState<number | null>(null);

  // Derive adjusted predictions based on slider
  const activePersonalWeight = customPersonalWeight ?? (hybridData?.personal_weight ?? 0.7);
  const activeGlobalWeight = 1 - activePersonalWeight;

  const adjustedTopics = useMemo(() => {
    if (!hybridData?.topic_predictions) return [];
    return hybridData.topic_predictions.map(t => {
      const adjusted = t.personal_strength * activePersonalWeight + t.global_avg_strength * activeGlobalWeight;
      return { ...t, hybrid_strength: adjusted };
    });
  }, [hybridData, activePersonalWeight, activeGlobalWeight]);

  const adjustedHealth = useMemo(() => {
    if (adjustedTopics.length === 0) return hybridData?.hybrid_health ?? 0;
    return adjustedTopics.reduce((s, t) => s + t.hybrid_strength, 0) / adjustedTopics.length;
  }, [adjustedTopics, hybridData]);
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);
  const [copied, setCopied] = useState(false);
  const shareCardRef = useRef<HTMLDivElement>(null);

  const loadData = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString();

      const [rankRes, topicsRes, subjectsRes, twinRes, globalRes, featuresRes] = await Promise.all([
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
          .select("avg_decay_rate, optimal_study_hour, optimal_session_duration, cognitive_capacity_score, learning_efficiency_score")
          .eq("user_id", user.id)
          .maybeSingle(),
        supabase.from("global_learning_patterns")
          .select("pattern_type, pattern_key, metrics, sample_size")
          .order("pattern_date", { ascending: false })
          .limit(100),
        supabase.from("user_features")
          .select("study_consistency_score, recall_success_rate, avg_session_duration_minutes, knowledge_stability")
          .eq("user_id", user.id)
          .order("computed_at", { ascending: false })
          .limit(1)
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

      // Build global comparison metrics
      const gPatterns = globalRes.data || [];
      const maxSample = Math.max(...gPatterns.map(p => p.sample_size || 0), 0);
      setGlobalSampleSize(maxSample);

      const getGlobalMetric = (type: string, key: string): number | null => {
        const p = gPatterns.find(g => g.pattern_type === type && g.pattern_key === key);
        if (!p || !p.metrics) return null;
        const m = p.metrics as Record<string, any>;
        return m.avg ?? m.mean ?? m.value ?? null;
      };

      const userFeats = featuresRes.data;
      const compMetrics: ComparisonMetric[] = [];

      // Average retention
      const avgRetention = memForecasts.length > 0
        ? memForecasts.reduce((s, f) => s + f.currentStrength, 0) / memForecasts.length
        : null;
      const globalRetention = getGlobalMetric("cognitive_benchmark", "knowledge_stability");
      if (avgRetention !== null) {
        compMetrics.push({
          label: "Avg Retention",
          userValue: Math.round(avgRetention),
          globalValue: globalRetention !== null ? Math.round(globalRetention * 100) : 62,
          unit: "%",
          higherIsBetter: true,
        });
      }

      // Study consistency
      if (userFeats?.study_consistency_score != null) {
        const globalConsistency = getGlobalMetric("cognitive_benchmark", "study_consistency");
        compMetrics.push({
          label: "Consistency",
          userValue: Math.round(Number(userFeats.study_consistency_score) * 100),
          globalValue: globalConsistency !== null ? Math.round(globalConsistency * 100) : 55,
          unit: "%",
          higherIsBetter: true,
        });
      }

      // Session duration
      if (userFeats?.avg_session_duration_minutes != null) {
        const globalSession = getGlobalMetric("study_timing", "avg_session_duration");
        compMetrics.push({
          label: "Session Length",
          userValue: Math.round(Number(userFeats.avg_session_duration_minutes)),
          globalValue: globalSession !== null ? Math.round(globalSession) : 25,
          unit: "min",
          higherIsBetter: true,
        });
      }

      // Recall rate
      if (userFeats?.recall_success_rate != null) {
        const globalRecall = getGlobalMetric("cognitive_benchmark", "recall_success_rate");
        compMetrics.push({
          label: "Recall Rate",
          userValue: Math.round(Number(userFeats.recall_success_rate) * 100),
          globalValue: globalRecall !== null ? Math.round(globalRecall * 100) : 58,
          unit: "%",
          higherIsBetter: true,
        });
      }

      // Cognitive capacity from twin
      if (twin?.cognitive_capacity_score != null) {
        compMetrics.push({
          label: "Cognitive Score",
          userValue: Math.round(Number(twin.cognitive_capacity_score)),
          globalValue: 50,
          unit: "",
          higherIsBetter: true,
        });
      }

      // Learning efficiency from twin
      if (twin?.learning_efficiency_score != null) {
        compMetrics.push({
          label: "Learn Efficiency",
          userValue: Math.round(Number(twin.learning_efficiency_score)),
          globalValue: 45,
          unit: "",
          higherIsBetter: true,
        });
      }

      setComparisons(compMetrics);
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

  const generateCanvas = useCallback(async () => {
    if (!shareCardRef.current) return null;
    return html2canvas(shareCardRef.current, { backgroundColor: null, scale: 2, useCORS: true });
  }, []);

  const exportAsImage = useCallback(async () => {
    if (!shareCardRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;
      const link = document.createElement("a");
      link.download = `prediction-summary-${format(new Date(), "yyyy-MM-dd")}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
      setExported(true);
      setTimeout(() => setExported(false), 2000);
    } catch (e) {
      console.error("Export error:", e);
    } finally {
      setExporting(false);
    }
  }, [exporting, generateCanvas]);

  const shareCard = useCallback(async () => {
    if (!shareCardRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) return;
        const file = new File([blob], `prediction-summary-${format(new Date(), "yyyy-MM-dd")}.png`, { type: "image/png" });
        if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({
            title: "My Learning Predictions",
            text: "Check out my AI-powered learning prediction summary!",
            files: [file],
          });
          setExported(true);
          setTimeout(() => setExported(false), 2000);
        } else {
          // Fallback: download
          const link = document.createElement("a");
          link.download = file.name;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
          setExported(true);
          setTimeout(() => setExported(false), 2000);
        }
        setExporting(false);
      }, "image/png");
    } catch (e) {
      console.error("Share error:", e);
      setExporting(false);
    }
  }, [exporting, generateCanvas]);

  const copyToClipboard = useCallback(async () => {
    if (!shareCardRef.current || exporting) return;
    setExporting(true);
    try {
      const canvas = await generateCanvas();
      if (!canvas) return;
      canvas.toBlob(async (blob) => {
        if (!blob) { setExporting(false); return; }
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ "image/png": blob }),
          ]);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
          toast({ title: "📋 Copied to clipboard", description: "Paste it into any chat or document." });
        } catch {
          toast({ title: "❌ Copy failed", description: "Your browser doesn't support image clipboard. Downloading instead.", variant: "destructive" });
          const link = document.createElement("a");
          link.download = `prediction-summary-${format(new Date(), "yyyy-MM-dd")}.png`;
          link.href = URL.createObjectURL(blob);
          link.click();
          URL.revokeObjectURL(link.href);
        }
        setExporting(false);
      }, "image/png");
    } catch (e) {
      console.error("Copy error:", e);
      setExporting(false);
    }
  }, [exporting, generateCanvas]);

  const canShare = typeof navigator !== "undefined" && !!navigator.share;

  const sections = [
    { key: "rank" as const, label: "Rank", icon: TrendingUp },
    { key: "memory" as const, label: "Memory", icon: Brain },
    { key: "hybrid" as const, label: "Hybrid", icon: Layers },
    { key: "global" as const, label: "Global", icon: Globe },
    { key: "strategy" as const, label: "Strategy", icon: Target },
    { key: "share" as const, label: "Share", icon: Share2 },
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

              {/* === HYBRID PREDICTION COMPARISON === */}
              {activeSection === "hybrid" && (
                <motion.div
                  key="hybrid"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Fetch button */}
                  {!hybridData && !hybridLoading && (
                    <div className="glass rounded-xl p-6 neural-border text-center">
                      <Layers className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-foreground font-medium mb-2">Hybrid Prediction Engine</p>
                      <p className="text-[10px] text-muted-foreground mb-4">Compare your personal predictions with global patterns and the AI-merged hybrid score</p>
                      <button
                        onClick={fetchHybrid}
                        className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:bg-primary/90 transition-colors"
                      >
                        Generate Hybrid Predictions
                      </button>
                    </div>
                  )}

                  {hybridLoading && (
                    <div className="flex items-center justify-center py-16">
                      <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}

                  {hybridData && (
                    <>
                      {/* Weight slider */}
                      <div className="glass rounded-xl p-4 neural-border space-y-3">
                        <div className="flex items-center gap-2 mb-1">
                          <SlidersHorizontal className="w-3.5 h-3.5 text-primary" />
                          <p className="text-xs font-semibold text-foreground">Adjust Weight Balance</p>
                          <Popover>
                            <PopoverTrigger asChild>
                              <button className="p-0.5 rounded-full hover:bg-secondary/50 transition-colors">
                                <Info className="w-3.5 h-3.5 text-muted-foreground" />
                              </button>
                            </PopoverTrigger>
                            <PopoverContent side="top" align="start" className="w-72 text-xs space-y-2">
                              <p className="font-semibold text-foreground">Why this weight ratio?</p>
                              <p className="text-muted-foreground leading-relaxed">
                                The AI set <span className="text-primary font-medium">{Math.round((hybridData.personal_weight ?? 0.7) * 100)}% personal</span> / <span className="text-accent-foreground font-medium">{Math.round((hybridData.global_weight ?? 0.3) * 100)}% global</span> based on:
                              </p>
                              <ul className="space-y-1.5 text-muted-foreground">
                                <li className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span><span className="text-foreground font-medium">Data maturity:</span> {hybridData.data_maturity_points ?? 0} points — {(hybridData.data_maturity_points ?? 0) >= 50 ? "strong personal history, so your data is weighted higher" : "limited personal data, so global patterns help fill gaps"}</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span><span className="text-foreground font-medium">Cognitive cluster:</span> {hybridData.embedding_cluster ? `"${hybridData.embedding_cluster.replace(/_/g, " ")}"` : "not yet classified"} — the model tunes weights for your learning archetype</span>
                                </li>
                                <li className="flex items-start gap-1.5">
                                  <span className="text-primary mt-0.5">•</span>
                                  <span>More study sessions and reviews increase data maturity, shifting weight toward your personal model</span>
                                </li>
                              </ul>
                            </PopoverContent>
                          </Popover>
                        </div>
                        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                          <span>Global-heavy</span>
                          <span>Personal-heavy</span>
                        </div>
                        <Slider
                          value={[activePersonalWeight * 100]}
                          onValueChange={([v]) => setCustomPersonalWeight(v / 100)}
                          min={10}
                          max={95}
                          step={5}
                          className="w-full"
                        />
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] text-muted-foreground">Personal: <span className="text-primary font-bold">{Math.round(activePersonalWeight * 100)}%</span></span>
                          <span className="text-[10px] text-muted-foreground">Global: <span className="text-accent-foreground font-bold">{Math.round(activeGlobalWeight * 100)}%</span></span>
                        </div>
                        {customPersonalWeight !== null && (() => {
                          const aiWeight = hybridData.personal_weight ?? 0.7;
                          const deviation = Math.round(Math.abs(customPersonalWeight - aiWeight) * 100);
                          const deviationLabel = deviation === 0 ? "At AI optimal" : `${deviation}pp from AI optimal`;
                          const deviationColor = deviation === 0 ? "bg-success/15 text-success" : deviation <= 15 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive";
                          const healthDiff = Math.round(adjustedHealth - (hybridData.hybrid_health ?? 0));
                          const healthLabel = healthDiff === 0 ? "No change" : healthDiff > 0 ? `+${healthDiff}% health` : `${healthDiff}% health`;
                          const healthColor = healthDiff >= 0 ? "text-success" : "text-destructive";

                          return (
                            <div className="space-y-2">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold ${deviationColor}`}>
                                  <AlertTriangle className="w-2.5 h-2.5" />
                                  {deviationLabel}
                                </span>
                                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-secondary/50 ${healthColor}`}>
                                  {healthLabel}
                                </span>
                              </div>
                              <button
                                onClick={() => setCustomPersonalWeight(null)}
                                className="text-[10px] text-primary hover:underline"
                              >
                                Reset to AI-recommended ({Math.round(aiWeight * 100)}% / {Math.round((1 - aiWeight) * 100)}%)
                              </button>
                            </div>
                          );
                        })()}
                      </div>

                      {/* Summary cards */}
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { label: "Personal Weight", value: `${Math.round(activePersonalWeight * 100)}%`, color: "text-primary" },
                          { label: "Global Weight", value: `${Math.round(activeGlobalWeight * 100)}%`, color: "text-accent-foreground" },
                          { label: "Hybrid Health", value: `${Math.round(adjustedHealth)}%`, color: "text-foreground" },
                        ].map((m, i) => (
                          <motion.div
                            key={i}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: i * 0.05 }}
                            className="glass rounded-xl p-3 neural-border text-center"
                          >
                            <p className="text-[10px] text-muted-foreground">{m.label}</p>
                            <p className={`text-sm font-bold mt-1 ${m.color}`}>{m.value}</p>
                          </motion.div>
                        ))}
                      </div>

                      {/* Per-topic bar chart */}
                      {adjustedTopics.length > 0 ? (
                        <>
                          <div className="glass rounded-xl p-4 neural-border">
                            <p className="text-xs font-semibold text-foreground mb-1">Topic-Level Comparison</p>
                            <p className="text-[10px] text-muted-foreground mb-3">Personal vs Global vs Hybrid strength</p>
                            <div className="h-56">
                              <ResponsiveContainer width="100%" height="100%">
                                <BarChart
                                  data={adjustedTopics.slice(0, 10).map(t => ({
                                    name: t.topic_name.length > 12 ? t.topic_name.slice(0, 12) + "…" : t.topic_name,
                                    personal: Math.round(t.personal_strength),
                                    global: Math.round(t.global_avg_strength),
                                    hybrid: Math.round(t.hybrid_strength),
                                  }))}
                                  layout="vertical"
                                  margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
                                >
                                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                                  <XAxis type="number" domain={[0, 100]} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                  <YAxis dataKey="name" type="category" width={80} tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} />
                                  <Tooltip
                                    contentStyle={{
                                      background: "hsl(var(--popover))",
                                      border: "1px solid hsl(var(--border))",
                                      borderRadius: "8px",
                                      fontSize: "11px",
                                      color: "hsl(var(--foreground))",
                                    }}
                                    formatter={(value: number, name: string) => [`${value}%`, name.charAt(0).toUpperCase() + name.slice(1)]}
                                  />
                                  <Bar dataKey="personal" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} barSize={6} />
                                  <Bar dataKey="global" fill="hsl(var(--muted-foreground))" radius={[0, 4, 4, 0]} barSize={6} />
                                  <Bar dataKey="hybrid" fill="hsl(var(--accent-foreground))" radius={[0, 4, 4, 0]} barSize={6} />
                                </BarChart>
                              </ResponsiveContainer>
                            </div>
                            {/* Legend */}
                            <div className="flex items-center justify-center gap-4 mt-3">
                              {[
                                { label: "Personal", color: "bg-primary" },
                                { label: "Global", color: "bg-muted-foreground" },
                                { label: "Hybrid", color: "bg-accent-foreground" },
                              ].map(l => (
                                <div key={l.label} className="flex items-center gap-1.5">
                                  <div className={`w-2.5 h-2.5 rounded-sm ${l.color}`} />
                                  <span className="text-[10px] text-muted-foreground">{l.label}</span>
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Topic detail cards */}
                          <div>
                            <p className="text-xs font-semibold text-foreground mb-2">Per-Topic Breakdown</p>
                            <div className="space-y-2">
                              {adjustedTopics.slice(0, 8).map((t, i) => {
                                const riskColor = t.risk_level === "critical" ? "text-destructive" : t.risk_level === "high" ? "text-warning" : t.risk_level === "medium" ? "text-muted-foreground" : "text-success";
                                return (
                                  <motion.div
                                    key={t.topic_id}
                                    initial={{ opacity: 0, x: -10 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: i * 0.03 }}
                                    className="glass rounded-lg p-3 neural-border"
                                  >
                                    <div className="flex items-center justify-between mb-2">
                                      <p className="text-xs font-medium text-foreground truncate max-w-[60%]">{t.topic_name}</p>
                                      <span className={`text-[10px] font-semibold ${riskColor} capitalize`}>{t.risk_level}</span>
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                      <div className="text-center">
                                        <p className="text-[9px] text-muted-foreground">Personal</p>
                                        <p className="text-xs font-bold text-primary">{Math.round(t.personal_strength)}%</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[9px] text-muted-foreground">Global</p>
                                        <p className="text-xs font-bold text-muted-foreground">{Math.round(t.global_avg_strength)}%</p>
                                      </div>
                                      <div className="text-center">
                                        <p className="text-[9px] text-muted-foreground">Hybrid</p>
                                        <p className="text-xs font-bold text-foreground">{Math.round(t.hybrid_strength)}%</p>
                                      </div>
                                    </div>
                                    {t.global_corroborated && (
                                      <p className="text-[9px] text-primary/70 mt-1.5 flex items-center gap-1">
                                        <Globe className="w-2.5 h-2.5" /> Global-corroborated prediction
                                      </p>
                                    )}
                                  </motion.div>
                                );
                              })}
                            </div>
                          </div>
                        </>
                      ) : (
                        <div className="glass rounded-xl p-6 neural-border text-center">
                          <Brain className="w-6 h-6 text-muted-foreground/40 mx-auto mb-2" />
                          <p className="text-xs text-muted-foreground">No topic predictions available yet</p>
                        </div>
                      )}
                    </>
                  )}
                </motion.div>
              )}

              {/* === GLOBAL COMPARISON === */}
              {activeSection === "global" && (
                <motion.div
                  key="global"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  {/* Header badge */}
                  <div className="flex items-center gap-2 rounded-lg bg-accent/10 border border-accent/20 px-3 py-2">
                    <div className="p-1.5 rounded-md bg-primary/10 shrink-0">
                      <Users className="w-3.5 h-3.5 text-primary" />
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      Compared against <span className="text-foreground font-semibold">{globalSampleSize > 0 ? `${globalSampleSize.toLocaleString()}+` : "community"}</span> learners
                    </p>
                  </div>

                  {comparisons.length > 0 ? (
                    <>
                      {/* Bar comparison chart */}
                      <div className="glass rounded-xl p-4 neural-border">
                        <p className="text-xs font-semibold text-foreground mb-3">You vs Global Average</p>
                        <div className="h-52">
                          <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                              data={comparisons.map(c => ({
                                name: c.label,
                                You: c.userValue,
                                Global: c.globalValue,
                              }))}
                              barGap={2}
                              barCategoryGap="20%"
                            >
                              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                              <XAxis dataKey="name" tick={{ fontSize: 8, fill: "hsl(var(--muted-foreground))" }} />
                              <YAxis tick={{ fontSize: 9, fill: "hsl(var(--muted-foreground))" }} width={30} />
                              <Tooltip
                                contentStyle={{
                                  background: "hsl(var(--popover))",
                                  border: "1px solid hsl(var(--border))",
                                  borderRadius: "8px",
                                  fontSize: "11px",
                                  color: "hsl(var(--foreground))",
                                }}
                              />
                              <Bar dataKey="You" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                              <Bar dataKey="Global" fill="hsl(var(--muted-foreground))" opacity={0.4} radius={[4, 4, 0, 0]} />
                            </BarChart>
                          </ResponsiveContainer>
                        </div>
                      </div>

                      {/* Detailed metric cards */}
                      <div className="space-y-2">
                        {comparisons.map((c, i) => {
                          const diff = c.userValue - c.globalValue;
                          const isAhead = c.higherIsBetter ? diff > 0 : diff < 0;
                          const absDiff = Math.abs(diff);

                          return (
                            <motion.div
                              key={c.label}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="glass rounded-lg p-3 neural-border flex items-center gap-3"
                            >
                              <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${isAhead ? "bg-success/10" : "bg-destructive/10"}`}>
                                {isAhead
                                  ? <TrendingUp className="w-4 h-4 text-success" />
                                  : <TrendingDown className="w-4 h-4 text-destructive" />
                                }
                              </div>
                              <div className="flex-1 min-w-0">
                                <p className="text-xs font-medium text-foreground">{c.label}</p>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <span className="text-[10px] font-semibold text-foreground">{c.userValue}{c.unit}</span>
                                  <span className="text-[9px] text-muted-foreground">vs {c.globalValue}{c.unit} avg</span>
                                </div>
                              </div>
                              <div className="text-right shrink-0">
                                <p className={`text-[10px] font-bold ${isAhead ? "text-success" : "text-destructive"}`}>
                                  {isAhead ? "+" : "-"}{absDiff}{c.unit}
                                </p>
                                <p className={`text-[9px] ${isAhead ? "text-success" : "text-destructive"}`}>
                                  {isAhead ? "Above avg" : "Below avg"}
                                </p>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </>
                  ) : (
                    <div className="glass rounded-xl p-8 neural-border text-center">
                      <Globe className="w-8 h-8 text-muted-foreground/40 mx-auto mb-3" />
                      <p className="text-sm text-foreground font-medium">Not enough data yet</p>
                      <p className="text-[10px] text-muted-foreground mt-1">Study more to generate comparison metrics against the community</p>
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

              {/* === SHAREABLE CARD === */}
              {activeSection === "share" && (
                <motion.div
                  key="share"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <p className="text-xs text-muted-foreground">Preview your shareable summary card, then export as an image.</p>

                  {/* The card to export */}
                  <div
                    ref={shareCardRef}
                    className="rounded-2xl p-5 space-y-4"
                    style={{
                      background: "linear-gradient(145deg, hsl(var(--background)), hsl(var(--card)))",
                      border: "1px solid hsl(var(--border))",
                    }}
                  >
                    {/* Card header */}
                    <div className="flex items-center gap-3">
                      <div className="p-2.5 rounded-xl bg-primary/15">
                        <BarChart3 className="w-5 h-5 text-primary" />
                      </div>
                      <div>
                        <h3 className="text-sm font-bold text-foreground">My Learning Predictions</h3>
                        <p className="text-[10px] text-muted-foreground">{format(new Date(), "MMMM d, yyyy")}</p>
                      </div>
                    </div>

                    {/* Rank summary */}
                    {rankHistory.length > 0 && (
                      <div className="rounded-xl p-4" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
                        <p className="text-[10px] font-medium text-muted-foreground mb-2">RANK TRAJECTORY</p>
                        <div className="flex items-end gap-3">
                          <span className="text-3xl font-bold text-foreground">
                            #{rankHistory[rankHistory.length - 1].rank.toLocaleString()}
                          </span>
                          {rankHistory.length >= 2 && (() => {
                            const change = rankHistory[0].rank - rankHistory[rankHistory.length - 1].rank;
                            return (
                              <span className={`text-xs font-semibold mb-1 flex items-center gap-0.5 ${change > 0 ? "text-success" : change < 0 ? "text-destructive" : "text-muted-foreground"}`}>
                                {change > 0 ? <TrendingUp className="w-3 h-3" /> : change < 0 ? <TrendingDown className="w-3 h-3" /> : null}
                                {change > 0 ? "+" : ""}{change.toLocaleString()} in 30d
                              </span>
                            );
                          })()}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1">
                          Top {rankHistory[rankHistory.length - 1].percentile ? (100 - rankHistory[rankHistory.length - 1].percentile).toFixed(1) : "—"}% percentile
                        </p>
                        {/* Mini sparkline */}
                        <div className="flex items-end gap-[2px] h-8 mt-3">
                          {rankHistory.slice(-14).map((r, i, arr) => {
                            const maxR = Math.max(...arr.map(a => a.rank));
                            const minR = Math.min(...arr.map(a => a.rank));
                            const range = maxR - minR || 1;
                            const height = ((maxR - r.rank) / range) * 100;
                            return (
                              <div
                                key={i}
                                className="flex-1 rounded-t-sm bg-primary/60"
                                style={{ height: `${Math.max(height, 8)}%` }}
                              />
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {/* Memory overview */}
                    {forecasts.length > 0 && (
                      <div className="rounded-xl p-4" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
                        <p className="text-[10px] font-medium text-muted-foreground mb-2">MEMORY OVERVIEW</p>
                        <div className="flex items-center gap-4">
                          <div>
                            <span className="text-2xl font-bold text-foreground">
                              {Math.round(forecasts.reduce((s, f) => s + f.currentStrength, 0) / forecasts.length)}%
                            </span>
                            <p className="text-[10px] text-muted-foreground">Avg retention</p>
                          </div>
                          <div>
                            <span className="text-2xl font-bold text-foreground">{forecasts.length}</span>
                            <p className="text-[10px] text-muted-foreground">Topics tracked</p>
                          </div>
                          <div>
                            <span className="text-2xl font-bold text-foreground">
                              {forecasts.filter(f => f.daysUntilDrop !== null && f.daysUntilDrop <= 3).length}
                            </span>
                            <p className="text-[10px] text-muted-foreground">At risk</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Global comparison bars */}
                    {comparisons.length > 0 && (
                      <div className="rounded-xl p-4" style={{ background: "hsl(var(--secondary) / 0.5)" }}>
                        <p className="text-[10px] font-medium text-muted-foreground mb-3">VS GLOBAL BENCHMARKS</p>
                        <div className="space-y-2.5">
                          {comparisons.slice(0, 4).map(c => {
                            const diff = c.userValue - c.globalValue;
                            const isAhead = c.higherIsBetter ? diff > 0 : diff < 0;
                            return (
                              <div key={c.label}>
                                <div className="flex justify-between mb-1">
                                  <span className="text-[10px] text-foreground font-medium">{c.label}</span>
                                  <span className={`text-[10px] font-bold ${isAhead ? "text-success" : "text-destructive"}`}>
                                    {c.userValue}{c.unit} {isAhead ? "▲" : "▼"}
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full" style={{ background: "hsl(var(--border))" }}>
                                  <div
                                    className={`h-full rounded-full transition-all ${isAhead ? "bg-success" : "bg-destructive"}`}
                                    style={{ width: `${Math.min((c.userValue / Math.max(c.globalValue * 1.5, 1)) * 100, 100)}%` }}
                                  />
                                </div>
                                <p className="text-[9px] text-muted-foreground mt-0.5">Global avg: {c.globalValue}{c.unit}</p>
                              </div>
                            );
                          })}
                        </div>
                        {globalSampleSize > 0 && (
                          <p className="text-[9px] text-muted-foreground mt-3 flex items-center gap-1">
                            <Users className="w-3 h-3" /> Based on {globalSampleSize.toLocaleString()}+ learners
                          </p>
                        )}
                      </div>
                    )}

                    {/* Branding */}
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-1.5">
                        <Brain className="w-3.5 h-3.5 text-primary" />
                        <span className="text-[10px] font-semibold text-foreground">AI Prediction Dashboard</span>
                      </div>
                      <span className="text-[9px] text-muted-foreground">{format(new Date(), "MMM d, yyyy · h:mm a")}</span>
                    </div>
                  </div>

                  {/* Action buttons */}
                  <div className="grid grid-cols-3 gap-3">
                    {canShare && (
                      <button
                        onClick={shareCard}
                        disabled={exporting}
                        className="flex items-center justify-center gap-2 py-3 rounded-xl bg-primary text-primary-foreground font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-50"
                      >
                        {exported ? (
                          <><Check className="w-4 h-4" /> Shared!</>
                        ) : exporting ? (
                          <><Share2 className="w-4 h-4 animate-pulse" /></>
                        ) : (
                          <><Share2 className="w-4 h-4" /> Share</>
                        )}
                      </button>
                    )}
                    <button
                      onClick={copyToClipboard}
                      disabled={exporting}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-accent text-accent-foreground font-medium text-sm hover:bg-accent/80 transition-colors disabled:opacity-50"
                    >
                      {copied ? (
                        <><Check className="w-4 h-4" /> Copied!</>
                      ) : (
                        <><Copy className="w-4 h-4" /> Copy</>
                      )}
                    </button>
                    <button
                      onClick={exportAsImage}
                      disabled={exporting}
                      className="flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-foreground font-medium text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50"
                    >
                      {exported ? (
                        <><Check className="w-4 h-4" /> Saved!</>
                      ) : exporting ? (
                        <><Download className="w-4 h-4 animate-bounce" /></>
                      ) : (
                        <><Download className="w-4 h-4" /> Save</>
                      )}
                    </button>
                  </div>
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
