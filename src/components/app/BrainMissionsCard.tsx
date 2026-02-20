import React, { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Target, CheckCircle, Clock, Zap, AlertTriangle, BookOpen, Brain, Sparkles, ChevronRight } from "lucide-react";
import { useBrainMissions, BrainMission } from "@/hooks/useBrainMissions";
import { Progress } from "@/components/ui/progress";
import { safeStr, safeNum } from "@/lib/safeRender";

const missionIcons: Record<string, React.ReactNode> = {
  rescue: <AlertTriangle className="w-4 h-4 text-destructive" />,
  consistency: <BookOpen className="w-4 h-4 text-primary" />,
  recall_boost: <Target className="w-4 h-4 text-amber-500" />,
  recovery: <Brain className="w-4 h-4 text-green-500" />,
  exploration: <Sparkles className="w-4 h-4 text-violet-500" />,
  challenge: <Zap className="w-4 h-4 text-orange-500" />,
};

const priorityColors: Record<string, string> = {
  critical: "border-destructive/40 bg-destructive/5",
  high: "border-amber-500/40 bg-amber-500/5",
  medium: "border-primary/30 bg-primary/5",
  low: "border-muted-foreground/20 bg-muted/5",
};

export default function BrainMissionsCard() {
  const { missions, loading, generate, list, complete } = useBrainMissions();
  const [completing, setCompleting] = useState<string | null>(null);

  useEffect(() => {
    list().then(data => {
      if (!data || (Array.isArray(data) && data.length === 0)) {
        generate();
      }
    });
  }, []);

  const handleComplete = async (mission: BrainMission) => {
    setCompleting(mission.id);
    await complete(mission.id);
    setCompleting(null);
  };

  if (loading && missions.length === 0) {
    return (
      <div className="rounded-2xl neural-border p-4 space-y-3 animate-pulse">
        <div className="h-5 bg-muted rounded w-1/2" />
        <div className="h-16 bg-muted rounded" />
        <div className="h-16 bg-muted rounded" />
      </div>
    );
  }

  if (missions.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl neural-border overflow-hidden"
    >
      <div className="p-4 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 flex items-center justify-center">
            <Target className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Brain Missions</h3>
            <p className="text-[10px] text-muted-foreground">Personalized to your cognitive profile</p>
          </div>
        </div>
        <button
          onClick={() => generate()}
          disabled={loading}
          className="text-[10px] text-primary font-medium px-2 py-1 rounded-md hover:bg-primary/10 transition-colors"
        >
          {loading ? "..." : "Refresh"}
        </button>
      </div>

      <div className="px-4 pb-4 space-y-2">
        <AnimatePresence mode="popLayout">
          {missions.map((mission, i) => (
            <motion.div
              key={mission.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20, scale: 0.9 }}
              transition={{ delay: i * 0.05 }}
              className={`rounded-xl border p-3 ${priorityColors[mission.priority] || priorityColors.medium}`}
            >
              <div className="flex items-start gap-2.5">
                <div className="mt-0.5 shrink-0">
                  {missionIcons[mission.mission_type] || <Target className="w-4 h-4 text-muted-foreground" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-foreground leading-tight">{safeStr(mission.title, "Mission")}</p>
                  {mission.description && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{safeStr(mission.description)}</p>
                  )}
                  {mission.target_value != null && mission.current_value != null && (
                    <div className="mt-1.5">
                      <Progress
                        value={Math.min(100, (safeNum(mission.current_value, 0) / safeNum(mission.target_value, 1)) * 100)}
                        className="h-1.5"
                      />
                      <p className="text-[9px] text-muted-foreground mt-0.5">
                        {Math.round(safeNum(mission.current_value, 0))} / {Math.round(safeNum(mission.target_value, 0))}
                      </p>
                    </div>
                  )}
                  {mission.reasoning && (
                    <p className="text-[9px] text-muted-foreground/70 mt-1 italic">💡 {safeStr(mission.reasoning)}</p>
                  )}
                </div>
                <button
                  onClick={() => handleComplete(mission)}
                  disabled={completing === mission.id}
                  className="shrink-0 p-1.5 rounded-lg hover:bg-primary/10 text-muted-foreground hover:text-primary transition-colors"
                >
                  <CheckCircle className={`w-4 h-4 ${completing === mission.id ? "animate-spin text-primary" : ""}`} />
                </button>
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                {mission.expires_at && (
                  <span className="text-[9px] text-muted-foreground flex items-center gap-0.5">
                    <Clock className="w-2.5 h-2.5" />
                    Expires {new Date(mission.expires_at).toLocaleDateString()}
                  </span>
                )}
                <span className="text-[9px] text-primary font-medium">+{safeNum(mission.reward_value, 0)} XP</span>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
