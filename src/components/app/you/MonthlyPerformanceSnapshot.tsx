import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { BarChart3, TrendingUp, TrendingDown, Minus, Clock, Brain, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { subDays, startOfDay, format } from "date-fns";

const MonthlyPerformanceSnapshot = () => {
  const { user } = useAuth();
  const [stats, setStats] = useState({
    totalHours: 0,
    avgDailyMin: 0,
    daysActive: 0,
    topSubject: "",
    prevTotalHours: 0,
    topicsImproved: 0,
    topicsDeclined: 0,
  });

  useEffect(() => {
    if (!user) return;
    const now = startOfDay(new Date());
    const thisMonthStart = subDays(now, 29);
    const prevMonthStart = subDays(now, 59);

    Promise.all([
      supabase.from("study_logs").select("created_at, duration_minutes, subject_id").eq("user_id", user.id).gte("created_at", thisMonthStart.toISOString()),
      supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id).gte("created_at", prevMonthStart.toISOString()).lt("created_at", thisMonthStart.toISOString()),
      supabase.from("topics").select("memory_strength").eq("user_id", user.id).is("deleted_at", null),
    ]).then(async ([currentRes, prevRes, topicsRes]) => {
      const currentLogs = currentRes.data || [];
      const prevLogs = prevRes.data || [];
      const topics = topicsRes.data || [];

      const totalMin = currentLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const prevTotalMin = prevLogs.reduce((s, l) => s + (l.duration_minutes || 0), 0);

      // Days active
      const daySet = new Set(currentLogs.map(l => format(new Date(l.created_at), "yyyy-MM-dd")));

      // Top subject
      const subjectMin: Record<string, number> = {};
      currentLogs.forEach(l => {
        if (l.subject_id) subjectMin[l.subject_id] = (subjectMin[l.subject_id] || 0) + (l.duration_minutes || 0);
      });
      const topSubId = Object.entries(subjectMin).sort(([, a], [, b]) => b - a)[0]?.[0];
      let topSubName = "";
      if (topSubId) {
        const { data } = await supabase.from("subjects").select("name").eq("id", topSubId).maybeSingle();
        topSubName = data?.name || "";
      }

      const improved = topics.filter(t => (t.memory_strength || 0) >= 60).length;
      const declined = topics.filter(t => (t.memory_strength || 0) < 40 && (t.memory_strength || 0) > 0).length;

      setStats({
        totalHours: Math.round(totalMin / 60 * 10) / 10,
        avgDailyMin: daySet.size > 0 ? Math.round(totalMin / daySet.size) : 0,
        daysActive: daySet.size,
        topSubject: topSubName,
        prevTotalHours: Math.round(prevTotalMin / 60 * 10) / 10,
        topicsImproved: improved,
        topicsDeclined: declined,
      });
    });
  }, [user]);

  const trend = stats.totalHours > stats.prevTotalHours ? "up" : stats.totalHours < stats.prevTotalHours ? "down" : "same";
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;
  const trendColor = trend === "up" ? "text-success" : trend === "down" ? "text-destructive" : "text-muted-foreground";

  const metrics = [
    { icon: Clock, label: "Total Hours", value: `${stats.totalHours}h`, color: "text-primary" },
    { icon: Flame, label: "Days Active", value: `${stats.daysActive}/30`, color: "text-warning" },
    { icon: Brain, label: "Avg/Day", value: `${stats.avgDailyMin}m`, color: "text-accent" },
    { icon: TrendIcon, label: "vs Last Month", value: trend === "up" ? `+${(stats.totalHours - stats.prevTotalHours).toFixed(1)}h` : trend === "down" ? `${(stats.totalHours - stats.prevTotalHours).toFixed(1)}h` : "Same", color: trendColor },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="glass rounded-2xl p-5 neural-border space-y-4"
    >
      <div className="flex items-center gap-2">
        <BarChart3 className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Monthly Snapshot</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">Last 30 days</span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 + i * 0.06 }}
            className="rounded-xl bg-secondary/30 p-3 border border-border/50"
          >
            <div className="flex items-center gap-1.5 mb-1">
              <m.icon className={`w-3 h-3 ${m.color}`} />
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
            </div>
            <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Insights */}
      <div className="flex gap-3 text-[10px]">
        {stats.topSubject && (
          <span className="text-muted-foreground">
            📚 Top: <span className="text-foreground font-medium">{stats.topSubject}</span>
          </span>
        )}
        {stats.topicsImproved > 0 && (
          <span className="text-success">
            ↑ {stats.topicsImproved} topics strong
          </span>
        )}
        {stats.topicsDeclined > 0 && (
          <span className="text-destructive">
            ↓ {stats.topicsDeclined} need review
          </span>
        )}
      </div>
    </motion.div>
  );
};

export default MonthlyPerformanceSnapshot;
