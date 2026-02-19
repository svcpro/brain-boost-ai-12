import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Brain, Zap, Target, Shield, TrendingUp, BarChart3, Radar,
  AlertTriangle, Trophy, Flame, RefreshCw, ChevronDown, ChevronUp,
  Crosshair, Atom, Activity, Gauge, BookOpen, Clock, Star,
  ArrowUpRight, ArrowDownRight, Minus, Sparkles, Layers
} from "lucide-react";
import { useExamDomination, ExamDominationData } from "@/hooks/useExamDomination";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

// Sub-components
const GlowingMetric = ({ label, value, suffix = "%", icon: Icon, color = "primary", size = "default" }: {
  label: string; value: number; suffix?: string; icon: any; color?: string; size?: "default" | "large";
}) => {
  const colorMap: Record<string, string> = {
    primary: "from-primary/20 to-primary/5 text-primary border-primary/30",
    success: "from-success/20 to-success/5 text-success border-success/30",
    warning: "from-warning/20 to-warning/5 text-warning border-warning/30",
    destructive: "from-destructive/20 to-destructive/5 text-destructive border-destructive/30",
  };
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative overflow-hidden rounded-xl border bg-gradient-to-br p-4",
        colorMap[color] || colorMap.primary
      )}
    >
      <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-bl from-current/5 to-transparent rounded-bl-full" />
      <Icon className={cn("w-4 h-4 mb-2 opacity-70", size === "large" && "w-5 h-5")} />
      <div className={cn("font-black", size === "large" ? "text-3xl" : "text-2xl")}>
        {Math.round(value)}{suffix}
      </div>
      <div className="text-[10px] uppercase tracking-wider opacity-60 mt-1 font-medium">{label}</div>
    </motion.div>
  );
};

const DominationBadge = ({ level }: { level: string }) => {
  const config: Record<string, { bg: string; text: string; label: string; icon: any }> = {
    dominating: { bg: "bg-success/20 border-success/40", text: "text-success", label: "DOMINATING", icon: Trophy },
    strong: { bg: "bg-primary/20 border-primary/40", text: "text-primary", label: "STRONG", icon: Flame },
    building: { bg: "bg-warning/20 border-warning/40", text: "text-warning", label: "BUILDING", icon: TrendingUp },
    needs_work: { bg: "bg-warning/20 border-warning/40", text: "text-warning", label: "NEEDS WORK", icon: AlertTriangle },
    critical: { bg: "bg-destructive/20 border-destructive/40", text: "text-destructive", label: "CRITICAL", icon: AlertTriangle },
  };
  const c = config[level] || config.building;
  const Icon = c.icon;
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-xs font-bold tracking-wider", c.bg, c.text)}
    >
      <Icon className="w-3.5 h-3.5" />
      {c.label}
    </motion.div>
  );
};

const SectionHeader = ({ icon: Icon, title, subtitle, action }: { icon: any; title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="flex items-center justify-between mb-3">
    <div className="flex items-center gap-2">
      <div className="p-1.5 rounded-lg bg-primary/10">
        <Icon className="w-4 h-4 text-primary" />
      </div>
      <div>
        <h3 className="text-sm font-bold text-foreground">{title}</h3>
        {subtitle && <p className="text-[10px] text-muted-foreground">{subtitle}</p>}
      </div>
    </div>
    {action}
  </div>
);

// Competition Meter
const CompetitionMeter = ({ intensity }: { intensity: string }) => {
  const levels = ["low", "moderate", "high", "extreme"];
  const idx = levels.indexOf(intensity);
  const colors = ["bg-success", "bg-primary", "bg-warning", "bg-destructive"];
  return (
    <div className="flex gap-1 items-end h-6">
      {levels.map((l, i) => (
        <motion.div
          key={l}
          initial={{ scaleY: 0 }}
          animate={{ scaleY: 1 }}
          transition={{ delay: i * 0.1 }}
          className={cn(
            "w-3 rounded-t-sm origin-bottom transition-colors",
            i <= idx ? colors[idx] : "bg-muted"
          )}
          style={{ height: `${(i + 1) * 25}%` }}
        />
      ))}
    </div>
  );
};

// Cutoff Risk Badge
const CutoffBadge = ({ risk }: { risk: string }) => {
  const config: Record<string, { color: string; label: string }> = {
    safe: { color: "bg-success/20 text-success border-success/30", label: "SAFE" },
    borderline: { color: "bg-warning/20 text-warning border-warning/30", label: "BORDERLINE" },
    at_risk: { color: "bg-destructive/20 text-destructive border-destructive/30", label: "AT RISK" },
    below: { color: "bg-destructive/30 text-destructive border-destructive/50", label: "BELOW CUTOFF" },
  };
  const c = config[risk] || config.borderline;
  return <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full border", c.color)}>{c.label}</span>;
};

// Mastery Heatmap Bar
const MasteryBar = ({ topic, mastery }: { topic: string; mastery: number }) => {
  const getColor = (v: number) => {
    if (v >= 80) return "bg-success";
    if (v >= 60) return "bg-primary";
    if (v >= 40) return "bg-warning";
    return "bg-destructive";
  };
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-muted-foreground w-24 truncate">{topic}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${mastery}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", getColor(mastery))}
        />
      </div>
      <span className="text-[10px] font-mono text-foreground w-8 text-right">{mastery}%</span>
    </div>
  );
};

const ProgressTab = () => {
  const { data, loading, error, analyze } = useExamDomination();
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    intelligence: true,
    questions: false,
    competition: true,
    strategy: false,
    syllabus: false,
    metrics: true,
  });

  useEffect(() => {
    if (!data) analyze();
  }, []);

  useEffect(() => {
    if (error) toast({ title: "Analysis Error", description: error, variant: "destructive" });
  }, [error]);

  const toggleSection = (key: string) => setExpandedSections(prev => ({ ...prev, [key]: !prev[key] }));

  const trendIcon = (trend: string) => {
    if (trend === "rising") return <ArrowUpRight className="w-3 h-3 text-success" />;
    if (trend === "declining") return <ArrowDownRight className="w-3 h-3 text-destructive" />;
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  };

  const priorityColor = (p: string) => {
    if (p === "critical") return "text-destructive bg-destructive/10 border-destructive/30";
    if (p === "high") return "text-warning bg-warning/10 border-warning/30";
    if (p === "medium") return "text-primary bg-primary/10 border-primary/30";
    return "text-muted-foreground bg-muted border-border";
  };

  return (
    <div className="px-4 py-6 space-y-4 pb-24">
      {/* Hero Header */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/10 via-card to-card p-5">
        <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-bl from-primary/10 to-transparent rounded-bl-full" />
        <div className="absolute bottom-0 left-0 w-24 h-24 bg-gradient-to-tr from-accent/10 to-transparent rounded-tr-full" />
        
        <div className="relative">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <motion.div
                animate={{ rotate: [0, 360] }}
                transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
                className="p-2 rounded-xl bg-primary/10 border border-primary/20"
              >
                <Atom className="w-5 h-5 text-primary" />
              </motion.div>
              <div>
                <h1 className="text-lg font-black text-foreground tracking-tight">ACRY ULTRA</h1>
                <p className="text-[10px] text-muted-foreground tracking-widest uppercase">AI Exam Domination Engine</p>
              </div>
            </div>
            <button
              onClick={() => analyze()}
              disabled={loading}
              className="p-2 rounded-xl bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              <RefreshCw className={cn("w-4 h-4 text-primary", loading && "animate-spin")} />
            </button>
          </div>

          {data && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <DominationBadge level={data.domination_level} />
                {data.days_to_exam !== null && (
                  <span className="text-[10px] text-muted-foreground font-medium">
                    {data.days_to_exam}d to {data.exam_type}
                  </span>
                )}
              </div>
              <p className="text-xs text-muted-foreground leading-relaxed">{data.overall_verdict}</p>
            </div>
          )}

          {loading && !data && (
            <div className="flex items-center gap-3 mt-2">
              <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity }} className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full" />
              <span className="text-xs text-muted-foreground">Analyzing your cognitive data...</span>
            </div>
          )}
        </div>
      </motion.div>

      {data && (
        <>
          {/* Ultra Metrics Grid */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="grid grid-cols-2 gap-3">
            <GlowingMetric label="Exam Intelligence" value={data.ultra_metrics.exam_intelligence_score} icon={Brain} color="primary" />
            <GlowingMetric label="Crack Probability" value={data.competition_simulation.crack_probability} icon={Target} color={data.competition_simulation.crack_probability >= 60 ? "success" : data.competition_simulation.crack_probability >= 30 ? "warning" : "destructive"} />
            <GlowingMetric label="Performance Accel." value={data.ultra_metrics.performance_acceleration} icon={Zap} color="success" />
            <GlowingMetric label="ML Confidence" value={data.ultra_metrics.ml_confidence} icon={Sparkles} color="primary" />
          </motion.div>

          {/* Competition Simulation */}
          <CollapsibleSection
            title="Competition Simulation"
            subtitle={`${(data.competition_simulation.virtual_students_simulated || 10000).toLocaleString()} virtual students`}
            icon={Trophy}
            isOpen={expandedSections.competition}
            onToggle={() => toggleSection("competition")}
          >
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="glass rounded-xl p-3 neural-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Expected Rank</div>
                  <div className="text-xl font-black text-foreground mt-1">
                    {data.competition_simulation.expected_rank_min.toLocaleString()}-{data.competition_simulation.expected_rank_max.toLocaleString()}
                  </div>
                </div>
                <div className="glass rounded-xl p-3 neural-border">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Percentile</div>
                  <div className="text-xl font-black text-primary mt-1">{data.competition_simulation.percentile}th</div>
                </div>
              </div>
              <div className="flex items-center justify-between glass rounded-xl p-3 neural-border">
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Competition Intensity</div>
                  <div className="text-sm font-bold text-foreground mt-0.5 capitalize">{data.competition_simulation.competition_intensity}</div>
                </div>
                <CompetitionMeter intensity={data.competition_simulation.competition_intensity} />
              </div>
              <div className="flex items-center justify-between glass rounded-xl p-3 neural-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Cutoff Risk</div>
                <CutoffBadge risk={data.competition_simulation.cutoff_risk} />
              </div>
              {/* Rank Probability Distribution */}
              {data.ultra_metrics.rank_probability_data.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Rank Probability Distribution</div>
                  {data.ultra_metrics.rank_probability_data.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className="text-[10px] text-muted-foreground w-20 truncate">{r.rank_range}</span>
                      <div className="flex-1 h-2.5 rounded-full bg-muted overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${r.probability}%` }}
                          transition={{ duration: 0.6, delay: i * 0.1 }}
                          className="h-full rounded-full bg-gradient-to-r from-primary to-accent"
                        />
                      </div>
                      <span className="text-[10px] font-mono text-foreground w-8 text-right">{r.probability}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Exam Intelligence */}
          <CollapsibleSection
            title="Exam Intelligence Engine"
            subtitle={`Score: ${data.exam_intelligence.overall_score}%`}
            icon={Brain}
            isOpen={expandedSections.intelligence}
            onToggle={() => toggleSection("intelligence")}
          >
            <div className="space-y-3">
              {/* High Probability Topics */}
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">High Probability Topics</div>
              {data.exam_intelligence.high_probability_topics.map((t, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className="flex items-center gap-2 glass rounded-lg p-2.5 neural-border"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-semibold text-foreground">{t.name}</span>
                      {trendIcon(t.trend)}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", priorityColor(t.impact))}>{t.impact.toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-lg font-black text-primary">{t.probability}%</div>
                    <div className="text-[9px] text-muted-foreground">probability</div>
                  </div>
                </motion.div>
              ))}

              {/* Emerging & Declining */}
              {data.exam_intelligence.emerging_topics.length > 0 && (
                <div>
                  <div className="text-[10px] text-success uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ArrowUpRight className="w-3 h-3" /> Emerging Trends
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.exam_intelligence.emerging_topics.map((t, i) => (
                      <span key={i} className="text-[10px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
              {data.exam_intelligence.declining_topics.length > 0 && (
                <div>
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1 flex items-center gap-1">
                    <ArrowDownRight className="w-3 h-3" /> Declining Topics
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.exam_intelligence.declining_topics.map((t, i) => (
                      <span key={i} className="text-[10px] bg-muted text-muted-foreground border border-border px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Predicted Questions */}
          <CollapsibleSection
            title="Predicted Questions"
            subtitle={`${data.predicted_questions.length} AI-generated predictions`}
            icon={Crosshair}
            isOpen={expandedSections.questions}
            onToggle={() => toggleSection("questions")}
          >
            <div className="space-y-3">
              {data.predicted_questions.map((q, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="glass rounded-xl p-3 neural-border space-y-2"
                >
                  <p className="text-xs text-foreground leading-relaxed">{q.question}</p>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-[9px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20">
                      {q.probability}% likely
                    </span>
                    <span className={cn(
                      "text-[9px] font-bold px-2 py-0.5 rounded-full border",
                      q.difficulty === "hard" ? "text-destructive bg-destructive/10 border-destructive/20" :
                        q.difficulty === "medium" ? "text-warning bg-warning/10 border-warning/20" :
                          "text-success bg-success/10 border-success/20"
                    )}>
                      {q.difficulty.toUpperCase()}
                    </span>
                    <span className="text-[9px] text-muted-foreground">{q.topic}</span>
                    <span className="text-[9px] text-muted-foreground ml-auto">Relevance: {q.relevance_score}%</span>
                  </div>
                </motion.div>
              ))}
            </div>
          </CollapsibleSection>

          {/* Adaptive Strategy */}
          <CollapsibleSection
            title="AI Strategy Engine"
            subtitle={data.adaptive_strategy.strategy_summary.slice(0, 50) + "..."}
            icon={Gauge}
            isOpen={expandedSections.strategy}
            onToggle={() => toggleSection("strategy")}
          >
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground leading-relaxed">{data.adaptive_strategy.strategy_summary}</p>

              {/* Daily Plan */}
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Today's Optimized Plan</div>
              {data.adaptive_strategy.daily_plan.map((p, i) => (
                <div key={i} className="flex items-center gap-2 glass rounded-lg p-2.5 neural-border">
                  <span className={cn("text-[9px] font-bold px-1.5 py-0.5 rounded border", priorityColor(p.priority))}>
                    {p.priority[0].toUpperCase()}
                  </span>
                  <span className="text-xs text-foreground flex-1">{p.topic}</span>
                  <span className="text-xs font-mono text-primary">{p.minutes}m</span>
                </div>
              ))}

              {/* Weak Areas */}
              {data.adaptive_strategy.weak_areas.length > 0 && (
                <div>
                  <div className="text-[10px] text-destructive uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Weak Areas
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.adaptive_strategy.weak_areas.map((w, i) => (
                      <span key={i} className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full">{w}</span>
                    ))}
                  </div>
                </div>
              )}

              <div className="glass rounded-lg p-2.5 neural-border">
                <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Time Allocation</div>
                <p className="text-xs text-foreground mt-1">{data.adaptive_strategy.time_allocation_advice}</p>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[10px] text-muted-foreground">Difficulty:</span>
                <span className={cn(
                  "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                  data.adaptive_strategy.difficulty_recommendation === "increase" ? "text-success bg-success/10 border-success/20" :
                    data.adaptive_strategy.difficulty_recommendation === "decrease" ? "text-warning bg-warning/10 border-warning/20" :
                      "text-primary bg-primary/10 border-primary/20"
                )}>
                  {data.adaptive_strategy.difficulty_recommendation.toUpperCase()}
                </span>
              </div>
            </div>
          </CollapsibleSection>

          {/* Syllabus Domination */}
          <CollapsibleSection
            title="Syllabus Domination"
            subtitle={`${data.syllabus_domination.coverage_percentage}% coverage`}
            icon={BookOpen}
            isOpen={expandedSections.syllabus}
            onToggle={() => toggleSection("syllabus")}
          >
            <div className="space-y-3">
              {/* Coverage Bar */}
              <div>
                <div className="flex justify-between text-[10px] mb-1">
                  <span className="text-muted-foreground uppercase tracking-wider">Syllabus Coverage</span>
                  <span className="font-bold text-foreground">{data.syllabus_domination.coverage_percentage}%</span>
                </div>
                <Progress value={data.syllabus_domination.coverage_percentage} className="h-3" />
              </div>

              {/* High ROI */}
              {data.syllabus_domination.high_roi_topics.length > 0 && (
                <div>
                  <div className="text-[10px] text-success uppercase tracking-wider mb-1 flex items-center gap-1">
                    <Star className="w-3 h-3" /> High ROI Topics
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.syllabus_domination.high_roi_topics.map((t, i) => (
                      <span key={i} className="text-[10px] bg-success/10 text-success border border-success/20 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Uncovered */}
              {data.syllabus_domination.uncovered_topics.length > 0 && (
                <div>
                  <div className="text-[10px] text-destructive uppercase tracking-wider mb-1 flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" /> Uncovered Topics
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {data.syllabus_domination.uncovered_topics.map((t, i) => (
                      <span key={i} className="text-[10px] bg-destructive/10 text-destructive border border-destructive/20 px-2 py-0.5 rounded-full">{t}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Revision Priority */}
              {data.syllabus_domination.revision_priority.length > 0 && (
                <div className="space-y-1.5">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider">Revision Priority</div>
                  {data.syllabus_domination.revision_priority.map((r, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        r.urgency === "immediate" ? "bg-destructive" : r.urgency === "soon" ? "bg-warning" : "bg-success"
                      )} />
                      <span className="text-xs text-foreground flex-1">{r.topic}</span>
                      <span className="text-[9px] text-muted-foreground capitalize">{r.urgency.replace("_", " ")}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </CollapsibleSection>

          {/* Topic Mastery Heatmap */}
          <CollapsibleSection
            title="Mastery Heatmap"
            subtitle={`${data.ultra_metrics.mastery_heatmap.length} topics analyzed`}
            icon={Layers}
            isOpen={expandedSections.metrics}
            onToggle={() => toggleSection("metrics")}
          >
            <div className="space-y-2">
              <div className="flex items-center gap-3 mb-2">
                <GlowingMetric label="Weakness Index" value={data.ultra_metrics.weakness_exposure} suffix="%" icon={Activity} color={data.ultra_metrics.weakness_exposure > 50 ? "destructive" : "warning"} size="default" />
              </div>
              {data.ultra_metrics.mastery_heatmap.map((m, i) => (
                <MasteryBar key={i} topic={m.topic} mastery={m.mastery} />
              ))}
            </div>
          </CollapsibleSection>

          {/* Footer Stats */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
            className="glass rounded-xl neural-border p-3 flex items-center justify-between"
          >
            <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
              <span>{data.total_topics} topics</span>
              <span>{data.total_study_hours}h studied</span>
            </div>
            <div className="text-[9px] text-muted-foreground/50">
              Updated {new Date(data.generated_at).toLocaleTimeString()}
            </div>
          </motion.div>
        </>
      )}

      {!data && !loading && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col items-center justify-center py-20 space-y-4">
          <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20">
            <Atom className="w-8 h-8 text-primary" />
          </div>
          <div className="text-center">
            <h2 className="text-lg font-bold text-foreground">ACRY ULTRA</h2>
            <p className="text-xs text-muted-foreground mt-1">AI Exam Domination Engine</p>
          </div>
          <button
            onClick={analyze}
            className="px-6 py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-bold hover:opacity-90 transition-opacity"
          >
            Launch Analysis
          </button>
        </motion.div>
      )}
    </div>
  );
};

// Collapsible Section Component
const CollapsibleSection = ({ title, subtitle, icon, isOpen, onToggle, children }: {
  title: string; subtitle?: string; icon: any; isOpen: boolean; onToggle: () => void; children: React.ReactNode;
}) => (
  <motion.div
    initial={{ opacity: 0, y: 20 }}
    animate={{ opacity: 1, y: 0 }}
    className="glass rounded-xl neural-border overflow-hidden"
  >
    <button onClick={onToggle} className="w-full p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
      <SectionHeader icon={icon} title={title} subtitle={subtitle} />
      {isOpen ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
    </button>
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1 }}
          exit={{ height: 0, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="px-4 pb-4"
        >
          {children}
        </motion.div>
      )}
    </AnimatePresence>
  </motion.div>
);

export default ProgressTab;
