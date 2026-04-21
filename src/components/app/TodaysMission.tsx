import React, { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, Clock, TrendingUp, Zap, ArrowRight, Sparkles, CheckCircle2, Brain, Flame, Shield, Crosshair } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import AdvancedMissionWizard from "./AdvancedMissionWizard";
import { safeStr, safeNum } from "@/lib/safeRender";

interface DailyMission {
  id: string;
  title: string;
  description: string;
  topic_id?: string;
  topic_name?: string;
  subject_name?: string;
  estimated_minutes: number;
  brain_improvement_pct: number;
  urgency: "critical" | "high" | "medium" | "low";
  reasoning: string;
  mission_type: "recall" | "review" | "practice" | "strengthen" | "rescue" | "consistency" | "onboarding";
  source: string;
}

interface TodaysMissionProps {
  hasTopics: boolean;
  onStartMission: (subject?: string, topic?: string, minutes?: number) => void;
}

const missionTypeConfig: Record<string, { icon: typeof Target; label: string; gradient: string }> = {
  recall: { icon: Brain, label: "Recall", gradient: "from-violet-500/20 to-primary/10" },
  review: { icon: Target, label: "Review", gradient: "from-primary/20 to-cyan-500/10" },
  practice: { icon: Zap, label: "Practice", gradient: "from-amber-500/20 to-orange-500/10" },
  strengthen: { icon: TrendingUp, label: "Strengthen", gradient: "from-emerald-500/20 to-green-500/10" },
  rescue: { icon: Shield, label: "Rescue", gradient: "from-destructive/20 to-red-500/10" },
  consistency: { icon: Clock, label: "Consistency", gradient: "from-blue-500/20 to-primary/10" },
  onboarding: { icon: Crosshair, label: "Get Started", gradient: "from-primary/20 to-violet-500/10" },
};

export default function TodaysMission({ hasTopics, onStartMission }: TodaysMissionProps) {
  const { user, session } = useAuth();
  const { toast } = useToast();

  const getToday = () => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  };

  const completedKey = user ? `acry-mission-completed-date-${user.id}` : "acry-mission-completed-date";

  const [mission, setMission] = useState<DailyMission | null>(null);
  const [loading, setLoading] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [showMissionFlow, setShowMissionFlow] = useState(false);
  const [error, setError] = useState(false);
  const [fetchAttempted, setFetchAttempted] = useState(false);

  const today = getToday();

  useEffect(() => {
    if (!user) return;
    setMission(null);
    setError(false);
    setFetchAttempted(false);
  }, [user]);

  const normalizePriority = (value: unknown): DailyMission["urgency"] => {
    const raw = safeStr(value, "medium").toLowerCase();
    return ["critical", "high", "medium", "low"].includes(raw) ? (raw as DailyMission["urgency"]) : "medium";
  };

  const normalizeMissionType = (value: unknown): DailyMission["mission_type"] => {
    const raw = safeStr(value, "review").toLowerCase();
    if (raw.includes("rescue")) return "rescue";
    if (raw.includes("consistency")) return "consistency";
    if (raw.includes("onboarding")) return "onboarding";
    if (raw.includes("recall") || raw.includes("remember")) return "recall";
    if (raw.includes("practice") || raw.includes("solve") || raw.includes("problem")) return "practice";
    if (raw.includes("strengthen") || raw.includes("deep")) return "strengthen";
    return "review";
  };

  const normalizeMission = (apiMission: any, source: string): DailyMission => ({
    id: safeStr(apiMission?.id, `mission-${today}`),
    title: safeStr(apiMission?.title, "Your Daily Mission").slice(0, 80),
    description: safeStr(apiMission?.description, ""),
    topic_id: safeStr(apiMission?.topic_id) || undefined,
    topic_name: safeStr(apiMission?.topic_name) || undefined,
    subject_name: safeStr(apiMission?.subject_name) || undefined,
    estimated_minutes: safeNum(apiMission?.estimated_minutes, 10),
    brain_improvement_pct: safeNum(apiMission?.brain_improvement_pct, safeNum(apiMission?.reward_value, 5)),
    urgency: normalizePriority(apiMission?.priority ?? apiMission?.urgency),
    reasoning: safeStr(apiMission?.reasoning, "Personalized by your AI brain agent."),
    mission_type: normalizeMissionType(apiMission?.type ?? apiMission?.mission_type),
    source,
  });

  const fetchMission = useCallback(async () => {
    if (!user || !session) return;
    setLoading(true);
    setError(false);
    try {
      const { data, error: fnError } = await supabase.functions.invoke("home-api", {
        body: { route: "todays-mission" },
      });
      if (fnError) throw fnError;
      if (data?.mission) {
        setMission(normalizeMission(data.mission, safeStr(data.source, "api")));
        setCompleted(false);
        return;
      }
      const { data: dashData, error: dashErr } = await supabase.functions.invoke("home-api", {
        body: { route: "dashboard" },
      });
      if (!dashErr && dashData?.todays_mission?.mission) {
        setMission(normalizeMission(dashData.todays_mission.mission, safeStr(dashData.todays_mission.source, "dashboard")));
        setCompleted(false);
        return;
      }
      setError(true);
    } catch (e: any) {
      console.error("Mission fetch failed:", e);
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [user, session, today]);

  useEffect(() => {
    if (!hasTopics || loading || !session || fetchAttempted) return;
    setFetchAttempted(true);
    fetchMission();
  }, [hasTopics, loading, fetchMission, session, fetchAttempted]);

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
    localStorage.setItem(completedKey, today);
    try {
      const { default: confetti } = await import("canvas-confetti");
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ["hsl(var(--primary))", "#FFD700", "#4ECDC4", "#FF6B6B"] });
    } catch {}
    toast({ title: "🎉 Mission Complete!", description: `+${mission?.brain_improvement_pct || 5}% brain stability boost` });
  };

  if (!hasTopics) return null;

  // Error state
  if (error && !mission && !loading) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1 flex items-center gap-1.5">
          <Crosshair className="w-3 h-3" /> Today's Mission
        </p>
        <div className="rounded-2xl border border-border bg-card p-6 text-center">
          <div className="w-12 h-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3">
            <Target className="w-6 h-6 text-muted-foreground" />
          </div>
          <p className="text-xs text-muted-foreground mb-3">Couldn't load your mission</p>
          <button
            onClick={() => { setError(false); setFetchAttempted(false); fetchMission(); }}
            className="text-xs text-primary font-semibold px-5 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 transition-colors active:scale-95"
          >
            Try Again
          </button>
        </div>
      </motion.section>
    );
  }

  const urgencyConfig = {
    critical: { border: "border-destructive/30", bg: "bg-destructive/8", text: "text-destructive", dot: "bg-destructive" },
    high: { border: "border-warning/30", bg: "bg-warning/8", text: "text-warning", dot: "bg-warning" },
    medium: { border: "border-primary/25", bg: "bg-primary/8", text: "text-primary", dot: "bg-primary" },
    low: { border: "border-border", bg: "bg-secondary/50", text: "text-muted-foreground", dot: "bg-muted-foreground" },
  };

  const urg = urgencyConfig[mission?.urgency || "medium"];
  const typeConf = missionTypeConfig[mission?.mission_type || "review"] || missionTypeConfig.review;
  const MissionIcon = typeConf.icon;

  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2.5 px-1 flex items-center gap-1.5">
        <Crosshair className="w-3 h-3" /> Today's Mission
      </p>

      {/* Loading skeleton */}
      {loading && !mission && (
        <div className="rounded-2xl border border-border bg-card overflow-hidden">
          <div className="p-5 space-y-3 animate-pulse">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-secondary" />
              <div className="flex-1 space-y-2">
                <div className="h-4 bg-secondary rounded-lg w-3/4" />
                <div className="h-3 bg-secondary rounded-lg w-1/2" />
              </div>
            </div>
            <div className="h-12 bg-secondary rounded-xl" />
          </div>
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
              className="rounded-2xl border border-primary/20 overflow-hidden"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.06), hsl(var(--card)))" }}
            >
              <div className="p-6 text-center">
                <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", stiffness: 200, delay: 0.1 }}>
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle2 className="w-8 h-8 text-primary" />
                  </div>
                </motion.div>
                <h3 className="text-sm font-bold text-foreground">Mission Complete! 🎉</h3>
                <p className="text-xs text-muted-foreground mt-1 mb-3">
                  +{mission.brain_improvement_pct}% brain stability boost earned
                </p>
                <div className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary/8 text-primary text-[10px] font-medium">
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
              className={`rounded-2xl border ${urg.border} overflow-hidden relative`}
            >
              {/* Background gradient */}
              <div className={`absolute inset-0 bg-gradient-to-br ${typeConf.gradient} pointer-events-none`} />
              
              {/* Accent orb */}
              <div className="absolute -top-6 -right-6 w-32 h-32 rounded-full bg-primary/8 blur-3xl pointer-events-none" />

              <div className="relative z-10">
                {/* Top bar with urgency & type */}
                <div className="flex items-center justify-between px-4 pt-4 pb-1">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-1.5 h-1.5 rounded-full ${urg.dot} ${mission.urgency === "critical" ? "animate-pulse" : ""}`} />
                    <span className={`text-[10px] font-semibold uppercase tracking-wider ${urg.text}`}>
                      {mission.urgency} priority
                    </span>
                  </div>
                  <span className="text-[10px] font-medium text-muted-foreground px-2 py-0.5 rounded-full bg-secondary/60">
                    {typeConf.label}
                  </span>
                </div>

                {/* Main content */}
                <div className="px-4 pb-2 pt-2">
                  <div className="flex items-start gap-3 mb-3">
                    <motion.div
                      animate={{ rotate: [0, 5, -5, 0] }}
                      transition={{ duration: 3, repeat: Infinity, repeatDelay: 4 }}
                      className="w-12 h-12 rounded-2xl bg-primary/12 flex items-center justify-center shrink-0 border border-primary/10"
                    >
                      <MissionIcon className="w-6 h-6 text-primary" />
                    </motion.div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-[15px] font-bold text-foreground leading-tight mb-1">
                        {mission.title}
                      </h3>
                      {mission.description && (
                        <p className="text-[11px] text-muted-foreground line-clamp-2 leading-relaxed">
                          {mission.description}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Stats chips */}
                  <div className="flex items-center gap-2 mb-3">
                    <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border/50">
                      <Clock className="w-3 h-3" />
                      <span className="font-medium">{mission.estimated_minutes} min</span>
                    </div>
                    <div className="flex items-center gap-1 text-[10px] text-primary bg-primary/8 px-2.5 py-1.5 rounded-lg font-semibold border border-primary/10">
                      <Brain className="w-3 h-3" />
                      +{mission.brain_improvement_pct}%
                    </div>
                    {mission.topic_name && (
                      <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-background/60 backdrop-blur-sm px-2.5 py-1.5 rounded-lg border border-border/50 truncate max-w-[120px]">
                        <Target className="w-3 h-3 shrink-0" />
                        <span className="truncate font-medium">{mission.topic_name}</span>
                      </div>
                    )}
                  </div>

                  {/* AI reasoning */}
                  <div className="flex items-start gap-2 mb-4 px-3 py-2.5 rounded-xl bg-background/40 backdrop-blur-sm border border-border/30">
                    <Sparkles className="w-3 h-3 text-primary shrink-0 mt-0.5" />
                    <p className="text-[10px] text-muted-foreground italic leading-relaxed">
                      {mission.reasoning}
                    </p>
                  </div>
                </div>

                {/* CTA section */}
                <div className="px-4 pb-4 space-y-2">
                  <motion.button
                    whileTap={{ scale: 0.98 }}
                    onClick={handleStart}
                    className="w-full py-3 rounded-xl bg-primary text-primary-foreground text-sm font-semibold flex items-center justify-center gap-2 active:opacity-90 transition-opacity"
                  >
                    Start Mission
                    <ArrowRight className="w-4 h-4" />
                  </motion.button>

                  {/* Mark as complete — hidden per user request */}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      )}

      {/* Advanced Mission Wizard overlay */}
      <AnimatePresence>
        {showMissionFlow && mission && (
          <AdvancedMissionWizard
            missionId={mission.id}
            missionTitle={mission.title}
            missionType={mission.mission_type}
            topicName={mission.topic_name}
            subjectName={mission.subject_name}
            topicId={mission.topic_id}
            estimatedMinutes={mission.estimated_minutes}
            brainImprovementPct={mission.brain_improvement_pct}
            urgency={mission.urgency}
            reasoning={mission.reasoning}
            onComplete={() => { handleComplete(); }}
            onClose={() => setShowMissionFlow(false)}
          />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
