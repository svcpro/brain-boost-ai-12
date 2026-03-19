import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Clock, Zap, ArrowRight, CheckCircle2, XCircle,
  TrendingUp, Sparkles, X, Target, ChevronRight, Timer,
  Trophy, Star, Share2, Flame, Award, BarChart3, Eye
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
  { key: "read", label: "Read & Recall", icon: Eye, description: "Quick concept refresh" },
  { key: "quiz", label: "Quiz Challenge", icon: Brain, description: "Test your understanding" },
  { key: "apply", label: "Apply & Analyze", icon: Target, description: "Higher-order thinking" },
  { key: "review", label: "Final Review", icon: CheckCircle2, description: "Consolidate learning" },
];

export default function AdvancedMissionWizard({
  missionId,
  missionTitle,
  missionType,
  topicName,
  subjectName,
  topicId,
  estimatedMinutes,
  brainImprovementPct,
  urgency,
  reasoning,
  onComplete,
  onClose,
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

  // Timer
  const [timeRemaining, setTimeRemaining] = useState(estimatedMinutes * 60);
  const [timerActive, setTimerActive] = useState(false);
  const [startTime] = useState(Date.now());
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Pre-mission data
  const [memoryBefore, setMemoryBefore] = useState(0);
  const [rankBefore, setRankBefore] = useState(4500);
  const [streakData, setStreakData] = useState({ current: 0, longest: 0, totalXP: 0, tier: "rookie" });

  // Results data
  const [sessionResults, setSessionResults] = useState<any>(null);
  const [showShareCard, setShowShareCard] = useState(false);

  // Timer countdown
  useEffect(() => {
    if (timerActive && timeRemaining > 0) {
      timerRef.current = setInterval(() => {
        setTimeRemaining(prev => {
          if (prev <= 1) {
            clearInterval(timerRef.current!);
            setTimerActive(false);
            if (wizardStep === "questions") handleTimerExpired();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [timerActive, wizardStep]);

  // Load pre-mission data on mount
  useEffect(() => {
    if (!user) return;
    loadPreMissionData();
  }, [user]);

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
      if (topicRes.status === "fulfilled" && (topicRes.value as any)?.data) {
        setMemoryBefore(Number((topicRes.value as any).data.memory_strength) || 0);
      }
      if (rankRes.status === "fulfilled" && (rankRes.value as any)?.data) {
        setRankBefore(Number((rankRes.value as any).data.predicted_rank) || 4500);
      }
    } catch {}
  };

  const handleTimerExpired = () => {
    toast({ title: "⏰ Time's up!", description: "Let's see how you did!" });
    triggerHaptic([50, 30]);
    finishQuestions();
  };

  /** Fetch questions via home-api/mission-questions — single API source */
  const fetchQuestions = useCallback(async (diff: "easy" | "medium" | "hard", stepType: string) => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("home-api", {
        body: {
          route: "mission-questions",
          mission_id: missionId.startsWith("risk-") || missionId.startsWith("weak-") || missionId.startsWith("review-") || missionId.startsWith("practice-") || missionId === "onboard-start"
            ? undefined  // Synthetic IDs — don't send as mission_id
            : missionId,
          topic_name: topicName,
          subject_name: subjectName,
          difficulty: diff,
          count: stepType === "apply" ? 3 : 4,
        },
      });

      if (error) throw error;

      if (data?.questions?.length) {
        setQuestions(data.questions);
        setCurrentQ(0);
        setSelectedAnswer(null);
        setShowFeedback(false);
      } else {
        // Fallback questions
        setQuestions(generateFallbackQuestions(diff));
        setCurrentQ(0);
      }
    } catch (e: any) {
      console.error("Failed to fetch mission questions:", e);
      setQuestions(generateFallbackQuestions(diff));
      setCurrentQ(0);
    } finally {
      setLoading(false);
    }
  }, [user, missionId, topicName, subjectName]);

  const generateFallbackQuestions = (diff: "easy" | "medium" | "hard"): MissionQuestion[] => [
    { question: `What is the key concept of ${topicName || "this topic"}?`, options: ["Option A", "Option B", "Option C", "Option D"], correct_index: 0, explanation: "Review the fundamentals to strengthen your understanding.", difficulty: diff },
    { question: `How does ${topicName || "this concept"} apply in practice?`, options: ["Application A", "Application B", "Application C", "Application D"], correct_index: 1, explanation: "Understanding application deepens retention.", difficulty: diff },
    { question: `Which statement about ${topicName || "this topic"} is correct?`, options: ["Statement 1", "Statement 2", "Statement 3", "Statement 4"], correct_index: 2, explanation: "Accuracy in recall is crucial for exam performance.", difficulty: diff },
  ];

  const handleStartMission = async () => {
    triggerHaptic(30);
    setTimerActive(true);
    setWizardStep("questions");
    setMissionStep(0);

    // Call mission-start API (only for real mission IDs from brain_missions table)
    const isRealMissionId = !missionId.startsWith("risk-") && !missionId.startsWith("weak-") && !missionId.startsWith("review-") && !missionId.startsWith("practice-") && missionId !== "onboard-start";
    if (isRealMissionId) {
      try {
        await supabase.functions.invoke("home-api", {
          body: { route: "mission-start", mission_id: missionId },
        });
      } catch {}
    }

    // Create session in mission_sessions
    try {
      if (user) {
        const { data } = await supabase.from("mission_sessions").insert({
          user_id: user.id,
          mission_id: missionId,
          mission_title: missionTitle,
          topic_id: topicId || "",
          topic_name: topicName || "",
          subject_name: subjectName || "",
          mission_type: missionType,
          total_steps: MISSION_STEPS.length,
          time_limit_seconds: estimatedMinutes * 60,
          initial_difficulty: difficulty,
          memory_before: memoryBefore,
          rank_before: rankBefore,
          status: "active",
        }).select("id").single();
        // Store session id for later updates
        sessionIdRef.current = data?.id || null;
      }
    } catch {}

    fetchQuestions(difficulty, MISSION_STEPS[0].key);
  };

  const sessionIdRef = useRef<string | null>(null);

  const handleAnswer = (index: number) => {
    if (showFeedback) return;
    setSelectedAnswer(index);
    setShowFeedback(true);
    const isCorrect = index === questions[currentQ].correct_index;
    const newResults = [...results, isCorrect];
    setResults(newResults);
    triggerHaptic(isCorrect ? [20, 40] : [50]);

    // Adaptive difficulty
    const recent3 = newResults.slice(-3);
    const recentCorrect = recent3.filter(r => r).length;
    if (recent3.length >= 2) {
      if (recentCorrect === 0 && difficulty !== "easy") {
        setDifficulty("easy");
        setDifficultyChanges(prev => prev + 1);
      } else if (recentCorrect >= 3 && difficulty !== "hard") {
        setDifficulty("hard");
        setDifficultyChanges(prev => prev + 1);
      } else if (recentCorrect >= 2 && difficulty === "easy") {
        setDifficulty("medium");
        setDifficultyChanges(prev => prev + 1);
      }
    }
  };

  const handleNext = () => {
    setSelectedAnswer(null);
    setShowFeedback(false);
    if (currentQ + 1 < questions.length) {
      setCurrentQ(currentQ + 1);
    } else {
      if (missionStep + 1 < MISSION_STEPS.length) {
        setMissionStep(prev => prev + 1);
        fetchQuestions(difficulty, MISSION_STEPS[missionStep + 1].key);
      } else {
        finishQuestions();
      }
    }
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

    const timeLimitSec = estimatedMinutes * 60;
    const timeRatio = Math.max(0, 1 - (timeUsedSec / timeLimitSec));
    const speedBonus = timeRemaining > 0 ? Math.round(timeRatio * 30) : 0;

    const baseXP = correctCount * 10;
    const difficultyMultiplier = difficulty === "hard" ? 1.5 : difficulty === "easy" ? 0.8 : 1;
    const urgencyMultiplier = urgency === "critical" ? 1.3 : urgency === "high" ? 1.15 : 1;
    const totalXP = Math.round((baseXP + speedBonus) * difficultyMultiplier * urgencyMultiplier);

    const brainBoost = Math.round(brainImprovementPct * (correctCount / totalQ));

    const badges: string[] = [];
    if (accuracy === 100) badges.push("perfect_score");
    if (speedBonus > 20) badges.push("speed_demon");
    if (difficulty === "hard" && accuracy >= 75) badges.push("hard_mode_hero");
    if (difficultyChanges >= 2) badges.push("adaptive_warrior");
    if (results.length >= 12) badges.push("endurance_master");

    const score = Math.round(accuracy * 10 + speedBonus * 2 + (badges.length * 50));

    const sessionData = {
      timeUsedSec, correctCount, totalQ, accuracy, speedBonus,
      totalXP, brainBoost, badges, score, difficulty, difficultyChanges,
    };

    setSessionResults(sessionData);

    // Persist results
    try {
      if (!user) return;

      // 1. Update mission_sessions
      if (sessionIdRef.current) {
        await supabase.from("mission_sessions").update({
          completed_at: new Date().toISOString(),
          time_used_seconds: timeUsedSec,
          speed_bonus_pct: speedBonus,
          final_difficulty: difficulty,
          difficulty_changes: difficultyChanges,
          questions_total: totalQ,
          questions_correct: correctCount,
          accuracy_pct: accuracy,
          score, xp_earned: totalXP, brain_boost_pct: brainBoost,
          streak_extended: true, badges_earned: badges,
          memory_before: memoryBefore,
          memory_after: Math.min(100, memoryBefore + brainBoost),
          status: "completed",
          current_step: MISSION_STEPS.length,
        }).eq("id", sessionIdRef.current);
      }

      // 2. Complete the mission via API (for real mission IDs)
      const isRealMissionId = !missionId.startsWith("risk-") && !missionId.startsWith("weak-") && !missionId.startsWith("review-") && !missionId.startsWith("practice-") && missionId !== "onboard-start";
      if (isRealMissionId) {
        await supabase.functions.invoke("home-api", {
          body: { route: "mission-complete", mission_id: missionId },
        });
      }

      // 3. Update topic memory strength
      if (topicId && brainBoost > 0) {
        const { data: topic } = await supabase
          .from("topics")
          .select("id, memory_strength")
          .eq("id", topicId)
          .maybeSingle();
        if (topic) {
          await supabase.from("topics").update({
            memory_strength: Math.min(100, Number(topic.memory_strength) + brainBoost),
            last_revision_date: new Date().toISOString(),
          }).eq("id", topic.id);
        }
      }

      // 4. Update mission streak
      const today = new Date().toISOString().split("T")[0];
      const { data: existing } = await supabase
        .from("mission_streaks")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();

      if (existing) {
        const lastDate = existing.last_completed_date;
        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
        const isConsecutive = lastDate === yesterday || lastDate === today;
        const newStreak = lastDate === today ? existing.current_streak : (isConsecutive ? existing.current_streak + 1 : 1);

        await supabase.from("mission_streaks").update({
          current_streak: newStreak,
          longest_streak: Math.max(existing.longest_streak, newStreak),
          last_completed_date: today,
          total_missions_completed: existing.total_missions_completed + 1,
          total_xp_earned: existing.total_xp_earned + totalXP,
          updated_at: new Date().toISOString(),
        }).eq("user_id", user.id);

        setStreakData(prev => ({
          ...prev,
          current: newStreak,
          longest: Math.max(prev.longest, newStreak),
          totalXP: prev.totalXP + totalXP,
        }));
      } else {
        await supabase.from("mission_streaks").insert({
          user_id: user.id,
          current_streak: 1,
          longest_streak: 1,
          last_completed_date: today,
          total_missions_completed: 1,
          total_xp_earned: totalXP,
        });
        setStreakData({ current: 1, longest: 1, totalXP, tier: "rookie" });
      }

      // 5. Log study session
      await supabase.from("study_logs").insert({
        user_id: user.id,
        duration_minutes: Math.max(1, Math.round(timeUsedSec / 60)),
        study_mode: "mission",
        confidence_level: accuracy >= 75 ? "high" : accuracy >= 50 ? "medium" : "low",
        topic_name: topicName,
        subject_name: subjectName,
      });

      // 6. Confetti
      try {
        const { default: confetti } = await import("canvas-confetti");
        confetti({ particleCount: 150, spread: 90, origin: { y: 0.5 }, colors: ["hsl(175,80%,50%)", "#FFD700", "#4ECDC4", "#FF6B6B", "#A855F7"] });
      } catch {}
    } catch (e) {
      console.error("Failed to save mission results:", e);
    }
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const correctCount = results.filter(r => r).length;
  const totalQ = results.length || 1;

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-card/80 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <Target className="w-4 h-4 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {wizardStep === "briefing" ? "Mission Briefing" : wizardStep === "questions" ? `Step ${missionStep + 1}: ${MISSION_STEPS[missionStep]?.label}` : wizardStep === "results" ? "Results" : wizardStep === "impact" ? "Brain Impact" : "Share"}
          </span>
        </div>
        <div className="flex items-center gap-3">
          {timerActive && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold ${timeRemaining < 60 ? "bg-destructive/15 text-destructive animate-pulse" : timeRemaining < 120 ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}
            >
              <Timer className="w-3 h-3" />
              {formatTime(timeRemaining)}
            </motion.div>
          )}
          {wizardStep !== "results" && wizardStep !== "impact" && (
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          )}
        </div>
      </div>

      {/* Multi-step progress */}
      {wizardStep === "questions" && (
        <div className="px-4 py-2 bg-card/50 border-b border-border/50">
          <div className="flex items-center gap-1">
            {MISSION_STEPS.map((step, i) => (
              <div key={step.key} className="flex-1 flex items-center gap-1">
                <div className={`h-1.5 flex-1 rounded-full transition-all duration-500 ${i < missionStep ? "bg-primary" : i === missionStep ? "bg-primary/60" : "bg-secondary"}`} />
                {i < MISSION_STEPS.length - 1 && <div className="w-0.5" />}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-1">
            {MISSION_STEPS.map((step, i) => (
              <span key={step.key} className={`text-[8px] font-medium ${i <= missionStep ? "text-primary" : "text-muted-foreground/50"}`}>
                {step.label.split(" ")[0]}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-5 py-6">
        <AnimatePresence mode="wait">
          {/* ─── BRIEFING ─── */}
          {wizardStep === "briefing" && (
            <motion.div
              key="briefing"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="flex flex-col items-center text-center max-w-sm mx-auto pt-6"
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 1 }}
                className="w-20 h-20 rounded-2xl bg-primary/15 flex items-center justify-center mb-5"
              >
                <Brain className="w-10 h-10 text-primary" />
              </motion.div>

              <h2 className="text-lg font-bold text-foreground mb-1">{missionTitle}</h2>
              {topicName && (
                <p className="text-xs text-muted-foreground mb-4">
                  {subjectName ? `${subjectName} → ` : ""}{topicName}
                </p>
              )}

              <div className="w-full space-y-2 mb-5">
                {MISSION_STEPS.map((step, i) => {
                  const StepIcon = step.icon;
                  return (
                    <div key={step.key} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/40 border border-border/50">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <StepIcon className="w-3.5 h-3.5 text-primary" />
                      </div>
                      <div className="flex-1 text-left">
                        <p className="text-xs font-semibold text-foreground">{step.label}</p>
                        <p className="text-[10px] text-muted-foreground">{step.description}</p>
                      </div>
                      <span className="text-[10px] text-muted-foreground">{i + 1}/{MISSION_STEPS.length}</span>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground bg-secondary/60 px-3 py-1.5 rounded-full">
                  <Timer className="w-3.5 h-3.5" />
                  {estimatedMinutes} min timer
                </div>
                <div className="flex items-center gap-1.5 text-xs text-primary bg-primary/10 px-3 py-1.5 rounded-full font-medium">
                  <TrendingUp className="w-3.5 h-3.5" />
                  +{brainImprovementPct}% brain
                </div>
              </div>

              {streakData.current > 0 && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 rounded-xl bg-warning/10 border border-warning/20">
                  <Flame className="w-4 h-4 text-warning" />
                  <span className="text-xs text-warning font-medium">{streakData.current}-day mission streak 🔥</span>
                </div>
              )}

              <div className="flex items-start gap-1.5 mb-5 px-3 py-2 rounded-xl bg-secondary/40 border border-border/50 w-full">
                <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                <p className="text-[10px] text-muted-foreground italic leading-relaxed text-left">
                  {reasoning}
                </p>
              </div>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleStartMission}
                className="w-full max-w-xs py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                <Zap className="w-4 h-4" />
                Start Mission ({estimatedMinutes} min)
                <ArrowRight className="w-4 h-4" />
              </motion.button>
            </motion.div>
          )}

          {/* ─── QUESTIONS ─── */}
          {wizardStep === "questions" && (
            <motion.div
              key="questions"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="max-w-sm mx-auto"
            >
              {loading ? (
                <div className="py-12 px-4">
                  <AIProgressBar
                    label={`Preparing ${MISSION_STEPS[missionStep]?.label}`}
                    sublabel={`Difficulty: ${difficulty} • Adapting to your level`}
                    estimatedSeconds={8}
                  />
                </div>
              ) : questions.length > 0 ? (
                <AnimatePresence mode="wait">
                  <motion.div
                    key={`${missionStep}-${currentQ}`}
                    initial={{ opacity: 0, x: 30 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -30 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-[10px] text-muted-foreground font-medium">
                        Q{currentQ + 1}/{questions.length} • Step {missionStep + 1}/{MISSION_STEPS.length}
                      </span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${difficulty === "easy" ? "bg-green-500/15 text-green-500" : difficulty === "hard" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"}`}>
                        {difficulty}
                        {difficultyChanges > 0 && <span className="ml-1 text-[8px]">⚡</span>}
                      </span>
                    </div>

                    <h3 className="text-sm font-semibold text-foreground leading-relaxed mb-5">
                      {questions[currentQ].question}
                    </h3>

                    <div className="space-y-2.5">
                      {questions[currentQ].options.map((opt, i) => {
                        const isCorrect = i === questions[currentQ].correct_index;
                        const isSelected = selectedAnswer === i;
                        let optStyle = "border-border bg-card hover:border-primary/40";
                        if (showFeedback) {
                          if (isCorrect) optStyle = "border-green-500 bg-green-500/10";
                          else if (isSelected && !isCorrect) optStyle = "border-destructive bg-destructive/10";
                          else optStyle = "border-border bg-card opacity-50";
                        }

                        return (
                          <motion.button
                            key={i}
                            whileTap={!showFeedback ? { scale: 0.98 } : undefined}
                            onClick={() => handleAnswer(i)}
                            disabled={showFeedback}
                            className={`w-full text-left p-3.5 rounded-xl border transition-all text-sm ${optStyle}`}
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-full border border-border flex items-center justify-center text-[10px] font-bold text-muted-foreground shrink-0 mt-0.5">
                                {String.fromCharCode(65 + i)}
                              </span>
                              <span className="flex-1 text-foreground">{opt}</span>
                              {showFeedback && isCorrect && <CheckCircle2 className="w-5 h-5 text-green-500 shrink-0" />}
                              {showFeedback && isSelected && !isCorrect && <XCircle className="w-5 h-5 text-destructive shrink-0" />}
                            </div>
                          </motion.button>
                        );
                      })}
                    </div>

                    <AnimatePresence>
                      {showFeedback && (
                        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4">
                          <div className={`p-3 rounded-xl border text-xs leading-relaxed ${results[results.length - 1] ? "bg-green-500/5 border-green-500/20 text-green-600" : "bg-destructive/5 border-destructive/20 text-destructive"}`}>
                            <div className="flex items-start gap-2">
                              <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5" />
                              <div>
                                <p className="font-semibold mb-1">{results[results.length - 1] ? "Correct! 🎯" : "Not quite 💡"}</p>
                                <p className="text-foreground/80">{questions[currentQ].explanation}</p>
                              </div>
                            </div>
                          </div>
                          <motion.button
                            whileTap={{ scale: 0.97 }}
                            onClick={handleNext}
                            className="w-full mt-3 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2"
                          >
                            {currentQ + 1 < questions.length ? (
                              <>Next <ChevronRight className="w-4 h-4" /></>
                            ) : missionStep + 1 < MISSION_STEPS.length ? (
                              <>Next Step: {MISSION_STEPS[missionStep + 1]?.label} <ArrowRight className="w-4 h-4" /></>
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

          {/* ─── RESULTS ─── */}
          {wizardStep === "results" && sessionResults && (
            <motion.div
              key="results"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center text-center max-w-sm mx-auto pt-4"
            >
              <motion.div className="relative w-28 h-28 mb-5">
                <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                  <circle cx="50" cy="50" r="44" fill="none" strokeWidth="6" className="stroke-secondary" />
                  <motion.circle
                    cx="50" cy="50" r="44" fill="none" strokeWidth="6" strokeLinecap="round" className="stroke-primary"
                    strokeDasharray={`${2 * Math.PI * 44}`}
                    initial={{ strokeDashoffset: 2 * Math.PI * 44 }}
                    animate={{ strokeDashoffset: 2 * Math.PI * 44 * (1 - sessionResults.accuracy / 100) }}
                    transition={{ duration: 1.5, ease: "easeOut", delay: 0.3 }}
                  />
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <motion.span initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.5 }} className="text-2xl font-bold text-foreground">
                    {sessionResults.correctCount}/{sessionResults.totalQ}
                  </motion.span>
                  <span className="text-[10px] text-muted-foreground">correct</span>
                </div>
              </motion.div>

              <h2 className="text-lg font-bold text-foreground mb-1">
                {sessionResults.accuracy >= 90 ? "Outstanding! 🏆" : sessionResults.accuracy >= 75 ? "Excellent! 🎉" : sessionResults.accuracy >= 50 ? "Good job! 💪" : "Keep going! 🌱"}
              </h2>

              <p className="text-xs text-muted-foreground mb-4">
                Completed in {Math.max(1, Math.round(sessionResults.timeUsedSec / 60))} min
                {sessionResults.speedBonus > 0 && ` • Speed bonus: +${sessionResults.speedBonus}%`}
              </p>

              <div className="w-full grid grid-cols-2 gap-2 mb-5">
                <div className="p-3 rounded-xl bg-primary/5 border border-primary/15 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Star className="w-3.5 h-3.5 text-primary" />
                    <span className="text-lg font-bold text-primary">{sessionResults.totalXP}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">XP Earned</span>
                </div>
                <div className="p-3 rounded-xl bg-green-500/5 border border-green-500/15 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Brain className="w-3.5 h-3.5 text-green-500" />
                    <span className="text-lg font-bold text-green-500">+{sessionResults.brainBoost}%</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Brain Boost</span>
                </div>
                <div className="p-3 rounded-xl bg-warning/5 border border-warning/15 text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <Flame className="w-3.5 h-3.5 text-warning" />
                    <span className="text-lg font-bold text-warning">{streakData.current}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Day Streak</span>
                </div>
                <div className="p-3 rounded-xl bg-secondary border border-border text-center">
                  <div className="flex items-center justify-center gap-1 mb-1">
                    <BarChart3 className="w-3.5 h-3.5 text-foreground" />
                    <span className="text-lg font-bold text-foreground">{sessionResults.score}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">Score</span>
                </div>
              </div>

              {sessionResults.badges.length > 0 && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="w-full mb-5">
                  <p className="text-[10px] text-muted-foreground font-semibold uppercase tracking-widest mb-2">Badges Earned</p>
                  <div className="flex flex-wrap gap-2 justify-center">
                    {sessionResults.badges.map((badge: string) => (
                      <motion.div key={badge} initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 300 }}
                        className="flex items-center gap-1 px-3 py-1.5 rounded-full bg-primary/10 border border-primary/20">
                        <Award className="w-3 h-3 text-primary" />
                        <span className="text-[10px] font-medium text-primary capitalize">{badge.replace(/_/g, " ")}</span>
                      </motion.div>
                    ))}
                  </div>
                </motion.div>
              )}

              {sessionResults.difficultyChanges > 0 && (
                <div className="w-full px-3 py-2 rounded-xl bg-secondary/50 border border-border/50 mb-5">
                  <p className="text-[10px] text-muted-foreground italic">
                    ⚡ AI adapted difficulty {sessionResults.difficultyChanges}x during your session ({sessionResults.difficulty} final level)
                  </p>
                </div>
              )}

              <div className="w-full space-y-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setWizardStep("impact")}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2"
                >
                  <BarChart3 className="w-4 h-4" />
                  View Brain Impact Report
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
                <button
                  onClick={() => setShowShareCard(true)}
                  className="w-full py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share Achievement
                </button>
              </div>
            </motion.div>
          )}

          {/* ─── BRAIN IMPACT REPORT ─── */}
          {wizardStep === "impact" && sessionResults && (
            <motion.div
              key="impact"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="max-w-sm mx-auto"
            >
              <MissionBrainImpactReport
                topicName={topicName || "Topic"}
                subjectName={subjectName || "Subject"}
                memoryBefore={memoryBefore}
                memoryAfter={Math.min(100, memoryBefore + sessionResults.brainBoost)}
                rankBefore={rankBefore}
                rankAfter={Math.max(1, rankBefore - Math.round(sessionResults.brainBoost * 5))}
                accuracy={sessionResults.accuracy}
                xpEarned={sessionResults.totalXP}
                brainBoost={sessionResults.brainBoost}
                streakDays={streakData.current}
                badges={sessionResults.badges}
                difficulty={sessionResults.difficulty}
              />

              <div className="mt-5 space-y-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => {
                    onComplete(sessionResults);
                    onClose();
                  }}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Done — Back to Home
                </motion.button>
                <button
                  onClick={() => setShowShareCard(true)}
                  className="w-full py-2.5 text-xs text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <Share2 className="w-3.5 h-3.5" />
                  Share to Community
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Share card overlay */}
      <AnimatePresence>
        {showShareCard && sessionResults && (
          <MissionShareCard
            missionTitle={missionTitle}
            accuracy={sessionResults.accuracy}
            xpEarned={sessionResults.totalXP}
            brainBoost={sessionResults.brainBoost}
            streakDays={streakData.current}
            score={sessionResults.score}
            badges={sessionResults.badges}
            onClose={() => setShowShareCard(false)}
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
