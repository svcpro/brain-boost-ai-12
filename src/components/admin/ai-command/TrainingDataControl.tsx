import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Loader2, Trash2, RefreshCw, BarChart3, Clock, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DataSource {
  name: string;
  table: string;
  count: number;
  lastUpdated: string | null;
}

export default function TrainingDataControl() {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [sources, setSources] = useState<DataSource[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [purging, setPurging] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [eventsCountRes, predsCountRes, logsCountRes, scoresCountRes, featuresCountRes, metricsCountRes] = await Promise.all([
          supabase.from("ml_events").select("id, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1),
          supabase.from("model_predictions").select("id, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1),
          supabase.from("ml_training_logs").select("id, started_at", { count: "exact" }).order("started_at", { ascending: false }).limit(1),
          supabase.from("memory_scores").select("id, recorded_at", { count: "exact" }).order("recorded_at", { ascending: false }).limit(1),
          supabase.from("user_features").select("id, computed_at", { count: "exact" }).order("computed_at", { ascending: false }).limit(1),
          supabase.from("model_metrics").select("id, created_at", { count: "exact" }).order("created_at", { ascending: false }).limit(1),
        ]);

        const dataSources: DataSource[] = [
          { name: "ML Events", table: "ml_events", count: eventsCountRes.count || 0, lastUpdated: eventsCountRes.data?.[0]?.created_at || null },
          { name: "Predictions", table: "model_predictions", count: predsCountRes.count || 0, lastUpdated: predsCountRes.data?.[0]?.created_at || null },
          { name: "Training Logs", table: "ml_training_logs", count: logsCountRes.count || 0, lastUpdated: logsCountRes.data?.[0]?.started_at || null },
          { name: "Memory Scores", table: "memory_scores", count: scoresCountRes.count || 0, lastUpdated: scoresCountRes.data?.[0]?.recorded_at || null },
          { name: "User Features", table: "user_features", count: featuresCountRes.count || 0, lastUpdated: featuresCountRes.data?.[0]?.computed_at || null },
          { name: "Model Metrics", table: "model_metrics", count: metricsCountRes.count || 0, lastUpdated: metricsCountRes.data?.[0]?.created_at || null },
        ];

        setSources(dataSources);
        setTotalEvents(dataSources.reduce((s, d) => s + d.count, 0));
      } catch (e) {
        console.error("Training data fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const purgeOldData = async (table: string) => {
    setPurging(table);
    try {
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      const dateCol = table === "ml_training_logs" ? "started_at" : table === "memory_scores" ? "recorded_at" : table === "user_features" ? "computed_at" : "created_at";

      const { error, count } = await (supabase.from(table as any).delete({ count: "exact" }) as any).lt(dateCol, thirtyDaysAgo.toISOString());
      if (error) throw error;
      toast({ title: "Data Purged", description: `Removed ${count || 0} old records from ${table}` });
    } catch (e: any) {
      toast({ title: "Purge failed", description: e.message, variant: "destructive" });
    } finally {
      setPurging(null);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: "Data Sources", value: sources.length, icon: Database, color: "text-primary" },
          { label: "Total Records", value: totalEvents.toLocaleString(), icon: BarChart3, color: "text-accent" },
          { label: "Tables", value: sources.filter(s => s.count > 0).length, icon: Zap, color: "text-success" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Data Sources */}
      <div className="space-y-2">
        {sources.map((source, i) => (
          <motion.div key={source.table} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
            className="glass rounded-xl neural-border p-4 flex items-center gap-3">
            <Database className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-foreground">{source.name}</p>
              <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                <span>{source.count.toLocaleString()} records</span>
                {source.lastUpdated && (
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {new Date(source.lastUpdated).toLocaleDateString()}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={() => purgeOldData(source.table)}
              disabled={purging === source.table || source.count === 0}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-[10px] font-medium text-destructive hover:bg-destructive/10 transition-colors disabled:opacity-40"
              title="Purge records older than 30 days"
            >
              {purging === source.table ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
              Purge 30d+
            </button>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
