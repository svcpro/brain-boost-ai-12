import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Shield, TrendingUp, Brain, Zap, Clock, Target, AlertTriangle, ChevronDown, ChevronUp, Sparkles, Activity } from "lucide-react";
import { usePrecisionIntelligence, PrecisionScore } from "@/hooks/usePrecisionIntelligence";

interface PrecisionIntelligenceCardProps {
  compact?: boolean;
  onComputeComplete?: (score: PrecisionScore) => void;
}

const factorConfig = [
  { key: "performance_trend", label: "Performance Trend", icon: TrendingUp, color: "text-primary" },
  { key: "topic_weight_importance", label: "Topic Mastery", icon: Brain, color: "text-chart-2" },
  { key: "forgetting_curve_factor", label: "Memory Retention", icon: Clock, color: "text-chart-3" },
  { key: "retrieval_strength_index", label: "Retrieval Strength", icon: Zap, color: "text-chart-4" },
  { key: "behavioral_timing_score", label: "Study Consistency", icon: Activity, color: "text-chart-5" },
  { key: "error_clustering_score", label: "Error Distribution", icon: Target, color: "text-chart-1" },
];

export default function PrecisionIntelligenceCard({ compact = false, onComputeComplete }: PrecisionIntelligenceCardProps) {
  const { precisionScore, loading, computePrecision } = usePrecisionIntelligence();
  const [expanded, setExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!hasLoaded) {
      setHasLoaded(true);
      computePrecision().then((data) => {
        if (data && onComputeComplete) onComputeComplete(data);
      });
    }
  }, [hasLoaded]);

  const score = precisionScore;
  const pct = score ? Math.round(score.unified_precision_score * 100) : 0;
  const ciLow = score ? Math.round(score.confidence_interval.low * 100) : 0;
  const ciHigh = score ? Math.round(score.confidence_interval.high * 100) : 0;

  const getScoreColor = (pct: number) => {
    if (pct >= 75) return "text-chart-2";
    if (pct >= 50) return "text-primary";
    if (pct >= 30) return "text-chart-5";
    return "text-destructive";
  };

  const getScoreLabel = (pct: number) => {
    if (pct >= 80) return "Excellent";
    if (pct >= 65) return "Strong";
    if (pct >= 45) return "Developing";
    if (pct >= 25) return "Needs Work";
    return "Critical";
  };

  if (loading && !score) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-xl bg-secondary" />
          <div className="flex-1 space-y-2">
            <div className="h-4 bg-secondary rounded w-2/3" />
            <div className="h-3 bg-secondary rounded w-1/2" />
          </div>
        </div>
      </div>
    );
  }

  if (compact) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-border bg-card/80 p-3 flex items-center gap-3"
      >
        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
          <Shield className={`w-5 h-5 ${getScoreColor(pct)}`} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className={`text-lg font-bold ${getScoreColor(pct)}`}>{pct}%</span>
            <span className="text-[10px] text-muted-foreground">Precision Score</span>
          </div>
          <div className="w-full h-1.5 rounded-full bg-secondary mt-1">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1, ease: "easeOut" }}
              className="h-full rounded-full bg-primary"
            />
          </div>
        </div>
        <span className="text-[9px] text-muted-foreground">{ciLow}-{ciHigh}%</span>
      </motion.div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 overflow-hidden"
      style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--card)))" }}
    >
      {/* Glow */}
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full opacity-15 blur-3xl pointer-events-none" style={{ background: "hsl(var(--primary))" }} />

      <div className="relative z-10 p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ duration: 3, repeat: Infinity }}
              className="w-12 h-12 rounded-xl bg-primary/15 flex items-center justify-center"
            >
              <Shield className={`w-6 h-6 ${getScoreColor(pct)}`} />
            </motion.div>
            <div>
              <h3 className="text-sm font-bold text-foreground">AI Precision Score</h3>
              <p className="text-[10px] text-muted-foreground">v7.0 Hybrid Intelligence</p>
            </div>
          </div>
          <div className="text-right">
            <p className={`text-2xl font-black ${getScoreColor(pct)}`}>{pct}%</p>
            <p className="text-[9px] text-muted-foreground">CI: {ciLow}–{ciHigh}%</p>
          </div>
        </div>

        {/* Score bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className={`text-[10px] font-semibold ${getScoreColor(pct)}`}>{getScoreLabel(pct)}</span>
            <span className="text-[9px] text-muted-foreground">{score?.data_maturity ? Math.round(score.data_maturity * 100) : 0}% data maturity</span>
          </div>
          <div className="relative w-full h-2.5 rounded-full bg-secondary overflow-hidden">
            {/* CI range */}
            <div
              className="absolute h-full bg-primary/20 rounded-full"
              style={{ left: `${ciLow}%`, width: `${ciHigh - ciLow}%` }}
            />
            {/* Score */}
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 1.2, ease: "easeOut" }}
              className="absolute h-full rounded-full bg-primary"
            />
          </div>
        </div>

        {/* AI Reasoning */}
        {score?.ai_reasoning && (
          <div className="flex items-start gap-1.5 mb-3 px-3 py-2 rounded-xl bg-secondary/40 border border-border/50">
            <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground italic leading-relaxed">{score.ai_reasoning}</p>
          </div>
        )}

        {/* Risk indicators */}
        {score && score.decaying_topics > 0 && (
          <div className="flex items-center gap-2 mb-3 px-3 py-1.5 rounded-lg bg-destructive/10 border border-destructive/20">
            <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
            <span className="text-[10px] text-destructive font-medium">
              {score.decaying_topics}/{score.total_topics} topics below 50% retention
            </span>
          </div>
        )}

        {/* Expand/collapse factors */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full flex items-center justify-center gap-1 py-1.5 text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? "Hide" : "View"} Factor Breakdown
        </button>

        {/* Factor breakdown */}
        {expanded && score && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="mt-2 space-y-2"
          >
            {factorConfig.map(({ key, label, icon: Icon, color }) => {
              const value = score.factors[key as keyof typeof score.factors] || 0;
              const valuePct = Math.round(value * 100);
              return (
                <div key={key} className="flex items-center gap-2">
                  <Icon className={`w-3.5 h-3.5 ${color} shrink-0`} />
                  <span className="text-[10px] text-muted-foreground w-28 shrink-0">{label}</span>
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${valuePct}%` }}
                      transition={{ duration: 0.8, delay: 0.1 }}
                      className="h-full rounded-full bg-primary"
                    />
                  </div>
                  <span className="text-[10px] font-medium text-foreground w-8 text-right">{valuePct}%</span>
                </div>
              );
            })}
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}
