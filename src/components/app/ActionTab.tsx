import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Crosshair, AlertOctagon, Radar,
  Brain, ArrowRight, Sparkles,
  Clock, TrendingUp, ChevronDown, BookOpen,
  Zap, Target, Play, Timer, Lock, ShieldAlert, Shield, Newspaper
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import DeepTopicExplorer from "./DeepTopicExplorer";

import LazyModeSession from "./LazyModeSession";
import FocusModeSession from "./FocusModeSession";
import EmergencyRecoverySession from "./EmergencyRecoverySession";
import MockPracticeSession from "./MockPracticeSession";
import FocusSessionHistory from "./FocusSessionHistory";
import TodaysGains from "./TodaysGains";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import ActiveTaskEngine from "./ActiveTaskEngine";
import { useExamCountdown } from "@/hooks/useExamCountdown";
import ExamLockModal from "./ExamLockModal";
import CAPracticeSession from "./CAPracticeSession";
import IntelPracticeSession from "./IntelPracticeSession";

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
  {
    id: "current-affairs",
    icon: Newspaper,
    title: "Current Affairs Quiz",
    desc: "AI-generated questions from latest news events. Stay exam-ready with daily current affairs practice.",
    duration: "5-10 min",
    gain: "+CA readiness",
    color: "text-primary",
    bgClass: "bg-primary/15",
  },
  {
    id: "intel-practice",
    icon: Radar,
    title: "Exam Intel Practice",
    desc: "AI-predicted high-probability questions. Practice what's most likely to appear in your exam.",
    duration: "10-20 min",
    gain: "+Prediction mastery",
    color: "text-primary",
    bgClass: "bg-primary/15",
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
  const [caOpen, setCaOpen] = useState(false);
  const [intelOpen, setIntelOpen] = useState(false);
  const [lockModalOpen, setLockModalOpen] = useState(false);
  const [lockedModeName, setLockedModeName] = useState("");
  
  const { user } = useAuth();
  const examCountdown = useExamCountdown();

  // ─── Recommended topic state ───
  const [recommendedTopic, setRecommendedTopic] = useState<{ name: string; subject: string; stability: number } | null>(null);
  const [loadingRec, setLoadingRec] = useState(true);


  // ─── Session history state ───
  // (Today stats now handled by TodaysGains component)
  // ─── Topic explorer state ───
  const [topicExplorerOpen, setTopicExplorerOpen] = useState(false);

  // ─── Listen for autopilot-start-session events ───
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail?.mode) {
        openStudyMode(detail.mode === "rescue" ? "emergency" : detail.mode);
      }
    };
    window.addEventListener("autopilot-start-session", handler);
    return () => window.removeEventListener("autopilot-start-session", handler);
  }, [examCountdown]);

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





  const MODE_LABELS: Record<string, string> = {
    focus: "Focus Study Mode",
    revision: "AI Revision Mode",
    mock: "Mock Practice Mode",
    emergency: "Emergency Rescue Mode",
  };

  const openStudyMode = (modeId: string) => {
    // Check if mode is blocked by exam countdown
    if (examCountdown.isModeBlocked(modeId)) {
      setLockedModeName(MODE_LABELS[modeId] || modeId);
      setLockModalOpen(true);
      return;
    }
    switch (modeId) {
      case "focus": setFocusModeOpen(true); break;
      case "revision": setLazyModeOpen(true); break;
      case "mock": setMockOpen(true); break;
      case "emergency": setEmergencyOpen(true); break;
      case "current-affairs": setCaOpen(true); break;
      case "intel-practice": setIntelOpen(true); break;
    }
  };

  const estimatedTime = recommendedTopic
    ? recommendedTopic.stability < 30 ? "25 min deep session" : recommendedTopic.stability < 60 ? "15 min review" : "10 min refresh"
    : "15 min session";

  return (
    <div className="px-5 py-6 space-y-5 max-w-lg mx-auto overflow-x-hidden">

      {/* ═══ Exam Phase Banner ═══ */}
      {examCountdown.phase !== "no_exam" && examCountdown.phase !== "normal" && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-xl p-3 flex items-center gap-3 border"
          style={{
            background: examCountdown.phase === "lockdown"
              ? "linear-gradient(135deg, hsl(0 50% 10%), hsl(0 40% 8%))"
              : "linear-gradient(135deg, hsl(35 40% 10%), hsl(35 30% 8%))",
            borderColor: examCountdown.phase === "lockdown" ? "hsl(0 60% 30% / 0.3)" : "hsl(35 60% 30% / 0.3)",
          }}
        >
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <ShieldAlert className="w-5 h-5" style={{ color: examCountdown.phase === "lockdown" ? "hsl(0 80% 60%)" : "hsl(35 80% 55%)" }} />
          </motion.div>
          <div className="flex-1">
            <p className="text-xs font-bold" style={{ color: examCountdown.phase === "lockdown" ? "hsl(0 80% 65%)" : "hsl(35 80% 60%)" }}>
              {examCountdown.phase === "lockdown" ? "🔴 LOCKDOWN MODE" : "🟡 ACCELERATION MODE"} — {examCountdown.daysRemaining} days left
            </p>
            <p className="text-[10px] text-muted-foreground">
              {examCountdown.lockedModes.length > 0 ? `${examCountdown.lockedModes.length} mode(s) restricted` : "All modes available"}
            </p>
          </div>
        </motion.div>
      )}
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
            {studyModes.map((mode, i) => {
              const isEmergency = mode.id === "emergency";
              const isLocked = examCountdown.isModeBlocked(mode.id);

              if (isEmergency) {
                return (
                  <motion.button
                    key={mode.id}
                    initial={{ opacity: 0, x: -16 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: "easeOut" }}
                    onClick={() => openStudyMode(mode.id)}
                    className={`w-full rounded-2xl p-[1px] text-left group active:scale-[0.98] relative overflow-hidden ${isLocked ? "opacity-60" : ""}`}
                    style={{
                      background: "linear-gradient(135deg, hsl(0 75% 55%), hsl(35 90% 55%), hsl(0 70% 45%))",
                    }}
                  >
                    {/* Animated border shimmer */}
                    <motion.div
                      className="absolute inset-0 opacity-60"
                      style={{
                        background: "linear-gradient(90deg, transparent, hsl(35 90% 60% / 0.4), transparent)",
                      }}
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 1, ease: "easeInOut" }}
                    />

                    <div
                      className="relative rounded-[calc(1rem-1px)] p-4 overflow-hidden"
                      style={{
                        background: "linear-gradient(135deg, hsl(0 50% 8%), hsl(0 40% 6%), hsl(var(--card)))",
                      }}
                    >
                      {/* Lock overlay for emergency */}
                      {isLocked && (
                        <div className="absolute inset-0 z-20 flex items-center justify-center rounded-[calc(1rem-1px)]" style={{ background: "hsl(0 30% 5% / 0.7)", backdropFilter: "blur(2px)" }}>
                          <motion.div
                            className="flex items-center gap-2 px-4 py-2 rounded-xl"
                            style={{ background: "hsl(0 60% 15% / 0.9)", border: "1px solid hsl(0 60% 40% / 0.3)" }}
                            animate={{ scale: [1, 1.03, 1] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          >
                            <Lock className="w-4 h-4 text-destructive" />
                            <span className="text-xs font-bold text-destructive">
                              {examCountdown.phase === "lockdown" ? "LOCKDOWN" : "RESTRICTED"}
                            </span>
                          </motion.div>
                        </div>
                      )}
                      {/* Emergency ambient glow */}
                      <div
                        className="absolute -top-10 -right-10 w-32 h-32 rounded-full blur-3xl pointer-events-none"
                        style={{ background: "hsl(0 70% 50% / 0.12)" }}
                      />
                      <motion.div
                        className="absolute -bottom-8 -left-8 w-24 h-24 rounded-full blur-2xl pointer-events-none"
                        style={{ background: "hsl(35 80% 50% / 0.08)" }}
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 3, repeat: Infinity }}
                      />

                      <div className="flex items-start gap-3.5 relative z-10">
                        {/* Pulsing icon container */}
                        <div className="relative shrink-0">
                          <motion.div
                            className="p-2.5 rounded-xl"
                            style={{
                              background: "linear-gradient(135deg, hsl(0 60% 20% / 0.8), hsl(0 50% 15% / 0.6))",
                              border: "1px solid hsl(0 60% 40% / 0.3)",
                              boxShadow: "0 0 20px hsl(0 70% 50% / 0.15)",
                            }}
                            animate={{ scale: [1, 1.08, 1] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <mode.icon className="w-5 h-5" style={{ color: "hsl(0 80% 65%)" }} />
                          </motion.div>
                          {/* Pulse ring */}
                          <motion.div
                            className="absolute inset-0 rounded-xl"
                            style={{ border: "1.5px solid hsl(0 70% 55% / 0.3)" }}
                            animate={{ scale: [1, 1.5], opacity: [0.5, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                          />
                        </div>

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h4 className="font-bold text-[13px]" style={{ color: "hsl(0 80% 70%)" }}>
                              {mode.title}
                            </h4>
                            <motion.div
                              className="w-1.5 h-1.5 rounded-full"
                              style={{ background: "hsl(0 80% 55%)" }}
                              animate={{ opacity: [1, 0.3, 1], scale: [1, 0.8, 1] }}
                              transition={{ duration: 1.2, repeat: Infinity }}
                            />
                          </div>
                          <p className="text-[11px] leading-relaxed line-clamp-2" style={{ color: "hsl(0 20% 55%)" }}>
                            {mode.desc}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <span className="flex items-center gap-1 text-[10px]" style={{ color: "hsl(35 70% 55%)" }}>
                              <Timer className="w-3 h-3" />
                              {mode.duration}
                            </span>
                            <span className="flex items-center gap-1 text-[10px] font-semibold" style={{ color: "hsl(0 80% 65%)" }}>
                              <Zap className="w-3 h-3" />
                              {mode.gain}
                            </span>
                          </div>
                        </div>

                        <motion.div
                          animate={{ x: [0, 3, 0] }}
                          transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <ArrowRight className="w-4 h-4 shrink-0 mt-1" style={{ color: "hsl(0 60% 55%)" }} />
                        </motion.div>
                      </div>
                    </div>
                  </motion.button>
                );
              }


              return (
                <motion.button
                  key={mode.id}
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.15 + i * 0.07, duration: 0.4, ease: "easeOut" }}
                  onClick={() => openStudyMode(mode.id)}
                  className={`w-full rounded-2xl border border-border bg-card p-4 hover:bg-secondary/30 transition-all duration-300 text-left group active:scale-[0.98] relative overflow-hidden ${isLocked ? "opacity-60" : ""}`}
                >
                  {/* Lock overlay */}
                  {isLocked && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center rounded-2xl" style={{ background: "hsl(var(--card) / 0.6)", backdropFilter: "blur(2px)" }}>
                      <motion.div
                        className="flex items-center gap-2 px-4 py-2 rounded-xl"
                        style={{ background: "hsl(0 60% 15% / 0.9)", border: "1px solid hsl(0 60% 40% / 0.3)" }}
                        animate={{ scale: [1, 1.03, 1] }}
                        transition={{ duration: 2, repeat: Infinity }}
                      >
                        <Lock className="w-4 h-4 text-destructive" />
                        <span className="text-xs font-bold text-destructive">
                          {examCountdown.phase === "lockdown" ? "LOCKDOWN" : "RESTRICTED"}
                        </span>
                      </motion.div>
                    </div>
                  )}

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
              );
            })}
          </div>
        </motion.section>
      )}

      {/* Intel Practice */}
      {intelOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto p-4">
          <div className="max-w-lg mx-auto">
            <IntelPracticeSession onClose={() => setIntelOpen(false)} />
          </div>
        </div>
      )}


      {/* ═══════════════════════════════════════════════════
          SECTION 3: AI Task Engine (hidden - API only)
         ═══════════════════════════════════════════════════ */}

      {/* ═══════════════════════════════════════════════════
          SECTION 4: Deep Topic Explorer (hidden - API only)
         ═══════════════════════════════════════════════════ */}

      {/* ═══════════════════════════════════════════════════
          SECTION 5: Today's Gains — Reward Reinforcement Engine
         ═══════════════════════════════════════════════════ */}
      <TodaysGains />

      {/* Focus History (hidden - API only) */}

      {/* ═══ Modals ═══ */}
      <LazyModeSession open={lazyModeOpen} onClose={() => setLazyModeOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <FocusModeSession open={focusModeOpen} onClose={() => setFocusModeOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <EmergencyRecoverySession open={emergencyOpen} onClose={() => setEmergencyOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      <MockPracticeSession open={mockOpen} onClose={() => setMockOpen(false)} onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))} />
      
      {/* CA Practice - inline, not modal */}
      {caOpen && (
        <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto p-4">
          <div className="max-w-lg mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-foreground">Current Affairs Quiz</h2>
              <button onClick={() => setCaOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">✕ Close</button>
            </div>
            <CAPracticeSession />
          </div>
        </div>
      )}

      <ExamLockModal
        open={lockModalOpen}
        onClose={() => setLockModalOpen(false)}
        phase={examCountdown.phase}
        daysRemaining={examCountdown.daysRemaining}
        lockMessage={examCountdown.lockMessage}
        recommendedMode={examCountdown.recommendedMode}
        lockedModeName={lockedModeName}
        onSwitchMode={openStudyMode}
        canBypass={examCountdown.canBypass}
      />
    </div>
  );
};

export default ActionTab;
