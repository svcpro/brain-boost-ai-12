import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Brain, Users, TrendingUp, Activity, Loader2, AlertTriangle, Gauge } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function GlobalBrainDashboard() {
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalBrains: 0,
    avgHealthScore: 0,
    avgRetention: 0,
    atRiskUsers: 0,
    avgStudyHours: 0,
    topDecayTopics: [] as { topic: string; avgScore: number }[],
    healthDistribution: { healthy: 0, moderate: 0, critical: 0 },
  });

  useEffect(() => {
    (async () => {
      try {
        const [twinsRes, scoresRes, featuresRes] = await Promise.all([
          supabase.from("cognitive_twins").select("brain_evolution_score, cognitive_capacity_score, learning_efficiency_score, user_id").order("computed_at", { ascending: false }).limit(500),
          supabase.from("memory_scores").select("score, topic_id").order("recorded_at", { ascending: false }).limit(1000),
          supabase.from("user_features").select("study_consistency_score, recall_success_rate, hours_studied_last_7d, fatigue_indicator, user_id").limit(500),
        ]);

        const twins = twinsRes.data || [];
        const scores = scoresRes.data || [];
        const features = featuresRes.data || [];

        // Unique users with brain models
        const uniqueUsers = new Set(twins.map(t => t.user_id));
        const avgHealth = twins.length > 0
          ? Math.round(twins.reduce((s, t) => s + (t.brain_evolution_score || 0), 0) / twins.length)
          : 0;

        const avgRetention = scores.length > 0
          ? Math.round(scores.reduce((s, m) => s + m.score, 0) / scores.length)
          : 0;

        // At-risk: fatigue > 60 or recall < 0.4
        const atRisk = features.filter(f => (f.fatigue_indicator || 0) > 60 || (f.recall_success_rate || 0) < 0.4).length;

        const avgStudyHours = features.length > 0
          ? Math.round(features.reduce((s, f) => s + (f.hours_studied_last_7d || 0), 0) / features.length * 10) / 10
          : 0;

        // Health distribution
        let healthy = 0, moderate = 0, critical = 0;
        for (const t of twins) {
          const score = t.brain_evolution_score || 0;
          if (score >= 70) healthy++;
          else if (score >= 40) moderate++;
          else critical++;
        }

        setStats({
          totalBrains: uniqueUsers.size,
          avgHealthScore: avgHealth,
          avgRetention,
          atRiskUsers: atRisk,
          avgStudyHours,
          topDecayTopics: [],
          healthDistribution: { healthy, moderate, critical },
        });
      } catch (e) {
        console.error("Global brain fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalBrainUsers = stats.healthDistribution.healthy + stats.healthDistribution.moderate + stats.healthDistribution.critical;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Brain Models", value: stats.totalBrains, icon: Brain, color: "text-primary" },
          { label: "Avg Health", value: `${stats.avgHealthScore}%`, icon: Gauge, color: stats.avgHealthScore >= 60 ? "text-success" : "text-warning" },
          { label: "Avg Retention", value: `${stats.avgRetention}%`, icon: TrendingUp, color: stats.avgRetention >= 60 ? "text-success" : "text-warning" },
          { label: "At-Risk Users", value: stats.atRiskUsers, icon: AlertTriangle, color: stats.atRiskUsers > 10 ? "text-destructive" : "text-warning" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Health Distribution */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Brain Health Distribution</h4>
        <div className="flex gap-1 h-6 rounded-full overflow-hidden bg-secondary">
          {totalBrainUsers > 0 && (
            <>
              <div className="bg-success transition-all" style={{ width: `${(stats.healthDistribution.healthy / totalBrainUsers) * 100}%` }} />
              <div className="bg-warning transition-all" style={{ width: `${(stats.healthDistribution.moderate / totalBrainUsers) * 100}%` }} />
              <div className="bg-destructive transition-all" style={{ width: `${(stats.healthDistribution.critical / totalBrainUsers) * 100}%` }} />
            </>
          )}
        </div>
        <div className="flex justify-between mt-2 text-[10px]">
          <span className="text-success">Healthy: {stats.healthDistribution.healthy}</span>
          <span className="text-warning">Moderate: {stats.healthDistribution.moderate}</span>
          <span className="text-destructive">Critical: {stats.healthDistribution.critical}</span>
        </div>
      </motion.div>

      {/* Platform Metrics */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Platform Learning Metrics</h4>
        <div className="grid grid-cols-2 gap-3">
          {[
            { label: "Avg Weekly Study", value: `${stats.avgStudyHours}h`, color: "text-primary" },
            { label: "Active Brain Models", value: stats.totalBrains, color: "text-accent" },
            { label: "Avg Memory Score", value: `${stats.avgRetention}%`, color: stats.avgRetention >= 60 ? "text-success" : "text-warning" },
            { label: "Users At Risk", value: stats.atRiskUsers, color: stats.atRiskUsers > 5 ? "text-destructive" : "text-success" },
          ].map((m, i) => (
            <div key={m.label} className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
              <span className="text-[10px] text-muted-foreground">{m.label}</span>
              <span className={`text-xs font-bold ${m.color}`}>{m.value}</span>
            </div>
          ))}
        </div>
      </motion.div>
    </div>
  );
}
