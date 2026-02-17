import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import {
  Mail, Send, Clock, BarChart3, Zap, Eye, Pencil,
  RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, ArrowUpRight, Play, Trash2, Plus, Search,
  FileText, Filter, LayoutDashboard, Rocket, TestTube,
  Gauge, Activity, Target, Users, MousePointerClick, MailOpen,
  Sparkles, Copy, Power, ChevronRight
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ───
type EmailTrigger = {
  id: string; trigger_key: string; display_name: string; description: string | null;
  category: string; template_id: string | null; is_enabled: boolean;
  conditions: Record<string, unknown>; cooldown_hours: number; priority: string;
  created_at: string; updated_at: string;
};
type EmailLog = {
  id: string; user_id: string; trigger_key: string; to_email: string; subject: string;
  status: string; opened_at: string | null; clicked_at: string | null;
  delivered_at: string | null; bounced_at: string | null;
  error_message: string | null; created_at: string;
};
type EmailQueueItem = {
  id: string; user_id: string; trigger_key: string; to_email: string; subject: string;
  status: string; priority: string; retry_count: number; error_message: string | null;
  scheduled_at: string; sent_at: string | null; created_at: string;
};
type EmailTemplate = {
  id: string; name: string; subject: string; html_body: string; category: string | null;
  is_active: boolean | null; variables: string[] | null; created_at: string; updated_at: string;
};

const CATEGORIES = [
  { value: "user_lifecycle", label: "User Lifecycle", color: "bg-indigo-500/15 text-indigo-400", icon: "👤" },
  { value: "ai_brain", label: "AI Brain", color: "bg-teal-500/15 text-teal-400", icon: "🧠" },
  { value: "study_reminder", label: "Study Reminder", color: "bg-amber-500/15 text-amber-400", icon: "📚" },
  { value: "study_progress", label: "Study Progress", color: "bg-emerald-500/15 text-emerald-400", icon: "📈" },
  { value: "rank_performance", label: "Rank & Performance", color: "bg-blue-500/15 text-blue-400", icon: "🏆" },
  { value: "community", label: "Community", color: "bg-purple-500/15 text-purple-400", icon: "💬" },
  { value: "billing", label: "Billing", color: "bg-pink-500/15 text-pink-400", icon: "💳" },
  { value: "security", label: "Security", color: "bg-red-500/15 text-red-400", icon: "🔐" },
  { value: "system", label: "System", color: "bg-slate-500/15 text-slate-400", icon: "⚙️" },
  { value: "engagement", label: "Engagement", color: "bg-teal-500/15 text-teal-400", icon: "🔥" },
  { value: "general", label: "General", color: "bg-slate-500/15 text-slate-400", icon: "📧" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/15 text-destructive border-destructive/20",
  normal: "bg-primary/15 text-primary border-primary/20",
  low: "bg-muted text-muted-foreground border-border",
};

const STATUS_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  sent: { icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
  delivered: { icon: CheckCircle2, color: "text-blue-400", bg: "bg-blue-500/10" },
  opened: { icon: MailOpen, color: "text-amber-400", bg: "bg-amber-500/10" },
  clicked: { icon: MousePointerClick, color: "text-purple-400", bg: "bg-purple-500/10" },
  failed: { icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
  bounced: { icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
  pending: { icon: Clock, color: "text-muted-foreground", bg: "bg-muted" },
  processing: { icon: Loader2, color: "text-primary", bg: "bg-primary/10" },
};

const EmailManagement = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
          <Mail className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold text-foreground">Email Command Center</h1>
          <p className="text-sm text-muted-foreground">Ultra-advanced automation, templates, queue & analytics</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border flex-wrap h-auto gap-1 p-1">
          <TabsTrigger value="overview" className="text-xs"><LayoutDashboard className="w-3.5 h-3.5 mr-1" />Overview</TabsTrigger>
          <TabsTrigger value="triggers" className="text-xs"><Zap className="w-3.5 h-3.5 mr-1" />Triggers</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs"><FileText className="w-3.5 h-3.5 mr-1" />Templates</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs"><Clock className="w-3.5 h-3.5 mr-1" />Queue</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs"><Send className="w-3.5 h-3.5 mr-1" />Logs</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs"><BarChart3 className="w-3.5 h-3.5 mr-1" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="overview"><OverviewTab /></TabsContent>
        <TabsContent value="triggers"><TriggersTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="queue"><QueueTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Overview Dashboard ───
const OverviewTab = () => {
  const [stats, setStats] = useState({ totalSent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, queuePending: 0, activeTriggers: 0, totalTriggers: 0, templates: 0 });
  const [recentEmails, setRecentEmails] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [triggerDailySending, setTriggerDailySending] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    (async () => {
      const [logsRes, queueRes, triggersRes, templatesRes, recentRes] = await Promise.all([
        supabase.from("email_logs").select("status"),
        supabase.from("email_queue").select("id", { count: "exact", head: true }).eq("status", "pending"),
        supabase.from("email_triggers").select("is_enabled"),
        supabase.from("email_templates").select("id", { count: "exact", head: true }),
        supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(5),
      ]);
      const logs = (logsRes.data || []) as unknown as { status: string }[];
      const s = { totalSent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, queuePending: queueRes.count || 0, activeTriggers: 0, totalTriggers: 0, templates: templatesRes.count || 0 };
      for (const l of logs) { s.totalSent++; if (l.status === "delivered") s.delivered++; if (l.status === "opened") s.opened++; if (l.status === "clicked") s.clicked++; if (l.status === "failed") s.failed++; }
      const triggers = (triggersRes.data || []) as unknown as { is_enabled: boolean }[];
      s.totalTriggers = triggers.length;
      s.activeTriggers = triggers.filter(t => t.is_enabled).length;
      setStats(s);
      setRecentEmails((recentRes.data || []) as unknown as EmailLog[]);
      setLoading(false);
    })();
  }, []);

  const triggerDailyBrand = async () => {
    setTriggerDailySending(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/daily-brand-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const result = await res.json();
      toast({ title: `Daily brand emails: ${result.sent || 0} sent, ${result.skipped || 0} skipped` });
    } catch {
      toast({ title: "Failed to trigger daily emails", variant: "destructive" });
    }
    setTriggerDailySending(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const openRate = stats.totalSent > 0 ? ((stats.opened / stats.totalSent) * 100).toFixed(1) : "0";
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0";
  const deliveryRate = stats.totalSent > 0 ? (((stats.totalSent - stats.failed) / stats.totalSent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sent", value: stats.totalSent.toLocaleString(), icon: Send, color: "text-primary", bg: "bg-primary/10" },
          { label: "Delivery Rate", value: `${deliveryRate}%`, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Open Rate", value: `${openRate}%`, icon: MailOpen, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Click Rate", value: `${clickRate}%`, icon: MousePointerClick, color: "text-purple-400", bg: "bg-purple-500/10" },
        ].map(card => (
          <Card key={card.label} className="bg-card border-border overflow-hidden">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className={`w-8 h-8 rounded-lg ${card.bg} flex items-center justify-center`}>
                  <card.icon className={`w-4 h-4 ${card.color}`} />
                </div>
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* System Status + Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4 text-primary" />System Status</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {[
              { label: "Active Triggers", value: `${stats.activeTriggers}/${stats.totalTriggers}`, pct: stats.totalTriggers > 0 ? (stats.activeTriggers / stats.totalTriggers) * 100 : 0, color: "bg-primary" },
              { label: "Templates Ready", value: stats.templates.toString(), pct: 100, color: "bg-emerald-400" },
              { label: "Queue Pending", value: stats.queuePending.toString(), pct: stats.queuePending > 0 ? Math.min(100, stats.queuePending * 2) : 0, color: stats.queuePending > 20 ? "bg-destructive" : "bg-amber-400" },
              { label: "Failed Emails", value: stats.failed.toString(), pct: stats.totalSent > 0 ? (stats.failed / stats.totalSent) * 100 : 0, color: "bg-destructive" },
            ].map(item => (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">{item.label}</span>
                  <span className="font-medium text-foreground">{item.value}</span>
                </div>
                <Progress value={item.pct} className="h-1.5" />
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="bg-card border-border">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2"><Rocket className="w-4 h-4 text-primary" />Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button className="w-full justify-between" variant="outline" onClick={triggerDailyBrand} disabled={triggerDailySending}>
              <span className="flex items-center gap-2">
                {triggerDailySending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Mail className="w-4 h-4" />}
                Send Daily Brand Emails
              </span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <ProcessQueueButton />
            <Button className="w-full justify-between" variant="outline" onClick={() => {
              const el = document.querySelector('[data-value="triggers"]') as HTMLElement;
              el?.click();
            }}>
              <span className="flex items-center gap-2"><Zap className="w-4 h-4" />Manage Triggers</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
            <Button className="w-full justify-between" variant="outline" onClick={() => {
              const el = document.querySelector('[data-value="templates"]') as HTMLElement;
              el?.click();
            }}>
              <span className="flex items-center gap-2"><FileText className="w-4 h-4" />Edit Templates</span>
              <ChevronRight className="w-4 h-4" />
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" />Recent Emails</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>To</TableHead>
                <TableHead>Subject</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {recentEmails.map(e => {
                const sc = STATUS_CONFIG[e.status] || STATUS_CONFIG.pending;
                const Icon = sc.icon;
                return (
                  <TableRow key={e.id}>
                    <TableCell className="text-xs font-medium">{e.to_email}</TableCell>
                    <TableCell className="text-xs max-w-48 truncate text-muted-foreground">{e.subject}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={`text-[10px] gap-1 ${sc.bg} ${sc.color} border-transparent`}>
                        <Icon className={`w-3 h-3 ${e.status === "processing" ? "animate-spin" : ""}`} />
                        {e.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(e.created_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                );
              })}
              {recentEmails.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-sm text-muted-foreground py-8">No emails sent yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Process Queue Button (reusable) ───
const ProcessQueueButton = () => {
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();
  const process = async () => {
    setProcessing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/process-email-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const result = await res.json();
      toast({ title: `Queue: ${result.sent || 0} sent, ${result.failed || 0} failed` });
    } catch { toast({ title: "Process failed", variant: "destructive" }); }
    setProcessing(false);
  };
  return (
    <Button className="w-full justify-between" variant="outline" onClick={process} disabled={processing}>
      <span className="flex items-center gap-2">
        {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
        Process Email Queue
      </span>
      <ChevronRight className="w-4 h-4" />
    </Button>
  );
};

// ─── Triggers Tab ───
const TriggersTab = () => {
  const [triggers, setTriggers] = useState<EmailTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
  const [testingId, setTestingId] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTriggers = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("email_triggers").select("*").order("category").order("display_name");
    setTriggers((data as unknown as EmailTrigger[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTriggers(); }, [fetchTriggers]);

  const toggleTrigger = async (id: string, enabled: boolean) => {
    await supabase.from("email_triggers").update({ is_enabled: enabled }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_enabled: enabled } : t));
    toast({ title: enabled ? "✅ Trigger enabled" : "⏸️ Trigger disabled" });
  };

  const updateCooldown = async (id: string, hours: number) => {
    await supabase.from("email_triggers").update({ cooldown_hours: hours }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, cooldown_hours: hours } : t));
  };

  const updatePriority = async (id: string, priority: string) => {
    await supabase.from("email_triggers").update({ priority }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
  };

  const testTrigger = async (triggerKey: string) => {
    setTestingId(triggerKey);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { toast({ title: "Not logged in", variant: "destructive" }); return; }
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/trigger-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
        body: JSON.stringify({ trigger_key: triggerKey, user_id: user.id, variables: { test: true } }),
      });
      const result = await res.json();
      if (result.success) toast({ title: "✅ Test email queued!" });
      else if (result.skipped) toast({ title: `⏭️ Skipped: ${result.reason}` });
      else toast({ title: "❌ Failed", description: result.error, variant: "destructive" });
    } catch { toast({ title: "Test failed", variant: "destructive" }); }
    setTestingId(null);
  };

  const bulkToggle = async (enabled: boolean) => {
    const ids = filtered.map(t => t.id);
    for (const id of ids) {
      await supabase.from("email_triggers").update({ is_enabled: enabled }).eq("id", id);
    }
    setTriggers(prev => prev.map(t => ids.includes(t.id) ? { ...t, is_enabled: enabled } : t));
    toast({ title: `${enabled ? "Enabled" : "Disabled"} ${ids.length} triggers` });
  };

  const filtered = triggers.filter(t =>
    (filterCat === "all" || t.category === filterCat) &&
    (search === "" || t.display_name.toLowerCase().includes(search.toLowerCase()) || t.trigger_key.toLowerCase().includes(search.toLowerCase()))
  );

  const groupedByCategory = filtered.reduce((acc, t) => {
    (acc[t.category] = acc[t.category] || []).push(t);
    return acc;
  }, {} as Record<string, EmailTrigger[]>);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search triggers..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-48">
            <Filter className="w-3.5 h-3.5 mr-2" />
            <SelectValue placeholder="All categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Bulk actions + stats */}
      <div className="flex flex-wrap gap-2 items-center justify-between">
        <div className="flex gap-2 text-xs">
          <Badge variant="outline" className="gap-1"><Zap className="w-3 h-3 text-primary" />Total: {triggers.length}</Badge>
          <Badge variant="outline" className="gap-1 text-emerald-400"><Power className="w-3 h-3" />Active: {triggers.filter(t => t.is_enabled).length}</Badge>
          <Badge variant="outline" className="gap-1 text-destructive"><XCircle className="w-3 h-3" />Disabled: {triggers.filter(t => !t.is_enabled).length}</Badge>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" className="text-xs" onClick={() => bulkToggle(true)}>Enable All Filtered</Button>
          <Button size="sm" variant="outline" className="text-xs text-destructive" onClick={() => bulkToggle(false)}>Disable All Filtered</Button>
        </div>
      </div>

      {Object.entries(groupedByCategory).map(([cat, items]) => {
        const catInfo = CATEGORIES.find(c => c.value === cat);
        return (
          <Card key={cat} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <span>{catInfo?.icon || "📧"}</span>
                <Badge variant="outline" className={catInfo?.color || ""}>{catInfo?.label || cat}</Badge>
                <span className="text-muted-foreground font-normal text-xs">({items.length} triggers)</span>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Trigger</TableHead>
                    <TableHead>Key</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Cooldown</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Test</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(t => (
                    <TableRow key={t.id} className={!t.is_enabled ? "opacity-50" : ""}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{t.display_name}</p>
                          {t.description && <p className="text-xs text-muted-foreground mt-0.5 max-w-xs truncate">{t.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell>
                        <code className="text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded font-mono">{t.trigger_key}</code>
                      </TableCell>
                      <TableCell>
                        <Select value={t.priority} onValueChange={v => updatePriority(t.id, v)}>
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">🔴 High</SelectItem>
                            <SelectItem value="normal">🟡 Normal</SelectItem>
                            <SelectItem value="low">⚪ Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Input type="number" value={t.cooldown_hours} onChange={e => updateCooldown(t.id, parseInt(e.target.value) || 0)} className="h-7 w-14 text-xs" min={0} />
                          <span className="text-[10px] text-muted-foreground">hrs</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Switch checked={t.is_enabled} onCheckedChange={v => toggleTrigger(t.id, v)} />
                      </TableCell>
                      <TableCell>
                        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => testTrigger(t.trigger_key)} disabled={testingId === t.trigger_key || !t.is_enabled}>
                          {testingId === t.trigger_key ? <Loader2 className="w-3 h-3 animate-spin" /> : <TestTube className="w-3 h-3" />}
                          Test
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

// ─── AI Template Purposes ───
const AI_TEMPLATE_PURPOSES = [
  { value: "welcome", label: "🎉 Welcome / Onboarding", desc: "First-time user welcome email" },
  { value: "study_reminder", label: "📚 Study Reminder", desc: "Remind users to study today" },
  { value: "streak_alert", label: "🔥 Streak Alert", desc: "Streak at risk or milestone" },
  { value: "weekly_report", label: "📊 Weekly Report", desc: "Weekly study progress summary" },
  { value: "exam_prep", label: "🎯 Exam Preparation", desc: "Exam coming soon motivation" },
  { value: "memory_risk", label: "🧠 Memory Risk Alert", desc: "Topics about to be forgotten" },
  { value: "achievement", label: "🏆 Achievement Unlocked", desc: "Badge or milestone earned" },
  { value: "comeback", label: "💪 Comeback / Re-engagement", desc: "Bring back inactive users" },
  { value: "subscription", label: "💳 Subscription Update", desc: "Plan upgrade, expiry, or renewal" },
  { value: "community", label: "💬 Community Activity", desc: "New replies, trending discussions" },
  { value: "ai_insight", label: "🤖 AI Brain Insight", desc: "Personalized AI-generated insight" },
  { value: "security", label: "🔐 Security Alert", desc: "Login, password change, MFA" },
  { value: "promotional", label: "🚀 Promotional", desc: "Feature launch or special offer" },
  { value: "custom", label: "✏️ Custom Purpose", desc: "Describe your own purpose" },
];

// ─── Templates Tab ───
const TemplatesTab = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", html_body: "", category: "general", variables: "" });
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPurpose, setAiPurpose] = useState("welcome");
  const [aiCustomPurpose, setAiCustomPurpose] = useState("");
  const [aiCategory, setAiCategory] = useState("general");
  const [showAiCreate, setShowAiCreate] = useState(false);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("email_templates").select("*").order("created_at", { ascending: false });
    setTemplates((data as unknown as EmailTemplate[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = async () => {
    const vars = form.variables.split(",").map(v => v.trim()).filter(Boolean);
    if (editId) {
      await supabase.from("email_templates").update({ name: form.name, subject: form.subject, html_body: form.html_body, category: form.category, variables: vars }).eq("id", editId);
      toast({ title: "✅ Template updated" });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("email_templates").insert({ name: form.name, subject: form.subject, html_body: form.html_body, category: form.category, variables: vars, created_by: user!.id });
      toast({ title: "✅ Template created" });
    }
    setShowCreate(false); setEditId(null);
    setForm({ name: "", subject: "", html_body: "", category: "general", variables: "" });
    fetchTemplates();
  };

  const duplicateTemplate = async (t: EmailTemplate) => {
    const { data: { user } } = await supabase.auth.getUser();
    await supabase.from("email_templates").insert({ name: `${t.name} (copy)`, subject: t.subject, html_body: t.html_body, category: t.category || "general", variables: t.variables || [], created_by: user!.id });
    toast({ title: "✅ Template duplicated" });
    fetchTemplates();
  };

  const toggleActive = async (id: string, active: boolean) => {
    await supabase.from("email_templates").update({ is_active: active }).eq("id", id);
    setTemplates(prev => prev.map(t => t.id === id ? { ...t, is_active: active } : t));
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("email_templates").delete().eq("id", id);
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  const generateWithAI = async () => {
    setAiGenerating(true);
    try {
      const purpose = aiPurpose === "custom" ? aiCustomPurpose : AI_TEMPLATE_PURPOSES.find(p => p.value === aiPurpose)?.label || aiPurpose;
      const { data, error } = await supabase.functions.invoke("generate-email-template", {
        body: { purpose, category: aiCategory },
      });
      if (error) throw error;
      if (data) {
        setForm({
          name: data.name || "",
          subject: data.subject || "",
          html_body: data.html_body || "",
          category: aiCategory,
          variables: (data.variables || []).join(", "),
        });
        setShowAiCreate(false);
        setShowCreate(true);
        toast({ title: "✨ AI generated template ready!", description: "Review and save the template" });
      }
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e.message, variant: "destructive" });
    }
    setAiGenerating(false);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} templates</p>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => { setForm({ name: "", subject: "", html_body: "", category: "general", variables: "" }); setEditId(null); setShowCreate(true); }}>
            <Plus className="w-3.5 h-3.5 mr-1.5" />Manual
          </Button>
          <Button size="sm" onClick={() => { setAiPurpose("welcome"); setAiCategory("general"); setAiCustomPurpose(""); setShowAiCreate(true); }} className="gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />AI Create
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(t => (
          <Card key={t.id} className={`bg-card border-border transition-all ${!t.is_active ? "opacity-60" : ""}`}>
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-sm font-semibold text-foreground truncate">{t.name}</h3>
                    <Switch checked={t.is_active ?? true} onCheckedChange={v => toggleActive(t.id, v)} className="scale-75" />
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{t.subject}</p>
                </div>
                <div className="flex gap-0.5 shrink-0">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewHtml(t.html_body)} title="Preview">
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => duplicateTemplate(t)} title="Duplicate">
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setForm({ name: t.name, subject: t.subject, html_body: t.html_body, category: t.category || "general", variables: (t.variables || []).join(", ") });
                    setEditId(t.id); setShowCreate(true);
                  }} title="Edit">
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)} title="Delete">
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{t.category || "general"}</Badge>
                {t.is_active ? <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px] border-transparent">Active</Badge> : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                {t.variables?.slice(0, 3).map(v => <Badge key={v} variant="secondary" className="text-[10px] font-mono">{`{{${v}}}`}</Badge>)}
                {(t.variables?.length || 0) > 3 && <Badge variant="secondary" className="text-[10px]">+{(t.variables?.length || 0) - 3}</Badge>}
              </div>
              <p className="text-[10px] text-muted-foreground">Updated {format(new Date(t.updated_at), "MMM d, yyyy HH:mm")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* AI Create Dialog */}
      <Dialog open={showAiCreate} onOpenChange={setShowAiCreate}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-primary" />
              </div>
              AI Template Generator
            </DialogTitle>
            <p className="text-xs text-muted-foreground mt-1">Select a purpose and category — AI will generate the complete template with professional HTML, subject line, and variables.</p>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-2 block">Template Purpose</label>
              <div className="grid grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
                {AI_TEMPLATE_PURPOSES.map(p => (
                  <button
                    key={p.value}
                    onClick={() => setAiPurpose(p.value)}
                    className={`text-left p-2.5 rounded-lg border transition-all ${
                      aiPurpose === p.value
                        ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                        : "border-border bg-card hover:border-primary/40 hover:bg-primary/5"
                    }`}
                  >
                    <p className="text-xs font-medium text-foreground">{p.label}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{p.desc}</p>
                  </button>
                ))}
              </div>
            </div>
            {aiPurpose === "custom" && (
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Describe your purpose</label>
                <Input value={aiCustomPurpose} onChange={e => setAiCustomPurpose(e.target.value)} placeholder="e.g., Notify users about a new AI feature launch..." />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
              <Select value={aiCategory} onValueChange={setAiCategory}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAiCreate(false)}>Cancel</Button>
            <Button onClick={generateWithAI} disabled={aiGenerating || (aiPurpose === "custom" && !aiCustomPurpose.trim())} className="gap-2">
              {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {aiGenerating ? "Generating..." : "Generate Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              {editId ? "Edit Template" : "New Email Template"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Template Name</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Welcome Email" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1 block">Category</label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Subject Line</label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="🎉 Welcome to ACRY!" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">Variables (comma-separated)</label>
              <Input value={form.variables} onChange={e => setForm(p => ({ ...p, variables: e.target.value }))} placeholder="user_name, exam_name, score" />
            </div>
            <div>
              <div className="flex justify-between items-center mb-1">
                <label className="text-xs font-medium text-muted-foreground">HTML Body</label>
                <div className="flex gap-1">
                  {form.html_body && (
                    <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => setPreviewHtml(form.html_body)}>
                      <Eye className="w-3 h-3 mr-1" />Preview
                    </Button>
                  )}
                </div>
              </div>
              <Textarea value={form.html_body} onChange={e => setForm(p => ({ ...p, html_body: e.target.value }))} className="min-h-[250px] font-mono text-xs" placeholder="<div>Your email HTML...</div>" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={!form.name || !form.subject || !form.html_body}>
              {editId ? "Update" : "Create"} Template
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Preview Dialog */}
      <Dialog open={!!previewHtml} onOpenChange={() => setPreviewHtml(null)}>
        <DialogContent className="max-w-3xl max-h-[85vh]">
          <DialogHeader><DialogTitle className="flex items-center gap-2"><Eye className="w-5 h-5 text-primary" />Email Preview</DialogTitle></DialogHeader>
          <div className="bg-muted/30 rounded-xl p-3 overflow-auto max-h-[70vh] border border-border">
            <iframe srcDoc={previewHtml || ""} className="w-full min-h-[500px] bg-white rounded-lg" sandbox="" />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// ─── Queue Tab ───
const QueueTab = () => {
  const [queue, setQueue] = useState<EmailQueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("email_queue").select("*").order("created_at", { ascending: false }).limit(100);
    setQueue((data as unknown as EmailQueueItem[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const clearFailed = async () => {
    await supabase.from("email_queue").delete().eq("status", "failed");
    toast({ title: "Failed emails cleared" });
    fetchQueue();
  };

  const clearSent = async () => {
    await supabase.from("email_queue").delete().eq("status", "sent");
    toast({ title: "Sent emails cleared from queue" });
    fetchQueue();
  };

  const statusCounts = queue.reduce((acc, q) => {
    acc[q.status] = (acc[q.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3 items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {Object.entries(statusCounts).map(([status, count]) => {
            const sc = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
            const Icon = sc.icon;
            return (
              <Badge key={status} variant="outline" className={`gap-1 ${sc.bg} ${sc.color} border-transparent`}>
                <Icon className={`w-3 h-3 ${status === "processing" ? "animate-spin" : ""}`} />
                {status}: {count}
              </Badge>
            );
          })}
          {queue.length === 0 && <Badge variant="outline" className="text-muted-foreground">Queue empty</Badge>}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchQueue}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
          <Button size="sm" variant="outline" onClick={clearSent} className="text-muted-foreground"><Trash2 className="w-3.5 h-3.5 mr-1.5" />Clear Sent</Button>
          <Button size="sm" variant="outline" onClick={clearFailed} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-1.5" />Clear Failed</Button>
          <ProcessQueueButton />
        </div>
      </div>

      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Retries</TableHead>
              <TableHead>Scheduled</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {queue.map(q => {
              const sc = STATUS_CONFIG[q.status] || STATUS_CONFIG.pending;
              const Icon = sc.icon;
              return (
                <TableRow key={q.id}>
                  <TableCell className="text-xs font-medium">{q.to_email}</TableCell>
                  <TableCell className="text-xs max-w-48 truncate text-muted-foreground">{q.subject}</TableCell>
                  <TableCell><code className="text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded font-mono">{q.trigger_key}</code></TableCell>
                  <TableCell><Badge variant="outline" className={`text-[10px] ${PRIORITY_COLORS[q.priority] || ""}`}>{q.priority}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${sc.bg} ${sc.color} border-transparent`}>
                      <Icon className={`w-3 h-3 ${q.status === "processing" ? "animate-spin" : ""}`} />
                      {q.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{q.retry_count}/3</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(q.scheduled_at), "MMM d, HH:mm")}</TableCell>
                </TableRow>
              );
            })}
            {queue.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-12">
                <div className="flex flex-col items-center gap-2">
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                  <span>Queue is empty — all emails processed!</span>
                </div>
              </TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};

// ─── Logs Tab ───
const LogsTab = () => {
  const [logs, setLogs] = useState<EmailLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [triggerFilter, setTriggerFilter] = useState("all");
  const [triggers, setTriggers] = useState<string[]>([]);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(300);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    if (triggerFilter !== "all") query = query.eq("trigger_key", triggerFilter);
    const { data } = await query;
    const logsData = (data || []) as unknown as EmailLog[];
    setLogs(logsData);
    const uniqueTriggers = [...new Set(logsData.map(l => l.trigger_key))].sort();
    setTriggers(uniqueTriggers);
    setLoading(false);
  }, [statusFilter, triggerFilter]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const filtered = logs.filter(l =>
    search === "" || l.to_email.toLowerCase().includes(search.toLowerCase()) || l.subject.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search by email or subject..." value={search} onChange={e => setSearch(e.target.value)} className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-36"><SelectValue placeholder="All statuses" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="sent">✅ Sent</SelectItem>
            <SelectItem value="delivered">📬 Delivered</SelectItem>
            <SelectItem value="opened">📖 Opened</SelectItem>
            <SelectItem value="clicked">🖱️ Clicked</SelectItem>
            <SelectItem value="failed">❌ Failed</SelectItem>
            <SelectItem value="bounced">⚠️ Bounced</SelectItem>
          </SelectContent>
        </Select>
        <Select value={triggerFilter} onValueChange={setTriggerFilter}>
          <SelectTrigger className="w-48"><SelectValue placeholder="All triggers" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Triggers</SelectItem>
            {triggers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
      </div>

      <p className="text-xs text-muted-foreground">Showing {filtered.length} of {logs.length} logs</p>

      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Engagement</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => {
              const sc = STATUS_CONFIG[l.status] || STATUS_CONFIG.pending;
              const Icon = sc.icon;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-xs font-medium">{l.to_email}</TableCell>
                  <TableCell className="text-xs max-w-48 truncate text-muted-foreground">{l.subject}</TableCell>
                  <TableCell><code className="text-[10px] bg-secondary/80 px-1.5 py-0.5 rounded font-mono">{l.trigger_key}</code></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] gap-1 ${sc.bg} ${sc.color} border-transparent`}>
                      <Icon className="w-3 h-3" />{l.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      {l.opened_at && <Badge className="bg-amber-500/15 text-amber-400 text-[10px] border-transparent gap-0.5"><MailOpen className="w-2.5 h-2.5" />Opened</Badge>}
                      {l.clicked_at && <Badge className="bg-purple-500/15 text-purple-400 text-[10px] border-transparent gap-0.5"><MousePointerClick className="w-2.5 h-2.5" />Clicked</Badge>}
                      {l.bounced_at && <Badge className="bg-destructive/15 text-destructive text-[10px] border-transparent gap-0.5"><AlertTriangle className="w-2.5 h-2.5" />Bounced</Badge>}
                      {!l.opened_at && !l.clicked_at && !l.bounced_at && <span className="text-[10px] text-muted-foreground">—</span>}
                    </div>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-12">No email logs found</TableCell></TableRow>
            )}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};

// ─── Analytics Tab ───
const AnalyticsTab = () => {
  const [stats, setStats] = useState({ total: 0, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0 });
  const [triggerStats, setTriggerStats] = useState<{ trigger_key: string; count: number; opened: number; clicked: number }[]>([]);
  const [dailyData, setDailyData] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: logs } = await supabase.from("email_logs").select("status, trigger_key, created_at, opened_at, clicked_at");
      if (logs) {
        const s = { total: logs.length, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0 };
        const trigMap: Record<string, { count: number; opened: number; clicked: number }> = {};
        const dayMap: Record<string, number> = {};
        for (const l of logs as unknown as { status: string; trigger_key: string; created_at: string; opened_at: string | null; clicked_at: string | null }[]) {
          if (l.status in s) (s as any)[l.status]++;
          if (!trigMap[l.trigger_key]) trigMap[l.trigger_key] = { count: 0, opened: 0, clicked: 0 };
          trigMap[l.trigger_key].count++;
          if (l.opened_at) trigMap[l.trigger_key].opened++;
          if (l.clicked_at) trigMap[l.trigger_key].clicked++;
          const day = l.created_at.split("T")[0];
          dayMap[day] = (dayMap[day] || 0) + 1;
        }
        setStats(s);
        setTriggerStats(Object.entries(trigMap).map(([trigger_key, d]) => ({ trigger_key, ...d })).sort((a, b) => b.count - a.count));
        // Last 14 days
        const days: { date: string; count: number }[] = [];
        for (let i = 13; i >= 0; i--) {
          const d = new Date(); d.setDate(d.getDate() - i);
          const key = d.toISOString().split("T")[0];
          days.push({ date: format(d, "MMM d"), count: dayMap[key] || 0 });
        }
        setDailyData(days);
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const openRate = stats.total > 0 ? ((stats.opened / stats.total) * 100).toFixed(1) : "0";
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0";
  const deliveryRate = stats.total > 0 ? (((stats.total - stats.failed - stats.bounced) / stats.total) * 100).toFixed(1) : "0";
  const bounceRate = stats.total > 0 ? ((stats.bounced / stats.total) * 100).toFixed(1) : "0";
  const maxDaily = Math.max(...dailyData.map(d => d.count), 1);

  return (
    <div className="space-y-6">
      {/* KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Total Sent", value: stats.total.toLocaleString(), icon: Send, color: "text-primary", bg: "bg-primary/10" },
          { label: "Delivered", value: `${deliveryRate}%`, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
          { label: "Open Rate", value: `${openRate}%`, icon: MailOpen, color: "text-amber-400", bg: "bg-amber-500/10" },
          { label: "Click Rate", value: `${clickRate}%`, icon: MousePointerClick, color: "text-purple-400", bg: "bg-purple-500/10" },
          { label: "Bounce Rate", value: `${bounceRate}%`, icon: AlertTriangle, color: "text-amber-500", bg: "bg-amber-500/10" },
          { label: "Failed", value: stats.failed.toString(), icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
        ].map(card => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-3">
              <div className={`w-7 h-7 rounded-lg ${card.bg} flex items-center justify-center mb-2`}>
                <card.icon className={`w-3.5 h-3.5 ${card.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground">{card.value}</p>
              <p className="text-[10px] text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Daily Volume Chart */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" />Daily Email Volume (14 days)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-end gap-1.5 h-32">
            {dailyData.map((d, i) => (
              <div key={i} className="flex-1 flex flex-col items-center gap-1 group">
                <span className="text-[9px] text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity">{d.count}</span>
                <div className="w-full bg-primary/20 rounded-t-sm overflow-hidden" style={{ height: `${Math.max(4, (d.count / maxDaily) * 100)}%` }}>
                  <div className="w-full h-full bg-primary rounded-t-sm transition-all group-hover:bg-primary/80" />
                </div>
                <span className="text-[8px] text-muted-foreground rotate-[-45deg] origin-center whitespace-nowrap">{d.date}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Status Breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm">Status Breakdown</CardTitle></CardHeader>
        <CardContent className="space-y-2.5">
          {[
            { label: "Sent", count: stats.sent, color: "bg-primary" },
            { label: "Delivered", count: stats.delivered, color: "bg-blue-400" },
            { label: "Opened", count: stats.opened, color: "bg-amber-400" },
            { label: "Clicked", count: stats.clicked, color: "bg-purple-400" },
            { label: "Failed", count: stats.failed, color: "bg-destructive" },
            { label: "Bounced", count: stats.bounced, color: "bg-amber-600" },
          ].map(item => (
            <div key={item.label} className="flex items-center gap-3">
              <span className="text-xs text-muted-foreground w-20">{item.label}</span>
              <div className="flex-1 h-2.5 bg-secondary rounded-full overflow-hidden">
                <div className={`h-full ${item.color} rounded-full transition-all duration-500`}
                  style={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }} />
              </div>
              <span className="text-xs font-medium text-foreground w-12 text-right">{item.count}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Top Triggers with engagement */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2"><CardTitle className="text-sm flex items-center gap-2"><Target className="w-4 h-4 text-primary" />Top Triggers by Volume</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>#</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Sent</TableHead>
                <TableHead>Opened</TableHead>
                <TableHead>Clicked</TableHead>
                <TableHead>Open Rate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {triggerStats.slice(0, 15).map((t, i) => (
                <TableRow key={t.trigger_key}>
                  <TableCell className="text-xs text-muted-foreground font-medium">#{i + 1}</TableCell>
                  <TableCell><code className="text-xs bg-secondary/80 px-1.5 py-0.5 rounded font-mono">{t.trigger_key}</code></TableCell>
                  <TableCell className="text-xs font-medium">{t.count}</TableCell>
                  <TableCell className="text-xs">{t.opened}</TableCell>
                  <TableCell className="text-xs">{t.clicked}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={`text-[10px] ${t.count > 0 && (t.opened / t.count) > 0.3 ? "text-emerald-400" : "text-muted-foreground"}`}>
                      {t.count > 0 ? ((t.opened / t.count) * 100).toFixed(0) : 0}%
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
              {triggerStats.length === 0 && (
                <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No data yet</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailManagement;
