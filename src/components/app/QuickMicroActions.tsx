import React, { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Shield, Trophy, Zap, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { triggerHaptic } from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import type { TopicPrediction } from "@/hooks/useMemoryEngine";
import SmartRecallOverlay from "./SmartRecallOverlay";
import RiskShieldOverlay from "./RiskShieldOverlay";
import RankBoostOverlay from "./RankBoostOverlay";

interface QuickMicroActionsProps {
  atRisk: TopicPrediction[];
  overallHealth: number;
  streakDays: number;
  onStartRecall: (subject?: string, topic?: string, minutes?: number) => void;
}

interface MicroAction {
  id: string;
  icon: typeof Brain;
  label: string;
  reward: string;
  color: string;
  bg: string;
  priority: number;
}

export default function QuickMicroActions({ atRisk, overallHealth, streakDays, onStartRecall }: QuickMicroActionsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [showRecall, setShowRecall] = useState(false);
  const [recallTopic, setRecallTopic] = useState<{ topic?: string; subject?: string }>({});
  const [showShield, setShowShield] = useState(false);
  const [showRankBoost, setShowRankBoost] = useState(false);
  // Dynamic reordering based on user state
  const actions = useMemo<MicroAction[]>(() => {
    const items: MicroAction[] = [
      {
        id: "smart-recall",
        icon: Brain,
        label: "Smart Recall",
        reward: "+3% memory",
        color: "text-primary",
        bg: "bg-primary/10",
        // Higher priority when memory health is low
        priority: overallHealth < 60 ? 100 : overallHealth < 80 ? 60 : 30,
      },
      {
        id: "risk-shield",
        icon: Shield,
        label: "Risk Shield",
        reward: atRisk.length > 0 ? `${atRisk.length} saved` : "All safe",
        color: "text-warning",
        bg: "bg-warning/10",
        // Higher priority when many topics are at risk
        priority: atRisk.length >= 3 ? 90 : atRisk.length > 0 ? 50 : 10,
      },
      {
        id: "rank-boost",
        icon: Trophy,
        label: "Rank Boost",
        reward: "+1 rank",
        color: "text-accent",
        bg: "bg-accent/10",
        // Higher priority for users with active streaks (competitive)
        priority: streakDays >= 3 ? 70 : 40,
      },
    ];
    return items.sort((a, b) => b.priority - a.priority);
  }, [atRisk.length, overallHealth, streakDays]);

  const handleAction = async (id: string) => {
    triggerHaptic(20);
    setLoadingId(id);

    try {
      if (id === "smart-recall") {
        const target = atRisk[0];
        setRecallTopic({
          topic: target?.name,
          subject: target?.subject_name ?? undefined,
        });
        setShowRecall(true);
        setLoadingId(null);
        return;
      }

      if (id === "risk-shield") {
        if (atRisk.length === 0) {
          toast({ title: "🎉 All clear!", description: "No at-risk topics right now." });
          setLoadingId(null);
          return;
        }
        setShowShield(true);
        setLoadingId(null);
        return;
      }

      if (id === "rank-boost") {
        setShowRankBoost(true);
        setLoadingId(null);
        return;
      }
    } catch {
      toast({ title: "Something went wrong", variant: "destructive" });
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 }}
    >
      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 px-1">
        Quick Actions
      </p>
      <div className="grid grid-cols-3 gap-2">
        {actions.map((item, i) => {
          const isLoading = loadingId === item.id;
          return (
            <motion.button
              key={item.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35 + i * 0.05 }}
              whileTap={{ scale: 0.93 }}
              onClick={() => handleAction(item.id)}
              disabled={isLoading}
              className="rounded-2xl border border-border/60 bg-card/80 backdrop-blur-sm p-3 flex flex-col items-center gap-1.5 hover:border-primary/20 transition-all disabled:opacity-60"
            >
              <div className={`w-8 h-8 rounded-lg ${item.bg} flex items-center justify-center`}>
                {isLoading ? (
                  <Loader2 className={`w-3.5 h-3.5 ${item.color} animate-spin`} />
                ) : (
                  <item.icon className={`w-3.5 h-3.5 ${item.color}`} />
                )}
              </div>
              <p className="text-[10px] font-semibold text-foreground leading-tight">{item.label}</p>
              <span className={`text-[8px] font-medium ${item.color} opacity-80`}>
                {item.reward}
              </span>
            </motion.button>
          );
        })}
      </div>

      {/* Smart Recall Overlay */}
      <AnimatePresence>
        {showRecall && (
          <SmartRecallOverlay
            topicName={recallTopic.topic}
            subjectName={recallTopic.subject}
            onClose={() => setShowRecall(false)}
          />
        )}
      </AnimatePresence>

      {/* Risk Shield Overlay */}
      <AnimatePresence>
        {showShield && (
          <RiskShieldOverlay
            atRisk={atRisk}
            onClose={() => setShowShield(false)}
          />
        )}
      </AnimatePresence>

      {/* Rank Boost Overlay */}
      <AnimatePresence>
        {showRankBoost && (
          <RankBoostOverlay onClose={() => setShowRankBoost(false)} />
        )}
      </AnimatePresence>
    </motion.section>
  );
}
