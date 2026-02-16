import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { IndianRupee, TrendingUp, Loader2, Zap, BarChart3, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MODEL_COST_MAP: Record<string, number> = {
  "google/gemini-3-flash-preview": 0.15,
  "google/gemini-2.5-flash": 0.10,
  "google/gemini-2.5-flash-lite": 0.05,
  "google/gemini-2.5-pro": 0.50,
  "openai/gpt-5": 1.00,
  "openai/gpt-5-mini": 0.30,
};

const USD_TO_INR = 83;

export default function AICostMonitoring() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalRequests: 0,
    totalTokensIn: 0,
    totalTokensOut: 0,
    estimatedCost: 0,
    costByModel: [] as { model: string; requests: number; cost: number }[],
    dailyCosts: [] as { date: string; cost: number; requests: number }[],
    topCostEdgeFunctions: [] as { name: string; requests: number; cost: number }[],
  });

  useEffect(() => {
    (async () => {
      try {
        const [chatUsageRes, predsRes, apiIntRes] = await Promise.all([
          supabase.from("chat_usage_logs").select("model_used, tokens_input, tokens_output, estimated_cost, created_at").limit(1000),
          supabase.from("model_predictions").select("model_name, created_at").limit(1000),
          supabase.from("api_integrations").select("service_name, monthly_usage_count, monthly_cost_estimate"),
        ]);

        const chatLogs = chatUsageRes.data || [];
        const preds = predsRes.data || [];
        const apis = apiIntRes.data || [];

        const totalTokensIn = chatLogs.reduce((s, l) => s + (l.tokens_input || 0), 0);
        const totalTokensOut = chatLogs.reduce((s, l) => s + (l.tokens_output || 0), 0);

        // Cost by model
        const modelMap = new Map<string, { requests: number; cost: number }>();
        for (const l of chatLogs) {
          const existing = modelMap.get(l.model_used) || { requests: 0, cost: 0 };
          existing.requests++;
          existing.cost += (l.estimated_cost || 0);
          modelMap.set(l.model_used, existing);
        }

        // Add prediction costs (estimated)
        for (const p of preds) {
          const costPerReq = (MODEL_COST_MAP[p.model_name] || 0.05) / USD_TO_INR;
          const existing = modelMap.get(p.model_name) || { requests: 0, cost: 0 };
          existing.requests++;
          existing.cost += costPerReq;
          modelMap.set(p.model_name, existing);
        }

        const costByModel = Array.from(modelMap.entries()).map(([model, v]) => ({
          model,
          requests: v.requests,
          cost: Math.round(v.cost * USD_TO_INR * 100) / 100,
        })).sort((a, b) => b.cost - a.cost);

        const totalCost = costByModel.reduce((s, c) => s + c.cost, 0);

        // Daily costs (last 7 days)
        const dailyMap = new Map<string, { cost: number; requests: number }>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date();
          d.setDate(d.getDate() - i);
          dailyMap.set(d.toISOString().split("T")[0], { cost: 0, requests: 0 });
        }
        for (const l of chatLogs) {
          const day = l.created_at.split("T")[0];
          const existing = dailyMap.get(day);
          if (existing) {
            existing.requests++;
            existing.cost += (l.estimated_cost || 0) * USD_TO_INR;
          }
        }

        // Top cost services
        const topServices = apis.filter(a => a.monthly_cost_estimate).map(a => ({
          name: a.service_name,
          requests: a.monthly_usage_count || 0,
          cost: a.monthly_cost_estimate || 0,
        })).sort((a, b) => b.cost - a.cost).slice(0, 5);

        setData({
          totalRequests: chatLogs.length + preds.length,
          totalTokensIn,
          totalTokensOut,
          estimatedCost: Math.round(totalCost * 100) / 100,
          costByModel,
          dailyCosts: Array.from(dailyMap.entries()).map(([date, v]) => ({ date, ...v })),
          topCostEdgeFunctions: topServices,
        });
      } catch (e) {
        console.error("Cost monitoring fetch failed:", e);
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
          { label: "Total AI Requests", value: data.totalRequests.toLocaleString(), icon: Zap, color: "text-primary" },
          { label: "Tokens In", value: data.totalTokensIn.toLocaleString(), icon: BarChart3, color: "text-accent" },
          { label: "Tokens Out", value: data.totalTokensOut.toLocaleString(), icon: TrendingUp, color: "text-success" },
          { label: "Est. Cost", value: `₹${data.estimatedCost}`, icon: IndianRupee, color: data.estimatedCost > 1000 ? "text-destructive" : "text-warning" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-3 neural-border text-center">
            <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Cost by Model */}
      {data.costByModel.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Cost by Model</h4>
          <div className="space-y-2">
            {data.costByModel.map(m => {
              const maxCost = Math.max(...data.costByModel.map(c => c.cost), 1);
              return (
                <div key={m.model} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-foreground font-medium">{m.model}</span>
                    <span className="text-muted-foreground">{m.requests} reqs · ₹{m.cost}</span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </motion.div>
      )}

      {/* Daily Cost Trend */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">7-Day Cost Trend</h4>
        <div className="flex items-end gap-1 h-20">
          {data.dailyCosts.map((d, i) => {
            const maxCost = Math.max(...data.dailyCosts.map(c => c.cost), 1);
            const height = maxCost > 0 ? (d.cost / maxCost) * 100 : 0;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <div className="w-full bg-primary/80 rounded-t transition-all" style={{ height: `${Math.max(height, 2)}%` }} />
                <span className="text-[8px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Top Cost Services */}
      {data.topCostEdgeFunctions.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="glass rounded-xl neural-border p-4">
          <h4 className="text-xs font-semibold text-foreground mb-3">Top Cost Services</h4>
          <div className="space-y-2">
            {data.topCostEdgeFunctions.map(s => (
              <div key={s.name} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                <span className="text-[10px] text-foreground font-medium">{s.name}</span>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="text-muted-foreground">{s.requests} reqs</span>
                  <span className="text-warning font-bold">₹{s.cost}</span>
                </div>
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </div>
  );
}
