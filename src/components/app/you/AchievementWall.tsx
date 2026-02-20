import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Medal, Star, ChevronRight, Flame, Brain, Target, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useStudyStreak } from "@/hooks/useStudyStreak";

interface Achievement {
  id: string;
  icon: string;
  title: string;
  description: string;
  earned: boolean;
  date?: string;
}

const ACHIEVEMENT_DEFS = [
  { id: "first_study", icon: "📖", title: "First Steps", desc: "Complete your first study session", check: (stats: any) => stats.totalSessions > 0 },
  { id: "streak_3", icon: "🔥", title: "On Fire", desc: "3-day study streak", check: (stats: any) => stats.streak >= 3 },
  { id: "streak_7", icon: "⚡", title: "Unstoppable", desc: "7-day study streak", check: (stats: any) => stats.streak >= 7 },
  { id: "streak_30", icon: "👑", title: "Monthly Master", desc: "30-day study streak", check: (stats: any) => stats.streak >= 30 },
  { id: "topics_10", icon: "🧠", title: "Knowledge Builder", desc: "Add 10 topics", check: (stats: any) => stats.topicCount >= 10 },
  { id: "topics_50", icon: "📚", title: "Library Builder", desc: "Add 50 topics", check: (stats: any) => stats.topicCount >= 50 },
  { id: "strength_80", icon: "💪", title: "Strong Mind", desc: "Get any topic above 80%", check: (stats: any) => stats.maxStrength >= 80 },
  { id: "hours_10", icon: "⏰", title: "10 Hour Club", desc: "Study for 10+ hours total", check: (stats: any) => stats.totalMinutes >= 600 },
  { id: "hours_50", icon: "🏆", title: "50 Hour Legend", desc: "Study for 50+ hours total", check: (stats: any) => stats.totalMinutes >= 3000 },
  { id: "level_5", icon: "🌟", title: "Rising Star", desc: "Reach Brain Level 5", check: (stats: any) => stats.level >= 5 },
];

const AchievementWall = () => {
  const { user } = useAuth();
  const { streak: streakData } = useStudyStreak();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    Promise.all([
      supabase.from("study_logs").select("duration_minutes").eq("user_id", user.id),
      supabase.from("topics").select("id, memory_strength").eq("user_id", user.id).is("deleted_at", null),
    ]).then(([logsRes, topicsRes]) => {
      const logs = logsRes.data || [];
      const topics = topicsRes.data || [];
      const totalMinutes = logs.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const totalSessions = logs.length;
      const topicCount = topics.length;
      const maxStrength = topics.reduce((max, t) => Math.max(max, t.memory_strength || 0), 0);
      const streak = streakData?.currentStreak ?? 0;
      
      // Calculate level from XP
      const THRESHOLDS = [0, 100, 300, 600, 1000, 1500, 2200, 3000, 4000, 5500, 7500, 10000];
      let level = 1;
      for (let i = THRESHOLDS.length - 1; i >= 0; i--) {
        if (totalMinutes >= THRESHOLDS[i]) { level = i + 1; break; }
      }

      const stats = { totalSessions, totalMinutes, topicCount, maxStrength, streak, level };

      setAchievements(ACHIEVEMENT_DEFS.map(def => ({
        id: def.id,
        icon: def.icon,
        title: def.title,
        description: def.desc,
        earned: def.check(stats),
      })));
    });
  }, [user, streakData]);

  const earned = achievements.filter(a => a.earned);
  const locked = achievements.filter(a => !a.earned);
  const displayAchievements = expanded ? achievements : earned.slice(0, 6);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
      className="glass rounded-2xl p-5 neural-border space-y-4"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" />
          <h3 className="text-sm font-semibold text-foreground">Achievement Wall</h3>
        </div>
        <span className="text-[10px] font-semibold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
          {earned.length}/{achievements.length}
        </span>
      </div>

      {/* Achievement Grid */}
      <div className="grid grid-cols-3 gap-2">
        {displayAchievements.map((ach, i) => (
          <motion.div
            key={ach.id}
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.05 * i }}
            className={`flex flex-col items-center gap-1.5 py-3 px-2 rounded-xl border transition-all ${
              ach.earned
                ? "bg-primary/5 border-primary/20"
                : "bg-secondary/20 border-border/30 opacity-40"
            }`}
          >
            <span className={`text-xl ${!ach.earned ? "grayscale" : ""}`}>{ach.icon}</span>
            <span className="text-[9px] font-semibold text-foreground text-center leading-tight">{ach.title}</span>
            {!ach.earned && (
              <span className="text-[8px] text-muted-foreground text-center leading-tight">{ach.description}</span>
            )}
          </motion.div>
        ))}
      </div>

      {achievements.length > 6 && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full text-center text-[11px] text-primary font-medium hover:underline"
        >
          {expanded ? "Show less" : `View all ${achievements.length} achievements`}
        </button>
      )}
    </motion.div>
  );
};

export default AchievementWall;
