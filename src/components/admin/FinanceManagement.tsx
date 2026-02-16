import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import {
  Loader2, DollarSign, TrendingUp, TrendingDown, CreditCard,
  Activity, BarChart3, PieChart, Wallet, ArrowUpRight, ArrowDownRight,
  RefreshCw, Calendar, Users, Zap, Shield, AlertTriangle, CheckCircle2,
  IndianRupee, Brain, Mail, Mic, Bell, Globe, Clock, Database,
  Receipt, Percent, Target, Landmark, ChevronDown, ChevronRight,
  Filter, Download
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ───
interface SubscriptionRow {
  id: string;
  user_id: string;
  plan_id: string;
  status: string;
  amount: number;
  currency: string;
  created_at: string;
  updated_at: string;
  expires_at: string | null;
  razorpay_order_id: string | null;
  razorpay_payment_id: string | null;
}

interface PlanRow {
  plan_key: string;
  name: string;
  price: number;
  currency: string;
  billing_period: string;
  is_active: boolean;
}

interface ApiCostRow {
  service_name: string;
  display_name: string;
  category: string;
  monthly_cost_estimate: number;
  monthly_usage_count: number;
  usage_limit: number | null;
  is_enabled: boolean;
  usage_reset_at: string | null;
}

const CATEGORY_META: Record<string, { icon: any; color: string; label: string }> = {
  ai: { icon: Brain, color: "text-purple-400", label: "AI / ML" },
  email: { icon: Mail, color: "text-blue-400", label: "Email" },
  voice: { icon: Mic, color: "text-pink-400", label: "Voice" },
  payments: { icon: CreditCard, color: "text-green-400", label: "Payments" },
  notifications: { icon: Bell, color: "text-amber-400", label: "Notifications" },
};

// ─── Main Component ───
const FinanceManagement = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-warning/30 to-success/20 flex items-center justify-center">
              <Landmark className="w-4 h-4 text-warning" />
            </div>
            Finance Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Revenue • API Costs • Subscriptions • Profit & Loss</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
          {[
            { value: "overview", label: "Overview", icon: PieChart },
            { value: "revenue", label: "Revenue", icon: IndianRupee },
            { value: "costs", label: "API Costs", icon: IndianRupee },
            { value: "subscriptions", label: "Subscriptions", icon: CreditCard },
            { value: "transactions", label: "Transactions", icon: Receipt },
            { value: "pnl", label: "P&L Report", icon: BarChart3 },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="revenue"><RevenueTab /></TabsContent>
        <TabsContent value="costs"><CostsTab /></TabsContent>
        <TabsContent value="subscriptions"><SubscriptionsTab /></TabsContent>
        <TabsContent value="transactions"><TransactionsTab /></TabsContent>
        <TabsContent value="pnl"><PnLTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Shared data hook ───
const useFinanceData = () => {
  const [subs, setSubs] = useState<SubscriptionRow[]>([]);
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [apiCosts, setApiCosts] = useState<ApiCostRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [subsRes, plansRes, apiRes] = await Promise.all([
        supabase.from("user_subscriptions").select("*").order("created_at", { ascending: false }),
        supabase.from("subscription_plans").select("plan_key, name, price, currency, billing_period, is_active"),
        supabase.from("api_integrations").select("service_name, display_name, category, monthly_cost_estimate, monthly_usage_count, usage_limit, is_enabled, usage_reset_at"),
      ]);
      setSubs((subsRes.data || []) as SubscriptionRow[]);
      setPlans((plansRes.data || []) as PlanRow[]);
      setApiCosts((apiRes.data || []) as ApiCostRow[]);
      setLoading(false);
    })();
  }, []);

  const activeSubs = subs.filter(s => s.status === "active" && s.plan_id !== "free");
  const mrr = activeSubs.reduce((s, sub) => s + (sub.amount || 0), 0);
  const totalApiCost = apiCosts.reduce((s, a) => s + ((a.monthly_cost_estimate || 0) * 83), 0);
  const totalApiCalls = apiCosts.reduce((s, a) => s + (a.monthly_usage_count || 0), 0);

  return { subs, plans, apiCosts, loading, activeSubs, mrr, totalApiCost, totalApiCalls };
};

// ─── OVERVIEW TAB ───
const OverviewTab = () => {
  const { subs, plans, apiCosts, loading, activeSubs, mrr, totalApiCost, totalApiCalls } = useFinanceData();

  if (loading) return <LoadingSpinner />;

  const netProfit = mrr - totalApiCost;
  const profitMargin = mrr > 0 ? ((netProfit / mrr) * 100) : 0;
  const totalCustomers = new Set(activeSubs.map(s => s.user_id)).size;

  // Plan distribution
  const planDist: Record<string, number> = {};
  activeSubs.forEach(s => { planDist[s.plan_id] = (planDist[s.plan_id] || 0) + 1; });

  // Cost by category
  const costByCat: Record<string, number> = {};
  apiCosts.forEach(a => { costByCat[a.category] = (costByCat[a.category] || 0) + (a.monthly_cost_estimate || 0); });

  // Recent transactions (last 30 days)
  const thirtyDaysAgo = subDays(new Date(), 30);
  const recentSubs = subs.filter(s => new Date(s.created_at) >= thirtyDaysAgo);
  const revenueThisMonth = recentSubs.filter(s => s.status === "active" && s.plan_id !== "free").reduce((s, sub) => s + (sub.amount || 0), 0);

  // Churn (expired in last 30 days)
  const churned = subs.filter(s => s.status === "expired" && s.expires_at && new Date(s.expires_at) >= thirtyDaysAgo).length;
  const churnRate = activeSubs.length > 0 ? ((churned / (activeSubs.length + churned)) * 100) : 0;

  // ARPU
  const arpu = totalCustomers > 0 ? mrr / totalCustomers : 0;

  return (
    <div className="space-y-5 mt-4">
      {/* Hero KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Monthly Revenue (MRR)", value: `₹${mrr.toLocaleString()}`, icon: IndianRupee, color: "text-success", gradient: "from-success/20 to-success/5", sub: `${totalCustomers} paying customers` },
          { label: "API Spend (Monthly)", value: `₹${Math.round(totalApiCost).toLocaleString()}`, icon: Wallet, color: "text-warning", gradient: "from-warning/20 to-warning/5", sub: `${totalApiCalls.toLocaleString()} total calls` },
          { label: "Net Profit", value: `₹${netProfit.toLocaleString()}`, icon: TrendingUp, color: netProfit >= 0 ? "text-success" : "text-destructive", gradient: netProfit >= 0 ? "from-success/20 to-success/5" : "from-destructive/20 to-destructive/5", sub: `${profitMargin.toFixed(1)}% margin` },
          { label: "Churn Rate", value: `${churnRate.toFixed(1)}%`, icon: TrendingDown, color: churnRate > 10 ? "text-destructive" : "text-success", gradient: churnRate > 10 ? "from-destructive/20 to-destructive/5" : "from-success/20 to-success/5", sub: `${churned} churned (30d)` },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`relative overflow-hidden rounded-xl p-4 border border-border bg-gradient-to-br ${card.gradient}`}>
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-background/80 flex items-center justify-center">
                <card.icon className={`w-4 h-4 ${card.color}`} />
              </div>
              <span className="text-[10px] text-muted-foreground font-medium">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{card.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* Secondary KPIs */}
      <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
        {[
          { label: "ARPU", value: `₹${arpu.toFixed(0)}` },
          { label: "Active Plans", value: activeSubs.length },
          { label: "Free Users", value: subs.filter(s => s.plan_id === "free" || s.status !== "active").length },
          { label: "Avg Cost/Call", value: `₹${totalApiCalls > 0 ? (totalApiCost / totalApiCalls).toFixed(2) : "0"}` },
          { label: "New Subs (30d)", value: recentSubs.filter(s => s.plan_id !== "free").length },
          { label: "API Services", value: apiCosts.filter(a => a.is_enabled).length },
        ].map((kpi, i) => (
          <motion.div key={kpi.label} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.03 }}
            className="glass rounded-lg p-3 neural-border text-center">
            <p className="text-[10px] text-muted-foreground font-medium">{kpi.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{kpi.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Plan Distribution */}
        <div className="glass rounded-xl p-4 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <PieChart className="w-4 h-4 text-primary" /> Revenue by Plan
          </h3>
          <div className="space-y-2.5">
            {Object.entries(planDist).map(([planId, count]) => {
              const plan = plans.find(p => p.plan_key === planId);
              const planRevenue = activeSubs.filter(s => s.plan_id === planId).reduce((s, sub) => s + (sub.amount || 0), 0);
              const pct = mrr > 0 ? (planRevenue / mrr) * 100 : 0;
              return (
                <div key={planId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{plan?.name || planId}</span>
                    <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                      <span>{count} users</span>
                      <span className="font-semibold text-foreground">₹{planRevenue.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-primary/60 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(planDist).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No active paid subscriptions</p>
            )}
          </div>
        </div>

        {/* API Cost Distribution */}
        <div className="glass rounded-xl p-4 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <DollarSign className="w-4 h-4 text-warning" /> API Cost by Category (₹)
          </h3>
          <div className="space-y-2.5">
            {Object.entries(costByCat).sort((a, b) => b[1] - a[1]).map(([cat, cost]) => {
              const meta = CATEGORY_META[cat] || CATEGORY_META.ai;
              const CatIcon = meta.icon;
              const pct = totalApiCost > 0 ? (cost / totalApiCost) * 100 : 0;
              return (
                <div key={cat}>
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <CatIcon className={`w-3.5 h-3.5 ${meta.color}`} />
                      <span className="text-xs font-medium text-foreground">{meta.label}</span>
                    </div>
                    <span className="text-xs font-semibold text-foreground">₹{Math.round(cost * 83).toLocaleString()}</span>
                  </div>
                  <div className="h-2 bg-border rounded-full overflow-hidden">
                    <div className="h-full bg-warning/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(costByCat).length === 0 && (
              <p className="text-xs text-muted-foreground text-center py-4">No cost data</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── REVENUE TAB ───
const RevenueTab = () => {
  const { subs, plans, loading, activeSubs, mrr } = useFinanceData();

  if (loading) return <LoadingSpinner />;

  const totalCustomers = new Set(activeSubs.map(s => s.user_id)).size;
  const arpu = totalCustomers > 0 ? mrr / totalCustomers : 0;

  // Monthly revenue trend (last 6 months)
  const monthlyRevenue: { month: string; revenue: number; count: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const monthEnd = endOfMonth(subMonths(new Date(), i));
    const monthSubs = subs.filter(s => {
      const d = new Date(s.created_at);
      return d >= monthStart && d <= monthEnd && s.status === "active" && s.plan_id !== "free";
    });
    monthlyRevenue.push({
      month: format(monthStart, "MMM yy"),
      revenue: monthSubs.reduce((s, sub) => s + (sub.amount || 0), 0),
      count: monthSubs.length,
    });
  }

  const maxRev = Math.max(...monthlyRevenue.map(m => m.revenue), 1);

  // Plan breakdown
  const planBreakdown: { plan: string; name: string; revenue: number; users: number; arpu: number }[] = [];
  const planMap: Record<string, { revenue: number; users: Set<string> }> = {};
  activeSubs.forEach(s => {
    if (!planMap[s.plan_id]) planMap[s.plan_id] = { revenue: 0, users: new Set() };
    planMap[s.plan_id].revenue += s.amount || 0;
    planMap[s.plan_id].users.add(s.user_id);
  });
  Object.entries(planMap).forEach(([planId, data]) => {
    const plan = plans.find(p => p.plan_key === planId);
    planBreakdown.push({
      plan: planId,
      name: plan?.name || planId,
      revenue: data.revenue,
      users: data.users.size,
      arpu: data.users.size > 0 ? data.revenue / data.users.size : 0,
    });
  });
  planBreakdown.sort((a, b) => b.revenue - a.revenue);

  return (
    <div className="space-y-5 mt-4">
      {/* Revenue KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "MRR", value: `₹${mrr.toLocaleString()}`, icon: IndianRupee, color: "text-success" },
          { label: "ARR (Projected)", value: `₹${(mrr * 12).toLocaleString()}`, icon: TrendingUp, color: "text-primary" },
          { label: "ARPU", value: `₹${arpu.toFixed(0)}`, icon: Users, color: "text-accent" },
          { label: "Paying Customers", value: totalCustomers, icon: CreditCard, color: "text-warning" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Monthly Revenue Trend */}
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-success" /> Revenue Trend (6 Months)
        </h3>
        <div className="flex items-end gap-2 h-40">
          {monthlyRevenue.map((m, i) => {
            const height = (m.revenue / maxRev) * 100;
            return (
              <div key={m.month} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-[9px] text-muted-foreground font-medium">₹{m.revenue.toLocaleString()}</span>
                <motion.div
                  initial={{ height: 0 }} animate={{ height: `${Math.max(height, 4)}%` }}
                  transition={{ duration: 0.5, delay: i * 0.08 }}
                  className="w-full rounded-t-lg bg-gradient-to-t from-success/60 to-success/30 min-h-[4px]"
                />
                <span className="text-[10px] text-muted-foreground">{m.month}</span>
                <span className="text-[9px] text-muted-foreground">{m.count} subs</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Plan Revenue Breakdown */}
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" /> Revenue by Plan
        </h3>
        {planBreakdown.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center py-6">No revenue data</p>
        ) : (
          <div className="space-y-3">
            {planBreakdown.map(p => (
              <div key={p.plan} className="p-3 rounded-xl bg-secondary/30">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-foreground">{p.name}</span>
                  <span className="text-sm font-bold text-success">₹{p.revenue.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>{p.users} customers</span>
                  <span>ARPU: ₹{p.arpu.toFixed(0)}</span>
                  <span>{mrr > 0 ? ((p.revenue / mrr) * 100).toFixed(1) : 0}% of MRR</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

// ─── COSTS TAB ───
const CostsTab = () => {
  const { apiCosts, loading, totalApiCost, totalApiCalls } = useFinanceData();

  if (loading) return <LoadingSpinner />;

  const avgCostPerCall = totalApiCalls > 0 ? totalApiCost / totalApiCalls : 0;
  const maxCost = Math.max(...apiCosts.map(a => a.monthly_cost_estimate || 0), 0.01);

  // Category breakdown
  const catBreakdown: Record<string, { cost: number; calls: number; services: number }> = {};
  apiCosts.forEach(a => {
    if (!catBreakdown[a.category]) catBreakdown[a.category] = { cost: 0, calls: 0, services: 0 };
    catBreakdown[a.category].cost += a.monthly_cost_estimate || 0;
    catBreakdown[a.category].calls += a.monthly_usage_count || 0;
    catBreakdown[a.category].services++;
  });

  return (
    <div className="space-y-5 mt-4">
      {/* Cost KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Monthly Spend", value: `₹${Math.round(totalApiCost).toLocaleString()}`, icon: IndianRupee, color: "text-warning" },
          { label: "Annual Projection", value: `₹${Math.round(totalApiCost * 12).toLocaleString()}`, icon: TrendingUp, color: "text-destructive" },
          { label: "Total API Calls", value: totalApiCalls.toLocaleString(), icon: Activity, color: "text-primary" },
          { label: "Avg Cost / Call", value: `₹${(avgCostPerCall).toFixed(3)}`, icon: Target, color: "text-accent" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Category Cost Breakdown */}
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-warning" /> Cost by Category
        </h3>
        <div className="space-y-3">
          {Object.entries(catBreakdown).sort((a, b) => b[1].cost - a[1].cost).map(([cat, data]) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.ai;
            const CatIcon = meta.icon;
            const pct = totalApiCost > 0 ? (data.cost / totalApiCost) * 100 : 0;
            return (
              <div key={cat} className="p-3 rounded-xl bg-secondary/30">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <CatIcon className={`w-4 h-4 ${meta.color}`} />
                    <span className="text-sm font-medium text-foreground">{meta.label}</span>
                  </div>
                  <span className="text-sm font-bold text-foreground">₹{Math.round(data.cost * 83).toLocaleString()}</span>
                </div>
                <div className="h-2 bg-border rounded-full overflow-hidden mb-1.5">
                  <div className="h-full bg-warning/50 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                  <span>{data.services} services</span>
                  <span>{data.calls.toLocaleString()} calls</span>
                  <span>{pct.toFixed(1)}% of total</span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Service Cost Table */}
      <div className="glass rounded-xl neural-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Database className="w-4 h-4 text-accent" /> Per-Service Breakdown
          </h3>
        </div>
        <div className="divide-y divide-border/50">
          {apiCosts.sort((a, b) => (b.monthly_cost_estimate || 0) - (a.monthly_cost_estimate || 0)).map(s => {
            const cat = CATEGORY_META[s.category] || CATEGORY_META.ai;
            const costPerCall = s.monthly_usage_count > 0 ? s.monthly_cost_estimate / s.monthly_usage_count : 0;
            const pct = maxCost > 0 ? ((s.monthly_cost_estimate || 0) / maxCost) * 100 : 0;
            return (
              <div key={s.service_name} className="px-4 py-3">
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${s.is_enabled ? "bg-success" : "bg-muted-foreground"}`} />
                    <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    <span className="text-xs font-medium text-foreground">{s.display_name}</span>
                  </div>
                  <span className="text-xs font-bold text-foreground">₹{Math.round((s.monthly_cost_estimate || 0) * 83).toLocaleString()}</span>
                </div>
                <div className="h-1 bg-border rounded-full overflow-hidden mb-1">
                  <div className="h-full bg-warning/40 rounded-full" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>{(s.monthly_usage_count || 0).toLocaleString()} calls</span>
                  <span>₹{(costPerCall * 83).toFixed(3)}/call</span>
                  {s.usage_limit && (
                    <span className={s.monthly_usage_count / s.usage_limit > 0.8 ? "text-destructive font-medium" : ""}>
                      {((s.monthly_usage_count / s.usage_limit) * 100).toFixed(0)}% quota
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── SUBSCRIPTIONS TAB ───
const SubscriptionsTab = () => {
  const { subs, plans, loading, activeSubs, mrr } = useFinanceData();

  if (loading) return <LoadingSpinner />;

  const thirtyDaysAgo = subDays(new Date(), 30);

  // Status distribution
  const statusDist: Record<string, number> = {};
  subs.forEach(s => { statusDist[s.status] = (statusDist[s.status] || 0) + 1; });

  // Churn
  const churned = subs.filter(s => s.status === "expired" && s.expires_at && new Date(s.expires_at) >= thirtyDaysAgo).length;
  const churnRate = activeSubs.length > 0 ? ((churned / (activeSubs.length + churned)) * 100) : 0;

  // Upcoming expirations
  const upcoming = subs.filter(s => s.status === "active" && s.expires_at && new Date(s.expires_at) <= subDays(new Date(), -7)).slice(0, 10);
  const expiringSoon = subs.filter(s => {
    if (s.status !== "active" || !s.expires_at) return false;
    const exp = new Date(s.expires_at);
    return exp > new Date() && exp <= subDays(new Date(), -30);
  });

  // LTV estimate
  const avgSubDuration = activeSubs.length > 0
    ? activeSubs.reduce((s, sub) => {
        const created = new Date(sub.created_at).getTime();
        const now = Date.now();
        return s + (now - created) / (1000 * 60 * 60 * 24 * 30); // months
      }, 0) / activeSubs.length
    : 0;
  const arpu = activeSubs.length > 0 ? mrr / new Set(activeSubs.map(s => s.user_id)).size : 0;
  const estimatedLTV = arpu * Math.max(avgSubDuration, 1);

  const statusColors: Record<string, string> = {
    active: "text-success bg-success/15",
    expired: "text-destructive bg-destructive/15",
    cancelled: "text-warning bg-warning/15",
    pending: "text-muted-foreground bg-muted/15",
  };

  return (
    <div className="space-y-5 mt-4">
      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Subscriptions", value: activeSubs.length, icon: CheckCircle2, color: "text-success" },
          { label: "Churn Rate (30d)", value: `${churnRate.toFixed(1)}%`, icon: TrendingDown, color: churnRate > 10 ? "text-destructive" : "text-success" },
          { label: "Est. LTV", value: `₹${estimatedLTV.toFixed(0)}`, icon: Target, color: "text-accent" },
          { label: "Expiring Soon", value: expiringSoon.length, icon: AlertTriangle, color: expiringSoon.length > 5 ? "text-warning" : "text-success" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{card.label}</span>
            </div>
            <p className="text-2xl font-bold text-foreground">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Status Distribution */}
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" /> Subscription Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {Object.entries(statusDist).map(([status, count]) => (
            <div key={status} className="p-3 rounded-xl bg-secondary/30 text-center">
              <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[status] || "text-muted-foreground bg-muted/15"}`}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </span>
              <p className="text-2xl font-bold text-foreground mt-2">{count}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Plan Distribution Table */}
      <div className="glass rounded-xl neural-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Plan Distribution</h3>
        </div>
        <div className="divide-y divide-border/50">
          {plans.filter(p => p.is_active).map(plan => {
            const count = activeSubs.filter(s => s.plan_id === plan.plan_key).length;
            const revenue = activeSubs.filter(s => s.plan_id === plan.plan_key).reduce((s, sub) => s + (sub.amount || 0), 0);
            return (
              <div key={plan.plan_key} className="flex items-center justify-between px-4 py-3">
                <div>
                  <p className="text-sm font-medium text-foreground">{plan.name}</p>
                  <p className="text-[10px] text-muted-foreground">₹{plan.price} / {plan.billing_period}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-foreground">{count} active</p>
                  <p className="text-[10px] text-success font-medium">₹{revenue.toLocaleString()} MRR</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── TRANSACTIONS TAB ───
const TransactionsTab = () => {
  const { subs, loading } = useFinanceData();

  if (loading) return <LoadingSpinner />;

  const statusColors: Record<string, string> = {
    active: "text-success bg-success/15",
    expired: "text-destructive bg-destructive/15",
    cancelled: "text-warning bg-warning/15",
    pending: "text-muted-foreground bg-muted/15",
  };

  return (
    <div className="space-y-4 mt-4">
      <div className="glass rounded-xl neural-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-1 flex items-center gap-2">
          <Receipt className="w-4 h-4 text-primary" /> Transaction History
        </h3>
        <p className="text-[11px] text-muted-foreground mb-4">All subscription transactions with Razorpay payment details</p>
      </div>

      <div className="glass rounded-xl neural-border overflow-hidden">
        <div className="divide-y divide-border/50">
          {subs.slice(0, 50).map((tx, i) => (
            <motion.div key={tx.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.02 }}
              className="px-4 py-3 hover:bg-secondary/20 transition-colors">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[tx.status] || "text-muted-foreground bg-muted/15"}`}>
                    {tx.status}
                  </span>
                  <span className="text-xs font-medium text-foreground">{tx.plan_id}</span>
                </div>
                <span className="text-sm font-bold text-foreground">
                  {tx.amount > 0 ? `₹${tx.amount.toLocaleString()}` : "Free"}
                </span>
              </div>
              <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                <span>{format(new Date(tx.created_at), "MMM d, yyyy HH:mm")}</span>
                <div className="flex items-center gap-3">
                  {tx.razorpay_payment_id && (
                    <span className="font-mono">{tx.razorpay_payment_id.substring(0, 16)}...</span>
                  )}
                  {tx.expires_at && (
                    <span>Expires: {format(new Date(tx.expires_at), "MMM d, yyyy")}</span>
                  )}
                </div>
              </div>
            </motion.div>
          ))}
          {subs.length === 0 && (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">No transactions found</div>
          )}
        </div>
      </div>
    </div>
  );
};

// ─── P&L TAB ───
const PnLTab = () => {
  const { subs, apiCosts, plans, loading, activeSubs, mrr, totalApiCost, totalApiCalls } = useFinanceData();

  if (loading) return <LoadingSpinner />;

  const totalCustomers = new Set(activeSubs.map(s => s.user_id)).size;
  const netProfit = mrr - totalApiCost;
  const profitMargin = mrr > 0 ? ((netProfit / mrr) * 100) : 0;

  // Monthly P&L (last 6 months)
  const monthlyPnL: { month: string; revenue: number; cost: number; profit: number }[] = [];
  for (let i = 5; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(new Date(), i));
    const monthEnd = endOfMonth(subMonths(new Date(), i));
    const monthRevenue = subs.filter(s => {
      const d = new Date(s.created_at);
      return d >= monthStart && d <= monthEnd && s.status === "active" && s.plan_id !== "free";
    }).reduce((s, sub) => s + (sub.amount || 0), 0);
    // API cost is monthly, distribute evenly
    const monthCost = totalApiCost;
    monthlyPnL.push({
      month: format(monthStart, "MMM yy"),
      revenue: monthRevenue,
      cost: monthCost,
      profit: monthRevenue - monthCost,
    });
  }

  // Unit economics
  const costPerCustomer = totalCustomers > 0 ? totalApiCost / totalCustomers : 0;
  const revenuePerCustomer = totalCustomers > 0 ? mrr / totalCustomers : 0;
  const customerMargin = revenuePerCustomer - costPerCustomer;

  return (
    <div className="space-y-5 mt-4">
      {/* P&L Summary */}
      <div className="glass rounded-2xl p-6 neural-border">
        <h3 className="text-lg font-bold text-foreground mb-5 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-primary" /> Profit & Loss Statement
        </h3>
        <div className="space-y-3">
          {/* Revenue */}
          <div className="p-4 rounded-xl bg-success/5 border border-success/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowUpRight className="w-4 h-4 text-success" />
                <span className="text-sm font-semibold text-foreground">Total Revenue (MRR)</span>
              </div>
              <span className="text-xl font-bold text-success">₹{mrr.toLocaleString()}</span>
            </div>
            <div className="mt-2 grid grid-cols-3 gap-2 text-[10px] text-muted-foreground">
              <span>{totalCustomers} customers</span>
              <span>ARPU: ₹{revenuePerCustomer.toFixed(0)}</span>
              <span>ARR: ₹{(mrr * 12).toLocaleString()}</span>
            </div>
          </div>

          {/* Costs */}
          <div className="p-4 rounded-xl bg-destructive/5 border border-destructive/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ArrowDownRight className="w-4 h-4 text-destructive" />
                <span className="text-sm font-semibold text-foreground">Total Costs (API Spend)</span>
              </div>
              <span className="text-xl font-bold text-destructive">₹{Math.round(totalApiCost).toLocaleString()}</span>
            </div>
            <div className="mt-2 space-y-1">
              {apiCosts.filter(a => a.monthly_cost_estimate > 0).map(a => (
                <div key={a.service_name} className="flex items-center justify-between text-[10px]">
                  <span className="text-muted-foreground">{a.display_name}</span>
                  <span className="text-foreground font-medium">₹{Math.round(a.monthly_cost_estimate * 83).toLocaleString()}</span>
                </div>
              ))}
              {apiCosts.every(a => a.monthly_cost_estimate === 0) && (
                <p className="text-[10px] text-muted-foreground">No API costs recorded yet</p>
              )}
            </div>
          </div>

          {/* Net Profit */}
          <div className={`p-4 rounded-xl border ${netProfit >= 0 ? "bg-success/10 border-success/30" : "bg-destructive/10 border-destructive/30"}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Landmark className={`w-4 h-4 ${netProfit >= 0 ? "text-success" : "text-destructive"}`} />
                <span className="text-sm font-semibold text-foreground">Net Profit</span>
              </div>
              <span className={`text-2xl font-bold ${netProfit >= 0 ? "text-success" : "text-destructive"}`}>
                ₹{netProfit.toLocaleString()}
              </span>
            </div>
            <div className="mt-2 flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>Margin: {profitMargin.toFixed(1)}%</span>
              <span>Cost/Customer: ₹{Math.round(costPerCustomer).toLocaleString()}</span>
              <span>Net/Customer: ₹{customerMargin.toFixed(0)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Monthly P&L Chart */}
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-accent" /> Monthly P&L Trend
        </h3>
        <div className="space-y-2">
          {monthlyPnL.map((m, i) => (
            <motion.div key={m.month} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30">
              <span className="text-xs font-medium text-foreground w-16">{m.month}</span>
              <div className="flex-1 flex items-center gap-2 text-[10px]">
                <span className="text-success font-medium">↑ ₹{m.revenue.toLocaleString()}</span>
                <span className="text-destructive font-medium">↓ ₹{Math.round(m.cost).toLocaleString()}</span>
              </div>
              <span className={`text-xs font-bold ${m.profit >= 0 ? "text-success" : "text-destructive"}`}>
                ₹{m.profit.toLocaleString()}
              </span>
            </motion.div>
          ))}
        </div>
      </div>

      {/* Unit Economics */}
      <div className="glass rounded-xl p-5 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <Target className="w-4 h-4 text-warning" /> Unit Economics
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: "Revenue / Customer", value: `₹${revenuePerCustomer.toFixed(0)}` },
            { label: "Cost / Customer", value: `₹${Math.round(costPerCustomer).toLocaleString()}` },
            { label: "Margin / Customer", value: `₹${Math.round(customerMargin).toLocaleString()}` },
            { label: "Cost / API Call", value: `₹${totalApiCalls > 0 ? (totalApiCost / totalApiCalls).toFixed(3) : "0"}` },
          ].map(u => (
            <div key={u.label} className="p-3 rounded-xl bg-secondary/30 text-center">
              <p className="text-[10px] text-muted-foreground font-medium">{u.label}</p>
              <p className="text-lg font-bold text-foreground mt-1">{u.value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ─── Loading Spinner ───
const LoadingSpinner = () => (
  <div className="flex justify-center py-12">
    <Loader2 className="w-5 h-5 animate-spin text-primary" />
  </div>
);

export default FinanceManagement;
