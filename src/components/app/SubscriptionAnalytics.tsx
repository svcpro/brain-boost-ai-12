import { useState, useEffect, useMemo } from "react";
import { motion } from "framer-motion";
import { Loader2, TrendingUp, TrendingDown, Users, PieChart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { format, subMonths, startOfMonth, endOfMonth, differenceInDays } from "date-fns";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from "recharts";

interface SubRecord {
  id: string;
  plan_id: string;
  status: string;
  amount: number | null;
  created_at: string;
  expires_at: string | null;
  updated_at: string;
}

interface PlanRecord {
  id: string;
  plan_key: string;
  name: string;
  billing_period: string;
}

const CHART_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
  "hsl(var(--success))",
  "hsl(var(--destructive))",
  "hsl(var(--muted-foreground))",
];

const SubscriptionAnalytics = () => {
  const [subs, setSubs] = useState<SubRecord[]>([]);
  const [plans, setPlans] = useState<PlanRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [subsRes, plansRes] = await Promise.all([
        supabase.from("user_subscriptions").select("id, plan_id, status, amount, created_at, expires_at, updated_at").order("created_at"),
        supabase.from("subscription_plans").select("id, plan_key, name, billing_period"),
      ]);
      setSubs(subsRes.data || []);
      setPlans(plansRes.data || []);
      setLoading(false);
    })();
  }, []);

  const planMap = useMemo(() => {
    const m: Record<string, PlanRecord> = {};
    plans.forEach(p => { m[p.plan_key] = p; m[p.id] = p; });
    return m;
  }, [plans]);

  // MRR over last 6 months
  const mrrData = useMemo(() => {
    const months: { label: string; mrr: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      // Active subs during this month
      const activeSubs = subs.filter(s => {
        const created = new Date(s.created_at);
        const expired = s.expires_at ? new Date(s.expires_at) : null;
        return created <= monthEnd && (!expired || expired >= monthStart) && s.plan_id !== "free" && s.amount;
      });

      const mrr = activeSubs.reduce((sum, s) => sum + (s.amount || 0), 0) / 100;
      months.push({ label: format(date, "MMM yy"), mrr: Math.round(mrr) });
    }
    return months;
  }, [subs]);

  // Churn rate per month (cancelled / active at start)
  const churnData = useMemo(() => {
    const months: { label: string; rate: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const date = subMonths(new Date(), i);
      const monthStart = startOfMonth(date);
      const monthEnd = endOfMonth(date);

      const activeAtStart = subs.filter(s => {
        const created = new Date(s.created_at);
        const expired = s.expires_at ? new Date(s.expires_at) : null;
        return created < monthStart && (!expired || expired >= monthStart) && s.plan_id !== "free";
      }).length;

      const churned = subs.filter(s => {
        if (s.status !== "cancelled" && s.status !== "expired") return false;
        const updated = new Date(s.updated_at);
        return updated >= monthStart && updated <= monthEnd && s.plan_id !== "free";
      }).length;

      const rate = activeAtStart > 0 ? Math.round((churned / activeAtStart) * 100) : 0;
      months.push({ label: format(date, "MMM yy"), rate });
    }
    return months;
  }, [subs]);

  // Plan distribution (current active)
  const planDistribution = useMemo(() => {
    const counts: Record<string, number> = {};
    const activeSubs = subs.filter(s => s.status === "active");
    activeSubs.forEach(s => {
      const name = planMap[s.plan_id]?.name || s.plan_id;
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count);
  }, [subs, planMap]);

  // Summary stats
  const stats = useMemo(() => {
    const activePaid = subs.filter(s => s.status === "active" && s.plan_id !== "free");
    const currentMrr = activePaid.reduce((sum, s) => sum + (s.amount || 0), 0) / 100;
    const totalActive = subs.filter(s => s.status === "active").length;
    const paidPct = totalActive > 0 ? Math.round((activePaid.length / totalActive) * 100) : 0;
    const prevMrr = mrrData.length >= 2 ? mrrData[mrrData.length - 2].mrr : 0;
    const mrrGrowth = prevMrr > 0 ? Math.round(((currentMrr - prevMrr) / prevMrr) * 100) : 0;
    return { currentMrr, activePaid: activePaid.length, totalActive, paidPct, mrrGrowth };
  }, [subs, mrrData]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalDist = planDistribution.reduce((s, d) => s + d.count, 0);

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Current MRR", value: `₹${stats.currentMrr.toLocaleString()}`, icon: TrendingUp, color: "text-success", sub: `${stats.mrrGrowth >= 0 ? "+" : ""}${stats.mrrGrowth}% vs last month` },
          { label: "Paid Subscribers", value: stats.activePaid, icon: Users, color: "text-primary", sub: `${stats.paidPct}% conversion` },
          { label: "Total Active", value: stats.totalActive, icon: Users, color: "text-accent", sub: "All plans" },
          { label: "Latest Churn", value: `${churnData[churnData.length - 1]?.rate || 0}%`, icon: TrendingDown, color: "text-destructive", sub: "This month" },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{c.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{c.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* MRR Trend */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-success" /> Monthly Recurring Revenue (MRR)
        </h3>
        <div className="h-56">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={mrrData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `₹${v}`} />
              <Tooltip
                contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                formatter={(value: number) => [`₹${value.toLocaleString()}`, "MRR"]}
              />
              <Line type="monotone" dataKey="mrr" stroke="hsl(var(--success))" strokeWidth={2.5} dot={{ r: 4, fill: "hsl(var(--success))" }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </motion.div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Churn Rate */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <TrendingDown className="w-4 h-4 text-destructive" /> Monthly Churn Rate
          </h3>
          <div className="h-48">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={churnData}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="label" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} tickFormatter={v => `${v}%`} />
                <Tooltip
                  contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                  formatter={(value: number) => [`${value}%`, "Churn Rate"]}
                />
                <Bar dataKey="rate" radius={[4, 4, 0, 0]}>
                  {churnData.map((_, i) => (
                    <Cell key={i} fill="hsl(var(--destructive))" fillOpacity={0.7} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </motion.div>

        {/* Plan Distribution */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="glass rounded-xl p-5 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" /> Plan Distribution
          </h3>
          {planDistribution.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">No active subscriptions</p>
          ) : (
            <div className="space-y-3">
              {planDistribution.map((d, i) => {
                const pct = totalDist > 0 ? Math.round((d.count / totalDist) * 100) : 0;
                return (
                  <div key={d.name} className="space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-medium text-foreground">{d.name}</span>
                      <span className="text-xs text-muted-foreground">{d.count} ({pct}%)</span>
                    </div>
                    <div className="h-2 rounded-full bg-secondary overflow-hidden">
                      <motion.div
                        className="h-full rounded-full"
                        style={{ backgroundColor: CHART_COLORS[i % CHART_COLORS.length] }}
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.6, delay: i * 0.1 }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>
    </div>
  );
};

export default SubscriptionAnalytics;
