import React, { useEffect, useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, AlertTriangle, Target, Calendar, CheckCircle, Wrench, RefreshCw, TrendingUp, AlertOctagon, Zap, ChevronRight, User, BookOpen, Plus, Sparkles, Flame, X } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useRankPrediction } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { formatDistanceToNow } from "date-fns";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import DailyGoalTracker from "./DailyGoalTracker";
import StreakTracker from "./StreakTracker";
import ReviewQueue from "./ReviewQueue";
import { notifyFeedback } from "@/lib/feedback";
import { useVoice } from "@/pages/AppDashboard";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import NextReminderIndicator from "./NextReminderIndicator";
import WeeklyReminderSummary from "./WeeklyReminderSummary";
import StudyInsights from "./StudyInsights";
import FocusModeSession from "./FocusModeSession";
import DailyStudyTip from "./DailyStudyTip";
import WeeklySummaryNotification from "./WeeklySummaryNotification";
import QuickStartStudy from "./QuickStartStudy";
import BrainUpdateHero, { markBrainUpdated } from "./BrainUpdateHero";
import RecentlyStudied from "./RecentlyStudied";
import QuickStudySignalModal from "./QuickStudySignalModal";
import DailyQuote from "./DailyQuote";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import StreakMilestoneCelebration from "./StreakMilestoneCelebration";
import StreakRecoveryCard from "./StreakRecoveryCard";
import ComebackCelebration from "./ComebackCelebration";
import ExplainButton from "./ExplainButton";

interface HomeTabProps {
  onNavigateToEmergency?: () => void;
  onRecommendationsSeen?: () => void;
  onOpenVoiceSettings?: () => void;
  onNavigateToBrain?: () => void;
  onNavigateToYou?: () => void;
}

const HomeTab = ({ onNavigateToEmergency, onRecommendationsSeen, onOpenVoiceSettings, onNavigateToBrain, onNavigateToYou }: HomeTabProps) => {
  const { prediction, loading, predict, generateRecommendations } = useMemoryEngine();
  const { data: rankData, loading: rankLoading, predictRank } = useRankPrediction();
  const { user } = useAuth();
  const { toast } = useToast();
  const voice = useVoice();
  const [burnoutData, setBurnoutData] = useState<{ burnout_score: number; risk_level: string; recommendations: string[] } | null>(null);
  const { streak: streakData, loadStreak } = useStudyStreak();
  const [latestCompletionRate, setLatestCompletionRate] = useState<number>(50);
  const [recommendations, setRecommendations] = useState<any[]>(() => getCache("home-recommendations") || []);
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(() => getCache("home-exam-days"));
  const recsRef = useRef<HTMLDivElement>(null);
  const voiceTriggeredRef = useRef(false);
  const rankVoiceFiredRef = useRef(false);
  const [fabVisible, setFabVisible] = useState(true);
  const [showWelcomeCard, setShowWelcomeCard] = useState(() => !localStorage.getItem("acry-welcome-card-seen"));
  const [brainPulseDismissed, setBrainPulseDismissed] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [recoverySessionOpen, setRecoverySessionOpen] = useState(false);
  const [showComeback, setShowComeback] = useState(false);
  const lastScrollY = useRef(0);

  // Hide FAB on scroll down, show on scroll up
  useEffect(() => {
    const handleScroll = () => {
      const y = window.scrollY;
      setFabVisible(y <= 10 || y < lastScrollY.current);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  // Auto-dismiss badge when recommendations section scrolls into view
  useEffect(() => {
    if (recommendations.length === 0 || !onRecommendationsSeen) return;
    const el = recsRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) onRecommendationsSeen(); },
      { threshold: 0.5 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [recommendations.length, onRecommendationsSeen]);

  useEffect(() => {
    predict().then(() => setRadarLastUpdated(new Date()));
    predictRank();
    loadRecommendations();
    // Burnout detection
    supabase.functions.invoke("burnout-detection").then(({ data }) => {
      if (data) setBurnoutData(data);
    }).catch(() => {});
    loadExamDate();
    loadStreak();
    // Load latest plan completion rate
    if (user) {
      supabase.from("plan_quality_logs").select("overall_completion_rate").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).then(({ data }) => {
        if (data?.[0]?.overall_completion_rate != null) setLatestCompletionRate(data[0].overall_completion_rate * 100);
      });
    }
    // Load avatar
    if (user) {
      supabase.from("profiles").select("avatar_url, display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data?.avatar_url) setAvatarUrl(data.avatar_url);
        if (data?.display_name) setDisplayName(data.display_name);
      });
    }

    const interval = setInterval(() => {
      predict().then(() => setRadarLastUpdated(new Date()));
    }, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // First-time welcome confetti after onboarding
  useEffect(() => {
    const key = "acry-first-visit-confetti";
    if (localStorage.getItem(key)) return;
    localStorage.setItem(key, "1");
    const timer = setTimeout(() => {
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, colors: ["hsl(var(--primary))", "#FFD700", "#FF6B6B", "#4ECDC4", "#A855F7"] });
      });
    }, 800);
    return () => clearTimeout(timer);
  }, []);

  // Auto-dismiss welcome card after 10 seconds
  useEffect(() => {
    if (!showWelcomeCard) return;
    const timer = setTimeout(() => {
      localStorage.setItem("acry-welcome-card-seen", "1");
      setShowWelcomeCard(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [showWelcomeCard]);

  // Show toast when auto-shield saved the streak
  useEffect(() => {
    if (streakData?.autoShieldUsed) {
      toast({
        title: "🛡️ Your streak was saved!",
        description: "Auto-shield activated yesterday — your streak is safe.",
      });
    }
  }, [streakData?.autoShieldUsed]);

  const loadRecommendations = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("ai_recommendations")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      const recs = data || [];
      setRecommendations(recs);
      setCache("home-recommendations", recs);
    } catch {
      // offline – cached data already loaded
    }
  };

  const loadExamDate = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("exam_date")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.exam_date) {
        const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const val = Math.max(0, days);
        setExamDaysLeft(val);
        setCache("home-exam-days", val);
      }
    } catch {
      // offline – cached data already loaded
    }
  };

  // Auto-trigger voice alerts once per session after data loads
  useEffect(() => {
    if (voiceTriggeredRef.current || loading || !prediction) return;
    const settings = getVoiceSettings();
    if (!settings.enabled || !voice) return;

    voiceTriggeredRef.current = true;

    const criticalTopics = (prediction.at_risk || []).filter(t => t.risk_level === "critical");

    // Priority 1: Exam countdown (≤7 days)
    if (examDaysLeft !== null && examDaysLeft <= 7) {
      voice.speak("exam_countdown", { exam_days: examDaysLeft });
      return;
    }

    // Priority 2: Critical forget-risk alert (top topic)
    if (criticalTopics.length > 0) {
      const top = criticalTopics[0];
      voice.speak("forget_risk", {
        topic: top.name,
        subject: top.subject_name || undefined,
        memory_score: Math.round(top.memory_strength),
      });
      return;
    }
  }, [loading, prediction, examDaysLeft, voice]);

  // Voice alert when rank improves between sessions
  useEffect(() => {
    if (rankVoiceFiredRef.current || rankLoading || !rankData?.predicted_rank || !voice) return;
    const settings = getVoiceSettings();
    if (!settings.enabled) return;

    const prevRank = getCache<number>("prev-session-rank");
    // Lower rank number = better, so improvement means new < prev
    if (prevRank && rankData.predicted_rank < prevRank) {
      rankVoiceFiredRef.current = true;
      const improvement = prevRank - rankData.predicted_rank;
      voice.speak("motivation", { rank_change: improvement });
    }
    // Always save current rank for next session comparison
    setCache("prev-session-rank", rankData.predicted_rank);
  }, [rankLoading, rankData, voice]);

  const atRisk = prediction?.at_risk || [];
  const overallHealth = prediction?.overall_health ?? 0;
  const hasTopics = (prediction?.topics?.length ?? 0) > 0;

  const [analyzing, setAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [analysisStep, setAnalysisStep] = useState("");
  const [radarLastUpdated, setRadarLastUpdated] = useState<Date | null>(null);
  const [insightReviewTopic, setInsightReviewTopic] = useState<string | null>(null);
  const [insightReviewSubject, setInsightReviewSubject] = useState<string | undefined>();
  const [signalModalOpen, setSignalModalOpen] = useState(false);
  const [insightsRefreshKey, setInsightsRefreshKey] = useState(0);
  const [prefillSubject, setPrefillSubject] = useState<string | undefined>();
  const [prefillTopic, setPrefillTopic] = useState<string | undefined>();
  const [prefillMinutes, setPrefillMinutes] = useState<number | undefined>();

  const openSignalWithPrefill = (subject?: string, topic?: string, minutes?: number) => {
    setPrefillSubject(subject);
    setPrefillTopic(topic);
    setPrefillMinutes(minutes);
    setSignalModalOpen(true);
  };

  const handleRefresh = async () => {
    setAnalyzing(true);
    setAnalysisProgress(0);
    setAnalysisStep("Scanning memory patterns…");
    try {
      setAnalysisProgress(15);
      await predict();
      setAnalysisProgress(35);
      setAnalysisStep("Predicting exam rank…");
      await predictRank();
      setRadarLastUpdated(new Date());
      setAnalysisProgress(55);
      setAnalysisStep("Generating AI recommendations…");
      await generateRecommendations();
      setAnalysisProgress(80);
      setAnalysisStep("Finalizing insights…");
      await loadRecommendations();
      setAnalysisProgress(95);
      notifyFeedback();
      if (user) {
        await supabase.from("profiles").update({ last_brain_update_at: new Date().toISOString() }).eq("id", user.id);
      }
      setAnalysisProgress(100);
      setAnalysisStep("Complete!");
      toast({ title: "✅ AI Analysis complete!", description: "Memory predictions and recommendations updated." });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setTimeout(() => {
        setAnalyzing(false);
        setAnalysisProgress(0);
        setAnalysisStep("");
      }, 600);
    }
  };

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-4">
        <motion.button
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.9 }}
          onClick={() => onNavigateToYou?.()}
          className="w-12 h-12 rounded-2xl neural-gradient neural-border flex items-center justify-center shrink-0 overflow-hidden"
        >
          {avatarUrl ? (
            <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-primary">
              {(displayName || user?.user_metadata?.display_name || "S").slice(0, 2).toUpperCase()}
            </span>
          )}
        </motion.button>
        <div className="flex-1 min-w-0">
          <h1 className="text-xl font-bold text-foreground truncate">
            {(() => {
              const h = new Date().getHours();
              const greeting = h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening";
              const name = displayName || user?.user_metadata?.display_name || user?.email?.split("@")[0];
              return name ? `${greeting}, ` : greeting;
            })()}
            {(() => {
              const name = displayName || user?.user_metadata?.display_name || user?.email?.split("@")[0];
              return name ? (
                <motion.span
                  key={name}
                  initial={{ opacity: 0, y: 8, filter: "blur(4px)" }}
                  animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
                  transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
                  className="inline-block text-primary"
                >
                  {name}
                </motion.span>
              ) : null;
            })()}
          </h1>
          <p className="text-muted-foreground text-xs mt-0.5">
            {hasTopics ? "Your AI brain is active and monitoring." : "Log your first study session to activate AI."}
          </p>
          <div className="mt-1">
            <NextReminderIndicator onOpenVoiceSettings={onOpenVoiceSettings} />
          </div>
        </div>
        <button onClick={handleRefresh} disabled={loading} className="p-2 rounded-lg neural-gradient neural-border hover:glow-primary transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* First-visit welcome card */}
      <AnimatePresence>
        {showWelcomeCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.92, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ delay: 0.5, duration: 0.5, ease: "easeOut" }}
            className="rounded-2xl neural-border overflow-hidden bg-gradient-to-br from-primary/15 via-background to-accent/10 p-5"
          >
            <div className="flex items-center gap-3">
              <motion.div
                initial={{ rotate: -20, scale: 0 }}
                animate={{ rotate: 0, scale: 1 }}
                transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                className="w-11 h-11 rounded-xl bg-primary/20 flex items-center justify-center shrink-0"
              >
                <Brain className="w-6 h-6 text-primary" />
              </motion.div>
              <div className="flex-1 min-w-0">
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.9, duration: 0.4 }}
                  className="text-sm font-bold text-foreground"
                >
                  Welcome to ACRY, <span className="text-primary">{displayName || user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Student"}</span>!
                </motion.p>
                <motion.p
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 1.1, duration: 0.4 }}
                  className="text-xs text-muted-foreground mt-0.5"
                >
                  Your AI brain is ready. Let's make every study session count. 🧠✨
                </motion.p>
              </div>
              <button
                onClick={() => {
                  localStorage.setItem("acry-welcome-card-seen", "1");
                  setShowWelcomeCard(false);
                }}
                className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Welcome Onboarding Card for new users */}
      {!hasTopics && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="rounded-2xl neural-border overflow-hidden bg-gradient-to-br from-primary/10 via-background to-primary/5"
        >
          <div className="p-5 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-foreground">Welcome to Your AI Study Brain!</h3>
                <p className="text-[10px] text-muted-foreground">3 quick steps to get started</p>
              </div>
            </div>

            <div className="space-y-3">
              {[
                { step: 1, icon: BookOpen, title: "Add your first subject", desc: "e.g. Physics, Chemistry, Biology" },
                { step: 2, icon: Plus, title: "Add topics under it", desc: "e.g. Thermodynamics, Organic Chemistry" },
                { step: 3, icon: Zap, title: "Log a study session", desc: "Tap the ⚡ button to start tracking" },
              ].map((item) => (
                <div key={item.step} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50">
                  <div className="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                    <span className="text-xs font-bold text-primary">{item.step}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-foreground">{item.title}</p>
                    <p className="text-[10px] text-muted-foreground">{item.desc}</p>
                  </div>
                  <item.icon className="w-4 h-4 text-muted-foreground shrink-0" />
                </div>
              ))}
            </div>

            <button
              onClick={() => onNavigateToBrain?.()}
              className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity active:scale-[0.98] flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Add Your First Subject
            </button>
          </div>
        </motion.div>
      )}

      {/* Mini Brain Health Badge */}
      {hasTopics && prediction && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.15, type: "spring", stiffness: 200 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => { setBrainPulseDismissed(true); onNavigateToBrain?.(); }}
          className="w-full glass rounded-xl neural-border p-3 flex items-center gap-3 hover:bg-secondary/20 transition-colors text-left"
        >
          <div className="relative w-10 h-10 shrink-0">
            {!brainPulseDismissed && (prediction.at_risk?.length ?? 0) > 0 && (
              <motion.div
                className="absolute inset-0 rounded-full bg-destructive/20"
                animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              />
            )}
            <svg viewBox="0 0 40 40" className="w-full h-full -rotate-90 relative z-10">
              <circle cx="20" cy="20" r="16" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3.5" />
              <motion.circle
                cx="20" cy="20" r="16" fill="none"
                stroke={
                  (prediction.overall_health ?? 0) > 70 ? "hsl(var(--success))" :
                  (prediction.overall_health ?? 0) > 50 ? "hsl(var(--warning))" :
                  "hsl(var(--destructive))"
                }
                strokeWidth="3.5"
                strokeLinecap="round"
                strokeDasharray={2 * Math.PI * 16}
                initial={{ strokeDashoffset: 2 * Math.PI * 16 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 16 * (1 - (prediction.overall_health ?? 0) / 100) }}
                transition={{ duration: 1, ease: "easeOut", delay: 0.3 }}
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold text-foreground z-10">
              {prediction.overall_health ?? 0}%
            </span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-semibold text-foreground">Brain Health</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">
              {(prediction.overall_health ?? 0) > 70 ? "Strong retention" :
               (prediction.overall_health ?? 0) > 50 ? "Needs attention" :
               "Review recommended"}
              {prediction.at_risk?.length > 0 && ` · ${prediction.at_risk.length} at risk`}
            </p>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
        </motion.button>
      )}

      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-4 neural-border overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-semibold text-foreground">AI Analysis Running</span>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{Math.round(analysisProgress)}%</span>
            </div>
            <div className="h-2 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-gradient-to-r from-primary via-primary/80 to-primary"
                initial={{ width: "0%" }}
                animate={{ width: `${analysisProgress}%` }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
              />
            </div>
            <motion.p
              key={analysisStep}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-[10px] text-muted-foreground mt-2"
            >
              {analysisStep}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daily Motivational Quote */}
      <DailyQuote currentStreak={streakData?.currentStreak ?? 0} completionRate={latestCompletionRate} />

      {/* Brain Update Hero — opens Quick Study Signal */}
      <BrainUpdateHero
        onOpen={() => openSignalWithPrefill()}
        overallHealth={overallHealth}
        hasTopics={hasTopics}
      />

      {/* Quick Study Signal Modal */}
      <QuickStudySignalModal
        open={signalModalOpen}
        onClose={() => setSignalModalOpen(false)}
        initialSubject={prefillSubject}
        initialTopic={prefillTopic}
        initialMinutes={prefillMinutes}
        onSuccess={async () => {
          markBrainUpdated();
          setInsightsRefreshKey(k => k + 1);
          // Also run AI analysis after logging
          await handleRefresh();
        }}
      />
      {/* Weekly Summary Notification */}
      <WeeklySummaryNotification />
      {/* Quick Start Study */}
      <QuickStartStudy />

      {/* Recently Studied */}
      <RecentlyStudied onQuickLog={() => handleRefresh()} analyzing={analyzing} />

      {/* Burnout Warning */}
      {burnoutData && burnoutData.burnout_score >= 40 && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`glass rounded-xl p-4 neural-border space-y-2 ${
            burnoutData.risk_level === "high" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"
          }`}
        >
          <div className="flex items-center gap-2">
            <Flame className={`w-4 h-4 ${burnoutData.risk_level === "high" ? "text-destructive" : "text-warning"}`} />
            <span className="text-sm font-semibold text-foreground">
              {burnoutData.risk_level === "high" ? "⚠️ High Burnout Risk" : "Moderate Fatigue Detected"}
            </span>
            <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${
              burnoutData.risk_level === "high" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"
            }`}>
              {burnoutData.burnout_score}/100
            </span>
          </div>
          {burnoutData.recommendations.length > 0 && (
            <div className="space-y-1">
              {burnoutData.recommendations.slice(0, 2).map((tip, i) => (
                <p key={i} className="text-xs text-foreground/70 leading-relaxed">• {tip}</p>
              ))}
            </div>
          )}
        </motion.div>
      )}

      {/* Daily Goal */}
      <DailyGoalTracker />

      {/* Streak */}
      <StreakTracker />

      {/* Streak Milestone Celebration */}
      <StreakMilestoneCelebration currentStreak={streakData?.currentStreak ?? 0} />

      {/* Streak Recovery Encouragement */}
      <StreakRecoveryCard
        currentStreak={streakData?.currentStreak ?? 0}
        longestStreak={streakData?.longestStreak ?? 0}
        todayMet={streakData?.todayMet ?? false}
        onStartRecovery={() => setRecoverySessionOpen(true)}
      />

      {/* Recovery Focus Session — auto-start */}
      <FocusModeSession
        open={recoverySessionOpen}
        onClose={() => setRecoverySessionOpen(false)}
        onSessionComplete={() => { setRecoverySessionOpen(false); setShowComeback(true); loadStreak(); }}
        autoStart
      />

      {/* Comeback Celebration */}
      <ComebackCelebration show={showComeback} onDismiss={() => setShowComeback(false)} />

      {/* Daily Study Tip */}
      <DailyStudyTip />

      {/* Weekly Voice Reminder Summary */}
      <WeeklyReminderSummary />

      {/* Smart Study Insights */}
      <StudyInsights refreshKey={insightsRefreshKey} onReviewTopic={(topic, subject) => {
        setInsightReviewSubject(subject);
        setInsightReviewTopic(topic);
      }} />

      {/* Exam urgency banner — ≤3 days */}
      {examDaysLeft !== null && examDaysLeft <= 3 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertOctagon className="w-5 h-5 text-destructive animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-destructive">
                {examDaysLeft === 0 ? "Exam is TODAY!" : `Exam in ${examDaysLeft} day${examDaysLeft !== 1 ? "s" : ""}!`}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activate Emergency Recovery for an AI-powered rescue plan to maximize your remaining time.
              </p>
              <button
                onClick={onNavigateToEmergency}
                className="mt-2.5 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                Activate Emergency Recovery
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">Brain</span>
          </div>
          <p className="text-xl font-bold gradient-text">{hasTopics ? `${overallHealth}%` : "—"}</p>
          {hasTopics && (
            <ExplainButton
              predictionType="memory_health"
              predictionData={{ overall_health: overallHealth, at_risk_count: atRisk.length, top_risk: atRisk[0]?.name }}
              label="Explain"
            />
          )}
        </div>
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-[10px] text-muted-foreground">Rank</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {rankData?.predicted_rank ? `#${rankData.predicted_rank.toLocaleString()}` : "—"}
          </p>
          {rankData?.rank_change !== undefined && rankData.rank_change !== 0 && (
            <span className={`text-[10px] flex items-center gap-0.5 ${rankData.rank_change > 0 ? "text-success" : "text-destructive"}`}>
              <TrendingUp className={`w-2.5 h-2.5 ${rankData.rank_change < 0 ? "rotate-180" : ""}`} />
              {rankData.rank_change > 0 ? "+" : ""}{rankData.rank_change.toLocaleString()}
            </span>
          )}
          {rankData?.predicted_rank && (
            <ExplainButton
              predictionType="rank_prediction"
              predictionData={{ predicted_rank: rankData.predicted_rank, percentile: rankData.percentile, rank_change: rankData.rank_change, factors: rankData.factors }}
              label="Explain"
            />
          )}
        </div>
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-warning" />
            <span className="text-[10px] text-muted-foreground">Exam</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {examDaysLeft !== null ? (
              <>{examDaysLeft}<span className="text-[10px] text-muted-foreground ml-1">d</span></>
            ) : "—"}
          </p>
        </div>
      </motion.div>

      {/* Forget Risk Radar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="font-semibold text-foreground text-sm">Forget Risk Radar</h2>
          {radarLastUpdated && (
            <span className="text-[9px] text-muted-foreground/60 ml-1 tabular-nums">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-success/60 animate-pulse mr-1 align-middle" />
              {formatDistanceToNow(radarLastUpdated, { addSuffix: true })}
            </span>
          )}
          {atRisk.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-medium">
              {atRisk.length} at risk
            </span>
          )}
        </div>
        {atRisk.length > 0 ? (
          <div className="space-y-3">
            {atRisk.slice(0, 5).map((topic: TopicPrediction) => (
              <div key={topic.id} className="space-y-0.5">
                <div className="flex items-center gap-3">
                  <div className="flex-1">
                    <div className="flex justify-between mb-1">
                      <span className="text-xs text-foreground">{topic.name}</span>
                      <span className={`text-[10px] ${topic.risk_level === "critical" ? "text-destructive" : "text-warning"}`}>
                        {Math.round(100 - topic.memory_strength)}% risk
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-warning to-destructive transition-all"
                        style={{ width: `${100 - topic.memory_strength}%` }}
                      />
                    </div>
                  </div>
                </div>
                <ExplainButton
                  predictionType="forget_risk"
                  predictionData={{ topic_name: topic.name, memory_strength: topic.memory_strength, risk_level: topic.risk_level, hours_until_drop: topic.hours_until_drop, subject: topic.subject_name }}
                  label="Why at risk?"
                />
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {hasTopics ? "All topics are healthy! 🧠" : "No topics tracked yet. Log a study session to start."}
          </p>
        )}
      </motion.div>

      {/* Spaced Repetition Review Queue */}
      <ReviewQueue />

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <motion.div ref={recsRef} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-5 neural-border">
          <div className="flex items-center gap-2 mb-1">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">AI Recommendations</h2>
          </div>
          <p className="text-[10px] text-muted-foreground mb-4">Tap a card to mark it done</p>
          <div className="space-y-3">
            {recommendations.map((rec: any) => (
              <motion.div
                key={rec.id}
                whileTap={{ scale: 0.96 }}
                onClick={async () => {
                  // Haptic feedback
                  if (navigator.vibrate) navigator.vibrate(20);
                  // Animate out then remove
                  const el = document.getElementById(`rec-${rec.id}`);
                  if (el) {
                    el.style.transition = "all 0.4s ease";
                    el.style.opacity = "0";
                    el.style.transform = "translateX(60px) scale(0.95)";
                  }
                  await new Promise((r) => setTimeout(r, 350));
                  await supabase.from("ai_recommendations").update({ completed: true }).eq("id", rec.id);
                  loadRecommendations();
                  toast({
                    title: "✅ Marked as done",
                    description: rec.title,
                    action: React.createElement(ToastAction, {
                      altText: "Undo",
                      className: "px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold hover:opacity-90 transition-opacity",
                      onClick: async () => {
                        await supabase.from("ai_recommendations").update({ completed: false }).eq("id", rec.id);
                        loadRecommendations();
                      },
                    }, "Undo") as any,
                  });
                }}
                id={`rec-${rec.id}`}
                className="flex items-center gap-3 p-3.5 rounded-xl bg-secondary/30 border border-border/50 cursor-pointer hover:bg-secondary/50 hover:border-primary/30 active:bg-primary/10 transition-all group"
              >
                <div className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                  rec.priority === "critical" ? "bg-destructive animate-pulse" :
                  rec.priority === "high" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium truncate">{rec.title}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5 capitalize">{rec.type} • {rec.priority}</p>
                </div>
                <CheckCircle className="w-5 h-5 text-muted-foreground/40 group-hover:text-success transition-colors shrink-0" />
              </motion.div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-3 relative z-10">
        <button onClick={handleRefresh} disabled={analyzing} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50">
          {analyzing ? (
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <Target className="w-6 h-6 text-primary" />
          )}
          <span className="text-xs font-medium text-foreground">{analyzing ? "Analyzing…" : "Run AI Analysis"}</span>
        </button>
        <button
          onClick={async () => {
            setAnalyzing(true);
            setAnalysisProgress(0);
            setAnalysisStep("Scanning your weak topics…");
            try {
              setAnalysisProgress(20);
              await new Promise((r) => setTimeout(r, 300));
              setAnalysisProgress(40);
              setAnalysisStep("AI generating fix suggestions…");
              const result = await generateRecommendations();
              setAnalysisProgress(75);
              setAnalysisStep("Loading recommendations…");
              await loadRecommendations();
              setAnalysisProgress(95);
              const count = result?.recommendations?.length ?? 0;
              if (count > 0) notifyFeedback();
              setAnalysisProgress(100);
              setAnalysisStep("Complete!");
              toast({ title: count > 0 ? `${count} fix suggestions generated! 🔧` : "All topics are healthy — no fixes needed right now 🎉" });
              // Auto-scroll to recommendations section
              if (count > 0) {
                setTimeout(() => {
                  recsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
                }, 700);
              }
            } catch {
              toast({ title: "Fix generation failed", variant: "destructive" });
            } finally {
              setTimeout(() => {
                setAnalyzing(false);
                setAnalysisProgress(0);
                setAnalysisStep("");
              }, 600);
            }
          }}
          disabled={analyzing}
          className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50"
        >
          {analyzing ? (
            <RefreshCw className="w-6 h-6 text-warning animate-spin" />
          ) : (
            <Wrench className="w-6 h-6 text-warning" />
          )}
          <span className="text-xs font-medium text-foreground">{analyzing ? "Fixing…" : "Fix Now"}</span>
        </button>
      </motion.div>

      {/* Focus session from insight Review Now — auto-starts */}
      <FocusModeSession
        open={!!insightReviewTopic}
        onClose={() => { setInsightReviewTopic(null); setInsightReviewSubject(undefined); }}
        onSessionComplete={() => setInsightsRefreshKey(k => k + 1)}
        initialSubject={insightReviewSubject}
        initialTopic={insightReviewTopic || undefined}
        autoStart
      />

      {/* Floating Action Button — Quick Study Log */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={fabVisible ? { scale: 1, opacity: 1, y: 0 } : { scale: 1, opacity: 0, y: 80 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="fixed bottom-20 right-5 z-50"
        style={{ pointerEvents: fabVisible ? "auto" : "none" }}
      >
        <span className="absolute inset-0 rounded-full bg-primary/30 animate-ping" />
        <span className="absolute -inset-1 rounded-full bg-primary/20 animate-pulse" />
        <button
          onClick={() => openSignalWithPrefill()}
          className="relative w-14 h-14 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 active:scale-95 transition-transform"
          aria-label="Log study session"
        >
          <motion.span
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: 2, ease: "easeInOut" }}
          >
            <Zap className="w-6 h-6" />
          </motion.span>
        </button>
      </motion.div>
    </div>
  );
};

export default HomeTab;
