// SMS Alerts Center — Ultra-advanced control panel for transactional SMS via MSG91
// Tabs: Overview · Live Feed · Templates · Broadcast · Schedule · Quota · Logs · Settings
import { useState, useEffect, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Smartphone, Send, Activity, FileText, Megaphone, Clock, BarChart3, Settings,
  CheckCircle2, XCircle, AlertTriangle, RefreshCw, Loader2, Zap, Shield,
  Users, Plus, Pencil, Eye, Sparkles, TrendingUp, Radio, Gauge, Link as LinkIcon, ExternalLink, Copy, Check,
} from "lucide-react";
import { format } from "date-fns";

type Tab = "overview" | "feed" | "templates" | "broadcast" | "schedule" | "quota" | "logs" | "settings";

const TABS: { key: Tab; label: string; icon: any }[] = [
  { key: "overview", label: "Overview", icon: BarChart3 },
  { key: "feed", label: "Live Feed", icon: Radio },
  { key: "templates", label: "Templates", icon: FileText },
  { key: "broadcast", label: "Broadcast", icon: Megaphone },
  { key: "schedule", label: "Schedule", icon: Clock },
  { key: "quota", label: "Quota", icon: Gauge },
  { key: "logs", label: "Logs", icon: Activity },
  { key: "settings", label: "Settings", icon: Settings },
];

// ─── Overview ───
function Overview() {
  const [stats, setStats] = useState({ total: 0, sent: 0, failed: 0, blocked: 0, today: 0, deliveryRate: 0, byCategory: {} as Record<string, number> });
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("sms_messages").select("status, category, created_at").limit(5000);
    const today = new Date().toISOString().slice(0, 10);
    const arr = data || [];
    const sent = arr.filter(m => m.status === "sent").length;
    const failed = arr.filter(m => m.status === "failed").length;
    const blocked = arr.filter(m => m.status === "blocked_quota").length;
    const todayCount = arr.filter(m => m.created_at?.startsWith(today)).length;
    const byCat: Record<string, number> = {};
    arr.forEach(m => { if (m.category) byCat[m.category] = (byCat[m.category] || 0) + 1; });
    setStats({
      total: arr.length, sent, failed, blocked, today: todayCount,
      deliveryRate: arr.length ? Math.round((sent / arr.length) * 100) : 0,
      byCategory: byCat,
    });
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const cards = [
    { label: "Total SMS", value: stats.total, icon: Send, color: "text-primary", bg: "bg-primary/10" },
    { label: "Delivered", value: stats.sent, icon: CheckCircle2, color: "text-emerald-400", bg: "bg-emerald-500/10" },
    { label: "Failed", value: stats.failed, icon: XCircle, color: "text-destructive", bg: "bg-destructive/10" },
    { label: "Quota Blocked", value: stats.blocked, icon: Shield, color: "text-amber-400", bg: "bg-amber-500/10" },
    { label: "Today", value: stats.today, icon: Clock, color: "text-cyan-400", bg: "bg-cyan-500/10" },
    { label: "Delivery Rate", value: `${stats.deliveryRate}%`, icon: TrendingUp, color: "text-violet-400", bg: "bg-violet-500/10" },
  ];

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-base font-bold text-foreground">SMS Performance Overview</h3>
        <Button size="sm" variant="outline" onClick={load} disabled={loading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${loading ? "animate-spin" : ""}`} /> Refresh
        </Button>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        {cards.map((c, i) => (
          <motion.div key={c.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <div className={`w-9 h-9 rounded-lg ${c.bg} flex items-center justify-center`}>
                    <c.icon className={`w-4 h-4 ${c.color}`} />
                  </div>
                </div>
                <div className="text-2xl font-bold text-foreground">{c.value}</div>
                <div className="text-xs text-muted-foreground">{c.label}</div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">By Category</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {Object.entries(stats.byCategory).length === 0 && <div className="text-xs text-muted-foreground">No data yet.</div>}
          {Object.entries(stats.byCategory).map(([cat, n]) => (
            <div key={cat} className="flex items-center gap-3">
              <Badge variant="outline" className="capitalize w-32 justify-start">{cat}</Badge>
              <Progress value={(n / Math.max(stats.total, 1)) * 100} className="flex-1 h-2" />
              <span className="text-xs font-medium text-foreground w-10 text-right">{n}</span>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Live Feed ───
function LiveFeed() {
  const [rows, setRows] = useState<any[]>([]);
  const load = useCallback(async () => {
    const { data } = await supabase.from("sms_messages")
      .select("*").order("created_at", { ascending: false }).limit(50);
    setRows(data || []);
  }, []);
  useEffect(() => {
    load();
    const ch = supabase.channel("sms_feed")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "sms_messages" },
        (p) => setRows(r => [p.new, ...r].slice(0, 50)))
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [load]);

  const statusColor = (s: string) =>
    s === "sent" ? "bg-emerald-500/15 text-emerald-400" :
    s === "failed" ? "bg-destructive/15 text-destructive" :
    s === "blocked_quota" ? "bg-amber-500/15 text-amber-400" :
    "bg-secondary text-muted-foreground";

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Radio className="w-4 h-4 text-emerald-400 animate-pulse" /> Live SMS Stream</CardTitle>
        <Badge variant="outline">{rows.length} recent</Badge>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[500px] overflow-auto">
        {rows.length === 0 && <div className="text-xs text-muted-foreground py-8 text-center">No SMS sent yet.</div>}
        {rows.map(r => (
          <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-lg hover:bg-secondary/50 transition-colors">
            <Badge className={`text-[10px] uppercase ${statusColor(r.status)}`}>{r.status}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-foreground">{r.to_number}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{r.message_body}</div>
            </div>
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">
              {format(new Date(r.created_at), "HH:mm:ss")}
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Bulk DLT Editor ───
function BulkDltEditor({ open, onClose, list, onSaved }: { open: boolean; onClose: () => void; list: any[]; onSaved: () => void }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<Record<string, { dlt_template_id: string; body_template: string; sender_id: string }>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [filter, setFilter] = useState<"all" | "missing">("missing");
  const [testPhone, setTestPhone] = useState<string>(() => localStorage.getItem("sms_test_phone") || "");
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<Record<string, { ok: boolean; msg: string }>>({});

  const sendTest = async (t: any) => {
    if (!testPhone || testPhone.replace(/\D/g, "").length < 10) {
      toast({ title: "Enter test phone first", description: "10-digit Indian mobile or with country code", variant: "destructive" });
      return;
    }
    localStorage.setItem("sms_test_phone", testPhone);
    setTesting(t.id);
    setTestResult((p) => ({ ...p, [t.id]: { ok: false, msg: "Sending..." } }));
    try {
      const sampleVars: Record<string, string> = {
        name: "Test User", title: "ACRY Test", body: "Test message",
        link: t.target_url || "https://acry.ai", otp: "123456",
        rank: "42", percentile: "95", streak: "7", days: "30", topic: "Sample Topic",
      };
      const { data, error } = await supabase.functions.invoke("sms-notify", {
        body: {
          action: "send",
          mobile: testPhone,
          template_name: t.name,
          variables: sampleVars,
          source: "admin_test",
        },
      });
      if (error) throw error;
      const ok = !!data?.ok;
      const msg = data?.reason || data?.status || (ok ? "Sent ✓" : "Failed");
      setTestResult((p) => ({ ...p, [t.id]: { ok, msg } }));
      toast({
        title: ok ? "✅ Test SMS sent" : "❌ Test failed",
        description: `${t.display_name}: ${msg}`,
        variant: ok ? "default" : "destructive",
      });
    } catch (e: any) {
      const msg = e?.message || "Network error";
      setTestResult((p) => ({ ...p, [t.id]: { ok: false, msg } }));
      toast({ title: "Test failed", description: msg, variant: "destructive" });
    } finally {
      setTesting(null);
    }
  };

  useEffect(() => {
    if (!open) return;
    const init: Record<string, any> = {};
    list.forEach((t) => {
      init[t.id] = {
        dlt_template_id: t.dlt_template_id || "",
        body_template: t.body_template || "",
        sender_id: t.sender_id || "",
      };
    });
    setRows(init);
  }, [open, list]);

  const filtered = useMemo(() => {
    if (filter === "missing") return list.filter((t) => !t.dlt_template_id);
    return list;
  }, [list, filter]);

  const saveOne = async (id: string) => {
    setSaving(id);
    const r = rows[id];
    const { error } = await supabase
      .from("sms_templates")
      .update({
        dlt_template_id: r.dlt_template_id.trim() || null,
        body_template: r.body_template,
        sender_id: r.sender_id.trim() || null,
      })
      .eq("id", id);
    setSaving(null);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Saved" }); onSaved(); }
  };

  const saveAll = async () => {
    setSavingAll(true);
    let ok = 0, fail = 0;
    for (const t of filtered) {
      const r = rows[t.id];
      if (!r) continue;
      const { error } = await supabase
        .from("sms_templates")
        .update({
          dlt_template_id: r.dlt_template_id.trim() || null,
          body_template: r.body_template,
          sender_id: r.sender_id.trim() || null,
        })
        .eq("id", t.id);
      if (error) fail++; else ok++;
    }
    setSavingAll(false);
    toast({ title: `Saved ${ok}/${ok + fail}`, description: fail ? `${fail} failed` : "All updated" });
    onSaved();
  };

  const missingCount = list.filter((t) => !t.dlt_template_id).length;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="w-4 h-4 text-amber-400" /> Bulk DLT Manager
            <Badge variant="outline" className="text-[10px]">{missingCount} missing DLT</Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-between gap-2 pb-2 border-b border-border/40 flex-wrap">
          <div className="flex gap-1">
            <Button size="sm" variant={filter === "missing" ? "default" : "outline"} onClick={() => setFilter("missing")}>
              Missing DLT ({missingCount})
            </Button>
            <Button size="sm" variant={filter === "all" ? "default" : "outline"} onClick={() => setFilter("all")}>
              All ({list.length})
            </Button>
          </div>
          <div className="flex items-center gap-2 flex-1 min-w-[240px] max-w-md">
            <Label className="text-[10px] whitespace-nowrap">Test Phone:</Label>
            <Input
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              placeholder="9876543210"
              className="h-8 text-xs font-mono"
            />
          </div>
          <Button size="sm" onClick={saveAll} disabled={savingAll || filtered.length === 0}>
            {savingAll ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />}
            Save All ({filtered.length})
          </Button>
        </div>

        <div className="flex-1 overflow-auto space-y-3 py-2">
          {filtered.length === 0 && (
            <div className="text-center py-8 text-sm text-muted-foreground">
              {filter === "missing" ? "🎉 All templates have DLT IDs!" : "No templates."}
            </div>
          )}
          {filtered.map((t) => {
            const r = rows[t.id] || { dlt_template_id: "", body_template: "", sender_id: "" };
            return (
              <Card key={t.id} className="border-border/40">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="capitalize text-[10px]">{t.category}</Badge>
                    <span className="text-sm font-semibold text-foreground">{t.display_name}</span>
                    <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{t.name}</code>
                    {!t.dlt_template_id && (
                      <Badge className="bg-amber-500/15 text-amber-400 text-[10px]">⚠ No DLT</Badge>
                    )}
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                    <div>
                      <Label className="text-[10px]">DLT Template ID *</Label>
                      <Input
                        value={r.dlt_template_id}
                        onChange={(e) => setRows({ ...rows, [t.id]: { ...r, dlt_template_id: e.target.value } })}
                        placeholder="1707161234567890123"
                        className="h-8 text-xs font-mono"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px]">Sender ID</Label>
                      <Input
                        value={r.sender_id}
                        onChange={(e) => setRows({ ...rows, [t.id]: { ...r, sender_id: e.target.value } })}
                        placeholder="ACRYAI"
                        className="h-8 text-xs"
                      />
                    </div>
                    <div className="flex items-end gap-1">
                      <Button size="sm" className="flex-1 h-8" onClick={() => saveOne(t.id)} disabled={saving === t.id}>
                        {saving === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><CheckCircle2 className="w-3.5 h-3.5 mr-1" /> Save</>}
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1 h-8 bg-cyan-500/10 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/20"
                        onClick={() => sendTest(t)}
                        disabled={testing === t.id || !testPhone}
                        title={!testPhone ? "Enter test phone above" : `Send test to ${testPhone}`}
                      >
                        {testing === t.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <><Send className="w-3.5 h-3.5 mr-1" /> Test</>}
                      </Button>
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px]">Message Body (must match DLT-approved template)</Label>
                    <Textarea
                      rows={2}
                      value={r.body_template}
                      onChange={(e) => setRows({ ...rows, [t.id]: { ...r, body_template: e.target.value } })}
                      className="text-xs font-mono"
                    />
                    <div className="flex items-center justify-between mt-0.5 gap-2">
                      <div className="text-[10px] text-muted-foreground">
                        {r.body_template.length}/160 · {Math.ceil(r.body_template.length / 160)} segment(s)
                      </div>
                      {testResult[t.id] && (
                        <Badge className={`text-[10px] ${testResult[t.id].ok ? "bg-emerald-500/15 text-emerald-400" : "bg-destructive/15 text-destructive"}`}>
                          {testResult[t.id].ok ? "✓" : "✗"} {testResult[t.id].msg}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <DialogFooter className="border-t border-border/40 pt-3">
          <div className="text-[10px] text-muted-foreground mr-auto">
            💡 Get DLT IDs from MSG91 → Manage Templates. Body must match approved DLT text exactly.
          </div>
          <Button variant="outline" onClick={onClose}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─── Templates ───
function Templates() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [edit, setEdit] = useState<any | null>(null);
  const [bulkOpen, setBulkOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const copyUrl = useCallback(async (id: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(id);
      toast({ title: "URL copied", description: url });
      setTimeout(() => setCopiedId((c) => (c === id ? null : c)), 1500);
    } catch {
      toast({ title: "Copy failed", variant: "destructive" });
    }
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("sms_templates").select("*").order("category").order("name");
    setList(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async () => {
    if (!edit?.name || !edit?.body_template) {
      toast({ title: "Name & body required", variant: "destructive" }); return;
    }
    const payload: any = {
      name: edit.name, display_name: edit.display_name || edit.name,
      body_template: edit.body_template, category: edit.category || "engagement",
      dlt_template_id: edit.dlt_template_id || null, sender_id: edit.sender_id || null,
      is_active: edit.is_active !== false, description: edit.description || null,
      variables: edit.variables || [],
      target_url: edit.target_url?.trim() || null,
    };
    const op = edit.id
      ? supabase.from("sms_templates").update(payload).eq("id", edit.id)
      : supabase.from("sms_templates").insert(payload);
    const { error } = await op;
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Template saved" }); setEdit(null); load(); }
  };

  const toggle = async (id: string, on: boolean) => {
    await supabase.from("sms_templates").update({ is_active: on }).eq("id", id);
    load();
  };

  const grouped = useMemo(() => {
    const g: Record<string, any[]> = {};
    list.forEach(t => { (g[t.category] = g[t.category] || []).push(t); });
    return g;
  }, [list]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h3 className="text-base font-bold text-foreground">SMS Templates</h3>
          <p className="text-xs text-muted-foreground">
            {list.length} templates · {list.filter((t) => t.dlt_template_id).length} with DLT · {list.filter((t) => !t.dlt_template_id).length} missing
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setBulkOpen(true)} className="bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20">
            <Zap className="w-3.5 h-3.5 mr-1.5" /> Bulk DLT Editor
          </Button>
          <Button size="sm" onClick={() => setEdit({ category: "engagement", is_active: true, body_template: "" })}>
            <Plus className="w-3.5 h-3.5 mr-1.5" /> New
          </Button>
        </div>
      </div>

      <BulkDltEditor open={bulkOpen} onClose={() => setBulkOpen(false)} list={list} onSaved={load} />

      {loading && <Loader2 className="w-5 h-5 animate-spin mx-auto" />}

      {Object.entries(grouped).map(([cat, items]) => (
        <Card key={cat}>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm capitalize flex items-center gap-2">
              <Badge variant="outline">{cat}</Badge>
              <span className="text-xs text-muted-foreground font-normal">{items.length}</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {items.map(t => (
              <div key={t.id} className="flex items-start gap-3 p-3 rounded-lg border border-border/40 hover:border-border transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{t.display_name}</span>
                    <code className="text-[10px] bg-secondary px-1.5 py-0.5 rounded">{t.name}</code>
                    {t.dlt_template_id && <Badge variant="outline" className="text-[10px]">DLT</Badge>}
                    {t.target_url && (
                      <>
                        <a
                          href={t.target_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline max-w-[180px] truncate"
                          title={t.target_url}
                        >
                          <LinkIcon className="w-2.5 h-2.5 shrink-0" />
                          <span className="truncate">{t.target_url.replace(/^https?:\/\//, "")}</span>
                          <ExternalLink className="w-2.5 h-2.5 shrink-0" />
                        </a>
                        <button
                          type="button"
                          onClick={() => copyUrl(t.id, t.target_url)}
                          title="Copy URL"
                          className="inline-flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded border border-border/40 hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors"
                        >
                          {copiedId === t.id ? (
                            <><Check className="w-2.5 h-2.5 text-emerald-400" /> Copied</>
                          ) : (
                            <><Copy className="w-2.5 h-2.5" /> Copy URL</>
                          )}
                        </button>
                      </>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground line-clamp-2">{t.body_template}</div>
                </div>
                <Switch checked={t.is_active} onCheckedChange={(v) => toggle(t.id, v)} />
                <Button size="sm" variant="ghost" onClick={() => setEdit(t)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      ))}

      <Dialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{edit?.id ? "Edit" : "New"} SMS Template</DialogTitle></DialogHeader>
          {edit && (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">Name (key)</Label>
                  <Input value={edit.name || ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} placeholder="streak_risk_alert" /></div>
                <div><Label className="text-xs">Display Name</Label>
                  <Input value={edit.display_name || ""} onChange={(e) => setEdit({ ...edit, display_name: e.target.value })} /></div>
              </div>
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={edit.category} onValueChange={(v) => setEdit({ ...edit, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="critical">critical</SelectItem>
                    <SelectItem value="transactional">transactional</SelectItem>
                    <SelectItem value="engagement">engagement</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Body Template (use {`{{variable}}`})</Label>
                <Textarea rows={4} value={edit.body_template || ""} onChange={(e) => setEdit({ ...edit, body_template: e.target.value })} />
                <div className="text-[10px] text-muted-foreground mt-1">{(edit.body_template || "").length}/160 chars · {Math.ceil((edit.body_template || "").length / 160)} segment(s)</div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div><Label className="text-xs">DLT Template ID</Label>
                  <Input value={edit.dlt_template_id || ""} onChange={(e) => setEdit({ ...edit, dlt_template_id: e.target.value })} /></div>
                <div><Label className="text-xs">Sender ID</Label>
                  <Input value={edit.sender_id || ""} onChange={(e) => setEdit({ ...edit, sender_id: e.target.value })} placeholder="ACRYAI" /></div>
              </div>
              <div>
                <Label className="text-xs flex items-center gap-1.5">
                  <LinkIcon className="w-3 h-3" /> Target URL (auto-fills <code className="text-[10px] bg-secondary px-1 rounded">{`{{link}}`}</code>)
                </Label>
                <Input
                  value={edit.target_url || ""}
                  onChange={(e) => setEdit({ ...edit, target_url: e.target.value })}
                  placeholder="https://acry.ai/app?tab=action"
                />
                <div className="text-[10px] text-muted-foreground mt-1">
                  Common: <code>?tab=action</code> · <code>?tab=brain</code> · <code>?tab=progress</code> · <code>?tab=you</code>
                </div>
              </div>
              <div className="flex items-center gap-2"><Switch checked={edit.is_active !== false} onCheckedChange={(v) => setEdit({ ...edit, is_active: v })} /><Label className="text-xs">Active</Label></div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEdit(null)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Broadcast ───
function Broadcast() {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplName, setTplName] = useState<string>("");
  const [vars, setVars] = useState("{}");
  const [audience, setAudience] = useState<"all" | "specific">("all");
  const [userIds, setUserIds] = useState("");
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [preview, setPreview] = useState<string>("");

  useEffect(() => {
    supabase.from("sms_templates").select("*").eq("is_active", true).order("name")
      .then(({ data }) => setTemplates(data || []));
  }, []);

  useEffect(() => {
    if (!tplName) { setPreview(""); return; }
    const tpl = templates.find(t => t.name === tplName);
    if (!tpl) return;
    let parsed = {};
    try { parsed = JSON.parse(vars || "{}"); } catch {}
    const rendered = tpl.body_template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_: any, k: string) => (parsed as any)[k] ?? `{{${k}}}`);
    setPreview(rendered);
  }, [tplName, vars, templates]);

  const send = async () => {
    if (!tplName) { toast({ title: "Pick a template", variant: "destructive" }); return; }
    let parsedVars = {}; try { parsedVars = JSON.parse(vars || "{}"); } catch { toast({ title: "Invalid JSON", variant: "destructive" }); return; }
    const payload: any = { action: "broadcast", template_name: tplName, variables: parsedVars, audience_type: audience };
    if (audience === "specific") payload.audience_user_ids = userIds.split(/[\s,]+/).filter(Boolean);
    setRunning(true); setResult(null);
    const { data, error } = await supabase.functions.invoke("sms-notify", { body: payload });
    setRunning(false);
    if (error) toast({ title: "Broadcast failed", description: error.message, variant: "destructive" });
    else { setResult(data); toast({ title: "Broadcast complete", description: `Sent ${data?.sent ?? 0} of ${data?.total ?? 0}` }); }
  };

  return (
    <Card>
      <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Megaphone className="w-4 h-4" /> SMS Broadcast</CardTitle></CardHeader>
      <CardContent className="space-y-3">
        <div>
          <Label className="text-xs">Template</Label>
          <Select value={tplName} onValueChange={setTplName}>
            <SelectTrigger><SelectValue placeholder="Pick template" /></SelectTrigger>
            <SelectContent>
              {templates.map(t => <SelectItem key={t.id} value={t.name}>[{t.category}] {t.display_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Variables (JSON)</Label>
          <Textarea rows={3} value={vars} onChange={(e) => setVars(e.target.value)} className="font-mono text-xs" />
        </div>
        {preview && <div className="p-3 rounded-lg bg-secondary/50 border border-border/40">
          <div className="text-[10px] text-muted-foreground uppercase mb-1">Preview ({preview.length}/160)</div>
          <div className="text-xs text-foreground whitespace-pre-wrap">{preview}</div>
        </div>}
        <div>
          <Label className="text-xs">Audience</Label>
          <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users with phone</SelectItem>
              <SelectItem value="specific">Specific user IDs</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {audience === "specific" && (
          <div><Label className="text-xs">User IDs (comma/space separated)</Label>
            <Textarea rows={3} value={userIds} onChange={(e) => setUserIds(e.target.value)} className="font-mono text-xs" /></div>
        )}
        <Button onClick={send} disabled={running || !tplName} className="w-full">
          {running ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />}
          Send Broadcast
        </Button>
        {result && (
          <div className="grid grid-cols-4 gap-2 text-center">
            <div className="p-2 rounded bg-secondary/50"><div className="text-lg font-bold">{result.total}</div><div className="text-[10px] text-muted-foreground">Total</div></div>
            <div className="p-2 rounded bg-emerald-500/10"><div className="text-lg font-bold text-emerald-400">{result.sent}</div><div className="text-[10px] text-muted-foreground">Sent</div></div>
            <div className="p-2 rounded bg-amber-500/10"><div className="text-lg font-bold text-amber-400">{result.blocked}</div><div className="text-[10px] text-muted-foreground">Quota</div></div>
            <div className="p-2 rounded bg-destructive/10"><div className="text-lg font-bold text-destructive">{result.failed}</div><div className="text-[10px] text-muted-foreground">Failed</div></div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Schedule ───
function Schedule() {
  const { toast } = useToast();
  const [list, setList] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [tplName, setTplName] = useState("");
  const [vars, setVars] = useState("{}");
  const [when, setWhen] = useState("");
  const [audience, setAudience] = useState<"all" | "specific">("all");
  const [userIds, setUserIds] = useState("");

  const load = useCallback(async () => {
    const [{ data: s }, { data: t }] = await Promise.all([
      supabase.from("sms_scheduled_sends").select("*").order("scheduled_at", { ascending: false }).limit(20),
      supabase.from("sms_templates").select("*").eq("is_active", true).order("name"),
    ]);
    setList(s || []); setTemplates(t || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const create = async () => {
    if (!tplName || !when) { toast({ title: "Template + time required", variant: "destructive" }); return; }
    let parsedVars = {}; try { parsedVars = JSON.parse(vars || "{}"); } catch { toast({ title: "Invalid JSON", variant: "destructive" }); return; }
    const payload: any = {
      template_name: tplName, variables: parsedVars,
      audience_type: audience, scheduled_at: new Date(when).toISOString(), status: "scheduled",
    };
    if (audience === "specific") payload.audience_user_ids = userIds.split(/[\s,]+/).filter(Boolean);
    const { error } = await supabase.from("sms_scheduled_sends").insert(payload);
    if (error) toast({ title: "Failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Scheduled" }); setTplName(""); setWhen(""); setVars("{}"); setUserIds(""); load(); }
  };

  const cancel = async (id: string) => {
    await supabase.from("sms_scheduled_sends").update({ status: "cancelled" }).eq("id", id);
    load();
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Clock className="w-4 h-4" /> Schedule SMS</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Select value={tplName} onValueChange={setTplName}>
            <SelectTrigger><SelectValue placeholder="Template" /></SelectTrigger>
            <SelectContent>{templates.map(t => <SelectItem key={t.id} value={t.name}>{t.display_name}</SelectItem>)}</SelectContent>
          </Select>
          <Textarea rows={2} value={vars} onChange={(e) => setVars(e.target.value)} className="font-mono text-xs" placeholder='{"name":"Rahul"}' />
          <Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Select value={audience} onValueChange={(v: any) => setAudience(v)}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All users with phone</SelectItem>
              <SelectItem value="specific">Specific IDs</SelectItem>
            </SelectContent>
          </Select>
          {audience === "specific" && <Textarea rows={2} value={userIds} onChange={(e) => setUserIds(e.target.value)} className="font-mono text-xs" />}
          <Button onClick={create} className="w-full"><Plus className="w-4 h-4 mr-2" /> Schedule</Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm">Upcoming & Recent</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {list.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">None.</div>}
          {list.map(s => (
            <div key={s.id} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40">
              <Badge variant="outline" className="capitalize">{s.status}</Badge>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-medium text-foreground truncate">{s.template_name}</div>
                <div className="text-[10px] text-muted-foreground">{format(new Date(s.scheduled_at), "PPp")} · {s.audience_type}</div>
              </div>
              {s.status === "scheduled" && (
                <Button size="sm" variant="ghost" onClick={() => cancel(s.id)}><XCircle className="w-3.5 h-3.5" /></Button>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Quota ───
function QuotaPanel() {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("sms_quota").select("*").order("count", { ascending: false }).limit(100);
    setRows(data || []);
    setLoading(false);
  }, []);
  useEffect(() => { load(); }, [load]);

  const reset = async (uid: string) => {
    await supabase.from("sms_quota").update({ count: 0 }).eq("user_id", uid);
    load();
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between">
        <CardTitle className="text-sm flex items-center gap-2"><Gauge className="w-4 h-4" /> User Quota Usage (60/month default)</CardTitle>
        <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
      </CardHeader>
      <CardContent className="space-y-2 max-h-[500px] overflow-auto">
        {rows.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">No quota usage yet.</div>}
        {rows.map(r => {
          const pct = (r.count / Math.max(r.monthly_limit, 1)) * 100;
          return (
            <div key={r.user_id} className="space-y-1.5 p-2.5 rounded-lg border border-border/40">
              <div className="flex items-center gap-2">
                <code className="text-[10px] text-muted-foreground flex-1 truncate">{r.user_id}</code>
                <Badge variant="outline" className="text-[10px]">{r.count}/{r.monthly_limit}</Badge>
                <Button size="sm" variant="ghost" onClick={() => reset(r.user_id)} className="h-6 px-2 text-[10px]">Reset</Button>
              </div>
              <Progress value={pct} className={`h-1.5 ${pct >= 90 ? "[&>div]:bg-destructive" : pct >= 70 ? "[&>div]:bg-amber-500" : ""}`} />
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Logs ───
function Logs() {
  const { toast } = useToast();
  const [rows, setRows] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("sms_messages").select("*").order("created_at", { ascending: false }).limit(200);
    if (filter !== "all") q = q.eq("status", filter);
    const { data } = await q;
    setRows(data || []);
    setLoading(false);
  }, [filter]);
  useEffect(() => { load(); }, [load]);

  const retry = async (id: string) => {
    const { data, error } = await supabase.functions.invoke("sms-notify", { body: { action: "retry", message_id: id } });
    if (error || !data?.ok) toast({ title: "Retry failed", description: error?.message || data?.reason, variant: "destructive" });
    else { toast({ title: "Retry sent" }); load(); }
  };

  return (
    <Card>
      <CardHeader className="pb-3 flex-row items-center justify-between gap-2 flex-wrap">
        <CardTitle className="text-sm flex items-center gap-2"><Activity className="w-4 h-4" /> Delivery Logs</CardTitle>
        <div className="flex items-center gap-2">
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="h-8 w-36 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="sent">Sent</SelectItem>
              <SelectItem value="failed">Failed</SelectItem>
              <SelectItem value="blocked_quota">Quota Blocked</SelectItem>
            </SelectContent>
          </Select>
          <Button size="sm" variant="outline" onClick={load}><RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /></Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-1.5 max-h-[600px] overflow-auto">
        {rows.length === 0 && <div className="text-xs text-muted-foreground py-4 text-center">No logs.</div>}
        {rows.map(r => (
          <div key={r.id} className="flex items-start gap-3 p-2.5 rounded-lg border border-border/40">
            <Badge className={`text-[10px] uppercase ${
              r.status === "sent" ? "bg-emerald-500/15 text-emerald-400" :
              r.status === "failed" ? "bg-destructive/15 text-destructive" :
              r.status === "blocked_quota" ? "bg-amber-500/15 text-amber-400" :
              "bg-secondary"
            }`}>{r.status}</Badge>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-mono text-foreground">{r.to_number} {r.template_name && <span className="text-muted-foreground ml-2">[{r.template_name}]</span>}</div>
              <div className="text-xs text-muted-foreground line-clamp-1">{r.message_body}</div>
              {r.error_message && <div className="text-[10px] text-destructive mt-0.5">⚠ {r.error_message}</div>}
            </div>
            <div className="text-[10px] text-muted-foreground whitespace-nowrap">{format(new Date(r.created_at), "MMM d HH:mm")}</div>
            {r.status === "failed" && (
              <Button size="sm" variant="ghost" onClick={() => retry(r.id)} className="h-7 px-2"><RefreshCw className="w-3 h-3" /></Button>
            )}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

// ─── Settings ───
function SettingsPanel() {
  const { toast } = useToast();
  const [cfg, setCfg] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [testTo, setTestTo] = useState("");
  const [testBody, setTestBody] = useState("Test SMS from ACRY Alerts Center");
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    supabase.from("sms_config").select("*").limit(1).maybeSingle().then(({ data }) => setCfg(data));
  }, []);

  const save = async () => {
    setSaving(true);
    const { error } = await supabase.from("sms_config").update({
      is_enabled: cfg.is_enabled, monthly_limit_per_user: cfg.monthly_limit_per_user,
      sender_id: cfg.sender_id, default_dlt_template_id: cfg.default_dlt_template_id,
      default_route: cfg.default_route, default_country: cfg.default_country,
      auto_fallback_on_quota_exceeded: cfg.auto_fallback_on_quota_exceeded,
      allowed_categories: cfg.allowed_categories, fallback_channels: cfg.fallback_channels,
    }).eq("id", cfg.id);
    setSaving(false);
    if (error) toast({ title: "Save failed", description: error.message, variant: "destructive" });
    else toast({ title: "Settings saved" });
  };

  const sendTest = async () => {
    if (!testTo) { toast({ title: "Mobile required", variant: "destructive" }); return; }
    setTesting(true);
    const { data, error } = await supabase.functions.invoke("sms-notify", {
      body: { action: "send", mobile: testTo, body: testBody, category: "transactional", source: "test" },
    });
    setTesting(false);
    if (error || !data?.ok) toast({ title: "Test failed", description: error?.message || data?.reason, variant: "destructive" });
    else toast({ title: "Test SMS sent ✓" });
  };

  if (!cfg) return <Loader2 className="w-5 h-5 animate-spin mx-auto" />;

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4" /> SMS Engine Settings</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40">
            <div><Label className="text-xs">SMS Globally Enabled</Label>
              <div className="text-[10px] text-muted-foreground">Master switch for all SMS dispatch</div></div>
            <Switch checked={cfg.is_enabled} onCheckedChange={(v) => setCfg({ ...cfg, is_enabled: v })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><Label className="text-xs">Monthly limit / user</Label>
              <Input type="number" value={cfg.monthly_limit_per_user} onChange={(e) => setCfg({ ...cfg, monthly_limit_per_user: parseInt(e.target.value) || 60 })} /></div>
            <div><Label className="text-xs">Sender ID</Label>
              <Input value={cfg.sender_id} onChange={(e) => setCfg({ ...cfg, sender_id: e.target.value })} /></div>
            <div><Label className="text-xs">Default DLT Template ID</Label>
              <Input value={cfg.default_dlt_template_id || ""} onChange={(e) => setCfg({ ...cfg, default_dlt_template_id: e.target.value })} /></div>
            <div><Label className="text-xs">Route</Label>
              <Input value={cfg.default_route} onChange={(e) => setCfg({ ...cfg, default_route: e.target.value })} /></div>
            <div><Label className="text-xs">Country</Label>
              <Input value={cfg.default_country} onChange={(e) => setCfg({ ...cfg, default_country: e.target.value })} /></div>
          </div>
          <div className="flex items-center justify-between p-2.5 rounded-lg bg-secondary/40">
            <div><Label className="text-xs">Auto-fallback on quota exceeded</Label>
              <div className="text-[10px] text-muted-foreground">Send via push/email if SMS quota reached</div></div>
            <Switch checked={cfg.auto_fallback_on_quota_exceeded} onCheckedChange={(v) => setCfg({ ...cfg, auto_fallback_on_quota_exceeded: v })} />
          </div>
          <Button onClick={save} disabled={saving} className="w-full">
            {saving ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <CheckCircle2 className="w-4 h-4 mr-2" />} Save Settings
          </Button>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-sm flex items-center gap-2"><Zap className="w-4 h-4" /> Send Test SMS</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <Input placeholder="Mobile (10-digit or 91XXXXXXXXXX)" value={testTo} onChange={(e) => setTestTo(e.target.value)} />
          <Textarea rows={2} value={testBody} onChange={(e) => setTestBody(e.target.value)} />
          <Button onClick={sendTest} disabled={testing} className="w-full">
            {testing ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Send className="w-4 h-4 mr-2" />} Send Test
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Root ───
export default function SmsAlertsCenter() {
  const [tab, setTab] = useState<Tab>("overview");

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500/30 to-cyan-500/20 flex items-center justify-center">
          <Smartphone className="w-5 h-5 text-emerald-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
            SMS Alerts Center
            <Badge className="bg-emerald-500/15 text-emerald-400 text-[10px]">MSG91 · 60/mo</Badge>
          </h2>
          <p className="text-xs text-muted-foreground">Ultra-advanced transactional SMS dispatch · templates, broadcast, schedule, quota</p>
        </div>
      </div>

      <div className="flex gap-1.5 flex-wrap">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
              tab === t.key ? "bg-emerald-500/15 text-emerald-400 shadow-sm" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}>
            <t.icon className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{t.label}</span>
          </button>
        ))}
      </div>

      <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
        {tab === "overview" && <Overview />}
        {tab === "feed" && <LiveFeed />}
        {tab === "templates" && <Templates />}
        {tab === "broadcast" && <Broadcast />}
        {tab === "schedule" && <Schedule />}
        {tab === "quota" && <QuotaPanel />}
        {tab === "logs" && <Logs />}
        {tab === "settings" && <SettingsPanel />}
      </motion.div>
    </div>
  );
}
