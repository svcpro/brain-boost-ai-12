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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Mail, Send, Clock, BarChart3, Settings, Zap, Eye, Pencil,
  RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, ArrowUpRight, Play, Pause, Trash2, Plus, Search,
  FileText, Filter, ChevronDown
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ───
type EmailTrigger = {
  id: string;
  trigger_key: string;
  display_name: string;
  description: string | null;
  category: string;
  template_id: string | null;
  is_enabled: boolean;
  conditions: Record<string, unknown>;
  cooldown_hours: number;
  priority: string;
  created_at: string;
  updated_at: string;
};

type EmailLog = {
  id: string;
  user_id: string;
  trigger_key: string;
  to_email: string;
  subject: string;
  status: string;
  opened_at: string | null;
  clicked_at: string | null;
  delivered_at: string | null;
  bounced_at: string | null;
  error_message: string | null;
  created_at: string;
};

type EmailQueueItem = {
  id: string;
  user_id: string;
  trigger_key: string;
  to_email: string;
  subject: string;
  status: string;
  priority: string;
  retry_count: number;
  error_message: string | null;
  scheduled_at: string;
  sent_at: string | null;
  created_at: string;
};

type EmailTemplate = {
  id: string;
  name: string;
  subject: string;
  html_body: string;
  category: string | null;
  is_active: boolean | null;
  variables: string[] | null;
  created_at: string;
  updated_at: string;
};

const CATEGORIES = [
  { value: "user_lifecycle", label: "User Lifecycle", color: "bg-indigo-500/15 text-indigo-400" },
  { value: "ai_brain", label: "AI Brain", color: "bg-teal-500/15 text-teal-400" },
  { value: "study_reminder", label: "Study Reminder", color: "bg-amber-500/15 text-amber-400" },
  { value: "study_progress", label: "Study Progress", color: "bg-emerald-500/15 text-emerald-400" },
  { value: "rank_performance", label: "Rank & Performance", color: "bg-blue-500/15 text-blue-400" },
  { value: "community", label: "Community", color: "bg-purple-500/15 text-purple-400" },
  { value: "billing", label: "Billing", color: "bg-pink-500/15 text-pink-400" },
  { value: "security", label: "Security", color: "bg-red-500/15 text-red-400" },
  { value: "system", label: "System", color: "bg-slate-500/15 text-slate-400" },
];

const PRIORITY_COLORS: Record<string, string> = {
  high: "bg-destructive/15 text-destructive",
  normal: "bg-primary/15 text-primary",
  low: "bg-muted text-muted-foreground",
};

const STATUS_ICONS: Record<string, { icon: any; color: string }> = {
  sent: { icon: CheckCircle2, color: "text-emerald-400" },
  delivered: { icon: CheckCircle2, color: "text-blue-400" },
  opened: { icon: Eye, color: "text-amber-400" },
  clicked: { icon: ArrowUpRight, color: "text-purple-400" },
  failed: { icon: XCircle, color: "text-destructive" },
  bounced: { icon: AlertTriangle, color: "text-amber-500" },
  pending: { icon: Clock, color: "text-muted-foreground" },
  processing: { icon: Loader2, color: "text-primary" },
};

const EmailManagement = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Mail className="w-6 h-6 text-primary" />
        <div>
          <h1 className="text-xl font-bold text-foreground">Email Automation</h1>
          <p className="text-sm text-muted-foreground">Manage triggers, templates, queue, and analytics</p>
        </div>
      </div>

      <Tabs defaultValue="triggers" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="triggers"><Zap className="w-3.5 h-3.5 mr-1.5" />Triggers</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="w-3.5 h-3.5 mr-1.5" />Templates</TabsTrigger>
          <TabsTrigger value="queue"><Clock className="w-3.5 h-3.5 mr-1.5" />Queue</TabsTrigger>
          <TabsTrigger value="logs"><Send className="w-3.5 h-3.5 mr-1.5" />Logs</TabsTrigger>
          <TabsTrigger value="analytics"><BarChart3 className="w-3.5 h-3.5 mr-1.5" />Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="triggers"><TriggersTab /></TabsContent>
        <TabsContent value="templates"><TemplatesTab /></TabsContent>
        <TabsContent value="queue"><QueueTab /></TabsContent>
        <TabsContent value="logs"><LogsTab /></TabsContent>
        <TabsContent value="analytics"><AnalyticsTab /></TabsContent>
      </Tabs>
    </div>
  );
};

// ─── Triggers Tab ───
const TriggersTab = () => {
  const [triggers, setTriggers] = useState<EmailTrigger[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCat, setFilterCat] = useState("all");
  const [search, setSearch] = useState("");
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
    toast({ title: enabled ? "Trigger enabled" : "Trigger disabled" });
  };

  const updateCooldown = async (id: string, hours: number) => {
    await supabase.from("email_triggers").update({ cooldown_hours: hours }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, cooldown_hours: hours } : t));
  };

  const updatePriority = async (id: string, priority: string) => {
    await supabase.from("email_triggers").update({ priority }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, priority } : t));
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
            {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      <div className="flex flex-wrap gap-2 text-xs">
        <span className="text-muted-foreground">Total: {triggers.length}</span>
        <span className="text-emerald-400">Active: {triggers.filter(t => t.is_enabled).length}</span>
        <span className="text-destructive">Disabled: {triggers.filter(t => !t.is_enabled).length}</span>
      </div>

      {Object.entries(groupedByCategory).map(([cat, items]) => {
        const catInfo = CATEGORIES.find(c => c.value === cat);
        return (
          <Card key={cat} className="bg-card border-border">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Badge variant="outline" className={catInfo?.color || ""}>{catInfo?.label || cat}</Badge>
                <span className="text-muted-foreground font-normal">({items.length})</span>
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
                    <TableHead>Enabled</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map(t => (
                    <TableRow key={t.id}>
                      <TableCell>
                        <div>
                          <p className="text-sm font-medium text-foreground">{t.display_name}</p>
                          {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                        </div>
                      </TableCell>
                      <TableCell><code className="text-xs bg-secondary px-1.5 py-0.5 rounded">{t.trigger_key}</code></TableCell>
                      <TableCell>
                        <Select value={t.priority} onValueChange={v => updatePriority(t.id, v)}>
                          <SelectTrigger className="h-7 w-24 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="high">High</SelectItem>
                            <SelectItem value="normal">Normal</SelectItem>
                            <SelectItem value="low">Low</SelectItem>
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          value={t.cooldown_hours}
                          onChange={e => updateCooldown(t.id, parseInt(e.target.value) || 0)}
                          className="h-7 w-16 text-xs"
                          min={0}
                        />
                        <span className="text-[10px] text-muted-foreground ml-1">hrs</span>
                      </TableCell>
                      <TableCell>
                        <Switch checked={t.is_enabled} onCheckedChange={v => toggleTrigger(t.id, v)} />
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

// ─── Templates Tab ───
const TemplatesTab = () => {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [previewHtml, setPreviewHtml] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState({ name: "", subject: "", html_body: "", category: "general", variables: "" });
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
      await supabase.from("email_templates").update({
        name: form.name, subject: form.subject, html_body: form.html_body,
        category: form.category, variables: vars,
      }).eq("id", editId);
      toast({ title: "Template updated" });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await supabase.from("email_templates").insert({
        name: form.name, subject: form.subject, html_body: form.html_body,
        category: form.category, variables: vars, created_by: user!.id,
      });
      toast({ title: "Template created" });
    }
    setShowCreate(false);
    setEditId(null);
    setForm({ name: "", subject: "", html_body: "", category: "general", variables: "" });
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    await supabase.from("email_templates").delete().eq("id", id);
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <p className="text-sm text-muted-foreground">{templates.length} templates</p>
        <Button size="sm" onClick={() => { setForm({ name: "", subject: "", html_body: "", category: "general", variables: "" }); setEditId(null); setShowCreate(true); }}>
          <Plus className="w-3.5 h-3.5 mr-1.5" />New Template
        </Button>
      </div>

      {/* Template cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(t => (
          <Card key={t.id} className="bg-card border-border">
            <CardContent className="p-4 space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">{t.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">{t.subject}</p>
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setPreviewHtml(t.html_body)}>
                    <Eye className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
                    setForm({ name: t.name, subject: t.subject, html_body: t.html_body, category: t.category || "general", variables: (t.variables || []).join(", ") });
                    setEditId(t.id); setShowCreate(true);
                  }}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Badge variant="outline" className="text-[10px]">{t.category || "general"}</Badge>
                {t.is_active ? <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">Active</Badge> : <Badge variant="secondary" className="text-[10px]">Inactive</Badge>}
                {t.variables?.map(v => <Badge key={v} variant="secondary" className="text-[10px]">{`{{${v}}}`}</Badge>)}
              </div>
              <p className="text-[10px] text-muted-foreground">Updated {format(new Date(t.updated_at), "MMM d, yyyy")}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{editId ? "Edit Template" : "New Email Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-muted-foreground">Name</label>
                <Input value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} placeholder="Welcome Email" />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground">Category</label>
                <Select value={form.category} onValueChange={v => setForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>)}
                    <SelectItem value="general">General</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Subject</label>
              <Input value={form.subject} onChange={e => setForm(p => ({ ...p, subject: e.target.value }))} placeholder="🎉 Welcome to ACRY!" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">Variables (comma-separated)</label>
              <Input value={form.variables} onChange={e => setForm(p => ({ ...p, variables: e.target.value }))} placeholder="user_name, exam_name" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground">HTML Body</label>
              <Textarea value={form.html_body} onChange={e => setForm(p => ({ ...p, html_body: e.target.value }))} className="min-h-[200px] font-mono text-xs" placeholder="<div>...</div>" />
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
          <DialogHeader><DialogTitle>Email Preview</DialogTitle></DialogHeader>
          <div className="bg-muted/50 rounded-lg p-2 overflow-auto max-h-[70vh]">
            <iframe srcDoc={previewHtml || ""} className="w-full min-h-[500px] bg-white rounded" sandbox="" />
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
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const fetchQueue = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("email_queue").select("*").order("created_at", { ascending: false }).limit(100);
    setQueue((data as unknown as EmailQueueItem[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchQueue(); }, [fetchQueue]);

  const processQueue = async () => {
    setProcessing(true);
    try {
      const projectId = import.meta.env.VITE_SUPABASE_PROJECT_ID;
      const res = await fetch(`https://${projectId}.supabase.co/functions/v1/process-email-queue`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}` },
      });
      const result = await res.json();
      toast({ title: `Queue processed: ${result.sent || 0} sent, ${result.failed || 0} failed` });
      fetchQueue();
    } catch {
      toast({ title: "Failed to process queue", variant: "destructive" });
    }
    setProcessing(false);
  };

  const clearFailed = async () => {
    await supabase.from("email_queue").delete().eq("status", "failed");
    toast({ title: "Failed emails cleared" });
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
        <div className="flex gap-2">
          {Object.entries(statusCounts).map(([status, count]) => {
            const si = STATUS_ICONS[status] || STATUS_ICONS.pending;
            const Icon = si.icon;
            return (
              <Badge key={status} variant="outline" className="gap-1">
                <Icon className={`w-3 h-3 ${si.color}`} />
                {status}: {count}
              </Badge>
            );
          })}
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchQueue}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
          <Button size="sm" variant="outline" onClick={clearFailed} className="text-destructive"><Trash2 className="w-3.5 h-3.5 mr-1.5" />Clear Failed</Button>
          <Button size="sm" onClick={processQueue} disabled={processing}>
            {processing ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Play className="w-3.5 h-3.5 mr-1.5" />}
            Process Queue
          </Button>
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
              const si = STATUS_ICONS[q.status] || STATUS_ICONS.pending;
              const Icon = si.icon;
              return (
                <TableRow key={q.id}>
                  <TableCell className="text-xs">{q.to_email}</TableCell>
                  <TableCell className="text-xs max-w-48 truncate">{q.subject}</TableCell>
                  <TableCell><code className="text-[10px] bg-secondary px-1 py-0.5 rounded">{q.trigger_key}</code></TableCell>
                  <TableCell><Badge className={`text-[10px] ${PRIORITY_COLORS[q.priority] || ""}`}>{q.priority}</Badge></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Icon className={`w-3.5 h-3.5 ${si.color} ${q.status === "processing" ? "animate-spin" : ""}`} />
                      <span className="text-xs">{q.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{q.retry_count}/{3}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(q.scheduled_at), "MMM d, HH:mm")}</TableCell>
                </TableRow>
              );
            })}
            {queue.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">Queue is empty</TableCell></TableRow>
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

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    let query = supabase.from("email_logs").select("*").order("created_at", { ascending: false }).limit(200);
    if (statusFilter !== "all") query = query.eq("status", statusFilter);
    const { data } = await query;
    setLogs((data as unknown as EmailLog[]) || []);
    setLoading(false);
  }, [statusFilter]);

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
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="sent">Sent</SelectItem>
            <SelectItem value="delivered">Delivered</SelectItem>
            <SelectItem value="opened">Opened</SelectItem>
            <SelectItem value="clicked">Clicked</SelectItem>
            <SelectItem value="failed">Failed</SelectItem>
            <SelectItem value="bounced">Bounced</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={fetchLogs}><RefreshCw className="w-3.5 h-3.5 mr-1.5" />Refresh</Button>
      </div>

      <ScrollArea className="h-[500px]">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>To</TableHead>
              <TableHead>Subject</TableHead>
              <TableHead>Trigger</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Opened</TableHead>
              <TableHead>Clicked</TableHead>
              <TableHead>Sent At</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map(l => {
              const si = STATUS_ICONS[l.status] || STATUS_ICONS.pending;
              const Icon = si.icon;
              return (
                <TableRow key={l.id}>
                  <TableCell className="text-xs">{l.to_email}</TableCell>
                  <TableCell className="text-xs max-w-48 truncate">{l.subject}</TableCell>
                  <TableCell><code className="text-[10px] bg-secondary px-1 py-0.5 rounded">{l.trigger_key}</code></TableCell>
                  <TableCell>
                    <div className="flex items-center gap-1">
                      <Icon className={`w-3.5 h-3.5 ${si.color}`} />
                      <span className="text-xs">{l.status}</span>
                    </div>
                  </TableCell>
                  <TableCell className="text-xs">{l.opened_at ? format(new Date(l.opened_at), "MMM d") : "—"}</TableCell>
                  <TableCell className="text-xs">{l.clicked_at ? format(new Date(l.clicked_at), "MMM d") : "—"}</TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell>
                </TableRow>
              );
            })}
            {filtered.length === 0 && (
              <TableRow><TableCell colSpan={7} className="text-center text-sm text-muted-foreground py-8">No email logs found</TableCell></TableRow>
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
  const [triggerStats, setTriggerStats] = useState<{ trigger_key: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: logs } = await supabase.from("email_logs").select("status, trigger_key");
      if (logs) {
        const s = { total: logs.length, sent: 0, delivered: 0, opened: 0, clicked: 0, failed: 0, bounced: 0 };
        const trigMap: Record<string, number> = {};
        for (const l of logs as unknown as { status: string; trigger_key: string }[]) {
          if (l.status in s) (s as any)[l.status]++;
          trigMap[l.trigger_key] = (trigMap[l.trigger_key] || 0) + 1;
        }
        setStats(s);
        setTriggerStats(Object.entries(trigMap).map(([trigger_key, count]) => ({ trigger_key, count })).sort((a, b) => b.count - a.count));
      }
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  const openRate = stats.sent > 0 ? ((stats.opened / stats.sent) * 100).toFixed(1) : "0";
  const clickRate = stats.opened > 0 ? ((stats.clicked / stats.opened) * 100).toFixed(1) : "0";
  const deliveryRate = stats.sent > 0 ? (((stats.sent - stats.failed - stats.bounced) / stats.sent) * 100).toFixed(1) : "0";

  return (
    <div className="space-y-6">
      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sent", value: stats.total, icon: Send, color: "text-primary" },
          { label: "Delivery Rate", value: `${deliveryRate}%`, icon: CheckCircle2, color: "text-emerald-400" },
          { label: "Open Rate", value: `${openRate}%`, icon: Eye, color: "text-amber-400" },
          { label: "Click Rate", value: `${clickRate}%`, icon: ArrowUpRight, color: "text-purple-400" },
        ].map(card => (
          <Card key={card.label} className="bg-card border-border">
            <CardContent className="p-4 text-center">
              <card.icon className={`w-5 h-5 mx-auto mb-2 ${card.color}`} />
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground">{card.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Status breakdown */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Status Breakdown</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
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
                <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                  <div className={`h-full ${item.color} rounded-full transition-all`}
                    style={{ width: `${stats.total > 0 ? (item.count / stats.total) * 100 : 0}%` }} />
                </div>
                <span className="text-xs font-medium text-foreground w-12 text-right">{item.count}</span>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Top triggers */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">Top Email Triggers</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {triggerStats.slice(0, 10).map((t, i) => (
              <div key={t.trigger_key} className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground w-6">#{i + 1}</span>
                <code className="text-xs bg-secondary px-1.5 py-0.5 rounded flex-1">{t.trigger_key}</code>
                <span className="text-xs font-medium text-foreground">{t.count}</span>
              </div>
            ))}
            {triggerStats.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No data yet</p>}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailManagement;
