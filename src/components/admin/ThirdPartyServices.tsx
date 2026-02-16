import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, ExternalLink, ToggleLeft, ToggleRight, AlertTriangle,
  CheckCircle2, DollarSign, Activity, Mail, Mic, CreditCard,
  Bell, Brain, Save, Eye, EyeOff, Info, Clock, Shield, Zap,
  Globe, Copy, RefreshCw, Search, TrendingUp, AlertCircle,
  Server, Lock, Settings, BarChart3, Gauge, ChevronDown,
  ChevronRight, Sparkles, Wallet, ArrowUpRight, ArrowDownRight,
  LifeBuoy, Database, FileText, PieChart
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ───
interface ServiceIntegration {
  id: string;
  service_name: string;
  display_name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  api_key_masked: string | null;
  key_last_updated_at: string | null;
  monthly_cost_estimate: number;
  monthly_usage_count: number;
  usage_limit: number | null;
  usage_reset_at: string | null;
  status: string;
  config: Record<string, any>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

// ─── Constants ───
const CATEGORY_META: Record<string, { icon: any; color: string; label: string; gradient: string }> = {
  ai: { icon: Brain, color: "text-purple-400", label: "AI / ML", gradient: "from-purple-500/20 to-purple-500/5" },
  email: { icon: Mail, color: "text-blue-400", label: "Email", gradient: "from-blue-500/20 to-blue-500/5" },
  voice: { icon: Mic, color: "text-pink-400", label: "Voice", gradient: "from-pink-500/20 to-pink-500/5" },
  payments: { icon: CreditCard, color: "text-green-400", label: "Payments", gradient: "from-green-500/20 to-green-500/5" },
  notifications: { icon: Bell, color: "text-amber-400", label: "Notifications", gradient: "from-amber-500/20 to-amber-500/5" },
};

const STATUS_META: Record<string, { color: string; bg: string; label: string }> = {
  active: { color: "text-success", bg: "bg-success/15", label: "Active" },
  inactive: { color: "text-muted-foreground", bg: "bg-muted/15", label: "Inactive" },
  error: { color: "text-destructive", bg: "bg-destructive/15", label: "Error" },
  degraded: { color: "text-warning", bg: "bg-warning/15", label: "Degraded" },
};

// ─── Main Component ───
const ThirdPartyServices = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-primary flex items-center justify-center">
              <Globe className="w-4 h-4 text-primary-foreground" />
            </div>
            Third-Party Service Hub
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Manage all external APIs • Cost tracking • Usage monitoring • Health status</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
          {[
            { value: "overview", label: "Overview", icon: PieChart },
            { value: "services", label: "All Services", icon: Server },
            { value: "costs", label: "Cost Center", icon: DollarSign },
            { value: "usage", label: "Usage Analytics", icon: BarChart3 },
            { value: "health", label: "Health Monitor", icon: Activity },
            { value: "keys", label: "Secret Keys", icon: Lock },
            { value: "docs", label: "Service Docs", icon: FileText },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="services"><ServicesTab /></TabsContent>
        <TabsContent value="costs"><CostCenterTab /></TabsContent>
        <TabsContent value="usage"><UsageAnalyticsTab /></TabsContent>
        <TabsContent value="health"><HealthMonitorTab /></TabsContent>
        <TabsContent value="keys"><SecretKeysTab /></TabsContent>
        <TabsContent value="docs"><ServiceDocsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ─── OVERVIEW TAB ───
const OverviewTab = () => {
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_integrations").select("*").order("category");
      setServices((data || []) as ServiceIntegration[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalServices = services.length;
  const activeServices = services.filter(s => s.is_enabled).length;
  const totalCost = services.reduce((s, i) => s + (i.monthly_cost_estimate || 0), 0);
  const totalUsage = services.reduce((s, i) => s + (i.monthly_usage_count || 0), 0);
  const categories = [...new Set(services.map(s => s.category))];

  return (
    <div className="space-y-5 mt-4">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Services", value: totalServices, sub: `${activeServices} active`, icon: Server, color: "text-primary", gradient: "from-primary/20 to-primary/5" },
          { label: "Monthly Cost", value: `$${totalCost.toFixed(2)}`, sub: "estimated spend", icon: DollarSign, color: "text-warning", gradient: "from-warning/20 to-warning/5" },
          { label: "API Calls (Month)", value: totalUsage.toLocaleString(), sub: "across all services", icon: Activity, color: "text-success", gradient: "from-success/20 to-success/5" },
          { label: "Categories", value: categories.length, sub: categories.join(", "), icon: Database, color: "text-accent", gradient: "from-accent/20 to-accent/5" },
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

      {/* Services by Category */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((service, i) => {
          const cat = CATEGORY_META[service.category] || CATEGORY_META.ai;
          const status = STATUS_META[service.status] || STATUS_META.active;
          const CatIcon = cat.icon;
          const usagePercent = service.usage_limit ? Math.min((service.monthly_usage_count / service.usage_limit) * 100, 100) : null;

          return (
            <motion.div key={service.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
              className="glass rounded-xl p-4 neural-border hover:border-primary/30 transition-all group">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                    <CatIcon className={`w-4 h-4 ${cat.color}`} />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-foreground">{service.display_name}</h3>
                    <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>
                    {status.label}
                  </span>
                  {service.is_enabled ? (
                    <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                  ) : (
                    <div className="w-2 h-2 rounded-full bg-muted-foreground" />
                  )}
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">{service.description}</p>

              <div className="grid grid-cols-2 gap-2 mb-3">
                <div className="bg-secondary/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">Monthly Cost</p>
                  <p className="text-sm font-bold text-foreground">${(service.monthly_cost_estimate || 0).toFixed(2)}</p>
                </div>
                <div className="bg-secondary/50 rounded-lg p-2">
                  <p className="text-[10px] text-muted-foreground">API Calls</p>
                  <p className="text-sm font-bold text-foreground">{(service.monthly_usage_count || 0).toLocaleString()}</p>
                </div>
              </div>

              {usagePercent !== null && (
                <div className="mb-2">
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="text-muted-foreground">Usage Quota</span>
                    <span className={usagePercent > 80 ? "text-destructive font-medium" : "text-muted-foreground"}>
                      {usagePercent.toFixed(0)}%
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border">
                    <div
                      className={`h-full rounded-full transition-all ${usagePercent > 90 ? "bg-destructive" : usagePercent > 70 ? "bg-warning" : "bg-success"}`}
                      style={{ width: `${usagePercent}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Edge functions using this service */}
              {service.config?.used_in && (
                <div className="mt-2 pt-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Used in {(service.config.used_in as string[]).length} functions</p>
                  <div className="flex flex-wrap gap-1">
                    {(service.config.used_in as string[]).slice(0, 4).map((fn: string) => (
                      <span key={fn} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{fn}</span>
                    ))}
                    {(service.config.used_in as string[]).length > 4 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">
                        +{(service.config.used_in as string[]).length - 4} more
                      </span>
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── SERVICES TAB ───
const ServicesTab = () => {
  const { toast } = useToast();
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingNotes, setEditingNotes] = useState<string | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [editingCost, setEditingCost] = useState<string | null>(null);
  const [costDraft, setCostDraft] = useState("");
  const [editingLimit, setEditingLimit] = useState<string | null>(null);
  const [limitDraft, setLimitDraft] = useState("");

  useEffect(() => {
    fetchServices();
  }, []);

  const fetchServices = async () => {
    setLoading(true);
    const { data } = await supabase.from("api_integrations").select("*").order("category");
    setServices((data || []) as ServiceIntegration[]);
    setLoading(false);
  };

  const toggleService = async (service: ServiceIntegration) => {
    const { error } = await supabase.from("api_integrations").update({ is_enabled: !service.is_enabled }).eq("id", service.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setServices(prev => prev.map(s => s.id === service.id ? { ...s, is_enabled: !s.is_enabled } : s));
      toast({ title: service.is_enabled ? "Service Disabled" : "Service Enabled", description: service.display_name });
    }
  };

  const saveNotes = async (id: string) => {
    await supabase.from("api_integrations").update({ notes: notesDraft }).eq("id", id);
    setServices(prev => prev.map(s => s.id === id ? { ...s, notes: notesDraft } : s));
    setEditingNotes(null);
    toast({ title: "Notes saved" });
  };

  const saveCost = async (id: string) => {
    const val = parseFloat(costDraft);
    if (isNaN(val)) return;
    await supabase.from("api_integrations").update({ monthly_cost_estimate: val }).eq("id", id);
    setServices(prev => prev.map(s => s.id === id ? { ...s, monthly_cost_estimate: val } : s));
    setEditingCost(null);
    toast({ title: "Cost updated" });
  };

  const saveLimit = async (id: string) => {
    const val = limitDraft === "" ? null : parseInt(limitDraft);
    await supabase.from("api_integrations").update({ usage_limit: val }).eq("id", id);
    setServices(prev => prev.map(s => s.id === id ? { ...s, usage_limit: val } : s));
    setEditingLimit(null);
    toast({ title: "Limit updated" });
  };

  const filtered = services.filter(s =>
    s.display_name.toLowerCase().includes(search.toLowerCase()) ||
    s.service_name.toLowerCase().includes(search.toLowerCase()) ||
    s.category.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Search */}
      <div className="relative">
        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
        <input
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search services..."
          className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
        />
      </div>

      {/* Service List */}
      <div className="space-y-3">
        {filtered.map((service, i) => {
          const cat = CATEGORY_META[service.category] || CATEGORY_META.ai;
          const status = STATUS_META[service.status] || STATUS_META.active;
          const CatIcon = cat.icon;
          const isExpanded = expandedId === service.id;

          return (
            <motion.div key={service.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass rounded-xl neural-border overflow-hidden">
              {/* Header Row */}
              <div className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-secondary/20 transition-colors"
                onClick={() => setExpandedId(isExpanded ? null : service.id)}>
                <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center flex-shrink-0`}>
                  <CatIcon className={`w-5 h-5 ${cat.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-foreground truncate">{service.display_name}</h3>
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${status.bg} ${status.color}`}>{status.label}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">{service.description}</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-foreground">{service.monthly_usage_count.toLocaleString()}</p>
                    <p className="text-[10px] text-muted-foreground">calls/mo</p>
                  </div>
                  <div className="text-right hidden sm:block">
                    <p className="text-xs font-semibold text-foreground">${service.monthly_cost_estimate.toFixed(2)}</p>
                    <p className="text-[10px] text-muted-foreground">cost/mo</p>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); toggleService(service); }}
                    className="p-1 rounded-lg hover:bg-secondary/50 transition-colors"
                  >
                    {service.is_enabled ? (
                      <ToggleRight className="w-6 h-6 text-success" />
                    ) : (
                      <ToggleLeft className="w-6 h-6 text-muted-foreground" />
                    )}
                  </button>
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </div>

              {/* Expanded Details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border">
                    <div className="p-4 space-y-4">
                      {/* Config Grid */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        {/* Secret Key Info */}
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Lock className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Secret Name</span>
                          </div>
                          <p className="text-xs font-mono text-foreground">{service.config?.secret_name || "N/A"}</p>
                          {service.config?.secret_name_2 && (
                            <p className="text-xs font-mono text-foreground mt-1">{service.config.secret_name_2}</p>
                          )}
                          {service.config?.managed_by_connector && (
                            <span className="text-[9px] px-1.5 py-0.5 mt-1 inline-block rounded bg-accent/15 text-accent">Managed by Connector</span>
                          )}
                        </div>

                        {/* Cost Management */}
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <DollarSign className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Monthly Cost</span>
                          </div>
                          {editingCost === service.id ? (
                            <div className="flex items-center gap-1">
                              <input value={costDraft} onChange={e => setCostDraft(e.target.value)} type="number" step="0.01" min="0"
                                className="w-20 px-2 py-1 rounded bg-background border border-border text-xs text-foreground" autoFocus />
                              <button onClick={() => saveCost(service.id)} className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">Save</button>
                              <button onClick={() => setEditingCost(null)} className="text-[10px] px-2 py-1 rounded bg-secondary text-foreground">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingCost(service.id); setCostDraft(service.monthly_cost_estimate.toString()); }}
                              className="text-xs font-semibold text-foreground hover:text-primary transition-colors">
                              ${service.monthly_cost_estimate.toFixed(2)} <span className="text-[9px] text-muted-foreground ml-1">click to edit</span>
                            </button>
                          )}
                          {service.config?.pricing_url && (
                            <a href={service.config.pricing_url} target="_blank" rel="noopener noreferrer"
                              className="text-[10px] text-primary flex items-center gap-0.5 mt-1 hover:underline">
                              Pricing <ExternalLink className="w-2.5 h-2.5" />
                            </a>
                          )}
                        </div>

                        {/* Usage Limit */}
                        <div className="bg-secondary/30 rounded-lg p-3">
                          <div className="flex items-center gap-1.5 mb-2">
                            <Gauge className="w-3.5 h-3.5 text-muted-foreground" />
                            <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Usage Limit</span>
                          </div>
                          {editingLimit === service.id ? (
                            <div className="flex items-center gap-1">
                              <input value={limitDraft} onChange={e => setLimitDraft(e.target.value)} type="number" min="0" placeholder="No limit"
                                className="w-20 px-2 py-1 rounded bg-background border border-border text-xs text-foreground" autoFocus />
                              <button onClick={() => saveLimit(service.id)} className="text-[10px] px-2 py-1 rounded bg-primary text-primary-foreground">Save</button>
                              <button onClick={() => setEditingLimit(null)} className="text-[10px] px-2 py-1 rounded bg-secondary text-foreground">Cancel</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditingLimit(service.id); setLimitDraft(service.usage_limit?.toString() || ""); }}
                              className="text-xs font-semibold text-foreground hover:text-primary transition-colors">
                              {service.usage_limit ? `${service.usage_limit.toLocaleString()} / month` : "Unlimited"}
                              <span className="text-[9px] text-muted-foreground ml-1">click to edit</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Edge Functions */}
                      {service.config?.used_in && (
                        <div>
                          <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-2">Edge Functions Using This Service</p>
                          <div className="flex flex-wrap gap-1.5">
                            {(service.config.used_in as string[]).map((fn: string) => (
                              <span key={fn} className="text-[10px] px-2 py-1 rounded-lg bg-secondary/70 text-foreground border border-border/50 font-mono">
                                {fn}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Documentation */}
                      {service.config?.docs_url && (
                        <a href={service.config.docs_url} target="_blank" rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline">
                          <FileText className="w-3.5 h-3.5" /> View Documentation <ExternalLink className="w-3 h-3" />
                        </a>
                      )}

                      {/* Notes */}
                      <div>
                        <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider mb-1.5">Admin Notes</p>
                        {editingNotes === service.id ? (
                          <div className="space-y-2">
                            <textarea value={notesDraft} onChange={e => setNotesDraft(e.target.value)} rows={2}
                              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
                              placeholder="Add notes about this service..." />
                            <div className="flex gap-2">
                              <button onClick={() => saveNotes(service.id)} className="text-[10px] px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-medium">Save</button>
                              <button onClick={() => setEditingNotes(null)} className="text-[10px] px-3 py-1.5 rounded-lg bg-secondary text-foreground font-medium">Cancel</button>
                            </div>
                          </div>
                        ) : (
                          <button onClick={() => { setEditingNotes(service.id); setNotesDraft(service.notes || ""); }}
                            className="text-xs text-muted-foreground hover:text-foreground transition-colors text-left w-full">
                            {service.notes || "Click to add notes..."}
                          </button>
                        )}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── COST CENTER TAB ───
const CostCenterTab = () => {
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_integrations").select("*").order("monthly_cost_estimate", { ascending: false });
      setServices((data || []) as ServiceIntegration[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalCost = services.reduce((s, i) => s + (i.monthly_cost_estimate || 0), 0);
  const totalUsage = services.reduce((s, i) => s + (i.monthly_usage_count || 0), 0);
  const costPerCall = totalUsage > 0 ? (totalCost / totalUsage) : 0;

  // By category
  const categoryBreakdown: Record<string, { cost: number; usage: number; count: number }> = {};
  services.forEach(s => {
    if (!categoryBreakdown[s.category]) categoryBreakdown[s.category] = { cost: 0, usage: 0, count: 0 };
    categoryBreakdown[s.category].cost += s.monthly_cost_estimate || 0;
    categoryBreakdown[s.category].usage += s.monthly_usage_count || 0;
    categoryBreakdown[s.category].count++;
  });

  return (
    <div className="space-y-5 mt-4">
      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Monthly Cost", value: `$${totalCost.toFixed(2)}`, icon: DollarSign, color: "text-warning" },
          { label: "Total API Calls", value: totalUsage.toLocaleString(), icon: Activity, color: "text-success" },
          { label: "Avg Cost / Call", value: `$${costPerCall.toFixed(4)}`, icon: TrendingUp, color: "text-accent" },
          { label: "Active Services", value: services.filter(s => s.is_enabled).length, icon: CheckCircle2, color: "text-primary" },
        ].map((card, i) => (
          <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className="glass rounded-xl p-4 neural-border">
            <div className="flex items-center gap-2 mb-2">
              <card.icon className={`w-4 h-4 ${card.color}`} />
              <span className="text-[10px] text-muted-foreground font-medium">{card.label}</span>
            </div>
            <p className="text-xl font-bold text-foreground">{card.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Category Breakdown */}
      <div className="glass rounded-xl neural-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <PieChart className="w-4 h-4 text-primary" /> Cost by Category
        </h3>
        <div className="space-y-3">
          {Object.entries(categoryBreakdown).map(([cat, data]) => {
            const meta = CATEGORY_META[cat] || CATEGORY_META.ai;
            const CatIcon = meta.icon;
            const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
            return (
              <div key={cat} className="flex items-center gap-3">
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${meta.gradient} flex items-center justify-center flex-shrink-0`}>
                  <CatIcon className={`w-4 h-4 ${meta.color}`} />
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-foreground">{meta.label}</span>
                    <span className="text-xs font-semibold text-foreground">${data.cost.toFixed(2)}</span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-border">
                    <div className={`h-full rounded-full bg-primary/60`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex items-center justify-between mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{data.count} service(s)</span>
                    <span className="text-[10px] text-muted-foreground">{data.usage.toLocaleString()} calls</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Per-Service Cost Table */}
      <div className="glass rounded-xl neural-border overflow-hidden">
        <div className="px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-foreground">Service Cost Breakdown</h3>
        </div>
        <div className="divide-y divide-border/50">
          {services.map(s => {
            const cat = CATEGORY_META[s.category] || CATEGORY_META.ai;
            const costPerCallService = s.monthly_usage_count > 0 ? s.monthly_cost_estimate / s.monthly_usage_count : 0;
            return (
              <div key={s.id} className="flex items-center gap-3 px-4 py-3">
                <cat.icon className={`w-4 h-4 ${cat.color} flex-shrink-0`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-foreground truncate">{s.display_name}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-xs font-semibold text-foreground">${s.monthly_cost_estimate.toFixed(2)}</p>
                  <p className="text-[10px] text-muted-foreground">${costPerCallService.toFixed(5)}/call</p>
                </div>
                <div className="text-right flex-shrink-0 w-16">
                  <p className="text-xs text-foreground">{s.monthly_usage_count.toLocaleString()}</p>
                  <p className="text-[10px] text-muted-foreground">calls</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── USAGE ANALYTICS TAB ───
const UsageAnalyticsTab = () => {
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_integrations").select("*").order("monthly_usage_count", { ascending: false });
      setServices((data || []) as ServiceIntegration[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalUsage = services.reduce((s, i) => s + (i.monthly_usage_count || 0), 0);
  const maxUsage = Math.max(...services.map(s => s.monthly_usage_count || 0), 1);

  return (
    <div className="space-y-5 mt-4">
      {/* Usage Chart */}
      <div className="glass rounded-xl neural-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-accent" /> Usage Distribution
        </h3>
        <div className="space-y-3">
          {services.map(s => {
            const cat = CATEGORY_META[s.category] || CATEGORY_META.ai;
            const pct = (s.monthly_usage_count / maxUsage) * 100;
            const quota = s.usage_limit ? (s.monthly_usage_count / s.usage_limit) * 100 : null;

            return (
              <div key={s.id} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <cat.icon className={`w-3.5 h-3.5 ${cat.color}`} />
                    <span className="text-xs font-medium text-foreground">{s.display_name}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-semibold text-foreground">{s.monthly_usage_count.toLocaleString()}</span>
                    {quota !== null && (
                      <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
                        quota > 90 ? "bg-destructive/15 text-destructive" : quota > 70 ? "bg-warning/15 text-warning" : "bg-success/15 text-success"
                      }`}>
                        {quota.toFixed(0)}% of limit
                      </span>
                    )}
                  </div>
                </div>
                <div className="w-full h-2 rounded-full bg-border">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 0.6 }}
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                  />
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-border/50">
          <span className="text-xs font-medium text-muted-foreground">Total API Calls This Month</span>
          <span className="text-sm font-bold text-foreground">{totalUsage.toLocaleString()}</span>
        </div>
      </div>

      {/* Alert: Near Limit */}
      {services.filter(s => s.usage_limit && s.monthly_usage_count / s.usage_limit > 0.8).length > 0 && (
        <div className="glass rounded-xl neural-border p-4 border-warning/30">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="w-4 h-4 text-warning" />
            <span className="text-xs font-semibold text-warning">Usage Alerts</span>
          </div>
          <div className="space-y-2">
            {services.filter(s => s.usage_limit && s.monthly_usage_count / s.usage_limit > 0.8).map(s => (
              <div key={s.id} className="flex items-center justify-between text-xs">
                <span className="text-foreground">{s.display_name}</span>
                <span className="text-warning font-medium">{s.monthly_usage_count.toLocaleString()} / {s.usage_limit!.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

// ─── HEALTH MONITOR TAB ───
const HealthMonitorTab = () => {
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_integrations").select("*").order("status");
      setServices((data || []) as ServiceIntegration[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const statusGroups: Record<string, ServiceIntegration[]> = {};
  services.forEach(s => {
    const key = s.is_enabled ? s.status : "disabled";
    if (!statusGroups[key]) statusGroups[key] = [];
    statusGroups[key].push(s);
  });

  const allHealthy = !statusGroups.error?.length && !statusGroups.degraded?.length;

  return (
    <div className="space-y-5 mt-4">
      {/* Overall Status */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
        className={`glass rounded-xl neural-border p-5 ${allHealthy ? "border-success/30" : "border-warning/30"}`}>
        <div className="flex items-center gap-3">
          {allHealthy ? (
            <CheckCircle2 className="w-8 h-8 text-success" />
          ) : (
            <AlertTriangle className="w-8 h-8 text-warning" />
          )}
          <div>
            <h3 className="text-lg font-bold text-foreground">
              {allHealthy ? "All Systems Operational" : "Some Services Need Attention"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {services.filter(s => s.is_enabled).length} active services monitored
            </p>
          </div>
        </div>
      </motion.div>

      {/* Service Status Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {services.map((s, i) => {
          const cat = CATEGORY_META[s.category] || CATEGORY_META.ai;
          const CatIcon = cat.icon;
          const isHealthy = s.is_enabled && s.status === "active";

          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className={`glass rounded-xl p-4 neural-border ${!s.is_enabled ? "opacity-50" : ""}`}>
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CatIcon className={`w-4 h-4 ${cat.color}`} />
                  <span className="text-xs font-semibold text-foreground">{s.display_name}</span>
                </div>
                <div className={`w-3 h-3 rounded-full ${isHealthy ? "bg-success animate-pulse" : !s.is_enabled ? "bg-muted-foreground" : "bg-warning animate-pulse"}`} />
              </div>
              <div className="grid grid-cols-2 gap-2 text-[10px]">
                <div>
                  <span className="text-muted-foreground">Status</span>
                  <p className={`font-medium ${isHealthy ? "text-success" : !s.is_enabled ? "text-muted-foreground" : "text-warning"}`}>
                    {!s.is_enabled ? "Disabled" : s.status.charAt(0).toUpperCase() + s.status.slice(1)}
                  </p>
                </div>
                <div>
                  <span className="text-muted-foreground">Last Updated</span>
                  <p className="text-foreground">{formatDistanceToNow(new Date(s.updated_at), { addSuffix: true })}</p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── SECRET KEYS TAB ───
const SecretKeysTab = () => {
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [revealedSecrets, setRevealedSecrets] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_integrations").select("*").order("category");
      setServices((data || []) as ServiceIntegration[]);
      setLoading(false);
    })();
  }, []);

  const toggleReveal = (id: string) => {
    setRevealedSecrets(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Security Notice */}
      <div className="glass rounded-xl neural-border p-4 border-primary/20">
        <div className="flex items-start gap-3">
          <Shield className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Secret Key Management</h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Secret keys are stored securely as environment variables in the backend. They cannot be viewed from the dashboard.
              To update a key, use the Cloud secrets management interface.
            </p>
          </div>
        </div>
      </div>

      {/* Keys List */}
      <div className="space-y-2">
        {services.map((s, i) => {
          const cat = CATEGORY_META[s.category] || CATEGORY_META.ai;
          const CatIcon = cat.icon;
          const secrets = [s.config?.secret_name, s.config?.secret_name_2].filter(Boolean);
          const isRevealed = revealedSecrets.has(s.id);

          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass rounded-xl neural-border p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <CatIcon className={`w-4 h-4 ${cat.color}`} />
                  <span className="text-sm font-semibold text-foreground">{s.display_name}</span>
                  {s.config?.managed_by_connector && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-accent/15 text-accent font-medium">Connector</span>
                  )}
                </div>
                <button onClick={() => toggleReveal(s.id)} className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors">
                  {isRevealed ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
              <div className="space-y-2">
                {secrets.map((secret: string) => (
                  <div key={secret} className="flex items-center gap-2 bg-secondary/30 rounded-lg px-3 py-2">
                    <Lock className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs font-mono text-foreground flex-1">
                      {isRevealed ? secret : "••••••••••••"}
                    </span>
                    <button onClick={() => { navigator.clipboard.writeText(secret); }}
                      className="p-1 rounded hover:bg-secondary transition-colors">
                      <Copy className="w-3 h-3 text-muted-foreground" />
                    </button>
                  </div>
                ))}
              </div>
              {s.key_last_updated_at && (
                <p className="text-[10px] text-muted-foreground mt-2">
                  Key updated {formatDistanceToNow(new Date(s.key_last_updated_at), { addSuffix: true })}
                </p>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── SERVICE DOCS TAB ───
const ServiceDocsTab = () => {
  const [services, setServices] = useState<ServiceIntegration[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_integrations").select("*").order("category");
      setServices((data || []) as ServiceIntegration[]);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="glass rounded-xl neural-border p-4">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary" /> Service Documentation & Resources
        </h3>
        <p className="text-[11px] text-muted-foreground mb-4">Quick access to official documentation, pricing pages, and API references for all connected services.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {services.map((s, i) => {
          const cat = CATEGORY_META[s.category] || CATEGORY_META.ai;
          const CatIcon = cat.icon;

          return (
            <motion.div key={s.id} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
              className="glass rounded-xl neural-border p-4 hover:border-primary/30 transition-all">
              <div className="flex items-center gap-2.5 mb-3">
                <div className={`w-9 h-9 rounded-lg bg-gradient-to-br ${cat.gradient} flex items-center justify-center`}>
                  <CatIcon className={`w-4 h-4 ${cat.color}`} />
                </div>
                <div>
                  <h4 className="text-sm font-semibold text-foreground">{s.display_name}</h4>
                  <span className="text-[10px] text-muted-foreground">{cat.label}</span>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground mb-3 line-clamp-2">{s.description}</p>

              <div className="flex flex-wrap gap-2">
                {s.config?.docs_url && (
                  <a href={s.config.docs_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors font-medium">
                    <FileText className="w-3 h-3" /> Documentation <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
                {s.config?.pricing_url && (
                  <a href={s.config.pricing_url} target="_blank" rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[10px] px-2.5 py-1.5 rounded-lg bg-warning/10 text-warning hover:bg-warning/20 transition-colors font-medium">
                    <DollarSign className="w-3 h-3" /> Pricing <ExternalLink className="w-2.5 h-2.5" />
                  </a>
                )}
              </div>

              {/* Edge functions */}
              {s.config?.used_in && (
                <div className="mt-3 pt-2 border-t border-border/50">
                  <p className="text-[10px] text-muted-foreground mb-1">Used in:</p>
                  <div className="flex flex-wrap gap-1">
                    {(s.config.used_in as string[]).map((fn: string) => (
                      <span key={fn} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground font-mono">{fn}</span>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default ThirdPartyServices;
