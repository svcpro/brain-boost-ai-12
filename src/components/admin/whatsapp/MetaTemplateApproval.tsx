import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Shield, CheckCircle2, XCircle, Clock, Send, Loader2, Eye, Trash2,
  Plus, RefreshCw, AlertTriangle, Globe, FileText, MessageSquare,
  Star, Tag, ChevronRight, Copy, Edit3, Search, Filter,
  Sparkles, ArrowUpRight, BarChart3, Zap, Bot, Phone
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { formatDistanceToNow } from "date-fns";

const META_CATEGORIES = [
  { value: "UTILITY", label: "🔧 Utility", desc: "Order updates, account alerts, verification codes" },
  { value: "MARKETING", label: "📣 Marketing", desc: "Promotions, offers, product recommendations" },
  { value: "AUTHENTICATION", label: "🔐 Authentication", desc: "OTP, login codes, 2FA verification" },
];

const META_LANGUAGES = [
  { value: "en", label: "🇬🇧 English" }, { value: "en_US", label: "🇺🇸 English (US)" },
  { value: "hi", label: "🇮🇳 Hindi" }, { value: "es", label: "🇪🇸 Spanish" },
  { value: "fr", label: "🇫🇷 French" }, { value: "ar", label: "🇸🇦 Arabic" },
  { value: "pt_BR", label: "🇧🇷 Portuguese" }, { value: "de", label: "🇩🇪 German" },
];

const HEADER_TYPES = [
  { value: "NONE", label: "None" }, { value: "TEXT", label: "📝 Text" },
  { value: "IMAGE", label: "🖼️ Image" }, { value: "VIDEO", label: "🎥 Video" },
  { value: "DOCUMENT", label: "📄 Document" },
];

const BUTTON_TYPES = [
  { value: "NONE", label: "No Buttons" },
  { value: "QUICK_REPLY", label: "⚡ Quick Reply" },
  { value: "CALL_TO_ACTION", label: "🔗 Call to Action" },
];

const STATUS_CONFIG: Record<string, { bg: string; text: string; icon: any; label: string; pulse?: boolean }> = {
  draft: { bg: "bg-muted/50", text: "text-muted-foreground", icon: Edit3, label: "Draft" },
  pending: { bg: "bg-yellow-500/15", text: "text-yellow-500", icon: Clock, label: "Pending Review", pulse: true },
  submitted: { bg: "bg-blue-500/15", text: "text-blue-500", icon: Send, label: "Submitted to META" },
  approved: { bg: "bg-green-500/15", text: "text-green-500", icon: CheckCircle2, label: "Approved ✅" },
  rejected: { bg: "bg-destructive/15", text: "text-destructive", icon: XCircle, label: "Rejected ❌" },
  paused: { bg: "bg-orange-500/15", text: "text-orange-500", icon: AlertTriangle, label: "Paused ⏸️" },
  disabled: { bg: "bg-muted/30", text: "text-muted-foreground", icon: XCircle, label: "Disabled" },
  in_appeal: { bg: "bg-violet-500/15", text: "text-violet-500", icon: ArrowUpRight, label: "In Appeal 📩" },
};

const MetaStatusBadge = ({ status }: { status: string }) => {
  const c = STATUS_CONFIG[status] || STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-bold ${c.bg} ${c.text}`}>
      <c.icon className={`w-3 h-3 ${c.pulse ? "animate-pulse" : ""}`} />
      {c.label}
    </span>
  );
};

const QualityBadge = ({ score }: { score: string | null }) => {
  if (!score) return null;
  const config: Record<string, { color: string; emoji: string }> = {
    HIGH: { color: "text-green-500 bg-green-500/15", emoji: "🟢" },
    MEDIUM: { color: "text-yellow-500 bg-yellow-500/15", emoji: "🟡" },
    LOW: { color: "text-destructive bg-destructive/15", emoji: "🔴" },
    UNKNOWN: { color: "text-muted-foreground bg-muted/50", emoji: "⚪" },
  };
  const c = config[score] || config.UNKNOWN;
  return (
    <span className={`inline-flex items-center gap-1 text-[9px] px-2 py-0.5 rounded-full font-bold ${c.color}`}>
      {c.emoji} Quality: {score}
    </span>
  );
};

interface TemplateForm {
  template_name: string;
  display_name: string;
  category: string;
  language: string;
  header_type: string;
  header_content: string;
  body_text: string;
  footer_text: string;
  button_type: string;
  buttons: { type: string; text: string; url?: string; phone?: string }[];
  sample_values: Record<string, string>;
  tags: string;
  notes: string;
}

const EMPTY_FORM: TemplateForm = {
  template_name: "", display_name: "", category: "UTILITY", language: "en",
  header_type: "NONE", header_content: "", body_text: "", footer_text: "",
  button_type: "NONE", buttons: [], sample_values: {}, tags: "", notes: "",
};

const MetaTemplateApproval = () => {
  const { toast } = useToast();
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<"list" | "create" | "detail">("list");
  const [form, setForm] = useState<TemplateForm>(EMPTY_FORM);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [generatingAI, setGeneratingAI] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("meta_template_submissions")
      .select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const extractVariables = (text: string): string[] => {
    const matches = text.match(/\{\{(\d+)\}\}/g) || [];
    return [...new Set(matches)];
  };

  const stats = {
    total: templates.length,
    approved: templates.filter(t => t.meta_status === "approved").length,
    pending: templates.filter(t => ["pending", "submitted"].includes(t.meta_status)).length,
    rejected: templates.filter(t => t.meta_status === "rejected").length,
    drafts: templates.filter(t => t.meta_status === "draft").length,
  };

  const filteredTemplates = templates.filter(t => {
    if (filterStatus !== "all" && t.meta_status !== filterStatus) return false;
    if (searchQuery && !t.display_name?.toLowerCase().includes(searchQuery.toLowerCase()) &&
        !t.template_name?.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  });

  const saveTemplate = async (status: string = "draft") => {
    if (!form.template_name || !form.body_text) {
      toast({ title: "Template name and body are required", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const vars = extractVariables(form.body_text);
      const payload = {
        template_name: form.template_name.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        display_name: form.display_name || form.template_name,
        category: form.category,
        language: form.language,
        header_type: form.header_type,
        header_content: form.header_content || null,
        body_text: form.body_text,
        footer_text: form.footer_text || null,
        button_type: form.button_type,
        buttons: form.buttons.length > 0 ? form.buttons : null,
        sample_values: Object.keys(form.sample_values).length > 0 ? form.sample_values : null,
        tags: form.tags ? form.tags.split(",").map(t => t.trim()).filter(Boolean) : null,
        notes: form.notes || null,
        meta_status: status === "submitted" ? "draft" : status, // Save as draft first if submitting
        submitted_at: null,
      };

      let savedId = selectedTemplate?.id;

      if (selectedTemplate) {
        await (supabase as any).from("meta_template_submissions").update(payload).eq("id", selectedTemplate.id);
      } else {
        const { data: insertedData } = await (supabase as any).from("meta_template_submissions").insert(payload).select("id").single();
        savedId = insertedData?.id;
      }

      // If user wants to submit to META, call the real API
      if (status === "submitted" && savedId) {
        toast({ title: "Template saved. Submitting to META..." });
        const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
          body: {
            action: selectedTemplate?.meta_template_id ? "edit_template" : "create_template",
            template_id: savedId,
            template_data: payload,
          },
        });
        if (error) throw error;
        if (data?.error) throw new Error(data.error);
        toast({ title: "✅ Submitted to META!", description: `Template ID: ${data.meta_template_id}` });
      } else {
        toast({ title: "Template saved as draft ✅" });
      }

      setView("list");
      setForm(EMPTY_FORM);
      setSelectedTemplate(null);
      fetchTemplates();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    }
    setSaving(false);
  };

  const [syncing, setSyncing] = useState(false);
  const [deletingMeta, setDeletingMeta] = useState(false);

  const submitToMeta = async (id: string) => {
    setSubmitting(true);
    try {
      // Find the template data
      const template = templates.find(t => t.id === id);
      if (!template) throw new Error("Template not found");

      const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
        body: {
          action: "create_template",
          template_id: id,
          template_data: {
            template_name: template.template_name,
            category: template.category,
            language: template.language,
            header_type: template.header_type,
            header_content: template.header_content,
            body_text: template.body_text,
            footer_text: template.footer_text,
            button_type: template.button_type,
            buttons: template.buttons,
            sample_values: template.sample_values,
          },
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "📤 Template submitted to META!", description: `ID: ${data.meta_template_id} | Status: ${data.status}` });
      fetchTemplates();
    } catch (e: any) {
      toast({ title: "META submission failed", description: e.message, variant: "destructive" });
    }
    setSubmitting(false);
  };

  const syncWithMeta = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
        body: { action: "sync_status" },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      toast({ title: "🔄 Synced with META!", description: `${data.synced} templates synced. META has ${data.meta_total} total.` });
      fetchTemplates();
    } catch (e: any) {
      toast({ title: "Sync failed", description: e.message, variant: "destructive" });
    }
    setSyncing(false);
  };

  const updateStatus = async (id: string, status: string) => {
    const updates: any = { meta_status: status };
    if (status === "approved") updates.approved_at = new Date().toISOString();
    if (status === "rejected") updates.rejected_at = new Date().toISOString();
    await (supabase as any).from("meta_template_submissions").update(updates).eq("id", id);
    toast({ title: `Status updated to ${status}` });
    fetchTemplates();
  };

  const deleteTemplate = async (id: string) => {
    const template = templates.find(t => t.id === id);
    setDeletingMeta(true);
    try {
      // If it has a meta_template_id, also delete from META
      if (template?.meta_template_id && template?.template_name) {
        const { data, error } = await supabase.functions.invoke("meta-whatsapp-templates", {
          body: {
            action: "delete_template",
            template_id: id,
            template_data: { template_name: template.template_name },
          },
        });
        if (error) console.warn("META delete failed:", error);
      }
    } catch (e) {
      console.warn("META delete error:", e);
    }
    await (supabase as any).from("meta_template_submissions").delete().eq("id", id);
    toast({ title: "Template deleted" });
    if (selectedTemplate?.id === id) { setView("list"); setSelectedTemplate(null); }
    setDeletingMeta(false);
    fetchTemplates();
  };

  const duplicateTemplate = async (template: any) => {
    const { id, created_at, updated_at, meta_template_id, submitted_at, approved_at, rejected_at, last_synced_at, ...rest } = template;
    await (supabase as any).from("meta_template_submissions").insert({
      ...rest,
      template_name: `${rest.template_name}_copy`,
      display_name: `${rest.display_name} (Copy)`,
      meta_status: "draft",
    });
    toast({ title: "Template duplicated as draft ✅" });
    fetchTemplates();
  };

  const generateAIBody = async () => {
    if (!form.display_name && !form.template_name) {
      toast({ title: "Enter a template name first", variant: "destructive" });
      return;
    }
    setGeneratingAI(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
        body: {
          action: "generate_single",
          trigger_key: form.template_name || "custom",
          channel: "push",
          custom_context: `Generate a META-compliant WhatsApp Business template body for: "${form.display_name || form.template_name}". Category: ${form.category}.

STRICT META RULES:
- Use {{1}}, {{2}}, {{3}} numbered placeholders (NOT named variables)
- Max 1024 chars for body
- No emojis in first line if category is AUTHENTICATION  
- Professional, clear, concise language
- Must pass META's automated review
- Include a clear value proposition
- For MARKETING: engaging, personalized
- For UTILITY: informative, action-oriented
- For AUTHENTICATION: minimal, security-focused

Return just the template body text, nothing else.`,
        },
      });
      if (error) throw error;
      const body = (data.html_body || data.subject || "").replace(/<[^>]+>/g, "").slice(0, 1024);
      setForm(prev => ({ ...prev, body_text: body }));
      toast({ title: "AI body generated! Review & edit before submitting 🤖" });
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e.message, variant: "destructive" });
    }
    setGeneratingAI(false);
  };

  const openDetail = (t: any) => {
    setSelectedTemplate(t);
    setView("detail");
  };

  const openEdit = (t: any) => {
    setSelectedTemplate(t);
    setForm({
      template_name: t.template_name,
      display_name: t.display_name,
      category: t.category,
      language: t.language,
      header_type: t.header_type || "NONE",
      header_content: t.header_content || "",
      body_text: t.body_text,
      footer_text: t.footer_text || "",
      button_type: t.button_type || "NONE",
      buttons: t.buttons || [],
      sample_values: t.sample_values || {},
      tags: (t.tags || []).join(", "),
      notes: t.notes || "",
    });
    setView("create");
  };

  const addButton = () => {
    if (form.buttons.length >= 3) return;
    setForm(prev => ({
      ...prev,
      buttons: [...prev.buttons, { type: form.button_type === "QUICK_REPLY" ? "QUICK_REPLY" : "URL", text: "", url: "" }],
    }));
  };

  const updateButton = (index: number, field: string, value: string) => {
    setForm(prev => ({
      ...prev,
      buttons: prev.buttons.map((b, i) => i === index ? { ...b, [field]: value } : b),
    }));
  };

  const removeButton = (index: number) => {
    setForm(prev => ({ ...prev, buttons: prev.buttons.filter((_, i) => i !== index) }));
  };

  // ─── RENDER ───
  return (
    <div className="space-y-4">
      {/* Hero Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: FileText, gradient: "from-blue-500/20 to-blue-600/5", color: "text-blue-500", border: "border-blue-500/20" },
          { label: "Approved", value: stats.approved, icon: CheckCircle2, gradient: "from-green-500/20 to-green-600/5", color: "text-green-500", border: "border-green-500/20" },
          { label: "Pending", value: stats.pending, icon: Clock, gradient: "from-yellow-500/20 to-yellow-600/5", color: "text-yellow-500", border: "border-yellow-500/20" },
          { label: "Rejected", value: stats.rejected, icon: XCircle, gradient: "from-red-500/20 to-red-600/5", color: "text-destructive", border: "border-red-500/20" },
          { label: "Drafts", value: stats.drafts, icon: Edit3, gradient: "from-muted/50 to-muted/20", color: "text-muted-foreground", border: "border-border" },
        ].map(m => (
          <motion.div key={m.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className={`relative overflow-hidden rounded-xl border ${m.border} bg-gradient-to-br ${m.gradient} p-3`}>
            <m.icon className={`w-4 h-4 ${m.color} mb-1.5`} />
            <p className="text-xl font-bold text-foreground">{m.value}</p>
            <p className="text-[10px] text-muted-foreground">{m.label}</p>
          </motion.div>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {/* ─── LIST VIEW ─── */}
        {view === "list" && (
          <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-4">
            {/* Actions Bar */}
            <div className="flex flex-wrap items-center gap-3">
              <button onClick={() => { setForm(EMPTY_FORM); setSelectedTemplate(null); setView("create"); }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 shadow-lg shadow-green-600/20 transition-all">
                <Plus className="w-4 h-4" /> New META Template
              </button>
              <button onClick={syncWithMeta} disabled={syncing}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 text-white hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-600/20 transition-all disabled:opacity-50">
                {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                Sync with META
              </button>
              <button onClick={fetchTemplates} className="p-2.5 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
              </button>
              <div className="flex-1 min-w-[200px] relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search templates..."
                  className="w-full pl-10 pr-3 py-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
              </div>
              <div className="flex gap-1.5 flex-wrap">
                {["all", "draft", "submitted", "approved", "rejected", "paused"].map(s => (
                  <button key={s} onClick={() => setFilterStatus(s)}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-all ${
                      filterStatus === s ? "bg-green-600/15 text-green-500 border border-green-500/30" : "bg-secondary/50 text-muted-foreground border border-transparent hover:border-border"
                    }`}>
                    {s === "all" ? "All" : (STATUS_CONFIG[s]?.label || s)}
                  </button>
                ))}
              </div>
            </div>

            {/* META Compliance Tips */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-2xl p-4">
              <div className="flex items-start gap-3">
                <Shield className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-blue-500">META Template Guidelines</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 mt-2">
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground">📋 Naming:</span> Lowercase, underscores only. Example: <code className="text-blue-400 bg-secondary px-1 rounded">order_confirmation</code>
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground">🔢 Variables:</span> Use numbered <code className="text-blue-400 bg-secondary px-1 rounded">{"{{1}}"}, {"{{2}}"}</code> format only
                    </div>
                    <div className="text-[11px] text-muted-foreground">
                      <span className="font-bold text-foreground">⏱️ Review:</span> META reviews within 24-48 hours typically
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Template List */}
            {loading ? (
              <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
            ) : filteredTemplates.length === 0 ? (
              <div className="text-center py-16 bg-card border border-border rounded-2xl">
                <Shield className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
                <p className="text-sm font-bold text-foreground">No META templates yet</p>
                <p className="text-xs text-muted-foreground mt-1">Create your first template to submit to META for approval</p>
              </div>
            ) : (
              <div className="space-y-2">
                {filteredTemplates.map((t, i) => (
                  <motion.div key={t.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.03 }}
                    className="bg-card border border-border rounded-2xl p-4 hover:border-green-500/20 transition-all group cursor-pointer"
                    onClick={() => openDetail(t)}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap mb-1">
                          <span className="text-sm font-bold text-foreground">{t.display_name}</span>
                          <MetaStatusBadge status={t.meta_status} />
                          <QualityBadge score={t.quality_score} />
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold uppercase">{t.category}</span>
                          <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{META_LANGUAGES.find(l => l.value === t.language)?.label || t.language}</span>
                        </div>
                        <code className="text-[10px] text-muted-foreground font-mono">{t.template_name}</code>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{t.body_text}</p>
                        {t.tags?.length > 0 && (
                          <div className="flex gap-1 mt-1.5 flex-wrap">
                            {t.tags.map((tag: string) => (
                              <span key={tag} className="text-[8px] px-1.5 py-0.5 rounded-full bg-green-500/10 text-green-500 font-bold">{tag}</span>
                            ))}
                          </div>
                        )}
                        <div className="flex items-center gap-3 mt-2 text-[10px] text-muted-foreground">
                          {t.submitted_at && <span>📤 Submitted {formatDistanceToNow(new Date(t.submitted_at), { addSuffix: true })}</span>}
                          {t.approved_at && <span>✅ Approved {formatDistanceToNow(new Date(t.approved_at), { addSuffix: true })}</span>}
                          {t.rejected_at && <span>❌ Rejected {formatDistanceToNow(new Date(t.rejected_at), { addSuffix: true })}</span>}
                          {t.message_sends_total > 0 && <span>📊 {t.message_sends_total} sends</span>}
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                        {t.meta_status === "draft" && (
                          <button onClick={(e) => { e.stopPropagation(); submitToMeta(t.id); }} disabled={submitting}
                            className="p-2 rounded-lg hover:bg-green-500/10 text-muted-foreground hover:text-green-500 transition-colors" title="Submit to META">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        <button onClick={(e) => { e.stopPropagation(); openEdit(t); }}
                          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Edit">
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); duplicateTemplate(t); }}
                          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition-colors" title="Duplicate">
                          <Copy className="w-4 h-4" />
                        </button>
                        <button onClick={(e) => { e.stopPropagation(); deleteTemplate(t.id); }}
                          className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                        <ChevronRight className="w-4 h-4 text-muted-foreground" />
                      </div>
                    </div>
                    {t.rejection_reason && (
                      <div className="mt-3 bg-destructive/10 border border-destructive/20 rounded-xl p-3 flex items-start gap-2">
                        <XCircle className="w-4 h-4 text-destructive flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-[10px] font-bold text-destructive">Rejection Reason:</p>
                          <p className="text-[11px] text-muted-foreground">{t.rejection_reason}</p>
                        </div>
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}

        {/* ─── CREATE / EDIT VIEW ─── */}
        {view === "create" && (
          <motion.div key="create" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setView("list"); setForm(EMPTY_FORM); setSelectedTemplate(null); }}
                className="p-2 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
              <h3 className="text-sm font-bold text-foreground">{selectedTemplate ? "Edit META Template" : "Create New META Template"}</h3>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Left: Form */}
              <div className="space-y-3">
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2"><FileText className="w-3.5 h-3.5 text-green-500" /> Template Info</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Template Name *</label>
                      <input value={form.template_name} onChange={e => setForm(p => ({ ...p, template_name: e.target.value }))}
                        placeholder="order_confirmation"
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50 font-mono" />
                      <p className="text-[9px] text-muted-foreground mt-0.5">Lowercase, underscores only</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Display Name</label>
                      <input value={form.display_name} onChange={e => setForm(p => ({ ...p, display_name: e.target.value }))}
                        placeholder="Order Confirmation"
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Category *</label>
                      <select value={form.category} onChange={e => setForm(p => ({ ...p, category: e.target.value }))}
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
                        {META_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{META_CATEGORIES.find(c => c.value === form.category)?.desc}</p>
                    </div>
                    <div>
                      <label className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Language</label>
                      <select value={form.language} onChange={e => setForm(p => ({ ...p, language: e.target.value }))}
                        className="w-full mt-1 p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
                        {META_LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                      </select>
                    </div>
                  </div>
                </div>

                {/* Header */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2">📎 Header (Optional)</h4>
                  <select value={form.header_type} onChange={e => setForm(p => ({ ...p, header_type: e.target.value }))}
                    className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
                    {HEADER_TYPES.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                  {form.header_type !== "NONE" && (
                    <input value={form.header_content} onChange={e => setForm(p => ({ ...p, header_content: e.target.value }))}
                      placeholder={form.header_type === "TEXT" ? "Header text..." : "Media URL..."}
                      className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                  )}
                </div>

                {/* Body */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-foreground flex items-center gap-2">💬 Body *</h4>
                    <button onClick={generateAIBody} disabled={generatingAI}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-bold bg-gradient-to-r from-green-600 to-emerald-600 text-white hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 transition-all">
                      {generatingAI ? <Loader2 className="w-3 h-3 animate-spin" /> : <Bot className="w-3 h-3" />}
                      AI Generate
                    </button>
                  </div>
                  <textarea value={form.body_text} onChange={e => setForm(p => ({ ...p, body_text: e.target.value }))}
                    placeholder="Hello {{1}}, your order {{2}} has been confirmed! Expected delivery: {{3}}"
                    className="w-full p-3 rounded-xl bg-secondary/50 border border-border text-sm min-h-[140px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                  <div className="flex items-center justify-between">
                    <p className="text-[9px] text-muted-foreground">Use {"{{1}}"}, {"{{2}}"}, {"{{3}}"} for dynamic variables. Max 1024 chars.</p>
                    <span className={`text-[10px] font-bold ${form.body_text.length > 1024 ? "text-destructive" : "text-muted-foreground"}`}>
                      {form.body_text.length}/1024
                    </span>
                  </div>
                  {extractVariables(form.body_text).length > 0 && (
                    <div className="flex gap-1.5 flex-wrap">
                      {extractVariables(form.body_text).map(v => (
                        <span key={v} className="text-[9px] px-2 py-0.5 rounded-full bg-green-500/15 text-green-500 font-bold font-mono">{v}</span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Footer */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground">📝 Footer (Optional)</h4>
                  <input value={form.footer_text} onChange={e => setForm(p => ({ ...p, footer_text: e.target.value }))}
                    placeholder="Reply STOP to unsubscribe"
                    className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                  <p className="text-[9px] text-muted-foreground">Max 60 chars. No variables allowed in footer.</p>
                </div>

                {/* Buttons */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground">🔘 Buttons (Optional)</h4>
                  <select value={form.button_type} onChange={e => setForm(p => ({ ...p, button_type: e.target.value, buttons: [] }))}
                    className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none text-foreground">
                    {BUTTON_TYPES.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
                  </select>
                  {form.button_type !== "NONE" && (
                    <div className="space-y-2">
                      {form.buttons.map((btn, i) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input value={btn.text} onChange={e => updateButton(i, "text", e.target.value)}
                            placeholder="Button text" className="flex-1 p-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none" />
                          {form.button_type === "CALL_TO_ACTION" && (
                            <input value={btn.url || ""} onChange={e => updateButton(i, "url", e.target.value)}
                              placeholder="https://..." className="flex-1 p-2 rounded-lg bg-secondary/50 border border-border text-sm focus:outline-none" />
                          )}
                          <button onClick={() => removeButton(i)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                      {form.buttons.length < 3 && (
                        <button onClick={addButton} className="flex items-center gap-1.5 text-[10px] font-bold text-green-500 hover:text-green-400 transition-colors">
                          <Plus className="w-3 h-3" /> Add Button (max 3)
                        </button>
                      )}
                    </div>
                  )}
                </div>

                {/* Tags & Notes */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2"><Tag className="w-3.5 h-3.5 text-green-500" /> Tags & Notes</h4>
                  <input value={form.tags} onChange={e => setForm(p => ({ ...p, tags: e.target.value }))}
                    placeholder="onboarding, transactional, neet"
                    className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                  <textarea value={form.notes} onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
                    placeholder="Internal notes about this template..."
                    className="w-full p-2.5 rounded-xl bg-secondary/50 border border-border text-sm min-h-[60px] resize-none focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => saveTemplate("draft")} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors disabled:opacity-50">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Edit3 className="w-4 h-4" />}
                    Save as Draft
                  </button>
                  <button onClick={() => saveTemplate("submitted")} disabled={saving}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-green-600 to-emerald-600 text-white font-semibold text-sm hover:from-green-700 hover:to-emerald-700 disabled:opacity-50 shadow-lg shadow-green-600/20 transition-all">
                    {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    Submit to META
                  </button>
                </div>
              </div>

              {/* Right: Live Preview */}
              <div className="space-y-3">
                <div className="bg-card border border-green-500/20 rounded-2xl p-5 sticky top-4">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3">
                    <Eye className="w-3.5 h-3.5 text-green-500" /> Live WhatsApp Preview
                  </h4>
                  <div className="bg-[#0b141a] rounded-2xl p-4 min-h-[300px]">
                    {/* WhatsApp bubble */}
                    <div className="bg-[#005c4b] rounded-xl rounded-tl-sm p-3 max-w-[90%] ml-auto">
                      {form.header_type === "TEXT" && form.header_content && (
                        <p className="text-white font-bold text-sm mb-1">{form.header_content}</p>
                      )}
                      {form.header_type === "IMAGE" && (
                        <div className="bg-[#003d33] rounded-lg p-6 text-center mb-2">
                          <span className="text-[10px] text-green-300/50">🖼️ Image Header</span>
                        </div>
                      )}
                      <p className="text-white text-[13px] whitespace-pre-wrap leading-relaxed">
                        {form.body_text || "Your message will appear here..."}
                      </p>
                      {form.footer_text && (
                        <p className="text-green-300/50 text-[10px] mt-2">{form.footer_text}</p>
                      )}
                      <p className="text-green-300/30 text-[9px] text-right mt-1">
                        {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                      </p>
                    </div>
                    {/* Buttons Preview */}
                    {form.buttons.length > 0 && (
                      <div className="mt-1 max-w-[90%] ml-auto space-y-0.5">
                        {form.buttons.map((btn, i) => (
                          <div key={i} className="bg-[#005c4b] rounded-lg p-2 text-center">
                            <span className="text-blue-300 text-xs font-medium flex items-center justify-center gap-1">
                              {form.button_type === "CALL_TO_ACTION" ? <ArrowUpRight className="w-3 h-3" /> : <Zap className="w-3 h-3" />}
                              {btn.text || `Button ${i + 1}`}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Variable Samples */}
                  {extractVariables(form.body_text).length > 0 && (
                    <div className="mt-4 space-y-2">
                      <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Sample Values (for META review)</h5>
                      {extractVariables(form.body_text).map(v => (
                        <div key={v} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-green-500 w-12">{v}</span>
                          <input value={form.sample_values[v] || ""} onChange={e => setForm(p => ({
                            ...p, sample_values: { ...p.sample_values, [v]: e.target.value }
                          }))} placeholder={`Sample for ${v}`}
                            className="flex-1 p-2 rounded-lg bg-secondary/50 border border-border text-xs focus:outline-none focus:ring-2 focus:ring-green-500/50" />
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Compliance Check */}
                  <div className="mt-4 space-y-1.5">
                    <h5 className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider">Compliance Check</h5>
                    {[
                      { label: "Template name format", ok: /^[a-z][a-z0-9_]*$/.test(form.template_name) },
                      { label: "Body text provided", ok: form.body_text.length > 0 },
                      { label: "Body within 1024 chars", ok: form.body_text.length <= 1024 },
                      { label: "Footer within 60 chars", ok: !form.footer_text || form.footer_text.length <= 60 },
                      { label: "Max 3 buttons", ok: form.buttons.length <= 3 },
                      { label: "Category selected", ok: !!form.category },
                      { label: "No HTML tags in body", ok: !/<[^>]+>/.test(form.body_text) },
                    ].map(check => (
                      <div key={check.label} className="flex items-center gap-2">
                        {check.ok ? (
                          <CheckCircle2 className="w-3 h-3 text-green-500" />
                        ) : (
                          <XCircle className="w-3 h-3 text-destructive" />
                        )}
                        <span className={`text-[10px] ${check.ok ? "text-muted-foreground" : "text-destructive font-bold"}`}>{check.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* ─── DETAIL VIEW ─── */}
        {view === "detail" && selectedTemplate && (
          <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} className="space-y-4">
            <div className="flex items-center gap-3">
              <button onClick={() => { setView("list"); setSelectedTemplate(null); }}
                className="p-2 rounded-xl bg-secondary/50 border border-border hover:bg-secondary transition-colors">
                <ChevronRight className="w-4 h-4 text-muted-foreground rotate-180" />
              </button>
              <div className="flex-1">
                <h3 className="text-sm font-bold text-foreground">{selectedTemplate.display_name}</h3>
                <code className="text-[10px] text-muted-foreground font-mono">{selectedTemplate.template_name}</code>
              </div>
              <MetaStatusBadge status={selectedTemplate.meta_status} />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <div className="space-y-3">
                {/* Template Details */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground">📋 Template Details</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/50 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Category</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{META_CATEGORIES.find(c => c.value === selectedTemplate.category)?.label}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Language</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{META_LANGUAGES.find(l => l.value === selectedTemplate.language)?.label}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Header</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{selectedTemplate.header_type || "None"}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground uppercase tracking-wider">Buttons</p>
                      <p className="text-sm font-bold text-foreground mt-0.5">{selectedTemplate.buttons?.length || 0}</p>
                    </div>
                  </div>
                  {selectedTemplate.meta_template_id && (
                    <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground">META Template ID</p>
                      <code className="text-xs font-mono text-green-500">{selectedTemplate.meta_template_id}</code>
                    </div>
                  )}
                </div>

                {/* Usage Stats */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2"><BarChart3 className="w-3.5 h-3.5 text-green-500" /> Usage</h4>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-secondary/50 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground">Last 24h</p>
                      <p className="text-lg font-bold text-foreground">{selectedTemplate.message_sends_24h || 0}</p>
                    </div>
                    <div className="bg-secondary/50 rounded-xl p-3">
                      <p className="text-[9px] text-muted-foreground">Total Sends</p>
                      <p className="text-lg font-bold text-foreground">{selectedTemplate.message_sends_total || 0}</p>
                    </div>
                  </div>
                </div>

                {/* Status Management */}
                <div className="bg-card border border-border rounded-2xl p-5 space-y-3">
                  <h4 className="text-xs font-bold text-foreground flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-green-500" /> Status Management</h4>
                  <div className="flex gap-2 flex-wrap">
                    {["draft", "submitted", "approved", "rejected", "paused", "in_appeal"].map(s => (
                      <button key={s} onClick={() => updateStatus(selectedTemplate.id, s)}
                        disabled={selectedTemplate.meta_status === s}
                        className={`px-3 py-2 rounded-xl text-[10px] font-bold transition-all disabled:opacity-30 ${
                          selectedTemplate.meta_status === s
                            ? "bg-green-600/15 text-green-500 border border-green-500/30"
                            : "bg-secondary/50 text-muted-foreground border border-border hover:border-green-500/20"
                        }`}>
                        {STATUS_CONFIG[s]?.label || s}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <button onClick={() => openEdit(selectedTemplate)}
                    className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-secondary text-foreground font-semibold text-sm hover:bg-secondary/80 transition-colors">
                    <Edit3 className="w-4 h-4" /> Edit Template
                  </button>
                  <button onClick={() => duplicateTemplate(selectedTemplate)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-secondary/50 text-muted-foreground hover:text-foreground transition-colors border border-border">
                    <Copy className="w-4 h-4" /> Duplicate
                  </button>
                  <button onClick={() => deleteTemplate(selectedTemplate.id)}
                    className="flex items-center gap-2 px-4 py-3 rounded-xl bg-destructive/10 text-destructive hover:bg-destructive/20 transition-colors border border-destructive/20">
                    <Trash2 className="w-4 h-4" /> Delete
                  </button>
                </div>
              </div>

              {/* Right: Preview */}
              <div className="bg-card border border-green-500/20 rounded-2xl p-5 sticky top-4">
                <h4 className="text-xs font-bold text-foreground flex items-center gap-2 mb-3">
                  <Eye className="w-3.5 h-3.5 text-green-500" /> WhatsApp Preview
                </h4>
                <div className="bg-[#0b141a] rounded-2xl p-4">
                  <div className="bg-[#005c4b] rounded-xl rounded-tl-sm p-3 max-w-[90%] ml-auto">
                    {selectedTemplate.header_type === "TEXT" && selectedTemplate.header_content && (
                      <p className="text-white font-bold text-sm mb-1">{selectedTemplate.header_content}</p>
                    )}
                    {selectedTemplate.header_type === "IMAGE" && (
                      <div className="bg-[#003d33] rounded-lg p-6 text-center mb-2">
                        <span className="text-[10px] text-green-300/50">🖼️ Image Header</span>
                      </div>
                    )}
                    <p className="text-white text-[13px] whitespace-pre-wrap leading-relaxed">{selectedTemplate.body_text}</p>
                    {selectedTemplate.footer_text && (
                      <p className="text-green-300/50 text-[10px] mt-2">{selectedTemplate.footer_text}</p>
                    )}
                    <p className="text-green-300/30 text-[9px] text-right mt-1">
                      {new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })} ✓✓
                    </p>
                  </div>
                  {selectedTemplate.buttons?.length > 0 && (
                    <div className="mt-1 max-w-[90%] ml-auto space-y-0.5">
                      {selectedTemplate.buttons.map((btn: any, i: number) => (
                        <div key={i} className="bg-[#005c4b] rounded-lg p-2 text-center">
                          <span className="text-blue-300 text-xs font-medium">{btn.text}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {selectedTemplate.rejection_reason && (
                  <div className="mt-4 bg-destructive/10 border border-destructive/20 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-destructive flex items-center gap-1"><XCircle className="w-3 h-3" /> Rejection Reason</p>
                    <p className="text-[11px] text-muted-foreground mt-1">{selectedTemplate.rejection_reason}</p>
                  </div>
                )}

                {selectedTemplate.notes && (
                  <div className="mt-3 bg-secondary/50 rounded-xl p-3">
                    <p className="text-[10px] font-bold text-muted-foreground">📝 Notes</p>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{selectedTemplate.notes}</p>
                  </div>
                )}

                <div className="mt-3 text-[9px] text-muted-foreground space-y-0.5">
                  <p>Created: {formatDistanceToNow(new Date(selectedTemplate.created_at), { addSuffix: true })}</p>
                  <p>Updated: {formatDistanceToNow(new Date(selectedTemplate.updated_at), { addSuffix: true })}</p>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default MetaTemplateApproval;
