import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { GraduationCap, BookOpen, Users, BarChart3, Loader2, Brain, FileText } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export default function TeacherModeAdmin() {
  const { toast } = useToast();
  const [tab, setTab] = useState("sets");
  const [practiceSets, setPracticeSets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [submissions, setSubmissions] = useState<any[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    const [setsRes, subsRes] = await Promise.all([
      supabase.from("teacher_practice_sets").select("*").order("created_at", { ascending: false }),
      supabase.from("practice_set_submissions").select("*").order("submitted_at", { ascending: false }).limit(50),
    ]);
    setPracticeSets((setsRes.data as any[]) || []);
    setSubmissions((subsRes.data as any[]) || []);
    setLoading(false);
  };

  const stats = {
    totalSets: practiceSets.length,
    published: practiceSets.filter(s => s.status === "published").length,
    aiGenerated: practiceSets.filter(s => s.ai_generated).length,
    totalSubmissions: submissions.length,
    avgScore: submissions.length > 0
      ? Math.round(submissions.reduce((s, sub) => s + (sub.score || 0), 0) / submissions.length)
      : 0,
  };

  const STATUS_COLORS: Record<string, string> = {
    draft: "bg-warning/15 text-warning",
    published: "bg-success/15 text-success",
    archived: "bg-muted text-muted-foreground",
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
          <GraduationCap className="w-5 h-5 text-accent" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">AI Teacher Mode</h2>
          <p className="text-xs text-muted-foreground">Adaptive practice sets & class performance analytics</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Practice Sets", value: stats.totalSets, icon: FileText },
          { label: "Published", value: stats.published, icon: BookOpen },
          { label: "AI Generated", value: stats.aiGenerated, icon: Brain },
          { label: "Submissions", value: stats.totalSubmissions, icon: Users },
          { label: "Avg Score", value: `${stats.avgScore}%`, icon: BarChart3 },
        ].map(s => (
          <div key={s.label} className="glass rounded-xl p-3 neural-border">
            <div className="flex items-center gap-1.5 mb-1">
              <s.icon className="w-3.5 h-3.5 text-muted-foreground" />
              <span className="text-[10px] text-muted-foreground">{s.label}</span>
            </div>
            <span className="text-lg font-bold text-foreground">{s.value}</span>
          </div>
        ))}
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-secondary/50">
          <TabsTrigger value="sets" className="text-xs">Practice Sets</TabsTrigger>
          <TabsTrigger value="submissions" className="text-xs">Submissions</TabsTrigger>
        </TabsList>

        <TabsContent value="sets" className="mt-4">
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>
          ) : practiceSets.length === 0 ? (
            <div className="glass rounded-xl p-8 neural-border text-center">
              <FileText className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No practice sets created yet</p>
              <p className="text-[10px] text-muted-foreground mt-1">Teachers can create AI-generated practice sets from the Teacher Mode</p>
            </div>
          ) : (
            <div className="space-y-2">
              {practiceSets.map(set => (
                <motion.div key={set.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="glass rounded-xl p-4 neural-border">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{set.title}</span>
                        <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full capitalize ${STATUS_COLORS[set.status] || "bg-secondary text-muted-foreground"}`}>{set.status}</span>
                        {set.ai_generated && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-full bg-primary/15 text-primary">AI</span>}
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <span className="text-[10px] text-muted-foreground">{set.subject}</span>
                        <span className="text-[10px] text-muted-foreground">{set.question_count} questions</span>
                        <span className="text-[10px] text-muted-foreground capitalize">{set.difficulty}</span>
                        <span className="text-[10px] text-muted-foreground">{(set.assigned_to || []).length} assigned</span>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-xs font-medium text-foreground">{set.completion_count || 0}</span>
                      <p className="text-[10px] text-muted-foreground">completions</p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="submissions" className="mt-4">
          {submissions.length === 0 ? (
            <div className="glass rounded-xl p-8 neural-border text-center">
              <Users className="w-8 h-8 text-muted-foreground mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No submissions yet</p>
            </div>
          ) : (
            <div className="space-y-2">
              {submissions.map(sub => (
                <div key={sub.id} className="glass rounded-xl p-3 neural-border flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-secondary flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <span className="text-xs font-medium text-foreground">{sub.student_id.slice(0, 8)}...</span>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className="text-[10px] text-muted-foreground">{sub.time_spent_minutes || 0} min</span>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className={`text-sm font-bold ${(sub.score || 0) >= 70 ? "text-success" : (sub.score || 0) >= 40 ? "text-warning" : "text-destructive"}`}>
                      {sub.score != null ? `${Math.round(sub.score)}%` : "—"}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
