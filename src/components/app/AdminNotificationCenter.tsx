import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Mail, Volume2, Send, Sparkles, Loader2, Users,
  Clock, CheckCircle2, XCircle, Search, Trash2, Eye,
  Filter, RefreshCw, Megaphone, User, ChevronRight,
  CalendarCheck, AlertTriangle, Award, Settings2, Zap,
  BarChart3, ArrowLeft, Play, Square
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow } from "date-fns";

type NotifChannel = "push" | "email" | "voice";
type NotifTab = "compose" | "history" | "events";

const NOTIFICATION_TYPES = [
  { value: "general", label: "General", icon: Bell, color: "text-primary" },
  { value: "reminder", label: "Reminder", icon: Clock, color: "text-accent" },
  { value: "achievement", label: "Achievement", icon: Award, color: "text-warning" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-destructive" },
  { value: "system", label: "System", icon: Settings2, color: "text-muted-foreground" },
];

const EVENT_TRIGGERS = [
  // Study & Revision
  { key: "study_reminder", label: "Study Reminder", desc: "When topics are due for revision based on forgetting curve", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "forget_risk", label: "Forget Risk Alert", desc: "When memory score drops below threshold or predicted drop within 3 days", channels: ["push", "voice"] as NotifChannel[] },
  { key: "risk_digest", label: "Daily Risk Digest", desc: "At-risk topics summary with quick study plan every morning", channels: ["push", "email"] as NotifChannel[] },

  // Streaks & Gamification
  { key: "streak_milestone", label: "Streak Milestone", desc: "Celebrate 7, 14, 30-day study streaks", channels: ["push", "voice"] as NotifChannel[] },
  { key: "freeze_gift", label: "Freeze Gift Received", desc: "When someone sends a streak freeze gift", channels: ["push"] as NotifChannel[] },
  { key: "streak_break_warning", label: "Streak Break Warning", desc: "Alert when streak is about to break (no study today)", channels: ["push", "voice"] as NotifChannel[] },

  // Brain & Cognitive
  { key: "brain_update_reminder", label: "Brain Update Nudge", desc: "Nudge when no brain update in 24h", channels: ["push", "voice"] as NotifChannel[] },
  { key: "daily_briefing", label: "Daily Morning Briefing", desc: "AI cognitive summary sent every morning at 07:00 UTC", channels: ["push", "email"] as NotifChannel[] },
  { key: "brain_missions", label: "Brain Missions", desc: "New AI-generated learning missions assigned", channels: ["push"] as NotifChannel[] },
  { key: "cognitive_twin_update", label: "Cognitive Twin Update", desc: "When cognitive twin model is recomputed with new insights", channels: ["push"] as NotifChannel[] },

  // Weekly Reports & Insights
  { key: "weekly_insights", label: "Weekly AI Insights", desc: "AI study recommendations every Monday", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "weekly_report", label: "Weekly Email Report", desc: "Detailed weekly performance report", channels: ["email"] as NotifChannel[] },
  { key: "weekly_brain_digest", label: "Weekly Brain Digest", desc: "Weekly brain evolution & learning summary", channels: ["push", "email"] as NotifChannel[] },

  // Exam & Goals
  { key: "exam_countdown", label: "Exam Countdown", desc: "Alerts as exam date approaches (30d, 14d, 7d, 3d, 1d)", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "daily_goal_complete", label: "Daily Goal Complete", desc: "Congratulate when daily study goal is hit", channels: ["push"] as NotifChannel[] },
  { key: "weekly_goal_complete", label: "Weekly Goal Complete", desc: "Celebrate hitting the weekly focus goal", channels: ["push", "voice"] as NotifChannel[] },

  // Health & Wellbeing
  { key: "burnout_detection", label: "Burnout Alert", desc: "Proactive wellness alert when fatigue score is high", channels: ["push", "voice"] as NotifChannel[] },
  { key: "study_break_reminder", label: "Study Break Reminder", desc: "Suggest break after prolonged study sessions", channels: ["push", "voice"] as NotifChannel[] },

  // AI & Model Events
  { key: "ai_self_evaluate", label: "AI Self-Evaluation", desc: "When AI models complete self-evaluation cycle", channels: ["push"] as NotifChannel[] },
  { key: "benchmark_deviation", label: "Benchmark Deviation", desc: "Alert when model performance deviates from baseline", channels: ["push", "email"] as NotifChannel[] },
  { key: "adaptive_difficulty", label: "Difficulty Adjusted", desc: "When AI adjusts quiz difficulty based on performance", channels: ["push"] as NotifChannel[] },
  { key: "rank_prediction_change", label: "Rank Prediction Change", desc: "When predicted rank improves or drops significantly", channels: ["push", "voice"] as NotifChannel[] },

  // Subscription & Account
  { key: "subscription_expiry", label: "Subscription Expiry", desc: "Warning before subscription expires (7d, 3d, 1d)", channels: ["push", "email"] as NotifChannel[] },
  { key: "subscription_renewed", label: "Subscription Renewed", desc: "Confirmation when subscription is renewed", channels: ["push", "email"] as NotifChannel[] },
  { key: "new_user_welcome", label: "Welcome Message", desc: "Onboarding welcome notification for new users", channels: ["push", "email"] as NotifChannel[] },
  { key: "inactivity_nudge", label: "Inactivity Nudge", desc: "Re-engagement nudge after 3+ days of no activity", channels: ["push", "email", "voice"] as NotifChannel[] },

  // Leaderboard & Social
  { key: "leaderboard_rank_up", label: "Leaderboard Rank Up", desc: "When user climbs up the leaderboard", channels: ["push"] as NotifChannel[] },
  { key: "leaderboard_overtaken", label: "Leaderboard Overtaken", desc: "When another user overtakes your position", channels: ["push"] as NotifChannel[] },

  // Content & Knowledge
  { key: "new_topic_added", label: "New Topic Added", desc: "Confirmation when a new topic is added via any input method", channels: ["push"] as NotifChannel[] },
  { key: "study_plan_ready", label: "Study Plan Ready", desc: "When AI-generated study plan is ready", channels: ["push", "email"] as NotifChannel[] },

  // System & Admin
  { key: "admin_broadcast", label: "Admin Broadcast", desc: "Manual broadcasts from admin panel", channels: ["push", "email"] as NotifChannel[] },
  { key: "system_maintenance", label: "System Maintenance", desc: "Scheduled maintenance or downtime alerts", channels: ["push", "email"] as NotifChannel[] },
  { key: "feature_announcement", label: "Feature Announcement", desc: "New feature rollout announcements", channels: ["push", "email"] as NotifChannel[] },
];

const CHANNEL_ICONS: Record<NotifChannel, any> = { push: Bell, email: Mail, voice: Volume2 };
const CHANNEL_LABELS: Record<NotifChannel, string> = { push: "Push", email: "Email", voice: "Voice" };
const CHANNEL_COLORS: Record<NotifChannel, string> = { push: "text-primary", email: "text-accent", voice: "text-warning" };

const AdminNotificationCenter = () => {
  const { toast } = useToast();
  const { user: adminUser } = useAuth();
  const [tab, setTab] = useState<NotifTab>("compose");

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-foreground">Notification Center</h2>
          <p className="text-xs text-muted-foreground mt-1">Manage all Push, Email & Voice notifications</p>
        </div>
      </div>

      {/* Tab switcher */}
      <div className="flex gap-2">
        {([
          { key: "compose" as NotifTab, label: "Compose & Send", icon: Send },
          { key: "history" as NotifTab, label: "History", icon: Clock },
          { key: "events" as NotifTab, label: "Event Triggers", icon: Zap },
        ]).map(t => (
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
          {tab === "compose" && <ComposeTab toast={toast} adminId={adminUser?.id} />}
          {tab === "history" && <HistoryTab toast={toast} />}
          {tab === "events" && <EventTriggersTab toast={toast} adminId={adminUser?.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── Compose Tab ───
const ComposeTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [channels, setChannels] = useState<Set<NotifChannel>>(new Set(["push"]));
  const [audience, setAudience] = useState<"all" | "single">("all");
  const [targetUserId, setTargetUserId] = useState("");
  const [type, setType] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [autoGenerated, setAutoGenerated] = useState(false);

  // Voice-specific
  const [voiceLanguage, setVoiceLanguage] = useState<"en" | "hi">("en");
  const [voiceTone, setVoiceTone] = useState<"soft" | "energetic" | "calm">("soft");
  const [voicePreview, setVoicePreview] = useState<string | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);

  const toggleChannel = (ch: NotifChannel) => {
    setChannels(prev => {
      const next = new Set(prev);
      next.has(ch) ? next.delete(ch) : next.add(ch);
      return next;
    });
  };

  const generateWithAI = useCallback(async (notifType?: string, forUserId?: string) => {
    setGenerating(true);
    try {
      const uid = forUserId || (audience === "single" && targetUserId ? targetUserId : undefined);
      const { data, error } = await supabase.functions.invoke("generate-notification", {
        body: { userId: uid, type: notifType || type },
      });
      if (error) throw error;
      if (data?.title) setTitle(data.title);
      if (data?.body) setBody(data.body);
      setAutoGenerated(true);
      toast({ title: "AI generated content ✨" });
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e?.message, variant: "destructive" });
    }
    setGenerating(false);
  }, [audience, targetUserId, type, toast]);

  // Auto-generate AI content on mount and when type changes
  useEffect(() => {
    generateWithAI(type);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewVoice = async () => {
    if (!title.trim()) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-notification", {
        body: {
          type: "test",
          language: voiceLanguage,
          tone: voiceTone,
          context: { daily_topic: title },
        },
      });
      if (error) throw error;
      if (data?.audio) {
        const audio = new Audio(`data:audio/mp3;base64,${data.audio}`);
        audio.play();
        setVoicePreview(data.text || "");
      }
      toast({ title: "🔊 Voice preview played" });
    } catch (e: any) {
      toast({ title: "Voice preview failed", description: e?.message, variant: "destructive" });
    }
    setPreviewLoading(false);
  };

  const sendNotification = async () => {
    if (!title.trim() || channels.size === 0) {
      toast({ title: "Select at least one channel and add a title", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      let recipientIds: string[] = [];

      if (audience === "single") {
        if (!targetUserId.trim()) {
          toast({ title: "Enter a user ID", variant: "destructive" });
          setSending(false);
          return;
        }
        recipientIds = [targetUserId.trim()];
      } else {
        const { data: profiles } = await supabase.from("profiles").select("id");
        recipientIds = (profiles || []).map(p => p.id);
      }

      let pushCount = 0, emailCount = 0, voiceCount = 0;

      // Push notifications — insert into notification_history
      if (channels.has("push")) {
        const notifications = recipientIds.map(uid => ({
          user_id: uid,
          title: title.trim(),
          body: body.trim() || null,
          type: audience === "all" ? "admin_broadcast" : type,
          read: false,
        }));
        for (let i = 0; i < notifications.length; i += 50) {
          await supabase.from("notification_history").insert(notifications.slice(i, i + 50));
        }
        pushCount = recipientIds.length;
      }

      // Email notifications — invoke edge function
      if (channels.has("email")) {
        for (const uid of recipientIds) {
          try {
            await supabase.functions.invoke("send-study-reminder-emails", {
              body: { userId: uid, customTitle: title.trim(), customBody: body.trim() },
            });
            emailCount++;
          } catch {
            // silently continue
          }
        }
      }

      // Voice notifications — invoke voice-notification edge function
      if (channels.has("voice")) {
        for (const uid of recipientIds.slice(0, 10)) { // limit to 10 for voice (expensive)
          try {
            await supabase.functions.invoke("voice-notification", {
              body: {
                type: "daily_reminder",
                language: voiceLanguage,
                tone: voiceTone,
                context: { daily_topic: title.trim(), userName: "" },
              },
            });
            voiceCount++;
          } catch {
            // silently continue
          }
        }
      }

      // Audit log
      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId,
          action: "notification_broadcast",
          target_type: "notification",
          details: {
            channels: [...channels],
            audience,
            type,
            title: title.trim(),
            recipientCount: recipientIds.length,
            pushCount, emailCount, voiceCount,
          } as any,
        });
      }

      const parts = [];
      if (pushCount > 0) parts.push(`${pushCount} push`);
      if (emailCount > 0) parts.push(`${emailCount} email`);
      if (voiceCount > 0) parts.push(`${voiceCount} voice`);

      toast({ title: `✅ Sent: ${parts.join(", ")}` });
      setSent(true);
      setTitle("");
      setBody("");
      setTimeout(() => setSent(false), 3000);
    } catch (e: any) {
      toast({ title: "Send failed", description: e?.message, variant: "destructive" });
    }
    setSending(false);
  };

  return (
    <div className="space-y-4 max-w-2xl">
      {/* Channel selection */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Channels</h3>
        <div className="flex gap-3">
          {(["push", "email", "voice"] as NotifChannel[]).map(ch => {
            const Icon = CHANNEL_ICONS[ch];
            const active = channels.has(ch);
            return (
              <button
                key={ch}
                onClick={() => toggleChannel(ch)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                  active
                    ? "bg-primary/10 border-primary/30 text-primary"
                    : "bg-secondary border-border text-muted-foreground hover:text-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {CHANNEL_LABELS[ch]}
                {active && <CheckCircle2 className="w-3 h-3" />}
              </button>
            );
          })}
        </div>
      </div>

      {/* Audience */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Audience</h3>
        <div className="flex gap-2">
          <button
            onClick={() => setAudience("all")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              audience === "all" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <Megaphone className="w-3.5 h-3.5" /> All Users
          </button>
          <button
            onClick={() => setAudience("single")}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
              audience === "single" ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <User className="w-3.5 h-3.5" /> Single User
          </button>
        </div>
        {audience === "single" && (
          <input
            value={targetUserId}
            onChange={e => setTargetUserId(e.target.value)}
            placeholder="Paste user ID..."
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
          />
        )}
      </div>

      {/* Compose */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Compose</h3>
          <button
            onClick={() => generateWithAI()}
            disabled={generating}
            className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors bg-accent/15 text-accent hover:bg-accent/25 flex items-center gap-1 disabled:opacity-50"
          >
            {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            {generating ? "Generating…" : "AI Write"}
          </button>
        </div>

        {/* Type */}
        <div className="flex gap-2 flex-wrap">
          {NOTIFICATION_TYPES.map(t => (
            <button
              key={t.value}
              onClick={() => setType(t.value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                type === t.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="w-3 h-3" />
              {t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Title *</label>
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="e.g. Great progress this week!"
            maxLength={120}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Body (optional)</label>
          <textarea
            value={body}
            onChange={e => setBody(e.target.value)}
            placeholder="Add more details..."
            rows={3}
            maxLength={500}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none resize-none"
          />
        </div>
        <p className="text-[9px] text-muted-foreground">{title.length}/120 · {body.length}/500</p>
      </div>

      {/* Voice settings (conditional) */}
      <AnimatePresence>
        {channels.has("voice") && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass rounded-xl p-4 neural-border space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Volume2 className="w-4 h-4 text-warning" /> Voice Settings
              </h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Language</label>
                  <div className="flex gap-2">
                    {(["en", "hi"] as const).map(l => (
                      <button
                        key={l}
                        onClick={() => setVoiceLanguage(l)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          voiceLanguage === l ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {l === "en" ? "English" : "Hindi"}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Tone</label>
                  <div className="flex gap-2">
                    {(["soft", "energetic", "calm"] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => setVoiceTone(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${
                          voiceTone === t ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-secondary"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              <button
                onClick={previewVoice}
                disabled={previewLoading || !title.trim()}
                className="flex items-center gap-1.5 text-xs font-medium text-warning hover:text-warning/80 transition-colors disabled:opacity-50"
              >
                {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Preview Voice
              </button>
              {voicePreview && (
                <p className="text-[10px] text-muted-foreground italic">"{voicePreview}"</p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send button */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
          {[...channels].map(ch => {
            const Icon = CHANNEL_ICONS[ch];
            return <span key={ch} className="flex items-center gap-1"><Icon className={`w-3 h-3 ${CHANNEL_COLORS[ch]}`} />{CHANNEL_LABELS[ch]}</span>;
          })}
          <span>→ {audience === "all" ? "All users" : "1 user"}</span>
        </div>
        <button
          onClick={sendNotification}
          disabled={sending || !title.trim() || channels.size === 0}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {sent ? "Sent!" : "Send Notification"}
        </button>
      </div>
    </div>
  );
};

// ─── History Tab ───
const HistoryTab = ({ toast }: { toast: any }) => {
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from("notification_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(200);
    setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = notifications.filter(n => {
    const matchSearch = !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.body?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || n.type === typeFilter;
    return matchSearch && matchType;
  });

  // Stats
  const totalSent = notifications.length;
  const readCount = notifications.filter(n => n.read).length;
  const unreadCount = totalSent - readCount;
  const readRate = totalSent > 0 ? Math.round((readCount / totalSent) * 100) : 0;
  const uniqueUsers = new Set(notifications.map(n => n.user_id)).size;

  const deleteNotification = async (id: string) => {
    await supabase.from("notification_history").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast({ title: "Notification deleted" });
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "Total Sent", value: totalSent, icon: Send, color: "text-primary" },
          { label: "Read", value: readCount, icon: Eye, color: "text-success" },
          { label: "Unread", value: unreadCount, icon: Bell, color: "text-warning" },
          { label: "Read Rate", value: `${readRate}%`, icon: BarChart3, color: "text-accent" },
        ].map((c, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="glass rounded-xl p-3 neural-border">
            <div className="flex items-center gap-1.5 mb-1">
              <c.icon className={`w-3.5 h-3.5 ${c.color}`} />
              <span className="text-[10px] text-muted-foreground">{c.label}</span>
            </div>
            <p className="text-lg font-bold text-foreground">{c.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Search & filter */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search notifications..."
            className="w-full pl-10 pr-4 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...NOTIFICATION_TYPES.map(t => t.value), "admin_broadcast", "daily_briefing"].map(f => (
            <button
              key={f}
              onClick={() => setTypeFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-colors ${
                typeFilter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              {f === "all" ? "All" : f.replace(/_/g, " ")}
            </button>
          ))}
        </div>
        <button onClick={fetchHistory} className="p-2 hover:bg-secondary rounded-lg transition-colors">
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {/* List */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-12">No notifications found</p>
      ) : (
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {filtered.map(n => (
            <motion.div
              key={n.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-3 neural-border flex items-start gap-3"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.read ? "bg-secondary" : "bg-primary/10"}`}>
                {n.read ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <Bell className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                  {n.type && (
                    <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">
                      {n.type.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
                {n.body && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-muted-foreground">
                    {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                  </span>
                  <span className="text-[9px] text-muted-foreground/50">·</span>
                  <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[100px]">{n.user_id?.slice(0, 8)}…</span>
                </div>
              </div>
              <button
                onClick={() => deleteNotification(n.id)}
                className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors shrink-0"
              >
                <Trash2 className="w-3 h-3 text-destructive" />
              </button>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
};

// ─── Event Triggers Tab ───
const EventTriggersTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [eventStates, setEventStates] = useState<Record<string, Record<NotifChannel, boolean>>>({});
  const [loading, setLoading] = useState(true);
  const [triggeringEvent, setTriggeringEvent] = useState<string | null>(null);

  useEffect(() => {
    // Initialize default states — all enabled
    const defaults: Record<string, Record<NotifChannel, boolean>> = {};
    for (const evt of EVENT_TRIGGERS) {
      defaults[evt.key] = { push: true, email: true, voice: true };
    }

    // Try loading saved states from feature_flags or local
    (async () => {
      const { data: flags } = await supabase
        .from("feature_flags")
        .select("flag_key, enabled")
        .like("flag_key", "notif_event_%");

      if (flags) {
        for (const flag of flags) {
          // flag_key format: notif_event_{eventKey}_{channel}
          const parts = flag.flag_key.replace("notif_event_", "").split("_");
          const channel = parts.pop() as NotifChannel;
          const eventKey = parts.join("_");
          if (defaults[eventKey] && channel) {
            defaults[eventKey][channel] = flag.enabled;
          }
        }
      }
      setEventStates(defaults);
      setLoading(false);
    })();
  }, []);

  const toggleEventChannel = async (eventKey: string, channel: NotifChannel) => {
    const current = eventStates[eventKey]?.[channel] ?? true;
    const newVal = !current;

    setEventStates(prev => ({
      ...prev,
      [eventKey]: { ...prev[eventKey], [channel]: newVal },
    }));

    const flagKey = `notif_event_${eventKey}_${channel}`;
    // Upsert into feature_flags
    const { data: existing } = await supabase
      .from("feature_flags")
      .select("id")
      .eq("flag_key", flagKey)
      .maybeSingle();

    if (existing) {
      await supabase.from("feature_flags").update({ enabled: newVal, updated_at: new Date().toISOString() } as any).eq("flag_key", flagKey);
    } else {
      await supabase.from("feature_flags").insert({
        flag_key: flagKey,
        label: `${eventKey} → ${channel}`,
        enabled: newVal,
      } as any);
    }

    toast({ title: `${newVal ? "✅ Enabled" : "🚫 Disabled"}: ${eventKey} → ${channel}` });
  };

  const triggerEventNow = async (eventKey: string) => {
    setTriggeringEvent(eventKey);
    try {
      // Map event to corresponding edge function
      const fnMap: Record<string, string> = {
        study_reminder: "send-study-reminder-emails",
        daily_briefing: "daily-brain-briefing",
        weekly_insights: "weekly-insights-summary",
        risk_digest: "daily-risk-digest",
        weekly_report: "send-weekly-report-email",
        brain_update_reminder: "brain-update-reminder",
        brain_missions: "brain-missions",
        cognitive_twin_update: "cognitive-twin",
        weekly_brain_digest: "weekly-brain-digest",
        burnout_detection: "burnout-detection",
        ai_self_evaluate: "ai-self-evaluate",
        benchmark_deviation: "benchmark-deviation-check",
        adaptive_difficulty: "adaptive-difficulty",
        subscription_expiry: "check-subscription-expiry",
        leaderboard_rank_up: "leaderboard",
      };

      const fn = fnMap[eventKey];
      if (fn) {
        await supabase.functions.invoke(fn);
        toast({ title: `⚡ Triggered: ${eventKey}` });
      } else {
        toast({ title: "This event can't be manually triggered", variant: "destructive" });
      }

      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId,
          action: "event_manually_triggered",
          target_type: "notification_event",
          target_id: eventKey,
          details: { event: eventKey } as any,
        });
      }
    } catch (e: any) {
      toast({ title: "Trigger failed", description: e?.message, variant: "destructive" });
    }
    setTriggeringEvent(null);
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">Configure which channels are active for each automated event. You can also manually trigger events.</p>

      {EVENT_TRIGGERS.map(evt => (
        <motion.div
          key={evt.key}
          initial={{ opacity: 0, y: 5 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass rounded-xl p-4 neural-border"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{evt.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{evt.desc}</p>
            </div>
            <button
              onClick={() => triggerEventNow(evt.key)}
              disabled={triggeringEvent === evt.key}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-medium text-primary bg-primary/10 hover:bg-primary/20 transition-colors disabled:opacity-50 shrink-0"
            >
              {triggeringEvent === evt.key ? <Loader2 className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
              Trigger Now
            </button>
          </div>

          <div className="flex gap-3 mt-3">
            {(["push", "email", "voice"] as NotifChannel[]).map(ch => {
              const Icon = CHANNEL_ICONS[ch];
              const supported = evt.channels.includes(ch);
              const enabled = eventStates[evt.key]?.[ch] ?? true;

              if (!supported) {
                return (
                  <div key={ch} className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-secondary/50 text-muted-foreground/40 text-[10px]">
                    <Icon className="w-3 h-3" />
                    {CHANNEL_LABELS[ch]}
                    <span className="text-[8px]">N/A</span>
                  </div>
                );
              }

              return (
                <button
                  key={ch}
                  onClick={() => toggleEventChannel(evt.key, ch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                    enabled
                      ? `bg-primary/10 border-primary/20 ${CHANNEL_COLORS[ch]}`
                      : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />
                  {CHANNEL_LABELS[ch]}
                  {enabled ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                </button>
              );
            })}
          </div>
        </motion.div>
      ))}
    </div>
  );
};

export default AdminNotificationCenter;
