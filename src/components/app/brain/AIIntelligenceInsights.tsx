import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Brain, TrendingUp, Zap, Clock, RefreshCw,
  Target, AlertTriangle, ChevronRight, Calendar, Shield,
  Play, CheckCircle2, ArrowRight, Lightbulb, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { safeStr } from "@/lib/safeRender";

/* ── Types ── */
interface MentorInsight {
  id: string;
  title: string;
  insight: string;
  type: "performance" | "mistake" | "timing" | "decay" | "rank";
  severity: "info" | "warning" | "critical";
  actionLabel: string;
  actionSubject?: string;
  actionTopic?: string;
  impactPreview?: string;
}

interface TomorrowStrategy {
  focusArea: string;
  optimalTime: string;
  estimatedGain: string;
  missionTitle: string;
  missionDuration: string;
  reason: string;
}

/* ── Config ── */
const typeConfig: Record<MentorInsight["type"], { icon: any; color: string; bg: string; glow: string }> = {
  performance: { icon: TrendingUp, color: "text-emerald-400", bg: "bg-emerald-500/10", glow: "0 0 20px hsl(160 60% 40% / 0.15)" },
  mistake:     { icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10", glow: "0 0 20px hsl(38 60% 40% / 0.15)" },
  timing:      { icon: Clock, color: "text-sky-400", bg: "bg-sky-500/10", glow: "0 0 20px hsl(200 60% 40% / 0.15)" },
  decay:       { icon: Shield, color: "text-rose-400", bg: "bg-rose-500/10", glow: "0 0 20px hsl(0 60% 40% / 0.15)" },
  rank:        { icon: BarChart3, color: "text-violet-400", bg: "bg-violet-500/10", glow: "0 0 20px hsl(270 60% 40% / 0.15)" },
};

const severityBorder: Record<MentorInsight["severity"], string> = {
  info: "hsl(var(--border))",
  warning: "hsl(38 50% 30% / 0.4)",
  critical: "hsl(0 50% 35% / 0.4)",
};

const CACHE_KEY = "brain-ai-mentor-insights";
const STRATEGY_CACHE = "brain-ai-tomorrow-strategy";

interface Props {
  onAction?: (subject: string, topic: string) => void;
}

export default function AIIntelligenceInsights({ onAction }: Props) {
  const { user } = useAuth();
  const [insights, setInsights] = useState<MentorInsight[]>(() => getCache(CACHE_KEY) || []);
  const [strategy, setStrategy] = useState<TomorrowStrategy | null>(() => getCache(STRATEGY_CACHE) || null);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState<string | null>(null);
  const [completedActions, setCompletedActions] = useState<Set<string>>(new Set());
  const [strategyScheduled, setStrategyScheduled] = useState(false);

  const fetchInsights = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "brain_feed" },
      });
      if (!error && data?.cards && Array.isArray(data.cards)) {
        const mapped: MentorInsight[] = data.cards.slice(0, 5).map((c: any, i: number) => {
          const types: MentorInsight["type"][] = ["performance", "mistake", "timing", "decay", "rank"];
          const catMap: Record<string, MentorInsight["type"]> = {
            strength: "performance", opportunity: "decay", pattern: "timing", tip: "rank",
          };
          const type = catMap[c.category] || types[i % types.length];
          return {
            id: `insight-${i}-${Date.now()}`,
            title: safeStr(c.title, "AI Insight"),
            insight: safeStr(c.content || c.insight, ""),
            type,
            severity: c.priority === "high" ? "critical" : c.priority === "medium" ? "warning" : "info",
            actionLabel: type === "decay" ? "Prevent Decay" : type === "mistake" ? "Fix Pattern" : type === "timing" ? "Optimize Schedule" : type === "rank" ? "Boost Rank" : "Strengthen",
            actionSubject: safeStr(c.subject) || undefined,
            actionTopic: safeStr(c.topic) || undefined,
            impactPreview: safeStr(c.impact, type === "decay" ? "+5% stability" : type === "performance" ? "+3% mastery" : "+2% brain health"),
          };
        });
        setInsights(mapped);
        setCache(CACHE_KEY, mapped);
      }

      // Generate tomorrow strategy
      const tomorrowData = data?.tomorrow_strategy || data?.strategy;
      if (tomorrowData) {
        const s: TomorrowStrategy = {
          focusArea: safeStr(tomorrowData.focus_area, "Weakest topics"),
          optimalTime: safeStr(tomorrowData.optimal_time, "Morning"),
          estimatedGain: safeStr(tomorrowData.estimated_gain, "+4% stability"),
          missionTitle: safeStr(tomorrowData.mission_title, "AI Recovery Mission"),
          missionDuration: safeStr(tomorrowData.duration, "5 min"),
          reason: safeStr(tomorrowData.reason, "Based on your decay patterns and study timing"),
        };
        setStrategy(s);
        setCache(STRATEGY_CACHE, s);
      } else {
        const fallback: TomorrowStrategy = {
          focusArea: "At-risk topics",
          optimalTime: "Morning (9–11 AM)",
          estimatedGain: "+4% brain stability",
          missionTitle: "Smart Recovery Session",
          missionDuration: "5 min",
          reason: "AI detected optimal retention window for your weakest areas",
        };
        setStrategy(fallback);
        setCache(STRATEGY_CACHE, fallback);
      }
    } catch (e) {
      console.error("AI mentor fetch failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (insights.length === 0) fetchInsights();
  }, []);

  const handleInsightAction = useCallback((insight: MentorInsight) => {
    if (!onAction) return;
    setActiveAction(insight.id);
    const subject = insight.actionSubject || "General";
    const topic = insight.actionTopic || insight.title;
    onAction(subject, topic);
    setTimeout(() => {
      setActiveAction(null);
      setCompletedActions(prev => new Set(prev).add(insight.id));
    }, 2000);
  }, [onAction]);

  // Fallback insights
  const displayInsights = useMemo(() => {
    if (insights.length > 0) return insights;
    return [
      { id: "f1", title: "Performance Trend", insight: "Study consistently to unlock personalized performance tracking and trend analysis.", type: "performance" as const, severity: "info" as const, actionLabel: "Start Studying", impactPreview: "+5% mastery" },
      { id: "f2", title: "Decay Prevention", insight: "Your AI mentor will detect memory decay patterns and suggest preventive actions.", type: "decay" as const, severity: "info" as const, actionLabel: "Learn More", impactPreview: "+3% stability" },
      { id: "f3", title: "Smart Timing", insight: "AI analyzes your study timing to recommend optimal learning windows.", type: "timing" as const, severity: "info" as const, actionLabel: "Set Schedule", impactPreview: "+2% efficiency" },
    ];
  }, [insights]);

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
    >
      {/* ── Header ── */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="relative">
            <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-primary" />
            </div>
            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-primary animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">AI Mentor</h3>
            <p className="text-[10px] text-muted-foreground">Personalized intelligence & strategy</p>
          </div>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={fetchInsights}
          disabled={loading}
          className="p-2 rounded-lg bg-secondary/50 hover:bg-secondary transition-colors disabled:opacity-50"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </div>

      {/* ── Insight Cards ── */}
      <div className="space-y-2.5">
        {loading && insights.length === 0 ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-xl p-4 animate-pulse"
              style={{ background: "hsl(var(--card) / 0.6)", border: "1px solid hsl(var(--border) / 0.3)" }}
            >
              <div className="flex items-start gap-3">
                <div className="w-9 h-9 rounded-lg bg-secondary/50" />
                <div className="flex-1 space-y-2">
                  <div className="h-3 bg-secondary/50 rounded w-1/3" />
                  <div className="h-3 bg-secondary/30 rounded w-full" />
                  <div className="h-6 bg-secondary/20 rounded-lg w-24 mt-2" />
                </div>
              </div>
            </div>
          ))
        ) : (
          <AnimatePresence mode="popLayout">
            {displayInsights.map((card, i) => {
              const config = typeConfig[card.type];
              const Icon = config.icon;
              const isActive = activeAction === card.id;
              const isCompleted = completedActions.has(card.id);

              return (
                <motion.div
                  key={card.id}
                  layout
                  initial={{ opacity: 0, x: -16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 16 }}
                  transition={{ delay: 0.05 * i, type: "spring", stiffness: 300, damping: 30 }}
                  className="rounded-xl p-4 relative overflow-hidden"
                  style={{
                    background: "hsl(var(--card) / 0.7)",
                    border: `1px solid ${severityBorder[card.severity]}`,
                    boxShadow: config.glow,
                  }}
                >
                  {/* Severity indicator line */}
                  {card.severity !== "info" && (
                    <div
                      className="absolute left-0 top-0 bottom-0 w-[2px]"
                      style={{
                        background: card.severity === "critical"
                          ? "hsl(0 70% 50%)"
                          : "hsl(38 70% 50%)",
                      }}
                    />
                  )}

                  <div className="flex items-start gap-3">
                    {/* Icon */}
                    <div
                      className={`w-9 h-9 rounded-lg ${config.bg} flex items-center justify-center shrink-0 relative`}
                    >
                      <Icon className={`w-4 h-4 ${config.color}`} />
                      {card.severity === "critical" && (
                        <motion.div
                          className="absolute inset-0 rounded-lg"
                          style={{ border: `1px solid hsl(0 70% 50% / 0.3)` }}
                          animate={{ opacity: [0.3, 0.8, 0.3] }}
                          transition={{ duration: 2, repeat: Infinity }}
                        />
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="text-xs font-semibold text-foreground">{card.title}</p>
                        {card.impactPreview && (
                          <span
                            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
                            style={{
                              background: "hsl(var(--primary) / 0.12)",
                              color: "hsl(var(--primary))",
                            }}
                          >
                            {card.impactPreview}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground leading-relaxed mb-2.5">
                        {card.insight}
                      </p>

                      {/* Action Button */}
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={() => handleInsightAction(card)}
                        disabled={isActive || isCompleted}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-semibold transition-all disabled:opacity-60"
                        style={{
                          background: isCompleted
                            ? "hsl(142 50% 30% / 0.2)"
                            : "hsl(var(--primary) / 0.12)",
                          color: isCompleted
                            ? "hsl(142 60% 60%)"
                            : "hsl(var(--primary))",
                        }}
                      >
                        {isActive ? (
                          <>
                            <RefreshCw className="w-3 h-3 animate-spin" />
                            Running...
                          </>
                        ) : isCompleted ? (
                          <>
                            <CheckCircle2 className="w-3 h-3" />
                            Done
                          </>
                        ) : (
                          <>
                            <Play className="w-3 h-3" />
                            {card.actionLabel}
                            <ChevronRight className="w-3 h-3" />
                          </>
                        )}
                      </motion.button>
                    </div>
                  </div>

                  {/* Completion flash */}
                  <AnimatePresence>
                    {isCompleted && (
                      <motion.div
                        initial={{ opacity: 0.5 }}
                        animate={{ opacity: 0 }}
                        transition={{ duration: 1 }}
                        className="absolute inset-0 rounded-xl pointer-events-none"
                        style={{ background: "hsl(142 60% 50% / 0.08)" }}
                      />
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </AnimatePresence>
        )}
      </div>

      {/* ── AI Strategy for Tomorrow ── */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5 }}
        className="mt-5 rounded-xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.4))",
          border: "1px solid hsl(var(--primary) / 0.15)",
          boxShadow: "0 0 30px hsl(var(--primary) / 0.06)",
        }}
      >
        {/* Subtle glow overlay */}
        <div
          className="absolute inset-0 pointer-events-none"
          style={{
            background: "radial-gradient(ellipse at top right, hsl(var(--primary) / 0.05), transparent 60%)",
          }}
        />

        <div className="p-4 relative z-10">
          {/* Strategy header */}
          <div className="flex items-center gap-2.5 mb-3">
            <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
              <Calendar className="w-4 h-4 text-primary" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-foreground">AI Strategy for Tomorrow</h4>
              <p className="text-[10px] text-muted-foreground">Pre-optimized mission ready</p>
            </div>
          </div>

          {strategy ? (
            <div className="space-y-3">
              {/* Strategy details grid */}
              <div className="grid grid-cols-3 gap-2">
                <div
                  className="rounded-lg p-2.5 text-center"
                  style={{ background: "hsl(var(--secondary) / 0.5)" }}
                >
                  <Target className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
                  <p className="text-[9px] text-muted-foreground">Focus</p>
                  <p className="text-[10px] font-semibold text-foreground truncate">{strategy.focusArea}</p>
                </div>
                <div
                  className="rounded-lg p-2.5 text-center"
                  style={{ background: "hsl(var(--secondary) / 0.5)" }}
                >
                  <Clock className="w-3.5 h-3.5 text-sky-400 mx-auto mb-1" />
                  <p className="text-[9px] text-muted-foreground">Time</p>
                  <p className="text-[10px] font-semibold text-foreground truncate">{strategy.optimalTime}</p>
                </div>
                <div
                  className="rounded-lg p-2.5 text-center"
                  style={{ background: "hsl(var(--secondary) / 0.5)" }}
                >
                  <TrendingUp className="w-3.5 h-3.5 text-emerald-400 mx-auto mb-1" />
                  <p className="text-[9px] text-muted-foreground">Gain</p>
                  <p className="text-[10px] font-semibold text-emerald-400">{strategy.estimatedGain}</p>
                </div>
              </div>

              {/* Mission card */}
              <div
                className="rounded-lg p-3 flex items-center gap-3"
                style={{
                  background: "hsl(var(--primary) / 0.06)",
                  border: "1px solid hsl(var(--primary) / 0.1)",
                }}
              >
                <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0">
                  <Lightbulb className="w-5 h-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-semibold text-foreground">{strategy.missionTitle}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {strategy.missionDuration} · {strategy.reason}
                  </p>
                </div>
              </div>

              {/* Schedule button */}
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setStrategyScheduled(true)}
                disabled={strategyScheduled}
                className="w-full py-2.5 rounded-xl text-[11px] font-semibold flex items-center justify-center gap-2 transition-all"
                style={{
                  background: strategyScheduled
                    ? "hsl(142 50% 30% / 0.15)"
                    : "hsl(var(--primary) / 0.12)",
                  color: strategyScheduled
                    ? "hsl(142 60% 60%)"
                    : "hsl(var(--primary))",
                  border: `1px solid ${strategyScheduled ? "hsl(142 50% 40% / 0.2)" : "hsl(var(--primary) / 0.15)"}`,
                }}
              >
                {strategyScheduled ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Mission Scheduled for Tomorrow
                  </>
                ) : (
                  <>
                    <Calendar className="w-3.5 h-3.5" />
                    Pre-Schedule Tomorrow's Mission
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </motion.button>
            </div>
          ) : (
            <div className="py-4 text-center">
              <p className="text-[11px] text-muted-foreground">Generating tomorrow's strategy...</p>
            </div>
          )}
        </div>
      </motion.div>
    </motion.section>
  );
}
