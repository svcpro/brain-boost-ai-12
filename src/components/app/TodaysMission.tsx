import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Clock, TrendingUp, Zap, ArrowRight, Sparkles, CheckCircle2, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import MicroMissionFlow from "./MicroMissionFlow";

interface DailyMission {
  title: string;
  description: string;
  topic_name?: string;
  subject_name?: string;
  estimated_minutes: number;
  brain_improvement_pct: number;
  urgency: "critical" | "high" | "medium";
  reasoning: string;
  mission_type: "recall" | "review" | "practice" | "strengthen";
  generated_date: string;
}

interface TodaysMissionProps {
  hasTopics: boolean;
  onStartMission: (subject?: string, topic?: string, minutes?: number) => void;
}

const CACHE_KEY = "acry-daily-mission";

const missionTypeConfig: Record<string, { icon: typeof Target; label: string }> = {
  recall: { icon: Brain, label: "Recall" },
  review: { icon: Target, label: "Review" },
  practice: { icon: Zap, label: "Practice" },
  strengthen: { icon: TrendingUp, label: "Strengthen" },
};

export default function TodaysMission({ hasTopics, onStartMission }: TodaysMissionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [mission, setMission] = useState<DailyMission | null>(() => {
    const cached = getCache<DailyMission>(CACHE_KEY);
    const now = new Date();
    const localToday = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    if (cached && cached.generated_date === localToday) return cached;
    return null;
  });
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMissionFlow, setShowMissionFlow] = useState(false);

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

  const generateMission = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "daily_mission" },
      });
      if (error) throw error;
      if (data?.title || data?.mission) {
        const missionData: DailyMission = {
          title: data.title || data.mission?.slice(0, 60) || "AI Mission",
          description: data.description || data.mission || "",
          topic_name: data.topic_name || data.topic || undefined,
          subject_name: data.subject_name || data.subject || undefined,
          estimated_minutes: data.estimated_minutes || data.duration || 5,
          brain_improvement_pct: data.brain_improvement_pct || 5,
          urgency: data.urgency || "medium",
          reasoning: data.reasoning || data.reason || "",
          mission_type: data.mission_type || data.type || "review",
          generated_date: today,
        };
        setMission(missionData);
        setCache(CACHE_KEY, missionData);
        setCompleted(false);
      }
    } catch (e: any) {
      console.error("Mission generation failed:", e);
      toast({ title: "Couldn't generate mission", description: "Using fallback mission.", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [user, today, toast]);

  // Auto-generate on mount if no mission for today
  useEffect(() => {
    if (!hasTopics || mission || loading) return;
    generateMission();
  }, [hasTopics, mission, loading, generateMission]);

  // Check completion status from localStorage
  useEffect(() => {
    const completedDate = localStorage.getItem("acry-mission-completed-date");
    if (completedDate === today) setCompleted(true);
  }, [today]);

  const handleStart = () => {
    triggerHaptic(30);
    setShowMissionFlow(true);
  };

  const handleComplete = async () => {
    triggerHaptic([30, 60, 30, 80]);
    setCompleted(true);
    setShowConfetti(true);
    localStorage.setItem("acry-mission-completed-date", today);

    try {
      const { default: confetti } = await import("canvas-confetti");
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["hsl(var(--primary))", "#FFD700", "#4ECDC4", "#FF6B6B"],
      });
    } catch {}

    toast({ title: "🎉 Mission Complete!", description: `+${mission?.brain_improvement_pct || 5}% brain stability boost` });
    setTimeout(() => setShowConfetti(false), 3000);
  };

  if (!hasTopics) return null;

  const urgencyStyles = {
    critical: { border: "border-destructive/30", badge: "bg-destructive/15 text-destructive", glow: "hsl(var(--destructive))" },
    high: { border: "border-warning/30", badge: "bg-warning/15 text-warning", glow: "hsl(var(--warning))" },
    medium: { border: "border-primary/20", badge: "bg-primary/15 text-primary", glow: "hsl(var(--primary))" },
  };

  const styles = urgencyStyles[mission?.urgency || "medium"];
  const MissionIcon = missionTypeConfig[mission?.mission_type || "review"]?.icon || Target;
  const missionLabel = missionTypeConfig[mission?.mission_type || "review"]?.label || "Study";

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
    >
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
        Today's Mission
      </p>

      {/* Loading skeleton */}
      {loading && !mission && (
        <div className="rounded-2xl border border-border bg-card p-5 space-y-3 animate-pulse">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-secondary" />
            <div className="flex-1 space-y-2">
              <div className="h-4 bg-secondary rounded w-3/4" />
              <div className="h-3 bg-secondary rounded w-1/2" />
            </div>
          </div>
          <div className="h-10 bg-secondary rounded-xl" />
        </div>
      )}

      {/* Mission card */}
      {mission && (
        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="completed"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="relative rounded-2xl border border-primary/30 overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--card)))" }}
            >
              <div className="p-5 text-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", stiffness: 200, delay: 0.1 }}
                >
                  <CheckCircle2 className="w-12 h-12 text-primary mx-auto mb-3" />
                </motion.div>
                <h3 className="text-sm font-bold text-foreground">Mission Complete! 🎉</h3>
                <p className="text-xs text-muted-foreground mt-1">
                  +{mission.brain_improvement_pct}% brain stability boost earned
                </p>
                <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-[10px] font-medium">
                  <TrendingUp className="w-3 h-3" />
                  Come back tomorrow for your next mission
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="active"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className={`relative rounded-2xl border ${styles.border} overflow-hidden`}
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.08), hsl(var(--card)))" }}
            >
              {/* Glow accent */}
              <div
                className="absolute top-0 right-0 w-28 h-28 rounded-full opacity-20 blur-3xl pointer-events-none"
                style={{ background: styles.glow }}
              />

              <div className="relative z-10 p-5">
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <motion.div
                    animate={{ rotate: [0, 5, -5, 0] }}
                    transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
                    className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center shrink-0"
                  >
                    <MissionIcon className="w-5 h-5 text-primary" />
                  </motion.div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground leading-tight">
                      {mission.title}
                    </h3>
                    <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                      {mission.description}
                    </p>
                  </div>
                </div>

                {/* Stats row */}
                <div className="flex items-center gap-3 mb-4">
                  <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-secondary/60 px-2 py-1 rounded-full">
                    <Clock className="w-3 h-3" />
                    {mission.estimated_minutes} min
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] text-primary bg-primary/10 px-2 py-1 rounded-full font-medium">
                    <TrendingUp className="w-3 h-3" />
                    +{mission.brain_improvement_pct}% brain
                  </span>
                  <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${styles.badge}`}>
                    {mission.urgency}
                  </span>
                </div>

                {/* AI reasoning */}
                <div className="flex items-start gap-1.5 mb-4 px-3 py-2 rounded-xl bg-secondary/40 border border-border/50">
                  <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                  <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                    {mission.reasoning}
                  </p>
                </div>

                {/* CTA */}
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleStart}
                  className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold flex items-center justify-center gap-2 hover:opacity-90 transition-all"
                  style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
                >
                  <Zap className="w-4 h-4" />
                  Start Mission
                  <ArrowRight className="w-4 h-4" />
                </motion.button>

                {/* Complete button (after starting) */}
                <button
                  onClick={handleComplete}
                  className="w-full mt-2 py-2 text-[11px] text-muted-foreground hover:text-primary transition-colors flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  Mark as complete
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}
      {/* Micro Mission Flow overlay */}
      <AnimatePresence>
        {showMissionFlow && mission && (
          <MicroMissionFlow
            missionTitle={mission.title}
            topicName={mission.topic_name}
            subjectName={mission.subject_name}
            estimatedMinutes={mission.estimated_minutes}
            brainImprovementPct={mission.brain_improvement_pct}
            onComplete={() => {
              handleComplete();
            }}
            onClose={() => setShowMissionFlow(false)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
