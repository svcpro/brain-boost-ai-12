import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Sparkles, Clock, BookOpen, RotateCcw, ChevronDown, ChevronUp, Lightbulb, Zap, Save, CheckCircle, Circle, Trash2, History, Bell, BellOff, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { usePlanSessionReminders } from "@/hooks/usePlanSessionReminders";

interface Session {
  topic: string;
  subject: string;
  duration_minutes: number;
  mode: string;
  reason: string;
}

interface PlanDay {
  day_name: string;
  date: string;
  focus: string;
  total_minutes: number;
  sessions: Session[];
}

interface StudyPlan {
  summary: string;
  days: PlanDay[];
}

interface SavedSession {
  id: string;
  day_index: number;
  day_name: string;
  topic: string;
  subject: string;
  duration_minutes: number;
  mode: string;
  reason: string | null;
  completed: boolean;
}

interface SavedPlan {
  id: string;
  summary: string;
  created_at: string;
  sessions: SavedSession[];
}

const modeConfig: Record<string, { icon: typeof BookOpen; color: string; bg: string }> = {
  "review": { icon: RotateCcw, color: "text-primary", bg: "bg-primary/10" },
  "deep-study": { icon: BookOpen, color: "text-warning", bg: "bg-warning/10" },
  "practice": { icon: Zap, color: "text-success", bg: "bg-success/10" },
  "light-review": { icon: Lightbulb, color: "text-muted-foreground", bg: "bg-secondary" },
};

const StudyPlanGenerator = () => {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [rlSignals, setRlSignals] = useState<Record<string, any> | null>(null);
  const [savedPlan, setSavedPlan] = useState<SavedPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const [showSaved, setShowSaved] = useState(true);
  const [remindersOn, setRemindersOn] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const { startReminders, stopReminders, requestPermission } = usePlanSessionReminders();

  const CACHE_KEY = "offline-saved-plan";

  const loadSavedPlan = useCallback(async () => {
    if (!user) return;

    // Try loading from cache first for instant display
    const cached = localStorage.getItem(CACHE_KEY);
    if (cached) {
      try {
        setSavedPlan(JSON.parse(cached));
      } catch {}
    }

    try {
      const { data: plans, error: plansErr } = await supabase
        .from("study_plans")
        .select("id, summary, created_at")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1);

      if (plansErr) throw plansErr;

      if (plans && plans.length > 0) {
        const p = plans[0];
        const { data: sessions, error: sessErr } = await supabase
          .from("plan_sessions")
          .select("id, day_index, day_name, topic, subject, duration_minutes, mode, reason, completed")
          .eq("plan_id", p.id)
          .order("day_index", { ascending: true });

        if (sessErr) throw sessErr;

        const freshPlan = { ...p, sessions: sessions || [] };
        setSavedPlan(freshPlan);
        localStorage.setItem(CACHE_KEY, JSON.stringify(freshPlan));
      } else {
        setSavedPlan(null);
        localStorage.removeItem(CACHE_KEY);
      }
    } catch {
      // Offline – cached data (if any) is already set above
      if (!cached) setSavedPlan(null);
    }
  }, [user]);

  useEffect(() => { loadSavedPlan(); }, [loadSavedPlan]);

  const generatePlan = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { toast({ title: "Not logged in", variant: "destructive" }); return; }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-engine`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${session.access_token}` },
          body: JSON.stringify({ action: "generate_plan" }),
        }
      );
      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error ${response.status}`);
      }
      const data = await response.json();
      setPlan(data.plan);
      setRlSignals(data.rl_signals || null);
      setShowSaved(false);
      setExpandedDay(0);
      toast({ title: "Study plan generated! 🧠" });
    } catch (e: any) {
      toast({ title: "Failed to generate plan", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const savePlan = async () => {
    if (!plan || !user) return;
    setSaving(true);
    try {
      // Delete old plan if exists
      if (savedPlan) {
        await supabase.from("study_plans").delete().eq("id", savedPlan.id);
      }

      const { data: newPlan, error: planErr } = await supabase
        .from("study_plans")
        .insert({ user_id: user.id, summary: plan.summary })
        .select("id")
        .single();
      if (planErr || !newPlan) throw planErr || new Error("Failed to save");

      const sessionRows = plan.days.flatMap((day, dayIdx) =>
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

      // Save RL quality log for this plan
      const totalSessions = sessionRows.length;
      await supabase.from("plan_quality_logs").insert({
        user_id: user.id,
        plan_id: newPlan.id,
        rl_signals: rlSignals || {},
        sessions_total: totalSessions,
        sessions_completed: 0,
        overall_completion_rate: 0,
      });

      toast({ title: "Plan saved! ✅" });
      setPlan(null);
      setRlSignals(null);
      setShowSaved(true);
      await loadSavedPlan();
    } catch (e: any) {
      toast({ title: "Failed to save", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleSession = async (sessionId: string, currentCompleted: boolean) => {
    const newCompleted = !currentCompleted;
    await supabase
      .from("plan_sessions")
      .update({ completed: newCompleted, completed_at: newCompleted ? new Date().toISOString() : null })
      .eq("id", sessionId);

    setSavedPlan((prev) => {
      if (!prev) return prev;
      const updated = {
        ...prev,
        sessions: prev.sessions.map((s) => s.id === sessionId ? { ...s, completed: newCompleted } : s),
      };
      localStorage.setItem(CACHE_KEY, JSON.stringify(updated));

      // Update plan quality log with latest completion rate
      const completedCount = updated.sessions.filter((s) => s.completed).length;
      const totalCount = updated.sessions.length;
      const rate = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
      supabase
        .from("plan_quality_logs")
        .update({ sessions_completed: completedCount, overall_completion_rate: rate })
        .eq("plan_id", prev.id)
        .then(() => {});

      return updated;
    });
  };

  const deleteSavedPlan = async () => {
    if (!savedPlan) return;
    await supabase.from("study_plans").delete().eq("id", savedPlan.id);
    setSavedPlan(null);
    localStorage.removeItem(CACHE_KEY);
    toast({ title: "Plan deleted" });
  };

  // Group saved sessions by day
  const savedDays = savedPlan
    ? Array.from(new Set(savedPlan.sessions.map((s) => s.day_index)))
        .sort((a, b) => a - b)
        .map((dayIdx) => {
          const daySessions = savedPlan.sessions.filter((s) => s.day_index === dayIdx);
          return {
            day_name: daySessions[0]?.day_name || "",
            sessions: daySessions,
            completedCount: daySessions.filter((s) => s.completed).length,
            totalCount: daySessions.length,
          };
        })
    : [];

  const totalCompleted = savedPlan?.sessions.filter((s) => s.completed).length || 0;
  const totalSessions = savedPlan?.sessions.length || 0;

  // Render saved plan with completion
  const renderSavedPlan = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {/* Header */}
      <div className="glass rounded-xl p-4 neural-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <CalendarDays className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Active Plan</span>
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={async () => {
                if (!remindersOn) {
                  const granted = await requestPermission();
                  if (!granted) {
                    toast({ title: "Notifications blocked", description: "Enable notifications in browser settings.", variant: "destructive" });
                    return;
                  }
                  setRemindersOn(true);
                  startReminders();
                  toast({ title: "🔔 Session reminders enabled", description: "You'll get notified for today's study sessions." });
                } else {
                  setRemindersOn(false);
                  stopReminders();
                  toast({ title: "🔕 Reminders disabled" });
                }
              }}
              className={`p-1.5 rounded-lg transition-colors ${remindersOn ? "bg-primary/15 text-primary" : "hover:bg-secondary text-muted-foreground"}`}
            >
              {remindersOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
            </button>
            <button onClick={deleteSavedPlan} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
            </button>
          </div>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed mb-3">{savedPlan!.summary}</p>
        {/* Progress bar */}
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 rounded-full bg-secondary">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary to-success"
              initial={{ width: 0 }}
              animate={{ width: `${totalSessions > 0 ? (totalCompleted / totalSessions) * 100 : 0}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <span className="text-[10px] font-medium text-foreground">{totalCompleted}/{totalSessions}</span>
        </div>
      </div>

      {/* Days */}
      {savedDays.map((day, i) => {
        const isExpanded = expandedDay === i;
        const allDone = day.completedCount === day.totalCount;

        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className={`glass rounded-xl neural-border overflow-hidden ${allDone ? "opacity-70" : ""}`}
          >
            <button onClick={() => setExpandedDay(isExpanded ? null : i)} className="w-full p-4 flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                allDone ? "bg-success/20 text-success" : "bg-secondary text-foreground"
              }`}>
                {allDone ? <CheckCircle className="w-5 h-5" /> : day.day_name.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground">{day.day_name}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <span>{day.completedCount}/{day.totalCount} done</span>
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
                    {day.sessions.map((session) => {
                      const config = modeConfig[session.mode] || modeConfig["review"];
                      const Icon = config.icon;

                      return (
                        <button
                          key={session.id}
                          onClick={() => toggleSession(session.id, session.completed)}
                          className={`w-full flex items-start gap-3 p-3 rounded-lg border transition-all text-left ${
                            session.completed
                              ? "bg-success/5 border-success/20 opacity-70"
                              : "bg-secondary/30 border-border hover:border-primary/30"
                          }`}
                        >
                          {session.completed ? (
                            <CheckCircle className="w-5 h-5 text-success shrink-0 mt-0.5" />
                          ) : (
                            <Circle className="w-5 h-5 text-muted-foreground shrink-0 mt-0.5" />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className={`text-xs font-medium truncate ${session.completed ? "line-through text-muted-foreground" : "text-foreground"}`}>
                                {session.topic}
                              </p>
                              <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{session.duration_minutes}m</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{session.subject} • {session.mode}</p>
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
    </motion.div>
  );

  // Render unsaved generated plan
  const renderGeneratedPlan = () => (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-3">
      {/* Summary + Save */}
      <div className="glass rounded-xl p-4 neural-border">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">AI Strategy</span>
            <span className="flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-primary/10 text-primary text-[9px] font-medium">
              <Brain className="w-2.5 h-2.5" />RL-optimized
            </span>
          </div>
          <button
            onClick={savePlan}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            <Save className="w-3.5 h-3.5" />
            {saving ? "Saving..." : "Save Plan"}
          </button>
        </div>
        <p className="text-sm text-muted-foreground leading-relaxed">{plan!.summary}</p>
      </div>

      {/* Days */}
      {plan!.days.map((day, i) => {
        const isExpanded = expandedDay === i;
        return (
          <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
            className={`glass rounded-xl neural-border overflow-hidden ${i === 0 ? "ring-1 ring-primary/30" : ""}`}>
            <button onClick={() => setExpandedDay(isExpanded ? null : i)} className="w-full p-4 flex items-center gap-3 text-left">
              <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"}`}>
                {day.day_name.slice(0, 3)}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">{day.focus}</p>
                <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                  <Clock className="w-3 h-3" /><span>{day.total_minutes} min</span><span>•</span><span>{day.sessions.length} sessions</span>
                </div>
              </div>
              {isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
                  <div className="px-4 pb-4 space-y-2">
                    {day.sessions.map((session, j) => {
                      const config = modeConfig[session.mode] || modeConfig["review"];
                      const Icon = config.icon;
                      return (
                        <div key={j} className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                          <div className={`p-1.5 rounded-md ${config.bg}`}><Icon className={`w-3.5 h-3.5 ${config.color}`} /></div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <p className="text-xs font-medium text-foreground truncate">{session.topic}</p>
                              <span className="text-[10px] text-muted-foreground ml-2 shrink-0">{session.duration_minutes}m</span>
                            </div>
                            <p className="text-[10px] text-muted-foreground">{session.subject} • {session.mode}</p>
                            <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{session.reason}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        );
      })}
    </motion.div>
  );

  return (
    <div className="space-y-4">
      {/* Generate Button */}
      <motion.button onClick={generatePlan} disabled={loading}
        className="w-full glass rounded-xl p-5 neural-border hover:glow-primary transition-all duration-300 text-left group disabled:opacity-60"
        whileTap={{ scale: 0.98 }}>
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 neural-border">
            {loading ? <Sparkles className="w-6 h-6 text-primary animate-pulse" /> : <CalendarDays className="w-6 h-6 text-primary" />}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {loading ? "Generating your plan..." : (plan || savedPlan) ? "Regenerate Study Plan" : "AI Study Plan Generator"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {loading ? "Analyzing forgetting curves & exam timeline..." : "Get a personalized 7-day schedule based on your memory data."}
            </p>
          </div>
        </div>
      </motion.button>

      {/* Toggle between saved and generated */}
      {plan && savedPlan && (
        <div className="flex gap-2">
          <button onClick={() => setShowSaved(false)}
            className={`flex-1 text-xs py-2 rounded-lg border transition-all ${!showSaved ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
            <Sparkles className="w-3 h-3 inline mr-1" />New Plan
          </button>
          <button onClick={() => setShowSaved(true)}
            className={`flex-1 text-xs py-2 rounded-lg border transition-all ${showSaved ? "bg-primary/10 border-primary/30 text-primary" : "border-border text-muted-foreground"}`}>
            <History className="w-3 h-3 inline mr-1" />Saved Plan
          </button>
        </div>
      )}

      <AnimatePresence mode="wait">
        {!loading && plan && !showSaved && renderGeneratedPlan()}
        {!loading && savedPlan && (showSaved || !plan) && !plan?.summary && renderSavedPlan()}
        {!loading && savedPlan && showSaved && plan && renderSavedPlan()}
      </AnimatePresence>
    </div>
  );
};

export default StudyPlanGenerator;
