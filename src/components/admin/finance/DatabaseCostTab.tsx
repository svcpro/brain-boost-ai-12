import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Database, Loader2, TrendingUp, Users, HardDrive, Activity, BarChart3 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const TABLE_ESTIMATES = [
  { table: "study_logs", label: "Study Logs", avgRowBytes: 200 },
  { table: "topics", label: "Topics", avgRowBytes: 500 },
  { table: "memory_scores", label: "Memory Scores", avgRowBytes: 150 },
  { table: "model_predictions", label: "Predictions", avgRowBytes: 300 },
  { table: "ml_events", label: "ML Events", avgRowBytes: 250 },
  { table: "ai_chat_messages", label: "Chat Messages", avgRowBytes: 800 },
  { table: "profiles", label: "Profiles", avgRowBytes: 400 },
  { table: "user_features", label: "User Features", avgRowBytes: 350 },
  { table: "cognitive_twins", label: "Cognitive Twins", avgRowBytes: 1000 },
  { table: "question_performance", label: "Questions", avgRowBytes: 600 },
];

// Lovable Cloud pricing estimate per GB/month (₹)
const DB_COST_PER_GB_INR = 166; // ~$2/GB * 83
const READ_COST_PER_MILLION_INR = 8.3; // ~$0.1/M reads * 83
const WRITE_COST_PER_MILLION_INR = 83; // ~$1/M writes * 83

export default function DatabaseCostTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    tables: [] as { name: string; label: string; rows: number; sizeBytes: number; sizeMB: number }[],
    totalSizeMB: 0,
    totalRows: 0,
    estimatedCostMonthly: 0,
    readEstimate: 0,
    writeEstimate: 0,
    growthTrend: [] as { table: string; growth: number }[],
  });

  useEffect(() => {
    (async () => {
      try {
        const results = await Promise.all(
          TABLE_ESTIMATES.map(async (t) => {
            const { count } = await supabase.from(t.table as any).select("id", { count: "exact", head: true });
            const rows = count || 0;
            const sizeBytes = rows * t.avgRowBytes;
            return { name: t.table, label: t.label, rows, sizeBytes, sizeMB: Math.round((sizeBytes / 1024 / 1024) * 100) / 100 };
          })
        );

        const totalSizeMB = results.reduce((s, t) => s + t.sizeMB, 0);
        const totalRows = results.reduce((s, t) => s + t.rows, 0);
        const storageCost = (totalSizeMB / 1024) * DB_COST_PER_GB_INR;

        // Estimate reads/writes from study_logs and predictions counts
        const readEstimate = (totalRows / 1000000) * READ_COST_PER_MILLION_INR * 30; // daily reads * 30
        const writeEstimate = (totalRows / 5000000) * WRITE_COST_PER_MILLION_INR * 30;

        setData({
          tables: results.sort((a, b) => b.sizeBytes - a.sizeBytes),
          totalSizeMB: Math.round(totalSizeMB * 100) / 100,
          totalRows,
          estimatedCostMonthly: Math.round((storageCost + readEstimate + writeEstimate) * 100) / 100,
          readEstimate: Math.round(readEstimate * 100) / 100,
          writeEstimate: Math.round(writeEstimate * 100) / 100,
          growthTrend: results.filter(r => r.rows > 0).map(r => ({ table: r.label, growth: Math.round(r.rows * 0.1) })),
        });
      } catch (e) {
        console.error("DB cost fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total DB Size", value: data.totalSizeMB > 1024 ? `${(data.totalSizeMB / 1024).toFixed(2)} GB` : `${data.totalSizeMB} MB`, icon: Database, color: "text-primary" },
          { label: "Total Rows", value: data.totalRows.toLocaleString(), icon: Activity, color: "text-accent" },
          { label: "Est. Monthly Cost", value: `₹${data.estimatedCostMonthly}`, icon: TrendingUp, color: "text-warning" },
          { label: "Tables Tracked", value: data.tables.length, icon: HardDrive, color: "text-success" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <s.icon className={`w-4 h-4 mb-1 ${s.color}`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Cost Breakdown */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Cost Breakdown</h4>
        <div className="grid grid-cols-3 gap-3">
          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-[10px] text-muted-foreground">Storage</p>
            <p className="text-sm font-bold text-foreground">₹{Math.round((data.totalSizeMB / 1024) * DB_COST_PER_GB_INR)}</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-[10px] text-muted-foreground">Reads (est.)</p>
            <p className="text-sm font-bold text-foreground">₹{data.readEstimate}</p>
          </div>
          <div className="p-3 rounded-xl bg-secondary/30 text-center">
            <p className="text-[10px] text-muted-foreground">Writes (est.)</p>
            <p className="text-sm font-bold text-foreground">₹{data.writeEstimate}</p>
          </div>
        </div>
      </div>

      {/* Table Size Distribution */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Table Size Distribution
        </h4>
        <div className="space-y-2">
          {data.tables.map(t => {
            const maxSize = Math.max(...data.tables.map(x => x.sizeBytes), 1);
            const pct = (t.sizeBytes / maxSize) * 100;
            return (
              <div key={t.name} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground font-medium">{t.label}</span>
                  <span className="text-muted-foreground">{t.rows.toLocaleString()} rows · {t.sizeMB} MB</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
