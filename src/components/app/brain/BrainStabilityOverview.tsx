import { useState, useCallback, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Shield, AlertTriangle, Target, TrendingUp, TrendingDown,
  Zap, ChevronDown, Sparkles, Activity, Gauge, Eye, Play, Loader2,
  ArrowRight,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

/* ───────── types ───────── */
interface TopicInfo {
  id: string;
  name: string;
  memory_strength: number;
  next_predicted_drop_date: string | null;
  last_revision_date: string | null;
}

interface SubjectHealthData {
  id: string;
  name: string;
  strength: number;
  topicCount: number;
  topics: TopicInfo[];
}

interface BrainStabilityOverviewProps {
  overallHealth: number;
  totalTopics: number;
  totalAtRisk: number;
  totalSubjects: number;
  hasData: boolean;
  subjectHealth: SubjectHealthData[];
  onBoostSession: (subject: string, topic: string) => void;
  onSurePassClick?: () => void;
}

/* ───────── sub-metrics derived ───────── */
function deriveMetrics(overallHealth: number, totalAtRisk: number, totalTopics: number, subjectHealth: SubjectHealthData[]) {
  const conceptStrength = overallHealth;
  const recallPower = totalTopics > 0
    ? Math.round(Math.max(0, overallHealth - (totalAtRisk / Math.max(totalTopics, 1)) * 30))
    : 0;
  const speedIndex = totalTopics > 0
    ? Math.round(Math.min(100, overallHealth * 1.05 + (totalTopics > 5 ? 5 : 0)))
    : 0;
  const riskExposure = totalTopics > 0
    ? Math.min(100, Math.round((totalAtRisk / Math.max(totalTopics, 1)) * 100))
    : 0;
  const decayRisk = riskExposure;
  const examReadiness = totalTopics > 0
    ? Math.round(overallHealth * 0.85 + (100 - decayRisk) * 0.15)
    : 0;
  return { conceptStrength, recallPower, speedIndex, riskExposure, decayRisk, examReadiness };
}

/* ───────── Stability Arc ───────── */
const StabilityArc = ({ value, size = 160, animateKey }: { value: number; size?: number; animateKey?: number }) => {
  const r = (size - 16) / 2;
  const circ = 2 * Math.PI * r;
  const arcFraction = 0.75;
  const arcLength = circ * arcFraction;
  const offset = arcLength * (1 - value / 100);

  const color = value > 70
    ? "hsl(var(--success))"
    : value > 50
    ? "hsl(var(--warning))"
    : "hsl(var(--destructive))";

  const glowColor = value > 70
    ? "hsl(142 71% 45% / 0.4)"
    : value > 50
    ? "hsl(38 92% 50% / 0.4)"
    : "hsl(0 72% 51% / 0.4)";

  const label = value > 70 ? "Strong" : value > 50 ? "Needs Care" : "Critical";

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <div
        className="absolute inset-4 rounded-full blur-2xl opacity-30 pointer-events-none"
        style={{ background: glowColor }}
      />
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full" style={{ transform: "rotate(135deg)" }}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="hsl(var(--secondary))" strokeWidth="10"
          strokeDasharray={`${arcLength} ${circ - arcLength}`} strokeLinecap="round"
        />
        <motion.circle
          key={animateKey}
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke={color} strokeWidth="10" strokeLinecap="round"
          strokeDasharray={`${arcLength} ${circ - arcLength}`}
          initial={{ strokeDashoffset: arcLength }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.8, ease: "easeOut", delay: 0.3 }}
          style={{ filter: `drop-shadow(0 0 12px ${glowColor})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingBottom: size * 0.08 }}>
        <motion.span
          key={`val-${animateKey}`}
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.6, type: "spring", stiffness: 200 }}
          className="text-4xl font-bold text-foreground tabular-nums"
        >
          {value > 0 ? `${value}%` : "—"}
        </motion.span>
        <span className="text-[10px] font-semibold uppercase tracking-wider mt-1" style={{ color }}>
          {value > 0 ? label : "No data"}
        </span>
      </div>
    </div>
  );
};

/* ───────── Breakdown metric card ───────── */
const BreakdownCard = ({ icon: Icon, label, value, color, bgColor, delay }: {
  icon: any; label: string; value: string; color: string; bgColor: string; delay: number;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay }}
    className="flex items-center gap-3 rounded-xl p-3 border border-border/40"
    style={{ background: "hsl(var(--card) / 0.5)" }}
  >
    <div className={`w-9 h-9 rounded-lg ${bgColor} flex items-center justify-center shrink-0`}>
      <Icon className={`w-4 h-4 ${color}`} />
    </div>
    <div className="flex-1 min-w-0">
      <p className="text-[10px] text-muted-foreground">{label}</p>
      <p className={`text-sm font-bold tabular-nums ${color}`}>{value}</p>
    </div>
    {/* Mini bar */}
    <div className="w-16 h-1.5 rounded-full bg-secondary/60 shrink-0">
      <motion.div
        className={`h-full rounded-full ${bgColor.replace("/10", "")}`}
        style={{ background: `hsl(var(--${color.replace("text-", "")}))` }}
        initial={{ width: 0 }}
        animate={{ width: `${parseInt(value) || 0}%` }}
        transition={{ duration: 0.8, delay: delay + 0.1 }}
      />
    </div>
  </motion.div>
);

/* ───────── Main component ───────── */
export default function BrainStabilityOverview({
  overallHealth, totalTopics, totalAtRisk, totalSubjects, hasData,
  subjectHealth, onBoostSession, onSurePassClick,
}: BrainStabilityOverviewProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const [boosting, setBoosting] = useState(false);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [loadingExplanation, setLoadingExplanation] = useState(false);
  const [arcKey, setArcKey] = useState(0);

  const m = deriveMetrics(overallHealth, totalAtRisk, totalTopics, subjectHealth);

  /* ── Find weakest topic for boost ── */
  const weakestTarget = useMemo(() => {
    let weakest: { subject: string; topic: string; strength: number } | null = null;
    for (const sub of subjectHealth) {
      for (const t of sub.topics) {
        if (!weakest || t.memory_strength < weakest.strength) {
          weakest = { subject: sub.name, topic: t.name, strength: t.memory_strength };
        }
      }
    }
    return weakest;
  }, [subjectHealth]);

  /* ── Decay alerts ── */
  const decayAlerts = useMemo(() => {
    const alerts: { topic: string; subject: string; strength: number }[] = [];
    for (const sub of subjectHealth) {
      for (const t of sub.topics) {
        if (t.next_predicted_drop_date) {
          const d = new Date(t.next_predicted_drop_date);
          if (d <= new Date()) {
            alerts.push({ topic: t.name, subject: sub.name, strength: t.memory_strength });
          }
        }
      }
    }
    return alerts.sort((a, b) => a.strength - b.strength).slice(0, 3);
  }, [subjectHealth]);

  /* ── Mission impact preview ── */
  const missionImpact = useMemo(() => {
    if (!weakestTarget) return null;
    const boost = Math.min(15, Math.max(3, Math.round((100 - weakestTarget.strength) * 0.2)));
    return { topic: weakestTarget.topic, boost };
  }, [weakestTarget]);

  /* ── Boost stability action ── */
  const handleBoost = useCallback(() => {
    if (!weakestTarget || boosting) return;
    setBoosting(true);
    onBoostSession(weakestTarget.subject, weakestTarget.topic);
    setTimeout(() => setBoosting(false), 1000);
  }, [weakestTarget, boosting, onBoostSession]);

  /* ── AI explanation ── */
  const fetchExplanation = useCallback(async () => {
    if (loadingExplanation || !user) return;
    setLoadingExplanation(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "explain_stability",
          context: {
            overall_health: overallHealth,
            total_topics: totalTopics,
            at_risk: totalAtRisk,
            concept_strength: m.conceptStrength,
            recall_power: m.recallPower,
            risk_exposure: m.riskExposure,
          },
        },
      });
      if (!error && data?.explanation) {
        setAiExplanation(data.explanation);
      } else {
        setAiExplanation(
          overallHealth > 70
            ? "Your brain is performing well. Keep reviewing to maintain this momentum."
            : overallHealth > 50
            ? "Some areas need attention. Focus on at-risk topics to strengthen your overall stability."
            : "Critical areas detected. Daily micro-sessions will significantly improve your scores."
        );
      }
    } catch {
      setAiExplanation("Focus on your weakest topics daily to see steady improvement in your stability score.");
    } finally {
      setLoadingExplanation(false);
    }
  }, [user, overallHealth, totalTopics, totalAtRisk, m, loadingExplanation]);

  /* ── Quick summary metrics (always visible) ── */
  const quickMetrics = [
    {
      icon: Brain, label: "Memory", value: hasData ? `${overallHealth}%` : "—",
      color: overallHealth > 70 ? "text-success" : overallHealth > 50 ? "text-warning" : "text-destructive",
      bgColor: overallHealth > 70 ? "bg-success/10" : overallHealth > 50 ? "bg-warning/10" : "bg-destructive/10",
    },
    {
      icon: AlertTriangle, label: "Risk", value: hasData ? `${m.decayRisk}%` : "—",
      color: m.decayRisk < 20 ? "text-success" : m.decayRisk < 50 ? "text-warning" : "text-destructive",
      bgColor: m.decayRisk < 20 ? "bg-success/10" : m.decayRisk < 50 ? "bg-warning/10" : "bg-destructive/10",
    },
    {
      icon: Target, label: "Ready", value: hasData ? `${m.examReadiness}%` : "—",
      color: m.examReadiness > 70 ? "text-success" : m.examReadiness > 50 ? "text-warning" : "text-destructive",
      bgColor: m.examReadiness > 70 ? "bg-success/10" : m.examReadiness > 50 ? "bg-warning/10" : "bg-destructive/10",
    },
  ];

  return (
    <motion.section
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: "easeOut" }}
      className="relative overflow-hidden rounded-3xl"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary)) 50%, hsl(var(--card)) 100%)",
        border: "1px solid hsl(var(--border))",
      }}
    >
      {/* Ambient glow */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-56 h-56 rounded-full opacity-15 blur-3xl pointer-events-none"
        style={{ background: "hsl(var(--primary))" }}
      />

      <div className="relative z-10 p-6">
        {/* ── Title ── */}
        <button
          onClick={onSurePassClick}
          className="flex items-center justify-center gap-2 mb-2 mx-auto group cursor-pointer"
        >
          <motion.div
            animate={{ scale: [1, 1.15, 1] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="w-2 h-2 rounded-full bg-primary"
          />
          <span className="text-[11px] font-semibold uppercase tracking-wider text-primary group-hover:text-primary/80 transition-colors">
            SurePass
          </span>
          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.2, repeat: Infinity, ease: "easeInOut" }}
          >
            <ArrowRight className="w-3.5 h-3.5 text-primary" />
          </motion.div>
        </button>

        {/* ── Arc ── */}
        <StabilityArc value={hasData ? overallHealth : 0} animateKey={arcKey} />

        {/* ── Quick metrics row ── */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="grid grid-cols-3 gap-2.5 mt-2"
        >
          {quickMetrics.map((qm, i) => (
            <motion.div
              key={qm.label}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1 + i * 0.1 }}
              className="rounded-xl bg-background/50 backdrop-blur-sm p-3 border border-border/50 text-center"
            >
              <div className={`w-7 h-7 rounded-lg ${qm.bgColor} flex items-center justify-center mx-auto mb-1.5`}>
                <qm.icon className={`w-3.5 h-3.5 ${qm.color}`} />
              </div>
              <p className={`text-base font-bold tabular-nums ${qm.color}`}>{qm.value}</p>
              <p className="text-[8px] text-muted-foreground mt-0.5 leading-tight">{qm.label}</p>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Decay alerts (subtle) ── */}
        {decayAlerts.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.2 }}
            className="mt-3 flex items-center gap-2 rounded-xl px-3 py-2 border border-destructive/20"
            style={{ background: "hsl(0 50% 8% / 0.4)" }}
          >
            <motion.div
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
            >
              <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />
            </motion.div>
            <p className="text-[10px] text-destructive/90 flex-1">
              <span className="font-semibold">{decayAlerts.length} topic{decayAlerts.length > 1 ? "s" : ""} decaying</span>
              {" · "}
              {decayAlerts.map(a => a.topic).join(", ")}
            </p>
          </motion.div>
        )}

        {/* ── Mission impact preview ── */}
        {missionImpact && hasData && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 1.3 }}
            className="mt-2 flex items-center gap-2 rounded-xl px-3 py-2 border border-primary/20"
            style={{ background: "hsl(var(--primary) / 0.05)" }}
          >
            <Sparkles className="w-3.5 h-3.5 text-primary shrink-0" />
            <p className="text-[10px] text-primary/90 flex-1">
              <span className="font-semibold">Today's mission</span>
              {" · Fix "}{missionImpact.topic}{" for +"}
              <span className="font-bold">{missionImpact.boost}%</span>
              {" stability boost"}
            </p>
          </motion.div>
        )}

        {/* ── Expand/collapse toggle ── */}
        <motion.button
          onClick={() => {
            setExpanded(!expanded);
            if (!expanded && !aiExplanation) fetchExplanation();
          }}
          whileTap={{ scale: 0.97 }}
          className="w-full mt-3 flex items-center justify-center gap-1.5 py-2 rounded-xl
                     text-[10px] font-semibold text-muted-foreground
                     hover:text-foreground hover:bg-secondary/30 transition-colors"
        >
          <span>{expanded ? "Hide Details" : "Tap for AI Breakdown"}</span>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.25 }}>
            <ChevronDown className="w-3.5 h-3.5" />
          </motion.div>
        </motion.button>

        {/* ── Expanded breakdown ── */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="pt-3 space-y-2">
                {/* Detailed metrics */}
                <BreakdownCard
                  icon={Brain} label="Concept Strength"
                  value={hasData ? `${m.conceptStrength}%` : "—"}
                  color={m.conceptStrength > 70 ? "success" : m.conceptStrength > 50 ? "warning" : "destructive"}
                  bgColor={m.conceptStrength > 70 ? "bg-success/10" : m.conceptStrength > 50 ? "bg-warning/10" : "bg-destructive/10"}
                  delay={0.05}
                />
                <BreakdownCard
                  icon={Activity} label="Recall Power"
                  value={hasData ? `${m.recallPower}%` : "—"}
                  color={m.recallPower > 70 ? "success" : m.recallPower > 50 ? "warning" : "destructive"}
                  bgColor={m.recallPower > 70 ? "bg-success/10" : m.recallPower > 50 ? "bg-warning/10" : "bg-destructive/10"}
                  delay={0.1}
                />
                <BreakdownCard
                  icon={Gauge} label="Speed Index"
                  value={hasData ? `${m.speedIndex}%` : "—"}
                  color={m.speedIndex > 70 ? "success" : m.speedIndex > 50 ? "warning" : "destructive"}
                  bgColor={m.speedIndex > 70 ? "bg-success/10" : m.speedIndex > 50 ? "bg-warning/10" : "bg-destructive/10"}
                  delay={0.15}
                />
                <BreakdownCard
                  icon={Eye} label="Risk Exposure"
                  value={hasData ? `${m.riskExposure}%` : "—"}
                  color={m.riskExposure < 20 ? "success" : m.riskExposure < 50 ? "warning" : "destructive"}
                  bgColor={m.riskExposure < 20 ? "bg-success/10" : m.riskExposure < 50 ? "bg-warning/10" : "bg-destructive/10"}
                  delay={0.2}
                />

                {/* ── AI Explanation ── */}
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.25 }}
                  className="rounded-xl p-3 border border-primary/15 mt-1"
                  style={{ background: "hsl(var(--primary) / 0.04)" }}
                >
                  <div className="flex items-center gap-2 mb-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[10px] font-semibold text-primary">AI Analysis</span>
                  </div>
                  {loadingExplanation ? (
                    <div className="flex items-center gap-2 py-2">
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                      <span className="text-[10px] text-muted-foreground">Analyzing your brain state...</span>
                    </div>
                  ) : (
                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                      {aiExplanation || "Tap to receive personalized insights about your stability."}
                    </p>
                  )}
                </motion.div>

                {/* ── Boost Stability CTA ── */}
                {hasData && weakestTarget && (
                  <motion.button
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={handleBoost}
                    disabled={boosting}
                    className="w-full mt-1 flex items-center justify-center gap-2 py-3 rounded-xl
                               bg-primary text-primary-foreground text-sm font-semibold
                               hover:bg-primary/90 transition-all disabled:opacity-60"
                    style={{ boxShadow: "0 4px 24px hsl(var(--primary) / 0.35)" }}
                  >
                    {boosting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Zap className="w-4 h-4" />
                    )}
                    <span>Boost Stability Now</span>
                    <span className="text-[10px] opacity-80 ml-1">· {weakestTarget.topic}</span>
                  </motion.button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}
