import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BookOpen, Users, AlertTriangle, TrendingUp, BarChart3, Loader2, Brain
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface Props {
  institutionId: string;
}

export default function FacultyDashboard({ institutionId }: Props) {
  const [batches, setBatches] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedBatch, setSelectedBatch] = useState<string | null>(null);

  useEffect(() => { loadData(); }, [institutionId]);

  const loadData = async () => {
    setLoading(true);
    const [{ data: batchData }, { data: analyticsData }] = await Promise.all([
      supabase.from("institution_batches").select("*").eq("institution_id", institutionId).eq("is_active", true),
      supabase.from("batch_analytics").select("*").eq("institution_id", institutionId).order("snapshot_date", { ascending: false }).limit(50),
    ]);
    setBatches((batchData as any[]) || []);
    setAnalytics((analyticsData as any[]) || []);
    if (batchData && batchData.length > 0) setSelectedBatch(batchData[0].id);
    setLoading(false);
  };

  const batchAnalytics = analytics.filter(a => a.batch_id === selectedBatch);
  const latest = batchAnalytics[0];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-9 h-9 rounded-xl bg-primary/20 flex items-center justify-center">
          <BookOpen className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="text-base font-bold text-foreground">Faculty Dashboard</h3>
          <p className="text-[10px] text-muted-foreground">Topic performance, weakness detection & intervention</p>
        </div>
      </div>

      {/* Batch selector */}
      <div className="flex gap-2 flex-wrap">
        {batches.map(b => (
          <button
            key={b.id}
            onClick={() => setSelectedBatch(b.id)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${selectedBatch === b.id ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground hover:text-foreground"}`}
          >
            {b.name}
          </button>
        ))}
      </div>

      {!latest ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <BarChart3 className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
          <h4 className="text-sm font-semibold text-foreground mb-1">No Analytics Data</h4>
          <p className="text-xs text-muted-foreground">Analytics will be generated once students start practicing</p>
        </div>
      ) : (
        <>
          {/* Key Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: "Avg Score", value: `${latest.avg_score?.toFixed(1) || 0}%`, color: "text-primary" },
              { label: "Memory Strength", value: `${latest.avg_memory_strength?.toFixed(1) || 0}%`, color: "text-accent" },
              { label: "Active Students", value: latest.active_students || 0, color: "text-success" },
              { label: "Dropout Risk", value: latest.dropout_risk_count || 0, color: "text-destructive" },
            ].map(m => (
              <div key={m.label} className="glass rounded-xl p-3 neural-border">
                <span className="text-[10px] text-muted-foreground">{m.label}</span>
                <p className={`text-lg font-bold ${m.color}`}>{m.value}</p>
              </div>
            ))}
          </div>

          {/* Weak Topics */}
          <div className="glass rounded-xl p-4 neural-border">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" /> Weak Topics (Class-wide)
            </h4>
            {Array.isArray(latest.top_weak_topics) && latest.top_weak_topics.length > 0 ? (
              <div className="space-y-2">
                {(latest.top_weak_topics as any[]).map((topic: any, i: number) => (
                  <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                    <span className="text-xs font-medium text-foreground">{topic.name || topic}</span>
                    {topic.avg_score !== undefined && (
                      <span className="text-[10px] text-destructive font-semibold">{topic.avg_score}%</span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">No weak topics detected</p>
            )}
          </div>

          {/* Stability Heatmap */}
          <div className="glass rounded-xl p-4 neural-border">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Brain className="w-4 h-4 text-primary" /> Stability Heatmap
            </h4>
            {latest.stability_heatmap && Object.keys(latest.stability_heatmap).length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {Object.entries(latest.stability_heatmap as Record<string, number>).map(([subject, score]) => (
                  <div key={subject} className="p-2 rounded-lg text-center" style={{
                    backgroundColor: `hsl(${Math.round((score as number) * 1.2)}, 70%, 50%, 0.15)`,
                  }}>
                    <span className="text-[10px] text-muted-foreground block">{subject}</span>
                    <span className="text-sm font-bold text-foreground">{(score as number).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Heatmap data not yet computed</p>
            )}
          </div>

          {/* Rank Projection */}
          <div className="glass rounded-xl p-4 neural-border">
            <h4 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-accent" /> Rank Projection
            </h4>
            {latest.rank_projection && Object.keys(latest.rank_projection).length > 0 ? (
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(latest.rank_projection as Record<string, any>).map(([tier, count]) => (
                  <div key={tier} className="p-3 rounded-lg bg-secondary/40 text-center">
                    <span className="text-xs font-semibold text-foreground capitalize">{tier}</span>
                    <p className="text-lg font-bold text-primary">{String(count)}</p>
                    <span className="text-[10px] text-muted-foreground">students</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">Rank projections not yet computed</p>
            )}
          </div>
        </>
      )}
    </div>
  );
}
