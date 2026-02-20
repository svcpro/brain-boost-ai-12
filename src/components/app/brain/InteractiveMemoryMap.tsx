import { useState, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Network, ChevronRight, Play, TrendingDown, Flame, Sparkles } from "lucide-react";
import { isPast, isToday, formatDistanceToNow } from "date-fns";

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

interface InteractiveMemoryMapProps {
  subjectHealth: SubjectHealthData[];
  onReview: (subject: string, topic: string) => void;
}

const SUBJECT_HUES = [175, 260, 340, 45, 200, 120, 300, 30];

const strengthColor = (s: number) =>
  s > 70 ? "hsl(var(--success))" : s > 50 ? "hsl(var(--warning))" : "hsl(var(--destructive))";

const strengthClass = (s: number) =>
  s > 70 ? "success" : s > 50 ? "warning" : "destructive";

export default function InteractiveMemoryMap({ subjectHealth, onReview }: InteractiveMemoryMapProps) {
  const [expandedSubject, setExpandedSubject] = useState<string | null>(null);

  if (subjectHealth.length === 0) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Network className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Memory Map</h3>
            <p className="text-[10px] text-muted-foreground">Subject &amp; topic stability network</p>
          </div>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
          border: "1px solid hsl(var(--border))",
        }}>
          <Network className="w-8 h-8 text-primary/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">Add subjects to see your memory map</p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15, duration: 0.5 }}
    >
      {/* Section header */}
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
          <Network className="w-4 h-4 text-primary" />
        </div>
        <div>
          <h3 className="text-sm font-bold text-foreground">Memory Map</h3>
          <p className="text-[10px] text-muted-foreground">Subject &amp; topic stability network</p>
        </div>
      </div>

      {/* Subject nodes */}
      <div className="space-y-2.5">
        {subjectHealth.map((sub, si) => {
          const hue = SUBJECT_HUES[si % SUBJECT_HUES.length];
          const isExpanded = expandedSubject === sub.id;
          const atRisk = sub.topics.filter(t =>
            t.next_predicted_drop_date && (isPast(new Date(t.next_predicted_drop_date)) || isToday(new Date(t.next_predicted_drop_date)))
          ).length;

          return (
            <motion.div
              key={sub.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + si * 0.06 }}
              className="rounded-2xl overflow-hidden"
              style={{
                background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary) / 0.3) 100%)",
                border: `1px solid hsl(${hue} 50% 40% / 0.2)`,
              }}
            >
              {/* Subject row */}
              <button
                onClick={() => setExpandedSubject(isExpanded ? null : sub.id)}
                className="w-full p-4 flex items-center gap-3 text-left hover:bg-secondary/20 transition-colors"
              >
                {/* Node indicator */}
                <div className="relative shrink-0">
                  <div
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{
                      background: `linear-gradient(135deg, hsl(${hue} 60% 20% / 0.6), hsl(${hue} 50% 15% / 0.3))`,
                      border: `1px solid hsl(${hue} 60% 50% / 0.3)`,
                      boxShadow: `0 0 16px hsl(${hue} 60% 50% / 0.15)`,
                    }}
                  >
                    <span className="text-sm font-bold" style={{ color: `hsl(${hue} 70% 65%)` }}>
                      {sub.strength}%
                    </span>
                  </div>
                  {/* Pulse ring for at-risk */}
                  {atRisk > 0 && (
                    <motion.div
                      className="absolute inset-0 rounded-xl"
                      style={{ border: `1.5px solid hsl(0 70% 55% / 0.4)` }}
                      animate={{ scale: [1, 1.3], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-semibold text-foreground truncate">{sub.name}</p>
                    {atRisk > 0 && (
                      <span className="flex items-center gap-0.5 text-[9px] text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">
                        <Flame className="w-2.5 h-2.5" /> {atRisk}
                      </span>
                    )}
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {sub.topicCount} topic{sub.topicCount !== 1 ? "s" : ""}
                  </p>
                  {/* Mini stability bar */}
                  <div className="h-1.5 rounded-full bg-secondary/60 mt-2">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ background: strengthColor(sub.strength) }}
                      initial={{ width: 0 }}
                      animate={{ width: `${sub.strength}%` }}
                      transition={{ duration: 0.8, delay: 0.3 + si * 0.06 }}
                    />
                  </div>
                </div>

                <motion.div animate={{ rotate: isExpanded ? 90 : 0 }} transition={{ duration: 0.2 }}>
                  <ChevronRight className="w-4 h-4 text-muted-foreground" />
                </motion.div>
              </button>

              {/* Expanded topics */}
              <AnimatePresence>
                {isExpanded && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25 }}
                    className="overflow-hidden"
                  >
                    <div className="px-4 pb-4 space-y-2">
                      {sub.topics.length === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-4 text-muted-foreground">
                          <Sparkles className="w-4 h-4 opacity-40" />
                          <p className="text-[10px]">No topics yet</p>
                        </div>
                      ) : (
                        sub.topics.map((topic, ti) => {
                          const s = topic.memory_strength;
                          const dropDate = topic.next_predicted_drop_date ? new Date(topic.next_predicted_drop_date) : null;
                          const isOverdue = dropDate ? isPast(dropDate) : false;
                          const isDue = dropDate ? isToday(dropDate) : false;
                          const needsReview = isOverdue || isDue;
                          const sc = strengthClass(s);

                          return (
                            <motion.div
                              key={topic.id}
                              initial={{ opacity: 0, x: -8 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: ti * 0.04 }}
                              className={`p-3 rounded-xl border transition-colors ${
                                needsReview
                                  ? "bg-destructive/5 border-destructive/20"
                                  : "bg-secondary/20 border-border/40"
                              }`}
                            >
                              <div className="flex items-center gap-2 mb-1.5">
                                <div className={`w-2 h-2 rounded-full bg-${sc} shrink-0`} />
                                <span className="text-xs font-medium text-foreground truncate flex-1">{topic.name}</span>
                                <span className={`text-[10px] font-bold text-${sc}`}>{s}%</span>
                              </div>

                              <div className="h-1 rounded-full bg-secondary/60">
                                <motion.div
                                  className={`h-full rounded-full bg-${sc}`}
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
                                    <Play className="w-2.5 h-2.5" /> Review
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
        })}
      </div>
    </motion.section>
  );
}
