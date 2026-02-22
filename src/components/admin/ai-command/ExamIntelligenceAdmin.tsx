import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Dna, Brain, Layers, Sparkles, TrendingUp, BarChart3, RefreshCw,
  AlertTriangle, Target, Atom, FlaskConical, ChevronRight, Zap, Shield
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useExamIntelligence } from "@/hooks/useExamIntelligence";
import { toast } from "sonner";

const EXAM_TYPES = ["UPSC", "NEET", "JEE", "SSC CGL", "CAT", "GATE", "GRE", "SAT", "CLAT", "NDA"];

export default function ExamIntelligenceAdmin() {
  const [examType, setExamType] = useState("NEET");
  const [stats, setStats] = useState<any>(null);
  const [evolutionReport, setEvolutionReport] = useState<any>(null);
  const [clusters, setClusters] = useState<any>(null);
  const [shifts, setShifts] = useState<any>(null);
  const { loading, error, analyzeEvolution, clusterQuestionDNA, detectCurriculumShift, getDashboardStats, retrainModel, extractMicroConcepts, generateQuestions } = useExamIntelligence();

  useEffect(() => {
    getDashboardStats(examType).then(setStats);
  }, [examType]);

  const handleEvolution = async () => {
    const result = await analyzeEvolution(examType);
    if (result) { setEvolutionReport(result); toast.success("Evolution analysis complete"); }
  };

  const handleCluster = async () => {
    const result = await clusterQuestionDNA(examType);
    if (result) { setClusters(result); toast.success(`${result.count} DNA clusters identified`); }
  };

  const handleShifts = async () => {
    const result = await detectCurriculumShift(examType);
    if (result) { setShifts(result); toast.success(`${result.total_detected} shifts detected`); }
  };

  const handleRetrain = async (type: string) => {
    await retrainModel(type, examType);
    toast.success(`${type} model retrained`);
  };

  const handleMicroExtract = async () => {
    const result = await extractMicroConcepts(examType, "Physics", "Mechanics");
    if (result) toast.success(`${result.count} micro-concepts extracted`);
  };

  const handleGenerateQ = async () => {
    const result = await generateQuestions(examType, "Physics", "Mechanics", 5);
    if (result) toast.success(`${result.count} questions generated`);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500/20 to-cyan-500/20 flex items-center justify-center">
            <Dna className="w-5 h-5 text-violet-400" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground flex items-center gap-2">
              Exam Intelligence v10.0
              <Badge variant="outline" className="text-[10px] border-violet-500/30 text-violet-400">SUPERMODEL</Badge>
            </h3>
            <p className="text-xs text-muted-foreground">Autonomous exam evolution modeling & predictive question generation</p>
          </div>
        </div>
        <Select value={examType} onValueChange={setExamType}>
          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
          <SelectContent>
            {EXAM_TYPES.map(e => <SelectItem key={e} value={e}>{e}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats Overview */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
        {[
          { label: "Evolution Reports", count: stats?.evolution_reports?.count || 0, icon: TrendingUp, color: "text-emerald-400" },
          { label: "Micro-Concepts", count: stats?.micro_concepts?.count || 0, icon: Atom, color: "text-cyan-400" },
          { label: "DNA Clusters", count: stats?.dna_clusters?.count || 0, icon: Dna, color: "text-violet-400" },
          { label: "Generated Qs", count: stats?.generated_questions?.count || 0, icon: Sparkles, color: "text-amber-400" },
          { label: "Curriculum Shifts", count: stats?.curriculum_shifts?.count || 0, icon: AlertTriangle, color: "text-red-400" },
        ].map((s, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="bg-card/50 border-border/50">
              <CardContent className="p-3 text-center">
                <s.icon className={`w-4 h-4 mx-auto mb-1 ${s.color}`} />
                <p className="text-lg font-bold text-foreground">{s.count}</p>
                <p className="text-[10px] text-muted-foreground">{s.label}</p>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Module Tabs */}
      <Tabs defaultValue="evolution" className="space-y-3">
        <TabsList className="grid grid-cols-3 sm:grid-cols-6 h-auto gap-1 bg-transparent p-0">
          {[
            { value: "evolution", label: "Evolution", icon: TrendingUp },
            { value: "micro", label: "Micro-Concepts", icon: Atom },
            { value: "dna", label: "Question DNA", icon: Dna },
            { value: "generate", label: "Generative", icon: Sparkles },
            { value: "shifts", label: "Curriculum", icon: Layers },
            { value: "retrain", label: "Retrain", icon: RefreshCw },
          ].map(t => (
            <TabsTrigger key={t.value} value={t.value} className="text-xs data-[state=active]:bg-primary/15 data-[state=active]:text-primary flex items-center gap-1">
              <t.icon className="w-3 h-3" /> {t.label}
            </TabsTrigger>
          ))}
        </TabsList>

        {/* Evolution Tab */}
        <TabsContent value="evolution" className="space-y-3">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-emerald-400" />
                Meta-Pattern Evolution Model
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Analyze time-series topic rotation, difficulty inflation, and structural shifts for {examType}.</p>
              <Button size="sm" onClick={handleEvolution} disabled={loading} className="text-xs">
                <BarChart3 className="w-3 h-3 mr-1" /> Run Evolution Analysis
              </Button>
              {evolutionReport && (
                <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-2 pt-2 border-t border-border/30">
                  <div className="grid grid-cols-3 gap-2">
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground">Difficulty Inflation</p>
                      <p className="text-sm font-bold text-foreground">{(evolutionReport.difficulty_inflation_rate * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground">Structural Drift</p>
                      <p className="text-sm font-bold text-foreground">{(evolutionReport.structural_drift_index * 100).toFixed(0)}%</p>
                    </div>
                    <div className="p-2 rounded-lg bg-secondary/50">
                      <p className="text-[10px] text-muted-foreground">Topic Rotation</p>
                      <p className="text-sm font-bold text-foreground">{(evolutionReport.topic_rotation_score * 100).toFixed(0)}%</p>
                    </div>
                  </div>
                  {evolutionReport.rising_topics?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">📈 Rising Topics</p>
                      <div className="flex flex-wrap gap-1">
                        {evolutionReport.rising_topics.map((t: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {evolutionReport.declining_topics?.length > 0 && (
                    <div>
                      <p className="text-[10px] text-muted-foreground mb-1">📉 Declining Topics</p>
                      <div className="flex flex-wrap gap-1">
                        {evolutionReport.declining_topics.map((t: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-[10px] border-red-500/30 text-red-400">{t}</Badge>
                        ))}
                      </div>
                    </div>
                  )}
                </motion.div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Micro-Concepts Tab */}
        <TabsContent value="micro" className="space-y-3">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Atom className="w-4 h-4 text-cyan-400" />
                Subtopic Granular Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Break topics into micro-concepts with probability scores. Inject into memory & revision engines.</p>
              <Button size="sm" onClick={handleMicroExtract} disabled={loading} className="text-xs">
                <Atom className="w-3 h-3 mr-1" /> Extract Micro-Concepts (Sample: Physics/Mechanics)
              </Button>
              {stats?.micro_concepts?.data?.length > 0 && (
                <div className="space-y-1 pt-2 border-t border-border/30 max-h-48 overflow-y-auto">
                  {stats.micro_concepts.data.slice(0, 10).map((mc: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-1.5 rounded bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <div className={`w-1.5 h-1.5 rounded-full ${mc.trend_direction === 'rising' ? 'bg-emerald-400' : mc.trend_direction === 'declining' ? 'bg-red-400' : 'bg-amber-400'}`} />
                        <span className="text-xs text-foreground">{mc.micro_concept}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px]">{(mc.probability_score * 100).toFixed(0)}%</Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Question DNA Tab */}
        <TabsContent value="dna" className="space-y-3">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Dna className="w-4 h-4 text-violet-400" />
                Question DNA Clustering
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Extract cognitive structure features, cluster by concept layering, detect rising archetypes.</p>
              <Button size="sm" onClick={handleCluster} disabled={loading} className="text-xs">
                <Dna className="w-3 h-3 mr-1" /> Run DNA Clustering
              </Button>
              {(clusters?.clusters || stats?.dna_clusters?.data)?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/30">
                  {(clusters?.clusters || stats?.dna_clusters?.data).slice(0, 8).map((c: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <Dna className="w-3 h-3 text-violet-400" />
                        <div>
                          <p className="text-xs font-medium text-foreground">{c.cluster_label}</p>
                          <p className="text-[10px] text-muted-foreground">{c.archetype}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        {c.is_rising && <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">↑ Rising</Badge>}
                        <span className="text-[10px] text-muted-foreground">{c.cluster_size || 0} Qs</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Generative Tab */}
        <TabsContent value="generate" className="space-y-3">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-amber-400" />
                Generative Question Engine
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">AI-powered future-style question generation aligned with predicted high-probability micro-topics.</p>
              <Button size="sm" onClick={handleGenerateQ} disabled={loading} className="text-xs">
                <Sparkles className="w-3 h-3 mr-1" /> Generate Questions (Sample: Physics/Mechanics)
              </Button>
              {stats?.generated_questions?.data?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/30 max-h-60 overflow-y-auto">
                  {stats.generated_questions.data.slice(0, 5).map((q: any, i: number) => (
                    <div key={i} className="p-2 rounded-lg bg-secondary/30 space-y-1">
                      <div className="flex items-center justify-between">
                        <Badge variant="outline" className="text-[9px]">{q.difficulty_level}</Badge>
                        <div className="flex items-center gap-1">
                          <Badge variant="outline" className="text-[9px]">{q.cognitive_type}</Badge>
                          {q.is_approved ? (
                            <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border-0">Approved</Badge>
                          ) : (
                            <Badge className="text-[9px] bg-amber-500/20 text-amber-400 border-0">Pending</Badge>
                          )}
                        </div>
                      </div>
                      <p className="text-xs text-foreground line-clamp-2">{q.question_text}</p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Curriculum Shift Tab */}
        <TabsContent value="shifts" className="space-y-3">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <Layers className="w-4 h-4 text-orange-400" />
                Predictive Curriculum Shift Detection
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">Detect syllabus structure changes, auto-recalibrate memory weighting, update Topic Intelligence Scores.</p>
              <Button size="sm" onClick={handleShifts} disabled={loading} className="text-xs">
                <AlertTriangle className="w-3 h-3 mr-1" /> Detect Shifts
              </Button>
              {(shifts?.shifts || stats?.curriculum_shifts?.data)?.length > 0 && (
                <div className="space-y-1.5 pt-2 border-t border-border/30">
                  {(shifts?.shifts || stats?.curriculum_shifts?.data).slice(0, 8).map((s: any, i: number) => (
                    <div key={i} className="flex items-center justify-between p-2 rounded-lg bg-secondary/30">
                      <div className="flex items-center gap-2">
                        <ChevronRight className={`w-3 h-3 ${s.shift_type?.includes('increase') ? 'text-emerald-400' : 'text-red-400'}`} />
                        <div>
                          <p className="text-xs font-medium text-foreground">{s.affected_topic}</p>
                          <p className="text-[10px] text-muted-foreground">{s.shift_type}</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-xs text-foreground">{s.old_weight} → {s.new_weight}</p>
                        <p className="text-[10px] text-muted-foreground">Conf: {(s.confidence * 100).toFixed(0)}%</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Retrain Tab */}
        <TabsContent value="retrain" className="space-y-3">
          <Card className="bg-card/60 border-border/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm flex items-center gap-2">
                <RefreshCw className="w-4 h-4 text-blue-400" />
                Model Retraining Control
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { type: "evolution", label: "Evolution Model", icon: TrendingUp, color: "text-emerald-400" },
                  { type: "micro_concept", label: "Micro-Concept Model", icon: Atom, color: "text-cyan-400" },
                  { type: "question_dna", label: "Question DNA Model", icon: Dna, color: "text-violet-400" },
                  { type: "generative", label: "Generative Engine", icon: Sparkles, color: "text-amber-400" },
                  { type: "curriculum", label: "Curriculum Shift Model", icon: Layers, color: "text-orange-400" },
                  { type: "confidence", label: "Confidence Band Model", icon: Shield, color: "text-blue-400" },
                ].map(m => (
                  <Button
                    key={m.type}
                    variant="outline"
                    size="sm"
                    onClick={() => handleRetrain(m.type)}
                    disabled={loading}
                    className="text-xs justify-start h-auto py-2.5"
                  >
                    <m.icon className={`w-3.5 h-3.5 mr-1.5 ${m.color}`} />
                    <div className="text-left">
                      <p className="text-xs">{m.label}</p>
                      <p className="text-[10px] text-muted-foreground">Retrain for {examType}</p>
                    </div>
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}
    </div>
  );
}
