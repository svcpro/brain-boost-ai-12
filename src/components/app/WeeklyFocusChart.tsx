import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crosshair, Clock, Timer } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay } from "date-fns";

interface DayData {
  label: string;
  minutes: number;
  date: string;
}

const WeeklyFocusChart = () => {
  const { user } = useAuth();
  const [days, setDays] = useState<DayData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    const today = startOfDay(new Date());
    const weekAgo = subDays(today, 6);

    const { data: logs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at")
      .eq("user_id", user.id)
      .eq("study_mode", "focus")
      .gte("created_at", weekAgo.toISOString())
      .order("created_at", { ascending: true });

    // Build day buckets
    const buckets = new Map<string, number>();
    for (let i = 0; i < 7; i++) {
      const d = subDays(today, 6 - i);
      buckets.set(format(d, "yyyy-MM-dd"), 0);
    }

    for (const log of logs || []) {
      const key = format(new Date(log.created_at), "yyyy-MM-dd");
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) || 0) + log.duration_minutes);
      }
    }

    const result: DayData[] = [];
    for (let i = 0; i < 7; i++) {
      const d = subDays(today, 6 - i);
      const key = format(d, "yyyy-MM-dd");
      result.push({
        label: format(d, "EEE"),
        minutes: buckets.get(key) || 0,
        date: key,
      });
    }

    setDays(result);
    setLoading(false);
  };

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);
  const activeDays = days.filter((d) => d.minutes > 0).length;

  if (loading) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <Crosshair className="w-4 h-4 text-success" />
        <h2 className="font-semibold text-foreground text-sm">Weekly Focus Time</h2>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-secondary/50 border border-border p-2 text-center">
          <Clock className="w-3 h-3 text-success mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground">
            {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}
          </p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border p-2 text-center">
          <Timer className="w-3 h-3 text-primary mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground">{Math.floor(totalMinutes / 25)}</p>
          <p className="text-[9px] text-muted-foreground">Pomodoros</p>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border p-2 text-center">
          <Crosshair className="w-3 h-3 text-warning mx-auto mb-0.5" />
          <p className="text-sm font-bold text-foreground">{activeDays}/7</p>
          <p className="text-[9px] text-muted-foreground">Active Days</p>
        </div>
      </div>

      {/* Bar chart */}
      <div className="flex items-end gap-2 h-28">
        {days.map((d, i) => {
          const heightPct = (d.minutes / maxMinutes) * 100;
          const isToday = i === 6;
          return (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-1 h-full justify-end">
              {d.minutes > 0 && (
                <span className="text-[9px] text-muted-foreground font-medium">{d.minutes}m</span>
              )}
              <motion.div
                className={`w-full rounded-t ${isToday ? "bg-success" : "bg-success/40"}`}
                style={{ minHeight: d.minutes > 0 ? 4 : 0 }}
                initial={{ height: 0 }}
                animate={{ height: d.minutes > 0 ? `${Math.max(heightPct, 5)}%` : 0 }}
                transition={{ duration: 0.5, delay: 0.2 + i * 0.06 }}
              />
              <span className={`text-[9px] ${isToday ? "text-foreground font-semibold" : "text-muted-foreground"}`}>
                {d.label}
              </span>
            </div>
          );
        })}
      </div>

      {totalMinutes === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          No focus sessions this week. Start one from the Action tab!
        </p>
      )}
    </motion.div>
  );
};

export default WeeklyFocusChart;
