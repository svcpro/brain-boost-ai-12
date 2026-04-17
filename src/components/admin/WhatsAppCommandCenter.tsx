import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  MessageSquare, Send, Clock, BarChart3, Zap, Settings2,
  CheckCircle2, XCircle, Loader2, Search, RefreshCw, AlertTriangle,
  CalendarClock, Users, FileText, ShieldCheck, Plus, Trash2
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type Tab = "compose" | "history" | "quotas" | "templates" | "meta" | "rules" | "schedule" | "analytics" | "settings";

interface Template { id: string; name: string; body_template: string; category: string; variables: string[]; is_active: boolean; }
interface Message { id: string; user_id: string | null; to_number: string; template_name: string | null; status: string; category: string; error_message: string | null; created_at: string; }
interface Trigger { id: string; trigger_key: string; display_name: string; category: string; is_enabled: boolean; template_name: string; cooldown_minutes: number; total_sent: number; total_delivered: number; }
interface ScheduledSend { id: string; template_name: string; category: string; audience_type: string; scheduled_at: string; status: string; total_recipients: number; delivered_count: number; }
interface Config { id: string; is_enabled: boolean; monthly_limit_per_user: number; allowed_categories: string[]; fallback_channels: string[]; auto_fallback_on_quota_exceeded: boolean; integrated_number: string; }
interface MetaTemplate {
  id: string; template_name: string; display_name: string; category: string; language: string;
  header_type: string; body_text: string; footer_text: string | null; variables: any;
  approval_status: string; meta_template_id: string | null; msg91_template_id: string | null;
  use_case: string | null; quality_score: string | null; rejection_reason: string | null;
  is_active: boolean; approved_at: string | null;
}

const WhatsAppCommandCenter = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [tab, setTab] = useState<Tab>("compose");
  const [loading, setLoading] = useState(false);

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-success/15 flex items-center justify-center">
            <MessageSquare className="w-5 h-5 text-success" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-foreground">WhatsApp Notification Center</h2>
            <p className="text-xs text-muted-foreground mt-0.5">MSG91 WhatsApp · 40 msgs/user/month · auto-fallback to Push & Email</p>
          </div>
        </div>
      </div>

      <div className="flex gap-2 flex-wrap">
        {([
          { key: "compose" as Tab, label: "Compose & Send", icon: Send },
          { key: "history" as Tab, label: "History", icon: Clock },
          { key: "quotas" as Tab, label: "User Quotas", icon: Users },
          { key: "templates" as Tab, label: "Templates", icon: FileText },
          { key: "meta" as Tab, label: "Meta Approval", icon: ShieldCheck },
          { key: "rules" as Tab, label: "Automation", icon: Zap },
          { key: "schedule" as Tab, label: "Schedule", icon: CalendarClock },
          { key: "analytics" as Tab, label: "Analytics", icon: BarChart3 },
          { key: "settings" as Tab, label: "Settings", icon: Settings2 },
        ]).map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
              tab === t.key
                ? "bg-success/20 text-success border border-success/30"
                : "bg-muted/40 text-muted-foreground border border-border/50 hover:bg-muted/60"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <div className="rounded-2xl border border-border/50 bg-card/40 backdrop-blur-xl p-4">
        {tab === "compose" && <ComposeTab />}
        {tab === "history" && <HistoryTab />}
        {tab === "quotas" && <QuotasTab />}
        {tab === "templates" && <TemplatesTab />}
        {tab === "meta" && <MetaTemplatesTab />}
        {tab === "rules" && <RulesTab />}
        {tab === "schedule" && <ScheduleTab />}
        {tab === "analytics" && <AnalyticsTab />}
        {tab === "settings" && <SettingsTab />}
      </div>
    </div>
  );
};

// ─── Compose ────────────────────────────────────────────
const ComposeTab = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [audienceMode, setAudienceMode] = useState<"all" | "single">("single");
  const [phone, setPhone] = useState("");
  const [userId, setUserId] = useState("");
  const [variables, setVariables] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  useEffect(() => { loadTemplates(); }, []);
  const loadTemplates = async () => {
    const { data } = await supabase.from("whatsapp_templates").select("*").eq("is_active", true).order("name");
    setTemplates((data as any) || []);
    if (data?.[0]) setTemplateName((data[0] as any).name);
  };

  const selected = templates.find(t => t.name === templateName);

  const send = async () => {
    if (!templateName) return toast({ title: "Pick a template", variant: "destructive" });
    if (audienceMode === "single" && !phone && !userId) return toast({ title: "Enter phone or user_id", variant: "destructive" });

    setSending(true);
    try {
      if (audienceMode === "all") {
        const { data: users } = await supabase.from("profiles").select("id").eq("whatsapp_enabled", true).limit(1000);
        const ids = (users || []).map((u: any) => u.id);
        const { data, error } = await supabase.functions.invoke("whatsapp-notify", {
          body: { action: "bulk-send", user_ids: ids, template_name: templateName, category: selected?.category || "engagement", variables, source: "admin_broadcast" },
        });
        if (error) throw error;
        toast({ title: `Bulk send complete`, description: `Delivered: ${data.delivered} · Blocked: ${data.blocked_quota} · Fallback sent: ${data.fallback_sent}` });
      } else {
        const { data, error } = await supabase.functions.invoke("whatsapp-notify", {
          body: { action: "send", user_id: userId || undefined, phone: phone || undefined, template_name: templateName, category: selected?.category || "engagement", variables, source: "admin" },
        });
        if (error) throw error;
        toast({ title: data.ok ? "Sent ✓" : `Blocked: ${data.blocked || data.error}`, variant: data.ok ? "default" : "destructive" });
      }
    } catch (e: any) {
      toast({ title: "Send failed", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="text-xs text-muted-foreground">Template</label>
        <select value={templateName} onChange={e => setTemplateName(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {templates.map(t => <option key={t.id} value={t.name}>{t.name} · [{t.category}]</option>)}
        </select>
        {selected && <p className="text-[11px] text-muted-foreground mt-1.5 italic">{selected.body_template}</p>}
      </div>

      {selected?.variables?.length ? (
        <div className="space-y-2">
          <label className="text-xs text-muted-foreground">Variables</label>
          {selected.variables.map(v => (
            <input key={v} placeholder={`{{${v}}}`} value={variables[v] || ""} onChange={e => setVariables({ ...variables, [v]: e.target.value })}
              className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          ))}
        </div>
      ) : null}

      <div className="flex gap-2">
        <button onClick={() => setAudienceMode("single")} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${audienceMode === "single" ? "bg-success/20 text-success" : "bg-muted/40 text-muted-foreground"}`}>Single user</button>
        <button onClick={() => setAudienceMode("all")} className={`flex-1 px-3 py-1.5 rounded-lg text-xs font-medium ${audienceMode === "all" ? "bg-success/20 text-success" : "bg-muted/40 text-muted-foreground"}`}>All opted-in users</button>
      </div>

      {audienceMode === "single" && (
        <div className="grid grid-cols-2 gap-2">
          <input placeholder="Phone (e.g. 9696969696)" value={phone} onChange={e => setPhone(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          <input placeholder="OR user_id (uuid)" value={userId} onChange={e => setUserId(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono" />
        </div>
      )}

      <button onClick={send} disabled={sending} className="w-full py-2.5 rounded-xl bg-success text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-50">
        {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Send WhatsApp
      </button>
    </div>
  );
};

// ─── History ────────────────────────────────────────────
const HistoryTab = () => {
  const [logs, setLogs] = useState<Message[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(false);
  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const { data } = await supabase.from("whatsapp_messages").select("*").order("created_at", { ascending: false }).limit(200);
    setLogs((data as any) || []);
    setLoading(false);
  };
  const filtered = logs.filter(l => !search || l.to_number?.includes(search) || l.template_name?.includes(search));

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <input placeholder="Search phone or template" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg bg-background border border-border text-sm" />
        </div>
        <button onClick={load} className="p-2 rounded-lg bg-muted/40 hover:bg-muted/60"><RefreshCw className="w-3.5 h-3.5" /></button>
      </div>
      <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> :
          filtered.map(l => (
            <div key={l.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/30">
              <div className={`w-7 h-7 rounded-full flex items-center justify-center ${l.status === "sent" ? "bg-success/15" : l.status === "blocked_quota" ? "bg-warning/15" : "bg-destructive/15"}`}>
                {l.status === "sent" ? <CheckCircle2 className="w-3.5 h-3.5 text-success" /> : l.status === "blocked_quota" ? <AlertTriangle className="w-3.5 h-3.5 text-warning" /> : <XCircle className="w-3.5 h-3.5 text-destructive" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-mono text-foreground truncate">{l.to_number} · <span className="text-muted-foreground">{l.template_name || "(custom)"}</span></p>
                <p className="text-[10px] text-muted-foreground">{l.category} · {formatDistanceToNow(new Date(l.created_at), { addSuffix: true })}{l.error_message ? ` · ${l.error_message}` : ""}</p>
              </div>
            </div>
          ))}
        {!loading && filtered.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No messages yet</p>}
      </div>
    </div>
  );
};

// ─── Quotas ────────────────────────────────────────────
const QuotasTab = () => {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("whatsapp_quota").select("*").order("count", { ascending: false }).limit(100);
    setRows(data || []);
  })(); }, []);
  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      <p className="text-xs text-muted-foreground mb-2">Top users by usage this month (hard cap 40)</p>
      {rows.map(r => (
        <div key={r.user_id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex-1 min-w-0">
            <p className="text-xs font-mono truncate">{r.user_id}</p>
            <p className="text-[10px] text-muted-foreground">Reset: {format(new Date(r.reset_at), "MMM dd")}</p>
          </div>
          <div className={`px-2.5 py-1 rounded-md text-xs font-bold ${r.count >= r.monthly_limit ? "bg-destructive/20 text-destructive" : r.count >= r.monthly_limit * 0.8 ? "bg-warning/20 text-warning" : "bg-success/20 text-success"}`}>
            {r.count}/{r.monthly_limit}
          </div>
        </div>
      ))}
      {rows.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No quota usage yet</p>}
    </div>
  );
};

// ─── Templates ────────────────────────────────────────────
const TemplatesTab = () => {
  const [templates, setTemplates] = useState<Template[]>([]);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("whatsapp_templates").select("*").order("name");
    setTemplates((data as any) || []);
  })(); }, []);
  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {templates.map(t => (
        <div key={t.id} className="p-3 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold font-mono">{t.name}</p>
            <span className={`text-[10px] px-2 py-0.5 rounded-md ${t.category === "critical" ? "bg-destructive/15 text-destructive" : "bg-primary/15 text-primary"}`}>{t.category}</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1 italic">{t.body_template}</p>
          {t.variables?.length > 0 && <p className="text-[10px] text-muted-foreground mt-1">Variables: {t.variables.join(", ")}</p>}
        </div>
      ))}
    </div>
  );
};

// ─── Rules (Automation) ────────────────────────────────────────────
const RulesTab = () => {
  const [rules, setRules] = useState<Trigger[]>([]);
  useEffect(() => { load(); }, []);
  const load = async () => {
    const { data } = await supabase.from("whatsapp_triggers").select("*").order("display_name");
    setRules((data as any) || []);
  };
  const toggle = async (id: string, val: boolean) => {
    await supabase.from("whatsapp_triggers").update({ is_enabled: val }).eq("id", id);
    load();
  };
  return (
    <div className="space-y-2 max-h-[500px] overflow-y-auto">
      {rules.map(r => (
        <div key={r.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
          <div className="flex-1">
            <p className="text-sm font-semibold">{r.display_name}</p>
            <p className="text-[10px] text-muted-foreground">Event: <span className="font-mono">{r.trigger_key}</span> → {r.template_name} · cooldown {r.cooldown_minutes}m · {r.total_delivered}/{r.total_sent} delivered</p>
          </div>
          <button onClick={() => toggle(r.id, !r.is_enabled)} className={`px-3 py-1 rounded-md text-xs font-semibold ${r.is_enabled ? "bg-success/20 text-success" : "bg-muted/40 text-muted-foreground"}`}>
            {r.is_enabled ? "Enabled" : "Disabled"}
          </button>
        </div>
      ))}
      {rules.length === 0 && <p className="text-xs text-muted-foreground text-center py-8">No automation rules configured yet</p>}
    </div>
  );
};

// ─── Schedule ────────────────────────────────────────────
const ScheduleTab = () => {
  const { toast } = useToast();
  const [sends, setSends] = useState<ScheduledSend[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [scheduledAt, setScheduledAt] = useState("");

  useEffect(() => { load(); }, []);
  const load = async () => {
    const { data: s } = await supabase.from("whatsapp_scheduled_sends").select("*").order("scheduled_at", { ascending: false }).limit(50);
    setSends((s as any) || []);
    const { data: t } = await supabase.from("whatsapp_templates").select("*").eq("is_active", true);
    setTemplates((t as any) || []);
    if (t?.[0]) setTemplateName((t[0] as any).name);
  };

  const schedule = async () => {
    if (!templateName || !scheduledAt) return toast({ title: "Pick template + date", variant: "destructive" });
    const tpl = templates.find(t => t.name === templateName);
    const { error } = await supabase.from("whatsapp_scheduled_sends").insert({
      template_name: templateName, category: tpl?.category || "engagement", audience_type: "all",
      scheduled_at: new Date(scheduledAt).toISOString(), variables: {},
    });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Scheduled ✓" }); load(); }
  };

  const runNow = async () => {
    const { data, error } = await supabase.functions.invoke("whatsapp-notify", { body: { action: "execute-scheduled" } });
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else toast({ title: `Executed ${data.executed} jobs` });
    load();
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
        <select value={templateName} onChange={e => setTemplateName(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
          {templates.map(t => <option key={t.id} value={t.name}>{t.name}</option>)}
        </select>
        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)} className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
        <button onClick={schedule} className="py-2 rounded-lg bg-success text-white text-sm font-semibold">Schedule (All Users)</button>
      </div>
      <button onClick={runNow} className="w-full py-2 rounded-lg bg-muted/40 text-foreground text-xs font-semibold border border-border/50">▶ Run Due Jobs Now</button>

      <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
        {sends.map(s => (
          <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-muted/20 border border-border/30">
            <div className="flex-1">
              <p className="text-xs font-semibold">{s.template_name} → {s.audience_type}</p>
              <p className="text-[10px] text-muted-foreground">{format(new Date(s.scheduled_at), "MMM dd, HH:mm")} · {s.delivered_count}/{s.total_recipients} delivered</p>
            </div>
            <span className={`text-[10px] px-2 py-1 rounded-md ${s.status === "completed" ? "bg-success/20 text-success" : s.status === "scheduled" ? "bg-primary/20 text-primary" : "bg-muted/40"}`}>{s.status}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

// ─── Analytics ────────────────────────────────────────────
const AnalyticsTab = () => {
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, blocked: 0, fallback: 0 });
  useEffect(() => { (async () => {
    const { data } = await supabase.from("whatsapp_messages").select("status").gte("created_at", new Date(Date.now() - 30 * 86400000).toISOString());
    const arr = data || [];
    setStats({
      total: arr.length,
      sent: arr.filter((m: any) => m.status === "sent").length,
      failed: arr.filter((m: any) => m.status === "failed").length,
      blocked: arr.filter((m: any) => m.status === "blocked_quota").length,
      fallback: 0,
    });
  })(); }, []);
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {[
        { label: "Total (30d)", value: stats.total, color: "text-primary" },
        { label: "Delivered", value: stats.sent, color: "text-success" },
        { label: "Failed", value: stats.failed, color: "text-destructive" },
        { label: "Blocked (quota)", value: stats.blocked, color: "text-warning" },
      ].map(c => (
        <div key={c.label} className="p-4 rounded-xl bg-muted/20 border border-border/30">
          <p className="text-[10px] text-muted-foreground uppercase">{c.label}</p>
          <p className={`text-2xl font-bold mt-1 ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Settings ────────────────────────────────────────────
const SettingsTab = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<Config | null>(null);
  useEffect(() => { (async () => {
    const { data } = await supabase.from("whatsapp_config").select("*").limit(1).maybeSingle();
    setConfig(data as any);
  })(); }, []);
  const save = async () => {
    if (!config) return;
    const { error } = await supabase.from("whatsapp_config").update({
      is_enabled: config.is_enabled,
      monthly_limit_per_user: config.monthly_limit_per_user,
      auto_fallback_on_quota_exceeded: config.auto_fallback_on_quota_exceeded,
      allowed_categories: config.allowed_categories,
      fallback_channels: config.fallback_channels,
    }).eq("id", config.id);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Settings saved ✓" });
  };
  if (!config) return <Loader2 className="w-5 h-5 animate-spin mx-auto" />;
  return (
    <div className="space-y-4">
      <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
        <input type="checkbox" checked={config.is_enabled} onChange={e => setConfig({ ...config, is_enabled: e.target.checked })} />
        <div className="flex-1">
          <p className="text-sm font-semibold">WhatsApp notifications enabled</p>
          <p className="text-[11px] text-muted-foreground">Master switch for all WhatsApp sends</p>
        </div>
      </label>
      <div>
        <label className="text-xs text-muted-foreground">Monthly limit per user</label>
        <input type="number" min={1} max={1000} value={config.monthly_limit_per_user} onChange={e => setConfig({ ...config, monthly_limit_per_user: Number(e.target.value) })}
          className="w-full mt-1 px-3 py-2 rounded-lg bg-background border border-border text-sm" />
      </div>
      <label className="flex items-center gap-3 p-3 rounded-lg bg-muted/20 border border-border/30">
        <input type="checkbox" checked={config.auto_fallback_on_quota_exceeded} onChange={e => setConfig({ ...config, auto_fallback_on_quota_exceeded: e.target.checked })} />
        <div className="flex-1">
          <p className="text-sm font-semibold">Auto fallback to Push + Email when quota exceeded</p>
          <p className="text-[11px] text-muted-foreground">Critical alerts still reach the user via other channels</p>
        </div>
      </label>
      <div>
        <label className="text-xs text-muted-foreground">MSG91 integrated number</label>
        <input value={config.integrated_number} disabled className="w-full mt-1 px-3 py-2 rounded-lg bg-muted/30 border border-border text-sm font-mono" />
      </div>
      <button onClick={save} className="w-full py-2.5 rounded-xl bg-success text-white text-sm font-semibold">Save Settings</button>
    </div>
  );
};

// ─── Meta Templates (Approval Tracking) ───────────────────────────────
const MetaTemplatesTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const [templates, setTemplates] = useState<MetaTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected" | "submitted">("all");
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<Partial<MetaTemplate>>({
    template_name: "", display_name: "", category: "UTILITY", language: "en",
    header_type: "NONE", body_text: "", footer_text: "", variables: [], use_case: "",
    approval_status: "pending",
  });

  useEffect(() => { load(); }, []);
  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("whatsapp_meta_templates" as any)
      .select("*")
      .order("created_at", { ascending: false });
    if (error) toast({ title: "Load failed", description: error.message, variant: "destructive" });
    setTemplates(((data as any) || []) as MetaTemplate[]);
    setLoading(false);
  };

  const save = async () => {
    if (!form.template_name || !form.body_text) {
      return toast({ title: "Name & body required", variant: "destructive" });
    }
    const payload = {
      ...form,
      template_name: form.template_name?.toLowerCase().replace(/[^a-z0-9_]/g, "_"),
      created_by: user?.id,
      variables: form.variables || [],
    };
    const { error } = await supabase.from("whatsapp_meta_templates" as any).insert(payload as any);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Template added ✓", description: "Submit to Meta via MSG91 dashboard for approval" });
      setShowForm(false);
      setForm({ template_name: "", display_name: "", category: "UTILITY", language: "en", header_type: "NONE", body_text: "", footer_text: "", variables: [], use_case: "", approval_status: "pending" });
      load();
    }
  };

  const updateStatus = async (id: string, status: string, extra: Record<string, any> = {}) => {
    const patch: any = { approval_status: status, ...extra };
    if (status === "approved") patch.approved_at = new Date().toISOString();
    const { error } = await supabase.from("whatsapp_meta_templates" as any).update(patch).eq("id", id);
    if (error) toast({ title: "Update failed", description: error.message, variant: "destructive" });
    else { toast({ title: `Marked as ${status}` }); load(); }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    const { error } = await supabase.from("whatsapp_meta_templates" as any).delete().eq("id", id);
    if (error) toast({ title: "Delete failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Deleted" }); load(); }
  };

  const filtered = templates.filter(t => filter === "all" || t.approval_status === filter);

  const statusBadge = (s: string) => {
    const map: Record<string, string> = {
      approved: "bg-success/20 text-success",
      pending: "bg-warning/20 text-warning",
      submitted: "bg-primary/20 text-primary",
      rejected: "bg-destructive/20 text-destructive",
      paused: "bg-muted/40 text-muted-foreground",
    };
    return map[s] || "bg-muted/40 text-muted-foreground";
  };

  const categoryColor = (c: string) => {
    if (c === "AUTHENTICATION") return "bg-primary/15 text-primary";
    if (c === "MARKETING") return "bg-accent/15 text-accent-foreground";
    return "bg-success/15 text-success";
  };

  const counts = {
    all: templates.length,
    approved: templates.filter(t => t.approval_status === "approved").length,
    pending: templates.filter(t => t.approval_status === "pending").length,
    submitted: templates.filter(t => t.approval_status === "submitted").length,
    rejected: templates.filter(t => t.approval_status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3 p-3 rounded-lg bg-blue-500/5 border border-blue-500/20">
        <ShieldCheck className="w-4 h-4 text-blue-400 mt-0.5 flex-shrink-0" />
        <div className="text-[11px] text-muted-foreground leading-relaxed">
          <strong className="text-foreground">Meta WhatsApp Business templates</strong> require approval from Meta before they can be sent outside the 24-hour customer service window. Add templates here, submit them via MSG91 / Meta Business Manager, then mark them <strong>Approved</strong> with the returned template ID.
        </div>
      </div>

      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex gap-1.5 flex-wrap">
          {(["all", "approved", "pending", "submitted", "rejected"] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={`px-2.5 py-1 rounded-md text-[11px] font-semibold ${filter === f ? "bg-success/20 text-success" : "bg-muted/40 text-muted-foreground"}`}>
              {f.charAt(0).toUpperCase() + f.slice(1)} ({counts[f]})
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="p-2 rounded-lg bg-muted/40 hover:bg-muted/60"><RefreshCw className="w-3.5 h-3.5" /></button>
          <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-success/20 text-success text-xs font-semibold">
            <Plus className="w-3.5 h-3.5" /> New Template
          </button>
        </div>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
          className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <input placeholder="template_name (e.g. payment_success)" value={form.template_name || ""} onChange={e => setForm({ ...form, template_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm font-mono" />
            <input placeholder="Display name" value={form.display_name || ""} onChange={e => setForm({ ...form, display_name: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
              <option value="UTILITY">UTILITY</option>
              <option value="MARKETING">MARKETING</option>
              <option value="AUTHENTICATION">AUTHENTICATION</option>
            </select>
            <select value={form.language} onChange={e => setForm({ ...form, language: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
              <option value="en">English (en)</option>
              <option value="hi">Hindi (hi)</option>
              <option value="en_US">English US</option>
            </select>
            <select value={form.header_type} onChange={e => setForm({ ...form, header_type: e.target.value })}
              className="px-3 py-2 rounded-lg bg-background border border-border text-sm">
              <option value="NONE">No header</option>
              <option value="TEXT">Text header</option>
              <option value="IMAGE">Image header</option>
              <option value="VIDEO">Video header</option>
              <option value="DOCUMENT">Document header</option>
            </select>
          </div>
          <textarea placeholder="Body text (use {{1}} {{2}} for variables)" value={form.body_text || ""} onChange={e => setForm({ ...form, body_text: e.target.value })}
            rows={4} className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          <input placeholder="Footer (optional)" value={form.footer_text || ""} onChange={e => setForm({ ...form, footer_text: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          <input placeholder="Use case (e.g. streak_break, exam_countdown)" value={form.use_case || ""} onChange={e => setForm({ ...form, use_case: e.target.value })}
            className="w-full px-3 py-2 rounded-lg bg-background border border-border text-sm" />
          <div className="flex gap-2">
            <button onClick={save} className="flex-1 py-2 rounded-lg bg-success text-white text-sm font-semibold">Save Template</button>
            <button onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg bg-muted/40 text-foreground text-sm">Cancel</button>
          </div>
        </motion.div>
      )}

      <div className="space-y-2 max-h-[500px] overflow-y-auto">
        {loading ? <Loader2 className="w-5 h-5 animate-spin mx-auto my-8" /> :
          filtered.map(t => (
            <div key={t.id} className="p-3 rounded-lg bg-muted/20 border border-border/30 space-y-2">
              <div className="flex items-start justify-between gap-2 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-sm font-bold font-mono">{t.template_name}</p>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${categoryColor(t.category)}`}>{t.category}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${statusBadge(t.approval_status)}`}>{t.approval_status.toUpperCase()}</span>
                    <span className="text-[10px] px-2 py-0.5 rounded-md bg-muted/40 text-muted-foreground">{t.language}</span>
                    {t.quality_score && (
                      <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold ${t.quality_score === "GREEN" ? "bg-success/20 text-success" : t.quality_score === "YELLOW" ? "bg-warning/20 text-warning" : "bg-destructive/20 text-destructive"}`}>
                        Quality: {t.quality_score}
                      </span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5">{t.display_name}{t.use_case ? ` · use case: ${t.use_case}` : ""}</p>
                </div>
                <button onClick={() => remove(t.id)} className="p-1.5 rounded-md bg-destructive/10 hover:bg-destructive/20 text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="text-xs bg-background/60 p-2.5 rounded-md border border-border/30 whitespace-pre-wrap font-mono">
                {t.header_type !== "NONE" && <p className="text-[10px] text-muted-foreground mb-1">[{t.header_type} HEADER]</p>}
                {t.body_text}
                {t.footer_text && <p className="text-[10px] text-muted-foreground mt-1.5">— {t.footer_text}</p>}
              </div>

              {t.variables && Array.isArray(t.variables) && t.variables.length > 0 && (
                <p className="text-[10px] text-muted-foreground">
                  <strong>Variables:</strong> {t.variables.map((v: any) => `{{${v.key || v}}}`).join(", ")}
                </p>
              )}

              {t.meta_template_id && <p className="text-[10px] text-muted-foreground font-mono">Meta ID: {t.meta_template_id}</p>}
              {t.rejection_reason && <p className="text-[11px] text-destructive">⚠ {t.rejection_reason}</p>}

              <div className="flex gap-1.5 flex-wrap pt-1">
                {t.approval_status !== "submitted" && (
                  <button onClick={() => updateStatus(t.id, "submitted")}
                    className="px-2.5 py-1 rounded-md bg-primary/15 text-primary text-[11px] font-semibold">Mark Submitted</button>
                )}
                {t.approval_status !== "approved" && (
                  <button onClick={() => {
                    const id = prompt("Meta template ID returned after approval:");
                    if (id) updateStatus(t.id, "approved", { meta_template_id: id });
                  }} className="px-2.5 py-1 rounded-md bg-success/15 text-success text-[11px] font-semibold">Mark Approved</button>
                )}
                {t.approval_status !== "rejected" && (
                  <button onClick={() => {
                    const reason = prompt("Rejection reason:");
                    if (reason) updateStatus(t.id, "rejected", { rejection_reason: reason });
                  }} className="px-2.5 py-1 rounded-md bg-destructive/15 text-destructive text-[11px] font-semibold">Mark Rejected</button>
                )}
              </div>
            </div>
          ))}
        {!loading && filtered.length === 0 && (
          <p className="text-xs text-muted-foreground text-center py-8">No templates in this category</p>
        )}
      </div>
    </div>
  );
};

export default WhatsAppCommandCenter;
