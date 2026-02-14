import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Crosshair, Clock, Timer, BookOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay } from "date-fns";

interface DayData {
  label: string;
  minutes: number;
  date: string;
}

interface SubjectBreakdown {
  name: string;
  minutes: number;
  color: string;
}

const SUBJECT_COLORS = [
  "bg-success", "bg-primary", "bg-warning", "bg-destructive",
  "bg-accent", "bg-secondary",
];
const SUBJECT_TEXT_COLORS = [
  "text-success", "text-primary", "text-warning", "text-destructive",
  "text-accent-foreground", "text-secondary-foreground",
];

const WeeklyFocusChart = () => {
  const { user } = useAuth();
  const [days, setDays] = useState<DayData[]>([]);
  const [subjects, setSubjects] = useState<SubjectBreakdown[]>([]);
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
      .select("duration_minutes, created_at, subject_id")
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

    // Subject minute accumulator
    const subjectMinutes = new Map<string, number>();

    for (const log of logs || []) {
      const key = format(new Date(log.created_at), "yyyy-MM-dd");
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) || 0) + log.duration_minutes);
      }
      if (log.subject_id) {
        subjectMinutes.set(log.subject_id, (subjectMinutes.get(log.subject_id) || 0) + log.duration_minutes);
      }
    }

    // Fetch subject names
    const subjectIds = [...subjectMinutes.keys()];
    let subjectMap = new Map<string, string>();
    if (subjectIds.length > 0) {
      const { data: subjectsData } = await supabase
        .from("subjects")
        .select("id, name")
        .in("id", subjectIds);
      subjectMap = new Map((subjectsData || []).map((s) => [s.id, s.name]));
    }

    // Build subject breakdown sorted by minutes desc
    const subjectList: SubjectBreakdown[] = [...subjectMinutes.entries()]
      .map(([id, mins], i) => ({
        name: subjectMap.get(id) || "Unknown",
        minutes: mins,
        color: SUBJECT_COLORS[i % SUBJECT_COLORS.length],
      }))
      .sort((a, b) => b.minutes - a.minutes);

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
    setSubjects(subjectList);
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

      {/* Subject breakdown */}
      {subjects.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs font-semibold text-foreground">By Subject</span>
          </div>

          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-secondary mb-3">
            {subjects.map((s, i) => (
              <motion.div
                key={s.name}
                className={`h-full ${s.color}`}
                initial={{ width: 0 }}
                animate={{ width: `${(s.minutes / totalMinutes) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.08 }}
              />
            ))}
          </div>

          {/* Legend */}
          <div className="space-y-1.5">
            {subjects.map((s, i) => {
              const pct = Math.round((s.minutes / totalMinutes) * 100);
              return (
                <div key={s.name} className="flex items-center gap-2">
                  <div className={`w-2.5 h-2.5 rounded-sm ${s.color} shrink-0`} />
                  <span className="text-xs text-foreground flex-1 truncate">{s.name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {s.minutes >= 60 ? `${Math.floor(s.minutes / 60)}h ${s.minutes % 60}m` : `${s.minutes}m`}
                  </span>
                  <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {totalMinutes === 0 && (
        <p className="text-xs text-muted-foreground text-center mt-3">
          No focus sessions this week. Start one from the Action tab!
        </p>
      )}
    </motion.div>
  );
};

export default WeeklyFocusChart;
