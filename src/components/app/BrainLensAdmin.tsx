import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Brain, Eye, BarChart3, TrendingUp, ToggleLeft, ToggleRight } from "lucide-react";
import { toast } from "sonner";

interface QueryStats {
  total: number;
  today: number;
  byType: Record<string, number>;
  topTopics: { topic: string; count: number }[];
}

export default function BrainLensAdmin() {
  const [enabled, setEnabled] = useState(true);
  const [dailyLimit, setDailyLimit] = useState(50);
  const [stats, setStats] = useState<QueryStats>({ total: 0, today: 0, byType: {}, topTopics: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Load config
      const { data: config } = await supabase
        .from("brainlens_config")
        .select("*")
        .single();
      if (config) {
        setEnabled(config.is_enabled);
        setDailyLimit(config.max_daily_queries_per_user);
      }

      // Load stats
      const today = new Date().toISOString().split("T")[0];
      
      const [totalRes, todayRes, queriesRes] = await Promise.all([
        supabase.from("brainlens_queries").select("id", { count: "exact", head: true }),
        supabase.from("brainlens_queries").select("id", { count: "exact", head: true }).gte("created_at", `${today}T00:00:00Z`),
        supabase.from("brainlens_queries").select("input_type, detected_topic").order("created_at", { ascending: false }).limit(500),
      ]);

      const byType: Record<string, number> = {};
      const topicCounts: Record<string, number> = {};
      (queriesRes.data || []).forEach((q: any) => {
        byType[q.input_type] = (byType[q.input_type] || 0) + 1;
        if (q.detected_topic) {
          topicCounts[q.detected_topic] = (topicCounts[q.detected_topic] || 0) + 1;
        }
      });

      const topTopics = Object.entries(topicCounts)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
        .map(([topic, count]) => ({ topic, count }));

      setStats({
        total: totalRes.count || 0,
        today: todayRes.count || 0,
        byType,
        topTopics,
      });
    } catch (e) {
      console.error("BrainLens admin load error:", e);
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async () => {
    const newVal = !enabled;
    const { error } = await supabase
      .from("brainlens_config")
      .update({ is_enabled: newVal })
      .not("id", "is", null);
    if (error) {
      toast.error("Failed to update");
      return;
    }
    setEnabled(newVal);
    toast.success(`BrainLens ${newVal ? "enabled" : "disabled"}`);
  };

  if (loading) {
    return <div className="p-6 text-center text-muted-foreground text-sm">Loading BrainLens data...</div>;
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="w-5 h-5 text-accent" />
          <h3 className="text-sm font-bold">BrainLens Control</h3>
        </div>
        <button onClick={toggleEnabled} className="flex items-center gap-1.5">
          {enabled ? (
            <ToggleRight className="w-8 h-8 text-success" />
          ) : (
            <ToggleLeft className="w-8 h-8 text-muted-foreground" />
          )}
          <span className="text-xs font-medium">{enabled ? "Active" : "Disabled"}</span>
        </button>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Queries</p>
          <p className="text-xl font-bold text-foreground">{stats.total}</p>
        </div>
        <div className="glass rounded-xl p-3">
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Today</p>
          <p className="text-xl font-bold text-primary">{stats.today}</p>
        </div>
      </div>

      {/* Query Types */}
      <div className="glass rounded-xl p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Query Types</p>
        {Object.entries(stats.byType).map(([type, count]) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <span className="capitalize text-foreground">{type}</span>
            <span className="text-muted-foreground font-mono">{count}</span>
          </div>
        ))}
        {Object.keys(stats.byType).length === 0 && (
          <p className="text-xs text-muted-foreground">No queries yet</p>
        )}
      </div>

      {/* Top Topics */}
      <div className="glass rounded-xl p-3 space-y-2">
        <p className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Popular Topics</p>
        {stats.topTopics.map(({ topic, count }) => (
          <div key={topic} className="flex items-center justify-between text-sm">
            <span className="text-foreground">{topic}</span>
            <span className="px-2 py-0.5 rounded-full bg-primary/15 text-primary text-[10px] font-bold">{count}</span>
          </div>
        ))}
        {stats.topTopics.length === 0 && (
          <p className="text-xs text-muted-foreground">No data yet</p>
        )}
      </div>
    </div>
  );
}
