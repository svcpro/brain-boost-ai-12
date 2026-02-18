import React, { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, Zap, Brain, Clock, Flame, Shield, AlertOctagon,
  Play, RefreshCw, CheckCircle, ChevronRight, Sparkles, TrendingUp,
  Target, X
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { getCache, setCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";
import ExplainButton from "./ExplainButton";
import FocusModeSession from "./FocusModeSession";

// ─── Types ───────────────────────────────────────────────────
interface RiskTopic extends TopicPrediction {
  estimated_fix_minutes?: number;
  improvement_estimate?: number;
}

interface RecallQuestion {
  question: string;
  topic_name: string;
}

// ─── Risk Heatmap Cell ───────────────────────────────────────
const HeatmapCell = ({
  topic,
  onFix,
  onEmergency,
  delay,
}: {
  topic: RiskTopic;
  onFix: () => void;
  onEmergency: () => void;
  delay: number;
}) => {
  const risk = Math.round(100 - topic.memory_strength);
  const isEmergency = risk > 85;
  const isHigh = risk > 60;
  const isMedium = risk > 35;

  const bg = isEmergency
    ? "bg-destructive/30 border-destructive/50"
    : isHigh
    ? "bg-warning/20 border-warning/40"
    : isMedium
    ? "bg-yellow-500/15 border-yellow-500/30"
    : "bg-success/10 border-success/30";

  const glow = isEmergency ? "shadow-[0_0_12px_hsl(var(--destructive)/0.3)]" : "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay, type: "spring", stiffness: 300, damping: 20 }}
      className={`relative rounded-xl border p-3 ${bg} ${glow} transition-all group cursor-pointer hover:scale-[1.02]`}
      onClick={isEmergency ? onEmergency : onFix}
    >
      {isEmergency && (
        <motion.div
          className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-destructive flex items-center justify-center"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.5 }}
        >
          <AlertOctagon className="w-2.5 h-2.5 text-destructive-foreground" />
        </motion.div>
      )}

      <p className="text-[10px] font-semibold text-foreground truncate mb-1">{topic.name}</p>

      {/* Strength bar */}
      <div className="h-1.5 rounded-full bg-secondary/50 mb-1.5">
        <motion.div
          className={`h-full rounded-full ${
            isEmergency ? "bg-destructive" : isHigh ? "bg-warning" : isMedium ? "bg-yellow-500" : "bg-success"
          }`}
          initial={{ width: 0 }}
          animate={{ width: `${topic.memory_strength}%` }}
          transition={{ duration: 0.8, delay: delay + 0.2 }}
        />
      </div>

      <div className="flex items-center justify-between">
        <span className={`text-[9px] font-bold ${isEmergency ? "text-destructive" : isHigh ? "text-warning" : "text-muted-foreground"}`}>
          {risk}% risk
        </span>
        <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
          <Clock className="w-2.5 h-2.5" />
          {topic.estimated_fix_minutes || Math.max(2, Math.round(risk / 20))}m
        </span>
      </div>

      {/* Improvement estimate */}
      {topic.improvement_estimate && topic.improvement_estimate > 0 && (
        <div className="mt-1 flex items-center gap-0.5 text-[9px] text-success font-medium">
          <TrendingUp className="w-2.5 h-2.5" />
          +{topic.improvement_estimate}% after fix
        </div>
      )}
    </motion.div>
  );
};

// ─── Risk Shield Streak Badge ────────────────────────────────
const RiskShieldBadge = ({ streak }: { streak: number }) => {
  if (streak === 0) return null;

  const level = streak >= 14 ? "diamond" : streak >= 7 ? "gold" : streak >= 3 ? "silver" : "bronze";
  const colors = {
    diamond: "from-primary/30 to-accent/30 border-primary/50 text-primary",
    gold: "from-yellow-500/20 to-warning/20 border-yellow-500/40 text-yellow-500",
    silver: "from-muted-foreground/20 to-secondary/30 border-muted-foreground/30 text-muted-foreground",
    bronze: "from-warning/15 to-destructive/10 border-warning/30 text-warning",
  };

  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      transition={{ type: "spring", stiffness: 300 }}
      className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-gradient-to-r ${colors[level]} border text-[10px] font-bold`}
    >
      <Shield className="w-3 h-3" />
      {streak}d shield
    </motion.div>
  );
};

// ─── Quick Recall Modal ──────────────────────────────────────
const RecallLoop = ({
  questions,
  onComplete,
  onClose,
}: {
  questions: RecallQuestion[];
  onComplete: () => void;
  onClose: () => void;
}) => {
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);

  const q = questions[current];
  if (!q) return null;

  const handleAnswer = (correct: boolean) => {
    const newResults = [...results, correct];
    setResults(newResults);
    setRevealed(false);

    if (current + 1 >= questions.length) {
      setTimeout(() => onComplete(), 300);
    } else {
      setCurrent(current + 1);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="w-full max-w-sm glass rounded-2xl neural-border p-5 space-y-4"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Quick Recall</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{current + 1}/{questions.length}</span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/80">
              <X className="w-3.5 h-3.5 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Progress dots */}
        <div className="flex gap-1 justify-center">
          {questions.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i < results.length
                  ? results[i] ? "bg-success" : "bg-destructive"
                  : i === current ? "bg-primary" : "bg-secondary"
              }`}
            />
          ))}
        </div>

        <div className="bg-secondary/30 rounded-xl p-4 min-h-[80px] flex items-center justify-center">
          <p className="text-sm text-foreground text-center font-medium">{q.question}</p>
        </div>

        <p className="text-[10px] text-muted-foreground text-center">{q.topic_name}</p>

        {!revealed ? (
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => setRevealed(true)}
            className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors"
          >
            Reveal Answer
          </motion.button>
        ) : (
          <div className="flex gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer(false)}
              className="flex-1 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold hover:bg-destructive/20 transition-colors"
            >
              Didn't Know
            </motion.button>
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => handleAnswer(true)}
              className="flex-1 py-2.5 rounded-xl bg-success/10 text-success text-sm font-semibold hover:bg-success/20 transition-colors"
            >
              Got It ✓
            </motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────
interface AIRiskReductionEngineProps {
  atRisk: TopicPrediction[];
  hasTopics: boolean;
  onStudyTopic?: (subject?: string, topic?: string, minutes?: number) => void;
}

const AIRiskReductionEngine = ({ atRisk, hasTopics, onStudyTopic }: AIRiskReductionEngineProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [autoMinimizer, setAutoMinimizer] = useState(() => localStorage.getItem("risk-auto-minimizer") === "true");
  const [riskShieldStreak, setRiskShieldStreak] = useState(() => getCache<number>("risk-shield-streak") || 0);
  const [recallQuestions, setRecallQuestions] = useState<RecallQuestion[] | null>(null);
  const [fixingTopicId, setFixingTopicId] = useState<string | null>(null);
  const [fixedTopics, setFixedTopics] = useState<Set<string>>(() => {
    const cached = getCache<string[]>("risk-fixed-today");
    return new Set(cached || []);
  });
  const [focusSession, setFocusSession] = useState<{ subject?: string; topic?: string } | null>(null);
  const [generatingRecall, setGeneratingRecall] = useState(false);
  const [bundleMode, setBundleMode] = useState(false);

  // Enrich topics with fix estimates
  const enrichedTopics: RiskTopic[] = useMemo(() => {
    return atRisk.map(t => ({
      ...t,
      estimated_fix_minutes: Math.max(2, Math.round((100 - t.memory_strength) / 20)),
      improvement_estimate: Math.min(30, Math.round((100 - t.memory_strength) * 0.35)),
    }));
  }, [atRisk]);

  const emergencyTopics = enrichedTopics.filter(t => (100 - t.memory_strength) > 85);
  const highRiskTopics = enrichedTopics.filter(t => {
    const risk = 100 - t.memory_strength;
    return risk > 60 && risk <= 85;
  });
  const totalFixTime = enrichedTopics.reduce((s, t) => s + (t.estimated_fix_minutes || 3), 0);

  // Load risk shield streak
  useEffect(() => {
    if (!user) return;
    const today = new Date().toDateString();
    const lastFixDate = localStorage.getItem("risk-shield-last-date");
    const streak = getCache<number>("risk-shield-streak") || 0;

    if (lastFixDate && lastFixDate !== today) {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      if (lastFixDate !== yesterday.toDateString()) {
        // Streak broken
        setRiskShieldStreak(0);
        setCache("risk-shield-streak", 0);
      }
    }
  }, [user]);

  // Auto-minimizer: auto-trigger recall for top risk topic
  useEffect(() => {
    if (!autoMinimizer || enrichedTopics.length === 0 || recallQuestions) return;
    const autoFixTimer = setTimeout(() => {
      const topRisk = enrichedTopics[0];
      if (topRisk && (100 - topRisk.memory_strength) > 50) {
        handleSmartRecall(topRisk);
      }
    }, 3000);
    return () => clearTimeout(autoFixTimer);
  }, [autoMinimizer, enrichedTopics.length]);

  const handleAIFix = useCallback(async (topic: RiskTopic) => {
    setFixingTopicId(topic.id);
    try {
      // Generate recall questions via AI
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "chat",
          message: `Generate exactly 3 quick recall questions for the topic "${topic.name}" (subject: ${topic.subject_name || "unknown"}). The student's memory strength is ${Math.round(topic.memory_strength)}%. Format each question on a new line starting with "Q: ". Keep questions concise and factual.`,
        },
      });

      if (error) throw error;

      const reply = data?.reply || "";
      const questions = reply
        .split("\n")
        .filter((l: string) => l.trim().startsWith("Q:") || l.trim().match(/^\d+[\.\)]/))
        .map((l: string) => l.replace(/^(Q:\s*|\d+[\.\)]\s*)/, "").trim())
        .filter((q: string) => q.length > 10)
        .slice(0, 3)
        .map((q: string) => ({ question: q, topic_name: topic.name }));

      if (questions.length > 0) {
        setRecallQuestions(questions);
      } else {
        // Fallback: open focus session
        onStudyTopic?.(topic.subject_name || undefined, topic.name, topic.estimated_fix_minutes || 3);
      }
    } catch {
      toast({ title: "Couldn't generate recall questions", variant: "destructive" });
      onStudyTopic?.(topic.subject_name || undefined, topic.name, topic.estimated_fix_minutes || 3);
    } finally {
      setFixingTopicId(null);
    }
  }, [onStudyTopic, toast]);

  const handleSmartRecall = useCallback(async (topic: RiskTopic) => {
    setGeneratingRecall(true);
    await handleAIFix(topic);
    setGeneratingRecall(false);
  }, [handleAIFix]);

  const handleRecallComplete = useCallback(() => {
    setRecallQuestions(null);
    notifyFeedback();

    // Update shield streak
    const today = new Date().toDateString();
    const lastDate = localStorage.getItem("risk-shield-last-date");
    let newStreak = riskShieldStreak;

    if (lastDate !== today) {
      newStreak = lastDate ? riskShieldStreak + 1 : 1;
      localStorage.setItem("risk-shield-last-date", today);
      setRiskShieldStreak(newStreak);
      setCache("risk-shield-streak", newStreak);
    }

    // Track fixed topics
    const newFixed = new Set(fixedTopics);
    if (recallQuestions?.[0]) {
      const topicName = recallQuestions[0].topic_name;
      const found = enrichedTopics.find(t => t.name === topicName);
      if (found) newFixed.add(found.id);
    }
    setFixedTopics(newFixed);
    setCache("risk-fixed-today", Array.from(newFixed));

    toast({
      title: "🛡️ Memory reinforced!",
      description: `Risk Shield streak: ${newStreak > riskShieldStreak ? newStreak : riskShieldStreak + 1} days`,
    });
  }, [riskShieldStreak, fixedTopics, recallQuestions, enrichedTopics, toast]);

  const handleBundleFix = useCallback(() => {
    const bundleTopics = enrichedTopics.filter(t => (100 - t.memory_strength) > 50).slice(0, 5);
    if (bundleTopics.length === 0) return;

    const totalMin = bundleTopics.reduce((s, t) => s + (t.estimated_fix_minutes || 3), 0);
    const topicNames = bundleTopics.map(t => t.name).join(", ");

    setFocusSession({
      subject: bundleTopics[0].subject_name || undefined,
      topic: topicNames,
    });

    toast({
      title: `🔥 Bundle session: ${bundleTopics.length} topics`,
      description: `Estimated ${totalMin} minutes to fix all`,
    });
  }, [enrichedTopics, toast]);

  const handleEmergencyRescue = useCallback((topic: RiskTopic) => {
    if (navigator.vibrate) navigator.vibrate([100, 50, 100]);
    handleSmartRecall(topic);
  }, [handleSmartRecall]);

  if (!hasTopics) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-5 neural-border"
      >
        <div className="flex items-center gap-2 mb-2">
          <ShieldAlert className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">AI Risk Reduction Engine</h2>
        </div>
        <p className="text-xs text-muted-foreground text-center py-4">
          Log a study session to activate risk monitoring.
        </p>
      </motion.div>
    );
  }

  if (enrichedTopics.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl neural-border overflow-hidden bg-gradient-to-br from-success/5 via-background to-success/5 border-success/20 p-5"
      >
        <div className="flex items-center gap-2 mb-2">
          <Shield className="w-4 h-4 text-success" />
          <h2 className="font-semibold text-foreground text-sm">AI Risk Reduction Engine</h2>
          <RiskShieldBadge streak={riskShieldStreak} />
        </div>
        <p className="text-xs text-success font-medium text-center py-2">✅ All topics are shielded — keep it up!</p>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
        className="glass rounded-2xl neural-border overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 pt-4 pb-2 flex items-center gap-2">
          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
            emergencyTopics.length > 0 ? "bg-destructive/15" : "bg-warning/15"
          }`}>
            <ShieldAlert className={`w-4 h-4 ${emergencyTopics.length > 0 ? "text-destructive" : "text-warning"}`} />
          </div>
          <div className="flex-1 min-w-0">
            <h2 className="text-sm font-bold text-foreground">AI Risk Reduction Engine</h2>
            <p className="text-[10px] text-muted-foreground">
              {enrichedTopics.length} topic{enrichedTopics.length !== 1 ? "s" : ""} • ~{totalFixTime}m to fix all
            </p>
          </div>
          <RiskShieldBadge streak={riskShieldStreak} />
        </div>

        {/* Emergency Rescue Banner */}
        <AnimatePresence>
          {emergencyTopics.length > 0 && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mx-3 mb-2"
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => handleEmergencyRescue(emergencyTopics[0])}
                className="w-full flex items-center gap-2 p-3 rounded-xl bg-destructive/10 border border-destructive/30 hover:bg-destructive/15 transition-colors"
              >
                <motion.div
                  animate={{ rotate: [0, -10, 10, 0] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                >
                  <AlertOctagon className="w-4 h-4 text-destructive" />
                </motion.div>
                <div className="flex-1 text-left">
                  <p className="text-[11px] font-bold text-destructive">🚨 Emergency Rescue</p>
                  <p className="text-[10px] text-destructive/80">
                    {emergencyTopics.length} topic{emergencyTopics.length > 1 ? "s" : ""} above 85% risk — tap to rescue
                  </p>
                </div>
                <ChevronRight className="w-3.5 h-3.5 text-destructive" />
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Visual Heatmap Grid */}
        <div className="px-3 pb-2">
          <div className="grid grid-cols-3 gap-2">
            {enrichedTopics.slice(0, 9).map((topic, i) => (
              <HeatmapCell
                key={topic.id}
                topic={topic}
                onFix={() => handleAIFix(topic)}
                onEmergency={() => handleEmergencyRescue(topic)}
                delay={i * 0.05}
              />
            ))}
          </div>
          {enrichedTopics.length > 9 && (
            <p className="text-[10px] text-muted-foreground text-center mt-2">
              +{enrichedTopics.length - 9} more topics at risk
            </p>
          )}
        </div>

        {/* Action Row */}
        <div className="px-3 pb-3 flex gap-2">
          {/* Smart Recall */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => handleSmartRecall(enrichedTopics[0])}
            disabled={generatingRecall}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary/10 text-primary text-[11px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
          >
            {generatingRecall ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Zap className="w-3.5 h-3.5" />
            )}
            Smart Recall
          </motion.button>

          {/* Bundle Fix */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={handleBundleFix}
            className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-warning/10 text-warning text-[11px] font-semibold hover:bg-warning/20 transition-colors"
          >
            <Flame className="w-3.5 h-3.5" />
            Bundle Fix
          </motion.button>

          {/* Auto Minimizer Toggle */}
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              const next = !autoMinimizer;
              setAutoMinimizer(next);
              localStorage.setItem("risk-auto-minimizer", String(next));
              toast({
                title: next ? "🤖 Auto Risk Minimizer ON" : "Auto Risk Minimizer OFF",
                description: next ? "AI will auto-suggest recall when risk is high" : undefined,
              });
            }}
            className={`px-3 py-2.5 rounded-xl text-[11px] font-semibold transition-colors ${
              autoMinimizer
                ? "bg-primary text-primary-foreground"
                : "bg-secondary/50 text-muted-foreground hover:bg-secondary/80"
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
          </motion.button>
        </div>

        {/* Per-Topic AI Fix Row (for top 5 not in heatmap) */}
        {enrichedTopics.length > 0 && (
          <div className="px-3 pb-3 space-y-1.5">
            {enrichedTopics.slice(0, 5).map((topic) => {
              const risk = Math.round(100 - topic.memory_strength);
              const isFixed = fixedTopics.has(topic.id);

              return (
                <div
                  key={`fix-${topic.id}`}
                  className={`flex items-center gap-2 p-2 rounded-lg transition-all ${
                    isFixed
                      ? "bg-success/5 border border-success/20"
                      : "bg-secondary/20 border border-border/30"
                  }`}
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isFixed && <CheckCircle className="w-3 h-3 text-success shrink-0" />}
                      <p className={`text-[11px] font-medium truncate ${isFixed ? "text-success line-through" : "text-foreground"}`}>
                        {topic.name}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[9px] text-muted-foreground">
                        <Clock className="w-2.5 h-2.5 inline mr-0.5" />
                        {topic.estimated_fix_minutes}m
                      </span>
                      {topic.improvement_estimate && (
                        <span className="text-[9px] text-success">
                          <TrendingUp className="w-2.5 h-2.5 inline mr-0.5" />
                          +{topic.improvement_estimate}%
                        </span>
                      )}
                    </div>
                  </div>

                  {!isFixed && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleAIFix(topic)}
                      disabled={fixingTopicId === topic.id}
                      className="shrink-0 flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:bg-primary/90 active:scale-95 transition-all disabled:opacity-50"
                    >
                      {fixingTopicId === topic.id ? (
                        <RefreshCw className="w-3 h-3 animate-spin" />
                      ) : (
                        <Zap className="w-3 h-3" />
                      )}
                      AI Fix
                    </motion.button>
                  )}

                  <ExplainButton
                    predictionType="forget_risk"
                    predictionData={{
                      topic_name: topic.name,
                      memory_strength: topic.memory_strength,
                      risk_level: topic.risk_level,
                      hours_until_drop: topic.hours_until_drop,
                      subject: topic.subject_name,
                    }}
                    label="Why?"
                  />
                </div>
              );
            })}
          </div>
        )}
      </motion.div>

      {/* Recall Loop Modal */}
      <AnimatePresence>
        {recallQuestions && (
          <RecallLoop
            questions={recallQuestions}
            onComplete={handleRecallComplete}
            onClose={() => setRecallQuestions(null)}
          />
        )}
      </AnimatePresence>

      {/* Bundle Focus Session */}
      <FocusModeSession
        open={!!focusSession}
        onClose={() => setFocusSession(null)}
        onSessionComplete={() => {
          setFocusSession(null);
          notifyFeedback();
        }}
        initialSubject={focusSession?.subject}
        initialTopic={focusSession?.topic}
        autoStart
      />
    </>
  );
};

export default AIRiskReductionEngine;
