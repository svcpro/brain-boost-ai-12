import { useState, useEffect, useRef, useMemo } from "react";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import { motion, AnimatePresence } from "framer-motion";
import { LogOut, Camera, Loader2, Check, X, Pencil, Sparkles, BookOpen } from "lucide-react";
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
import { useAuth } from "@/contexts/AuthContext";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import SubscriptionPlan from "./SubscriptionPlan";
import { useFeatureFlagContext } from "@/hooks/useFeatureFlags";
import PlanGateWrapper from "./PlanGateWrapper";

// Identity sections
import IdentityCommandCenter from "./you/IdentityCommandCenter";
import MyRankRankCard from "./you/MyRankRankCard";
import LearningIdentitySummary from "./you/LearningIdentitySummary";
import AIPersonalStrategy from "./you/AIPersonalStrategy";
import AchievementWall from "./you/AchievementWall";
import MonthlyPerformanceSnapshot from "./you/MonthlyPerformanceSnapshot";
import SubscriptionOverview from "./you/SubscriptionOverview";
import AIRecalibration from "./you/AIRecalibration";
import AIPersonalizationControlCenter from "./you/AIPersonalizationControlCenter";
import CognitiveProfileCard from "./CognitiveProfileCard";
import PasswordManagement from "./you/PasswordManagement";
import ApiKeyCard from "./you/ApiKeyCard";
import AITopicManager from "./AITopicManager";

interface YouTabProps {
  autoOpenVoiceSettings?: boolean;
  onVoiceSettingsOpened?: () => void;
  autoOpenSubscription?: boolean;
  onSubscriptionOpened?: () => void;
  autoOpenNotifHistory?: boolean;
  onNotifHistoryOpened?: () => void;
}

const YouTab = ({ autoOpenVoiceSettings, onVoiceSettingsOpened, autoOpenSubscription, onSubscriptionOpened, autoOpenNotifHistory, onNotifHistoryOpened }: YouTabProps) => {
  const { isEnabled } = useFeatureFlagContext();
  const { user, signOut } = useAuth();
  const { streak: streakData } = useStudyStreak();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [totalXp, setTotalXp] = useState(0);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [levelUpCelebration, setLevelUpCelebration] = useState<number | null>(null);
  const [profileDisplayName, setProfileDisplayName] = useState<string | null>(null);
  const [editingName, setEditingName] = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [savingName, setSavingName] = useState(false);
  const prevLevelRef = useRef<number | null>(null);
  // Mobile OTP users may have stale auth metadata from a previous identity —
  // never fall back to user_metadata or email for them.
  const isMobileSignup =
    user?.user_metadata?.signup_method === "mobile_otp" ||
    user?.app_metadata?.provider === "phone" ||
    !!user?.phone;
  const [showSubscription, setShowSubscription] = useState(false);
  const [currentPlan, setCurrentPlan] = useState("free");
  const [showSignOutDialog, setShowSignOutDialog] = useState(false);
  const [showTopicManager, setShowTopicManager] = useState(false);

  const LEVEL_THRESHOLDS = useMemo(() => [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000], []);

  const currentLevel = useMemo(() => {
    let level = 1;
    for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
      if (totalXp >= LEVEL_THRESHOLDS[i]) { level = i + 1; break; }
    }
    return level;
  }, [totalXp, LEVEL_THRESHOLDS]);

  const currentThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel - 1, LEVEL_THRESHOLDS.length - 1)] || 0;
  const nextThreshold = LEVEL_THRESHOLDS[Math.min(currentLevel, LEVEL_THRESHOLDS.length - 1)] || currentThreshold + 1000;

  // Detect level-up
  useEffect(() => {
    if (prevLevelRef.current !== null && currentLevel > prevLevelRef.current) {
      setLevelUpCelebration(currentLevel);
      import("canvas-confetti").then(({ default: confetti }) => {
        confetti({ particleCount: 120, spread: 80, origin: { y: 0.6 }, colors: ["hsl(var(--primary))", "hsl(var(--success))", "#FFD700", "#FF6B6B"] });
      });
      setTimeout(() => setLevelUpCelebration(null), 3000);
    }
    prevLevelRef.current = currentLevel;
  }, [currentLevel]);

  // Auto-open subscription
  useEffect(() => {
    if (autoOpenSubscription) { setShowSubscription(true); onSubscriptionOpened?.(); }
  }, [autoOpenSubscription, onSubscriptionOpened]);

  // Load avatar URL, XP, and plan
  useEffect(() => {
    if (!user) return;
    supabase.from("profiles").select("avatar_url, display_name").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.avatar_url) setAvatarUrl(data.avatar_url);
      setProfileDisplayName(data?.display_name || null);
    });
    supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id).then(({ data }) => {
      const xp = (data || []).reduce((sum, log) => sum + (log.duration_minutes || 0), 0);
      setTotalXp(xp);
    });
    supabase.from("user_subscriptions").select("plan_id").eq("user_id", user.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
      if (data) setCurrentPlan(data.plan_id);
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

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <div className="px-5 py-6 space-y-5 max-w-lg mx-auto overflow-x-hidden">
      {/* ═══ PROFILE CARD ═══ */}
      {isEnabled("you_profile") && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl p-5 neural-border">
          <div className="flex items-center gap-4">
            <motion.label
              htmlFor="avatar-upload"
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, type: "spring", stiffness: 200 }}
              className="relative w-14 h-14 rounded-2xl neural-gradient neural-border flex items-center justify-center shrink-0 cursor-pointer group overflow-hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="Avatar" className="w-full h-full object-cover rounded-2xl" />
              ) : (
                <span className="text-lg font-bold text-primary">
                  {(profileDisplayName || (isMobileSignup ? "S" : (user?.user_metadata?.display_name || "S"))).slice(0, 2).toUpperCase()}
                </span>
              )}
              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl flex items-center justify-center">
                {uploadingAvatar ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Camera className="w-5 h-5 text-white" />}
              </div>
              <input id="avatar-upload" type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            </motion.label>
            <div className="flex-1 min-w-0">
              {editingName ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={editNameValue}
                    onChange={(e) => setEditNameValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        const trimmed = editNameValue.trim();
                        if (!trimmed || !user) return;
                        setSavingName(true);
                        supabase.from("profiles").update({ display_name: trimmed } as any).eq("id", user.id).then(({ error }) => {
                          setSavingName(false);
                          if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                          setProfileDisplayName(trimmed);
                          setEditingName(false);
                          toast({ title: "✨ Name updated!" });
                        });
                      }
                      if (e.key === "Escape") setEditingName(false);
                    }}
                    autoFocus
                    className="flex-1 min-w-0 rounded-lg bg-secondary border border-border px-2.5 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Your name"
                    disabled={savingName}
                  />
                  <button
                    onClick={() => {
                      const trimmed = editNameValue.trim();
                      if (!trimmed || !user) return;
                      setSavingName(true);
                      supabase.from("profiles").update({ display_name: trimmed } as any).eq("id", user.id).then(({ error }) => {
                        setSavingName(false);
                        if (error) { toast({ title: "Error", description: error.message, variant: "destructive" }); return; }
                        setProfileDisplayName(trimmed);
                        setEditingName(false);
                        toast({ title: "✨ Name updated!" });
                      });
                    }}
                    disabled={savingName}
                    className="p-1 rounded-md hover:bg-secondary text-primary"
                  >
                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  </button>
                  <button onClick={() => setEditingName(false)} className="p-1 rounded-md hover:bg-secondary text-muted-foreground"><X className="w-4 h-4" /></button>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <h2 className="text-lg font-bold text-foreground truncate">
                    {profileDisplayName || (isMobileSignup ? "Student" : (user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Student"))}
                  </h2>
                  <button
                    onClick={() => { setEditNameValue(profileDisplayName || (isMobileSignup ? "" : (user?.user_metadata?.display_name || user?.email?.split("@")[0] || ""))); setEditingName(true); }}
                    className="p-1 rounded-md hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground truncate">{user?.email}</p>
            </div>
          </div>
        </motion.div>
      )}

      {/* ═══ SECTION 1: MyRank Leaderboard Rank (replaces Level/Personal Growth) ═══ */}
      <MyRankRankCard />

      {/* ═══ SECTION 4: Subscription Overview (moved above Exam Intelligence) ═══ */}
      <SubscriptionOverview currentPlan={currentPlan} onManagePlan={() => setShowSubscription(true)} />

      {/* ═══ SECTION 2: Learning Identity Summary ═══ */}
      <LearningIdentitySummary />

      {/* Strategic Command (AIPersonalStrategy) — hidden per user request */}

      {/* AI Cognitive Profile hidden per user request */}

      {/* ═══ Achievement Wall ═══ */}
      {isEnabled("you_badges") && <AchievementWall />}

      {/* ═══ Monthly Performance Snapshot ═══ */}
      <MonthlyPerformanceSnapshot />

      {/* ═══ Subjects & Topics Manager ═══ */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => setShowTopicManager(true)}
        className="w-full glass rounded-2xl p-4 neural-border text-left hover:glow-primary transition-all"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5">
              Subjects & Topics
              <Sparkles className="w-3 h-3 text-primary" />
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">Add, edit, or remove your syllabus</p>
          </div>
          <Pencil className="w-4 h-4 text-muted-foreground" />
        </div>
      </motion.button>

      {/* Topic Manager Modal */}
      <AnimatePresence>
        {showTopicManager && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl neural-border p-5"
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-primary" />
                  Subjects & Topics
                </h2>
                <button
                  onClick={() => setShowTopicManager(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors"
                >
                  ✕
                </button>
              </div>
              <AITopicManager mode="user" onDone={() => setShowTopicManager(false)} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* API Key card hidden per user request */}

      {/* AI Recalibration hidden per user request */}

      {/* AI Personalization Control Center (AI Behavior Control, Risk & Stability Shield, Exam and Goal Config, Data Privacy, AI Personality Mode, System Recalibration, Automation Transparency) — hidden per user request */}

      {/* Subscription Plan Modal */}
      <AnimatePresence>
        {showSubscription && <SubscriptionPlan onClose={() => setShowSubscription(false)} currentPlan={currentPlan} onPlanChanged={() => {
          supabase.from("user_subscriptions").select("plan_id").eq("user_id", user!.id).eq("status", "active").order("created_at", { ascending: false }).limit(1).maybeSingle().then(({ data }) => {
            if (data) setCurrentPlan(data.plan_id);
          });
        }} />}
      </AnimatePresence>

      {/* Password Management — hidden per user request */}

      {/* Sign Out */}
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.35 }}>
        <button onClick={() => setShowSignOutDialog(true)} className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center bg-destructive/10 shrink-0"><LogOut className="w-4 h-4 text-destructive" /></div>
          <span className="flex-1 text-left text-sm text-destructive font-medium">Sign Out</span>
        </button>
      </motion.div>

      {/* Dialogs */}
      <AlertDialog open={showSignOutDialog} onOpenChange={setShowSignOutDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sign out?</AlertDialogTitle>
            <AlertDialogDescription>You'll need to sign back in to access your study data.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleSignOut} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Sign Out</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Level-up celebration */}
      <AnimatePresence>
        {levelUpCelebration !== null && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none">
            <motion.div initial={{ scale: 0.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 1.5, opacity: 0 }} transition={{ type: "spring", stiffness: 200, damping: 15 }} className="bg-card/95 backdrop-blur-lg rounded-3xl p-8 shadow-2xl border border-primary/30 text-center pointer-events-auto">
              <motion.div animate={{ rotate: [0, -10, 10, -10, 0], scale: [1, 1.2, 1] }} transition={{ duration: 0.6 }} className="text-5xl mb-3">🧠</motion.div>
              <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-1">Level Up!</p>
              <p className="text-3xl font-extrabold text-foreground">Level {levelUpCelebration}</p>
              <p className="text-sm text-muted-foreground mt-2">Keep studying to unlock the next level!</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default YouTab;
