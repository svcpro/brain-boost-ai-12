import { useState } from "react";
import { motion } from "framer-motion";
import { Database, Download, Loader2, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

const DataBackup = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [exporting, setExporting] = useState(false);
  const [exported, setExported] = useState(false);

  const exportData = async () => {
    if (!user) return;
    setExporting(true);
    try {
      const [subjects, topics, studyLogs, plans, scores, profile] = await Promise.all([
        supabase.from("subjects").select("*").eq("user_id", user.id),
        supabase.from("topics").select("*").eq("user_id", user.id),
        supabase.from("study_logs").select("*").eq("user_id", user.id),
        supabase.from("study_plans").select("*").eq("user_id", user.id),
        supabase.from("memory_scores").select("*").eq("user_id", user.id),
        supabase.from("profiles").select("*").eq("id", user.id).maybeSingle(),
      ]);

      const backup = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        profile: profile.data,
        subjects: subjects.data || [],
        topics: topics.data || [],
        studyLogs: studyLogs.data || [],
        studyPlans: plans.data || [],
        memoryScores: scores.data || [],
      };

      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `acry-backup-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);

      setExported(true);
      toast({ title: "Backup Downloaded ✅", description: "Your brain data has been exported successfully." });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    } finally {
      setExporting(false);
    }
  };

  return (
    <motion.div
      initial={{ height: 0, opacity: 0 }}
      animate={{ height: "auto", opacity: 1 }}
      exit={{ height: 0, opacity: 0 }}
      transition={{ duration: 0.3 }}
      className="overflow-hidden"
    >
      <div className="glass rounded-xl p-4 neural-border space-y-3 mt-1">
        <p className="text-xs text-muted-foreground">
          Export all your subjects, topics, study logs, and memory scores as a JSON file.
        </p>

        <button
          onClick={exportData}
          disabled={exporting}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95 disabled:opacity-50"
        >
          {exporting ? (
            <Loader2 className="w-4 h-4 text-primary animate-spin" />
          ) : exported ? (
            <CheckCircle2 className="w-4 h-4 text-success" />
          ) : (
            <Download className="w-4 h-4 text-primary" />
          )}
          <span className="text-sm font-medium text-foreground">
            {exporting ? "Exporting..." : exported ? "Exported!" : "Download Backup"}
          </span>
        </button>

        <p className="text-[10px] text-muted-foreground text-center">
          Your data stays on your device. Nothing is shared externally.
        </p>
      </div>
    </motion.div>
  );
};

export default DataBackup;
