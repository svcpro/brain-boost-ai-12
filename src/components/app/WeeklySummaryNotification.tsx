import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BarChart3, Clock, BookOpen, TrendingUp, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/offlineCache";

interface WeeklySummary {
  totalMinutes: number;
  sessionCount: number;
  topicsCovered: number;
  daysStudied: number;
  topSubject: string | null;
  weekLabel: string;
}

const CACHE_KEY = "weekly-summary-notification";
const DISMISSED_KEY = "weekly-summary-dismissed";

/**
 * Returns the Monday-based ISO week key, e.g. "2026-W07"
 */
function getWeekKey(date: Date): string {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  // Adjust to Thursday of the current week (ISO week numbering)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  const weekNo = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + yearStart.getDay() + 1) / 7);
  return `${d.getFullYear()}-W${String(weekNo).padStart(2, "0")}`;
}

const WeeklySummaryNotification = () => {
  const { user } = useAuth();
  const [summary, setSummary] = useState<WeeklySummary | null>(null);
  const [visible, setVisible] = useState(false);

  const loadSummary = useCallback(async () => {
    if (!user) return;

    const now = new Date();
    const dayOfWeek = now.getDay(); // 0=Sun, 1=Mon...

    // Show on Sunday (0) or Monday (1) — end/start of week
    if (dayOfWeek !== 0 && dayOfWeek !== 1) return;

    // Check if already dismissed this week
    const currentWeek = getWeekKey(now);
    const previousWeek = getWeekKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    const dismissedWeek = getCache<string>(DISMISSED_KEY);
    if (dismissedWeek === previousWeek) return;

    // Check cache
    const cached = getCache<WeeklySummary & { weekKey: string }>(CACHE_KEY);
    if (cached?.weekKey === previousWeek) {
      setSummary(cached);
      setVisible(true);
      return;
    }

    // Fetch last week's data (Mon-Sun)
    const lastMonday = new Date(now);
    const diff = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    lastMonday.setDate(lastMonday.getDate() - diff - 7);
    lastMonday.setHours(0, 0, 0, 0);

    const lastSunday = new Date(lastMonday);
    lastSunday.setDate(lastSunday.getDate() + 7);

    try {
      const [{ data: logs }, { data: subjects }] = await Promise.all([
        supabase
          .from("study_logs")
          .select("duration_minutes, created_at, topic_id, subject_id")
          .eq("user_id", user.id)
          .gte("created_at", lastMonday.toISOString())
          .lt("created_at", lastSunday.toISOString()),
        supabase
          .from("subjects")
          .select("id, name")
          .eq("user_id", user.id),
      ]);

      if (!logs || logs.length === 0) return;

      const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]));
      const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const topicSet = new Set(logs.filter((l) => l.topic_id).map((l) => l.topic_id));
      const daySet = new Set(logs.map((l) => new Date(l.created_at).toLocaleDateString("en-CA")));

      // Find top subject
      const subjectMinutes = new Map<string, number>();
      for (const l of logs) {
        if (l.subject_id) {
          subjectMinutes.set(l.subject_id, (subjectMinutes.get(l.subject_id) || 0) + (l.duration_minutes || 0));
        }
      }
      let topSubject: string | null = null;
      let maxMin = 0;
      for (const [id, mins] of subjectMinutes) {
        if (mins > maxMin) {
          maxMin = mins;
          topSubject = subjectMap.get(id) || null;
        }
      }

      const weekLabel = `${lastMonday.toLocaleDateString("en-US", { month: "short", day: "numeric" })} – ${new Date(lastSunday.getTime() - 86400000).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`;

      const data: WeeklySummary = {
        totalMinutes,
        sessionCount: logs.length,
        topicsCovered: topicSet.size,
        daysStudied: daySet.size,
        topSubject,
        weekLabel,
      };

      setCache(CACHE_KEY, { ...data, weekKey: previousWeek });
      setSummary(data);
      setVisible(true);
    } catch {
      // offline — skip
    }
  }, [user]);

  useEffect(() => {
    loadSummary();
  }, [loadSummary]);

  const handleDismiss = () => {
    setVisible(false);
    const now = new Date();
    const previousWeek = getWeekKey(new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000));
    setCache(DISMISSED_KEY, previousWeek);
  };

  if (!summary || !visible) return null;

  const hours = Math.floor(summary.totalMinutes / 60);
  const mins = summary.totalMinutes % 60;
  const timeStr = hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -10, height: 0 }}
        animate={{ opacity: 1, y: 0, height: "auto" }}
        exit={{ opacity: 0, y: -10, height: 0 }}
        className="rounded-xl border border-primary/25 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent p-4 overflow-hidden"
      >
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/15">
            <BarChart3 className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <h3 className="text-sm font-bold text-foreground">Weekly Recap</h3>
              <span className="text-[10px] text-muted-foreground">{summary.weekLabel}</span>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-2 mt-2">
              <div className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-primary/70" />
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{timeStr}</p>
                  <p className="text-[9px] text-muted-foreground">studied</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <BookOpen className="w-3.5 h-3.5 text-primary/70" />
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{summary.topicsCovered}</p>
                  <p className="text-[9px] text-muted-foreground">topics</p>
                </div>
              </div>
              <div className="flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5 text-primary/70" />
                <div>
                  <p className="text-sm font-bold text-foreground leading-none">{summary.daysStudied}/7</p>
                  <p className="text-[9px] text-muted-foreground">days active</p>
                </div>
              </div>
            </div>

            {summary.topSubject && (
              <p className="text-[10px] text-muted-foreground mt-2">
                Top focus: <span className="text-foreground font-medium">{summary.topSubject}</span>
              </p>
            )}
          </div>
          <button
            onClick={handleDismiss}
            className="p-1 rounded-md hover:bg-secondary transition-colors"
            aria-label="Dismiss"
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  );
};

export default WeeklySummaryNotification;
