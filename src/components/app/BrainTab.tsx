import { useEffect, useState, useCallback, Component, type ReactNode, type ErrorInfo } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Activity, Network, Clock, Layers, RefreshCw, ChevronDown, ChevronUp, AlertTriangle, TrendingDown, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoryEngine } from "@/hooks/useMemoryEngine";
import { setCache, getCache } from "@/lib/offlineCache";
import KnowledgeGraph from "./KnowledgeGraph";
import StudyPlanGenerator from "./StudyPlanGenerator";
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
const BrainTab = () => {
  const { toast } = useToast();
  const { user } = useAuth();
  const { prediction, loading, error: memoryError, predict } = useMemoryEngine();
  const [subjectHealth, setSubjectHealth] = useState<SubjectHealthData[]>([]);
  const [showGraph, setShowGraph] = useState(false);
  const [showBrainPlan, setShowBrainPlan] = useState(false);
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);
  const [reviewSession, setReviewSession] = useState<{ subject: string; topic: string } | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Load cached data on mount
  useEffect(() => {
    try {
      const cached = getCache<SubjectHealthData[]>("brain-subject-health");
      if (cached && Array.isArray(cached)) {
        setSubjectHealth(cached);
      }
    } catch (e) {
      console.error("BrainTab cache error:", e);
    }
  }, []);

  const loadSubjectHealth = useCallback(async () => {
    if (!user) return;
    try {
      const { data: subjects } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id);

      if (!subjects || subjects.length === 0) {
        setSubjectHealth([]);
        return;
      }

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
          ? Math.round((topics!.reduce((s, t) => s + Number(t.memory_strength), 0) / topicCount))
          : 0;

        health.push({
          id: sub.id,
          name: sub.name,
          strength: avgStrength,
          topicCount,
          topics: (topics || []).map(t => ({
            ...t,
            memory_strength: Number(t.memory_strength),
          })),
        });
      }
      setSubjectHealth(health);
      setCache("brain-subject-health", health);
    } catch (e) {
      console.error("BrainTab loadSubjectHealth error:", e);
      setLoadError("Failed to load subject data");
    }
  }, [user]);

  const refreshAll = useCallback(async () => {
    setLoadError(null);
    try {
      await predict();
    } catch (e) {
      console.error("BrainTab predict error:", e);
    }
    try {
      await loadSubjectHealth();
    } catch (e) {
      console.error("BrainTab loadSubjectHealth error:", e);
      setLoadError("Failed to load data");
    }
  }, [predict, loadSubjectHealth]);

  useEffect(() => {
    if (user) {
      refreshAll();
    }
  }, [user]);

  // Realtime subscription for topic/study_log changes
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel("brain-tab-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "topics", filter: `user_id=eq.${user.id}` },
        () => loadSubjectHealth()
      )
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "study_logs", filter: `user_id=eq.${user.id}` },
        () => refreshAll()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user, loadSubjectHealth, refreshAll]);

  const overallHealth = prediction?.overall_health ?? 0;
  const hasData = subjectHealth.length > 0;

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brain Dashboard</h1>
          <p className="text-muted-foreground text-sm mt-1">Your cognitive health at a glance.</p>
        </div>
        <button onClick={refreshAll} disabled={loading} className="p-2 rounded-lg neural-gradient neural-border hover:glow-primary transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* Overall Brain Score */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass rounded-2xl p-6 neural-border text-center">
        <div className="relative w-32 h-32 mx-auto mb-4">
          <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90">
            <circle cx="50" cy="50" r="42" fill="none" stroke="hsl(222, 30%, 16%)" strokeWidth="6" />
            <motion.circle
              cx="50" cy="50" r="42" fill="none"
              stroke="hsl(175, 80%, 50%)"
              strokeWidth="6"
              strokeLinecap="round"
              strokeDasharray={264}
              initial={{ strokeDashoffset: 264 }}
              animate={{ strokeDashoffset: 264 * (1 - overallHealth / 100) }}
              transition={{ duration: 1.5, delay: 0.3 }}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="text-3xl font-bold gradient-text">{hasData ? `${overallHealth}%` : "—"}</span>
            <span className="text-[10px] text-muted-foreground">Brain Health</span>
          </div>
        </div>
        <p className="text-sm text-muted-foreground">
          {!hasData ? "Log study sessions to see your brain health" :
            overallHealth > 70 ? "Your memory network is strong 💪" :
            overallHealth > 50 ? <span>Your memory network is <span className="text-warning font-medium">moderately strong</span></span> :
            <span>Your memory network <span className="text-destructive font-medium">needs attention</span></span>
          }
        </p>
      </motion.div>

      {/* Memory Health by Subject */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Memory Health</h2>
        </div>
        {hasData ? (
          <div className="space-y-3">
            {subjectHealth.map((sub, i) => {
              const isExpanded = expandedSubject === sub.id;
              const atRiskCount = sub.topics.filter(t => {
                if (!t.next_predicted_drop_date) return false;
                return isPast(new Date(t.next_predicted_drop_date)) || isToday(new Date(t.next_predicted_drop_date));
              }).length;

              return (
                <div key={sub.id}>
                  <button
                    onClick={() => setExpandedSubject(isExpanded ? null : sub.id)}
                    className={`w-full text-left p-3 rounded-lg transition-colors ${isExpanded ? "bg-secondary/50" : "hover:bg-secondary/30"}`}
                  >
                    <div className="flex justify-between items-center mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-foreground font-medium">{sub.name}</span>
                        {atRiskCount > 0 && (
                          <span className="flex items-center gap-0.5 text-[9px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full">
                            <AlertTriangle className="w-2.5 h-2.5" />
                            {atRiskCount} at risk
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-medium ${
                          sub.strength > 70 ? "text-success" :
                          sub.strength > 50 ? "text-warning" : "text-destructive"
                        }`}>{sub.strength}%</span>
                        {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
                      </div>
                    </div>
                    <div className="h-2 rounded-full bg-secondary">
                      <motion.div
                        className={`h-full rounded-full ${
                          sub.strength > 70 ? "bg-success" :
                          sub.strength > 50 ? "bg-warning" : "bg-destructive"
                        }`}
                        initial={{ width: 0 }}
                        animate={{ width: `${sub.strength}%` }}
                        transition={{ duration: 1, delay: 0.3 + i * 0.1 }}
                      />
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">{sub.topicCount} topics tracked</p>
                  </button>

                  <AnimatePresence>
                    {isExpanded && sub.topics.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="ml-3 pl-3 border-l-2 border-border space-y-2 py-2">
                          {sub.topics.map((topic) => {
                            const strength = topic.memory_strength;
                            const dropDate = topic.next_predicted_drop_date ? new Date(topic.next_predicted_drop_date) : null;
                            const isOverdue = dropDate ? isPast(dropDate) : false;
                            const isDueToday = dropDate ? isToday(dropDate) : false;
                            const lastRevised = topic.last_revision_date ? new Date(topic.last_revision_date) : null;

                            return (
                              <div key={topic.id} className="p-2.5 rounded-lg bg-secondary/20 border border-border/50">
                                <div className="flex items-center justify-between mb-1.5">
                                  <span className="text-xs text-foreground font-medium truncate flex-1">{topic.name}</span>
                                  <span className={`text-[10px] font-bold ml-2 ${
                                    strength > 70 ? "text-success" :
                                    strength > 50 ? "text-warning" : "text-destructive"
                                  }`}>{strength}%</span>
                                </div>

                                {/* Strength bar */}
                                <div className="h-1.5 rounded-full bg-secondary mb-2">
                                  <motion.div
                                    className={`h-full rounded-full ${
                                      strength > 70 ? "bg-success" :
                                      strength > 50 ? "bg-warning" : "bg-destructive"
                                    }`}
                                    initial={{ width: 0 }}
                                    animate={{ width: `${strength}%` }}
                                    transition={{ duration: 0.6 }}
                                  />
                                </div>

                                {/* Decay prediction & Review Now */}
                                <div className="flex items-center justify-between">
                                  {dropDate ? (
                                    <div className="flex items-center gap-1">
                                      <TrendingDown className={`w-3 h-3 ${isOverdue || isDueToday ? "text-destructive" : "text-muted-foreground"}`} />
                                      <span className={`text-[10px] ${
                                        isOverdue ? "text-destructive font-medium" :
                                        isDueToday ? "text-warning font-medium" : "text-muted-foreground"
                                      }`}>
                                        {isOverdue
                                          ? `Overdue by ${formatDistanceToNow(dropDate)}`
                                          : isDueToday
                                          ? "Review due today"
                                          : `Drops in ${formatDistanceToNow(dropDate)}`}
                                      </span>
                                    </div>
                                  ) : (
                                    <span className="text-[10px] text-muted-foreground">No decay prediction</span>
                                  )}

                                  <div className="flex items-center gap-2">
                                    {lastRevised && (
                                      <span className="text-[9px] text-muted-foreground">
                                        {formatDistanceToNow(lastRevised, { addSuffix: true })}
                                      </span>
                                    )}
                                    {(isOverdue || isDueToday) && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setReviewSession({ subject: sub.name, topic: topic.name });
                                        }}
                                        className="flex items-center gap-1 px-2 py-1 rounded-md bg-primary/10 border border-primary/30 text-primary hover:bg-primary/20 transition-colors"
                                      >
                                        <Play className="w-2.5 h-2.5" />
                                        <span className="text-[9px] font-semibold">Review Now</span>
                                      </button>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                    {isExpanded && sub.topics.length === 0 && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <p className="ml-3 pl-3 border-l-2 border-border text-[10px] text-muted-foreground py-2">
                          No topics added yet
                        </p>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">No subjects tracked yet.</p>
        )}
      </motion.div>

      {/* Knowledge Graph */}
      {showGraph && (
        <KnowledgeGraph onClose={() => setShowGraph(false)} />
      )}

      {/* Features Grid */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="grid grid-cols-2 gap-3">
        <button onClick={() => setShowGraph((v) => !v)} className={`glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left ${showGraph ? "ring-1 ring-primary" : ""}`}>
          <Network className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Knowledge Graph</p>
          <p className="text-[10px] text-muted-foreground">Visual brain map</p>
        </button>
        <button onClick={() => setShowBrainPlan(true)} className={`glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left ${showBrainPlan ? "ring-1 ring-primary" : ""}`}>
          <Brain className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Brain Plan</p>
          <p className="text-[10px] text-muted-foreground">AI auto schedule</p>
        </button>
        <button onClick={() => toast({ title: "Coming Soon 🚀", description: "Multi-Source Sync will let you import from PDFs, YouTube, and notes automatically." })} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <Layers className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Multi-Source Sync</p>
          <p className="text-[10px] text-muted-foreground">PDF, YouTube, Notes</p>
        </button>
        <button onClick={() => toast({ title: "Coming Soon 🚀", description: "Passive Learning will auto-detect your study activity and log it for you." })} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all text-left cursor-pointer">
          <Clock className="w-5 h-5 text-primary mb-2" />
          <p className="text-sm font-medium text-foreground">Passive Learning</p>
          <p className="text-[10px] text-muted-foreground">Auto detection</p>
        </button>
      </motion.div>

      {/* Study Plan Generator from Brain Plan */}
      {showBrainPlan && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl neural-border p-1">
            <StudyPlanGenerator />
            <button
              onClick={() => setShowBrainPlan(false)}
              className="w-full py-2.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Focus session from Review Now */}
      <FocusModeSession
        open={!!reviewSession}
        onClose={() => {
          setReviewSession(null);
          refreshAll();
        }}
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
  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("BrainTab crash:", error, info);
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="px-6 py-12 text-center space-y-3">
          <Brain className="w-8 h-8 text-destructive mx-auto" />
          <h2 className="text-foreground font-semibold">Something went wrong</h2>
          <p className="text-sm text-muted-foreground">{this.state.error}</p>
          <button
            onClick={() => this.setState({ hasError: false, error: "" })}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium"
          >
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
