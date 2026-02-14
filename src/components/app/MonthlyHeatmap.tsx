import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  startOfMonth,
  endOfMonth,
  subMonths,
  addMonths,
  format,
  getDay,
  eachDayOfInterval,
  isSameMonth,
  isToday,
} from "date-fns";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

const getIntensity = (minutes: number): string => {
  if (minutes === 0) return "bg-secondary";
  if (minutes < 15) return "bg-success/20";
  if (minutes < 30) return "bg-success/40";
  if (minutes < 60) return "bg-success/60";
  if (minutes < 120) return "bg-success/80";
  return "bg-success";
};

const MonthlyHeatmap = () => {
  const { user } = useAuth();
  const [month, setMonth] = useState(new Date());
  const [dayMinutes, setDayMinutes] = useState<Map<string, number>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user) loadMonth();
  }, [user, month]);

  const loadMonth = async () => {
    if (!user) return;
    setLoading(true);

    const start = startOfMonth(month);
    const end = endOfMonth(month);

    const { data: logs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at")
      .eq("user_id", user.id)
      .gte("created_at", start.toISOString())
      .lte("created_at", end.toISOString());

    const map = new Map<string, number>();
    for (const log of logs || []) {
      const key = format(new Date(log.created_at), "yyyy-MM-dd");
      map.set(key, (map.get(key) || 0) + log.duration_minutes);
    }
    setDayMinutes(map);
    setLoading(false);
  };

  const days = eachDayOfInterval({
    start: startOfMonth(month),
    end: endOfMonth(month),
  });

  const startPadding = getDay(startOfMonth(month));
  const totalMinutes = Array.from(dayMinutes.values()).reduce((s, m) => s + m, 0);
  const activeDays = Array.from(dayMinutes.values()).filter((m) => m > 0).length;
  const canGoForward = !isSameMonth(month, new Date());

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <CalendarDays className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Monthly Heatmap</h2>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMonth((m) => subMonths(m, 1))}
            className="p-1 rounded-md hover:bg-secondary/50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4 text-muted-foreground" />
          </button>
          <span className="text-xs font-medium text-foreground min-w-[80px] text-center">
            {format(month, "MMM yyyy")}
          </span>
          <button
            onClick={() => setMonth((m) => addMonths(m, 1))}
            disabled={!canGoForward}
            className="p-1 rounded-md hover:bg-secondary/50 transition-colors disabled:opacity-30"
          >
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      {/* Summary */}
      <div className="flex gap-4 mb-3">
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">
            {totalMinutes >= 60
              ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
              : `${totalMinutes}m`}
          </p>
          <p className="text-[9px] text-muted-foreground">Total</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">{activeDays}</p>
          <p className="text-[9px] text-muted-foreground">Active Days</p>
        </div>
        <div className="text-center">
          <p className="text-sm font-bold text-foreground">
            {activeDays > 0 ? Math.round(totalMinutes / activeDays) : 0}m
          </p>
          <p className="text-[9px] text-muted-foreground">Avg/Day</p>
        </div>
      </div>

      {/* Day labels */}
      <div className="grid grid-cols-7 gap-1 mb-1">
        {DAY_LABELS.map((d, i) => (
          <span key={i} className="text-[9px] text-muted-foreground text-center">
            {d}
          </span>
        ))}
      </div>

      {/* Calendar grid */}
      {loading ? (
        <div className="h-32 flex items-center justify-center">
          <p className="text-xs text-muted-foreground">Loading…</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-1">
          {/* Empty cells for padding */}
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} className="aspect-square" />
          ))}

          {days.map((day, i) => {
            const key = format(day, "yyyy-MM-dd");
            const mins = dayMinutes.get(key) || 0;
            const today = isToday(day);

            return (
              <motion.div
                key={key}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.15, delay: i * 0.01 }}
                className={`aspect-square rounded-sm ${getIntensity(mins)} ${
                  today ? "ring-1 ring-primary" : ""
                } relative group cursor-default`}
                title={`${format(day, "MMM d")}: ${mins}m`}
              >
                {/* Tooltip on hover */}
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-10">
                  <div className="bg-popover border border-border rounded-md px-2 py-1 shadow-lg whitespace-nowrap">
                    <p className="text-[10px] text-foreground font-medium">
                      {format(day, "MMM d")}
                    </p>
                    <p className="text-[9px] text-muted-foreground">
                      {mins > 0
                        ? mins >= 60
                          ? `${Math.floor(mins / 60)}h ${mins % 60}m`
                          : `${mins}m studied`
                        : "No study"}
                    </p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Legend */}
      <div className="flex items-center justify-end gap-1 mt-3">
        <span className="text-[9px] text-muted-foreground mr-1">Less</span>
        {["bg-secondary", "bg-success/20", "bg-success/40", "bg-success/60", "bg-success/80", "bg-success"].map(
          (c, i) => (
            <div key={i} className={`w-3 h-3 rounded-sm ${c}`} />
          )
        )}
        <span className="text-[9px] text-muted-foreground ml-1">More</span>
      </div>
    </motion.div>
  );
};

export default MonthlyHeatmap;
