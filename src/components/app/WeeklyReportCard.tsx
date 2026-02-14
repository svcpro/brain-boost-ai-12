import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { FileText, Clock, BookOpen, Brain, TrendingUp, TrendingDown, Minus, Share2, Download, RotateCcw, Target } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";
import html2canvas from "html2canvas";

interface ReportData {
  totalMinutes: number;
  sessionCount: number;
  daysStudied: number;
  topicsStudied: number;
  newTopics: number;
  avgStrengthNow: number;
  avgStrengthBefore: number;
  topSubjects: { name: string; minutes: number }[];
  reviewSessionCount: number;
  totalTopicsDue: number;
  reviewCompletionRate: number;
  dailyGoalMetDays: number;
  dailyGoalMinutes: number;
  memoryTrend: { day: string; avgStrength: number }[];
}

const WeeklyReportCard = () => {
  const { user } = useAuth();
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const captureCard = useCallback(async (): Promise<Blob | null> => {
    if (!cardRef.current) return null;
    const canvas = await html2canvas(cardRef.current, {
      backgroundColor: "#0f1419",
      scale: 2,
      useCORS: true,
    });
    return new Promise((resolve) => canvas.toBlob((blob) => resolve(blob), "image/png"));
  }, []);

  const handleDownload = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acry-weekly-report-${new Date().toISOString().slice(0, 10)}.png`;
      a.click();
      URL.revokeObjectURL(url);
      toast({ title: "📥 Report downloaded!", description: "Your weekly report card has been saved." });
    } catch {
      toast({ title: "Failed to download", description: "Could not capture the report card.", variant: "destructive" });
    } finally {
      setSharing(false);
    }
  }, [captureCard]);

  const handleShare = useCallback(async () => {
    setSharing(true);
    try {
      const blob = await captureCard();
      if (!blob) return;
      const file = new File([blob], "acry-weekly-report.png", { type: "image/png" });

      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          title: "My ACRY Weekly Report",
          text: "Check out my study progress this week! 🧠",
          files: [file],
        });
      } else {
        // Fallback: copy image to clipboard
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        toast({ title: "📋 Copied to clipboard!", description: "Report card image copied. Paste it anywhere to share." });
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") {
        toast({ title: "Could not share", description: "Try downloading instead.", variant: "destructive" });
      }
    } finally {
      setSharing(false);
    }
  }, [captureCard]);

  const loadReport = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    const now = new Date();
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);
    const twoWeeksAgo = new Date(now);
    twoWeeksAgo.setDate(twoWeeksAgo.getDate() - 14);

    // Fetch this week's study logs
    const { data: logs } = await supabase
      .from("study_logs")
      .select("duration_minutes, created_at, topic_id, subject_id, study_mode")
      .eq("user_id", user.id)
      .gte("created_at", weekAgo.toISOString())
      .order("created_at", { ascending: true });

    // Fetch daily goal
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_study_goal_minutes")
      .eq("id", user.id)
      .maybeSingle();
    const dailyGoalMinutes = profile?.daily_study_goal_minutes ?? 60;

    // Fetch subjects for names
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id);

    // Fetch current topic strengths
    const { data: topics } = await supabase
      .from("topics")
      .select("id, memory_strength, created_at")
      .eq("user_id", user.id);

    // Fetch memory_scores from this week for daily trend
    const { data: weekScores } = await supabase
      .from("memory_scores")
      .select("score, recorded_at")
      .eq("user_id", user.id)
      .gte("recorded_at", weekAgo.toISOString())
      .order("recorded_at", { ascending: true });

    // Fetch memory_scores from a week ago for comparison
    const { data: oldScores } = await supabase
      .from("memory_scores")
      .select("topic_id, score")
      .eq("user_id", user.id)
      .lte("recorded_at", weekAgo.toISOString())
      .order("recorded_at", { ascending: false });

    if (!logs || !subjects || !topics) {
      setLoading(false);
      return;
    }

    const subjectMap = new Map(subjects.map((s) => [s.id, s.name]));

    const totalMinutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
    const sessionCount = logs.length;

    // Days studied
    const daySet = new Set<string>();
    for (const l of logs) {
      const d = new Date(l.created_at);
      daySet.add(`${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`);
    }

    // Unique topics studied
    const topicSet = new Set(logs.filter((l) => l.topic_id).map((l) => l.topic_id));

    // New topics created this week
    const newTopics = topics.filter((t) => new Date(t.created_at) >= weekAgo).length;

    // Current avg strength
    const avgStrengthNow = topics.length > 0
      ? Math.round(topics.reduce((s, t) => s + Number(t.memory_strength), 0) / topics.length)
      : 0;

    // Previous avg strength from memory_scores
    let avgStrengthBefore = avgStrengthNow;
    if (oldScores && oldScores.length > 0) {
      // Get latest score per topic from before the week
      const latestPerTopic = new Map<string, number>();
      for (const s of oldScores) {
        if (!latestPerTopic.has(s.topic_id)) {
          latestPerTopic.set(s.topic_id, Number(s.score));
        }
      }
      if (latestPerTopic.size > 0) {
        avgStrengthBefore = Math.round(
          Array.from(latestPerTopic.values()).reduce((a, b) => a + b, 0) / latestPerTopic.size
        );
      }
    }

    // Top subjects by time
    const subjectMinutes = new Map<string, number>();
    for (const l of logs) {
      if (l.subject_id) {
        subjectMinutes.set(l.subject_id, (subjectMinutes.get(l.subject_id) || 0) + l.duration_minutes);
      }
    }
    const topSubjects = Array.from(subjectMinutes.entries())
      .map(([id, minutes]) => ({ name: subjectMap.get(id) || "Unknown", minutes }))
      .sort((a, b) => b.minutes - a.minutes)
      .slice(0, 4);

    // Review completion rate
    const reviewSessionCount = logs.filter((l) => l.study_mode === "review").length;
    const uniqueTopicsWithLogs = new Set(logs.filter((l) => l.topic_id).map((l) => l.topic_id)).size;
    const totalTopicsDue = topics.filter((t) => {
      if (!t.memory_strength) return false;
      return Number(t.memory_strength) < 70;
    }).length;
    const reviewCompletionRate = totalTopicsDue > 0
      ? Math.min(100, Math.round((reviewSessionCount / totalTopicsDue) * 100))
      : 100;

    // Daily goal met days
    const dailyTotals: Record<string, number> = {};
    for (const l of logs) {
      const d = new Date(l.created_at).toLocaleDateString("en-CA");
      dailyTotals[d] = (dailyTotals[d] || 0) + l.duration_minutes;
    }
    const dailyGoalMetDays = Object.values(dailyTotals).filter((m) => m >= dailyGoalMinutes).length;

    // Memory trend (daily avg strength from memory_scores)
    const memoryTrend: { day: string; avgStrength: number }[] = [];
    const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString("en-CA");
      const dayScores = (weekScores || []).filter((s) => s.recorded_at.startsWith(dateStr));
      const avg = dayScores.length > 0
        ? Math.round(dayScores.reduce((sum, s) => sum + Number(s.score), 0) / dayScores.length)
        : -1; // -1 means no data
      memoryTrend.push({ day: dayNames[d.getDay()], avgStrength: avg });
    }

    setReport({
      totalMinutes,
      sessionCount,
      daysStudied: daySet.size,
      topicsStudied: topicSet.size,
      newTopics,
      avgStrengthNow,
      avgStrengthBefore,
      topSubjects,
      reviewSessionCount,
      totalTopicsDue,
      reviewCompletionRate,
      dailyGoalMetDays,
      dailyGoalMinutes,
      memoryTrend,
    });
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadReport();
  }, [loadReport]);

  if (loading) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Weekly Report Card</h2>
        </div>
        <p className="text-sm text-muted-foreground text-center py-4">Loading report…</p>
      </motion.div>
    );
  }

  if (!report) return null;

  const hours = Math.floor(report.totalMinutes / 60);
  const mins = report.totalMinutes % 60;
  const strengthDelta = report.avgStrengthNow - report.avgStrengthBefore;
  const hasActivity = report.sessionCount > 0;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <FileText className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Weekly Report Card</h2>
        <div className="ml-auto flex items-center gap-1.5">
          {hasActivity && (
            <>
              <button
                onClick={handleDownload}
                disabled={sharing}
                className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all disabled:opacity-50"
                title="Download as image"
              >
                <Download className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
              <button
                onClick={handleShare}
                disabled={sharing}
                className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all disabled:opacity-50"
                title="Share report"
              >
                <Share2 className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </>
          )}
          <span className="text-[10px] text-muted-foreground">Last 7 days</span>
        </div>
      </div>

      {!hasActivity ? (
        <p className="text-sm text-muted-foreground text-center py-4">No study sessions this week. Start studying to see your report!</p>
      ) : (
        <div className="space-y-4">
          {/* Stat Grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              {
                icon: Clock,
                label: "Time Spent",
                value: hours > 0 ? `${hours}h ${mins}m` : `${mins}m`,
                sub: `${report.sessionCount} sessions`,
              },
              {
                icon: BookOpen,
                label: "Topics",
                value: String(report.topicsStudied),
                sub: report.newTopics > 0 ? `+${report.newTopics} new` : "reviewed",
              },
              {
                icon: Brain,
                label: "Memory",
                value: `${report.avgStrengthNow}%`,
                sub: strengthDelta > 0 ? `+${strengthDelta}%` : strengthDelta < 0 ? `${strengthDelta}%` : "no change",
                deltaColor: strengthDelta > 0 ? "text-success" : strengthDelta < 0 ? "text-destructive" : "text-muted-foreground",
              },
            ].map((stat, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: 0.2 + i * 0.08 }}
                className="flex flex-col items-center p-3 rounded-lg bg-secondary/30 border border-border/50"
              >
                <stat.icon className="w-4 h-4 text-primary mb-1.5" />
                <span className="text-lg font-bold text-foreground">{stat.value}</span>
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
                <span className={`text-[9px] mt-0.5 font-medium ${"deltaColor" in stat ? stat.deltaColor : "text-muted-foreground"}`}>
                  {stat.sub}
                </span>
              </motion.div>
            ))}
          </div>

          {/* Consistency */}
          <div>
            <div className="flex justify-between mb-1.5">
              <span className="text-xs text-foreground">Weekly Consistency</span>
              <span className="text-xs text-muted-foreground">{report.daysStudied}/7 days</span>
            </div>
            <div className="flex gap-1">
              {Array.from({ length: 7 }).map((_, i) => (
                <motion.div
                  key={i}
                  initial={{ scaleY: 0 }}
                  animate={{ scaleY: 1 }}
                  transition={{ duration: 0.3, delay: 0.3 + i * 0.04 }}
                  className={`flex-1 h-2 rounded-full ${i < report.daysStudied ? "bg-primary/70" : "bg-secondary"}`}
                />
              ))}
            </div>
          </div>

          {/* Review Completion & Goal Achievement */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col items-center p-3 rounded-lg bg-secondary/30 border border-border/50">
              <RotateCcw className="w-4 h-4 text-primary mb-1.5" />
              <span className="text-lg font-bold text-foreground">{report.reviewCompletionRate}%</span>
              <span className="text-[10px] text-muted-foreground">Review Rate</span>
              <span className="text-[9px] mt-0.5 text-muted-foreground">
                {report.reviewSessionCount} of {report.totalTopicsDue} due
              </span>
            </div>
            <div className="flex flex-col items-center p-3 rounded-lg bg-secondary/30 border border-border/50">
              <Target className="w-4 h-4 text-primary mb-1.5" />
              <span className="text-lg font-bold text-foreground">{report.dailyGoalMetDays}/7</span>
              <span className="text-[10px] text-muted-foreground">Goals Met</span>
              <span className="text-[9px] mt-0.5 text-muted-foreground">
                {report.dailyGoalMinutes}min daily target
              </span>
            </div>
          </div>

          {/* Memory Strength Trend (mini chart) */}
          {report.memoryTrend.some((d) => d.avgStrength >= 0) && (
            <div>
              <p className="text-xs text-foreground mb-2">Memory Trend</p>
              <div className="flex items-end gap-1 h-16">
                {report.memoryTrend.map((d, i) => {
                  const hasData = d.avgStrength >= 0;
                  const height = hasData ? Math.max(d.avgStrength, 5) : 5;
                  const color = hasData
                    ? d.avgStrength >= 70 ? "bg-success/50" : d.avgStrength >= 40 ? "bg-warning/50" : "bg-destructive/50"
                    : "bg-secondary";
                  return (
                    <div key={i} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        className={`w-full rounded-t ${color}`}
                        initial={{ height: 0 }}
                        animate={{ height: `${height}%` }}
                        transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                      />
                      <span className="text-[9px] text-muted-foreground">{d.day}</span>
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[9px] text-muted-foreground">Avg memory %</span>
                <span className="text-[9px] text-muted-foreground">
                  {(() => {
                    const valid = report.memoryTrend.filter((d) => d.avgStrength >= 0);
                    return valid.length > 0
                      ? `${Math.round(valid.reduce((s, d) => s + d.avgStrength, 0) / valid.length)}% avg`
                      : "";
                  })()}
                </span>
              </div>
            </div>
          )}

          {/* Top Subjects */}
          {report.topSubjects.length > 0 && (
            <div>
              <p className="text-xs text-foreground mb-2">Top Subjects</p>
              <div className="space-y-2">
                {report.topSubjects.map((sub, i) => {
                  const maxMins = report.topSubjects[0].minutes;
                  return (
                    <div key={i}>
                      <div className="flex justify-between mb-1">
                        <span className="text-[11px] text-foreground">{sub.name}</span>
                        <span className="text-[10px] text-muted-foreground">
                          {sub.minutes >= 60 ? `${Math.floor(sub.minutes / 60)}h ${sub.minutes % 60}m` : `${sub.minutes}m`}
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-secondary">
                        <motion.div
                          className="h-full rounded-full bg-primary/50"
                          initial={{ width: 0 }}
                          animate={{ width: `${(sub.minutes / maxMins) * 100}%` }}
                          transition={{ duration: 0.6, delay: 0.4 + i * 0.08 }}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Memory Trend */}
          <div className="flex items-center gap-2 p-3 rounded-lg border border-border/50 bg-secondary/20">
            {strengthDelta > 0 ? (
              <TrendingUp className="w-4 h-4 text-success" />
            ) : strengthDelta < 0 ? (
              <TrendingDown className="w-4 h-4 text-destructive" />
            ) : (
              <Minus className="w-4 h-4 text-muted-foreground" />
            )}
            <p className="text-[11px] text-foreground">
              {strengthDelta > 0
                ? `Memory improved by ${strengthDelta}% this week. Great progress! 🚀`
                : strengthDelta < 0
                ? `Memory dropped by ${Math.abs(strengthDelta)}%. Consider reviewing weak topics.`
                : "Memory strength held steady this week. Keep studying to improve!"}
            </p>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default WeeklyReportCard;
