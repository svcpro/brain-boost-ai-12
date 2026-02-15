import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Globe, TrendingUp, TrendingDown, Clock, Brain, ChevronDown, AlertTriangle, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PatternRow {
  pattern_type: string;
  pattern_key: string;
  sample_size: number;
  metrics: Record<string, any>;
  pattern_date: string;
}

const GlobalIntelligenceCard = () => {
  const { user } = useAuth();
  const [patterns, setPatterns] = useState<PatternRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("global_learning_patterns")
        .select("pattern_type, pattern_key, sample_size, metrics, pattern_date")
        .order("pattern_date", { ascending: false })
        .limit(50);
      setPatterns(data || []);
      setLoading(false);
    };
    load();
  }, [user]);

  if (loading) {
    return (
      <div className="glass rounded-xl neural-border p-4 animate-pulse">
        <div className="h-4 bg-secondary/50 rounded w-1/2 mb-3" />
        <div className="h-3 bg-secondary/30 rounded w-3/4" />
      </div>
    );
  }

  if (patterns.length === 0) {
    return null; // No global data yet
  }

  // Parse patterns
  const hardestTopics = patterns
    .filter(p => p.pattern_type === "topic_difficulty")
    .sort((a, b) => (a.metrics.avg_strength ?? 100) - (b.metrics.avg_strength ?? 100))
    .slice(0, 5);

  const bestHours = patterns
    .filter(p => p.pattern_type === "study_timing")
    .sort((a, b) => (b.metrics.high_confidence_pct ?? 0) - (a.metrics.high_confidence_pct ?? 0))
    .slice(0, 3);

  const decayGlobal = patterns.find(p => p.pattern_type === "decay_patterns" && p.pattern_key === "global_avg");

  const revisionEffectiveness = patterns
    .filter(p => p.pattern_type === "revision_effectiveness")
    .sort((a, b) => {
      const order = ["within_1d", "within_3d", "within_7d", "within_14d", "over_14d"];
      return order.indexOf(a.pattern_key) - order.indexOf(b.pattern_key);
    });

  const totalSamples = patterns.reduce((sum, p) => sum + p.sample_size, 0);

  const bucketLabel: Record<string, string> = {
    within_1d: "< 1 day",
    within_3d: "1–3 days",
    within_7d: "3–7 days",
    within_14d: "1–2 weeks",
    over_14d: "> 2 weeks",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      <button
        onClick={() => setExpanded(v => !v)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/10 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center shrink-0">
          <Globe className="w-4.5 h-4.5 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-foreground">Global Intelligence</p>
          <p className="text-[10px] text-muted-foreground">
            Patterns from {totalSamples.toLocaleString()} data points across all learners
          </p>
        </div>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4">
              {/* Hardest Topics Globally */}
              {hardestTopics.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <AlertTriangle className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground">Hardest Topics Globally</span>
                  </div>
                  <div className="space-y-1.5">
                    {hardestTopics.map((t, i) => (
                      <motion.div
                        key={t.pattern_key}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.05 }}
                        className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20"
                      >
                        <span className="text-[10px] text-muted-foreground w-4 shrink-0">#{i + 1}</span>
                        <span className="text-xs text-foreground flex-1 truncate capitalize">{t.pattern_key}</span>
                        <div className="flex items-center gap-1.5">
                          <div className="w-16 h-1.5 rounded-full bg-secondary">
                            <div
                              className={`h-full rounded-full ${t.metrics.avg_strength < 40 ? "bg-destructive" : t.metrics.avg_strength < 60 ? "bg-warning" : "bg-success"}`}
                              style={{ width: `${t.metrics.avg_strength}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-medium text-muted-foreground w-8 text-right">
                            {Math.round(t.metrics.avg_strength)}%
                          </span>
                        </div>
                        <div className="flex items-center gap-0.5">
                          <Users className="w-2.5 h-2.5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">{t.sample_size}</span>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              )}

              {/* Best Study Hours */}
              {bestHours.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Best Study Hours</span>
                  </div>
                  <div className="flex gap-2">
                    {bestHours.map((h, i) => {
                      const hour = parseInt(h.pattern_key.replace("hour_", ""));
                      const label = hour === 0 ? "12 AM" : hour < 12 ? `${hour} AM` : hour === 12 ? "12 PM" : `${hour - 12} PM`;
                      return (
                        <motion.div
                          key={h.pattern_key}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: i * 0.1 }}
                          className="flex-1 p-2.5 rounded-lg bg-primary/5 border border-primary/20 text-center"
                        >
                          <p className="text-sm font-bold text-primary">{label}</p>
                          <p className="text-[9px] text-muted-foreground mt-0.5">
                            {h.metrics.high_confidence_pct}% high confidence
                          </p>
                          <p className="text-[9px] text-muted-foreground">
                            ~{h.metrics.avg_duration_min} min avg
                          </p>
                        </motion.div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Revision Effectiveness */}
              {revisionEffectiveness.length > 0 && (
                <div>
                  <div className="flex items-center gap-1.5 mb-2">
                    <TrendingDown className="w-3.5 h-3.5 text-warning" />
                    <span className="text-xs font-semibold text-foreground">Revision Timing → Retention</span>
                  </div>
                  <div className="space-y-1">
                    {revisionEffectiveness.map((r, i) => (
                      <div key={r.pattern_key} className="flex items-center gap-2 text-xs">
                        <span className="text-[10px] text-muted-foreground w-16 shrink-0">
                          {bucketLabel[r.pattern_key] || r.pattern_key}
                        </span>
                        <div className="flex-1 h-2 rounded-full bg-secondary">
                          <motion.div
                            className={`h-full rounded-full ${r.metrics.avg_retention > 70 ? "bg-success" : r.metrics.avg_retention > 50 ? "bg-warning" : "bg-destructive"}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${r.metrics.avg_retention}%` }}
                            transition={{ duration: 0.6, delay: i * 0.1 }}
                          />
                        </div>
                        <span className="text-[10px] font-medium text-foreground w-8 text-right">
                          {Math.round(r.metrics.avg_retention)}%
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-1.5 italic">
                    Topics revised within 1 day retain {
                      revisionEffectiveness.find(r => r.pattern_key === "within_1d")?.metrics.avg_retention
                        ? `${Math.round(revisionEffectiveness.find(r => r.pattern_key === "within_1d")!.metrics.avg_retention - (revisionEffectiveness.find(r => r.pattern_key === "over_14d")?.metrics.avg_retention || 0))}%`
                        : "significantly"
                    } more than those left for 2+ weeks
                  </p>
                </div>
              )}

              {/* Global Cognitive Health */}
              {decayGlobal && (
                <div className="p-3 rounded-lg bg-secondary/15 border border-border/50">
                  <div className="flex items-center gap-1.5 mb-2">
                    <Brain className="w-3.5 h-3.5 text-primary" />
                    <span className="text-xs font-semibold text-foreground">Global Cognitive Health</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {Math.round(decayGlobal.metrics.avg_knowledge_stability)}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">Avg Stability</p>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-foreground">
                        {decayGlobal.metrics.avg_learning_velocity?.toFixed(2)}
                      </p>
                      <p className="text-[9px] text-muted-foreground">Avg Velocity</p>
                    </div>
                    <div>
                      <p className={`text-sm font-bold ${decayGlobal.metrics.high_burnout_pct > 30 ? "text-destructive" : "text-success"}`}>
                        {decayGlobal.metrics.high_burnout_pct}%
                      </p>
                      <p className="text-[9px] text-muted-foreground">High Burnout</p>
                    </div>
                  </div>
                  <p className="text-[9px] text-muted-foreground mt-2 text-center">
                    Based on {decayGlobal.sample_size} learners
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default GlobalIntelligenceCard;
