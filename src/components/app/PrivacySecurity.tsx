import { useState } from "react";
import { motion } from "framer-motion";
import { Shield, Eye, EyeOff, Trash2, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

const PrivacySecurity = () => {
  const { user, signOut } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [leaderboardVisible, setLeaderboardVisible] = useState(true);
  const [deleting, setDeleting] = useState(false);

  const toggleLeaderboard = async () => {
    if (!user) return;
    const next = !leaderboardVisible;
    setLeaderboardVisible(next);
    await supabase.from("profiles").update({ opt_in_leaderboard: next }).eq("id", user.id);
    toast({ title: next ? "Profile visible on leaderboard" : "Profile hidden from leaderboard" });
  };

  const deleteAllData = async () => {
    if (!user) return;
    setDeleting(true);
    try {
      await Promise.all([
        supabase.from("study_logs").delete().eq("user_id", user.id),
        supabase.from("memory_scores").delete().eq("user_id", user.id),
        supabase.from("ai_recommendations").delete().eq("user_id", user.id),
        supabase.from("brain_reports").delete().eq("user_id", user.id),
        supabase.from("rank_predictions").delete().eq("user_id", user.id),
      ]);

      // Delete topics then subjects (order matters for FK)
      const { data: subjects } = await supabase.from("subjects").select("id").eq("user_id", user.id);
      if (subjects) {
        for (const sub of subjects) {
          await supabase.from("topics").delete().eq("subject_id", sub.id);
        }
        await supabase.from("subjects").delete().eq("user_id", user.id);
      }

      await supabase.from("study_plans").delete().eq("user_id", user.id);

      toast({ title: "All data deleted", description: "Your brain data has been wiped clean." });
      await signOut();
      navigate("/");
    } catch (e: any) {
      toast({ title: "Delete failed", description: e.message, variant: "destructive" });
    }
    setDeleting(false);
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
        {/* Leaderboard visibility */}
        <button
          onClick={toggleLeaderboard}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors"
        >
          {leaderboardVisible ? <Eye className="w-4 h-4 text-primary" /> : <EyeOff className="w-4 h-4 text-muted-foreground" />}
          <div className="flex-1 text-left">
            <p className="text-sm text-foreground">Leaderboard Visibility</p>
            <p className="text-[10px] text-muted-foreground">{leaderboardVisible ? "Your profile is visible" : "Your profile is hidden"}</p>
          </div>
        </button>

        {/* Clear local data */}
        <button
          onClick={() => {
            localStorage.clear();
            toast({ title: "Local cache cleared", description: "Cached data has been removed from this device." });
          }}
          className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-secondary/30 transition-colors"
        >
          <Shield className="w-4 h-4 text-warning" />
          <div className="flex-1 text-left">
            <p className="text-sm text-foreground">Clear Local Cache</p>
            <p className="text-[10px] text-muted-foreground">Remove cached data from this device</p>
          </div>
        </button>

        {/* Delete all data */}
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <button className="w-full flex items-center gap-3 p-3 rounded-lg hover:bg-destructive/10 transition-colors">
              <Trash2 className="w-4 h-4 text-destructive" />
              <div className="flex-1 text-left">
                <p className="text-sm text-destructive font-medium">Delete All Data</p>
                <p className="text-[10px] text-muted-foreground">Permanently remove all your brain data</p>
              </div>
            </button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
              <AlertDialogDescription>
                This will permanently delete all your subjects, topics, study logs, memory scores, and predictions.
                This action cannot be undone.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={deleteAllData} disabled={deleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Delete Everything"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </motion.div>
  );
};

export default PrivacySecurity;
