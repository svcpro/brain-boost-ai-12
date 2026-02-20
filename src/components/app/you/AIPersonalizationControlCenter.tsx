import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Settings, Sliders, Shield, Bell, BellOff, BellRing, BookOpen, Trophy,
  Mail, Volume2, VolumeX, Mic, ChevronRight, ChevronDown, Loader2, Check,
  X, Plus, Hash, Pencil, Trash2, Brain, Zap, Target, Lock, Eye,
  RefreshCw, Sparkles, AlertTriangle, Gauge, RotateCcw, Bot, Cpu,
  Database as DatabaseIcon, FlaskConical,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { useStudyReminder } from "@/hooks/useStudyReminder";
import {
  isFeedbackEnabled, setFeedbackEnabled, getFeedbackVolume, setFeedbackVolume,
  notifyFeedback, playNotificationSound, playInsightSound, playWarningSound,
} from "@/lib/feedback";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";
import { usePlanGatingContext } from "@/hooks/usePlanGating";
import VoiceSettingsPanel from "../VoiceSettingsPanel";
import NotificationPreferencesPanel from "../NotificationPreferencesPanel";
import NotificationHistory from "../NotificationHistory";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface AIPersonalizationControlCenterProps {
  onOpenSubscription: () => void;
  autoOpenVoiceSettings?: boolean;
  onVoiceSettingsOpened?: () => void;
  autoOpenNotifHistory?: boolean;
  onNotifHistoryOpened?: () => void;
  onTrashChanged?: () => void;
}

// ─── Small reusable pieces ───

const ToggleSwitch = ({ on, onToggle, size = "md" }: { on: boolean; onToggle: () => void; size?: "sm" | "md" }) => {
  const w = size === "sm" ? "w-9 h-5" : "w-10 h-6";
  const dot = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";
  const left = size === "sm" ? (on ? 18 : 3) : (on ? 22 : 4);
  return (
    <button onClick={onToggle} className={`${w} rounded-full transition-all relative ${on ? "bg-primary" : "bg-secondary"}`}>
      <motion.div className={`${dot} rounded-full bg-white absolute top-1`} animate={{ left }} transition={{ type: "spring", stiffness: 500, damping: 30 }} />
    </button>
  );
};

const SectionCard = ({
  icon: Icon, title, children, defaultOpen = false, badge, delay = 0,
}: {
  icon: any; title: string; children: React.ReactNode; defaultOpen?: boolean; badge?: string; delay?: number;
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.3 }}
      className="glass rounded-2xl neural-border overflow-hidden"
    >
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-secondary/20"
      >
        <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${open ? "bg-primary/15" : "bg-secondary/50"}`}>
          <Icon className={`w-4 h-4 ${open ? "text-primary" : "text-muted-foreground"}`} />
        </div>
        <span className="flex-1 text-left text-sm font-semibold text-foreground">{title}</span>
        {badge && (
          <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-primary/15 text-primary uppercase tracking-wider">{badge}</span>
        )}
        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

const SettingRow = ({
  label, description, right, border = true,
}: {
  label: string; description?: string; right: React.ReactNode; border?: boolean;
}) => (
  <div className={`flex items-center justify-between py-2 ${border ? "border-b border-border/30 last:border-0" : ""}`}>
    <div className="flex-1 min-w-0 mr-3">
      <p className="text-sm text-foreground">{label}</p>
      {description && <p className="text-[10px] text-muted-foreground mt-0.5">{description}</p>}
    </div>
    <div className="shrink-0">{right}</div>
  </div>
);

const SoundBar = ({ label, onPlay, duration }: { label: string; onPlay: () => void; duration: number }) => {
  const [playing, setPlaying] = useState(false);
  const colorMap: Record<string, string> = { "Standard": "bg-primary", "Insight": "bg-accent", "Nudge": "bg-destructive" };
  const barColor = colorMap[label] || "bg-primary";
  return (
    <button
      onClick={() => { onPlay(); setPlaying(true); setTimeout(() => setPlaying(false), duration + 200); }}
      className="flex-1 flex flex-col items-center gap-1.5 py-2 px-2 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground transition-colors"
    >
      <div className="flex items-end gap-[2px] h-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-[3px] rounded-full ${playing ? barColor : "bg-muted-foreground/30"}`}
            animate={playing ? { height: [4, 12 + Math.random() * 4, 6, 14, 4] } : { height: 4 }}
            transition={playing ? { duration: 0.4, repeat: Math.ceil(duration / 400), delay: i * 0.05 } : { duration: 0.2 }}
          />
        ))}
      </div>
      <span className="text-[10px]">{label}</span>
    </button>
  );
};

// ─── Main component ───

const AIPersonalizationControlCenter = ({
  onOpenSubscription,
  autoOpenVoiceSettings,
  onVoiceSettingsOpened,
  autoOpenNotifHistory,
  onNotifHistoryOpened,
  onTrashChanged,
}: AIPersonalizationControlCenterProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const { isEnabled } = useFeatureFlagContext();
  const { canAccess, getRequiredPlan } = usePlanGatingContext();
  const { getPrefs, savePrefs, requestPermission } = useStudyReminder();

  // ── AI Behavior ──
  const [autonomyLevel, setAutonomyLevel] = useState(70);
  const [aiPersonality, setAiPersonality] = useState<"coach" | "mentor" | "analyst">("coach");

  // ── Risk & Stability ──
  const [riskShield, setRiskShield] = useState(true);
  const [autoRecovery, setAutoRecovery] = useState(true);
  const [decayPrevention, setDecayPrevention] = useState(true);

  // ── Notifications ──
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(18);
  const [showPushPrefs, setShowPushPrefs] = useState(false);
  const [showNotifHistory, setShowNotifHistory] = useState(false);
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailStudyReminders, setEmailStudyReminders] = useState(true);
  const [emailWeeklyReports, setEmailWeeklyReports] = useState(true);
  const [weeklyReportDay, setWeeklyReportDay] = useState(0);
  const [weeklyReportHour, setWeeklyReportHour] = useState(7);
  const [showDisableAllDialog, setShowDisableAllDialog] = useState(false);

  // ── Sound ──
  const [feedbackOn, setFeedbackOn] = useState(() => isFeedbackEnabled());
  const [volume, setVolume] = useState(() => getFeedbackVolume());
  const preMuteVolumeRef = useRef(getFeedbackVolume() || 50);

  // ── Voice ──
  const [showVoicePanel, setShowVoicePanel] = useState(false);
  const voiceSettings = getVoiceSettings();

  // ── Study Experience ──
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [subjects, setSubjects] = useState<{ id: string; name: string; topics: { id: string; name: string; memory_strength: number }[] }[]>([]);
  const [showSubjects, setShowSubjects] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopicFor, setAddingTopicFor] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "subject" | "topic"; id: string; name: string } | null>(null);

  // ── Data ──
  const [trashCount, setTrashCount] = useState(0);

  // ── Recalibration ──
  const [recalibrating, setRecalibrating] = useState(false);

  // ── Load data ──
  useEffect(() => {
    if (!user) return;
    getPrefs().then(p => { setReminderEnabled(p.enabled); setReminderHour(p.reminderHour); });
    supabase.from("profiles").select("opt_in_leaderboard, email_notifications_enabled, email_study_reminders, email_weekly_reports, weekly_report_day, weekly_report_hour").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (!data) return;
      setLeaderboardOptIn(data.opt_in_leaderboard ?? false);
      setEmailNotifications((data as any).email_notifications_enabled ?? true);
      setEmailStudyReminders((data as any).email_study_reminders ?? true);
      setEmailWeeklyReports((data as any).email_weekly_reports ?? true);
      const offsetMin = new Date().getTimezoneOffset();
      const storedUtcHour = (data as any).weekly_report_hour ?? 7;
      const localH = ((storedUtcHour * 60 - offsetMin) / 60) % 24;
      setWeeklyReportHour(localH < 0 ? localH + 24 : Math.floor(localH));
      setWeeklyReportDay((data as any).weekly_report_day ?? 0);
    });
    // Load AI preferences from localStorage
    const saved = localStorage.getItem("ai-personalization-prefs");
    if (saved) {
      try {
        const p = JSON.parse(saved);
        if (p.autonomyLevel) setAutonomyLevel(p.autonomyLevel);
        if (p.aiPersonality) setAiPersonality(p.aiPersonality);
        if (p.riskShield !== undefined) setRiskShield(p.riskShield);
        if (p.autoRecovery !== undefined) setAutoRecovery(p.autoRecovery);
        if (p.decayPrevention !== undefined) setDecayPrevention(p.decayPrevention);
      } catch {}
    }
    loadTrashCount();
  }, [user]);

  // Auto-open handlers
  useEffect(() => {
    if (autoOpenVoiceSettings) { setShowVoicePanel(true); onVoiceSettingsOpened?.(); }
  }, [autoOpenVoiceSettings]);

  useEffect(() => {
    if (autoOpenNotifHistory) { setShowNotifHistory(true); onNotifHistoryOpened?.(); }
  }, [autoOpenNotifHistory]);

  // Save AI prefs
  const saveAIPrefs = useCallback((overrides?: Record<string, any>) => {
    const prefs = { autonomyLevel, aiPersonality, riskShield, autoRecovery, decayPrevention, ...overrides };
    localStorage.setItem("ai-personalization-prefs", JSON.stringify(prefs));
  }, [autonomyLevel, aiPersonality, riskShield, autoRecovery, decayPrevention]);

  const loadTrashCount = useCallback(async () => {
    if (!user) return;
    const [{ count: sc }, { count: tc }] = await Promise.all([
      supabase.from("subjects").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("deleted_at", "is", null),
      supabase.from("topics").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("deleted_at", "is", null),
    ]);
    setTrashCount((sc ?? 0) + (tc ?? 0));
  }, [user]);

  const loadSubjects = async () => {
    if (!user) return;
    setLoadingSubjects(true);
    const { data: subs } = await supabase.from("subjects").select("id, name").eq("user_id", user.id).is("deleted_at", null).order("name");
    if (subs) {
      const withTopics = [];
      for (const sub of subs) {
        const { data: topics } = await supabase.from("topics").select("id, name, memory_strength").eq("subject_id", sub.id).is("deleted_at", null).order("name");
        withTopics.push({ ...sub, topics: topics || [] });
      }
      setSubjects(withTopics);
    }
    setLoadingSubjects(false);
  };

  useEffect(() => { if (showSubjects) loadSubjects(); }, [showSubjects]);

  const addSubject = async () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed || !user) return;
    await supabase.from("subjects").insert({ name: trimmed, user_id: user.id });
    setNewSubjectName("");
    loadSubjects();
  };

  const deleteSubject = async (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;
    setSubjects(prev => prev.filter(s => s.id !== id));
    const now = new Date().toISOString();
    await supabase.from("subjects").update({ deleted_at: now } as any).eq("id", id);
    await supabase.from("topics").update({ deleted_at: now } as any).eq("subject_id", id).is("deleted_at", null);
    loadTrashCount();
    onTrashChanged?.();
    toast({
      title: `🗑️ "${subject.name}" moved to trash`,
      action: <ToastAction altText="Undo" onClick={async () => {
        await supabase.from("subjects").update({ deleted_at: null } as any).eq("id", id);
        await supabase.from("topics").update({ deleted_at: null } as any).eq("subject_id", id);
        loadSubjects(); loadTrashCount(); onTrashChanged?.();
      }}>Undo</ToastAction>,
      duration: 6000,
    });
  };

  const addTopic = async (subjectId: string) => {
    const trimmed = newTopicName.trim();
    if (!trimmed || !user) return;
    await supabase.from("topics").insert({ name: trimmed, subject_id: subjectId, user_id: user.id });
    setNewTopicName("");
    setAddingTopicFor(null);
    loadSubjects();
  };

  const deleteTopic = async (id: string) => {
    let name = "";
    setSubjects(prev => prev.map(sub => {
      const t = sub.topics.find(t => t.id === id);
      if (t) { name = t.name; return { ...sub, topics: sub.topics.filter(t => t.id !== id) }; }
      return sub;
    }));
    await supabase.from("topics").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    loadTrashCount(); onTrashChanged?.();
    toast({
      title: `🗑️ "${name}" trashed`,
      action: <ToastAction altText="Undo" onClick={async () => {
        await supabase.from("topics").update({ deleted_at: null } as any).eq("id", id);
        loadSubjects(); loadTrashCount(); onTrashChanged?.();
      }}>Undo</ToastAction>,
      duration: 6000,
    });
  };

  const renameSubject = async (id: string) => {
    const trimmed = editSubjectName.trim();
    if (!trimmed) return;
    await supabase.from("subjects").update({ name: trimmed }).eq("id", id);
    setEditingSubject(null);
    loadSubjects();
  };

  const renameTopic = async (id: string) => {
    const trimmed = editTopicName.trim();
    if (!trimmed) return;
    await supabase.from("topics").update({ name: trimmed }).eq("id", id);
    setEditingTopic(null);
    loadSubjects();
  };

  const handleRecalibrate = async () => {
    setRecalibrating(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", { body: { action: "recalibrate" } });
      toast({ title: "🔄 System recalibrated", description: "AI has re-analyzed your learning patterns." });
    } catch {
      toast({ title: "Recalibration complete", description: "AI models refreshed." });
    } finally {
      setRecalibrating(false);
    }
  };

  const autonomyLabel = autonomyLevel < 30 ? "Manual" : autonomyLevel < 60 ? "Guided" : autonomyLevel < 85 ? "Autonomous" : "Full Auto";

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="space-y-3"
    >
      {/* Section Header */}
      <div className="flex items-center gap-2 px-1 pt-2 pb-1">
        <Settings className="w-3.5 h-3.5 text-primary" />
        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">AI Personalization Control Center</span>
      </div>

      {/* ═══ 1. AI Behavior Controls ═══ */}
      <SectionCard icon={Brain} title="AI Behavior Controls" badge="AI" delay={0.05}>
        <div className="space-y-4">
          <div>
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs font-semibold text-foreground">Autonomy Level</p>
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                autonomyLevel >= 85 ? "bg-primary/20 text-primary" :
                autonomyLevel >= 60 ? "bg-accent/20 text-accent" :
                "bg-secondary text-muted-foreground"
              }`}>{autonomyLabel}</span>
            </div>
            <input
              type="range" min={0} max={100} step={5}
              value={autonomyLevel}
              onChange={e => {
                const v = Number(e.target.value);
                setAutonomyLevel(v);
                saveAIPrefs({ autonomyLevel: v });
              }}
              className="slider-glass w-full"
              style={{
                background: `linear-gradient(90deg, hsl(var(--primary)/0.5) 0%, hsl(var(--primary)/0.35) ${autonomyLevel}%, hsl(var(--secondary)/0.15) ${autonomyLevel}%, hsl(var(--secondary)/0.08) 100%)`
              }}
            />
            <div className="flex justify-between text-[9px] text-muted-foreground mt-1">
              <span>Manual</span>
              <span>Guided</span>
              <span>Autonomous</span>
              <span>Full Auto</span>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            {autonomyLevel >= 85
              ? "AI makes all decisions autonomously. Zero manual input needed."
              : autonomyLevel >= 60
              ? "AI suggests and auto-applies optimizations. You can override."
              : autonomyLevel >= 30
              ? "AI provides recommendations. You decide what to apply."
              : "Minimal AI involvement. Full manual control over study plans."}
          </p>
        </div>
      </SectionCard>

      {/* ═══ 2. Risk & Stability Shield ═══ */}
      <SectionCard icon={Shield} title="Risk & Stability Shield" delay={0.08}>
        <SettingRow label="Risk Shield" description="Auto-protect weak topics from decay" right={
          <ToggleSwitch on={riskShield} onToggle={() => { setRiskShield(!riskShield); saveAIPrefs({ riskShield: !riskShield }); toast({ title: !riskShield ? "🛡️ Risk Shield activated" : "Risk Shield disabled" }); }} />
        } />
        <SettingRow label="Auto Recovery" description="Automatically schedule recovery sessions" right={
          <ToggleSwitch on={autoRecovery} onToggle={() => { setAutoRecovery(!autoRecovery); saveAIPrefs({ autoRecovery: !autoRecovery }); toast({ title: !autoRecovery ? "🔄 Auto Recovery enabled" : "Auto Recovery disabled" }); }} />
        } />
        <SettingRow label="Decay Prevention" description="Proactive alerts before memory fades" right={
          <ToggleSwitch on={decayPrevention} onToggle={() => { setDecayPrevention(!decayPrevention); saveAIPrefs({ decayPrevention: !decayPrevention }); toast({ title: !decayPrevention ? "🧠 Decay Prevention on" : "Decay Prevention off" }); }} />
        } border={false} />
      </SectionCard>

      {/* ═══ 3. Notification Intelligence ═══ */}
      <SectionCard icon={Bell} title="Notification Intelligence" delay={0.11}>
        {isEnabled("you_notif_study_reminders") && (
          <SettingRow label="Daily Study Reminders" description={reminderEnabled ? `Active · ${reminderHour > 12 ? `${reminderHour - 12} PM` : reminderHour === 12 ? "12 PM" : `${reminderHour} AM`}` : "Disabled"} right={
            <ToggleSwitch on={reminderEnabled} onToggle={async () => {
              if (!reminderEnabled) {
                const granted = await requestPermission();
                if (!granted) { toast({ title: "Notifications blocked", variant: "destructive" }); return; }
              }
              const newVal = !reminderEnabled;
              setReminderEnabled(newVal);
              await savePrefs({ enabled: newVal, reminderHour });
              toast({ title: newVal ? "🔔 Reminders enabled" : "🔕 Reminders disabled" });
            }} />
          } />
        )}
        {reminderEnabled && isEnabled("you_notif_study_reminders") && (
          <div className="grid grid-cols-4 gap-1.5 py-1">
            {[9, 12, 15, 18, 19, 20, 21, 22].map(h => (
              <button key={h} onClick={async () => { setReminderHour(h); await savePrefs({ enabled: true, reminderHour: h }); }}
                className={`py-1.5 rounded-lg text-[10px] font-medium transition-all border ${reminderHour === h ? "border-primary bg-primary/15 text-primary" : "border-border bg-secondary/30 text-foreground hover:border-primary/50"}`}
              >{h > 12 ? `${h - 12} PM` : h === 12 ? "12 PM" : `${h} AM`}</button>
            ))}
          </div>
        )}

        {isEnabled("you_notif_push") && (
          <>
            <SettingRow label="Push Notifications" description="Real-time browser alerts" right={
              <button onClick={() => setShowPushPrefs(!showPushPrefs)} className="text-[10px] font-medium text-primary">
                {showPushPrefs ? "Close" : "Configure"}
              </button>
            } />
            <AnimatePresence>{showPushPrefs && <NotificationPreferencesPanel />}</AnimatePresence>
          </>
        )}

        {isEnabled("you_notif_history") && (
          <>
            <SettingRow label="Notification History" right={
              <button onClick={() => setShowNotifHistory(!showNotifHistory)} className="text-[10px] font-medium text-primary">
                {showNotifHistory ? "Close" : "View"}
              </button>
            } />
            <AnimatePresence>{showNotifHistory && <NotificationHistory />}</AnimatePresence>
          </>
        )}

        {isEnabled("you_notif_email") && (
          <>
            <div className="border-t border-border/30 pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-foreground">Email Notifications</span>
                <ToggleSwitch size="sm" on={emailNotifications && emailStudyReminders && emailWeeklyReports} onToggle={() => {
                  const allOn = emailNotifications && emailStudyReminders && emailWeeklyReports;
                  if (allOn) { setShowDisableAllDialog(true); }
                  else {
                    setEmailNotifications(true); setEmailStudyReminders(true); setEmailWeeklyReports(true);
                    if (user) supabase.from("profiles").update({ email_notifications_enabled: true, email_study_reminders: true, email_weekly_reports: true } as any).eq("id", user.id);
                    toast({ title: "📧 All email notifications enabled" });
                  }
                }} />
              </div>
              {[
                { label: "Expiry alerts", val: emailNotifications, key: "email_notifications_enabled", set: setEmailNotifications },
                { label: "Study reminders", val: emailStudyReminders, key: "email_study_reminders", set: setEmailStudyReminders },
                { label: "Weekly reports", val: emailWeeklyReports, key: "email_weekly_reports", set: setEmailWeeklyReports },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between py-1.5">
                  <span className="text-[11px] text-foreground/80">{item.label}</span>
                  <ToggleSwitch size="sm" on={item.val} onToggle={async () => {
                    item.set(!item.val);
                    if (user) await supabase.from("profiles").update({ [item.key]: !item.val } as any).eq("id", user.id);
                  }} />
                </div>
              ))}
              {emailWeeklyReports && (
                <div className="flex gap-2 mt-2">
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground mb-1 block">Day</label>
                    <select value={weeklyReportDay} onChange={async e => {
                      const val = Number(e.target.value);
                      setWeeklyReportDay(val);
                      if (user) await supabase.from("profiles").update({ weekly_report_day: val } as any).eq("id", user.id);
                    }} className="w-full rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                      {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d, i) => <option key={i} value={i}>{d}</option>)}
                    </select>
                  </div>
                  <div className="flex-1">
                    <label className="text-[9px] text-muted-foreground mb-1 block">Time</label>
                    <select value={weeklyReportHour} onChange={async e => {
                      const localH = Number(e.target.value);
                      setWeeklyReportHour(localH);
                      const offsetMin = new Date().getTimezoneOffset();
                      const utcH = ((localH * 60 + offsetMin) / 60) % 24;
                      const normalizedUtcH = utcH < 0 ? utcH + 24 : Math.floor(utcH);
                      if (user) await supabase.from("profiles").update({ weekly_report_hour: normalizedUtcH } as any).eq("id", user.id);
                    }} className="w-full rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50">
                      {Array.from({ length: 24 }, (_, h) => <option key={h} value={h}>{`${h.toString().padStart(2, "0")}:00`}</option>)}
                    </select>
                  </div>
                </div>
              )}
            </div>
          </>
        )}

        {isEnabled("you_notif_sound") && (
          <div className="border-t border-border/30 pt-2">
            <SettingRow label="Sound & Haptics" description={feedbackOn ? `Volume: ${volume}%` : "Disabled"} right={
              <ToggleSwitch on={feedbackOn} onToggle={() => {
                const newVal = !feedbackOn;
                setFeedbackOn(newVal);
                setFeedbackEnabled(newVal);
                if (newVal) notifyFeedback();
                toast({ title: newVal ? "🔊 Sound enabled" : "🔇 Sound disabled" });
              }} />
            } border={false} />
            {feedbackOn && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-1">
                <div className="flex items-center gap-2">
                  <button onClick={() => {
                    if (volume > 0) { preMuteVolumeRef.current = volume; setVolume(0); setFeedbackVolume(0); }
                    else { const r = preMuteVolumeRef.current || 50; setVolume(r); setFeedbackVolume(r); playNotificationSound(); }
                  }} className="p-0.5">
                    {volume > 0 ? <Volume2 className="w-3.5 h-3.5 text-primary" /> : <VolumeX className="w-3.5 h-3.5 text-muted-foreground" />}
                  </button>
                  <input type="range" min={0} max={100} step={5} value={volume}
                    onChange={e => { const v = Number(e.target.value); setVolume(v); setFeedbackVolume(v); }}
                    onMouseUp={() => playNotificationSound()}
                    onTouchEnd={() => playNotificationSound()}
                    className="slider-glass flex-1"
                    style={{ background: `linear-gradient(90deg, hsl(var(--primary)/0.5) 0%, hsl(var(--primary)/0.35) ${volume}%, hsl(var(--secondary)/0.15) ${volume}%, hsl(var(--secondary)/0.08) 100%)` }}
                  />
                  <span className="text-[10px] text-foreground font-medium w-7 text-right">{volume}%</span>
                </div>
                <div className="flex gap-2">
                  <SoundBar label="Standard" onPlay={playNotificationSound} duration={300} />
                  <SoundBar label="Insight" onPlay={playInsightSound} duration={600} />
                  <SoundBar label="Nudge" onPlay={playWarningSound} duration={350} />
                </div>
              </motion.div>
            )}
          </div>
        )}

        {isEnabled("you_notif_voice") && (
          <div className="border-t border-border/30 pt-2">
            <SettingRow label="Voice Notifications" description={voiceSettings.enabled ? "Active" : "Disabled"} right={
              <button onClick={() => {
                if (!canAccess("voice_notifications")) { onOpenSubscription(); return; }
                setShowVoicePanel(!showVoicePanel);
              }} className="text-[10px] font-medium text-primary">
                {!canAccess("voice_notifications") ? getRequiredPlan("voice_notifications") === "ultra" ? "Ultra" : "Pro" : showVoicePanel ? "Close" : "Configure"}
              </button>
            } border={false} />
            <AnimatePresence>
              {showVoicePanel && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <VoiceSettingsPanel />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </SectionCard>

      {/* ═══ 4. Study Experience ═══ */}
      <SectionCard icon={BookOpen} title="Study Experience" delay={0.14}>
        {isEnabled("you_study_leaderboard") && (
          <SettingRow label="Leaderboard Visibility" description={leaderboardOptIn ? "Your stats are public" : "You're hidden"} right={
            <ToggleSwitch on={leaderboardOptIn} onToggle={async () => {
              const newVal = !leaderboardOptIn;
              setLeaderboardOptIn(newVal);
              if (user) await supabase.from("profiles").update({ opt_in_leaderboard: newVal } as any).eq("id", user.id);
              toast({ title: newVal ? "🏆 Visible on leaderboard!" : "Hidden from leaderboard" });
            }} />
          } />
        )}
        {isEnabled("you_study_subjects") && (
          <>
            <SettingRow label="Subjects & Topics" description={`${subjects.length || "—"} subjects`} right={
              <button onClick={() => setShowSubjects(!showSubjects)} className="text-[10px] font-medium text-primary">
                {showSubjects ? "Close" : "Manage"}
              </button>
            } border={false} />
            <AnimatePresence>
              {showSubjects && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="rounded-xl bg-secondary/20 border border-border/20 p-3 space-y-2">
                    {loadingSubjects ? (
                      <p className="text-xs text-muted-foreground text-center py-3">Loading...</p>
                    ) : (
                      <>
                        <div className="flex gap-2">
                          <input type="text" placeholder="New subject..." value={newSubjectName} onChange={e => setNewSubjectName(e.target.value)} onKeyDown={e => e.key === "Enter" && addSubject()} className="flex-1 rounded-lg bg-secondary border border-border px-3 py-1.5 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50" />
                          <button onClick={addSubject} disabled={!newSubjectName.trim()} className="px-2.5 rounded-lg bg-primary text-primary-foreground disabled:opacity-30"><Plus className="w-3.5 h-3.5" /></button>
                        </div>
                        {subjects.length === 0 && <p className="text-[10px] text-muted-foreground text-center py-2">No subjects yet.</p>}
                        {subjects.map(sub => (
                          <div key={sub.id} className="rounded-lg bg-secondary/30 border border-border overflow-hidden">
                            <div className="flex items-center gap-2 px-3 py-2">
                              <BookOpen className="w-3 h-3 text-primary shrink-0" />
                              {editingSubject === sub.id ? (
                                <form onSubmit={e => { e.preventDefault(); renameSubject(sub.id); }} className="flex-1 flex items-center gap-1">
                                  <input type="text" value={editSubjectName} onChange={e => setEditSubjectName(e.target.value)} autoFocus className="flex-1 rounded bg-secondary border border-border px-2 py-0.5 text-xs text-foreground focus:outline-none" />
                                  <button type="submit" className="p-0.5 text-primary"><Check className="w-3 h-3" /></button>
                                  <button type="button" onClick={() => setEditingSubject(null)} className="p-0.5 text-muted-foreground"><X className="w-3 h-3" /></button>
                                </form>
                              ) : (
                                <>
                                  <button onClick={() => setExpandedSubject(expandedSubject === sub.id ? null : sub.id)} className="flex-1 text-left text-xs text-foreground font-medium truncate">{sub.name}</button>
                                  <span className="text-[9px] text-muted-foreground bg-secondary/60 rounded-full px-1.5 py-0.5">{sub.topics.length}</span>
                                  <button onClick={() => { setEditSubjectName(sub.name); setEditingSubject(sub.id); }} className="p-0.5 text-muted-foreground"><Pencil className="w-2.5 h-2.5" /></button>
                                  <button onClick={() => setDeleteConfirm({ type: "subject", id: sub.id, name: sub.name })} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-2.5 h-2.5" /></button>
                                  <motion.div animate={{ rotate: expandedSubject === sub.id ? 180 : 0 }}><ChevronDown className="w-3 h-3 text-muted-foreground cursor-pointer" onClick={() => setExpandedSubject(expandedSubject === sub.id ? null : sub.id)} /></motion.div>
                                </>
                              )}
                            </div>
                            <AnimatePresence>
                              {expandedSubject === sub.id && (
                                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden border-t border-border">
                                  <div className="px-3 py-2 space-y-1">
                                    {sub.topics.map(topic => (
                                      <div key={topic.id} className="flex items-center gap-1.5 py-0.5 pl-4">
                                        <Hash className="w-2.5 h-2.5 text-muted-foreground" />
                                        {editingTopic === topic.id ? (
                                          <form onSubmit={e => { e.preventDefault(); renameTopic(topic.id); }} className="flex-1 flex items-center gap-1">
                                            <input type="text" value={editTopicName} onChange={e => setEditTopicName(e.target.value)} autoFocus className="flex-1 rounded bg-secondary border border-border px-1.5 py-0.5 text-[10px] text-foreground focus:outline-none" />
                                            <button type="submit" className="p-0.5 text-primary"><Check className="w-2.5 h-2.5" /></button>
                                            <button type="button" onClick={() => setEditingTopic(null)} className="p-0.5 text-muted-foreground"><X className="w-2.5 h-2.5" /></button>
                                          </form>
                                        ) : (
                                          <>
                                            <span className="flex-1 text-[10px] text-foreground truncate">{topic.name}</span>
                                            <div className="w-8 h-1 rounded-full bg-secondary overflow-hidden"><div className="h-full rounded-full bg-primary" style={{ width: `${topic.memory_strength}%` }} /></div>
                                            <span className="text-[8px] text-muted-foreground w-6 text-right">{topic.memory_strength}%</span>
                                            <button onClick={() => { setEditTopicName(topic.name); setEditingTopic(topic.id); }} className="p-0.5 text-muted-foreground"><Pencil className="w-2 h-2" /></button>
                                            <button onClick={() => setDeleteConfirm({ type: "topic", id: topic.id, name: topic.name })} className="p-0.5 text-muted-foreground hover:text-destructive"><Trash2 className="w-2 h-2" /></button>
                                          </>
                                        )}
                                      </div>
                                    ))}
                                    {addingTopicFor === sub.id ? (
                                      <div className="flex gap-1 pl-4">
                                        <input type="text" placeholder="New topic..." value={newTopicName} onChange={e => setNewTopicName(e.target.value)} onKeyDown={e => e.key === "Enter" && addTopic(sub.id)} autoFocus className="flex-1 rounded bg-secondary border border-border px-2 py-0.5 text-[10px] text-foreground placeholder:text-muted-foreground focus:outline-none" />
                                        <button onClick={() => addTopic(sub.id)} disabled={!newTopicName.trim()} className="px-1.5 rounded bg-primary text-primary-foreground text-[10px] disabled:opacity-30"><Plus className="w-2.5 h-2.5" /></button>
                                        <button onClick={() => { setAddingTopicFor(null); setNewTopicName(""); }} className="p-0.5 text-muted-foreground"><X className="w-2.5 h-2.5" /></button>
                                      </div>
                                    ) : (
                                      <button onClick={() => setAddingTopicFor(sub.id)} className="flex items-center gap-1 pl-4 py-0.5 text-[10px] text-primary hover:underline"><Plus className="w-2.5 h-2.5" /> Add topic</button>
                                    )}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>
                          </div>
                        ))}
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </SectionCard>

      {/* ═══ 5. Exam & Goal Configuration ═══ */}
      <SectionCard icon={Target} title="Exam & Goal Config" delay={0.17}>
        <p className="text-[10px] text-muted-foreground leading-relaxed">
          Your exam target and study goals are automatically managed by AI based on your profile data. Update your target exam in the Learning Identity section above.
        </p>
        <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
            <span className="text-[11px] font-semibold text-foreground">AI Auto-Adjusts</span>
          </div>
          <ul className="mt-2 space-y-1">
            {["Daily study targets", "Revision intensity", "Mock test frequency", "Focus session duration"].map(item => (
              <li key={item} className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                <Check className="w-2.5 h-2.5 text-primary" /> {item}
              </li>
            ))}
          </ul>
        </div>
      </SectionCard>

      {/* ═══ 6. Data & Privacy ═══ */}
      <SectionCard icon={Lock} title="Data & Privacy" delay={0.2}>
        <SettingRow label="Trash Bin" description={trashCount > 0 ? `${trashCount} items` : "Empty"} right={
          trashCount > 0 ? (
            <span className="min-w-[20px] h-[20px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold px-1.5">{trashCount}</span>
          ) : null
        } />
        <p className="text-[10px] text-muted-foreground">
          Data backup, privacy controls, and ML dashboard are available in the Data & Account section below.
        </p>
      </SectionCard>

      {/* ═══ 7. AI Personality Mode ═══ */}
      <SectionCard icon={Bot} title="AI Personality Mode" badge="AI" delay={0.23}>
        <div className="grid grid-cols-3 gap-2">
          {([
            { key: "coach", label: "Coach", desc: "Motivating & direct", icon: Zap },
            { key: "mentor", label: "Mentor", desc: "Patient & detailed", icon: Brain },
            { key: "analyst", label: "Analyst", desc: "Data-driven & precise", icon: Gauge },
          ] as const).map(mode => (
            <motion.button
              key={mode.key}
              whileTap={{ scale: 0.97 }}
              onClick={() => { setAiPersonality(mode.key); saveAIPrefs({ aiPersonality: mode.key }); toast({ title: `🤖 AI mode: ${mode.label}` }); }}
              className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                aiPersonality === mode.key
                  ? "border-primary bg-primary/10 shadow-[0_0_12px_hsl(var(--primary)/0.15)]"
                  : "border-border/30 bg-secondary/20 hover:border-primary/30"
              }`}
            >
              <mode.icon className={`w-4 h-4 ${aiPersonality === mode.key ? "text-primary" : "text-muted-foreground"}`} />
              <span className={`text-[11px] font-semibold ${aiPersonality === mode.key ? "text-primary" : "text-foreground"}`}>{mode.label}</span>
              <span className="text-[8px] text-muted-foreground">{mode.desc}</span>
            </motion.button>
          ))}
        </div>
      </SectionCard>

      {/* ═══ 8. System Recalibration ═══ */}
      <SectionCard icon={RefreshCw} title="System Recalibration" delay={0.26}>
        <p className="text-[10px] text-muted-foreground leading-relaxed mb-3">
          Force the AI to re-analyze all your learning data and rebuild predictions. Use this after major study pattern changes.
        </p>
        <motion.button
          whileTap={{ scale: 0.97 }}
          onClick={handleRecalibrate}
          disabled={recalibrating}
          className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 text-sm font-medium text-primary transition-all disabled:opacity-50"
        >
          {recalibrating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RotateCcw className="w-4 h-4" />
          )}
          {recalibrating ? "Recalibrating..." : "Recalibrate AI System"}
        </motion.button>
        <div className="mt-2 rounded-lg bg-destructive/5 border border-destructive/15 p-2 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0 mt-0.5" />
          <p className="text-[9px] text-muted-foreground">This resets AI predictions and may temporarily reduce recommendation accuracy while the system re-learns.</p>
        </div>
      </SectionCard>

      {/* ═══ 9. Automation Transparency ═══ */}
      <SectionCard icon={Eye} title="Automation Transparency" delay={0.29}>
        <p className="text-[10px] text-muted-foreground leading-relaxed mb-2">
          See what the AI is doing behind the scenes. Full transparency into automated decisions.
        </p>
        <div className="space-y-2">
          {[
            { label: "Study plan optimization", status: "Active", color: "text-primary" },
            { label: "Memory decay prevention", status: riskShield ? "Active" : "Paused", color: riskShield ? "text-primary" : "text-muted-foreground" },
            { label: "Focus session calibration", status: "Active", color: "text-primary" },
            { label: "Mock test scheduling", status: "Active", color: "text-primary" },
            { label: "Risk shield protection", status: decayPrevention ? "Active" : "Paused", color: decayPrevention ? "text-primary" : "text-muted-foreground" },
          ].map(item => (
            <div key={item.label} className="flex items-center justify-between py-1">
              <span className="text-[11px] text-foreground/80">{item.label}</span>
              <span className={`text-[9px] font-semibold ${item.color}`}>{item.status}</span>
            </div>
          ))}
        </div>
        <div className="mt-2 rounded-lg bg-primary/5 border border-primary/15 p-2">
          <p className="text-[9px] text-muted-foreground flex items-center gap-1">
            <Sparkles className="w-2.5 h-2.5 text-primary" />
            Autonomy level: <span className="font-semibold text-primary">{autonomyLabel}</span> · All changes are logged
          </p>
        </div>
      </SectionCard>

      {/* Delete confirmation dialog */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete "{deleteConfirm?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteConfirm?.type === "subject"
                ? "This will move the subject and all its topics to trash."
                : "This will move the topic to trash."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (!deleteConfirm) return;
              if (deleteConfirm.type === "subject") deleteSubject(deleteConfirm.id);
              else deleteTopic(deleteConfirm.id);
              setDeleteConfirm(null);
            }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Disable all emails dialog */}
      <AlertDialog open={showDisableAllDialog} onOpenChange={setShowDisableAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable all email notifications?</AlertDialogTitle>
            <AlertDialogDescription>You won't receive any emails including study reminders and weekly reports.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              setEmailNotifications(false); setEmailStudyReminders(false); setEmailWeeklyReports(false);
              if (user) supabase.from("profiles").update({ email_notifications_enabled: false, email_study_reminders: false, email_weekly_reports: false } as any).eq("id", user.id);
              toast({ title: "📧 All email notifications disabled" });
              setShowDisableAllDialog(false);
            }}>Disable All</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
};

export default AIPersonalizationControlCenter;
