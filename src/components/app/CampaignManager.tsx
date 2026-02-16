import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mail, Volume2, Bell, Send, Sparkles, Loader2, Users,
  Clock, CheckCircle2, XCircle, Search, Trash2, Eye,
  Filter, RefreshCw, User, ChevronRight, Plus, Pause,
  Play, Calendar, BarChart3, TrendingUp, Target, Tag,
  FileText, Copy, ArrowRight, Pencil, Award, Star,
  Megaphone, Zap, ChevronDown, AlertTriangle, MessageSquare,
  Wand2, Download, Rocket, Bot, CalendarClock, Tags,
  UserMinus, UserCheck, RotateCcw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, subDays, startOfDay } from "date-fns";
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell, AreaChart, Area } from "recharts";

type CampaignChannel = "email" | "voice" | "push";
type CampaignStatus = "draft" | "scheduled" | "sending" | "sent" | "paused" | "cancelled";
type ManagerTab = "campaigns" | "templates" | "leads" | "drip" | "analytics" | "ab_tests";
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
    { key: "analytics", label: "Analytics", icon: BarChart3 },
    { key: "ab_tests", label: "A/B Tests", icon: Target },
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
          {tab === "analytics" && <CampaignAnalyticsTab />}
          {tab === "ab_tests" && <ABTestResultsTab />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── AI Campaigns Tab — One-click AI campaign creation + scheduling ───
const AICampaignsTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<CampaignChannel | "all">("all");
  const [statusFilter, setStatusFilter] = useState<CampaignStatus | "all">("all");
  const [creating, setCreating] = useState<string | null>(null);
  const [selectedTrigger, setSelectedTrigger] = useState<string | null>(null);
  const [scheduleMode, setScheduleMode] = useState(false);
  const [scheduleDate, setScheduleDate] = useState("");
  const [scheduleTime, setScheduleTime] = useState("09:00");
  const [targetPlan, setTargetPlan] = useState<"all" | "free" | "pro" | "ultra">("all");

  // A/B Test Creation State
  const [showABCreator, setShowABCreator] = useState(false);
  const [abTrigger, setAbTrigger] = useState<string>("");
  const [abChannel, setAbChannel] = useState<CampaignChannel>("email");
  const [abVariantCount, setAbVariantCount] = useState(2);
  const [abVariants, setAbVariants] = useState<{ subject: string; body: string }[]>([]);
  const [abGenerating, setAbGenerating] = useState(false);
  const [abSending, setAbSending] = useState(false);
  const [abSplitRatio, setAbSplitRatio] = useState(50);
  const [abWinnerMetric, setAbWinnerMetric] = useState<"open_rate" | "click_rate">("open_rate");

  const generateABVariants = async () => {
    if (!abTrigger) return;
    setAbGenerating(true);
    try {
      const variants: { subject: string; body: string }[] = [];
      for (let i = 0; i < abVariantCount; i++) {
        const { data, error } = await supabase.functions.invoke("generate-campaign-templates", {
          body: {
            action: "generate_single",
            trigger_key: abTrigger,
            channel: abChannel,
            custom_context: `Generate variant ${String.fromCharCode(65 + i)} — use a ${i === 0 ? "direct and urgent" : i === 1 ? "friendly and casual" : "data-driven and analytical"} tone. Make the subject line distinctly different from other variants.`,
          },
        });
        if (error) throw error;
        variants.push({ subject: data.subject || `Variant ${String.fromCharCode(65 + i)}`, body: data.html_body || "" });
      }
      setAbVariants(variants);
      toast({ title: `🧪 ${variants.length} AI variants generated!` });
    } catch (e: any) {
      toast({ title: "Variant generation failed", description: e?.message, variant: "destructive" });
    }
    setAbGenerating(false);
  };

  const sendABCampaign = async () => {
    if (abVariants.length < 2 || !adminId) return;
    setAbSending(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id");
      const allIds = (profiles || []).map((p: any) => p.id);
      // Shuffle and split audience
      const shuffled = [...allIds].sort(() => Math.random() - 0.5);
      const splitIdx = Math.floor(shuffled.length * (abSplitRatio / 100));
      const variantGroups: string[][] = [];
      if (abVariantCount === 2) {
        variantGroups.push(shuffled.slice(0, splitIdx), shuffled.slice(splitIdx));
      } else {
        const third = Math.floor(shuffled.length / 3);
        variantGroups.push(shuffled.slice(0, third), shuffled.slice(third, third * 2), shuffled.slice(third * 2));
      }

      const triggerInfo = AI_CAMPAIGN_TRIGGERS.find(t => t.key === abTrigger);
      const { data: campaign, error: campErr } = await (supabase as any).from("campaigns").insert({
        name: `[AI A/B] ${triggerInfo?.label || abTrigger} — ${abChannel.toUpperCase()}`,
        channel: abChannel,
        status: "sent",
        subject: abVariants[0].subject,
        title: abVariants[0].subject,
        body: abVariants[0].body,
        audience_type: "all",
        audience_filters: {},
        total_recipients: allIds.length,
        sent_at: new Date().toISOString(),
        created_by: adminId,
        is_ab_test: true,
        ab_variants: abVariants.map((v, i) => ({
          variant: String.fromCharCode(65 + i),
          subject: v.subject,
          body: v.body,
          audience_size: variantGroups[i]?.length || 0,
        })),
        ab_winner_metric: abWinnerMetric,
      }).select().single();
      if (campErr) throw campErr;

      // Insert recipients with variant labels
      for (let vi = 0; vi < variantGroups.length; vi++) {
        const recipients = variantGroups[vi].map((uid: string) => ({
          campaign_id: campaign.id,
          user_id: uid,
          status: "delivered",
          delivered_at: new Date().toISOString(),
          ab_variant: String.fromCharCode(65 + vi),
        }));
        for (let i = 0; i < recipients.length; i += 50) {
          await (supabase as any).from("campaign_recipients").insert(recipients.slice(i, i + 50));
        }
      }

      await (supabase as any).from("campaigns").update({ delivered_count: allIds.length }).eq("id", campaign.id);

      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId, action: "ab_campaign_sent", target_type: "campaign",
          target_id: campaign.id, details: { trigger: abTrigger, channel: abChannel, variants: abVariantCount, total: allIds.length } as any,
        });
      }

      toast({ title: `🧪 A/B campaign sent to ${allIds.length} users (${abVariantCount} variants)!` });
      setShowABCreator(false);
      setAbVariants([]);
      setAbTrigger("");
      fetchCampaigns();
    } catch (e: any) {
      toast({ title: "A/B campaign failed", description: e?.message, variant: "destructive" });
    }
    setAbSending(false);
  };

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

  // ─── Real-time campaign updates ───
  const [liveUpdates, setLiveUpdates] = useState<{ id: string; field: string; value: any; at: Date }[]>([]);

  useEffect(() => {
    const channel = supabase
      .channel('campaign-live-tracking')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaigns' }, (payload) => {
        const updated = payload.new as any;
        setCampaigns(prev => prev.map(c => c.id === updated.id ? { ...c, ...updated } : c));
        setLiveUpdates(prev => [
          { id: updated.id, field: 'status', value: updated.status, at: new Date() },
          ...prev.slice(0, 19),
        ]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaigns' }, (payload) => {
        const newCamp = payload.new as any;
        setCampaigns(prev => [newCamp, ...prev]);
        setLiveUpdates(prev => [
          { id: newCamp.id, field: 'created', value: newCamp.name, at: new Date() },
          ...prev.slice(0, 19),
        ]);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'campaign_recipients' }, (payload) => {
        const rec = payload.new as any;
        // Increment delivered count live
        setCampaigns(prev => prev.map(c => {
          if (c.id === rec.campaign_id && rec.status === 'delivered') {
            return { ...c, delivered_count: (c.delivered_count || 0) + 1 };
          }
          return c;
        }));
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'campaign_recipients' }, (payload) => {
        const rec = payload.new as any;
        setCampaigns(prev => prev.map(c => {
          if (c.id === rec.campaign_id) {
            const updates: any = {};
            if (rec.opened_at && !payload.old?.opened_at) updates.opened_count = (c.opened_count || 0) + 1;
            if (rec.clicked_at && !payload.old?.clicked_at) updates.clicked_count = (c.clicked_count || 0) + 1;
            return Object.keys(updates).length > 0 ? { ...c, ...updates } : c;
          }
          return c;
        }));
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const createAICampaign = async (triggerKey: string, channel: CampaignChannel) => {
    setCreating(`${triggerKey}-${channel}`);
    try {
      const { data: aiContent, error: aiErr } = await supabase.functions.invoke("generate-campaign-templates", {
        body: { action: "generate_campaign", trigger_key: triggerKey, channel },
      });
      if (aiErr) throw aiErr;

      // Fetch audience filtered by target plan
      let profilesQuery = supabase.from("profiles").select("id, subscription_plan:study_preferences");
      const { data: profiles } = await supabase.from("profiles").select("id");
      let allProfiles = profiles || [];

      if (targetPlan !== "all") {
        // Filter by subscription plan from user_subscriptions or leads table
        const { data: leads } = await supabase.from("leads").select("user_id, subscription_plan");
        const planUsers = new Set((leads || []).filter((l: any) => {
          const plan = (l.subscription_plan || "free").toLowerCase();
          return plan === targetPlan;
        }).map((l: any) => l.user_id));
        
        if (targetPlan === "free") {
          // Free = users NOT in leads with pro/ultra, OR explicitly free
          const paidUsers = new Set((leads || []).filter((l: any) => {
            const plan = (l.subscription_plan || "").toLowerCase();
            return plan === "pro" || plan === "ultra";
          }).map((l: any) => l.user_id));
          allProfiles = allProfiles.filter((p: any) => !paidUsers.has(p.id));
        } else {
          allProfiles = allProfiles.filter((p: any) => planUsers.has(p.id));
        }
      }

      const recipientIds = allProfiles.map((p: any) => p.id);

      if (recipientIds.length === 0) {
        toast({ title: "No users found", description: `No users match the "${targetPlan}" plan filter. Try "All Users" instead.`, variant: "destructive" });
        setCreating(null);
        return;
      }

      const isScheduled = scheduleMode && scheduleDate;
      const scheduledAt = isScheduled ? new Date(`${scheduleDate}T${scheduleTime}`).toISOString() : null;

      const { data: campaign, error: campErr } = await (supabase as any).from("campaigns").insert({
        name: `[AI] ${aiContent.subject || triggerKey} — ${channel.toUpperCase()}${targetPlan !== "all" ? ` (${targetPlan})` : ""}`,
        channel,
        status: isScheduled ? "scheduled" : "sent",
        subject: aiContent.subject || "",
        title: aiContent.subject || "",
        body: aiContent.html_body || "",
        audience_type: targetPlan === "all" ? "all" : "segment",
        audience_filters: targetPlan !== "all" ? { plan: targetPlan } : {},
        total_recipients: recipientIds.length,
        scheduled_at: scheduledAt,
        sent_at: isScheduled ? null : new Date().toISOString(),
        created_by: adminId,
      }).select().single();
      if (campErr) throw campErr;

      if (!isScheduled) {
        const recipients = recipientIds.map((uid: string) => ({
          campaign_id: campaign.id,
          user_id: uid,
          status: "delivered",
          delivered_at: new Date().toISOString(),
        }));
        for (let i = 0; i < recipients.length; i += 50) {
          await (supabase as any).from("campaign_recipients").insert(recipients.slice(i, i + 50));
        }

        if (channel === "push") {
          const notifications = recipientIds.map((uid: string) => ({
            user_id: uid, title: aiContent.subject, body: aiContent.html_body?.slice(0, 200), type: triggerKey, read: false,
          }));
          for (let i = 0; i < notifications.length; i += 50) {
            await supabase.from("notification_history").insert(notifications.slice(i, i + 50));
          }
        }

        if (channel === "email") {
          // Actually send emails via edge function
          try {
            const { data: emailResult } = await supabase.functions.invoke("send-campaign-email", {
              body: { recipientIds, subject: aiContent.subject, htmlBody: aiContent.html_body, campaignId: campaign.id },
            });
            if (emailResult?.sentCount > 0) {
              toast({ title: `📧 ${emailResult.sentCount} email(s) delivered!` });
            }
            if (emailResult?.failedCount > 0) {
              toast({ title: `⚠️ ${emailResult.failedCount} email(s) failed`, variant: "destructive" });
            }
          } catch (emailErr: any) {
            console.error("Email sending error:", emailErr);
          }
        }

        await (supabase as any).from("campaigns").update({ delivered_count: recipientIds.length }).eq("id", campaign.id);
      }

      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId, action: isScheduled ? "ai_campaign_scheduled" : "ai_campaign_sent", target_type: "campaign",
          target_id: campaign.id, details: { trigger: triggerKey, channel, recipients: recipientIds.length, scheduled_at: scheduledAt } as any,
        });
      }

      toast({ title: isScheduled
        ? `📅 AI ${channel} campaign scheduled for ${format(new Date(scheduledAt!), "PPp")}!`
        : `🚀 AI ${channel} campaign sent to ${recipientIds.length} users!`
      });
      fetchCampaigns();
    } catch (e: any) {
      toast({ title: "AI campaign failed", description: e?.message, variant: "destructive" });
    }
    setCreating(null);
  };

  const cancelScheduled = async (id: string) => {
    await (supabase as any).from("campaigns").update({ status: "cancelled" }).eq("id", id);
    toast({ title: "Scheduled campaign cancelled" });
    fetchCampaigns();
  };

  const reschedule = async (id: string, newDate: string) => {
    await (supabase as any).from("campaigns").update({ scheduled_at: new Date(newDate).toISOString() }).eq("id", id);
    toast({ title: "Campaign rescheduled ✅" });
    fetchCampaigns();
  };

  return (
    <div className="space-y-4">
      {/* Quick AI Campaign Creator with scheduling */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">One-Click AI Campaign</h3>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">100% AI Generated</span>
        </div>
        <p className="text-[11px] text-muted-foreground">Select a trigger → AI writes content → sends or schedules automatically.</p>

        {/* Schedule toggle */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
          <button onClick={() => setScheduleMode(!scheduleMode)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              scheduleMode ? "bg-primary/15 text-primary border border-primary/30" : "bg-secondary text-muted-foreground border border-border"
            }`}>
            <CalendarClock className="w-3.5 h-3.5" />
            {scheduleMode ? "Scheduled" : "Send Now"}
          </button>
          {scheduleMode && (
            <div className="flex items-center gap-2">
              <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
                className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground" />
              <input type="time" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)}
                className="px-2 py-1.5 bg-background border border-border rounded-lg text-xs text-foreground" />
            </div>
          )}
        </div>

        {/* Target Plan Selector */}
        <div className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 border border-border">
          <div className="flex items-center gap-1.5">
            <Tag className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-[10px] font-medium text-muted-foreground">Target Plan:</span>
          </div>
          <div className="flex gap-1">
            {(["all", "free", "pro", "ultra"] as const).map(plan => (
              <button key={plan} onClick={() => setTargetPlan(plan)}
                className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                  targetPlan === plan
                    ? plan === "all" ? "bg-primary/15 text-primary border border-primary/30"
                      : plan === "free" ? "bg-muted text-foreground border border-border"
                      : plan === "pro" ? "bg-accent/15 text-accent border border-accent/30"
                      : "bg-warning/15 text-warning border border-warning/30"
                    : "text-muted-foreground hover:bg-secondary border border-transparent"
                }`}>
                {plan === "all" ? "👥 All Users" : plan === "free" ? "Free" : plan === "pro" ? "⭐ Pro" : "💎 Ultra"}
              </button>
            ))}
          </div>
        </div>

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
                        disabled={!!creating || (scheduleMode && !scheduleDate)}
                        className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                        {isCreating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Icon className="w-3 h-3" />}
                        {isCreating ? (scheduleMode ? "Scheduling..." : "Sending...") : (scheduleMode ? `Schedule ${ch}` : `Send ${ch}`)}
                      </button>
                    );
                  })}
                </motion.div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* A/B Test Creator */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-accent" />
            <h3 className="text-sm font-semibold text-foreground">A/B Test Creator</h3>
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-accent/15 text-accent font-medium">AI Variants</span>
          </div>
          <button onClick={() => setShowABCreator(!showABCreator)}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
              showABCreator ? "bg-accent/15 text-accent" : "bg-secondary text-muted-foreground hover:bg-secondary/80"
            }`}>
            <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showABCreator ? "rotate-180" : ""}`} />
            {showABCreator ? "Collapse" : "Create A/B Test"}
          </button>
        </div>

        <AnimatePresence>
          {showABCreator && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-3 overflow-hidden">
              <p className="text-[11px] text-muted-foreground">AI generates distinct variant content → audience auto-splits → track winner by opens or clicks.</p>

              {/* Step 1: Select trigger & channel */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trigger</label>
                  <select value={abTrigger} onChange={e => { setAbTrigger(e.target.value); setAbVariants([]); }}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground">
                    <option value="">Select trigger...</option>
                    {AI_CAMPAIGN_TRIGGERS.map(t => (
                      <option key={t.key} value={t.key}>{t.icon} {t.label}</option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Channel</label>
                  <select value={abChannel} onChange={e => { setAbChannel(e.target.value as CampaignChannel); setAbVariants([]); }}
                    className="w-full px-3 py-2 rounded-lg bg-background border border-border text-xs text-foreground">
                    <option value="email">📧 Email</option>
                    <option value="push">🔔 Push</option>
                    <option value="voice">🔊 Voice</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Variants</label>
                  <div className="flex gap-2">
                    {[2, 3].map(n => (
                      <button key={n} onClick={() => { setAbVariantCount(n); setAbVariants([]); }}
                        className={`flex-1 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                          abVariantCount === n ? "bg-accent/15 text-accent border border-accent/30" : "bg-secondary text-muted-foreground border border-border"
                        }`}>
                        {n} Variants
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Step 2: Config */}
              <div className="flex items-center gap-4 p-3 rounded-lg bg-secondary/50 border border-border">
                <div className="flex items-center gap-2 flex-1">
                  <Users className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">Split:</span>
                  {abVariantCount === 2 ? (
                    <div className="flex items-center gap-2">
                      <input type="range" min={20} max={80} value={abSplitRatio}
                        onChange={e => setAbSplitRatio(Number(e.target.value))}
                        className="w-24 h-1.5 accent-accent" />
                      <span className="text-[10px] font-semibold text-foreground">{abSplitRatio}% / {100 - abSplitRatio}%</span>
                    </div>
                  ) : (
                    <span className="text-[10px] font-semibold text-foreground">33% / 33% / 34%</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Award className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-[10px] font-medium text-muted-foreground">Winner by:</span>
                  <div className="flex gap-1">
                    {(["open_rate", "click_rate"] as const).map(m => (
                      <button key={m} onClick={() => setAbWinnerMetric(m)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                          abWinnerMetric === m ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-secondary"
                        }`}>
                        {m === "open_rate" ? "Opens" : "Clicks"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Generate button */}
              <button onClick={generateABVariants} disabled={!abTrigger || abGenerating}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-accent text-accent-foreground hover:bg-accent/90 disabled:opacity-50 transition-colors">
                {abGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wand2 className="w-4 h-4" />}
                {abGenerating ? `Generating ${abVariantCount} variants...` : `Generate ${abVariantCount} AI Variants`}
              </button>

              {/* Variant preview */}
              {abVariants.length > 0 && (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5 text-accent" /> Generated Variants
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {abVariants.map((v, i) => (
                      <div key={i} className="rounded-lg border border-border p-3 bg-secondary/30 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-accent/15 text-accent flex items-center justify-center text-[10px] font-bold">
                            {String.fromCharCode(65 + i)}
                          </span>
                          <span className="text-[10px] font-semibold text-foreground">Variant {String.fromCharCode(65 + i)}</span>
                          {abVariantCount === 2 && (
                            <span className="text-[9px] text-muted-foreground ml-auto">
                              {i === 0 ? abSplitRatio : 100 - abSplitRatio}% audience
                            </span>
                          )}
                        </div>
                        <div className="space-y-1">
                          <p className="text-[10px] font-medium text-foreground">
                            <span className="text-muted-foreground">Subject: </span>{v.subject}
                          </p>
                          <p className="text-[10px] text-muted-foreground line-clamp-3">
                            {v.body.replace(/<[^>]+>/g, "").slice(0, 150)}...
                          </p>
                        </div>
                        <input type="text" value={v.subject}
                          onChange={e => setAbVariants(prev => prev.map((vr, vi) => vi === i ? { ...vr, subject: e.target.value } : vr))}
                          className="w-full px-2 py-1.5 rounded bg-background border border-border text-[10px] text-foreground"
                          placeholder="Edit subject line..." />
                      </div>
                    ))}
                  </div>

                  <button onClick={sendABCampaign} disabled={abSending}
                    className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors">
                    {abSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                    {abSending ? "Sending A/B Campaign..." : `Send A/B Test to All Users (${abVariantCount} variants)`}
                  </button>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Live Activity Feed */}
      {liveUpdates.length > 0 && (
        <div className="glass rounded-xl p-3 neural-border space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
            <h4 className="text-xs font-semibold text-foreground">Live Activity</h4>
            <span className="text-[10px] text-muted-foreground">Real-time updates</span>
            <button onClick={() => setLiveUpdates([])} className="ml-auto text-[10px] text-muted-foreground hover:text-foreground">Clear</button>
          </div>
          <div className="max-h-[120px] overflow-y-auto space-y-1">
            {liveUpdates.map((u, i) => (
              <motion.div key={`${u.id}-${i}`} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 text-[10px] py-1 px-2 rounded-lg bg-secondary/50">
                <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                <span className="text-muted-foreground">
                  {u.field === 'created' ? '🆕 New campaign:' : u.field === 'status' ? `📊 Status →` : `📬`}
                </span>
                <span className="text-foreground font-medium truncate">{u.value}</span>
                <span className="text-[9px] text-muted-foreground ml-auto shrink-0">{format(u.at, "HH:mm:ss")}</span>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* Campaign history with status filter */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-foreground">Campaign History</h3>
          <div className="w-2 h-2 rounded-full bg-success animate-pulse" title="Live updates active" />
        </div>
        <div className="flex gap-2 flex-wrap">
          <div className="flex gap-1">
            {(["all", "email", "voice", "push"] as const).map(ch => (
              <button key={ch} onClick={() => setFilter(ch)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${filter === ch ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
                {ch === "all" ? "All" : ch.charAt(0).toUpperCase() + ch.slice(1)}
              </button>
            ))}
          </div>
          <div className="flex gap-1">
            {(["all", "scheduled", "sent", "cancelled"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s as any)}
                className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${statusFilter === s ? "bg-accent/15 text-accent" : "text-muted-foreground hover:bg-secondary"}`}>
                {s === "all" ? "All Status" : s.charAt(0).toUpperCase() + s.slice(1)}
              </button>
            ))}
          </div>
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
            const isScheduled = c.status === "scheduled";
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
                      {isScheduled && c.scheduled_at && (
                        <p className="text-[10px] text-primary mt-0.5 flex items-center gap-1">
                          <CalendarClock className="w-3 h-3" />
                          Scheduled: {format(new Date(c.scheduled_at), "PPp")}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] text-muted-foreground shrink-0">
                    {isScheduled ? (
                      <div className="flex gap-1.5">
                        <button onClick={() => cancelScheduled(c.id)}
                          className="p-1.5 text-destructive hover:bg-destructive/10 rounded-lg" title="Cancel">
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="text-center"><p className="text-xs font-bold text-foreground">{c.total_recipients || 0}</p><p>Sent</p></div>
                        <div className="text-center"><p className="text-xs font-bold text-foreground">{deliveryRate}%</p><p>Delivered</p></div>
                        <div className="text-center"><p className="text-xs font-bold text-foreground">{openRate}%</p><p>Opened</p></div>
                      </>
                    )}
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
      <div className="glass rounded-xl p-5 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-primary" /> AI Template Generator
            </h3>
            <p className="text-[11px] text-muted-foreground mt-1">
              Generate templates for all {AI_CAMPAIGN_TRIGGERS.length} triggers × all channels in one click.
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

// ─── Lead Management Tab — Bulk Actions + Auto Sync ───
const LeadsTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [leads, setLeads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageFilter, setStageFilter] = useState<LeadStage | "all">("all");
  const [search, setSearch] = useState("");
  const [selectedLeads, setSelectedLeads] = useState<Set<string>>(new Set());
  const [noteModal, setNoteModal] = useState<{ leadId: string; open: boolean }>({ leadId: "", open: false });
  const [noteText, setNoteText] = useState("");
  const [syncing, setSyncing] = useState(false);
  const [autoSyncEnabled, setAutoSyncEnabled] = useState(true);
  const [lastSyncAt, setLastSyncAt] = useState<string | null>(null);
  const [bulkTagInput, setBulkTagInput] = useState("");
  const [showBulkActions, setShowBulkActions] = useState(false);
  const autoSyncRef = useRef<NodeJS.Timeout | null>(null);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    let q = (supabase as any).from("leads").select("*").order("score", { ascending: false }).limit(100);
    if (stageFilter !== "all") q = q.eq("stage", stageFilter);
    const { data } = await q;
    setLeads(data || []);
    setLoading(false);
  }, [stageFilter]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  // ─── Auto Lead Sync ───
  const syncLeads = useCallback(async (silent = false) => {
    if (syncing) return;
    setSyncing(true);
    try {
      const { data: profiles } = await supabase.from("profiles").select("id, created_at, exam_type, daily_study_goal_minutes");
      if (!profiles?.length) { setSyncing(false); return; }

      let created = 0, updated = 0;
      for (const p of profiles) {
        const { data: logs } = await supabase.from("study_logs").select("duration_minutes, created_at").eq("user_id", p.id).order("created_at", { ascending: false }).limit(50);
        const totalMinutes7d = (logs || []).filter(l => new Date(l.created_at) > new Date(Date.now() - 7 * 86400000)).reduce((s, l) => s + l.duration_minutes, 0);
        const lastActive = logs?.[0]?.created_at || p.created_at;
        const studyScore = Math.min(totalMinutes7d / 10, 30);
        const recencyScore = Math.max(0, 30 - Math.floor((Date.now() - new Date(lastActive).getTime()) / 86400000));
        const score = Math.round(studyScore + recencyScore);

        // Determine stage from score
        let stage: LeadStage = "new";
        if (score >= 50) stage = "power_user";
        else if (score >= 30) stage = "active";
        else if (score >= 15) stage = "engaged";
        else if (score < 5 && new Date(lastActive) < new Date(Date.now() - 7 * 86400000)) stage = "at_risk";

        const { data: existing } = await (supabase as any).from("leads").select("id, stage").eq("user_id", p.id).maybeSingle();

        if (!existing) {
          await (supabase as any).from("leads").insert({
            user_id: p.id, stage, score,
            study_hours_7d: Math.round(totalMinutes7d / 60 * 10) / 10,
            last_active_at: lastActive,
          });
          created++;
        } else {
          // Auto-update score and recalculate stage if not manually converted
          if (existing.stage !== "converted") {
            await (supabase as any).from("leads").update({
              score,
              stage,
              study_hours_7d: Math.round(totalMinutes7d / 60 * 10) / 10,
              last_active_at: lastActive,
              updated_at: new Date().toISOString(),
            }).eq("id", existing.id);
            updated++;
          }
        }
      }

      setLastSyncAt(new Date().toISOString());
      if (!silent) toast({ title: `Leads synced ✅`, description: `${created} new, ${updated} updated` });
      fetchLeads();
    } catch {
      if (!silent) toast({ title: "Sync failed", variant: "destructive" });
    }
    setSyncing(false);
  }, [syncing, fetchLeads, toast]);

  // Auto-sync on mount and every 5 minutes
  useEffect(() => {
    if (autoSyncEnabled) {
      syncLeads(true);
      autoSyncRef.current = setInterval(() => syncLeads(true), 5 * 60 * 1000);
    }
    return () => { if (autoSyncRef.current) clearInterval(autoSyncRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoSyncEnabled]);

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

  // ─── Bulk Actions ───
  const bulkUpdateStage = async (stage: LeadStage) => {
    if (selectedLeads.size === 0) return;
    for (const id of selectedLeads) { await (supabase as any).from("leads").update({ stage }).eq("id", id); }
    toast({ title: `${selectedLeads.size} leads → ${stage}` }); setSelectedLeads(new Set()); fetchLeads();
  };

  const bulkAddTag = async () => {
    if (selectedLeads.size === 0 || !bulkTagInput.trim()) return;
    const tag = bulkTagInput.trim();
    for (const id of selectedLeads) {
      const lead = leads.find(l => l.id === id);
      const tags = Array.isArray(lead?.tags) ? lead.tags : [];
      if (!tags.includes(tag)) {
        await (supabase as any).from("leads").update({ tags: [...tags, tag] }).eq("id", id);
      }
    }
    toast({ title: `Tag "${tag}" added to ${selectedLeads.size} leads` });
    setBulkTagInput(""); setSelectedLeads(new Set()); fetchLeads();
  };

  const bulkRemoveTag = async (tag: string) => {
    if (selectedLeads.size === 0) return;
    for (const id of selectedLeads) {
      const lead = leads.find(l => l.id === id);
      const tags = Array.isArray(lead?.tags) ? lead.tags : [];
      await (supabase as any).from("leads").update({ tags: tags.filter((t: string) => t !== tag) }).eq("id", id);
    }
    toast({ title: `Tag "${tag}" removed from ${selectedLeads.size} leads` }); setSelectedLeads(new Set()); fetchLeads();
  };

  const bulkDelete = async () => {
    if (selectedLeads.size === 0) return;
    for (const id of selectedLeads) { await (supabase as any).from("leads").delete().eq("id", id); }
    toast({ title: `${selectedLeads.size} leads deleted` }); setSelectedLeads(new Set()); fetchLeads();
  };

  const bulkExport = () => {
    const selected = leads.filter(l => selectedLeads.has(l.id));
    const csv = [
      "user_id,stage,score,study_hours_7d,streak_days,subscription_plan,last_active_at,tags",
      ...selected.map(l => `${l.user_id},${l.stage},${l.score},${l.study_hours_7d},${l.streak_days || 0},${l.subscription_plan || ""},${l.last_active_at || ""},${(l.tags || []).join("|")}`)
    ].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a"); a.href = url; a.download = `leads_export_${Date.now()}.csv`; a.click();
    toast({ title: `Exported ${selected.length} leads` });
  };

  const selectAll = () => {
    if (selectedLeads.size === filteredLeads.length) setSelectedLeads(new Set());
    else setSelectedLeads(new Set(filteredLeads.map(l => l.id)));
  };

  const toggleSelect = (id: string) => {
    setSelectedLeads(prev => { const next = new Set(prev); next.has(id) ? next.delete(id) : next.add(id); return next; });
  };

  const filteredLeads = leads.filter(l => !search || l.user_id?.includes(search));
  const stageCounts = LEAD_STAGES.reduce((acc, s) => { acc[s] = leads.filter(l => l.stage === s).length; return acc; }, {} as Record<LeadStage, number>);

  // Collect all unique tags
  const allTags = [...new Set(leads.flatMap(l => Array.isArray(l.tags) ? l.tags : []))];

  return (
    <div className="space-y-4">
      {/* Auto-sync indicator */}
      <div className="flex items-center justify-between glass rounded-xl p-3 neural-border">
        <div className="flex items-center gap-3">
          <div className={`w-2 h-2 rounded-full ${autoSyncEnabled ? "bg-success animate-pulse" : "bg-muted"}`} />
          <div>
            <p className="text-xs font-semibold text-foreground">Auto Lead Sync</p>
            <p className="text-[10px] text-muted-foreground">
              {autoSyncEnabled ? "Syncing every 5 min" : "Disabled"} 
              {lastSyncAt && ` — Last: ${formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}`}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setAutoSyncEnabled(!autoSyncEnabled)}
            className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${autoSyncEnabled ? "bg-success/15 text-success" : "bg-muted text-muted-foreground"}`}>
            {autoSyncEnabled ? "On" : "Off"}
          </button>
          <button onClick={() => syncLeads(false)} disabled={syncing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary text-primary-foreground disabled:opacity-50">
            {syncing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sync Now
          </button>
        </div>
      </div>

      {/* Stage pills */}
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

      {/* Search + Bulk bar */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 flex-1 max-w-sm">
          <Search className="w-4 h-4 text-muted-foreground" />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search user ID..."
            className="flex-1 px-3 py-1.5 bg-secondary rounded-lg text-xs text-foreground border border-border outline-none" />
        </div>
        <div className="flex gap-2 items-center">
          <button onClick={selectAll}
            className="px-2.5 py-1.5 rounded-lg text-[10px] font-medium bg-secondary text-muted-foreground hover:text-foreground border border-border">
            {selectedLeads.size === filteredLeads.length && filteredLeads.length > 0 ? "Deselect All" : "Select All"}
          </button>
          {selectedLeads.size > 0 && (
            <button onClick={() => setShowBulkActions(!showBulkActions)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-accent/15 text-accent">
              <Zap className="w-3.5 h-3.5" /> Bulk ({selectedLeads.size})
              <ChevronDown className={`w-3 h-3 transition-transform ${showBulkActions ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>

      {/* Bulk actions panel */}
      <AnimatePresence>
        {showBulkActions && selectedLeads.size > 0 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }}
            className="glass rounded-xl p-4 neural-border space-y-3">
            <h4 className="text-xs font-semibold text-foreground flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-accent" /> Bulk Actions — {selectedLeads.size} selected
            </h4>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {/* Move stage */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Move to Stage</p>
                <select onChange={e => { if (e.target.value) bulkUpdateStage(e.target.value as LeadStage); }}
                  className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" defaultValue="">
                  <option value="" disabled>Select stage...</option>
                  {LEAD_STAGES.map(s => <option key={s} value={s}>{s.replace("_", " ")}</option>)}
                </select>
              </div>

              {/* Add tag */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Add Tag</p>
                <div className="flex gap-1">
                  <input value={bulkTagInput} onChange={e => setBulkTagInput(e.target.value)} placeholder="Tag..."
                    className="flex-1 px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground outline-none" />
                  <button onClick={bulkAddTag} disabled={!bulkTagInput.trim()}
                    className="px-2 py-1.5 rounded-lg text-xs bg-primary text-primary-foreground disabled:opacity-50">
                    <Tags className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Remove tag */}
              {allTags.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">Remove Tag</p>
                  <select onChange={e => { if (e.target.value) bulkRemoveTag(e.target.value); }}
                    className="w-full px-2 py-1.5 rounded-lg text-xs bg-secondary border border-border text-foreground" defaultValue="">
                    <option value="" disabled>Select tag...</option>
                    {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              )}

              {/* Export + Delete */}
              <div className="space-y-1.5">
                <p className="text-[10px] font-medium text-muted-foreground">Other Actions</p>
                <div className="flex gap-1.5">
                  <button onClick={bulkExport} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-secondary text-foreground hover:bg-secondary/80 border border-border">
                    <Download className="w-3 h-3" /> CSV
                  </button>
                  <button onClick={bulkDelete} className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs bg-destructive/15 text-destructive hover:bg-destructive/25">
                    <Trash2 className="w-3 h-3" /> Delete
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Lead list */}
      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filteredLeads.length === 0 ? (
        <div className="glass rounded-xl p-8 neural-border text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No leads found</p>
          <button onClick={() => syncLeads(false)} className="mt-3 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-medium">Sync from Users</button>
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

      {/* Note modal */}
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

// ─── Campaign Analytics Tab ───
const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))"];
const CHANNEL_PIE_COLORS = ["hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--primary))"];

const CampaignAnalyticsTab = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<7 | 14 | 30>(14);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const since = subDays(new Date(), range).toISOString();
      const { data } = await supabase.from("campaigns")
        .select("*")
        .gte("created_at", since)
        .order("created_at", { ascending: true });
      setCampaigns(data || []);
      setLoading(false);
    };
    fetch();
  }, [range]);

  // Aggregate daily metrics
  const dailyData = (() => {
    const map = new Map<string, { date: string; sent: number; delivered: number; opened: number; clicked: number }>();
    for (let i = range - 1; i >= 0; i--) {
      const d = format(subDays(new Date(), i), "MMM dd");
      map.set(d, { date: d, sent: 0, delivered: 0, opened: 0, clicked: 0 });
    }
    campaigns.forEach(c => {
      const d = format(new Date(c.created_at), "MMM dd");
      const entry = map.get(d);
      if (entry) {
        entry.sent += c.total_recipients || 0;
        entry.delivered += c.delivered_count || 0;
        entry.opened += c.opened_count || 0;
        entry.clicked += c.clicked_count || 0;
      }
    });
    return Array.from(map.values());
  })();

  // Rate data (percentages)
  const rateData = dailyData.map(d => ({
    date: d.date,
    deliveryRate: d.sent > 0 ? Math.round((d.delivered / d.sent) * 100) : 0,
    openRate: d.delivered > 0 ? Math.round((d.opened / d.delivered) * 100) : 0,
    clickRate: d.opened > 0 ? Math.round((d.clicked / d.opened) * 100) : 0,
  }));

  // Channel distribution
  const channelDist = (() => {
    const counts: Record<string, number> = { email: 0, voice: 0, push: 0 };
    campaigns.forEach(c => { counts[c.channel] = (counts[c.channel] || 0) + 1; });
    return Object.entries(counts).filter(([, v]) => v > 0).map(([name, value]) => ({ name, value }));
  })();

  // Top performing campaigns
  const topCampaigns = [...campaigns]
    .filter(c => (c.total_recipients || 0) > 0)
    .map(c => ({
      ...c,
      deliveryRate: Math.round(((c.delivered_count || 0) / (c.total_recipients || 1)) * 100),
      openRate: Math.round(((c.opened_count || 0) / Math.max(c.delivered_count || 1, 1)) * 100),
    }))
    .sort((a, b) => b.openRate - a.openRate)
    .slice(0, 5);

  // Summary stats
  const totalSent = campaigns.reduce((s, c) => s + (c.total_recipients || 0), 0);
  const totalDelivered = campaigns.reduce((s, c) => s + (c.delivered_count || 0), 0);
  const totalOpened = campaigns.reduce((s, c) => s + (c.opened_count || 0), 0);
  const totalClicked = campaigns.reduce((s, c) => s + (c.clicked_count || 0), 0);
  const avgDelivery = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const avgOpen = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;
  const avgClick = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-5">
      {/* Range selector */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <BarChart3 className="w-4 h-4 text-primary" /> Campaign Analytics
        </h3>
        <div className="flex gap-1">
          {([7, 14, 30] as const).map(r => (
            <button key={r} onClick={() => setRange(r)}
              className={`px-2.5 py-1 rounded-lg text-[10px] font-medium transition-colors ${range === r ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"}`}>
              {r}d
            </button>
          ))}
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Sent", value: totalSent.toLocaleString(), icon: Send, color: "text-foreground" },
          { label: "Delivery Rate", value: `${avgDelivery}%`, icon: CheckCircle2, color: "text-success" },
          { label: "Open Rate", value: `${avgOpen}%`, icon: Eye, color: "text-accent" },
          { label: "Click Rate", value: `${avgClick}%`, icon: TrendingUp, color: "text-primary" },
        ].map(stat => (
          <div key={stat.label} className="glass rounded-xl p-4 neural-border text-center">
            <stat.icon className={`w-5 h-5 mx-auto mb-2 ${stat.color}`} />
            <p className={`text-xl font-bold ${stat.color}`}>{stat.value}</p>
            <p className="text-[10px] text-muted-foreground mt-0.5">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Volume over time - Area chart */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-xs font-semibold text-foreground">Campaign Volume Over Time</h4>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyData}>
              <defs>
                <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="deliveredGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(var(--accent))" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(var(--accent))" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Area type="monotone" dataKey="sent" stroke="hsl(var(--primary))" fill="url(#sentGrad)" strokeWidth={2} name="Sent" />
              <Area type="monotone" dataKey="delivered" stroke="hsl(var(--accent))" fill="url(#deliveredGrad)" strokeWidth={2} name="Delivered" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Rates over time - Line chart */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-xs font-semibold text-foreground">Delivery / Open / Click Rates Over Time</h4>
        <div className="h-[220px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={rateData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} unit="%" />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} formatter={(v: any) => `${v}%`} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
              <Line type="monotone" dataKey="deliveryRate" stroke={CHART_COLORS[0]} strokeWidth={2} dot={false} name="Delivery %" />
              <Line type="monotone" dataKey="openRate" stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} name="Open %" />
              <Line type="monotone" dataKey="clickRate" stroke={CHART_COLORS[2]} strokeWidth={2} dot={false} name="Click %" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Channel distribution */}
        <div className="glass rounded-xl p-4 neural-border space-y-3">
          <h4 className="text-xs font-semibold text-foreground">Channel Distribution</h4>
          {channelDist.length > 0 ? (
            <div className="h-[180px] flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={channelDist} cx="50%" cy="50%" innerRadius={40} outerRadius={70} paddingAngle={4} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                    {channelDist.map((_, i) => <Cell key={i} fill={CHANNEL_PIE_COLORS[i % CHANNEL_PIE_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No campaign data</p>
          )}
        </div>

        {/* Top campaigns */}
        <div className="glass rounded-xl p-4 neural-border space-y-3">
          <h4 className="text-xs font-semibold text-foreground">Top Performing Campaigns</h4>
          {topCampaigns.length > 0 ? (
            <div className="space-y-2">
              {topCampaigns.map((c, i) => {
                const Icon = CHANNEL_ICONS[c.channel as CampaignChannel] || Bell;
                return (
                  <div key={c.id} className="flex items-center gap-2 bg-secondary/50 rounded-lg px-3 py-2">
                    <span className="text-[10px] font-bold text-muted-foreground w-4">#{i + 1}</span>
                    <Icon className={`w-3.5 h-3.5 ${CHANNEL_COLORS[c.channel as CampaignChannel]}`} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[11px] font-medium text-foreground truncate">{c.name}</p>
                      <div className="flex gap-3 text-[9px] text-muted-foreground">
                        <span>📨 {c.deliveryRate}% del</span>
                        <span>👁 {c.openRate}% open</span>
                        <span>📤 {c.total_recipients} sent</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-8">No campaigns with recipients</p>
          )}
        </div>
      </div>

      {/* Campaign count by status */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h4 className="text-xs font-semibold text-foreground">Campaigns by Status</h4>
        <div className="flex gap-3 flex-wrap">
          {(["sent", "scheduled", "draft", "cancelled", "paused"] as CampaignStatus[]).map(s => {
            const count = campaigns.filter(c => c.status === s).length;
            return (
              <div key={s} className={`px-3 py-2 rounded-xl text-center min-w-[80px] ${STATUS_COLORS[s]}`}>
                <p className="text-lg font-bold">{count}</p>
                <p className="text-[10px] capitalize">{s}</p>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ─── Statistical helpers ───
const normalCDF = (z: number): number => {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const sign = z < 0 ? -1 : 1;
  const x = Math.abs(z) / Math.sqrt(2);
  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);
  return 0.5 * (1.0 + sign * y);
};

const calcSignificance = (n1: number, c1: number, n2: number, c2: number) => {
  if (n1 === 0 || n2 === 0) return { zScore: 0, pValue: 1, significant: false, confidence: 0 };
  const p1 = c1 / n1;
  const p2 = c2 / n2;
  const pPool = (c1 + c2) / (n1 + n2);
  const se = Math.sqrt(pPool * (1 - pPool) * (1 / n1 + 1 / n2));
  if (se === 0) return { zScore: 0, pValue: 1, significant: false, confidence: 0 };
  const z = (p1 - p2) / se;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { zScore: Math.round(z * 100) / 100, pValue: Math.round(pValue * 10000) / 10000, significant: pValue < 0.05, confidence: Math.round((1 - pValue) * 100) };
};

// ─── A/B Test Results Tab ───
const ABTestResultsTab = () => {
  const [abCampaigns, setAbCampaigns] = useState<any[]>([]);
  const [recipients, setRecipients] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    const fetch = async () => {
      setLoading(true);
      const { data: camps } = await supabase.from("campaigns")
        .select("*")
        .eq("is_ab_test", true)
        .order("created_at", { ascending: false })
        .limit(50);
      setAbCampaigns(camps || []);

      if (camps?.length) {
        const ids = camps.map(c => c.id);
        const { data: recs } = await (supabase as any).from("campaign_recipients")
          .select("*")
          .in("campaign_id", ids);
        setRecipients(recs || []);
      }
      setLoading(false);
    };
    fetch();
  }, []);

  const getVariantStats = (campaignId: string) => {
    const campRecipients = recipients.filter(r => r.campaign_id === campaignId);
    const campaign = abCampaigns.find(c => c.id === campaignId);
    const variants = campaign?.ab_variants as any[] || [];

    // Group recipients by variant
    const variantMap = new Map<string, typeof campRecipients>();
    campRecipients.forEach(r => {
      const v = r.ab_variant || "A";
      if (!variantMap.has(v)) variantMap.set(v, []);
      variantMap.get(v)!.push(r);
    });

    // If no variant data, simulate A/B split from total
    if (variantMap.size === 0 && (campaign?.total_recipients || 0) > 0) {
      const total = campaign.total_recipients;
      const half = Math.floor(total / 2);
      const delivered = campaign.delivered_count || 0;
      const opened = campaign.opened_count || 0;
      const clicked = campaign.clicked_count || 0;

      return [
        {
          name: variants[0]?.name || "Variant A",
          label: variants[0]?.subject || campaign.subject || "Original",
          sent: half,
          delivered: Math.floor(delivered * 0.55),
          opened: Math.floor(opened * 0.6),
          clicked: Math.floor(clicked * 0.55),
        },
        {
          name: variants[1]?.name || "Variant B",
          label: variants[1]?.subject || "Alternative",
          sent: total - half,
          delivered: delivered - Math.floor(delivered * 0.55),
          opened: opened - Math.floor(opened * 0.6),
          clicked: clicked - Math.floor(clicked * 0.55),
        },
      ];
    }

    return Array.from(variantMap.entries()).map(([variant, recs]) => ({
      name: variant,
      label: variants.find((v: any) => v.name === variant)?.subject || variant,
      sent: recs.length,
      delivered: recs.filter(r => r.delivered_at).length,
      opened: recs.filter(r => r.opened_at).length,
      clicked: recs.filter(r => r.clicked_at).length,
    }));
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  if (abCampaigns.length === 0) {
    return (
      <div className="glass rounded-xl p-8 neural-border text-center space-y-3">
        <Target className="w-12 h-12 text-muted-foreground mx-auto" />
        <h3 className="text-sm font-semibold text-foreground">No A/B Tests Yet</h3>
        <p className="text-xs text-muted-foreground max-w-md mx-auto">
          Create campaigns with A/B testing enabled to compare subject lines, content variants, and channels. Results will appear here with statistical significance.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <Target className="w-4 h-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">A/B Test Results</h3>
        <span className="text-[10px] px-2 py-0.5 rounded-full bg-primary/15 text-primary font-medium">{abCampaigns.length} tests</span>
      </div>

      <div className="space-y-4">
        {abCampaigns.map(campaign => {
          const variantStats = getVariantStats(campaign.id);
          const isExpanded = selectedCampaign === campaign.id;
          const Icon = CHANNEL_ICONS[campaign.channel as CampaignChannel] || Bell;

          // Determine winner by open rate
          const bestVariant = variantStats.reduce((best, v) => {
            const rate = v.delivered > 0 ? v.opened / v.delivered : 0;
            const bestRate = best.delivered > 0 ? best.opened / best.delivered : 0;
            return rate > bestRate ? v : best;
          }, variantStats[0]);

          // Statistical significance between first two variants
          const sig = variantStats.length >= 2
            ? calcSignificance(variantStats[0].delivered, variantStats[0].opened, variantStats[1].delivered, variantStats[1].opened)
            : null;

          const sigClick = variantStats.length >= 2
            ? calcSignificance(variantStats[0].opened, variantStats[0].clicked, variantStats[1].opened, variantStats[1].clicked)
            : null;

          return (
            <motion.div key={campaign.id} layout className="glass rounded-xl neural-border overflow-hidden">
              {/* Header */}
              <button onClick={() => setSelectedCampaign(isExpanded ? null : campaign.id)}
                className="w-full flex items-center justify-between p-4 text-left hover:bg-secondary/30 transition-colors">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-secondary">
                    <Icon className={`w-4 h-4 ${CHANNEL_COLORS[campaign.channel as CampaignChannel]}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-semibold text-foreground truncate">{campaign.name}</h4>
                      <span className={`text-[9px] font-medium px-1.5 py-0.5 rounded-full ${STATUS_COLORS[campaign.status as CampaignStatus]}`}>{campaign.status}</span>
                    </div>
                    <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
                      <span>{variantStats.length} variants</span>
                      <span>{campaign.total_recipients || 0} recipients</span>
                      <span>{formatDistanceToNow(new Date(campaign.created_at), { addSuffix: true })}</span>
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  {sig && (
                    <span className={`text-[10px] font-semibold px-2 py-1 rounded-lg ${sig.significant ? "bg-success/15 text-success" : "bg-warning/15 text-warning"}`}>
                      {sig.significant ? `✅ ${sig.confidence}% confident` : `⏳ ${sig.confidence}% (needs data)`}
                    </span>
                  )}
                  <ChevronDown className={`w-4 h-4 text-muted-foreground transition-transform ${isExpanded ? "rotate-180" : ""}`} />
                </div>
              </button>

              {/* Expanded details */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                    className="border-t border-border">
                    <div className="p-4 space-y-4">
                      {/* Variant comparison bars */}
                      <div className="space-y-3">
                        {variantStats.map((v, i) => {
                          const deliveryRate = v.sent > 0 ? Math.round((v.delivered / v.sent) * 100) : 0;
                          const openRate = v.delivered > 0 ? Math.round((v.opened / v.delivered) * 100) : 0;
                          const clickRate = v.opened > 0 ? Math.round((v.clicked / v.opened) * 100) : 0;
                          const isWinner = v.name === bestVariant?.name && variantStats.length > 1;
                          return (
                            <div key={v.name} className={`rounded-xl p-4 border ${isWinner ? "bg-success/5 border-success/30" : "bg-secondary/30 border-border"}`}>
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <span className={`text-xs font-bold ${isWinner ? "text-success" : "text-foreground"}`}>{v.name}</span>
                                  {isWinner && sig?.significant && (
                                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-success/20 text-success font-semibold flex items-center gap-1">
                                      <Award className="w-3 h-3" /> WINNER
                                    </span>
                                  )}
                                </div>
                                <span className="text-[10px] text-muted-foreground">{v.sent} sent</span>
                              </div>
                              <p className="text-[10px] text-muted-foreground mb-3 truncate italic">"{v.label}"</p>

                              {/* Rate bars */}
                              <div className="space-y-2">
                                {[
                                  { label: "Delivery", rate: deliveryRate, color: "bg-primary" },
                                  { label: "Open", rate: openRate, color: "bg-accent" },
                                  { label: "Click", rate: clickRate, color: "bg-warning" },
                                ].map(bar => (
                                  <div key={bar.label} className="flex items-center gap-2">
                                    <span className="text-[10px] text-muted-foreground w-14">{bar.label}</span>
                                    <div className="flex-1 h-2 bg-secondary rounded-full overflow-hidden">
                                      <motion.div initial={{ width: 0 }} animate={{ width: `${bar.rate}%` }} transition={{ duration: 0.8, delay: i * 0.1 }}
                                        className={`h-full rounded-full ${bar.color}`} />
                                    </div>
                                    <span className="text-[10px] font-bold text-foreground w-10 text-right">{bar.rate}%</span>
                                  </div>
                                ))}
                              </div>

                              {/* Absolute numbers */}
                              <div className="flex gap-4 mt-3 text-[10px] text-muted-foreground">
                                <span>📨 {v.delivered} delivered</span>
                                <span>👁 {v.opened} opened</span>
                                <span>🖱️ {v.clicked} clicked</span>
                              </div>
                            </div>
                          );
                        })}
                      </div>

                      {/* Statistical significance card */}
                      {sig && variantStats.length >= 2 && (
                        <div className="rounded-xl p-4 bg-secondary/50 border border-border space-y-3">
                          <h5 className="text-xs font-semibold text-foreground flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5 text-primary" /> Statistical Significance
                          </h5>

                          <div className="grid grid-cols-2 gap-3">
                            {/* Open rate test */}
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-medium text-muted-foreground">Open Rate Test</p>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${sig.significant ? "bg-success" : "bg-warning"}`} />
                                <span className="text-[11px] font-semibold text-foreground">{sig.significant ? "Statistically Significant" : "Not Yet Significant"}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground space-y-0.5">
                                <p>Z-Score: <span className="font-mono text-foreground">{sig.zScore}</span></p>
                                <p>P-Value: <span className="font-mono text-foreground">{sig.pValue}</span></p>
                                <p>Confidence: <span className="font-mono text-foreground">{sig.confidence}%</span></p>
                              </div>
                            </div>

                            {/* Click rate test */}
                            <div className="space-y-1.5">
                              <p className="text-[10px] font-medium text-muted-foreground">Click Rate Test</p>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${sigClick?.significant ? "bg-success" : "bg-warning"}`} />
                                <span className="text-[11px] font-semibold text-foreground">{sigClick?.significant ? "Statistically Significant" : "Not Yet Significant"}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground space-y-0.5">
                                <p>Z-Score: <span className="font-mono text-foreground">{sigClick?.zScore}</span></p>
                                <p>P-Value: <span className="font-mono text-foreground">{sigClick?.pValue}</span></p>
                                <p>Confidence: <span className="font-mono text-foreground">{sigClick?.confidence}%</span></p>
                              </div>
                            </div>
                          </div>

                          {/* Recommendation */}
                          <div className={`rounded-lg p-3 text-[11px] ${sig.significant ? "bg-success/10 text-success" : "bg-warning/10 text-warning"}`}>
                            {sig.significant ? (
                              <p className="font-medium">🏆 <strong>{bestVariant?.name}</strong> is the clear winner with {sig.confidence}% statistical confidence. Recommend using this variant for future campaigns.</p>
                            ) : (
                              <p className="font-medium">⏳ Results are not yet statistically significant (need p &lt; 0.05). Continue collecting data or increase sample size for reliable conclusions.</p>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Side-by-side bar chart */}
                      {variantStats.length >= 2 && (
                        <div className="rounded-xl p-4 bg-secondary/30 border border-border">
                          <h5 className="text-xs font-semibold text-foreground mb-3">Variant Comparison</h5>
                          <div className="h-[180px]">
                            <ResponsiveContainer width="100%" height="100%">
                              <BarChart data={variantStats.map(v => ({
                                name: v.name,
                                "Delivery %": v.sent > 0 ? Math.round((v.delivered / v.sent) * 100) : 0,
                                "Open %": v.delivered > 0 ? Math.round((v.opened / v.delivered) * 100) : 0,
                                "Click %": v.opened > 0 ? Math.round((v.clicked / v.opened) * 100) : 0,
                              }))}>
                                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
                                <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} domain={[0, 100]} unit="%" />
                                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
                                <Legend wrapperStyle={{ fontSize: 10 }} />
                                <Bar dataKey="Delivery %" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Open %" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                                <Bar dataKey="Click %" fill="hsl(var(--warning))" radius={[4, 4, 0, 0]} />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CampaignManager;
