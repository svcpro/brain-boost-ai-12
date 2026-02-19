import React, { useState, useCallback, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, ShieldAlert, AlertOctagon, Zap, Brain, Clock, CheckCircle,
  RefreshCw, Sparkles, TrendingUp, ChevronRight, X, Play, Flame, Target,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TopicPrediction } from "@/hooks/useMemoryEngine";
import { getCache, setCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback, triggerHaptic } from "@/lib/feedback";
import FocusModeSession from "./FocusModeSession";

// ─── Types ───────────────────────────────────────────────────
interface RiskTopic extends TopicPrediction {
  estimated_fix_minutes: number;
  improvement_estimate: number;
}

interface RecallQuestion {
  question: string;
  topic_name: string;
}

type FixDuration = 3 | 5 | "auto";

// ─── Priority tiers ──────────────────────────────────────────
type Tier = "critical" | "moderate" | "stable";

const tierConfig: Record<Tier, { label: string; color: string; bg: string; border: string; icon: typeof AlertOctagon }> = {
  critical: { label: "Critical", color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/25", icon: AlertOctagon },
  moderate: { label: "Moderate", color: "text-warning", bg: "bg-warning/10", border: "border-warning/25", icon: ShieldAlert },
  stable: { label: "Stable", color: "text-success", bg: "bg-success/10", border: "border-success/25", icon: Shield },
};

function getTier(memory: number): Tier {
  if (memory < 15) return "critical";
  if (memory < 50) return "moderate";
  return "stable";
}

// ─── Brain Map Node ──────────────────────────────────────────
const BrainNode = ({ topic, index, onClick }: { topic: RiskTopic; index: number; onClick: () => void }) => {
  const risk = 100 - topic.memory_strength;
  const isEmergency = risk > 85;
  const tier = getTier(topic.memory_strength);
  const cfg = tierConfig[tier];

  // Determine size based on risk severity
  const size = isEmergency ? "w-14 h-14" : risk > 60 ? "w-12 h-12" : "w-10 h-10";

  return (
    <motion.button
      initial={{ opacity: 0, scale: 0 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ delay: 0.1 + index * 0.06, type: "spring", stiffness: 300 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      className={`relative ${size} rounded-full ${cfg.bg} border ${cfg.border} flex items-center justify-center group transition-all hover:scale-110`}
    >
      {/* Pulse for emergency */}
      {isEmergency && (
        <motion.div
          className="absolute inset-0 rounded-full border-2 border-destructive/40"
          animate={{ scale: [1, 1.4, 1], opacity: [0.6, 0, 0.6] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        />
      )}

      {/* Memory ring */}
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="17" fill="none" stroke="hsl(var(--border) / 0.3)" strokeWidth="2" />
        <motion.circle
          cx="20" cy="20" r="17" fill="none"
          stroke={isEmergency ? "hsl(var(--destructive))" : tier === "moderate" ? "hsl(var(--warning))" : "hsl(var(--success))"}
          strokeWidth="2"
          strokeLinecap="round"
          strokeDasharray={2 * Math.PI * 17}
          initial={{ strokeDashoffset: 2 * Math.PI * 17 }}
          animate={{ strokeDashoffset: 2 * Math.PI * 17 * (1 - topic.memory_strength / 100) }}
          transition={{ duration: 0.8, delay: 0.2 + index * 0.06 }}
        />
      </svg>

      <span className={`relative z-10 text-[8px] font-bold ${cfg.color} leading-none text-center px-0.5 truncate max-w-[90%]`}>
        {topic.name.length > 6 ? topic.name.slice(0, 6) + "…" : topic.name}
      </span>

      {/* Tooltip on hover */}
      <div className="absolute -bottom-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-20">
        <div className="bg-card border border-border rounded-md px-2 py-0.5 text-[8px] text-foreground whitespace-nowrap shadow-lg">
          {topic.name} · {Math.round(topic.memory_strength)}%
        </div>
      </div>
    </motion.button>
  );
};

// ─── Recall Loop Modal ───────────────────────────────────────
const RecallLoop = ({ questions, onComplete, onClose }: { questions: RecallQuestion[]; onComplete: () => void; onClose: () => void }) => {
  const [current, setCurrent] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [results, setResults] = useState<boolean[]>([]);
  const q = questions[current];
  if (!q) return null;

  const handleAnswer = (correct: boolean) => {
    const nr = [...results, correct];
    setResults(nr);
    setRevealed(false);
    if (current + 1 >= questions.length) setTimeout(onComplete, 300);
    else setCurrent(current + 1);
  };

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <motion.div initial={{ scale: 0.9, y: 20 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.9 }} className="w-full max-w-sm glass rounded-2xl neural-border p-5 space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">Quick Recall</h3>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] text-muted-foreground">{current + 1}/{questions.length}</span>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary/80"><X className="w-3.5 h-3.5 text-muted-foreground" /></button>
          </div>
        </div>
        <div className="flex gap-1 justify-center">
          {questions.map((_, i) => (
            <div key={i} className={`w-2 h-2 rounded-full transition-colors ${i < results.length ? results[i] ? "bg-success" : "bg-destructive" : i === current ? "bg-primary" : "bg-secondary"}`} />
          ))}
        </div>
        <div className="bg-secondary/30 rounded-xl p-4 min-h-[80px] flex items-center justify-center">
          <p className="text-sm text-foreground text-center font-medium">{q.question}</p>
        </div>
        <p className="text-[10px] text-muted-foreground text-center">{q.topic_name}</p>
        {!revealed ? (
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => setRevealed(true)} className="w-full py-2.5 rounded-xl bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors">Reveal Answer</motion.button>
        ) : (
          <div className="flex gap-2">
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAnswer(false)} className="flex-1 py-2.5 rounded-xl bg-destructive/10 text-destructive text-sm font-semibold">Didn't Know</motion.button>
            <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleAnswer(true)} className="flex-1 py-2.5 rounded-xl bg-success/10 text-success text-sm font-semibold">Got It ✓</motion.button>
          </div>
        )}
      </motion.div>
    </motion.div>
  );
};

// ─── Main Component ──────────────────────────────────────────
interface Props {
  atRisk: TopicPrediction[];
  hasTopics: boolean;
  overallHealth: number;
  onStudyTopic?: (subject?: string, topic?: string, minutes?: number) => void;
}

const BrainStabilityControlCenter = ({ atRisk, hasTopics, overallHealth, onStudyTopic }: Props) => {
  const { user } = useAuth();
  const { toast } = useToast();

  const [recallQuestions, setRecallQuestions] = useState<RecallQuestion[] | null>(null);
  const [fixingId, setFixingId] = useState<string | null>(null);
  const [autoShield, setAutoShield] = useState(() => localStorage.getItem("stability-auto-shield") === "true");
  const [focusSession, setFocusSession] = useState<{ subject?: string; topic?: string } | null>(null);
  const [shieldStreak, setShieldStreak] = useState(() => getCache<number>("risk-shield-streak") || 0);
  const [fixedToday, setFixedToday] = useState<Set<string>>(() => new Set(getCache<string[]>("risk-fixed-today") || []));
  const [selectedTopic, setSelectedTopic] = useState<RiskTopic | null>(null);

  // Enrich topics
  const enriched: RiskTopic[] = useMemo(() =>
    atRisk.map(t => ({
      ...t,
      estimated_fix_minutes: Math.max(2, Math.round((100 - t.memory_strength) / 20)),
      improvement_estimate: Math.min(30, Math.round((100 - t.memory_strength) * 0.35)),
    }))
  , [atRisk]);

  // AI prioritization: only show 1-2 urgent + a few moderate
  const prioritized = useMemo(() => {
    const critical = enriched.filter(t => getTier(t.memory_strength) === "critical").slice(0, 2);
    const moderate = enriched.filter(t => getTier(t.memory_strength) === "moderate").slice(0, 3);
    const stable = enriched.filter(t => getTier(t.memory_strength) === "stable").slice(0, 4);
    return { critical, moderate, stable, all: [...critical, ...moderate, ...stable] };
  }, [enriched]);

  const emergencyActive = prioritized.critical.length > 0 && prioritized.critical.some(t => (100 - t.memory_strength) > 85);

  // Shield streak
  useEffect(() => {
    const today = new Date().toDateString();
    const last = localStorage.getItem("risk-shield-last-date");
    if (last && last !== today) {
      const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
      if (last !== yesterday.toDateString()) { setShieldStreak(0); setCache("risk-shield-streak", 0); }
    }
  }, []);

  // Auto-shield: schedule recall for top risk topic
  useEffect(() => {
    if (!autoShield || enriched.length === 0) return;
    const top = enriched[0];
    if (top && (100 - top.memory_strength) > 50 && !fixedToday.has(top.id)) {
      // Auto-update memory model silently
      const autoFix = async () => {
        if (!user) return;
        await supabase.from("topics").update({
          memory_strength: Math.min(100, top.memory_strength + 5),
          next_predicted_drop_date: new Date(Date.now() + 86400000).toISOString(),
        }).eq("user_id", user.id).eq("id", top.id);
      };
      const timer = setTimeout(autoFix, 2000);
      return () => clearTimeout(timer);
    }
  }, [autoShield, enriched, user]);

  const handleFix = useCallback(async (topic: RiskTopic, duration: FixDuration) => {
    if (duration === "auto") {
      // Auto Shield — update memory + schedule recall silently
      setFixingId(topic.id);
      try {
        if (user) {
          await supabase.from("topics").update({
            memory_strength: Math.min(100, topic.memory_strength + 10),
            next_predicted_drop_date: new Date(Date.now() + 86400000).toISOString(),
          }).eq("user_id", user.id).eq("id", topic.id);
        }
        const nf = new Set(fixedToday); nf.add(topic.id); setFixedToday(nf); setCache("risk-fixed-today", Array.from(nf));
        triggerHaptic([15, 30, 15]);
        notifyFeedback();
        updateShieldStreak();
        toast({ title: "🛡️ Auto Shield activated", description: `${topic.name} recall scheduled for tomorrow` });
      } finally { setFixingId(null); setSelectedTopic(null); }
      return;
    }

    // Smart Recall (3m or 5m)
    setFixingId(topic.id);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "chat",
          message: `Generate exactly 3 quick recall questions for "${topic.name}" (subject: ${topic.subject_name || "unknown"}). Memory strength: ${Math.round(topic.memory_strength)}%. Format: Q: question. Keep concise.`,
        },
      });
      if (error) throw error;
      const questions = (data?.reply || "").split("\n").filter((l: string) => l.trim().startsWith("Q:") || l.trim().match(/^\d+[\.\)]/)).map((l: string) => l.replace(/^(Q:\s*|\d+[\.\)]\s*)/, "").trim()).filter((q: string) => q.length > 10).slice(0, 3).map((q: string) => ({ question: q, topic_name: topic.name }));
      if (questions.length > 0) { setRecallQuestions(questions); setSelectedTopic(null); }
      else onStudyTopic?.(topic.subject_name, topic.name, duration);
    } catch {
      onStudyTopic?.(topic.subject_name, topic.name, duration);
    } finally { setFixingId(null); }
  }, [user, toast, fixedToday, onStudyTopic]);

  const updateShieldStreak = useCallback(() => {
    const today = new Date().toDateString();
    const last = localStorage.getItem("risk-shield-last-date");
    let ns = shieldStreak;
    if (last !== today) { ns = last ? shieldStreak + 1 : 1; localStorage.setItem("risk-shield-last-date", today); setShieldStreak(ns); setCache("risk-shield-streak", ns); }
  }, [shieldStreak]);

  const handleRecallComplete = useCallback(() => {
    setRecallQuestions(null);
    notifyFeedback();
    updateShieldStreak();
    if (recallQuestions?.[0]) {
      const found = enriched.find(t => t.name === recallQuestions[0].topic_name);
      if (found) { const nf = new Set(fixedToday); nf.add(found.id); setFixedToday(nf); setCache("risk-fixed-today", Array.from(nf)); }
    }
    toast({ title: "🧠 Memory reinforced!", description: `Shield streak: ${shieldStreak + 1} days` });
  }, [shieldStreak, fixedToday, recallQuestions, enriched, toast, updateShieldStreak]);

  // ─── Empty states ──────────────────────────────────────────
  if (!hasTopics) return null;

  if (enriched.length === 0) {
    return (
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative glass rounded-2xl neural-border overflow-hidden p-5 text-center">
        <motion.div className="absolute inset-0 bg-gradient-to-br from-success/5 to-transparent pointer-events-none" animate={{ opacity: [0.5, 0.8, 0.5] }} transition={{ duration: 4, repeat: Infinity }} />
        <div className="relative z-10 flex flex-col items-center gap-2">
          <div className="w-12 h-12 rounded-full bg-success/10 border border-success/20 flex items-center justify-center">
            <Shield className="w-6 h-6 text-success" />
          </div>
          <p className="text-sm font-display font-bold text-foreground">All Clear</p>
          <p className="text-[10px] text-muted-foreground">Every topic is shielded — brilliant work!</p>
          {shieldStreak > 0 && (
            <div className="flex items-center gap-1 text-[10px] font-bold text-success">
              <Flame className="w-3 h-3" /> {shieldStreak}d shield streak
            </div>
          )}
        </div>
      </motion.div>
    );
  }

  // ─── Main render ───────────────────────────────────────────
  const topPriority = prioritized.critical[0] || prioritized.moderate[0];

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="relative"
      >
        {/* Background aura */}
        <div className="absolute inset-0 -m-2 rounded-3xl pointer-events-none overflow-hidden">
          <motion.div
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-56 h-56 rounded-full blur-3xl"
            style={{ background: emergencyActive ? "radial-gradient(circle, hsl(var(--destructive) / 0.06) 0%, transparent 70%)" : "radial-gradient(circle, hsl(var(--primary) / 0.05) 0%, transparent 70%)" }}
            animate={{ scale: [1, 1.1, 1], opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 5, repeat: Infinity }}
          />
        </div>

        <div className="relative glass rounded-2xl overflow-hidden">
          {/* Shimmer */}
          <motion.div
            className="absolute top-0 left-0 right-0 h-[1px]"
            style={{ background: emergencyActive ? "linear-gradient(90deg, transparent, hsl(var(--destructive) / 0.5), transparent)" : "linear-gradient(90deg, transparent, hsl(var(--primary) / 0.4), transparent)" }}
            animate={{ opacity: [0.3, 0.8, 0.3] }}
            transition={{ duration: 3, repeat: Infinity }}
          />

          {/* ── Header ── */}
          <div className="px-4 pt-4 pb-2 flex items-center gap-3">
            <motion.div
              className={`w-9 h-9 rounded-xl flex items-center justify-center ${emergencyActive ? "bg-destructive/15" : "bg-primary/10"}`}
              animate={emergencyActive ? { scale: [1, 1.05, 1] } : {}}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <Shield className={`w-4.5 h-4.5 ${emergencyActive ? "text-destructive" : "text-primary"}`} />
            </motion.div>
            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-display font-bold text-foreground">Stability Control</h2>
              <p className="text-[10px] text-muted-foreground">
                {prioritized.critical.length > 0 ? `${prioritized.critical.length} critical` : ""}
                {prioritized.critical.length > 0 && prioritized.moderate.length > 0 ? " · " : ""}
                {prioritized.moderate.length > 0 ? `${prioritized.moderate.length} moderate` : ""}
                {prioritized.critical.length === 0 && prioritized.moderate.length === 0 ? "Monitoring…" : ""}
              </p>
            </div>
            {shieldStreak > 0 && (
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/10 border border-primary/20 text-[9px] font-bold text-primary">
                <Flame className="w-3 h-3" /> {shieldStreak}d
              </motion.div>
            )}
          </div>

          {/* ── Emergency Banner ── */}
          <AnimatePresence>
            {emergencyActive && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mx-3 mb-2">
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => topPriority && handleFix(topPriority as RiskTopic, 3)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl bg-destructive/10 border border-destructive/25"
                >
                  <motion.div animate={{ rotate: [0, -10, 10, 0] }} transition={{ repeat: Infinity, duration: 2 }}>
                    <AlertOctagon className="w-5 h-5 text-destructive" />
                  </motion.div>
                  <div className="flex-1 text-left">
                    <p className="text-[11px] font-bold text-destructive">🚨 Emergency Mode</p>
                    <p className="text-[10px] text-destructive/80">Risk &gt;85% — tap to rescue now</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-destructive/60" />
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* ── 1. Interactive Brain Heatmap ── */}
          <div className="px-4 pb-3">
            <p className="text-[9px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Risk Map</p>
            <div className="flex flex-wrap justify-center gap-2">
              {prioritized.all.map((topic, i) => (
                <BrainNode
                  key={topic.id}
                  topic={topic as RiskTopic}
                  index={i}
                  onClick={() => setSelectedTopic(topic as RiskTopic)}
                />
              ))}
            </div>
          </div>

          {/* ── 2. AI Priority Focus (1-2 topics only) ── */}
          {topPriority && !fixedToday.has(topPriority.id) && (
            <div className="px-4 pb-3">
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className={`rounded-xl p-3.5 ${getTier(topPriority.memory_strength) === "critical" ? "bg-destructive/5 border border-destructive/15" : "bg-warning/5 border border-warning/15"}`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Target className={`w-3.5 h-3.5 ${getTier(topPriority.memory_strength) === "critical" ? "text-destructive" : "text-warning"}`} />
                  <span className="text-[10px] font-bold text-foreground">AI Priority — Focus today</span>
                </div>
                <p className="text-xs font-semibold text-foreground mb-0.5">{topPriority.name}</p>
                <div className="flex items-center gap-3 text-[9px] text-muted-foreground mb-3">
                  <span className="flex items-center gap-0.5"><Clock className="w-2.5 h-2.5" /> ~{(topPriority as RiskTopic).estimated_fix_minutes}m</span>
                  <span className="flex items-center gap-0.5 text-success"><TrendingUp className="w-2.5 h-2.5" /> +{(topPriority as RiskTopic).improvement_estimate}%</span>
                </div>

                {/* ── 3. One-Tap Fix Options ── */}
                <div className="flex gap-2">
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleFix(topPriority as RiskTopic, 3)}
                    disabled={fixingId === topPriority.id}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-primary/10 text-primary text-[10px] font-semibold hover:bg-primary/20 transition-colors disabled:opacity-50"
                  >
                    {fixingId === topPriority.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                    3-min Fix
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleFix(topPriority as RiskTopic, 5)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-warning/10 text-warning text-[10px] font-semibold hover:bg-warning/20 transition-colors"
                  >
                    <Play className="w-3 h-3" /> 5-min Fix
                  </motion.button>
                  <motion.button
                    whileTap={{ scale: 0.95 }}
                    onClick={() => handleFix(topPriority as RiskTopic, "auto")}
                    className="flex items-center justify-center gap-1 px-3 py-2 rounded-xl bg-secondary/40 text-muted-foreground text-[10px] font-semibold hover:bg-secondary/60 transition-colors"
                  >
                    <Shield className="w-3 h-3" /> Auto
                  </motion.button>
                </div>
              </motion.div>
            </div>
          )}

          {/* ── 4. Predictive Decay Timeline ── */}
          {prioritized.all.length > 0 && (
            <div className="px-4 pb-3">
              <p className="text-[9px] text-muted-foreground mb-2 uppercase tracking-wider font-medium">Decay Timeline</p>
              <div className="space-y-1.5">
                {prioritized.all.slice(0, 4).map((topic, i) => {
                  const hours = topic.hours_until_drop ?? 48;
                  const tier = getTier(topic.memory_strength);
                  const cfg = tierConfig[tier];
                  const isFixed = fixedToday.has(topic.id);

                  return (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.15 + i * 0.05 }}
                      className={`flex items-center gap-2 p-2 rounded-lg ${isFixed ? "bg-success/5 border border-success/15" : "bg-secondary/15 border border-border/20"}`}
                    >
                      <div className={`w-1.5 h-1.5 rounded-full ${isFixed ? "bg-success" : tier === "critical" ? "bg-destructive animate-pulse" : tier === "moderate" ? "bg-warning" : "bg-success"}`} />
                      <span className={`text-[10px] font-medium flex-1 truncate ${isFixed ? "text-success line-through" : "text-foreground"}`}>
                        {topic.name}
                      </span>
                      <span className="text-[9px] text-muted-foreground tabular-nums flex items-center gap-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        {hours < 24 ? `${Math.round(hours)}h` : `${Math.round(hours / 24)}d`}
                      </span>
                      {!isFixed && (
                        <motion.button
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setSelectedTopic(topic as RiskTopic)}
                          className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-semibold hover:bg-primary/20 transition-colors"
                        >
                          Fix
                        </motion.button>
                      )}
                      {isFixed && <CheckCircle className="w-3 h-3 text-success shrink-0" />}
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}

          {/* ── 5. Auto Shield Toggle ── */}
          <div className="px-4 pb-4 flex items-center gap-2">
            <motion.button
              whileTap={{ scale: 0.95 }}
              onClick={() => {
                const next = !autoShield;
                setAutoShield(next);
                localStorage.setItem("stability-auto-shield", String(next));
                triggerHaptic([15]);
                toast({ title: next ? "🛡️ Auto Shield ON" : "Auto Shield OFF", description: next ? "AI will auto-schedule recall for high-risk topics" : undefined });
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[10px] font-semibold transition-all ${
                autoShield ? "bg-primary text-primary-foreground glow-primary" : "bg-secondary/40 text-muted-foreground hover:bg-secondary/60"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              Auto Shield {autoShield ? "Active" : "Off"}
            </motion.button>
          </div>
        </div>
      </motion.div>

      {/* ── Topic detail sheet ── */}
      <AnimatePresence>
        {selectedTopic && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-end justify-center bg-background/70 backdrop-blur-sm" onClick={(e) => e.target === e.currentTarget && setSelectedTopic(null)}>
            <motion.div initial={{ y: 200 }} animate={{ y: 0 }} exit={{ y: 200 }} className="w-full max-w-lg glass rounded-t-3xl neural-border p-5 pb-8 space-y-4">
              <div className="w-10 h-1 rounded-full bg-border mx-auto mb-2" />
              <div className="flex items-center gap-3">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${tierConfig[getTier(selectedTopic.memory_strength)].bg}`}>
                  <Brain className={`w-5 h-5 ${tierConfig[getTier(selectedTopic.memory_strength)].color}`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-display font-bold text-foreground">{selectedTopic.name}</p>
                  <p className="text-[10px] text-muted-foreground">{selectedTopic.subject_name || "Unknown subject"}</p>
                </div>
                <button onClick={() => setSelectedTopic(null)} className="p-1.5 rounded-lg hover:bg-secondary"><X className="w-4 h-4 text-muted-foreground" /></button>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
                  <p className="text-lg font-bold text-foreground tabular-nums">{Math.round(selectedTopic.memory_strength)}%</p>
                  <p className="text-[9px] text-muted-foreground">Memory</p>
                </div>
                <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
                  <p className="text-lg font-bold text-foreground tabular-nums">{selectedTopic.estimated_fix_minutes}m</p>
                  <p className="text-[9px] text-muted-foreground">Fix Time</p>
                </div>
                <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 text-center">
                  <p className="text-lg font-bold text-success tabular-nums">+{selectedTopic.improvement_estimate}%</p>
                  <p className="text-[9px] text-muted-foreground">After Fix</p>
                </div>
              </div>

              {/* Fix buttons */}
              <div className="flex gap-2">
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleFix(selectedTopic, 3)} disabled={fixingId === selectedTopic.id} className="flex-1 py-3 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-opacity disabled:opacity-50">
                  {fixingId === selectedTopic.id ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                  3-min Recall
                </motion.button>
                <motion.button whileTap={{ scale: 0.95 }} onClick={() => handleFix(selectedTopic, 5)} className="flex-1 py-3 rounded-xl bg-warning/15 text-warning text-sm font-bold flex items-center justify-center gap-1.5">
                  <Play className="w-4 h-4" /> 5-min Deep
                </motion.button>
              </div>
              <motion.button whileTap={{ scale: 0.97 }} onClick={() => handleFix(selectedTopic, "auto")} className="w-full py-2.5 rounded-xl bg-secondary/30 text-muted-foreground text-[11px] font-semibold flex items-center justify-center gap-1.5 hover:bg-secondary/50 transition-colors">
                <Shield className="w-3.5 h-3.5" /> Auto Shield — schedule recall automatically
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Recall Loop */}
      <AnimatePresence>
        {recallQuestions && <RecallLoop questions={recallQuestions} onComplete={handleRecallComplete} onClose={() => setRecallQuestions(null)} />}
      </AnimatePresence>

      {/* Focus Session */}
      <FocusModeSession open={!!focusSession} onClose={() => setFocusSession(null)} onSessionComplete={() => { setFocusSession(null); notifyFeedback(); }} initialSubject={focusSession?.subject} initialTopic={focusSession?.topic} autoStart />
    </>
  );
};

export default BrainStabilityControlCenter;
