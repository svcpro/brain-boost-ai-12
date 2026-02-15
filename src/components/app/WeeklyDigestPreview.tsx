import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, TrendingUp, TrendingDown, AlertTriangle, Sparkles, RefreshCw, Clock, ChevronDown, ChevronUp, Zap, Share2, ArrowLeftRight, Target, Flame, Quote, Copy, Check } from "lucide-react";
import html2canvas from "html2canvas";
import { toast } from "sonner";
import confetti from "canvas-confetti";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { getCache, setCache } from "@/lib/offlineCache";

interface WeekStats {
  totalMinutes: number;
  sessions: number;
  evoScore: number | null;
  efficiency: number | null;
  growth: number | null;
}

interface DigestData {
  twin: {
    brain_evolution_score: number | null;
    learning_efficiency_score: number | null;
    memory_growth_rate: number | null;
  } | null;
  evolutionChange: number | null;
  totalMinutes: number;
  sessions: number;
  atRisk: Array<{
    name: string;
    memory_strength: number;
    subject_name?: string;
  }>;
  recommendations: string;
  lastWeek: WeekStats | null;
  weeklyFocusGoal: number;
  streak: number;
}

const CACHE_KEY = "weekly-digest-preview";

const formatTime = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
};

const GoalProgressRing = ({ current, goal }: { current: number; goal: number }) => {
  const pct = Math.min(Math.round((current / goal) * 100), 100);
  const radius = 28;
  const stroke = 5;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (pct / 100) * circumference;
  const color = pct >= 100 ? "text-success" : pct >= 60 ? "text-primary" : "text-warning";

  return (
    <div className="rounded-lg border border-border/40 bg-secondary/20 p-3 flex items-center gap-4">
      <div className="relative shrink-0">
        <svg width="66" height="66" viewBox="0 0 66 66" className="-rotate-90">
          <circle cx="33" cy="33" r={radius} fill="none" strokeWidth={stroke} className="stroke-secondary" />
          <motion.circle
            cx="33" cy="33" r={radius} fill="none" strokeWidth={stroke}
            strokeLinecap="round"
            className={`${color} stroke-current`}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: "easeOut" }}
            strokeDasharray={circumference}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-sm font-bold ${color}`}>{pct}%</span>
        </div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <Target className={`w-3 h-3 ${color}`} />
          <span className="text-xs font-semibold text-foreground">Weekly Focus Goal</span>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {formatTime(current)} / {formatTime(goal)}
        </p>
        {pct >= 100 ? (
          <p className="text-[10px] text-success font-medium mt-0.5">🎉 Goal reached!</p>
        ) : (
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {formatTime(goal - current)} remaining
          </p>
        )}
      </div>
    </div>
  );
};

const MILESTONES = [7, 14, 21, 30, 50, 100];
const MILESTONE_CACHE_KEY = "digest-streak-celebrated";

const STREAK_QUOTES: Record<string, string[]> = {
  zero: [
    "Every expert was once a beginner. Start today! 💪",
    "The best time to start is now. One session is all it takes.",
    "Your brain is ready — just show up for 5 minutes.",
  ],
  building: [
    "Small steps lead to big results. Keep going! 🌱",
    "You're building momentum — don't stop now.",
    "Consistency beats intensity. You're proving it.",
  ],
  week: [
    "A full week! Your brain is rewiring itself. 🔥",
    "7 days strong — habits are forming. Feel the difference?",
    "One week down — you're officially in the zone!",
  ],
  twoWeeks: [
    "Two weeks of focus! You're unstoppable. ⭐",
    "14 days — this isn't luck, it's discipline.",
    "Your future self is thanking you right now.",
  ],
  month: [
    "A whole month! You're in the top 1% of learners. 🏆",
    "30 days of dedication — mastery is within reach.",
    "Legendary consistency. This is what champions do.",
  ],
  epic: [
    "You're redefining what's possible. Absolute legend! 👑",
    "Most people dream about this level of commitment. You live it.",
    "Your dedication is extraordinary. Keep blazing the trail!",
  ],
};

const getStreakQuote = (streak: number): string => {
  const tier = streak === 0 ? "zero"
    : streak < 7 ? "building"
    : streak < 14 ? "week"
    : streak < 30 ? "twoWeeks"
    : streak < 50 ? "month"
    : "epic";
  const quotes = STREAK_QUOTES[tier];
  // Deterministic pick based on streak number
  return quotes[streak % quotes.length];
};

const StreakCard = ({ streak }: { streak: number }) => {
  const ref = useRef<HTMLDivElement>(null);
  const isMilestone = MILESTONES.includes(streak);
  const milestoneLabel = streak >= 30 ? "🏆 Legend!" : streak >= 14 ? "⭐ Amazing!" : streak >= 7 ? "🔥 On fire!" : null;

  useEffect(() => {
    if (!isMilestone || !ref.current) return;
    const lastCelebrated = getCache(MILESTONE_CACHE_KEY);
    if (lastCelebrated === streak) return;
    setCache(MILESTONE_CACHE_KEY, streak);

    const rect = ref.current.getBoundingClientRect();
    const x = (rect.left + rect.width / 2) / window.innerWidth;
    const y = (rect.top + rect.height / 2) / window.innerHeight;

    confetti({
      particleCount: streak >= 30 ? 120 : streak >= 14 ? 80 : 50,
      spread: streak >= 30 ? 90 : 70,
      origin: { x, y },
      colors: ["#f59e0b", "#ef4444", "#8b5cf6", "#10b981", "#3b82f6"],
      scalar: 0.8,
      gravity: 1.2,
      ticks: 150,
    });
  }, [streak, isMilestone]);

  return (
    <div
      ref={ref}
      className={`rounded-lg border p-3 flex flex-col items-center justify-center min-w-[80px] transition-colors ${
        isMilestone ? "border-warning/40 bg-warning/5" : "border-border/40 bg-secondary/20"
      }`}
    >
      <motion.div
        animate={isMilestone ? { scale: [1, 1.3, 1], rotate: [0, -10, 10, 0] } : {}}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        <Flame className={`w-5 h-5 mb-1 ${streak >= 7 ? "text-warning" : streak >= 3 ? "text-primary" : "text-muted-foreground"}`} />
      </motion.div>
      <motion.span
        className={`text-2xl font-bold ${streak >= 7 ? "text-warning" : streak >= 3 ? "text-primary" : "text-foreground"}`}
        animate={isMilestone ? { scale: [1, 1.15, 1] } : {}}
        transition={{ duration: 0.4, delay: 0.2 }}
      >
        {streak}
      </motion.span>
      <span className="text-[10px] text-muted-foreground font-medium">day streak</span>
      {milestoneLabel && (
        <motion.span
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[9px] text-warning font-semibold mt-0.5"
        >
          {milestoneLabel}
        </motion.span>
      )}
    </div>
  );
};

const QuoteBanner = ({ quote, streak }: { quote: string; streak: number }) => {
  const [copied, setCopied] = useState(false);
  const shareText = `"${quote}" — ${streak}-day study streak 🔥`;
  const canNativeShare = typeof navigator.share === "function";

  const handleCopy = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shareText);
      setCopied(true);
      toast.success("Quote copied to clipboard!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  }, [shareText]);

  const handleShare = useCallback(async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.share({ text: shareText });
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Failed to share");
    }
  }, [shareText]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
      className="rounded-lg border border-primary/15 bg-primary/5 px-3 py-2 flex items-start gap-2 group"
    >
      <Quote className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
      <p className="text-[11px] text-foreground/80 leading-relaxed italic flex-1">{quote}</p>
      <div className="flex items-center gap-1 shrink-0 mt-0.5">
        <button
          onClick={handleCopy}
          className="p-1 rounded-md hover:bg-primary/10 transition-colors"
          title="Copy quote"
        >
          <AnimatePresence mode="wait">
            {copied ? (
              <motion.div key="check" initial={{ scale: 0 }} animate={{ scale: 1 }} exit={{ scale: 0 }}>
                <Check className="w-3 h-3 text-success" />
              </motion.div>
            ) : (
              <motion.div key="copy" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <Copy className="w-3 h-3 text-muted-foreground" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>
        {canNativeShare && (
          <button
            onClick={handleShare}
            className="p-1 rounded-md hover:bg-primary/10 transition-colors"
            title="Share quote"
          >
            <Share2 className="w-3 h-3 text-muted-foreground" />
          </button>
        )}
      </div>
    </motion.div>
  );
};

const DeltaBadge = ({ current, previous, suffix = "" }: { current: number | null; previous: number | null; suffix?: string }) => {
  if (current == null || previous == null) return null;
  const diff = Math.round(current - previous);
  if (diff === 0) return <span className="text-[9px] text-muted-foreground ml-auto">—</span>;
  return (
    <span className={`text-[9px] font-semibold flex items-center gap-0.5 ml-auto ${diff > 0 ? "text-success" : "text-destructive"}`}>
      {diff > 0 ? <TrendingUp className="w-2 h-2" /> : <TrendingDown className="w-2 h-2" />}
      {diff > 0 ? "+" : ""}{diff}{suffix}
    </span>
  );
};

const MetricCard = ({
  icon, iconColor, label, value, subValue, compare, compareValue, compareSuffix,
}: {
  icon: React.ReactNode; iconColor: string; label: string; value: React.ReactNode; subValue?: React.ReactNode;
  compare?: boolean; compareValue?: { current: number | null; previous: number | null }; compareSuffix?: string;
}) => (
  <div className="rounded-lg bg-secondary/30 border border-border/40 p-3">
    <div className="flex items-center gap-1.5 mb-1">
      <span className={iconColor}>{icon}</span>
      <span className="text-[10px] text-muted-foreground">{label}</span>
      {compare && compareValue && <DeltaBadge current={compareValue.current} previous={compareValue.previous} suffix={compareSuffix} />}
    </div>
    <div className="flex items-baseline gap-1.5">
      {value}
      {subValue}
    </div>
  </div>
);

const WeeklyDigestPreview = () => {
  const { user } = useAuth();
  const [data, setData] = useState<DigestData | null>(() => getCache(CACHE_KEY));
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [comparing, setComparing] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleShare = useCallback(async () => {
    if (!cardRef.current || sharing) return;
    setSharing(true);
    try {
      const canvas = await html2canvas(cardRef.current, { backgroundColor: null, scale: 2, useCORS: true });
      const blob = await new Promise<Blob | null>(r => canvas.toBlob(r, "image/png"));
      if (!blob) throw new Error("Failed to generate image");
      if (navigator.share && navigator.canShare?.({ files: [new File([blob], "brain-digest.png", { type: "image/png" })] })) {
        await navigator.share({
          title: "My Weekly Brain Digest",
          text: `Brain Evolution: ${data?.twin?.brain_evolution_score != null ? Math.round(data.twin.brain_evolution_score) : "N/A"}/100`,
          files: [new File([blob], "brain-digest.png", { type: "image/png" })],
        });
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url; a.download = "brain-digest.png"; a.click();
        URL.revokeObjectURL(url);
        toast.success("Digest image downloaded!");
      }
    } catch (err: any) {
      if (err?.name !== "AbortError") toast.error("Failed to share digest");
    } finally { setSharing(false); }
  }, [data, sharing]);

  const loadDigest = useCallback(async () => {
    if (!user || loading) return;
    setLoading(true);
    try {
      const now = new Date();
      const weekAgo = new Date(now.getTime() - 7 * 86400000);
      const twoWeeksAgo = new Date(now.getTime() - 14 * 86400000);

      const thirtyDaysAgo = new Date(now.getTime() - 30 * 86400000);

      const [twinRes, reportsRes, topicsRes, logsThisWeekRes, logsLastWeekRes, profileRes, streakLogsRes] = await Promise.all([
        supabase.from("cognitive_twins")
          .select("brain_evolution_score, learning_efficiency_score, memory_growth_rate")
          .eq("user_id", user.id).maybeSingle(),
        supabase.from("brain_reports")
          .select("metrics, created_at")
          .eq("user_id", user.id).eq("report_type", "cognitive_snapshot")
          .gte("created_at", twoWeeksAgo.toISOString())
          .order("created_at", { ascending: true }),
        supabase.from("topics")
          .select("name, memory_strength, next_predicted_drop_date, subject_id")
          .eq("user_id", user.id).is("deleted_at", null)
          .order("memory_strength", { ascending: true }),
        supabase.from("study_logs")
          .select("duration_minutes")
          .eq("user_id", user.id)
          .gte("created_at", weekAgo.toISOString()),
        supabase.from("study_logs")
          .select("duration_minutes")
          .eq("user_id", user.id)
          .gte("created_at", twoWeeksAgo.toISOString())
          .lt("created_at", weekAgo.toISOString()),
        supabase.from("profiles")
          .select("display_name, exam_type, exam_date, daily_study_goal_minutes, weekly_focus_goal_minutes")
          .eq("id", user.id).maybeSingle(),
        supabase.from("study_logs")
          .select("created_at")
          .eq("user_id", user.id)
          .gte("created_at", thirtyDaysAgo.toISOString())
          .order("created_at", { ascending: false }),
      ]);

      const twin = twinRes.data;
      const reports = reportsRes.data || [];
      const topics = topicsRes.data || [];
      const logsThisWeek = logsThisWeekRes.data || [];
      const logsLastWeek = logsLastWeekRes.data || [];

      const totalMinutes = logsThisWeek.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const sessions = logsThisWeek.length;

      // Calculate streak from recent logs
      const streakDays = new Set((streakLogsRes.data || []).map(l => new Date(l.created_at).toDateString()));
      let streak = 0;
      const checkDate = new Date(now);
      // If no study today yet, start checking from yesterday
      if (!streakDays.has(checkDate.toDateString())) {
        checkDate.setDate(checkDate.getDate() - 1);
      }
      while (streakDays.has(checkDate.toDateString())) {
        streak++;
        checkDate.setDate(checkDate.getDate() - 1);
      }
      const lastWeekMinutes = logsLastWeek.reduce((s, l) => s + (l.duration_minutes || 0), 0);
      const lastWeekSessions = logsLastWeek.length;

      // Evolution change & last week snapshot from reports
      let evolutionChange: number | null = null;
      let lastWeekEvo: number | null = null;
      let lastWeekEfficiency: number | null = null;
      let lastWeekGrowth: number | null = null;

      if (reports.length >= 2) {
        const oldM = reports[0].metrics as Record<string, number> | null;
        const newM = reports[reports.length - 1].metrics as Record<string, number> | null;
        if (oldM?.brain_evolution_score != null && newM?.brain_evolution_score != null) {
          evolutionChange = Math.round(newM.brain_evolution_score - oldM.brain_evolution_score);
        }
        lastWeekEvo = oldM?.brain_evolution_score ?? null;
        lastWeekEfficiency = oldM?.learning_efficiency_score ?? null;
        lastWeekGrowth = oldM?.memory_growth_rate ?? null;
      }

      // At-risk topics
      const threeDaysOut = new Date(now.getTime() + 3 * 86400000);
      const atRiskRaw = topics.filter(t => {
        const str = Number(t.memory_strength);
        const drop = t.next_predicted_drop_date ? new Date(t.next_predicted_drop_date) : null;
        return str < 50 || (drop && drop <= threeDaysOut);
      }).slice(0, 6);

      const subjectIds = [...new Set(atRiskRaw.map(t => t.subject_id).filter(Boolean))];
      const { data: subjects } = subjectIds.length > 0
        ? await supabase.from("subjects").select("id, name").in("id", subjectIds)
        : { data: [] };
      const subjectMap: Record<string, string> = {};
      for (const s of subjects || []) subjectMap[s.id] = s.name;

      const atRisk = atRiskRaw.map(t => ({
        name: t.name,
        memory_strength: Number(t.memory_strength),
        subject_name: subjectMap[t.subject_id] || undefined,
      }));

      // AI recommendations
      const timeStr = formatTime(totalMinutes);
      let recommendations = "";
      try {
        const contextStr = `Student: ${profileRes.data?.display_name || "Student"}
Exam: ${profileRes.data?.exam_type || "Not set"}${profileRes.data?.exam_date ? `, ${Math.ceil((new Date(profileRes.data.exam_date).getTime() - now.getTime()) / 86400000)} days away` : ""}
Weekly study: ${timeStr} across ${sessions} sessions
Brain evolution: ${twin?.brain_evolution_score != null ? `${Math.round(twin.brain_evolution_score)}/100` : "N/A"}${evolutionChange != null ? ` (${evolutionChange >= 0 ? "+" : ""}${evolutionChange})` : ""}
Efficiency: ${twin?.learning_efficiency_score != null ? `${Math.round(twin.learning_efficiency_score)}%` : "N/A"}
At-risk topics: ${atRisk.length > 0 ? atRisk.slice(0, 4).map(t => `${t.name} (${Math.round(t.memory_strength)}%)`).join(", ") : "None"}`;

        const aiResp = await supabase.functions.invoke("ai-brain-agent", {
          body: {
            messages: [
              { role: "system", content: "Generate 3 specific, actionable study recommendations for this student's upcoming week. Each should be 1 sentence. Number them 1-3. Be specific about topic names and time durations. No greetings." },
              { role: "user", content: contextStr },
            ],
          },
        });
        if (aiResp.data?.reply) recommendations = aiResp.data.reply;
      } catch { /* fallback */ }

      if (!recommendations) {
        recommendations = atRisk.length > 0
          ? `1. Priority review: ${atRisk[0].name} (${Math.round(atRisk[0].memory_strength)}% strength) — 20 min session\n2. Consolidate your strongest topics to maintain momentum\n3. Aim for ${profileRes.data?.daily_study_goal_minutes || 60} min daily to stay on track`
          : "1. Keep reviewing your existing topics to maintain high retention\n2. Consider adding new study material to expand coverage\n3. Use Focus Mode for deeper learning sessions";
      }

      const result: DigestData = {
        twin: twin ? {
          brain_evolution_score: twin.brain_evolution_score,
          learning_efficiency_score: twin.learning_efficiency_score,
          memory_growth_rate: twin.memory_growth_rate,
        } : null,
        evolutionChange,
        totalMinutes,
        sessions,
        atRisk,
        recommendations,
        weeklyFocusGoal: profileRes.data?.weekly_focus_goal_minutes || 420,
        streak,
        lastWeek: {
          totalMinutes: lastWeekMinutes,
          sessions: lastWeekSessions,
          evoScore: lastWeekEvo,
          efficiency: lastWeekEfficiency,
          growth: lastWeekGrowth,
        },
      };

      setData(result);
      setCache(CACHE_KEY, result);
    } catch (err) {
      console.error("Weekly digest preview error:", err);
    } finally {
      setLoading(false);
    }
  }, [user, loading]);

  useEffect(() => {
    if (!data) loadDigest();
  }, [user]);

  if (!data && !loading) return null;

  const evoScore = data?.twin?.brain_evolution_score;
  const evoChange = data?.evolutionChange;
  const efficiency = data?.twin?.learning_efficiency_score;
  const growth = data?.twin?.memory_growth_rate;
  const lw = data?.lastWeek;
  const showCompare = comparing && lw;

  return (
    <motion.div
      ref={cardRef}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      {/* Header */}
      <div className="bg-gradient-to-r from-primary/15 via-primary/5 to-accent/10 px-4 py-3 flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
          <Brain className="w-4 h-4 text-primary" />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-bold text-foreground">Weekly Brain Digest</h3>
          <p className="text-[10px] text-muted-foreground">
            {comparing ? "This week vs last week" : "Live preview — same as your email report"}
          </p>
        </div>
        <button
          onClick={() => setComparing(!comparing)}
          disabled={!data}
          className={`p-1.5 rounded-lg transition-colors ${comparing ? "bg-primary/20 text-primary" : "hover:bg-secondary/80 text-muted-foreground hover:text-foreground"}`}
          title="Compare with last week"
        >
          <ArrowLeftRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={handleShare}
          disabled={sharing || !data}
          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <Share2 className={`w-3.5 h-3.5 ${sharing ? "animate-pulse" : ""}`} />
        </button>
        <button
          onClick={loadDigest}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-secondary/80 text-muted-foreground hover:text-foreground transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading && !data ? (
        <div className="p-6 text-center">
          <RefreshCw className="w-5 h-5 text-primary animate-spin mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Building your digest…</p>
        </div>
      ) : data ? (
        <div className="p-4 space-y-3">
          {/* Weekly Goal + Streak */}
          {!showCompare && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <div className="flex-1">
                  <GoalProgressRing current={data.totalMinutes} goal={data.weeklyFocusGoal} />
                </div>
                <StreakCard streak={data.streak} />
              </div>
              <QuoteBanner quote={getStreakQuote(data.streak)} streak={data.streak} />
            </div>
          )}

          {/* Compare column headers */}
          <AnimatePresence>
            {showCompare && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-2 text-[10px] font-semibold text-muted-foreground overflow-hidden"
              >
                <div className="flex-1 text-center rounded-md bg-primary/10 py-1">This Week</div>
                <div className="flex-1 text-center rounded-md bg-secondary/50 py-1">Last Week</div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Cognitive Scores Grid */}
          {showCompare ? (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-2"
            >
              <CompareRow
                icon={<Brain className="w-3 h-3" />} iconColor="text-primary" label="Evolution"
                thisVal={evoScore != null ? `${Math.round(evoScore)}/100` : "—"}
                lastVal={lw.evoScore != null ? `${Math.round(lw.evoScore)}/100` : "—"}
                diff={evoScore != null && lw.evoScore != null ? Math.round(evoScore - lw.evoScore) : null}
              />
              <CompareRow
                icon={<Zap className="w-3 h-3" />} iconColor="text-warning" label="Efficiency"
                thisVal={efficiency != null ? `${Math.round(efficiency)}%` : "—"}
                lastVal={lw.efficiency != null ? `${Math.round(lw.efficiency)}%` : "—"}
                diff={efficiency != null && lw.efficiency != null ? Math.round(efficiency - lw.efficiency) : null}
                suffix="%"
              />
              <CompareRow
                icon={<TrendingUp className="w-3 h-3" />} iconColor="text-success" label="Memory Growth"
                thisVal={growth != null ? `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%` : "—"}
                lastVal={lw.growth != null ? `${lw.growth > 0 ? "+" : ""}${lw.growth.toFixed(1)}%` : "—"}
                diff={growth != null && lw.growth != null ? +(growth - lw.growth).toFixed(1) : null}
                suffix="%"
              />
              <CompareRow
                icon={<Clock className="w-3 h-3" />} iconColor="text-primary" label="Study Time"
                thisVal={`${formatTime(data.totalMinutes)} (${data.sessions})`}
                lastVal={`${formatTime(lw.totalMinutes)} (${lw.sessions})`}
                diff={data.totalMinutes - lw.totalMinutes}
                suffix="m"
              />
            </motion.div>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              <MetricCard
                icon={<Brain className="w-3 h-3" />} iconColor="text-primary" label="Evolution"
                value={<span className="text-lg font-bold text-foreground">{evoScore != null ? Math.round(evoScore) : "—"}</span>}
                subValue={<span className="text-[10px] text-muted-foreground">/100</span>}
                compare={false}
              />
              <MetricCard
                icon={<Zap className="w-3 h-3" />} iconColor="text-warning" label="Efficiency"
                value={<span className="text-lg font-bold text-foreground">{efficiency != null ? `${Math.round(efficiency)}%` : "—"}</span>}
              />
              <MetricCard
                icon={<TrendingUp className="w-3 h-3" />} iconColor="text-success" label="Memory Growth"
                value={<span className={`text-lg font-bold ${(growth || 0) >= 0 ? "text-success" : "text-destructive"}`}>{growth != null ? `${growth > 0 ? "+" : ""}${growth.toFixed(1)}%` : "—"}</span>}
              />
              <MetricCard
                icon={<Clock className="w-3 h-3" />} iconColor="text-primary" label="Study Time"
                value={<span className="text-lg font-bold text-foreground">{formatTime(data.totalMinutes)}</span>}
                subValue={<span className="text-[10px] text-muted-foreground ml-1">({data.sessions})</span>}
              />
            </div>
          )}

          {/* At-Risk Topics */}
          {data.atRisk.length > 0 ? (
            <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3">
              <div className="flex items-center gap-1.5 mb-2">
                <AlertTriangle className="w-3 h-3 text-destructive" />
                <span className="text-xs font-semibold text-foreground">
                  {data.atRisk.length} Topic{data.atRisk.length !== 1 ? "s" : ""} at Risk
                </span>
              </div>
              <div className="space-y-1.5">
                {data.atRisk.slice(0, expanded ? 6 : 3).map((t, i) => {
                  const str = Math.round(t.memory_strength);
                  const barColor = str < 25 ? "bg-destructive" : str < 40 ? "bg-warning" : "bg-yellow-500";
                  return (
                    <div key={i} className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between mb-0.5">
                          <span className="text-[11px] text-foreground font-medium truncate">
                            {t.name}
                            {t.subject_name && <span className="text-muted-foreground font-normal ml-1">({t.subject_name})</span>}
                          </span>
                          <span className={`text-[10px] font-bold ${str < 30 ? "text-destructive" : "text-warning"}`}>{str}%</span>
                        </div>
                        <div className="h-1 rounded-full bg-secondary">
                          <div className={`h-full rounded-full ${barColor} transition-all`} style={{ width: `${str}%` }} />
                        </div>
                      </div>
                    </div>
                  );
                })}
                {data.atRisk.length > 3 && (
                  <button
                    onClick={() => setExpanded(!expanded)}
                    className="flex items-center justify-center gap-1 w-full pt-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {expanded ? <>Show less <ChevronUp className="w-3 h-3" /></> : <>+{data.atRisk.length - 3} more <ChevronDown className="w-3 h-3" /></>}
                  </button>
                )}
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-success/20 bg-success/5 p-3 text-center">
              <p className="text-xs text-success font-medium">✅ No topics at risk this week!</p>
            </div>
          )}

          {/* AI Recommendations */}
          <div className="rounded-lg border border-border/40 bg-secondary/20 p-3">
            <div className="flex items-center gap-1.5 mb-2">
              <Sparkles className="w-3 h-3 text-primary" />
              <span className="text-xs font-semibold text-foreground">AI Recommendations</span>
            </div>
            <p className="text-[11px] text-foreground/80 leading-relaxed whitespace-pre-line">
              {data.recommendations}
            </p>
          </div>
        </div>
      ) : null}
    </motion.div>
  );
};

/** Side-by-side comparison row */
const CompareRow = ({
  icon, iconColor, label, thisVal, lastVal, diff, suffix = "",
}: {
  icon: React.ReactNode; iconColor: string; label: string;
  thisVal: string; lastVal: string; diff: number | null; suffix?: string;
}) => (
  <div className="rounded-lg border border-border/40 bg-secondary/20 p-2.5">
    <div className="flex items-center gap-1.5 mb-1.5">
      <span className={iconColor}>{icon}</span>
      <span className="text-[10px] text-muted-foreground font-medium">{label}</span>
      {diff != null && (
        <span className={`text-[9px] font-bold flex items-center gap-0.5 ml-auto ${diff > 0 ? "text-success" : diff < 0 ? "text-destructive" : "text-muted-foreground"}`}>
          {diff > 0 ? <TrendingUp className="w-2 h-2" /> : diff < 0 ? <TrendingDown className="w-2 h-2" /> : null}
          {diff > 0 ? "+" : ""}{diff}{suffix}
        </span>
      )}
    </div>
    <div className="flex gap-2">
      <div className="flex-1 rounded-md bg-primary/10 px-2 py-1.5 text-center">
        <span className="text-xs font-bold text-foreground">{thisVal}</span>
      </div>
      <div className="flex-1 rounded-md bg-secondary/50 px-2 py-1.5 text-center">
        <span className="text-xs font-medium text-muted-foreground">{lastVal}</span>
      </div>
    </div>
  </div>
);

export default WeeklyDigestPreview;
