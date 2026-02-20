import { useState, useEffect, useMemo, useCallback } from "react";
import { motion } from "framer-motion";
import { Brain, Flame, Activity, Target, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyStreak } from "@/hooks/useStudyStreak";
import { subDays, startOfDay, format } from "date-fns";

const BRAIN_LEVELS = [
  { name: "Beginner", min: 0, icon: "🌱" },
  { name: "Learner", min: 100, icon: "📖" },
  { name: "Explorer", min: 300, icon: "🧭" },
  { name: "Thinker", min: 600, icon: "💡" },
  { name: "Scholar", min: 1000, icon: "🎓" },
  { name: "Master", min: 1500, icon: "🏆" },
  { name: "Genius", min: 2200, icon: "🧠" },
  { name: "Legend", min: 3000, icon: "⚡" },
  { name: "Titan", min: 4000, icon: "👑" },
  { name: "Immortal", min: 5500, icon: "🌟" },
];

interface PersonalGrowthSnapshotProps {
  totalXp: number;
  currentLevel: number;
  nextThreshold: number;
  currentThreshold: number;
}

const PersonalGrowthSnapshot = ({ totalXp, currentLevel, nextThreshold, currentThreshold }: PersonalGrowthSnapshotProps) => {
  const { user } = useAuth();
  const { streak: streakData } = useStudyStreak();
  const [consistencyScore, setConsistencyScore] = useState(0);
  const [examReadiness, setExamReadiness] = useState(0);
  const [daysToExam, setDaysToExam] = useState<number | null>(null);

  const levelInfo = BRAIN_LEVELS[Math.min(currentLevel - 1, BRAIN_LEVELS.length - 1)];
  const xpInLevel = totalXp - currentThreshold;
  const xpNeeded = nextThreshold - currentThreshold;
  const pct = Math.min(100, Math.round((xpInLevel / xpNeeded) * 100));

  // Calculate consistency score (7-day)
  useEffect(() => {
    if (!user) return;
    const today = startOfDay(new Date());
    const since = subDays(today, 6);
    supabase.from("study_logs").select("created_at, duration_minutes").eq("user_id", user.id).gte("created_at", since.toISOString()).then(({ data: logs }) => {
      if (!logs?.length) { setConsistencyScore(0); return; }
      const dayBuckets: Record<string, number> = {};
      for (let i = 0; i < 7; i++) dayBuckets[format(subDays(today, 6 - i), "yyyy-MM-dd")] = 0;
      for (const log of logs) {
        const key = format(new Date(log.created_at), "yyyy-MM-dd");
        if (key in dayBuckets) dayBuckets[key] += log.duration_minutes || 0;
      }
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
    });
  }, [user]);

  // Calculate exam readiness
  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("topics").select("memory_strength").eq("user_id", user.id).is("deleted_at", null),
      (supabase as any).from("exam_countdown_config").select("exam_date").eq("user_id", user.id).maybeSingle(),
    ]).then(([topicsRes, examRes]) => {
      const topics = topicsRes.data || [];
      if (topics.length > 0) {
        const avgStrength = topics.reduce((sum: number, t: any) => sum + (t.memory_strength || 0), 0) / topics.length;
        setExamReadiness(Math.round(avgStrength));
      }
      if (examRes.data?.exam_date) {
        const days = Math.ceil((new Date(examRes.data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        setDaysToExam(days > 0 ? days : null);
      }
    });
  }, [user]);

  const stats = [
    {
      icon: Brain,
      label: "Brain Level",
      value: `Lv ${currentLevel}`,
      sub: levelInfo?.name || "",
      emoji: levelInfo?.icon || "🧠",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: Activity,
      label: "Consistency",
      value: `${consistencyScore}%`,
      sub: consistencyScore >= 85 ? "Excellent" : consistencyScore >= 65 ? "Good" : consistencyScore >= 40 ? "Fair" : "Build it up",
      emoji: consistencyScore >= 65 ? "📈" : "📊",
      color: consistencyScore >= 65 ? "text-success" : "text-warning",
      bgColor: consistencyScore >= 65 ? "bg-success/10" : "bg-warning/10",
    },
    {
      icon: Flame,
      label: "Streak",
      value: `${streakData?.currentStreak ?? 0}`,
      sub: "days",
      emoji: "🔥",
      color: "text-warning",
      bgColor: "bg-warning/10",
    },
    {
      icon: Target,
      label: "Exam Ready",
      value: `${examReadiness}%`,
      sub: daysToExam ? `${daysToExam}d left` : "Set exam",
      emoji: examReadiness >= 70 ? "✅" : "🎯",
      color: examReadiness >= 70 ? "text-success" : "text-accent",
      bgColor: examReadiness >= 70 ? "bg-success/10" : "bg-accent/10",
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-4"
    >
      {/* Brain Level Progress */}
      <div className="glass rounded-2xl p-5 neural-border">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-2xl">
            {levelInfo?.icon}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground">Level {currentLevel}</h3>
              <span className="text-xs text-primary font-semibold">{levelInfo?.name}</span>
            </div>
            <p className="text-[10px] text-muted-foreground">{xpInLevel} / {xpNeeded} XP to next level</p>
          </div>
          <Sparkles className="w-5 h-5 text-primary/50" />
        </div>
        <div className="h-2 rounded-full bg-secondary overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary via-accent to-success"
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 1.2, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 + i * 0.08 }}
            className="glass rounded-xl p-4 neural-border"
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`w-7 h-7 rounded-lg ${stat.bgColor} flex items-center justify-center`}>
                <stat.icon className={`w-3.5 h-3.5 ${stat.color}`} />
              </div>
              <span className="text-[10px] font-medium text-muted-foreground">{stat.label}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className={`text-xl font-bold ${stat.color}`}>{stat.value}</span>
              <span className="text-[10px] text-muted-foreground">{stat.sub}</span>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default PersonalGrowthSnapshot;
