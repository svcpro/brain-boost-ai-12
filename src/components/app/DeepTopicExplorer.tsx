import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, ChevronDown, ChevronRight, Brain, Crosshair,
  Target, AlertOctagon, Zap, TrendingDown, Activity,
  Sparkles, Loader2, Shield, Clock, BarChart3,
  Layers, Route, ArrowRight, RefreshCw
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FocusModeSession from "./FocusModeSession";
import LazyModeSession from "./LazyModeSession";
import MockPracticeSession from "./MockPracticeSession";

// ─── Types ───
interface TopicData {
  id: string;
  name: string;
  memory_strength: number;
  last_revision_date: string | null;
  next_predicted_drop_date: string | null;
  marks_impact_weight: number | null;
}

interface SubjectData {
  id: string;
  name: string;
  topics: TopicData[];
}

interface TopicHealth {
  conceptClarity: number;
  applicationStrength: number;
  errorPattern: string;
  decayPrediction: string;
  riskLevel: "critical" | "high" | "medium" | "low";
}

interface StrategyStep {
  action: string;
  mode: string;
  duration: string;
  reason: string;
}

// ─── Helpers ───
const stabilityColor = (s: number) =>
  s < 0.3 ? "text-destructive" : s < 0.6 ? "text-warning" : "text-success";

const stabilityBg = (s: number) =>
  s < 0.3 ? "bg-destructive" : s < 0.6 ? "bg-warning" : "bg-success";

const riskLabel = (s: number) =>
  s < 0.3 ? "Critical" : s < 0.5 ? "At Risk" : s < 0.7 ? "Moderate" : "Stable";

const riskBadge = (s: number) => {
  if (s < 0.3) return "bg-destructive/15 text-destructive";
  if (s < 0.5) return "bg-warning/15 text-warning";
  if (s < 0.7) return "bg-primary/15 text-primary";
  return "bg-success/15 text-success";
};

const computeHealth = (t: TopicData): TopicHealth => {
  const s = t.memory_strength;
  const daysSinceRevision = t.last_revision_date
    ? Math.floor((Date.now() - new Date(t.last_revision_date).getTime()) / 86400000)
    : 999;
  const daysUntilDrop = t.next_predicted_drop_date
    ? Math.max(0, Math.floor((new Date(t.next_predicted_drop_date).getTime() - Date.now()) / 86400000))
    : 0;

  const conceptClarity = Math.min(100, Math.round(s * 100));
  const applicationStrength = Math.min(100, Math.round(s * 85 + (t.marks_impact_weight || 0) * 5));
  const errorPattern = s < 0.3 ? "Frequent recall failures" : s < 0.6 ? "Occasional gaps in application" : "Minimal errors detected";
  const decayPrediction = daysUntilDrop <= 1 ? "Decaying now" : daysUntilDrop <= 3 ? `Dropping in ${daysUntilDrop}d` : `Stable for ${daysUntilDrop}d`;
  const riskLevel: TopicHealth["riskLevel"] = s < 0.3 ? "critical" : s < 0.5 ? "high" : s < 0.7 ? "medium" : "low";

  return { conceptClarity, applicationStrength, errorPattern, decayPrediction, riskLevel };
};

// ─── Sub-components ───
const HealthBar = ({ label, value, icon: Icon }: { label: string; value: number; icon: any }) => (
  <div className="space-y-1">
    <div className="flex items-center justify-between">
      <span className="text-[10px] text-muted-foreground flex items-center gap-1">
        <Icon className="w-3 h-3" />
        {label}
      </span>
      <span className="text-[10px] font-semibold text-foreground">{value}%</span>
    </div>
    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
      <motion.div
        initial={{ width: 0 }}
        animate={{ width: `${value}%` }}
        transition={{ duration: 0.6, ease: "easeOut" }}
        className={`h-full rounded-full ${value < 40 ? "bg-destructive" : value < 70 ? "bg-warning" : "bg-success"}`}
      />
    </div>
  </div>
);

const TopicHealthDashboard = ({ topic }: { topic: TopicData }) => {
  const health = computeHealth(topic);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      className="overflow-hidden"
    >
      <div className="px-4 pb-3 pt-1 space-y-3">
        {/* Health Bars */}
        <div className="grid grid-cols-2 gap-3">
          <HealthBar label="Concept Clarity" value={health.conceptClarity} icon={Brain} />
          <HealthBar label="Application" value={health.applicationStrength} icon={Target} />
        </div>

        {/* Error Pattern & Decay */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-secondary text-muted-foreground flex items-center gap-1">
            <AlertOctagon className="w-2.5 h-2.5" />
            {health.errorPattern}
          </span>
          <span className={`text-[9px] px-2 py-0.5 rounded-full flex items-center gap-1 ${
            health.riskLevel === "critical" ? "bg-destructive/15 text-destructive" :
            health.riskLevel === "high" ? "bg-warning/15 text-warning" : "bg-secondary text-muted-foreground"
          }`}>
            <TrendingDown className="w-2.5 h-2.5" />
            {health.decayPrediction}
          </span>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Main Component ───
const DeepTopicExplorer = () => {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<SubjectData[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<TopicData | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  // Study mode states
  const [focusOpen, setFocusOpen] = useState(false);
  const [revisionOpen, setRevisionOpen] = useState(false);
  const [mockOpen, setMockOpen] = useState(false);

  // Smart Strategy
  const [strategyTopic, setStrategyTopic] = useState<TopicData | null>(null);
  const [strategy, setStrategy] = useState<StrategyStep[]>([]);
  const [strategyLoading, setStrategyLoading] = useState(false);

  // ─── Fetch data ───
  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data: subData } = await (supabase as any)
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");

      if (!subData || subData.length === 0) {
        setSubjects([]);
        setLoading(false);
        return;
      }

      const { data: topicData } = await (supabase as any)
        .from("topics")
        .select("id, name, memory_strength, last_revision_date, next_predicted_drop_date, marks_impact_weight, subject_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("memory_strength", { ascending: true });

      const topicsBySubject: Record<string, TopicData[]> = {};
      for (const t of (topicData || [])) {
        if (!topicsBySubject[t.subject_id]) topicsBySubject[t.subject_id] = [];
        topicsBySubject[t.subject_id].push(t);
      }

      const mapped: SubjectData[] = (subData || []).map((s: any) => ({
        id: s.id,
        name: s.name,
        topics: topicsBySubject[s.id] || [],
      }));

      setSubjects(mapped);
    } catch { /* ignore */ }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // ─── Subject stats ───
  const getSubjectStats = (sub: SubjectData) => {
    const count = sub.topics.length;
    if (count === 0) return { avg: 0, atRisk: 0, mastered: 0 };
    const avg = sub.topics.reduce((s, t) => s + t.memory_strength, 0) / count;
    const atRisk = sub.topics.filter(t => t.memory_strength < 0.4).length;
    const mastered = sub.topics.filter(t => t.memory_strength >= 0.8).length;
    return { avg, atRisk, mastered };
  };

  // ─── Smart Strategy (intelligent local generation) ───
  const generateStrategy = (topic: TopicData) => {
    setStrategyTopic(topic);
    setStrategyLoading(true);
    setStrategy([]);

    // Simulate brief AI processing feel
    setTimeout(() => {
      const s = topic.memory_strength;
      const steps: StrategyStep[] = [];

      if (s < 0.3) {
        // Critical — full recovery sequence
        steps.push(
          { action: "Emergency Recall Burst", mode: "revision", duration: "3 min", reason: "Reactivate fading memory traces before they're lost" },
          { action: "Deep Focus Rebuild", mode: "focus", duration: "15 min", reason: "Reconstruct weak foundations with focused learning" },
          { action: "Pressure Test", mode: "mock", duration: "5 min", reason: "Validate recovery under exam-like conditions" },
        );
      } else if (s < 0.6) {
        // Moderate — reinforcement sequence
        steps.push(
          { action: "Quick Recall Check", mode: "revision", duration: "3 min", reason: "Test current retention level before reinforcing" },
          { action: "Targeted Review", mode: "focus", duration: "10 min", reason: "Strengthen gaps identified in recall check" },
          { action: "Application Practice", mode: "mock", duration: "5 min", reason: "Build application confidence with timed questions" },
        );
      } else {
        // Strong — maintenance sequence
        steps.push(
          { action: "Speed Recall", mode: "revision", duration: "2 min", reason: "Maintain fast retrieval speed for this topic" },
          { action: "Challenge Mode", mode: "mock", duration: "5 min", reason: "Push boundaries with harder exam-level questions" },
          { action: "Cross-Topic Links", mode: "focus", duration: "5 min", reason: "Connect to related concepts for deeper mastery" },
        );
      }

      setStrategy(steps);
      setStrategyLoading(false);
    }, 600);
  };

  const startMode = (mode: string) => {
    if (mode === "focus") setFocusOpen(true);
    else if (mode === "revision") setRevisionOpen(true);
    else if (mode === "mock") setMockOpen(true);
  };

  // ─── Empty state ───
  if (!loading && subjects.length === 0) {
    return (
      <div className="rounded-2xl border border-border bg-card p-6 text-center space-y-2">
        <BookOpen className="w-8 h-8 text-muted-foreground mx-auto" />
        <p className="text-sm font-medium text-foreground">No subjects yet</p>
        <p className="text-xs text-muted-foreground">Add topics via the AI Curriculum Generator to explore them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {loading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-primary" />
        </div>
      ) : (
        subjects.map((sub) => {
          const stats = getSubjectStats(sub);
          const isExpanded = expandedSubject === sub.id;

          return (
            <motion.div
              key={sub.id}
              layout
              className="rounded-2xl border border-border bg-card overflow-hidden"
            >
              {/* Subject Row */}
              <button
                onClick={() => setExpandedSubject(isExpanded ? null : sub.id)}
                className="w-full flex items-center gap-3 p-4 hover:bg-secondary/30 transition-colors text-left group"
              >
                <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <BookOpen className="w-4.5 h-4.5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="text-[13px] font-semibold text-foreground truncate group-hover:text-primary transition-colors">
                    {sub.name}
                  </h4>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[10px] text-muted-foreground">{sub.topics.length} topics</span>
                    {stats.atRisk > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-destructive/15 text-destructive font-medium">
                        {stats.atRisk} at risk
                      </span>
                    )}
                    {stats.mastered > 0 && (
                      <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-success/15 text-success font-medium">
                        {stats.mastered} mastered
                      </span>
                    )}
                  </div>
                </div>
                {/* Avg stability ring */}
                <div className="relative w-9 h-9 shrink-0">
                  <svg className="w-9 h-9 -rotate-90" viewBox="0 0 36 36">
                    <circle cx="18" cy="18" r="14" fill="none" stroke="hsl(var(--secondary))" strokeWidth="3" />
                    <circle
                      cx="18" cy="18" r="14" fill="none"
                      stroke={stats.avg < 0.4 ? "hsl(var(--destructive))" : stats.avg < 0.7 ? "hsl(var(--warning))" : "hsl(var(--success))"}
                      strokeWidth="3" strokeLinecap="round"
                      strokeDasharray={`${stats.avg * 88} 88`}
                    />
                  </svg>
                  <span className="absolute inset-0 flex items-center justify-center text-[8px] font-bold text-foreground">
                    {Math.round(stats.avg * 100)}
                  </span>
                </div>
                <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronDown className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>

              {/* Topics list */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 space-y-1.5">
                      {sub.topics.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center py-3">No topics in this subject</p>
                      ) : (
                        sub.topics.map((topic) => {
                          const pct = Math.round(topic.memory_strength * 100);
                          const isActionsOpen = showActions === topic.id;
                          const isHealthOpen = selectedTopic?.id === topic.id;

                          return (
                            <div key={topic.id} className="rounded-xl border border-border/50 bg-background/50 overflow-hidden">
                              {/* Topic row */}
                              <button
                                onClick={() => {
                                  setShowActions(isActionsOpen ? null : topic.id);
                                  setSelectedTopic(isHealthOpen ? null : topic);
                                }}
                                className="w-full flex items-center gap-2.5 p-3 hover:bg-secondary/20 transition-colors text-left group"
                              >
                                {/* Stability dot */}
                                <div className={`w-2 h-2 rounded-full shrink-0 ${stabilityBg(topic.memory_strength)}`} />
                                <div className="flex-1 min-w-0">
                                  <span className="text-xs font-medium text-foreground truncate block group-hover:text-primary transition-colors">
                                    {topic.name}
                                  </span>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <span className={`text-[9px] font-semibold ${stabilityColor(topic.memory_strength)}`}>
                                      {pct}% stable
                                    </span>
                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-medium ${riskBadge(topic.memory_strength)}`}>
                                      {riskLabel(topic.memory_strength)}
                                    </span>
                                  </div>
                                </div>
                                {/* Mini bar */}
                                <div className="w-12 h-1.5 bg-secondary rounded-full overflow-hidden shrink-0">
                                  <div className={`h-full rounded-full ${stabilityBg(topic.memory_strength)}`} style={{ width: `${pct}%` }} />
                                </div>
                                <motion.div animate={{ rotate: isActionsOpen ? 90 : 0 }} transition={{ duration: 0.15 }}>
                                  <ChevronRight className="w-3.5 h-3.5 text-muted-foreground/50" />
                                </motion.div>
                              </button>

                              {/* Expanded: Health + Actions */}
                              <AnimatePresence>
                                {isActionsOpen && (
                                  <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2 }}
                                    className="overflow-hidden border-t border-border/30"
                                  >
                                    {/* Health Dashboard */}
                                    <TopicHealthDashboard topic={topic} />

                                    {/* Action Buttons */}
                                    <div className="px-3 pb-3 space-y-2">
                                      <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-semibold">AI Actions</p>
                                      <div className="grid grid-cols-3 gap-2">
                                        {[
                                          { label: "Deep Focus", icon: Crosshair, mode: "focus", color: "bg-primary/10 text-primary" },
                                          { label: "AI Revision", icon: Brain, mode: "revision", color: "bg-accent/10 text-accent" },
                                          { label: "Mock Test", icon: Target, mode: "mock", color: "bg-warning/10 text-warning" },
                                        ].map((action) => (
                                          <motion.button
                                            key={action.mode}
                                            whileTap={{ scale: 0.95 }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              startMode(action.mode);
                                            }}
                                            className={`flex flex-col items-center gap-1.5 p-2.5 rounded-xl border border-border/50 hover:border-primary/30 transition-all ${action.color}`}
                                          >
                                            <action.icon className="w-4 h-4" />
                                            <span className="text-[9px] font-semibold">{action.label}</span>
                                          </motion.button>
                                        ))}
                                      </div>

                                      {/* Smart Strategy Button */}
                                      <motion.button
                                        whileTap={{ scale: 0.97 }}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          generateStrategy(topic);
                                        }}
                                        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold hover:opacity-90 transition-opacity"
                                        style={{ boxShadow: "0 2px 12px hsl(var(--primary) / 0.25)" }}
                                      >
                                        <Route className="w-3.5 h-3.5" />
                                        Generate Smart Strategy
                                      </motion.button>
                                    </div>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })
      )}

      {/* ─── Smart Strategy Panel ─── */}
      <AnimatePresence>
        {strategyTopic && (
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 16 }}
            className="rounded-2xl border border-primary/20 bg-card p-4 space-y-3"
            style={{ boxShadow: "0 0 24px hsl(var(--primary) / 0.08)" }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
                  <Route className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-foreground">Smart Strategy</h4>
                  <p className="text-[10px] text-muted-foreground">{strategyTopic.name}</p>
                </div>
              </div>
              <button onClick={() => setStrategyTopic(null)} className="text-[10px] text-muted-foreground hover:text-foreground">
                Close
              </button>
            </div>

            {strategyLoading ? (
              <div className="flex items-center justify-center py-4">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
                <span className="text-xs text-muted-foreground ml-2">AI planning optimal sequence...</span>
              </div>
            ) : (
              <div className="space-y-2">
                {strategy.map((step, i) => (
                  <motion.div
                    key={i}
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className="flex items-center gap-3 group"
                  >
                    {/* Step number */}
                    <div className="w-6 h-6 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-primary">{i + 1}</span>
                    </div>
                    {/* Step content */}
                    <div className="flex-1 rounded-xl border border-border/50 bg-background/50 p-2.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-semibold text-foreground">{step.action}</span>
                        <span className="text-[9px] text-muted-foreground flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5" />
                          {step.duration}
                        </span>
                      </div>
                      <p className="text-[9px] text-muted-foreground mt-0.5">{step.reason}</p>
                    </div>
                    {/* Start button */}
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={() => startMode(step.mode)}
                      className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors shrink-0"
                    >
                      <ArrowRight className="w-3.5 h-3.5 text-primary" />
                    </motion.button>
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── Study Mode Modals ─── */}
      <FocusModeSession open={focusOpen} onClose={() => setFocusOpen(false)} onSessionComplete={() => { fetchData(); window.dispatchEvent(new Event("insights-refresh")); }} />
      <LazyModeSession open={revisionOpen} onClose={() => setRevisionOpen(false)} onSessionComplete={() => { fetchData(); window.dispatchEvent(new Event("insights-refresh")); }} />
      <MockPracticeSession open={mockOpen} onClose={() => setMockOpen(false)} onSessionComplete={() => { fetchData(); window.dispatchEvent(new Event("insights-refresh")); }} />
    </div>
  );
};

export default DeepTopicExplorer;
