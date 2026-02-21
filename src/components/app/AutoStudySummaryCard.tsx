import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Sparkles, Check, Clock, Brain, Zap, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyLogger } from "@/hooks/useStudyLogger";

interface DetectedActivity {
  subject: string;
  topic: string;
  minutes: number;
  source: string;
  confirmed: boolean;
}

const AutoStudySummaryCard = ({ onRefresh }: { onRefresh?: () => void }) => {
  const { user } = useAuth();
  const { logStudy } = useStudyLogger();
  const [activities, setActivities] = useState<DetectedActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [confirming, setConfirming] = useState(false);

  const detectActivities = useCallback(async () => {
    if (!user) return;
    setLoading(true);

    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Get today's existing logs to detect what's already tracked
      const { data: todayLogs } = await supabase
        .from("study_logs")
        .select("topic_id, duration_minutes, study_mode")
        .eq("user_id", user.id)
        .gte("created_at", todayStart.toISOString());

      const loggedTopicIds = new Set((todayLogs || []).map(l => l.topic_id).filter(Boolean));

      // Find topics that were recently updated (last_revision_date = today) but NOT logged
      const { data: recentTopics } = await supabase
        .from("topics")
        .select("id, name, subject_id, memory_strength, last_revision_date, subjects!inner(name)")
        .eq("user_id", user.id)
        .gte("last_revision_date", todayStart.toISOString())
        .is("deleted_at", null);

      // Find weak topics the user might want to log
      const { data: activeTopics } = await supabase
        .from("topics")
        .select("id, name, subject_id, memory_strength, subjects!inner(name)")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .lt("memory_strength", 40)
        .order("memory_strength", { ascending: true })
        .limit(3);

      const detected: DetectedActivity[] = [];

      // Topics revised today but not logged
      for (const topic of (recentTopics || [])) {
        if (!loggedTopicIds.has(topic.id)) {
          const subName = (topic as any).subjects?.name || "General";
          detected.push({
            subject: subName,
            topic: topic.name,
            minutes: 5,
            source: "revision_detected",
            confirmed: false,
          });
        }
      }

      // Suggest weak topics as "did you study these?"
      for (const topic of (activeTopics || [])) {
        if (!loggedTopicIds.has(topic.id) && !detected.find(d => d.topic === topic.name)) {
          const subName = (topic as any).subjects?.name || "General";
          detected.push({
            subject: subName,
            topic: topic.name,
            minutes: 10,
            source: "weak_topic_suggestion",
            confirmed: false,
          });
        }
      }

      // Calculate total auto-logged today
      const autoLoggedToday = (todayLogs || [])
        .filter(l => l.study_mode === "auto")
        .reduce((sum, l) => sum + (l.duration_minutes || 0), 0);

      if (autoLoggedToday > 0 && detected.length === 0) {
        // Already auto-tracked, nothing to confirm
        setActivities([]);
      } else {
        setActivities(detected.slice(0, 5)); // max 5 suggestions
      }
    } catch (err) {
      console.error("Auto-detect error:", err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    detectActivities();
  }, [detectActivities]);

  const handleConfirmAll = async () => {
    setConfirming(true);
    try {
      const toConfirm = activities.filter(a => !a.confirmed);
      for (const activity of toConfirm) {
        await logStudy({
          subjectName: activity.subject,
          topicName: activity.topic,
          durationMinutes: activity.minutes,
          confidenceLevel: "medium",
          studyMode: "auto" as any,
          notes: `Auto-detected: ${activity.source}`,
        });
      }
      setActivities(prev => prev.map(a => ({ ...a, confirmed: true })));
      onRefresh?.();
    } catch (err) {
      console.error("Confirm error:", err);
    } finally {
      setConfirming(false);
    }
  };

  const handleToggleActivity = (index: number) => {
    setActivities(prev => prev.map((a, i) => i === index ? { ...a, confirmed: !a.confirmed } : a));
  };

  const handleConfirmSelected = async () => {
    setConfirming(true);
    try {
      const toConfirm = activities.filter(a => a.confirmed);
      for (const activity of toConfirm) {
        await logStudy({
          subjectName: activity.subject,
          topicName: activity.topic,
          durationMinutes: activity.minutes,
          confidenceLevel: "medium",
          studyMode: "auto" as any,
          notes: `Auto-detected: ${activity.source}`,
        });
      }
      setActivities(prev => prev.filter(a => !a.confirmed));
      onRefresh?.();
    } catch (err) {
      console.error("Confirm error:", err);
    } finally {
      setConfirming(false);
    }
  };

  if (loading || activities.length === 0) return null;

  const unconfirmed = activities.filter(a => !a.confirmed);
  if (unconfirmed.length === 0) return null;

  const totalMinutes = unconfirmed.reduce((sum, a) => sum + a.minutes, 0);
  const selectedCount = activities.filter(a => a.confirmed).length;

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5 p-4"
    >
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="font-semibold text-foreground text-sm">Auto-Detected Study</h3>
            <p className="text-xs text-muted-foreground">
              {unconfirmed.length} activit{unconfirmed.length === 1 ? 'y' : 'ies'} · ~{totalMinutes} min
            </p>
          </div>
        </div>
        <button
          onClick={() => setExpanded(!expanded)}
          className="p-1.5 rounded-lg hover:bg-muted/50 text-muted-foreground"
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="space-y-2 mt-3 mb-3">
              {activities.map((activity, idx) => (
                <motion.button
                  key={idx}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => handleToggleActivity(idx)}
                  className={`w-full flex items-center gap-3 p-2.5 rounded-xl text-left transition-all ${
                    activity.confirmed
                      ? "bg-primary/10 border border-primary/30"
                      : "bg-muted/30 border border-transparent hover:border-border"
                  }`}
                >
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center flex-shrink-0 ${
                    activity.confirmed ? "bg-primary text-primary-foreground" : "border-2 border-muted-foreground/30"
                  }`}>
                    {activity.confirmed && <Check className="w-3 h-3" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{activity.topic}</p>
                    <p className="text-xs text-muted-foreground">{activity.subject}</p>
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    {activity.minutes}m
                  </div>
                  <div className="flex items-center gap-1">
                    {activity.source === "revision_detected" ? (
                      <Brain className="w-3.5 h-3.5 text-primary" />
                    ) : (
                      <Zap className="w-3.5 h-3.5 text-primary" />
                    )}
                  </div>
                </motion.button>
              ))}
            </div>

            <div className="flex gap-2">
              {selectedCount > 0 && (
                <motion.button
                  whileTap={{ scale: 0.95 }}
                  onClick={handleConfirmSelected}
                  disabled={confirming}
                  className="flex-1 py-2 px-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
                >
                  {confirming ? "Logging..." : `Confirm ${selectedCount} Selected`}
                </motion.button>
              )}
              <motion.button
                whileTap={{ scale: 0.95 }}
                onClick={handleConfirmAll}
                disabled={confirming}
                className={`py-2 px-3 rounded-xl text-sm font-semibold ${
                  selectedCount > 0
                    ? "bg-muted text-foreground"
                    : "bg-primary text-primary-foreground flex-1"
                }`}
              >
                {confirming ? "Logging..." : "✅ Confirm All"}
              </motion.button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!expanded && (
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={handleConfirmAll}
          disabled={confirming}
          className="w-full mt-2 py-2 rounded-xl bg-primary text-primary-foreground text-sm font-semibold"
        >
          {confirming ? "Logging..." : "✅ One-Tap Confirm All"}
        </motion.button>
      )}
    </motion.div>
  );
};

export default AutoStudySummaryCard;
