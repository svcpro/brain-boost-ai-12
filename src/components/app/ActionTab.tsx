import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Crosshair, AlertOctagon, CheckCircle2,
  Loader2, Brain, ArrowRight, Sparkles,
  Clock, TrendingUp, ChevronDown, BookOpen, CheckCircle,
  Zap, Target, BarChart3, Play, Timer, Flame
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import AITopicManager from "./AITopicManager";
import { useToast } from "@/hooks/use-toast";
import LazyModeSession from "./LazyModeSession";
import FocusModeSession from "./FocusModeSession";
import EmergencyRecoverySession from "./EmergencyRecoverySession";
import FocusSessionHistory from "./FocusSessionHistory";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// ─── Animation variants ───
const sectionVariant = (i: number) => ({
  initial: { opacity: 0, y: 24 },
  animate: { opacity: 1, y: 0, transition: { delay: 0.08 * i, duration: 0.45, ease: [0.22, 1, 0.36, 1] as const } },
});

// ─── Study mode definitions ───
const studyModes = [
  {
    id: "focus",
    icon: Crosshair,
    title: "Focus Study Mode",
    desc: "Deep Pomodoro sessions with distraction blocking. Maximum retention through spaced repetition.",
    duration: "25-50 min",
    gain: "+8-12% stability",
    color: "text-primary",
    glowClass: "shadow-[0_0_20px_hsl(var(--primary)/0.15)]",
    bgClass: "bg-primary/8",
  },
  {
    id: "revision",
    icon: Brain,
    title: "AI Revision Mode",
    desc: "AI picks your weakest topics for rapid micro-review. Smart spaced repetition at work.",
    duration: "5-15 min",
    gain: "+3-6% recall",
    color: "text-accent-foreground",
    glowClass: "shadow-[0_0_20px_hsl(175,80%,50%,0.12)]",
    bgClass: "neural-gradient",
  },
  {
    id: "mock",
    icon: Target,
    title: "Mock Practice Mode",
    desc: "Simulate real exam conditions. Timed questions with instant AI-powered feedback.",
    duration: "15-30 min",
    gain: "+5-10% readiness",
    color: "text-primary",
    glowClass: "shadow-[0_0_20px_hsl(var(--primary)/0.12)]",
    bgClass: "bg-primary/8",
  },
  {
    id: "emergency",
    icon: AlertOctagon,
    title: "Emergency Rescue Mode",
    desc: "Exam in <7 days? AI creates a rapid rescue plan targeting your critical weak points.",
    duration: "20-40 min",
    gain: "Max crisis recovery",
    color: "text-destructive",
    glowClass: "shadow-[0_0_20px_hsl(var(--destructive)/0.15)]",
    bgClass: "bg-destructive/8",
  },
];

interface ActionTabProps {
  onNavigateToBrain?: () => void;
}

const ActionTab = ({ onNavigateToBrain }: ActionTabProps) => {
  const { isEnabled } = useFeatureFlagContext();
  const [lazyModeOpen, setLazyModeOpen] = useState(false);
  const [focusModeOpen, setFocusModeOpen] = useState(false);
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();

  // ─── Recommended topic state ───
  const [recommendedTopic, setRecommendedTopic] = useState<{ name: string; subject: string; stability: number } | null>(null);
  const [loadingRec, setLoadingRec] = useState(true);

  // ─── Active tasks state ───
  const [tasks, setTasks] = useState<any[]>([]);
  const [loadingTasks, setLoadingTasks] = useState(true);

  // ─── Session history state ───
  const [todayStats, setTodayStats] = useState({ studyMinutes: 0, sessionsCompleted: 0, stabilityGain: 0 });

  // ─── Topic explorer state ───
  const [topicExplorerOpen, setTopicExplorerOpen] = useState(false);

  // Fetch recommended topic
  useEffect(() => {
    if (!user) return;
    const fetchRec = async () => {
      setLoadingRec(true);
      try {
        const { data } = await (supabase as any)
          .from("topics")
          .select("id, name, memory_strength, subjects(name)")
          .eq("user_id", user.id)
          .eq("deleted", false)
          .order("memory_strength", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (data) {
          setRecommendedTopic({
            name: data.name,
            subject: (data.subjects as any)?.name || "General",
            stability: Math.round((data.memory_strength ?? 0) * 100),
          });
        }
      } catch { /* ignore */ }
      setLoadingRec(false);
    };
    fetchRec();
  }, [user]);

  // Fetch pending AI tasks
  useEffect(() => {
    if (!user) return;
    const fetchTasks = async () => {
      setLoadingTasks(true);
      try {
        const { data } = await supabase
          .from("ai_recommendations")
          .select("id, title, description, priority, completed, type")
          .eq("user_id", user.id)
          .eq("completed", false)
          .order("created_at", { ascending: false })
          .limit(8);
        setTasks(data || []);
      } catch { /* ignore */ }
      setLoadingTasks(false);
    };
    fetchTasks();
  }, [user]);

  // Fetch today's study stats
  useEffect(() => {
    if (!user) return;
    const fetchStats = async () => {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      try {
        const { data } = await (supabase as any)
          .from("study_sessions")
          .select("duration_minutes, created_at")
          .eq("user_id", user.id)
          .gte("created_at", todayStart.toISOString());
        const rows = (data || []) as any[];
        const totalMin = rows.reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
        setTodayStats({
          studyMinutes: totalMin,
          sessionsCompleted: rows.length,
          stabilityGain: Math.min((rows.length * 2.5), 15),
        });
      } catch { /* ignore */ }
    };
    fetchStats();
  }, [user]);

  // Toggle task completion
  const toggleTask = async (taskId: string, currentCompleted: boolean) => {
    const newVal = !currentCompleted;
    setTasks((prev) => prev.map((t) => (t.id === taskId ? { ...t, completed: newVal } : t)));
    await supabase.from("ai_recommendations").update({ completed: newVal }).eq("id", taskId);
    if (newVal) {
      toast({ title: "✅ Task completed!", description: "Great execution. Keep going!" });
    }
  };

  const openStudyMode = (modeId: string) => {
    switch (modeId) {
      case "focus": setFocusModeOpen(true); break;
      case "revision": setLazyModeOpen(true); break;
      case "mock": toast({ title: "Mock Practice 🎯", description: "Starting mock exam session..." }); break;
      case "emergency": setEmergencyOpen(true); break;
    }
  };

  const estimatedTime = recommendedTopic
    ? recommendedTopic.stability < 30 ? "25 min deep session" : recommendedTopic.stability < 60 ? "15 min review" : "10 min refresh"
    : "15 min session";

  return (
    <div className="px-5 py-6 space-y-6 pb-8">

      {/* ═══════════════════════════════════════════════════
          SECTION 1: Focus Mode Header — Hero CTA
         ═══════════════════════════════════════════════════ */}
      <motion.section {...sectionVariant(0)}>
        <div className="glass rounded-2xl neural-border p-6 relative overflow-hidden">
          {/* Ambient glow */}
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-primary/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-12 -left-12 w-32 h-32 rounded-full bg-primary/8 blur-2xl pointer-events-none" />

          <div className="relative z-10 space-y-4">
            {/* Label */}
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[11px] font-semibold uppercase tracking-wider text-primary">
                Recommended Next
              </span>
            </div>

            {/* Topic info */}
            {loadingRec ? (
              <div className="space-y-2">
                <div className="h-6 w-48 rounded-lg bg-secondary/50 animate-pulse" />
                <div className="h-4 w-32 rounded-lg bg-secondary/30 animate-pulse" />
              </div>
            ) : recommendedTopic ? (
              <>
                <h2 className="text-xl font-bold text-foreground leading-tight">
                  {recommendedTopic.name}
                </h2>
                <div className="flex items-center gap-3 flex-wrap">
                  <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-secondary/50 border border-border/30">
                    {recommendedTopic.subject}
                  </span>
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${recommendedTopic.stability < 40 ? 'bg-destructive' : recommendedTopic.stability < 70 ? 'bg-warning' : 'bg-success'}`} />
                    <span className="text-xs text-muted-foreground">
                      {recommendedTopic.stability}% stable
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {estimatedTime}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-foreground">Ready to study?</h2>
                <p className="text-sm text-muted-foreground">Add topics in your Brain tab to get AI recommendations.</p>
              </div>
            )}

            {/* CTA */}
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => setFocusModeOpen(true)}
              className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2.5 shadow-[0_4px_20px_hsl(var(--primary)/0.3)] hover:shadow-[0_6px_28px_hsl(var(--primary)/0.4)] transition-all duration-300"
            >
              <Play className="w-4.5 h-4.5" />
              Start Focus Session
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════
          SECTION 2: Structured Study Modes
         ═══════════════════════════════════════════════════ */}
      {isEnabled("action_study_modes") && (
        <motion.section {...sectionVariant(1)}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Study Modes</h3>
          </div>

          <div className="space-y-2.5">
            {studyModes.map((mode, i) => (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                onClick={() => openStudyMode(mode.id)}
                className={`w-full glass rounded-xl p-4 neural-border hover:glow-primary transition-all duration-300 text-left group active:scale-[0.98] ${mode.glowClass}`}
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl ${mode.bgClass} neural-border shrink-0`}>
                    <mode.icon className={`w-5 h-5 ${mode.color}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h4 className="font-semibold text-foreground text-[13px] mb-0.5 group-hover:text-primary transition-colors">
                      {mode.title}
                    </h4>
                    <p className="text-[11px] text-muted-foreground leading-relaxed line-clamp-2">
                      {mode.desc}
                    </p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                        <Timer className="w-3 h-3" />
                        {mode.duration}
                      </span>
                      <span className="flex items-center gap-1 text-[10px] text-primary font-medium">
                        <TrendingUp className="w-3 h-3" />
                        {mode.gain}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-muted-foreground/50 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 3: Active Task Queue
         ═══════════════════════════════════════════════════ */}
      <motion.section {...sectionVariant(2)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Active Tasks</h3>
            {tasks.filter((t) => !t.completed).length > 0 && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">
                {tasks.filter((t) => !t.completed).length}
              </span>
            )}
          </div>
        </div>

        <div className="glass rounded-xl neural-border overflow-hidden">
          {loadingTasks ? (
            <div className="p-6 flex items-center justify-center">
              <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
          ) : tasks.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <div className="w-10 h-10 rounded-full bg-primary/10 mx-auto flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <p className="text-xs text-muted-foreground">
                No pending tasks. Study more to get AI recommendations!
              </p>
            </div>
          ) : (
            <div className="divide-y divide-border/30">
              {tasks.map((task, i) => (
                <motion.div
                  key={task.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.04 }}
                  className={`flex items-start gap-3 px-4 py-3.5 group hover:bg-secondary/30 transition-colors ${task.completed ? 'opacity-50' : ''}`}
                >
                  <button
                    onClick={() => toggleTask(task.id, task.completed)}
                    className="mt-0.5 shrink-0"
                  >
                    <div className={`w-[18px] h-[18px] rounded-md border-2 flex items-center justify-center transition-all duration-200 ${
                      task.completed
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/40 hover:border-primary'
                    }`}>
                      {task.completed && <CheckCircle2 className="w-3 h-3 text-primary-foreground" />}
                    </div>
                  </button>
                  <div className="flex-1 min-w-0">
                    <p className={`text-xs font-medium leading-snug ${task.completed ? 'line-through text-muted-foreground' : 'text-foreground'}`}>
                      {task.title}
                    </p>
                    {task.description && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">{task.description}</p>
                    )}
                  </div>
                  <span className={`text-[9px] font-semibold uppercase tracking-wider px-1.5 py-0.5 rounded-full shrink-0 mt-0.5 ${
                    task.priority === 'high' ? 'bg-destructive/15 text-destructive' :
                    task.priority === 'medium' ? 'bg-warning/15 text-warning' :
                    'bg-secondary text-muted-foreground'
                  }`}>
                    {task.priority}
                  </span>
                </motion.div>
              ))}
            </div>
          )}
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════
          SECTION 4: Deep Topic Explorer (collapsible)
         ═══════════════════════════════════════════════════ */}
      {isEnabled("action_ai_topic_manager") && (
        <motion.section {...sectionVariant(3)}>
          <Collapsible open={topicExplorerOpen} onOpenChange={setTopicExplorerOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between glass rounded-xl neural-border p-4 hover:glow-primary transition-all duration-300 group">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 rounded-lg bg-primary/8 neural-border">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-semibold text-foreground group-hover:text-primary transition-colors">
                      Deep Topic Explorer
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Subject → Topic → Subtopic navigation</p>
                  </div>
                </div>
                <motion.div
                  animate={{ rotate: topicExplorerOpen ? 180 : 0 }}
                  transition={{ duration: 0.25 }}
                >
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                className="mt-2"
              >
                <div className="glass rounded-xl neural-border p-4">
                  <AITopicManager mode="user" onDone={() => {}} />
                </div>
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 5: Session History & Daily Gains
         ═══════════════════════════════════════════════════ */}
      <motion.section {...sectionVariant(4)}>
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Today's Gains</h3>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            {
              icon: Clock,
              label: "Study Time",
              value: `${todayStats.studyMinutes}m`,
              sub: todayStats.studyMinutes >= 30 ? "Great pace!" : "Keep going",
              color: "text-primary",
              bg: "bg-primary/8",
            },
            {
              icon: TrendingUp,
              label: "Stability",
              value: `+${todayStats.stabilityGain.toFixed(1)}%`,
              sub: "Brain growth",
              color: "text-success",
              bg: "bg-success/8",
            },
            {
              icon: Flame,
              label: "Sessions",
              value: `${todayStats.sessionsCompleted}`,
              sub: todayStats.sessionsCompleted >= 3 ? "On fire!" : "Focus more",
              color: "text-primary",
              bg: "bg-primary/8",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.4 + i * 0.07, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="glass rounded-xl neural-border p-3.5 text-center"
            >
              <div className={`w-8 h-8 rounded-lg ${stat.bg} mx-auto flex items-center justify-center mb-2`}>
                <stat.icon className={`w-4 h-4 ${stat.color}`} />
              </div>
              <p className="text-lg font-bold text-foreground leading-none">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
              <p className="text-[9px] text-primary/70 font-medium mt-0.5">{stat.sub}</p>
            </motion.div>
          ))}
        </div>

        {/* Focus History */}
        {isEnabled("action_focus_history") && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.55 }}
            className="mt-4"
          >
            <FocusSessionHistory />
          </motion.div>
        )}
      </motion.section>

      {/* ═══ Modals ═══ */}
      <LazyModeSession open={lazyModeOpen} onClose={() => setLazyModeOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <FocusModeSession open={focusModeOpen} onClose={() => setFocusModeOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <EmergencyRecoverySession open={emergencyOpen} onClose={() => setEmergencyOpen(false)} />
    </div>
  );
};

export default ActionTab;
