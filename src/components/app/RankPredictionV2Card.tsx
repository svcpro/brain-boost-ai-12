import React, { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Trophy, TrendingUp, TrendingDown, Minus, Shield, BarChart3, Sparkles, ChevronDown, ChevronUp } from "lucide-react";
import { usePrecisionIntelligence, RankV2Data } from "@/hooks/usePrecisionIntelligence";

export default function RankPredictionV2Card() {
  const { rankData, loading, computeRankV2 } = usePrecisionIntelligence();
  const [expanded, setExpanded] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);

  useEffect(() => {
    if (!hasLoaded) {
      setHasLoaded(true);
      computeRankV2();
    }
  }, [hasLoaded]);

  const data = rankData;

  if (loading && !data) {
    return (
      <div className="rounded-2xl border border-border bg-card p-4 animate-pulse">
        <div className="h-16 bg-secondary rounded" />
      </div>
    );
  }

  if (!data) return null;

  const TrendIcon = data.trend === "rising" ? TrendingUp : data.trend === "falling" ? TrendingDown : Minus;
  const trendColor = data.trend === "rising" ? "text-chart-2" : data.trend === "falling" ? "text-destructive" : "text-muted-foreground";
  const trendBg = data.trend === "rising" ? "bg-chart-2/10" : data.trend === "falling" ? "bg-destructive/10" : "bg-secondary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-border overflow-hidden"
      style={{ background: "linear-gradient(135deg, hsl(var(--chart-2) / 0.04), hsl(var(--card)))" }}
    >
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-chart-2/15 flex items-center justify-center">
              <Trophy className="w-5.5 h-5.5 text-chart-2" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Rank Prediction v2.0</h3>
              <p className="text-[10px] text-muted-foreground">12-Factor AI Model</p>
            </div>
          </div>
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full ${trendBg}`}>
            <TrendIcon className={`w-3 h-3 ${trendColor}`} />
            <span className={`text-[10px] font-medium ${trendColor}`}>{data.trend}</span>
          </div>
        </div>

        {/* Rank display */}
        <div className="text-center mb-4">
          <p className="text-3xl font-black text-foreground">#{data.predicted_rank.toLocaleString()}</p>
          <p className="text-[10px] text-muted-foreground mt-1">
            Range: #{data.rank_band.low.toLocaleString()} – #{data.rank_band.high.toLocaleString()}
          </p>
        </div>

        {/* Percentile with CI */}
        <div className="flex items-center gap-3 mb-4">
          <div className="flex-1 text-center px-3 py-2 rounded-xl bg-secondary/50 border border-border/50">
            <p className="text-lg font-bold text-primary">{data.percentile}%</p>
            <p className="text-[9px] text-muted-foreground">Percentile</p>
          </div>
          <div className="flex-1 text-center px-3 py-2 rounded-xl bg-secondary/50 border border-border/50">
            <p className="text-xs font-bold text-foreground">{data.confidence_interval.low}–{data.confidence_interval.high}%</p>
            <p className="text-[9px] text-muted-foreground">Confidence Interval</p>
          </div>
        </div>

        {/* Key factors */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center px-2 py-1.5 rounded-lg bg-secondary/40">
            <p className="text-xs font-bold text-foreground">{Math.round(data.consistency_coefficient * 100)}%</p>
            <p className="text-[8px] text-muted-foreground">Consistency</p>
          </div>
          <div className="text-center px-2 py-1.5 rounded-lg bg-secondary/40">
            <p className="text-xs font-bold text-foreground">{Math.round(data.volatility_index * 100)}%</p>
            <p className="text-[8px] text-muted-foreground">Volatility</p>
          </div>
          <div className="text-center px-2 py-1.5 rounded-lg bg-secondary/40">
            <p className="text-xs font-bold text-foreground">{Math.round(data.high_weight_factor * 100)}%</p>
            <p className="text-[8px] text-muted-foreground">Key Topics</p>
          </div>
        </div>

        {/* AI Reasoning */}
        {data.ai_reasoning && (
          <div className="flex items-start gap-1.5 px-3 py-2 rounded-xl bg-secondary/40 border border-border/50">
            <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
            <p className="text-[10px] text-muted-foreground italic leading-relaxed">{data.ai_reasoning}</p>
          </div>
        )}

        {/* Data maturity */}
        <div className="flex items-center justify-between mt-3">
          <span className="text-[9px] text-muted-foreground flex items-center gap-1">
            <Shield className="w-3 h-3" />
            {Math.round(data.data_maturity * 100)}% data maturity
          </span>
          <span className="text-[9px] text-muted-foreground">{data.model_version}</span>
        </div>
      </div>
    </motion.div>
  );
}
