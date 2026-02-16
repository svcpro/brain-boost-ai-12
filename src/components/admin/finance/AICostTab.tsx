import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Brain, IndianRupee, Loader2, TrendingUp, Users, Zap,
  MessageSquare, Mic, Target, Activity, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MODEL_COST_INR: Record<string, number> = {
  "google/gemini-3-flash-preview": 12.45,
  "google/gemini-2.5-flash": 8.30,
  "google/gemini-2.5-flash-lite": 4.15,
  "google/gemini-2.5-pro": 41.50,
  "openai/gpt-5": 83.00,
  "openai/gpt-5-mini": 24.90,
};

const FEATURE_MAP: Record<string, { label: string; icon: any; color: string }> = {
  chat: { label: "AI Chat", icon: MessageSquare, color: "text-primary" },
  prediction: { label: "Predictions", icon: Target, color: "text-accent" },
  voice: { label: "Voice AI", icon: Mic, color: "text-pink-400" },
  brain_agent: { label: "Brain Agent", icon: Brain, color: "text-warning" },
};

export default function AICostTab() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({
    totalAICost: 0,
    todayCost: 0,
    monthlyCost: 0,
    costPerModel: [] as { model: string; requests: number; cost: number; avgCost: number }[],
    costPerUser: [] as { userId: string; requests: number; cost: number }[],
    costPerFeature: [] as { feature: string; requests: number; cost: number }[],
    dailyTrend: [] as { date: string; cost: number; requests: number }[],
  });

  useEffect(() => {
    (async () => {
      try {
        const today = new Date().toISOString().split("T")[0];
        const monthStart = new Date(); monthStart.setDate(1);
        const sevenDaysAgo = new Date(); sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        const [chatRes, predsRes, voiceRes] = await Promise.all([
          supabase.from("chat_usage_logs").select("user_id, model_used, tokens_input, tokens_output, estimated_cost, created_at").limit(1000),
          supabase.from("model_predictions").select("user_id, model_name, latency_ms, created_at").limit(1000),
          supabase.from("chat_usage_logs").select("user_id, estimated_cost, created_at").limit(500),
        ]);

        const chatLogs = chatRes.data || [];
        const preds = predsRes.data || [];

        // Cost per model
        const modelMap = new Map<string, { requests: number; cost: number }>();
        for (const l of chatLogs) {
          const existing = modelMap.get(l.model_used) || { requests: 0, cost: 0 };
          existing.requests++;
          existing.cost += (l.estimated_cost || 0) * 83;
          modelMap.set(l.model_used, existing);
        }
        for (const p of preds) {
          const costPer = (MODEL_COST_INR[p.model_name] || 4) / 1000;
          const existing = modelMap.get(p.model_name) || { requests: 0, cost: 0 };
          existing.requests++;
          existing.cost += costPer;
          modelMap.set(p.model_name, existing);
        }

        const costPerModel = Array.from(modelMap.entries()).map(([model, v]) => ({
          model, requests: v.requests, cost: Math.round(v.cost * 100) / 100, avgCost: v.requests > 0 ? Math.round((v.cost / v.requests) * 1000) / 1000 : 0,
        })).sort((a, b) => b.cost - a.cost);

        // Cost per user (top 20)
        const userMap = new Map<string, { requests: number; cost: number }>();
        for (const l of chatLogs) {
          const existing = userMap.get(l.user_id) || { requests: 0, cost: 0 };
          existing.requests++;
          existing.cost += (l.estimated_cost || 0) * 83;
          userMap.set(l.user_id, existing);
        }
        for (const p of preds) {
          const costPer = (MODEL_COST_INR[p.model_name] || 4) / 1000;
          const existing = userMap.get(p.user_id) || { requests: 0, cost: 0 };
          existing.requests++;
          existing.cost += costPer;
          userMap.set(p.user_id, existing);
        }
        const costPerUser = Array.from(userMap.entries()).map(([userId, v]) => ({
          userId, requests: v.requests, cost: Math.round(v.cost * 100) / 100,
        })).sort((a, b) => b.cost - a.cost).slice(0, 20);

        // Cost per feature
        const featureMap = new Map<string, { requests: number; cost: number }>();
        featureMap.set("chat", { requests: chatLogs.length, cost: chatLogs.reduce((s, l) => s + (l.estimated_cost || 0) * 83, 0) });
        featureMap.set("prediction", { requests: preds.length, cost: preds.reduce((s, p) => s + (MODEL_COST_INR[p.model_name] || 4) / 1000, 0) });

        const costPerFeature = Array.from(featureMap.entries()).map(([feature, v]) => ({
          feature, requests: v.requests, cost: Math.round(v.cost * 100) / 100,
        })).sort((a, b) => b.cost - a.cost);

        // Daily trend (7 days)
        const dailyMap = new Map<string, { cost: number; requests: number }>();
        for (let i = 6; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          dailyMap.set(d.toISOString().split("T")[0], { cost: 0, requests: 0 });
        }
        for (const l of chatLogs) {
          const day = l.created_at.split("T")[0];
          const existing = dailyMap.get(day);
          if (existing) { existing.requests++; existing.cost += (l.estimated_cost || 0) * 83; }
        }
        for (const p of preds) {
          const day = p.created_at.split("T")[0];
          const existing = dailyMap.get(day);
          if (existing) { existing.requests++; existing.cost += (MODEL_COST_INR[p.model_name] || 4) / 1000; }
        }

        const totalCost = costPerModel.reduce((s, m) => s + m.cost, 0);
        const todayKey = today;
        const todayCost = dailyMap.get(todayKey)?.cost || 0;

        setData({
          totalAICost: Math.round(totalCost * 100) / 100,
          todayCost: Math.round(todayCost * 100) / 100,
          monthlyCost: Math.round(totalCost * 100) / 100,
          costPerModel,
          costPerUser,
          costPerFeature,
          dailyTrend: Array.from(dailyMap.entries()).map(([date, v]) => ({
            date, cost: Math.round(v.cost * 100) / 100, requests: v.requests,
          })),
        });
      } catch (e) {
        console.error("AI cost fetch failed:", e);
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
          { label: "Total AI Cost", value: `₹${data.totalAICost.toLocaleString()}`, icon: Brain, color: "text-primary" },
          { label: "Today's AI Cost", value: `₹${data.todayCost}`, icon: IndianRupee, color: "text-warning" },
          { label: "Total AI Requests", value: data.costPerModel.reduce((s, m) => s + m.requests, 0).toLocaleString(), icon: Zap, color: "text-accent" },
          { label: "Unique AI Users", value: data.costPerUser.length, icon: Users, color: "text-success" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <s.icon className={`w-4 h-4 mb-1 ${s.color}`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Daily Trend */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> 7-Day AI Cost Trend
        </h4>
        <div className="flex items-end gap-1 h-24">
          {data.dailyTrend.map((d, i) => {
            const maxCost = Math.max(...data.dailyTrend.map(x => x.cost), 0.01);
            const height = (d.cost / maxCost) * 100;
            return (
              <div key={d.date} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[8px] text-muted-foreground">₹{d.cost}</span>
                <div className="w-full bg-primary/70 rounded-t transition-all" style={{ height: `${Math.max(height, 3)}%` }} />
                <span className="text-[8px] text-muted-foreground">{d.date.slice(5)}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost per Model */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Cost by AI Model</h4>
        <div className="space-y-2">
          {data.costPerModel.map(m => {
            const maxCost = Math.max(...data.costPerModel.map(x => x.cost), 0.01);
            return (
              <div key={m.model} className="space-y-1">
                <div className="flex justify-between text-[10px]">
                  <span className="text-foreground font-medium">{m.model}</span>
                  <span className="text-muted-foreground">{m.requests} reqs · ₹{m.cost} · ₹{m.avgCost}/req</span>
                </div>
                <div className="h-2 bg-secondary rounded-full overflow-hidden">
                  <div className="h-full bg-primary rounded-full" style={{ width: `${(m.cost / maxCost) * 100}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Cost per Feature */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3">Cost by Feature</h4>
        <div className="grid grid-cols-2 gap-3">
          {data.costPerFeature.map(f => {
            const meta = FEATURE_MAP[f.feature] || { label: f.feature, icon: Zap, color: "text-muted-foreground" };
            const FIcon = meta.icon;
            return (
              <div key={f.feature} className="p-3 rounded-xl bg-secondary/30 text-center">
                <FIcon className={`w-5 h-5 mx-auto mb-1 ${meta.color}`} />
                <p className="text-sm font-bold text-foreground">₹{f.cost}</p>
                <p className="text-[10px] text-muted-foreground">{meta.label} · {f.requests} reqs</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Top Cost Users */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <Users className="w-4 h-4 text-warning" /> Top Cost-Consuming Users
        </h4>
        <div className="space-y-1.5">
          {data.costPerUser.slice(0, 10).map((u, i) => (
            <div key={u.userId} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30 text-[10px]">
              <div className="flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[9px]">{i + 1}</span>
                <span className="text-foreground font-medium font-mono">{u.userId.slice(0, 8)}...</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-muted-foreground">{u.requests} reqs</span>
                <span className="text-warning font-bold">₹{u.cost}</span>
              </div>
            </div>
          ))}
          {data.costPerUser.length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No user cost data yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
