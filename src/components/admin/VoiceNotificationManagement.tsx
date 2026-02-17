import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Volume2, Mic, Plus, Pencil, Trash2, ToggleLeft, ToggleRight,
  Sparkles, Loader2, Search, Clock, Activity, Zap, BarChart3,
  Send, RefreshCw, Play, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Textarea } from "@/components/ui/textarea";

type Tab = "overview" | "triggers" | "templates" | "logs" | "queue";

const CATEGORIES = [
  { key: "user_action", label: "User Actions", color: "bg-blue-500/15 text-blue-400" },
  { key: "ai_prediction", label: "AI Predictions", color: "bg-purple-500/15 text-purple-400" },
  { key: "study_reminder", label: "Study Reminders", color: "bg-primary/15 text-primary" },
  { key: "fix_session", label: "Fix Sessions", color: "bg-orange-500/15 text-orange-400" },
  { key: "rank_exam", label: "Rank & Exam", color: "bg-red-500/15 text-red-400" },
  { key: "community", label: "Community", color: "bg-green-500/15 text-green-400" },
  { key: "subscription", label: "Subscription", color: "bg-yellow-500/15 text-yellow-400" },
  { key: "security", label: "Security", color: "bg-red-600/15 text-red-500" },
  { key: "admin", label: "Admin", color: "bg-accent/15 text-accent" },
  { key: "streak", label: "Streaks", color: "bg-pink-500/15 text-pink-400" },
];

const AI_PURPOSES = [
  "welcome", "study_reminder", "memory_risk", "weak_topic", "brain_improvement",
  "fix_session", "rank_update", "exam_countdown", "streak_milestone", "streak_risk",
  "community_reply", "subscription_activated", "subscription_expiring", "payment_success",
  "payment_failed", "security_alert", "admin_announcement", "motivation", "inactive_reminder",
];

const getCategoryStyle = (cat: string) => CATEGORIES.find(c => c.key === cat)?.color || "bg-muted text-muted-foreground";

const VoiceNotificationManagement = () => {
  const [tab, setTab] = useState<Tab>("overview");
  const { toast } = useToast();

  const tabs: { key: Tab; label: string; icon: any }[] = [
    { key: "overview", label: "Overview", icon: BarChart3 },
    { key: "triggers", label: "Triggers", icon: Zap },
    { key: "templates", label: "Templates", icon: Volume2 },
    { key: "logs", label: "Logs", icon: Activity },
    { key: "queue", label: "Queue", icon: Clock },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Volume2 className="w-6 h-6 text-primary" />
        <div>
          <h2 className="text-xl font-bold text-foreground">Voice Notification Command Center</h2>
          <p className="text-xs text-muted-foreground">AI-powered voice alerts with ElevenLabs TTS</p>
        </div>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
              tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <t.icon className="w-4 h-4" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
          {tab === "overview" && <OverviewTab />}
          {tab === "triggers" && <TriggersTab />}
          {tab === "templates" && <TemplatesTab />}
          {tab === "logs" && <LogsTab />}
          {tab === "queue" && <QueueTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Overview ───
const OverviewTab = () => {
  const [stats, setStats] = useState({ totalSent: 0, aiGenerated: 0, played: 0, activeTriggers: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const [logsRes, aiRes, playedRes, triggersRes] = await Promise.all([
        supabase.from("voice_notification_logs").select("id", { count: "exact", head: true }),
        supabase.from("voice_notification_logs").select("id", { count: "exact", head: true }).eq("ai_generated", true),
        supabase.from("voice_notification_logs").select("id", { count: "exact", head: true }).not("played_at", "is", null),
        supabase.from("voice_notification_triggers").select("id", { count: "exact", head: true }).eq("is_enabled", true),
      ]);
      setStats({
        totalSent: logsRes.count || 0,
        aiGenerated: aiRes.count || 0,
        played: playedRes.count || 0,
        activeTriggers: triggersRes.count || 0,
      });
      setLoading(false);
    })();
  }, []);

  const cards = [
    { label: "Total Sent", value: stats.totalSent, icon: Send, color: "text-primary" },
    { label: "AI Generated", value: stats.aiGenerated, icon: Sparkles, color: "text-purple-400" },
    { label: "Played", value: stats.played, icon: Play, color: "text-green-400" },
    { label: "Active Triggers", value: stats.activeTriggers, icon: Zap, color: "text-yellow-400" },
  ];

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {cards.map(c => (
        <div key={c.label} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <c.icon className={`w-4 h-4 ${c.color}`} />
            <span className="text-xs text-muted-foreground">{c.label}</span>
          </div>
          <p className="text-2xl font-bold text-foreground">{c.value.toLocaleString()}</p>
        </div>
      ))}
    </div>
  );
};

// ─── Triggers ───
const TriggersTab = () => {
  const [triggers, setTriggers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("all");
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("voice_notification_triggers")
      .select("*")
      .order("category")
      .order("display_name");
    setTriggers(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const toggle = async (id: string, field: string, current: boolean) => {
    await supabase.from("voice_notification_triggers").update({ [field]: !current }).eq("id", id);
    setTriggers(prev => prev.map(t => t.id === id ? { ...t, [field]: !current } : t));
    toast({ title: `Trigger ${!current ? "enabled" : "disabled"}` });
  };

  const filtered = triggers.filter(t =>
    (filterCat === "all" || t.category === filterCat) &&
    (t.display_name.toLowerCase().includes(search.toLowerCase()) || t.trigger_key.includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search triggers..."
            className="w-full pl-10 pr-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <select value={filterCat} onChange={e => setFilterCat(e.target.value)} className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border">
          <option value="all">All Categories</option>
          {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map(t => (
            <div key={t.id} className="glass rounded-xl p-4 neural-border flex flex-col md:flex-row md:items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-semibold text-foreground">{t.display_name}</span>
                  <span className={`text-[10px] px-2 py-0.5 rounded-full ${getCategoryStyle(t.category)}`}>{t.category}</span>
                  <span className="text-[10px] text-muted-foreground font-mono">{t.trigger_key}</span>
                </div>
                {t.description && <p className="text-xs text-muted-foreground mt-1">{t.description}</p>}
                <div className="flex gap-3 mt-1 text-[10px] text-muted-foreground">
                  <span>Cooldown: {t.cooldown_minutes}m</span>
                  <span>Priority: {t.priority}</span>
                  <span>Tone: {t.default_tone}</span>
                  <span>Lang: {t.default_language}</span>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggle(t.id, "use_ai_content", t.use_ai_content)}
                  className={`text-[10px] px-2 py-1 rounded-full flex items-center gap-1 ${t.use_ai_content ? "bg-purple-500/15 text-purple-400" : "bg-muted text-muted-foreground"}`}>
                  <Sparkles className="w-3 h-3" />
                  AI {t.use_ai_content ? "On" : "Off"}
                </button>
                <button onClick={() => toggle(t.id, "is_enabled", t.is_enabled)}
                  className={`p-1.5 rounded-lg transition-colors ${t.is_enabled ? "bg-green-500/15 text-green-400" : "bg-muted text-muted-foreground"}`}>
                  {t.is_enabled ? <ToggleRight className="w-5 h-5" /> : <ToggleLeft className="w-5 h-5" />}
                </button>
              </div>
            </div>
          ))}
          {filtered.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No triggers found</p>}
        </div>
      )}
    </div>
  );
};

// ─── Templates ───
const TemplatesTab = () => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [showPurposePicker, setShowPurposePicker] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("voice_notification_templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleAIGenerate = async (purpose: string) => {
    setShowPurposePicker(false);
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-automation-engine", {
        body: { action: "generate_template", context: { purpose, category: purpose.includes("security") ? "security" : purpose.includes("subscription") || purpose.includes("payment") ? "subscription" : "general" } },
      });
      if (error) throw error;
      if (data?.template) {
        setEditing({
          name: data.template.name || "",
          description: data.template.description || "",
          voice_text: data.template.voice_text || "",
          category: data.template.category || "general",
          tone: data.template.tone || "soft",
          language: "en",
          voice_id: "EXAVITQu4vr4xnSDxMaL",
          variables: data.template.variables || [],
          is_active: true,
        });
        toast({ title: "AI Template Generated ✨" });
      }
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setAiGenerating(false);
    }
  };

  const save = async () => {
    if (!editing?.name || !editing?.voice_text) return;
    setSaving(true);
    try {
      if (editing.id) {
        await supabase.from("voice_notification_templates").update({
          name: editing.name, description: editing.description, voice_text: editing.voice_text,
          category: editing.category, tone: editing.tone, language: editing.language,
          voice_id: editing.voice_id, variables: editing.variables, is_active: editing.is_active,
        }).eq("id", editing.id);
      } else {
        await supabase.from("voice_notification_templates").insert({
          name: editing.name, description: editing.description, voice_text: editing.voice_text,
          category: editing.category, tone: editing.tone, language: editing.language,
          voice_id: editing.voice_id, variables: editing.variables || [], is_active: true,
        });
      }
      toast({ title: editing.id ? "Template updated" : "Template created" });
      setEditing(null);
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await supabase.from("voice_notification_templates").delete().eq("id", id);
    setTemplates(prev => prev.filter(t => t.id !== id));
    toast({ title: "Template deleted" });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <button onClick={() => setShowPurposePicker(true)} disabled={aiGenerating}
          className="flex items-center gap-2 px-4 py-2 bg-purple-500/15 text-purple-400 rounded-lg text-sm font-medium hover:bg-purple-500/25 transition-colors disabled:opacity-50">
          {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
          AI Create
        </button>
        <button onClick={() => setEditing({ name: "", description: "", voice_text: "", category: "general", tone: "soft", language: "en", voice_id: "EXAVITQu4vr4xnSDxMaL", variables: [], is_active: true })}
          className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary rounded-lg text-sm font-medium hover:bg-primary/25 transition-colors">
          <Plus className="w-4 h-4" /> Manual
        </button>
      </div>

      {/* AI Purpose Picker */}
      <AnimatePresence>
        {showPurposePicker && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-4 neural-border">
            <p className="text-sm font-medium text-foreground mb-3">Select template purpose:</p>
            <div className="flex flex-wrap gap-2">
              {AI_PURPOSES.map(p => (
                <button key={p} onClick={() => handleAIGenerate(p)}
                  className="px-3 py-1.5 text-xs bg-secondary hover:bg-primary/15 text-foreground rounded-lg transition-colors capitalize">
                  {p.replace(/_/g, " ")}
                </button>
              ))}
            </div>
            <button onClick={() => setShowPurposePicker(false)} className="mt-2 text-xs text-muted-foreground">Cancel</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Editor */}
      <AnimatePresence>
        {editing && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
            className="glass rounded-xl p-4 neural-border space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <input value={editing.name} onChange={e => setEditing({ ...editing, name: e.target.value })}
                placeholder="Template name" className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" />
              <input value={editing.description || ""} onChange={e => setEditing({ ...editing, description: e.target.value })}
                placeholder="Description" className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" />
            </div>
            <Textarea value={editing.voice_text} onChange={e => setEditing({ ...editing, voice_text: e.target.value })}
              placeholder="Voice text with {{variables}}..." className="bg-secondary border-border text-sm min-h-[80px]" />
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <select value={editing.category} onChange={e => setEditing({ ...editing, category: e.target.value })}
                className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border">
                {CATEGORIES.map(c => <option key={c.key} value={c.key}>{c.label}</option>)}
                <option value="general">General</option>
              </select>
              <select value={editing.tone} onChange={e => setEditing({ ...editing, tone: e.target.value })}
                className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border">
                <option value="soft">Soft</option>
                <option value="energetic">Energetic</option>
                <option value="calm">Calm</option>
              </select>
              <select value={editing.language} onChange={e => setEditing({ ...editing, language: e.target.value })}
                className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border">
                <option value="en">English</option>
                <option value="hi">Hindi</option>
              </select>
              <select value={editing.voice_id} onChange={e => setEditing({ ...editing, voice_id: e.target.value })}
                className="px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border">
                <option value="EXAVITQu4vr4xnSDxMaL">Sarah (Female)</option>
                <option value="Xb7hH8MSUJpSbSDYk0k2">Alice (Female)</option>
                <option value="nPczCjzI2devNBz1zQrb">Brian (Male)</option>
                <option value="onwK4e9ZLuTAKqWW03F9">Daniel (Male)</option>
              </select>
            </div>
            <input value={(editing.variables || []).join(", ")}
              onChange={e => setEditing({ ...editing, variables: e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean) })}
              placeholder="Variables (comma-separated): user_name, topic_name..."
              className="w-full px-3 py-2 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" />
            <div className="flex gap-2">
              <button onClick={save} disabled={saving || !editing.name || !editing.voice_text}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-50">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : editing.id ? "Update" : "Create"}
              </button>
              <button onClick={() => setEditing(null)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground">Cancel</button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : (
        <div className="space-y-2">
          {templates.map(t => (
            <div key={t.id} className="glass rounded-xl p-4 neural-border">
              <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-foreground">{t.name}</span>
                    <span className={`text-[10px] px-2 py-0.5 rounded-full ${getCategoryStyle(t.category)}`}>{t.category}</span>
                    <span className="text-[10px] text-muted-foreground">{t.tone} • {t.language}</span>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.voice_text}</p>
                  {t.variables?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {t.variables.map((v: string) => (
                        <span key={v} className="text-[10px] px-1.5 py-0.5 bg-primary/10 text-primary rounded">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1 flex-shrink-0">
                  <button onClick={() => setEditing(t)} className="p-1.5 rounded-lg hover:bg-secondary transition-colors text-muted-foreground">
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  <button onClick={() => remove(t.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 transition-colors text-destructive">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {templates.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No templates yet. Use AI Create to get started!</p>}
        </div>
      )}
    </div>
  );
};

// ─── Logs ───
const LogsTab = () => {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("voice_notification_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(100);
      setLogs(data || []);
      setLoading(false);
    })();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">Showing last 100 voice notifications</p>
      {logs.map(l => (
        <div key={l.id} className="glass rounded-xl p-3 neural-border">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.ai_generated ? "bg-purple-500/15 text-purple-400" : "bg-muted text-muted-foreground"}`}>
              {l.ai_generated ? "AI" : "Template"}
            </span>
            <span className="text-[10px] font-mono text-muted-foreground">{l.trigger_key || "direct"}</span>
            <span className={`text-[10px] px-2 py-0.5 rounded-full ${l.status === "sent" ? "bg-green-500/15 text-green-400" : l.status === "played" ? "bg-blue-500/15 text-blue-400" : "bg-red-500/15 text-red-400"}`}>
              {l.status}
            </span>
            <span className="text-[10px] text-muted-foreground">{l.tone} • {l.language}</span>
            <span className="text-[10px] text-muted-foreground ml-auto">{new Date(l.created_at).toLocaleString()}</span>
          </div>
          <p className="text-xs text-foreground mt-1 line-clamp-2">{l.voice_text}</p>
        </div>
      ))}
      {logs.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">No voice notifications sent yet</p>}
    </div>
  );
};

// ─── Queue ───
const QueueTab = () => {
  const [queue, setQueue] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("voice_notification_queue")
      .select("*")
      .order("scheduled_at", { ascending: false })
      .limit(50);
    setQueue(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const processQueue = async () => {
    setProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-automation-engine", {
        body: { action: "process_queue" },
      });
      if (error) throw error;
      toast({ title: `Processed ${data?.processed || 0} items` });
      load();
    } catch (e: any) {
      toast({ title: "Error", description: e.message, variant: "destructive" });
    } finally {
      setProcessing(false);
    }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <button onClick={processQueue} disabled={processing}
          className="flex items-center gap-2 px-4 py-2 bg-primary/15 text-primary rounded-lg text-sm font-medium hover:bg-primary/25 transition-colors disabled:opacity-50">
          {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
          Process Queue
        </button>
      </div>
      {queue.map(q => (
        <div key={q.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">{q.trigger_key || "direct"}</span>
              <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                q.status === "pending" ? "bg-yellow-500/15 text-yellow-400" :
                q.status === "completed" ? "bg-green-500/15 text-green-400" :
                q.status === "failed" ? "bg-red-500/15 text-red-400" : "bg-muted text-muted-foreground"
              }`}>{q.status}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">Scheduled: {new Date(q.scheduled_at).toLocaleString()}</p>
            {q.error_message && <p className="text-[10px] text-destructive mt-0.5">{q.error_message}</p>}
          </div>
          <span className="text-[10px] text-muted-foreground">Retries: {q.retry_count}/{q.max_retries}</span>
        </div>
      ))}
      {queue.length === 0 && <p className="text-center text-sm text-muted-foreground py-8">Queue is empty</p>}
    </div>
  );
};

export default VoiceNotificationManagement;
