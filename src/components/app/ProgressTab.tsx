import { useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, BarChart3, Clock, Users, SlidersHorizontal, RefreshCw } from "lucide-react";
import { useRankPrediction } from "@/hooks/useRankPrediction";

const ProgressTab = () => {
  const { data, loading, predictRank } = useRankPrediction();

  useEffect(() => {
    predictRank();
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

      {/* Features */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="grid grid-cols-2 gap-3"
      >
        {[
          { icon: Clock, label: "Brain Evolution", desc: "Timeline view" },
          { icon: Users, label: "Competition Intel", desc: "Peer comparison" },
          { icon: SlidersHorizontal, label: "Exam Simulator", desc: "Strategy testing" },
          { icon: BarChart3, label: "Weekly Report", desc: "AI analysis" },
        ].map((item, i) => (
          <button
            key={i}
            className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left"
          >
            <item.icon className="w-5 h-5 text-primary mb-2" />
            <p className="text-sm font-medium text-foreground">{item.label}</p>
            <p className="text-[10px] text-muted-foreground">{item.desc}</p>
          </button>
        ))}
      </motion.div>
    </div>
  );
};

export default ProgressTab;
