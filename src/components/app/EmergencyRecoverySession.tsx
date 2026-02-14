import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { AlertOctagon, X, Zap, Calendar, Brain, Loader2, CheckCircle, Circle, ChevronDown, ChevronUp, RotateCcw, BookOpen, Lightbulb, Save } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useToast } from "@/hooks/use-toast";

interface EmergencyRecoverySessionProps {
  open: boolean;
  onClose: () => void;
}

interface RescueSession {
  topic: string;
  subject: string;
  duration_minutes: number;
  mode: string;
  reason: string;
}

interface RescueDay {
  day_name: string;
  date: string;
  focus: string;
  total_minutes: number;
  sessions: RescueSession[];
}

interface RescuePlan {
  summary: string;
  days: RescueDay[];
}

type ViewState = "overview" | "generating" | "plan";

const modeConfig: Record<string, { icon: typeof BookOpen; color: string; bg: string }> = {
  review: { icon: RotateCcw, color: "text-primary", bg: "bg-primary/10" },
  "deep-study": { icon: BookOpen, color: "text-warning", bg: "bg-warning/10" },
  practice: { icon: Zap, color: "text-success", bg: "bg-success/10" },
  "light-review": { icon: Lightbulb, color: "text-muted-foreground", bg: "bg-secondary" },
};

const EmergencyRecoverySession = ({ open, onClose }: EmergencyRecoverySessionProps) => {
  const { prediction, predict } = useMemoryEngine();
  const { user } = useAuth();
  const { toast } = useToast();

  const [view, setView] = useState<ViewState>("overview");
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(null);
  const [examDate, setExamDate] = useState<string | null>(null);
  const [atRiskTopics, setAtRiskTopics] = useState<TopicPrediction[]>([]);
  const [rescuePlan, setRescuePlan] = useState<RescuePlan | null>(null);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [completedSessions, setCompletedSessions] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (open) {
      setView("overview");
      setRescuePlan(null);
      setCompletedSessions(new Set());
      setSaved(false);
      loadData();
    }
  }, [open]);

  const loadData = async () => {
    // Load exam date
    if (user) {
      try {
        const { data } = await supabase
          .from("profiles")
          .select("exam_date")
          .eq("id", user.id)
          .maybeSingle();
        if (data?.exam_date) {
          setExamDate(data.exam_date);
          const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
          setExamDaysLeft(Math.max(0, days));
        } else {
          setExamDaysLeft(null);
          setExamDate(null);
        }
      } catch {}
    }

    // Load at-risk topics
    let pred = prediction;
    if (!pred) {
      pred = await predict();
    }
    if (pred?.at_risk) {
      setAtRiskTopics(pred.at_risk);
    } else if (pred?.topics) {
      const sorted = [...pred.topics].sort((a, b) => a.memory_strength - b.memory_strength);
      setAtRiskTopics(sorted.slice(0, 5));
    }
  };

  const generateRescuePlan = async () => {
    setView("generating");
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not logged in", variant: "destructive" });
        setView("overview");
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-engine`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "generate_plan" }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data = await response.json();
      setRescuePlan(data.plan);
      setView("plan");
      toast({ title: "Rescue plan ready! 🚨" });
    } catch (e: any) {
      toast({ title: "Failed to generate rescue plan", description: e.message, variant: "destructive" });
      setView("overview");
    }
  };

  const saveRescuePlan = async () => {
    if (!rescuePlan || !user) return;
    setSaving(true);
    try {
      const { data: newPlan, error: planErr } = await supabase
        .from("study_plans")
        .insert({ user_id: user.id, summary: `🚨 Emergency: ${rescuePlan.summary}` })
        .select("id")
        .single();
      if (planErr || !newPlan) throw planErr || new Error("Failed to save");

      const sessionRows = rescuePlan.days.flatMap((day, dayIdx) =>
        day.sessions.map((s) => ({
          plan_id: newPlan.id,
          user_id: user.id,
          day_index: dayIdx,
          day_name: day.day_name,
          day_date: day.date,
          day_focus: day.focus,
          topic: s.topic,
          subject: s.subject,
          duration_minutes: s.duration_minutes,
          mode: s.mode,
          reason: s.reason,
        }))
      );

      const { error: sessErr } = await supabase.from("plan_sessions").insert(sessionRows);
      if (sessErr) throw sessErr;

      setSaved(true);
      toast({ title: "Rescue plan saved! ✅", description: "View it in your AI Study Planner." });
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };


  const toggleSession = (dayIdx: number, sessionIdx: number) => {
    const key = `${dayIdx}-${sessionIdx}`;
    setCompletedSessions((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!open) return null;

  const totalSessions = rescuePlan?.days.reduce((s, d) => s + d.sessions.length, 0) ?? 0;
  const completedCount = completedSessions.size;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center bg-background/95 backdrop-blur-md p-4"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.9, opacity: 0 }}
          className="w-full max-w-sm glass rounded-2xl neural-border relative max-h-[90vh] flex flex-col"
        >
          {/* Close */}
          <button onClick={onClose} className="absolute top-4 right-4 p-1 rounded-lg hover:bg-secondary transition-colors z-10">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>

          {/* Header */}
          <div className="p-6 pb-0">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2.5 rounded-xl bg-destructive/10 neural-border">
                <AlertOctagon className="w-5 h-5 text-destructive" />
              </div>
              <div>
                <h2 className="font-bold text-foreground">Emergency Recovery</h2>
                <p className="text-xs text-muted-foreground">Rapid rescue mode</p>
              </div>
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto px-6 pb-6 space-y-4">
            {/* Overview */}
            {view === "overview" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {/* Exam countdown */}
                <div className={`rounded-xl p-4 border ${
                  examDaysLeft !== null && examDaysLeft <= 7
                    ? "border-destructive/30 bg-destructive/5"
                    : "border-border bg-secondary/30"
                }`}>
                  <div className="flex items-center gap-2 mb-2">
                    <Calendar className="w-4 h-4 text-destructive" />
                    <span className="text-xs font-medium text-foreground">Exam Countdown</span>
                  </div>
                  {examDaysLeft !== null ? (
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-bold text-destructive">{examDaysLeft}</span>
                      <span className="text-sm text-muted-foreground">days left</span>
                      {examDaysLeft <= 7 && (
                        <span className="ml-auto px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-semibold animate-pulse">
                          URGENT
                        </span>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No exam date set. Go to profile to set one.</p>
                  )}
                </div>

                {/* At-risk topics */}
                <div className="rounded-xl border border-border bg-secondary/30 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-warning" />
                    <span className="text-xs font-medium text-foreground">Critical Topics</span>
                    <span className="ml-auto text-[10px] text-destructive font-medium">{atRiskTopics.length} at risk</span>
                  </div>
                  {atRiskTopics.length > 0 ? (
                    <div className="space-y-2">
                      {atRiskTopics.slice(0, 5).map((topic) => (
                        <div key={topic.id} className="flex items-center gap-3">
                          <div className={`w-2 h-2 rounded-full shrink-0 ${
                            topic.risk_level === "critical" ? "bg-destructive animate-pulse" : "bg-warning"
                          }`} />
                          <div className="flex-1 min-w-0">
                            <p className="text-xs text-foreground truncate">{topic.name}</p>
                            <p className="text-[10px] text-muted-foreground">{topic.subject_name}</p>
                          </div>
                          <span className="text-[10px] font-medium text-destructive">{Math.round(topic.memory_strength)}%</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-muted-foreground text-center py-2">No topics tracked yet.</p>
                  )}
                </div>

                {/* Generate button */}
                <button
                  onClick={generateRescuePlan}
                  className="w-full flex items-center justify-center gap-2 py-3.5 rounded-xl bg-destructive text-destructive-foreground font-semibold transition-all hover:brightness-110 active:scale-95"
                >
                  <Zap className="w-4 h-4" /> Generate Rescue Plan
                </button>
              </motion.div>
            )}

            {/* Generating */}
            {view === "generating" && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-12 gap-4">
                <div className="relative">
                  <Loader2 className="w-10 h-10 text-destructive animate-spin" />
                  <AlertOctagon className="w-4 h-4 text-destructive absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">Analyzing your brain data...</p>
                  <p className="text-xs text-muted-foreground mt-1">Building your rapid rescue strategy</p>
                </div>
              </motion.div>
            )}

            {/* Plan */}
            {view === "plan" && rescuePlan && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
                {/* Summary */}
                <div className="rounded-xl border border-destructive/20 bg-destructive/5 p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Zap className="w-4 h-4 text-destructive" />
                      <span className="text-xs font-semibold text-foreground">Rescue Strategy</span>
                    </div>
                    <button
                      onClick={saveRescuePlan}
                      disabled={saving || saved}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-destructive text-destructive-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
                    >
                      {saved ? <CheckCircle className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                      {saving ? "Saving..." : saved ? "Saved" : "Save Plan"}
                    </button>
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed">{rescuePlan.summary}</p>
                  {/* Progress */}
                  <div className="flex items-center gap-3 mt-3">
                    <div className="flex-1 h-2 rounded-full bg-secondary">
                      <motion.div
                        className="h-full rounded-full bg-gradient-to-r from-destructive to-warning"
                        initial={{ width: 0 }}
                        animate={{ width: `${totalSessions > 0 ? (completedCount / totalSessions) * 100 : 0}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-medium text-foreground">{completedCount}/{totalSessions}</span>
                  </div>
                </div>

                {/* Days */}
                {rescuePlan.days.map((day, dayIdx) => {
                  const isExpanded = expandedDay === dayIdx;
                  const dayCompleted = day.sessions.every((_, sIdx) => completedSessions.has(`${dayIdx}-${sIdx}`));

                  return (
                    <motion.div
                      key={dayIdx}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: dayIdx * 0.05 }}
                      className={`glass rounded-xl neural-border overflow-hidden ${dayCompleted ? "opacity-60" : ""} ${dayIdx === 0 ? "ring-1 ring-destructive/30" : ""}`}
                    >
                      <button
                        onClick={() => setExpandedDay(isExpanded ? null : dayIdx)}
                        className="w-full p-4 flex items-center gap-3 text-left"
                      >
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                          dayCompleted ? "bg-success/20 text-success" : dayIdx === 0 ? "bg-destructive text-destructive-foreground" : "bg-secondary text-foreground"
                        }`}>
                          {dayCompleted ? <CheckCircle className="w-5 h-5" /> : day.day_name.slice(0, 3)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">{day.focus}</p>
                          <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                            <span>{day.total_minutes} min</span>
                            <span>•</span>
                            <span>{day.sessions.length} sessions</span>
                          </div>
                        </div>
                        {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                      </button>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="px-4 pb-4 space-y-2">
                              {day.sessions.map((session, sIdx) => {
                                const config = modeConfig[session.mode] || modeConfig.review;
                                const Icon = config.icon;
                                const isDone = completedSessions.has(`${dayIdx}-${sIdx}`);

                                return (
                                  <button
                                    key={sIdx}
                                    onClick={() => toggleSession(dayIdx, sIdx)}
                                    className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                                      isDone
                                        ? "bg-success/5 border-success/20 opacity-70"
                                        : "bg-secondary/30 border-border hover:border-destructive/30"
                                    }`}
                                  >
                                    {isDone ? (
                                      <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                                    ) : (
                                      <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                                    )}
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center justify-between">
                                        <p className={`text-xs font-medium truncate ${isDone ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                          {session.topic}
                                        </p>
                                        <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{session.duration_minutes}m</span>
                                      </div>
                                      <p className="text-[10px] text-muted-foreground">{session.subject} • {session.mode}</p>
                                      {session.reason && (
                                        <p className="text-[10px] text-muted-foreground/70 mt-1 italic">{session.reason}</p>
                                      )}
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  );
                })}

                {/* Regenerate */}
                <button
                  onClick={generateRescuePlan}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-destructive/30 bg-destructive/5 text-destructive text-sm font-medium transition-all hover:bg-destructive/10 active:scale-95"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Regenerate Plan
                </button>
              </motion.div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default EmergencyRecoverySession;
