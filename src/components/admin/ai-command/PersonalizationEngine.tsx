import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { User, Fingerprint, Brain, Loader2, TrendingUp, Gauge, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function PersonalizationEngine() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEmbeddings: 0,
    avgCognitiveCapacity: 0,
    avgLearningEfficiency: 0,
    embeddingFreshness: 0,
    strategyCount: 0,
    activeStrategies: 0,
    twinVersions: { v1: 0, v2: 0, v3: 0 },
    recallPatterns: {} as Record<string, number>,
  });

  useEffect(() => {
    (async () => {
      try {
        const [twinsRes, strategiesRes, embedRes] = await Promise.all([
          supabase.from("cognitive_twins").select("cognitive_capacity_score, learning_efficiency_score, twin_version, recall_pattern_type, computed_at").limit(500),
          supabase.from("meta_learning_strategies").select("is_active, strategy_type").limit(500),
          supabase.from("hybrid_predictions").select("id, computed_at").order("computed_at", { ascending: false }).limit(1),
        ]);

        const twins = twinsRes.data || [];
        const strategies = strategiesRes.data || [];

        const avgCap = twins.length > 0 ? Math.round(twins.reduce((s, t) => s + (t.cognitive_capacity_score || 0), 0) / twins.length) : 0;
        const avgEff = twins.length > 0 ? Math.round(twins.reduce((s, t) => s + (t.learning_efficiency_score || 0), 0) / twins.length) : 0;

        // Twin version distribution
        const versions: Record<string, number> = {};
        for (const t of twins) {
          const v = `v${t.twin_version || 1}`;
          versions[v] = (versions[v] || 0) + 1;
        }

        // Recall patterns
        const patterns: Record<string, number> = {};
        for (const t of twins) {
          const p = t.recall_pattern_type || "unknown";
          patterns[p] = (patterns[p] || 0) + 1;
        }

        // Freshness: hours since last embedding
        const lastEmbed = embedRes.data?.[0];
        const freshness = lastEmbed ? Math.round((Date.now() - new Date(lastEmbed.computed_at).getTime()) / 3600000) : 999;

        setStats({
          totalEmbeddings: twins.length,
          avgCognitiveCapacity: avgCap,
          avgLearningEfficiency: avgEff,
          embeddingFreshness: freshness,
          strategyCount: strategies.length,
          activeStrategies: strategies.filter(s => s.is_active).length,
          twinVersions: { v1: versions["v1"] || 0, v2: versions["v2"] || 0, v3: versions["v3"] || 0 },
          recallPatterns: patterns,
        });
      } catch (e) {
        console.error("Personalization fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "User Embeddings", value: stats.totalEmbeddings, icon: Fingerprint, color: "text-primary" },
          { label: "Avg Cognitive", value: `${stats.avgCognitiveCapacity}%`, icon: Brain, color: stats.avgCognitiveCapacity >= 60 ? "text-success" : "text-warning" },
          { label: "Avg Efficiency", value: `${stats.avgLearningEfficiency}%`, icon: TrendingUp, color: stats.avgLearningEfficiency >= 60 ? "text-success" : "text-warning" },
          { label: "Active Strategies", value: `${stats.activeStrategies}/${stats.strategyCount}`, icon: Zap, color: "text-accent" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Embedding Freshness */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-2">Embedding Health</h4>
        <div className="flex items-center gap-3">
          <Gauge className={`w-5 h-5 ${stats.embeddingFreshness < 24 ? "text-success" : stats.embeddingFreshness < 72 ? "text-warning" : "text-destructive"}`} />
          <div className="flex-1">
            <p className="text-sm font-bold text-foreground">
              {stats.embeddingFreshness < 24 ? "Fresh" : stats.embeddingFreshness < 72 ? "Aging" : "Stale"}
            </p>
            <p className="text-[10px] text-muted-foreground">Last computed {stats.embeddingFreshness}h ago</p>
          </div>
        </div>
      </motion.div>

      {/* Recall Pattern Distribution */}
      {Object.keys(stats.recallPatterns).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Recall Pattern Distribution</h4>
          <div className="space-y-2">
            {Object.entries(stats.recallPatterns).map(([pattern, count]) => {
              const total = Object.values(stats.recallPatterns).reduce((s, c) => s + c, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={pattern} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-muted-foreground capitalize">{pattern}</span>
                    <span className="text-foreground font-medium">{count} ({pct}%)</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Twin Versions */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Cognitive Twin Versions</h4>
        <div className="grid grid-cols-3 gap-3">
          {Object.entries(stats.twinVersions).map(([v, count]) => (
            <div key={v} className="text-center p-2 rounded-lg bg-secondary/30">
              <p className="text-sm font-bold text-foreground">{count}</p>
              <p className="text-[10px] text-muted-foreground">{v}</p>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
