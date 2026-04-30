import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Bell, Send, Calendar, Users, Settings, Activity, FileText, Layers, Zap, Search } from "lucide-react";
import {
  getOneSignalLastError,
  getOneSignalSubscription,
  initOneSignal,
  optInPush,
  registerPlayerWithBackend,
  requestPushPermission,
  setOneSignalUser,
} from "@/lib/onesignal";

type Catalog = { id: string; event_key: string; category: string; display_name: string; description: string; priority: string };
type Rule = { id: string; event_key: string; enabled: boolean; respect_quiet_hours: boolean; throttle_per_user_per_day: number; cooldown_minutes: number; escalate_to_email: boolean; ab_test_enabled: boolean };
type Tmpl = { id: string; event_key: string; variant: string; title: string; body: string; is_active: boolean; weight: number; deep_link?: string };
type Campaign = { id: string; name: string; title: string; body: string; status: string; scheduled_at?: string; sent_at?: string; created_at: string };
type Delivery = { id: string; event_key?: string; user_id?: string; status: string; title?: string; body?: string; created_at: string; error?: string; suppression_reason?: string };

const CATEGORY_COLORS: Record<string, string> = {
  study: "bg-cyan-500/15 text-cyan-300",
  exam: "bg-purple-500/15 text-purple-300",
  growth: "bg-emerald-500/15 text-emerald-300",
  social: "bg-pink-500/15 text-pink-300",
  system: "bg-slate-500/15 text-slate-300",
};

const PushNotificationManagement = () => {
  const { toast } = useToast();
  const [tab, setTab] = useState("dashboard");
  const [catalog, setCatalog] = useState<Catalog[]>([]);
  const [rules, setRules] = useState<Record<string, Rule>>({});
  const [templates, setTemplates] = useState<Tmpl[]>([]);
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [stats, setStats] = useState({ sent: 0, delivered: 0, clicked: 0, failed: 0, suppressed: 0 });

  // AI Announcement form
  const [aiIntent, setAiIntent] = useState("");
  const [aiTone, setAiTone] = useState("motivating");
  const [aiSchedule, setAiSchedule] = useState("");
  const [aiPreview, setAiPreview] = useState<{ title: string; body: string; deep_link: string } | null>(null);
  const [aiBusy, setAiBusy] = useState<"idle" | "preview" | "send">("idle");

  const loadAll = async () => {
    setLoading(true);
    const [c, r, t, ca, d] = await Promise.all([
      supabase.from("push_event_catalog" as any).select("*").order("category").order("display_name"),
      supabase.from("push_automation_rules" as any).select("*"),
      supabase.from("push_templates" as any).select("*").order("created_at", { ascending: false }),
      supabase.from("push_campaigns" as any).select("*").order("created_at", { ascending: false }).limit(50),
      supabase.from("push_deliveries" as any).select("*").order("created_at", { ascending: false }).limit(200),
    ]);
    setCatalog((c.data as any) || []);
    const ruleMap: Record<string, Rule> = {};
    ((r.data as any) || []).forEach((x: Rule) => { ruleMap[x.event_key] = x; });
    setRules(ruleMap);
    setTemplates((t.data as any) || []);
    setCampaigns((ca.data as any) || []);
    const deliv = (d.data as any) || [];
    setDeliveries(deliv);
    const s = { sent: 0, delivered: 0, clicked: 0, failed: 0, suppressed: 0 };
    deliv.forEach((x: Delivery) => { (s as any)[x.status] = ((s as any)[x.status] || 0) + 1; });
    setStats(s);
    setLoading(false);
  };

  useEffect(() => { loadAll(); }, []);

  const filteredCatalog = useMemo(
    () => catalog.filter(c => !search || c.event_key.includes(search) || c.display_name.toLowerCase().includes(search.toLowerCase())),
    [catalog, search]
  );

  const toggleRule = async (eventKey: string, field: keyof Rule, value: any) => {
    const existing = rules[eventKey];
    const payload: any = { event_key: eventKey, ...existing, [field]: value };
    delete payload.id;
    const { data, error } = await supabase.from("push_automation_rules" as any).upsert(payload, { onConflict: "event_key" }).select().single();
    if (error) return toast({ title: "Update failed", description: error.message, variant: "destructive" });
    setRules({ ...rules, [eventKey]: data as any });
    toast({ title: "Saved" });
  };

  const runAIAnnouncement = async (mode: "preview" | "send") => {
    setAiBusy(mode);
    try {
      const { data, error } = await supabase.functions.invoke("ai-announcement", {
        body: {
          intent: aiIntent || undefined,
          tone: aiTone,
          send: mode === "send" && !aiSchedule,
          scheduled_at: aiSchedule ? new Date(aiSchedule).toISOString() : null,
        },
      });
      if (error) throw error;
      const r = data as any;
      if (r?.error) throw new Error(r.error);
      setAiPreview({ title: r.title, body: r.body, deep_link: r.deep_link });
      if (r.scheduled) {
        toast({ title: "📅 Scheduled", description: `${r.title}` });
        setAiIntent(""); setAiSchedule("");
        loadAll();
      } else if (r.sent) {
        toast({ title: "🚀 Announcement sent", description: r.title });
        setAiIntent("");
        loadAll();
      } else {
        toast({ title: "🤖 AI draft ready", description: "Review below, then send." });
      }
    } catch (e: any) {
      toast({ title: "AI announcement failed", description: e.message, variant: "destructive" });
    } finally {
      setAiBusy("idle");
    }
  };

  const sendTest = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const initialized = await initOneSignal();
    if (!initialized) {
      return toast({ title: "Push setup incomplete", description: getOneSignalLastError() || "OneSignal could not initialize for this domain.", variant: "destructive" });
    }

    // Permission first — without it, no player ID is created
    const granted = typeof Notification !== "undefined" && Notification.permission === "granted"
      ? true
      : await requestPushPermission();
    if (!granted) {
      return toast({ title: "Notifications blocked", description: "Allow notifications in this browser, then try Send Test again.", variant: "destructive" });
    }

    await optInPush();
    const sub = await getOneSignalSubscription();
    if (!sub.playerId) {
      return toast({ title: "Device not registered", description: getOneSignalLastError() || "OneSignal did not return a browser subscription ID yet. Try again after a few seconds.", variant: "destructive" });
    }
    await registerPlayerWithBackend(sub.playerId);

    // Link external_id AFTER subscription exists — non-fatal if it fails
    setOneSignalUser(user.id).catch(() => { /* non-blocking */ });

    // Target by player_id directly — most reliable path, doesn't depend on alias linking
    const { data, error } = await supabase.functions.invoke("onesignal-dispatch", {
      body: {
        action: "send_to_user",
        user_id: user.id,
        player_ids: [sub.playerId],
        title: "🧪 Test Notification",
        body: "Your OneSignal command center is live!",
        deep_link: "/app",
      },
    });
    const result = data as any;
    if (error || result?.error || !result?.id) {
      return toast({
        title: "Test not sent",
        description: error?.message || result?.error || "No registered browser device found. Enable Web Push for this OneSignal app/domain first, then allow notifications.",
        variant: "destructive",
      });
    }
    toast({ title: "✅ Test sent", description: "Check your device." });
  };

  const triggerEvent = async (eventKey: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase.functions.invoke("onesignal-dispatch", {
      body: { action: "send_event", event_key: eventKey, user_id: user.id, data: { test: true } },
    });
    if (error) return toast({ title: "Trigger failed", description: error.message, variant: "destructive" });
    toast({ title: `Fired: ${eventKey}` });
    setTimeout(loadAll, 800);
  };

  const grouped = useMemo(() => {
    const g: Record<string, Catalog[]> = {};
    filteredCatalog.forEach(c => { (g[c.category] ||= []).push(c); });
    return g;
  }, [filteredCatalog]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2"><Bell className="w-5 h-5 text-primary" /> Push Notification Command Center</h2>
          <p className="text-xs text-muted-foreground">OneSignal · {catalog.length} automated triggers · Fully autonomous</p>
        </div>
        <Button size="sm" variant="outline" onClick={sendTest}><Zap className="w-3.5 h-3.5 mr-1.5" /> Send Test</Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-2">
        {[
          { k: "sent", label: "Sent", color: "text-cyan-400" },
          { k: "delivered", label: "Delivered", color: "text-emerald-400" },
          { k: "clicked", label: "Clicked", color: "text-purple-400" },
          { k: "failed", label: "Failed", color: "text-rose-400" },
          { k: "suppressed", label: "Suppressed", color: "text-amber-400" },
        ].map(s => (
          <motion.div key={s.k} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-3 neural-border">
            <div className={`text-2xl font-bold ${s.color}`}>{(stats as any)[s.k] ?? 0}</div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
          </motion.div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid grid-cols-6 w-full">
          <TabsTrigger value="dashboard"><Activity className="w-3.5 h-3.5 mr-1" />Live</TabsTrigger>
          <TabsTrigger value="automations"><Zap className="w-3.5 h-3.5 mr-1" />Triggers</TabsTrigger>
          <TabsTrigger value="templates"><FileText className="w-3.5 h-3.5 mr-1" />Templates</TabsTrigger>
          <TabsTrigger value="broadcast"><Send className="w-3.5 h-3.5 mr-1" />Broadcast</TabsTrigger>
          <TabsTrigger value="campaigns"><Calendar className="w-3.5 h-3.5 mr-1" />Campaigns</TabsTrigger>
          <TabsTrigger value="logs"><Layers className="w-3.5 h-3.5 mr-1" />Logs</TabsTrigger>
        </TabsList>

        {/* DASHBOARD */}
        <TabsContent value="dashboard" className="space-y-3 mt-4">
          <div className="glass rounded-xl p-4 neural-border">
            <h3 className="text-sm font-semibold mb-2 flex items-center gap-2"><Users className="w-4 h-4" /> Recent Activity</h3>
            <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
              {deliveries.slice(0, 30).map(d => (
                <div key={d.id} className="flex items-center justify-between text-xs py-2 border-b border-border/40">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{d.title || d.event_key || "—"}</div>
                    <div className="text-muted-foreground text-[10px]">{d.event_key} · {new Date(d.created_at).toLocaleString()}</div>
                  </div>
                  <Badge variant="outline" className={`text-[10px] ${
                    d.status === "sent" || d.status === "delivered" ? "text-emerald-400" :
                    d.status === "clicked" ? "text-purple-400" :
                    d.status === "failed" ? "text-rose-400" : "text-amber-400"
                  }`}>{d.status}</Badge>
                </div>
              ))}
              {!deliveries.length && <p className="text-xs text-muted-foreground py-6 text-center">No deliveries yet — send a test or trigger an event.</p>}
            </div>
          </div>
        </TabsContent>

        {/* AUTOMATIONS */}
        <TabsContent value="automations" className="space-y-3 mt-4">
          <div className="flex items-center gap-2">
            <Search className="w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search triggers…" value={search} onChange={e => setSearch(e.target.value)} className="h-8" />
          </div>
          {Object.entries(grouped).map(([cat, items]) => (
            <div key={cat} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center justify-between mb-2">
                <Badge className={CATEGORY_COLORS[cat] || ""}>{cat.toUpperCase()}</Badge>
                <span className="text-[10px] text-muted-foreground">{items.length} triggers</span>
              </div>
              <div className="space-y-2">
                {items.map(c => {
                  const r = rules[c.event_key];
                  return (
                    <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg bg-background/40">
                      <Switch checked={r?.enabled ?? true} onCheckedChange={v => toggleRule(c.event_key, "enabled", v)} />
                      <div className="flex-1 min-w-0">
                        <div className="text-xs font-medium truncate">{c.display_name}</div>
                        <div className="text-[10px] text-muted-foreground truncate">{c.event_key} · {c.description}</div>
                      </div>
                      <Input
                        type="number" min={1} max={50}
                        value={r?.throttle_per_user_per_day ?? 5}
                        onChange={e => toggleRule(c.event_key, "throttle_per_user_per_day", parseInt(e.target.value || "5"))}
                        className="h-7 w-14 text-xs"
                        title="Daily cap per user"
                      />
                      <Button size="sm" variant="ghost" className="h-7 px-2 text-[10px]" onClick={() => triggerEvent(c.event_key)}>Fire</Button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </TabsContent>

        {/* TEMPLATES */}
        <TabsContent value="templates" className="space-y-3 mt-4">
          <TemplatesEditor catalog={catalog} templates={templates} onChange={loadAll} />
        </TabsContent>

        {/* BROADCAST — AI AUTOMATED */}
        <TabsContent value="broadcast" className="space-y-3 mt-4">
          <div className="glass rounded-xl p-4 neural-border space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <Zap className="w-4 h-4 text-cyan-400" />
              <h3 className="text-sm font-semibold">AI Announcement Composer</h3>
              <Badge className="bg-cyan-500/15 text-cyan-300 text-[10px]">FULLY AUTOMATED</Badge>
            </div>
            <p className="text-[11px] text-muted-foreground -mt-1">
              No manual writing. AI crafts the perfect title, body & deep link, then broadcasts to every subscribed user.
            </p>

            <div>
              <Label className="text-xs">Intent (optional)</Label>
              <Textarea
                value={aiIntent}
                onChange={e => setAiIntent(e.target.value)}
                rows={2}
                placeholder={`e.g. "remind everyone about today's mock test" — or leave blank to let AI auto-pick`}
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-xs">Tone</Label>
                <select
                  value={aiTone}
                  onChange={e => setAiTone(e.target.value)}
                  className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="motivating">🔥 Motivating</option>
                  <option value="urgent">⚡ Urgent</option>
                  <option value="celebratory">🎉 Celebratory</option>
                  <option value="friendly">💬 Friendly</option>
                  <option value="exam-focused">📚 Exam-Focused</option>
                </select>
              </div>
              <div>
                <Label className="text-xs">Schedule (optional)</Label>
                <Input type="datetime-local" value={aiSchedule} onChange={e => setAiSchedule(e.target.value)} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => runAIAnnouncement("preview")}
                disabled={aiBusy !== "idle"}
              >
                <FileText className="w-4 h-4 mr-2" />
                {aiBusy === "preview" ? "Drafting…" : "AI Draft Preview"}
              </Button>
              <Button
                onClick={() => runAIAnnouncement("send")}
                disabled={aiBusy !== "idle"}
                className="bg-gradient-to-r from-cyan-500 to-purple-500"
              >
                <Send className="w-4 h-4 mr-2" />
                {aiBusy === "send" ? "Sending…" : aiSchedule ? "AI Generate & Schedule" : "AI Generate & Send"}
              </Button>
            </div>

            {aiPreview && (
              <div className="rounded-lg bg-background/60 border border-cyan-500/20 p-3 space-y-1">
                <div className="text-[10px] text-cyan-400 uppercase tracking-wide">Last AI Draft</div>
                <div className="text-sm font-semibold">{aiPreview.title}</div>
                <div className="text-xs text-muted-foreground">{aiPreview.body}</div>
                <div className="text-[10px] text-muted-foreground">→ {aiPreview.deep_link}</div>
              </div>
            )}

            <p className="text-[10px] text-muted-foreground">
              Goes to all subscribed users. Scheduled announcements fire via cron every 15 min.
            </p>
          </div>
        </TabsContent>

        {/* CAMPAIGNS */}
        <TabsContent value="campaigns" className="space-y-3 mt-4">
          <div className="glass rounded-xl p-3 neural-border">
            <div className="space-y-2 max-h-[500px] overflow-y-auto">
              {campaigns.map(c => (
                <div key={c.id} className="p-3 rounded-lg bg-background/40 flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium truncate">{c.name}</div>
                    <div className="text-xs text-muted-foreground truncate">{c.body}</div>
                    <div className="text-[10px] text-muted-foreground mt-1">
                      {c.scheduled_at ? `📅 ${new Date(c.scheduled_at).toLocaleString()}` : ""}
                      {c.sent_at ? ` · Sent ${new Date(c.sent_at).toLocaleString()}` : ""}
                    </div>
                  </div>
                  <Badge variant="outline" className={
                    c.status === "sent" ? "text-emerald-400" :
                    c.status === "scheduled" ? "text-cyan-400" :
                    c.status === "failed" ? "text-rose-400" : "text-muted-foreground"
                  }>{c.status}</Badge>
                </div>
              ))}
              {!campaigns.length && <p className="text-xs text-muted-foreground py-6 text-center">No campaigns yet.</p>}
            </div>
          </div>
        </TabsContent>

        {/* LOGS */}
        <TabsContent value="logs" className="mt-4">
          <div className="glass rounded-xl p-3 neural-border">
            <div className="space-y-1 max-h-[600px] overflow-y-auto text-xs font-mono">
              {deliveries.map(d => (
                <div key={d.id} className="py-1.5 border-b border-border/40">
                  <div className="flex items-center gap-2">
                    <span className={
                      d.status === "sent" || d.status === "delivered" ? "text-emerald-400" :
                      d.status === "clicked" ? "text-purple-400" :
                      d.status === "failed" ? "text-rose-400" : "text-amber-400"
                    }>● {d.status}</span>
                    <span className="text-muted-foreground">{new Date(d.created_at).toLocaleTimeString()}</span>
                    <span className="text-foreground">{d.event_key || "broadcast"}</span>
                  </div>
                  <div className="text-muted-foreground truncate">{d.title}</div>
                  {(d.error || d.suppression_reason) && <div className="text-rose-400/80">{d.error || d.suppression_reason}</div>}
                </div>
              ))}
              {!deliveries.length && <p className="text-xs text-muted-foreground py-6 text-center">No logs.</p>}
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {loading && <p className="text-center text-xs text-muted-foreground">Loading…</p>}
    </div>
  );
};

const TemplatesEditor = ({ catalog, templates, onChange }: { catalog: Catalog[]; templates: Tmpl[]; onChange: () => void }) => {
  const { toast } = useToast();
  const [eventKey, setEventKey] = useState("");
  const [variant, setVariant] = useState("A");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [deep, setDeep] = useState("");

  const save = async () => {
    if (!eventKey || !title || !body) return toast({ title: "Pick event + title + body", variant: "destructive" });
    const { error } = await supabase.from("push_templates" as any).insert({
      event_key: eventKey, variant, title, body, deep_link: deep || null, is_active: true, weight: 50,
    });
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Template saved" });
    setTitle(""); setBody(""); setDeep("");
    onChange();
  };

  const remove = async (id: string) => {
    await supabase.from("push_templates" as any).delete().eq("id", id);
    onChange();
  };

  const toggleActive = async (id: string, v: boolean) => {
    await supabase.from("push_templates" as any).update({ is_active: v }).eq("id", id);
    onChange();
  };

  return (
    <>
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h3 className="text-sm font-semibold">New Template</h3>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <Label className="text-xs">Event</Label>
            <select value={eventKey} onChange={e => setEventKey(e.target.value)} className="w-full h-9 rounded-md bg-background border border-border px-2 text-xs">
              <option value="">Select…</option>
              {catalog.map(c => <option key={c.id} value={c.event_key}>{c.display_name} ({c.event_key})</option>)}
            </select>
          </div>
          <div>
            <Label className="text-xs">Variant</Label>
            <Input value={variant} onChange={e => setVariant(e.target.value)} placeholder="A" />
          </div>
        </div>
        <div>
          <Label className="text-xs">Title (use {`{{var}}`} for dynamic)</Label>
          <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="🔥 Streak {{streak}} days!" />
        </div>
        <div>
          <Label className="text-xs">Body</Label>
          <Textarea value={body} onChange={e => setBody(e.target.value)} rows={2} />
        </div>
        <div>
          <Label className="text-xs">Deep link</Label>
          <Input value={deep} onChange={e => setDeep(e.target.value)} placeholder="/app" />
        </div>
        <Button onClick={save} className="w-full">Save Template</Button>
      </div>

      <div className="glass rounded-xl p-3 neural-border">
        <h3 className="text-sm font-semibold mb-2">Existing Templates ({templates.length})</h3>
        <div className="space-y-2 max-h-[400px] overflow-y-auto">
          {templates.map(t => (
            <div key={t.id} className="p-2 rounded-lg bg-background/40 flex items-start gap-2">
              <Switch checked={t.is_active} onCheckedChange={v => toggleActive(t.id, v)} />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium">{t.title}</div>
                <div className="text-[10px] text-muted-foreground truncate">{t.body}</div>
                <div className="text-[10px] text-primary">{t.event_key} · variant {t.variant} · weight {t.weight}</div>
              </div>
              <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => remove(t.id)}>Delete</Button>
            </div>
          ))}
          {!templates.length && <p className="text-xs text-muted-foreground py-4 text-center">No templates yet — defaults will use event key.</p>}
        </div>
      </div>
    </>
  );
};

export default PushNotificationManagement;
