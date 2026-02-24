import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ShieldAlert, ArrowLeft, Eye, TrendingUp, TrendingDown,
  Zap, Clock, Brain, BarChart3, ShieldCheck, AlertTriangle,
  Activity, Target, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface FocusShieldDashboardProps {
  onClose: () => void;
}

interface DayScore {
  score_date: string;
  distraction_score: number;
  focus_score: number;
  tab_switches: number;
  blur_events: number;
  total_distraction_seconds: number;
  rapid_switches: number;
  late_night_minutes: number;
}

interface WarningRow {
  id: string;
  warning_type: string;
  was_dismissed: boolean;
  recall_passed: boolean | null;
  created_at: string;
}

export default function FocusShieldDashboard({ onClose }: FocusShieldDashboardProps) {
  const { user } = useAuth();
  const [scores, setScores] = useState<DayScore[]>([]);
  const [warnings, setWarnings] = useState<WarningRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const [scoresRes, warningsRes] = await Promise.all([
      supabase.from("distraction_scores")
        .select("*")
        .eq("user_id", user.id)
        .order("score_date", { ascending: false })
        .limit(14),
      supabase.from("focus_shield_warnings")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);
    if (scoresRes.data) setScores(scoresRes.data as any);
    if (warningsRes.data) setWarnings(warningsRes.data as any);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const today = scores[0];
  const avgFocus = scores.length
    ? Math.round(scores.reduce((s, r) => s + r.focus_score, 0) / scores.length)
    : 100;
  const totalSwitches = scores.reduce((s, r) => s + r.tab_switches, 0);
  const totalDistractedMin = Math.round(
    scores.reduce((s, r) => s + r.total_distraction_seconds, 0) / 60
  );
  const recallAttempts = warnings.filter(w => w.warning_type === "recall_challenge").length;
  const recallPassed = warnings.filter(w => w.recall_passed === true).length;

  const getFocusGrade = (score: number) => {
    if (score >= 90) return { label: "Excellent", color: "text-success", emoji: "🧠" };
    if (score >= 70) return { label: "Good", color: "text-primary", emoji: "✅" };
    if (score >= 50) return { label: "Average", color: "text-warning", emoji: "⚠️" };
    return { label: "Needs Work", color: "text-destructive", emoji: "🔴" };
  };

  const grade = getFocusGrade(today?.focus_score ?? avgFocus);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-background flex flex-col"
    >
      {/* Header */}
      <header className="flex items-center gap-3 px-5 py-4 border-b border-border/50 safe-area-top">
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={onClose}
          className="p-2 -ml-2 rounded-xl hover:bg-secondary transition-colors"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </motion.button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">Focus Shield</h1>
          <p className="text-[10px] text-muted-foreground">Distraction Intelligence</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={load}
          className="p-2 rounded-xl hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-4 h-4 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </header>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto pb-24">
        <div className="px-5 py-5 space-y-5">

          {/* ── Hero Card ── */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative rounded-2xl overflow-hidden border border-border/50"
          >
            {/* Animated gradient bg */}
            <div className="absolute inset-0">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="absolute -top-10 -right-10 w-40 h-40 rounded-full bg-primary/8 blur-3xl"
              />
              <motion.div
                animate={{ rotate: [360, 0] }}
                transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                className="absolute -bottom-10 -left-10 w-36 h-36 rounded-full bg-success/8 blur-3xl"
              />
            </div>

            <div className="relative p-5">
              <div className="flex items-start justify-between mb-4">
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-widest mb-1">Today's Focus</p>
                  <div className="flex items-baseline gap-2">
                    <motion.span
                      key={today?.focus_score}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`text-4xl font-black ${grade.color}`}
                    >
                      {today?.focus_score ?? "—"}
                    </motion.span>
                    <span className="text-sm text-muted-foreground">/100</span>
                  </div>
                  <p className={`text-xs font-semibold mt-0.5 ${grade.color}`}>
                    {grade.emoji} {grade.label}
                  </p>
                </div>

                {/* Shield icon with pulse */}
                <motion.div
                  animate={{
                    boxShadow: [
                      "0 0 0 0 hsl(var(--success) / 0)",
                      "0 0 0 12px hsl(var(--success) / 0.1)",
                      "0 0 0 0 hsl(var(--success) / 0)",
                    ],
                  }}
                  transition={{ duration: 2, repeat: Infinity }}
                  className="w-14 h-14 rounded-2xl bg-success/10 flex items-center justify-center"
                >
                  <ShieldCheck className="w-7 h-7 text-success" />
                </motion.div>
              </div>

              {/* Mini stats row */}
              <div className="flex gap-2">
                <MiniStat icon={Zap} label="Switches" value={String(today?.tab_switches ?? 0)} />
                <MiniStat icon={Clock} label="Distracted" value={`${Math.round((today?.total_distraction_seconds ?? 0) / 60)}m`} />
                <MiniStat icon={AlertTriangle} label="Rapid" value={String(today?.rapid_switches ?? 0)} />
              </div>
            </div>
          </motion.div>

          {/* ── 14-Day Trend ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
              14-Day Focus Trend
            </p>
            <div className="rounded-2xl border border-border/50 bg-card/80 p-4">
              {scores.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  No data yet — keep studying and your focus data will appear here
                </p>
              ) : (
                <div className="flex items-end gap-1 h-24">
                  {[...scores].reverse().map((s, i) => {
                    const h = Math.max(4, (s.focus_score / 100) * 100);
                    return (
                      <motion.div
                        key={s.score_date}
                        initial={{ height: 0 }}
                        animate={{ height: `${h}%` }}
                        transition={{ delay: i * 0.03, type: "spring", stiffness: 200 }}
                        className="flex-1 rounded-t-md"
                        style={{
                          background: s.focus_score >= 70
                            ? "hsl(var(--success))"
                            : s.focus_score >= 50
                            ? "hsl(var(--warning))"
                            : "hsl(var(--destructive))",
                          opacity: 0.7 + (i / scores.length) * 0.3,
                        }}
                        title={`${s.score_date}: ${s.focus_score}%`}
                      />
                    );
                  })}
                </div>
              )}
              <div className="flex justify-between mt-2">
                <span className="text-[9px] text-muted-foreground">14 days ago</span>
                <span className="text-[9px] text-muted-foreground">Today</span>
              </div>
            </div>
          </motion.section>

          {/* ── Aggregate Stats ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
              Overall Insights
            </p>
            <div className="grid grid-cols-2 gap-2.5">
              <InsightCard
                icon={TrendingUp}
                label="Avg Focus Score"
                value={`${avgFocus}%`}
                color="text-success"
                bg="bg-success/10"
              />
              <InsightCard
                icon={Activity}
                label="Total Switches"
                value={String(totalSwitches)}
                color="text-warning"
                bg="bg-warning/10"
              />
              <InsightCard
                icon={Clock}
                label="Total Distracted"
                value={`${totalDistractedMin}m`}
                color="text-destructive"
                bg="bg-destructive/10"
              />
              <InsightCard
                icon={Brain}
                label="Recall Pass Rate"
                value={recallAttempts > 0 ? `${Math.round((recallPassed / recallAttempts) * 100)}%` : "—"}
                color="text-primary"
                bg="bg-primary/10"
              />
            </div>
          </motion.section>

          {/* ── Recent Warnings ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-3 px-1">
              Recent Shield Events
            </p>
            <div className="rounded-2xl border border-border/50 bg-card/80 overflow-hidden">
              {warnings.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-8">
                  No shield events yet — stay focused! 🎯
                </p>
              ) : (
                <div className="divide-y divide-border/30">
                  {warnings.slice(0, 8).map((w, i) => (
                    <motion.div
                      key={w.id}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.25 + i * 0.03 }}
                      className="flex items-center gap-3 px-4 py-3"
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${
                        w.warning_type === "freeze" ? "bg-destructive/10" :
                        w.warning_type === "recall_challenge" ? "bg-accent/10" : "bg-warning/10"
                      }`}>
                        {w.warning_type === "freeze" ? (
                          <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                        ) : w.warning_type === "recall_challenge" ? (
                          <Brain className="w-3.5 h-3.5 text-accent" />
                        ) : (
                          <ShieldAlert className="w-3.5 h-3.5 text-warning" />
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[11px] font-semibold text-foreground capitalize">
                          {w.warning_type.replace("_", " ")}
                        </p>
                        <p className="text-[9px] text-muted-foreground">
                          {new Date(w.created_at).toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </div>
                      {w.warning_type === "recall_challenge" && (
                        <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                          w.recall_passed ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                        }`}>
                          {w.recall_passed ? "Passed" : "Failed"}
                        </span>
                      )}
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </motion.section>

          {/* ── How It Works ── */}
          <motion.section
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="rounded-2xl border border-border/50 bg-card/80 p-4"
          >
            <p className="text-xs font-bold text-foreground mb-3">How Focus Shield Works</p>
            <div className="space-y-2.5">
              {[
                { icon: Eye, text: "Monitors tab switches & app focus automatically" },
                { icon: BarChart3, text: "Calculates daily distraction score (0-100)" },
                { icon: ShieldAlert, text: "Warns you when leaving during study sessions" },
                { icon: Brain, text: "Micro recall challenge to unlock distractions" },
                { icon: Target, text: "Correlates focus with memory retention" },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-lg bg-primary/8 flex items-center justify-center shrink-0">
                    <item.icon className="w-3.5 h-3.5 text-primary" />
                  </div>
                  <p className="text-[11px] text-muted-foreground">{item.text}</p>
                </div>
              ))}
            </div>
          </motion.section>

        </div>
      </div>
    </motion.div>
  );
}

function MiniStat({ icon: Icon, label, value }: { icon: any; label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-secondary/40 border border-border/30 p-2.5 text-center">
      <Icon className="w-3 h-3 text-muted-foreground mx-auto mb-1" />
      <p className="text-xs font-bold text-foreground">{value}</p>
      <p className="text-[8px] text-muted-foreground">{label}</p>
    </div>
  );
}

function InsightCard({ icon: Icon, label, value, color, bg }: {
  icon: any; label: string; value: string; color: string; bg: string;
}) {
  return (
    <div className={`rounded-xl ${bg} border border-border/30 p-4`}>
      <Icon className={`w-4 h-4 ${color} mb-2`} />
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-lg font-bold ${color}`}>{value}</p>
    </div>
  );
}
