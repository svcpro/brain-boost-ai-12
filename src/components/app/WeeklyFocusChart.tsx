import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Crosshair, Clock, Timer, BookOpen, ChevronDown, ChevronUp, FileText, Target, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, startOfDay } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface DayData {
  label: string;
  minutes: number;
  date: string;
}

interface SubjectBreakdown {
  id: string;
  name: string;
  minutes: number;
  color: string;
}

interface TopicDetail {
  name: string;
  minutes: number;
}

const SUBJECT_COLORS = [
  "bg-success", "bg-primary", "bg-warning", "bg-destructive",
  "bg-accent", "bg-secondary",
];

const WeeklyFocusChart = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [days, setDays] = useState<DayData[]>([]);
  const [subjects, setSubjects] = useState<SubjectBreakdown[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [topicDetails, setTopicDetails] = useState<Map<string, TopicDetail[]>>(new Map());
  const [loadingTopics, setLoadingTopics] = useState<string | null>(null);
  const [goalMinutes, setGoalMinutes] = useState(300);
  const [editingGoal, setEditingGoal] = useState(false);
  const [goalInput, setGoalInput] = useState("");

  useEffect(() => {
    if (user) loadData();
  }, [user]);

  const loadData = async () => {
    if (!user) return;

    // Load goal from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("weekly_focus_goal_minutes")
      .eq("id", user.id)
      .maybeSingle();
    if (profile?.weekly_focus_goal_minutes) {
      setGoalMinutes(profile.weekly_focus_goal_minutes);
    }

    const today = startOfDay(new Date());
    const weekAgo = subDays(today, 6);

    const { data: logs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at, subject_id, topic_id")
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

    // Subject & topic minute accumulators
    const subjectMinutes = new Map<string, number>();
    // subject_id -> topic_id -> minutes
    const subjectTopicMinutes = new Map<string, Map<string, number>>();

    for (const log of logs || []) {
      const key = format(new Date(log.created_at), "yyyy-MM-dd");
      if (buckets.has(key)) {
        buckets.set(key, (buckets.get(key) || 0) + log.duration_minutes);
      }
      if (log.subject_id) {
        subjectMinutes.set(log.subject_id, (subjectMinutes.get(log.subject_id) || 0) + log.duration_minutes);
        if (log.topic_id) {
          if (!subjectTopicMinutes.has(log.subject_id)) {
            subjectTopicMinutes.set(log.subject_id, new Map());
          }
          const topicMap = subjectTopicMinutes.get(log.subject_id)!;
          topicMap.set(log.topic_id, (topicMap.get(log.topic_id) || 0) + log.duration_minutes);
        }
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

    // Fetch all topic names upfront
    const allTopicIds = new Set<string>();
    for (const topicMap of subjectTopicMinutes.values()) {
      for (const tid of topicMap.keys()) allTopicIds.add(tid);
    }
    let topicNameMap = new Map<string, string>();
    if (allTopicIds.size > 0) {
      const { data: topicsData } = await supabase
        .from("topics")
        .select("id, name")
        .in("id", [...allTopicIds]);
      topicNameMap = new Map((topicsData || []).map((t) => [t.id, t.name]));
    }

    // Build pre-resolved topic details per subject
    const resolvedTopics = new Map<string, TopicDetail[]>();
    for (const [subjectId, topicMap] of subjectTopicMinutes.entries()) {
      const details: TopicDetail[] = [...topicMap.entries()]
        .map(([tid, mins]) => ({ name: topicNameMap.get(tid) || "Unknown", minutes: mins }))
        .sort((a, b) => b.minutes - a.minutes);
      resolvedTopics.set(subjectId, details);
    }
    setTopicDetails(resolvedTopics);

    const subjectList: SubjectBreakdown[] = [...subjectMinutes.entries()]
      .map(([id, mins], i) => ({
        id,
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

  const toggleSubject = (subjectId: string) => {
    setExpandedSubject((prev) => (prev === subjectId ? null : subjectId));
  };

  const saveGoal = async () => {
    const hours = parseFloat(goalInput);
    if (isNaN(hours) || hours <= 0) return;
    const mins = Math.round(hours * 60);
    setGoalMinutes(mins);
    setEditingGoal(false);
    if (user) {
      await supabase.from("profiles").update({ weekly_focus_goal_minutes: mins }).eq("id", user.id);
      toast({ title: "Goal updated! 🎯", description: `Weekly target set to ${hours}h` });
    }
  };

  const totalMinutes = days.reduce((s, d) => s + d.minutes, 0);
  const maxMinutes = Math.max(...days.map((d) => d.minutes), 1);
  const activeDays = days.filter((d) => d.minutes > 0).length;
  const goalProgress = Math.min((totalMinutes / goalMinutes) * 100, 100);
  const goalHours = goalMinutes / 60;

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

      {/* Weekly Goal Progress */}
      <div className="mb-4 p-3 rounded-xl border border-border bg-secondary/30">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Target className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-semibold text-foreground">Weekly Goal</span>
          </div>
          {editingGoal ? (
            <form onSubmit={(e) => { e.preventDefault(); saveGoal(); }} className="flex items-center gap-1.5">
              <input
                type="number"
                step="0.5"
                min="0.5"
                value={goalInput}
                onChange={(e) => setGoalInput(e.target.value)}
                autoFocus
                className="w-16 rounded-md bg-secondary border border-border px-2 py-0.5 text-xs text-foreground text-center focus:outline-none focus:ring-1 focus:ring-primary/50"
                placeholder="hrs"
              />
              <span className="text-[10px] text-muted-foreground">hrs</span>
              <button type="submit" className="p-0.5 text-success hover:text-success/80">
                <Check className="w-3.5 h-3.5" />
              </button>
            </form>
          ) : (
            <button
              onClick={() => { setEditingGoal(true); setGoalInput(String(goalHours)); }}
              className="flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
            >
              {goalHours}h target
              <Pencil className="w-2.5 h-2.5" />
            </button>
          )}
        </div>
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className={`h-full rounded-full transition-colors ${
              goalProgress >= 100 ? "bg-success" : goalProgress >= 60 ? "bg-primary" : "bg-warning"
            }`}
            initial={{ width: 0 }}
            animate={{ width: `${goalProgress}%` }}
            transition={{ duration: 0.8, delay: 0.2 }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[10px] text-muted-foreground">
            {totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`} done
          </span>
          <span className={`text-[10px] font-medium ${goalProgress >= 100 ? "text-success" : "text-muted-foreground"}`}>
            {goalProgress >= 100 ? "🎉 Goal reached!" : `${Math.round(goalProgress)}%`}
          </span>
        </div>

        {/* Congratulations animation */}
        <AnimatePresence>
          {goalProgress >= 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, height: 0 }}
              animate={{ opacity: 1, scale: 1, height: "auto" }}
              exit={{ opacity: 0, scale: 0.8, height: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 20 }}
              className="overflow-hidden"
            >
              <div className="mt-2 p-3 rounded-xl bg-success/10 border border-success/30 text-center">
                <motion.div
                  animate={{ rotate: [0, -10, 10, -10, 10, 0] }}
                  transition={{ duration: 0.6, delay: 0.3 }}
                  className="text-2xl mb-1"
                >
                  🏆
                </motion.div>
                <p className="text-xs font-semibold text-success">Congratulations!</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  You crushed your {goalHours}h weekly focus goal!
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
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
            <span className="text-[10px] text-muted-foreground ml-auto">Tap to expand</span>
          </div>

          {/* Stacked bar */}
          <div className="h-3 rounded-full overflow-hidden flex bg-secondary mb-3">
            {subjects.map((s, i) => (
              <motion.div
                key={s.id}
                className={`h-full ${s.color} cursor-pointer`}
                initial={{ width: 0 }}
                animate={{ width: `${(s.minutes / totalMinutes) * 100}%` }}
                transition={{ duration: 0.6, delay: 0.3 + i * 0.08 }}
                onClick={() => toggleSubject(s.id)}
              />
            ))}
          </div>

          {/* Legend with expandable topics */}
          <div className="space-y-1">
            {subjects.map((s, i) => {
              const pct = Math.round((s.minutes / totalMinutes) * 100);
              const isExpanded = expandedSubject === s.id;
              const topics = topicDetails.get(s.id) || [];

              return (
                <div key={s.id}>
                  <button
                    onClick={() => toggleSubject(s.id)}
                    className={`w-full flex items-center gap-2 p-1.5 rounded-lg transition-colors ${
                      isExpanded ? "bg-secondary/50" : "hover:bg-secondary/30"
                    }`}
                  >
                    <div className={`w-2.5 h-2.5 rounded-sm ${s.color} shrink-0`} />
                    <span className="text-xs text-foreground flex-1 truncate text-left">{s.name}</span>
                    <span className="text-[10px] text-muted-foreground shrink-0">
                      {s.minutes >= 60 ? `${Math.floor(s.minutes / 60)}h ${s.minutes % 60}m` : `${s.minutes}m`}
                    </span>
                    <span className="text-[10px] text-muted-foreground w-8 text-right shrink-0">{pct}%</span>
                    {topics.length > 0 ? (
                      isExpanded ? <ChevronUp className="w-3 h-3 text-muted-foreground shrink-0" /> : <ChevronDown className="w-3 h-3 text-muted-foreground shrink-0" />
                    ) : (
                      <div className="w-3 shrink-0" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && topics.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-5 pl-3 border-l-2 border-border space-y-1 py-1.5">
                          {topics.map((t) => (
                            <div key={t.name} className="flex items-center gap-2">
                              <FileText className="w-2.5 h-2.5 text-muted-foreground shrink-0" />
                              <span className="text-[11px] text-muted-foreground flex-1 truncate">{t.name}</span>
                              <span className="text-[10px] text-muted-foreground shrink-0">
                                {t.minutes}m
                              </span>
                            </div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                    {isExpanded && topics.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="ml-5 pl-3 border-l-2 border-border text-[10px] text-muted-foreground py-1.5">
                          No specific topics logged
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
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
