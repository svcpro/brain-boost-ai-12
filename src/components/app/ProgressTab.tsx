import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Clock, Users, SlidersHorizontal, RefreshCw, Flame, Award, Trophy, Star, Zap, Medal, HeartCrack, PartyPopper, Snowflake, Globe, AlertTriangle } from "lucide-react";
import confetti from "canvas-confetti";
import { useRankPrediction } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast, useToast } from "@/hooks/use-toast";
import { setCache, getCache } from "@/lib/offlineCache";
import WeeklyReportCard from "./WeeklyReportCard";
import LeaderboardCard from "./LeaderboardCard";
import WeeklyFocusChart from "./WeeklyFocusChart";
import MonthlyFocusTrend from "./MonthlyFocusTrend";
import MonthlyHeatmap from "./MonthlyHeatmap";
import BrainEvolution from "./BrainEvolution";
import CompetitionIntel from "./CompetitionIntel";
import ExamSimulator from "./ExamSimulator";
import ExamHistory from "./ExamHistory";
import WeakQuestions from "./WeakQuestions";
import WeeklyReportAI from "./WeeklyReportAI";
import ConfidenceTrendChart from "./ConfidenceTrendChart";
import ConfidenceGoalTracker from "./ConfidenceGoalTracker";
import StreakFreezeCard from "./StreakFreezeCard";
import FreezeGiftInbox from "./FreezeGiftInbox";
import ConsistencyScore from "./ConsistencyScore";
import PushNotificationToggle from "./PushNotificationToggle";
import BadgeGallery from "./BadgeGallery";
import WeeklyDigestPreview from "./WeeklyDigestPreview";
import PredictionDashboard from "./PredictionDashboard";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";

type DayStatus = "studied" | "frozen" | "none";

interface StreakData {
  currentStreak: number;
  longestStreak: number;
  last30Days: DayStatus[];
  todayStudied: boolean;
  brokenStreak: number; // streak length before it was broken (0 if not broken)
  isComeback: boolean; // true if user just restarted after a 3+ day broken streak
}

const MILESTONES = [
  { days: 3, label: "3-Day Starter", icon: Zap, emoji: "⚡", color: "text-primary", ring: "border-primary/60", glow: "glow-primary" },
  { days: 5, label: "5-Day Shield", icon: Award, emoji: "🛡️", color: "text-warning", ring: "border-warning/60", glow: "" },
  { days: 7, label: "7-Day Streak", icon: Award, emoji: "🔥", color: "text-warning", ring: "border-warning/60", glow: "" },
  { days: 14, label: "14-Day Warrior", icon: Star, emoji: "⭐", color: "text-primary", ring: "border-primary/60", glow: "" },
  { days: 30, label: "30-Day Legend", icon: Trophy, emoji: "🏆", color: "text-success", ring: "border-success/60", glow: "" },
];

const ProgressTab = () => {
  const { user } = useAuth();
  const { isEnabled } = useFeatureFlagContext();
  const { data, loading, predictRank } = useRankPrediction();
  const [streak, setStreak] = useState<StreakData | null>(() => getCache("progress-streak"));
  const [showBrainEvo, setShowBrainEvo] = useState(false);
  const [showCompIntel, setShowCompIntel] = useState(false);
  const [showExamSim, setShowExamSim] = useState(false);
  const [retryQuestions, setRetryQuestions] = useState<any[] | undefined>(undefined);
  const [showWeeklyAI, setShowWeeklyAI] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const notifiedRef = useRef(false);
  const [freezeData, setFreezeData] = useState<{ available: number; usedToday: boolean }>({ available: 0, usedToday: false });
  const [checkingBenchmark, setCheckingBenchmark] = useState(false);

  const loadStreak = useCallback(async () => {
    if (!user) return;

    try {
      // Fetch study logs from last 90 days to compute streaks
      const since = new Date();
      since.setDate(since.getDate() - 90);

      const { data: logs } = await supabase
        .from("study_logs")
        .select("created_at")
        .eq("user_id", user.id)
        .gte("created_at", since.toISOString())
        .order("created_at", { ascending: true });

      // Fetch streak freezes
      const { data: freezes } = await (supabase as any)
        .from("streak_freezes")
        .select("id, used_date")
        .eq("user_id", user.id);

      const frozenDays = new Set<string>();
      let availableFreezes = 0;
      const todayDate = new Date().toISOString().split("T")[0];
      let usedFreezeToday = false;
      if (freezes) {
        for (const f of freezes) {
          if (f.used_date) {
            frozenDays.add(f.used_date);
            if (f.used_date === todayDate) usedFreezeToday = true;
          } else {
            availableFreezes++;
          }
        }
      }
      setFreezeData({ available: availableFreezes, usedToday: usedFreezeToday });

      if (!logs) return;

      // Build a set of study dates (YYYY-MM-DD)
      const studyDays = new Set<string>();
      for (const log of logs) {
        const d = new Date(log.created_at);
        studyDays.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`);
      }

      const today = new Date();
      const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
      const todayStudied = studyDays.has(todayStr);

      // Count streak considering frozen days as "studied"
      let currentStreak = 0;
      const checkDate = new Date(today);
      if (!todayStudied && !frozenDays.has(todayStr)) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (true) {
        const key = `${checkDate.getFullYear()}-${String(checkDate.getMonth() + 1).padStart(2, "0")}-${String(checkDate.getDate()).padStart(2, "0")}`;
        if (studyDays.has(key) || frozenDays.has(key)) {
          currentStreak++;
          checkDate.setDate(checkDate.getDate() - 1);
        } else break;
      }

      // Compute broken streak and comeback status
      let brokenStreak = 0;
      let isComeback = false;

      // Check for comeback: currentStreak is 1 (just today) and yesterday was a gap after a 3+ streak
      if (currentStreak === 1 && todayStudied) {
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const yKey = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
        if (!studyDays.has(yKey)) {
          // Walk back from 2 days ago to find previous streak
          const walkBack = new Date(today);
          walkBack.setDate(walkBack.getDate() - 2);
          let gapDays = 1;
          while (gapDays < 30) {
            const key = `${walkBack.getFullYear()}-${String(walkBack.getMonth() + 1).padStart(2, "0")}-${String(walkBack.getDate()).padStart(2, "0")}`;
            if (studyDays.has(key)) {
              let prevStreak = 0;
              const countDate = new Date(walkBack);
              while (true) {
                const k = `${countDate.getFullYear()}-${String(countDate.getMonth() + 1).padStart(2, "0")}-${String(countDate.getDate()).padStart(2, "0")}`;
                if (studyDays.has(k)) { prevStreak++; countDate.setDate(countDate.getDate() - 1); } else break;
              }
              if (prevStreak >= 3) { brokenStreak = prevStreak; isComeback = true; }
              break;
            }
            walkBack.setDate(walkBack.getDate() - 1);
            gapDays++;
          }
        }
      }

      // If not a comeback, check for broken streak (no study today)
      if (!isComeback && currentStreak === 0 && !todayStudied) {
        const walkBack = new Date(today);
        walkBack.setDate(walkBack.getDate() - 1);
        let gapDays = 1;
        while (gapDays < 30) {
          const key = `${walkBack.getFullYear()}-${String(walkBack.getMonth() + 1).padStart(2, "0")}-${String(walkBack.getDate()).padStart(2, "0")}`;
          if (studyDays.has(key)) {
            let prevStreak = 0;
            const countDate = new Date(walkBack);
            while (true) {
              const k = `${countDate.getFullYear()}-${String(countDate.getMonth() + 1).padStart(2, "0")}-${String(countDate.getDate()).padStart(2, "0")}`;
              if (studyDays.has(k)) { prevStreak++; countDate.setDate(countDate.getDate() - 1); } else break;
            }
            if (prevStreak >= 3) brokenStreak = prevStreak;
            break;
          }
          walkBack.setDate(walkBack.getDate() - 1);
          gapDays++;
        }
      }

      let longestStreak = 0;
      let tempStreak = 0;
      const iterDate = new Date(since);
      while (iterDate <= today) {
        const key = `${iterDate.getFullYear()}-${String(iterDate.getMonth() + 1).padStart(2, "0")}-${String(iterDate.getDate()).padStart(2, "0")}`;
        if (studyDays.has(key) || frozenDays.has(key)) {
          tempStreak++;
          longestStreak = Math.max(longestStreak, tempStreak);
        } else {
          tempStreak = 0;
        }
        iterDate.setDate(iterDate.getDate() + 1);
      }

      const last30Days: DayStatus[] = [];
      for (let i = 29; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        const dateOnly = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        if (studyDays.has(key)) last30Days.push("studied");
        else if (frozenDays.has(dateOnly)) last30Days.push("frozen");
        else last30Days.push("none");
      }

      const result = { currentStreak, longestStreak, last30Days, todayStudied, brokenStreak, isComeback };
      setStreak(result);
      setCache("progress-streak", result);
    } catch {
      // offline – cached data already loaded via initial state
    }
  }, [user]);

  // Show toast notification for milestone achievements, streak recovery, or comeback
  useEffect(() => {
    if (!streak || notifiedRef.current) return;
    notifiedRef.current = true;

    // Comeback celebration
    if (streak.isComeback) {
      confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 } });
      toast({
        title: "🎉 Welcome back!",
        description: "You're back on track — your new streak starts now!",
      });
      return;
    }

    // Streak recovery nudge
    if (streak.brokenStreak >= 3) {
      toast({
        title: `💔 ${streak.brokenStreak}-day streak broken`,
        description: "One session today can restart your momentum!",
      });
      return;
    }

    const hit = MILESTONES.filter((m) => streak.currentStreak >= m.days);
    const highest = hit.length > 0 ? hit[hit.length - 1] : null;
    // Only notify if streak exactly matches a milestone (celebrate the moment)
    const exact = MILESTONES.find((m) => streak.currentStreak === m.days);
    if (exact) {
      toast({
        title: `${exact.emoji} ${exact.label} Unlocked!`,
        description: `You've studied ${exact.days} days in a row. Keep it up!`,
      });
      // Award scaled streak freezes at milestones
      if (user) {
        const freezeRewards: Record<number, number> = { 3: 0, 5: 1, 7: 1, 14: 2, 30: 3 };
        const reward = freezeRewards[exact.days];
        if (reward && reward > 0) {
          const inserts = Array.from({ length: reward }, () => ({ user_id: user.id }));
          (supabase as any)
            .from("streak_freezes")
            .insert(inserts)
            .then(() => {
              toast({
                title: `❄️ ${reward} streak freeze${reward > 1 ? "s" : ""} earned!`,
                description: `${exact.days}-day milestone reward — skip ${reward > 1 ? "days" : "a day"} without breaking your streak.`,
              });
              loadStreak();
            });
        }
      }
    }
  }, [streak]);

  const runBenchmarkCheck = useCallback(async () => {
    if (!user || checkingBenchmark) return;
    setCheckingBenchmark(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await supabase.functions.invoke("benchmark-deviation-check", {
        headers: { Authorization: `Bearer ${session?.access_token}` },
      });
      const result = res.data;
      if (result?.alerts?.length > 0) {
        const negCount = result.alerts.filter((a: any) => a.severity === "negative").length;
        const posCount = result.alerts.filter((a: any) => a.severity === "positive").length;
        toast({
          title: `📊 Benchmark Analysis Complete`,
          description: `${negCount > 0 ? `${negCount} area${negCount > 1 ? "s" : ""} need attention` : ""}${negCount > 0 && posCount > 0 ? " · " : ""}${posCount > 0 ? `${posCount} area${posCount > 1 ? "s" : ""} above average` : ""}. Check notifications for details.`,
        });
      } else {
        toast({
          title: "✅ On Track",
          description: result?.message || "No significant deviations from global benchmarks.",
        });
      }
    } catch (e) {
      toast({ title: "Error", description: "Could not run benchmark check." });
    } finally {
      setCheckingBenchmark(false);
    }
  }, [user, checkingBenchmark]);

  useEffect(() => {
    predictRank();
    loadStreak();
  }, []);

  const predictedRank = data?.predicted_rank;
  const percentile = data?.percentile;
  const rankChange = data?.rank_change ?? 0;
  const weeklyData = data?.weekly_data ?? [];
  const weekTotalHours = data?.week_total_hours ?? 0;
  const history = data?.history ?? [];
  const factors = data?.factors;
  const hasData = predictedRank !== null && predictedRank !== undefined;

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Progress Intelligence</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hasData ? "AI-powered rank prediction active." : "Log study sessions to activate predictions."}
          </p>
        </div>
        <button onClick={predictRank} disabled={loading} className="p-2 rounded-lg neural-gradient neural-border hover:glow-primary transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* Study Streak - placeholder removed */}

      {/* Streak Freeze */}
      {isEnabled("progress_streak_freeze") && (
      <StreakFreezeCard
        availableFreezes={freezeData.available}
        usedToday={freezeData.usedToday}
        canUseToday={!!(streak && !streak.todayStudied && streak.currentStreak > 0)}
        onFreezeUsed={loadStreak}
      />
      )}

      {/* Freeze Gift Inbox */}
      {isEnabled("progress_gifts") && <FreezeGiftInbox />}

      {/* Badge Gallery */}
      {isEnabled("progress_badges") && <BadgeGallery />}

      {/* Push Notification Toggle */}
      {isEnabled("progress_push_notif") && <PushNotificationToggle />}

      {/* Comeback Celebration - kept inline with streak */}
      {streak && streak.isComeback && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="glass rounded-xl p-5 neural-border border-success/30 relative overflow-hidden"
        >
          <motion.div className="absolute inset-0 bg-gradient-to-br from-success/5 to-primary/5" animate={{ opacity: [0.3, 0.6, 0.3] }} transition={{ duration: 2, repeat: Infinity }} />
          <div className="relative flex items-start gap-3">
            <motion.div className="p-2 rounded-lg bg-success/10 shrink-0" animate={{ rotate: [0, -10, 10, -10, 0] }} transition={{ duration: 0.6, delay: 0.3 }}>
              <PartyPopper className="w-5 h-5 text-success" />
            </motion.div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">🎉 You're back!</h3>
              <p className="text-xs text-muted-foreground mt-1">After a break from your {streak.brokenStreak}-day streak, you've jumped right back in.</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-success font-medium px-2 py-1 rounded-full bg-success/10">🔥 New streak: Day 1</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Streak Recovery Nudge */}
      {streak && !streak.isComeback && streak.brokenStreak >= 3 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-5 neural-border border-warning/30">
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-warning/10 shrink-0"><HeartCrack className="w-5 h-5 text-warning" /></div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">Your {streak.brokenStreak}-day streak ended</h3>
              <p className="text-xs text-muted-foreground mt-1">You were on a great run! Studies show that resuming quickly preserves most of your memory gains.</p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-warning font-medium px-2 py-1 rounded-full bg-warning/10">🔥 Study today to start a new streak</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Weekly Report Card */}
      {isEnabled("progress_weekly_report") && <WeeklyReportCard />}

      {/* Weekly Brain Digest Preview */}
      {isEnabled("progress_weekly_digest") && <WeeklyDigestPreview />}

      {/* Consistency Score */}
      {isEnabled("progress_consistency") && <ConsistencyScore />}

      {/* Weekly Focus Chart */}
      {isEnabled("progress_weekly_focus") && <WeeklyFocusChart />}

      {/* Confidence Trend */}
      {isEnabled("progress_confidence") && (
        <>
          <ConfidenceTrendChart />
          <ConfidenceGoalTracker />
        </>
      )}

      {/* Monthly Charts */}
      {isEnabled("progress_monthly") && (
        <>
          <MonthlyFocusTrend />
          <MonthlyHeatmap />
        </>
      )}

      {/* Rank Prediction - placeholder removed */}

      {/* Leaderboard */}
      {isEnabled("progress_leaderboard") && <LeaderboardCard />}

      {/* Features - placeholder removed */}

      {/* Exam */}
      {isEnabled("progress_exam") && (
      <ExamHistory onRetryMistakes={(questions) => {
        setRetryQuestions(questions);
        setShowExamSim(true);
      }} />
      )}

      {/* Weak Questions */}
      {isEnabled("progress_weak_questions") && (
      <WeakQuestions onRetryWeak={(questions) => {
        setRetryQuestions(questions);
        setShowExamSim(true);
      }} />
      )}

      {showBrainEvo && <BrainEvolution onClose={() => setShowBrainEvo(false)} />}
      {showCompIntel && <CompetitionIntel onClose={() => setShowCompIntel(false)} />}
      {showExamSim && <ExamSimulator onClose={() => { setShowExamSim(false); setRetryQuestions(undefined); }} retryQuestions={retryQuestions} />}
      {showWeeklyAI && <WeeklyReportAI onClose={() => setShowWeeklyAI(false)} />}
      {showPredictions && <PredictionDashboard onClose={() => setShowPredictions(false)} />}
    </div>
  );
};

export default ProgressTab;
