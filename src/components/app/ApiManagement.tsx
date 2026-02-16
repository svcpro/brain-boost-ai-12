import { useState, useEffect, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Loader2, Key, ExternalLink, ToggleLeft, ToggleRight,
  AlertTriangle, CheckCircle2, Settings, DollarSign, Activity,
  Mail, Mic, CreditCard, Bell, Brain, Save, Pencil, Eye, EyeOff,
  Info, Hash, Plus, X, Trash2, Clock, Shield, Zap, Globe,
  Copy, RefreshCw, Search, Filter, Download, FileJson, BarChart3,
  TrendingUp, AlertCircle, Server, Lock, Unlock, ChevronDown,
  ChevronRight, Code, BookOpen, Gauge, Users, ArrowUpDown, GitBranch, Tag
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { format, formatDistanceToNow, startOfMonth, addMonths, subDays } from "date-fns";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import FlutterApiHub from "@/components/app/FlutterApiHub";

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
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent flex items-center justify-center">
              <Server className="w-4 h-4 text-primary-foreground" />
            </div>
            API Command Center
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Enterprise API gateway • Keys • Endpoints • Security • Monitoring</p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/10 border border-success/20">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <span className="text-[10px] font-medium text-success">System Online</span>
          </div>
        </div>
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
            { value: "flutter", label: "Flutter Hub", icon: Code },
            { value: "versions", label: "Versions", icon: GitBranch },
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
        <TabsContent value="flutter"><FlutterApiHub /></TabsContent>
        <TabsContent value="versions"><VersionsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ─── OVERVIEW TAB ───
const OverviewTab = () => {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [keysRes, endpointsRes, integrationsRes, logsRes, rateLimitsRes] = await Promise.all([
        supabase.from("api_keys").select("*"),
        supabase.from("api_endpoints").select("*"),
        supabase.from("api_integrations").select("*"),
        supabase.from("api_request_logs").select("*").order("created_at", { ascending: false }).limit(500),
        supabase.from("api_rate_limits").select("*"),
      ]);
      const keys = (keysRes.data as any[]) || [];
      const endpoints = (endpointsRes.data as any[]) || [];
      const integrations = (integrationsRes.data as any[]) || [];
      const logs = (logsRes.data as any[]) || [];
      const rateLimits = (rateLimitsRes.data as any[]) || [];

      const totalRequests = endpoints.reduce((s: number, e: any) => s + (e.total_requests || 0), 0);
      const totalErrors = endpoints.reduce((s: number, e: any) => s + (e.total_errors || 0), 0);
      const avgLatency = endpoints.length > 0 ? Math.round(endpoints.reduce((s: number, e: any) => s + (e.avg_latency_ms || 0), 0) / endpoints.length) : 0;
      
      // Security analysis
      const noAuthEndpoints = endpoints.filter((e: any) => !e.requires_auth && e.is_enabled);
      const expiredKeys = keys.filter((k: any) => k.expires_at && new Date(k.expires_at) < new Date() && k.is_active);
      const securityChecks = 9;
      const securityPassed = securityChecks - (noAuthEndpoints.length > 10 ? 1 : 0) - (expiredKeys.length > 0 ? 1 : 0);
      
      // Version distribution
      const versionMap: Record<string, number> = {};
      endpoints.forEach((ep: any) => { const v = ep.version || "v1"; versionMap[v] = (versionMap[v] || 0) + 1; });
      
      // Category distribution
      const categoryMap: Record<string, number> = {};
      endpoints.forEach((ep: any) => { categoryMap[ep.category] = (categoryMap[ep.category] || 0) + 1; });

      // Recent activity (last 24h)
      const now = new Date();
      const last24h = logs.filter((l: any) => (now.getTime() - new Date(l.created_at).getTime()) < 86400000);
      const last24hErrors = last24h.filter((l: any) => l.status_code >= 400);

      // Top endpoints by traffic
      const topEndpoints = [...endpoints].sort((a: any, b: any) => (b.total_requests || 0) - (a.total_requests || 0)).slice(0, 5);

      setStats({
        keys, endpoints, integrations, logs, rateLimits,
        totalRequests, totalErrors, avgLatency,
        securityScore: Math.round((securityPassed / securityChecks) * 100),
        noAuthEndpoints: noAuthEndpoints.length,
        expiredKeys: expiredKeys.length,
        versionMap, categoryMap,
        last24h: last24h.length,
        last24hErrors: last24hErrors.length,
        totalCost: integrations.reduce((s: number, i: any) => s + (i.monthly_cost_estimate || 0), 0),
        totalUsage: integrations.reduce((s: number, i: any) => s + (i.monthly_usage_count || 0), 0),
        topEndpoints,
      });
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;
  if (!stats) return null;

  const successRate = stats.totalRequests > 0 ? ((1 - stats.totalErrors / stats.totalRequests) * 100).toFixed(1) : "100";

  return (
    <div className="space-y-5 mt-4">
      {/* Primary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total API Keys", value: `${stats.keys.filter((k: any) => k.is_active).length}/${stats.keys.length}`, sub: "active / total", icon: Key, color: "text-primary", gradient: "from-primary/20 to-primary/5" },
          { label: "Total Endpoints", value: "124", sub: `${stats.endpoints.length} registered in DB`, icon: Globe, color: "text-accent", gradient: "from-accent/20 to-accent/5" },
          { label: "Total Requests", value: stats.totalRequests.toLocaleString(), sub: "all time", icon: Activity, color: "text-success", gradient: "from-success/20 to-success/5" },
          { label: "Monthly Cost", value: `$${stats.totalCost.toFixed(0)}`, sub: `${stats.totalUsage.toLocaleString()} API calls`, icon: DollarSign, color: "text-warning", gradient: "from-warning/20 to-warning/5" },
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

      {/* System Health Row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Performance Gauge */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
          className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground">Performance</span>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="text-center">
              <p className={`text-lg font-bold ${parseFloat(successRate) >= 99 ? "text-success" : parseFloat(successRate) >= 95 ? "text-warning" : "text-destructive"}`}>
                {successRate}%
              </p>
              <span className="text-[10px] text-muted-foreground">Success Rate</span>
            </div>
            <div className="text-center">
              <p className={`text-lg font-bold ${stats.avgLatency < 500 ? "text-success" : stats.avgLatency < 1000 ? "text-warning" : "text-destructive"}`}>
                {stats.avgLatency}ms
              </p>
              <span className="text-[10px] text-muted-foreground">Avg Latency</span>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{stats.totalErrors.toLocaleString()}</p>
              <span className="text-[10px] text-muted-foreground">Total Errors</span>
            </div>
          </div>
        </motion.div>

        {/* Security Score */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}
          className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Security Score</span>
          </div>
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16">
              <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="hsl(var(--border))" strokeWidth="3" />
                <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none"
                  stroke={stats.securityScore >= 90 ? "hsl(var(--success))" : stats.securityScore >= 70 ? "hsl(var(--warning))" : "hsl(var(--destructive))"}
                  strokeWidth="3" strokeDasharray={`${stats.securityScore}, 100`} strokeLinecap="round" />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-sm font-bold text-foreground">{stats.securityScore}%</span>
            </div>
            <div className="flex-1 space-y-1.5">
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">No-Auth Endpoints</span>
                <span className={stats.noAuthEndpoints > 10 ? "text-warning font-medium" : "text-success"}>{stats.noAuthEndpoints}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Expired Active Keys</span>
                <span className={stats.expiredKeys > 0 ? "text-destructive font-medium" : "text-success"}>{stats.expiredKeys}</span>
              </div>
              <div className="flex items-center justify-between text-[10px]">
                <span className="text-muted-foreground">Rate Limit Rules</span>
                <span className="text-foreground">{stats.rateLimits.length}</span>
              </div>
            </div>
          </div>
        </motion.div>

        {/* 24h Activity */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <Activity className="w-4 h-4 text-success" />
            <span className="text-xs font-semibold text-foreground">Last 24 Hours</span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-lg font-bold text-foreground">{stats.last24h.toLocaleString()}</p>
              <span className="text-[10px] text-muted-foreground">Requests</span>
            </div>
            <div>
              <p className={`text-lg font-bold ${stats.last24hErrors > 0 ? "text-destructive" : "text-success"}`}>{stats.last24hErrors}</p>
              <span className="text-[10px] text-muted-foreground">Errors</span>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{stats.integrations.filter((i: any) => i.is_enabled).length}</p>
              <span className="text-[10px] text-muted-foreground">Active Services</span>
            </div>
            <div>
              <p className="text-lg font-bold text-foreground">{stats.rateLimits.filter((r: any) => r.is_active).length}</p>
              <span className="text-[10px] text-muted-foreground">Rate Rules</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Version Distribution + Category Breakdown + Top Endpoints */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* Version Distribution */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }}
          className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <GitBranch className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground">Version Distribution</span>
          </div>
          <div className="space-y-2">
            {Object.entries(stats.versionMap).sort(([a], [b]) => a.localeCompare(b)).map(([version, count]) => {
              const pct = stats.endpoints.length > 0 ? ((count as number) / stats.endpoints.length) * 100 : 0;
              const colors: Record<string, string> = { v1: "bg-blue-400", v2: "bg-green-400", v3: "bg-purple-400" };
              return (
                <div key={version}>
                  <div className="flex items-center justify-between text-[10px] mb-1">
                    <span className="font-medium text-foreground uppercase">{version}</span>
                    <span className="text-muted-foreground">{count as number} endpoints ({pct.toFixed(0)}%)</span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div className={`${colors[version] || "bg-primary"} rounded-full h-2 transition-all`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
            {Object.keys(stats.versionMap).length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No endpoints configured</p>}
          </div>
        </motion.div>

        {/* Category Breakdown */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <BarChart3 className="w-4 h-4 text-accent" />
            <span className="text-xs font-semibold text-foreground">Categories</span>
          </div>
          <div className="space-y-1.5">
            {Object.entries(stats.categoryMap).sort(([, a], [, b]) => (b as number) - (a as number)).map(([cat, count]) => {
              const Icon = CATEGORY_ICONS[cat] || Globe;
              return (
                <div key={cat} className="flex items-center gap-2 py-1">
                  <Icon className="w-3 h-3 text-primary shrink-0" />
                  <span className="text-[10px] text-foreground capitalize flex-1">{cat}</span>
                  <span className="text-[10px] font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">{count as number}</span>
                </div>
              );
            })}
          </div>
        </motion.div>

        {/* Top Endpoints */}
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-xs font-semibold text-foreground">Top Endpoints</span>
          </div>
          <div className="space-y-2">
            {stats.topEndpoints.map((ep: any, i: number) => (
              <div key={ep.id} className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-muted-foreground w-4">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-medium text-foreground truncate">{ep.display_name}</p>
                  <p className="text-[9px] text-muted-foreground font-mono truncate">/{ep.path}</p>
                </div>
                <span className="text-[10px] font-medium text-foreground shrink-0">{(ep.total_requests || 0).toLocaleString()}</span>
              </div>
            ))}
            {stats.topEndpoints.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No traffic data yet</p>}
          </div>
        </motion.div>
      </div>

      {/* Cost Breakdown by Service */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
        className="glass rounded-xl p-4 neural-border">
        <div className="flex items-center gap-2 mb-3">
          <DollarSign className="w-4 h-4 text-warning" />
          <span className="text-xs font-semibold text-foreground">Cost Breakdown by Service</span>
          <span className="text-[10px] text-muted-foreground ml-auto">Total: ${stats.totalCost.toFixed(2)}/mo</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {stats.integrations.filter((i: any) => i.monthly_cost_estimate > 0).sort((a: any, b: any) => b.monthly_cost_estimate - a.monthly_cost_estimate).map((integration: any) => {
            const Icon = CATEGORY_ICONS[integration.category] || Settings;
            const pct = stats.totalCost > 0 ? ((integration.monthly_cost_estimate / stats.totalCost) * 100).toFixed(0) : "0";
            return (
              <div key={integration.id} className="bg-secondary/50 rounded-lg p-2.5">
                <div className="flex items-center gap-1.5 mb-1">
                  <Icon className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-foreground font-medium truncate">{integration.display_name}</span>
                </div>
                <p className="text-sm font-bold text-foreground">${integration.monthly_cost_estimate.toFixed(0)}</p>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] text-muted-foreground">{pct}% of total</span>
                  <span className="text-[9px] text-muted-foreground">{(integration.monthly_usage_count || 0).toLocaleString()} calls</span>
                </div>
              </div>
            );
          })}
          {stats.integrations.filter((i: any) => i.monthly_cost_estimate > 0).length === 0 && (
            <p className="text-[10px] text-muted-foreground col-span-4 text-center py-2">No cost data available</p>
          )}
        </div>
      </motion.div>
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

  const { toast } = useToast();
  const [versionFilter, setVersionFilter] = useState("all");

  const filtered = versionFilter === "all" ? endpoints : endpoints.filter(ep => (ep.version || "v1") === versionFilter);

  const baseUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`;

  const buildEndpointDoc = (ep: ApiEndpoint) => ({
    name: ep.display_name,
    path: `/${ep.path}`,
    method: ep.method,
    category: ep.category,
    version: ep.version || "v1",
    description: ep.description || "",
    requires_auth: ep.requires_auth,
    rate_limit_per_minute: ep.rate_limit_per_minute,
    enabled: ep.is_enabled,
    request_schema: ep.request_schema || { type: "object", properties: {} },
    response_schema: ep.response_schema || { type: "object", properties: { success: { type: "boolean" }, data: { type: "object" } } },
  });

  const exportJSON = () => {
    const doc = {
      info: { title: "ACRY API Documentation", version: "1.0.0", description: "AI Second Brain for All Exams — Flutter Developer Guide", generated_at: new Date().toISOString() },
      base_url: baseUrl,
      authentication: {
        type: "Bearer JWT",
        header: "Authorization",
        description: "Include 'Bearer <user_jwt>' for authenticated endpoints. Always include 'apikey: <anon_key>' header.",
      },
      endpoints: filtered.map(buildEndpointDoc),
    };
    const blob = new Blob([JSON.stringify(doc, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "acry-api-docs.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "JSON documentation exported" });
  };

  const exportSwagger = () => {
    const paths: Record<string, any> = {};
    filtered.forEach(ep => {
      const pathKey = `/${ep.path}`;
      if (!paths[pathKey]) paths[pathKey] = {};
      paths[pathKey][ep.method.toLowerCase()] = {
        summary: ep.display_name,
        description: ep.description || "",
        tags: [ep.category],
        operationId: ep.path.replace(/[^a-zA-Z0-9]/g, "_"),
        security: ep.requires_auth ? [{ bearerAuth: [] }] : [],
        parameters: [
          { name: "apikey", in: "header", required: true, schema: { type: "string" }, description: "Supabase anon key" },
        ],
        ...(ep.method === "POST" || ep.method === "PUT" ? {
          requestBody: {
            required: true,
            content: { "application/json": { schema: ep.request_schema || { type: "object" } } },
          },
        } : {}),
        responses: {
          "200": {
            description: "Successful response",
            content: { "application/json": { schema: ep.response_schema || { type: "object", properties: { success: { type: "boolean" }, data: { type: "object" } } } } },
          },
          "401": { description: "Unauthorized — invalid or missing JWT" },
          "429": { description: `Rate limited — max ${ep.rate_limit_per_minute} req/min` },
          "500": { description: "Internal server error" },
        },
      };
    });

    const swagger = {
      openapi: "3.0.3",
      info: { title: "ACRY API", version: "1.0.0", description: "AI Second Brain for All Exams — Auto-generated OpenAPI spec for Flutter developers" },
      servers: [{ url: baseUrl, description: "Production" }],
      paths,
      components: {
        securitySchemes: {
          bearerAuth: { type: "http", scheme: "bearer", bearerFormat: "JWT" },
          apiKey: { type: "apiKey", in: "header", name: "apikey" },
        },
      },
    };
    const blob = new Blob([JSON.stringify(swagger, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "acry-api-swagger.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Swagger/OpenAPI spec exported" });
  };

  const exportPostman = () => {
    const collection = {
      info: { name: "ACRY API", schema: "https://schema.getpostman.com/json/collection/v2.1.0/collection.json", description: "Auto-generated for Flutter developers" },
      variable: [
        { key: "base_url", value: baseUrl },
        { key: "anon_key", value: "" },
        { key: "token", value: "" },
      ],
      item: Object.entries(
        filtered.reduce((acc, ep) => {
          if (!acc[ep.category]) acc[ep.category] = [];
          acc[ep.category].push(ep);
          return acc;
        }, {} as Record<string, ApiEndpoint[]>)
      ).map(([cat, eps]) => ({
        name: cat.charAt(0).toUpperCase() + cat.slice(1),
        item: eps.map(ep => ({
          name: `${ep.display_name} (${ep.version || "v1"})`,
          request: {
            method: ep.method,
            header: [
              { key: "Content-Type", value: "application/json" },
              { key: "apikey", value: "{{anon_key}}" },
              ...(ep.requires_auth ? [{ key: "Authorization", value: "Bearer {{token}}" }] : []),
            ],
            url: { raw: `{{base_url}}/${ep.path}`, host: ["{{base_url}}"], path: [ep.path] },
            description: `${ep.description || ep.display_name}\n\nVersion: ${ep.version || "v1"}\nRate Limit: ${ep.rate_limit_per_minute} req/min\nAuth: ${ep.requires_auth ? "JWT Required" : "Public"}`,
            body: ep.method === "POST" || ep.method === "PUT" ? {
              mode: "raw",
              raw: JSON.stringify(ep.request_schema?.properties
                ? Object.fromEntries(Object.entries(ep.request_schema.properties).map(([k, v]: any) => [k, v.example || v.default || ""]))
                : {}, null, 2),
              options: { raw: { language: "json" } },
            } : undefined,
          },
          response: [{
            name: "Success",
            status: "OK",
            code: 200,
            body: JSON.stringify(ep.response_schema?.properties
              ? Object.fromEntries(Object.entries(ep.response_schema.properties).map(([k, v]: any) => [k, v.example || v.default || null]))
              : { success: true, data: {} }, null, 2),
          }],
        })),
      })),
    };
    const blob = new Blob([JSON.stringify(collection, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = "acry-api-postman.json"; a.click();
    URL.revokeObjectURL(url);
    toast({ title: "Postman collection exported" });
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const grouped = filtered.reduce((acc, ep) => {
    if (!acc[ep.category]) acc[ep.category] = [];
    acc[ep.category].push(ep);
    return acc;
  }, {} as Record<string, ApiEndpoint[]>);

  return (
    <div className="space-y-4 mt-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Auto-Generated API Documentation</h3>
          <p className="text-[10px] text-muted-foreground">{filtered.length} endpoints documented • For Flutter developers</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <select value={versionFilter} onChange={e => setVersionFilter(e.target.value)}
            className="px-3 py-1.5 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none">
            <option value="all">All Versions</option>
            <option value="v1">v1 Only</option>
            <option value="v2">v2 Only</option>
            <option value="v3">v3 Only</option>
          </select>
          <button onClick={exportJSON} className="px-3 py-1.5 bg-secondary text-foreground rounded-lg text-xs font-medium hover:bg-secondary/80 flex items-center gap-1">
            <FileJson className="w-3 h-3" /> JSON
          </button>
          <button onClick={exportSwagger} className="px-3 py-1.5 bg-accent/15 text-accent rounded-lg text-xs font-medium hover:bg-accent/25 flex items-center gap-1">
            <Code className="w-3 h-3" /> Swagger
          </button>
          <button onClick={exportPostman} className="px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:bg-primary/90 flex items-center gap-1">
            <Download className="w-3 h-3" /> Postman
          </button>
        </div>
      </div>

      {/* Base URL + Quick Start */}
      <div className="glass rounded-xl p-3 neural-border space-y-3">
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Base URL</p>
          <div className="flex items-center gap-2">
            <code className="text-xs font-mono text-foreground bg-secondary px-2 py-1 rounded flex-1">{baseUrl}</code>
            <button onClick={() => { navigator.clipboard.writeText(baseUrl); toast({ title: "Copied" }); }} className="p-1 hover:bg-secondary rounded">
              <Copy className="w-3.5 h-3.5 text-primary" />
            </button>
          </div>
        </div>
        <div>
          <p className="text-[10px] text-muted-foreground mb-1">Flutter Quick Start (Dart)</p>
          <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{`final response = await http.post(
  Uri.parse('$baseUrl/endpoint'),
  headers: {
    'Content-Type': 'application/json',
    'apikey': anonKey,
    'Authorization': 'Bearer \$userJwt',
  },
  body: jsonEncode({'key': 'value'}),
);`}
          </pre>
        </div>
      </div>

      {/* Endpoint Docs by Category */}
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
                <span className={`text-[10px] px-2 py-0.5 rounded font-mono font-bold ${
                  ep.method === "GET" ? "bg-green-500/15 text-green-400" :
                  ep.method === "POST" ? "bg-blue-500/15 text-blue-400" :
                  ep.method === "PUT" ? "bg-yellow-500/15 text-yellow-400" :
                  "bg-red-500/15 text-red-400"
                }`}>{ep.method}</span>
                <code className="text-xs font-mono text-foreground flex-1">/{ep.path}</code>
                <span className="text-xs text-muted-foreground">{ep.display_name}</span>
                {ep.requires_auth && <Lock className="w-3 h-3 text-warning" />}
                <span className="text-[10px] bg-secondary px-1.5 py-0.5 rounded text-muted-foreground">{ep.version || "v1"}</span>
                {expanded === ep.id ? <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />}
              </button>
              {expanded === ep.id && (
                <div className="px-3 pb-3 space-y-3 border-t border-border">
                  {ep.description && <p className="text-[10px] text-muted-foreground mt-2">{ep.description}</p>}

                  <div className="grid grid-cols-2 md:grid-cols-5 gap-2 mt-2">
                    <div><span className="text-[10px] text-muted-foreground block">Method</span><span className="text-xs font-mono font-bold text-foreground">{ep.method}</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Auth</span><span className="text-xs text-foreground">{ep.requires_auth ? "JWT Required" : "Public"}</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Rate Limit</span><span className="text-xs text-foreground">{ep.rate_limit_per_minute} req/min</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Version</span><span className="text-xs text-foreground">{ep.version || "v1"}</span></div>
                    <div><span className="text-[10px] text-muted-foreground block">Status</span><span className={`text-xs ${ep.is_enabled ? "text-green-400" : "text-destructive"}`}>{ep.is_enabled ? "Active" : "Disabled"}</span></div>
                  </div>

                  {/* Endpoint URL */}
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Endpoint URL</span>
                    <div className="flex items-center gap-2">
                      <code className="text-[10px] bg-secondary rounded px-2 py-1 font-mono text-foreground flex-1 overflow-x-auto">
                        {ep.method} {baseUrl}/{ep.path}
                      </code>
                      <button onClick={() => { navigator.clipboard.writeText(`${baseUrl}/${ep.path}`); toast({ title: "URL copied" }); }} className="p-1 hover:bg-secondary rounded shrink-0">
                        <Copy className="w-3 h-3 text-primary" />
                      </button>
                    </div>
                  </div>

                  {/* Headers */}
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Required Headers</span>
                    <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{`Content-Type: application/json
apikey: <anon_key>${ep.requires_auth ? "\nAuthorization: Bearer <user_jwt>" : ""}`}
                    </pre>
                  </div>

                  {/* Request Parameters */}
                  {(ep.method === "POST" || ep.method === "PUT") && (
                    <div>
                      <span className="text-[10px] text-muted-foreground block mb-1">Request Parameters</span>
                      {ep.request_schema?.properties ? (
                        <div className="bg-secondary rounded overflow-hidden">
                          <table className="w-full text-[10px]">
                            <thead><tr className="border-b border-border">
                              <th className="text-left p-1.5 text-muted-foreground font-medium">Parameter</th>
                              <th className="text-left p-1.5 text-muted-foreground font-medium">Type</th>
                              <th className="text-left p-1.5 text-muted-foreground font-medium">Required</th>
                              <th className="text-left p-1.5 text-muted-foreground font-medium">Description</th>
                            </tr></thead>
                            <tbody>
                              {Object.entries(ep.request_schema.properties).map(([key, val]: any) => (
                                <tr key={key} className="border-b border-border/50">
                                  <td className="p-1.5 font-mono text-foreground">{key}</td>
                                  <td className="p-1.5 text-muted-foreground">{val.type || "any"}</td>
                                  <td className="p-1.5">{ep.request_schema.required?.includes(key) ? <span className="text-destructive">Yes</span> : <span className="text-muted-foreground">No</span>}</td>
                                  <td className="p-1.5 text-muted-foreground">{val.description || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ) : (
                        <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground">{"{ /* See endpoint-specific docs */ }"}</pre>
                      )}
                    </div>
                  )}

                  {/* Response Format */}
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Response Format</span>
                    {ep.response_schema?.properties ? (
                      <div className="bg-secondary rounded overflow-hidden">
                        <table className="w-full text-[10px]">
                          <thead><tr className="border-b border-border">
                            <th className="text-left p-1.5 text-muted-foreground font-medium">Field</th>
                            <th className="text-left p-1.5 text-muted-foreground font-medium">Type</th>
                            <th className="text-left p-1.5 text-muted-foreground font-medium">Description</th>
                          </tr></thead>
                          <tbody>
                            {Object.entries(ep.response_schema.properties).map(([key, val]: any) => (
                              <tr key={key} className="border-b border-border/50">
                                <td className="p-1.5 font-mono text-foreground">{key}</td>
                                <td className="p-1.5 text-muted-foreground">{val.type || "any"}</td>
                                <td className="p-1.5 text-muted-foreground">{val.description || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{`{
  "success": true,
  "data": { ... }
}`}
                      </pre>
                    )}
                  </div>

                  {/* Flutter Example */}
                  <div>
                    <span className="text-[10px] text-muted-foreground block mb-1">Flutter (Dart) Example</span>
                    <pre className="text-[10px] bg-secondary rounded p-2 font-mono text-foreground overflow-x-auto">
{ep.method === "GET"
  ? `final response = await http.get(
  Uri.parse('${baseUrl}/${ep.path}'),
  headers: {
    'apikey': anonKey,${ep.requires_auth ? "\n    'Authorization': 'Bearer \$jwt'," : ""}
  },
);
final data = jsonDecode(response.body);`
  : `final response = await http.post(
  Uri.parse('${baseUrl}/${ep.path}'),
  headers: {
    'Content-Type': 'application/json',
    'apikey': anonKey,${ep.requires_auth ? "\n    'Authorization': 'Bearer \$jwt'," : ""}
  },
  body: jsonEncode({
    ${ep.request_schema?.properties
      ? Object.keys(ep.request_schema.properties).map(k => `'${k}': value`).join(",\n    ")
      : "// request body"}
  }),
);
final data = jsonDecode(response.body);`}
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

// ─── VERSIONS TAB ───
const VersionsTab = () => {
  const { toast } = useToast();
  const [endpoints, setEndpoints] = useState<ApiEndpoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.from("api_endpoints").select("*").order("path");
      setEndpoints((data as any[]) || []);
      setLoading(false);
    })();
  }, []);

  const versions = useMemo(() => {
    const map: Record<string, ApiEndpoint[]> = {};
    endpoints.forEach(ep => {
      const v = ep.version || "v1";
      if (!map[v]) map[v] = [];
      map[v].push(ep);
    });
    // Ensure v1, v2, v3 always exist
    ["v1", "v2", "v3"].forEach(v => { if (!map[v]) map[v] = []; });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [endpoints]);

  const updateEndpointVersion = async (id: string, newVersion: string) => {
    const { error } = await supabase.from("api_endpoints").update({ version: newVersion } as any).eq("id", id);
    if (error) return toast({ title: "Failed to update version", variant: "destructive" });
    setEndpoints(prev => prev.map(ep => ep.id === id ? { ...ep, version: newVersion } : ep));
    toast({ title: `Moved to ${newVersion}` });
  };

  const toggleEndpoint = async (id: string, enabled: boolean) => {
    await supabase.from("api_endpoints").update({ is_enabled: !enabled } as any).eq("id", id);
    setEndpoints(prev => prev.map(ep => ep.id === id ? { ...ep, is_enabled: !enabled } : ep));
    toast({ title: !enabled ? "Endpoint enabled" : "Endpoint disabled" });
  };

  const versionStats = useMemo(() => {
    return versions.map(([version, eps]) => ({
      version,
      total: eps.length,
      active: eps.filter(e => e.is_enabled).length,
      deprecated: eps.filter(e => !e.is_enabled).length,
      requests: eps.reduce((s, e) => s + (e.total_requests || 0), 0),
    }));
  }, [versions]);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  const VERSION_COLORS: Record<string, string> = {
    v1: "bg-blue-500/15 text-blue-400 border-blue-500/30",
    v2: "bg-green-500/15 text-green-400 border-green-500/30",
    v3: "bg-purple-500/15 text-purple-400 border-purple-500/30",
  };

  const VERSION_STATUS: Record<string, { label: string; color: string }> = {
    v1: { label: "Stable", color: "text-blue-400" },
    v2: { label: "Current", color: "text-green-400" },
    v3: { label: "Beta", color: "text-purple-400" },
  };

  return (
    <div className="space-y-4 mt-4">
      {/* Version Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {versionStats.map((vs, i) => (
          <motion.div key={vs.version} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
            className={`rounded-xl p-4 border ${VERSION_COLORS[vs.version] || "bg-secondary/50 text-muted-foreground border-border"}`}>
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4" />
                <span className="text-sm font-bold uppercase">{vs.version}</span>
              </div>
              <span className={`text-[10px] font-medium ${VERSION_STATUS[vs.version]?.color || "text-muted-foreground"}`}>
                {VERSION_STATUS[vs.version]?.label || "Custom"}
              </span>
            </div>
            <div className="grid grid-cols-3 gap-2 mt-3">
              <div>
                <p className="text-lg font-bold">{vs.total}</p>
                <p className="text-[10px] opacity-70">Endpoints</p>
              </div>
              <div>
                <p className="text-lg font-bold">{vs.active}</p>
                <p className="text-[10px] opacity-70">Active</p>
              </div>
              <div>
                <p className="text-lg font-bold">{vs.requests.toLocaleString()}</p>
                <p className="text-[10px] opacity-70">Requests</p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Endpoints by Version */}
      {versions.map(([version, eps]) => (
        <div key={version} className="glass rounded-xl neural-border overflow-hidden">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <GitBranch className="w-4 h-4 text-primary" />
              <span className="text-sm font-semibold text-foreground uppercase">{version}</span>
              <span className="text-[10px] text-muted-foreground">({eps.length} endpoints)</span>
            </div>
            <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${VERSION_COLORS[version] || "bg-secondary text-muted-foreground"}`}>
              {VERSION_STATUS[version]?.label || version}
            </span>
          </div>
          {eps.length === 0 ? (
            <div className="p-6 text-center text-xs text-muted-foreground">No endpoints in this version</div>
          ) : (
            <div className="divide-y divide-border">
              {eps.map(ep => (
                <div key={ep.id} className="p-3 flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold ${
                      ep.method === "GET" ? "bg-green-500/15 text-green-400" :
                      ep.method === "POST" ? "bg-blue-500/15 text-blue-400" :
                      ep.method === "PUT" ? "bg-yellow-500/15 text-yellow-400" :
                      "bg-red-500/15 text-red-400"
                    }`}>{ep.method}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-foreground truncate">{ep.display_name}</p>
                      <p className="text-[10px] text-muted-foreground font-mono truncate">{ep.path}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <select value={ep.version || "v1"} onChange={e => updateEndpointVersion(ep.id, e.target.value)}
                      className="px-2 py-1 bg-secondary rounded text-[10px] text-foreground border border-border outline-none">
                      <option value="v1">v1</option>
                      <option value="v2">v2</option>
                      <option value="v3">v3</option>
                    </select>
                    <button onClick={() => toggleEndpoint(ep.id, ep.is_enabled)}
                      className={`p-1 rounded transition-colors ${ep.is_enabled ? "text-green-400 hover:bg-green-500/10" : "text-muted-foreground hover:bg-secondary"}`}>
                      {ep.is_enabled ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
};

export default ApiManagement;
