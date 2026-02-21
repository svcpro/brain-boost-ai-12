import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Brain, Zap, Target, Timer, TrendingUp, Gauge, Loader2, RefreshCw, Languages, Sparkles } from "lucide-react";
import { useCognitiveProfile } from "@/hooks/useCognitiveProfile";

const styleEmoji: Record<string, string> = { conceptual: "🧠", memorizer: "📚", hybrid: "⚡" };
const styleLabel: Record<string, string> = { conceptual: "Conceptual Thinker", memorizer: "Pattern Memorizer", hybrid: "Hybrid Learner" };
const speedEmoji: Record<string, string> = { fast: "🚀", moderate: "⚡", slow: "🐢", variable: "🔀" };
const tradeoffLabel: Record<string, string> = { speed_first: "Speed Priority", accuracy_first: "Accuracy Priority", balanced: "Balanced" };

export default function CognitiveProfileCard() {
  const { profile, languagePerf, loading, fetchProfile } = useCognitiveProfile();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => { fetchProfile(); }, [fetchProfile]);

  if (loading) return (
    <div className="glass rounded-2xl neural-border p-4 flex justify-center">
      <Loader2 className="w-5 h-5 animate-spin text-primary" />
    </div>
  );

  if (!profile) return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-2xl neural-border p-5">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-lg">🧠</div>
        <div>
          <p className="text-xs font-bold text-foreground">AI Cognitive Profile</p>
          <p className="text-[10px] text-muted-foreground">v2.0 Engine</p>
        </div>
      </div>
      <div className="rounded-xl bg-secondary/30 p-4 text-center space-y-1">
        <Sparkles className="w-5 h-5 mx-auto text-primary/60" />
        <p className="text-xs font-medium text-foreground">Your cognitive profile is building</p>
        <p className="text-[10px] text-muted-foreground">Complete a practice session to unlock personalized insights about your learning style, speed patterns & accuracy.</p>
      </div>
    </motion.div>
  );

  const styleColor = profile.learning_style === "conceptual" ? "text-blue-400" : profile.learning_style === "memorizer" ? "text-amber-400" : "text-primary";

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-2xl neural-border overflow-hidden"
    >
      {/* Header */}
      <div className="p-4 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-primary/20 flex items-center justify-center text-lg">
              {styleEmoji[profile.learning_style]}
            </div>
            <div>
              <p className="text-xs font-bold text-foreground">AI Cognitive Profile</p>
              <p className="text-[10px] text-muted-foreground">v2.0 Engine • {profile.total_answers_analyzed} answers analyzed</p>
            </div>
          </div>
          <button onClick={(e) => { e.stopPropagation(); fetchProfile(); }} className="p-1.5 rounded-lg hover:bg-secondary/50">
            <RefreshCw className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        </div>

        {/* Main Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="rounded-xl bg-secondary/30 p-2.5 text-center">
            <Brain className={`w-4 h-4 mx-auto mb-1 ${styleColor}`} />
            <p className={`text-xs font-bold ${styleColor}`}>{styleLabel[profile.learning_style]}</p>
            <p className="text-[9px] text-muted-foreground">{profile.learning_style_confidence}% confidence</p>
          </div>
          <div className="rounded-xl bg-secondary/30 p-2.5 text-center">
            <Timer className="w-4 h-4 mx-auto mb-1 text-accent" />
            <p className="text-xs font-bold text-accent">{speedEmoji[profile.speed_pattern]} {profile.speed_pattern}</p>
            <p className="text-[9px] text-muted-foreground">{Math.round(profile.avg_answer_speed_ms / 1000)}s avg</p>
          </div>
          <div className="rounded-xl bg-secondary/30 p-2.5 text-center">
            <Target className="w-4 h-4 mx-auto mb-1 text-success" />
            <p className="text-xs font-bold text-success">{Math.round(profile.accuracy_rate * 100)}%</p>
            <p className="text-[9px] text-muted-foreground">{tradeoffLabel[profile.speed_accuracy_tradeoff]}</p>
          </div>
        </div>
      </div>

      {/* Expanded Section */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3">
              {/* Style Breakdown */}
              <div className="space-y-2">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Learning Style Breakdown</p>
                <div className="space-y-1.5">
                  {[
                    { label: "Conceptual", value: profile.conceptual_score, color: "bg-blue-500" },
                    { label: "Memorizer", value: profile.memorizer_score, color: "bg-amber-500" },
                  ].map(s => (
                    <div key={s.label} className="space-y-0.5">
                      <div className="flex justify-between text-[10px]">
                        <span className="text-muted-foreground">{s.label}</span>
                        <span className="text-foreground font-medium">{Math.round(s.value)}%</span>
                      </div>
                      <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                        <div className={`h-full ${s.color} rounded-full transition-all`} style={{ width: `${Math.min(100, s.value)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Language Performance */}
              {languagePerf.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                    <Languages className="w-3 h-3" /> Language Performance
                  </p>
                  <div className="grid grid-cols-2 gap-2">
                    {languagePerf.map(lp => (
                      <div key={lp.language} className="rounded-xl bg-secondary/30 p-2.5">
                        <p className="text-xs font-bold text-foreground capitalize">{lp.language}</p>
                        <p className="text-[10px] text-muted-foreground">{lp.total_questions} Qs • {Math.round(lp.accuracy_rate * 100)}% accuracy</p>
                        <div className="flex items-center gap-1 mt-1">
                          <TrendingUp className={`w-3 h-3 ${lp.improvement_pct >= 0 ? "text-success" : "text-destructive"}`} />
                          <span className={`text-[10px] font-bold ${lp.improvement_pct >= 0 ? "text-success" : "text-destructive"}`}>
                            {lp.improvement_pct >= 0 ? "+" : ""}{Math.round(lp.improvement_pct)}%
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {languagePerf.length === 2 && (
                    <div className="rounded-xl bg-primary/10 p-2 text-center">
                      <p className="text-[10px] text-primary font-medium">
                        🎯 Optimal: <span className="font-bold capitalize">
                          {languagePerf.sort((a, b) => b.accuracy_rate - a.accuracy_rate)[0].language}
                        </span>
                      </p>
                    </div>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
