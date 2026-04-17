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
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  MessageSquare, Send, Clock, BarChart3, Zap, RefreshCw, Loader2, CheckCircle2,
  XCircle, AlertTriangle, TrendingUp, Plus, Search, FileText, LayoutDashboard,
  TestTube, Settings, Users, Phone, Shield, Sparkles, Power, Smartphone, Hash, Trash2,
} from "lucide-react";
import { format, subDays } from "date-fns";

// ─── Dashboard Tab ───
const SmsDashboard = () => {
  const [stats, setStats] = useState({
    totalSent: 0, delivered: 0, failed: 0, blockedQuota: 0,
    deliveryRate: 0, todaySent: 0, monthSent: 0, fallbackSent: 0,
  });
  const [recent, setRecent] = useState<any[]>([]);
  const [series, setSeries] = useState<{ date: string; count: number }[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch_ = useCallback(async () => {
    setLoading(true);
    try {
      const since = subDays(new Date(), 7).toISOString();
      const { data: msgs } = await supabase
        .from("sms_messages")
        .select("id,status,fallback_sent,created_at,to_number,category,priority,template_name,error_message")
        .gte("created_at", since)
        .order("created_at", { ascending: false })
        .limit(500);

      const today = new Date().toISOString().split("T")[0];
      const monthStart = new Date(); monthStart.setDate(1);
      const all = msgs || [];
      const total = all.length;
      const delivered = all.filter(m => m.status === "sent" || m.status === "delivered").length;
      const failed = all.filter(m => m.status === "failed").length;
      const blocked = all.filter(m => m.status === "blocked_quota").length;
      const todayCount = all.filter(m => m.created_at.startsWith(today)).length;
      const monthCount = all.filter(m => new Date(m.created_at) >= monthStart).length;
      const fb = all.filter(m => m.fallback_sent).length;

      setStats({
        totalSent: total, delivered, failed, blockedQuota: blocked,
        deliveryRate: total > 0 ? Math.round((delivered / total) * 100) : 0,
        todaySent: todayCount, monthSent: monthCount, fallbackSent: fb,
      });
      setRecent(all.slice(0, 10));

      // 7-day series
      const buckets: Record<string, number> = {};
      for (let i = 6; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "MMM dd");
        buckets[d] = 0;
      }
      all.forEach(m => {
        const d = format(new Date(m.created_at), "MMM dd");
        if (d in buckets) buckets[d]++;
      });
      setSeries(Object.entries(buckets).map(([date, count]) => ({ date, count })));
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const cards = [
    { label: "7-Day Sent", value: stats.totalSent, icon: Send, color: "text-primary", bg: "bg-primary/10" },
    { label: "Delivered", value: stats.delivered, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Failed", value: stats.failed, icon: XCircle, color: "text-red-400", bg: "bg-red-500/10" },
    { label: "Blocked (Quota)", value: stats.blockedQuota, icon: AlertTriangle, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Delivery Rate", value: `${stats.deliveryRate}%`, icon: TrendingUp, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Today", value: stats.todaySent, icon: Clock, color: "text-blue-400", bg: "bg-blue-500/10" },
    { label: "This Month", value: stats.monthSent, icon: BarChart3, color: "text-violet-400", bg: "bg-violet-500/10" },
    { label: "Fallback Sent", value: stats.fallbackSent, icon: Shield, color: "text-fuchsia-400", bg: "bg-fuchsia-500/10" },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-foreground">SMS Notification Dashboard</h3>
          <p className="text-sm text-muted-foreground">Real-time delivery, quota & fallback performance</p>
        </div>
        <Button variant="outline" size="sm" onClick={fetch_} disabled={loading}>
          <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {cards.map((s, i) => (
          <Card key={i} className="border-border/50 bg-card/50 backdrop-blur-sm">
            <CardContent className="p-4">
              <div className={`h-9 w-9 rounded-lg ${s.bg} flex items-center justify-center mb-3`}>
                <s.icon className={`h-4 w-4 ${s.color}`} />
              </div>
              <p className="text-2xl font-bold text-foreground">{s.value}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Last 7 Days</CardTitle></CardHeader>
        <CardContent>
          <div className="flex items-end gap-2 h-32">
            {series.map((d, i) => {
              const max = Math.max(...series.map(s => s.count), 1);
              const h = (d.count / max) * 100;
              return (
                <div key={i} className="flex-1 flex flex-col items-center gap-1">
                  <div className="w-full bg-primary/20 rounded-t flex items-end justify-center" style={{ height: `${h}%`, minHeight: "4px" }}>
                    <span className="text-[10px] text-foreground font-bold pb-1">{d.count || ""}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{d.date}</span>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="border-border/50">
        <CardHeader className="pb-3"><CardTitle className="text-sm font-medium">Recent Activity</CardTitle></CardHeader>
        <CardContent>
          {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
            : recent.length === 0 ? <p className="text-center py-8 text-muted-foreground text-sm">No SMS sent yet</p>
            : <div className="space-y-2">
                {recent.map(log => (
                  <div key={log.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border/30">
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-500/15 flex items-center justify-center">
                        <Smartphone className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-foreground">+{log.to_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {log.template_name || "custom"} • {format(new Date(log.created_at), "MMM dd, HH:mm")}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className={
                      log.status === "sent" || log.status === "delivered" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      log.status === "blocked_quota" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                      "bg-red-500/15 text-red-400 border-red-500/30"
                    }>{log.status}</Badge>
                  </div>
                ))}
              </div>}
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Send Test SMS Tab ───
const SmsTest = () => {
  const { toast } = useToast();
  const [phone, setPhone] = useState("");
  const [message, setMessage] = useState("ACRY test SMS — all systems operational.");
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState<any>(null);

  const send = async () => {
    if (!phone.trim()) {
      toast({ title: "Phone required", variant: "destructive" }); return;
    }
    setSending(true); setResult(null);
    try {
      const { data, error } = await supabase.functions.invoke("sms-notify", {
        body: { action: "test", phone: phone.trim(), message },
      });
      if (error) throw error;
      setResult(data);
      toast({
        title: data?.ok ? "SMS sent ✓" : "Send failed",
        description: data?.ok ? `Request ID: ${data.requestId}` : (data?.error || "Unknown"),
        variant: data?.ok ? "default" : "destructive",
      });
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><TestTube className="h-5 w-5 text-primary" /> Send Test SMS</CardTitle>
        <CardDescription>Verify MSG91 connectivity and DLT template approval</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <Label>Phone (with country code, e.g. 919876543210)</Label>
          <Input placeholder="919876543210" value={phone} onChange={e => setPhone(e.target.value)} />
        </div>
        <div>
          <Label>Message ({message.length}/300 chars)</Label>
          <Textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} rows={3} />
          <p className="text-xs text-muted-foreground mt-1">
            Must match an approved DLT template if your sender ID requires it.
          </p>
        </div>
        <Button onClick={send} disabled={sending || !phone} className="w-full">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Send className="h-4 w-4 mr-2" />}
          Send Test SMS
        </Button>
        {result && (
          <pre className="text-xs bg-muted/30 p-3 rounded border border-border/30 overflow-auto max-h-48">
            {JSON.stringify(result, null, 2)}
          </pre>
        )}
      </CardContent>
    </Card>
  );
};

// ─── Broadcast Tab ───
const SmsBroadcast = () => {
  const { toast } = useToast();
  const [mode, setMode] = useState<"template" | "custom">("template");
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [message, setMessage] = useState("");
  const [category, setCategory] = useState("engagement");
  const [priority, setPriority] = useState("medium");
  const [audience, setAudience] = useState<"all" | "phone_list">("all");
  const [phoneList, setPhoneList] = useState("");
  const [scheduleAt, setScheduleAt] = useState("");
  const [sending, setSending] = useState(false);
  const [varsJson, setVarsJson] = useState("{}");

  useEffect(() => {
    supabase.from("sms_templates").select("*").eq("is_active", true).order("name")
      .then(({ data }) => setTemplates(data || []));
  }, []);

  const broadcast = async () => {
    setSending(true);
    try {
      let user_ids: string[] = [];
      if (audience === "all") {
        const { data } = await supabase.from("profiles").select("id").not("phone", "is", null).limit(2000);
        user_ids = (data || []).map(p => p.id);
      } else {
        // resolve phone numbers → user_ids
        const phones = phoneList.split(/[\s,;\n]+/).filter(Boolean);
        const { data } = await supabase.from("profiles").select("id,phone").in("phone", phones);
        user_ids = (data || []).map(p => p.id);
      }

      if (user_ids.length === 0) {
        toast({ title: "No recipients found", variant: "destructive" });
        setSending(false); return;
      }

      let variables: Record<string, any> = {};
      try { variables = JSON.parse(varsJson || "{}"); }
      catch { toast({ title: "Invalid variables JSON", variant: "destructive" }); setSending(false); return; }

      if (scheduleAt) {
        const { error } = await supabase.from("sms_scheduled_sends").insert({
          template_name: mode === "template" ? templateName : "custom",
          category, variables,
          audience_type: audience === "all" ? "all" : "select",
          audience_user_ids: audience === "all" ? null : user_ids,
          scheduled_at: new Date(scheduleAt).toISOString(),
          status: "scheduled",
          total_recipients: user_ids.length,
        });
        if (error) throw error;
        toast({ title: "Scheduled ✓", description: `${user_ids.length} recipients at ${scheduleAt}` });
      } else {
        const { data, error } = await supabase.functions.invoke("sms-notify", {
          body: {
            action: "bulk-send", user_ids,
            template_name: mode === "template" ? templateName : undefined,
            message: mode === "custom" ? message : undefined,
            category, priority, variables, source: "admin_broadcast",
          },
        });
        if (error) throw error;
        toast({
          title: "Broadcast complete",
          description: `Delivered ${data.delivered}/${data.total} • Failed ${data.failed} • Quota-blocked ${data.blocked_quota}`,
        });
      }
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally { setSending(false); }
  };

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Broadcast SMS Campaign</CardTitle>
        <CardDescription>Send to all users with phone numbers, or to a specific list</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Mode</Label>
            <Select value={mode} onValueChange={(v: any) => setMode(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="template">DLT Template</SelectItem>
                <SelectItem value="custom">Custom Message</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Audience</Label>
            <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All users with phone</SelectItem>
                <SelectItem value="phone_list">Specific phone list</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {mode === "template" ? (
          <div>
            <Label>Template</Label>
            <Select value={templateName} onValueChange={setTemplateName}>
              <SelectTrigger><SelectValue placeholder="Choose template" /></SelectTrigger>
              <SelectContent>
                {templates.map(t => <SelectItem key={t.id} value={t.name}>{t.display_name}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <div>
            <Label>Message ({message.length}/300)</Label>
            <Textarea value={message} onChange={e => setMessage(e.target.value.slice(0, 300))} rows={3} />
          </div>
        )}

        <div>
          <Label>Variables (JSON)</Label>
          <Textarea value={varsJson} onChange={e => setVarsJson(e.target.value)} rows={2}
            placeholder='{"name":"User","days":3}' className="font-mono text-xs" />
        </div>

        {audience === "phone_list" && (
          <div>
            <Label>Phone numbers (comma/newline separated)</Label>
            <Textarea value={phoneList} onChange={e => setPhoneList(e.target.value)} rows={3}
              placeholder="919876543210, 919812345678" />
          </div>
        )}

        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={category} onValueChange={setCategory}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Priority</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="low">Low</SelectItem>
                <SelectItem value="medium">Medium</SelectItem>
                <SelectItem value="high">High</SelectItem>
                <SelectItem value="critical">Critical (bypass quota)</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Schedule (optional)</Label>
            <Input type="datetime-local" value={scheduleAt} onChange={e => setScheduleAt(e.target.value)} />
          </div>
        </div>

        <Button onClick={broadcast} disabled={sending || (mode === "template" && !templateName) || (mode === "custom" && !message)}
          className="w-full">
          {sending ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Zap className="h-4 w-4 mr-2" />}
          {scheduleAt ? "Schedule Broadcast" : "Send Now"}
        </Button>
      </CardContent>
    </Card>
  );
};

// ─── Logs Tab ───
const SmsLogs = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("sms_messages")
      .select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setLogs(data || []);
    setLoading(false);
  }, [filter]);

  useEffect(() => { load(); }, [load]);

  const filtered = logs.filter(l =>
    !search || l.to_number?.includes(search) || l.template_name?.includes(search) || l.message_body?.includes(search)
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> Delivery Logs</CardTitle>
        <CardDescription>Last 200 SMS messages</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search phone, template, body..." className="pl-9" />
          </div>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="delivered">Delivered</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="blocked_quota">Blocked (quota)</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <ScrollArea className="h-[500px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Phone</TableHead>
                <TableHead>Template</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Time</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(l => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono text-xs">+{l.to_number}</TableCell>
                  <TableCell className="text-xs">{l.template_name || "—"}</TableCell>
                  <TableCell><Badge variant="outline" className="text-[10px]">{l.category || "—"}</Badge></TableCell>
                  <TableCell>
                    <Badge variant="outline" className={
                      l.status === "sent" || l.status === "delivered" ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/30" :
                      l.status === "blocked_quota" ? "bg-amber-500/15 text-amber-400 border-amber-500/30" :
                      "bg-red-500/15 text-red-400 border-red-500/30"
                    }>{l.status}</Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "MMM dd HH:mm")}</TableCell>
                </TableRow>
              ))}
              {filtered.length === 0 && (
                <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No logs</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// ─── Quota Viewer Tab ───
const SmsQuotaViewer = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    const { data: quotas } = await supabase.from("sms_quota")
      .select("*").order("count", { ascending: false }).limit(200);
    if (!quotas?.length) { setUsers([]); setLoading(false); return; }
    const userIds = quotas.map(q => q.user_id);
    const { data: profs } = await supabase.from("profiles")
      .select("id,display_name,phone,email").in("id", userIds);
    const profMap = new Map((profs || []).map(p => [p.id, p]));
    setUsers(quotas.map(q => ({ ...q, profile: profMap.get(q.user_id) })));
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = users.filter(u =>
    !search ||
    u.profile?.display_name?.toLowerCase().includes(search.toLowerCase()) ||
    u.profile?.phone?.includes(search) ||
    u.profile?.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><Hash className="h-5 w-5 text-primary" /> Per-User Quota</CardTitle>
        <CardDescription>Top 200 users by usage this month</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search name, phone, email..." className="pl-9" />
          </div>
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
        <ScrollArea className="h-[500px]">
          <div className="space-y-2">
            {filtered.map(u => {
              const pct = u.monthly_limit > 0 ? (u.count / u.monthly_limit) * 100 : 0;
              return (
                <div key={u.user_id} className="p-3 rounded-lg bg-muted/30 border border-border/30">
                  <div className="flex items-center justify-between mb-2">
                    <div>
                      <p className="text-sm font-medium text-foreground">{u.profile?.display_name || "Unknown"}</p>
                      <p className="text-xs text-muted-foreground font-mono">+{u.profile?.phone || "—"}</p>
                    </div>
                    <Badge variant={pct >= 100 ? "destructive" : pct >= 80 ? "secondary" : "outline"}>
                      {u.count} / {u.monthly_limit}
                    </Badge>
                  </div>
                  <Progress value={Math.min(100, pct)} className="h-1.5" />
                </div>
              );
            })}
            {filtered.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No quota records</p>}
          </div>
        </ScrollArea>
      </CardContent>
    </Card>
  );
};

// ─── Templates Tab ───
const SmsTemplates = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("sms_templates").select("*").order("name");
    setTemplates(data || []); setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async (form: any) => {
    const payload = {
      ...form,
      variables: typeof form.variables === "string"
        ? JSON.parse(form.variables || "[]")
        : form.variables,
    };
    if (editing?.id) {
      const { error } = await supabase.from("sms_templates").update(payload).eq("id", editing.id);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    } else {
      const { error } = await supabase.from("sms_templates").insert(payload);
      if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    }
    toast({ title: "Saved ✓" });
    setOpen(false); setEditing(null); load();
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this template?")) return;
    await supabase.from("sms_templates").delete().eq("id", id);
    load();
  };

  return (
    <Card className="border-border/50">
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle className="flex items-center gap-2"><FileText className="h-5 w-5 text-primary" /> SMS Templates</CardTitle>
          <CardDescription>Manage DLT-approved message templates</CardDescription>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" onClick={() => setEditing(null)}><Plus className="h-4 w-4 mr-2" />New</Button>
          </DialogTrigger>
          <TemplateDialog template={editing} onSave={save} />
        </Dialog>
      </CardHeader>
      <CardContent>
        {loading ? <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>
          : <div className="space-y-2">
              {templates.map(t => (
                <div key={t.id} className="p-3 rounded-lg bg-muted/30 border border-border/30 flex items-center justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="text-sm font-bold text-foreground">{t.display_name}</p>
                      <Badge variant="outline" className="text-[10px]">{t.category}</Badge>
                      {!t.is_active && <Badge variant="secondary" className="text-[10px]">disabled</Badge>}
                      {t.dlt_template_id && <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">DLT</Badge>}
                    </div>
                    <p className="text-xs text-muted-foreground font-mono truncate">{t.body_template}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">name: {t.name}</p>
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" onClick={() => { setEditing(t); setOpen(true); }}>
                      <Settings className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => remove(t.id)}>
                      <Trash2 className="h-4 w-4 text-red-400" />
                    </Button>
                  </div>
                </div>
              ))}
              {templates.length === 0 && <p className="text-center py-8 text-muted-foreground text-sm">No templates yet</p>}
            </div>}
      </CardContent>
    </Card>
  );
};

const TemplateDialog = ({ template, onSave }: { template: any; onSave: (f: any) => void }) => {
  const [form, setForm] = useState({
    name: "", display_name: "", body_template: "", category: "engagement",
    variables: "[]", dlt_template_id: "", sender_id: "", description: "", is_active: true,
  });
  useEffect(() => {
    if (template) setForm({
      name: template.name || "",
      display_name: template.display_name || "",
      body_template: template.body_template || "",
      category: template.category || "engagement",
      variables: JSON.stringify(template.variables || []),
      dlt_template_id: template.dlt_template_id || "",
      sender_id: template.sender_id || "",
      description: template.description || "",
      is_active: template.is_active !== false,
    });
    else setForm({
      name: "", display_name: "", body_template: "", category: "engagement",
      variables: "[]", dlt_template_id: "", sender_id: "", description: "", is_active: true,
    });
  }, [template]);

  return (
    <DialogContent className="max-w-2xl">
      <DialogHeader>
        <DialogTitle>{template ? "Edit" : "New"} SMS Template</DialogTitle>
      </DialogHeader>
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Internal Name (snake_case)</Label>
            <Input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="daily_mission_reminder" />
          </div>
          <div>
            <Label>Display Name</Label>
            <Input value={form.display_name} onChange={e => setForm({ ...form, display_name: e.target.value })} />
          </div>
        </div>
        <div>
          <Label>Body Template (use {"{{variable}}"})</Label>
          <Textarea value={form.body_template} onChange={e => setForm({ ...form, body_template: e.target.value })} rows={3} />
        </div>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <Label>Category</Label>
            <Select value={form.category} onValueChange={v => setForm({ ...form, category: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="engagement">Engagement</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="otp">OTP</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>DLT Template ID</Label>
            <Input value={form.dlt_template_id} onChange={e => setForm({ ...form, dlt_template_id: e.target.value })} />
          </div>
          <div>
            <Label>Sender ID Override</Label>
            <Input value={form.sender_id} onChange={e => setForm({ ...form, sender_id: e.target.value })} placeholder="ACRYAI" />
          </div>
        </div>
        <div>
          <Label>Variables (JSON array)</Label>
          <Input value={form.variables} onChange={e => setForm({ ...form, variables: e.target.value })} className="font-mono text-xs" />
        </div>
        <div>
          <Label>Description</Label>
          <Input value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
        </div>
        <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
          <Label>Active</Label>
          <Switch checked={form.is_active} onCheckedChange={v => setForm({ ...form, is_active: v })} />
        </div>
      </div>
      <DialogFooter>
        <Button onClick={() => onSave(form)} disabled={!form.name || !form.body_template}>Save</Button>
      </DialogFooter>
    </DialogContent>
  );
};

// ─── Config Tab ───
const SmsConfig = () => {
  const { toast } = useToast();
  const [config, setConfig] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    supabase.from("sms_config").select("*").limit(1).maybeSingle()
      .then(({ data }) => setConfig(data));
  }, []);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    const { error } = await supabase.from("sms_config").update({
      is_enabled: config.is_enabled,
      monthly_limit_per_user: Number(config.monthly_limit_per_user),
      sender_id: config.sender_id,
      default_dlt_template_id: config.default_dlt_template_id,
      default_route: config.default_route,
      default_country: config.default_country,
      auto_fallback_on_quota_exceeded: config.auto_fallback_on_quota_exceeded,
      allowed_categories: config.allowed_categories,
      critical_categories: config.critical_categories,
      fallback_channels: config.fallback_channels,
      updated_at: new Date().toISOString(),
    }).eq("id", config.id);
    setSaving(false);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else toast({ title: "Saved ✓" });
  };

  if (!config) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin" /></div>;

  return (
    <div className="space-y-4">
      <Card className="border-border/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2"><Settings className="h-5 w-5 text-primary" /> MSG91 SMS Configuration</CardTitle>
          <CardDescription>Provider settings & quota policy</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
            <div>
              <Label className="text-base">Enable SMS Notifications</Label>
              <p className="text-xs text-muted-foreground">Master switch for all SMS sends</p>
            </div>
            <Switch checked={config.is_enabled} onCheckedChange={v => setConfig({ ...config, is_enabled: v })} />
          </div>
          <div className="flex items-center justify-between p-3 bg-muted/30 rounded">
            <div>
              <Label className="text-base">Auto-fallback on quota</Label>
              <p className="text-xs text-muted-foreground">Send via push/email when SMS limit reached</p>
            </div>
            <Switch checked={config.auto_fallback_on_quota_exceeded}
              onCheckedChange={v => setConfig({ ...config, auto_fallback_on_quota_exceeded: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Monthly limit / user</Label>
              <Input type="number" value={config.monthly_limit_per_user}
                onChange={e => setConfig({ ...config, monthly_limit_per_user: e.target.value })} />
            </div>
            <div>
              <Label>Sender ID</Label>
              <Input value={config.sender_id} onChange={e => setConfig({ ...config, sender_id: e.target.value })} />
            </div>
            <div>
              <Label>Default DLT Template ID</Label>
              <Input value={config.default_dlt_template_id || ""}
                onChange={e => setConfig({ ...config, default_dlt_template_id: e.target.value })} />
            </div>
            <div>
              <Label>MSG91 Route</Label>
              <Select value={config.default_route} onValueChange={v => setConfig({ ...config, default_route: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="4">4 — Transactional</SelectItem>
                  <SelectItem value="1">1 — Promotional</SelectItem>
                  <SelectItem value="11">11 — Marketing</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Country code</Label>
              <Input value={config.default_country} onChange={e => setConfig({ ...config, default_country: e.target.value })} />
            </div>
            <div>
              <Label>Critical categories (bypass quota)</Label>
              <Input value={(config.critical_categories || []).join(",")}
                onChange={e => setConfig({ ...config, critical_categories: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                className="font-mono text-xs" />
            </div>
            <div>
              <Label>Allowed categories</Label>
              <Input value={(config.allowed_categories || []).join(",")}
                onChange={e => setConfig({ ...config, allowed_categories: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                className="font-mono text-xs" />
            </div>
            <div>
              <Label>Fallback channels</Label>
              <Input value={(config.fallback_channels || []).join(",")}
                onChange={e => setConfig({ ...config, fallback_channels: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                className="font-mono text-xs" />
            </div>
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
            Save Configuration
          </Button>
        </CardContent>
      </Card>

      <Card className="border-border/50 bg-amber-500/5">
        <CardContent className="p-4 text-xs text-muted-foreground">
          <p className="flex items-center gap-2 font-medium text-amber-400 mb-2">
            <AlertTriangle className="h-4 w-4" /> DLT Compliance
          </p>
          <p>India SMS regulations require all transactional/promotional SMS to use a DLT-approved template ID and sender ID. OTP-only routes (route 4) work without DLT for whitelisted senders. Template body must match exactly what's approved in your DLT account.</p>
        </CardContent>
      </Card>
    </div>
  );
};

// ─── Main Component ───
const SmsCommandCenter = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <div className="h-12 w-12 rounded-xl bg-gradient-to-br from-blue-500/20 to-cyan-500/20 flex items-center justify-center">
          <Smartphone className="h-6 w-6 text-blue-400" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">SMS Notification Center</h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            MSG91 SMS · 60 msgs/user/month · auto-fallback to Push & Email · DLT compliant
          </p>
        </div>
      </div>

      <Tabs defaultValue="dashboard">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="test"><TestTube className="h-4 w-4 mr-1" />Test</TabsTrigger>
          <TabsTrigger value="broadcast"><Send className="h-4 w-4 mr-1" />Broadcast</TabsTrigger>
          <TabsTrigger value="logs"><FileText className="h-4 w-4 mr-1" />Logs</TabsTrigger>
          <TabsTrigger value="quota"><Hash className="h-4 w-4 mr-1" />Quota</TabsTrigger>
          <TabsTrigger value="templates"><Sparkles className="h-4 w-4 mr-1" />Templates</TabsTrigger>
        </TabsList>
        <TabsContent value="dashboard" className="mt-6"><SmsDashboard /></TabsContent>
        <TabsContent value="test" className="mt-6"><SmsTest /></TabsContent>
        <TabsContent value="broadcast" className="mt-6"><SmsBroadcast /></TabsContent>
        <TabsContent value="logs" className="mt-6"><SmsLogs /></TabsContent>
        <TabsContent value="quota" className="mt-6"><SmsQuotaViewer /></TabsContent>
        <TabsContent value="templates" className="mt-6"><SmsTemplates /></TabsContent>
      </Tabs>

      <SmsConfig />
    </div>
  );
};

export default SmsCommandCenter;
