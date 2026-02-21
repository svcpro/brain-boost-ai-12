import { useState } from "react";
import { motion } from "framer-motion";
import { Rocket, ArrowLeft, Zap, Target, Calendar, Brain, Shield, TrendingUp, Play, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useAccelerator, useWeaknessPredictions, useExamTrends } from "@/hooks/useCompetitiveIntel";

const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
const DAY_LABELS: Record<string, string> = { mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat", sun: "Sun" };

export default function AcceleratorPage() {
  const navigate = useNavigate();
  const { enrollment, isLoading, enroll, isEnrolling } = useAccelerator();
  const { predictions } = useWeaknessPredictions();
  const { trends } = useExamTrends();
  const [examType, setExamType] = useState("general");

  const daysLeft = enrollment ? Math.max(0, Math.ceil((new Date(enrollment.end_date).getTime() - Date.now()) / 86400000)) : 30;
  const progress = enrollment?.progress_percentage || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="sticky top-0 z-30 backdrop-blur-xl border-b border-border/50 px-4 py-3 flex items-center gap-3" style={{ background: "hsl(var(--background) / 0.85)" }}>
        <button onClick={() => navigate("/app")} className="p-2 rounded-lg hover:bg-secondary"><ArrowLeft className="w-5 h-5 text-foreground" /></button>
        <div className="flex-1">
          <h1 className="text-base font-bold text-foreground">30-Day Accelerator</h1>
          <p className="text-[10px] text-muted-foreground">Strategic Exam War Mode</p>
        </div>
        <Rocket className="w-5 h-5 text-primary" />
      </div>

      <div className="px-4 py-5 space-y-5 max-w-lg mx-auto pb-24">
        {!enrollment ? (
          /* Enrollment state */
          <>
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-6 text-center space-y-4"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.1), hsl(var(--card)))", border: "1px solid hsl(var(--primary) / 0.2)" }}
            >
              <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center mx-auto">
                <Rocket className="w-8 h-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold text-foreground">Activate War Mode</h2>
              <p className="text-xs text-muted-foreground leading-relaxed">
                AI will analyze your weaknesses, exam trends, and create a hyper-focused 30-day battle plan to maximize your rank.
              </p>

              <div className="grid grid-cols-3 gap-3 pt-2">
                <div className="p-3 rounded-xl bg-background/50">
                  <Target className="w-5 h-5 text-primary mx-auto mb-1" />
                  <p className="text-[10px] font-medium text-foreground">Weakness Fix</p>
                </div>
                <div className="p-3 rounded-xl bg-background/50">
                  <TrendingUp className="w-5 h-5 text-accent mx-auto mb-1" />
                  <p className="text-[10px] font-medium text-foreground">Trend Focus</p>
                </div>
                <div className="p-3 rounded-xl bg-background/50">
                  <Zap className="w-5 h-5 text-warning mx-auto mb-1" />
                  <p className="text-[10px] font-medium text-foreground">High Intensity</p>
                </div>
              </div>

              <select
                value={examType}
                onChange={(e) => setExamType(e.target.value)}
                className="w-full p-2.5 rounded-lg bg-background border border-border text-sm text-foreground"
              >
                <option value="general">General Exam</option>
                <option value="JEE">JEE</option>
                <option value="NEET">NEET</option>
                <option value="UPSC">UPSC</option>
              </select>

              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                onClick={() => enroll(examType)}
                disabled={isEnrolling}
                className="w-full py-3.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
              >
                {isEnrolling ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                {isEnrolling ? "Generating Plan..." : "Start 30-Day Accelerator"}
              </motion.button>
            </motion.div>

            {/* Preview weak topics */}
            {predictions && predictions.length > 0 && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                <p className="text-xs font-bold text-foreground flex items-center gap-2"><Shield className="w-3.5 h-3.5 text-warning" /> Your Weak Zones</p>
                {predictions.slice(0, 3).map((p: any, i: number) => (
                  <div key={i} className="flex items-center gap-2 text-xs">
                    <div className="w-6 h-6 rounded bg-destructive/15 flex items-center justify-center text-[10px] font-bold text-destructive">{Math.round(p.failure_probability)}%</div>
                    <span className="text-foreground">{p.topic_name}</span>
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          /* Active enrollment */
          <>
            {/* Progress Hero */}
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl p-5 space-y-4"
              style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.12), hsl(var(--card)))", border: "1px solid hsl(var(--primary) / 0.2)" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-primary uppercase tracking-wider">War Mode Active</p>
                  <p className="text-2xl font-black text-foreground mt-1">{daysLeft} days left</p>
                </div>
                <div className="text-right">
                  <p className="text-3xl font-black text-primary">{Math.round(progress)}%</p>
                  <p className="text-[10px] text-muted-foreground">complete</p>
                </div>
              </div>
              <div className="h-2 rounded-full bg-secondary overflow-hidden">
                <motion.div className="h-full rounded-full bg-primary" initial={{ width: 0 }} animate={{ width: `${progress}%` }} transition={{ duration: 1, ease: "easeOut" }} />
              </div>
              <p className="text-[10px] text-muted-foreground">{enrollment.days_completed || 0} of 30 days completed · {enrollment.target_exam_type || "General"}</p>
            </motion.div>

            {/* AI Strategy */}
            {enrollment.ai_strategy && (
              <div className="rounded-xl p-4 space-y-2" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                <p className="text-xs font-bold text-foreground flex items-center gap-2"><Brain className="w-3.5 h-3.5 text-primary" /> AI Strategy</p>
                <p className="text-xs text-muted-foreground leading-relaxed">{enrollment.ai_strategy}</p>
              </div>
            )}

            {/* Weekly Schedule */}
            {enrollment.daily_schedule && Object.keys(enrollment.daily_schedule).length > 0 && (
              <div className="rounded-xl p-4 space-y-3" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                <p className="text-xs font-bold text-foreground flex items-center gap-2"><Calendar className="w-3.5 h-3.5 text-accent" /> Weekly Pattern</p>
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map(day => {
                    const task = (enrollment.daily_schedule as any)?.[day];
                    if (!task) return null;
                    return (
                      <div key={day} className="flex items-center gap-3 p-2 rounded-lg bg-background/50">
                        <span className="text-[10px] font-bold text-primary w-7">{DAY_LABELS[day]}</span>
                        <span className="text-[11px] text-foreground">{task}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Focus Topics */}
            <div className="grid grid-cols-2 gap-3">
              {enrollment.weak_topics && (enrollment.weak_topics as any[]).length > 0 && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                  <p className="text-[10px] font-bold text-warning">⚠️ Weak Topics</p>
                  {(enrollment.weak_topics as any[]).slice(0, 3).map((t: any, i: number) => (
                    <p key={i} className="text-[10px] text-muted-foreground truncate">{t.name} ({t.risk}%)</p>
                  ))}
                </div>
              )}
              {enrollment.high_probability_topics && (enrollment.high_probability_topics as any[]).length > 0 && (
                <div className="rounded-xl p-3 space-y-2" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
                  <p className="text-[10px] font-bold text-accent">🎯 High Probability</p>
                  {(enrollment.high_probability_topics as any[]).slice(0, 3).map((t: any, i: number) => (
                    <p key={i} className="text-[10px] text-muted-foreground truncate">{t.name} ({t.probability}%)</p>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
