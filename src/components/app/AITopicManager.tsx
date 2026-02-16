import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles, Loader2, BookOpen, Target, AlertTriangle, CheckCircle2,
  ChevronDown, ChevronRight, Search, RefreshCw, Zap, BarChart3, Plus
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface GeneratedTopic {
  name: string;
  marks_impact_weight: number;
  priority: "critical" | "high" | "medium" | "low";
}

interface GeneratedSubject {
  name: string;
  topics: GeneratedTopic[];
}

interface GapTopic {
  subject: string;
  topic_name: string;
  marks_impact_weight: number;
  priority: string;
  reason: string;
}

interface WeightCorrection {
  topic_name: string;
  current_weight: number;
  suggested_weight: number;
  reason: string;
}

interface AITopicManagerProps {
  mode: "admin" | "user";
  targetUserId?: string;
  examType?: string;
  onDone?: () => void;
}

const PRIORITY_COLORS: Record<string, string> = {
  critical: "bg-destructive/15 text-destructive",
  high: "bg-warning/15 text-warning",
  medium: "bg-primary/15 text-primary",
  low: "bg-muted text-muted-foreground",
};

const AITopicManager = ({ mode, targetUserId, examType, onDone }: AITopicManagerProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [tab, setTab] = useState<"generate" | "gaps" | "prioritize">("generate");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);

  // Generate state
  const [curriculum, setCurriculum] = useState<{ subjects: GeneratedSubject[]; total_topics: number; exam_summary: string } | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [expandedSubjects, setExpandedSubjects] = useState<Set<string>>(new Set());
  const [deselectedTopics, setDeselectedTopics] = useState<Set<string>>(new Set());

  // Gap analysis state
  const [gapData, setGapData] = useState<{ coverage_percentage: number; missing_topics: GapTopic[]; weight_corrections: WeightCorrection[]; summary: string } | null>(null);
  const [selectedGaps, setSelectedGaps] = useState<Set<number>>(new Set());

  // Prioritize state
  const [prioritizeResult, setPrioritizeResult] = useState<{ updated: number; total: number } | null>(null);

  // Profile exam type
  const [userExamType, setUserExamType] = useState(examType || "");
  const userId = targetUserId || user?.id;

  useEffect(() => {
    if (!examType && userId) {
      supabase.from("profiles").select("exam_type").eq("id", userId).maybeSingle().then(({ data }) => {
        if (data?.exam_type) setUserExamType(data.exam_type);
      });
    }
  }, [userId, examType]);

  const handleGenerate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "generate_curriculum", exam_type: userExamType, target_user_id: targetUserId },
      });
      if (error) throw error;
      setCurriculum(data);
      // Auto-select all subjects
      const all = new Set<string>((data.subjects || []).map((s: GeneratedSubject) => s.name));
      setSelectedSubjects(all);
      setDeselectedTopics(new Set());
      toast({ title: "✨ Curriculum generated!", description: `${data.total_topics} topics across ${data.subjects?.length || 0} subjects` });
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveCurriculum = async () => {
    if (!curriculum) return;
    setSaving(true);
    try {
      const filteredSubjects = curriculum.subjects
        .filter(s => selectedSubjects.has(s.name))
        .map(s => ({
          ...s,
          topics: s.topics.filter(t => !deselectedTopics.has(`${s.name}:${t.name}`)),
        }));

      const { error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "save_curriculum_data", subjects: filteredSubjects, target_user_id: targetUserId },
      });
      if (error) throw error;
      toast({ title: "✅ Curriculum saved!", description: "Subjects and topics added to the brain." });
      onDone?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleGapAnalysis = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "gap_analysis", target_user_id: targetUserId },
      });
      if (error) throw error;
      setGapData(data);
      // Auto-select all critical/high gaps
      const autoSelect = new Set<number>();
      (data.missing_topics || []).forEach((t: GapTopic, i: number) => {
        if (t.priority === "critical" || t.priority === "high") autoSelect.add(i);
      });
      setSelectedGaps(autoSelect);
      toast({ title: "🔍 Gap analysis complete", description: `${data.coverage_percentage}% syllabus coverage` });
    } catch (e: any) {
      toast({ title: "Analysis failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveGaps = async () => {
    if (!gapData) return;
    setSaving(true);
    try {
      const selected = gapData.missing_topics.filter((_, i) => selectedGaps.has(i));
      // Group by subject
      const bySubject: Record<string, { name: string; topics: { name: string; marks_impact_weight: number }[] }> = {};
      for (const gap of selected) {
        if (!bySubject[gap.subject]) bySubject[gap.subject] = { name: gap.subject, topics: [] };
        bySubject[gap.subject].topics.push({ name: gap.topic_name, marks_impact_weight: gap.marks_impact_weight });
      }

      const { error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "save_curriculum_data", subjects: Object.values(bySubject), target_user_id: targetUserId },
      });
      if (error) throw error;
      toast({ title: "✅ Gap topics added!", description: `${selected.length} topics saved.` });
      onDone?.();
    } catch (e: any) {
      toast({ title: "Save failed", description: e.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const handleAutoPrioritize = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("ai-topic-manager", {
        body: { action: "auto_prioritize", target_user_id: targetUserId },
      });
      if (error) throw error;
      setPrioritizeResult(data);
      toast({ title: "⚡ Auto-prioritization complete", description: `${data.updated}/${data.total} topics updated` });
      onDone?.();
    } catch (e: any) {
      toast({ title: "Prioritization failed", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const toggleSubject = (name: string) => {
    setSelectedSubjects(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleExpand = (name: string) => {
    setExpandedSubjects(prev => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  };

  const toggleTopic = (key: string) => {
    setDeselectedTopics(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleGap = (i: number) => {
    setSelectedGaps(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const tabs = [
    { id: "generate" as const, label: "Auto-Generate", icon: Sparkles },
    { id: "gaps" as const, label: "Gap Analysis", icon: Search },
    { id: "prioritize" as const, label: "Auto-Prioritize", icon: BarChart3 },
  ];

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-2 flex-wrap">
        {tabs.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id ? "bg-primary/15 text-primary" : "text-muted-foreground hover:bg-secondary"
            }`}
          >
            <t.icon className="w-3.5 h-3.5" />
            {t.label}
          </button>
        ))}
      </div>

      {/* Generate Tab */}
      {tab === "generate" && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 neural-border space-y-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Curriculum Generator</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              AI will generate a complete subject & topic structure based on {userExamType || "the exam type"}. Review and approve before saving.
            </p>
            <button
              onClick={handleGenerate}
              disabled={loading || !userExamType}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              {loading ? "Generating..." : "Generate Full Curriculum"}
            </button>
          </div>

          {/* Generated Results */}
          <AnimatePresence>
            {curriculum && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                <div className="glass rounded-xl p-3 neural-border">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <CheckCircle2 className="w-4 h-4 text-success" />
                      <span className="text-sm font-medium text-foreground">{curriculum.total_topics} topics generated</span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{curriculum.exam_summary}</span>
                  </div>
                </div>

                {curriculum.subjects.map(sub => {
                  const isSelected = selectedSubjects.has(sub.name);
                  const isExpanded = expandedSubjects.has(sub.name);
                  const activeTopics = sub.topics.filter(t => !deselectedTopics.has(`${sub.name}:${t.name}`)).length;

                  return (
                    <div key={sub.name} className={`glass rounded-xl neural-border overflow-hidden ${!isSelected ? "opacity-40" : ""}`}>
                      <div className="flex items-center gap-2 p-3">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleSubject(sub.name)}
                          className="w-4 h-4 rounded border-border accent-primary"
                        />
                        <button onClick={() => toggleExpand(sub.name)} className="flex items-center gap-1.5 flex-1 text-left">
                          <BookOpen className="w-4 h-4 text-primary" />
                          <span className="text-sm font-medium text-foreground">{sub.name}</span>
                          <span className="text-[10px] text-muted-foreground ml-1">({activeTopics}/{sub.topics.length} topics)</span>
                          {isExpanded ? <ChevronDown className="w-3.5 h-3.5 ml-auto text-muted-foreground" /> : <ChevronRight className="w-3.5 h-3.5 ml-auto text-muted-foreground" />}
                        </button>
                      </div>

                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden">
                            <div className="px-3 pb-3 space-y-1.5">
                              {sub.topics.map(topic => {
                                const topicKey = `${sub.name}:${topic.name}`;
                                const isTopicSelected = !deselectedTopics.has(topicKey);
                                return (
                                  <label key={topicKey} className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                                    <input
                                      type="checkbox"
                                      checked={isTopicSelected}
                                      onChange={() => toggleTopic(topicKey)}
                                      className="w-3.5 h-3.5 rounded border-border accent-primary"
                                    />
                                    <span className={`text-xs flex-1 ${isTopicSelected ? "text-foreground" : "text-muted-foreground line-through"}`}>{topic.name}</span>
                                    <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[topic.priority]}`}>{topic.priority}</span>
                                    <span className="text-[9px] text-muted-foreground">w:{topic.marks_impact_weight}</span>
                                  </label>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}

                <button
                  onClick={handleSaveCurriculum}
                  disabled={saving || selectedSubjects.size === 0}
                  className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 disabled:opacity-50 transition-colors"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  {saving ? "Saving..." : `Save ${selectedSubjects.size} Subjects to Brain`}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Gap Analysis Tab */}
      {tab === "gaps" && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 neural-border space-y-3">
            <div className="flex items-center gap-2">
              <Search className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">Smart Gap Scanner</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              AI scans existing topics against the complete {userExamType || "exam"} syllabus to find missing coverage.
            </p>
            <button
              onClick={handleGapAnalysis}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              {loading ? "Analyzing..." : "Run Gap Analysis"}
            </button>
          </div>

          <AnimatePresence>
            {gapData && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
                {/* Coverage bar */}
                <div className="glass rounded-xl p-4 neural-border">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-foreground">Syllabus Coverage</span>
                    <span className={`text-sm font-bold ${gapData.coverage_percentage >= 80 ? "text-success" : gapData.coverage_percentage >= 50 ? "text-warning" : "text-destructive"}`}>
                      {gapData.coverage_percentage}%
                    </span>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${gapData.coverage_percentage}%` }}
                      className={`h-full rounded-full ${gapData.coverage_percentage >= 80 ? "bg-success" : gapData.coverage_percentage >= 50 ? "bg-warning" : "bg-destructive"}`}
                    />
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-2">{gapData.summary}</p>
                </div>

                {/* Missing Topics */}
                {gapData.missing_topics.length > 0 && (
                  <div className="glass rounded-xl p-4 neural-border space-y-2">
                    <div className="flex items-center justify-between">
                      <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-warning" />
                        Missing Topics ({gapData.missing_topics.length})
                      </h4>
                      <button
                        onClick={() => {
                          const all = new Set(gapData.missing_topics.map((_, i) => i));
                          setSelectedGaps(selectedGaps.size === gapData.missing_topics.length ? new Set() : all);
                        }}
                        className="text-[10px] text-primary font-medium"
                      >
                        {selectedGaps.size === gapData.missing_topics.length ? "Deselect All" : "Select All"}
                      </button>
                    </div>
                    {gapData.missing_topics.map((gap, i) => (
                      <label key={i} className="flex items-start gap-2 p-2 rounded-lg hover:bg-secondary/50 cursor-pointer transition-colors">
                        <input
                          type="checkbox"
                          checked={selectedGaps.has(i)}
                          onChange={() => toggleGap(i)}
                          className="w-3.5 h-3.5 mt-0.5 rounded border-border accent-primary"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs font-medium text-foreground">{gap.topic_name}</span>
                            <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{gap.subject}</span>
                            <span className={`text-[9px] px-1.5 py-0.5 rounded-full ${PRIORITY_COLORS[gap.priority]}`}>{gap.priority}</span>
                            <span className="text-[9px] text-muted-foreground">w:{gap.marks_impact_weight}</span>
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">{gap.reason}</p>
                        </div>
                      </label>
                    ))}

                    <button
                      onClick={handleSaveGaps}
                      disabled={saving || selectedGaps.size === 0}
                      className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                      {saving ? "Adding..." : `Add ${selectedGaps.size} Topics to Brain`}
                    </button>
                  </div>
                )}

                {/* Weight Corrections */}
                {gapData.weight_corrections.length > 0 && (
                  <div className="glass rounded-xl p-4 neural-border space-y-2">
                    <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                      <BarChart3 className="w-4 h-4 text-accent" />
                      Weight Corrections ({gapData.weight_corrections.length})
                    </h4>
                    {gapData.weight_corrections.map((wc, i) => (
                      <div key={i} className="flex items-center gap-2 p-2 rounded-lg bg-secondary/30">
                        <span className="text-xs text-foreground flex-1">{wc.topic_name}</span>
                        <span className="text-[10px] text-muted-foreground line-through">{wc.current_weight}</span>
                        <span className="text-[10px] text-primary font-semibold">→ {wc.suggested_weight}</span>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Auto-Prioritize Tab */}
      {tab === "prioritize" && (
        <div className="space-y-4">
          <div className="glass rounded-xl p-4 neural-border space-y-3">
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">AI Auto-Prioritizer</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              AI recalculates marks_impact_weight for all topics based on {userExamType || "exam"} patterns and question frequency.
            </p>
            <button
              onClick={handleAutoPrioritize}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
              {loading ? "Analyzing..." : "Run Auto-Prioritize"}
            </button>
          </div>

          <AnimatePresence>
            {prioritizeResult && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="glass rounded-xl p-4 neural-border">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <div>
                    <p className="text-sm font-medium text-foreground">Prioritization Complete</p>
                    <p className="text-[10px] text-muted-foreground">{prioritizeResult.updated} of {prioritizeResult.total} topics updated with AI-calculated weights</p>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
};

export default AITopicManager;
