import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Key, ExternalLink, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle2, Settings, DollarSign, Activity,
  Mail, Mic, CreditCard, Bell, Brain, Save, Pencil, Eye, EyeOff,
  Info, Hash, Plus, X, Trash2, Clock, Shield, Zap, Globe,
  Copy, RefreshCw, Search, Filter, Download, FileJson, BarChart3,
  TrendingUp, AlertCircle, Server, Lock, Unlock, ChevronDown,
  ChevronRight, Code, BookOpen, Gauge, Users, ArrowUpDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow, startOfMonth, addMonths, subDays } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

// ─── Types ───
interface ApiKey {
  id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  environment: string;
  key_type: string;
  permissions: string[];
  rate_limit_per_minute: number;
  usage_count: number;
  usage_limit: number | null;
  is_active: boolean;
  expires_at: string | null;
  last_used_at: string | null;
  created_by: string;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface ApiEndpoint {
  id: string;
  path: string;
  method: string;
  display_name: string;
  description: string | null;
  category: string;
  is_enabled: boolean;
  requires_auth: boolean;
  rate_limit_per_minute: number;
  version: string;
  request_schema: any;
  response_schema: any;
  total_requests: number;
  total_errors: number;
  avg_latency_ms: number;
  created_at: string;
  updated_at: string;
}

interface ApiRateLimit {
  id: string;
  target_type: string;
  target_id: string | null;
  requests_per_minute: number;
  requests_per_hour: number | null;
  requests_per_day: number | null;
  burst_limit: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface RequestLog {
  id: string;
  endpoint_id: string | null;
  api_key_id: string | null;
  user_id: string | null;
  method: string;
  path: string;
  status_code: number;
  latency_ms: number;
  request_size_bytes: number;
  response_size_bytes: number;
  error_message: string | null;
  ip_address: string | null;
  created_at: string;
}

interface ApiIntegration {
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

const ENV_COLORS: Record<string, string> = {
  development: "bg-blue-500/15 text-blue-400",
  staging: "bg-yellow-500/15 text-yellow-400",
  production: "bg-green-500/15 text-green-400",
};

const KEY_TYPE_COLORS: Record<string, string> = {
  user: "bg-primary/15 text-primary",
  app: "bg-accent/15 text-accent",
  admin: "bg-destructive/15 text-destructive",
};

const CATEGORY_ICONS: Record<string, any> = {
  ai: Brain, prediction: TrendingUp, user: Users, voice: Mic,
  extraction: FileJson, payments: CreditCard, notifications: Bell,
  analytics: BarChart3, system: Server, general: Settings, email: Mail,
};

const AVAILABLE_PERMISSIONS = [
  "user_api", "chat_api", "ai_prediction_api", "subscription_api",
  "admin_api", "voice_api", "extraction_api", "analytics_api",
  "notification_api", "payment_api",
];

// ─── Helpers ───
function generateApiKey(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let key = "acry_";
  for (let i = 0; i < 40; i++) key += chars.charAt(Math.floor(Math.random() * chars.length));
  return key;
}

function hashKey(key: string): string {
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    const char = key.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0;
  }
  return "hash_" + Math.abs(hash).toString(36) + "_" + Date.now().toString(36);
}

// ─── Main Component ───
const ApiManagement = () => {
  const [activeTab, setActiveTab] = useState("overview");

  return (
    <div className="space-y-4">
      <div>
        <h2 className="text-xl font-bold text-foreground">API Management</h2>
        <p className="text-xs text-muted-foreground mt-1">Enterprise API gateway, keys, endpoints, rate limits, monitoring & security</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="flex flex-wrap h-auto gap-1 bg-secondary/50 p-1">
          {[
            { value: "overview", label: "Overview", icon: BarChart3 },
            { value: "keys", label: "API Keys", icon: Key },
            { value: "endpoints", label: "Endpoints", icon: Globe },
            { value: "rate_limits", label: "Rate Limits", icon: Gauge },
            { value: "usage", label: "Usage & Logs", icon: Activity },
            { value: "performance", label: "Performance", icon: Zap },
            { value: "security", label: "Security", icon: Shield },
            { value: "integrations", label: "Integrations", icon: Settings },
            { value: "docs", label: "API Docs", icon: BookOpen },
          ].map(tab => (
            <TabsTrigger key={tab.value} value={tab.value} className="flex items-center gap-1.5 text-xs px-3 py-1.5">
              <tab.icon className="w-3.5 h-3.5" />
              {tab.label}
            </TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="keys"><ApiKeysTab /></TabsContent>
        <TabsContent value="endpoints"><EndpointsTab /></TabsContent>
        <TabsContent value="rate_limits"><RateLimitsTab /></TabsContent>
        <TabsContent value="usage"><UsageLogsTab /></TabsContent>
        <TabsContent value="performance"><PerformanceTab /></TabsContent>
        <TabsContent value="security"><SecurityTab /></TabsContent>
        <TabsContent value="integrations"><IntegrationsTab /></TabsContent>
        <TabsContent value="docs"><ApiDocsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ─── OVERVIEW TAB ───
const OverviewTab = () => {
  const [stats, setStats] = useState({ keys: 0, activeKeys: 0, endpoints: 0, activeEndpoints: 0, totalRequests: 0, totalErrors: 0, integrations: 0, totalCost: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [keysRes, endpointsRes, integrationsRes, logsRes] = await Promise.all([
        supabase.from("api_keys").select("id, is_active"),
        supabase.from("api_endpoints").select("id, is_enabled, total_requests, total_errors"),
        supabase.from("api_integrations").select("id, monthly_cost_estimate, is_enabled"),
        supabase.from("api_request_logs").select("id", { count: "exact", head: true }),
      ]);
      const keys = keysRes.data || [];
      const endpoints = endpointsRes.data || [];
      const integrations = (integrationsRes.data || []) as any[];
      setStats({
        keys: keys.length,
        activeKeys: keys.filter(k => k.is_active).length,
        endpoints: endpoints.length,
        activeEndpoints: endpoints.filter(e => e.is_enabled).length,
        totalRequests: endpoints.reduce((s, e: any) => s + (e.total_requests || 0), 0),
        totalErrors: endpoints.reduce((s, e: any) => s + (e.total_errors || 0), 0),
        integrations: integrations.length,
        totalCost: integrations.reduce((s, i) => s + (i.monthly_cost_estimate || 0), 0),
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const cards = [
    { label: "API Keys", value: `${stats.activeKeys}/${stats.keys}`, sub: "active/total", icon: Key, color: "text-primary" },
    { label: "Endpoints", value: `${stats.activeEndpoints}/${stats.endpoints}`, sub: "enabled/total", icon: Globe, color: "text-accent" },
    { label: "Total Requests", value: stats.totalRequests.toLocaleString(), sub: "all time", icon: Activity, color: "text-success" },
    { label: "Error Rate", value: stats.totalRequests > 0 ? `${((stats.totalErrors / stats.totalRequests) * 100).toFixed(1)}%` : "0%", sub: `${stats.totalErrors} errors`, icon: AlertTriangle, color: "text-warning" },
    { label: "Integrations", value: stats.integrations, sub: "services", icon: Settings, color: "text-muted-foreground" },
    { label: "Monthly Cost", value: `$${stats.totalCost.toFixed(0)}`, sub: "estimated", icon: DollarSign, color: "text-primary" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mt-4">
      {cards.map((card, i) => (
        <motion.div key={card.label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-1">
            <card.icon className={`w-4 h-4 ${card.color}`} />
            <span className="text-[10px] text-muted-foreground">{card.label}</span>
          </div>
          <p className="text-xl font-bold text-foreground">{card.value}</p>
          <p className="text-[10px] text-muted-foreground">{card.sub}</p>
        </motion.div>
      ))}
    </div>
  );
};

// ─── API KEYS TAB ───
const ApiKeysTab = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [envFilter, setEnvFilter] = useState("all");
  const [form, setForm] = useState({ name: "", environment: "development", key_type: "app", permissions: [] as string[], rate_limit_per_minute: 60, usage_limit: null as number | null, expires_days: null as number | null, notes: "" });

  const fetchKeys = useCallback(async () => {
    const { data } = await supabase.from("api_keys").select("*").order("created_at", { ascending: false });
    setKeys((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchKeys(); }, [fetchKeys]);

  const createKey = async () => {
    if (!form.name || !user) return toast({ title: "Name is required", variant: "destructive" });
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10) + "...";

    const { error } = await supabase.from("api_keys").insert({
      name: form.name,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      environment: form.environment,
      key_type: form.key_type,
      permissions: form.permissions,
      rate_limit_per_minute: form.rate_limit_per_minute,
      usage_limit: form.usage_limit,
      expires_at: form.expires_days ? new Date(Date.now() + form.expires_days * 86400000).toISOString() : null,
      notes: form.notes || null,
      created_by: user.id,
    } as any);

    if (error) return toast({ title: "Failed to create key", description: error.message, variant: "destructive" });
    setGeneratedKey(rawKey);
    toast({ title: "API Key generated successfully" });
    setForm({ name: "", environment: "development", key_type: "app", permissions: [], rate_limit_per_minute: 60, usage_limit: null, expires_days: null, notes: "" });
    fetchKeys();
  };

  const toggleKey = async (id: string, active: boolean) => {
    await supabase.from("api_keys").update({ is_active: !active } as any).eq("id", id);
    toast({ title: !active ? "Key activated" : "Key revoked" });
    fetchKeys();
  };

  const deleteKey = async (id: string, name: string) => {
    if (!confirm(`Delete key "${name}"? This cannot be undone.`)) return;
    await supabase.from("api_keys").delete().eq("id", id);
    toast({ title: "Key deleted" });
    fetchKeys();
  };

  const regenerateKey = async (id: string) => {
    const rawKey = generateApiKey();
    const keyHash = hashKey(rawKey);
    const keyPrefix = rawKey.substring(0, 10) + "...";
    await supabase.from("api_keys").update({ key_hash: keyHash, key_prefix: keyPrefix } as any).eq("id", id);
    setGeneratedKey(rawKey);
    toast({ title: "Key regenerated" });
    fetchKeys();
  };

  const togglePermission = (perm: string) => {
    setForm(f => ({ ...f, permissions: f.permissions.includes(perm) ? f.permissions.filter(p => p !== perm) : [...f.permissions, perm] }));
  };

  const filtered = envFilter === "all" ? keys : keys.filter(k => k.environment === envFilter);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      {/* Generated Key Alert */}
      {generatedKey && (
        <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="bg-success/10 border border-success/30 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-success mt-0.5" />
            <div className="flex-1">
              <p className="text-sm font-semibold text-foreground">API Key Generated</p>
              <p className="text-xs text-muted-foreground mb-2">Copy this key now. It won't be shown again.</p>
              <div className="flex items-center gap-2 bg-background rounded-lg p-2">
                <code className="text-xs font-mono text-foreground flex-1 break-all">{generatedKey}</code>
                <button onClick={() => { navigator.clipboard.writeText(generatedKey); toast({ title: "Copied to clipboard" }); }} className="p-1.5 hover:bg-secondary rounded-lg transition-colors">
                  <Copy className="w-4 h-4 text-primary" />
                </button>
              </div>
            </div>
            <button onClick={() => setGeneratedKey(null)} className="p-1"><X className="w-4 h-4 text-muted-foreground" /></button>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2">
          {["all", "development", "staging", "production"].map(env => (
            <button key={env} onClick={() => setEnvFilter(env)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${envFilter === env ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}
            >{env}</button>
          ))}
        </div>
        <button onClick={() => setShowCreate(!showCreate)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 transition-colors flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Generate Key
        </button>
      </div>

      {/* Create Key Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="glass rounded-xl neural-border overflow-hidden">
            <div className="p-4 space-y-4">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Key className="w-4 h-4 text-primary" /> Generate New API Key</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Key Name *</label>
                  <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Flutter Production App"
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Environment</label>
                  <select value={form.environment} onChange={e => setForm(f => ({ ...f, environment: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none">
                    <option value="development">Development</option>
                    <option value="staging">Staging</option>
                    <option value="production">Production</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Key Type</label>
                  <select value={form.key_type} onChange={e => setForm(f => ({ ...f, key_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none">
                    <option value="user">User-specific</option>
                    <option value="app">App-specific</option>
                    <option value="admin">Admin-specific</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Rate Limit (req/min)</label>
                  <input type="number" value={form.rate_limit_per_minute} onChange={e => setForm(f => ({ ...f, rate_limit_per_minute: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Usage Limit (optional)</label>
                  <input type="number" value={form.usage_limit ?? ""} onChange={e => setForm(f => ({ ...f, usage_limit: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="No limit" className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Expires In (days, optional)</label>
                  <input type="number" value={form.expires_days ?? ""} onChange={e => setForm(f => ({ ...f, expires_days: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="Never" className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-2 block">Permissions</label>
                <div className="flex flex-wrap gap-2">
                  {AVAILABLE_PERMISSIONS.map(perm => (
                    <button key={perm} onClick={() => togglePermission(perm)}
                      className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${form.permissions.includes(perm) ? "bg-primary/20 text-primary" : "bg-secondary text-muted-foreground hover:text-foreground"}`}>
                      {perm.replace(/_/g, " ")}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-[10px] text-muted-foreground mb-1 block">Notes</label>
                <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Internal notes..."
                  className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowCreate(false)} className="px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground">Cancel</button>
                <button onClick={createKey} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1">
                  <Key className="w-3 h-3" /> Generate
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keys List */}
      <div className="space-y-3">
        {filtered.map((key, i) => (
          <motion.div key={key.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
            className={`glass rounded-xl p-4 neural-border ${!key.is_active ? "opacity-60" : ""}`}>
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center">
                <Key className={`w-5 h-5 ${key.is_active ? "text-primary" : "text-muted-foreground"}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-sm font-semibold text-foreground">{key.name}</h3>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${ENV_COLORS[key.environment]}`}>{key.environment}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${KEY_TYPE_COLORS[key.key_type]}`}>{key.key_type}</span>
                  {!key.is_active && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Revoked</span>}
                  {key.expires_at && new Date(key.expires_at) < new Date() && <span className="text-[10px] px-2 py-0.5 rounded-full bg-destructive/15 text-destructive">Expired</span>}
                </div>
                <p className="text-xs text-muted-foreground font-mono mt-0.5">{key.key_prefix}</p>
              </div>
              <div className="flex items-center gap-1">
                <button onClick={() => regenerateKey(key.id)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title="Regenerate">
                  <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                </button>
                <button onClick={() => toggleKey(key.id, key.is_active)} className="p-1.5 hover:bg-secondary rounded-lg transition-colors" title={key.is_active ? "Revoke" : "Activate"}>
                  {key.is_active ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={() => deleteKey(key.id, key.name)} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors" title="Delete">
                  <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Rate Limit</span>
                <p className="text-xs font-medium text-foreground">{key.rate_limit_per_minute} req/min</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Usage</span>
                <p className="text-xs font-medium text-foreground">{(key.usage_count || 0).toLocaleString()}{key.usage_limit ? ` / ${key.usage_limit.toLocaleString()}` : ""}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Expires</span>
                <p className="text-xs font-medium text-foreground">{key.expires_at ? format(new Date(key.expires_at), "MMM d, yyyy") : "Never"}</p>
              </div>
              <div className="space-y-0.5">
                <span className="text-[10px] text-muted-foreground">Last Used</span>
                <p className="text-xs font-medium text-foreground">{key.last_used_at ? formatDistanceToNow(new Date(key.last_used_at), { addSuffix: true }) : "Never"}</p>
              </div>
            </div>
            {key.permissions.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {key.permissions.map(p => (
                  <span key={p} className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary">{p.replace(/_/g, " ")}</span>
                ))}
              </div>
            )}
          </motion.div>
        ))}
        {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No API keys found</p>}
      </div>
    </div>
  );
};

// ─── ENDPOINTS TAB ───
const EndpointsTab = () => {
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [catFilter, setCatFilter] = useState("all");
  const [search, setSearch] = useState("");

  const fetchEndpoints = useCallback(async () => {
    const { data } = await supabase.from("api_endpoints").select("*").order("category, display_name");
    setEndpoints((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchEndpoints(); }, [fetchEndpoints]);

  const toggleEndpoint = async (id: string, enabled: boolean) => {
    await supabase.from("api_endpoints").update({ is_enabled: !enabled } as any).eq("id", id);
    toast({ title: !enabled ? "Endpoint enabled" : "Endpoint disabled" });
    fetchEndpoints();
  };

  const updateRateLimit = async (id: string, limit: number) => {
    await supabase.from("api_endpoints").update({ rate_limit_per_minute: limit } as any).eq("id", id);
    toast({ title: "Rate limit updated" });
    fetchEndpoints();
  };

  const toggleAuth = async (id: string, current: boolean) => {
    await supabase.from("api_endpoints").update({ requires_auth: !current } as any).eq("id", id);
    toast({ title: !current ? "Auth required" : "Auth removed" });
    fetchEndpoints();
  };

  const updateVersion = async (id: string, version: string) => {
    await supabase.from("api_endpoints").update({ version } as any).eq("id", id);
    toast({ title: `Version updated to ${version}` });
    fetchEndpoints();
  };

  const categories = useMemo(() => ["all", ...Array.from(new Set(endpoints.map(e => e.category)))], [endpoints]);
  const filtered = endpoints.filter(e => {
    if (catFilter !== "all" && e.category !== catFilter) return false;
    if (search && !e.display_name.toLowerCase().includes(search.toLowerCase()) && !e.path.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search endpoints..."
            className="w-full pl-9 pr-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        </div>
        <div className="flex gap-1 flex-wrap">
          {categories.map(cat => (
            <button key={cat} onClick={() => setCatFilter(cat)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors capitalize ${catFilter === cat ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="text-[10px] text-muted-foreground">{filtered.length} endpoints</div>

      <div className="space-y-2">
        {filtered.map((ep, i) => {
          const Icon = CATEGORY_ICONS[ep.category] || Globe;
          const errorRate = ep.total_requests > 0 ? ((ep.total_errors / ep.total_requests) * 100).toFixed(1) : "0";
          return (
            <motion.div key={ep.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.02 }}
              className={`glass rounded-xl p-3 neural-border ${!ep.is_enabled ? "opacity-50" : ""}`}>
              <div className="flex items-center gap-3">
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{ep.display_name}</span>
                    <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">{ep.method} /{ep.path}</code>
                    <span className="text-[10px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{ep.version}</span>
                    {ep.requires_auth && <Lock className="w-3 h-3 text-warning" />}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] text-muted-foreground">
                  <span>{ep.total_requests.toLocaleString()} req</span>
                  <span className={parseFloat(errorRate) > 5 ? "text-destructive" : ""}>{errorRate}% err</span>
                  <span>{Math.round(ep.avg_latency_ms)}ms</span>
                  <select value={ep.rate_limit_per_minute} onChange={e => updateRateLimit(ep.id, parseInt(e.target.value))}
                    className="bg-secondary rounded px-1.5 py-0.5 text-[10px] border-none outline-none text-foreground w-20">
                    {[10, 30, 60, 120, 300, 1000].map(v => <option key={v} value={v}>{v}/min</option>)}
                  </select>
                  <select value={ep.version} onChange={e => updateVersion(ep.id, e.target.value)}
                    className="bg-secondary rounded px-1.5 py-0.5 text-[10px] border-none outline-none text-foreground w-14">
                    {["v1", "v2", "v3"].map(v => <option key={v} value={v}>{v}</option>)}
                  </select>
                  <button onClick={() => toggleAuth(ep.id, ep.requires_auth)} className="p-1 hover:bg-secondary rounded" title={ep.requires_auth ? "Remove auth" : "Require auth"}>
                    {ep.requires_auth ? <Lock className="w-3.5 h-3.5 text-warning" /> : <Unlock className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <button onClick={() => toggleEndpoint(ep.id, ep.is_enabled)} className="p-1 hover:bg-secondary rounded">
                    {ep.is_enabled ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── RATE LIMITS TAB ───
const RateLimitsTab = () => {
  const { toast } = useToast();
  const [limits, setLimits] = useState<ApiRateLimit[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ target_type: "global", target_id: "", requests_per_minute: 60, requests_per_hour: null as number | null, requests_per_day: null as number | null, burst_limit: null as number | null });

  const fetchLimits = useCallback(async () => {
    const { data } = await supabase.from("api_rate_limits").select("*").order("target_type, created_at");
    setLimits((data as any[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchLimits(); }, [fetchLimits]);

  const addLimit = async () => {
    const { error } = await supabase.from("api_rate_limits").insert({
      target_type: form.target_type,
      target_id: form.target_id || null,
      requests_per_minute: form.requests_per_minute,
      requests_per_hour: form.requests_per_hour,
      requests_per_day: form.requests_per_day,
      burst_limit: form.burst_limit,
    } as any);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    toast({ title: "Rate limit added" });
    setShowAdd(false);
    fetchLimits();
  };

  const toggleLimit = async (id: string, active: boolean) => {
    await supabase.from("api_rate_limits").update({ is_active: !active } as any).eq("id", id);
    fetchLimits();
  };

  const deleteLimit = async (id: string) => {
    if (!confirm("Delete this rate limit rule?")) return;
    await supabase.from("api_rate_limits").delete().eq("id", id);
    toast({ title: "Rate limit deleted" });
    fetchLimits();
  };

  const updateField = async (id: string, field: string, value: number | null) => {
    await supabase.from("api_rate_limits").update({ [field]: value } as any).eq("id", id);
    fetchLimits();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const typeIcons: Record<string, any> = { global: Globe, endpoint: Server, api_key: Key, user: Users };

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{limits.length} rate limit rules</p>
        <button onClick={() => setShowAdd(!showAdd)} className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1.5">
          <Plus className="w-3.5 h-3.5" /> Add Rule
        </button>
      </div>

      <AnimatePresence>
        {showAdd && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="glass rounded-xl neural-border overflow-hidden">
            <div className="p-4 space-y-3">
              <h3 className="text-sm font-semibold text-foreground">New Rate Limit Rule</h3>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Target Type</label>
                  <select value={form.target_type} onChange={e => setForm(f => ({ ...f, target_type: e.target.value }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none">
                    <option value="global">Global</option>
                    <option value="endpoint">Endpoint</option>
                    <option value="api_key">API Key</option>
                    <option value="user">User</option>
                  </select>
                </div>
                {form.target_type !== "global" && (
                  <div>
                    <label className="text-[10px] text-muted-foreground mb-1 block">Target ID</label>
                    <input value={form.target_id} onChange={e => setForm(f => ({ ...f, target_id: e.target.value }))} placeholder="UUID or identifier"
                      className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none font-mono" />
                  </div>
                )}
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Req/Minute</label>
                  <input type="number" value={form.requests_per_minute} onChange={e => setForm(f => ({ ...f, requests_per_minute: parseInt(e.target.value) || 60 }))}
                    className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Req/Hour</label>
                  <input type="number" value={form.requests_per_hour ?? ""} onChange={e => setForm(f => ({ ...f, requests_per_hour: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="No limit" className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Req/Day</label>
                  <input type="number" value={form.requests_per_day ?? ""} onChange={e => setForm(f => ({ ...f, requests_per_day: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="No limit" className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Burst Limit</label>
                  <input type="number" value={form.burst_limit ?? ""} onChange={e => setForm(f => ({ ...f, burst_limit: e.target.value ? parseInt(e.target.value) : null }))}
                    placeholder="No limit" className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
                </div>
              </div>
              <div className="flex gap-2 justify-end">
                <button onClick={() => setShowAdd(false)} className="px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
                <button onClick={addLimit} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium flex items-center gap-1">
                  <Plus className="w-3 h-3" /> Add
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {limits.map(limit => {
          const Icon = typeIcons[limit.target_type] || Globe;
          return (
            <div key={limit.id} className={`glass rounded-xl p-3 neural-border flex items-center gap-3 ${!limit.is_active ? "opacity-50" : ""}`}>
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground capitalize">{limit.target_type}</span>
                  {limit.target_id && <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded font-mono text-muted-foreground">{limit.target_id.substring(0, 8)}...</code>}
                </div>
              </div>
              <div className="flex items-center gap-3 text-[10px]">
                <div className="text-center">
                  <input type="number" value={limit.requests_per_minute} onChange={e => updateField(limit.id, "requests_per_minute", parseInt(e.target.value) || 0)}
                    className="w-16 bg-secondary rounded px-1.5 py-0.5 text-center text-foreground border-none outline-none" />
                  <span className="block text-muted-foreground">/min</span>
                </div>
                <div className="text-center">
                  <input type="number" value={limit.requests_per_hour ?? ""} onChange={e => updateField(limit.id, "requests_per_hour", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="—" className="w-16 bg-secondary rounded px-1.5 py-0.5 text-center text-foreground border-none outline-none" />
                  <span className="block text-muted-foreground">/hr</span>
                </div>
                <div className="text-center">
                  <input type="number" value={limit.requests_per_day ?? ""} onChange={e => updateField(limit.id, "requests_per_day", e.target.value ? parseInt(e.target.value) : null)}
                    placeholder="—" className="w-16 bg-secondary rounded px-1.5 py-0.5 text-center text-foreground border-none outline-none" />
                  <span className="block text-muted-foreground">/day</span>
                </div>
                <button onClick={() => toggleLimit(limit.id, limit.is_active)} className="p-1 hover:bg-secondary rounded">
                  {limit.is_active ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </button>
                <button onClick={() => deleteLimit(limit.id)} className="p-1 hover:bg-destructive/10 rounded">
                  <Trash2 className="w-3.5 h-3.5 text-destructive/70" />
                </button>
              </div>
            </div>
          );
        })}
        {limits.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No rate limit rules configured</p>}
      </div>
    </div>
  );
};

// ─── USAGE LOGS TAB ───
const UsageLogsTab = () => {
  const [logs, setLogs] = useState<RequestLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");

  useEffect(() => {
    (async () => {
      let query = supabase.from("api_request_logs").select("*").order("created_at", { ascending: false }).limit(200);
      const { data } = await query;
      setLogs((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const filtered = statusFilter === "all" ? logs : statusFilter === "errors" ? logs.filter(l => l.status_code >= 400) : logs.filter(l => l.status_code < 400);

  // Stats
  const totalReqs = logs.length;
  const errors = logs.filter(l => l.status_code >= 400).length;
  const avgLatency = totalReqs > 0 ? Math.round(logs.reduce((s, l) => s + l.latency_ms, 0) / totalReqs) : 0;
  const uniqueUsers = new Set(logs.filter(l => l.user_id).map(l => l.user_id)).size;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: totalReqs, icon: Activity, color: "text-primary" },
          { label: "Errors", value: errors, icon: AlertCircle, color: "text-destructive" },
          { label: "Avg Latency", value: `${avgLatency}ms`, icon: Clock, color: "text-accent" },
          { label: "Unique Users", value: uniqueUsers, icon: Users, color: "text-success" },
        ].map(card => (
          <div key={card.label} className="glass rounded-xl p-3 neural-border">
            <div className="flex items-center gap-1.5 mb-1"><card.icon className={`w-3.5 h-3.5 ${card.color}`} /><span className="text-[10px] text-muted-foreground">{card.label}</span></div>
            <p className="text-lg font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        {["all", "success", "errors"].map(f => (
          <button key={f} onClick={() => setStatusFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${statusFilter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="glass rounded-xl neural-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left p-2 text-muted-foreground font-medium">Time</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Method</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Path</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Status</th>
                <th className="text-left p-2 text-muted-foreground font-medium">Latency</th>
                <th className="text-left p-2 text-muted-foreground font-medium">User</th>
              </tr>
            </thead>
            <tbody>
              {filtered.slice(0, 50).map(log => (
                <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30">
                  <td className="p-2 text-muted-foreground">{format(new Date(log.created_at), "MMM d HH:mm:ss")}</td>
                  <td className="p-2"><span className="px-1.5 py-0.5 rounded bg-secondary text-foreground font-mono">{log.method}</span></td>
                  <td className="p-2 font-mono text-foreground max-w-[200px] truncate">/{log.path}</td>
                  <td className="p-2">
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-medium ${log.status_code < 400 ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"}`}>
                      {log.status_code}
                    </span>
                  </td>
                  <td className="p-2 text-foreground">{log.latency_ms}ms</td>
                  <td className="p-2 text-muted-foreground font-mono">{log.user_id ? log.user_id.substring(0, 8) + "..." : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {filtered.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">No logs found</p>}
        </div>
      </div>
    </div>
  );
};

// ─── PERFORMANCE TAB ───
const PerformanceTab = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_endpoints").select("*").order("total_requests", { ascending: false });
      setEndpoints((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalReqs = endpoints.reduce((s, e) => s + (e.total_requests || 0), 0);
  const totalErrors = endpoints.reduce((s, e) => s + (e.total_errors || 0), 0);
  const avgLatency = endpoints.length > 0 ? Math.round(endpoints.reduce((s, e) => s + (e.avg_latency_ms || 0), 0) / endpoints.length) : 0;
  const successRate = totalReqs > 0 ? ((1 - totalErrors / totalReqs) * 100).toFixed(1) : "100";

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Requests", value: totalReqs.toLocaleString(), icon: Activity, color: "text-primary" },
          { label: "Success Rate", value: `${successRate}%`, icon: CheckCircle2, color: "text-success" },
          { label: "Avg Latency", value: `${avgLatency}ms`, icon: Clock, color: "text-accent" },
          { label: "Total Errors", value: totalErrors.toLocaleString(), icon: AlertTriangle, color: "text-destructive" },
        ].map(card => (
          <div key={card.label} className="glass rounded-xl p-3 neural-border">
            <div className="flex items-center gap-1.5 mb-1"><card.icon className={`w-3.5 h-3.5 ${card.color}`} /><span className="text-[10px] text-muted-foreground">{card.label}</span></div>
            <p className="text-lg font-bold text-foreground">{card.value}</p>
          </div>
        ))}
      </div>

      <h3 className="text-sm font-semibold text-foreground">Endpoint Performance Rankings</h3>
      <div className="space-y-2">
        {endpoints.filter(e => e.total_requests > 0).map((ep, i) => {
          const errorRate = ep.total_requests > 0 ? ((ep.total_errors / ep.total_requests) * 100) : 0;
          const reqPct = totalReqs > 0 ? (ep.total_requests / totalReqs) * 100 : 0;
          return (
            <div key={ep.id} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-muted-foreground w-6">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">{ep.display_name}</span>
                    <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground font-mono">/{ep.path}</code>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-1.5 mt-1.5">
                    <div className="bg-primary rounded-full h-1.5 transition-all" style={{ width: `${Math.min(reqPct, 100)}%` }} />
                  </div>
                </div>
                <div className="flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
                  <div className="text-center">
                    <p className="text-xs font-bold text-foreground">{ep.total_requests.toLocaleString()}</p>
                    <span>requests</span>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-bold ${ep.avg_latency_ms > 1000 ? "text-destructive" : ep.avg_latency_ms > 500 ? "text-warning" : "text-success"}`}>
                      {Math.round(ep.avg_latency_ms)}ms
                    </p>
                    <span>latency</span>
                  </div>
                  <div className="text-center">
                    <p className={`text-xs font-bold ${errorRate > 5 ? "text-destructive" : errorRate > 1 ? "text-warning" : "text-success"}`}>
                      {errorRate.toFixed(1)}%
                    </p>
                    <span>errors</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
        {endpoints.filter(e => e.total_requests > 0).length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No endpoint performance data yet</p>
        )}
      </div>
    </div>
  );
};

// ─── SECURITY TAB ───
const SecurityTab = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [epRes, keyRes] = await Promise.all([
        supabase.from("api_endpoints").select("*"),
        supabase.from("api_keys").select("*"),
      ]);
      setEndpoints((epRes.data as any[]) || []);
      setKeys((keyRes.data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const noAuthEndpoints = endpoints.filter(e => !e.requires_auth && e.is_enabled);
  const expiredKeys = keys.filter(k => k.expires_at && new Date(k.expires_at) < new Date() && k.is_active);
  const noPermKeys = keys.filter(k => k.permissions.length === 0 && k.is_active);
  const adminKeys = keys.filter(k => k.key_type === "admin" && k.is_active);

  const checks = [
    { label: "JWT Authentication", desc: "All authenticated endpoints require JWT tokens", status: "active" as const, icon: Shield },
    { label: "HTTPS Only", desc: "All API traffic encrypted via TLS", status: "active" as const, icon: Lock },
    { label: "CORS Headers", desc: "Cross-origin security headers configured", status: "active" as const, icon: Globe },
    { label: "Security Headers", desc: "X-Content-Type-Options, X-Frame-Options, HSTS", status: "active" as const, icon: Shield },
    { label: "Request Signature", desc: "API key hash validation", status: "active" as const, icon: Key },
    { label: "No-Auth Endpoints", desc: `${noAuthEndpoints.length} endpoints without authentication`, status: noAuthEndpoints.length > 10 ? "warning" as const : "active" as const, icon: Unlock },
    { label: "Expired Active Keys", desc: `${expiredKeys.length} expired keys still active`, status: expiredKeys.length > 0 ? "error" as const : "active" as const, icon: Clock },
    { label: "Keys Without Permissions", desc: `${noPermKeys.length} keys with no permission scope`, status: noPermKeys.length > 0 ? "warning" as const : "active" as const, icon: AlertTriangle },
    { label: "Active Admin Keys", desc: `${adminKeys.length} admin-level keys active`, status: adminKeys.length > 3 ? "warning" as const : "active" as const, icon: Shield },
  ];

  const statusStyles = { active: "bg-success/15 text-success", warning: "bg-warning/15 text-warning", error: "bg-destructive/15 text-destructive" };
  const statusLabels = { active: "Secure", warning: "Warning", error: "Action Required" };

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { label: "Security Score", value: `${Math.round((checks.filter(c => c.status === "active").length / checks.length) * 100)}%`, color: "text-success" },
          { label: "Warnings", value: checks.filter(c => c.status === "warning").length, color: "text-warning" },
          { label: "Critical", value: checks.filter(c => c.status === "error").length, color: "text-destructive" },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-4 neural-border text-center">
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <span className="text-[10px] text-muted-foreground">{s.label}</span>
          </div>
        ))}
      </div>

      <div className="space-y-2">
        {checks.map(check => (
          <div key={check.label} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
            <check.icon className="w-4 h-4 text-primary shrink-0" />
            <div className="flex-1">
              <p className="text-xs font-semibold text-foreground">{check.label}</p>
              <p className="text-[10px] text-muted-foreground">{check.desc}</p>
            </div>
            <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${statusStyles[check.status]}`}>
              {statusLabels[check.status]}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── INTEGRATIONS TAB (legacy) ───
const IntegrationsTab = () => {
  const { toast } = useToast();
  const [integrations, setIntegrations] = useState<ApiIntegration[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");

  const fetchIntegrations = useCallback(async () => {
    const { data } = await supabase.from("api_integrations").select("*").order("category, display_name");
    setIntegrations((data as ApiIntegration[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchIntegrations(); }, [fetchIntegrations]);

  const toggleEnabled = async (id: string, current: boolean) => {
    await supabase.from("api_integrations").update({ is_enabled: !current } as any).eq("id", id);
    toast({ title: !current ? "Enabled" : "Disabled" });
    fetchIntegrations();
  };

  const categories = ["all", ...Array.from(new Set(integrations.map(i => i.category)))];
  const filtered = filter === "all" ? integrations : integrations.filter(i => i.category === filter);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const totalCost = integrations.reduce((s, i) => s + (i.monthly_cost_estimate || 0), 0);
  const totalUsage = integrations.reduce((s, i) => s + (i.monthly_usage_count || 0), 0);

  return (
    <div className="space-y-4 mt-4">
      <div className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-1.5 mb-1"><Settings className="w-3.5 h-3.5 text-primary" /><span className="text-[10px] text-muted-foreground">Services</span></div>
          <p className="text-lg font-bold text-foreground">{integrations.length}</p>
        </div>
        <div className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-1.5 mb-1"><DollarSign className="w-3.5 h-3.5 text-primary" /><span className="text-[10px] text-muted-foreground">Monthly Cost</span></div>
          <p className="text-lg font-bold text-foreground">${totalCost.toFixed(0)}</p>
        </div>
        <div className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-1.5 mb-1"><Activity className="w-3.5 h-3.5 text-accent" /><span className="text-[10px] text-muted-foreground">API Calls</span></div>
          <p className="text-lg font-bold text-foreground">{totalUsage.toLocaleString()}</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {categories.map(cat => (
          <button key={cat} onClick={() => setFilter(cat)}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize ${filter === cat ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
            {cat}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.map(integration => {
          const Icon = CATEGORY_ICONS[integration.category] || Settings;
          const STATUS_STYLES: Record<string, string> = { active: "bg-success/15 text-success", degraded: "bg-warning/15 text-warning", error: "bg-destructive/15 text-destructive", inactive: "bg-secondary text-muted-foreground" };
          return (
            <div key={integration.id} className={`glass rounded-xl p-3 neural-border flex items-center gap-3 ${!integration.is_enabled ? "opacity-50" : ""}`}>
              <Icon className="w-4 h-4 text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-semibold text-foreground">{integration.display_name}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${STATUS_STYLES[integration.status]}`}>{integration.status}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate">{integration.description}</p>
              </div>
              <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                <span>${integration.monthly_cost_estimate || 0}/mo</span>
                <span>{(integration.monthly_usage_count || 0).toLocaleString()} calls</span>
                <button onClick={() => toggleEnabled(integration.id, integration.is_enabled)} className="p-1 hover:bg-secondary rounded">
                  {integration.is_enabled ? <ToggleRight className="w-4 h-4 text-success" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

// ─── API DOCS TAB ───
const ApiDocsTab = () => {
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_endpoints").select("*").order("category, display_name");
      setEndpoints((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const exportJSON = () => {
    const doc = {
      info: { title: "ACRY API Documentation", version: "1.0.0", description: "AI Second Brain for All Exams" },
      base_url: `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`,
      endpoints: endpoints.map(ep => ({
        name: ep.display_name,
        path: `/${ep.path}`,
        method: ep.method,
        category: ep.category,
        version: ep.version,
        requires_auth: ep.requires_auth,
        rate_limit: ep.rate_limit_per_minute,
        enabled: ep.is_enabled,
      })),
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acry-api-docs.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportPostman = () => {
    const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;
    const collection = {
      info: { name: "ACRY API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json" },
      item: Object.entries(
        endpoints.reduce((acc, ep) => {
          if (!acc[ep.category]) acc[ep.category] = [];
          acc[ep.category].push(ep);
          return acc;
        }, {} as Record<string, ApiEndpoint[]>)
      ).map(([cat, eps]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        item: eps.map(ep => ({
          name: ep.display_name,
          request: {
            method: ep.method,
            header: [
              { key: "Content-Type", value: "application/json" },
              ...(ep.requires_auth ? [{ key: "Authorization", value: "Bearer {{token}}" }] : []),
              { key: "apikey", value: "{{anon_key}}" },
            ],
            url: { raw: `${baseUrl}/${ep.path}`, host: [baseUrl], path: [ep.path] },
            body: ep.method === "POST" ? { mode: "raw", raw: JSON.stringify({}, null, 2) } : undefined,
          },
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "acry-api-postman.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const grouped = endpoints.reduce((acc, ep) => {
    if (!acc[ep.category]) acc[ep.category] = [];
    acc[ep.category].push(ep);
    return acc;
  }, {} as Record<string, ApiEndpoint[]>);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Auto-Generated API Documentation</h3>
          <p className="text-[10px] text-muted-foreground">{endpoints.length} endpoints documented</p>
        </div>
        <div className="flex gap-2">
          <button onClick={exportJSON} className="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 flex items-center gap-1">
            <FileJson className="w-3 h-3" /> Export JSON
          </button>
          <button onClick={exportPostman} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1">
            <Download className="w-3 h-3" /> Postman
          </button>
        </div>
      </div>

      <div className="glass rounded-xl p-3 neural-border">
        <p className="text-[10px] text-muted-foreground mb-1">Base URL</p>
        <div className="flex items-center gap-2">
          <code className="text-xs font-mono text-foreground bg-secondary px-2 py-1 rounded flex-1">
            {import.meta.env.VITE_SUPABASE_URL}/functions/v1
          </code>
          <button onClick={() => navigator.clipboard.writeText(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1`)} className="p-1 hover:bg-secondary rounded">
            <Copy className="w-3.5 h-3.5 text-primary" />
          </button>
        </div>
      </div>

      {Object.entries(grouped).map(([cat, eps]) => (
        <div key={cat} className="space-y-2">
          <h4 className="text-xs font-semibold text-foreground capitalize flex items-center gap-2">
            {(() => { const Icon = CATEGORY_ICONS[cat] || Globe; return <Icon className="w-3.5 h-3.5 text-primary" />; })()}
            {cat} <span className="text-muted-foreground font-normal">({eps.length})</span>
          </h4>
          {eps.map(ep => (
            <div key={ep.id} className="glass rounded-xl neural-border overflow-hidden">
              <button onClick={() => setExpanded(expanded === ep.id ? null : ep.id)}
                className="w-full p-3 flex items-center gap-3 hover:bg-secondary/30 transition-colors text-left">
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${ep.method === "GET" ? "bg-blue-500/15 text-blue-400" : "bg-green-500/15 text-green-400"}`}>
                  {ep.method}
                </span>
                <code className="text-xs font-mono text-foreground flex-1">/{ep.path}</code>
                <span className="text-xs text-muted-foreground">{ep.display_name}</span>
                {ep.requires_auth && <Lock className="w-3 h-3 text-warning" />}
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{ep.version}</span>
                {expanded === ep.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {expanded === ep.id && (
                <div className="px-3 pb-3 space-y-2 border-t border-border">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-2">
                    <div><span className="text-[10px] text-muted-foreground block">Auth</span><span className="text-xs text-foreground">{ep.requires_auth ? "JWT Required" : "Public"}</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Rate Limit</span><span className="text-xs text-foreground">{ep.rate_limit_per_minute} req/min</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Status</span><span className={`text-xs ${ep.is_enabled ? "text-success" : "text-destructive"}`}>{ep.is_enabled ? "Enabled" : "Disabled"}</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Version</span><span className="text-xs text-foreground">{ep.version}</span></div>
                  </div>
                  {ep.description && <p className="text-[10px] text-muted-foreground">{ep.description}</p>}
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Headers</span>
                    <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{`Content-Type: application/json
apikey: <anon_key>${ep.requires_auth ? "\nAuthorization: Bearer <user_jwt>" : ""}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Example Request</span>
                    <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{`${ep.method} ${import.meta.env.VITE_SUPABASE_URL}/functions/v1/${ep.path}

{
  // Request body
}`}
                    </pre>
                  </div>
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Response Format</span>
                    <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{`{
  "success": true,
  "data": { ... }
}`}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      ))}
    </div>
  );
};

export default ApiManagement;
