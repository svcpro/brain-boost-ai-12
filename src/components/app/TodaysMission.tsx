import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Clock, TrendingUp, Zap, ArrowRight, Sparkles, CheckCircle2, Brain } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import MicroMissionFlow from "./MicroMissionFlow";
import { safeStr, safeNum } from "@/lib/safeRender";

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

const BASE_CACHE_KEY = "acry-home-mission-v2";

const missionTypeConfig: Record<string, { icon: typeof Target; label: string }> = {
  recall: { icon: Brain, label: "Recall" },
  review: { icon: Target, label: "Review" },
  practice: { icon: Zap, label: "Practice" },
  strengthen: { icon: TrendingUp, label: "Strengthen" },
};

export default function TodaysMission({ hasTopics, onStartMission }: TodaysMissionProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();

  const getToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  // Per-user cache key so each user gets their own personalized mission
  const cacheKey = user ? `${BASE_CACHE_KEY}-${user.id}` : BASE_CACHE_KEY;
  const completedKey = user ? `acry-mission-completed-date-${user.id}` : "acry-mission-completed-date";

  const [mission, setMission] = useState<DailyMission | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showConfetti, setShowConfetti] = useState(false);
  const [showMissionFlow, setShowMissionFlow] = useState(false);
  const [error, setError] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const today = getToday();

  // Load cached mission as placeholder, but always re-fetch from API
  useEffect(() => {
    if (!user) return;
    try {
      const cached = getCache<DailyMission>(`${BASE_CACHE_KEY}-${user.id}`);
      if (cached && cached.generated_date === today && cached.title && cached.title !== "AI Mission") {
        setMission(cached);
      }
      // Also clear legacy cache keys so old data doesn't persist
      try { localStorage.removeItem(`acry-daily-mission-${user.id}`); } catch {}
    } catch {}
  }, [user, today]);

  // safeStr and safeNum imported from @/lib/safeRender

  const parseMissionResponse = (data: any): DailyMission | null => {
    if (!data) return null;

    // Handle case where mission is returned as a plain string
    if (typeof data.mission === "string" && typeof data.mission !== "object") {
      const text = data.mission;
      return {
        title: text.length > 60 ? text.slice(0, 57) + "…" : text,
        description: text,
        estimated_minutes: 5,
        brain_improvement_pct: 5,
        urgency: "medium",
        reasoning: "Personalized by your AI brain agent.",
        mission_type: text.toLowerCase().includes("solve") || text.toLowerCase().includes("problem") ? "practice" : "review",
        generated_date: today,
      };
    }

    // The AI may return the mission as a nested object in data.title, data.mission, or directly in data
    // Normalize: find the actual mission object
    let src = data;
    if (typeof data.title === "object" && data.title !== null) {
      src = data.title;
    } else if (typeof data.mission === "object" && data.mission !== null) {
      src = data.mission;
    }

    // Extract topic/action for building a human-readable title
    const topic = safeStr(src.topic_name || src.topic || data.topic_name || data.topic, "");
    const actionType = safeStr(src.action_type || src.mission_type || data.action_type || data.mission_type || data.type || src.type, "Review");
    
    // Build a readable title — prefer an explicit string title, otherwise compose from topic+action
    const capitalize = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    let title = "";
    if (typeof data.title === "string" && data.title.length > 0 && !data.title.startsWith("{") && data.title !== "AI Mission") {
      title = data.title;
    } else if (typeof src.title === "string" && src.title.length > 0 && !src.title.startsWith("{") && src.title !== "AI Mission") {
      title = src.title;
    } else if (topic && actionType) {
      title = `${capitalize(actionType)}: ${topic}`;
    } else if (topic) {
      title = `Review: ${topic}`;
    } else if (typeof src.description === "string" && src.description.length > 0) {
      title = src.description.length > 60 ? src.description.slice(0, 57) + "…" : src.description;
    } else {
      title = "Your Daily Mission";
    }

    // Build description — check description, goal, reason fields
    let description = "";
    const descCandidates = [data.description, src.description, src.goal, data.goal, src.reason, data.reason];
    for (const c of descCandidates) {
      if (typeof c === "string" && c.length > 0 && !c.startsWith("{")) {
        description = c;
        break;
      }
    }
    if (!description && topic) {
      description = `Focus on ${topic} with a ${actionType.toLowerCase()} session to strengthen your memory.`;
    }

    return {
      title: title.slice(0, 80),
      description,
      topic_name: topic || undefined,
      subject_name: safeStr(src.subject_name || src.subject || data.subject_name || data.subject) || undefined,
      estimated_minutes: safeNum(src.estimated_minutes || src.duration_minutes || src.duration || data.estimated_minutes || data.duration, 5),
      brain_improvement_pct: safeNum(src.brain_improvement_pct || data.brain_improvement_pct, 5),
      urgency: (["critical", "high", "medium"].includes(src.urgency || data.urgency) ? (src.urgency || data.urgency) : "medium") as DailyMission["urgency"],
      reasoning: safeStr(src.reasoning || src.rationale || src.reason || src.goal || data.reasoning || data.rationale || data.reason || data.goal, "Personalized by your AI brain agent."),
      mission_type: (() => {
        const raw = safeStr(src.mission_type || src.type || src.action_type || data.mission_type || data.type || data.action_type, "review").toLowerCase();
        if (raw.includes("recall") || raw.includes("remember")) return "recall";
        if (raw.includes("practice") || raw.includes("solve") || raw.includes("problem")) return "practice";
        if (raw.includes("strengthen") || raw.includes("deep")) return "strengthen";
        return "review";
      })() as DailyMission["mission_type"],
      generated_date: today,
    };
  };

  const generateMission = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    setError(false);
    try {
      // Use home-api/todays-mission so web app matches the external API response
      const { data, error: fnError } = await supabase.functions.invoke("home-api", {
        body: { route: "todays-mission" },
      });
      
      // home-api returns { mission: {...}, source: "..." }
      // Try parsing the home-api format first
      const apiMission = data?.mission;
      if (apiMission && apiMission.title) {
        const missionData: DailyMission = {
          title: String(apiMission.title || "Your Daily Mission").slice(0, 80),
          description: String(apiMission.description || ""),
          topic_name: apiMission.topic_name || undefined,
          subject_name: apiMission.subject_name || undefined,
          estimated_minutes: safeNum(apiMission.estimated_minutes, 10),
          brain_improvement_pct: safeNum(apiMission.brain_improvement_pct, 5),
          urgency: (["critical", "high", "medium"].includes(apiMission.priority) ? apiMission.priority : "medium") as DailyMission["urgency"],
          reasoning: String(apiMission.reasoning || data?.source || "Personalized by your AI brain agent."),
          mission_type: (() => {
            const raw = String(apiMission.type || "review").toLowerCase();
            if (raw.includes("recall") || raw.includes("remember")) return "recall";
            if (raw.includes("practice") || raw.includes("solve")) return "practice";
            if (raw.includes("strengthen") || raw.includes("deep")) return "strengthen";
            return "review";
          })() as DailyMission["mission_type"],
          generated_date: today,
        };
        setMission(missionData);
        setCache(cacheKey, missionData);
        setCompleted(false);
        return;
      }

      // Fallback: try parsing as legacy ai-brain-agent response
      if (fnError) throw fnError;
      const missionData = parseMissionResponse(data);
      if (missionData) {
        setMission(missionData);
        setCache(cacheKey, missionData);
        setCompleted(false);
      }
    } catch (e: any) {
      console.error("Mission generation failed:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, session, today, cacheKey]);

  // Auto-generate on mount if no mission for today
  useEffect(() => {
    if (!hasTopics || mission || loading || !session || fetchAttempted) return;
    setFetchAttempted(true);
    generateMission();
  }, [hasTopics, mission, loading, generateMission, session, fetchAttempted]);

  // Check completion status from localStorage
  useEffect(() => {
    const completedDate = localStorage.getItem(completedKey);
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
    localStorage.setItem(completedKey, today);

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

  // Error state with retry
  if (error && !mission && !loading) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
          Today's Mission
        </p>
        <div className="rounded-2xl border border-border bg-card p-5 text-center">
          <Target className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground mb-3">Couldn't load your mission</p>
          <button
            onClick={() => { setError(false); generateMission(); }}
            className="text-xs text-primary font-medium px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors"
          >
            Try Again
          </button>
        </div>
      </motion.section>
    );
  }

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
