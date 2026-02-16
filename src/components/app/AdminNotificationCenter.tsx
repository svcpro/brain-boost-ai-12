import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Mail, Volume2, Send, Sparkles, Loader2, Users,
  Clock, CheckCircle2, XCircle, Search, Trash2, Eye,
  Filter, RefreshCw, Megaphone, User, ChevronRight,
  CalendarCheck, AlertTriangle, Award, Settings2, Zap,
  BarChart3, ArrowLeft, Play, Square, Upload, UserCheck,
  UserMinus, RotateCcw, TrendingUp, Target, PieChart as PieChartIcon,
  FileText, Download, ChevronDown
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, subDays } from "date-fns";
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, PieChart, Pie, Cell,
  AreaChart, Area, FunnelChart, Funnel, LabelList
} from "recharts";

type NotifChannel = "push" | "email" | "voice";
type NotifTab = "compose" | "history" | "events" | "analytics";
type AudienceMode = "all" | "single" | "select" | "segment" | "csv";

const NOTIFICATION_TYPES = [
  { value: "general", label: "General", icon: Bell, color: "text-primary" },
  { value: "reminder", label: "Reminder", icon: Clock, color: "text-accent" },
  { value: "achievement", label: "Achievement", icon: Award, color: "text-warning" },
  { value: "warning", label: "Warning", icon: AlertTriangle, color: "text-destructive" },
  { value: "system", label: "System", icon: Settings2, color: "text-muted-foreground" },
];

const EVENT_TRIGGERS = [
  { key: "study_reminder", label: "Study Reminder", desc: "When topics are due for revision based on forgetting curve", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "forget_risk", label: "Forget Risk Alert", desc: "When memory score drops below threshold or predicted drop within 3 days", channels: ["push", "voice"] as NotifChannel[] },
  { key: "risk_digest", label: "Daily Risk Digest", desc: "At-risk topics summary with quick study plan every morning", channels: ["push", "email"] as NotifChannel[] },
  { key: "streak_milestone", label: "Streak Milestone", desc: "Celebrate 7, 14, 30-day study streaks", channels: ["push", "voice"] as NotifChannel[] },
  { key: "freeze_gift", label: "Freeze Gift Received", desc: "When someone sends a streak freeze gift", channels: ["push"] as NotifChannel[] },
  { key: "streak_break_warning", label: "Streak Break Warning", desc: "Alert when streak is about to break (no study today)", channels: ["push", "voice"] as NotifChannel[] },
  { key: "brain_update_reminder", label: "Brain Update Nudge", desc: "Nudge when no brain update in 24h", channels: ["push", "voice"] as NotifChannel[] },
  { key: "daily_briefing", label: "Daily Morning Briefing", desc: "AI cognitive summary sent every morning at 07:00 UTC", channels: ["push", "email"] as NotifChannel[] },
  { key: "brain_missions", label: "Brain Missions", desc: "New AI-generated learning missions assigned", channels: ["push"] as NotifChannel[] },
  { key: "cognitive_twin_update", label: "Cognitive Twin Update", desc: "When cognitive twin model is recomputed with new insights", channels: ["push"] as NotifChannel[] },
  { key: "weekly_insights", label: "Weekly AI Insights", desc: "AI study recommendations every Monday", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "weekly_report", label: "Weekly Email Report", desc: "Detailed weekly performance report", channels: ["email"] as NotifChannel[] },
  { key: "weekly_brain_digest", label: "Weekly Brain Digest", desc: "Weekly brain evolution & learning summary", channels: ["push", "email"] as NotifChannel[] },
  { key: "exam_countdown", label: "Exam Countdown", desc: "Alerts as exam date approaches (30d, 14d, 7d, 3d, 1d)", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "daily_goal_complete", label: "Daily Goal Complete", desc: "Congratulate when daily study goal is hit", channels: ["push"] as NotifChannel[] },
  { key: "weekly_goal_complete", label: "Weekly Goal Complete", desc: "Celebrate hitting the weekly focus goal", channels: ["push", "voice"] as NotifChannel[] },
  { key: "burnout_detection", label: "Burnout Alert", desc: "Proactive wellness alert when fatigue score is high", channels: ["push", "voice"] as NotifChannel[] },
  { key: "study_break_reminder", label: "Study Break Reminder", desc: "Suggest break after prolonged study sessions", channels: ["push", "voice"] as NotifChannel[] },
  { key: "ai_self_evaluate", label: "AI Self-Evaluation", desc: "When AI models complete self-evaluation cycle", channels: ["push"] as NotifChannel[] },
  { key: "benchmark_deviation", label: "Benchmark Deviation", desc: "Alert when model performance deviates from baseline", channels: ["push", "email"] as NotifChannel[] },
  { key: "adaptive_difficulty", label: "Difficulty Adjusted", desc: "When AI adjusts quiz difficulty based on performance", channels: ["push"] as NotifChannel[] },
  { key: "rank_prediction_change", label: "Rank Prediction Change", desc: "When predicted rank improves or drops significantly", channels: ["push", "voice"] as NotifChannel[] },
  { key: "subscription_expiry", label: "Subscription Expiry", desc: "Warning before subscription expires (7d, 3d, 1d)", channels: ["push", "email"] as NotifChannel[] },
  { key: "subscription_renewed", label: "Subscription Renewed", desc: "Confirmation when subscription is renewed", channels: ["push", "email"] as NotifChannel[] },
  { key: "new_user_welcome", label: "Welcome Message", desc: "Onboarding welcome notification for new users", channels: ["push", "email"] as NotifChannel[] },
  { key: "inactivity_nudge", label: "Inactivity Nudge", desc: "Re-engagement nudge after 3+ days of no activity", channels: ["push", "email", "voice"] as NotifChannel[] },
  { key: "leaderboard_rank_up", label: "Leaderboard Rank Up", desc: "When user climbs up the leaderboard", channels: ["push"] as NotifChannel[] },
  { key: "leaderboard_overtaken", label: "Leaderboard Overtaken", desc: "When another user overtakes your position", channels: ["push"] as NotifChannel[] },
  { key: "new_topic_added", label: "New Topic Added", desc: "Confirmation when a new topic is added via any input method", channels: ["push"] as NotifChannel[] },
  { key: "study_plan_ready", label: "Study Plan Ready", desc: "When AI-generated study plan is ready", channels: ["push", "email"] as NotifChannel[] },
  { key: "admin_broadcast", label: "Admin Broadcast", desc: "Manual broadcasts from admin panel", channels: ["push", "email"] as NotifChannel[] },
  { key: "system_maintenance", label: "System Maintenance", desc: "Scheduled maintenance or downtime alerts", channels: ["push", "email"] as NotifChannel[] },
  { key: "feature_announcement", label: "Feature Announcement", desc: "New feature rollout announcements", channels: ["push", "email"] as NotifChannel[] },
];

const CHANNEL_ICONS: Record<NotifChannel, any> = { push: Bell, email: Mail, voice: Volume2 };
const CHANNEL_LABELS: Record<NotifChannel, string> = { push: "Push", email: "Email", voice: "Voice" };
const CHANNEL_COLORS: Record<NotifChannel, string> = { push: "text-primary", email: "text-accent", voice: "text-warning" };

const CHART_COLORS = ["hsl(var(--primary))", "hsl(var(--accent))", "hsl(var(--warning))", "hsl(var(--destructive))", "hsl(var(--success, 142 71% 45%))"];

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
      <div className="flex gap-2 flex-wrap">
        {([
          { key: "compose" as NotifTab, label: "Compose & Send", icon: Send },
          { key: "history" as NotifTab, label: "History", icon: Clock },
          { key: "analytics" as NotifTab, label: "Analytics", icon: BarChart3 },
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
          {tab === "analytics" && <AnalyticsTab />}
          {tab === "events" && <EventTriggersTab toast={toast} adminId={adminUser?.id} />}
        </motion.div>
      </AnimatePresence>
    </div>
  );
};

// ─── User Selector Component ───
type PlanFilter = "all" | "free" | "pro" | "ultra";

const UserSelector = ({
  mode, setMode, selectedIds, setSelectedIds, targetUserId, setTargetUserId, planFilter, setPlanFilter
}: {
  mode: AudienceMode;
  setMode: (m: AudienceMode) => void;
  selectedIds: Set<string>;
  setSelectedIds: (s: Set<string>) => void;
  targetUserId: string;
  setTargetUserId: (s: string) => void;
  planFilter: PlanFilter;
  setPlanFilter: (p: PlanFilter) => void;
}) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [segmentFilter, setSegmentFilter] = useState({ minStreak: 0, maxInactiveDays: 999, examType: "all" });
  const csvInputRef = useRef<HTMLInputElement>(null);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    const { data: profiles } = await supabase.from("profiles").select("id, display_name, exam_type");
    const { data: leads } = await supabase.from("leads").select("user_id, streak_days, last_active_at, subscription_plan");
    const leadsMap = new Map((leads || []).map(l => [l.user_id, l]));
    const merged = (profiles || []).map(p => ({
      ...p,
      streak: leadsMap.get(p.id)?.streak_days || 0,
      lastActive: leadsMap.get(p.id)?.last_active_at,
      plan: leadsMap.get(p.id)?.subscription_plan || "free",
    }));
    setUsers(merged);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (mode === "select" || mode === "segment") fetchUsers();
  }, [mode, fetchUsers]);

  const filteredUsers = users.filter(u => {
    if (search && !u.display_name?.toLowerCase().includes(search.toLowerCase()) && !u.id.includes(search)) return false;
    if (mode === "segment") {
      if (u.streak < segmentFilter.minStreak) return false;
      if (segmentFilter.examType !== "all" && u.exam_type !== segmentFilter.examType) return false;
      if (segmentFilter.maxInactiveDays < 999 && u.lastActive) {
        const daysSince = Math.floor((Date.now() - new Date(u.lastActive).getTime()) / 86400000);
        if (daysSince > segmentFilter.maxInactiveDays) return false;
      }
    }
    return true;
  });

  const toggleUser = (id: string) => {
    const next = new Set(selectedIds);
    next.has(id) ? next.delete(id) : next.add(id);
    setSelectedIds(next);
  };

  const selectAll = () => setSelectedIds(new Set(filteredUsers.map(u => u.id)));
  const deselectAll = () => setSelectedIds(new Set());

  const handleCsvUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result as string;
      const ids = text.split(/[\n,]/).map(s => s.trim()).filter(s => s.length > 10);
      setSelectedIds(new Set(ids));
    };
    reader.readAsText(file);
  };

  return (
    <div className="glass rounded-xl p-4 neural-border space-y-3">
      <h3 className="text-sm font-semibold text-foreground">Audience</h3>

      {/* Plan filter */}
      <div>
        <label className="text-[9px] text-muted-foreground block mb-1.5">User Plan</label>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: "all" as PlanFilter, label: "All Users" },
            { key: "free" as PlanFilter, label: "Free" },
            { key: "pro" as PlanFilter, label: "Pro" },
            { key: "ultra" as PlanFilter, label: "Ultra" },
          ]).map(p => (
            <button
              key={p.key}
              onClick={() => setPlanFilter(p.key)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                planFilter === p.key ? "bg-primary/15 text-primary ring-1 ring-primary/30" : "text-muted-foreground hover:bg-secondary bg-secondary/50"
              }`}
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      {/* Selection mode */}
      <div>
        <label className="text-[9px] text-muted-foreground block mb-1.5">Selection Mode</label>
        <div className="flex gap-1.5 flex-wrap">
          {([
            { key: "all" as AudienceMode, label: "All Users", icon: Megaphone },
            { key: "single" as AudienceMode, label: "Single User", icon: User },
            { key: "select" as AudienceMode, label: "Multi-Select", icon: UserCheck },
            { key: "segment" as AudienceMode, label: "Smart Segment", icon: Filter },
            { key: "csv" as AudienceMode, label: "CSV Upload", icon: Upload },
          ]).map(a => (
            <button
              key={a.key}
              onClick={() => { setMode(a.key); deselectAll(); }}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-medium transition-colors ${
                mode === a.key ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <a.icon className="w-3 h-3" />
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {/* Single user input */}
      {mode === "single" && (
        <input
          value={targetUserId}
          onChange={e => setTargetUserId(e.target.value)}
          placeholder="Paste user ID..."
          className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
        />
      )}

      {/* CSV upload */}
      {mode === "csv" && (
        <div className="space-y-2">
          <input ref={csvInputRef} type="file" accept=".csv,.txt" onChange={handleCsvUpload} className="hidden" />
          <button
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-2 px-4 py-2.5 bg-secondary rounded-lg text-xs font-medium text-foreground hover:bg-secondary/80 transition-colors border border-border"
          >
            <Upload className="w-4 h-4" />
            {selectedIds.size > 0 ? `${selectedIds.size} user IDs loaded` : "Upload CSV with user IDs"}
          </button>
          <p className="text-[9px] text-muted-foreground">CSV should contain one user ID per line or comma-separated</p>
        </div>
      )}

      {/* Smart segment filters */}
      {mode === "segment" && (
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="text-[9px] text-muted-foreground block mb-1">Min Streak Days</label>
            <input
              type="number"
              value={segmentFilter.minStreak}
              onChange={e => setSegmentFilter(p => ({ ...p, minStreak: Number(e.target.value) }))}
              className="w-full px-2 py-1.5 bg-secondary rounded-lg text-xs border border-border focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground block mb-1">Max Inactive Days</label>
            <input
              type="number"
              value={segmentFilter.maxInactiveDays}
              onChange={e => setSegmentFilter(p => ({ ...p, maxInactiveDays: Number(e.target.value) }))}
              className="w-full px-2 py-1.5 bg-secondary rounded-lg text-xs border border-border focus:border-primary outline-none"
            />
          </div>
          <div>
            <label className="text-[9px] text-muted-foreground block mb-1">Exam Type</label>
            <select
              value={segmentFilter.examType}
              onChange={e => setSegmentFilter(p => ({ ...p, examType: e.target.value }))}
              className="w-full px-2 py-1.5 bg-secondary rounded-lg text-xs border border-border focus:border-primary outline-none"
            >
              <option value="all">All</option>
              <option value="NEET">NEET</option>
              <option value="JEE">JEE</option>
            </select>
          </div>
        </div>
      )}

      {/* User list with checkboxes */}
      {(mode === "select" || mode === "segment") && (
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search users..."
                className="w-full pl-8 pr-3 py-1.5 bg-secondary rounded-lg text-xs border border-border focus:border-primary outline-none"
              />
            </div>
            <button onClick={selectAll} className="text-[10px] text-primary hover:underline">Select All ({filteredUsers.length})</button>
            <button onClick={deselectAll} className="text-[10px] text-muted-foreground hover:underline">Clear</button>
          </div>

          {loading ? (
            <div className="flex justify-center py-6"><Loader2 className="w-4 h-4 animate-spin text-primary" /></div>
          ) : (
            <div className="max-h-[200px] overflow-y-auto space-y-1 border border-border rounded-lg p-2">
              {filteredUsers.map(u => (
                <label key={u.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedIds.has(u.id)}
                    onChange={() => toggleUser(u.id)}
                    className="rounded border-border"
                  />
                  <span className="text-xs text-foreground truncate flex-1">{u.display_name || u.id.slice(0, 8)}</span>
                  <span className="text-[9px] text-muted-foreground">{u.plan}</span>
                  <span className="text-[9px] text-muted-foreground">🔥{u.streak}</span>
                </label>
              ))}
              {filteredUsers.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No users match filters</p>}
            </div>
          )}
          <p className="text-[9px] text-muted-foreground">{selectedIds.size} user(s) selected</p>
        </div>
      )}

      {/* Summary */}
      {mode === "all" && (
        <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Will send to all registered users</p>
      )}
    </div>
  );
};

// ─── Compose Tab ───
const ComposeTab = ({ toast, adminId }: { toast: any; adminId?: string }) => {
  const [channels, setChannels] = useState<Set<NotifChannel>>(new Set(["push"]));
  const [audience, setAudience] = useState<AudienceMode>("all");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [targetUserId, setTargetUserId] = useState("");
  const [planFilter, setPlanFilter] = useState<PlanFilter>("all");
  const [type, setType] = useState("general");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

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
      toast({ title: "AI generated content ✨" });
    } catch (e: any) {
      toast({ title: "AI generation failed", description: e?.message, variant: "destructive" });
    }
    setGenerating(false);
  }, [audience, targetUserId, type, toast]);

  useEffect(() => {
    generateWithAI(type);
  }, [type]); // eslint-disable-line react-hooks/exhaustive-deps

  const previewVoiceFn = async () => {
    if (!title.trim()) return;
    setPreviewLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("voice-notification", {
        body: { type: "test", language: voiceLanguage, tone: voiceTone, context: { daily_topic: title } },
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

  const getRecipientIds = async (): Promise<string[]> => {
    if (audience === "single") return targetUserId.trim() ? [targetUserId.trim()] : [];
    if (audience === "select" || audience === "segment" || audience === "csv") {
      let ids = [...selectedIds];
      if (planFilter !== "all") {
        const { data: leads } = await supabase.from("leads").select("user_id, subscription_plan");
        const planUsers = new Set(
          (leads || [])
            .filter(l => {
              const p = (l.subscription_plan || "free").toLowerCase();
              return planFilter === "free" ? (p === "free" || !l.subscription_plan) : p === planFilter;
            })
            .map(l => l.user_id)
        );
        ids = ids.filter(id => planUsers.has(id));
      }
      return ids;
    }
    // "all" mode
    const { data: profiles } = await supabase.from("profiles").select("id");
    let allIds = (profiles && profiles.length > 0) ? profiles.map(p => p.id) : [];
    if (allIds.length === 0) {
      const { data: leads } = await supabase.from("leads").select("user_id");
      allIds = (leads || []).map(l => l.user_id);
    }
    if (planFilter !== "all") {
      const { data: leads } = await supabase.from("leads").select("user_id, subscription_plan");
      const planUsers = new Set(
        (leads || [])
          .filter(l => {
            const p = (l.subscription_plan || "free").toLowerCase();
            return planFilter === "free" ? (p === "free" || !l.subscription_plan) : p === planFilter;
          })
          .map(l => l.user_id)
      );
      allIds = allIds.filter(id => planUsers.has(id));
    }
    return allIds;
  };

  const sendNotification = async () => {
    if (!title.trim() || channels.size === 0) {
      toast({ title: "Select at least one channel and add a title", variant: "destructive" });
      return;
    }
    setSending(true);
    try {
      const recipientIds = await getRecipientIds();
      if (recipientIds.length === 0) {
        toast({ title: "No recipients selected", variant: "destructive" });
        setSending(false);
        return;
      }

      let pushCount = 0, emailCount = 0, voiceCount = 0;

      if (channels.has("push")) {
        const notifications = recipientIds.map(uid => ({
          user_id: uid, title: title.trim(), body: body.trim() || null,
          type: audience === "all" ? "admin_broadcast" : type, read: false,
        }));
        for (let i = 0; i < notifications.length; i += 50) {
          await supabase.from("notification_history").insert(notifications.slice(i, i + 50));
        }
        pushCount = recipientIds.length;
      }

      if (channels.has("email")) {
        try {
          const { data: emailResult } = await supabase.functions.invoke("send-campaign-email", {
            body: { recipientIds, subject: title.trim(), htmlBody: body.trim() },
          });
          emailCount = emailResult?.sentCount || 0;
        } catch {
          // fallback
          for (const uid of recipientIds) {
            try {
              await supabase.functions.invoke("send-study-reminder-emails", {
                body: { userId: uid, customTitle: title.trim(), customBody: body.trim() },
              });
              emailCount++;
            } catch { /* continue */ }
          }
        }
      }

      if (channels.has("voice")) {
        for (const uid of recipientIds.slice(0, 10)) {
          try {
            await supabase.functions.invoke("voice-notification", {
              body: { type: "daily_reminder", language: voiceLanguage, tone: voiceTone, context: { daily_topic: title.trim() } },
            });
            voiceCount++;
          } catch { /* continue */ }
        }
      }

      if (adminId) {
        await supabase.from("admin_audit_logs").insert({
          admin_id: adminId, action: "notification_broadcast", target_type: "notification",
          details: { channels: [...channels], audience, type, title: title.trim(), recipientCount: recipientIds.length, pushCount, emailCount, voiceCount } as any,
        });
      }

      const parts = [];
      if (pushCount > 0) parts.push(`${pushCount} push`);
      if (emailCount > 0) parts.push(`${emailCount} email`);
      if (voiceCount > 0) parts.push(`${voiceCount} voice`);

      toast({ title: `✅ Sent: ${parts.join(", ")}` });
      setSent(true);
      setTitle(""); setBody("");
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
              <button key={ch} onClick={() => toggleChannel(ch)}
                className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-xs font-medium transition-all border ${
                  active ? "bg-primary/10 border-primary/30 text-primary" : "bg-secondary border-border text-muted-foreground hover:text-foreground"
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

      {/* User Selector */}
      <UserSelector mode={audience} setMode={setAudience} selectedIds={selectedIds} setSelectedIds={setSelectedIds} targetUserId={targetUserId} setTargetUserId={setTargetUserId} planFilter={planFilter} setPlanFilter={setPlanFilter} />

      {/* Compose */}
      <div className="glass rounded-xl p-4 neural-border space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-foreground">Compose</h3>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview(!showPreview)}
              className="px-2.5 py-1 rounded-md text-[10px] font-medium bg-secondary text-foreground hover:bg-secondary/80 flex items-center gap-1"
            >
              <Eye className="w-3 h-3" />
              {showPreview ? "Hide Preview" : "Preview"}
            </button>
            <button onClick={() => generateWithAI()} disabled={generating}
              className="px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors bg-accent/15 text-accent hover:bg-accent/25 flex items-center gap-1 disabled:opacity-50"
            >
              {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
              {generating ? "Generating…" : "AI Write"}
            </button>
          </div>
        </div>

        <div className="flex gap-2 flex-wrap">
          {NOTIFICATION_TYPES.map(t => (
            <button key={t.value} onClick={() => setType(t.value)}
              className={`flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-medium transition-colors ${
                type === t.value ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >
              <t.icon className="w-3 h-3" />{t.label}
            </button>
          ))}
        </div>

        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Title *</label>
          <input value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Great progress this week!" maxLength={120}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <div>
          <label className="text-[10px] text-muted-foreground mb-1 block">Body (optional)</label>
          <textarea value={body} onChange={e => setBody(e.target.value)} placeholder="Add more details..." rows={3} maxLength={500}
            className="w-full px-3 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none resize-none"
          />
        </div>
        <p className="text-[9px] text-muted-foreground">{title.length}/120 · {body.length}/500</p>
      </div>

      {/* Template Preview */}
      <AnimatePresence>
        {showPreview && title.trim() && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 neural-border space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Eye className="w-4 h-4 text-accent" /> Template Preview</h3>
              <div className="grid gap-3">
                {channels.has("push") && (
                  <div className="bg-secondary rounded-xl p-3 border border-border">
                    <p className="text-[9px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Push Notification</p>
                    <div className="bg-background rounded-lg p-3 shadow-sm border border-border/50">
                      <div className="flex items-start gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"><Bell className="w-4 h-4 text-primary" /></div>
                        <div>
                          <p className="text-xs font-semibold text-foreground">{title}</p>
                          {body && <p className="text-[10px] text-muted-foreground mt-0.5">{body.slice(0, 100)}</p>}
                          <p className="text-[9px] text-muted-foreground/50 mt-1">ACRY Brain · just now</p>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
                {channels.has("email") && (
                  <div className="bg-secondary rounded-xl p-3 border border-border">
                    <p className="text-[9px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Email Preview</p>
                    <div className="bg-background rounded-lg overflow-hidden border border-border/50">
                      <div className="bg-gradient-to-r from-primary/20 to-accent/20 p-3 text-center">
                        <span className="text-lg">🧠</span>
                        <p className="text-xs font-bold text-foreground">ACRY Brain</p>
                      </div>
                      <div className="p-4">
                        <p className="text-[10px] text-muted-foreground">Hi User 👋</p>
                        <h4 className="text-sm font-bold text-foreground mt-1">{title}</h4>
                        <div className="w-8 h-0.5 bg-primary/50 rounded mt-2" />
                        {body && <p className="text-[10px] text-muted-foreground mt-2 leading-relaxed">{body}</p>}
                        <button className="mt-3 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-[10px] font-medium">Open ACRY Brain →</button>
                      </div>
                    </div>
                  </div>
                )}
                {channels.has("voice") && (
                  <div className="bg-secondary rounded-xl p-3 border border-border">
                    <p className="text-[9px] text-muted-foreground mb-1.5 font-semibold uppercase tracking-wider">Voice Script</p>
                    <div className="bg-background rounded-lg p-3 border border-border/50">
                      <p className="text-xs text-foreground italic">"{title}. {body || ''}"</p>
                      <p className="text-[9px] text-muted-foreground mt-1">Language: {voiceLanguage === "en" ? "English" : "Hindi"} · Tone: {voiceTone}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Voice settings */}
      <AnimatePresence>
        {channels.has("voice") && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="glass rounded-xl p-4 neural-border space-y-3">
              <h3 className="text-sm font-semibold text-foreground flex items-center gap-2"><Volume2 className="w-4 h-4 text-warning" /> Voice Settings</h3>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Language</label>
                  <div className="flex gap-2">
                    {(["en", "hi"] as const).map(l => (
                      <button key={l} onClick={() => setVoiceLanguage(l)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${voiceLanguage === l ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-secondary"}`}
                      >{l === "en" ? "English" : "Hindi"}</button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-[10px] text-muted-foreground mb-1 block">Tone</label>
                  <div className="flex gap-2">
                    {(["soft", "energetic", "calm"] as const).map(t => (
                      <button key={t} onClick={() => setVoiceTone(t)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium capitalize transition-colors ${voiceTone === t ? "bg-warning/15 text-warning" : "text-muted-foreground hover:bg-secondary"}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
              </div>
              <button onClick={previewVoiceFn} disabled={previewLoading || !title.trim()}
                className="flex items-center gap-1.5 text-xs font-medium text-warning hover:text-warning/80 transition-colors disabled:opacity-50"
              >
                {previewLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                Preview Voice
              </button>
              {voicePreview && <p className="text-[10px] text-muted-foreground italic">"{voicePreview}"</p>}
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
          <span>→ {audience === "all" ? "All users" : audience === "single" ? "1 user" : `${selectedIds.size} user(s)`}</span>
        </div>
        <button onClick={sendNotification} disabled={sending || !title.trim() || channels.size === 0}
          className="px-5 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium flex items-center gap-2 hover:bg-primary/90 transition-all disabled:opacity-50"
        >
          {sending ? <Loader2 className="w-4 h-4 animate-spin" /> : sent ? <CheckCircle2 className="w-4 h-4" /> : <Send className="w-4 h-4" />}
          {sent ? "Sent!" : "Send Notification"}
        </button>
      </div>
    </div>
  );
};

// ─── Analytics Tab ───
const AnalyticsTab = () => {
  const [campaigns, setCampaigns] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      const [campRes, notifRes] = await Promise.all([
        supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(100),
        supabase.from("notification_history").select("*").order("created_at", { ascending: false }).limit(500),
      ]);
      setCampaigns(campRes.data || []);
      setNotifications(notifRes.data || []);
      setLoading(false);
    };
    fetchData();
  }, []);

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  // Compute analytics
  const totalCampaigns = campaigns.length;
  const totalSent = campaigns.reduce((a, c) => a + (c.total_recipients || 0), 0);
  const totalDelivered = campaigns.reduce((a, c) => a + (c.delivered_count || 0), 0);
  const totalOpened = campaigns.reduce((a, c) => a + (c.opened_count || 0), 0);
  const totalClicked = campaigns.reduce((a, c) => a + (c.clicked_count || 0), 0);
  const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 0;
  const openRate = totalDelivered > 0 ? Math.round((totalOpened / totalDelivered) * 100) : 0;
  const clickRate = totalOpened > 0 ? Math.round((totalClicked / totalOpened) * 100) : 0;

  const totalNotifs = notifications.length;
  const readNotifs = notifications.filter(n => n.read).length;
  const pushReadRate = totalNotifs > 0 ? Math.round((readNotifs / totalNotifs) * 100) : 0;

  // Channel breakdown
  const channelData = [
    { name: "Email", sent: campaigns.filter(c => c.channel === "email").reduce((a, c) => a + (c.total_recipients || 0), 0), delivered: campaigns.filter(c => c.channel === "email").reduce((a, c) => a + (c.delivered_count || 0), 0) },
    { name: "Push", sent: totalNotifs, delivered: readNotifs },
    { name: "Voice", sent: campaigns.filter(c => c.channel === "voice").reduce((a, c) => a + (c.total_recipients || 0), 0), delivered: campaigns.filter(c => c.channel === "voice").reduce((a, c) => a + (c.delivered_count || 0), 0) },
  ];

  // Engagement funnel
  const funnelData = [
    { name: "Sent", value: totalSent || totalNotifs || 1, fill: CHART_COLORS[0] },
    { name: "Delivered", value: totalDelivered || readNotifs || 0, fill: CHART_COLORS[1] },
    { name: "Opened", value: totalOpened || 0, fill: CHART_COLORS[2] },
    { name: "Clicked", value: totalClicked || 0, fill: CHART_COLORS[3] },
  ];

  // Daily trend (last 7 days)
  const dailyTrend = Array.from({ length: 7 }, (_, i) => {
    const d = subDays(new Date(), 6 - i);
    const day = format(d, "MMM dd");
    const dayStr = format(d, "yyyy-MM-dd");
    const dayNotifs = notifications.filter(n => n.created_at?.startsWith(dayStr)).length;
    const dayCamps = campaigns.filter(c => c.sent_at?.startsWith(dayStr)).reduce((a, c) => a + (c.total_recipients || 0), 0);
    return { day, push: dayNotifs, email: dayCamps };
  });

  // Channel pie
  const pieData = [
    { name: "Email", value: campaigns.filter(c => c.channel === "email").length || 0 },
    { name: "Push", value: campaigns.filter(c => c.channel === "push").length + (totalNotifs > 0 ? 1 : 0) },
    { name: "Voice", value: campaigns.filter(c => c.channel === "voice").length || 0 },
  ].filter(d => d.value > 0);

  return (
    <div className="space-y-5">
      {/* KPI cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3">
        {[
          { label: "Campaigns", value: totalCampaigns, icon: Megaphone, color: "text-primary" },
          { label: "Total Sent", value: totalSent + totalNotifs, icon: Send, color: "text-accent" },
          { label: "Delivered", value: totalDelivered + readNotifs, icon: CheckCircle2, color: "text-success" },
          { label: "Delivery Rate", value: `${deliveryRate || pushReadRate}%`, icon: TrendingUp, color: "text-primary" },
          { label: "Open Rate", value: `${openRate}%`, icon: Eye, color: "text-warning" },
          { label: "Click Rate", value: `${clickRate}%`, icon: Target, color: "text-accent" },
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

      {/* Charts row */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Daily Trend */}
        <div className="glass rounded-xl p-4 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-primary" /> 7-Day Send Trend</h3>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={dailyTrend}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="day" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Area type="monotone" dataKey="push" stackId="1" stroke={CHART_COLORS[0]} fill={CHART_COLORS[0]} fillOpacity={0.3} name="Push" />
              <Area type="monotone" dataKey="email" stackId="1" stroke={CHART_COLORS[1]} fill={CHART_COLORS[1]} fillOpacity={0.3} name="Email" />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Channel Breakdown Bar */}
        <div className="glass rounded-xl p-4 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><BarChart3 className="w-4 h-4 text-accent" /> Channel Breakdown</h3>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={channelData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <YAxis tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }} />
              <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              <Bar dataKey="sent" fill={CHART_COLORS[0]} name="Sent" radius={[4, 4, 0, 0]} />
              <Bar dataKey="delivered" fill={CHART_COLORS[4]} name="Delivered" radius={[4, 4, 0, 0]} />
              <Legend wrapperStyle={{ fontSize: 10 }} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Funnel & Pie */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Engagement Funnel */}
        <div className="glass rounded-xl p-4 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><Target className="w-4 h-4 text-warning" /> Engagement Funnel</h3>
          <div className="space-y-2">
            {funnelData.map((step, i) => {
              const maxVal = funnelData[0].value || 1;
              const pct = Math.round((step.value / maxVal) * 100);
              return (
                <div key={step.name} className="space-y-1">
                  <div className="flex justify-between text-[10px]">
                    <span className="text-foreground font-medium">{step.name}</span>
                    <span className="text-muted-foreground">{step.value} ({pct}%)</span>
                  </div>
                  <div className="h-6 bg-secondary rounded-lg overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: i * 0.15 }}
                      className="h-full rounded-lg"
                      style={{ background: step.fill }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Channel Distribution Pie */}
        <div className="glass rounded-xl p-4 neural-border">
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><PieChartIcon className="w-4 h-4 text-primary" /> Channel Distribution</h3>
          {pieData.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                  {pieData.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={{ background: "hsl(var(--background))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 11 }} />
              </PieChart>
            </ResponsiveContainer>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-12">No campaign data yet</p>
          )}
        </div>
      </div>

      {/* Campaign Performance Table */}
      <div className="glass rounded-xl p-4 neural-border">
        <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-accent" /> Campaign Performance</h3>
        {campaigns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">No campaigns yet</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Campaign</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Channel</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Sent</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Delivered</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Opened</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Clicked</th>
                  <th className="text-right py-2 px-2 text-muted-foreground font-medium">Open %</th>
                  <th className="text-left py-2 px-2 text-muted-foreground font-medium">Date</th>
                </tr>
              </thead>
              <tbody>
                {campaigns.slice(0, 20).map(c => {
                  const oRate = (c.delivered_count || 0) > 0 ? Math.round(((c.opened_count || 0) / (c.delivered_count || 1)) * 100) : 0;
                  return (
                    <tr key={c.id} className="border-b border-border/50 hover:bg-secondary/30">
                      <td className="py-2 px-2 text-foreground font-medium truncate max-w-[200px]">{c.name || c.subject || "Untitled"}</td>
                      <td className="py-2 px-2">
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full bg-secondary ${CHANNEL_COLORS[c.channel as NotifChannel] || ""}`}>
                          {c.channel}
                        </span>
                      </td>
                      <td className="py-2 px-2 text-right text-foreground">{c.total_recipients || 0}</td>
                      <td className="py-2 px-2 text-right text-foreground">{c.delivered_count || 0}</td>
                      <td className="py-2 px-2 text-right text-foreground">{c.opened_count || 0}</td>
                      <td className="py-2 px-2 text-right text-foreground">{c.clicked_count || 0}</td>
                      <td className="py-2 px-2 text-right">
                        <span className={`font-medium ${oRate > 30 ? "text-success" : oRate > 10 ? "text-warning" : "text-destructive"}`}>{oRate}%</span>
                      </td>
                      <td className="py-2 px-2 text-muted-foreground">{c.sent_at ? format(new Date(c.sent_at), "MMM dd") : "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
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
  const [resending, setResending] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase.from("notification_history").select("*").order("created_at", { ascending: false }).limit(200);
    setNotifications(data || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);

  const filtered = notifications.filter(n => {
    const matchSearch = !search || n.title?.toLowerCase().includes(search.toLowerCase()) || n.body?.toLowerCase().includes(search.toLowerCase());
    const matchType = typeFilter === "all" || n.type === typeFilter;
    return matchSearch && matchType;
  });

  const totalSent = notifications.length;
  const readCount = notifications.filter(n => n.read).length;
  const unreadCount = totalSent - readCount;
  const readRate = totalSent > 0 ? Math.round((readCount / totalSent) * 100) : 0;

  const deleteNotification = async (id: string) => {
    await supabase.from("notification_history").delete().eq("id", id);
    setNotifications(prev => prev.filter(n => n.id !== id));
    toast({ title: "Notification deleted" });
  };

  const resendNotification = async (notif: any) => {
    setResending(notif.id);
    try {
      await supabase.from("notification_history").insert({
        user_id: notif.user_id, title: notif.title, body: notif.body, type: notif.type, read: false,
      });
      toast({ title: "✅ Notification resent" });
      fetchHistory();
    } catch (e: any) {
      toast({ title: "Resend failed", variant: "destructive" });
    }
    setResending(null);
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search notifications..."
            className="w-full pl-10 pr-4 py-2 bg-secondary rounded-lg text-xs text-foreground border border-border focus:border-primary outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {["all", ...NOTIFICATION_TYPES.map(t => t.value), "admin_broadcast", "daily_briefing"].map(f => (
            <button key={f} onClick={() => setTypeFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-[10px] font-medium capitalize transition-colors ${
                typeFilter === f ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
              }`}
            >{f === "all" ? "All" : f.replace(/_/g, " ")}</button>
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
            <motion.div key={n.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
              className="glass rounded-xl p-3 neural-border flex items-start gap-3"
            >
              <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${n.read ? "bg-secondary" : "bg-primary/10"}`}>
                {n.read ? <Eye className="w-3.5 h-3.5 text-muted-foreground" /> : <Bell className="w-3.5 h-3.5 text-primary" />}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="text-xs font-medium text-foreground truncate">{n.title}</p>
                  {n.type && <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground capitalize">{n.type.replace(/_/g, " ")}</span>}
                </div>
                {n.body && <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.body}</p>}
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-[9px] text-muted-foreground">{formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}</span>
                  <span className="text-[9px] text-muted-foreground/50">·</span>
                  <span className="text-[9px] text-muted-foreground font-mono truncate max-w-[100px]">{n.user_id?.slice(0, 8)}…</span>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <button onClick={() => resendNotification(n)} disabled={resending === n.id}
                  className="p-1.5 hover:bg-primary/10 rounded-lg transition-colors"
                  title="Resend"
                >
                  {resending === n.id ? <Loader2 className="w-3 h-3 animate-spin text-primary" /> : <RotateCcw className="w-3 h-3 text-primary" />}
                </button>
                <button onClick={() => deleteNotification(n.id)} className="p-1.5 hover:bg-destructive/10 rounded-lg transition-colors">
                  <Trash2 className="w-3 h-3 text-destructive" />
                </button>
              </div>
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
    const defaults: Record<string, Record<NotifChannel, boolean>> = {};
    for (const evt of EVENT_TRIGGERS) {
      defaults[evt.key] = { push: true, email: true, voice: true };
    }
    (async () => {
      const { data: flags } = await supabase.from("feature_flags").select("flag_key, enabled").like("flag_key", "notif_event_%");
      if (flags) {
        for (const flag of flags) {
          const parts = flag.flag_key.replace("notif_event_", "").split("_");
          const channel = parts.pop() as NotifChannel;
          const eventKey = parts.join("_");
          if (defaults[eventKey] && channel) defaults[eventKey][channel] = flag.enabled;
        }
      }
      setEventStates(defaults);
      setLoading(false);
    })();
  }, []);

  const toggleEventChannel = async (eventKey: string, channel: NotifChannel) => {
    const current = eventStates[eventKey]?.[channel] ?? true;
    const newVal = !current;
    setEventStates(prev => ({ ...prev, [eventKey]: { ...prev[eventKey], [channel]: newVal } }));
    const flagKey = `notif_event_${eventKey}_${channel}`;
    const { data: existing } = await supabase.from("feature_flags").select("id").eq("flag_key", flagKey).maybeSingle();
    if (existing) {
      await supabase.from("feature_flags").update({ enabled: newVal, updated_at: new Date().toISOString() } as any).eq("flag_key", flagKey);
    } else {
      await supabase.from("feature_flags").insert({ flag_key: flagKey, label: `${eventKey} → ${channel}`, enabled: newVal } as any);
    }
    toast({ title: `${newVal ? "✅ Enabled" : "🚫 Disabled"}: ${eventKey} → ${channel}` });
  };

  const triggerEventNow = async (eventKey: string) => {
    setTriggeringEvent(eventKey);
    try {
      const fnMap: Record<string, string> = {
        study_reminder: "send-study-reminder-emails", daily_briefing: "daily-brain-briefing",
        weekly_insights: "weekly-insights-summary", risk_digest: "daily-risk-digest",
        weekly_report: "send-weekly-report-email", brain_update_reminder: "brain-update-reminder",
        brain_missions: "brain-missions", cognitive_twin_update: "cognitive-twin",
        weekly_brain_digest: "weekly-brain-digest", burnout_detection: "burnout-detection",
        ai_self_evaluate: "ai-self-evaluate", benchmark_deviation: "benchmark-deviation-check",
        adaptive_difficulty: "adaptive-difficulty", subscription_expiry: "check-subscription-expiry",
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
          admin_id: adminId, action: "event_manually_triggered", target_type: "notification_event",
          target_id: eventKey, details: { event: eventKey } as any,
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
        <motion.div key={evt.key} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground">{evt.label}</p>
              <p className="text-[10px] text-muted-foreground mt-0.5">{evt.desc}</p>
            </div>
            <button onClick={() => triggerEventNow(evt.key)} disabled={triggeringEvent === evt.key}
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
                    <Icon className="w-3 h-3" />{CHANNEL_LABELS[ch]}<span className="text-[8px]">N/A</span>
                  </div>
                );
              }
              return (
                <button key={ch} onClick={() => toggleEventChannel(evt.key, ch)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-medium transition-all border ${
                    enabled ? `bg-primary/10 border-primary/20 ${CHANNEL_COLORS[ch]}` : "bg-secondary border-border text-muted-foreground"
                  }`}
                >
                  <Icon className="w-3 h-3" />{CHANNEL_LABELS[ch]}
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
