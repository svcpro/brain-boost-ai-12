import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Crosshair, AlertOctagon,
  Brain, ArrowRight, Sparkles,
  Clock, TrendingUp, ChevronDown, BookOpen,
  Zap, Target, BarChart3, Play, Timer, Flame
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DeepTopicExplorer from "./DeepTopicExplorer";

import LazyModeSession from "./LazyModeSession";
import FocusModeSession from "./FocusModeSession";
import EmergencyRecoverySession from "./EmergencyRecoverySession";
import MockPracticeSession from "./MockPracticeSession";
import FocusSessionHistory from "./FocusSessionHistory";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ActiveTaskEngine from "./ActiveTaskEngine";

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
    bgClass: "bg-primary/15",
  },
  {
    id: "revision",
    icon: Brain,
    title: "AI Revision Mode",
    desc: "AI picks your weakest topics for rapid micro-review. Smart spaced repetition at work.",
    duration: "5-15 min",
    gain: "+3-6% recall",
    color: "text-primary",
    bgClass: "bg-primary/15",
  },
  {
    id: "mock",
    icon: Target,
    title: "Mock Practice Mode",
    desc: "Simulate real exam conditions. Timed questions with instant AI-powered feedback.",
    duration: "15-30 min",
    gain: "+5-10% readiness",
    color: "text-primary",
    bgClass: "bg-primary/15",
  },
  {
    id: "emergency",
    icon: AlertOctagon,
    title: "Emergency Rescue Mode",
    desc: "Memory crisis? AI runs rapid recall bursts + high-impact MCQ sprints to stabilize critical topics.",
    duration: "5-8 min",
    gain: "Emergency stabilization",
    color: "text-destructive",
    bgClass: "bg-destructive/15",
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
  const [mockOpen, setMockOpen] = useState(false);
  
  const { user } = useAuth();

  // ─── Recommended topic state ───
  const [recommendedTopic, setRecommendedTopic] = useState<{ name: string; subject: string; stability: number } | null>(null);
  const [loadingRec, setLoadingRec] = useState(true);


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


  const openStudyMode = (modeId: string) => {
    switch (modeId) {
      case "focus": setFocusModeOpen(true); break;
      case "revision": setLazyModeOpen(true); break;
      case "mock": setMockOpen(true); break;
      case "emergency": setEmergencyOpen(true); break;
    }
  };

  const estimatedTime = recommendedTopic
    ? recommendedTopic.stability < 30 ? "25 min deep session" : recommendedTopic.stability < 60 ? "15 min review" : "10 min refresh"
    : "15 min session";

  return (
    <div className="px-5 py-6 space-y-5 max-w-lg mx-auto">

      {/* ═══════════════════════════════════════════════════
          SECTION 1: Focus Mode Header — Hero CTA
         ═══════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative overflow-hidden rounded-2xl p-6"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
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
                <span className="text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-background/50 backdrop-blur-sm border border-border/50">
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
            className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-semibold text-sm flex items-center justify-center gap-2.5 hover:opacity-90 transition-all active:scale-[0.98]"
            style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
          >
            <Play className="w-4 h-4" />
            Start Focus Session
          </motion.button>
        </div>
      </motion.section>

      {/* ═══════════════════════════════════════════════════
          SECTION 2: Structured Study Modes
         ═══════════════════════════════════════════════════ */}
      {isEnabled("action_study_modes") && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex items-center gap-2 mb-3">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <Zap className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Study Modes</h3>
              <p className="text-[10px] text-muted-foreground">Choose your execution style</p>
            </div>
          </div>

          <div className="space-y-2.5">
            {studyModes.map((mode, i) => (
              <motion.button
                key={mode.id}
                initial={{ opacity: 0, x: -16 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: "easeOut" }}
                onClick={() => openStudyMode(mode.id)}
                className="w-full rounded-2xl border border-border bg-card p-4 hover:bg-secondary/30 transition-all duration-300 text-left group active:scale-[0.98]"
              >
                <div className="flex items-start gap-3.5">
                  <div className={`p-2.5 rounded-xl ${mode.bgClass} shrink-0`}>
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
                  <ArrowRight className="w-4 h-4 text-muted-foreground/30 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0 mt-1" />
                </div>
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 3: AI Task Engine
         ═══════════════════════════════════════════════════ */}
      <ActiveTaskEngine />

      {/* ═══════════════════════════════════════════════════
          SECTION 4: Deep Topic Explorer (collapsible)
         ═══════════════════════════════════════════════════ */}
      {isEnabled("action_ai_topic_manager") && (
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.5, ease: "easeOut" }}
        >
          <Collapsible open={topicExplorerOpen} onOpenChange={setTopicExplorerOpen}>
            <CollapsibleTrigger asChild>
              <button className="w-full flex items-center justify-between rounded-2xl border border-border bg-card p-4 hover:bg-secondary/30 transition-all duration-300 group">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                    <BookOpen className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <h3 className="text-sm font-bold text-foreground group-hover:text-primary transition-colors">
                      Deep Topic Explorer
                    </h3>
                    <p className="text-[10px] text-muted-foreground">Subject → Topic health, strategy & AI actions</p>
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
                <DeepTopicExplorer />
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </motion.section>
      )}

      {/* ═══════════════════════════════════════════════════
          SECTION 5: Session History & Daily Gains
         ═══════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
      >
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <BarChart3 className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Today's Gains</h3>
            <p className="text-[10px] text-muted-foreground">Your daily execution summary</p>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2.5">
          {[
            {
              icon: Clock,
              label: "Study Time",
              value: `${todayStats.studyMinutes}m`,
              sub: todayStats.studyMinutes >= 30 ? "Great pace!" : "Keep going",
            },
            {
              icon: TrendingUp,
              label: "Stability",
              value: `+${todayStats.stabilityGain.toFixed(1)}%`,
              sub: "Brain growth",
            },
            {
              icon: Flame,
              label: "Sessions",
              value: `${todayStats.sessionsCompleted}`,
              sub: todayStats.sessionsCompleted >= 3 ? "On fire!" : "Focus more",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.45 + i * 0.07, duration: 0.4, ease: "easeOut" }}
              className="rounded-2xl border border-border bg-card p-3.5 text-center"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 mx-auto flex items-center justify-center mb-2">
                <stat.icon className="w-4 h-4 text-primary" />
              </div>
              <p className="text-lg font-bold text-foreground leading-none tabular-nums">{stat.value}</p>
              <p className="text-[10px] text-muted-foreground mt-1">{stat.label}</p>
              <p className="text-[9px] text-primary font-medium mt-0.5">{stat.sub}</p>
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
      <EmergencyRecoverySession open={emergencyOpen} onClose={() => setEmergencyOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <MockPracticeSession open={mockOpen} onClose={() => setMockOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
    </div>
  );
};

export default ActionTab;
