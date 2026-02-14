import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, ArrowUp, ArrowDown, Minus, CalendarDays } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay, subWeeks } from "date-fns";

interface WeekBucket {
  label: string;
  minutes: number;
  startDate: Date;
}

const MonthlyFocusTrend = () => {
  const { user } = useAuth();
  const [weeks, setWeeks] = useState<WeekBucket[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const today = startOfDay(new Date());
    const fourWeeksAgo = subWeeks(today, 3);
    // Start from Monday of that week
    const startDate = subDays(fourWeeksAgo, fourWeeksAgo.getDay() === 0 ? 6 : fourWeeksAgo.getDay() - 1);

    const { data: logs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at")
      .eq("user_id", user.id)
      .eq("study_mode", "focus")
      .gte("created_at", startDate.toISOString())
      .order("created_at", { ascending: true });

    // Build 4 week buckets
    const buckets: WeekBucket[] = [];
    for (let w = 0; w < 4; w++) {
      const weekStart = subWeeks(today, 3 - w);
      const adjustedStart = subDays(weekStart, weekStart.getDay() === 0 ? 6 : weekStart.getDay() - 1);
      buckets.push({
        label: `W${w + 1}`,
        minutes: 0,
        startDate: adjustedStart,
      });
    }

    // Label weeks nicely
    buckets.forEach((b, i) => {
      if (i === 3) {
        b.label = "This Week";
      } else {
        b.label = format(b.startDate, "MMM d");
      }
    });

    for (const log of logs || []) {
      const logDate = new Date(log.created_at);
      // Find which bucket this log belongs to
      for (let i = buckets.length - 1; i >= 0; i--) {
        const nextStart = i < buckets.length - 1 ? buckets[i + 1].startDate : undefined;
        if (logDate >= buckets[i].startDate && (!nextStart || logDate < nextStart)) {
          buckets[i].minutes += log.duration_minutes;
          break;
        }
        // Last bucket catches everything from its start onward
        if (i === buckets.length - 1 && logDate >= buckets[i].startDate) {
          buckets[i].minutes += log.duration_minutes;
          break;
        }
      }
    }

    setWeeks(buckets);
    setLoading(false);
  };

  if (loading) return null;

  const maxMinutes = Math.max(...weeks.map((w) => w.minutes), 1);
  const totalMinutes = weeks.reduce((s, w) => s + w.minutes, 0);
  const currentWeek = weeks[weeks.length - 1]?.minutes || 0;
  const prevWeek = weeks[weeks.length - 2]?.minutes || 0;
  const diff = currentWeek - prevWeek;
  const diffPct = prevWeek > 0 ? Math.round((diff / prevWeek) * 100) : currentWeek > 0 ? 100 : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <CalendarDays className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Monthly Focus Trend</h2>
      </div>

      {/* Week-over-week comparison */}
      <div className="flex items-center gap-3 mb-4 p-3 rounded-lg bg-secondary/50 border border-border">
        <div className="flex-1">
          <p className="text-[10px] text-muted-foreground">This week vs last</p>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-lg font-bold text-foreground">
              {currentWeek >= 60 ? `${Math.floor(currentWeek / 60)}h ${currentWeek % 60}m` : `${currentWeek}m`}
            </span>
            {diff !== 0 ? (
              <span className={`flex items-center gap-0.5 text-xs font-semibold ${diff > 0 ? "text-success" : "text-destructive"}`}>
                {diff > 0 ? <ArrowUp className="w-3 h-3" /> : <ArrowDown className="w-3 h-3" />}
                {Math.abs(diffPct)}%
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-xs text-muted-foreground">
                <Minus className="w-3 h-3" /> Same
              </span>
            )}
          </div>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-muted-foreground">4-week total</p>
          <p className="text-sm font-bold text-foreground mt-0.5">
            {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}
          </p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-3 h-32">
        {weeks.map((w, i) => {
          const heightPct = (w.minutes / maxMinutes) * 100;
          const isCurrent = i === weeks.length - 1;
          return (
            <div key={i} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              {w.minutes > 0 && (
                <span className="text-[9px] text-muted-foreground font-medium">
                  {w.minutes >= 60 ? `${Math.floor(w.minutes / 60)}h` : `${w.minutes}m`}
                </span>
              )}
              <motion.div
                className={`w-full rounded-t ${isCurrent ? "bg-primary" : "bg-primary/30"}`}
                style={{ minHeight: w.minutes > 0 ? 4 : 0 }}
                initial={{ height: 0 }}
                animate={{ height: w.minutes > 0 ? `${Math.max(heightPct, 5)}%` : 0 }}
                transition={{ duration: 0.6, delay: 0.2 + i * 0.1 }}
              />
              <span className={`text-[9px] text-center leading-tight ${isCurrent ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {w.label}
              </span>
            </div>
          );
        })}
      </div>

      {totalMinutes === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          No focus sessions in the last 4 weeks.
        </p>
      )}
    </motion.div>
  );
};

export default MonthlyFocusTrend;
