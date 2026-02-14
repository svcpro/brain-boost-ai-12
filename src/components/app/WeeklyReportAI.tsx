import { useState, useCallback } from "react";
import { motion } from "framer-motion";
import { BarChart3, X, Loader2, RefreshCw, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { subDays, format } from "date-fns";

interface WeeklyReportAIProps {
  onClose: () => void;
}

const WeeklyReportAI = ({ onClose }: WeeklyReportAIProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<string | null>(null);

  const generate = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const since = subDays(new Date(), 7).toISOString();

      const [logsRes, topicsRes, subjectsRes] = await Promise.all([
        supabase.from("study_logs").select("*").eq("user_id", user.id).gte("created_at", since),
        supabase.from("topics").select("name, memory_strength, last_revision_date, subject_id").eq("user_id", user.id),
        supabase.from("subjects").select("id, name").eq("user_id", user.id),
      ]);

      const logs = logsRes.data || [];
      const topics = topicsRes.data || [];
      const subjects = subjectsRes.data || [];
      const subMap = new Map(subjects.map(s => [s.id, s.name]));

      const totalMinutes = logs.reduce((s, l) => s + l.duration_minutes, 0);
      const totalSessions = logs.length;
      const avgStrength = topics.length > 0
        ? Math.round(topics.reduce((s, t) => s + Number(t.memory_strength), 0) / topics.length)
        : 0;

      const weakTopics = topics
        .filter(t => Number(t.memory_strength) < 50)
        .map(t => `${t.name} (${subMap.get(t.subject_id) || "Unknown"}: ${t.memory_strength}%)`)
        .slice(0, 5);

      const LOVABLE_API_KEY = "ai-gateway"; // Edge function handles the key

      const { data, error } = await supabase.functions.invoke("memory-engine", {
        body: {
          type: "weekly_report",
          stats: {
            totalMinutes,
            totalSessions,
            avgStrength,
            topicCount: topics.length,
            weakTopics,
            subjectCount: subjects.length,
          },
        },
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.result || "Could not generate report.";
      setReport(content);
    } catch (e: any) {
      toast({ title: "Report generation failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [user, toast]);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">AI Weekly Report</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {!report && !loading && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              AI will analyze your past 7 days of study activity, identify patterns, and give personalized recommendations.
            </p>
            <button
              onClick={generate}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95"
            >
              <Sparkles className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Generate Weekly Report</span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Analyzing your study patterns...</p>
          </div>
        )}

        {report && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
            <div className="prose prose-sm prose-invert max-w-none">
              {report.split("\n").map((line, i) => {
                if (line.startsWith("##")) return <h3 key={i} className="text-sm font-semibold text-foreground mt-3 mb-1">{line.replace(/^#+\s*/, "")}</h3>;
                if (line.startsWith("**")) return <p key={i} className="text-xs text-foreground font-medium">{line.replace(/\*\*/g, "")}</p>;
                if (line.startsWith("- ") || line.startsWith("• ")) return <p key={i} className="text-xs text-muted-foreground pl-3">• {line.replace(/^[-•]\s*/, "")}</p>;
                if (line.trim() === "") return <div key={i} className="h-2" />;
                return <p key={i} className="text-xs text-muted-foreground">{line}</p>;
              })}
            </div>

            <button
              onClick={() => { setReport(null); generate(); }}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              Regenerate
            </button>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default WeeklyReportAI;
