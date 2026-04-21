import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import {
  CheckCircle2, AlertTriangle, RefreshCw, Database, Crown, Zap,
  Users, Clock, ShieldCheck, ArrowRight, Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PlanRow {
  id: string;
  plan_key: string;
  name: string;
  tier_level: number;
  is_active: boolean;
  price: number;
  yearly_price: number;
  trial_days: number;
}

interface SubRow {
  plan_id: string | null;
  status: string;
  is_trial: boolean;
  billing_cycle: string | null;
}

// Known legacy plan keys (string literals stored as plan_id) and how the gating hook maps them
const LEGACY_KEY_MAP: Record<string, { mappedTo: string; reason: string }> = {
  pro: { mappedTo: "premium", reason: "Old 'pro' tier merged into Premium" },
  ultra: { mappedTo: "premium", reason: "Old 'ultra' tier merged into Premium" },
  free: { mappedTo: "none", reason: "Free tier deprecated; treated as expired" },
};

const TIER_META: Record<string, { color: string; bg: string; icon: any }> = {
  starter: { color: "#00E5FF", bg: "linear-gradient(135deg,#00E5FF22,#7C4DFF22)", icon: Zap },
  premium: { color: "#FFD700", bg: "linear-gradient(135deg,#FFD70022,#FF850022)", icon: Crown },
};

const SubscriptionMigrationWidget = () => {
  const [plans, setPlans] = useState<PlanRow[]>([]);
  const [subs, setSubs] = useState<SubRow[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    setLoading(true);
    const [{ data: planData }, { data: subData }] = await Promise.all([
      supabase
        .from("subscription_plans")
        .select("id, plan_key, name, tier_level, is_active, price, yearly_price, trial_days")
        .order("tier_level"),
      supabase
        .from("user_subscriptions")
        .select("plan_id, status, is_trial, billing_cycle"),
    ]);
    setPlans((planData as PlanRow[]) || []);
    setSubs((subData as SubRow[]) || []);
    setLoading(false);
  };

  useEffect(() => { fetchAll(); }, []);

  // Build lookup: plan_id (UUID) -> plan row
  const planById = useMemo(() => {
    const m: Record<string, PlanRow> = {};
    plans.forEach(p => { m[p.id] = p; m[p.plan_key] = p; });
    return m;
  }, [plans]);

  const stats = useMemo(() => {
    const active = subs.filter(s => s.status === "active");
    const byPlanKey: Record<string, { total: number; trial: number; paid: number; monthly: number; yearly: number }> = {};
    const legacyHits: Record<string, number> = {};
    let unmapped = 0;

    active.forEach(s => {
      const raw = s.plan_id || "";
      let key = "unknown";
      const matched = planById[raw];

      if (matched) {
        // Normalize legacy keys per gating hook: pro/ultra → premium
        key = matched.plan_key === "pro" || matched.plan_key === "ultra" ? "premium" : matched.plan_key;
      } else if (LEGACY_KEY_MAP[raw]) {
        key = LEGACY_KEY_MAP[raw].mappedTo;
        legacyHits[raw] = (legacyHits[raw] || 0) + 1;
      } else {
        unmapped += 1;
      }

      if (!byPlanKey[key]) byPlanKey[key] = { total: 0, trial: 0, paid: 0, monthly: 0, yearly: 0 };
      byPlanKey[key].total += 1;
      if (s.is_trial) byPlanKey[key].trial += 1; else byPlanKey[key].paid += 1;
      if (s.billing_cycle === "yearly") byPlanKey[key].yearly += 1;
      else byPlanKey[key].monthly += 1;
    });

    const totalActive = active.length;
    const totalTrials = active.filter(s => s.is_trial).length;
    const legacyTotal = Object.values(legacyHits).reduce((a, b) => a + b, 0);

    // Migration health = % of active subs that point to a current (is_active) plan UUID
    const onCurrentPlans = active.filter(s => {
      const p = planById[s.plan_id || ""];
      return p?.is_active === true;
    }).length;
    const migrationPct = totalActive > 0 ? Math.round((onCurrentPlans / totalActive) * 100) : 100;

    return { byPlanKey, legacyHits, unmapped, totalActive, totalTrials, legacyTotal, migrationPct };
  }, [subs, planById]);

  const healthColor = stats.migrationPct >= 95 ? "#10b981" : stats.migrationPct >= 80 ? "#facc15" : "#ef4444";
  const healthLabel = stats.migrationPct >= 95 ? "Healthy" : stats.migrationPct >= 80 ? "Needs Attention" : "Critical";

  if (loading) {
    return (
      <Card>
        <CardContent className="flex justify-center py-10">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header card with health score */}
      <Card className="overflow-hidden">
        <div className="h-[2px]" style={{ background: `linear-gradient(90deg, ${healthColor}, ${healthColor}66)` }} />
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Database className="w-4 h-4 text-primary" />
                Subscription Migration Status
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Real-time health of plan ID mappings and active subscribers
              </CardDescription>
            </div>
            <Button variant="outline" size="sm" onClick={fetchAll} className="h-7 text-[10px]">
              <RefreshCw className="w-3 h-3 mr-1" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-4 gap-3">
            {/* Migration health */}
            <motion.div
              className="rounded-xl p-3 col-span-2"
              style={{ background: `${healthColor}10`, border: `1px solid ${healthColor}33` }}
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <ShieldCheck className="w-3 h-3" style={{ color: healthColor }} />
                <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color: healthColor }}>
                  Migration Health
                </span>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black tabular-nums" style={{ color: healthColor }}>
                  {stats.migrationPct}%
                </span>
                <span className="text-[10px] font-semibold" style={{ color: healthColor }}>{healthLabel}</span>
              </div>
              <div className="text-[9px] text-muted-foreground mt-1">
                of active subs on current plan UUIDs
              </div>
            </motion.div>

            <StatCell icon={Users} label="Total Active" value={stats.totalActive} color="#00E5FF" />
            <StatCell icon={Clock} label="On Trial" value={stats.totalTrials} color="#FFD700" />
          </div>
        </CardContent>
      </Card>

      {/* Active subs by plan */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2">
            <Crown className="w-4 h-4 text-primary" /> Active Subscribers by Plan
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {Object.entries(stats.byPlanKey).length === 0 && (
            <p className="text-xs text-muted-foreground text-center py-4">No active subscriptions yet</p>
          )}
          {Object.entries(stats.byPlanKey)
            .sort((a, b) => b[1].total - a[1].total)
            .map(([key, data]) => {
              const meta = TIER_META[key] || { color: "#94a3b8", bg: "rgba(255,255,255,0.04)", icon: Users };
              const Icon = meta.icon;
              const planRow = plans.find(p => p.plan_key === key);
              return (
                <div
                  key={key}
                  className="rounded-xl p-3 border"
                  style={{ background: meta.bg, borderColor: `${meta.color}33` }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Icon className="w-4 h-4" style={{ color: meta.color }} />
                      <span className="text-sm font-bold capitalize">{planRow?.name || key}</span>
                      {planRow && (
                        <span className="text-[10px] text-muted-foreground">
                          ₹{planRow.price}/mo · ₹{planRow.yearly_price}/yr
                        </span>
                      )}
                    </div>
                    <span className="text-2xl font-black tabular-nums" style={{ color: meta.color }}>
                      {data.total}
                    </span>
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-[10px]">
                    <BreakdownPill label="Trial" value={data.trial} color="#FFD700" />
                    <BreakdownPill label="Paid" value={data.paid} color="#10b981" />
                    <BreakdownPill label="Monthly" value={data.monthly} color="#00E5FF" />
                    <BreakdownPill label="Yearly" value={data.yearly} color="#7C4DFF" />
                  </div>
                </div>
              );
            })}
        </CardContent>
      </Card>

      {/* Legacy mappings */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" /> Legacy Plan ID Mappings
            </CardTitle>
            {stats.legacyTotal === 0 && stats.unmapped === 0 ? (
              <Badge variant="outline" className="text-emerald-500 border-emerald-500/30">
                <CheckCircle2 className="w-3 h-3 mr-1" /> All clean
              </Badge>
            ) : (
              <Badge variant="outline" className="text-amber-500 border-amber-500/30">
                {stats.legacyTotal + stats.unmapped} edge cases
              </Badge>
            )}
          </div>
          <CardDescription className="text-xs">
            How the gating layer normalizes deprecated plan keys at runtime
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {/* Static rules (always show so admins know the contract) */}
          {Object.entries(LEGACY_KEY_MAP).map(([from, { mappedTo, reason }]) => {
            const hits = stats.legacyHits[from] || 0;
            return (
              <div key={from} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30">
                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-background/50 text-amber-400">
                  {from}
                </code>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-background/50 text-emerald-400">
                  {mappedTo}
                </code>
                <span className="text-[10px] text-muted-foreground flex-1 truncate">{reason}</span>
                <Badge variant={hits > 0 ? "default" : "outline"} className="text-[10px] shrink-0">
                  {hits} active
                </Badge>
              </div>
            );
          })}

          {/* Deprecated plan UUIDs still referenced */}
          {plans.filter(p => !p.is_active).map(p => {
            const hits = subs.filter(s => s.status === "active" && s.plan_id === p.id).length;
            if (hits === 0) return null;
            return (
              <div key={p.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-amber-500/5 border border-amber-500/20">
                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-background/50 text-amber-400 truncate max-w-[140px]">
                  {p.id.slice(0, 8)}…
                </code>
                <ArrowRight className="w-3 h-3 text-muted-foreground shrink-0" />
                <code className="text-[11px] font-mono px-2 py-0.5 rounded bg-background/50 text-emerald-400">
                  {p.plan_key === "pro" || p.plan_key === "ultra" ? "premium" : "none"}
                </code>
                <span className="text-[10px] text-muted-foreground flex-1 truncate">
                  Inactive plan "{p.name}" still has live subs
                </span>
                <Badge variant="default" className="text-[10px] shrink-0 bg-amber-500/20 text-amber-300">
                  {hits} active
                </Badge>
              </div>
            );
          })}

          {stats.unmapped > 0 && (
            <div className="flex items-center gap-3 p-2.5 rounded-lg bg-destructive/10 border border-destructive/30">
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
              <span className="text-[11px] text-destructive font-medium flex-1">
                {stats.unmapped} active subscription(s) point to unknown plan IDs — manual review required
              </span>
            </div>
          )}

          <p className="text-[9px] text-muted-foreground/60 pt-2 border-t border-border/40 mt-3">
            Mapping logic lives in <code className="bg-background/40 px-1 rounded">src/hooks/usePlanGating.ts</code> · normalized at runtime, no DB writes needed
          </p>
        </CardContent>
      </Card>
    </div>
  );
};

const StatCell = ({ icon: Icon, label, value, color }: { icon: any; label: string; value: number; color: string }) => (
  <motion.div
    className="rounded-xl p-3"
    style={{ background: `${color}10`, border: `1px solid ${color}22` }}
    initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
  >
    <div className="flex items-center gap-1.5 mb-1">
      <Icon className="w-3 h-3" style={{ color }} />
      <span className="text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        {label}
      </span>
    </div>
    <span className="text-2xl font-black tabular-nums" style={{ color }}>{value}</span>
  </motion.div>
);

const BreakdownPill = ({ label, value, color }: { label: string; value: number; color: string }) => (
  <div className="rounded-md px-2 py-1.5 text-center" style={{ background: `${color}12`, border: `1px solid ${color}22` }}>
    <div className="text-[9px] text-muted-foreground uppercase tracking-wider">{label}</div>
    <div className="text-sm font-bold tabular-nums" style={{ color }}>{value}</div>
  </div>
);

export default SubscriptionMigrationWidget;
