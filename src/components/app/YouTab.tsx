import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Flame, Crown, Settings, Database, Shield, ChevronRight, LogOut, BookOpen, Plus, X, Hash, ChevronDown, Pencil, Check, Bell, BellOff, Trophy, Volume2, Mic, Mail, Trash2, BellRing, Sparkles, Camera, Loader2 } from "lucide-react";
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
import { ToastAction } from "@/components/ui/toast";
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useStudyReminder } from "@/hooks/useStudyReminder";
import { isFeedbackEnabled, setFeedbackEnabled, getFeedbackVolume, setFeedbackVolume, notifyFeedback, playNotificationSound, playInsightSound, playWarningSound } from "@/lib/feedback";
import VoiceSettingsPanel from "./VoiceSettingsPanel";
import DataBackup from "./DataBackup";
import PrivacySecurity from "./PrivacySecurity";
import TrashBin from "./TrashBin";
import BadgeGallery from "./BadgeGallery";
import SubscriptionPlan from "./SubscriptionPlan";
import NotificationPreferencesPanel from "./NotificationPreferencesPanel";
import NotificationHistory from "./NotificationHistory";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";

interface Topic {
  id: string;
  name: string;
  memory_strength: number;
}

interface Subject {
  id: string;
  name: string;
  topics: Topic[];
}

interface YouTabProps {
  autoOpenVoiceSettings?: boolean;
  onVoiceSettingsOpened?: () => void;
  autoOpenSubscription?: boolean;
  onSubscriptionOpened?: () => void;
  autoOpenNotifHistory?: boolean;
  onNotifHistoryOpened?: () => void;
}

const soundColorMap: Record<string, { bar: string; active: string; glow: string }> = {
  "🔔 Standard": { bar: "bg-primary/40", active: "bg-primary", glow: "shadow-[0_0_8px_2px_hsl(var(--primary)/0.4)]" },
  "✨ Insight": { bar: "bg-accent/40", active: "bg-accent", glow: "shadow-[0_0_8px_2px_hsl(var(--accent)/0.4)]" },
  "⚠️ Nudge": { bar: "bg-destructive/40", active: "bg-destructive", glow: "shadow-[0_0_8px_2px_hsl(var(--destructive)/0.4)]" },
};

const SoundPreviewButton = ({ label, onPlay, duration }: { label: string; onPlay: () => void; duration: number }) => {
  const [playing, setPlaying] = useState(false);
  const bars = 5;
  const colors = soundColorMap[label] || soundColorMap["🔔 Standard"];

  const handleClick = () => {
    onPlay();
    setPlaying(true);
    setTimeout(() => setPlaying(false), duration + 200);
  };

  return (
    <button
      onClick={handleClick}
      className="flex-1 flex flex-col items-center gap-1.5 py-2 px-2 rounded-lg bg-secondary/50 hover:bg-secondary text-foreground transition-colors"
    >
      <div className={`flex items-end gap-[2px] h-4 rounded-md px-1 transition-shadow duration-300 ${playing ? colors.glow : ""}`}>
        {Array.from({ length: bars }).map((_, i) => (
          <motion.div
            key={i}
            className={`w-[3px] rounded-full ${playing ? colors.active : colors.bar}`}
            animate={playing ? {
              height: [4, 12 + Math.random() * 4, 6, 14 + Math.random() * 2, 4],
            } : { height: 4 }}
            transition={playing ? {
              duration: 0.4,
              repeat: Math.ceil(duration / 400),
              delay: i * 0.05,
              ease: "easeInOut",
            } : { duration: 0.2 }}
          />
        ))}
      </div>
      <span className="text-[10px]">{label}</span>
    </button>
  );
};

const YouTab = ({ autoOpenVoiceSettings, onVoiceSettingsOpened, autoOpenSubscription, onSubscriptionOpened, autoOpenNotifHistory, onNotifHistoryOpened }: YouTabProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [levelUpCelebration, setLevelUpCelebration] = useState<number | null>(null);
  const prevLevelRef = useRef<number | null>(null);

  const LEVEL_THRESHOLDS = useMemo(() => [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000], []);

  const currentLevel = useMemo(() => {
    let level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
    }
    return level;
  }, [totalXp, LEVEL_THRESHOLDS]);

  // Detect level-up
  useEffect(() => {
    if (prevLevelRef.current !== null && currentLevel > prevLevelRef.current) {
      setLevelUpCelebration(currentLevel);
      // Fire confetti
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["hsl(var(--primary))", "hsl(var(--success))", "#FFD700", "#FF6B6B"] });
      });
      setTimeout(() => setLevelUpCelebration(null), 3000);
    }
    prevLevelRef.current = currentLevel;
  }, [currentLevel]);

  const [showSubjects, setShowSubjects] = useState(false);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [newSubjectName, setNewSubjectName] = useState("");
  const [newTopicName, setNewTopicName] = useState("");
  const [addingTopicFor, setAddingTopicFor] = useState<string | null>(null);
  const [editingSubject, setEditingSubject] = useState<string | null>(null);
  const [editSubjectName, setEditSubjectName] = useState("");
  const [editingTopic, setEditingTopic] = useState<string | null>(null);
  const [editTopicName, setEditTopicName] = useState("");
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [reminderEnabled, setReminderEnabled] = useState(false);
  const [reminderHour, setReminderHour] = useState(18);
  const [leaderboardOptIn, setLeaderboardOptIn] = useState(false);
  const [showLeaderboardSetting, setShowLeaderboardSetting] = useState(false);
  const [feedbackOn, setFeedbackOn] = useState(() => isFeedbackEnabled());
  const [volume, setVolume] = useState(() => getFeedbackVolume());
  const [showFeedbackSetting, setShowFeedbackSetting] = useState(false);
  const [showVoiceSettings, setShowVoiceSettings] = useState(false);
  const [showDataBackup, setShowDataBackup] = useState(false);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showSubscription, setShowSubscription] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [emailStudyReminders, setEmailStudyReminders] = useState(true);
  const [emailWeeklyReports, setEmailWeeklyReports] = useState(true);
  const [weeklyReportDay, setWeeklyReportDay] = useState(0);
  const [weeklyReportHour, setWeeklyReportHour] = useState(7);
  const [showEmailSetting, setShowEmailSetting] = useState(false);
  const [showDisableAllDialog, setShowDisableAllDialog] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [trashCount, setTrashCount] = useState(0);
  const [deleteConfirm, setDeleteConfirm] = useState<{ type: "subject" | "topic"; id: string; name: string } | null>(null);
  const [showPushPrefs, setShowPushPrefs] = useState(false);
  const [showNotifHistory, setShowNotifHistory] = useState(false);

  const voiceSettings = getVoiceSettings();
  const { getPrefs, savePrefs, requestPermission } = useStudyReminder();

  // Auto-open voice settings when navigated from Home indicator
  useEffect(() => {
    if (autoOpenVoiceSettings) {
      setShowVoiceSettings(true);
      onVoiceSettingsOpened?.();
    }
  }, [autoOpenVoiceSettings, onVoiceSettingsOpened]);

  // Auto-open subscription panel when navigated from expiry banner
  useEffect(() => {
    if (autoOpenSubscription) {
      setShowSubscription(true);
      onSubscriptionOpened?.();
    }
  }, [autoOpenSubscription, onSubscriptionOpened]);

  // Auto-open notification history when navigated from toast
  useEffect(() => {
    if (autoOpenNotifHistory) {
      setShowNotifHistory(true);
      onNotifHistoryOpened?.();
    }
  }, [autoOpenNotifHistory, onNotifHistoryOpened]);

  const loadTrashCount = useCallback(async () => {
    if (!user) return;
    const [{ count: sc }, { count: tc }] = await Promise.all([
      supabase.from("subjects").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("deleted_at", "is", null),
      supabase.from("topics").select("id", { count: "exact", head: true }).eq("user_id", user.id).not("deleted_at", "is", null),
    ]);
    setTrashCount((sc ?? 0) + (tc ?? 0));
  }, [user]);

  // Load avatar URL and XP
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
    });
    // Sum all study minutes as XP
    supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id).then(({ data }) => {
      const xp = (data || []).reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
      setTotalXp(xp);
    });
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) {
      toast({ title: "Invalid file", description: "Please select an image file.", variant: "destructive" });
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 2MB allowed.", variant: "destructive" });
      return;
    }
    setUploadingAvatar(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage.from("avatars").upload(path, file, { upsert: true });
      if (uploadError) throw uploadError;
      const { data: { publicUrl } } = supabase.storage.from("avatars").getPublicUrl(path);
      const urlWithCacheBust = `${publicUrl}?t=${Date.now()}`;
      await supabase.from("profiles").update({ avatar_url: urlWithCacheBust } as any).eq("id", user.id);
      setAvatarUrl(urlWithCacheBust);
      toast({ title: "✨ Avatar updated!" });
    } catch (err: any) {
      toast({ title: "Upload failed", description: err.message, variant: "destructive" });
    } finally {
      setUploadingAvatar(false);
    }
  };

  useEffect(() => {
    getPrefs().then((p) => {
      setReminderEnabled(p.enabled);
      setReminderHour(p.reminderHour);
    });
    // Load leaderboard opt-in & subscription
    if (user) {
      supabase.from("profiles").select("opt_in_leaderboard, email_notifications_enabled, email_study_reminders, email_weekly_reports, weekly_report_day, weekly_report_hour").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setLeaderboardOptIn(data.opt_in_leaderboard ?? false);
          setEmailNotifications((data as any).email_notifications_enabled ?? true);
          setEmailStudyReminders((data as any).email_study_reminders ?? true);
          setEmailWeeklyReports((data as any).email_weekly_reports ?? true);
          const offsetMin = new Date().getTimezoneOffset();
          const storedUtcHour = (data as any).weekly_report_hour ?? 7;
          const localH = ((storedUtcHour * 60 - offsetMin) / 60) % 24;
          setWeeklyReportHour(localH < 0 ? localH + 24 : Math.floor(localH));
          setWeeklyReportDay((data as any).weekly_report_day ?? 0);
        }
      });
      supabase.from("user_subscriptions").select("plan_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
        if (data) setCurrentPlan(data.plan_id);
      });
      loadTrashCount();
    }
  }, [getPrefs, user, loadTrashCount]);

  const loadSubjects = async () => {
    if (!user) return;
    setLoadingSubjects(true);
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name");

    if (subs) {
      const withTopics: Subject[] = [];
      for (const sub of subs) {
        const { data: topics } = await supabase
          .from("topics")
          .select("id, name, memory_strength")
          .eq("subject_id", sub.id)
          .is("deleted_at", null)
          .order("name");
        withTopics.push({ ...sub, topics: topics || [] });
      }
      setSubjects(withTopics);
    }
    setLoadingSubjects(false);
  };

  useEffect(() => {
    if (showSubjects) loadSubjects();
  }, [showSubjects]);

  const addSubject = async () => {
    const trimmed = newSubjectName.trim();
    if (!trimmed || !user) return;
    const { error } = await supabase.from("subjects").insert({ name: trimmed, user_id: user.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewSubjectName("");
    loadSubjects();
  };

  const deleteSubject = async (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    // Optimistically remove from UI
    setSubjects(prev => prev.filter(s => s.id !== id));

    // Soft-delete in DB
    const now = new Date().toISOString();
    const { error } = await supabase.from("subjects").update({ deleted_at: now } as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      loadSubjects();
      return;
    }
    // Soft-delete topics under this subject
    await supabase.from("topics").update({ deleted_at: now } as any).eq("subject_id", id).is("deleted_at", null);

    toast({
      title: `🗑️ "${subject.name}" moved to trash`,
      description: `Subject and ${subject.topics.length} topic${subject.topics.length !== 1 ? "s" : ""} trashed.`,
      action: (
        <ToastAction altText="Undo delete" onClick={async () => {
            await supabase.from("subjects").update({ deleted_at: null } as any).eq("id", id);
            await supabase.from("topics").update({ deleted_at: null } as any).eq("subject_id", id);
            loadSubjects();
            toast({ title: "↩️ Restored", description: `"${subject.name}" has been restored.` });
          }}>
          Undo
        </ToastAction>
      ),
      duration: 6000,
    });
  };

  const addTopic = async (subjectId: string) => {
    const trimmed = newTopicName.trim();
    if (!trimmed || !user) return;
    const { error } = await supabase.from("topics").insert({ name: trimmed, subject_id: subjectId, user_id: user.id });
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setNewTopicName("");
    setAddingTopicFor(null);
    loadSubjects();
  };

  const deleteTopic = async (id: string) => {
    let deletedTopicName = "";

    // Optimistically remove from UI
    setSubjects(prev => prev.map(sub => {
      const topic = sub.topics.find(t => t.id === id);
      if (topic) {
        deletedTopicName = topic.name;
        return { ...sub, topics: sub.topics.filter(t => t.id !== id) };
      }
      return sub;
    }));

    if (!deletedTopicName) return;

    const { error } = await supabase.from("topics").update({ deleted_at: new Date().toISOString() } as any).eq("id", id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      loadSubjects();
      return;
    }

    toast({
      title: `🗑️ "${deletedTopicName}" moved to trash`,
      description: "Topic has been trashed.",
      action: (
        <ToastAction altText="Undo delete" onClick={async () => {
            await supabase.from("topics").update({ deleted_at: null } as any).eq("id", id);
            loadSubjects();
            toast({ title: "↩️ Restored", description: `"${deletedTopicName}" has been restored.` });
          }}>
          Undo
        </ToastAction>
      ),
      duration: 6000,
    });
  };

  const renameSubject = async (id: string) => {
    const trimmed = editSubjectName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("subjects").update({ name: trimmed }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setEditingSubject(null);
    loadSubjects();
  };

  const renameTopic = async (id: string) => {
    const trimmed = editTopicName.trim();
    if (!trimmed) return;
    const { error } = await supabase.from("topics").update({ name: trimmed }).eq("id", id);
    if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
    setEditingTopic(null);
    loadSubjects();
  };

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  // Grouped menu sections
  const studySection = [
    { icon: BookOpen, label: "Subjects & Topics", value: `${subjects.length || "—"}`, onClick: () => setShowSubjects(!showSubjects), isOpen: showSubjects },
    { icon: Trophy, label: "Leaderboard", value: leaderboardOptIn ? "Visible" : "Hidden", onClick: () => setShowLeaderboardSetting(!showLeaderboardSetting), isOpen: showLeaderboardSetting },
  ];

  const notificationSection = [
    { icon: Bell, label: "Study Reminders", value: reminderEnabled ? "On" : "Off", onClick: () => setShowReminders(!showReminders), isOpen: showReminders },
    { icon: BellRing, label: "Push Notifications", value: "", onClick: () => setShowPushPrefs(!showPushPrefs), isOpen: showPushPrefs },
    { icon: Bell, label: "Notification History", value: "", onClick: () => setShowNotifHistory(!showNotifHistory), isOpen: showNotifHistory },
    { icon: Mail, label: "Email Notifications", value: [emailNotifications, emailStudyReminders, emailWeeklyReports].every(v => v) ? "All On" : [emailNotifications, emailStudyReminders, emailWeeklyReports].every(v => !v) ? "All Off" : "Custom", onClick: () => setShowEmailSetting(!showEmailSetting), isOpen: showEmailSetting },
    { icon: Volume2, label: "Sound & Haptics", value: feedbackOn ? "On" : "Off", onClick: () => setShowFeedbackSetting(!showFeedbackSetting), isOpen: showFeedbackSetting },
    { icon: Mic, label: "Voice Notifications", value: voiceSettings.enabled ? "On" : "Off", onClick: () => setShowVoiceSettings(!showVoiceSettings), isOpen: showVoiceSettings },
  ];

  const dataSection = [
    { icon: Trash2, label: "Trash", value: "__trash__", onClick: () => setShowTrash(!showTrash), isOpen: showTrash },
    { icon: Database, label: "Data Backup", value: "", onClick: () => setShowDataBackup(!showDataBackup), isOpen: showDataBackup },
    { icon: Shield, label: "Privacy & Security", value: "", onClick: () => setShowPrivacy(!showPrivacy), isOpen: showPrivacy },
  ];

  const MenuItem = ({ item, index }: { item: typeof studySection[0]; index: number }) => (
    <motion.button
      initial={{ opacity: 0, x: -12 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: 0.05 * index, duration: 0.3 }}
      onClick={item.onClick}
      className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
        item.isOpen ? "bg-primary/5 border border-primary/20" : "hover:bg-secondary/30"
      }`}
    >
      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
        item.isOpen ? "bg-primary/15" : "bg-secondary/50"
      }`}>
        <item.icon className={`w-4 h-4 ${item.isOpen ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <span className="flex-1 text-left text-sm text-foreground font-medium">{item.label}</span>
      {item.value === "__trash__" ? (
        <AnimatePresence mode="wait">
          {trashCount > 0 && (
            <motion.span
              key={trashCount}
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 500, damping: 20 }}
              className="min-w-[22px] h-[22px] flex items-center justify-center rounded-full bg-destructive text-destructive-foreground text-[11px] font-bold px-1.5"
            >
              {trashCount}
            </motion.span>
          )}
        </AnimatePresence>
      ) : item.value ? (
        <span className="text-[11px] text-muted-foreground bg-secondary/50 px-2 py-0.5 rounded-md">{item.value}</span>
      ) : null}
      <motion.div animate={{ rotate: item.isOpen ? 90 : 0 }} transition={{ duration: 0.2 }}>
        <ChevronRight className="w-4 h-4 text-muted-foreground" />
      </motion.div>
    </motion.button>
  );

  const SectionHeader = ({ icon: Icon, label, delay }: { icon: any; label: string; delay: number }) => (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay }}
      className="flex items-center gap-2 px-1 pt-2 pb-1"
    >
      <Icon className="w-3.5 h-3.5 text-primary" />
      <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
    </motion.div>
  );

  return (
    <div className="px-6 py-6 space-y-5">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 neural-border"
      >
        <div className="flex items-center gap-4">
          <motion.label
            htmlFor="avatar-upload"
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
            className="relative w-16 h-16 rounded-2xl neural-gradient neural-border flex items-center justify-center shrink-0 cursor-pointer group overflow-hidden"
          >
            {avatarUrl ? (
              <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
            ) : (
              <span className="text-lg font-bold text-primary">
                {(user?.user_metadata?.display_name || "S").slice(0, 2).toUpperCase()}
              </span>
            )}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
              {uploadingAvatar ? (
                <Loader2 className="w-5 h-5 text-white animate-spin" />
              ) : (
                <Camera className="w-5 h-5 text-white" />
              )}
            </div>
            <input
              id="avatar-upload"
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarUpload}
              disabled={uploadingAvatar}
            />
          </motion.label>
          <div className="flex-1 min-w-0">
            <motion.h2
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.15 }}
              className="text-lg font-bold text-foreground truncate"
            >
              {user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Student"}
            </motion.h2>
            <motion.p
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2 }}
              className="text-xs text-muted-foreground truncate"
            >
              {user?.email}
            </motion.p>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.25 }}
              className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-warning/10 border border-warning/20"
            >
              <Flame className="w-3.5 h-3.5 text-warning" />
              <span className="text-xs font-semibold text-foreground">7 Day Streak</span>
              <span className="text-sm">🔥</span>
            </motion.div>
          </div>
        </div>
      </motion.div>

      {/* Brain Level + Plan */}
      <div className="grid grid-cols-2 gap-3">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass rounded-xl p-4 neural-border"
        >
          <div className="flex items-center gap-2 mb-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-[11px] font-semibold text-muted-foreground">Brain Level</span>
          </div>
          {(() => {
            const currentThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel - 1, LEVEL_THRESHOLDS.length - 1)] || 0;
            const nextThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel, LEVEL_THRESHOLDS.length - 1)] || currentThreshold + 1000;
            const xpInLevel = totalXp - currentThreshold;
            const xpNeeded = nextThreshold - currentThreshold;
            const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));
            return (
              <>
                <p className="text-xl font-bold text-foreground">Level {currentLevel}</p>
                <div className="h-1.5 rounded-full bg-secondary mt-2">
                  <motion.div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-success"
                    initial={{ width: 0 }}
                    animate={{ width: `${pct}%` }}
                    transition={{ duration: 1, delay: 0.3 }}
                  />
                </div>
                <p className="text-[9px] text-muted-foreground mt-1.5">{xpInLevel} / {xpNeeded} XP</p>
              </>
            );
          })()}
        </motion.div>

        <motion.button
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          whileTap={{ scale: 0.97 }}
          onClick={() => setShowSubscription(true)}
          className="glass rounded-xl p-4 neural-border text-left hover:bg-secondary/20 transition-colors"
        >
          <div className="flex items-center gap-2 mb-2">
            <Crown className="w-4 h-4 text-warning" />
            <span className="text-[11px] font-semibold text-muted-foreground">Plan</span>
          </div>
          <p className="text-sm font-bold text-foreground">
            {currentPlan === "ultra" ? "Ultra Brain" : currentPlan === "pro" ? "Pro Brain" : "Free Brain"}
          </p>
          <p className="text-[9px] text-primary mt-1">Manage →</p>
        </motion.button>
      </div>

      {/* Badge Gallery */}
      <BadgeGallery />

      {/* Study & Learning Section */}
      <div className="space-y-1">
        <SectionHeader icon={BookOpen} label="Study & Learning" delay={0.2} />
        {studySection.map((item, i) => (
          <MenuItem key={item.label} item={item} index={i} />
        ))}

        {/* Subjects & Topics Panel */}
        <AnimatePresence>
          {showSubjects && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl p-4 neural-border space-y-3 mt-1">
                {loadingSubjects ? (
                  <p className="text-xs text-muted-foreground text-center py-4">Loading...</p>
                ) : (
                  <>
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="New subject..."
                        value={newSubjectName}
                        onChange={e => setNewSubjectName(e.target.value)}
                        onKeyDown={e => e.key === "Enter" && addSubject()}
                        className="flex-1 rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                      />
                      <button
                        onClick={addSubject}
                        disabled={!newSubjectName.trim()}
                        className="px-3 rounded-lg bg-primary text-primary-foreground disabled:opacity-30 transition-all"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>

                    {subjects.length === 0 && (
                      <p className="text-xs text-muted-foreground text-center py-2">No subjects yet.</p>
                    )}

                    {subjects.map(sub => (
                      <div key={sub.id} className="rounded-lg bg-secondary/30 border border-border overflow-hidden">
                        <div className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-secondary/50 transition-all">
                          <BookOpen className="w-3.5 h-3.5 text-primary flex-shrink-0" />
                          {editingSubject === sub.id ? (
                            <form onSubmit={e => { e.preventDefault(); renameSubject(sub.id); }} className="flex-1 flex items-center gap-1.5">
                              <input
                                type="text"
                                value={editSubjectName}
                                onChange={e => setEditSubjectName(e.target.value)}
                                autoFocus
                                onBlur={() => setEditingSubject(null)}
                                className="flex-1 rounded-md bg-secondary border border-border px-2 py-0.5 text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                              />
                              <button type="submit" onMouseDown={e => e.preventDefault()} className="text-success hover:text-success/80">
                                <Check className="w-3.5 h-3.5" />
                              </button>
                            </form>
                          ) : (
                            <button onClick={() => setExpandedSubject(expandedSubject === sub.id ? null : sub.id)} className="flex-1 text-left text-sm font-medium text-foreground">
                              {sub.name}
                            </button>
                          )}
                          <span className="text-[10px] text-muted-foreground flex-shrink-0">{sub.topics.length} topics</span>
                          <button
                            onClick={e => { e.stopPropagation(); setEditingSubject(sub.id); setEditSubjectName(sub.name); }}
                            className="text-muted-foreground hover:text-primary transition-colors"
                          >
                            <Pencil className="w-3 h-3" />
                          </button>
                          <ChevronDown
                            onClick={() => setExpandedSubject(expandedSubject === sub.id ? null : sub.id)}
                            className={`w-3.5 h-3.5 text-muted-foreground transition-transform cursor-pointer ${expandedSubject === sub.id ? "rotate-180" : ""}`}
                          />
                          <button
                            onClick={e => { e.stopPropagation(); setDeleteConfirm({ type: "subject", id: sub.id, name: sub.name }); }}
                            className="text-muted-foreground hover:text-destructive transition-colors"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>

                        <AnimatePresence>
                          {expandedSubject === sub.id && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              transition={{ duration: 0.2 }}
                              className="overflow-hidden"
                            >
                              <div className="px-3 pb-3 space-y-2">
                                {sub.topics.map(topic => (
                                  <div key={topic.id} className="flex items-center gap-2 pl-5">
                                    <Hash className="w-3 h-3 text-muted-foreground flex-shrink-0" />
                                    {editingTopic === topic.id ? (
                                      <form onSubmit={e => { e.preventDefault(); renameTopic(topic.id); }} className="flex-1 flex items-center gap-1.5">
                                        <input
                                          type="text"
                                          value={editTopicName}
                                          onChange={e => setEditTopicName(e.target.value)}
                                          autoFocus
                                          onBlur={() => setEditingTopic(null)}
                                          className="flex-1 rounded-md bg-secondary border border-border px-2 py-0.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                        />
                                        <button type="submit" onMouseDown={e => e.preventDefault()} className="text-success hover:text-success/80">
                                          <Check className="w-3 h-3" />
                                        </button>
                                      </form>
                                    ) : (
                                      <span className="flex-1 text-xs text-foreground">{topic.name}</span>
                                    )}
                                    <span className={`text-[10px] ${topic.memory_strength > 70 ? "text-success" : topic.memory_strength > 40 ? "text-warning" : "text-destructive"}`}>
                                      {topic.memory_strength}%
                                    </span>
                                    <button
                                      onClick={() => { setEditingTopic(topic.id); setEditTopicName(topic.name); }}
                                      className="text-muted-foreground hover:text-primary transition-colors"
                                    >
                                      <Pencil className="w-2.5 h-2.5" />
                                    </button>
                                    <button
                                      onClick={() => setDeleteConfirm({ type: "topic", id: topic.id, name: topic.name })}
                                      className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}

                                {addingTopicFor === sub.id ? (
                                  <div className="flex gap-1.5 pl-5">
                                    <input
                                      type="text"
                                      placeholder="Topic name..."
                                      value={newTopicName}
                                      onChange={e => setNewTopicName(e.target.value)}
                                      onKeyDown={e => e.key === "Enter" && addTopic(sub.id)}
                                      autoFocus
                                      className="flex-1 rounded-md bg-secondary border border-border px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                                    />
                                    <button onClick={() => addTopic(sub.id)} disabled={!newTopicName.trim()} className="px-2 rounded-md bg-primary text-primary-foreground text-xs disabled:opacity-30">
                                      Add
                                    </button>
                                    <button onClick={() => { setAddingTopicFor(null); setNewTopicName(""); }} className="text-muted-foreground hover:text-foreground">
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ) : (
                                  <button
                                    onClick={() => { setAddingTopicFor(sub.id); setNewTopicName(""); }}
                                    className="flex items-center gap-1 pl-5 text-[11px] text-primary hover:underline"
                                  >
                                    <Plus className="w-3 h-3" /> Add topic
                                  </button>
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

        {/* Leaderboard Settings Panel */}
        <AnimatePresence>
          {showLeaderboardSetting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl p-4 neural-border space-y-3 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Trophy className={`w-4 h-4 ${leaderboardOptIn ? "text-warning" : "text-muted-foreground"}`} />
                    <span className="text-sm text-foreground">Show me on leaderboard</span>
                  </div>
                  <button
                    onClick={async () => {
                      const newVal = !leaderboardOptIn;
                      setLeaderboardOptIn(newVal);
                      if (user) {
                        await supabase.from("profiles").update({ opt_in_leaderboard: newVal } as any).eq("id", user.id);
                      }
                      toast({ title: newVal ? "🏆 You're now on the leaderboard!" : "You've been hidden from the leaderboard" });
                    }}
                    className={`w-10 h-6 rounded-full transition-all relative ${leaderboardOptIn ? "bg-primary" : "bg-secondary"}`}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-1"
                      animate={{ left: leaderboardOptIn ? 22 : 4 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {leaderboardOptIn
                    ? "Your display name and stats are visible to other students. Only the first 2 characters of your name are shown."
                    : "You're hidden from the leaderboard. Other students can't see your rank or stats."}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Notifications Section */}
      <div className="space-y-1">
        <SectionHeader icon={Bell} label="Notifications" delay={0.25} />
        {notificationSection.map((item, i) => (
          <MenuItem key={item.label} item={item} index={i} />
        ))}

        {/* Reminders Panel */}
        <AnimatePresence>
          {showReminders && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl p-4 neural-border space-y-4 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {reminderEnabled ? (
                      <Bell className="w-4 h-4 text-primary" />
                    ) : (
                      <BellOff className="w-4 h-4 text-muted-foreground" />
                    )}
                    <span className="text-sm text-foreground">Daily Reminders</span>
                  </div>
                  <button
                    onClick={async () => {
                      if (!reminderEnabled) {
                        const granted = await requestPermission();
                        if (!granted) {
                          toast({ title: "Notifications blocked", description: "Please enable notifications in your browser settings.", variant: "destructive" });
                          return;
                        }
                      }
                      const newVal = !reminderEnabled;
                      setReminderEnabled(newVal);
                      await savePrefs({ enabled: newVal, reminderHour });
                      toast({ title: newVal ? "🔔 Reminders enabled" : "🔕 Reminders disabled" });
                    }}
                    className={`w-10 h-6 rounded-full transition-all relative ${reminderEnabled ? "bg-primary" : "bg-secondary"}`}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-1"
                      animate={{ left: reminderEnabled ? 22 : 4 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>

                {reminderEnabled && (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2">
                    <p className="text-xs text-muted-foreground">Remind me at:</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[9, 12, 15, 18, 19, 20, 21, 22].map((h) => (
                        <button
                          key={h}
                          onClick={async () => {
                            setReminderHour(h);
                            await savePrefs({ enabled: true, reminderHour: h });
                          }}
                          className={`py-2 rounded-lg text-xs font-medium transition-all border ${
                            reminderHour === h
                              ? "border-primary bg-primary/15 text-primary"
                              : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
                          }`}
                        >
                          {h > 12 ? `${h - 12} PM` : h === 12 ? "12 PM" : `${h} AM`}
                        </button>
                      ))}
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      You'll get a notification if you haven't studied by this time.
                    </p>
                  </motion.div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Push Notification Preferences Panel */}
        <AnimatePresence>
          {showPushPrefs && <NotificationPreferencesPanel />}
        </AnimatePresence>

        {/* Notification History Panel */}
        <AnimatePresence>
          {showNotifHistory && <NotificationHistory />}
        </AnimatePresence>

        {/* Email Notifications Settings Panel */}
        <AnimatePresence>
          {showEmailSetting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl p-4 neural-border space-y-4 mt-1">
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold text-foreground">All Email Notifications</span>
                    <button
                      onClick={() => {
                        const allOn = emailNotifications && emailStudyReminders && emailWeeklyReports;
                        if (allOn) {
                          setShowDisableAllDialog(true);
                        } else {
                          const disableAll = async () => {
                            setEmailNotifications(true);
                            setEmailStudyReminders(true);
                            setEmailWeeklyReports(true);
                            if (user) await supabase.from("profiles").update({ email_notifications_enabled: true, email_study_reminders: true, email_weekly_reports: true } as any).eq("id", user.id);
                            toast({ title: "📧 All email notifications enabled" });
                          };
                          disableAll();
                        }
                      }}
                      className={`w-10 h-6 rounded-full transition-all relative ${emailNotifications && emailStudyReminders && emailWeeklyReports ? "bg-primary" : "bg-secondary"}`}
                    >
                      <motion.div
                        className="w-4 h-4 rounded-full bg-white absolute top-1"
                        animate={{ left: emailNotifications && emailStudyReminders && emailWeeklyReports ? 22 : 4 }}
                        transition={{ type: "spring", stiffness: 500, damping: 30 }}
                      />
                    </button>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">Toggle all email types on or off at once</p>
                </div>

                <div className="border-t border-border" />

                {[
                  {
                    label: "Subscription expiry alerts",
                    desc: "Get notified when your plan is about to expire",
                    value: emailNotifications,
                    onChange: async (val: boolean) => {
                      setEmailNotifications(val);
                      if (user) await supabase.from("profiles").update({ email_notifications_enabled: val } as any).eq("id", user.id);
                      toast({ title: val ? "📧 Expiry alerts enabled" : "Expiry alerts disabled" });
                    },
                  },
                  {
                    label: "Daily study reminders",
                    desc: "Receive emails when topics need revision",
                    value: emailStudyReminders,
                    onChange: async (val: boolean) => {
                      setEmailStudyReminders(val);
                      if (user) await supabase.from("profiles").update({ email_study_reminders: val } as any).eq("id", user.id);
                      toast({ title: val ? "📚 Study reminders enabled" : "Study reminders disabled" });
                    },
                  },
                  {
                    label: "Weekly progress reports",
                    desc: "Get a summary of your study stats every week",
                    value: emailWeeklyReports,
                    onChange: async (val: boolean) => {
                      setEmailWeeklyReports(val);
                      if (user) await supabase.from("profiles").update({ email_weekly_reports: val } as any).eq("id", user.id);
                      toast({ title: val ? "📊 Weekly reports enabled" : "Weekly reports disabled" });
                    },
                  },
                ].map((item, i) => (
                  <div key={i} className={`${i > 0 ? "border-t border-border pt-3" : ""}`}>
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-foreground">{item.label}</span>
                      <button
                        onClick={() => item.onChange(!item.value)}
                        className={`w-10 h-6 rounded-full transition-all relative ${item.value ? "bg-primary" : "bg-secondary"}`}
                      >
                        <motion.div
                          className="w-4 h-4 rounded-full bg-white absolute top-1"
                          animate={{ left: item.value ? 22 : 4 }}
                          transition={{ type: "spring", stiffness: 500, damping: 30 }}
                        />
                      </button>
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{item.desc}</p>
                  </div>
                ))}

                {emailWeeklyReports && (
                  <div className="border-t border-border pt-3 space-y-3">
                    <p className="text-xs font-medium text-foreground">📅 Delivery schedule</p>
                    <div className="flex gap-2">
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground mb-1 block">Day</label>
                        <select
                          value={weeklyReportDay}
                          onChange={async (e) => {
                            const val = Number(e.target.value);
                            setWeeklyReportDay(val);
                            if (user) await supabase.from("profiles").update({ weekly_report_day: val } as any).eq("id", user.id);
                            toast({ title: "📅 Report day updated" });
                          }}
                          className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"].map((d, i) => (
                            <option key={i} value={i}>{d}</option>
                          ))}
                        </select>
                      </div>
                      <div className="flex-1">
                        <label className="text-[10px] text-muted-foreground mb-1 block">Time</label>
                        <select
                          value={weeklyReportHour}
                          onChange={async (e) => {
                            const localH = Number(e.target.value);
                            setWeeklyReportHour(localH);
                            const offsetMin = new Date().getTimezoneOffset();
                            const utcH = ((localH * 60 + offsetMin) / 60) % 24;
                            const normalizedUtcH = utcH < 0 ? utcH + 24 : Math.floor(utcH);
                            if (user) await supabase.from("profiles").update({ weekly_report_hour: normalizedUtcH } as any).eq("id", user.id);
                            toast({ title: "🕐 Report time updated" });
                          }}
                          className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                        >
                          {Array.from({ length: 24 }, (_, h) => (
                            <option key={h} value={h}>{`${h.toString().padStart(2, "0")}:00`}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground">
                      📍 Times shown in your local timezone ({Intl.DateTimeFormat().resolvedOptions().timeZone})
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Sound & Haptics Settings Panel */}
        <AnimatePresence>
          {showFeedbackSetting && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="glass rounded-xl p-4 neural-border space-y-3 mt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Volume2 className={`w-4 h-4 ${feedbackOn ? "text-primary" : "text-muted-foreground"}`} />
                    <span className="text-sm text-foreground">Sound & haptic feedback</span>
                  </div>
                  <button
                    onClick={() => {
                      const newVal = !feedbackOn;
                      setFeedbackOn(newVal);
                      setFeedbackEnabled(newVal);
                      if (newVal) notifyFeedback();
                      toast({ title: newVal ? "🔊 Sound & haptics enabled" : "🔇 Sound & haptics disabled" });
                    }}
                    className={`w-10 h-6 rounded-full transition-all relative ${feedbackOn ? "bg-primary" : "bg-secondary"}`}
                  >
                    <motion.div
                      className="w-4 h-4 rounded-full bg-white absolute top-1"
                      animate={{ left: feedbackOn ? 22 : 4 }}
                      transition={{ type: "spring", stiffness: 500, damping: 30 }}
                    />
                  </button>
                </div>
                <p className="text-[10px] text-muted-foreground">
                  {feedbackOn
                    ? "A chime and vibration play when AI analysis or recommendations complete."
                    : "Notifications will be silent with no vibration."}
                </p>

                {feedbackOn && (
                  <div className="space-y-2 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-xs text-muted-foreground">Volume</span>
                      <div className="flex items-center gap-1.5">
                        <div className="flex items-end gap-[1.5px] h-3">
                          {Array.from({ length: 4 }).map((_, i) => {
                            const threshold = (i + 1) * 25;
                            const active = volume >= threshold;
                            const scaled = Math.min(1, volume / 100);
                            return (
                              <motion.div
                                key={i}
                                className={`w-[2.5px] rounded-full ${active ? "bg-primary" : "bg-muted-foreground/20"}`}
                                animate={{ height: active ? 4 + i * 2.5 * scaled : 3 }}
                                transition={{ type: "spring", stiffness: 400, damping: 25 }}
                              />
                            );
                          })}
                        </div>
                        <span className="text-xs text-foreground font-medium">{volume}%</span>
                      </div>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={volume}
                      onChange={(e) => {
                        const v = Number(e.target.value);
                        setVolume(v);
                        setFeedbackVolume(v);
                      }}
                      onMouseUp={() => playNotificationSound()}
                      onTouchEnd={() => playNotificationSound()}
                      className="slider-glass"
                      style={{
                        background: `linear-gradient(90deg, hsl(175 80% 50% / 0.5) 0%, hsl(175 80% 45% / 0.35) ${volume}%, hsl(175 40% 25% / 0.15) ${volume}%, hsl(175 40% 25% / 0.08) 100%)`,
                      }}
                    />
                    <div className="flex justify-between text-[10px] text-muted-foreground">
                      <span>Quiet</span>
                      <span>Loud</span>
                    </div>

                    {/* Sound previews */}
                    <div className="pt-2 border-t border-border space-y-1.5">
                      <span className="text-xs text-muted-foreground font-medium">Preview sounds</span>
                      <div className="flex gap-2">
                        {[
                          { label: "🔔 Standard", fn: playNotificationSound, duration: 300 },
                          { label: "✨ Insight", fn: playInsightSound, duration: 600 },
                          { label: "⚠️ Nudge", fn: playWarningSound, duration: 350 },
                        ].map((s) => (
                          <SoundPreviewButton key={s.label} label={s.label} onPlay={s.fn} duration={s.duration} />
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Voice Notification Settings Panel */}
        <AnimatePresence>
          {showVoiceSettings && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <VoiceSettingsPanel />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Data & Account Section */}
      <div className="space-y-1">
        <SectionHeader icon={Database} label="Data & Account" delay={0.3} />
        {dataSection.map((item, i) => (
          <MenuItem key={item.label} item={item} index={i} />
        ))}

        {/* Trash Bin Panel */}
        <AnimatePresence>
          {showTrash && <TrashBin onTrashChanged={loadTrashCount} />}
        </AnimatePresence>

        {/* Data Backup Panel */}
        <AnimatePresence>
          {showDataBackup && <DataBackup />}
        </AnimatePresence>

        {/* Privacy & Security Panel */}
        <AnimatePresence>
          {showPrivacy && <PrivacySecurity />}
        </AnimatePresence>
      </div>

      {/* Subscription Plan Modal */}
      <AnimatePresence>
        {showSubscription && <SubscriptionPlan onClose={() => setShowSubscription(false)} currentPlan={currentPlan} onPlanChanged={() => {
          supabase.from("user_subscriptions").select("plan_id").eq("user_id", user!.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
            if (data) setCurrentPlan(data.plan_id);
          });
        }} />}
      </AnimatePresence>

      {/* Sign Out */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.35 }}
      >
        <button
          onClick={() => setShowSignOutDialog(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10 shrink-0">
            <LogOut className="w-4 h-4 text-destructive" />
          </div>
          <span className="flex-1 text-left text-sm text-destructive font-medium">Sign Out</span>
        </button>
      </motion.div>

      {/* Disable All Notifications Confirmation */}
      <AlertDialog open={showDisableAllDialog} onOpenChange={setShowDisableAllDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disable all email notifications?</AlertDialogTitle>
            <AlertDialogDescription>
              You won't receive any emails including study reminders, weekly reports, and subscription alerts. You can re-enable them anytime.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                setEmailNotifications(false);
                setEmailStudyReminders(false);
                setEmailWeeklyReports(false);
                if (user) await supabase.from("profiles").update({ email_notifications_enabled: false, email_study_reminders: false, email_weekly_reports: false } as any).eq("id", user.id);
                toast({ title: "All email notifications disabled" });
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Disable All
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>



      {/* Sign Out Confirmation */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>
              You'll need to sign back in to access your study data and progress.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleSignOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Sign Out
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={(open) => { if (!open) setDeleteConfirm(null); }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Move to trash?</AlertDialogTitle>
            <AlertDialogDescription>
              "{deleteConfirm?.name}" will be moved to trash. You can restore it from the Trash bin within 30 days.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteConfirm?.type === "subject") deleteSubject(deleteConfirm.id);
                else if (deleteConfirm?.type === "topic") deleteTopic(deleteConfirm.id);
                setDeleteConfirm(null);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Move to Trash
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Level-up celebration overlay */}
      <AnimatePresence>
        {levelUpCelebration !== null && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.3, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 1.5, opacity: 0 }}
              transition={{ type: "spring", stiffness: 200, damping: 15 }}
              className="bg-card/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-primary/30 text-center pointer-events-auto"
            >
              <motion.div
                animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }}
                transition={{ duration: 0.6 }}
                className="text-5xl mb-3"
              >
                🧠
              </motion.div>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.2 }}
                className="text-xs font-semibold text-primary uppercase tracking-wider mb-1"
              >
                Level Up!
              </motion.p>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="text-3xl font-extrabold text-foreground"
              >
                Level {levelUpCelebration}
              </motion.p>
              <motion.p
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="text-sm text-muted-foreground mt-2"
              >
                Keep studying to unlock the next level!
              </motion.p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default YouTab;
