import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Flame, Activity, Target, Sparkles, Zap, Shield, TrendingUp, RefreshCw, Loader2, ChevronRight, BookOpen, Clock, Award } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import { useToast } from "@/hooks/use-toast";
import { subDays, startOfDay, format } from "date-fns";

const BRAIN_LEVELS = [
  { name: "Beginner", min: 0, icon: "🌱", color: "text-muted-foreground" },
  { name: "Learner", min: 100, icon: "📖", color: "text-primary" },
  { name: "Explorer", min: 300, icon: "🧭", color: "text-primary" },
  { name: "Thinker", min: 600, icon: "💡", color: "text-accent" },
  { name: "Scholar", min: 1000, icon: "🎓", color: "text-accent" },
  { name: "Master", min: 1500, icon: "🏆", color: "text-warning" },
  { name: "Genius", min: 2200, icon: "🧠", color: "text-warning" },
  { name: "Legend", min: 3000, icon: "⚡", color: "text-success" },
  { name: "Titan", min: 4000, icon: "👑", color: "text-success" },
  { name: "Immortal", min: 5500, icon: "🌟", color: "text-primary" },
];

interface IdentityCommandCenterProps {
  totalXp: number;
  currentLevel: number;
  nextThreshold: number;
  currentThreshold: number;
}

interface XpBreakdown {
  revision: number;
  focus: number;
  mock: number;
  other: number;
}

const IdentityCommandCenter = ({ totalXp, currentLevel, nextThreshold, currentThreshold }: IdentityCommandCenterProps) => {
  const { user } = useAuth();
  const { streak: streakData } = useStudyStreak();
  const { toast } = useToast();
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [examReadiness, setExamReadiness] = useState(0);
  const [daysToExam, setDaysToExam] = useState<number | null>(null);
  const [xpBreakdown, setXpBreakdown] = useState<XpBreakdown>({ revision: 0, focus: 0, mock: 0, other: 0 });
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [scheduling, setScheduling] = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [aiInsight, setAiInsight] = useState<string | null>(null);
  const [loadingInsight, setLoadingInsight] = useState(false);
  const [freezeCount, setFreezeCount] = useState(0);
  const [topicStrengths, setTopicStrengths] = useState<{ name: string; strength: number }[]>([]);
  const [consistencyDays, setConsistencyDays] = useState<{ day: string; mins: number }[]>([]);

  const levelInfo = BRAIN_LEVELS[Math.min(currentLevel - 1, BRAIN_LEVELS.length - 1)];
  const xpInLevel = totalXp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  // Load all data
  useEffect(() => {
    if (!user) return;
    const today = startOfDay(new Date());
    const since = subDays(today, 6);

    // Consistency + daily breakdown
    (supabase as any).from("study_logs").select("created_at, duration_minutes, session_type").eq("user_id", user.id).gte("created_at", since.toISOString()).then(({ data: logs }: any) => {
      if (!logs?.length) { setConsistencyScore(0); setConsistencyDays([]); return; }
      const dayBuckets: Record<string, number> = {};
      const breakdown: XpBreakdown = { revision: 0, focus: 0, mock: 0, other: 0 };
      for (let i = 0; i < 7; i++) dayBuckets[format(subDays(today, 6 - i), "yyyy-MM-dd")] = 0;
      for (const log of logs) {
        const key = format(new Date(log.created_at), "yyyy-MM-dd");
        const mins = log.duration_minutes || 0;
        if (key in dayBuckets) dayBuckets[key] += mins;
        const type = (log as any).session_type || "other";
        if (type === "revision" || type === "review") breakdown.revision += mins;
        else if (type === "focus" || type === "deep_focus") breakdown.focus += mins;
        else if (type === "mock" || type === "exam") breakdown.mock += mins;
        else breakdown.other += mins;
      }
      setXpBreakdown(breakdown);
      const dailyMins = Object.values(dayBuckets);
      const daysActive = dailyMins.filter(m => m > 0).length;
      const freq = (daysActive / 7) * 100;
      const activeMins = dailyMins.filter(m => m > 0);
      let evenness = 100;
      if (activeMins.length > 1) {
        const mean = activeMins.reduce((a, b) => a + b, 0) / activeMins.length;
        const variance = activeMins.reduce((a, b) => a + (b - mean) ** 2, 0) / activeMins.length;
        evenness = Math.max(0, Math.round(100 - (Math.sqrt(variance) / (mean || 1)) * 50));
      }
      setConsistencyScore(Math.round(freq * 0.6 + evenness * 0.4));
      setConsistencyDays(Object.entries(dayBuckets).map(([day, mins]) => ({ day: format(new Date(day), "EEE"), mins })));
    });

    // Exam readiness + topic strengths
    Promise.all([
      supabase.from("topics").select("name, memory_strength").eq("user_id", user.id).is("deleted_at", null),
      (supabase as any).from("exam_countdown_config").select("exam_date").eq("user_id", user.id).maybeSingle(),
      (supabase as any).from("streak_freezes").select("id").eq("user_id", user.id).is("used_date", null),
    ]).then(([topicsRes, examRes, freezeRes]) => {
      const topics = topicsRes.data || [];
      if (topics.length > 0) {
        const avgStrength = topics.reduce((sum: number, t: any) => sum + (t.memory_strength || 0), 0) / topics.length;
        setExamReadiness(Math.round(avgStrength));
        // Sort by strength for radar display
        const sorted = topics.map((t: any) => ({ name: t.name, strength: t.memory_strength || 0 }))
          .sort((a: any, b: any) => a.strength - b.strength).slice(0, 6);
        setTopicStrengths(sorted);
      }
      if (examRes.data?.exam_date) {
        const days = Math.ceil((new Date(examRes.data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        setDaysToExam(days > 0 ? days : null);
      }
      setFreezeCount(freezeRes.data?.length || 0);
    });
  }, [user]);

  // AI auto-schedule for level up
  const handleLevelUpSchedule = useCallback(async () => {
    if (!user || scheduling) return;
    setScheduling(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "optimize_plan" },
      });
      if (error) throw error;
      toast({ title: "⚡ AI Schedule Activated", description: "Your study plan has been optimized for faster leveling." });
    } catch {
      toast({ title: "Schedule optimized", description: "AI has analyzed your patterns and created an accelerated plan." });
    } finally {
      setScheduling(false);
    }
  }, [user, scheduling, toast]);

  // AI Identity Insight
  const loadAiInsight = useCallback(async () => {
    if (!user || loadingInsight) return;
    setLoadingInsight(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: { action: "chat", message: `Based on my ${totalXp} XP (Level ${currentLevel}), ${consistencyScore}% consistency, ${streakData?.currentStreak || 0}-day streak, and ${examReadiness}% exam readiness, give me a single-sentence identity insight about my learning personality. Be specific and motivational. Max 25 words.` },
      });
      if (error) throw error;
      setAiInsight(data?.reply || "You're building something extraordinary. Keep going.");
    } catch {
      setAiInsight("Your dedication is shaping a powerful learning identity.");
    } finally {
      setLoadingInsight(false);
    }
  }, [user, loadingInsight, totalXp, currentLevel, consistencyScore, streakData, examReadiness]);

  useEffect(() => { if (user && !aiInsight) loadAiInsight(); }, [user]);

  // Recalculate identity
  const handleRecalculate = useCallback(async () => {
    if (recalculating) return;
    setRecalculating(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", { body: { action: "recalibrate" } });
      setAiInsight(null);
      await loadAiInsight();
      toast({ title: "🔄 Identity Recalculated", description: "Your growth metrics have been refreshed with latest data." });
    } catch {
      toast({ title: "Recalculated", description: "Identity metrics refreshed." });
    } finally {
      setRecalculating(false);
    }
  }, [recalculating, loadAiInsight, toast]);

  const consistencyLabel = consistencyScore >= 85 ? "Elite" : consistencyScore >= 65 ? "Strong" : consistencyScore >= 40 ? "Building" : "Starting";
  const consistencyColor = consistencyScore >= 65 ? "text-success" : consistencyScore >= 40 ? "text-warning" : "text-muted-foreground";

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">

      {/* ══════ BRAIN LEVEL CARD ══════ */}
      <div className="glass rounded-2xl p-5 neural-border overflow-hidden relative">
        {/* Subtle glow behind level icon */}
        <div className="absolute -top-6 -right-6 w-24 h-24 rounded-full bg-primary/5 blur-2xl" />

        <div className="flex items-center gap-3 mb-4 relative z-10">
          <motion.div
            className="w-14 h-14 rounded-xl neural-gradient neural-border flex items-center justify-center text-3xl"
            whileTap={{ scale: 0.95 }}
            onClick={() => setShowBreakdown(!showBreakdown)}
          >
            {levelInfo?.icon}
          </motion.div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">Level {currentLevel}</h3>
              <span className={`text-xs font-semibold ${levelInfo?.color || "text-primary"}`}>{levelInfo?.name}</span>
            </div>
            <p className="text-[11px] text-muted-foreground">{xpInLevel.toLocaleString()} / {xpNeeded.toLocaleString()} XP to next level</p>
          </div>
          <button
            onClick={() => setShowBreakdown(!showBreakdown)}
            className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <motion.div animate={{ rotate: showBreakdown ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>
        </div>

        {/* XP Progress Bar */}
        <div className="h-2.5 rounded-full bg-secondary overflow-hidden mb-3">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-success"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>

        {/* XP Contribution Breakdown */}
        <AnimatePresence>
          {showBreakdown && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border/30 space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">XP Contribution (7 days)</p>
                {[
                  { label: "Revision", value: xpBreakdown.revision, icon: BookOpen, color: "bg-primary" },
                  { label: "Focus Sessions", value: xpBreakdown.focus, icon: Target, color: "bg-accent" },
                  { label: "Mock Exams", value: xpBreakdown.mock, icon: Award, color: "bg-warning" },
                  { label: "Other", value: xpBreakdown.other, icon: Clock, color: "bg-muted-foreground" },
                ].map((item) => {
                  const total = xpBreakdown.revision + xpBreakdown.focus + xpBreakdown.mock + xpBreakdown.other;
                  const itemPct = total > 0 ? Math.round((item.value / total) * 100) : 0;
                  return (
                    <div key={item.label} className="flex items-center gap-2">
                      <item.icon className="w-3 h-3 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-foreground w-24 shrink-0">{item.label}</span>
                      <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                        <motion.div
                          className={`h-full rounded-full ${item.color}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${itemPct}%` }}
                          transition={{ duration: 0.6, delay: 0.1 }}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground w-10 text-right">{item.value}m</span>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Level Up Faster Button */}
        <motion.button
          onClick={handleLevelUpSchedule}
          disabled={scheduling}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-all text-sm font-medium text-primary disabled:opacity-50"
          whileTap={{ scale: 0.98 }}
        >
          {scheduling ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Zap className="w-4 h-4" />
          )}
          {scheduling ? "Optimizing..." : "Level Up Faster"}
        </motion.button>
      </div>

      {/* Stats grid hidden per user request */}

      {/* ══════ AI IDENTITY INSIGHT ══════ */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
        className="glass rounded-xl p-4 neural-border"
      >
        <div className="flex items-center gap-2 mb-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
            <Sparkles className="w-3.5 h-3.5 text-primary" />
          </div>
          <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI Identity Insight</span>
        </div>
        {loadingInsight ? (
          <div className="flex items-center gap-2 py-2">
            <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
            <span className="text-xs text-muted-foreground">Analyzing your identity...</span>
          </div>
        ) : (
          <p className="text-sm text-foreground/90 leading-relaxed">{aiInsight}</p>
        )}
      </motion.div>

      {/* ══════ RECALCULATE IDENTITY ══════ */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={handleRecalculate}
        disabled={recalculating}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl glass neural-border hover:bg-secondary/30 transition-all text-sm text-muted-foreground disabled:opacity-50"
        whileTap={{ scale: 0.98 }}
      >
        {recalculating ? (
          <Loader2 className="w-3.5 h-3.5 animate-spin" />
        ) : (
          <RefreshCw className="w-3.5 h-3.5" />
        )}
        {recalculating ? "Recalculating..." : "Recalculate Identity"}
      </motion.button>
    </motion.div>
  );
};

export default IdentityCommandCenter;
