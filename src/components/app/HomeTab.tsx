import React, { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Target, Calendar, CheckCircle, RefreshCw, TrendingUp, AlertOctagon, Zap, ChevronDown, ChevronRight, User, BookOpen, Plus, Sparkles, Flame, X, Shield, Clock, BarChart3, Star, Trophy, ArrowRight, Swords, PenTool, Eye } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useRankPrediction } from "@/hooks/useRankPrediction";
import { usePrecisionIntelligence } from "@/hooks/usePrecisionIntelligence";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import DailyGoalTracker from "./DailyGoalTracker";
import SectionErrorBoundary from "@/components/SectionErrorBoundary";

import ReviewQueue from "./ReviewQueue";
import { useNavigate } from "react-router-dom";
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
const AcceleratorWidget = lazy(() => import("./AcceleratorWidget"));
const CognitiveEmbeddingCard = lazy(() => import("./CognitiveEmbeddingCard"));
const RLPolicyCard = lazy(() => import("./RLPolicyCard"));
const AutoStudySummaryCard = lazy(() => import("./AutoStudySummaryCard"));
const PrecisionIntelligenceCard = lazy(() => import("./PrecisionIntelligenceCard"));


function DebateEngineWidgetInline() {
  const nav = useNavigate();
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border bg-card p-4 cursor-pointer hover:border-primary/30 transition-all group"
      onClick={() => nav("/debate")}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-red-500 flex items-center justify-center shrink-0">
          <Swords className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-foreground text-sm">Debate & Writing Lab</h3>
          <p className="text-[10px] text-muted-foreground">AI-powered UPSC answer practice</p>
        </div>
        <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors shrink-0" />
      </div>
      <div className="flex gap-2">
        {[
          { icon: PenTool, label: "Practice Writing" },
          { icon: Eye, label: "View Analyses" },
        ].map((item, i) => (
          <span key={i} className="flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/50 px-2 py-1 rounded-lg">
            <item.icon className="w-3 h-3" /> {item.label}
          </span>
        ))}
      </div>
    </motion.div>
  );
}

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
  const { rankData: rankV2Data, loading: rankV2Loading, computeRankV2 } = usePrecisionIntelligence();
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
    computeRankV2();
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
      await computeRankV2();
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

      {/* ══════════════════════════════════════════════════════════════
           SECTION 1: HERO — Brain Health Score + Key Stats
           Purpose: "How am I doing right now?"
         ══════════════════════════════════════════════════════════════ */}
      <motion.section
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className="relative overflow-hidden rounded-3xl p-6 text-center"
        style={{
          background: `radial-gradient(ellipse at 30% 20%, hsl(var(--primary)/0.08) 0%, transparent 50%),
                       radial-gradient(ellipse at 70% 80%, hsl(var(--success)/0.06) 0%, transparent 50%),
                       linear-gradient(160deg, hsl(var(--card)) 0%, hsl(var(--secondary)/0.5) 50%, hsl(var(--card)) 100%)`,
          border: "1px solid hsl(var(--primary)/0.15)",
          boxShadow: `0 0 40px hsl(var(--primary)/0.06), inset 0 1px 0 hsl(var(--primary)/0.08)`,
        }}
      >
        {/* Animated background orbs */}
        <motion.div
          className="absolute top-[-30px] left-[-20px] w-44 h-44 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, hsl(var(--primary)/0.12), transparent 70%)` }}
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.7, 0.4], x: [-5, 15, -5] }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-[-20px] right-[-15px] w-36 h-36 rounded-full pointer-events-none"
          style={{ background: `radial-gradient(circle, hsl(var(--success)/0.1), transparent 70%)` }}
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        {/* Shimmer sweep */}
        <motion.div
          className="absolute inset-0 pointer-events-none"
          style={{ background: "linear-gradient(105deg, transparent 40%, hsl(var(--primary)/0.04) 48%, hsl(var(--primary)/0.08) 50%, hsl(var(--primary)/0.04) 52%, transparent 60%)" }}
          animate={{ x: ["-100%", "200%"] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut", repeatDelay: 3 }}
        />

        {/* Greeting with animated avatar */}
        <div className="relative z-10 flex items-center justify-center gap-3 mb-5">
          <motion.button
            whileTap={{ scale: 0.9 }}
            whileHover={{ scale: 1.08 }}
            onClick={() => onNavigateToYou?.()}
            className="relative w-12 h-12 shrink-0"
          >
            <motion.div
              className="absolute -inset-1 rounded-full"
              style={{
                background: `conic-gradient(from 0deg, hsl(var(--primary)), hsl(var(--success)), hsl(var(--primary)/0.4), hsl(var(--primary)))`,
                filter: "blur(1px)",
              }}
              animate={{ rotate: [0, 360] }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <div className="absolute inset-[2px] rounded-full bg-card" />
            <div className="relative w-full h-full rounded-full overflow-hidden" style={{ boxShadow: `0 0 16px hsl(var(--primary)/0.2)` }}>
              {avatarUrl ? (
                <img src={avatarUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full flex items-center justify-center bg-secondary text-sm font-bold text-primary">
                  {(userName || "S").slice(0, 2).toUpperCase()}
                </div>
              )}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 z-10">
              <motion.div
                className="absolute inset-0 w-4 h-4 rounded-full"
                style={{ background: "hsl(var(--success)/0.3)" }}
                animate={{ scale: [1, 2.2, 1], opacity: [0.6, 0, 0.6] }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeOut" }}
              />
              <motion.div
                className="relative w-4 h-4 rounded-full border-[2.5px] border-card"
                style={{ background: "hsl(var(--success))", boxShadow: "0 0 8px hsl(var(--success)/0.6)" }}
                animate={{ scale: [1, 1.15, 1] }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
              />
            </div>
          </motion.button>
          <div className="text-left">
            <p className="text-[10px] text-muted-foreground">{greeting}</p>
            {userName && (
              <motion.p initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3 }} className="text-sm font-extrabold text-foreground">
                {userName}
              </motion.p>
            )}
          </div>
          <motion.div className="ml-auto" animate={{ rotate: [0, 15, -15, 0], scale: [1, 1.15, 1] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}>
            <Sparkles className="w-5 h-5 text-primary" style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.5))" }} />
          </motion.div>
        </div>

        {/* Circular progress with glow */}
        <div className="relative z-10 mx-auto w-40 h-40 mb-4">
          <motion.div
            className="absolute inset-[-6px] rounded-full pointer-events-none"
            style={{ border: `2px solid ${healthColor}`, opacity: 0.15 }}
            animate={{ scale: [1, 1.04, 1], opacity: [0.1, 0.25, 0.1] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          />
          <svg viewBox="0 0 140 140" className="w-full h-full -rotate-90">
            <circle cx="70" cy="70" r="58" fill="none" stroke="hsl(var(--border))" strokeWidth="6" strokeOpacity="0.3" />
            <motion.circle
              cx="70" cy="70" r="58" fill="none"
              stroke={healthColor}
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 58}
              initial={{ strokeDashoffset: 2 * Math.PI * 58 }}
              animate={{ strokeDashoffset: 2 * Math.PI * 58 * (1 - (hasTopics ? overallHealth : 0) / 100) }}
              transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
              style={{ filter: `drop-shadow(0 0 12px ${healthColor})` }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.span
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
              className="text-4xl font-black text-foreground tabular-nums"
              style={{ textShadow: `0 0 20px ${healthColor}40` }}
            >
              {hasTopics ? `${overallHealth}%` : "—"}
            </motion.span>
            <motion.span
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.9 }}
              className="text-[10px] font-semibold mt-0.5 px-2 py-0.5 rounded-full"
              style={{ background: `${healthColor}15`, color: healthColor }}
            >
              {hasTopics ? healthLabel : "No data yet"}
            </motion.span>
          </div>
        </div>

        {/* SurePass CTA */}
        <div className="relative z-10 flex items-center justify-center gap-3">
          <motion.button
            onClick={() => setSafePassOpen(true)}
            className="flex items-center gap-1.5 cursor-pointer group"
            animate={{ opacity: [0.7, 1, 0.7] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Brain className="w-3.5 h-3.5 text-primary" style={{ filter: "drop-shadow(0 0 4px hsl(var(--primary)/0.4))" }} />
            <p className="text-xs font-semibold text-muted-foreground group-hover:text-primary transition-colors">SurePass</p>
            <motion.div animate={{ x: [0, 4, 0] }} transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}>
              <ArrowRight className="w-3 h-3 text-primary" />
            </motion.div>
          </motion.button>
          <motion.button
            onClick={() => setSafePassOpen(true)}
            className="relative w-8 h-8 rounded-full flex items-center justify-center cursor-pointer"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)/0.2), hsl(var(--success)/0.15))",
              border: "1.5px solid hsl(var(--primary)/0.3)",
            }}
            whileHover={{ scale: 1.2 }}
            whileTap={{ scale: 0.85 }}
            animate={{
              boxShadow: [
                "0 0 0px 0px hsl(var(--primary)/0)",
                "0 0 14px 4px hsl(var(--primary)/0.4)",
                "0 0 0px 0px hsl(var(--primary)/0)",
              ],
            }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          >
            <motion.div
              className="absolute inset-[-4px] rounded-full pointer-events-none"
              style={{ border: "1.5px dashed hsl(var(--success)/0.35)" }}
              animate={{ rotate: 360 }}
              transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />
            <motion.div
              className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full"
              style={{ background: "hsl(var(--success))", boxShadow: "0 0 6px hsl(var(--success)/0.6)" }}
              animate={{ scale: [1, 1.5, 1], opacity: [1, 0.4, 1] }}
              transition={{ duration: 1.2, repeat: Infinity }}
            />
            <Trophy className="w-4 h-4 text-primary" style={{ filter: "drop-shadow(0 0 4px hsl(var(--primary)/0.5))" }} />
          </motion.button>
        </div>

        {/* Key stats: Rank / Streak / Exam */}
        {hasTopics && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="relative z-10 grid grid-cols-3 gap-2.5 mt-5"
          >
            <motion.div
              className="rounded-2xl p-3 border backdrop-blur-md"
              style={{ background: "hsl(var(--card)/0.7)", borderColor: "hsl(var(--primary)/0.15)", boxShadow: "0 0 12px hsl(var(--primary)/0.05)" }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 20px hsl(var(--primary)/0.15)" }}
            >
              <motion.div animate={{ rotate: [0, 8, -8, 0] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="flex justify-center mb-1">
                <TrendingUp className="w-4 h-4 text-primary" style={{ filter: "drop-shadow(0 0 6px hsl(var(--primary)/0.5))" }} />
              </motion.div>
              <p className="text-lg font-black text-foreground tabular-nums text-center">
                {rankV2Data?.predicted_rank ? `#${rankV2Data.predicted_rank.toLocaleString()}` : "—"}
              </p>
              {rankV2Data?.trend && rankV2Data.trend !== "stable" && (
                <motion.span initial={{ scale: 0 }} animate={{ scale: 1 }} className={`text-[9px] font-bold block text-center ${rankV2Data.trend === "rising" ? "text-success" : "text-destructive"}`}>
                  {rankV2Data.trend === "rising" ? "↑ Rising" : "↓ Falling"}
                </motion.span>
              )}
              <p className="text-[9px] text-muted-foreground text-center mt-0.5">Rank</p>
            </motion.div>

            <motion.div
              className="rounded-2xl p-3 border backdrop-blur-md"
              style={{ background: "hsl(var(--card)/0.7)", borderColor: "hsl(var(--warning)/0.15)", boxShadow: "0 0 12px hsl(var(--warning)/0.05)" }}
              whileHover={{ scale: 1.03, boxShadow: "0 0 20px hsl(var(--warning)/0.15)" }}
            >
              <motion.div animate={{ scale: [1, 1.2, 1], rotate: [0, -10, 10, 0] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="flex justify-center mb-1">
                <Flame className="w-4 h-4 text-warning" style={{ filter: "drop-shadow(0 0 6px hsl(var(--warning)/0.6))" }} />
              </motion.div>
              <p className="text-lg font-black text-foreground tabular-nums text-center">{streakData?.currentStreak ?? 0}</p>
              <p className="text-[9px] text-muted-foreground text-center mt-0.5">Streak 🔥</p>
            </motion.div>

            <motion.div
              className="rounded-2xl p-3 border backdrop-blur-md"
              style={{
                background: "hsl(var(--card)/0.7)",
                borderColor: examDaysLeft !== null && examDaysLeft <= 30 ? "hsl(var(--destructive)/0.2)" : "hsl(var(--border)/0.3)",
                boxShadow: examDaysLeft !== null && examDaysLeft <= 30 ? "0 0 12px hsl(var(--destructive)/0.08)" : "none",
              }}
              whileHover={{ scale: 1.03 }}
            >
              <motion.div
                animate={examDaysLeft !== null && examDaysLeft <= 7 ? { scale: [1, 1.3, 1], opacity: [1, 0.5, 1] } : { rotate: [0, 5, -5, 0] }}
                transition={{ duration: examDaysLeft !== null && examDaysLeft <= 7 ? 1 : 3, repeat: Infinity }}
                className="flex justify-center mb-1"
              >
                <Clock className="w-4 h-4" style={{
                  color: examDaysLeft !== null && examDaysLeft <= 7 ? "hsl(var(--destructive))" : "hsl(var(--muted-foreground))",
                  filter: examDaysLeft !== null && examDaysLeft <= 7 ? "drop-shadow(0 0 6px hsl(var(--destructive)/0.5))" : "none",
                }} />
              </motion.div>
              <p className="text-lg font-black text-foreground tabular-nums text-center">
                {examDaysLeft !== null ? examDaysLeft : "—"}
                {examDaysLeft !== null && <span className="text-[9px] text-muted-foreground ml-0.5">d</span>}
              </p>
              <p className="text-[9px] text-muted-foreground text-center mt-0.5">Exam</p>
            </motion.div>
          </motion.div>
        )}

        {/* Consistency & Decay Shield bars */}
        {hasTopics && rankData?.factors && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 1 }} className="relative z-10 grid grid-cols-2 gap-2.5 mt-3">
            <div className="rounded-xl bg-card/50 backdrop-blur-sm p-2.5 border border-primary/10">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <motion.div animate={{ rotate: [0, 360] }} transition={{ duration: 8, repeat: Infinity, ease: "linear" }}>
                    <Target className="w-3 h-3 text-primary" style={{ filter: "drop-shadow(0 0 3px hsl(var(--primary)/0.4))" }} />
                  </motion.div>
                  <span className="text-[8px] text-muted-foreground">Consistency</span>
                </div>
                <span className="text-[9px] font-bold text-foreground tabular-nums">{rankData.factors.consistency_score ?? 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, hsl(var(--primary)), hsl(var(--primary)/0.7))", boxShadow: "0 0 8px hsl(var(--primary)/0.3)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${rankData.factors.consistency_score ?? 0}%` }}
                  transition={{ duration: 1.2, delay: 1.2, ease: "easeOut" }}
                />
              </div>
            </div>
            <div className="rounded-xl bg-card/50 backdrop-blur-sm p-2.5 border border-success/10">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1">
                  <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ duration: 2, repeat: Infinity }}>
                    <Shield className="w-3 h-3 text-success" style={{ filter: "drop-shadow(0 0 3px hsl(var(--success)/0.4))" }} />
                  </motion.div>
                  <span className="text-[8px] text-muted-foreground">Decay Shield</span>
                </div>
                <span className="text-[9px] font-bold text-foreground tabular-nums">{rankData.factors.decay_velocity_score ?? 0}%</span>
              </div>
              <div className="h-1.5 rounded-full bg-secondary/60 overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "linear-gradient(90deg, hsl(var(--success)), hsl(var(--success)/0.7))", boxShadow: "0 0 8px hsl(var(--success)/0.3)" }}
                  initial={{ width: 0 }}
                  animate={{ width: `${rankData.factors.decay_velocity_score ?? 0}%` }}
                  transition={{ duration: 1.2, delay: 1.3, ease: "easeOut" }}
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
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center gap-1.5 px-4 py-2 rounded-full transition-all disabled:opacity-50"
            style={{
              background: "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--primary)/0.08))",
              border: "1px solid hsl(var(--primary)/0.2)",
              boxShadow: "0 2px 8px hsl(var(--primary)/0.1)",
            }}
          >
            <RefreshCw className={`w-3.5 h-3.5 text-primary ${analyzing ? "animate-spin" : ""}`} />
            <span className="text-[10px] font-semibold text-primary">{analyzing ? "Analyzing…" : "Refresh AI"}</span>
          </motion.button>
        </div>
      </motion.section>

      {/* AI Analysis progress overlay */}
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
          <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="rounded-2xl border border-primary/20 bg-primary/5 p-4">
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

      {/* Exam urgency banner (contextual — only when ≤3 days) */}
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

      {/* Trial Banner */}
      <TrialBanner />

      {/* ══════════════════════════════════════════════════════════════
           SECTION 2: TODAY'S MISSION — Single Clear Action
           Purpose: "What should I do RIGHT NOW?"
         ══════════════════════════════════════════════════════════════ */}
      <SectionErrorBoundary name="todays-mission">
        <TodaysMission
          hasTopics={hasTopics}
          onStartMission={(subject, topic, minutes) => {
            openSignalWithPrefill(subject, topic, minutes);
          }}
        />
      </SectionErrorBoundary>

      {/* ══════════════════════════════════════════════════════════════
           SECTION 3: QUICK ACTIONS — 3 One-Tap Power Tools
           Purpose: "Smart Recall / Risk Shield / Rank Boost"
         ══════════════════════════════════════════════════════════════ */}
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

      {/* ══════════════════════════════════════════════════════════════
           SECTION 4: MOMENTUM — Progress & Streak Tracking
           Purpose: "Am I improving?"
         ══════════════════════════════════════════════════════════════ */}
      {hasTopics && (
        <SectionErrorBoundary name="momentum">
          <MomentumSection
            streakData={streakData}
            overallHealth={overallHealth}
            rankPredicted={rankData?.predicted_rank ?? null}
            rankPercentile={rankData?.percentile ?? null}
            hasTopics={hasTopics}
          />
        </SectionErrorBoundary>
      )}

      {/* Streak celebrations (lightweight) */}
      {hasTopics && isEnabled('home_streak_milestone') && <StreakMilestoneCelebration currentStreak={streakData?.currentStreak ?? 0} />}

      {/* ══════════════════════════════════════════════════════════════
           SECTION 5: DEEP INSIGHTS — Collapsible Power Analytics
           Purpose: "Details on demand for power users"
         ══════════════════════════════════════════════════════════════ */}
      {hasTopics && (
        <SectionErrorBoundary name="deep-analytics">
          <Collapsible>
            <CollapsibleTrigger asChild>
              <motion.button
                whileTap={{ scale: 0.97 }}
                className="w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm hover:border-primary/20 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: "linear-gradient(135deg, hsl(var(--primary)/0.15), hsl(var(--primary)/0.05))" }}>
                    <BarChart3 className="w-4 h-4 text-primary" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-bold text-foreground">Deep Insights</p>
                    <p className="text-[9px] text-muted-foreground">Analytics, predictions & AI intel</p>
                  </div>
                </div>
                <ChevronDown className="w-4 h-4 text-muted-foreground group-data-[state=open]:rotate-180 transition-transform duration-300" />
              </motion.button>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-3 space-y-3"
              >
                {/* Precision Intelligence */}
                <Suspense fallback={null}>
                  <PrecisionIntelligenceCard compact />
                </Suspense>

                {/* Deep Analytics */}
                <DeepAnalyticsSection
                  atRisk={atRisk}
                  allTopics={prediction?.topics || []}
                  overallHealth={overallHealth}
                  streakDays={streakData?.currentStreak ?? 0}
                  rankPredicted={rankData?.predicted_rank ?? null}
                  rankPercentile={rankData?.percentile ?? null}
                />

                {/* Feature-flagged extras */}
                {isEnabled('home_brain_missions') && <PlanGateWrapper featureKey="brain_missions"><BrainMissionsCard /></PlanGateWrapper>}
                {isEnabled('home_cognitive_embedding') && <PlanGateWrapper featureKey="cognitive_embedding"><CognitiveEmbeddingCard /></PlanGateWrapper>}
                {isEnabled('home_risk_digest') && <PlanGateWrapper featureKey="risk_digest"><RiskDigestCard onStudyTopic={(subject, topic, minutes) => openSignalWithPrefill(subject, topic, minutes)} /></PlanGateWrapper>}
                {isEnabled('home_study_insights') && (
                  <PlanGateWrapper featureKey="study_insights">
                    <StudyInsights refreshKey={insightsRefreshKey} onReviewTopic={(topic, subject) => { setInsightReviewSubject(subject); setInsightReviewTopic(topic); }} />
                  </PlanGateWrapper>
                )}
                {isEnabled('home_streak_recovery') && (
                  <StreakRecoveryCard
                    currentStreak={streakData?.currentStreak ?? 0}
                    longestStreak={streakData?.longestStreak ?? 0}
                    todayMet={streakData?.todayMet ?? false}
                    onStartRecovery={() => setRecoverySessionOpen(true)}
                  />
                )}
                {isEnabled('home_recently_studied') && <RecentlyStudied onQuickLog={() => handleRefresh()} analyzing={analyzing} />}
                {isEnabled('home_daily_quote') && <PlanGateWrapper featureKey="daily_quote"><DailyQuote currentStreak={streakData?.currentStreak ?? 0} completionRate={latestCompletionRate} /></PlanGateWrapper>}
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
              </motion.div>
            </CollapsibleContent>
          </Collapsible>
        </SectionErrorBoundary>
      )}

      {/* Weekly Summary */}
      {isEnabled('home_quick_start') && <WeeklySummaryNotification />}

      {/* ─── Modals ─── */}
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
