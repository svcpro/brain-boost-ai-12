import { useEffect, useState, useCallback, Component, type ReactNode } from "react";
import { useToast } from "@/hooks/use-toast";
import { motion } from "framer-motion";
import { Brain, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useMemoryEngine } from "@/hooks/useMemoryEngine";
import { setCache, getCache } from "@/lib/offlineCache";

import { isPast, isToday } from "date-fns";

// Section components
import BrainStabilityOverview from "./brain/BrainStabilityOverview";
import InteractiveMemoryMap from "./brain/InteractiveMemoryMap";
import DecayForecastTimeline from "./brain/DecayForecastTimeline";
import AIIntelligenceInsights from "./brain/AIIntelligenceInsights";
import BrainEvolutionHistory from "./brain/BrainEvolutionHistory";

// Modals
import FocusModeSession from "./FocusModeSession";
import AITopicManager from "./AITopicManager";

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
  const { prediction, loading, predict } = useMemoryEngine();
  const [subjectHealth, setSubjectHealth] = useState<SubjectHealthData[]>([]);
  const [reviewSession, setReviewSession] = useState<{ subject: string; topic: string } | null>(null);
  const [showAITopicManager, setShowAITopicManager] = useState(false);

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
    <div className="px-5 py-6 space-y-6 max-w-lg mx-auto">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Brain className="w-5 h-5 text-primary" />
            Brain Intelligence
          </h1>
          <p className="text-muted-foreground text-[10px] mt-0.5">Your cognitive performance center</p>
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

      {/* ═══ SECTION 1: Brain Stability Overview ═══ */}
      <BrainStabilityOverview
        overallHealth={hasData ? overallHealth : 0}
        totalTopics={totalTopics}
        totalAtRisk={totalAtRisk}
        totalSubjects={subjectHealth.length}
        hasData={hasData}
        subjectHealth={subjectHealth}
        onBoostSession={(s, t) => setReviewSession({ subject: s, topic: t })}
      />

      {/* ═══ SECTION 2: Interactive Memory Map ═══ */}
      <InteractiveMemoryMap
        subjectHealth={subjectHealth}
        onReview={(s, t) => setReviewSession({ subject: s, topic: t })}
      />

      {/* ═══ SECTION 3: Decay Forecast Timeline ═══ */}
      <DecayForecastTimeline
        subjectHealth={subjectHealth}
        onPreventDecay={(s, t) => setReviewSession({ subject: s, topic: t })}
      />

      {/* ═══ SECTION 4: AI Intelligence Insights ═══ */}
      <AIIntelligenceInsights onAction={(s, t) => setReviewSession({ subject: s, topic: t })} />

      {/* ═══ SECTION 5: Brain Evolution History ═══ */}
      <BrainEvolutionHistory />

      {/* Empty state */}
      {!hasData && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <div
            className="rounded-2xl p-8 text-center"
            style={{
              background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
              border: "1px solid hsl(var(--border))",
            }}
          >
            <Sparkles className="w-8 h-8 text-primary/40 mx-auto mb-3" />
            <p className="text-sm text-foreground font-medium">No subjects tracked yet</p>
            <p className="text-[10px] text-muted-foreground mt-1 mb-4">
              Let AI generate your complete curriculum or log a study session to get started.
            </p>
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => setShowAITopicManager(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors"
              style={{ boxShadow: "0 4px 20px hsl(var(--primary) / 0.3)" }}
            >
              <Sparkles className="w-4 h-4" />
              AI Generate Curriculum
            </motion.button>
          </div>
        </motion.div>
      )}

      {/* ─── Modals ─── */}
      {showAITopicManager && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <motion.div
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="w-full max-w-lg max-h-[90vh] overflow-y-auto glass rounded-2xl neural-border p-5"
          >
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-bold text-foreground flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-primary" />
                AI Topic Manager
              </h2>
              <button onClick={() => setShowAITopicManager(false)} className="text-muted-foreground hover:text-foreground p-1 rounded-lg hover:bg-secondary transition-colors">
                ✕
              </button>
            </div>
            <AITopicManager mode="user" onDone={() => { setShowAITopicManager(false); refreshAll(); }} />
          </motion.div>
        </div>
      )}

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
