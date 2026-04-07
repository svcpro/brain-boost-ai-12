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
      const { data: apiData, error } = await supabase.functions.invoke("todays-gains");

      if (error || !apiData?.success) {
        console.error("[TodaysGains] API error:", error || apiData);
        setLoading(false);
        return;
      }

      const d = apiData.data;
      setData({
        stabilityGain: d.stability_gain,
        riskReduction: d.risk_reduction,
        rankChange: d.rank_change,
        focusScore: d.focus_score,
        focusStreak: d.focus_streak,
        studyMinutes: d.study_minutes,
        sessionsCount: d.sessions_count,
        weeklyData: d.weekly_data,
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

      {/* ─── 7-Day Momentum Graph (hidden) ─── */}

      {/* ─── Lock Progress Button (hidden) ─── */}
    </motion.section>
  );
};

export default TodaysGains;
