import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Users, Loader2, Brain, MessageSquare, Database, IndianRupee, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

const MODEL_COST_INR: Record<string, number> = {
  "google/gemini-3-flash-preview": 12.45,
  "google/gemini-2.5-flash": 8.30,
  "google/gemini-2.5-flash-lite": 4.15,
  "google/gemini-2.5-pro": 41.50,
};

interface UserCost {
  userId: string;
  displayName: string;
  chatCost: number;
  predictionCost: number;
  storageCost: number;
  totalCost: number;
  chatRequests: number;
  predictionRequests: number;
}

export default function UserCostTab() {
  const [loading, setLoading] = useState(true);
  const [users, setUsers] = useState<UserCost[]>([]);
  const [sortBy, setSortBy] = useState<"totalCost" | "chatCost" | "predictionCost">("totalCost");

  useEffect(() => {
    (async () => {
      try {
        const [chatRes, predsRes, profilesRes, storageRes] = await Promise.all([
          supabase.from("chat_usage_logs").select("user_id, estimated_cost").limit(1000),
          supabase.from("model_predictions").select("user_id, model_name").limit(1000),
          supabase.from("profiles").select("id, display_name").limit(500),
          supabase.from("topics").select("user_id").limit(1000),
        ]);

        const chatLogs = chatRes.data || [];
        const preds = predsRes.data || [];
        const profiles = profilesRes.data || [];
        const topics = storageRes.data || [];

        const userMap = new Map<string, UserCost>();
        const getUser = (uid: string) => {
          if (!userMap.has(uid)) {
            const profile = profiles.find(p => p.id === uid);
            userMap.set(uid, {
              userId: uid,
              displayName: profile?.display_name || uid.slice(0, 8),
              chatCost: 0, predictionCost: 0, storageCost: 0, totalCost: 0,
              chatRequests: 0, predictionRequests: 0,
            });
          }
          return userMap.get(uid)!;
        };

        for (const l of chatLogs) {
          const u = getUser(l.user_id);
          u.chatCost += (l.estimated_cost || 0) * 83;
          u.chatRequests++;
        }

        for (const p of preds) {
          const u = getUser(p.user_id);
          u.predictionCost += (MODEL_COST_INR[p.model_name] || 4) / 1000;
          u.predictionRequests++;
        }

        // Storage cost estimate: topics count * avg storage per topic
        const topicsByUser = new Map<string, number>();
        for (const t of topics) { topicsByUser.set(t.user_id, (topicsByUser.get(t.user_id) || 0) + 1); }
        for (const [uid, count] of topicsByUser) {
          const u = getUser(uid);
          u.storageCost = Math.round(count * 0.05 * 100) / 100; // ₹0.05 per topic estimate
        }

        // Calculate totals
        for (const u of userMap.values()) {
          u.chatCost = Math.round(u.chatCost * 100) / 100;
          u.predictionCost = Math.round(u.predictionCost * 100) / 100;
          u.totalCost = Math.round((u.chatCost + u.predictionCost + u.storageCost) * 100) / 100;
        }

        setUsers(Array.from(userMap.values()).sort((a, b) => b.totalCost - a.totalCost));
      } catch (e) {
        console.error("User cost fetch failed:", e);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const sorted = [...users].sort((a, b) => b[sortBy] - a[sortBy]);
  const totalPlatformCost = users.reduce((s, u) => s + u.totalCost, 0);
  const avgCostPerUser = users.length > 0 ? totalPlatformCost / users.length : 0;
  const expensiveUsers = users.filter(u => u.totalCost > avgCostPerUser * 2);

  return (
    <div className="space-y-5 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Users Tracked", value: users.length, icon: Users, color: "text-primary" },
          { label: "Total Cost", value: `₹${Math.round(totalPlatformCost)}`, icon: IndianRupee, color: "text-warning" },
          { label: "Avg Cost/User", value: `₹${avgCostPerUser.toFixed(2)}`, icon: Brain, color: "text-accent" },
          { label: "High-Cost Users", value: expensiveUsers.length, icon: AlertTriangle, color: expensiveUsers.length > 5 ? "text-destructive" : "text-success" },
        ].map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <s.icon className={`w-4 h-4 mb-1 ${s.color}`} />
            <p className={`text-xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Sort Controls */}
      <div className="flex gap-2">
        {[
          { key: "totalCost", label: "Total Cost" },
          { key: "chatCost", label: "Chat Cost" },
          { key: "predictionCost", label: "Prediction Cost" },
        ].map(s => (
          <button key={s.key} onClick={() => setSortBy(s.key as any)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${sortBy === s.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            {s.label}
          </button>
        ))}
      </div>

      {/* User Cost Table */}
      <div className="glass rounded-xl neural-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {sorted.slice(0, 30).map((u, i) => (
            <motion.div key={u.userId} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
              className="px-4 py-3 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className="w-6 h-6 rounded-full bg-primary/20 flex items-center justify-center text-primary font-bold text-[10px]">{i + 1}</span>
                  <span className="text-sm font-medium text-foreground">{u.displayName}</span>
                  {u.totalCost > avgCostPerUser * 2 && <AlertTriangle className="w-3 h-3 text-warning" />}
                </div>
                <span className="text-sm font-bold text-warning">₹{u.totalCost}</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] text-muted-foreground ml-8">
                <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" /> Chat: ₹{u.chatCost} ({u.chatRequests})</span>
                <span className="flex items-center gap-1"><Brain className="w-3 h-3" /> AI: ₹{u.predictionCost} ({u.predictionRequests})</span>
                <span className="flex items-center gap-1"><Database className="w-3 h-3" /> Storage: ₹{u.storageCost}</span>
              </div>
            </motion.div>
          ))}
          {users.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">No user cost data yet</div>
          )}
        </div>
      </div>
    </div>
  );
}
