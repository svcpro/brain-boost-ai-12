import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, TrendingUp, TrendingDown, Minus, Shield, Trophy, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, format, startOfDay } from "date-fns";
import { StreakData } from "@/hooks/useStudyStreak";

interface DayPoint {
  date: string;
  label: string;
  value: number;
}

interface MomentumSectionProps {
  streakData: StreakData | null;
  overallHealth: number;
  rankPredicted: number | null;
  rankPercentile: number | null;
  hasTopics: boolean;
  missionCompleted?: boolean;
}

const MomentumSection = ({
  streakData,
  overallHealth,
  rankPredicted,
  rankPercentile,
  hasTopics,
  missionCompleted,
}: MomentumSectionProps) => {
  const { user } = useAuth();
  const [points, setPoints] = useState<DayPoint[]>([]);
  const [hovered, setHovered] = useState<number | null>(null);
  const [availableFreezes, setAvailableFreezes] = useState(0);
  const [autoShieldOn, setAutoShieldOn] = useState(false);
  const [prevRank, setPrevRank] = useState<number | null>(null);
  const [animateBoost, setAnimateBoost] = useState(false);

  // Load 7-day brain stability data
  const loadSparkline = useCallback(async () => {
    if (!user) return;
    try {
      const now = new Date();
      const since = subDays(startOfDay(now), 6).toISOString();
      const { data: scores } = await supabase
        .from("memory_scores")
        .select("score, recorded_at")
        .eq("user_id", user.id)
        .gte("recorded_at", since)
        .order("recorded_at", { ascending: true });

      const { data: topics } = await supabase
        .from("topics")
        .select("memory_strength")
        .eq("user_id", user.id);

      const dayMap = new Map<string, number[]>();
      for (let i = 6; i >= 0; i--) {
        const d = subDays(now, i);
        dayMap.set(format(d, "yyyy-MM-dd"), []);
      }

      scores?.forEach((s) => {
        const key = format(new Date(s.recorded_at), "yyyy-MM-dd");
        if (dayMap.has(key)) dayMap.get(key)!.push(Number(s.score));
      });

      const todayKey = format(now, "yyyy-MM-dd");
      if (dayMap.get(todayKey)?.length === 0 && topics && topics.length > 0) {
        const avg = Math.round(topics.reduce((sum, t) => sum + Number(t.memory_strength), 0) / topics.length);
        dayMap.get(todayKey)!.push(avg);
      }

      let lastVal = 0;
      const days: DayPoint[] = [];
      for (const [key, vals] of dayMap) {
        const avg = vals.length > 0 ? Math.round(vals.reduce((a, b) => a + b, 0) / vals.length) : lastVal;
        if (vals.length > 0) lastVal = avg;
        days.push({ date: key, label: format(new Date(key), "EEE"), value: avg });
      }
      setPoints(days);
    } catch {}
  }, [user]);

  // Load freeze/shield status
  const loadShieldStatus = useCallback(async () => {
    if (!user) return;
    try {
      const { data: freezes } = await (supabase as any)
        .from("streak_freezes")
        .select("id")
        .eq("user_id", user.id)
        .is("used_date", null);
      setAvailableFreezes(freezes?.length ?? 0);

      const { data: pref } = await (supabase as any)
        .from("profiles")
        .select("auto_use_streak_freeze")
        .eq("id", user.id)
        .maybeSingle();
      setAutoShieldOn(!!pref?.auto_use_streak_freeze);
    } catch {}
  }, [user]);

  useEffect(() => {
    loadSparkline();
    loadShieldStatus();
  }, [loadSparkline, loadShieldStatus]);

  // Track rank changes for delta display
  useEffect(() => {
    if (rankPredicted) {
      const stored = localStorage.getItem("momentum-prev-rank");
      if (stored) setPrevRank(Number(stored));
      localStorage.setItem("momentum-prev-rank", String(rankPredicted));
    }
  }, [rankPredicted]);

  // Animate boost on mission completion
  useEffect(() => {
    if (missionCompleted) {
      setAnimateBoost(true);
      const t = setTimeout(() => setAnimateBoost(false), 3000);
      return () => clearTimeout(t);
    }
  }, [missionCompleted]);

  if (!hasTopics) return null;

  const currentStreak = streakData?.currentStreak ?? 0;
  const todayMet = streakData?.todayMet ?? false;
  const goalMinutes = streakData?.goalMinutes ?? 60;
  const todayMinutes = streakData?.todayMinutes ?? 0;

  // Sparkline calculations
  const hasSparkData = points.some((p) => p.value > 0);
  const max = Math.max(...points.map((p) => p.value), 100);
  const min = Math.min(...points.filter((p) => p.value > 0).map((p) => p.value), 0);
  const range = Math.max(max - min, 10);
  const W = 200;
  const H = 44;
  const padX = 4;
  const padY = 4;
  const xStep = points.length > 1 ? (W - padX * 2) / (points.length - 1) : 0;
  const toY = (v: number) => padY + (1 - (v - min) / range) * (H - padY * 2);

  const linePath = points.map((p, i) => {
    const x = padX + i * xStep;
    const y = toY(p.value);
    return i === 0 ? `M${x},${y}` : `L${x},${y}`;
  }).join(" ");
  const areaPath = `${linePath} L${padX + (points.length - 1) * xStep},${H} L${padX},${H} Z`;

  const first = points.find((p) => p.value > 0)?.value ?? 0;
  const last = points[points.length - 1]?.value ?? 0;
  const diff = last - first;
  const TrendIcon = diff > 2 ? TrendingUp : diff < -2 ? TrendingDown : Minus;
  const trendColor = diff > 2 ? "text-success" : diff < -2 ? "text-destructive" : "text-muted-foreground";

  // Rank delta
  const rankDelta = prevRank && rankPredicted ? prevRank - rankPredicted : null;

  // Streak flame intensity
  const flameSize = currentStreak >= 14 ? "w-8 h-8" : currentStreak >= 7 ? "w-7 h-7" : "w-6 h-6";
  const flameColor = currentStreak >= 14 ? "text-warning" : currentStreak >= 7 ? "text-primary" : currentStreak >= 3 ? "text-primary/70" : "text-muted-foreground";

  // Positive reinforcement text
  const motivationText = todayMet
    ? currentStreak >= 7
      ? "Unstoppable! 🏆"
      : currentStreak >= 3
        ? "Building momentum! 💪"
        : "Great start today! ✨"
    : currentStreak >= 3
      ? `${goalMinutes - todayMinutes} min to keep your fire alive`
      : "Start studying to build your streak";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4 }}
      className="space-y-3"
    >
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest px-1">
        Momentum
      </p>

      {/* Main momentum card */}
      <motion.div
        className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm p-4 space-y-4 overflow-hidden relative"
        layout
      >
        {/* Boost glow on mission completion */}
        <AnimatePresence>
          {animateBoost && (
            <motion.div
              initial={{ opacity: 0, scale: 0.5 }}
              animate={{ opacity: 0.15, scale: 2 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5 }}
              className="absolute inset-0 rounded-2xl pointer-events-none"
              style={{ background: "radial-gradient(circle, hsl(var(--success)) 0%, transparent 70%)" }}
            />
          )}
        </AnimatePresence>

        {/* ── 1. Streak Meter ── */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <motion.div
              animate={currentStreak > 0 ? { scale: [1, 1.12, 1] } : {}}
              transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
            >
              <Flame className={`${flameSize} ${flameColor} transition-all`} />
            </motion.div>
            {currentStreak > 0 && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="absolute -top-1 -right-1.5 min-w-[18px] h-[18px] rounded-full bg-warning flex items-center justify-center px-1"
              >
                <span className="text-[9px] font-bold text-warning-foreground">{currentStreak}</span>
              </motion.div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-foreground">
                {currentStreak > 0 ? `${currentStreak}-day streak` : "No streak yet"}
              </span>
              {todayMet && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="px-1.5 py-0.5 rounded-full bg-success/20 text-success text-[9px] font-medium"
                >
                  ✓ Today
                </motion.span>
              )}
            </div>
            <p className="text-[10px] text-muted-foreground mt-0.5">{motivationText}</p>
          </div>
        </div>

        {/* Streak dots for last 7 days */}
        {streakData && (
          <div className="flex items-center justify-between px-0.5">
            {Array.from({ length: 7 }).map((_, i) => {
              const date = new Date();
              date.setDate(date.getDate() - (6 - i));
              const dateStr = date.toLocaleDateString("en-CA");
              const dayLabel = date.toLocaleDateString("en-US", { weekday: "narrow" });
              const isToday = i === 6;
              const studied = (streakData.dailyTotals[dateStr] || 0) >= streakData.goalMinutes;
              const frozen = streakData.frozenDays.has(dateStr);

              return (
                <div key={i} className="flex flex-col items-center gap-0.5">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.05 }}
                    className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-all ${
                      frozen && !studied
                        ? "bg-accent/30 text-accent-foreground border border-accent/50"
                        : studied
                          ? "bg-primary/20 text-primary border border-primary/40"
                          : isToday
                            ? "bg-secondary border border-border text-foreground"
                            : "bg-secondary/50 text-muted-foreground"
                    }`}
                  >
                    {frozen && !studied ? "🛡️" : studied ? "✓" : dayLabel}
                  </motion.div>
                </div>
              );
            })}
          </div>
        )}

        {/* ── 2. 7-Day Brain Stability Mini Graph ── */}
        {hasSparkData && points.length > 1 && (
          <div className="pt-2 border-t border-border/30">
            <div className="flex items-center justify-between mb-1.5">
              <p className="text-[10px] font-medium text-muted-foreground">Brain Stability</p>
              <div className={`flex items-center gap-1 text-[10px] font-semibold ${trendColor}`}>
                <TrendIcon className="w-3 h-3" />
                {diff > 0 ? "+" : ""}{diff}%
              </div>
            </div>

            <div className="relative">
              <svg viewBox={`0 0 ${W} ${H}`} className="w-full" style={{ height: 44 }} preserveAspectRatio="none">
                <defs>
                  <linearGradient id="momentumGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.2" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <motion.path d={areaPath} fill="url(#momentumGrad)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3, duration: 0.5 }} />
                <motion.path
                  d={linePath} fill="none" stroke="hsl(var(--primary))" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: 0.2, duration: 0.8, ease: "easeOut" }}
                />
                {points.map((p, i) => {
                  const cx = padX + i * xStep;
                  const cy = toY(p.value);
                  return (
                    <g key={i}>
                      <circle cx={cx} cy={cy} r="10" fill="transparent"
                        onMouseEnter={() => setHovered(i)} onMouseLeave={() => setHovered(null)}
                        onTouchStart={() => setHovered(i)} onTouchEnd={() => setHovered(null)}
                        style={{ cursor: "pointer" }}
                      />
                      <motion.circle
                        cx={cx} cy={cy} r={hovered === i ? 4 : 2.5}
                        fill={hovered === i ? "hsl(var(--primary))" : "hsl(var(--background))"}
                        stroke="hsl(var(--primary))" strokeWidth="1.5"
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ delay: 0.4 + i * 0.06, type: "spring", stiffness: 300 }}
                      />
                    </g>
                  );
                })}
              </svg>

              {hovered !== null && points[hovered] && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }}
                  className="absolute pointer-events-none z-10 px-2 py-1 rounded-lg bg-popover border border-border shadow-lg"
                  style={{ left: `${((padX + hovered * xStep) / W) * 100}%`, top: -4, transform: "translateX(-50%) translateY(-100%)" }}
                >
                  <p className="text-[10px] font-bold text-foreground">{points[hovered].value}%</p>
                  <p className="text-[8px] text-muted-foreground">{format(new Date(points[hovered].date), "MMM d")}</p>
                </motion.div>
              )}
            </div>

            <div className="flex justify-between mt-0.5 px-0.5">
              {points.map((p) => (
                <span key={p.date} className="text-[8px] text-muted-foreground">{p.label}</span>
              ))}
            </div>
          </div>
        )}

        {/* ── Bottom row: Rank Badge + Risk Shield ── */}
        <div className="grid grid-cols-2 gap-2 pt-2 border-t border-border/30">
          {/* 3. Rank Percentile Badge */}
          <motion.div
            className="rounded-xl bg-secondary/40 p-3 text-center relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <AnimatePresence>
              {animateBoost && (
                <motion.div
                  initial={{ opacity: 0 }} animate={{ opacity: 0.2 }} exit={{ opacity: 0 }}
                  className="absolute inset-0 bg-warning/20 pointer-events-none"
                />
              )}
            </AnimatePresence>
            <Trophy className="w-4 h-4 text-warning mx-auto mb-1" />
            <motion.p
              key={rankPredicted}
              initial={{ y: animateBoost ? 10 : 0, opacity: animateBoost ? 0 : 1 }}
              animate={{ y: 0, opacity: 1 }}
              className="text-lg font-bold text-foreground tabular-nums"
            >
              {rankPredicted ? `#${rankPredicted.toLocaleString()}` : "—"}
            </motion.p>
            {rankDelta !== null && rankDelta !== 0 && (
              <motion.span
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className={`text-[9px] font-semibold ${rankDelta > 0 ? "text-success" : "text-destructive"}`}
              >
                {rankDelta > 0 ? `↑${rankDelta}` : `↓${Math.abs(rankDelta)}`}
              </motion.span>
            )}
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {rankPercentile ? `Top ${rankPercentile}%` : "Rank"}
            </p>
          </motion.div>

          {/* 4. Risk Shield Status */}
          <motion.div
            className="rounded-xl bg-secondary/40 p-3 text-center relative overflow-hidden"
            whileHover={{ scale: 1.02 }}
            transition={{ type: "spring", stiffness: 400 }}
          >
            <Shield className={`w-4 h-4 mx-auto mb-1 ${autoShieldOn ? "text-success" : availableFreezes > 0 ? "text-primary" : "text-muted-foreground"}`} />
            <p className="text-lg font-bold text-foreground tabular-nums">{availableFreezes}</p>
            <p className="text-[9px] text-muted-foreground mt-0.5">
              {autoShieldOn ? "Auto-shield ✓" : availableFreezes > 0 ? "Shields ready" : "No shields"}
            </p>
            {autoShieldOn && (
              <motion.div
                className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-success"
                animate={{ scale: [1, 1.3, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
          </motion.div>
        </div>

        {/* Positive reinforcement after mission */}
        <AnimatePresence>
          {animateBoost && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex items-center gap-2 px-3 py-2 rounded-xl bg-success/10 border border-success/20"
            >
              <Zap className="w-4 h-4 text-success shrink-0" />
              <p className="text-[10px] font-medium text-success">
                Brain score boosted! Keep the momentum going 🚀
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </motion.section>
  );
};

export default MomentumSection;
