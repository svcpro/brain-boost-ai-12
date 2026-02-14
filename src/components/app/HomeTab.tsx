import { useEffect, useState, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Brain, AlertTriangle, Target, Calendar, CheckCircle, Wrench, RefreshCw, TrendingUp, AlertOctagon, Zap } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useRankPrediction } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
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

interface HomeTabProps {
  onNavigateToEmergency?: () => void;
  onRecommendationsSeen?: () => void;
  onOpenVoiceSettings?: () => void;
}

const HomeTab = ({ onNavigateToEmergency, onRecommendationsSeen, onOpenVoiceSettings }: HomeTabProps) => {
  const { prediction, loading, predict, generateRecommendations } = useMemoryEngine();
  const { data: rankData, loading: rankLoading, predictRank } = useRankPrediction();
  const { user } = useAuth();
  const { toast } = useToast();
  const voice = useVoice();
  const [recommendations, setRecommendations] = useState<any[]>(() => getCache("home-recommendations") || []);
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(() => getCache("home-exam-days"));
  const recsRef = useRef<HTMLDivElement>(null);
  const voiceTriggeredRef = useRef(false);
  const rankVoiceFiredRef = useRef(false);
  const [fabVisible, setFabVisible] = useState(true);
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
    predict();
    predictRank();
    loadRecommendations();
    loadExamDate();
  }, []);

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
  const [insightReviewTopic, setInsightReviewTopic] = useState<string | null>(null);
  const [signalModalOpen, setSignalModalOpen] = useState(false);

  const handleRefresh = async () => {
    setAnalyzing(true);
    try {
      await Promise.all([predict(), predictRank()]);
      await generateRecommendations();
      await loadRecommendations();
      notifyFeedback();
      // Record brain update timestamp
      if (user) {
        await supabase.from("profiles").update({ last_brain_update_at: new Date().toISOString() }).eq("id", user.id);
      }
      toast({ title: "✅ AI Analysis complete!", description: "Memory predictions and recommendations updated." });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brain Command Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hasTopics ? "Your AI brain is active and monitoring." : "Log your first study session to activate AI."}
          </p>
          <div className="mt-1.5">
            <NextReminderIndicator onOpenVoiceSettings={onOpenVoiceSettings} />
          </div>
        </div>
        <button onClick={handleRefresh} disabled={loading} className="p-2 rounded-lg neural-gradient neural-border hover:glow-primary transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* Daily Motivational Quote */}
      <DailyQuote />

      {/* Brain Update Hero — opens Quick Study Signal */}
      <BrainUpdateHero
        onOpen={() => setSignalModalOpen(true)}
        overallHealth={overallHealth}
        hasTopics={hasTopics}
      />

      {/* Quick Study Signal Modal */}
      <QuickStudySignalModal
        open={signalModalOpen}
        onClose={() => setSignalModalOpen(false)}
        onSuccess={async () => {
          markBrainUpdated();
          // Also run AI analysis after logging
          await handleRefresh();
        }}
      />
      {/* Weekly Summary Notification */}
      <WeeklySummaryNotification />
      {/* Quick Start Study */}
      <QuickStartStudy />

      {/* Recently Studied */}
      <RecentlyStudied />

      {/* Daily Goal */}
      <DailyGoalTracker />

      {/* Streak */}
      <StreakTracker />

      {/* Daily Study Tip */}
      <DailyStudyTip />

      {/* Weekly Voice Reminder Summary */}
      <WeeklyReminderSummary />

      {/* Smart Study Insights */}
      <StudyInsights onReviewTopic={(topic) => setInsightReviewTopic(topic)} />

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
          {atRisk.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-medium">
              {atRisk.length} at risk
            </span>
          )}
        </div>
        {atRisk.length > 0 ? (
          <div className="space-y-3">
            {atRisk.slice(0, 5).map((topic: TopicPrediction) => (
              <div key={topic.id} className="flex items-center gap-3">
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
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">AI Recommendations</h2>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec: any) => (
              <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <div className={`w-2 h-2 rounded-full ${
                  rec.priority === "critical" ? "bg-destructive animate-pulse" :
                  rec.priority === "high" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{rec.title}</p>
                  <p className="text-[10px] text-muted-foreground">{rec.type} • {rec.priority}</p>
                </div>
                <button
                  onClick={async () => {
                    await supabase.from("ai_recommendations").update({ completed: true }).eq("id", rec.id);
                    loadRecommendations();
                  }}
                >
                  <CheckCircle className="w-4 h-4 text-muted-foreground hover:text-success transition-colors" />
                </button>
              </div>
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
          const result = await generateRecommendations();
          await loadRecommendations();
          const count = result?.recommendations?.length ?? 0;
          if (count > 0) notifyFeedback();
          toast({ title: count > 0 ? `${count} fix suggestions generated! 🔧` : "All topics are healthy — no fixes needed right now 🎉" });
          }}
          className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 active:scale-95"
        >
          <Wrench className="w-6 h-6 text-warning" />
          <span className="text-xs font-medium text-foreground">Fix Now</span>
        </button>
      </motion.div>

      {/* Focus session from insight Review Now */}
      <FocusModeSession
        open={!!insightReviewTopic}
        onClose={() => setInsightReviewTopic(null)}
        initialTopic={insightReviewTopic || undefined}
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
          onClick={() => setSignalModalOpen(true)}
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
