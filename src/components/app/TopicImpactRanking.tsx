import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Flame, ChevronDown, Crosshair, TrendingUp, AlertTriangle, Clock } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { type TopicCognitiveModel } from "@/hooks/useCognitiveTwin";
import FocusModeSession from "./FocusModeSession";

interface RankedTopic {
  topic: TopicCognitiveModel;
  retentionGain: number;
  currentRetention7d: number;
  afterStudyRetention7d: number;
  urgency: "critical" | "high" | "medium" | "low";
}

interface Props {
  topicModels: TopicCognitiveModel[];
}

export default function TopicImpactRanking({ topicModels }: Props) {
  const [open, setOpen] = useState(true);
  const [focusTopic, setFocusTopic] = useState<TopicCognitiveModel | null>(null);

  const ranked = useMemo(() => {
    if (!topicModels.length) return [];

    return topicModels
      .map((t): RankedTopic => {
        const decayRate = t.decay_rate || 0.05;
        const stability = 1 / Math.max(0.001, decayRate);
        const hours7d = 7 * 24;
        const currentRet = t.memory_strength * Math.exp(-hours7d / stability);
        const learningSpeed = t.learning_speed || 5;
        const postStrength = Math.min(100, t.memory_strength + learningSpeed * 1.5);
        const afterRet = postStrength * Math.exp(-hours7d / stability);
        const gain = afterRet - currentRet;

        let urgency: RankedTopic["urgency"] = "low";
        if (t.memory_strength < 30 || currentRet < 10) urgency = "critical";
        else if (t.memory_strength < 50 || currentRet < 25) urgency = "high";
        else if (t.memory_strength < 70) urgency = "medium";

        return {
          topic: t,
          retentionGain: Math.round(gain * 10) / 10,
          currentRetention7d: Math.round(currentRet * 10) / 10,
          afterStudyRetention7d: Math.round(afterRet * 10) / 10,
          urgency,
        };
      })
      .sort((a, b) => b.retentionGain - a.retentionGain)
      .slice(0, 8);
  }, [topicModels]);

  if (ranked.length === 0) return null;

  const urgencyColors = {
    critical: "bg-destructive/15 text-destructive border-destructive/30",
    high: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
    medium: "bg-yellow-500/15 text-yellow-600 dark:text-yellow-400 border-yellow-500/30",
    low: "bg-muted text-muted-foreground border-border",
  };

  const urgencyIcons = {
    critical: <AlertTriangle className="w-3 h-3" />,
    high: <Flame className="w-3 h-3" />,
    medium: <Clock className="w-3 h-3" />,
    low: <TrendingUp className="w-3 h-3" />,
  };

  return (
    <>
      <Card className="p-4 overflow-hidden">
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center justify-between w-full text-left"
        >
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-orange-500/15 flex items-center justify-center">
              <Flame className="w-4 h-4 text-orange-500" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-foreground">Most Impactful to Study Now</h3>
              <p className="text-[10px] text-muted-foreground">Topics ranked by potential retention gain</p>
            </div>
          </div>
          <motion.div animate={{ rotate: open ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
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
              <div className="mt-3 space-y-2">
                {ranked.map((item, idx) => (
                  <motion.div
                    key={item.topic.topic_id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: idx * 0.04 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 hover:bg-muted/70 transition-colors group"
                  >
                    {/* Rank number */}
                    <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      idx === 0 ? "bg-primary text-primary-foreground" : idx < 3 ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                    }`}>
                      {idx + 1}
                    </span>

                    {/* Topic info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-medium text-foreground truncate">{item.topic.topic_name}</span>
                        <Badge className={`text-[9px] px-1 py-0 h-4 border ${urgencyColors[item.urgency]}`}>
                          {urgencyIcons[item.urgency]}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground">
                          Now {Math.round(item.topic.memory_strength)}%
                        </span>
                        <span className="text-[10px] text-muted-foreground">→</span>
                        <span className="text-[10px] text-primary font-medium">
                          +{item.retentionGain}% in 7d
                        </span>
                      </div>
                    </div>

                    {/* Retention gain bar */}
                    <div className="w-16 shrink-0">
                      <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          className="h-full rounded-full bg-primary"
                          initial={{ width: 0 }}
                          animate={{ width: `${Math.min(100, (item.retentionGain / (ranked[0]?.retentionGain || 1)) * 100)}%` }}
                          transition={{ delay: idx * 0.04 + 0.2, duration: 0.4 }}
                        />
                      </div>
                    </div>

                    {/* Study button */}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-7 px-2 opacity-0 group-hover:opacity-100 transition-opacity gap-1 shrink-0"
                      onClick={() => setFocusTopic(item.topic)}
                    >
                      <Crosshair className="w-3 h-3" />
                      <span className="text-[10px]">Study</span>
                    </Button>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </Card>

      <FocusModeSession
        open={!!focusTopic}
        onClose={() => setFocusTopic(null)}
        initialSubject={focusTopic?.topic_name || ""}
        initialTopic={focusTopic?.topic_name || ""}
        autoStart
        onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))}
      />
    </>
  );
}
