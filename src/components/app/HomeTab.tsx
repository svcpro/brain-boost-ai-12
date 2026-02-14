import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, AlertTriangle, Target, Calendar, CheckCircle, Wrench, RefreshCw, TrendingUp, AlertOctagon, Zap } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { useRankPrediction } from "@/hooks/useRankPrediction";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { setCache, getCache } from "@/lib/offlineCache";
import { useToast } from "@/hooks/use-toast";
import DailyGoalTracker from "./DailyGoalTracker";
import StreakTracker from "./StreakTracker";
import ReviewQueue from "./ReviewQueue";

interface HomeTabProps {
  onNavigateToEmergency?: () => void;
}

const HomeTab = ({ onNavigateToEmergency }: HomeTabProps) => {
  const { prediction, loading, predict, generateRecommendations } = useMemoryEngine();
  const { data: rankData, loading: rankLoading, predictRank } = useRankPrediction();
  const { user } = useAuth();
  const { toast } = useToast();
  const [recommendations, setRecommendations] = useState<any[]>(() => getCache("home-recommendations") || []);
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(() => getCache("home-exam-days"));

  useEffect(() => {
    predict();
    predictRank();
    loadRecommendations();
    loadExamDate();
  }, []);

  const loadRecommendations = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("ai_recommendations")
        .select("*")
        .eq("user_id", user.id)
        .eq("completed", false)
        .order("created_at", { ascending: false })
        .limit(5);
      const recs = data || [];
      setRecommendations(recs);
      setCache("home-recommendations", recs);
    } catch {
      // offline – cached data already loaded
    }
  };

  const loadExamDate = async () => {
    if (!user) return;
    try {
      const { data } = await supabase
        .from("profiles")
        .select("exam_date")
        .eq("id", user.id)
        .maybeSingle();
      if (data?.exam_date) {
        const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
        const val = Math.max(0, days);
        setExamDaysLeft(val);
        setCache("home-exam-days", val);
      }
    } catch {
      // offline – cached data already loaded
    }
  };

  const atRisk = prediction?.at_risk || [];
  const overallHealth = prediction?.overall_health ?? 0;
  const hasTopics = (prediction?.topics?.length ?? 0) > 0;

  const [analyzing, setAnalyzing] = useState(false);

  const handleRefresh = async () => {
    setAnalyzing(true);
    try {
      await Promise.all([predict(), predictRank()]);
      await generateRecommendations();
      await loadRecommendations();
      toast({ title: "✅ AI Analysis complete!", description: "Memory predictions and recommendations updated." });
    } catch {
      toast({ title: "Analysis failed", variant: "destructive" });
    } finally {
      setAnalyzing(false);
    }
  };

  return (
    <div className="px-6 py-6 space-y-6">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Brain Command Center</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {hasTopics ? "Your AI brain is active and monitoring." : "Log your first study session to activate AI."}
          </p>
        </div>
        <button onClick={handleRefresh} disabled={loading} className="p-2 rounded-lg neural-gradient neural-border hover:glow-primary transition-all disabled:opacity-50">
          <RefreshCw className={`w-4 h-4 text-primary ${loading ? "animate-spin" : ""}`} />
        </button>
      </motion.div>

      {/* Daily Goal */}
      <DailyGoalTracker />

      {/* Streak */}
      <StreakTracker />

      {/* Exam urgency banner — ≤3 days */}
      {examDaysLeft !== null && examDaysLeft <= 3 && (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="rounded-xl border border-destructive/30 bg-destructive/10 p-4"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-lg bg-destructive/20">
              <AlertOctagon className="w-5 h-5 text-destructive animate-pulse" />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-bold text-destructive">
                {examDaysLeft === 0 ? "Exam is TODAY!" : `Exam in ${examDaysLeft} day${examDaysLeft !== 1 ? "s" : ""}!`}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Activate Emergency Recovery for an AI-powered rescue plan to maximize your remaining time.
              </p>
              <button
                onClick={onNavigateToEmergency}
                className="mt-2.5 flex items-center gap-1.5 px-4 py-2 rounded-lg bg-destructive text-destructive-foreground text-xs font-semibold hover:opacity-90 transition-opacity active:scale-95"
              >
                <Zap className="w-3.5 h-3.5" />
                Activate Emergency Recovery
              </button>
            </div>
          </div>
        </motion.div>
      )}

      {/* Stats row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-3 gap-3">
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-[10px] text-muted-foreground">Brain</span>
          </div>
          <p className="text-xl font-bold gradient-text">{hasTopics ? `${overallHealth}%` : "—"}</p>
        </div>
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <TrendingUp className="w-4 h-4 text-success" />
            <span className="text-[10px] text-muted-foreground">Rank</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {rankData?.predicted_rank ? `#${rankData.predicted_rank.toLocaleString()}` : "—"}
          </p>
          {rankData?.rank_change !== undefined && rankData.rank_change !== 0 && (
            <span className={`text-[10px] flex items-center gap-0.5 ${rankData.rank_change > 0 ? "text-success" : "text-destructive"}`}>
              <TrendingUp className={`w-2.5 h-2.5 ${rankData.rank_change < 0 ? "rotate-180" : ""}`} />
              {rankData.rank_change > 0 ? "+" : ""}{rankData.rank_change.toLocaleString()}
            </span>
          )}
        </div>
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-warning" />
            <span className="text-[10px] text-muted-foreground">Exam</span>
          </div>
          <p className="text-xl font-bold text-foreground">
            {examDaysLeft !== null ? (
              <>{examDaysLeft}<span className="text-[10px] text-muted-foreground ml-1">d</span></>
            ) : "—"}
          </p>
        </div>
      </motion.div>

      {/* Forget Risk Radar */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-4">
          <AlertTriangle className="w-4 h-4 text-destructive" />
          <h2 className="font-semibold text-foreground text-sm">Forget Risk Radar</h2>
          {atRisk.length > 0 && (
            <span className="ml-auto px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-medium">
              {atRisk.length} at risk
            </span>
          )}
        </div>
        {atRisk.length > 0 ? (
          <div className="space-y-3">
            {atRisk.slice(0, 5).map((topic: TopicPrediction) => (
              <div key={topic.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="text-xs text-foreground">{topic.name}</span>
                    <span className={`text-[10px] ${topic.risk_level === "critical" ? "text-destructive" : "text-warning"}`}>
                      {Math.round(100 - topic.memory_strength)}% risk
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-warning to-destructive transition-all"
                      style={{ width: `${100 - topic.memory_strength}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">
            {hasTopics ? "All topics are healthy! 🧠" : "No topics tracked yet. Log a study session to start."}
          </p>
        )}
      </motion.div>

      {/* Spaced Repetition Review Queue */}
      <ReviewQueue />

      {/* AI Recommendations */}
      {recommendations.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="glass rounded-xl p-5 neural-border">
          <div className="flex items-center gap-2 mb-4">
            <Brain className="w-4 h-4 text-primary" />
            <h2 className="font-semibold text-foreground text-sm">AI Recommendations</h2>
          </div>
          <div className="space-y-3">
            {recommendations.map((rec: any) => (
              <div key={rec.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border">
                <div className={`w-2 h-2 rounded-full ${
                  rec.priority === "critical" ? "bg-destructive animate-pulse" :
                  rec.priority === "high" ? "bg-warning" : "bg-primary"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground truncate">{rec.title}</p>
                  <p className="text-[10px] text-muted-foreground">{rec.type} • {rec.priority}</p>
                </div>
                <button
                  onClick={async () => {
                    await supabase.from("ai_recommendations").update({ completed: true }).eq("id", rec.id);
                    loadRecommendations();
                  }}
                >
                  <CheckCircle className="w-4 h-4 text-muted-foreground hover:text-success transition-colors" />
                </button>
              </div>
            ))}
          </div>
        </motion.div>
      )}

      {/* Quick Actions */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-3 relative z-10">
        <button onClick={handleRefresh} disabled={analyzing} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 active:scale-95 disabled:opacity-50">
          {analyzing ? (
            <RefreshCw className="w-6 h-6 text-primary animate-spin" />
          ) : (
            <Target className="w-6 h-6 text-primary" />
          )}
          <span className="text-xs font-medium text-foreground">{analyzing ? "Analyzing…" : "Run AI Analysis"}</span>
        </button>
        <button
          onClick={async () => {
            await generateRecommendations();
            await loadRecommendations();
            toast({ title: "Fix suggestions generated! 🔧" });
          }}
          className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2 active:scale-95"
        >
          <Wrench className="w-6 h-6 text-warning" />
          <span className="text-xs font-medium text-foreground">Fix Now</span>
        </button>
      </motion.div>
    </div>
  );
};

export default HomeTab;
