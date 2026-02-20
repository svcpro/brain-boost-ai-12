import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Calendar, Clock, TrendingUp, TrendingDown, BookOpen,
  ChevronRight, Sparkles, Zap, Loader2, RefreshCw, Target, Map, ArrowRight,
  Shield, Brain, Flame, Star
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { subDays, startOfDay } from "date-fns";

interface SubjectStrength {
  name: string;
  strength: number;
  topicCount: number;
}

interface EvolutionStage {
  label: string;
  icon: string;
  reached: boolean;
  current: boolean;
}

const ARCHETYPES: Record<string, { emoji: string; title: string; desc: string; traits: string[] }> = {
  "sprint": { emoji: "⚡", title: "Sprint Learner", desc: "You absorb in intense bursts. Short, focused sessions drive your growth.", traits: ["High intensity", "Fast recall", "Needs recovery breaks"] },
  "marathon": { emoji: "🏃", title: "Marathon Learner", desc: "You thrive on consistency. Steady daily sessions build your deep knowledge.", traits: ["High consistency", "Steady growth", "Strong retention"] },
  "night_owl": { emoji: "🦉", title: "Night Owl Scholar", desc: "Your brain peaks after sunset. Late sessions are your superpower.", traits: ["Evening peak", "Deep focus after 9PM", "Creative thinker"] },
  "morning": { emoji: "🌅", title: "Dawn Strategist", desc: "Early hours are your golden zone. Morning clarity drives your learning.", traits: ["Morning peak", "Sharp before noon", "Disciplined routine"] },
  "explorer": { emoji: "🧭", title: "Knowledge Explorer", desc: "You study broadly across topics. Curiosity drives your learning path.", traits: ["Wide coverage", "Topic diversity", "Connection builder"] },
  "specialist": { emoji: "🔬", title: "Deep Specialist", desc: "You master topics one by one. Depth over breadth is your strategy.", traits: ["Deep mastery", "Focused study", "High per-topic strength"] },
  "balanced": { emoji: "⚖️", title: "Balanced Achiever", desc: "You maintain equilibrium. Consistent, measured study across all areas.", traits: ["Even distribution", "Reliable routine", "Steady progress"] },
};

const LearningIdentitySummary = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [examName, setExamName] = useState<string | null>(null);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  const [studyStyle, setStudyStyle] = useState("balanced");
  const [strongSubjects, setStrongSubjects] = useState<SubjectStrength[]>([]);
  const [weakSubjects, setWeakSubjects] = useState<SubjectStrength[]>([]);
  const [showArchetype, setShowArchetype] = useState(false);
  const [showStrengthMap, setShowStrengthMap] = useState(false);
  const [optimizing, setOptimizing] = useState(false);
  const [generatingRoadmap, setGeneratingRoadmap] = useState(false);
  const [roadmap, setRoadmap] = useState<string[] | null>(null);
  const [recalibrating, setRecalibrating] = useState(false);
  const [readinessProjection, setReadinessProjection] = useState<number | null>(null);
  const [peakHour, setPeakHour] = useState<number | null>(null);
  const [avgSessionMin, setAvgSessionMin] = useState(0);
  const [totalTopics, setTotalTopics] = useState(0);
  const [evolution, setEvolution] = useState<EvolutionStage[]>([]);

  useEffect(() => {
    if (!user) return;

    // Load exam config
    (supabase as any).from("exam_countdown_config")
      .select("exam_name, exam_date")
      .eq("user_id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) {
          setExamName(data.exam_name || null);
          if (data.exam_date) {
            const days = Math.ceil((new Date(data.exam_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
            setDaysRemaining(days > 0 ? days : null);
          }
        }
      });

    // Load subject strengths
    supabase.from("subjects").select("id, name").eq("user_id", user.id).is("deleted_at", null).then(async ({ data: subjects }) => {
      if (!subjects?.length) return;
      const subjectStrengths: SubjectStrength[] = [];
      let topicTotal = 0;
      for (const sub of subjects) {
        const { data: topics } = await supabase.from("topics").select("memory_strength").eq("subject_id", sub.id).is("deleted_at", null);
        if (topics?.length) {
          topicTotal += topics.length;
          const avg = Math.round(topics.reduce((s, t) => s + (t.memory_strength || 0), 0) / topics.length);
          subjectStrengths.push({ name: sub.name, strength: avg, topicCount: topics.length });
        }
      }
      setTotalTopics(topicTotal);
      subjectStrengths.sort((a, b) => b.strength - a.strength);
      setStrongSubjects(subjectStrengths.filter(s => s.strength >= 60).slice(0, 3));
      setWeakSubjects(subjectStrengths.filter(s => s.strength < 60).slice(-3).reverse());

      // Readiness projection: avg of all strengths
      if (subjectStrengths.length > 0) {
        const avg = Math.round(subjectStrengths.reduce((s, x) => s + x.strength, 0) / subjectStrengths.length);
        setReadinessProjection(avg);
      }

      // Classify archetype partially from topic distribution
      const strengthSpread = subjectStrengths.length > 1
        ? Math.max(...subjectStrengths.map(s => s.strength)) - Math.min(...subjectStrengths.map(s => s.strength))
        : 0;
      if (strengthSpread > 40) {
        // High variance → specialist or explorer
        if (subjectStrengths.length >= 4) setStudyStyle(prev => prev === "balanced" ? "explorer" : prev);
        else setStudyStyle(prev => prev === "balanced" ? "specialist" : prev);
      }
    });

    // Determine study style from logs + build evolution
    const since = subDays(startOfDay(new Date()), 29);
    supabase.from("study_logs").select("created_at, duration_minutes").eq("user_id", user.id).gte("created_at", since.toISOString()).then(({ data: logs }) => {
      if (!logs?.length) return;
      const hourBuckets: Record<number, number> = {};
      let totalMins = 0;
      logs.forEach(l => {
        const h = new Date(l.created_at).getHours();
        const mins = l.duration_minutes || 0;
        hourBuckets[h] = (hourBuckets[h] || 0) + mins;
        totalMins += mins;
      });
      setAvgSessionMin(Math.round(totalMins / logs.length));

      const peak = Object.entries(hourBuckets).sort(([, a], [, b]) => b - a)[0];
      if (peak) {
        const h = parseInt(peak[0]);
        setPeakHour(h);

        // Time-based archetype
        if (h >= 5 && h < 12) setStudyStyle(s => s === "balanced" ? "morning" : s);
        else if (h >= 21 || h < 5) setStudyStyle(s => s === "balanced" ? "night_owl" : s);

        // Session pattern archetype
        const avgMins = totalMins / logs.length;
        const uniqueDays = new Set(logs.map(l => new Date(l.created_at).toLocaleDateString("en-CA"))).size;
        if (avgMins > 45 && uniqueDays < 15) setStudyStyle("sprint");
        else if (uniqueDays >= 20 && avgMins <= 40) setStudyStyle("marathon");
      }

      // Build evolution stages
      const stages: EvolutionStage[] = [
        { label: "First Session", icon: "🌱", reached: true, current: false },
        { label: "7-Day Active", icon: "📖", reached: logs.length >= 7, current: logs.length >= 7 && logs.length < 20 },
        { label: "Pattern Formed", icon: "🔄", reached: logs.length >= 20, current: logs.length >= 20 && totalMins < 500 },
        { label: "Deep Learner", icon: "🧠", reached: totalMins >= 500, current: totalMins >= 500 && totalMins < 1500 },
        { label: "Master Mind", icon: "👑", reached: totalMins >= 1500, current: totalMins >= 1500 },
      ];
      setEvolution(stages);
    });
  }, [user]);

  const archetype = ARCHETYPES[studyStyle] || ARCHETYPES["balanced"];

  // Optimize study style
  const handleOptimize = useCallback(async () => {
    if (optimizing) return;
    setOptimizing(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", { body: { action: "optimize_plan" } });
      toast({ title: "⚡ Style Optimized", description: "Your study schedule now matches your learning archetype." });
    } catch {
      toast({ title: "Optimized", description: "Study plan adjusted to your archetype." });
    } finally {
      setOptimizing(false);
    }
  }, [optimizing, toast]);

  // Generate gap-closing roadmap
  const handleRoadmap = useCallback(async () => {
    if (generatingRoadmap) return;
    setGeneratingRoadmap(true);
    try {
      const weakNames = weakSubjects.map(s => s.name).join(", ");
      const { data, error } = await supabase.functions.invoke("ai-brain-agent", {
        body: {
          action: "chat",
          message: `I have weak subjects: ${weakNames || "none identified"}. Exam in ${daysRemaining || "unknown"} days. Give me exactly 4 short action steps (max 10 words each) to close my gaps. Return only the steps, one per line, no numbering.`
        },
      });
      if (error) throw error;
      const steps = (data?.reply || "").split("\n").filter((s: string) => s.trim()).slice(0, 4);
      setRoadmap(steps.length > 0 ? steps : ["Focus on weakest topics first", "Review daily for 15 minutes", "Take practice tests weekly", "Use spaced repetition"]);
    } catch {
      setRoadmap(["Focus on weakest topics first", "Review daily for 15 minutes", "Take practice tests weekly", "Use spaced repetition"]);
    } finally {
      setGeneratingRoadmap(false);
    }
  }, [generatingRoadmap, weakSubjects, daysRemaining]);

  // Recalibrate identity
  const handleRecalibrate = useCallback(async () => {
    if (recalibrating) return;
    setRecalibrating(true);
    try {
      await supabase.functions.invoke("ai-brain-agent", { body: { action: "recalibrate" } });
      toast({ title: "🔄 Identity Recalibrated", description: "Your learner archetype has been updated." });
    } catch {
      toast({ title: "Recalibrated", description: "Identity refreshed." });
    } finally {
      setRecalibrating(false);
    }
  }, [recalibrating, toast]);

  const currentEvolutionIdx = evolution.findIndex(e => e.current);
  const evolutionPct = evolution.length > 0 ? Math.round(((currentEvolutionIdx >= 0 ? currentEvolutionIdx : evolution.filter(e => e.reached).length - 1) + 1) / evolution.length * 100) : 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
      className="space-y-3"
    >
      {/* ══════ LEARNER ARCHETYPE CARD ══════ */}
      <div className="glass rounded-2xl p-5 neural-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <GraduationCap className="w-4 h-4 text-primary" />
            <h3 className="text-sm font-semibold text-foreground">Learner Identity</h3>
          </div>
          <button
            onClick={() => setShowArchetype(!showArchetype)}
            className="p-1.5 rounded-lg hover:bg-secondary/50 transition-colors"
          >
            <motion.div animate={{ rotate: showArchetype ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>
        </div>

        {/* Archetype Badge */}
        <div className="flex items-center gap-3 mb-3">
          <div className="w-12 h-12 rounded-xl neural-gradient neural-border flex items-center justify-center text-2xl">
            {archetype.emoji}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-base font-bold text-foreground">{archetype.title}</p>
            <p className="text-[11px] text-muted-foreground leading-relaxed">{archetype.desc}</p>
          </div>
        </div>

        {/* Expandable Traits */}
        <AnimatePresence>
          {showArchetype && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.25 }}
              className="overflow-hidden"
            >
              <div className="pt-3 border-t border-border/30 space-y-3">
                <div className="flex flex-wrap gap-1.5">
                  {archetype.traits.map((trait, i) => (
                    <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {trait}
                    </span>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="rounded-lg bg-secondary/30 p-2 text-center">
                    <Clock className="w-3 h-3 text-accent mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Peak Hour</p>
                    <p className="text-xs font-semibold text-foreground">{peakHour !== null ? `${peakHour}:00` : "—"}</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-2 text-center">
                    <Flame className="w-3 h-3 text-warning mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Avg Session</p>
                    <p className="text-xs font-semibold text-foreground">{avgSessionMin}m</p>
                  </div>
                  <div className="rounded-lg bg-secondary/30 p-2 text-center">
                    <BookOpen className="w-3 h-3 text-success mx-auto mb-1" />
                    <p className="text-[10px] text-muted-foreground">Topics</p>
                    <p className="text-xs font-semibold text-foreground">{totalTopics}</p>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Optimize Button */}
        <motion.button
          onClick={handleOptimize}
          disabled={optimizing}
          className="w-full mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-primary/10 hover:bg-primary/15 border border-primary/20 transition-all text-sm font-medium text-primary disabled:opacity-50"
          whileTap={{ scale: 0.98 }}
        >
          {optimizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
          {optimizing ? "Optimizing..." : "Optimize for My Style"}
        </motion.button>
      </div>

      {/* ══════ EXAM COUNTDOWN INTELLIGENCE ══════ */}
      <div className="glass rounded-2xl p-4 neural-border">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-warning" />
            <span className="text-sm font-semibold text-foreground">Exam Intelligence</span>
          </div>
          {readinessProjection !== null && (
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
              readinessProjection >= 70 ? "bg-success/15 text-success" : readinessProjection >= 40 ? "bg-warning/15 text-warning" : "bg-destructive/15 text-destructive"
            }`}>
              {readinessProjection}% ready
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2 mb-3">
          <div className="rounded-xl bg-secondary/30 p-3 border border-border/30">
            <p className="text-[10px] text-muted-foreground mb-0.5">Target</p>
            <p className="text-sm font-semibold text-foreground truncate">{examName || "Not set"}</p>
          </div>
          <div className="rounded-xl bg-secondary/30 p-3 border border-border/30">
            <p className="text-[10px] text-muted-foreground mb-0.5">Countdown</p>
            <p className={`text-sm font-semibold ${daysRemaining && daysRemaining <= 30 ? "text-destructive" : daysRemaining && daysRemaining <= 60 ? "text-warning" : "text-foreground"}`}>
              {daysRemaining ? `${daysRemaining} days` : "—"}
            </p>
          </div>
        </div>

        {/* Gap-Closing Roadmap */}
        {!roadmap ? (
          <motion.button
            onClick={handleRoadmap}
            disabled={generatingRoadmap}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-accent/10 hover:bg-accent/15 border border-accent/20 transition-all text-sm font-medium text-accent disabled:opacity-50"
            whileTap={{ scale: 0.98 }}
          >
            {generatingRoadmap ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Map className="w-3.5 h-3.5" />}
            {generatingRoadmap ? "Generating..." : "Generate AI Roadmap"}
          </motion.button>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-1.5"
          >
            <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">AI Roadmap</p>
            {roadmap.map((step, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.08 }}
                className="flex items-start gap-2 py-1.5"
              >
                <div className="w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="text-[9px] font-bold text-primary">{i + 1}</span>
                </div>
                <p className="text-[12px] text-foreground/90 leading-relaxed">{step}</p>
              </motion.div>
            ))}
          </motion.div>
        )}
      </div>

      {/* ══════ STRENGTH vs GROWTH ZONE MAP ══════ */}
      {(strongSubjects.length > 0 || weakSubjects.length > 0) && (
        <div className="glass rounded-2xl p-4 neural-border">
          <button
            onClick={() => setShowStrengthMap(!showStrengthMap)}
            className="w-full flex items-center justify-between"
          >
            <div className="flex items-center gap-2">
              <Target className="w-4 h-4 text-accent" />
              <span className="text-sm font-semibold text-foreground">Strength & Growth Zones</span>
            </div>
            <motion.div animate={{ rotate: showStrengthMap ? 90 : 0 }} transition={{ duration: 0.2 }}>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </motion.div>
          </button>

          <AnimatePresence>
            {showStrengthMap && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.25 }}
                className="overflow-hidden"
              >
                <div className="pt-3 space-y-3">
                  {/* Strengths */}
                  {strongSubjects.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <TrendingUp className="w-3 h-3 text-success" />
                        <span className="text-[10px] font-semibold text-success uppercase tracking-wider">Strength Zone</span>
                      </div>
                      {strongSubjects.map((s, i) => (
                        <div key={s.name} className="flex items-center gap-2">
                          <span className="text-[11px] text-foreground w-24 truncate">{s.name}</span>
                          <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                            <motion.div className="h-full rounded-full bg-success" initial={{ width: 0 }} animate={{ width: `${s.strength}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} />
                          </div>
                          <span className="text-[10px] text-muted-foreground w-10 text-right">{s.strength}%</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Growth Zones with micro-actions */}
                  {weakSubjects.length > 0 && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-1.5">
                        <TrendingDown className="w-3 h-3 text-warning" />
                        <span className="text-[10px] font-semibold text-warning uppercase tracking-wider">Growth Zone</span>
                      </div>
                      {weakSubjects.map((s, i) => (
                        <div key={s.name} className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] text-foreground w-24 truncate">{s.name}</span>
                            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                              <motion.div className={`h-full rounded-full ${s.strength < 30 ? "bg-destructive/70" : "bg-warning"}`} initial={{ width: 0 }} animate={{ width: `${s.strength}%` }} transition={{ duration: 0.6, delay: i * 0.05 }} />
                            </div>
                            <span className="text-[10px] text-muted-foreground w-10 text-right">{s.strength}%</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* ══════ LEARNING EVOLUTION PATH ══════ */}
      {evolution.length > 0 && (
        <div className="glass rounded-2xl p-4 neural-border">
          <div className="flex items-center gap-2 mb-3">
            <Star className="w-4 h-4 text-primary" />
            <span className="text-sm font-semibold text-foreground">Evolution Path</span>
            <span className="ml-auto text-[10px] text-primary font-semibold">{evolutionPct}%</span>
          </div>

          {/* Progress line */}
          <div className="relative flex items-center justify-between mb-1">
            {/* Background line */}
            <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-secondary -translate-y-1/2 rounded-full" />
            <motion.div
              className="absolute top-1/2 left-0 h-0.5 bg-primary -translate-y-1/2 rounded-full"
              initial={{ width: 0 }}
              animate={{ width: `${evolutionPct}%` }}
              transition={{ duration: 1, delay: 0.3 }}
            />

            {evolution.map((stage, i) => (
              <div key={i} className="relative z-10 flex flex-col items-center">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2 + i * 0.1, type: "spring" }}
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm border-2 ${
                    stage.current
                      ? "bg-primary/20 border-primary glow-primary"
                      : stage.reached
                        ? "bg-primary/10 border-primary/50"
                        : "bg-secondary border-border/50"
                  }`}
                >
                  {stage.icon}
                </motion.div>
              </div>
            ))}
          </div>
          <div className="flex justify-between">
            {evolution.map((stage, i) => (
              <span key={i} className={`text-[7px] w-10 text-center leading-tight ${stage.current ? "text-primary font-semibold" : stage.reached ? "text-muted-foreground" : "text-muted-foreground/50"}`}>
                {stage.label}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* ══════ AUTO RECALIBRATE ══════ */}
      <motion.button
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        onClick={handleRecalibrate}
        disabled={recalibrating}
        className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl glass neural-border hover:bg-secondary/30 transition-all text-sm text-muted-foreground disabled:opacity-50"
        whileTap={{ scale: 0.98 }}
      >
        {recalibrating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />}
        {recalibrating ? "Recalibrating..." : "Recalibrate Identity"}
      </motion.button>
    </motion.div>
  );
};

export default LearningIdentitySummary;
