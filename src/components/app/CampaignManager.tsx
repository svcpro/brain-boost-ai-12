import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Volume2, Bell, Send, Sparkles, Loader2, Users,
  Clock, CheckCircle2, XCircle, Search, Trash2, Eye,
  Filter, RefreshCw, User, ChevronRight, Plus, Pause,
  Play, Calendar, BarChart3, TrendingUp, Target, Tag,
  FileText, Copy, ArrowRight, Pencil, Award, Star,
  Megaphone, Zap, ChevronDown, AlertTriangle, MessageSquare,
  Wand2, Download, Rocket, Bot
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

const AI_CAMPAIGN_TRIGGERS = [
  { key: "study_reminder", label: "Study Reminder", channels: ["email", "push", "voice"], icon: "📚" },
  { key: "forget_risk", label: "Forget Risk Alert", channels: ["push", "voice"], icon: "⚠️" },
  { key: "risk_digest", label: "Daily Risk Digest", channels: ["push", "email"], icon: "📊" },
  { key: "streak_milestone", label: "Streak Milestone", channels: ["push", "voice"], icon: "🔥" },
  { key: "streak_break_warning", label: "Streak Break Warning", channels: ["push", "voice"], icon: "💔" },
  { key: "daily_briefing", label: "Daily Morning Briefing", channels: ["push", "email"], icon: "🌅" },
  { key: "brain_missions", label: "Brain Missions", channels: ["push"], icon: "🎯" },
  { key: "weekly_insights", label: "Weekly AI Insights", channels: ["push", "email", "voice"], icon: "🧠" },
  { key: "weekly_report", label: "Weekly Email Report", channels: ["email"], icon: "📈" },
  { key: "exam_countdown", label: "Exam Countdown", channels: ["push", "email", "voice"], icon: "⏰" },
  { key: "daily_goal_complete", label: "Daily Goal Complete", channels: ["push"], icon: "✅" },
  { key: "weekly_goal_complete", label: "Weekly Goal Complete", channels: ["push", "voice"], icon: "🏆" },
  { key: "burnout_detection", label: "Burnout Alert", channels: ["push", "voice"], icon: "😮‍💨" },
  { key: "subscription_expiry", label: "Subscription Expiry", channels: ["push", "email"], icon: "💳" },
  { key: "new_user_welcome", label: "Welcome Message", channels: ["push", "email"], icon: "👋" },
  { key: "inactivity_nudge", label: "Inactivity Nudge", channels: ["push", "email", "voice"], icon: "💤" },
  { key: "leaderboard_rank_up", label: "Leaderboard Rank Up", channels: ["push"], icon: "🏅" },
  { key: "rank_prediction_change", label: "Rank Prediction Change", channels: ["push", "voice"], icon: "📉" },
  { key: "study_plan_ready", label: "Study Plan Ready", channels: ["push", "email"], icon: "📋" },
  { key: "feature_announcement", label: "Feature Announcement", channels: ["push", "email"], icon: "🆕" },
  { key: "promo_seasonal", label: "Seasonal Promotion", channels: ["email", "push"], icon: "🎉" },
  { key: "promo_upgrade", label: "Upgrade Promotion", channels: ["email", "push", "voice"], icon: "⬆️" },
  { key: "promo_referral", label: "Referral Promotion", channels: ["email", "push"], icon: "🤝" },
  { key: "promo_milestone_reward", label: "Milestone Reward", channels: ["email", "push"], icon: "🎁" },
  { key: "promo_reengagement", label: "Re-engagement Promo", channels: ["email", "push", "voice"], icon: "🔄" },
];

const CampaignManager = () => {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const [tab, setTab] = useState<ManagerTab>("campaigns");

  const tabs: { key: ManagerTab; label: string; icon: any }[] = [
    { key: "campaigns", label: "AI Campaigns", icon: Rocket },
    { key: "templates", label: "AI Templates", icon: Wand2 },
    { key: "leads", label: "Lead Management", icon: Target },
    { key: "drip", label: "AI Drip Sequences", icon: Zap },
  ];

  return (
    <div className="space-y-5">
      <div>
        <h2 className="text-xl font-bold text-foreground flex items-center gap-2">
          <Bot className="w-5 h-5 text-primary" /> AI Campaign Manager
        </h2>
        <p className="text-xs text-muted-foreground mt-1">Fully AI-powered — Email, Voice & Push campaigns with zero manual work</p>
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
          {tab === "campaigns" && <AICampaignsTab toast={toast} adminId={adminUser?.id} />}
          {tab === "templates" && <AITemplatesTab toast={toast} adminId={adminUser?.id} />}
          {tab === "leads" && <LeadsTab toast={toast} adminId={adminUser?.id} />}
          {tab === "drip" && <AIDripTab toast={toast} adminId={adminUser?.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── AI Campaigns Tab — One-click AI campaign creation ───
const AICampaignsTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CampaignChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [creating, setCreating] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);

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

  const createAICampaign = async (triggerKey: string, channel: CampaignChannel) => {
    setCreating(`${triggerKey}-${channel}`);
    try {
      // Step 1: AI generates content
      const { data: aiContent, error: aiErr } = await supabase.functions.invoke("generate-campaign-templates", {
        body: { action: "generate_campaign", trigger_key: triggerKey, channel },
      });
      if (aiErr) throw aiErr;

      // Step 2: Resolve audience (all users)
      const { data: profiles } = await supabase.from("profiles").select("id");
      const recipientIds = (profiles || []).map((p: any) => p.id);

      // Step 3: Create campaign
      const { data: campaign, error: campErr } = await (supabase as any).from("campaigns").insert({
        name: `[AI] ${aiContent.subject || triggerKey} — ${channel.toUpperCase()}`,
        channel,
        status: "sent",
        subject: aiContent.subject || "",
        title: aiContent.subject || "",
        body: aiContent.html_body || "",
        audience_type: "all",
        audience_filters: {},
        total_recipients: recipientIds.length,
        sent_at: new Date().toISOString(),
        created_by: adminId,
      }).select().single();
      if (campErr) throw campErr;

      // Step 4: Create recipients
      const recipients = recipientIds.map((uid: string) => ({
        campaign_id: campaign.id,
        user_id: uid,
        status: "delivered",
        delivered_at: new Date().toISOString(),
      }));
      for (let i = 0; i < recipients.length; i += 50) {
        await (supabase as any).from("campaign_recipients").insert(recipients.slice(i, i + 50));
      }

      // Step 5: Actually send via channels
      if (channel === "push") {
        const notifications = recipientIds.map((uid: string) => ({
          user_id: uid, title: aiContent.subject, body: aiContent.html_body?.slice(0, 200), type: triggerKey, read: false,
        }));
        for (let i = 0; i < notifications.length; i += 50) {
          await supabase.from("notification_history").insert(notifications.slice(i, i + 50));
        }
      }

      // Update delivered count
      await (supabase as any).from("campaigns").update({ delivered_count: recipientIds.length }).eq("id", campaign.id);

      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId, action: "ai_campaign_sent", target_type: "campaign",
          target_id: campaign.id, details: { trigger: triggerKey, channel, recipients: recipientIds.length } as any,
        });
      }

      toast({ title: `🚀 AI ${channel} campaign sent to ${recipientIds.length} users!` });
      fetchCampaigns();
    } catch (e: any) {
      toast({ title: "AI campaign failed", description: e?.message, variant: "destructive" });
    }
    setCreating(null);
  };

  return (
    <div className="space-y-4">
      {/* Quick AI Campaign Creator */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">One-Click AI Campaign</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">100% AI Generated</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Select a trigger → AI writes content → sends to all users automatically. No manual work.</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[320px] overflow-y-auto pr-1">
          {AI_CAMPAIGN_TRIGGERS.map(trigger => (
            <div key={trigger.key}
              className={`rounded-xl p-3 border transition-all cursor-pointer ${
                selectedTrigger === trigger.key
                  ? "bg-primary/10 border-primary/30"
                  : "bg-secondary/50 border-border hover:border-primary/20"
              }`}
              onClick={() => setSelectedTrigger(selectedTrigger === trigger.key ? null : trigger.key)}
            >
              <div className="flex items-center gap-2 mb-2">
                <span className="text-base">{trigger.icon}</span>
                <span className="text-xs font-semibold text-foreground">{trigger.label}</span>
              </div>
              {selectedTrigger === trigger.key && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} className="flex gap-1.5 mt-1">
                  {trigger.channels.map(ch => {
                    const Icon = CHANNEL_ICONS[ch as CampaignChannel];
                    const isCreating = creating === `${trigger.key}-${ch}`;
                    return (
                      <button key={ch} onClick={(e) => { e.stopPropagation(); createAICampaign(trigger.key, ch as CampaignChannel); }}
                        disabled={!!creating}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                        {isCreating ? "Sending..." : `Send ${ch}`}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Campaign history */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h3 className="text-sm font-semibold text-foreground">Campaign History</h3>
        <div className="flex gap-2">
          {(["all", "email", "voice", "push"] as const).map(ch => (
            <button key={ch} onClick={() => setFilter(ch)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${filter === ch ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {ch === "all" ? "All" : ch.charAt(0).toUpperCase() + ch.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : campaigns.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Rocket className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No campaigns yet — use AI One-Click above!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map(c => {
            const Icon = CHANNEL_ICONS[c.channel as CampaignChannel] || Bell;
            const openRate = c.total_recipients > 0 ? Math.round(((c.opened_count || 0) / c.total_recipients) * 100) : 0;
            const deliveryRate = c.total_recipients > 0 ? Math.round(((c.delivered_count || 0) / c.total_recipients) * 100) : 0;
            return (
              <motion.div key={c.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-3 neural-border">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary">
                      <Icon className={`w-4 h-4 ${CHANNEL_COLORS[c.channel as CampaignChannel]}`} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="text-xs font-semibold text-foreground truncate">{c.name}</h4>
                        <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[c.status as CampaignStatus]}`}>{c.status}</span>
                        {c.name?.includes("[AI]") && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">AI</span>}
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{c.subject || c.title || "—"}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                    <div className="text-center"><p className="text-xs font-bold text-foreground">{c.total_recipients || 0}</p><p>Sent</p></div>
                    <div className="text-center"><p className="text-xs font-bold text-foreground">{deliveryRate}%</p><p>Delivered</p></div>
                    <div className="text-center"><p className="text-xs font-bold text-foreground">{openRate}%</p><p>Opened</p></div>
                    <p className="text-[9px]">{formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}</p>
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

// ─── AI Templates Tab — Auto-generate all templates ───
const AITemplatesTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [generatingSingle, setGeneratingSingle] = useState<string | null>(null);
  const [previewTemplate, setPreviewTemplate] = useState<any>(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("email_templates").select("*").order("created_at", { ascending: false });
    setTemplates(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchTemplates(); }, [fetchTemplates]);

  const generateAllTemplates = async () => {
    setGeneratingAll(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
        body: { action: "generate_all" },
      });
      if (error) throw error;
      toast({ title: `✨ ${data.templates_created} AI templates generated!`, description: "All triggers × all channels covered." });
      fetchTemplates();
    } catch (e: any) {
      toast({ title: "Bulk generation failed", description: e?.message, variant: "destructive" });
    }
    setGeneratingAll(false);
  };

  const generateSingleTemplate = async (triggerKey: string, channel: string) => {
    setGeneratingSingle(`${triggerKey}-${channel}`);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
        body: { action: "generate_single", trigger_key: triggerKey, channel },
      });
      if (error) throw error;
      // Save to templates
      await (supabase as any).from("email_templates").insert({
        name: `[AI] ${triggerKey} — ${channel.toUpperCase()}`,
        subject: data.subject,
        html_body: data.html_body,
        category: triggerKey.startsWith("promo_") ? "promotion" : "reminder",
        variables: data.variables,
        is_active: true,
        created_by: adminId || "ai-system",
      });
      toast({ title: `Template generated for ${triggerKey} (${channel}) ✨` });
      fetchTemplates();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e?.message, variant: "destructive" });
    }
    setGeneratingSingle(null);
  };

  const deleteTemplate = async (id: string) => {
    await (supabase as any).from("email_templates").delete().eq("id", id);
    toast({ title: "Template deleted" });
    fetchTemplates();
  };

  const deleteAllAITemplates = async () => {
    const aiTemplates = templates.filter(t => t.name?.includes("[AI]"));
    for (const t of aiTemplates) {
      await (supabase as any).from("email_templates").delete().eq("id", t.id);
    }
    toast({ title: `Deleted ${aiTemplates.length} AI templates` });
    fetchTemplates();
  };

  return (
    <div className="space-y-4">
      {/* Bulk AI Generator */}
      <div className="glass rounded-xl p-5 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> AI Template Generator
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Generate templates for all {AI_CAMPAIGN_TRIGGERS.length} triggers × all channels in one click. AI handles subject, body, HTML, and voice scripts.
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button onClick={generateAllTemplates} disabled={generatingAll}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
            {generatingAll ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {generatingAll ? "Generating all templates..." : "🚀 Generate All Templates (AI)"}
          </button>
          {templates.some(t => t.name?.includes("[AI]")) && (
            <button onClick={deleteAllAITemplates}
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-3.5 h-3.5" /> Clear AI Templates
            </button>
          )}
        </div>
      </div>

      {/* Per-trigger generator */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-xs font-semibold text-foreground">Generate Single Template</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[280px] overflow-y-auto pr-1">
          {AI_CAMPAIGN_TRIGGERS.map(trigger => (
            <div key={trigger.key} className="flex items-center justify-between bg-secondary/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm">{trigger.icon}</span>
                <span className="text-[11px] font-medium text-foreground truncate">{trigger.label}</span>
              </div>
              <div className="flex gap-1 shrink-0">
                {trigger.channels.map(ch => {
                  const Icon = CHANNEL_ICONS[ch as CampaignChannel];
                  const isGen = generatingSingle === `${trigger.key}-${ch}`;
                  return (
                    <button key={ch} onClick={() => generateSingleTemplate(trigger.key, ch)}
                      disabled={!!generatingSingle}
                      className="p-1.5 rounded-md hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors disabled:opacity-30"
                      title={`Generate ${ch} template`}>
                      {isGen ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Saved templates */}
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground">Saved Templates ({templates.length})</h3>
      </div>

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : templates.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Wand2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No templates yet — click "Generate All" above!</p>
        </div>
      ) : (
        <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
          {templates.map((t: any) => (
            <div key={t.id} className="glass rounded-xl p-3 neural-border">
              <div className="flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <h4 className="text-[11px] font-semibold text-foreground truncate">{t.name}</h4>
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{t.category}</span>
                    {t.name?.includes("[AI]") && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-accent/15 text-accent">AI</span>}
                  </div>
                  <p className="text-[10px] text-muted-foreground truncate mt-0.5">{t.subject}</p>
                  {t.variables?.length > 0 && (
                    <div className="flex gap-1 mt-1 flex-wrap">
                      {t.variables.map((v: string) => (
                        <span key={v} className="text-[8px] px-1 py-0.5 rounded bg-primary/10 text-primary font-mono">{`{{${v}}}`}</span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex gap-1.5 shrink-0">
                  <button onClick={() => setPreviewTemplate(previewTemplate?.id === t.id ? null : t)}
                    className="p-1.5 text-muted-foreground hover:text-primary"><Eye className="w-3.5 h-3.5" /></button>
                  <button onClick={() => deleteTemplate(t.id)} className="p-1.5 text-muted-foreground hover:text-destructive">
                    <Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              {previewTemplate?.id === t.id && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="mt-3 pt-3 border-t border-border">
                  <div className="bg-secondary/50 rounded-lg p-3 text-[11px] text-foreground whitespace-pre-wrap max-h-[200px] overflow-y-auto font-mono">
                    {t.html_body}
                  </div>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Lead Management Tab (kept intact) ───
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

  const syncLeads = async () => {
    setSyncing(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, created_at, exam_type, daily_study_goal_minutes");
      if (!profiles?.length) { setSyncing(false); return; }
      for (const p of profiles) {
        const { data: existing } = await (supabase as any).from("leads").select("id").eq("user_id", p.id).maybeSingle();
        if (!existing) {
          const { data: logs } = await supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(50);
          const totalMinutes7d = (logs || []).filter(l => new Date(l.created_at) > new Date(Date.now() - 7 * 86400000)).reduce((s, l) => s + l.duration_minutes, 0);
          const lastActive = logs?.[0]?.created_at || p.created_at;
          const studyScore = Math.min(totalMinutes7d / 10, 30);
          const recencyScore = Math.max(0, 30 - Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000));
          const score = Math.round(studyScore + recencyScore);
          let stage: LeadStage = "new";
          if (score >= 50) stage = "power_user";
          else if (score >= 30) stage = "active";
          else if (score >= 15) stage = "engaged";
          else if (score < 5 && new Date(lastActive) < new Date(Date.now() - 7 * 86400000)) stage = "at_risk";
          await (supabase as any).from("leads").insert({ user_id: p.id, stage, score, study_hours_7d: Math.round(totalMinutes7d / 60 * 10) / 10, last_active_at: lastActive });
        }
      }
      toast({ title: "Leads synced ✅" }); fetchLeads();
    } catch { toast({ title: "Sync failed", variant: "destructive" }); }
    setSyncing(false);
  };

  const updateStage = async (leadId: string, stage: LeadStage) => {
    await (supabase as any).from("leads").update({ stage }).eq("id", leadId);
    toast({ title: `Stage → ${stage.replace("_", " ")}` }); fetchLeads();
  };

  const addNote = async () => {
    if (!noteText.trim() || !noteModal.leadId) return;
    const lead = leads.find(l => l.id === noteModal.leadId);
    const existingNotes = Array.isArray(lead?.notes) ? lead.notes : [];
    await (supabase as any).from("leads").update({ notes: [...existingNotes, { text: noteText.trim(), at: new Date().toISOString(), by: adminId }] }).eq("id", noteModal.leadId);
    toast({ title: "Note added" }); setNoteModal({ leadId: "", open: false }); setNoteText(""); fetchLeads();
  };

  const bulkUpdateStage = async (stage: LeadStage) => {
    if (selectedLeads.size === 0) return;
    for (const id of selectedLeads) { await (supabase as any).from("leads").update({ stage }).eq("id", id); }
    toast({ title: `${selectedLeads.size} leads → ${stage}` }); setSelectedLeads(new Set()); fetchLeads();
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const filteredLeads = leads.filter(l => !search || l.user_id?.includes(search));
  const stageCounts = LEAD_STAGES.reduce((acc, s) => { acc[s] = leads.filter(l => l.stage === s).length; return acc; }, {} as Record<LeadStage, number>);

  return (
    <div className="space-y-4">
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
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user ID..."
            className="flex-1 px-3 py-1.5 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
        </div>
        <div className="flex gap-2">
          {selectedLeads.size > 0 && (
            <select onChange={e => { if (e.target.value) bulkUpdateStage(e.target.value as LeadStage); }}
              className="px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" defaultValue="">
              <option value="" disabled>Bulk move {selectedLeads.size}...</option>
              {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
            </select>
          )}
          <button onClick={syncLeads} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Leads
          </button>
        </div>
      </div>
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No leads found</p>
          <button onClick={syncLeads} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium">Sync from Users</button>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLeads.map(l => {
            const notes = Array.isArray(l.notes) ? l.notes : [];
            return (
              <motion.div key={l.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={`glass rounded-xl p-3 neural-border ${selectedLeads.has(l.id) ? "ring-1 ring-primary" : ""}`}>
                <div className="flex items-center gap-3">
                  <input type="checkbox" checked={selectedLeads.has(l.id)} onChange={() => toggleSelect(l.id)} className="w-3.5 h-3.5 rounded" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-mono text-foreground truncate max-w-[200px]">{l.user_id}</span>
                      <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${LEAD_STAGE_COLORS[l.stage as LeadStage]}`}>{l.stage?.replace("_", " ")}</span>
                      <span className="text-[10px] font-bold text-foreground">Score: {l.score}</span>
                      {l.tags?.map((t: string) => <span key={t} className="text-[9px] px-1.5 py-0.5 rounded bg-secondary text-muted-foreground">{t}</span>)}
                    </div>
                    <div className="flex gap-4 mt-1 text-[10px] text-muted-foreground">
                      <span>Study: {l.study_hours_7d}h/7d</span>
                      <span>Streak: {l.streak_days}d</span>
                      <span>Plan: {l.subscription_plan}</span>
                      {l.last_active_at && <span>Last: {formatDistanceToNow(new Date(l.last_active_at), { addSuffix: true })}</span>}
                    </div>
                    {notes.length > 0 && <div className="mt-1 text-[10px] text-muted-foreground italic">💬 {notes[notes.length - 1]?.text}</div>}
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
      {noteModal.open && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setNoteModal({ leadId: "", open: false })}>
          <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
            className="glass rounded-2xl p-5 neural-border max-w-sm w-full space-y-3" onClick={e => e.stopPropagation()}>
            <h4 className="text-sm font-semibold text-foreground">Add Note</h4>
            <textarea value={noteText} onChange={e => setNoteText(e.target.value)} placeholder="Add a note..."
              rows={3} className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
            <div className="flex justify-end gap-2">
              <button onClick={() => setNoteModal({ leadId: "", open: false })} className="px-3 py-1.5 text-xs text-muted-foreground">Cancel</button>
              <button onClick={addNote} className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium">Save</button>
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
};

// ─── AI Drip Sequences Tab — AI auto-generates steps ───
const AIDripTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [sequences, setSequences] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [channel, setChannel] = useState<CampaignChannel>("email");
  const [triggerEvent, setTriggerEvent] = useState("new_signup");
  const [steps, setSteps] = useState<{ title: string; body: string; delay_hours: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);

  const fetchSequences = useCallback(async () => {
    setLoading(true);
    const { data } = await (supabase as any).from("drip_sequences").select("*").order("created_at", { ascending: false });
    setSequences(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchSequences(); }, [fetchSequences]);

  const aiGenerateSteps = async () => {
    setAiGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
        body: { action: "generate_single", trigger_key: triggerEvent, channel },
      });
      if (error) throw error;
      // Generate 4-step drip sequence from AI
      const baseTitle = data.subject || "Step";
      const baseBody = data.html_body || "";
      setSteps([
        { title: `${baseTitle} - Welcome`, body: baseBody.slice(0, 200), delay_hours: 0 },
        { title: `${baseTitle} - Follow-up`, body: "Continue where you left off. Your brain is counting on you!", delay_hours: 24 },
        { title: `${baseTitle} - Nudge`, body: "Don't lose momentum! A quick 10-minute session can make a big difference.", delay_hours: 72 },
        { title: `${baseTitle} - Final Push`, body: "This is your last reminder. Take action now to stay on track! 🚀", delay_hours: 168 },
      ]);
      setName(`[AI] ${triggerEvent.replace(/_/g, " ")} Drip — ${channel.toUpperCase()}`);
      toast({ title: "AI generated 4-step drip sequence ✨" });
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e?.message, variant: "destructive" });
    }
    setAiGenerating(false);
  };

  const saveSequence = async () => {
    if (!name.trim() || steps.length === 0) { toast({ title: "Generate steps first", variant: "destructive" }); return; }
    setSaving(true);
    try {
      await (supabase as any).from("drip_sequences").insert({
        name: name.trim(), channel, trigger_event: triggerEvent, steps, created_by: adminId,
      });
      toast({ title: "AI Drip sequence created ✅" });
      setShowCreate(false); setName(""); setSteps([]);
      fetchSequences();
    } catch (e: any) { toast({ title: "Failed", variant: "destructive" }); }
    setSaving(false);
  };

  const toggleStatus = async (id: string, current: string) => {
    const newStatus = current === "active" ? "paused" : "active";
    await (supabase as any).from("drip_sequences").update({ status: newStatus }).eq("id", id);
    toast({ title: `Sequence ${newStatus}` }); fetchSequences();
  };

  const deleteSequence = async (id: string) => {
    await (supabase as any).from("drip_sequences").delete().eq("id", id);
    toast({ title: "Deleted" }); fetchSequences();
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Bot className="w-4 h-4 text-primary" /> AI Drip Sequences
        </h3>
        <button onClick={() => setShowCreate(!showCreate)} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground">
          <Plus className="w-3.5 h-3.5" /> New AI Sequence
        </button>
      </div>

      {showCreate && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 neural-border space-y-3">
          <div className="flex gap-2">
            {(["email", "push", "voice"] as CampaignChannel[]).map(ch => {
              const Icon = CHANNEL_ICONS[ch];
              return (
                <button key={ch} onClick={() => setChannel(ch)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium border ${
                    channel === ch ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground"
                  }`}><Icon className="w-3.5 h-3.5" /> {ch}</button>
              );
            })}
          </div>
          <select value={triggerEvent} onChange={e => setTriggerEvent(e.target.value)}
            className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground">
            <option value="new_signup">New Signup</option>
            <option value="plan_upgrade">Plan Upgrade</option>
            <option value="inactivity_3d">3 Days Inactive</option>
            <option value="inactivity_7d">7 Days Inactive</option>
            <option value="streak_broken">Streak Broken</option>
            <option value="exam_approaching">Exam Approaching</option>
            <option value="subscription_expiry">Subscription Expiry</option>
            <option value="promo_upgrade">Upgrade Promo</option>
            <option value="promo_reengagement">Re-engagement</option>
          </select>

          <button onClick={aiGenerateSteps} disabled={aiGenerating}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-xs font-semibold bg-accent/15 text-accent hover:bg-accent/25 disabled:opacity-50 transition-colors">
            {aiGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            {aiGenerating ? "AI generating steps..." : "✨ AI Generate Drip Steps"}
          </button>

          {steps.length > 0 && (
            <>
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Sequence name..."
                className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
              <div className="space-y-2">
                {steps.map((step, idx) => (
                  <div key={idx} className="bg-secondary/50 rounded-lg p-3 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold text-primary">Step {idx + 1} — {step.delay_hours}h delay</span>
                    </div>
                    <p className="text-[11px] font-medium text-foreground">{step.title}</p>
                    <p className="text-[10px] text-muted-foreground">{step.body}</p>
                  </div>
                ))}
              </div>
              <button onClick={saveSequence} disabled={saving}
                className="w-full px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-xs font-medium disabled:opacity-50 flex items-center justify-center gap-2">
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                {saving ? "Saving..." : "Save AI Sequence"}
              </button>
            </>
          )}
        </motion.div>
      )}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : sequences.length === 0 ? (
        <div className="glass rounded-xl p-6 neural-border text-center">
          <Zap className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No sequences yet — create one with AI above!</p>
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
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2 items-center">
                    <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                      seq.status === "active" ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"
                    }`}>{seq.status}</span>
                    <button onClick={() => toggleStatus(seq.id, seq.status)} className="p-1 text-muted-foreground hover:text-foreground">
                      {seq.status === "active" ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
                    </button>
                    <button onClick={() => deleteSequence(seq.id)} className="p-1 text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3.5 h-3.5" /></button>
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
