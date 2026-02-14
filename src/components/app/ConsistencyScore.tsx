import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, startOfDay, format } from "date-fns";

const ConsistencyScore = () => {
  const { user } = useAuth();
  const [score, setScore] = useState<number | null>(null);
  const [details, setDetails] = useState<{
    daysActive: number;
    totalDays: number;
    evenness: number;
    timeVariance: string;
  } | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const today = startOfDay(new Date());
    const since = subDays(today, 6); // current week (7 days)

    const { data: logs } = await supabase
      .from("study_logs")
      .select("created_at, duration_minutes")
      .eq("user_id", user.id)
      .gte("created_at", since.toISOString())
      .order("created_at", { ascending: true });

    if (!logs || logs.length === 0) {
      setScore(0);
      setDetails({ daysActive: 0, totalDays: 7, evenness: 0, timeVariance: "—" });
      return;
    }

    // Group by day
    const dayBuckets: Record<string, number> = {};
    for (let i = 0; i < 7; i++) {
      const d = subDays(today, 6 - i);
      dayBuckets[format(d, "yyyy-MM-dd")] = 0;
    }
    for (const log of logs) {
      const key = format(new Date(log.created_at), "yyyy-MM-dd");
      if (key in dayBuckets) {
        dayBuckets[key] += log.duration_minutes || 0;
      }
    }

    const dailyMins = Object.values(dayBuckets);
    const daysActive = dailyMins.filter((m) => m > 0).length;

    // Frequency score (0-100): what % of days had study
    const frequencyScore = (daysActive / 7) * 100;

    // Evenness score (0-100): how evenly distributed study time is
    // Uses coefficient of variation (lower = more even)
    const activeMins = dailyMins.filter((m) => m > 0);
    let evennessScore = 100;
    if (activeMins.length > 1) {
      const mean = activeMins.reduce((a, b) => a + b, 0) / activeMins.length;
      const variance = activeMins.reduce((a, b) => a + (b - mean) ** 2, 0) / activeMins.length;
      const cv = Math.sqrt(variance) / (mean || 1); // coefficient of variation
      evennessScore = Math.max(0, Math.round(100 - cv * 50)); // lower CV = higher score
    }

    // Time variance label
    const totalMins = dailyMins.reduce((a, b) => a + b, 0);
    const avgPerActive = daysActive > 0 ? Math.round(totalMins / daysActive) : 0;
    let timeVariance = "—";
    if (daysActive > 1) {
      const maxDay = Math.max(...activeMins);
      const minDay = Math.min(...activeMins);
      const spread = maxDay - minDay;
      timeVariance = spread <= 10 ? "Very steady" : spread <= 30 ? "Moderate" : "High variance";
    }

    // Combined: 60% frequency, 40% evenness
    const combined = Math.round(frequencyScore * 0.6 + evennessScore * 0.4);

    setScore(combined);
    setDetails({ daysActive, totalDays: 7, evenness: evennessScore, timeVariance });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (score === null) return null;

  const getLabel = (s: number) =>
    s >= 85 ? "Excellent" : s >= 65 ? "Good" : s >= 40 ? "Fair" : "Needs work";
  const getColor = (s: number) =>
    s >= 85 ? "text-success" : s >= 65 ? "text-primary" : s >= 40 ? "text-warning" : "text-destructive";
  const getBarColor = (s: number) =>
    s >= 85 ? "bg-success" : s >= 65 ? "bg-primary" : s >= 40 ? "bg-warning" : "bg-destructive";

  const circumference = 2 * Math.PI * 40;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <Activity className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Consistency Score</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">This week</span>
      </div>

      <div className="flex items-center gap-5">
        {/* Circular gauge */}
        <div className="relative w-24 h-24 shrink-0">
          <svg className="w-full h-full -rotate-90" viewBox="0 0 96 96">
            <circle cx="48" cy="48" r="40" fill="none" stroke="hsl(var(--secondary))" strokeWidth="5" />
            <motion.circle
              cx="48" cy="48" r="40" fill="none"
              stroke={score >= 85 ? "hsl(var(--success))" : score >= 65 ? "hsl(var(--primary))" : score >= 40 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
              strokeWidth="5"
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: dashOffset }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className={`text-2xl font-bold ${getColor(score)}`}>{score}</span>
            <span className="text-[9px] text-muted-foreground">/ 100</span>
          </div>
        </div>

        {/* Details */}
        <div className="flex-1 space-y-2">
          <div>
            <span className={`text-xs font-semibold ${getColor(score)}`}>{getLabel(score)}</span>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {details?.daysActive}/{details?.totalDays} days active
            </p>
          </div>

          {/* Evenness bar */}
          <div>
            <div className="flex justify-between mb-1">
              <span className="text-[9px] text-muted-foreground">Time evenness</span>
              <span className="text-[9px] text-muted-foreground">{details?.evenness}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className={`h-full rounded-full ${getBarColor(details?.evenness ?? 0)}`}
                initial={{ width: 0 }}
                animate={{ width: `${details?.evenness ?? 0}%` }}
                transition={{ duration: 0.8, delay: 0.3 }}
              />
            </div>
          </div>

          <p className="text-[9px] text-muted-foreground">
            Variance: <span className="text-foreground font-medium">{details?.timeVariance}</span>
          </p>
        </div>
      </div>

      {/* Tip */}
      {score < 65 && (
        <p className="text-[10px] text-warning mt-3">
          💡 Try studying at a consistent time each day — even 15 minutes counts!
        </p>
      )}
    </motion.div>
  );
};

export default ConsistencyScore;
