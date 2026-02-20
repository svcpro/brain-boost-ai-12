import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, RefreshCw, Search, Crown, Check, X, Filter, Users, Calendar, Settings, ToggleLeft, ToggleRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

const PlanGatingManagement = () => {
  const { toast } = useToast();
  const [plan, setPlan] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [stats, setStats] = useState({ active: 0, trial: 0, expired: 0, totalRevenue: 0 });

  // Editable fields
  const [planName, setPlanName] = useState("");
  const [monthlyPrice, setMonthlyPrice] = useState(149);
  const [yearlyPrice, setYearlyPrice] = useState(1499);
  const [trialDays, setTrialDays] = useState(15);
  const [trialEnabled, setTrialEnabled] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const [planRes, subsRes] = await Promise.all([
      supabase.from("subscription_plans").select("*").eq("plan_key", "premium").maybeSingle(),
      supabase.from("user_subscriptions").select("status, is_trial, amount"),
    ]);

    const p = planRes.data;
    if (p) {
      setPlan(p);
      setPlanName(p.name || "ACRY Premium");
      setMonthlyPrice(p.price || 149);
      setYearlyPrice(p.yearly_price || 1499);
      setTrialDays(p.trial_days || 15);
      setTrialEnabled(p.trial_days > 0);
    }

    const subs = subsRes.data || [];
    setStats({
      active: subs.filter((s: any) => s.status === "active" && !s.is_trial).length,
      trial: subs.filter((s: any) => s.status === "active" && s.is_trial).length,
      expired: subs.filter((s: any) => s.status === "expired" || s.status === "cancelled").length,
      totalRevenue: subs.filter((s: any) => s.status === "active" && !s.is_trial).reduce((sum: number, s: any) => sum + (s.amount || 0), 0),
    });
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleSave = async () => {
    if (!plan) return;
    setSaving(true);
    const { error } = await supabase
      .from("subscription_plans")
      .update({
        name: planName,
        price: monthlyPrice,
        yearly_price: yearlyPrice,
        trial_days: trialEnabled ? trialDays : 0,
      } as any)
      .eq("id", plan.id);

    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Plan Updated", description: "Changes saved successfully." });
      fetchData();
    }
    setSaving(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Crown className="w-5 h-5 text-primary" />
          Premium Plan Management
        </h2>
        <button onClick={fetchData} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Manage the single ACRY Premium plan. All features are included for subscribers.
      </p>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Active Subscribers", value: stats.active, icon: Users, color: "text-success" },
          { label: "Trial Users", value: stats.trial, icon: Calendar, color: "text-primary" },
          { label: "Expired/Cancelled", value: stats.expired, icon: X, color: "text-destructive" },
          { label: "Total Revenue", value: `₹${stats.totalRevenue.toLocaleString()}`, icon: Crown, color: "text-warning" },
        ].map(s => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="glass rounded-xl p-4 neural-border text-center">
            <s.icon className={`w-5 h-5 mx-auto mb-1.5 ${s.color}`} />
            <p className={`text-lg font-bold ${s.color}`}>{s.value}</p>
            <p className="text-[10px] text-muted-foreground">{s.label}</p>
          </motion.div>
        ))}
      </div>

      {/* Plan Configuration */}
      <div className="glass rounded-xl neural-border p-5 space-y-4">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" />
          Plan Configuration
        </h3>

        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Plan Name</label>
            <input
              value={planName}
              onChange={e => setPlanName(e.target.value)}
              className="w-full px-3 py-2.5 bg-secondary/50 rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Monthly Price (₹)</label>
            <input
              type="number"
              value={monthlyPrice}
              onChange={e => setMonthlyPrice(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-secondary/50 rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Yearly Price (₹)</label>
            <input
              type="number"
              value={yearlyPrice}
              onChange={e => setYearlyPrice(Number(e.target.value))}
              className="w-full px-3 py-2.5 bg-secondary/50 rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Trial Days</label>
            <div className="flex items-center gap-3">
              <input
                type="number"
                value={trialDays}
                onChange={e => setTrialDays(Number(e.target.value))}
                disabled={!trialEnabled}
                className="flex-1 px-3 py-2.5 bg-secondary/50 rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none disabled:opacity-50"
              />
              <button
                onClick={() => setTrialEnabled(!trialEnabled)}
                className={`p-2 rounded-lg transition-colors ${trialEnabled ? "text-success" : "text-muted-foreground"}`}
              >
                {trialEnabled ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
              </button>
            </div>
          </div>
        </div>

        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleSave}
          disabled={saving}
          className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
          {saving ? "Saving..." : "Save Changes"}
        </motion.button>
      </div>

      {/* Features included notice */}
      <div className="glass rounded-xl neural-border p-4">
        <p className="text-xs text-muted-foreground text-center">
          <Shield className="w-3.5 h-3.5 inline mr-1" />
          Single plan model — all features are included for all subscribers. No feature gating needed.
        </p>
      </div>
    </div>
  );
};

export default PlanGatingManagement;
