import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Zap, Edit3, Send, RefreshCw, Filter, Plus } from "lucide-react";

type EventRow = {
  id: string;
  event_key: string;
  display_name: string;
  description: string | null;
  category: string;
  priority: string;
  template_name: string | null;
  variable_map: Record<string, string>;
  daily_cap_per_user: number;
  bypass_quota: boolean;
  is_enabled: boolean;
};

type Template = { name: string; display_name: string; dlt_template_id: string | null; is_active?: boolean };

const CATEGORY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  security: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  payment: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  otp: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  transactional: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  engagement: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

export default function SmsEventRegistry() {
  const { toast } = useToast();
  const [rows, setRows] = useState<EventRow[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<EventRow | null>(null);
  const [testing, setTesting] = useState<string | null>(null);
  const [testMobile, setTestMobile] = useState("");
  const [testEvent, setTestEvent] = useState<EventRow | null>(null);
  const [creatingTpl, setCreatingTpl] = useState(false);
  const [newTpl, setNewTpl] = useState({
    name: "",
    display_name: "",
    dlt_template_id: "",
    sender_id: "",
    category: "engagement",
    body_template: "",
  });
  const [savingTpl, setSavingTpl] = useState(false);

  async function load() {
    setLoading(true);
    const [{ data: ev }, { data: tpl }] = await Promise.all([
      supabase.from("sms_event_registry").select("*").order("category").order("event_key"),
      supabase.from("sms_templates").select("name,display_name,dlt_template_id,is_active").order("display_name"),
    ]);
    setRows((ev as any) || []);
    setTemplates((tpl as any) || []);
    setLoading(false);
  }

  useEffect(() => { load(); }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (filter !== "all" && r.category !== filter) return false;
      if (search && !`${r.event_key} ${r.display_name}`.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    });
  }, [rows, filter, search]);

  async function toggleEnabled(row: EventRow) {
    const { error } = await supabase
      .from("sms_event_registry")
      .update({ is_enabled: !row.is_enabled })
      .eq("id", row.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, is_enabled: !row.is_enabled } : r)));
  }

  async function saveEdit() {
    if (!editing) return;
    const { error } = await supabase
      .from("sms_event_registry")
      .update({
        template_name: editing.template_name,
        category: editing.category,
        priority: editing.priority,
        daily_cap_per_user: editing.daily_cap_per_user,
        bypass_quota: editing.bypass_quota,
        variable_map: editing.variable_map,
      })
      .eq("id", editing.id);
    if (error) return toast({ title: "Save failed", description: error.message, variant: "destructive" });
    toast({ title: "Saved", description: editing.event_key });
    setEditing(null);
    load();
  }

  async function runTest() {
    if (!testEvent || !testMobile) return;
    setTesting(testEvent.event_key);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data, error } = await supabase.functions.invoke("sms-event-engine", {
        body: {
          event_type: testEvent.event_key,
          user_id: user?.id,
          override_mobile: testMobile,
          data: { name: "Test User", amount: "₹149", rank: "42", days: "3", topic: "Physics", link: "https://acry.ai" },
          source: "admin_test",
        },
      });
      if (error) throw error;
      const ok = (data as any)?.results?.[0]?.ok;
      toast({
        title: ok ? "✅ Test sent" : "⚠️ Skipped",
        description: ok ? `Delivered via ${testEvent.template_name}` : (data as any)?.results?.[0]?.status || "no result",
      });
    } catch (e: any) {
      toast({ title: "Test failed", description: e.message, variant: "destructive" });
    } finally {
      setTesting(null);
      setTestEvent(null);
      setTestMobile("");
    }
  }

  async function createTemplate() {
    const name = newTpl.name.trim().toLowerCase().replace(/[^a-z0-9_]/g, "_");
    if (!name) return toast({ title: "Name required", variant: "destructive" });
    if (!newTpl.display_name.trim()) return toast({ title: "Display name required", variant: "destructive" });
    if (!newTpl.dlt_template_id.trim()) return toast({ title: "DLT Template ID required", variant: "destructive" });
    if (!newTpl.body_template.trim()) return toast({ title: "Message body required", variant: "destructive" });

    setSavingTpl(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { error } = await supabase.from("sms_templates").insert({
        name,
        display_name: newTpl.display_name.trim(),
        dlt_template_id: newTpl.dlt_template_id.trim(),
        sender_id: newTpl.sender_id.trim() || null,
        category: newTpl.category,
        body_template: newTpl.body_template.trim(),
        is_active: true,
        created_by: user?.id ?? null,
      });
      if (error) throw error;

      toast({ title: "✅ Template added", description: name });

      const { data: tpl } = await supabase
        .from("sms_templates")
        .select("name,display_name,dlt_template_id,is_active")
        .order("display_name");
      setTemplates((tpl as any) || []);
      if (editing) setEditing({ ...editing, template_name: name });

      setNewTpl({ name: "", display_name: "", dlt_template_id: "", sender_id: "", category: "engagement", body_template: "" });
      setCreatingTpl(false);
    } catch (e: any) {
      toast({ title: "Failed to add template", description: e.message, variant: "destructive" });
    } finally {
      setSavingTpl(false);
    }
  }

    const total = rows.length;
    const mapped = rows.filter((r) => r.template_name).length;
    const enabled = rows.filter((r) => r.is_enabled && r.template_name).length;
    return { total, mapped, enabled };
  }, [rows]);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <Card className="bg-gradient-to-br from-violet-500/10 to-violet-500/5 border-violet-500/20">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total events</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border-blue-500/20">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.mapped}/{stats.total}</div>
            <div className="text-xs text-muted-foreground">Mapped to template</div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border-emerald-500/20">
          <CardContent className="p-4">
            <div className="text-2xl font-bold">{stats.enabled}</div>
            <div className="text-xs text-muted-foreground">Live & enabled</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <CardTitle className="flex items-center gap-2 text-base">
              <Zap className="h-4 w-4 text-violet-400" />
              Event Auto-Trigger Registry
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={load} disabled={loading}>
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2 flex-wrap">
            <Input
              placeholder="Search event…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="max-w-xs"
            />
            <Select value={filter} onValueChange={setFilter}>
              <SelectTrigger className="w-44"><Filter className="h-3.5 w-3.5 mr-2" /><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All categories</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="security">Security</SelectItem>
                <SelectItem value="payment">Payment</SelectItem>
                <SelectItem value="otp">OTP</SelectItem>
                <SelectItem value="transactional">Transactional</SelectItem>
                <SelectItem value="engagement">Engagement</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Event rows */}
          <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
            {filtered.map((row) => (
              <div
                key={row.id}
                className="flex items-center gap-3 p-3 rounded-lg border border-border/50 bg-card/50 hover:bg-card transition"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm">{row.display_name}</span>
                    <code className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">{row.event_key}</code>
                    <Badge variant="outline" className={`text-[10px] ${CATEGORY_COLORS[row.category] || ""}`}>
                      {row.category}
                    </Badge>
                    {row.bypass_quota && <Badge variant="outline" className="text-[10px] bg-red-500/10 text-red-400 border-red-500/30">bypass quota</Badge>}
                    {!row.template_name && <Badge variant="outline" className="text-[10px] bg-amber-500/10 text-amber-400 border-amber-500/30">⚠️ no template</Badge>}
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1 truncate">
                    {row.template_name ? `→ ${row.template_name}` : "Not yet mapped to a DLT template"}
                    <span className="mx-2">·</span>
                    cap {row.daily_cap_per_user}/day · {row.priority}
                  </div>
                </div>
                <Switch checked={row.is_enabled} onCheckedChange={() => toggleEnabled(row)} />
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Auto-suggest a template when none is mapped yet, OR when the saved
                    // template no longer exists in the templates list.
                    // Priority: 1) exact name match, 2) starts-with event_key,
                    // 3) contains event_key, 4) any token of event_key matches,
                    // 5) first template with a Flow ID, 6) first template available.
                    const existsInList =
                      !!row.template_name &&
                      templates.some((t) => t.name === row.template_name);
                    let suggested = existsInList ? row.template_name : null;

                    if (!suggested && templates.length) {
                      const ek = (row.event_key || "").toLowerCase();
                      const tokens = ek.split(/[_\-\s]+/).filter(Boolean);
                      suggested =
                        templates.find((t) => t.name?.toLowerCase() === ek)?.name ||
                        templates.find((t) => t.name?.toLowerCase().startsWith(ek))?.name ||
                        templates.find((t) => t.name?.toLowerCase().includes(ek))?.name ||
                        templates.find((t) =>
                          tokens.some((tok) => tok.length > 2 && t.name?.toLowerCase().includes(tok))
                        )?.name ||
                        templates.find((t) => !!t.dlt_template_id)?.name ||
                        templates[0]?.name ||
                        null;
                    }
                    setEditing({ ...row, template_name: suggested, variable_map: row.variable_map || {} });
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  disabled={!row.template_name || testing === row.event_key}
                  onClick={() => setTestEvent(row)}
                >
                  <Send className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
            {!filtered.length && (
              <div className="text-center text-sm text-muted-foreground py-8">No events match.</div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Edit dialog */}
      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Edit event: {editing?.display_name}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div>
                <Label className="text-xs">DLT Template (Flow ID source)</Label>
                <Select
                  value={editing.template_name ?? undefined}
                  onValueChange={(v) => setEditing({ ...editing, template_name: v })}
                >
                  <SelectTrigger><SelectValue placeholder="Pick a template…" /></SelectTrigger>
                  <SelectContent>
                    {/* Fallback: if saved template isn't in list (deleted/renamed), still show it */}
                    {editing.template_name && !templates.some((t) => t.name === editing.template_name) && (
                      <SelectItem value={editing.template_name}>
                        {editing.template_name} <span className="text-amber-400">(missing)</span>
                      </SelectItem>
                    )}
                    {templates.map((t) => (
                      <SelectItem key={t.name} value={t.name}>
                        {t.display_name}
                        {t.dlt_template_id ? ` (${t.dlt_template_id.slice(0, 8)}…)` : " ⚠️ no Flow ID"}
                        {t.is_active === false ? " · inactive" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-[10px] text-muted-foreground mt-1">
                  The Flow ID lives on the template itself (Templates tab). Add it there once and it applies everywhere.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Category</Label>
                  <Select value={editing.category} onValueChange={(v) => setEditing({ ...editing, category: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["critical","security","payment","otp","transactional","engagement"].map((c) => (
                        <SelectItem key={c} value={c}>{c}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Priority</Label>
                  <Select value={editing.priority} onValueChange={(v) => setEditing({ ...editing, priority: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {["critical","high","medium","low"].map((p) => (
                        <SelectItem key={p} value={p}>{p}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">Daily cap / user</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={editing.daily_cap_per_user}
                    onChange={(e) => setEditing({ ...editing, daily_cap_per_user: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="flex items-end gap-2">
                  <Switch
                    checked={editing.bypass_quota}
                    onCheckedChange={(v) => setEditing({ ...editing, bypass_quota: v })}
                  />
                  <Label className="text-xs">Bypass 60/mo quota</Label>
                </div>
              </div>

              <div>
                <Label className="text-xs">Variable Map (JSON: slot → data key)</Label>
                <Textarea
                  rows={4}
                  className="font-mono text-xs"
                  value={JSON.stringify(editing.variable_map || {}, null, 2)}
                  onChange={(e) => {
                    try {
                      setEditing({ ...editing, variable_map: JSON.parse(e.target.value) });
                    } catch {
                      // ignore until valid JSON
                    }
                  }}
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  e.g. <code>{`{"var1":"name","var2":"amount","var3":"link"}`}</code> — keys are template slots, values are fields from event data.
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test dialog */}
      <Dialog open={!!testEvent} onOpenChange={(o) => !o && setTestEvent(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Live test: {testEvent?.display_name}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">Mobile (with country code)</Label>
              <Input
                placeholder="919876543210"
                value={testMobile}
                onChange={(e) => setTestMobile(e.target.value.replace(/\D/g, ""))}
              />
            </div>
            <p className="text-[11px] text-muted-foreground">
              Will send a real SMS via MSG91 using the mapped Flow ID with sample variables.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTestEvent(null)}>Cancel</Button>
            <Button onClick={runTest} disabled={!testMobile || testing === testEvent?.event_key}>
              {testing === testEvent?.event_key ? "Sending…" : "Send test"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
