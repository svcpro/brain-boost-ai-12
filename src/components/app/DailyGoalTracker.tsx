import { useEffect, useState, useCallback, useRef } from "react";
import { motion } from "framer-motion";
import { Target, Pencil, Check } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useVoice } from "@/pages/AppDashboard";
import { getVoiceSettings } from "@/hooks/useVoiceNotification";
import { useWhatsAppPreview } from "@/hooks/useWhatsAppPreview";
import WhatsAppPreviewModal from "@/components/app/WhatsAppPreviewModal";

const GOAL_OPTIONS = [15, 30, 45, 60, 90, 120];

const DailyGoalTracker = () => {
  const { user } = useAuth();
  const voice = useVoice();
  const { previewState, showPreview, confirmSend, cancelSend } = useWhatsAppPreview();
  const [goalMinutes, setGoalMinutes] = useState(60);
  const [todayMinutes, setTodayMinutes] = useState(0);
  const [editing, setEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const goalVoiceFiredRef = useRef(false);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    // Load goal from profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("daily_study_goal_minutes")
      .eq("id", user.id)
      .maybeSingle();

    if (profile?.daily_study_goal_minutes) {
      setGoalMinutes(profile.daily_study_goal_minutes);
    }

    // Load today's study minutes
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const { data: logs } = await supabase
      .from("study_logs")
      .select("duration_minutes")
      .eq("user_id", user.id)
      .gte("created_at", today.toISOString());

    const total = logs?.reduce((s, l) => s + l.duration_minutes, 0) ?? 0;
    setTodayMinutes(total);
    setLoading(false);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  const saveGoal = async (minutes: number) => {
    if (!user) return;
    setGoalMinutes(minutes);
    setEditing(false);
    await supabase
      .from("profiles")
      .update({ daily_study_goal_minutes: minutes })
      .eq("id", user.id);
  };

  const progress = goalMinutes > 0 ? Math.min((todayMinutes / goalMinutes) * 100, 100) : 0;
  const completed = todayMinutes >= goalMinutes;
  // Voice alert when daily goal is completed
  useEffect(() => {
    if (!completed || goalVoiceFiredRef.current || !voice) return;
    const settings = getVoiceSettings();
    if (!settings.enabled) return;
    goalVoiceFiredRef.current = true;
    voice.speak("motivation", { daily_minutes: todayMinutes });
    // Send WhatsApp notification for daily goal completion
    if (user) {
      showPreview("daily_goal_completed", { user_id: user.id, data: { minutes: todayMinutes } });
    }
  }, [completed, voice, todayMinutes, user]);

  const remaining = Math.max(goalMinutes - todayMinutes, 0);

  const formatTime = (mins: number) => {
    if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
    return `${mins}m`;
  };

  if (loading) return null;

  return (
    <>
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-3">
        <Target className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Daily Goal</h2>
        <button
          onClick={() => setEditing(!editing)}
          className="ml-auto p-1 rounded neural-border hover:glow-primary transition-all"
        >
          <Pencil className="w-3 h-3 text-muted-foreground" />
        </button>
      </div>

      {editing ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
          <p className="text-xs text-muted-foreground">Set your daily study target:</p>
          <div className="grid grid-cols-3 gap-2">
            {GOAL_OPTIONS.map((mins) => (
              <button
                key={mins}
                onClick={() => saveGoal(mins)}
                className={`py-2.5 rounded-lg text-sm font-medium transition-all border ${
                  goalMinutes === mins
                    ? "border-primary bg-primary/15 text-primary"
                    : "border-border bg-secondary/30 text-foreground hover:border-primary/50"
                }`}
              >
                {formatTime(mins)}
              </button>
            ))}
          </div>
        </motion.div>
      ) : (
        <div className="space-y-3">
          {/* Progress ring + stats */}
          <div className="flex items-center gap-4">
            <div className="relative w-16 h-16 flex-shrink-0">
              <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
                <circle cx="50" cy="50" r="40" fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
                <motion.circle
                  cx="50" cy="50" r="40" fill="none"
                  stroke={completed ? "hsl(var(--success))" : "hsl(var(--primary))"}
                  strokeWidth="8"
                  strokeLinecap="round"
                  strokeDasharray={251}
                  initial={{ strokeDashoffset: 251 }}
                  animate={{ strokeDashoffset: 251 * (1 - progress / 100) }}
                  transition={{ duration: 1, delay: 0.2 }}
                />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                {completed ? (
                  <Check className="w-5 h-5 text-success" />
                ) : (
                  <span className="text-xs font-bold text-foreground">{Math.round(progress)}%</span>
                )}
              </div>
            </div>

            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">
                {completed ? "Goal achieved! 🎉" : `${formatTime(remaining)} remaining`}
              </p>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {formatTime(todayMinutes)} / {formatTime(goalMinutes)} today
              </p>
              {!completed && todayMinutes > 0 && (
                <div className="h-1.5 rounded-full bg-secondary mt-2">
                  <motion.div
                    className="h-full rounded-full bg-primary/70"
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.8, delay: 0.3 }}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </motion.div>
    <WhatsAppPreviewModal
      open={previewState.open}
      message={previewState.message}
      eventType={previewState.eventType}
      onConfirm={confirmSend}
      onCancel={cancelSend}
      sending={previewState.sending}
    />
    </>
  );
};

export default DailyGoalTracker;
