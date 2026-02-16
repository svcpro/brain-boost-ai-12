import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { TrendingUp, Loader2, Calendar, IndianRupee, Brain, Activity, AlertTriangle, Lightbulb } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function CostForecastTab() {
  const [loading, setLoading] = useState(true);
  const [forecast, setForecast] = useState({
    dailyAvg: 0,
    projected7d: 0,
    projectedMonthly: 0,
    projectedAnnual: 0,
    growthRate: 0,
    dailyTrend: [] as { date: string; cost: number }[],
    optimizations: [] as string[],
  });

  useEffect(() => {
    (async () => {
      try {
        const [chatRes, apiRes] = await Promise.all([
          supabase.from("chat_usage_logs").select("estimated_cost, created_at").order("created_at", { ascending: false }).limit(1000),
          supabase.from("api_integrations").select("monthly_cost_estimate, monthly_usage_count, display_name, is_enabled"),
        ]);

        const chatLogs = chatRes.data || [];
        const apis = apiRes.data || [];

        // Build daily costs (last 14 days)
        const dailyMap = new Map<string, number>();
        for (let i = 13; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          dailyMap.set(d.toISOString().split("T")[0], 0);
        }
        for (const l of chatLogs) {
          const day = l.created_at.split("T")[0];
          if (dailyMap.has(day)) {
            dailyMap.set(day, (dailyMap.get(day) || 0) + (l.estimated_cost || 0) * 83);
          }
        }

        const dailyTrend = Array.from(dailyMap.entries()).map(([date, cost]) => ({
          date, cost: Math.round(cost * 100) / 100,
        }));

        const dailyCosts = dailyTrend.map(d => d.cost);
        const dailyAvg = dailyCosts.length > 0 ? dailyCosts.reduce((s, c) => s + c, 0) / dailyCosts.length : 0;

        // Growth rate (compare last 7 to previous 7)
        const last7 = dailyCosts.slice(-7).reduce((s, c) => s + c, 0);
        const prev7 = dailyCosts.slice(0, 7).reduce((s, c) => s + c, 0);
        const growthRate = prev7 > 0 ? ((last7 - prev7) / prev7) * 100 : 0;

        // Monthly API costs
        const monthlyApiCost = apis.reduce((s, a) => s + (a.monthly_cost_estimate || 0) * 83, 0);

        const projectedMonthly = (dailyAvg * 30) + monthlyApiCost;

        // Optimization suggestions
        const optimizations: string[] = [];
        const expensiveApis = apis.filter(a => (a.monthly_cost_estimate || 0) > 5).sort((a, b) => (b.monthly_cost_estimate || 0) - (a.monthly_cost_estimate || 0));
        if (expensiveApis.length > 0) {
          optimizations.push(`Consider optimizing ${expensiveApis[0].display_name} — highest cost API service`);
        }
        if (growthRate > 20) {
          optimizations.push("AI usage is growing rapidly (+20%+ WoW). Consider implementing rate limits.");
        }
        if (dailyAvg > 100) {
          optimizations.push("Switch high-volume predictions to gemini-2.5-flash-lite to reduce AI costs by ~50%");
        }
        optimizations.push("Enable response caching for repeated AI queries to reduce redundant calls");
        optimizations.push("Archive ML events older than 90 days to reduce database storage costs");

        setForecast({
          dailyAvg: Math.round(dailyAvg * 100) / 100,
          projected7d: Math.round(dailyAvg * 7 * 100) / 100,
          projectedMonthly: Math.round(projectedMonthly * 100) / 100,
          projectedAnnual: Math.round(projectedMonthly * 12 * 100) / 100,
          growthRate: Math.round(growthRate * 10) / 10,
          dailyTrend,
          optimizations,
        });
      } catch (e) {
        console.error("Forecast fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Daily Average", value: `₹${forecast.dailyAvg}`, icon: IndianRupee, color: "text-primary" },
          { label: "Projected 7d", value: `₹${forecast.projected7d}`, icon: Calendar, color: "text-accent" },
          { label: "Projected Monthly", value: `₹${forecast.projectedMonthly.toLocaleString()}`, icon: TrendingUp, color: "text-warning" },
          { label: "Growth Rate", value: `${forecast.growthRate > 0 ? "+" : ""}${forecast.growthRate}%`, icon: Activity, color: forecast.growthRate > 20 ? "text-destructive" : "text-success" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <s.icon className={`w-4 h-4 mb-1 ${s.color}`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* 14-Day Trend with Projection */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">14-Day Cost Trend & Forecast</h4>
        <div className="flex items-end gap-1 h-28">
          {forecast.dailyTrend.map((d, i) => {
            const maxCost = Math.max(...forecast.dailyTrend.map(x => x.cost), forecast.dailyAvg, 0.01);
            const height = (d.cost / maxCost) * 100;
            const isProjection = i >= forecast.dailyTrend.length - 3;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[7px] text-muted-foreground">₹{d.cost}</span>
                <div className={`w-full rounded-t transition-all ${isProjection ? "bg-warning/50 border border-dashed border-warning" : "bg-primary/70"}`}
                  style={{ height: `${Math.max(height, 3)}%` }} />
                <span className="text-[7px] text-muted-foreground">{d.date.slice(8)}</span>
              </div>
            );
          })}
        </div>
        {/* Avg line */}
        <div className="mt-2 flex items-center gap-2 text-[10px] text-muted-foreground">
          <div className="w-3 h-0.5 bg-warning" /> Projected
          <div className="w-3 h-0.5 bg-primary" /> Actual
          <span className="ml-auto">Daily avg: ₹{forecast.dailyAvg}</span>
        </div>
      </div>

      {/* Annual Projection */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Annual Cost Projection</h4>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-2xl font-bold text-warning">₹{forecast.projectedAnnual.toLocaleString()}</p>
            <p className="text-[10px] text-muted-foreground">Projected annual spend based on current trend</p>
          </div>
          {forecast.growthRate > 20 && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              <span className="text-[10px] text-destructive font-medium">High growth rate detected</span>
            </div>
          )}
        </div>
      </motion.div>

      {/* Optimization Suggestions */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-warning" /> Cost Optimization Insights
        </h4>
        <div className="space-y-2">
          {forecast.optimizations.map((tip, i) => (
            <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-start gap-2 p-3 rounded-lg bg-secondary/30">
              <span className="text-warning text-xs mt-0.5">💡</span>
              <p className="text-xs text-foreground/80 leading-relaxed">{tip}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  );
}
