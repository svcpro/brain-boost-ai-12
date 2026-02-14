import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Flame, Crown, Settings, Database, Shield, ChevronRight, LogOut, BookOpen, Plus, X, Hash, ChevronDown, Pencil, Check, Bell, BellOff, Trophy, Volume2, Mic, Mail } from "lucide-react";
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
import { isFeedbackEnabled, setFeedbackEnabled, getFeedbackVolume, setFeedbackVolume, notifyFeedback, playNotificationSound } from "@/lib/feedback";
import VoiceSettingsPanel from "./VoiceSettingsPanel";
import DataBackup from "./DataBackup";
import PrivacySecurity from "./PrivacySecurity";
import SubscriptionPlan from "./SubscriptionPlan";
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
}

const YouTab = ({ autoOpenVoiceSettings, onVoiceSettingsOpened, autoOpenSubscription, onSubscriptionOpened }: YouTabProps) => {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

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
  const [showEmailSetting, setShowEmailSetting] = useState(false);
  const [showDisableAllDialog, setShowDisableAllDialog] = useState(false);
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);


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

  useEffect(() => {
    getPrefs().then((p) => {
      setReminderEnabled(p.enabled);
      setReminderHour(p.reminderHour);
    });
    // Load leaderboard opt-in & subscription
    if (user) {
      supabase.from("profiles").select("opt_in_leaderboard, email_notifications_enabled, email_study_reminders, email_weekly_reports").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (data) {
          setLeaderboardOptIn(data.opt_in_leaderboard ?? false);
          setEmailNotifications((data as any).email_notifications_enabled ?? true);
          setEmailStudyReminders((data as any).email_study_reminders ?? true);
          setEmailWeeklyReports((data as any).email_weekly_reports ?? true);
        }
      });
      supabase.from("user_subscriptions").select("plan_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
        if (data) setCurrentPlan(data.plan_id);
      });
    }
  }, [getPrefs, user]);

  const loadSubjects = async () => {
    if (!user) return;
    setLoadingSubjects(true);
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id)
      .order("name");

    if (subs) {
      const withTopics: Subject[] = [];
      for (const sub of subs) {
        const { data: topics } = await supabase
          .from("topics")
          .select("id, name, memory_strength")
          .eq("subject_id", sub.id)
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

  const pendingDeletesRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const deleteSubject = async (id: string) => {
    const subject = subjects.find(s => s.id === id);
    if (!subject) return;

    // Optimistically remove from UI
    setSubjects(prev => prev.filter(s => s.id !== id));

    // Schedule actual deletion
    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(`subject-${id}`);
      await supabase.from("topics").delete().eq("subject_id", id);
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        loadSubjects();
      }
    }, 6000);

    pendingDeletesRef.current.set(`subject-${id}`, timeoutId);

    toast({
      title: `🗑️ "${subject.name}" deleted`,
      description: `Subject and ${subject.topics.length} topic${subject.topics.length !== 1 ? "s" : ""} removed.`,
      action: (
        <ToastAction altText="Undo delete" onClick={() => {
            clearTimeout(pendingDeletesRef.current.get(`subject-${id}`));
            pendingDeletesRef.current.delete(`subject-${id}`);
            setSubjects(prev => [...prev, subject].sort((a, b) => a.name.localeCompare(b.name)));
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
    let deletedTopic: Topic | null = null;
    let parentSubjectId: string | null = null;

    // Find and optimistically remove
    setSubjects(prev => prev.map(sub => {
      const topic = sub.topics.find(t => t.id === id);
      if (topic) {
        deletedTopic = topic;
        parentSubjectId = sub.id;
        return { ...sub, topics: sub.topics.filter(t => t.id !== id) };
      }
      return sub;
    }));

    if (!deletedTopic || !parentSubjectId) return;

    const topicName = (deletedTopic as Topic).name;
    const subId = parentSubjectId;

    const timeoutId = setTimeout(async () => {
      pendingDeletesRef.current.delete(`topic-${id}`);
      const { error } = await supabase.from("topics").delete().eq("id", id);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
        loadSubjects();
      }
    }, 6000);

    pendingDeletesRef.current.set(`topic-${id}`, timeoutId);

    toast({
      title: `🗑️ "${topicName}" deleted`,
      description: "Topic has been removed.",
      action: (
        <ToastAction altText="Undo delete" onClick={() => {
            clearTimeout(pendingDeletesRef.current.get(`topic-${id}`));
            pendingDeletesRef.current.delete(`topic-${id}`);
            setSubjects(prev => prev.map(sub => {
              if (sub.id === subId) {
                return { ...sub, topics: [...sub.topics, deletedTopic!].sort((a, b) => a.name.localeCompare(b.name)) };
              }
              return sub;
            }));
            toast({ title: "↩️ Restored", description: `"${topicName}" has been restored.` });
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

  const menuItems = [
    { icon: Crown, label: "Subscription Plan", value: currentPlan === "ultra" ? "Ultra Brain" : currentPlan === "pro" ? "Pro Brain" : "Free Brain", onClick: () => setShowSubscription(true) },
    { icon: BookOpen, label: "Subjects & Topics", value: `${subjects.length || "—"}`, onClick: () => setShowSubjects(!showSubjects) },
    { icon: Bell, label: "Study Reminders", value: reminderEnabled ? "On" : "Off", onClick: () => setShowReminders(!showReminders) },
    { icon: Trophy, label: "Leaderboard", value: leaderboardOptIn ? "Visible" : "Hidden", onClick: () => setShowLeaderboardSetting(!showLeaderboardSetting) },
    { icon: Volume2, label: "Sound & Haptics", value: feedbackOn ? "On" : "Off", onClick: () => setShowFeedbackSetting(!showFeedbackSetting) },
    { icon: Mic, label: "Voice Notifications", value: voiceSettings.enabled ? "On" : "Off", onClick: () => setShowVoiceSettings(!showVoiceSettings) },
    { icon: Mail, label: "Email Notifications", value: [emailNotifications, emailStudyReminders, emailWeeklyReports].every(v => v) ? "All On" : [emailNotifications, emailStudyReminders, emailWeeklyReports].every(v => !v) ? "All Off" : "Custom", onClick: () => setShowEmailSetting(!showEmailSetting) },
    { icon: Database, label: "Data Backup", value: "", onClick: () => setShowDataBackup(!showDataBackup) },
    { icon: Shield, label: "Privacy & Security", value: "", onClick: () => setShowPrivacy(!showPrivacy) },
  ];

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Profile Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-2xl p-6 neural-border text-center"
      >
        <div className="w-20 h-20 rounded-full neural-gradient neural-border flex items-center justify-center mx-auto mb-4">
          <User className="w-10 h-10 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">
          {user?.user_metadata?.display_name || "Student"}
        </h2>
        <p className="text-sm text-muted-foreground">{user?.email}</p>

        <div className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-full neural-gradient neural-border">
          <Flame className="w-4 h-4 text-warning" />
          <span className="text-sm font-semibold text-foreground">7 Day Streak</span>
          <span className="text-xl">🔥</span>
        </div>
      </motion.div>

      {/* Brain Level */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-xl p-5 neural-border"
      >
        <div className="flex items-center justify-between mb-3">
          <span className="text-sm font-semibold text-foreground">Brain Level</span>
          <span className="text-xs text-primary font-medium">Level 4</span>
        </div>
        <div className="h-2 rounded-full bg-secondary mb-2">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary to-success"
            initial={{ width: 0 }}
            animate={{ width: "62%" }}
            transition={{ duration: 1 }}
          />
        </div>
        <p className="text-[10px] text-muted-foreground">620 / 1000 XP to Level 5</p>
      </motion.div>

      {/* Menu Items */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="space-y-1"
      >
        {menuItems.map((item, i) => (
          <button
            key={i}
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-secondary/30 transition-all"
          >
            <item.icon className="w-5 h-5 text-muted-foreground" />
            <span className="flex-1 text-left text-sm text-foreground">{item.label}</span>
            {item.value && (
              <span className="text-xs text-muted-foreground">{item.value}</span>
            )}
            <ChevronRight className={`w-4 h-4 text-muted-foreground transition-transform ${item.label === "Subjects & Topics" && showSubjects ? "rotate-90" : ""}`} />
          </button>
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
                    {/* Add subject */}
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

                    {/* Subject list */}
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
                            onClick={e => { e.stopPropagation(); deleteSubject(sub.id); }}
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
                                {/* Topics */}
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
                                      onClick={() => deleteTopic(topic.id)}
                                      className="text-muted-foreground hover:text-destructive transition-colors"
                                    >
                                      <X className="w-3 h-3" />
                                    </button>
                                  </div>
                                ))}

                                {/* Add topic inline */}
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
                {/* Master toggle */}
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

                {/* Individual toggles */}
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
                      <span className="text-xs text-foreground font-medium">{volume}%</span>
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

        {/* Data Backup Panel */}
        <AnimatePresence>
          {showDataBackup && <DataBackup />}
        </AnimatePresence>

        {/* Privacy & Security Panel */}
        <AnimatePresence>
          {showPrivacy && <PrivacySecurity />}
        </AnimatePresence>

        {/* Subscription Plan Modal */}
        <AnimatePresence>
          {showSubscription && <SubscriptionPlan onClose={() => setShowSubscription(false)} currentPlan={currentPlan} onPlanChanged={() => {
            supabase.from("user_subscriptions").select("plan_id").eq("user_id", user!.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
              if (data) setCurrentPlan(data.plan_id);
            });
          }} />}
        </AnimatePresence>

        <button
          onClick={() => setShowSignOutDialog(true)}
          className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-destructive/10 transition-all"
        >
          <LogOut className="w-5 h-5 text-destructive" />
          <span className="flex-1 text-left text-sm text-destructive">Sign Out</span>
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
    </div>
  );
};

export default YouTab;
