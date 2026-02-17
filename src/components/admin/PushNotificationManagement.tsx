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
  Bell, Send, Clock, BarChart3, Zap, Eye, Pencil,
  RefreshCw, Loader2, CheckCircle2, XCircle, AlertTriangle,
  TrendingUp, Play, Trash2, Plus, Search,
  Filter, LayoutDashboard, Sparkles, Power, ChevronRight,
  Target, Users, Activity, Megaphone, Smartphone, Globe,
  Settings, Radio, MousePointerClick, ArrowUpRight
} from "lucide-react";
import { format } from "date-fns";

// ─── Types ───
type PushTrigger = {
  id: string; trigger_key: string; display_name: string; description: string | null;
  category: string; template_id: string | null; is_enabled: boolean;
  conditions: Record<string, unknown>; cooldown_minutes: number; priority: string;
  schedule_type: string; schedule_config: Record<string, unknown> | null;
  target_audience: Record<string, unknown>; use_ai_content: boolean;
  total_sent: number; total_opened: number; total_clicked: number;
  created_at: string; updated_at: string;
};
type PushTemplate = {
  id: string; name: string; title_template: string; body_template: string;
  category: string; variables: string[] | null; priority: string;
  is_active: boolean; use_ai_personalization: boolean;
  created_at: string; updated_at: string;
};
type PushLog = {
  id: string; user_id: string; trigger_key: string | null; title: string;
  body: string | null; status: string; device_count: number;
  delivered_count: number; opened_at: string | null; clicked_at: string | null;
  ai_generated: boolean; created_at: string;
};
type QueueItem = {
  id: string; user_id: string; trigger_key: string | null; title: string;
  body: string; status: string; priority: string; scheduled_at: string;
  sent_at: string | null; error_message: string | null; created_at: string;
};

const CATEGORIES = [
  { value: "user_action", label: "User Actions", color: "bg-blue-500/15 text-blue-400", icon: "👤" },
  { value: "ai_prediction", label: "AI Predictions", color: "bg-purple-500/15 text-purple-400", icon: "🧠" },
  { value: "study_reminder", label: "Study Reminders", color: "bg-amber-500/15 text-amber-400", icon: "📚" },
  { value: "improvement", label: "Improvement", color: "bg-emerald-500/15 text-emerald-400", icon: "📈" },
  { value: "rank_exam", label: "Rank & Exam", color: "bg-rose-500/15 text-rose-400", icon: "🏆" },
  { value: "community", label: "Community", color: "bg-cyan-500/15 text-cyan-400", icon: "💬" },
  { value: "billing", label: "Billing", color: "bg-orange-500/15 text-orange-400", icon: "💳" },
  { value: "security", label: "Security", color: "bg-red-500/15 text-red-400", icon: "🔒" },
  { value: "engagement", label: "Engagement", color: "bg-pink-500/15 text-pink-400", icon: "🔥" },
  { value: "admin", label: "Admin", color: "bg-slate-500/15 text-slate-400", icon: "📢" },
];

const getCategoryStyle = (cat: string) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

const PushNotificationManagement = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");
  const [triggers, setTriggers] = useState<PushTrigger[]>([]);
  const [templates, setTemplates] = useState<PushTemplate[]>([]);
  const [logs, setLogs] = useState<PushLog[]>([]);
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [stats, setStats] = useState({ totalSent: 0, totalDevices: 0, openRate: 0, clickRate: 0 });

  // Template editor state
  const [editTemplate, setEditTemplate] = useState<PushTemplate | null>(null);
  const [showTemplateDialog, setShowTemplateDialog] = useState(false);
  const [templateForm, setTemplateForm] = useState({
    name: "", title_template: "", body_template: "", category: "general",
    priority: "normal", use_ai_personalization: false, variables: ""
  });

  // Announcement state
  const [showAnnouncement, setShowAnnouncement] = useState(false);
  const [announcementForm, setAnnouncementForm] = useState({ title: "", body: "", target: "all" });
  const [sending, setSending] = useState(false);

  // AI Template Generator state
  const [showAIPicker, setShowAIPicker] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiPurpose, setAiPurpose] = useState("");
  const [aiCategory, setAiCategory] = useState("general");
  const [customPurpose, setCustomPurpose] = useState("");

  const AI_PURPOSES = [
    { value: "welcome", label: "🎉 Welcome / Onboarding", desc: "New user signup or profile setup" },
    { value: "memory_risk", label: "⚠️ Memory Risk Alert", desc: "Topic about to be forgotten" },
    { value: "weak_topic", label: "📉 Weak Topic Detected", desc: "AI found a struggling area" },
    { value: "study_reminder", label: "📚 Study Reminder", desc: "Nudge to study today" },
    { value: "inactive_comeback", label: "💤 Comeback Nudge", desc: "User inactive for days" },
    { value: "streak_risk", label: "🔥 Streak At Risk", desc: "Streak about to break" },
    { value: "streak_milestone", label: "🏆 Streak Milestone", desc: "Celebrate streak achievement" },
    { value: "brain_improved", label: "🧠 Brain Performance Up", desc: "Brain score improved" },
    { value: "brain_declined", label: "📊 Brain Performance Down", desc: "Brain score dropped" },
    { value: "rank_improved", label: "🚀 Rank Improved", desc: "User rank went up" },
    { value: "rank_declined", label: "📉 Rank Declined", desc: "User rank dropped" },
    { value: "exam_approaching", label: "📅 Exam Approaching", desc: "Exam date countdown" },
    { value: "fix_session", label: "🔧 Fix Session Needed", desc: "AI recommends a fix session" },
    { value: "revision_due", label: "🔄 Revision Due", desc: "Topics need revision" },
    { value: "achievement", label: "🎖️ Achievement Unlocked", desc: "Milestone or badge earned" },
    { value: "subscription", label: "💳 Subscription Alert", desc: "Billing or plan notification" },
    { value: "community", label: "💬 Community Activity", desc: "Reply, mention, or AI answer" },
    { value: "security", label: "🔒 Security Alert", desc: "New login or suspicious activity" },
    { value: "custom", label: "✨ Custom Purpose", desc: "Describe your own purpose" },
  ];

  const generateAITemplate = async () => {
    setAiGenerating(true);
    try {
      const purpose = aiPurpose === "custom" ? customPurpose : aiPurpose;
      const { data, error } = await supabase.functions.invoke("generate-push-template", {
        body: { purpose, category: aiCategory },
      });
      if (error) throw error;
      if (!data?.name) throw new Error("AI returned empty result");

      setTemplateForm({
        name: data.name,
        title_template: data.title_template,
        body_template: data.body_template,
        category: data.category || aiCategory,
        priority: data.priority || "normal",
        use_ai_personalization: true,
        variables: (data.variables || []).join(", "),
      });
      setShowAIPicker(false);
      setShowTemplateDialog(true);
      setEditTemplate(null);
      toast({ title: "AI Template Generated ✨", description: "Review and save the template" });
    } catch (e: any) {
      toast({ title: "AI Generation Failed", description: e.message, variant: "destructive" });
    }
    setAiGenerating(false);
  };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [trRes, tmRes, lgRes, qRes, devRes] = await Promise.all([
      (supabase as any).from("push_notification_triggers").select("*").order("category"),
      (supabase as any).from("push_notification_templates").select("*").order("created_at", { ascending: false }),
      (supabase as any).from("push_notification_logs").select("*").order("created_at", { ascending: false }).limit(200),
      (supabase as any).from("push_notification_queue").select("*").order("scheduled_at", { ascending: false }).limit(100),
      (supabase as any).from("push_subscriptions").select("id", { count: "exact", head: true }),
    ]);

    setTriggers(trRes.data || []);
    setTemplates(tmRes.data || []);
    setLogs(lgRes.data || []);
    setQueue(qRes.data || []);

    const allLogs = lgRes.data || [];
    const totalSent = allLogs.filter((l: PushLog) => l.status === "sent").length;
    const opened = allLogs.filter((l: PushLog) => l.opened_at).length;
    const clicked = allLogs.filter((l: PushLog) => l.clicked_at).length;

    setStats({
      totalSent,
      totalDevices: devRes.count || 0,
      openRate: totalSent > 0 ? Math.round((opened / totalSent) * 100) : 0,
      clickRate: totalSent > 0 ? Math.round((clicked / totalSent) * 100) : 0,
    });

    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Toggle trigger
  const toggleTrigger = async (id: string, enabled: boolean) => {
    await (supabase as any).from("push_notification_triggers").update({ is_enabled: enabled }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, is_enabled: enabled } : t));
    toast({ title: enabled ? "Trigger Enabled" : "Trigger Disabled" });
  };

  // Toggle AI content for trigger
  const toggleAI = async (id: string, useAi: boolean) => {
    await (supabase as any).from("push_notification_triggers").update({ use_ai_content: useAi }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, use_ai_content: useAi } : t));
  };

  // Update cooldown
  const updateCooldown = async (id: string, minutes: number) => {
    await (supabase as any).from("push_notification_triggers").update({ cooldown_minutes: minutes }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, cooldown_minutes: minutes } : t));
  };

  // Save template
  const saveTemplate = async () => {
    const payload = {
      name: templateForm.name,
      title_template: templateForm.title_template,
      body_template: templateForm.body_template,
      category: templateForm.category,
      priority: templateForm.priority,
      use_ai_personalization: templateForm.use_ai_personalization,
      variables: templateForm.variables ? templateForm.variables.split(",").map(v => v.trim()).filter(Boolean) : [],
    };

    if (editTemplate) {
      await (supabase as any).from("push_notification_templates").update(payload).eq("id", editTemplate.id);
      toast({ title: "Template Updated" });
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      await (supabase as any).from("push_notification_templates").insert({ ...payload, created_by: user?.id });
      toast({ title: "Template Created" });
    }
    setShowTemplateDialog(false);
    setEditTemplate(null);
    fetchAll();
  };

  // Send announcement
  const sendAnnouncement = async () => {
    setSending(true);
    try {
      const { data, error } = await supabase.functions.invoke("push-automation-engine", {
        body: {
          action: "send_direct",
          title: announcementForm.title,
          body: announcementForm.body,
          data: { type: "admin_announcement" },
        },
      });
      if (error) throw error;
      toast({ title: "Announcement Sent", description: `Delivered to ${data?.users || 0} users` });
      setShowAnnouncement(false);
      setAnnouncementForm({ title: "", body: "", target: "all" });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Send Failed", description: e.message, variant: "destructive" });
    }
    setSending(false);
  };

  // Process queue
  const processQueue = async () => {
    try {
      const { data, error } = await supabase.functions.invoke("push-automation-engine", {
        body: { action: "process_queue" },
      });
      if (error) throw error;
      toast({ title: "Queue Processed", description: `${data?.processed || 0} notifications sent` });
      fetchAll();
    } catch (e: any) {
      toast({ title: "Process Failed", description: e.message, variant: "destructive" });
    }
  };

  // Test trigger
  const testTrigger = async (triggerKey: string) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("push-automation-engine", {
        body: { action: "fire_trigger", trigger_key: triggerKey, user_id: user?.id, variables: { topic_name: "Test Topic", score: 75 } },
      });
      if (error) throw error;
      toast({ title: "Test Sent", description: `Sent to ${data?.sent || 0} devices` });
    } catch (e: any) {
      toast({ title: "Test Failed", description: e.message, variant: "destructive" });
    }
  };

  // Assign template to trigger
  const assignTemplate = async (triggerId: string, templateId: string | null) => {
    await (supabase as any).from("push_notification_triggers").update({ template_id: templateId || null }).eq("id", triggerId);
    setTriggers(prev => prev.map(t => t.id === triggerId ? { ...t, template_id: templateId } : t));
    toast({ title: "Template Assigned" });
  };

  // Delete template
  const deleteTemplate = async (id: string) => {
    await (supabase as any).from("push_notification_templates").delete().eq("id", id);
    toast({ title: "Template Deleted" });
    fetchAll();
  };

  const openNewTemplate = () => {
    setEditTemplate(null);
    setTemplateForm({ name: "", title_template: "", body_template: "", category: "general", priority: "normal", use_ai_personalization: false, variables: "" });
    setShowTemplateDialog(true);
  };

  const openEditTemplate = (t: PushTemplate) => {
    setEditTemplate(t);
    setTemplateForm({
      name: t.name, title_template: t.title_template, body_template: t.body_template,
      category: t.category, priority: t.priority, use_ai_personalization: t.use_ai_personalization,
      variables: (t.variables || []).join(", "),
    });
    setShowTemplateDialog(true);
  };

  const filteredTriggers = triggers.filter(t =>
    (catFilter === "all" || t.category === catFilter) &&
    (!searchQ || t.display_name.toLowerCase().includes(searchQ.toLowerCase()) || t.trigger_key.toLowerCase().includes(searchQ.toLowerCase()))
  );

  const filteredLogs = logs.filter(l =>
    !searchQ || (l.title?.toLowerCase().includes(searchQ.toLowerCase())) || (l.trigger_key?.toLowerCase().includes(searchQ.toLowerCase()))
  );

  if (loading) {
    return <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Bell className="w-7 h-7 text-primary" /> Push Notification Command Center
          </h2>
          <p className="text-sm text-muted-foreground mt-1">AI-driven, fully automated push notification management</p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="w-4 h-4 mr-1" /> Refresh</Button>
          <Button size="sm" onClick={() => setShowAnnouncement(true)} className="bg-primary text-primary-foreground">
            <Megaphone className="w-4 h-4 mr-1" /> Send Announcement
          </Button>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-muted/50 p-1 rounded-xl flex-wrap h-auto gap-1">
          <TabsTrigger value="dashboard" className="text-xs gap-1"><LayoutDashboard className="w-3.5 h-3.5" /> Dashboard</TabsTrigger>
          <TabsTrigger value="triggers" className="text-xs gap-1"><Zap className="w-3.5 h-3.5" /> Triggers</TabsTrigger>
          <TabsTrigger value="templates" className="text-xs gap-1"><Sparkles className="w-3.5 h-3.5" /> Templates</TabsTrigger>
          <TabsTrigger value="queue" className="text-xs gap-1"><Clock className="w-3.5 h-3.5" /> Queue</TabsTrigger>
          <TabsTrigger value="logs" className="text-xs gap-1"><Activity className="w-3.5 h-3.5" /> Logs</TabsTrigger>
          <TabsTrigger value="analytics" className="text-xs gap-1"><BarChart3 className="w-3.5 h-3.5" /> Analytics</TabsTrigger>
        </TabsList>

        {/* ═══════════ DASHBOARD ═══════════ */}
        <TabsContent value="dashboard" className="space-y-4 mt-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: "Total Sent", value: stats.totalSent, icon: Send, color: "text-blue-400" },
              { label: "Active Devices", value: stats.totalDevices, icon: Smartphone, color: "text-emerald-400" },
              { label: "Open Rate", value: `${stats.openRate}%`, icon: Eye, color: "text-amber-400" },
              { label: "Click Rate", value: `${stats.clickRate}%`, icon: MousePointerClick, color: "text-purple-400" },
            ].map(s => (
              <Card key={s.label} className="bg-card/50 border-border/50">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-muted/50"><s.icon className={`w-5 h-5 ${s.color}`} /></div>
                  <div>
                    <p className="text-xs text-muted-foreground">{s.label}</p>
                    <p className="text-xl font-bold text-foreground">{s.value}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4 text-primary" /> Active Triggers</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {CATEGORIES.map(cat => {
                    const catTriggers = triggers.filter(t => t.category === cat.value);
                    const active = catTriggers.filter(t => t.is_enabled).length;
                    return (
                      <div key={cat.value} className="flex items-center justify-between py-1">
                        <span className="text-sm text-muted-foreground">{cat.icon} {cat.label}</span>
                        <Badge variant="outline" className={cat.color}>{active}/{catTriggers.length}</Badge>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4 text-primary" /> Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                <ScrollArea className="h-[250px]">
                  <div className="space-y-2">
                    {logs.slice(0, 10).map(l => (
                      <div key={l.id} className="flex items-center justify-between py-1.5 border-b border-border/30 last:border-0">
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{l.title}</p>
                          <p className="text-[10px] text-muted-foreground">{l.trigger_key || "direct"} · {format(new Date(l.created_at), "MMM d, HH:mm")}</p>
                        </div>
                        <Badge variant="outline" className={l.status === "sent" ? "text-emerald-400 border-emerald-500/30" : "text-red-400 border-red-500/30"}>
                          {l.status}
                        </Badge>
                      </div>
                    ))}
                    {logs.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No notifications sent yet</p>}
                  </div>
                </ScrollArea>
              </CardContent>
            </Card>
          </div>

          {/* Quick Actions */}
          <Card className="bg-card/50 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm">Quick Actions</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-wrap gap-2">
              <Button size="sm" variant="outline" onClick={processQueue}><Play className="w-3 h-3 mr-1" /> Process Queue</Button>
              <Button size="sm" variant="outline" onClick={() => setShowAnnouncement(true)}><Megaphone className="w-3 h-3 mr-1" /> Announcement</Button>
              <Button size="sm" variant="outline" onClick={() => { setTab("templates"); openNewTemplate(); }}><Plus className="w-3 h-3 mr-1" /> New Template</Button>
              <Button size="sm" variant="outline" onClick={fetchAll}><RefreshCw className="w-3 h-3 mr-1" /> Refresh Stats</Button>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ═══════════ TRIGGERS ═══════════ */}
        <TabsContent value="triggers" className="space-y-4 mt-4">
          <div className="flex flex-col sm:flex-row gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input placeholder="Search triggers..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 bg-muted/30" />
            </div>
            <Select value={catFilter} onValueChange={setCatFilter}>
              <SelectTrigger className="w-[180px] bg-muted/30"><Filter className="w-3 h-3 mr-1" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <ScrollArea className="h-[600px]">
            <div className="space-y-2">
              {filteredTriggers.map(t => {
                const cat = getCategoryStyle(t.category);
                return (
                  <Card key={t.id} className={`bg-card/50 border-border/50 ${!t.is_enabled ? "opacity-60" : ""}`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap mb-1">
                            <span className="text-sm font-semibold text-foreground">{t.display_name}</span>
                            <Badge className={`${cat.color} text-[10px]`}>{cat.icon} {cat.label}</Badge>
                            {t.use_ai_content && <Badge className="bg-purple-500/15 text-purple-400 text-[10px]">🤖 AI</Badge>}
                            <Badge variant="outline" className="text-[10px]">{t.priority}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground mb-2">{t.description}</p>
                          <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                            <span>Key: <code className="text-primary">{t.trigger_key}</code></span>
                            <span>Cooldown: {t.cooldown_minutes}m</span>
                            <span>Sent: {t.total_sent}</span>
                            <span>Schedule: {t.schedule_type}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => testTrigger(t.trigger_key)}>
                            <Play className="w-3 h-3 mr-1" /> Test
                          </Button>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground">AI</span>
                            <Switch checked={t.use_ai_content} onCheckedChange={v => toggleAI(t.id, v)} className="scale-75" />
                          </div>
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="text-[9px] text-muted-foreground">Active</span>
                            <Switch checked={t.is_enabled} onCheckedChange={v => toggleTrigger(t.id, v)} />
                          </div>
                        </div>
                      </div>
                      {/* Cooldown & Template Assignment Row */}
                      <div className="flex items-center gap-3 mt-3 pt-3 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Cooldown:</span>
                          <Select value={String(t.cooldown_minutes)} onValueChange={v => updateCooldown(t.id, Number(v))}>
                            <SelectTrigger className="h-6 w-20 text-[10px] bg-muted/30"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              {[0, 5, 15, 30, 60, 120, 240, 360, 720, 1440].map(m => (
                                <SelectItem key={m} value={String(m)}>{m === 0 ? "None" : m < 60 ? `${m}m` : `${m / 60}h`}</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-muted-foreground">Template:</span>
                          <Select value={t.template_id || "none"} onValueChange={v => assignTemplate(t.id, v === "none" ? null : v)}>
                            <SelectTrigger className="h-6 w-40 text-[10px] bg-muted/30"><SelectValue /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="none">AI Generated / Default</SelectItem>
                              {templates.map(tm => <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>)}
                            </SelectContent>
                          </Select>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* ═══════════ TEMPLATES ═══════════ */}
        <TabsContent value="templates" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{templates.length} templates</p>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => { setAiPurpose(""); setCustomPurpose(""); setShowAIPicker(true); }} className="border-primary/30 text-primary">
                <Sparkles className="w-4 h-4 mr-1" /> AI Create
              </Button>
              <Button size="sm" onClick={openNewTemplate}><Plus className="w-4 h-4 mr-1" /> Manual</Button>
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-3">
            {templates.map(t => (
              <Card key={t.id} className="bg-card/50 border-border/50">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h4 className="text-sm font-semibold text-foreground">{t.name}</h4>
                      <Badge className="text-[10px] mt-1">{t.category}</Badge>
                      {t.use_ai_personalization && <Badge className="bg-purple-500/15 text-purple-400 text-[10px] ml-1">AI Personalized</Badge>}
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => openEditTemplate(t)}><Pencil className="w-3 h-3" /></Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteTemplate(t.id)}><Trash2 className="w-3 h-3" /></Button>
                    </div>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3 space-y-1">
                    <p className="text-xs font-medium text-foreground">📌 {t.title_template}</p>
                    <p className="text-xs text-muted-foreground">{t.body_template}</p>
                  </div>
                  {t.variables?.length ? (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {t.variables.map(v => (
                        <Badge key={v} variant="outline" className="text-[9px]">{`{{${v}}}`}</Badge>
                      ))}
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            ))}
            {templates.length === 0 && (
              <Card className="bg-card/50 border-border/50 col-span-2">
                <CardContent className="py-12 text-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No templates yet. Create one or let AI generate content.</p>
                </CardContent>
              </Card>
            )}
          </div>
        </TabsContent>

        {/* ═══════════ QUEUE ═══════════ */}
        <TabsContent value="queue" className="space-y-4 mt-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">{queue.filter(q => q.status === "pending").length} pending</p>
            <Button size="sm" onClick={processQueue}><Play className="w-4 h-4 mr-1" /> Process Now</Button>
          </div>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow><TableHead className="text-xs">Title</TableHead><TableHead className="text-xs">Trigger</TableHead><TableHead className="text-xs">Status</TableHead><TableHead className="text-xs">Scheduled</TableHead><TableHead className="text-xs">Priority</TableHead></TableRow>
              </TableHeader>
              <TableBody>
                {queue.map(q => (
                  <TableRow key={q.id}>
                    <TableCell className="text-xs font-medium">{q.title}</TableCell>
                    <TableCell><code className="text-[10px] text-primary">{q.trigger_key || "direct"}</code></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={q.status === "pending" ? "text-amber-400" : q.status === "sent" ? "text-emerald-400" : "text-red-400"}>
                        {q.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(q.scheduled_at), "MMM d, HH:mm")}</TableCell>
                    <TableCell><Badge variant="outline" className="text-[10px]">{q.priority}</Badge></TableCell>
                  </TableRow>
                ))}
                {queue.length === 0 && (
                  <TableRow><TableCell colSpan={5} className="text-center text-sm text-muted-foreground py-8">Queue is empty</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        {/* ═══════════ LOGS ═══════════ */}
        <TabsContent value="logs" className="space-y-4 mt-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search logs..." value={searchQ} onChange={e => setSearchQ(e.target.value)} className="pl-9 bg-muted/30" />
          </div>
          <ScrollArea className="h-[500px]">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Title</TableHead>
                  <TableHead className="text-xs">Trigger</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs">Devices</TableHead>
                  <TableHead className="text-xs">AI</TableHead>
                  <TableHead className="text-xs">Time</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLogs.map(l => (
                  <TableRow key={l.id}>
                    <TableCell className="text-xs font-medium max-w-[200px] truncate">{l.title}</TableCell>
                    <TableCell><code className="text-[10px] text-primary">{l.trigger_key || "direct"}</code></TableCell>
                    <TableCell>
                      <Badge variant="outline" className={l.status === "sent" ? "text-emerald-400" : "text-red-400"}>
                        {l.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">{l.device_count}</TableCell>
                    <TableCell>{l.ai_generated && <Badge className="bg-purple-500/15 text-purple-400 text-[9px]">AI</Badge>}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{format(new Date(l.created_at), "MMM d, HH:mm")}</TableCell>
                  </TableRow>
                ))}
                {filteredLogs.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-sm text-muted-foreground py-8">No logs found</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </TabsContent>

        {/* ═══════════ ANALYTICS ═══════════ */}
        <TabsContent value="analytics" className="space-y-4 mt-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-sm">Trigger Performance</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {triggers.filter(t => t.total_sent > 0).sort((a, b) => b.total_sent - a.total_sent).slice(0, 10).map(t => {
                    const cat = getCategoryStyle(t.category);
                    const openRate = t.total_sent > 0 ? Math.round((t.total_opened / t.total_sent) * 100) : 0;
                    return (
                      <div key={t.id}>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-foreground font-medium">{cat.icon} {t.display_name}</span>
                          <span className="text-muted-foreground">{t.total_sent} sent · {openRate}% open</span>
                        </div>
                        <Progress value={openRate} className="h-1.5" />
                      </div>
                    );
                  })}
                  {triggers.filter(t => t.total_sent > 0).length === 0 && (
                    <p className="text-xs text-muted-foreground text-center py-4">No data yet. Send notifications to see analytics.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="bg-card/50 border-border/50">
              <CardHeader><CardTitle className="text-sm">Category Breakdown</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {CATEGORIES.map(cat => {
                    const catTriggers = triggers.filter(t => t.category === cat.value);
                    const totalSent = catTriggers.reduce((s, t) => s + (t.total_sent || 0), 0);
                    const totalOpened = catTriggers.reduce((s, t) => s + (t.total_opened || 0), 0);
                    const openRate = totalSent > 0 ? Math.round((totalOpened / totalSent) * 100) : 0;
                    return (
                      <div key={cat.value} className="flex items-center justify-between py-1">
                        <span className="text-xs">{cat.icon} {cat.label}</span>
                        <div className="flex items-center gap-3">
                          <span className="text-[10px] text-muted-foreground">{totalSent} sent</span>
                          <Badge variant="outline" className={`text-[10px] ${cat.color}`}>{openRate}%</Badge>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-card/50 border-border/50">
            <CardHeader><CardTitle className="text-sm">System Health</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{triggers.filter(t => t.is_enabled).length}</p>
                  <p className="text-xs text-muted-foreground">Active Triggers</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{templates.length}</p>
                  <p className="text-xs text-muted-foreground">Templates</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{queue.filter(q => q.status === "pending").length}</p>
                  <p className="text-xs text-muted-foreground">Queued</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-foreground">{triggers.filter(t => t.use_ai_content).length}</p>
                  <p className="text-xs text-muted-foreground">AI-Enabled</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* ═══════════ TEMPLATE DIALOG ═══════════ */}
      <Dialog open={showTemplateDialog} onOpenChange={setShowTemplateDialog}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle>{editTemplate ? "Edit Template" : "Create Template"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Template Name</label>
              <Input value={templateForm.name} onChange={e => setTemplateForm(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Memory Risk Alert" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Title Template</label>
              <Input value={templateForm.title_template} onChange={e => setTemplateForm(p => ({ ...p, title_template: e.target.value }))} placeholder="e.g. ⚠️ Memory Risk: {{topic_name}}" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Body Template</label>
              <Textarea value={templateForm.body_template} onChange={e => setTemplateForm(p => ({ ...p, body_template: e.target.value }))} placeholder="e.g. Hey {{user_name}}, your memory for {{topic_name}} is dropping..." className="mt-1" rows={3} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={templateForm.category} onValueChange={v => setTemplateForm(p => ({ ...p, category: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>{CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-xs text-muted-foreground">Priority</label>
                <Select value={templateForm.priority} onValueChange={v => setTemplateForm(p => ({ ...p, priority: v }))}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="high">High</SelectItem>
                    <SelectItem value="urgent">Urgent</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Variables (comma-separated)</label>
              <Input value={templateForm.variables} onChange={e => setTemplateForm(p => ({ ...p, variables: e.target.value }))} placeholder="user_name, topic_name, score" className="mt-1" />
            </div>
            <div className="flex items-center gap-2">
              <Switch checked={templateForm.use_ai_personalization} onCheckedChange={v => setTemplateForm(p => ({ ...p, use_ai_personalization: v }))} />
              <span className="text-xs text-muted-foreground">Enable AI personalization</span>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowTemplateDialog(false)}>Cancel</Button>
            <Button onClick={saveTemplate} disabled={!templateForm.name || !templateForm.title_template}>
              {editTemplate ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ ANNOUNCEMENT DIALOG ═══════════ */}
      <Dialog open={showAnnouncement} onOpenChange={setShowAnnouncement}>
        <DialogContent className="max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Megaphone className="w-5 h-5 text-primary" /> Send Announcement</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-muted-foreground">Title</label>
              <Input value={announcementForm.title} onChange={e => setAnnouncementForm(p => ({ ...p, title: e.target.value }))} placeholder="e.g. 🎉 New Feature Released!" className="mt-1" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Body</label>
              <Textarea value={announcementForm.body} onChange={e => setAnnouncementForm(p => ({ ...p, body: e.target.value }))} placeholder="Notification body text..." className="mt-1" rows={3} />
            </div>
            <Card className="bg-muted/30 border-border/30">
              <CardContent className="p-3">
                <p className="text-xs text-muted-foreground mb-1">Preview:</p>
                <div className="bg-background rounded-lg p-3 border border-border/50">
                  <p className="text-sm font-semibold text-foreground">{announcementForm.title || "Title"}</p>
                  <p className="text-xs text-muted-foreground">{announcementForm.body || "Body text"}</p>
                </div>
              </CardContent>
            </Card>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAnnouncement(false)}>Cancel</Button>
            <Button onClick={sendAnnouncement} disabled={sending || !announcementForm.title}>
              {sending ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Sending...</> : <><Send className="w-4 h-4 mr-1" /> Send to All Users</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ═══════════ AI TEMPLATE PICKER ═══════════ */}
      <Dialog open={showAIPicker} onOpenChange={setShowAIPicker}>
        <DialogContent className="max-w-lg bg-card max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Sparkles className="w-5 h-5 text-primary" /> AI Template Generator</DialogTitle>
            <CardDescription>Select a purpose and AI will generate a complete push notification template</CardDescription>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-6 px-6">
            <div className="space-y-4">
              <div>
                <label className="text-xs text-muted-foreground mb-2 block">Select Purpose</label>
                <div className="grid grid-cols-2 gap-2">
                  {AI_PURPOSES.map(p => (
                    <button
                      key={p.value}
                      onClick={() => setAiPurpose(p.value)}
                      className={`p-2.5 rounded-lg border text-left transition-all ${
                        aiPurpose === p.value
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border/50 bg-muted/20 hover:border-primary/30"
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
                  <label className="text-xs text-muted-foreground">Describe your purpose</label>
                  <Input
                    value={customPurpose}
                    onChange={e => setCustomPurpose(e.target.value)}
                    placeholder="e.g. Congratulate user on completing 100 study sessions"
                    className="mt-1"
                  />
                </div>
              )}

              <div>
                <label className="text-xs text-muted-foreground">Category</label>
                <Select value={aiCategory} onValueChange={setAiCategory}>
                  <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => <SelectItem key={c.value} value={c.value}>{c.icon} {c.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </ScrollArea>
          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setShowAIPicker(false)}>Cancel</Button>
            <Button
              onClick={generateAITemplate}
              disabled={aiGenerating || !aiPurpose || (aiPurpose === "custom" && !customPurpose)}
              className="bg-primary text-primary-foreground"
            >
              {aiGenerating ? <><Loader2 className="w-4 h-4 mr-1 animate-spin" /> Generating...</> : <><Sparkles className="w-4 h-4 mr-1" /> Generate Template</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PushNotificationManagement;
