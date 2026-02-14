import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Brain, AlertTriangle, Target, Calendar, CheckCircle, Wrench, RefreshCw } from "lucide-react";
import { useMemoryEngine, TopicPrediction } from "@/hooks/useMemoryEngine";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const HomeTab = () => {
  const { prediction, loading, predict, generateRecommendations } = useMemoryEngine();
  const { user } = useAuth();
  const [recommendations, setRecommendations] = useState<any[]>([]);
  const [examDaysLeft, setExamDaysLeft] = useState<number | null>(null);

  useEffect(() => {
    predict();
    loadRecommendations();
    loadExamDate();
  }, []);

  const loadRecommendations = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("ai_recommendations")
      .select("*")
      .eq("user_id", user.id)
      .eq("completed", false)
      .order("created_at", { ascending: false })
      .limit(5);
    setRecommendations(data || []);
  };

  const loadExamDate = async () => {
    if (!user) return;
    const { data } = await supabase
      .from("profiles")
      .select("exam_date")
      .eq("id", user.id)
      .maybeSingle();
    if (data?.exam_date) {
      const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
      setExamDaysLeft(Math.max(0, days));
    }
  };

  const atRisk = prediction?.at_risk || [];
  const overallHealth = prediction?.overall_health ?? 0;
  const hasTopics = (prediction?.topics?.length ?? 0) > 0;

  const handleRefresh = async () => {
    await predict();
    await generateRecommendations();
    await loadRecommendations();
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

      {/* Stats row */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Brain className="w-4 h-4 text-primary" />
            <span className="text-xs text-muted-foreground">Brain Health</span>
          </div>
          <p className="text-2xl font-bold gradient-text">{hasTopics ? `${overallHealth}%` : "—"}</p>
        </div>
        <div className="glass rounded-xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-warning" />
            <span className="text-xs text-muted-foreground">Exam Countdown</span>
          </div>
          <p className="text-2xl font-bold text-foreground">
            {examDaysLeft !== null ? (
              <>{examDaysLeft} <span className="text-sm text-muted-foreground">days</span></>
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
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid grid-cols-2 gap-3">
        <button onClick={handleRefresh} className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2">
          <Target className="w-6 h-6 text-primary" />
          <span className="text-xs font-medium text-foreground">Run AI Analysis</span>
        </button>
        <button className="glass rounded-xl p-4 neural-border hover:glow-primary transition-all flex flex-col items-center gap-2">
          <Wrench className="w-6 h-6 text-warning" />
          <span className="text-xs font-medium text-foreground">Fix Now</span>
        </button>
      </motion.div>
    </div>
  );
};

export default HomeTab;
