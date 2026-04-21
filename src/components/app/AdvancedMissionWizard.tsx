import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, Zap, ArrowRight, CheckCircle2, XCircle,
  TrendingUp, Sparkles, X, Target, ChevronRight, Timer,
  Trophy, Star, Share2, Flame, Award, BarChart3, Eye,
  Shield, Crosshair, ChevronLeft
} from "lucide-react";
import AIProgressBar from "./AIProgressBar";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import { safeNum } from "@/lib/safeRender";
import MissionBrainImpactReport from "./MissionBrainImpactReport";
import MissionShareCard from "./MissionShareCard";

interface MissionQuestion {
  question: string;
  options: string[];
  correct_index: number;
  explanation: string;
  difficulty: "easy" | "medium" | "hard";
}

interface AdvancedMissionWizardProps {
  missionId: string;
  missionTitle: string;
  missionType: string;
  topicName?: string;
  subjectName?: string;
  topicId?: string;
  estimatedMinutes: number;
  brainImprovementPct: number;
  urgency: string;
  reasoning: string;
  onComplete: (sessionData: any) => void;
  onClose: () => void;
}

type WizardStep = "briefing" | "questions" | "results" | "impact" | "share";

const MISSION_STEPS = [
  { key: "read", label: "Read & Recall", icon: Eye, description: "Quick concept refresh", color: "text-violet-500" },
  { key: "quiz", label: "Quiz Challenge", icon: Brain, description: "Test your understanding", color: "text-primary" },
  { key: "apply", label: "Apply & Analyze", icon: Target, description: "Higher-order thinking", color: "text-amber-500" },
  { key: "review", label: "Final Review", icon: CheckCircle2, description: "Consolidate learning", color: "text-emerald-500" },
];

export default function AdvancedMissionWizard({
  missionId, missionTitle, missionType, topicName, subjectName, topicId,
  estimatedMinutes, brainImprovementPct, urgency, reasoning, onComplete, onClose,
}: AdvancedMissionWizardProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [wizardStep, setWizardStep] = useState<WizardStep>("briefing");
  const [missionStep, setMissionStep] = useState(0);
  const [questions, setQuestions] = useState<MissionQuestion[]>([]);
  const [currentQ, setCurrentQ] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<number | null>(null);
  const [showFeedback, setShowFeedback] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const [loading, setLoading] = useState(false);
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("medium");
  const [difficultyChanges, setDifficultyChanges] = useState(0);

  const [timeRemaining, setTimeRemaining] = useState(estimatedMinutes * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const [memoryBefore, setMemoryBefore] = useState(0);
  const [rankBefore, setRankBefore] = useState(4500);
  const [streakData, setStreakData] = useState({ current: 0, longest: 0, totalXP: 0, tier: "rookie" });

  const [sessionResults, setSessionResults] = useState<any>(null);
  const [showShareCard, setShowShareCard] = useState(false);
  const sessionIdRef = useRef<string | null>(null);

  // Timer countdown
  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) { clearInterval(timerRef.current!); setTimerActive(false); if (wizardStep === "questions") handleTimerExpired(); return 0; }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, wizardStep]);

  useEffect(() => { if (user) loadPreMissionData(); }, [user]);

  const loadPreMissionData = async () => {
    if (!user) return;
    try {
      const [streakRes, topicRes, rankRes] = await Promise.allSettled([
        supabase.from("mission_streaks").select("*").eq("user_id", user.id).maybeSingle(),
        topicId ? supabase.from("topics").select("memory_strength").eq("id", topicId).maybeSingle() : Promise.resolve({ data: null }),
        supabase.from("rank_predictions_v2").select("predicted_rank").eq("user_id", user.id).order("computed_at", { ascending: false }).limit(1).maybeSingle(),
      ]);
      if (streakRes.status === "fulfilled" && streakRes.value?.data) {
        const s = streakRes.value.data;
        setStreakData({ current: s.current_streak, longest: s.longest_streak, totalXP: s.total_xp_earned, tier: s.current_tier || "rookie" });
      }
      if (topicRes.status === "fulfilled" && (topicRes.value as any)?.data) setMemoryBefore(Number((topicRes.value as any).data.memory_strength) || 0);
      if (rankRes.status === "fulfilled" && (rankRes.value as any)?.data) setRankBefore(Number((rankRes.value as any).data.predicted_rank) || 4500);
    } catch {}
  };

  const handleTimerExpired = () => {
    toast({ title: "⏰ Time's up!", description: "Let's see how you did!" });
    triggerHaptic([50, 30]);
    finishQuestions();
  };

  const fetchQuestions = useCallback(async (diff: "easy" | "medium" | "hard", stepType: string, startTimerOnLoad = false) => {
    if (!user) return;
    setLoading(true);
    try {
      // ─── Unified Today's Mission API: action=questions ───
      const { data, error } = await supabase.functions.invoke("home-api", {
        body: {
          route: "todays-mission-api",
          action: "questions",
          mission_id: missionId,
          topic_name: topicName,
          subject_name: subjectName,
          difficulty: diff,
          count: stepType === "apply" ? 3 : 4,
        },
      });
      if (error) throw error;
      if (data?.questions?.length) {
        setQuestions(data.questions); setCurrentQ(0); setSelectedAnswer(null); setShowFeedback(false);
      } else {
        console.warn("[Mission] No questions from API, using fallback:", data?.error);
        setQuestions(generateFallbackQuestions(diff)); setCurrentQ(0);
      }
    } catch (e) {
      console.warn("[Mission] questions fetch failed, using fallback:", e);
      setQuestions(generateFallbackQuestions(diff)); setCurrentQ(0);
    } finally {
      setLoading(false);
      // Start the timer ONLY after questions are loaded — never during loading
      if (startTimerOnLoad) setTimerActive(true);
    }
  }, [user, missionId, topicName, subjectName]);

  const generateFallbackQuestions = (diff: "easy" | "medium" | "hard"): MissionQuestion[] => [
    { question: `What is the key concept of ${topicName || "this topic"}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct_index: 0, explanation: "Review the fundamentals to strengthen your understanding.", difficulty: diff },
    { question: `How does ${topicName || "this concept"} apply in practice?`, options: ["Application A", "Application B", "Application C", "Application D"], correct_index: 1, explanation: "Understanding application deepens retention.", difficulty: diff },
    { question: `Which statement about ${topicName || "this topic"} is correct?`, options: ["Statement 1", "Statement 2", "Statement 3", "Statement 4"], correct_index: 2, explanation: "Accuracy in recall is crucial for exam performance.", difficulty: diff },
  ];

  // 🚀 ULTRA-FAST: Prefetch first batch of questions in the background as soon
  // as the briefing screen mounts — so when user taps Start, they're already cached.
  const prefetchedRef = useRef(false);
  useEffect(() => {
    if (prefetchedRef.current || !user || wizardStep !== "briefing") return;
    prefetchedRef.current = true;
    fetchQuestions(difficulty, MISSION_STEPS[0].key, false);
  }, [user, wizardStep, fetchQuestions, difficulty]);

  const handleStartMission = async () => {
    triggerHaptic(30);
    setWizardStep("questions");
    setMissionStep(0);

    // ─── Unified Today's Mission API: action=start (works for both real + synthetic) ───
    try {
      const { data: startData, error: startErr } = await supabase.functions.invoke("home-api", {
        body: { route: "todays-mission-api", action: "start", mission_id: missionId },
      });
      if (startErr) {
        console.warn("[Mission] start failed:", startErr.message);
      } else if (startData?.already_started) {
        toast({ title: "▶️ Resumed", description: "Continuing your mission" });
      }
    } catch (e) {
      console.warn("[Mission] start invocation error:", e);
    }

    // ─── Persist local mission_sessions row for analytics & resume ───
    try {
      if (user) {
        const { data } = await supabase.from("mission_sessions").insert({
          user_id: user.id, mission_id: missionId, mission_title: missionTitle, topic_id: topicId || "", topic_name: topicName || "",
          subject_name: subjectName || "", mission_type: missionType, total_steps: MISSION_STEPS.length, time_limit_seconds: estimatedMinutes * 60,
          initial_difficulty: difficulty, memory_before: memoryBefore, rank_before: rankBefore, status: "active",
        }).select("id").single();
        sessionIdRef.current = data?.id || null;
      }
    } catch (e) {
      console.warn("[Mission] session insert failed:", e);
    }

    // If prefetch already finished, start the timer immediately.
    // Otherwise fetchQuestions will start it once questions land.
    if (questions.length > 0 && !loading) {
      setTimerActive(true);
    } else {
      fetchQuestions(difficulty, MISSION_STEPS[0].key, true);
    }
  };

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    const isCorrect = index === questions[currentQ].correct_index;
    const newResults = [...results, isCorrect];
    setResults(newResults);
    triggerHaptic(isCorrect ? [20, 40] : [50]);

    const recent3 = newResults.slice(-3);
    const recentCorrect = recent3.filter(r => r).length;
    if (recent3.length >= 2) {
      if (recentCorrect === 0 && difficulty !== "easy") { setDifficulty("easy"); setDifficultyChanges(p => p + 1); }
      else if (recentCorrect >= 3 && difficulty !== "hard") { setDifficulty("hard"); setDifficultyChanges(p => p + 1); }
      else if (recentCorrect >= 2 && difficulty === "easy") { setDifficulty("medium"); setDifficultyChanges(p => p + 1); }
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    if (currentQ + 1 < questions.length) { setCurrentQ(currentQ + 1); }
    else if (missionStep + 1 < MISSION_STEPS.length) { setMissionStep(p => p + 1); fetchQuestions(difficulty, MISSION_STEPS[missionStep + 1].key); }
    else { finishQuestions(); }
  };

  const finishQuestions = () => {
    setTimerActive(false);
    if (timerRef.current) clearInterval(timerRef.current);
    setWizardStep("results");
    calculateResults();
  };

  const calculateResults = async () => {
    const timeUsedSec = Math.round((Date.now() - startTime) / 1000);
    const correctCount = results.filter(r => r).length;
    const totalQ = results.length || 1;
    const accuracy = Math.round((correctCount / totalQ) * 100);
    const timeRatio = Math.max(0, 1 - (timeUsedSec / (estimatedMinutes * 60)));
    const speedBonus = timeRemaining > 0 ? Math.round(timeRatio * 30) : 0;
    const baseXP = correctCount * 10;
    const diffMult = difficulty === "hard" ? 1.5 : difficulty === "easy" ? 0.8 : 1;
    const urgMult = urgency === "critical" ? 1.3 : urgency === "high" ? 1.15 : 1;
    const totalXP = Math.round((baseXP + speedBonus) * diffMult * urgMult);
    const brainBoost = Math.round(brainImprovementPct * (correctCount / totalQ));
    // Badges — earned only on real performance, never as participation trophies
    const badges: string[] = [];
    if (totalQ >= 4 && accuracy === 100) badges.push("perfect_score");
    // Speed Demon: must be fast AND mostly correct
    if (speedBonus >= 20 && accuracy >= 70) badges.push("speed_demon");
    // Hard Mode Hero: stayed on hard with strong accuracy
    if (difficulty === "hard" && accuracy >= 75) badges.push("hard_mode_hero");
    // Adaptive Warrior: AI raised difficulty (not just dropped it) AND user kept up
    if (difficultyChanges >= 2 && difficulty !== "easy" && accuracy >= 70) badges.push("adaptive_warrior");
    // Endurance Master: long session AND solid accuracy
    if (results.length >= 12 && accuracy >= 70) badges.push("endurance_master");
    // Comeback Kid: started rough, finished strong
    if (results.length >= 6) {
      const firstHalf = results.slice(0, Math.floor(results.length / 2));
      const lastHalf = results.slice(Math.floor(results.length / 2));
      const firstAcc = firstHalf.filter(Boolean).length / Math.max(firstHalf.length, 1);
      const lastAcc = lastHalf.filter(Boolean).length / Math.max(lastHalf.length, 1);
      if (firstAcc < 0.5 && lastAcc >= 0.75) badges.push("comeback_kid");
    }
    // Sharp Shooter: high accuracy on a focused short session
    if (results.length >= 4 && results.length <= 8 && accuracy >= 90) badges.push("sharp_shooter");

    const score = Math.round(accuracy * 10 + speedBonus * 2 + (badges.length * 50));

    const sessionData = { timeUsedSec, correctCount, totalQ, accuracy, speedBonus, totalXP, brainBoost, badges, score, difficulty, difficultyChanges };
    setSessionResults(sessionData);

    try {
      if (!user) return;
      if (sessionIdRef.current) {
        await supabase.from("mission_sessions").update({
          completed_at: new Date().toISOString(), time_used_seconds: timeUsedSec, speed_bonus_pct: speedBonus,
          final_difficulty: difficulty, difficulty_changes: difficultyChanges, questions_total: totalQ, questions_correct: correctCount,
          accuracy_pct: accuracy, score, xp_earned: totalXP, brain_boost_pct: brainBoost, streak_extended: true, badges_earned: badges,
          memory_before: memoryBefore, memory_after: Math.min(100, memoryBefore + brainBoost), status: "completed", current_step: MISSION_STEPS.length,
        }).eq("id", sessionIdRef.current);
      }
      // ─── Unified Today's Mission API: action=complete ───
      try {
        const { data: completeData, error: completeErr } = await supabase.functions.invoke("home-api", {
          body: {
            route: "todays-mission-api",
            action: "complete",
            mission_id: missionId,
            score: sessionData.score,
            accuracy: sessionData.accuracy,
            time_taken_seconds: sessionData.timeUsedSec,
            questions_attempted: sessionData.totalQ,
            questions_correct: sessionData.correctCount,
          },
        });
        if (completeErr) {
          console.warn("[Mission] complete failed:", completeErr.message);
        } else if (completeData?.brain_impact) {
          // Merge server-side brain impact into local sessionResults so the impact report has authoritative data
          setSessionResults((prev: any) => ({ ...prev, brain_impact: completeData.brain_impact, reward: completeData.reward }));
        }
      } catch (e) {
        console.warn("[Mission] complete invocation error:", e);
      }
      if (topicId && brainBoost > 0) {
        const { data: topic } = await supabase.from("topics").select("id, memory_strength").eq("id", topicId).maybeSingle();
        if (topic) await supabase.from("topics").update({ memory_strength: Math.min(100, Number(topic.memory_strength) + brainBoost), last_revision_date: new Date().toISOString() }).eq("id", topic.id);
      }
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase.from("mission_streaks").select("*").eq("user_id", user.id).maybeSingle();
      if (existing) {
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const isConsecutive = existing.last_completed_date === yesterday || existing.last_completed_date === today;
        const newStreak = existing.last_completed_date === today ? existing.current_streak : (isConsecutive ? existing.current_streak + 1 : 1);
        await supabase.from("mission_streaks").update({ current_streak: newStreak, longest_streak: Math.max(existing.longest_streak, newStreak), last_completed_date: today, total_missions_completed: existing.total_missions_completed + 1, total_xp_earned: existing.total_xp_earned + totalXP, updated_at: new Date().toISOString() }).eq("user_id", user.id);
        setStreakData(prev => ({ ...prev, current: newStreak, longest: Math.max(prev.longest, newStreak), totalXP: prev.totalXP + totalXP }));
      } else {
        await supabase.from("mission_streaks").insert({ user_id: user.id, current_streak: 1, longest_streak: 1, last_completed_date: today, total_missions_completed: 1, total_xp_earned: totalXP });
        setStreakData({ current: 1, longest: 1, totalXP, tier: "rookie" });
      }
      await supabase.from("study_logs").insert({ user_id: user.id, duration_minutes: Math.max(1, Math.round(timeUsedSec / 60)), study_mode: "mission", confidence_level: accuracy >= 75 ? "high" : accuracy >= 50 ? "medium" : "low", topic_name: topicName, subject_name: subjectName });
      try { const { default: confetti } = await import("canvas-confetti"); confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, colors: ["hsl(175,80%,50%)", "#FFD700", "#4ECDC4", "#FF6B6B", "#A855F7"] }); } catch {}
    } catch (e) { console.error("Failed to save mission results:", e); }
  };

  const formatTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;
  const correctCount = results.filter(r => r).length;

  const headerTitle = wizardStep === "briefing" ? "Mission Briefing"
    : wizardStep === "questions" ? MISSION_STEPS[missionStep]?.label
    : wizardStep === "results" ? "Mission Results"
    : wizardStep === "impact" ? "Brain Impact" : "Share";

  const timerColor = timeRemaining < 60 ? "text-destructive" : timeRemaining < 120 ? "text-warning" : "text-muted-foreground";
  const timerBg = timeRemaining < 60 ? "bg-destructive/10" : timeRemaining < 120 ? "bg-warning/10" : "bg-secondary/60";

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* ─── MOBILE NATIVE HEADER ─── */}
      <div className="bg-card/95 backdrop-blur-xl border-b border-border/40 safe-area-top">
        {/* Top bar */}
        <div className="flex items-center justify-between px-4 pt-3 pb-2">
          <div className="flex items-center gap-2.5">
            {(wizardStep === "briefing" || wizardStep === "questions") && (
              <button onClick={onClose} className="w-8 h-8 rounded-xl bg-secondary/60 flex items-center justify-center active:scale-90 transition-transform">
                {wizardStep === "briefing" ? <X className="w-4 h-4 text-muted-foreground" /> : <ChevronLeft className="w-4 h-4 text-foreground" />}
              </button>
            )}
            <div>
              <h1 className="text-[13px] font-bold text-foreground leading-tight">{headerTitle}</h1>
              {wizardStep === "questions" && (
                <p className="text-[10px] text-muted-foreground mt-0.5">Step {missionStep + 1} of {MISSION_STEPS.length}</p>
              )}
            </div>
          </div>
          {timerActive && (
            <motion.div initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl ${timerBg} ${timeRemaining < 60 ? "animate-pulse" : ""}`}>
              <Timer className={`w-3.5 h-3.5 ${timerColor}`} />
              <span className={`text-xs font-bold tabular-nums ${timerColor}`}>{formatTime(timeRemaining)}</span>
            </motion.div>
          )}
        </div>

        {/* Step progress — mobile native pill bar */}
        {wizardStep === "questions" && (
          <div className="px-4 pt-0.5 pb-3">
            <div className="flex gap-1.5 mb-2">
              {MISSION_STEPS.map((step, i) => {
                const isActive = i === missionStep;
                const isDone = i < missionStep;
                return (
                  <div key={step.key} className="flex-1 h-[5px] rounded-full bg-secondary/80 overflow-hidden">
                    {isDone && <div className="h-full w-full rounded-full bg-primary" />}
                    {isActive && (
                      <motion.div className="h-full rounded-full bg-primary"
                        initial={{ width: "0%" }}
                        animate={{ width: `${((currentQ + (showFeedback ? 1 : 0.5)) / Math.max(questions.length, 1)) * 100}%` }}
                        transition={{ duration: 0.4, ease: "easeOut" }}
                      />
                    )}
                  </div>
                );
              })}
            </div>
            <div className="flex">
              {MISSION_STEPS.map((step, i) => {
                const StepIcon = step.icon;
                const isActive = i === missionStep;
                const isDone = i < missionStep;
                return (
                  <div key={step.key} className="flex-1 flex items-center justify-center gap-1">
                    {isDone ? (
                      <CheckCircle2 className="w-3 h-3 text-primary" />
                    ) : (
                      <StepIcon className={`w-3 h-3 ${isActive ? "text-primary" : "text-muted-foreground/30"}`} />
                    )}
                    <span className={`text-[9px] font-semibold ${isDone ? "text-primary" : isActive ? "text-foreground" : "text-muted-foreground/30"}`}>
                      {step.label.split(" ")[0]}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── CONTENT ─── */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-5 py-6 max-w-md mx-auto">
          <AnimatePresence mode="wait">

            {/* ════ BRIEFING ════ */}
            {wizardStep === "briefing" && (
              <motion.div key="briefing" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
                className="flex flex-col items-center text-center pt-4">
                
                {/* Hero icon */}
                <motion.div
                  animate={{ scale: [1, 1.06, 1] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="relative w-24 h-24 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 flex items-center justify-center mb-6 border border-primary/10"
                >
                  <Brain className="w-11 h-11 text-primary" />
                  <div className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center">
                    <Zap className="w-3 h-3 text-primary" />
                  </div>
                </motion.div>

                <h2 className="text-xl font-bold text-foreground mb-1">{missionTitle}</h2>
                {topicName && (
                  <p className="text-xs text-muted-foreground mb-5">
                    {subjectName ? `${subjectName} → ` : ""}{topicName}
                  </p>
                )}

                {/* Steps overview */}
                <div className="w-full space-y-2 mb-5">
                  {MISSION_STEPS.map((step, i) => {
                    const StepIcon = step.icon;
                    return (
                      <motion.div
                        key={step.key}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 + i * 0.08 }}
                        className="flex items-center gap-3 p-3.5 rounded-xl bg-card border border-border/50 hover:border-primary/20 transition-colors"
                      >
                        <div className={`w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center border border-primary/10`}>
                          <StepIcon className={`w-4 h-4 ${step.color}`} />
                        </div>
                        <div className="flex-1 text-left">
                          <p className="text-xs font-bold text-foreground">{step.label}</p>
                          <p className="text-[10px] text-muted-foreground">{step.description}</p>
                        </div>
                        <span className="text-[10px] text-muted-foreground/60 font-medium">{i + 1}/{MISSION_STEPS.length}</span>
                      </motion.div>
                    );
                  })}
                </div>

                {/* Stats */}
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-card px-3 py-2 rounded-xl border border-border/50">
                    <Timer className="w-3.5 h-3.5" />
                    <span className="font-medium">{estimatedMinutes} min</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/8 px-3 py-2 rounded-xl font-semibold border border-primary/10">
                    <TrendingUp className="w-3.5 h-3.5" />
                    +{brainImprovementPct}% brain
                  </div>
                </div>

                {/* Streak banner */}
                {streakData.current > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
                    className="flex items-center gap-2 mb-4 px-4 py-2.5 rounded-xl bg-warning/8 border border-warning/15 w-full justify-center">
                    <Flame className="w-4 h-4 text-warning" />
                    <span className="text-xs text-warning font-semibold">{streakData.current}-day mission streak 🔥</span>
                  </motion.div>
                )}

                {/* AI reasoning */}
                <div className="flex items-start gap-2 mb-6 px-3.5 py-3 rounded-xl bg-card border border-border/50 w-full">
                  <Sparkles className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                  <p className="text-[11px] text-muted-foreground italic leading-relaxed text-left">{reasoning}</p>
                </div>

                {/* CTA */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStartMission}
                  className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2.5 active:opacity-90 transition-all relative overflow-hidden group"
                  style={{ boxShadow: "0 6px 30px hsl(var(--primary) / 0.3)" }}
                >
                  <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-1000 bg-gradient-to-r from-transparent via-white/10 to-transparent" />
                  <Zap className="w-5 h-5" />
                  Start Mission ({estimatedMinutes} min)
                  <ArrowRight className="w-5 h-5" />
                </motion.button>
              </motion.div>
            )}

            {/* ════ QUESTIONS ════ */}
            {wizardStep === "questions" && (
              <motion.div key="questions" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                {loading ? (
                  <div className="py-16 px-4">
                    <AIProgressBar label={`Preparing ${MISSION_STEPS[missionStep]?.label}`} sublabel={`Difficulty: ${difficulty} • Adapting to your level`} estimatedSeconds={8} />
                  </div>
                ) : questions.length > 0 ? (
                  <AnimatePresence mode="wait">
                    <motion.div key={`${missionStep}-${currentQ}`} initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -30 }} transition={{ duration: 0.25 }}>
                      {/* Question header */}
                      <div className="flex items-center justify-between mb-5">
                        <div className="flex items-center gap-2">
                          <span className="text-[11px] text-muted-foreground font-medium bg-secondary/60 px-2.5 py-1 rounded-lg">
                            Q{currentQ + 1}/{questions.length}
                          </span>
                          <span className={`text-[10px] font-semibold px-2.5 py-1 rounded-lg ${difficulty === "easy" ? "bg-emerald-500/10 text-emerald-500" : difficulty === "hard" ? "bg-warning/10 text-warning" : "bg-secondary text-muted-foreground"}`}>
                            {difficulty}{difficultyChanges > 0 && " ⚡"}
                          </span>
                        </div>
                        {/* Mini score */}
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                          <CheckCircle2 className="w-3 h-3 text-emerald-500" />
                          <span className="font-medium">{correctCount}/{results.length}</span>
                        </div>
                      </div>

                      {/* Question text */}
                      <div className="p-4 rounded-2xl bg-card border border-border/50 mb-5">
                        <h3 className="text-[15px] font-semibold text-foreground leading-relaxed">
                          {questions[currentQ].question}
                        </h3>
                      </div>

                      {/* Options */}
                      <div className="space-y-2.5">
                        {questions[currentQ].options.map((opt, i) => {
                          const isCorrect = i === questions[currentQ].correct_index;
                          const isSelected = selectedAnswer === i;
                          let optClass = "border-border/50 bg-card hover:border-primary/30 hover:bg-primary/3";
                          if (showFeedback) {
                            if (isCorrect) optClass = "border-emerald-500/50 bg-emerald-500/8";
                            else if (isSelected && !isCorrect) optClass = "border-destructive/50 bg-destructive/8";
                            else optClass = "border-border/30 bg-card opacity-40";
                          }

                          return (
                            <motion.button
                              key={i}
                              whileTap={!showFeedback ? { scale: 0.98 } : undefined}
                              onClick={() => handleAnswer(i)}
                              disabled={showFeedback}
                              className={`w-full text-left p-4 rounded-2xl border transition-all ${optClass}`}
                            >
                              <div className="flex items-start gap-3">
                                <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 ${showFeedback && isCorrect ? "bg-emerald-500/15 text-emerald-500" : showFeedback && isSelected && !isCorrect ? "bg-destructive/15 text-destructive" : "bg-secondary text-muted-foreground"}`}>
                                  {String.fromCharCode(65 + i)}
                                </span>
                                <span className="flex-1 text-[13px] text-foreground leading-relaxed pt-0.5">{opt}</span>
                                {showFeedback && isCorrect && <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />}
                                {showFeedback && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />}
                              </div>
                            </motion.button>
                          );
                        })}
                      </div>

                      {/* Feedback & next */}
                      <AnimatePresence>
                        {showFeedback && (
                          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-5">
                            <div className={`p-4 rounded-2xl border ${results[results.length - 1] ? "bg-emerald-500/5 border-emerald-500/15" : "bg-destructive/5 border-destructive/15"}`}>
                              <div className="flex items-start gap-2.5">
                                <Sparkles className={`w-4 h-4 shrink-0 mt-0.5 ${results[results.length - 1] ? "text-emerald-500" : "text-destructive"}`} />
                                <div>
                                  <p className={`text-xs font-bold mb-1 ${results[results.length - 1] ? "text-emerald-500" : "text-destructive"}`}>
                                    {results[results.length - 1] ? "Correct! 🎯" : "Not quite 💡"}
                                  </p>
                                  <p className="text-[11px] text-muted-foreground leading-relaxed">{questions[currentQ].explanation}</p>
                                </div>
                              </div>
                            </div>
                            <motion.button
                              whileTap={{ scale: 0.97 }}
                              onClick={handleNext}
                              className="w-full mt-4 py-3.5 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:opacity-90"
                            >
                              {currentQ + 1 < questions.length ? (
                                <>Next <ChevronRight className="w-4 h-4" /></>
                              ) : missionStep + 1 < MISSION_STEPS.length ? (
                                <>Next: {MISSION_STEPS[missionStep + 1]?.label} <ArrowRight className="w-4 h-4" /></>
                              ) : (
                                <>See Results <Trophy className="w-4 h-4" /></>
                              )}
                            </motion.button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  </AnimatePresence>
                ) : null}
              </motion.div>
            )}

            {/* ════ RESULTS ════ */}
            {wizardStep === "results" && sessionResults && (
              <motion.div key="results" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center text-center pt-4">
                
                {/* Score ring */}
                <motion.div className="relative w-32 h-32 mb-6">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                    <circle cx="50" cy="50" r="42" fill="none" strokeWidth="5" className="stroke-secondary" />
                    <motion.circle cx="50" cy="50" r="42" fill="none" strokeWidth="5" strokeLinecap="round" className="stroke-primary"
                      strokeDasharray={`${2 * Math.PI * 42}`}
                      initial={{ strokeDashoffset: 2 * Math.PI * 42 }}
                      animate={{ strokeDashoffset: 2 * Math.PI * 42 * (1 - sessionResults.accuracy / 100) }}
                      transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }}
                      className="text-3xl font-bold text-foreground">{sessionResults.accuracy}%</motion.span>
                    <span className="text-[10px] text-muted-foreground font-medium">{sessionResults.correctCount}/{sessionResults.totalQ} correct</span>
                  </div>
                </motion.div>

                <h2 className="text-xl font-bold text-foreground mb-1">
                  {sessionResults.accuracy >= 90 ? "Outstanding! 🏆" : sessionResults.accuracy >= 75 ? "Excellent! 🎉" : sessionResults.accuracy >= 50 ? "Good Job! 💪" : "Keep Going! 🌱"}
                </h2>
                <p className="text-xs text-muted-foreground mb-5">
                  Completed in {Math.max(1, Math.round(sessionResults.timeUsedSec / 60))} min
                  {sessionResults.speedBonus > 0 && ` • +${sessionResults.speedBonus}% speed bonus`}
                </p>

                {/* Stats grid */}
                <div className="w-full grid grid-cols-2 gap-2.5 mb-5">
                  {[
                    { icon: Star, label: "XP Earned", value: `+${sessionResults.totalXP}`, color: "text-primary", bg: "bg-primary/8 border-primary/10" },
                    { icon: Brain, label: "Brain Boost", value: `+${sessionResults.brainBoost}%`, color: "text-emerald-500", bg: "bg-emerald-500/8 border-emerald-500/10" },
                    { icon: Flame, label: "Streak", value: `${streakData.current} days`, color: "text-warning", bg: "bg-warning/8 border-warning/10" },
                    { icon: BarChart3, label: "Score", value: sessionResults.score.toString(), color: "text-foreground", bg: "bg-card border-border/50" },
                  ].map(({ icon: Icon, label, value, color, bg }) => (
                    <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      className={`p-3.5 rounded-2xl border text-center ${bg}`}>
                      <div className={`flex items-center justify-center gap-1.5 mb-1 ${color}`}>
                        <Icon className="w-4 h-4" />
                        <span className="text-lg font-bold">{value}</span>
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
                    </motion.div>
                  ))}
                </div>

                {/* Badges */}
                {sessionResults.badges.length > 0 && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="w-full mb-5">
                    <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-2">Badges Earned</p>
                    <div className="flex flex-wrap gap-2 justify-center">
                      {sessionResults.badges.map((badge: string) => (
                        <motion.div key={badge} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
                          className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-primary/8 border border-primary/15">
                          <Award className="w-3.5 h-3.5 text-primary" />
                          <span className="text-[10px] font-semibold text-primary capitalize">{badge.replace(/_/g, " ")}</span>
                        </motion.div>
                      ))}
                    </div>
                  </motion.div>
                )}

                {sessionResults.difficultyChanges > 0 && (
                  <div className="w-full px-4 py-2.5 rounded-xl bg-card border border-border/50 mb-5">
                    <p className="text-[10px] text-muted-foreground italic">⚡ AI adapted difficulty {sessionResults.difficultyChanges}× during your session ({sessionResults.difficulty} final level)</p>
                  </div>
                )}

                <div className="w-full space-y-2.5">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => setWizardStep("impact")}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:opacity-90"
                    style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.25)" }}>
                    <BarChart3 className="w-4 h-4" /> View Brain Impact Report <ArrowRight className="w-4 h-4" />
                  </motion.button>
                  <button onClick={() => setShowShareCard(true)} className="w-full py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 active:scale-95">
                    <Share2 className="w-3.5 h-3.5" /> Share Achievement
                  </button>
                </div>
              </motion.div>
            )}

            {/* ════ BRAIN IMPACT ════ */}
            {wizardStep === "impact" && sessionResults && (
              <motion.div key="impact" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}>
                <MissionBrainImpactReport
                  topicName={topicName || "Topic"} subjectName={subjectName || "Subject"} memoryBefore={memoryBefore}
                  memoryAfter={Math.min(100, memoryBefore + sessionResults.brainBoost)} rankBefore={rankBefore}
                  rankAfter={Math.max(1, rankBefore - Math.round(sessionResults.brainBoost * 5))}
                  accuracy={sessionResults.accuracy} xpEarned={sessionResults.totalXP} brainBoost={sessionResults.brainBoost}
                  streakDays={streakData.current} badges={sessionResults.badges} difficulty={sessionResults.difficulty}
                />
                <div className="mt-6 space-y-2.5">
                  <motion.button whileTap={{ scale: 0.97 }} onClick={() => { onComplete(sessionResults); onClose(); }}
                    className="w-full py-4 rounded-2xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 active:opacity-90"
                    style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.25)" }}>
                    <CheckCircle2 className="w-4 h-4" /> Done — Back to Home
                  </motion.button>
                  <button onClick={() => setShowShareCard(true)} className="w-full py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5 active:scale-95">
                    <Share2 className="w-3.5 h-3.5" /> Share to Community
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Share card overlay */}
      <AnimatePresence>
        {showShareCard && sessionResults && (
          <MissionShareCard missionTitle={missionTitle} accuracy={sessionResults.accuracy} xpEarned={sessionResults.totalXP}
            brainBoost={sessionResults.brainBoost} streakDays={streakData.current} score={sessionResults.score}
            badges={sessionResults.badges} onClose={() => setShowShareCard(false)} />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
