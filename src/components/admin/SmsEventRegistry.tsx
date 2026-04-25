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

type Template = { name: string; display_name: string; dlt_template_id: string | null; is_active?: boolean; variables?: string[] | null; body_template?: string | null };

const CATEGORY_COLORS: Record<string, string> = {
  critical: "bg-red-500/15 text-red-400 border-red-500/30",
  security: "bg-orange-500/15 text-orange-400 border-orange-500/30",
  payment: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  otp: "bg-cyan-500/15 text-cyan-400 border-cyan-500/30",
  transactional: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  engagement: "bg-violet-500/15 text-violet-400 border-violet-500/30",
};

// ---------- Auto-select scoring ----------
// Synonyms map common event tokens → words that appear in template names/bodies.
const SYNONYMS: Record<string, string[]> = {
  badge: ["milestone", "achievement", "reward", "unlocked"],
  earned: ["unlocked", "achieved", "won", "reward"],
  milestone: ["badge", "achievement", "unlocked"],
  comeback: ["inactivity", "return", "comeback"],
  comeback_user: ["inactivity", "return"],
  rank: ["leaderboard", "myrank"],
  drop: ["risk", "drop"],
  climb: ["leaderboard", "climb", "top"],
  streak: ["streak"],
  risk: ["risk", "drop", "save"],
  exam: ["exam", "countdown", "d_day", "mock"],
  countdown: ["exam", "days"],
  mock: ["mock", "test", "practice"],
  test: ["mock", "test", "practice", "completed"],
  weak: ["weak", "topic"],
  topic: ["weak", "topic", "revision"],
  revision: ["revision", "ai"],
  daily: ["daily", "mission", "briefing"],
  brief: ["briefing", "daily"],
  briefing: ["briefing", "daily"],
  study: ["mission", "focus", "revision"],
  reminder: ["mission", "due", "reminder"],
  emergency: ["emergency", "rescue"],
  rescue: ["emergency", "rescue"],
  feature: ["feature", "announcement", "launch"],
  announcement: ["feature", "launch"],
  friend: ["friend", "referral", "joined"],
  joined: ["referral", "signup", "joined"],
  referral: ["referral", "reward", "friend"],
  reward: ["reward", "referral", "milestone"],
  leaderboard: ["leaderboard", "myrank", "rank"],
  weekly: ["weekly", "recap"],
  summary: ["recap", "weekly"],
  recap: ["weekly", "recap"],
  payment: ["payment"],
  failed: ["failed"],
  success: ["success"],
  refund: ["refund"],
  invoice: ["invoice"],
  otp: ["otp", "verification"],
  login: ["login", "alert", "otp"],
  account: ["account", "security", "locked"],
  locked: ["locked", "account"],
  password: ["password", "reset"],
  security: ["security", "alert", "locked"],
  trial: ["trial", "ending"],
  subscription: ["subscription", "expiring"],
  expiring: ["expiring", "subscription"],
  current: ["current", "affairs"],
  affairs: ["current", "affairs"],
  sureshot: ["sureshot", "predicted"],
};

const STOP_TOKENS = new Set(["the", "and", "a", "an", "of", "to", "is", "in", "on", "at", "user", "alert"]);

const tokenize = (s: string): string[] =>
  (s || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .split(/\s+/)
    .filter((t) => t && t.length > 1 && !STOP_TOKENS.has(t));

const expandTokens = (tokens: string[]): Set<string> => {
  const out = new Set<string>();
  tokens.forEach((t) => {
    out.add(t);
    (SYNONYMS[t] || []).forEach((s) => out.add(s));
  });
  return out;
};

/**
 * Score how well a template fits an event. Higher = better.
 * Returns 0 when there's no real overlap (caller can choose to leave unmapped).
 */
function scoreTemplate(
  ev: { event_key: string; display_name?: string | null; category?: string | null },
  tpl: Template,
): number {
  const evTokens = expandTokens([
    ...tokenize(ev.event_key),
    ...tokenize(ev.display_name || ""),
  ]);
  const tplCorpus = `${tpl.name || ""} ${tpl.display_name || ""} ${tpl.body_template || ""}`;
  const tplTokens = new Set(tokenize(tplCorpus));

  // Exact name match wins big
  if (tpl.name?.toLowerCase() === ev.event_key.toLowerCase()) return 1000;

  let score = 0;
  evTokens.forEach((t) => {
    if (tplTokens.has(t)) score += 10;
  });

  // Category hint (e.g. payment events should prefer "you_payment_*")
  const cat = (ev.category || "").toLowerCase();
  if (cat && tpl.name?.toLowerCase().includes(cat)) score += 6;
  if (cat === "payment" && /payment|invoice|refund/.test(tpl.name || "")) score += 8;
  if (cat === "otp" && /otp|verification/.test(tpl.name || "")) score += 8;
  if (cat === "security" && /security|locked|login/.test(tpl.name || "")) score += 8;
  if (cat === "engagement" && /^(home_|action_|practice_|myrank_|you_)/.test(tpl.name || "")) score += 2;

  // Strong bonus for DLT-approved (deliverable) templates — but never enough on its own.
  if (tpl.dlt_template_id) score += 3;

  // Prefer active templates
  if (tpl.is_active === false) score -= 20;

  return score;
}

function pickBestTemplate(
  ev: { event_key: string; display_name?: string | null; category?: string | null },
  templates: Template[],
): Template | null {
  if (!templates.length) return null;
  let best: Template | null = null;
  let bestScore = 0;
  for (const t of templates) {
    const s = scoreTemplate(ev, t);
    if (s > bestScore) {
      bestScore = s;
      best = t;
    }
  }
  // Require a meaningful overlap (≥ 2 token hits worth of score) to avoid
  // suggesting a clearly-irrelevant template just because it has a Flow ID.
  return bestScore >= 13 ? best : null;
}


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
      supabase.from("sms_templates").select("name,display_name,dlt_template_id,is_active,variables,body_template").order("display_name"),
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

  async function toggleBypass(row: EventRow) {
    const next = !row.bypass_quota;
    const { error } = await supabase
      .from("sms_event_registry")
      .update({ bypass_quota: next })
      .eq("id", row.id);
    if (error) return toast({ title: "Failed", description: error.message, variant: "destructive" });
    setRows((rs) => rs.map((r) => (r.id === row.id ? { ...r, bypass_quota: next } : r)));
    toast({ title: next ? "Quota bypass enabled" : "Quota bypass disabled", description: row.display_name });
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
        .select("name,display_name,dlt_template_id,is_active,variables,body_template")
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

  const stats = useMemo(() => {
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
                <div className="flex items-center gap-2 px-2 py-1 rounded-md border border-border/50 bg-background/40">
                  <Switch
                    checked={row.bypass_quota}
                    onCheckedChange={() => toggleBypass(row)}
                    aria-label="Bypass 60/mo quota"
                  />
                  <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                    Bypass 60/mo
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    // Auto-suggest a template when none is mapped yet, OR when the
                    // saved template no longer exists in the templates list.
                    // Uses semantic scoring (token overlap + synonyms + category
                    // hints) and refuses to suggest anything irrelevant.
                    const existsInList =
                      !!row.template_name &&
                      templates.some((t) => t.name === row.template_name);
                    let suggested: string | null = existsInList ? row.template_name : null;

                    if (!suggested && templates.length) {
                      const best = pickBestTemplate(
                        { event_key: row.event_key, display_name: row.display_name, category: row.category },
                        templates,
                      );
                      suggested = best?.name ?? null;
                    }
                    setEditing({ ...row, template_name: suggested, variable_map: row.variable_map || {} });
                  }}
                >
                  <Edit3 className="h-3.5 w-3.5" />
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
                <div className="flex items-center justify-between mb-1">
                  <Label className="text-xs">DLT Template (Flow ID source)</Label>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-6 px-2 text-[11px] text-violet-400 hover:text-violet-300"
                    onClick={() => setCreatingTpl(true)}
                  >
                    <Plus className="h-3 w-3 mr-1" /> New template
                  </Button>
                </div>
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

                {/* Mismatch warning: template variable count vs event variable_map */}
                {(() => {
                  const t = templates.find((x) => x.name === editing.template_name);
                  if (!t) return null;
                  const tplVars = (t.variables || []) as string[];
                  const evVars = Object.keys(editing.variable_map || {});
                  if (!tplVars.length && evVars.length) {
                    return (
                      <p className="text-[11px] mt-1 text-amber-400">
                        ⚠️ This template has no declared variables but your event sends {evVars.length}. MSG91/DLT may reject the request.
                      </p>
                    );
                  }
                  if (tplVars.length !== evVars.length) {
                    return (
                      <p className="text-[11px] mt-1 text-amber-400">
                        ⚠️ Variable mismatch — template expects {tplVars.length} ({tplVars.join(", ")}), event sends {evVars.length}. Engine will auto-align, but content may be wrong.
                      </p>
                    );
                  }
                  if (!t.dlt_template_id) {
                    return (
                      <p className="text-[11px] mt-1 text-red-400">
                        ⚠️ This template has no Flow ID / DLT Template ID — SMS will fail. Add it via Templates tab or "+ New template".
                      </p>
                    );
                  }
                  return (
                    <p className="text-[11px] mt-1 text-emerald-400">
                      ✓ Template ready. Flow ID: <code>{t.dlt_template_id.slice(0, 12)}…</code>
                    </p>
                  );
                })()}

                <p className="text-[10px] text-muted-foreground mt-1">
                  Don't see your DLT-approved template? Click <b>New template</b> to add it with its Flow ID right here.
                </p>
              </div>

              {/* Live template preview */}
              {(() => {
                const t = templates.find((x) => x.name === editing.template_name);
                if (!t?.body_template) return null;

                const sample: Record<string, string> = {
                  name: "Santosh", badge: "Memory Master", amount: "₹149", rank: "42",
                  days: "3", topic: "Physics", link: "https://acry.ai", url: "https://acry.ai",
                  otp: "482913", time: "10:24", app: "ACRY", exam: "NEET UG", streak: "7",
                  score: "82%", feature: "Brain Missions", reward: "₹50", test: "Mock 12",
                  milestone: "Level 5", friend: "Aman",
                  summary: "Today: 3 sessions, 2 weak topics fixed",
                };

                const map = (editing.variable_map || {}) as Record<string, string>;
                const resolveToken = (token: string): string => {
                  if (sample[token] !== undefined) return sample[token];
                  if (map[token]) return sample[map[token]] ?? `{${map[token]}}`;
                  const m = token.match(/^var(\d+)$/);
                  if (m) {
                    const idx = parseInt(m[1]) - 1;
                    const slots = Object.keys(map);
                    const key = map[slots[idx]] ?? slots[idx];
                    if (key && sample[key] !== undefined) return sample[key];
                  }
                  return `{${token}}`;
                };

                const rendered = (t.body_template as string)
                  .replace(/##([a-zA-Z0-9_]+)##/g, (_, k) => resolveToken(k))
                  .replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k) => resolveToken(k));

                const length = rendered.length;
                const segments = Math.max(1, Math.ceil(length / 160));

                return (
                  <div>
                    <Label className="text-xs flex items-center justify-between mb-1">
                      <span>Live preview (sample data)</span>
                      <span className="text-[10px] text-muted-foreground font-normal">
                        {length} chars · {segments} SMS
                      </span>
                    </Label>
                    <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs whitespace-pre-wrap leading-relaxed font-mono">
                      {rendered}
                    </div>
                    {t.dlt_template_id && (
                      <p className="text-[10px] text-muted-foreground mt-1">
                        Sent via Flow ID <code>{t.dlt_template_id}</code>
                        {t.variables?.length ? <> · template vars: <code>{(t.variables as string[]).join(", ")}</code></> : null}
                      </p>
                    )}
                  </div>
                );
              })()}

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

      {/* Create new DLT template dialog */}
      <Dialog open={creatingTpl} onOpenChange={(o) => !savingTpl && setCreatingTpl(o)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add DLT-Approved Template</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Internal name *</Label>
                <Input
                  placeholder="payment_success"
                  value={newTpl.name}
                  onChange={(e) => setNewTpl({ ...newTpl, name: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">lowercase, underscores only</p>
              </div>
              <div>
                <Label className="text-xs">Display name *</Label>
                <Input
                  placeholder="Payment Success"
                  value={newTpl.display_name}
                  onChange={(e) => setNewTpl({ ...newTpl, display_name: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">DLT Template ID / Flow ID *</Label>
                <Input
                  placeholder="65f1c8a4d6e2…"
                  value={newTpl.dlt_template_id}
                  onChange={(e) => setNewTpl({ ...newTpl, dlt_template_id: e.target.value })}
                />
                <p className="text-[10px] text-muted-foreground mt-1">From your MSG91 Flow dashboard</p>
              </div>
              <div>
                <Label className="text-xs">Sender ID (optional)</Label>
                <Input
                  placeholder="ACRYAI"
                  value={newTpl.sender_id}
                  onChange={(e) => setNewTpl({ ...newTpl, sender_id: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label className="text-xs">Category</Label>
              <Select value={newTpl.category} onValueChange={(v) => setNewTpl({ ...newTpl, category: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["critical","security","payment","otp","transactional","engagement"].map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Message body (DLT-approved text) *</Label>
              <Textarea
                rows={4}
                placeholder="Hi {{var1}}, your payment of {{var2}} was successful. — ACRY"
                value={newTpl.body_template}
                onChange={(e) => setNewTpl({ ...newTpl, body_template: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground mt-1">
                Use <code>{`{{var1}}`}</code>, <code>{`{{var2}}`}</code>, <code>{`{{var3}}`}</code> as placeholders matching your Flow variables.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreatingTpl(false)} disabled={savingTpl}>Cancel</Button>
            <Button onClick={createTemplate} disabled={savingTpl}>
              {savingTpl ? "Saving…" : "Add Template"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
