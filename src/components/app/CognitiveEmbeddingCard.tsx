import React, { useEffect } from "react";
import { motion } from "framer-motion";
import { Fingerprint, Cpu, TrendingUp } from "lucide-react";
import { useUserEmbedding } from "@/hooks/useUserEmbedding";

const dimensionLabels: Record<string, string> = {
  memory_decay_speed: "Memory Retention",
  learning_speed: "Learning Speed",
  recall_success: "Recall Accuracy",
  revision_effectiveness: "Revision Impact",
  study_consistency: "Consistency",
  cognitive_fatigue: "Energy Level",
  optimal_time_alignment: "Schedule Fit",
  focus_duration: "Focus Capacity",
  learning_efficiency: "Efficiency",
  knowledge_breadth: "Knowledge Breadth",
  exam_performance: "Exam Score",
  engagement_level: "Engagement",
  burnout_resilience: "Resilience",
  memory_stability: "Stability",
  improvement_velocity: "Growth Rate",
  session_regularity: "Regularity",
};

export default function CognitiveEmbeddingCard() {
  const { embedding, loading, compute } = useUserEmbedding();

  useEffect(() => {
    compute();
  }, []);

  if (loading && !embedding) {
    return (
      <div className="rounded-2xl neural-border p-4 animate-pulse">
        <div className="h-5 bg-muted rounded w-2/3 mb-3" />
        <div className="grid grid-cols-4 gap-2">
          {Array.from({ length: 16 }).map((_, i) => (
            <div key={i} className="h-10 bg-muted rounded" />
          ))}
        </div>
      </div>
    );
  }

  if (!embedding) return null;

  const topDimensions = embedding.embedding
    .map((val, idx) => ({ val, label: embedding.feature_labels[idx] }))
    .sort((a, b) => b.val - a.val);

  const clusterDisplay = embedding.cluster_id.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl neural-border overflow-hidden"
    >
      <div className="p-4 pb-2 flex items-center gap-2">
        <div className="w-8 h-8 rounded-lg bg-violet-500/15 flex items-center justify-center">
          <Fingerprint className="w-4 h-4 text-violet-500" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Cognitive DNA</h3>
          <p className="text-[10px] text-muted-foreground">Your unique brain fingerprint</p>
        </div>
      </div>

      {/* Cluster badge */}
      <div className="px-4 pb-2">
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-violet-500/10 border border-violet-500/20">
          <Cpu className="w-3 h-3 text-violet-500" />
          <span className="text-[10px] font-semibold text-violet-400">{clusterDisplay}</span>
        </div>
      </div>

      {/* Embedding visualization - radar-like bar chart */}
      <div className="px-4 pb-4 space-y-1.5">
        {topDimensions.slice(0, 8).map((dim, i) => (
          <motion.div
            key={dim.label}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.03 }}
            className="flex items-center gap-2"
          >
            <span className="text-[9px] text-muted-foreground w-20 truncate">
              {dimensionLabels[dim.label] || dim.label}
            </span>
            <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.round(dim.val * 100)}%` }}
                transition={{ delay: 0.2 + i * 0.05, duration: 0.5 }}
                className={`h-full rounded-full ${
                  dim.val > 0.7 ? "bg-green-500" : dim.val > 0.4 ? "bg-primary" : "bg-amber-500"
                }`}
              />
            </div>
            <span className="text-[9px] font-mono text-muted-foreground w-8 text-right">
              {Math.round(dim.val * 100)}%
            </span>
          </motion.div>
        ))}
      </div>

      {/* Fingerprint */}
      <div className="px-4 pb-3 flex items-center gap-1.5">
        <span className="text-[8px] text-muted-foreground/50 font-mono tracking-widest truncate">
          ID: {embedding.cognitive_fingerprint}
        </span>
      </div>
    </motion.div>
  );
}
