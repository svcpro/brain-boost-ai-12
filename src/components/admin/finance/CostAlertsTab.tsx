import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  AlertTriangle, Bell, Loader2, IndianRupee, Plus, Trash2,
  CheckCircle, TrendingUp, Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface CostAlert {
  id: string;
  category: string;
  threshold: number;
  current: number;
  triggered: boolean;
  createdAt: string;
}

const DEFAULT_ALERTS: Omit<CostAlert, "id" | "current" | "triggered" | "createdAt">[] = [
  { category: "daily_total", threshold: 500 },
  { category: "ai_monthly", threshold: 5000 },
  { category: "api_monthly", threshold: 3000 },
  { category: "per_user_daily", threshold: 50 },
];

const CATEGORY_LABELS: Record<string, string> = {
  daily_total: "Daily Total Cost",
  ai_monthly: "Monthly AI Cost",
  api_monthly: "Monthly API Cost",
  per_user_daily: "Per-User Daily Cost",
  storage_monthly: "Monthly Storage Cost",
};

export default function CostAlertsTab() {
  const { toast } = useToast();
  const [alerts, setAlerts] = useState<CostAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [newCategory, setNewCategory] = useState("daily_total");
  const [newThreshold, setNewThreshold] = useState(500);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    setLoading(true);
    try {
      // Check current costs
      const [chatRes, apiRes] = await Promise.all([
        supabase.from("chat_usage_logs").select("estimated_cost, created_at").gte("created_at", new Date().toISOString().split("T")[0]).limit(500),
        supabase.from("api_integrations").select("monthly_cost_estimate"),
      ]);

      const todayChatCost = (chatRes.data || []).reduce((s, l) => s + (l.estimated_cost || 0) * 83, 0);
      const monthlyApiCost = (apiRes.data || []).reduce((s, a) => s + (a.monthly_cost_estimate || 0) * 83, 0);

      // Generate alerts with current values
      const alertsList: CostAlert[] = DEFAULT_ALERTS.map((a, i) => {
        let current = 0;
        if (a.category === "daily_total") current = todayChatCost;
        if (a.category === "ai_monthly") current = todayChatCost * 30;
        if (a.category === "api_monthly") current = monthlyApiCost;
        return {
          id: `alert-${i}`,
          ...a,
          current: Math.round(current * 100) / 100,
          triggered: current >= a.threshold,
          createdAt: new Date().toISOString(),
        };
      });

      setAlerts(alertsList);
    } catch (e) {
      console.error("Cost alerts fetch failed:", e);
    } finally {
      setLoading(false);
    }
  };

  const addAlert = () => {
    const newAlert: CostAlert = {
      id: `alert-${Date.now()}`,
      category: newCategory,
      threshold: newThreshold,
      current: 0,
      triggered: false,
      createdAt: new Date().toISOString(),
    };
    setAlerts([...alerts, newAlert]);
    toast({ title: "Alert Added", description: `${CATEGORY_LABELS[newCategory]} threshold set to ₹${newThreshold}` });
  };

  const removeAlert = (id: string) => {
    setAlerts(alerts.filter(a => a.id !== id));
    toast({ title: "Alert Removed" });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const triggeredCount = alerts.filter(a => a.triggered).length;

  return (
    <div className="space-y-5 mt-4">
      {/* Status Banner */}
      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        className={`glass rounded-xl neural-border p-4 flex items-center gap-3 ${triggeredCount > 0 ? "border-destructive/30" : "border-success/30"}`}>
        {triggeredCount > 0 ? (
          <AlertTriangle className="w-6 h-6 text-destructive" />
        ) : (
          <CheckCircle className="w-6 h-6 text-success" />
        )}
        <div>
          <p className="text-sm font-bold text-foreground">
            {triggeredCount > 0 ? `${triggeredCount} Alert${triggeredCount > 1 ? "s" : ""} Triggered` : "All Systems Normal"}
          </p>
          <p className="text-[10px] text-muted-foreground">
            {alerts.length} threshold{alerts.length !== 1 ? "s" : ""} configured
          </p>
        </div>
      </motion.div>

      {/* Add New Alert */}
      <div className="glass rounded-xl neural-border p-4">
        <h4 className="text-xs font-semibold text-foreground mb-3 flex items-center gap-2">
          <Settings className="w-4 h-4 text-primary" /> Configure Alert
        </h4>
        <div className="flex items-center gap-3">
          <select value={newCategory} onChange={e => setNewCategory(e.target.value)}
            className="flex-1 text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground">
            {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
          <div className="flex items-center gap-1">
            <span className="text-sm text-muted-foreground">₹</span>
            <input type="number" value={newThreshold} onChange={e => setNewThreshold(Number(e.target.value))}
              className="w-24 text-sm bg-secondary border border-border rounded-lg px-3 py-2 text-foreground" />
          </div>
          <button onClick={addAlert}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-all">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Alert List */}
      <div className="space-y-2">
        {alerts.map((alert, i) => (
          <motion.div key={alert.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }}
            className={`glass rounded-xl neural-border p-4 ${alert.triggered ? "border-destructive/30" : ""}`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                {alert.triggered ? <AlertTriangle className="w-4 h-4 text-destructive" /> : <CheckCircle className="w-4 h-4 text-success" />}
                <div>
                  <p className="text-sm font-medium text-foreground">{CATEGORY_LABELS[alert.category] || alert.category}</p>
                  <p className="text-[10px] text-muted-foreground">Threshold: ₹{alert.threshold}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <p className={`text-sm font-bold ${alert.triggered ? "text-destructive" : "text-success"}`}>₹{alert.current}</p>
                  <p className="text-[10px] text-muted-foreground">{alert.triggered ? "EXCEEDED" : "OK"}</p>
                </div>
                <button onClick={() => removeAlert(alert.id)} className="p-2 rounded-lg hover:bg-destructive/10 text-destructive transition-colors">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
            {/* Progress bar */}
            <div className="mt-2 h-2 bg-secondary rounded-full overflow-hidden">
              <div className={`h-full rounded-full transition-all ${alert.triggered ? "bg-destructive" : "bg-success"}`}
                style={{ width: `${Math.min((alert.current / alert.threshold) * 100, 100)}%` }} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
