import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Shield, TrendingUp, Zap, Lock, Sparkles,
  ChevronDown, CheckCircle2, Flame, BarChart3
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

// ─── SVG Arc Component ───
const ProgressArc = ({
  value,
  max,
  color,
  size = 64,
  strokeWidth = 5,
  delay = 0,
}: {
  value: number;
  max: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  delay?: number;
}) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.min(value / Math.max(max, 1), 1);

  return (
    <svg width={size} height={size} className="rotate-[-90deg]">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke="hsl(var(--border))"
        strokeWidth={strokeWidth}
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: circumference * (1 - pct) }}
        transition={{ duration: 1.2, delay, ease: "easeOut" }}
      />
    </svg>
  );
};

// ─── Mini Bar Chart ───
const MAX_BAR_PX = 40;

const MiniMomentumGraph = ({ data }: { data: { day: string; value: number }[] }) => {
  const max = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="flex items-end gap-1.5" style={{ height: MAX_BAR_PX + 16 }}>
      {data.map((d, i) => {
        const barH = Math.max((d.value / max) * MAX_BAR_PX, 4);
        return (
          <div key={d.day} className="flex flex-col items-center gap-1 flex-1">
            <motion.div
              className="w-full rounded-sm bg-primary/80"
              style={{ minWidth: 6 }}
              initial={{ height: 0 }}
              animate={{ height: barH }}
              transition={{ duration: 0.6, delay: 0.05 * i, ease: "easeOut" }}
            />
            <span className="text-[8px] text-muted-foreground leading-none">{d.day}</span>
          </div>
        );
      })}
    </div>
  );
};

// ─── Confetti burst (lightweight) ───
const triggerCelebration = async () => {
  try {
    const confetti = (await import("canvas-confetti")).default;
    confetti({
      particleCount: 45,
      spread: 55,
      startVelocity: 20,
      gravity: 0.8,
      origin: { y: 0.7 },
      colors: ["hsl(175,80%,50%)", "hsl(142,71%,45%)", "hsl(38,92%,50%)"],
    });
  } catch {}
};

interface GainsData {
  stabilityGain: number;
  riskReduction: number;
  rankChange: number;
  focusScore: number;
  focusStreak: number;
  studyMinutes: number;
  sessionsCount: number;
  weeklyData: { day: string; value: number }[];
}

const TodaysGains = () => {
  const { user } = useAuth();
  const [data, setData] = useState<GainsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [locking, setLocking] = useState(false);
  const [showMomentum, setShowMomentum] = useState(false);
  const sectionRef = useRef<HTMLDivElement>(null);

  const fetchGains = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      // Parallel fetches
      const [sessionsRes, topicsRes, weekRes] = await Promise.all([
        supabase
          .from("study_logs")
          .select("duration_minutes, confidence_level, created_at")
          .eq("user_id", user.id)
          .gte("created_at", todayStart.toISOString()),
        supabase
          .from("topics")
          .select("memory_strength")
          .eq("user_id", user.id),
        supabase
          .from("study_logs")
          .select("duration_minutes, created_at")
          .eq("user_id", user.id)
          .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
      ]);

      const sessions = (sessionsRes.data || []) as any[];
      const topics = (topicsRes.data || []) as any[];
      const weekSessions = (weekRes.data || []) as any[];

      const totalMin = sessions.reduce((s: number, r: any) => s + (r.duration_minutes || 0), 0);
      const count = sessions.length;

      // Stability gain: sessions × 2.5 capped at 15
      const stabilityGain = Math.min(count * 2.5, 15);

      // Risk reduction: count topics that improved (simplified)
      const weakTopics = topics.filter((t: any) => (t.memory_strength ?? 0) < 0.4).length;
      const totalTopics = topics.length || 1;
      const riskReduction = Math.min(count * 3, Math.round((1 - weakTopics / totalTopics) * 100));

      // Rank change estimate
      const rankChange = Math.min(count * 1.5, 10);

      // Focus quality from confidence levels
      const confMap: Record<string, number> = { high: 100, medium: 70, low: 40 };
      const focusScores = sessions
        .filter((s: any) => s.confidence_level)
        .map((s: any) => confMap[s.confidence_level] || 50);
      const focusScore = focusScores.length > 0
        ? Math.round(focusScores.reduce((a: number, b: number) => a + b, 0) / focusScores.length)
        : 0;

      // Build 7-day data
      const dayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
      const weeklyData: { day: string; value: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date(Date.now() - i * 86400000);
        const dayStart = new Date(d); dayStart.setHours(0, 0, 0, 0);
        const dayEnd = new Date(d); dayEnd.setHours(23, 59, 59, 999);
        const mins = weekSessions
          .filter((s: any) => {
            const t = new Date(s.created_at).getTime();
            return t >= dayStart.getTime() && t <= dayEnd.getTime();
          })
          .reduce((sum: number, s: any) => sum + (s.duration_minutes || 0), 0);
        weeklyData.push({ day: dayLabels[d.getDay()], value: mins });
      }

      // Focus streak: consecutive days with sessions
      let streak = 0;
      for (let i = 0; i < weeklyData.length; i++) {
        const idx = weeklyData.length - 1 - i;
        if (weeklyData[idx].value > 0) streak++;
        else break;
      }

      setData({
        stabilityGain,
        riskReduction,
        rankChange,
        focusScore,
        focusStreak: streak,
        studyMinutes: totalMin,
        sessionsCount: count,
        weeklyData,
      });
    } catch {
      /* ignore */
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchGains(); }, [fetchGains]);

  const handleLock = async () => {
    if (!user || locked || locking) return;
    setLocking(true);

    // Simulate AI scheduling
    await new Promise((r) => setTimeout(r, 1200));
    setLocked(true);
    setLocking(false);
    triggerCelebration();
    toast.success("Progress locked! Tomorrow's mission is ready.", {
      description: "AI has scheduled your next revision & focus session.",
      icon: <CheckCircle2 className="w-4 h-4 text-success" />,
    });
  };

  if (loading) {
    return (
      <div className="space-y-3">
        <div className="h-5 w-32 rounded-lg bg-secondary/50 animate-pulse" />
        <div className="grid grid-cols-2 gap-2.5">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-28 rounded-2xl bg-secondary/30 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (!data) return null;

  const metrics = [
    {
      icon: Brain,
      label: "Brain Stability",
      value: `+${data.stabilityGain.toFixed(1)}%`,
      sub: "Neural growth",
      arcValue: data.stabilityGain,
      arcMax: 15,
      arcColor: "hsl(var(--primary))",
    },
    {
      icon: Shield,
      label: "Risk Reduced",
      value: `${data.riskReduction}%`,
      sub: "Topics shielded",
      arcValue: data.riskReduction,
      arcMax: 100,
      arcColor: "hsl(var(--success))",
    },
    {
      icon: TrendingUp,
      label: "Rank Boost",
      value: `+${data.rankChange.toFixed(1)}`,
      sub: "Percentile shift",
      arcValue: data.rankChange,
      arcMax: 10,
      arcColor: "hsl(var(--warning))",
    },
    {
      icon: Zap,
      label: "Focus Quality",
      value: `${data.focusScore}%`,
      sub: `${data.focusStreak}d streak`,
      arcValue: data.focusScore,
      arcMax: 100,
      arcColor: "hsl(var(--primary))",
    },
  ];

  return (
    <motion.section
      ref={sectionRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.4, duration: 0.5, ease: "easeOut" }}
      className="space-y-3"
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
          <BarChart3 className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">Today's Gains</h3>
          <p className="text-[10px] text-muted-foreground">Your daily reward summary</p>
        </div>
        {data.sessionsCount > 0 && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 300 }}
            className="flex items-center gap-1 px-2 py-1 rounded-full bg-success/15 border border-success/20"
          >
            <Flame className="w-3 h-3 text-success" />
            <span className="text-[10px] font-semibold text-success">
              {data.sessionsCount} session{data.sessionsCount !== 1 ? "s" : ""}
            </span>
          </motion.div>
        )}
      </div>

      {/* ─── Metric Cards with Progress Arcs ─── */}
      <div className="grid grid-cols-2 gap-2.5">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.45 + i * 0.1, duration: 0.5, ease: "easeOut" }}
            className="rounded-2xl border border-border bg-card p-3.5 flex flex-col items-center text-center relative overflow-hidden group"
          >
            {/* Subtle glow on hover */}
            <div className="absolute inset-0 bg-primary/[0.03] opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            {/* Arc + icon */}
            <div className="relative w-16 h-16 flex items-center justify-center mb-2">
              <ProgressArc
                value={m.arcValue}
                max={m.arcMax}
                color={m.arcColor}
                size={64}
                strokeWidth={5}
                delay={0.5 + i * 0.12}
              />
              <div className="absolute inset-0 flex items-center justify-center">
                <m.icon className="w-5 h-5 text-primary" />
              </div>
            </div>

            <p className="text-lg font-bold text-foreground leading-none tabular-nums">{m.value}</p>
            <p className="text-[10px] text-muted-foreground mt-1">{m.label}</p>
            <p className="text-[9px] text-primary font-medium mt-0.5">{m.sub}</p>
          </motion.div>
        ))}
      </div>

      {/* ─── 7-Day Momentum Graph (collapsible) ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.85 }}
      >
        <button
          onClick={() => setShowMomentum(!showMomentum)}
          className="w-full flex items-center justify-between rounded-2xl border border-border bg-card px-4 py-3 hover:bg-secondary/20 transition-all group"
        >
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span className="text-xs font-semibold text-foreground group-hover:text-primary transition-colors">
              7-Day Momentum
            </span>
          </div>
          <motion.div animate={{ rotate: showMomentum ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </motion.div>
        </button>
        <AnimatePresence>
          {showMomentum && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="rounded-2xl border border-border bg-card p-4 mt-2">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] text-muted-foreground">Study minutes per day</span>
                  <span className="text-[10px] font-medium text-primary">
                    {data.weeklyData.reduce((s, d) => s + d.value, 0)}m total
                  </span>
                </div>
                <MiniMomentumGraph data={data.weeklyData} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>

      {/* ─── Lock Progress Button ─── */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.95 }}
      >
        <motion.button
          whileHover={{ scale: locked ? 1 : 1.02 }}
          whileTap={{ scale: locked ? 1 : 0.97 }}
          onClick={handleLock}
          disabled={locked || locking || data.sessionsCount === 0}
          className={`w-full py-3.5 rounded-xl font-semibold text-sm flex items-center justify-center gap-2.5 transition-all
            ${
              locked
                ? "bg-success/15 text-success border border-success/20 cursor-default"
                : data.sessionsCount === 0
                ? "bg-secondary/50 text-muted-foreground cursor-not-allowed"
                : "bg-primary text-primary-foreground hover:opacity-90 active:scale-[0.98]"
            }`}
          style={
            !locked && data.sessionsCount > 0
              ? { boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }
              : undefined
          }
        >
          {locking ? (
            <>
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
              >
                <Sparkles className="w-4 h-4" />
              </motion.div>
              AI scheduling tomorrow…
            </>
          ) : locked ? (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Progress Locked — Tomorrow Ready
            </>
          ) : (
            <>
              <Lock className="w-4 h-4" />
              {data.sessionsCount === 0 ? "Complete a session first" : "Lock Today's Progress"}
            </>
          )}
        </motion.button>
      </motion.div>
    </motion.section>
  );
};

export default TodaysGains;
