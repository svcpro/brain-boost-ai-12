import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Target, Calendar, CheckCircle, RefreshCw, TrendingUp, AlertOctagon, Zap, ChevronDown, ChevronRight, User, BookOpen, Plus, Sparkles, Flame, X, Shield, Clock, BarChart3, Star, Trophy, ArrowRight } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useRankPrediction } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import DailyGoalTracker from "./DailyGoalTracker";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

import ReviewQueue from "./ReviewQueue";
import { notifyFeedback, triggerHaptic } from "@/lib/feedback";
import { useVoice } from "@/pages/AppDashboard";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import NextReminderIndicator from "./NextReminderIndicator";
import FocusModeSession from "./FocusModeSession";

import BrainUpdateHero, { markBrainUpdated } from "./BrainUpdateHero";
import QuickStudySignalModal from "./QuickStudySignalModal";
import DeviceSyncIndicator from "./DeviceSyncIndicator";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import StreakMilestoneCelebration from "./StreakMilestoneCelebration";
import ExplainButton from "./ExplainButton";
import TodaysMission from "./TodaysMission";
import QuickMicroActions from "./QuickMicroActions";
import PlanGateWrapper from "./PlanGateWrapper";
import SafePassPopup from "./SafePassPopup";
import TrialBanner from "./TrialBanner";
const AutopilotWidget = lazy(() => import("./AutopilotWidget"));
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

// Lazy load below-the-fold heavy components
const WeeklyReminderSummary = lazy(() => import("./WeeklyReminderSummary"));
const StudyInsights = lazy(() => import("./StudyInsights"));
const DailyStudyTip = lazy(() => import("./DailyStudyTip"));
const WeeklySummaryNotification = lazy(() => import("./WeeklySummaryNotification"));
const RecentlyStudied = lazy(() => import("./RecentlyStudied"));
const DailyQuote = lazy(() => import("./DailyQuote"));
const StreakRecoveryCard = lazy(() => import("./StreakRecoveryCard"));
const ComebackCelebration = lazy(() => import("./ComebackCelebration"));
const RiskDigestCard = lazy(() => import("./RiskDigestCard"));
const AIRiskReductionEngine = lazy(() => import("./AIRiskReductionEngine"));
const BrainFeed = lazy(() => import("./BrainFeed"));
const VoiceBrainCapture = lazy(() => import("./VoiceBrainCapture"));
const MomentumSection = lazy(() => import("./MomentumSection"));
const BrainStabilityControlCenter = lazy(() => import("./BrainStabilityControlCenter"));
const DeepAnalyticsSection = lazy(() => import("./DeepAnalyticsSection"));
const BrainMissionsCard = lazy(() => import("./BrainMissionsCard"));
const CognitiveEmbeddingCard = lazy(() => import("./CognitiveEmbeddingCard"));
const RLPolicyCard = lazy(() => import("./RLPolicyCard"));
const AutoStudySummaryCard = lazy(() => import("./AutoStudySummaryCard"));

interface HomeTabProps {
  onNavigateToEmergency?: () => void;
  onRecommendationsSeen?: () => void;
  onOpenVoiceSettings?: () => void;
  onNavigateToBrain?: () => void;
  onNavigateToYou?: () => void;
}

const HomeTab = ({ onNavigateToEmergency, onRecommendationsSeen, onOpenVoiceSettings, onNavigateToBrain, onNavigateToYou }: HomeTabProps) => {
  const { isEnabled } = useFeatureFlagContext();
  const { prediction, loading, predict, generateRecommendations } = useMemoryEngine();
  const { data: rankData, loading: rankLoading, predictRank } = useRankPrediction();
  const { user } = useAuth();
  const { toast } = useToast();
  const voice = useVoice();
  const [burnoutData, setBurnoutData] = useState<{ burnout_score: number; risk_level: string; recommendations: string[] } | null>(null);
  const { streak: streakData } = useStudyStreak();
  const [latestCompletionRate, setLatestCompletionRate] = useState<number>(50);
  const [recommendations, setRecommendations] = useState<any[]>(() => getCache("home-recommendations") || []);
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(() => getCache("home-exam-days"));
  const recsRef = useRef<HTMLDivElement>(null);
  const voiceTriggeredRef = useRef(false);
  const rankVoiceFiredRef = useRef(false);
  const [fabVisible, setFabVisible] = useState(true);
  const [showWelcomeCard, setShowWelcomeCard] = useState(() => !localStorage.getItem("acry-welcome-card-seen"));
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState<string | null>(null);
  const [recoverySessionOpen, setRecoverySessionOpen] = useState(false);
  const [showComeback, setShowComeback] = useState(false);
  const lastScrollY = useRef(0);
  const [safePassOpen, setSafePassOpen] = useState(false);

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
    supabase.functions.invoke("burnout-detection").then(({ data }) => {
      if (data) setBurnoutData(data);
    }).catch(() => {});
    loadExamDate();
    // Streak auto-updates via realtime in useStudyStreak
    if (user) {
      supabase.from("plan_quality_logs").select("overall_completion_rate").eq("user_id", user.id).order("created_at", { ascending: false }).limit(1).then(({ data }) => {
        if (data?.[0]?.overall_completion_rate != null) setLatestCompletionRate(data[0].overall_completion_rate * 100);
      });
    }
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

  useEffect(() => {
    if (!showWelcomeCard) return;
    const timer = setTimeout(() => {
      localStorage.setItem("acry-welcome-card-seen", "1");
      setShowWelcomeCard(false);
    }, 10000);
    return () => clearTimeout(timer);
  }, [showWelcomeCard]);

  useEffect(() => {
    if (streakData?.autoShieldUsed) {
      toast({ title: "🛡️ Your streak was saved!", description: "Auto-shield activated yesterday — your streak is safe." });
    }
  }, [streakData?.autoShieldUsed]);

  const loadRecommendations = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from("ai_recommendations").select("*").eq("user_id", user.id).eq("completed", false).order("created_at", { ascending: false }).limit(5);
      const recs = data || [];
      setRecommendations(recs);
      setCache("home-recommendations", recs);
    } catch {}
  };

  const loadExamDate = async () => {
    if (!user) return;
    try {
      const { data } = await supabase.from("profiles").select("exam_date").eq("id", user.id).maybeSingle();
      if (data?.exam_date) {
        const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const val = Math.max(0, days);
        setExamDaysLeft(val);
        setCache("home-exam-days", val);
      }
    } catch {}
  };

  useEffect(() => {
    if (voiceTriggeredRef.current || loading || !prediction) return;
    const settings = getVoiceSettings();
    if (!settings.enabled || !voice) return;
    voiceTriggeredRef.current = true;
    const criticalTopics = (prediction.at_risk || []).filter(t => t.risk_level === "critical");
    if (examDaysLeft !== null && examDaysLeft <= 7) {
      voice.speak("exam_countdown", { exam_days: examDaysLeft });
      return;
    }
    if (criticalTopics.length > 0) {
      const top = criticalTopics[0];
      voice.speak("forget_risk", { topic: top.name, subject: top.subject_name || undefined, memory_score: Math.round(top.memory_strength) });
      return;
    }
  }, [loading, prediction, examDaysLeft, voice]);

  useEffect(() => {
    if (rankVoiceFiredRef.current || rankLoading || !rankData?.predicted_rank || !voice) return;
    const settings = getVoiceSettings();
    if (!settings.enabled) return;
    const prevRank = getCache<number>("prev-session-rank");
    if (prevRank && rankData.predicted_rank < prevRank) {
      rankVoiceFiredRef.current = true;
      const improvement = prevRank - rankData.predicted_rank;
      voice.speak("motivation", { rank_change: improvement });
    }
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
      setAnalysisProgress(10);
      await predict();
      setAnalysisProgress(25);
      setAnalysisStep("Computing cognitive embedding…");
      await supabase.functions.invoke("user-embedding");
      setAnalysisProgress(40);
      setAnalysisStep("Predicting exam rank…");
      await predictRank();
      setRadarLastUpdated(new Date());
      setAnalysisProgress(55);
      setAnalysisStep("Running hybrid prediction engine…");
      await supabase.functions.invoke("hybrid-prediction");
      setAnalysisProgress(70);
      setAnalysisStep("Generating AI recommendations…");
      await generateRecommendations();
      setAnalysisProgress(82);
      setAnalysisStep("Creating brain missions…");
      await supabase.functions.invoke("brain-missions", { body: { action: "generate" } });
      setAnalysisProgress(85);
      setAnalysisStep("Optimizing RL study policy…");
      await supabase.functions.invoke("rl-agent");
      setAnalysisProgress(90);
      setAnalysisStep("Finalizing insights…");
      await loadRecommendations();
      setAnalysisProgress(95);
      notifyFeedback();
      if (user) {
        await supabase.from("profiles").update({ last_brain_update_at: new Date().toISOString() }).eq("id", user.id);
      }
      setAnalysisProgress(100);
      setAnalysisStep("Complete!");
      triggerHaptic([30, 60, 30]);
      toast({ title: "✅ AI Analysis complete!", description: "Your brain is fully updated." });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setTimeout(() => { setAnalyzing(false); setAnalysisProgress(0); setAnalysisStep(""); }, 600);
    }
  };

  // Determine today's primary mission
  const topMission = recommendations[0] || (atRisk.length > 0 ? {
    id: "risk-" + atRisk[0]?.id,
    title: `Review: ${String(atRisk[0]?.name || "")}`,
    description: `Memory at ${Math.round(atRisk[0]?.memory_strength ?? 0)}% — quick recall can save it`,
    type: "review",
    priority: atRisk[0]?.risk_level === "critical" ? "critical" : "high",
    _riskTopic: atRisk[0],
  } : null);

  const userName = String(displayName || user?.user_metadata?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split("@")[0] || "Student");
  const greeting = (() => { const h = new Date().getHours(); return h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening"; })();

  const healthColor = overallHealth > 70 ? "hsl(var(--success))" : overallHealth > 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const healthLabel = overallHealth > 70 ? "Strong" : overallHealth > 50 ? "Needs care" : "Critical";

  return (
    <div className="px-5 py-6 space-y-5 max-w-lg mx-auto overflow-x-hidden">
      {/* ─── SECTION 1: Hero Brain Stability Score ─── */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl p-6 text-center"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Decorative glow */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 rounded-full opacity-20 blur-3xl pointer-events-none" style={{ background: healthColor }} />

        {/* Greeting */}
        <div className="relative z-10 flex items-center justify-center gap-2 mb-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={() => onNavigateToYou?.()}
            className="w-10 h-10 rounded-full overflow-hidden border-2 border-primary/30 shrink-0"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary text-xs font-bold text-primary">
                {(userName || "S").slice(0, 2).toUpperCase()}
              </div>
            )}
          </motion.button>
          <div className="text-left">
            <p className="text-xs text-muted-foreground">{greeting}</p>
            {userName && (
              <motion.p
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 }}
                className="text-sm font-bold text-foreground"
              >
                {userName}
              </motion.p>
            )}
          </div>
        </div>

        {/* Circular progress */}
        <div className="relative z-10 mx-auto w-36 h-36 mb-4">
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle cx="70" cy="70" r="58" fill="none" stroke="hsl(var(--border))" strokeWidth="8" />
            <motion.circle
              cx="70" cy="70" r="58" fill="none"
              stroke={healthColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 58}
              initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - (hasTopics ? overallHealth : 0) / 100) }}
              transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
              style={{ filter: `drop-shadow(0 0 8px ${healthColor})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
              className="text-3xl font-bold text-foreground tabular-nums"
            >
              {hasTopics ? `${overallHealth}%` : "—"}
            </motion.span>
            <span className="text-[10px] font-medium text-muted-foreground mt-0.5">
              {hasTopics ? healthLabel : "No data yet"}
            </span>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-center gap-2">
          <p className="text-xs text-muted-foreground">
            Brain Stability Score
          </p>
          {/* Safe Pass Prediction Icon — Ultra animated */}
          <motion.button
            onClick={() => setSafePassOpen(true)}
            className="relative w-7 h-7 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--success)/0.12))",
              border: "1px solid hsl(var(--primary)/0.3)",
            }}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.9 }}
            animate={{
              boxShadow: [
                "0 0 0px 0px hsl(var(--primary)/0)",
                "0 0 10px 3px hsl(var(--primary)/0.35)",
                "0 0 0px 0px hsl(var(--primary)/0)",
              ],
            }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Orbiting ring */}
            <motion.div
              className="absolute inset-[-3px] rounded-full pointer-events-none"
              style={{
                border: "1.5px dashed hsl(var(--primary)/0.3)",
              }}
              animate={{ rotate: 360 }}
              transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            />
            {/* Pulsing dot */}
            <motion.div
              className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-success"
              animate={{
                scale: [1, 1.4, 1],
                opacity: [1, 0.5, 1],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <Trophy className="w-3.5 h-3.5 text-primary" />
          </motion.button>
        </div>

        {/* Mini stats row */}
        {hasTopics && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative z-10 grid grid-cols-3 gap-2 mt-4"
          >
            <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
              <div className="flex items-center justify-center gap-1">
                <p className="text-lg font-bold text-foreground tabular-nums">
                  {rankData?.predicted_rank ? `#${rankData.predicted_rank.toLocaleString()}` : "—"}
                </p>
                {rankData?.rank_change !== undefined && rankData.rank_change !== 0 && (
                  <span className={`text-[9px] font-bold ${rankData.rank_change > 0 ? "text-success" : "text-destructive"}`}>
                    {rankData.rank_change > 0 ? `↑${rankData.rank_change.toLocaleString()}` : `↓${Math.abs(rankData.rank_change).toLocaleString()}`}
                  </span>
                )}
              </div>
              <p className="text-[9px] text-muted-foreground">
                Rank {rankData?.trend === "rising" ? "📈" : rankData?.trend === "falling" ? "📉" : rankData?.trend === "stable" ? "➡️" : ""}
              </p>
            </div>
            <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {streakData?.currentStreak ?? 0}
                <span className="text-xs ml-0.5">🔥</span>
              </p>
              <p className="text-[9px] text-muted-foreground">Streak</p>
            </div>
            <div className="rounded-xl bg-background/50 backdrop-blur-sm p-2.5 border border-border/50">
              <p className="text-lg font-bold text-foreground tabular-nums">
                {examDaysLeft !== null ? examDaysLeft : "—"}
                {examDaysLeft !== null && <span className="text-[9px] text-muted-foreground ml-0.5">d</span>}
              </p>
              <p className="text-[9px] text-muted-foreground">Exam</p>
            </div>
          </motion.div>
        )}

        {/* Exam Readiness & Consistency micro-bar */}
        {hasTopics && rankData?.factors && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="relative z-10 grid grid-cols-2 gap-2 mt-2"
            >
              <div className="rounded-lg bg-background/40 backdrop-blur-sm p-2 border border-border/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] text-muted-foreground">Consistency</span>
                  <span className="text-[9px] font-bold text-foreground tabular-nums">{rankData.factors.consistency_score ?? 0}%</span>
                </div>
                <div className="h-1 rounded-full bg-secondary/60">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    initial={{ width: 0 }}
                    animate={{ width: `${rankData.factors.consistency_score ?? 0}%` }}
                    transition={{ duration: 1, delay: 1.2 }}
                  />
                </div>
              </div>
              <div className="rounded-lg bg-background/40 backdrop-blur-sm p-2 border border-border/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[8px] text-muted-foreground">Decay Shield</span>
                  <span className="text-[9px] font-bold text-foreground tabular-nums">{rankData.factors.decay_velocity_score ?? 0}%</span>
                </div>
                <div className="h-1 rounded-full bg-secondary/60">
                  <motion.div
                    className="h-full rounded-full bg-success"
                    initial={{ width: 0 }}
                    animate={{ width: `${rankData.factors.decay_velocity_score ?? 0}%` }}
                    transition={{ duration: 1, delay: 1.3 }}
                  />
                </div>
              </div>
            </motion.div>
          )}

        {/* Device sync + Refresh */}
        <div className="relative z-10 flex items-center justify-center gap-3 mt-4">
          <DeviceSyncIndicator />
          <motion.button
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          onClick={handleRefresh}
          disabled={analyzing}
          className="relative z-10 mt-4 inline-flex items-center gap-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          <RefreshCw className={`w-3 h-3 ${analyzing ? "animate-spin" : ""}`} />
            {analyzing ? "Updating…" : "Refresh brain"}
          </motion.button>
        </div>
      </motion.section>

      {/* AI Autopilot — hidden */}
      {/* <SectionErrorBoundary name="Autopilot">
        <Suspense fallback={null}>
          <AutopilotWidget />
        </Suspense>
      </SectionErrorBoundary> */}

      {/* Trial banner */}
      <TrialBanner />

      {/* Analysis progress */}
      <AnimatePresence>
        {analyzing && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="rounded-2xl p-4 border border-border bg-card overflow-hidden"
          >
            <div className="flex items-center gap-2 mb-2">
              <Brain className="w-4 h-4 text-primary animate-pulse" />
              <span className="text-xs font-semibold text-foreground">AI Analysis</span>
              <span className="ml-auto text-[10px] text-muted-foreground tabular-nums">{Math.round(analysisProgress)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-primary"
                animate={{ width: `${analysisProgress}%` }}
                transition={{ duration: 0.5 }}
                style={{ boxShadow: "0 0 8px hsl(var(--primary) / 0.5)" }}
              />
            </div>
            <motion.p key={analysisStep} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-[10px] text-muted-foreground mt-2">
              {analysisStep}
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* First-visit welcome */}
      <AnimatePresence>
        {showWelcomeCard && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="rounded-2xl border border-primary/20 bg-primary/5 p-4"
          >
            <div className="flex items-center gap-3">
              <Brain className="w-8 h-8 text-primary shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-bold text-foreground">Welcome to ACRY{userName ? `, ${userName}` : ""}! 🧠</p>
                <p className="text-xs text-muted-foreground mt-0.5">Your AI brain is ready to learn.</p>
              </div>
              <button onClick={() => { localStorage.setItem("acry-welcome-card-seen", "1"); setShowWelcomeCard(false); }} className="text-muted-foreground hover:text-foreground p-1"><X className="w-4 h-4" /></button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>


      {/* Exam urgency banner */}
      {examDaysLeft !== null && examDaysLeft <= 3 && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="rounded-2xl border border-destructive/30 bg-destructive/10 p-4">
          <div className="flex items-start gap-3">
            <AlertOctagon className="w-5 h-5 text-destructive animate-pulse shrink-0 mt-0.5" />
            <div className="flex-1">
              <h3 className="text-sm font-bold text-destructive">
                {examDaysLeft === 0 ? "Exam is TODAY!" : `Exam in ${examDaysLeft} day${examDaysLeft !== 1 ? "s" : ""}!`}
              </h3>
              <button onClick={onNavigateToEmergency} className="mt-2 flex items-center gap-1.5 px-4 py-2 rounded-xl bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 active:scale-95 transition-all">
                <Zap className="w-3.5 h-3.5" /> Emergency Recovery
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Burnout Warning */}
      {isEnabled('home_burnout_warning') && burnoutData && burnoutData.burnout_score >= 40 && (
        <SectionErrorBoundary name="burnout">
        <PlanGateWrapper featureKey="burnout_warning">
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`rounded-2xl border p-4 ${burnoutData.risk_level === "high" ? "border-destructive/30 bg-destructive/5" : "border-warning/30 bg-warning/5"}`}>
            <div className="flex items-center gap-2">
              <Flame className={`w-4 h-4 ${burnoutData.risk_level === "high" ? "text-destructive" : "text-warning"}`} />
              <span className="text-sm font-semibold text-foreground">{burnoutData.risk_level === "high" ? "⚠️ High Burnout Risk" : "Moderate Fatigue"}</span>
              <span className={`ml-auto text-xs font-bold px-2 py-0.5 rounded-full ${burnoutData.risk_level === "high" ? "bg-destructive/15 text-destructive" : "bg-warning/15 text-warning"}`}>{burnoutData.burnout_score}/100</span>
            </div>
            {Array.isArray(burnoutData.recommendations) && burnoutData.recommendations.slice(0, 2).map((tip, i) => (
              <p key={i} className="text-xs text-muted-foreground mt-1.5">• {typeof tip === 'string' ? tip : JSON.stringify(tip)}</p>
            ))}
          </motion.div>
        </PlanGateWrapper>
        </SectionErrorBoundary>
      )}

      {/* Auto-Detected Study — removed, replaced by fully autonomous AI tracking */}

      {/* ─── SECTION 2: Today's Mission (AI-Powered Single Action) ─── */}
      <SectionErrorBoundary name="todays-mission">
        <TodaysMission
          hasTopics={hasTopics}
          onStartMission={(subject, topic, minutes) => {
            openSignalWithPrefill(subject, topic, minutes);
          }}
        />
      </SectionErrorBoundary>

      {/* ─── SECTION 2.5: Voice Brain Capture — hidden, replaced by AutoStudySummaryCard ─── */}
      {/* <SectionErrorBoundary name="voice-brain-capture">
        <VoiceBrainCapture onSuccess={async () => { await predict(); setInsightsRefreshKey(k => k + 1); }} />
      </SectionErrorBoundary> */}
      {/* ─── SECTION 2.6: Brain Feed (Second Brain Feed) ─── */}
      {/* <BrainFeed hasTopics={hasTopics} /> */}

      {/* ─── SECTION 3: Quick Micro Actions ─── */}
      {hasTopics && (
        <SectionErrorBoundary name="quick-micro-actions">
          <QuickMicroActions
            atRisk={atRisk}
            overallHealth={overallHealth}
            streakDays={streakData?.currentStreak ?? 0}
            onStartRecall={(subject, topic, minutes) => openSignalWithPrefill(subject, topic, minutes)}
          />
        </SectionErrorBoundary>
      )}

      {/* ─── SECTION 3.5: Brain Stability Control Center ─── */}
      {hasTopics && (
        <SectionErrorBoundary name="brain-stability">
          <BrainStabilityControlCenter
            atRisk={atRisk}
            hasTopics={hasTopics}
            overallHealth={overallHealth}
            onStudyTopic={(subject, topic, minutes) => openSignalWithPrefill(subject, topic, minutes)}
          />
        </SectionErrorBoundary>
      )}

      {/* ─── SECTION 4: Progress & Streak Momentum ─── */}
      {hasTopics && (
        <>
          <SectionErrorBoundary name="momentum">
          <MomentumSection
            streakData={streakData}
            overallHealth={overallHealth}
            rankPredicted={rankData?.predicted_rank ?? null}
            rankPercentile={rankData?.percentile ?? null}
            hasTopics={hasTopics}
          />
          </SectionErrorBoundary>

          {/* DailyGoalTracker hidden - consolidated into MomentumSection */}
          {isEnabled('home_streak_milestone') && <StreakMilestoneCelebration currentStreak={streakData?.currentStreak ?? 0} />}
          {isEnabled('home_streak_recovery') && (
            <StreakRecoveryCard
              currentStreak={streakData?.currentStreak ?? 0}
              longestStreak={streakData?.longestStreak ?? 0}
              todayMet={streakData?.todayMet ?? false}
              onStartRecovery={() => setRecoverySessionOpen(true)}
            />
          )}

          {isEnabled('home_brain_missions') && <PlanGateWrapper featureKey="brain_missions"><BrainMissionsCard /></PlanGateWrapper>}
        </>
      )}

      {/* ─── SECTION 5: Collapsible Deep Analytics ─── */}
      {hasTopics && (
        <SectionErrorBoundary name="deep-analytics">
          <DeepAnalyticsSection
            atRisk={atRisk}
            allTopics={prediction?.topics || []}
            overallHealth={overallHealth}
            streakDays={streakData?.currentStreak ?? 0}
            rankPredicted={rankData?.predicted_rank ?? null}
            rankPercentile={rankData?.percentile ?? null}
          />
        </SectionErrorBoundary>
      )}

      {/* Additional analytics (feature-flagged) */}
      {hasTopics && (
        <SectionErrorBoundary name="analytics-widgets">
          <div className="space-y-3">
            {/* AIRiskReductionEngine hidden — functionality consolidated into MomentumSection */}
            {/* AutoStudySummaryCard moved above Today's Mission */}
            {isEnabled('home_cognitive_embedding') && <PlanGateWrapper featureKey="cognitive_embedding"><CognitiveEmbeddingCard /></PlanGateWrapper>}
            {isEnabled('home_risk_digest') && <PlanGateWrapper featureKey="risk_digest"><RiskDigestCard onStudyTopic={(subject, topic, minutes) => openSignalWithPrefill(subject, topic, minutes)} /></PlanGateWrapper>}
            {isEnabled('home_daily_quote') && <PlanGateWrapper featureKey="daily_quote"><DailyQuote currentStreak={streakData?.currentStreak ?? 0} completionRate={latestCompletionRate} /></PlanGateWrapper>}
            {isEnabled('home_recently_studied') && <RecentlyStudied onQuickLog={() => handleRefresh()} analyzing={analyzing} />}
            {isEnabled('home_daily_tip') && <DailyStudyTip />}
            {isEnabled('home_weekly_reminder') && <PlanGateWrapper featureKey="weekly_reminder"><WeeklyReminderSummary /></PlanGateWrapper>}
            {isEnabled('home_study_insights') && (
              <PlanGateWrapper featureKey="study_insights">
                <StudyInsights refreshKey={insightsRefreshKey} onReviewTopic={(topic, subject) => { setInsightReviewSubject(subject); setInsightReviewTopic(topic); }} />
              </PlanGateWrapper>
            )}
            {isEnabled('home_review_queue') && <PlanGateWrapper featureKey="review_queue"><ReviewQueue /></PlanGateWrapper>}
            {isEnabled('home_rl_policy') && <PlanGateWrapper featureKey="rl_policy"><RLPolicyCard /></PlanGateWrapper>}
            {isEnabled('home_recommendations') && recommendations.length > 0 && (
              <PlanGateWrapper featureKey="ai_recommendations">
                <div ref={recsRef} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-primary" />
                    <h2 className="font-semibold text-foreground text-sm">AI Recommendations</h2>
                  </div>
                  <div className="space-y-2">
                    {recommendations.map((rec: any) => (
                      <motion.div
                        key={rec.id}
                        whileTap={{ scale: 0.96 }}
                        onClick={async () => {
                          if (navigator.vibrate) navigator.vibrate(20);
                          const el = document.getElementById(`rec-${rec.id}`);
                          if (el) { el.style.transition = "all 0.4s ease"; el.style.opacity = "0"; el.style.transform = "translateX(60px) scale(0.95)"; }
                          await new Promise((r) => setTimeout(r, 350));
                          await supabase.from("ai_recommendations").update({ completed: true }).eq("id", rec.id);
                          loadRecommendations();
                          triggerHaptic(30);
                          toast({
                            title: "✅ Done!",
                            description: String(rec.title || ""),
                            action: React.createElement(ToastAction, {
                              altText: "Undo",
                              className: "px-3 py-1.5 rounded-md bg-primary text-primary-foreground text-xs font-semibold",
                              onClick: async () => { await supabase.from("ai_recommendations").update({ completed: false }).eq("id", rec.id); loadRecommendations(); },
                            }, "Undo") as any,
                          });
                        }}
                        id={`rec-${rec.id}`}
                        className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/50 cursor-pointer hover:bg-secondary/50 transition-all group"
                      >
                        <div className={`w-2 h-2 rounded-full shrink-0 ${rec.priority === "critical" ? "bg-destructive animate-pulse" : rec.priority === "high" ? "bg-warning" : "bg-primary"}`} />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs text-foreground font-medium truncate">{String(rec.title || "")}</p>
                          <p className="text-[10px] text-muted-foreground capitalize">{String(rec.type || "")} • {String(rec.priority || "")}</p>
                        </div>
                        <CheckCircle className="w-4 h-4 text-muted-foreground/30 group-hover:text-success transition-colors shrink-0" />
                      </motion.div>
                    ))}
                  </div>
                </div>
              </PlanGateWrapper>
            )}
          </div>
        </SectionErrorBoundary>
      )}

      {/* Brain Update Hero — hidden, replaced by AutoStudySummaryCard */}
      {/* {isEnabled('home_brain_update') && <BrainUpdateHero onOpen={() => openSignalWithPrefill()} overallHealth={overallHealth} hasTopics={hasTopics} />} */}

      {/* Weekly Summary */}
      {isEnabled('home_quick_start') && <WeeklySummaryNotification />}
      

      {/* Modals */}
      <QuickStudySignalModal
        open={signalModalOpen}
        onClose={() => setSignalModalOpen(false)}
        initialSubject={prefillSubject}
        initialTopic={prefillTopic}
        initialMinutes={prefillMinutes}
        onSuccess={async () => { markBrainUpdated(); setInsightsRefreshKey(k => k + 1); await handleRefresh(); }}
      />

      <FocusModeSession
        open={recoverySessionOpen}
        onClose={() => setRecoverySessionOpen(false)}
        onSessionComplete={() => { setRecoverySessionOpen(false); setShowComeback(true); }}
        autoStart
      />

      <ComebackCelebration show={showComeback} onDismiss={() => setShowComeback(false)} />

      <FocusModeSession
        open={!!insightReviewTopic}
        onClose={() => { setInsightReviewTopic(null); setInsightReviewSubject(undefined); }}
        onSessionComplete={() => setInsightsRefreshKey(k => k + 1)}
        initialSubject={insightReviewSubject}
        initialTopic={insightReviewTopic || undefined}
        autoStart
      />

      {/* Safe Pass Rank Prediction Popup */}
      <SafePassPopup
        open={safePassOpen}
        onClose={() => setSafePassOpen(false)}
        allTopics={prediction?.topics || []}
        overallHealth={overallHealth}
        streakDays={streakData?.currentStreak ?? 0}
        rankData={rankData}
      />
    </div>
  );
};

export default HomeTab;
