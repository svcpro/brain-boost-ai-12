import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Clock, Users, SlidersHorizontal, RefreshCw, Flame, Award, Trophy, Star, Zap, Medal, HeartCrack, PartyPopper, Snowflake } from "lucide-react";
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

      {/* Study Streak */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <Flame className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Study Streak</h2>
        </div>
        {streak ? (
          <>
            <div className="flex items-center gap-6 mb-4">
              <div className="text-center">
                <div className="flex items-center gap-1 justify-center">
                  <Flame className={`w-5 h-5 ${streak.currentStreak > 0 ? "text-warning" : "text-muted-foreground"}`} />
                  <span className="text-3xl font-bold gradient-text">{streak.currentStreak}</span>
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">Current Streak</p>
              </div>
              <div className="text-center">
                <span className="text-xl font-bold text-foreground">{streak.longestStreak}</span>
                <p className="text-[10px] text-muted-foreground mt-1">Best Streak</p>
              </div>
              <div className="text-center ml-auto">
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${streak.todayStudied ? "bg-success/20 text-success" : "bg-warning/20 text-warning"}`}>
                  {streak.todayStudied ? "✓ Studied today" : "Not yet today"}
                </span>
              </div>
            </div>

            {/* 30-day heatmap grid */}
            <div>
              <p className="text-[10px] text-muted-foreground mb-2">Last 30 days</p>
              <div className="flex gap-[3px] flex-wrap">
                {streak.last30Days.map((status, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, scale: 0 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.2, delay: 0.1 + i * 0.015 }}
                    className={`w-[14px] h-[14px] rounded-sm ${
                      status === "studied"
                        ? "bg-primary/80"
                        : status === "frozen"
                        ? "bg-sky-400/60 border border-sky-400/40"
                        : "bg-secondary"
                    }`}
                    title={`${29 - i} days ago${status === "studied" ? " — studied" : status === "frozen" ? " — frozen ❄️" : ""}`}
                  />
                ))}
              </div>
              <div className="flex justify-between mt-1.5">
                <span className="text-[9px] text-muted-foreground">30 days ago</span>
                <span className="text-[9px] text-muted-foreground">Today</span>
              </div>
              {/* Legend */}
              <div className="flex items-center gap-3 mt-2">
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-primary/80" />
                  <span className="text-[9px] text-muted-foreground">Studied</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-400/60 border border-sky-400/40" />
                  <span className="text-[9px] text-muted-foreground">Frozen</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-secondary" />
                  <span className="text-[9px] text-muted-foreground">Missed</span>
                </div>
              </div>
            </div>

            {/* Milestone Badges */}
            <div className="mt-4 pt-3 border-t border-border">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Medal className="w-4 h-4 text-primary" />
                  <p className="text-xs font-semibold text-foreground">Badges</p>
                </div>
                <span className="text-[10px] text-muted-foreground">
                  {MILESTONES.filter((m) => streak.longestStreak >= m.days).length}/{MILESTONES.length} earned
                </span>
              </div>
              <div className="grid grid-cols-5 gap-2">
                {MILESTONES.map((m, idx) => {
                  const earned = streak.longestStreak >= m.days;
                  const active = streak.currentStreak >= m.days;
                  // Progress toward this badge
                  const prevDays = idx > 0 ? MILESTONES[idx - 1].days : 0;
                  const progress = earned
                    ? 100
                    : Math.min(100, Math.round(((streak.currentStreak - prevDays) / (m.days - prevDays)) * 100));
                  const circumference = 2 * Math.PI * 28;
                  const dashOffset = circumference - (Math.max(0, progress) / 100) * circumference;

                  return (
                    <motion.div
                      key={m.days}
                      initial={{ opacity: 0, scale: 0.5 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ type: "spring", stiffness: 300, damping: 20, delay: idx * 0.08 }}
                      className={`relative flex flex-col items-center gap-1 p-2 rounded-xl border transition-all ${
                        active
                          ? `${m.ring} bg-primary/5`
                          : earned
                          ? "border-border bg-secondary/40"
                          : "border-border/30 bg-secondary/10"
                      }`}
                    >
                      {/* Circular progress ring */}
                      <div className="relative w-14 h-14">
                        <svg className="w-full h-full -rotate-90" viewBox="0 0 64 64">
                          <circle cx="32" cy="32" r="28" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                          <motion.circle
                            cx="32" cy="32" r="28" fill="none"
                            stroke={active ? "hsl(var(--primary))" : earned ? "hsl(var(--success))" : "hsl(var(--muted-foreground))"}
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeDasharray={circumference}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: dashOffset }}
                            transition={{ duration: 1, delay: 0.3 + idx * 0.1 }}
                            opacity={earned || progress > 0 ? 1 : 0.2}
                          />
                        </svg>
                        <div className="absolute inset-0 flex items-center justify-center">
                          {earned ? (
                            <motion.span
                              className="text-xl"
                              initial={{ scale: 0 }}
                              animate={{ scale: 1 }}
                              transition={{ type: "spring", stiffness: 400, delay: 0.5 + idx * 0.1 }}
                            >
                              {m.emoji}
                            </motion.span>
                          ) : (
                            <m.icon className={`w-5 h-5 ${progress > 0 ? "text-muted-foreground" : "text-muted-foreground/40"}`} />
                          )}
                        </div>
                      </div>

                      <span className={`text-[9px] font-semibold text-center leading-tight ${
                        active ? "text-foreground" : earned ? "text-foreground" : "text-muted-foreground"
                      }`}>
                        {m.label}
                      </span>

                      {!earned && (
                        <span className="text-[8px] text-muted-foreground">
                          {Math.max(0, m.days - streak.currentStreak)}d left
                        </span>
                      )}

                      {active && (
                        <motion.div
                          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-success flex items-center justify-center"
                          initial={{ scale: 0 }}
                          animate={{ scale: 1 }}
                          transition={{ type: "spring", delay: 0.6 + idx * 0.1 }}
                        >
                          <span className="text-[8px] text-success-foreground font-bold">✓</span>
                        </motion.div>
                      )}
                    </motion.div>
                  );
                })}
              </div>

              {/* Next milestone hint */}
              {(() => {
                const next = MILESTONES.find((m) => streak.currentStreak < m.days);
                if (!next) return (
                  <p className="text-[10px] text-success text-center mt-3">🎉 All badges unlocked! You're a legend!</p>
                );
                return (
                  <p className="text-[10px] text-muted-foreground text-center mt-3">
                    {next.emoji} <span className="text-foreground font-medium">{next.days - streak.currentStreak} more days</span> until "{next.label}"
                  </p>
                );
              })()}
            </div>
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">Loading streak data…</p>
        )}
      </motion.div>

      {/* Streak Freeze */}
      <StreakFreezeCard
        availableFreezes={freezeData.available}
        usedToday={freezeData.usedToday}
        canUseToday={!!(streak && !streak.todayStudied && streak.currentStreak > 0)}
        onFreezeUsed={loadStreak}
      />

      {/* Freeze Gift Inbox */}
      <FreezeGiftInbox />

      {/* Badge Gallery — shareable milestone badges */}
      <BadgeGallery />

      {/* Push Notification Toggle */}
      <PushNotificationToggle />

      {/* Comeback Celebration */}
      {streak && streak.isComeback && (
        <motion.div
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 20 }}
          className="glass rounded-xl p-5 neural-border border-success/30 relative overflow-hidden"
        >
          <motion.div
            className="absolute inset-0 bg-gradient-to-br from-success/5 to-primary/5"
            animate={{ opacity: [0.3, 0.6, 0.3] }}
            transition={{ duration: 2, repeat: Infinity }}
          />
          <div className="relative flex items-start gap-3">
            <motion.div
              className="p-2 rounded-lg bg-success/10 shrink-0"
              animate={{ rotate: [0, -10, 10, -10, 0] }}
              transition={{ duration: 0.6, delay: 0.3 }}
            >
              <PartyPopper className="w-5 h-5 text-success" />
            </motion.div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">🎉 You're back!</h3>
              <p className="text-xs text-muted-foreground mt-1">
                After a break from your {streak.brokenStreak}-day streak, you've jumped right back in. That takes real discipline!
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-success font-medium px-2 py-1 rounded-full bg-success/10">
                  🔥 New streak: Day 1
                </span>
                <span className="text-[10px] text-muted-foreground">Keep going to rebuild momentum</span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Streak Recovery Nudge */}
      {streak && !streak.isComeback && streak.brokenStreak >= 3 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-5 neural-border border-warning/30"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-warning/10 shrink-0">
              <HeartCrack className="w-5 h-5 text-warning" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-foreground">
                Your {streak.brokenStreak}-day streak ended
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                You were on a great run! Studies show that resuming quickly preserves most of your memory gains.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <span className="text-[10px] text-warning font-medium px-2 py-1 rounded-full bg-warning/10">
                  🔥 Study today to start a new streak
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      )}

      {/* Weekly Report Card */}
      <WeeklyReportCard />

      {/* Weekly Brain Digest Preview */}
      <WeeklyDigestPreview />

      {/* Consistency Score */}
      <ConsistencyScore />

      {/* Weekly Focus Chart */}
      <WeeklyFocusChart />

      {/* Confidence Trend */}
      <ConfidenceTrendChart />

      {/* Confidence Goal Tracker */}
      <ConfidenceGoalTracker />

      {/* Monthly Focus Trend */}
      <MonthlyFocusTrend />

      {/* Monthly Heatmap */}
      <MonthlyHeatmap />

      {/* Rank Prediction */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <TrendingUp className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Rank Prediction</h2>
        </div>
        {hasData ? (
          <>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold gradient-text">#{predictedRank!.toLocaleString()}</span>
              {rankChange !== 0 && (
                <span className={`text-sm mb-1 flex items-center gap-1 ${rankChange > 0 ? "text-success" : "text-destructive"}`}>
                  <TrendingUp className={`w-3 h-3 ${rankChange < 0 ? "rotate-180" : ""}`} />
                  {rankChange > 0 ? "+" : ""}{rankChange.toLocaleString()}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              Top {percentile ? (100 - percentile).toFixed(1) : "—"}% · Based on memory strength ({factors?.avg_strength}%), coverage ({Math.round((factors?.coverage_ratio ?? 0) * 100)}%), and {factors?.total_hours}h studied.
            </p>

            {/* Rank history graph */}
            {history.length > 1 && (
              <>
                <div className="mt-4 flex items-end gap-1 h-16">
                  {history.map((h, i) => {
                    const maxRank = Math.max(...history.map(x => x.rank));
                    const minRank = Math.min(...history.map(x => x.rank));
                    const range = maxRank - minRank || 1;
                    const heightPct = ((maxRank - h.rank) / range) * 80 + 20;
                    return (
                      <motion.div
                        key={i}
                        className="flex-1 bg-primary/30 rounded-t"
                        initial={{ height: 0 }}
                        animate={{ height: `${heightPct}%` }}
                        transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                      />
                    );
                  })}
                </div>
                <div className="flex justify-between mt-1">
                  <span className="text-[9px] text-muted-foreground">Oldest</span>
                  <span className="text-[9px] text-muted-foreground">Now</span>
                </div>
              </>
            )}
          </>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            No prediction yet. Log study sessions to get your rank estimate.
          </p>
        )}
      </motion.div>

      {/* Weekly Study */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-4">
          <BarChart3 className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">This Week</h2>
          <span className="ml-auto text-xs text-muted-foreground">{weekTotalHours}h total</span>
        </div>
        <div className="flex items-end gap-2 h-24">
          {(weeklyData.length > 0 ? weeklyData : ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d => ({ day: d, hours: 0 }))).map((d, i) => {
            const maxH = Math.max(...weeklyData.map(x => x.hours), 1);
            return (
              <div key={i} className="flex-1 flex flex-col items-center gap-1">
                <motion.div
                  className="w-full rounded-t bg-primary/40"
                  initial={{ height: 0 }}
                  animate={{ height: `${(d.hours / maxH) * 100}%` }}
                  transition={{ duration: 0.5, delay: 0.3 + i * 0.05 }}
                />
                <span className="text-[9px] text-muted-foreground">{d.day}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Factor Breakdown */}
      {factors && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass rounded-xl p-5 neural-border"
        >
          <div className="flex items-center gap-2 mb-4">
            <SlidersHorizontal className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">Rank Factors</h2>
          </div>
          <div className="space-y-3">
            {[
              { label: "Memory Strength", value: factors.avg_strength, max: 100, suffix: "%" },
              { label: "Topic Coverage", value: Math.round(factors.coverage_ratio * 100), max: 100, suffix: "%" },
              { label: "Study Volume", value: factors.total_hours, max: 200, suffix: "h" },
            ].map((f, i) => (
              <div key={i}>
                <div className="flex justify-between mb-1">
                  <span className="text-xs text-foreground">{f.label}</span>
                  <span className="text-xs text-muted-foreground">{f.value}{f.suffix}</span>
                </div>
                <div className="h-1.5 rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-primary/60"
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min((f.value / f.max) * 100, 100)}%` }}
                    transition={{ duration: 0.8, delay: 0.4 + i * 0.1 }}
                  />
                </div>
              </div>
            ))}
            <p className="text-[10px] text-muted-foreground mt-2">
              Composite Score: {factors.composite_score}/100 · {factors.strong_topics}/{factors.topic_count} topics strong
            </p>
          </div>
        </motion.div>
      )}

      {/* Leaderboard */}
      <LeaderboardCard />

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
      >
        <button onClick={() => setShowBrainEvo(true)} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <Clock className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Brain Evolution</p>
          <p className="text-[10px] text-muted-foreground">Timeline view</p>
        </button>
        <button onClick={() => setShowCompIntel(true)} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <Users className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Competition Intel</p>
          <p className="text-[10px] text-muted-foreground">Peer comparison</p>
        </button>
        <button onClick={() => setShowPredictions(true)} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <TrendingUp className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Predictions</p>
          <p className="text-[10px] text-muted-foreground">Forecasts & strategy</p>
        </button>
        <button onClick={() => setShowExamSim(true)} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <SlidersHorizontal className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Exam Simulator</p>
          <p className="text-[10px] text-muted-foreground">Strategy testing</p>
        </button>
        <button onClick={() => setShowWeeklyAI(true)} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <BarChart3 className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Weekly Report</p>
          <p className="text-[10px] text-muted-foreground">AI analysis</p>
        </button>
      </motion.div>

      <ExamHistory onRetryMistakes={(questions) => {
        setRetryQuestions(questions);
        setShowExamSim(true);
      }} />

      <WeakQuestions onRetryWeak={(questions) => {
        setRetryQuestions(questions);
        setShowExamSim(true);
      }} />

      {showBrainEvo && <BrainEvolution onClose={() => setShowBrainEvo(false)} />}
      {showCompIntel && <CompetitionIntel onClose={() => setShowCompIntel(false)} />}
      {showExamSim && <ExamSimulator onClose={() => { setShowExamSim(false); setRetryQuestions(undefined); }} retryQuestions={retryQuestions} />}
      {showWeeklyAI && <WeeklyReportAI onClose={() => setShowWeeklyAI(false)} />}
      {showPredictions && <PredictionDashboard onClose={() => setShowPredictions(false)} />}
    </div>
  );
};

export default ProgressTab;
