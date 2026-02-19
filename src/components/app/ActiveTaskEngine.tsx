import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Zap, Loader2, Sparkles, Clock, TrendingUp,
  ChevronRight, Flame, Trophy, CheckCircle2, Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import confetti from "canvas-confetti";
import ActiveTaskMiniSession from "./ActiveTaskMiniSession";

interface AITask {
  id: string;
  title: string;
  description: string | null;
  priority: string;
  type: string;
  topic_id: string | null;
  estimatedMinutes: number;
  impactLevel: "high" | "medium" | "low";
}

const IMPACT_CONFIG = {
  high: { label: "High Impact", color: "text-destructive", bg: "bg-destructive/15", icon: Zap },
  medium: { label: "Med Impact", color: "text-warning", bg: "bg-warning/15", icon: TrendingUp },
  low: { label: "Low Impact", color: "text-primary", bg: "bg-primary/15", icon: Star },
};

const deriveImpact = (priority: string): "high" | "medium" | "low" => {
  if (priority === "critical" || priority === "high") return "high";
  if (priority === "medium") return "medium";
  return "low";
};

const deriveDuration = (priority: string): number => {
  if (priority === "critical" || priority === "high") return 5;
  if (priority === "medium") return 4;
  return 3;
};

const ActiveTaskEngine = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tasks, setTasks] = useState<AITask[]>([]);
  const [loading, setLoading] = useState(true);
  const [completedToday, setCompletedToday] = useState(0);
  const [dailyGoal] = useState(5);
  const [executionStreak, setExecutionStreak] = useState(0);
  const [activeSession, setActiveSession] = useState<AITask | null>(null);
  const [justCompleted, setJustCompleted] = useState<string | null>(null);

  const fetchTasks = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data } = await supabase
        .from("ai_recommendations")
        .select("id, title, description, priority, type, topic_id")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(3);

      setTasks(
        (data || []).map((t) => ({
          ...t,
          estimatedMinutes: deriveDuration(t.priority),
          impactLevel: deriveImpact(t.priority),
        }))
      );
    } catch { /* ignore */ }
    setLoading(false);
  }, [user]);

  // Fetch today's completed count + streak
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      try {
        const { count } = await supabase
          .from("ai_recommendations")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user.id)
          .eq("completed", true)
          .gte("created_at", todayStart.toISOString());
        setCompletedToday(count || 0);
      } catch { /* ignore */ }

      // Simple streak: count consecutive days with completions
      try {
        const { data } = await supabase
          .from("ai_recommendations")
          .select("created_at")
          .eq("user_id", user.id)
          .eq("completed", true)
          .order("created_at", { ascending: false })
          .limit(50);

        if (data && data.length > 0) {
          let streak = 0;
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          let checkDate = new Date(today);

          for (let d = 0; d < 30; d++) {
            const dayStr = checkDate.toISOString().split("T")[0];
            const hasCompletion = data.some((r) => r.created_at.startsWith(dayStr));
            if (hasCompletion) {
              streak++;
              checkDate.setDate(checkDate.getDate() - 1);
            } else {
              break;
            }
          }
          setExecutionStreak(streak);
        }
      } catch { /* ignore */ }
    };
    fetchStats();
  }, [user, completedToday]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const handleTaskComplete = async (taskId: string) => {
    // Mark completed in DB
    await supabase.from("ai_recommendations").update({ completed: true }).eq("id", taskId);

    setJustCompleted(taskId);
    setCompletedToday((p) => p + 1);

    // Confetti burst
    confetti({ particleCount: 80, spread: 60, origin: { y: 0.7 }, colors: ["#2dd4bf", "#fbbf24", "#f43f5e"] });

    toast({ title: "🎯 Task Crushed!", description: "+1 execution point. Keep the momentum!" });

    // Remove after animation
    setTimeout(() => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId));
      setJustCompleted(null);
      // Auto-fetch next task
      fetchTasks();
    }, 1200);
  };

  const progressPercent = Math.min((completedToday / dailyGoal) * 100, 100);

  return (
    <>
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.5, ease: "easeOut" }}
      >
        {/* Header */}
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Zap className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-foreground">AI Task Engine</h3>
            <p className="text-[10px] text-muted-foreground">Complete micro-tasks to level up</p>
          </div>
        </div>

        {/* Daily Progress Meter + Streak */}
        <div className="rounded-2xl border border-border bg-card p-4 mb-3">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Trophy className="w-4 h-4 text-warning" />
              <span className="text-xs font-semibold text-foreground">
                Daily Execution
              </span>
            </div>
            <div className="flex items-center gap-2">
              {executionStreak > 0 && (
                <span className="flex items-center gap-1 text-[10px] font-bold text-warning bg-warning/15 px-2 py-0.5 rounded-full">
                  <Flame className="w-3 h-3" />
                  {executionStreak}d streak
                </span>
              )}
              <span className="text-[11px] font-bold text-primary tabular-nums">
                {completedToday}/{dailyGoal}
              </span>
            </div>
          </div>

          {/* Progress bar */}
          <div className="h-2.5 rounded-full bg-secondary overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              style={{
                background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--warning)))",
              }}
              initial={{ width: 0 }}
              animate={{ width: `${progressPercent}%` }}
              transition={{ duration: 0.8, ease: "easeOut" }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            {completedToday >= dailyGoal
              ? "🏆 Daily goal achieved! You're unstoppable."
              : `${dailyGoal - completedToday} more to hit today's goal`}
          </p>
        </div>

        {/* Task Cards */}
        <div className="space-y-2.5">
          {loading ? (
            <div className="rounded-2xl border border-border bg-card p-8 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs font-medium text-foreground">All caught up!</p>
              <p className="text-[10px] text-muted-foreground">
                Study more to unlock new AI tasks.
              </p>
            </div>
          ) : (
            <AnimatePresence mode="popLayout">
              {tasks.map((task, i) => {
                const impact = IMPACT_CONFIG[task.impactLevel];
                const ImpactIcon = impact.icon;
                const isCompleting = justCompleted === task.id;

                return (
                  <motion.div
                    key={task.id}
                    layout
                    initial={{ opacity: 0, x: -20 }}
                    animate={{
                      opacity: isCompleting ? 0 : 1,
                      x: 0,
                      scale: isCompleting ? 0.9 : 1,
                    }}
                    exit={{ opacity: 0, x: 40, scale: 0.9 }}
                    transition={{ delay: i * 0.06, duration: 0.4, ease: "easeOut" }}
                    className="rounded-2xl border border-border bg-card overflow-hidden group"
                  >
                    <div className="p-4">
                      {/* Top row: impact + duration */}
                      <div className="flex items-center gap-2 mb-2">
                        <span className={`flex items-center gap-1 text-[9px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${impact.bg} ${impact.color}`}>
                          <ImpactIcon className="w-2.5 h-2.5" />
                          {impact.label}
                        </span>
                        <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          ~{task.estimatedMinutes} min
                        </span>
                      </div>

                      {/* Title */}
                      <h4 className="text-[13px] font-semibold text-foreground leading-snug mb-1">
                        {task.title}
                      </h4>
                      {task.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed mb-3">
                          {task.description}
                        </p>
                      )}

                      {/* CTA */}
                      <motion.button
                        whileHover={{ scale: 1.01 }}
                        whileTap={{ scale: 0.97 }}
                        onClick={() => setActiveSession(task)}
                        className="w-full py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-[0.98]"
                        style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.25)" }}
                      >
                        Start Task
                        <ChevronRight className="w-4 h-4" />
                      </motion.button>
                    </div>

                    {/* Completion overlay */}
                    <AnimatePresence>
                      {isCompleting && (
                        <motion.div
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="absolute inset-0 bg-primary/20 backdrop-blur-sm flex items-center justify-center rounded-2xl"
                        >
                          <motion.div
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ type: "spring", stiffness: 300 }}
                          >
                            <CheckCircle2 className="w-12 h-12 text-primary" />
                          </motion.div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>
      </motion.section>

      {/* Mini Session Modal */}
      {activeSession && (
        <ActiveTaskMiniSession
          task={activeSession}
          open={!!activeSession}
          onClose={() => setActiveSession(null)}
          onComplete={(taskId) => {
            setActiveSession(null);
            handleTaskComplete(taskId);
          }}
        />
      )}
    </>
  );
};

export default ActiveTaskEngine;
