import { useEffect, useState, useCallback, Component, type ReactNode, type ErrorInfo } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Activity, Network, Clock, Layers, RefreshCw, ChevronRight, AlertTriangle, TrendingDown, Play, Sparkles, Shield, Flame } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoryEngine } from "@/hooks/useMemoryEngine";
import { setCache, getCache } from "@/lib/offlineCache";
import KnowledgeGraph from "./KnowledgeGraph";
import BrainHealthSparkline from "./BrainHealthSparkline";
import StudyPlanGenerator from "./StudyPlanGenerator";
import MultiSourceSync from "./MultiSourceSync";
import PassiveLearning from "./PassiveLearning";
import FocusModeSession from "./FocusModeSession";
import { formatDistanceToNow, isPast, isToday } from "date-fns";

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

// --- Animated ring component ---
const BrainRing = ({ value, size = 140 }: { value: number; size?: number }) => {
  const r = (size - 12) / 2;
  const circ = 2 * Math.PI * r;
  const color = value > 70 ? "hsl(var(--success))" : value > 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";
  const emoji = value > 70 ? "💪" : value > 50 ? "⚡" : "🧠";

  return (
    <div className="relative mx-auto" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="hsl(var(--secondary))" strokeWidth="8" />
        <motion.circle
          cx={size / 2} cy={size / 2} r={r} fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circ}
          initial={{ strokeDashoffset: circ }}
          animate={{ strokeDashoffset: circ * (1 - value / 100) }}
          transition={{ duration: 1.5, ease: "easeOut", delay: 0.2 }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <motion.span
          className="text-3xl font-bold text-foreground"
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.5, type: "spring", stiffness: 200 }}
        >
          {value > 0 ? `${value}%` : "—"}
        </motion.span>
        <span className="text-lg mt-0.5">{emoji}</span>
      </div>
    </div>
  );
};

// --- Subject card ---
const SubjectCard = ({ sub, index, onReview }: { sub: SubjectHealthData; index: number; onReview: (s: string, t: string) => void }) => {
  const [open, setOpen] = useState(false);
  const atRisk = sub.topics.filter(t => t.next_predicted_drop_date && (isPast(new Date(t.next_predicted_drop_date)) || isToday(new Date(t.next_predicted_drop_date)))).length;
  const color = sub.strength > 70 ? "success" : sub.strength > 50 ? "warning" : "destructive";

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 + index * 0.06 }}
      className="glass rounded-xl neural-border overflow-hidden"
    >
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/20 transition-colors"
      >
        {/* Strength badge */}
        <div className={`w-11 h-11 rounded-xl bg-${color}/10 border border-${color}/30 flex items-center justify-center shrink-0`}>
          <span className={`text-sm font-bold text-${color}`}>{sub.strength}%</span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <p className="text-sm font-semibold text-foreground truncate">{sub.name}</p>
            {atRisk > 0 && (
              <span className="flex items-center gap-0.5 text-[9px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
                <Flame className="w-2.5 h-2.5" />
                {atRisk}
              </span>
            )}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{sub.topicCount} topic{sub.topicCount !== 1 ? "s" : ""}</p>
          {/* Mini progress */}
          <div className="h-1.5 rounded-full bg-secondary mt-1.5">
            <motion.div
              className={`h-full rounded-full bg-${color}`}
              initial={{ width: 0 }}
              animate={{ width: `${sub.strength}%` }}
              transition={{ duration: 0.8, delay: 0.2 + index * 0.06 }}
            />
          </div>
        </div>

        <motion.div animate={{ rotate: open ? 90 : 0 }} transition={{ duration: 0.2 }}>
          <ChevronRight className="w-4 h-4 text-muted-foreground" />
        </motion.div>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2">
              {sub.topics.length === 0 ? (
                <p className="text-[10px] text-muted-foreground text-center py-2">No topics yet</p>
              ) : (
                sub.topics.map((topic, ti) => {
                  const s = topic.memory_strength;
                  const dropDate = topic.next_predicted_drop_date ? new Date(topic.next_predicted_drop_date) : null;
                  const isOverdue = dropDate ? isPast(dropDate) : false;
                  const isDue = dropDate ? isToday(dropDate) : false;
                  const needsReview = isOverdue || isDue;
                  const tColor = s > 70 ? "success" : s > 50 ? "warning" : "destructive";

                  return (
                    <motion.div
                      key={topic.id}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: ti * 0.04 }}
                      className={`p-3 rounded-lg border transition-colors ${
                        needsReview
                          ? "bg-destructive/5 border-destructive/20"
                          : "bg-secondary/20 border-border/50"
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-1.5">
                        <div className={`w-2 h-2 rounded-full bg-${tColor} shrink-0`} />
                        <span className="text-xs font-medium text-foreground truncate flex-1">{topic.name}</span>
                        <span className={`text-[10px] font-bold text-${tColor}`}>{s}%</span>
                      </div>

                      <div className="h-1 rounded-full bg-secondary">
                        <motion.div
                          className={`h-full rounded-full bg-${tColor}`}
                          initial={{ width: 0 }}
                          animate={{ width: `${s}%` }}
                          transition={{ duration: 0.5, delay: ti * 0.04 }}
                        />
                      </div>

                      <div className="flex items-center justify-between mt-2">
                        {dropDate ? (
                          <span className={`text-[10px] flex items-center gap-1 ${
                            isOverdue ? "text-destructive" : isDue ? "text-warning" : "text-muted-foreground"
                          }`}>
                            <TrendingDown className="w-3 h-3" />
                            {isOverdue
                              ? `Overdue ${formatDistanceToNow(dropDate)}`
                              : isDue ? "Due today"
                              : `In ${formatDistanceToNow(dropDate)}`}
                          </span>
                        ) : (
                          <span className="text-[10px] text-muted-foreground">Stable</span>
                        )}

                        {needsReview && (
                          <motion.button
                            whileTap={{ scale: 0.92 }}
                            onClick={(e) => { e.stopPropagation(); onReview(sub.name, topic.name); }}
                            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-primary text-primary-foreground text-[10px] font-semibold hover:opacity-90 transition-opacity"
                          >
                            <Play className="w-2.5 h-2.5" />
                            Review
                          </motion.button>
                        )}
                      </div>
                    </motion.div>
                  );
                })
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// --- Feature card ---
const FeatureCard = ({ icon: Icon, label, desc, active, onClick, delay }: { icon: any; label: string; desc: string; active: boolean; onClick: () => void; delay: number }) => (
  <motion.button
    initial={{ opacity: 0, scale: 0.9 }}
    animate={{ opacity: 1, scale: 1 }}
    transition={{ delay, type: "spring", stiffness: 200 }}
    whileTap={{ scale: 0.95 }}
    onClick={onClick}
    className={`glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left ${active ? "ring-1 ring-primary bg-primary/5" : ""}`}
  >
    <div className={`w-9 h-9 rounded-lg flex items-center justify-center mb-2 ${active ? "bg-primary/20" : "bg-secondary/50"}`}>
      <Icon className={`w-4.5 h-4.5 ${active ? "text-primary" : "text-muted-foreground"}`} />
    </div>
    <p className="text-xs font-semibold text-foreground">{label}</p>
    <p className="text-[10px] text-muted-foreground mt-0.5">{desc}</p>
  </motion.button>
);

// --- Main component ---
const BrainTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { prediction, loading, predict } = useMemoryEngine();
  const [subjectHealth, setSubjectHealth] = useState<SubjectHealthData[]>([]);
  const [showGraph, setShowGraph] = useState(false);
  const [showBrainPlan, setShowBrainPlan] = useState(false);
  const [showMultiSync, setShowMultiSync] = useState(false);
  const [showPassiveLearning, setShowPassiveLearning] = useState(false);
  const [reviewSession, setReviewSession] = useState<{ subject: string; topic: string } | null>(null);

  useEffect(() => {
    try {
      const cached = getCache<SubjectHealthData[]>("brain-subject-health");
      if (cached && Array.isArray(cached)) setSubjectHealth(cached);
    } catch {}
  }, []);

  const loadSubjectHealth = useCallback(async () => {
    if (!user) return;
    try {
      const { data: subjects } = await supabase.from("subjects").select("id, name").eq("user_id", user.id);
      if (!subjects || subjects.length === 0) { setSubjectHealth([]); return; }

      const health: SubjectHealthData[] = [];
      for (const sub of subjects) {
        const { data: topics } = await supabase
          .from("topics")
          .select("id, name, memory_strength, next_predicted_drop_date, last_revision_date")
          .eq("user_id", user.id)
          .eq("subject_id", sub.id)
          .order("memory_strength", { ascending: true });

        const topicCount = topics?.length || 0;
        const avgStrength = topicCount > 0
          ? Math.round(topics!.reduce((s, t) => s + Number(t.memory_strength), 0) / topicCount)
          : 0;

        health.push({
          id: sub.id, name: sub.name, strength: avgStrength, topicCount,
          topics: (topics || []).map(t => ({ ...t, memory_strength: Number(t.memory_strength) })),
        });
      }
      // Sort: weakest first
      health.sort((a, b) => a.strength - b.strength);
      setSubjectHealth(health);
      setCache("brain-subject-health", health);
    } catch (e) {
      console.error("BrainTab loadSubjectHealth error:", e);
    }
  }, [user]);

  const refreshAll = useCallback(async () => {
    try { await predict(); } catch {}
    try { await loadSubjectHealth(); } catch {}
  }, [predict, loadSubjectHealth]);

  useEffect(() => { if (user) refreshAll(); }, [user]);

  useEffect(() => {
    if (!user) return;
    const channel = supabase
      .channel("brain-tab-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "topics", filter: `user_id=eq.${user.id}` }, () => loadSubjectHealth())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "study_logs", filter: `user_id=eq.${user.id}` }, () => refreshAll())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [user, loadSubjectHealth, refreshAll]);

  const overallHealth = prediction?.overall_health ?? 0;
  const hasData = subjectHealth.length > 0;
  const totalAtRisk = subjectHealth.reduce((acc, s) => acc + s.topics.filter(t => t.next_predicted_drop_date && (isPast(new Date(t.next_predicted_drop_date)) || isToday(new Date(t.next_predicted_drop_date)))).length, 0);
  const totalTopics = subjectHealth.reduce((acc, s) => acc + s.topicCount, 0);

  return (
    <div className="px-6 py-6 space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-6 h-6 text-primary" />
            Brain Health
          </h1>
          <p className="text-muted-foreground text-xs mt-1">How strong is your memory network</p>
        </div>
        <motion.button
          whileTap={{ scale: 0.9 }}
          onClick={refreshAll}
          disabled={loading}
          className="p-2.5 rounded-xl glass neural-border hover:glow-primary transition-all disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </motion.button>
      </motion.div>

      {/* Score Card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass rounded-2xl p-6 neural-border"
      >
        <BrainRing value={hasData ? overallHealth : 0} />

        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          className="text-center text-sm text-muted-foreground mt-4"
        >
          {!hasData ? "Start studying to activate your brain map" :
            overallHealth > 70 ? "Your memory is firing on all cylinders!" :
            overallHealth > 50 ? "Decent retention — some areas need work" :
            "Several topics are fading — time to review!"
          }
        </motion.p>

        {/* Quick stats */}
        {hasData && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1 }}
            className="flex justify-center gap-6 mt-4"
          >
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{subjectHealth.length}</p>
              <p className="text-[10px] text-muted-foreground">Subjects</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className="text-lg font-bold text-foreground">{totalTopics}</p>
              <p className="text-[10px] text-muted-foreground">Topics</p>
            </div>
            <div className="w-px bg-border" />
            <div className="text-center">
              <p className={`text-lg font-bold ${totalAtRisk > 0 ? "text-destructive" : "text-success"}`}>{totalAtRisk}</p>
              <p className="text-[10px] text-muted-foreground">At Risk</p>
            </div>
          </motion.div>
        )}

        {/* 7-Day Sparkline */}
        {hasData && <BrainHealthSparkline />}
      </motion.div>

      {/* Section: Subjects */}
      {hasData && (
        <div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.15 }}
            className="flex items-center gap-2 mb-3"
          >
            <Activity className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Subject Breakdown</h2>
            <span className="text-[10px] text-muted-foreground ml-auto">Tap to expand</span>
          </motion.div>
          <div className="space-y-3">
            {subjectHealth.map((sub, i) => (
              <SubjectCard
                key={sub.id}
                sub={sub}
                index={i}
                onReview={(s, t) => setReviewSession({ subject: s, topic: t })}
              />
            ))}
          </div>
        </div>
      )}

      {!hasData && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass rounded-xl p-8 neural-border text-center"
        >
          <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
          <p className="text-sm text-foreground font-medium">No subjects tracked yet</p>
          <p className="text-[10px] text-muted-foreground mt-1">Log a study session from the Home tab to see your brain health here.</p>
        </motion.div>
      )}

      {/* Tools Grid */}
      <div>
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="flex items-center gap-2 mb-3"
        >
          <Shield className="w-4 h-4 text-primary" />
          <h2 className="text-sm font-semibold text-foreground">Brain Tools</h2>
        </motion.div>
        <div className="grid grid-cols-2 gap-3">
          <FeatureCard icon={Network} label="Knowledge Graph" desc="Visual brain map" active={showGraph} onClick={() => setShowGraph(v => !v)} delay={0.3} />
          <FeatureCard icon={Brain} label="Brain Plan" desc="AI auto schedule" active={showBrainPlan} onClick={() => setShowBrainPlan(true)} delay={0.35} />
          <FeatureCard icon={Layers} label="Multi-Source Sync" desc="PDF, YouTube, Notes" active={showMultiSync} onClick={() => setShowMultiSync(true)} delay={0.4} />
          <FeatureCard icon={Clock} label="Passive Learning" desc="Auto detection" active={showPassiveLearning} onClick={() => setShowPassiveLearning(true)} delay={0.45} />
        </div>
      </div>

      {/* Modals & Panels */}
      {showGraph && <KnowledgeGraph onClose={() => setShowGraph(false)} />}

      {showBrainPlan && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl neural-border p-1"
          >
            <StudyPlanGenerator />
            <button onClick={() => setShowBrainPlan(false)} className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Close
            </button>
          </motion.div>
        </div>
      )}

      {showMultiSync && <MultiSourceSync onClose={() => setShowMultiSync(false)} onSynced={() => refreshAll()} />}
      {showPassiveLearning && <PassiveLearning onClose={() => setShowPassiveLearning(false)} />}

      <FocusModeSession
        open={!!reviewSession}
        onClose={() => { setReviewSession(null); refreshAll(); }}
        onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))}
        initialSubject={reviewSession?.subject}
        initialTopic={reviewSession?.topic}
      />
    </div>
  );
};

class BrainTabErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean; error: string }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false, error: "" };
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message };
  }
  componentDidCatch(error: Error, info: any) {
    console.error("BrainTab crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-12 text-center space-y-3">
          <Brain className="w-8 h-8 text-destructive mx-auto" />
          <h2 className="text-foreground font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{this.state.error}</p>
          <button onClick={() => this.setState({ hasError: false, error: "" })} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium">
            Try Again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

const BrainTabWithErrorBoundary = () => (
  <BrainTabErrorBoundary>
    <BrainTab />
  </BrainTabErrorBoundary>
);

export default BrainTabWithErrorBoundary;
