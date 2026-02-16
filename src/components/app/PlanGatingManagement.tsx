import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Shield, Loader2, RefreshCw, Search, Zap, Sparkles, Brain, Check, X, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { PlanFeatureGate } from "@/hooks/usePlanGating";

const CATEGORY_LABELS: Record<string, string> = {
  home: "Home Tab",
  action: "Action Tab",
  brain: "Brain Tab",
  progress: "Progress Tab",
  settings: "Settings",
  general: "General",
};

const CATEGORY_ICONS: Record<string, typeof Brain> = {
  home: Brain,
  action: Zap,
  brain: Brain,
  progress: Brain,
  settings: Shield,
  general: Shield,
};

const PlanGatingManagement = () => {
  const { toast } = useToast();
  const [gates, setGates] = useState<PlanFeatureGate[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [saving, setSaving] = useState<string | null>(null);

  const fetchGates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("plan_feature_gates")
      .select("*")
      .order("sort_order");
    setGates((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchGates(); }, [fetchGates]);

  const toggleGate = async (id: string, field: "free_enabled" | "pro_enabled" | "ultra_enabled", value: boolean) => {
    setSaving(id);
    const { error } = await supabase
      .from("plan_feature_gates")
      .update({ [field]: value, updated_at: new Date().toISOString() } as any)
      .eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setGates(prev => prev.map(g => g.id === id ? { ...g, [field]: value } : g));
    }
    setSaving(null);
  };

  const categories = [...new Set(gates.map(g => g.feature_category))];
  const filtered = gates.filter(g => {
    if (categoryFilter !== "all" && g.feature_category !== categoryFilter) return false;
    if (search && !g.feature_label.toLowerCase().includes(search.toLowerCase()) && !g.feature_key.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const groupedByCategory = filtered.reduce<Record<string, PlanFeatureGate[]>>((acc, g) => {
    if (!acc[g.feature_category]) acc[g.feature_category] = [];
    acc[g.feature_category].push(g);
    return acc;
  }, {});

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Shield className="w-5 h-5 text-primary" />
          Plan Feature Gating
        </h2>
        <button onClick={fetchGates} className="p-2 rounded-lg hover:bg-secondary transition-colors">
          <RefreshCw className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>

      <p className="text-xs text-muted-foreground">
        Control which features are available on each subscription plan. Changes take effect immediately for all users.
      </p>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { plan: "Free", icon: Brain, count: gates.filter(g => g.free_enabled).length, total: gates.length, color: "text-muted-foreground" },
          { plan: "Pro", icon: Zap, count: gates.filter(g => g.pro_enabled).length, total: gates.length, color: "text-primary" },
          { plan: "Ultra", icon: Sparkles, count: gates.filter(g => g.ultra_enabled).length, total: gates.length, color: "text-accent" },
        ].map(p => (
          <motion.div key={p.plan} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border text-center">
            <p.icon className={`w-5 h-5 mx-auto mb-1.5 ${p.color}`} />
            <p className={`text-lg font-bold ${p.color}`}>{p.count}/{p.total}</p>
            <p className="text-[10px] text-muted-foreground">{p.plan} Features</p>
          </motion.div>
        ))}
      </div>

      {/* Search & Filter */}
      <div className="flex gap-2 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search features..."
            className="w-full pl-9 pr-3 py-2.5 bg-secondary/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <div className="flex gap-1 items-center flex-wrap">
          <Filter className="w-3.5 h-3.5 text-muted-foreground" />
          <button onClick={() => setCategoryFilter("all")}
            className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors ${categoryFilter === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            All
          </button>
          {categories.map(cat => (
            <button key={cat} onClick={() => setCategoryFilter(cat)}
              className={`px-2.5 py-1.5 rounded-md text-[10px] font-medium transition-colors capitalize ${categoryFilter === cat ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {CATEGORY_LABELS[cat] || cat}
            </button>
          ))}
        </div>
      </div>

      {/* Feature Gates Table */}
      {Object.entries(groupedByCategory).map(([category, features]) => {
        const CatIcon = CATEGORY_ICONS[category] || Shield;
        return (
          <motion.div key={category} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <CatIcon className="w-3.5 h-3.5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">{CATEGORY_LABELS[category] || category}</h3>
              <span className="text-[10px] text-muted-foreground">({features.length})</span>
            </div>

            <div className="glass rounded-xl neural-border overflow-hidden">
              {/* Header */}
              <div className="grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-2.5 bg-secondary/30 border-b border-border">
                <span className="text-[10px] font-semibold text-muted-foreground uppercase">Feature</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-center">Free</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-center">Pro</span>
                <span className="text-[10px] font-semibold text-muted-foreground uppercase text-center">Ultra</span>
              </div>

              {features.map((gate, i) => (
                <div key={gate.id} className={`grid grid-cols-[1fr_80px_80px_80px] gap-2 px-4 py-3 items-center ${i < features.length - 1 ? "border-b border-border/50" : ""} hover:bg-secondary/20 transition-colors`}>
                  <div>
                    <p className="text-sm font-medium text-foreground">{gate.feature_label}</p>
                    <p className="text-[10px] text-muted-foreground font-mono">{gate.feature_key}</p>
                  </div>
                  {(["free_enabled", "pro_enabled", "ultra_enabled"] as const).map(field => (
                    <div key={field} className="flex justify-center">
                      <button
                        onClick={() => toggleGate(gate.id, field, !(gate as any)[field])}
                        disabled={saving === gate.id}
                        className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                          (gate as any)[field]
                            ? "bg-success/15 text-success hover:bg-success/25"
                            : "bg-secondary/50 text-muted-foreground hover:bg-destructive/15 hover:text-destructive"
                        } ${saving === gate.id ? "opacity-50" : ""}`}
                      >
                        {(gate as any)[field] ? <Check className="w-4 h-4" /> : <X className="w-4 h-4" />}
                      </button>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        );
      })}

      {filtered.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-8">No features match your search.</p>
      )}
    </div>
  );
};

export default PlanGatingManagement;
