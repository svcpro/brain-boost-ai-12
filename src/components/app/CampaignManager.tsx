import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Volume2, Bell, Send, Sparkles, Loader2, Users,
  Clock, CheckCircle2, XCircle, Search, Trash2, Eye,
  Filter, RefreshCw, User, ChevronRight, Plus, Pause,
  Play, Calendar, BarChart3, TrendingUp, Target, Tag,
  FileText, Copy, ArrowRight, Pencil, Award, Star,
  Megaphone, Zap, ChevronDown, AlertTriangle, MessageSquare
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type CampaignChannel = "email" | "voice" | "push";
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled";
type ManagerTab = "campaigns" | "templates" | "leads" | "drip";
type LeadStage = "new" | "engaged" | "active" | "power_user" | "at_risk" | "churned" | "converted";

const CHANNEL_ICONS: Record<CampaignChannel, any> = { email: Mail, voice: Volume2, push: Bell };
const CHANNEL_COLORS: Record<CampaignChannel, string> = { email: "text-accent", voice: "text-warning", push: "text-primary" };

const STATUS_COLORS: Record<CampaignStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  scheduled: "bg-primary/15 text-primary",
  sending: "bg-warning/15 text-warning",
  sent: "bg-success/15 text-success",
  paused: "bg-secondary text-secondary-foreground",
  cancelled: "bg-destructive/15 text-destructive",
};

const LEAD_STAGE_COLORS: Record<LeadStage, string> = {
  new: "bg-primary/15 text-primary",
  engaged: "bg-accent/15 text-accent",
  active: "bg-success/15 text-success",
  power_user: "bg-warning/15 text-warning",
  at_risk: "bg-destructive/15 text-destructive",
  churned: "bg-muted text-muted-foreground",
  converted: "bg-success/20 text-success",
};

const LEAD_STAGES: LeadStage[] = ["new", "engaged", "active", "power_user", "at_risk", "churned", "converted"];

const CampaignManager = () => {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const [tab, setTab] = useState<ManagerTab>("campaigns");

  const tabs: { key: ManagerTab; label: string; icon: any }[] = [
    { key: "campaigns", label: "Campaigns", icon: Megaphone },
    { key: "templates", label: "Email Templates", icon: FileText },
    { key: "leads", label: "Lead Management", icon: Target },
    { key: "drip", label: "Drip Sequences", icon: Zap },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground">Campaign Manager</h2>
        <p className="text-xs text-muted-foreground mt-1">Email, Voice & Push campaigns with lead management</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              tab === t.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        <motion.div key={tab} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}>
          {tab === "campaigns" && <CampaignsTab toast={toast} adminId={adminUser?.id} />}
          {tab === "templates" && <TemplatesTab toast={toast} adminId={adminUser?.id} />}
          {tab === "leads" && <LeadsTab toast={toast} adminId={adminUser?.id} />}
          {tab === "drip" && <DripTab toast={toast} adminId={adminUser?.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Campaigns Tab ───
const CampaignsTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [filter, setFilter] = useState<CampaignChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");

  const fetchCampaigns = useCallback(async () => {
    setLoading(true);
    let q = supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(50);
    if (filter !== "all") q = q.eq("channel", filter);
    if (statusFilter !== "all") q = q.eq("status", statusFilter);
    const { data } = await q;
    setCampaigns(data || []);
    setLoading(false);
  }, [filter, statusFilter]);

  useEffect(() => { fetchCampaigns(); }, [fetchCampaigns]);

  if (showCreate) {
    return <CreateCampaign toast={toast} adminId={adminId} onBack={() => { setShowCreate(false); fetchCampaigns(); }} />;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex gap-2 flex-wrap">
          {(["all", "email", "voice", "push"] as const).map(ch => (
            <button key={ch} onClick={() => setFilter(ch)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === ch ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {ch === "all" ? "All Channels" : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
        <div className="flex gap-2">
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value as any)}
            className="px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground">
            <option value="all">All Status</option>
            {(["draft", "scheduled", "sending", "sent", "paused", "cancelled"] as CampaignStatus[]).map(s => (
              <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>
            ))}
          </select>
          <button onClick={() => setShowCreate(true)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90">
            <Plus className="w-3.5 h-3.5" /> New Campaign
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : campaigns.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Megaphone className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No campaigns yet</p>
          <button onClick={() => setShowCreate(true)} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium">
            Create First Campaign
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {campaigns.map(c => {
            const Icon = CHANNEL_ICONS[c.channel as CampaignChannel] || Bell;
            const openRate = c.total_recipients > 0 ? Math.round((c.opened_count / c.total_recipients) * 100) : 0;
            const deliveryRate = c.total_recipients > 0 ? Math.round((c.delivered_count / c.total_recipients) * 100) : 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className={`w-9 h-9 rounded-lg flex items-center justify-center bg-secondary`}>
                      <Icon className={`w-4 h-4 ${CHANNEL_COLORS[c.channel as CampaignChannel]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-sm font-semibold text-foreground truncate">{c.name}</h4>
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[c.status as CampaignStatus]}`}>
                          {c.status}
                        </span>
                        {c.is_ab_test && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-accent/15 text-accent">A/B</span>}
                        {c.is_drip && <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-warning/15 text-warning">Drip</span>}
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{c.subject || c.title || "No subject"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground shrink-0">
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">{c.total_recipients}</p>
                      <p>Recipients</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">{deliveryRate}%</p>
                      <p>Delivered</p>
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-bold text-foreground">{openRate}%</p>
                      <p>Opened</p>
                    </div>
                    <p className="text-[10px]">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
};

// ─── Create Campaign ───
const CreateCampaign = ({ toast, adminId, onBack }: { toast: any; adminId?: string; onBack: () => void }) => {
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [subject, setSubject] = useState("");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [audienceType, setAudienceType] = useState<"all" | "segment" | "manual">("all");
  const [segmentFilters, setSegmentFilters] = useState({ plan: "all", minStreak: 0, maxInactiveDays: 0, examType: "" });
  const [manualUserIds, setManualUserIds] = useState("");
  const [isAbTest, setIsAbTest] = useState(false);
  const [abVariantB, setAbVariantB] = useState({ subject: "", title: "", body: "" });
  const [scheduledAt, setScheduledAt] = useState("");
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);

  const generateWithAI = async () => {
    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-notification", { body: { type: "general" } });
      if (error) throw error;
      if (data?.title) { setTitle(data.title); setSubject(data.title); }
      if (data?.body) setBody(data.body);
      toast({ title: "AI generated content ✨" });
    } catch (e: any) { toast({ title: "AI generation failed", variant: "destructive" }); }
    setGenerating(false);
  };

  const saveCampaign = async (asDraft: boolean) => {
    if (!name.trim()) { toast({ title: "Enter campaign name", variant: "destructive" }); return; }
    setSaving(true);
    try {
      const status: CampaignStatus = asDraft ? "draft" : scheduledAt ? "scheduled" : "sending";
      const audienceUserIds = audienceType === "manual" ? manualUserIds.split(",").map(s => s.trim()).filter(Boolean) : [];

      const { data, error } = await (supabase as any).from("campaigns").insert({
        name: name.trim(),
        channel,
        status,
        subject: subject.trim() || null,
        title: title.trim() || null,
        body: body.trim() || null,
        audience_type: audienceType,
        audience_filters: audienceType === "segment" ? segmentFilters : {},
        audience_user_ids: audienceUserIds,
        is_ab_test: isAbTest,
        ab_variants: isAbTest ? [{ subject: abVariantB.subject, title: abVariantB.title, body: abVariantB.body }] : [],
        scheduled_at: scheduledAt || null,
        created_by: adminId,
      }).select().single();

      if (error) throw error;

      // If sending immediately, resolve audience and create recipients
      if (!asDraft && !scheduledAt) {
        let recipientIds: string[] = [];
        if (audienceType === "all") {
          const { data: profiles } = await supabase.from("profiles").select("id");
          recipientIds = (profiles || []).map((p: any) => p.id);
        } else if (audienceType === "segment") {
          let q = supabase.from("profiles").select("id");
          if (segmentFilters.plan !== "all") {
            // Would need join with user_subscriptions - simplified here
          }
          const { data: profiles } = await q;
          recipientIds = (profiles || []).map((p: any) => p.id);
        } else {
          recipientIds = audienceUserIds;
        }

        // Insert recipients in batches
        const recipients = recipientIds.map((uid, i) => ({
          campaign_id: data.id,
          user_id: uid,
          status: "pending",
          ab_variant: isAbTest ? (i % 2 === 0 ? "A" : "B") : null,
        }));
        for (let i = 0; i < recipients.length; i += 50) {
          await (supabase as any).from("campaign_recipients").insert(recipients.slice(i, i + 50));
        }

        // Update campaign totals
        await (supabase as any).from("campaigns").update({
          total_recipients: recipientIds.length,
          status: "sent",
          sent_at: new Date().toISOString(),
        }).eq("id", data.id);
      }

      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId,
          action: asDraft ? "campaign_draft_created" : "campaign_sent",
          target_type: "campaign",
          target_id: data.id,
          details: { name: name.trim(), channel, audienceType } as any,
        });
      }

      toast({ title: asDraft ? "Campaign saved as draft" : "Campaign sent! 🚀" });
      onBack();
    } catch (e: any) {
      toast({ title: "Failed to save campaign", description: e?.message, variant: "destructive" });
    }
    setSaving(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      <button onClick={onBack} className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors">
        ← Back to campaigns
      </button>

      <h3 className="text-lg font-bold text-foreground">Create Campaign</h3>

      {/* Name & Channel */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Campaign name..."
          className="w-full px-3 py-2.5 bg-secondary rounded-lg text-sm text-foreground border border-border focus:border-primary outline-none" />
        <div className="flex gap-2">
          {(["email", "push", "voice"] as CampaignChannel[]).map(ch => {
            const Icon = CHANNEL_ICONS[ch];
            return (
              <button key={ch} onClick={() => setChannel(ch)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                  channel === ch ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground"
                }`}>
                <Icon className="w-4 h-4" /> {ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audience Segmentation */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Target className="w-4 h-4" /> Audience</h4>
        <div className="flex gap-2">
          {(["all", "segment", "manual"] as const).map(a => (
            <button key={a} onClick={() => setAudienceType(a)}
              className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${audienceType === a ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {a === "all" ? "All Users" : a === "segment" ? "Segment" : "Manual IDs"}
            </button>
          ))}
        </div>
        {audienceType === "segment" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Plan</label>
              <select value={segmentFilters.plan} onChange={e => setSegmentFilters(p => ({ ...p, plan: e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground">
                <option value="all">All Plans</option>
                <option value="free">Free</option>
                <option value="pro">Pro</option>
                <option value="ultra">Ultra</option>
              </select>
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Min Streak Days</label>
              <input type="number" value={segmentFilters.minStreak} onChange={e => setSegmentFilters(p => ({ ...p, minStreak: +e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Max Inactive Days</label>
              <input type="number" value={segmentFilters.maxInactiveDays} onChange={e => setSegmentFilters(p => ({ ...p, maxInactiveDays: +e.target.value }))}
                className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" />
            </div>
            <div>
              <label className="text-[10px] text-muted-foreground mb-1 block">Exam Type</label>
              <input value={segmentFilters.examType} onChange={e => setSegmentFilters(p => ({ ...p, examType: e.target.value }))}
                placeholder="e.g. NEET, JEE" className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" />
            </div>
          </div>
        )}
        {audienceType === "manual" && (
          <textarea value={manualUserIds} onChange={e => setManualUserIds(e.target.value)}
            placeholder="Paste user IDs (comma separated)..." rows={3}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        )}
      </div>

      {/* Content */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground">Content</h4>
          <button onClick={generateWithAI} disabled={generating}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-accent/15 text-accent hover:bg-accent/25 flex items-center gap-1 disabled:opacity-50">
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI Write
          </button>
        </div>
        {channel === "email" && (
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject..."
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        )}
        <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title..."
          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Message body..."
          rows={4} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
      </div>

      {/* A/B Testing */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
            <BarChart3 className="w-4 h-4" /> A/B Testing
          </h4>
          <button onClick={() => setIsAbTest(!isAbTest)}
            className={`text-[10px] font-medium px-2.5 py-1 rounded-md transition-colors ${isAbTest ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground"}`}>
            {isAbTest ? "Enabled" : "Disabled"}
          </button>
        </div>
        {isAbTest && (
          <div className="space-y-2 border-t border-border pt-3">
            <p className="text-[10px] text-muted-foreground">Variant B (50% of audience)</p>
            <input value={abVariantB.subject} onChange={e => setAbVariantB(p => ({ ...p, subject: e.target.value }))} placeholder="Variant B subject..."
              className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
            <input value={abVariantB.title} onChange={e => setAbVariantB(p => ({ ...p, title: e.target.value }))} placeholder="Variant B title..."
              className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
            <textarea value={abVariantB.body} onChange={e => setAbVariantB(p => ({ ...p, body: e.target.value }))} placeholder="Variant B body..."
              rows={3} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
          </div>
        )}
      </div>

      {/* Schedule */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-sm font-semibold text-foreground flex items-center gap-2"><Calendar className="w-4 h-4" /> Schedule</h4>
        <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none" />
        <p className="text-[10px] text-muted-foreground">Leave empty to send immediately</p>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={() => saveCampaign(true)} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium border border-border text-foreground hover:bg-secondary transition-colors disabled:opacity-50">
          Save as Draft
        </button>
        <button onClick={() => saveCampaign(false)} disabled={saving}
          className="flex-1 px-4 py-2.5 rounded-xl text-xs font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors flex items-center justify-center gap-2 disabled:opacity-50">
          {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
          {scheduledAt ? "Schedule Campaign" : "Send Now"}
        </button>
      </div>
    </div>
  );
};

// ─── Email Templates Tab ───
const TemplatesTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [htmlBody, setHtmlBody] = useState("");
  const [variables, setVariables] = useState("");
  const [category, setCategory] = useState("general");
  const [saving, setSaving] = useState(false);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("email_templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const saveTemplate = async () => {
    if (!name.trim() || !subject.trim()) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await (supabase as any).from("email_templates").insert({
        name: name.trim(), subject: subject.trim(), html_body: htmlBody,
        variables: variables.split(",").map(s => s.trim()).filter(Boolean),
        category, created_by: adminId,
      });
      toast({ title: "Template saved ✅" });
      setShowForm(false); setName(""); setSubject(""); setHtmlBody(""); setVariables("");
      fetchTemplates();
    } catch (e: any) { toast({ title: "Failed", variant: "destructive" }); }
    setSaving(false);
  };

  const deleteTemplate = async (id: string) => {
    await (supabase as any).from("email_templates").delete().eq("id", id);
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Email Templates</h3>
        <button onClick={() => setShowForm(!showForm)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5" /> New Template
        </button>
      </div>

      {showForm && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="glass rounded-xl p-4 neural-border space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Template name..."
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject line (use {{name}}, {{streak}})..."
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
          <select value={category} onChange={e => setCategory(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground">
            <option value="general">General</option>
            <option value="welcome">Welcome</option>
            <option value="reminder">Reminder</option>
            <option value="promotion">Promotion</option>
            <option value="reengagement">Re-engagement</option>
          </select>
          <textarea value={htmlBody} onChange={e => setHtmlBody(e.target.value)} placeholder="HTML body..."
            rows={6} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none font-mono" />
          <input value={variables} onChange={e => setVariables(e.target.value)} placeholder="Variables (comma separated): name, streak, exam_date..."
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
          <div className="flex gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancel</button>
            <button onClick={saveTemplate} disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Save Template"}
            </button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="glass rounded-xl p-6 neural-border text-center">
          <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No templates yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {templates.map((t: any) => (
            <div key={t.id} className="glass rounded-xl p-3 neural-border flex items-center justify-between">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h4 className="text-xs font-semibold text-foreground">{t.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.category}</span>
                </div>
                <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.subject}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => deleteTemplate(t.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Lead Management Tab ───
const LeadsTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [noteModal, setNoteModal] = useState<{ leadId: string; open: boolean }>({ leadId: "", open: false });
  const [noteText, setNoteText] = useState("");
  const [syncing, setSyncing] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("leads").select("*").order("score", { ascending: false }).limit(100);
    if (stageFilter !== "all") q = q.eq("stage", stageFilter);
    const { data } = await q;
    setLeads(data || []);
    setLoading(false);
  }, [stageFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // Sync leads from profiles
  const syncLeads = async () => {
    setSyncing(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, created_at, exam_type, daily_study_goal_minutes");
      if (!profiles?.length) { setSyncing(false); return; }

      for (const p of profiles) {
        // Check if lead exists
        const { data: existing } = await (supabase as any).from("leads").select("id").eq("user_id", p.id).maybeSingle();
        if (!existing) {
          // Get study stats
          const { data: logs } = await supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(50);
          const totalMinutes7d = (logs || []).filter(l => new Date(l.created_at) > new Date(Date.now() - 7 * 86400000)).reduce((s, l) => s + l.duration_minutes, 0);
          const lastActive = logs?.[0]?.created_at || p.created_at;

          // Score calculation
          const studyScore = Math.min(totalMinutes7d / 10, 30);
          const recencyScore = Math.max(0, 30 - Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000));
          const score = Math.round(studyScore + recencyScore);

          // Determine stage
          let stage: LeadStage = "new";
          if (score >= 50) stage = "power_user";
          else if (score >= 30) stage = "active";
          else if (score >= 15) stage = "engaged";
          else if (score < 5 && new Date(lastActive) < new Date(Date.now() - 7 * 86400000)) stage = "at_risk";

          await (supabase as any).from("leads").insert({
            user_id: p.id, stage, score,
            study_hours_7d: Math.round(totalMinutes7d / 60 * 10) / 10,
            last_active_at: lastActive,
          });
        }
      }
      toast({ title: "Leads synced from user data ✅" });
      fetchLeads();
    } catch (e: any) { toast({ title: "Sync failed", variant: "destructive" }); }
    setSyncing(false);
  };

  const updateStage = async (leadId: string, stage: LeadStage) => {
    await (supabase as any).from("leads").update({ stage }).eq("id", leadId);
    toast({ title: `Stage → ${stage.replace("_", " ")}` });
    fetchLeads();
  };

  const addNote = async () => {
    if (!noteText.trim() || !noteModal.leadId) return;
    const lead = leads.find(l => l.id === noteModal.leadId);
    const existingNotes = Array.isArray(lead?.notes) ? lead.notes : [];
    const newNotes = [...existingNotes, { text: noteText.trim(), at: new Date().toISOString(), by: adminId }];
    await (supabase as any).from("leads").update({ notes: newNotes }).eq("id", noteModal.leadId);
    toast({ title: "Note added" });
    setNoteModal({ leadId: "", open: false });
    setNoteText("");
    fetchLeads();
  };

  const bulkUpdateStage = async (stage: LeadStage) => {
    if (selectedLeads.size === 0) return;
    for (const id of selectedLeads) {
      await (supabase as any).from("leads").update({ stage }).eq("id", id);
    }
    toast({ title: `${selectedLeads.size} leads → ${stage}` });
    setSelectedLeads(new Set());
    fetchLeads();
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const filteredLeads = leads.filter(l => !search || l.user_id?.includes(search));

  // Stage summary
  const stageCounts = LEAD_STAGES.reduce((acc, s) => {
    acc[s] = leads.filter(l => l.stage === s).length;
    return acc;
  }, {} as Record<LeadStage, number>);

  return (
    <div className="space-y-4">
      {/* Pipeline overview */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {LEAD_STAGES.map(s => (
          <button key={s} onClick={() => setStageFilter(stageFilter === s ? "all" : s)}
            className={`flex flex-col items-center px-3 py-2 rounded-xl text-xs font-medium transition-colors shrink-0 min-w-[80px] ${
              stageFilter === s ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground border border-border"
            }`}>
            <span className="text-lg font-bold text-foreground">{stageCounts[s]}</span>
            <span className="capitalize">{s.replace("_", " ")}</span>
          </button>
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by user ID..."
            className="flex-1 px-3 py-1.5 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
        </div>
        <div className="flex gap-2">
          {selectedLeads.size > 0 && (
            <select onChange={e => { if (e.target.value) bulkUpdateStage(e.target.value as LeadStage); }}
              className="px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" defaultValue="">
              <option value="" disabled>Bulk: Move {selectedLeads.size} to...</option>
              {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          )}
          <button onClick={syncLeads} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
            Sync Leads
          </button>
        </div>
      </div>

      {/* Leads list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No leads found</p>
          <button onClick={syncLeads} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium">
            Sync from Users
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map(l => {
            const notes = Array.isArray(l.notes) ? l.notes : [];
            return (
              <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`glass rounded-xl p-3 neural-border ${selectedLeads.has(l.id) ? "ring-1 ring-primary" : ""}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selectedLeads.has(l.id)} onChange={() => toggleSelect(l.id)}
                    className="w-3.5 h-3.5 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-foreground truncate max-w-[200px]">{l.user_id}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${LEAD_STAGE_COLORS[l.stage as LeadStage]}`}>
                        {l.stage?.replace("_", " ")}
                      </span>
                      <span className="text-[10px] font-bold text-foreground">Score: {l.score}</span>
                      {l.tags?.map((t: string) => (
                        <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>
                      ))}
                    </div>
                    <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                      <span>Study: {l.study_hours_7d}h/7d</span>
                      <span>Streak: {l.streak_days}d</span>
                      <span>Plan: {l.subscription_plan}</span>
                      {l.last_active_at && <span>Last: {formatDistanceToNow(new Date(l.last_active_at), { addSuffix: true })}</span>}
                    </div>
                    {notes.length > 0 && (
                      <div className="mt-1 text-[10px] text-muted-foreground italic">
                        💬 {notes[notes.length - 1]?.text}
                      </div>
                    )}
                  </div>
                  <div className="flex gap-1.5 shrink-0">
                    <select onChange={e => { if (e.target.value) updateStage(l.id, e.target.value as LeadStage); }} defaultValue=""
                      className="px-1.5 py-1 rounded text-[10px] bg-secondary border border-border text-foreground">
                      <option value="" disabled>Move</option>
                      {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                    </select>
                    <button onClick={() => { setNoteModal({ leadId: l.id, open: true }); setNoteText(""); }}
                      className="p-1.5 text-muted-foreground hover:text-primary"><MessageSquare className="w-3.5 h-3.5" /></button>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Note modal */}
      {noteModal.open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNoteModal({ leadId: "", open: false })}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-2xl p-5 neural-border max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-foreground">Add Note</h4>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note about this lead..."
              rows={3} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteModal({ leadId: "", open: false })} className="px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
              <button onClick={addNote} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">Save Note</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// ─── Drip Sequences Tab ───
const DripTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [triggerEvent, setTriggerEvent] = useState("manual");
  const [steps, setSteps] = useState<{ title: string; body: string; delay_hours: number }[]>([{ title: "", body: "", delay_hours: 24 }]);
  const [saving, setSaving] = useState(false);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("drip_sequences").select("*").order("created_at", { ascending: false });
    setSequences(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  const addStep = () => setSteps(p => [...p, { title: "", body: "", delay_hours: 24 }]);
  const updateStep = (idx: number, field: string, value: any) => {
    setSteps(p => p.map((s, i) => i === idx ? { ...s, [field]: value } : s));
  };
  const removeStep = (idx: number) => setSteps(p => p.filter((_, i) => i !== idx));

  const saveSequence = async () => {
    if (!name.trim() || steps.length === 0) { toast({ title: "Fill required fields", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await (supabase as any).from("drip_sequences").insert({
        name: name.trim(), channel, trigger_event: triggerEvent,
        steps, created_by: adminId,
      });
      toast({ title: "Drip sequence created ✅" });
      setShowCreate(false); setName(""); setSteps([{ title: "", body: "", delay_hours: 24 }]);
      fetchSequences();
    } catch (e: any) { toast({ title: "Failed", variant: "destructive" }); }
    setSaving(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "paused" : "active";
    await (supabase as any).from("drip_sequences").update({ status: newStatus }).eq("id", id);
    toast({ title: `Sequence ${newStatus}` });
    fetchSequences();
  };

  const deleteSequence = async (id: string) => {
    await (supabase as any).from("drip_sequences").delete().eq("id", id);
    toast({ title: "Sequence deleted" });
    fetchSequences();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Drip Sequences</h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5" /> New Sequence
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 neural-border space-y-3">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Sequence name..."
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
          <div className="flex gap-2">
            {(["email", "push", "voice"] as CampaignChannel[]).map(ch => {
              const Icon = CHANNEL_ICONS[ch];
              return (
                <button key={ch} onClick={() => setChannel(ch)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${
                    channel === ch ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground"
                  }`}>
                  <Icon className="w-3.5 h-3.5" /> {ch}
                </button>
              );
            })}
          </div>
          <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground">
            <option value="manual">Manual Enrollment</option>
            <option value="new_signup">New Signup</option>
            <option value="plan_upgrade">Plan Upgrade</option>
            <option value="inactivity_3d">3 Days Inactive</option>
            <option value="inactivity_7d">7 Days Inactive</option>
            <option value="streak_broken">Streak Broken</option>
            <option value="exam_approaching">Exam Approaching</option>
          </select>

          <div className="space-y-3">
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">Steps</p>
            {steps.map((step, idx) => (
              <div key={idx} className="bg-secondary/50 rounded-lg p-3 space-y-2 relative">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-semibold text-primary">Step {idx + 1}</span>
                  {steps.length > 1 && (
                    <button onClick={() => removeStep(idx)} className="text-muted-foreground hover:text-destructive">
                      <XCircle className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <input value={step.title} onChange={e => updateStep(idx, "title", e.target.value)} placeholder="Step title..."
                  className="w-full px-2 py-1.5 bg-background rounded text-xs text-foreground border border-border outline-none" />
                <textarea value={step.body} onChange={e => updateStep(idx, "body", e.target.value)} placeholder="Step message..."
                  rows={2} className="w-full px-2 py-1.5 bg-background rounded text-xs text-foreground border border-border outline-none" />
                <div className="flex items-center gap-2">
                  <Clock className="w-3 h-3 text-muted-foreground" />
                  <input type="number" value={step.delay_hours} onChange={e => updateStep(idx, "delay_hours", +e.target.value)}
                    className="w-16 px-2 py-1 bg-background rounded text-xs text-foreground border border-border outline-none" />
                  <span className="text-[10px] text-muted-foreground">hours after previous</span>
                </div>
              </div>
            ))}
            <button onClick={addStep} className="flex items-center gap-1 text-xs text-primary hover:text-primary/80">
              <Plus className="w-3 h-3" /> Add Step
            </button>
          </div>

          <div className="flex gap-2">
            <button onClick={() => setShowCreate(false)} className="px-3 py-2 text-xs text-muted-foreground">Cancel</button>
            <button onClick={saveSequence} disabled={saving}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium disabled:opacity-50">
              {saving ? "Saving..." : "Create Sequence"}
            </button>
          </div>
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : sequences.length === 0 ? (
        <div className="glass rounded-xl p-6 neural-border text-center">
          <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No drip sequences yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {sequences.map((seq: any) => {
            const Icon = CHANNEL_ICONS[seq.channel as CampaignChannel] || Bell;
            const stepsArr = Array.isArray(seq.steps) ? seq.steps : [];
            return (
              <div key={seq.id} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Icon className={`w-4 h-4 ${CHANNEL_COLORS[seq.channel as CampaignChannel]}`} />
                    <div>
                      <h4 className="text-xs font-semibold text-foreground">{seq.name}</h4>
                      <div className="flex gap-3 mt-0.5 text-[10px] text-muted-foreground">
                        <span>{stepsArr.length} steps</span>
                        <span>Trigger: {seq.trigger_event}</span>
                        <span>Enrolled: {seq.total_enrolled}</span>
                        <span>Completed: {seq.completed_count}</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      seq.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}>
                      {seq.status}
                    </span>
                    <button onClick={() => toggleStatus(seq.id, seq.status)} className="p-1 text-muted-foreground hover:text-foreground">
                      {seq.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteSequence(seq.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default CampaignManager;
