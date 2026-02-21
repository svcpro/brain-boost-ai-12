import { useState } from "react";
import { motion } from "framer-motion";
import { Swords, BarChart3, AlertTriangle, TrendingUp, Rocket, RefreshCw, ChevronRight } from "lucide-react";
import { useRankHeatmap, useWeaknessPredictions, useExamTrends } from "@/hooks/useCompetitiveIntel";
import { useNavigate } from "react-router-dom";

export default function CompetitiveIntelDashboard() {
  const { latest, isLoading: rankLoading, compute, isComputing } = useRankHeatmap();
  const { predictions, isLoading: weakLoading, predict, isPredicting } = useWeaknessPredictions();
  const { trends, isLoading: trendLoading } = useExamTrends();
  const navigate = useNavigate();

  const topPredictions = predictions?.slice(0, 3) || [];
  const topTrends = trends?.slice(0, 3) || [];

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Swords className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Competition Intel</h3>
            <p className="text-[10px] text-muted-foreground">v3.0 — AI Competitive Intelligence</p>
          </div>
        </div>
      </div>

      {/* Rank Heatmap Card */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl p-4 space-y-3"
        style={{ background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary)))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-primary" />
            <span className="text-xs font-bold text-foreground">Rank Heatmap</span>
          </div>
          <button
            onClick={() => compute("general")}
            disabled={isComputing}
            className="text-[10px] text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isComputing ? "animate-spin" : ""}`} />
            {isComputing ? "Computing..." : "Refresh"}
          </button>
        </div>

        {latest ? (
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-primary">{Math.round(latest.blended_percentile || latest.percentile)}th</p>
              <p className="text-[9px] text-muted-foreground">Percentile</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-foreground">{Math.round(latest.internal_rank_score)}%</p>
              <p className="text-[9px] text-muted-foreground">Internal</p>
            </div>
            <div className="text-center p-2 rounded-lg bg-background/50">
              <p className="text-lg font-bold text-accent">{Math.round(latest.simulated_national_score)}%</p>
              <p className="text-[9px] text-muted-foreground">National Est.</p>
            </div>
          </div>
        ) : (
          <div className="text-center py-3">
            <p className="text-xs text-muted-foreground">No rank data yet</p>
            <button onClick={() => compute("general")} className="text-xs text-primary mt-1 hover:underline">Generate now</button>
          </div>
        )}

        {latest?.subject_breakdown && Object.keys(latest.subject_breakdown).length > 0 && (
          <div className="space-y-1.5">
            <p className="text-[10px] font-medium text-muted-foreground">Subject Breakdown</p>
            {Object.entries(latest.subject_breakdown as Record<string, number>).slice(0, 4).map(([subj, score]) => (
              <div key={subj} className="flex items-center gap-2">
                <span className="text-[10px] text-foreground w-20 truncate">{subj}</span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                  <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${score}%` }} />
                </div>
                <span className="text-[10px] text-muted-foreground w-8 text-right">{score}%</span>
              </div>
            ))}
          </div>
        )}
      </motion.div>

      {/* Weakness Prediction */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="rounded-xl p-4 space-y-3"
        style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-xs font-bold text-foreground">Failure Zone Predictions</span>
          </div>
          <button
            onClick={() => predict()}
            disabled={isPredicting}
            className="text-[10px] text-primary flex items-center gap-1 hover:underline disabled:opacity-50"
          >
            <RefreshCw className={`w-3 h-3 ${isPredicting ? "animate-spin" : ""}`} />
            Analyze
          </button>
        </div>

        {topPredictions.length > 0 ? (
          <div className="space-y-2">
            {topPredictions.map((p: any, i: number) => (
              <div key={p.id || i} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold ${
                  p.failure_probability > 70 ? "bg-destructive/15 text-destructive" :
                  p.failure_probability > 40 ? "bg-warning/15 text-warning" : "bg-primary/15 text-primary"
                }`}>
                  {Math.round(p.failure_probability)}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{p.topic_name}</p>
                  <p className="text-[9px] text-muted-foreground truncate">
                    {p.risk_factors?.factors?.slice(0, 2).join(" · ") || "Needs attention"}
                  </p>
                </div>
                {p.reinforcement_date && (
                  <span className="text-[9px] text-primary shrink-0">📅 {new Date(p.reinforcement_date).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="text-xs text-muted-foreground text-center py-2">Run analysis to find your failure zones</p>
        )}
      </motion.div>

      {/* Exam Trends */}
      {topTrends.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="rounded-xl p-4 space-y-3"
          style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}
        >
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-accent" />
            <span className="text-xs font-bold text-foreground">High-Probability Topics</span>
          </div>
          <div className="space-y-2">
            {topTrends.map((t: any, i: number) => (
              <div key={t.id || i} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                <div className="w-8 h-8 rounded-lg bg-accent/15 flex items-center justify-center text-xs font-bold text-accent">
                  {Math.round(t.predicted_probability)}%
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{t.topic}</p>
                  <p className="text-[9px] text-muted-foreground">{t.subject} · {t.frequency_count || 0} past appearances</p>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Accelerator CTA */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        whileHover={{ scale: 1.01 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate("/accelerator")}
        className="w-full rounded-xl p-4 flex items-center gap-3 text-left"
        style={{
          background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))",
          border: "1px solid hsl(var(--primary) / 0.3)",
        }}
      >
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Rocket className="w-5 h-5 text-primary" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold text-foreground">30-Day Rank Accelerator</p>
          <p className="text-[10px] text-muted-foreground">Strategic exam war mode — high intensity auto-scheduling</p>
        </div>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </motion.button>
    </div>
  );
}
