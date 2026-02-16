import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, MessageSquare, Users, DollarSign, Zap, Settings, Shield,
  Search, RefreshCw, Loader2, ToggleLeft, ToggleRight, Save,
  TrendingUp, Clock, AlertTriangle, Eye, Ban, Check, X,
  BarChart3, Activity, ChevronDown, ChevronRight, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface ChatConfig {
  id: string;
  active_model: string;
  max_tokens: number;
  temperature: number;
  global_daily_limit: number;
  global_chat_enabled: boolean;
  cost_per_request: number;
  max_conversation_history: number;
  response_timeout_seconds: number;
  system_prompt_override: string | null;
  updated_at: string;
}

interface UserChatLimit {
  id: string;
  user_id: string;
  chat_enabled: boolean;
  daily_message_limit: number;
  messages_used_today: number;
  total_messages_sent: number;
  total_tokens_used: number;
  estimated_cost: number;
  last_message_at: string | null;
  limit_reset_at: string;
  notes: string | null;
  display_name?: string;
  email?: string;
}

interface UsageLog {
  id: string;
  user_id: string;
  model_used: string;
  tokens_input: number | null;
  tokens_output: number | null;
  latency_ms: number | null;
  estimated_cost: number | null;
  status: string;
  error_message: string | null;
  created_at: string;
}

const AVAILABLE_MODELS = [
  { value: "google/gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite", speed: "⚡ Ultra Fast", cost: "$" },
  { value: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash", speed: "🚀 Fast", cost: "$$" },
  { value: "google/gemini-3-flash-preview", label: "Gemini 3 Flash", speed: "🚀 Fast", cost: "$$" },
  { value: "google/gemini-2.5-pro", label: "Gemini 2.5 Pro", speed: "🧠 Balanced", cost: "$$$" },
  { value: "google/gemini-3-pro-preview", label: "Gemini 3 Pro", speed: "🧠 Balanced", cost: "$$$" },
  { value: "openai/gpt-5-nano", label: "GPT-5 Nano", speed: "⚡ Ultra Fast", cost: "$" },
  { value: "openai/gpt-5-mini", label: "GPT-5 Mini", speed: "🚀 Fast", cost: "$$" },
  { value: "openai/gpt-5", label: "GPT-5", speed: "🧠 Powerful", cost: "$$$$" },
  { value: "openai/gpt-5.2", label: "GPT-5.2", speed: "🧠 Latest", cost: "$$$$" },
];

type Tab = "overview" | "config" | "users" | "conversations" | "logs";

const ChatManagement = () => {
  const { toast } = useToast();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Data
  const [config, setConfig] = useState<ChatConfig | null>(null);
  const [userLimits, setUserLimits] = useState<UserChatLimit[]>([]);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>([]);
  const [conversations, setConversations] = useState<any[]>([]);
  const [stats, setStats] = useState({ totalMessages: 0, totalUsers: 0, todayMessages: 0, totalCost: 0, avgLatency: 0, errorRate: 0 });

  // Filters
  const [userSearch, setUserSearch] = useState("");
  const [convSearch, setConvSearch] = useState("");
  const [expandedConv, setExpandedConv] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const today = new Date().toISOString().split("T")[0];

    const [configRes, limitsRes, logsRes, messagesCountRes, todayCountRes, conversationsRes] = await Promise.all([
      supabase.from("chat_admin_config").select("*").limit(1).maybeSingle(),
      supabase.from("user_chat_limits").select("*").order("total_messages_sent", { ascending: false }).limit(100),
      supabase.from("chat_usage_logs").select("*").order("created_at", { ascending: false }).limit(200),
      supabase.from("ai_chat_messages").select("id", { count: "exact", head: true }),
      supabase.from("ai_chat_messages").select("id", { count: "exact", head: true }).gte("created_at", today),
      supabase.from("ai_chat_messages").select("user_id, role, content, created_at, bookmarked").order("created_at", { ascending: false }).limit(500),
    ]);

    if (configRes.data) setConfig(configRes.data as any);
    setUserLimits((limitsRes.data || []) as any);
    setUsageLogs((logsRes.data || []) as any);

    // Build conversation groups
    const msgs = conversationsRes.data || [];
    const userMap = new Map<string, any[]>();
    for (const m of msgs) {
      if (!userMap.has(m.user_id)) userMap.set(m.user_id, []);
      userMap.get(m.user_id)!.push(m);
    }
    const convArr = Array.from(userMap.entries()).map(([uid, msgs]) => ({
      user_id: uid,
      message_count: msgs.length,
      last_message: msgs[0]?.created_at,
      messages: msgs.slice(0, 20),
      bookmarked_count: msgs.filter((m: any) => m.bookmarked).length,
    }));
    setConversations(convArr);

    // Stats
    const logs = logsRes.data || [];
    const totalCost = logs.reduce((s: number, l: any) => s + (l.estimated_cost || 0), 0);
    const latencies = logs.filter((l: any) => l.latency_ms).map((l: any) => l.latency_ms);
    const avgLatency = latencies.length > 0 ? Math.round(latencies.reduce((a: number, b: number) => a + b, 0) / latencies.length) : 0;
    const errors = logs.filter((l: any) => l.status !== "success").length;

    setStats({
      totalMessages: messagesCountRes.count || 0,
      totalUsers: userMap.size,
      todayMessages: todayCountRes.count || 0,
      totalCost: Math.round(totalCost * 10000) / 10000,
      avgLatency,
      errorRate: logs.length > 0 ? Math.round((errors / logs.length) * 100) : 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const saveConfig = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from("chat_admin_config").update({
      active_model: config.active_model,
      max_tokens: config.max_tokens,
      temperature: config.temperature,
      global_daily_limit: config.global_daily_limit,
      global_chat_enabled: config.global_chat_enabled,
      cost_per_request: config.cost_per_request,
      max_conversation_history: config.max_conversation_history,
      response_timeout_seconds: config.response_timeout_seconds,
      system_prompt_override: config.system_prompt_override,
    }).eq("id", config.id);
    setSaving(false);
    if (error) toast({ title: "Failed to save", variant: "destructive" });
    else toast({ title: "Configuration saved ✅" });
  };

  const toggleUserAccess = async (limit: UserChatLimit) => {
    const newVal = !limit.chat_enabled;
    await supabase.from("user_chat_limits").update({ chat_enabled: newVal }).eq("id", limit.id);
    setUserLimits(prev => prev.map(l => l.id === limit.id ? { ...l, chat_enabled: newVal } : l));
    toast({ title: `Chat ${newVal ? "enabled" : "disabled"} for user` });
  };

  const updateUserLimit = async (limitId: string, daily_message_limit: number) => {
    await supabase.from("user_chat_limits").update({ daily_message_limit }).eq("id", limitId);
    setUserLimits(prev => prev.map(l => l.id === limitId ? { ...l, daily_message_limit } : l));
    toast({ title: "Limit updated ✅" });
  };

  const resetUserUsage = async (limitId: string) => {
    await supabase.from("user_chat_limits").update({ messages_used_today: 0 }).eq("id", limitId);
    setUserLimits(prev => prev.map(l => l.id === limitId ? { ...l, messages_used_today: 0 } : l));
    toast({ title: "Usage reset ✅" });
  };

  const timeAgo = (d: string | null) => {
    if (!d) return "Never";
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const TABS: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "config", label: "AI Config", icon: Settings },
    { key: "users", label: "User Limits", icon: Users },
    { key: "conversations", label: "Conversations", icon: MessageSquare },
    { key: "logs", label: "Usage Logs", icon: Activity },
  ];

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            <MessageSquare className="w-5 h-5 text-primary" />
            Chat Management
          </h2>
          <p className="text-xs text-muted-foreground mt-1">Monitor, configure, and control AI chat system</p>
        </div>
        <button onClick={fetchData} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-secondary text-xs font-medium text-foreground hover:bg-secondary/80">
          <RefreshCw className="w-3.5 h-3.5" /> Refresh
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary/50 rounded-xl p-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              activeTab === t.key ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <AnimatePresence mode="wait">
        <motion.div key={activeTab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {activeTab === "overview" && (
            <OverviewTab stats={stats} config={config} usageLogs={usageLogs} />
          )}
          {activeTab === "config" && config && (
            <ConfigTab config={config} setConfig={setConfig} saving={saving} saveConfig={saveConfig} />
          )}
          {activeTab === "users" && (
            <UsersTab
              userLimits={userLimits}
              search={userSearch}
              setSearch={setUserSearch}
              toggleUserAccess={toggleUserAccess}
              updateUserLimit={updateUserLimit}
              resetUserUsage={resetUserUsage}
              timeAgo={timeAgo}
            />
          )}
          {activeTab === "conversations" && (
            <ConversationsTab
              conversations={conversations}
              search={convSearch}
              setSearch={setConvSearch}
              expanded={expandedConv}
              setExpanded={setExpandedConv}
              timeAgo={timeAgo}
            />
          )}
          {activeTab === "logs" && (
            <LogsTab usageLogs={usageLogs} timeAgo={timeAgo} />
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Overview Tab ───
const OverviewTab = ({ stats, config, usageLogs }: { stats: any; config: ChatConfig | null; usageLogs: UsageLog[] }) => {
  const cards = [
    { label: "Total Messages", value: stats.totalMessages.toLocaleString(), icon: MessageSquare, color: "text-primary" },
    { label: "Today", value: stats.todayMessages.toLocaleString(), icon: Zap, color: "text-accent" },
    { label: "Active Users", value: stats.totalUsers, icon: Users, color: "text-green-500" },
    { label: "Est. Cost", value: `$${stats.totalCost}`, icon: DollarSign, color: "text-yellow-500" },
    { label: "Avg Latency", value: `${stats.avgLatency}ms`, icon: Clock, color: "text-blue-500" },
    { label: "Error Rate", value: `${stats.errorRate}%`, icon: AlertTriangle, color: stats.errorRate > 5 ? "text-destructive" : "text-green-500" },
  ];

  // Model usage distribution
  const modelCounts: Record<string, number> = {};
  for (const log of usageLogs) {
    modelCounts[log.model_used] = (modelCounts[log.model_used] || 0) + 1;
  }
  const modelEntries = Object.entries(modelCounts).sort((a, b) => b[1] - a[1]);

  // Hourly distribution
  const hourCounts = new Array(24).fill(0);
  for (const log of usageLogs) {
    hourCounts[new Date(log.created_at).getHours()]++;
  }
  const maxHour = Math.max(...hourCounts, 1);

  return (
    <div className="space-y-6">
      {/* Status banner */}
      <div className={`flex items-center gap-3 px-4 py-3 rounded-xl border ${
        config?.global_chat_enabled ? "bg-green-500/10 border-green-500/20" : "bg-destructive/10 border-destructive/20"
      }`}>
        <div className={`w-2.5 h-2.5 rounded-full ${config?.global_chat_enabled ? "bg-green-500 animate-pulse" : "bg-destructive"}`} />
        <span className="text-sm font-medium text-foreground">
          Chat System: {config?.global_chat_enabled ? "Active" : "Disabled"}
        </span>
        <span className="text-xs text-muted-foreground ml-auto">Model: {config?.active_model?.split("/")[1] || "—"}</span>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        {cards.map(c => (
          <div key={c.label} className="bg-card rounded-xl border border-border p-3">
            <div className="flex items-center gap-2 mb-1">
              <c.icon className={`w-4 h-4 ${c.color}`} />
              <span className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{c.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Model distribution */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> Model Usage
          </h3>
          {modelEntries.length > 0 ? (
            <div className="space-y-2">
              {modelEntries.map(([model, count]) => (
                <div key={model} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-32 truncate">{model.split("/")[1]}</span>
                  <div className="flex-1 bg-secondary rounded-full h-2">
                    <div className="bg-primary rounded-full h-2 transition-all" style={{ width: `${(count / usageLogs.length) * 100}%` }} />
                  </div>
                  <span className="text-xs font-semibold text-foreground w-8 text-right">{count}</span>
                </div>
              ))}
            </div>
          ) : <p className="text-xs text-muted-foreground">No usage data yet</p>}
        </div>

        {/* Hourly activity */}
        <div className="bg-card rounded-xl border border-border p-4">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" /> Hourly Activity (24h)
          </h3>
          <div className="flex items-end gap-0.5 h-24">
            {hourCounts.map((count, hour) => (
              <div key={hour} className="flex-1 flex flex-col items-center gap-0.5">
                <div
                  className="w-full bg-primary/70 rounded-t transition-all hover:bg-primary"
                  style={{ height: `${(count / maxHour) * 100}%`, minHeight: count > 0 ? 3 : 0 }}
                  title={`${hour}:00 — ${count} messages`}
                />
                {hour % 6 === 0 && <span className="text-[8px] text-muted-foreground">{hour}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Config Tab ───
const ConfigTab = ({ config, setConfig, saving, saveConfig }: { config: ChatConfig; setConfig: (c: ChatConfig) => void; saving: boolean; saveConfig: () => void }) => {
  const update = (key: keyof ChatConfig, value: any) => setConfig({ ...config, [key]: value });

  return (
    <div className="space-y-6">
      {/* Global toggle */}
      <div className="flex items-center justify-between p-4 bg-card rounded-xl border border-border">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Global Chat</h3>
          <p className="text-xs text-muted-foreground">Enable or disable chat for all users</p>
        </div>
        <button onClick={() => update("global_chat_enabled", !config.global_chat_enabled)} className="flex items-center gap-2">
          {config.global_chat_enabled
            ? <ToggleRight className="w-8 h-8 text-green-500" />
            : <ToggleLeft className="w-8 h-8 text-muted-foreground" />
          }
        </button>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        {/* Model selection */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Brain className="w-4 h-4 text-primary" /> AI Model
          </h3>
          <select
            value={config.active_model}
            onChange={e => update("active_model", e.target.value)}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground"
          >
            {AVAILABLE_MODELS.map(m => (
              <option key={m.value} value={m.value}>{m.label} — {m.speed} {m.cost}</option>
            ))}
          </select>
          <p className="text-[10px] text-muted-foreground">Faster models = cheaper but less detailed responses</p>
        </div>

        {/* Response params */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Zap className="w-4 h-4 text-primary" /> Response Parameters
          </h3>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Max Tokens</span>
              <input type="number" value={config.max_tokens} onChange={e => update("max_tokens", Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Temperature (0-1)</span>
              <input type="number" step="0.1" min="0" max="1" value={config.temperature} onChange={e => update("temperature", Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Timeout (seconds)</span>
              <input type="number" value={config.response_timeout_seconds} onChange={e => update("response_timeout_seconds", Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground mt-1" />
            </label>
          </div>
        </div>

        {/* Limits */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" /> Global Limits
          </h3>
          <div className="space-y-2">
            <label className="block">
              <span className="text-xs text-muted-foreground">Daily Message Limit (per user)</span>
              <input type="number" value={config.global_daily_limit} onChange={e => update("global_daily_limit", Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Max Conversation History</span>
              <input type="number" value={config.max_conversation_history} onChange={e => update("max_conversation_history", Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground mt-1" />
            </label>
            <label className="block">
              <span className="text-xs text-muted-foreground">Cost per Request ($)</span>
              <input type="number" step="0.0001" value={config.cost_per_request} onChange={e => update("cost_per_request", Number(e.target.value))}
                className="w-full px-3 py-1.5 rounded-lg bg-secondary border border-border text-sm text-foreground mt-1" />
            </label>
          </div>
        </div>

        {/* System prompt override */}
        <div className="bg-card rounded-xl border border-border p-4 space-y-3">
          <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> System Prompt Override
          </h3>
          <textarea
            value={config.system_prompt_override || ""}
            onChange={e => update("system_prompt_override", e.target.value || null)}
            placeholder="Leave empty to use default ACRY Intelligence prompt..."
            rows={5}
            className="w-full px-3 py-2 rounded-lg bg-secondary border border-border text-xs text-foreground resize-none"
          />
          <p className="text-[10px] text-muted-foreground">Overrides the default system prompt. Leave empty for default behavior.</p>
        </div>
      </div>

      {/* Save */}
      <div className="flex justify-end">
        <button onClick={saveConfig} disabled={saving} className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Save Configuration
        </button>
      </div>
    </div>
  );
};

// ─── Users Tab ───
const UsersTab = ({ userLimits, search, setSearch, toggleUserAccess, updateUserLimit, resetUserUsage, timeAgo }: any) => {
  const filtered = userLimits.filter((u: UserChatLimit) =>
    u.user_id.toLowerCase().includes(search.toLowerCase()) ||
    (u.notes || "").toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search users..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" />
        </div>
        <span className="text-xs text-muted-foreground">{filtered.length} users</span>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <Users className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No user chat limits configured yet.</p>
          <p className="text-xs text-muted-foreground mt-1">Limits are created when users first interact with the chat.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u: UserChatLimit) => (
            <div key={u.id} className="bg-card rounded-xl border border-border p-3">
              <div className="flex items-center gap-3">
                <div className={`w-2 h-2 rounded-full ${u.chat_enabled ? "bg-green-500" : "bg-destructive"}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-mono text-foreground truncate">{u.user_id.slice(0, 8)}…</p>
                  <p className="text-[10px] text-muted-foreground">
                    {u.messages_used_today}/{u.daily_message_limit} today • {u.total_messages_sent} total • ${Number(u.estimated_cost).toFixed(4)}
                  </p>
                </div>
                <span className="text-[10px] text-muted-foreground">{timeAgo(u.last_message_at)}</span>
                <div className="flex gap-1">
                  <button onClick={() => toggleUserAccess(u)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title={u.chat_enabled ? "Disable" : "Enable"}>
                    {u.chat_enabled ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-muted-foreground" />}
                  </button>
                  <button onClick={() => resetUserUsage(u.id)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors" title="Reset daily usage">
                    <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <select
                    value={u.daily_message_limit}
                    onChange={e => updateUserLimit(u.id, Number(e.target.value))}
                    className="text-[10px] bg-secondary border border-border rounded-lg px-1.5 py-1 text-foreground"
                  >
                    {[10, 25, 50, 100, 200, 500, 1000].map(v => (
                      <option key={v} value={v}>{v}/day</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Conversations Tab ───
const ConversationsTab = ({ conversations, search, setSearch, expanded, setExpanded, timeAgo }: any) => {
  const filtered = conversations.filter((c: any) =>
    c.user_id.toLowerCase().includes(search.toLowerCase()) ||
    c.messages.some((m: any) => m.content.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search conversations..."
            className="w-full pl-9 pr-3 py-2 rounded-lg bg-secondary border border-border text-sm text-foreground" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-12">
          <MessageSquare className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No conversations found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((c: any) => (
            <div key={c.user_id} className="bg-card rounded-xl border border-border overflow-hidden">
              <button
                onClick={() => setExpanded(expanded === c.user_id ? null : c.user_id)}
                className="w-full flex items-center gap-3 p-3 hover:bg-secondary/50 transition-colors"
              >
                <MessageSquare className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 text-left min-w-0">
                  <p className="text-xs font-mono text-foreground">{c.user_id.slice(0, 12)}…</p>
                  <p className="text-[10px] text-muted-foreground">{c.message_count} msgs • {c.bookmarked_count} bookmarked • Last: {timeAgo(c.last_message)}</p>
                </div>
                {expanded === c.user_id ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
              </button>
              <AnimatePresence>
                {expanded === c.user_id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                    <div className="p-3 pt-0 space-y-1.5 max-h-64 overflow-y-auto">
                      {c.messages.map((m: any, i: number) => (
                        <div key={i} className={`text-xs p-2 rounded-lg ${m.role === "user" ? "bg-primary/10 text-foreground" : "bg-secondary text-foreground"}`}>
                          <span className="font-semibold text-[10px] text-muted-foreground uppercase">{m.role}</span>
                          {m.bookmarked && <span className="text-[10px] text-yellow-500 ml-1">⭐</span>}
                          <p className="mt-0.5 line-clamp-3">{m.content}</p>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Logs Tab ───
const LogsTab = ({ usageLogs, timeAgo }: { usageLogs: UsageLog[]; timeAgo: (d: string | null) => string }) => (
  <div className="space-y-3">
    <div className="flex items-center justify-between">
      <h3 className="text-sm font-semibold text-foreground">Recent Usage Logs</h3>
      <span className="text-xs text-muted-foreground">{usageLogs.length} entries</span>
    </div>
    {usageLogs.length === 0 ? (
      <div className="text-center py-12">
        <Activity className="w-10 h-10 text-muted-foreground/40 mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No usage logs yet</p>
      </div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="text-left text-muted-foreground border-b border-border">
              <th className="py-2 px-2 font-medium">User</th>
              <th className="py-2 px-2 font-medium">Model</th>
              <th className="py-2 px-2 font-medium">Latency</th>
              <th className="py-2 px-2 font-medium">Cost</th>
              <th className="py-2 px-2 font-medium">Status</th>
              <th className="py-2 px-2 font-medium">Time</th>
            </tr>
          </thead>
          <tbody>
            {usageLogs.slice(0, 50).map(log => (
              <tr key={log.id} className="border-b border-border/50 hover:bg-secondary/30">
                <td className="py-2 px-2 font-mono">{log.user_id.slice(0, 8)}…</td>
                <td className="py-2 px-2">{log.model_used.split("/")[1]}</td>
                <td className="py-2 px-2">{log.latency_ms ? `${log.latency_ms}ms` : "—"}</td>
                <td className="py-2 px-2">{log.estimated_cost ? `$${Number(log.estimated_cost).toFixed(4)}` : "—"}</td>
                <td className="py-2 px-2">
                  <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-medium ${
                    log.status === "success" ? "bg-green-500/15 text-green-500" : "bg-destructive/15 text-destructive"
                  }`}>
                    {log.status === "success" ? <Check className="w-2.5 h-2.5" /> : <X className="w-2.5 h-2.5" />}
                    {log.status}
                  </span>
                </td>
                <td className="py-2 px-2 text-muted-foreground">{timeAgo(log.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export default ChatManagement;
