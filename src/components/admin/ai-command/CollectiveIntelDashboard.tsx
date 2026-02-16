import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Globe, Database, TrendingUp, Loader2, BarChart3, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function CollectiveIntelDashboard() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalPatterns: 0,
    patternTypes: {} as Record<string, number>,
    avgSampleSize: 0,
    recentPatterns: [] as { key: string; type: string; sample: number; date: string }[],
    hybridPredictions: 0,
    avgPersonalWeight: 0,
    avgGlobalWeight: 0,
  });

  useEffect(() => {
    (async () => {
      try {
        const [patternsRes, hybridRes] = await Promise.all([
          supabase.from("global_learning_patterns").select("*").order("created_at", { ascending: false }).limit(100),
          supabase.from("hybrid_predictions").select("personal_weight, global_weight").limit(200),
        ]);

        const patterns = patternsRes.data || [];
        const hybrid = hybridRes.data || [];

        const types: Record<string, number> = {};
        for (const p of patterns) {
          types[p.pattern_type] = (types[p.pattern_type] || 0) + 1;
        }

        const avgSample = patterns.length > 0 ? Math.round(patterns.reduce((s, p) => s + p.sample_size, 0) / patterns.length) : 0;
        const avgPW = hybrid.length > 0 ? Math.round(hybrid.reduce((s, h) => s + (h.personal_weight || 0.6), 0) / hybrid.length * 100) : 60;
        const avgGW = hybrid.length > 0 ? Math.round(hybrid.reduce((s, h) => s + (h.global_weight || 0.4), 0) / hybrid.length * 100) : 40;

        setData({
          totalPatterns: patterns.length,
          patternTypes: types,
          avgSampleSize: avgSample,
          recentPatterns: patterns.slice(0, 8).map(p => ({
            key: p.pattern_key,
            type: p.pattern_type,
            sample: p.sample_size,
            date: new Date(p.created_at).toLocaleDateString(),
          })),
          hybridPredictions: hybrid.length,
          avgPersonalWeight: avgPW,
          avgGlobalWeight: avgGW,
        });
      } catch (e) {
        console.error("Collective intel fetch failed:", e);
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
          { label: "Global Patterns", value: data.totalPatterns, icon: Globe, color: "text-primary" },
          { label: "Avg Sample Size", value: data.avgSampleSize, icon: Database, color: "text-accent" },
          { label: "Hybrid Predictions", value: data.hybridPredictions, icon: TrendingUp, color: "text-success" },
          { label: "Personal Weight", value: `${data.avgPersonalWeight}%`, icon: Users, color: "text-warning" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Hybrid Intelligence Balance */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Hybrid Intelligence Balance</h4>
        <div className="flex gap-1 h-8 rounded-full overflow-hidden">
          <div className="bg-primary flex items-center justify-center transition-all" style={{ width: `${data.avgPersonalWeight}%` }}>
            <span className="text-[9px] font-bold text-primary-foreground">Personal {data.avgPersonalWeight}%</span>
          </div>
          <div className="bg-accent flex items-center justify-center transition-all" style={{ width: `${data.avgGlobalWeight}%` }}>
            <span className="text-[9px] font-bold text-accent-foreground">Global {data.avgGlobalWeight}%</span>
          </div>
        </div>
      </motion.div>

      {/* Pattern Types */}
      {Object.keys(data.patternTypes).length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
          className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Pattern Types</h4>
          <div className="grid grid-cols-2 gap-2">
            {Object.entries(data.patternTypes).map(([type, count]) => (
              <div key={type} className="flex justify-between items-center p-2 rounded-lg bg-secondary/30">
                <span className="text-[10px] text-muted-foreground capitalize">{type.replace(/_/g, " ")}</span>
                <span className="text-xs font-bold text-foreground">{count}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Recent Patterns */}
      {data.recentPatterns.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Recent Patterns</h4>
          <div className="space-y-1.5">
            {data.recentPatterns.map((p, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] p-2 rounded-lg bg-secondary/30">
                <span className="text-foreground font-medium truncate max-w-[40%]">{p.key}</span>
                <span className="text-muted-foreground capitalize">{p.type.replace(/_/g, " ")}</span>
                <span className="text-muted-foreground">{p.sample} users</span>
                <span className="text-muted-foreground">{p.date}</span>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
