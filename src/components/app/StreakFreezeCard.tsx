import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Snowflake, History, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";
import { format } from "date-fns";

interface FreezeRecord {
  id: string;
  earned_at: string;
  used_date: string | null;
}

interface StreakFreezeCardProps {
  availableFreezes: number;
  usedToday: boolean;
  canUseToday: boolean;
  onFreezeUsed: () => void;
}

const StreakFreezeCard = ({ availableFreezes, usedToday, canUseToday, onFreezeUsed }: StreakFreezeCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [using, setUsing] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [history, setHistory] = useState<FreezeRecord[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);

  const loadHistory = useCallback(async () => {
    if (!user) return;
    setLoadingHistory(true);
    const { data } = await (supabase as any)
      .from("streak_freezes")
      .select("id, earned_at, used_date")
      .eq("user_id", user.id)
      .order("earned_at", { ascending: false })
      .limit(20);
    setHistory(data || []);
    setLoadingHistory(false);
  }, [user]);

  useEffect(() => {
    if (showHistory && history.length === 0) loadHistory();
  }, [showHistory, loadHistory]);

  const useFreeze = async () => {
    if (!user || availableFreezes <= 0 || usedToday || !canUseToday) return;
    setUsing(true);
    try {
      const today = new Date().toISOString().split("T")[0];
      const { data: freezes } = await (supabase as any)
        .from("streak_freezes")
        .select("id")
        .eq("user_id", user.id)
        .is("used_date", null)
        .limit(1);

      if (!freezes || freezes.length === 0) {
        toast({ title: "No freezes available", variant: "destructive" });
        return;
      }

      const { error } = await (supabase as any)
        .from("streak_freezes")
        .update({ used_date: today })
        .eq("id", freezes[0].id);

      if (error) throw error;

      notifyFeedback();
      toast({ title: "❄️ Streak frozen!", description: "Your streak is protected for today." });
      onFreezeUsed();
      if (showHistory) loadHistory();
    } catch {
      toast({ title: "Failed to use freeze", variant: "destructive" });
    } finally {
      setUsing(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      <div className="flex items-center gap-2 mb-3">
        <Snowflake className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">Streak Freeze</h3>
        <span className="ml-auto text-[10px] text-muted-foreground">
          {availableFreezes} available
        </span>
        <button
          onClick={() => setShowHistory((s) => !s)}
          className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all"
          title="Freeze history"
        >
          <History className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          {Array.from({ length: Math.min(availableFreezes, 5) }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center"
            >
              <Snowflake className="w-4 h-4 text-primary" />
            </motion.div>
          ))}
          {availableFreezes === 0 && (
            <span className="text-xs text-muted-foreground">No freezes — earn one at 7-day streaks!</span>
          )}
        </div>

        <div className="ml-auto">
          {usedToday ? (
            <span className="text-[10px] text-primary font-medium px-2 py-1 rounded-full bg-primary/10">
              ❄️ Active today
            </span>
          ) : canUseToday ? (
            <button
              onClick={useFreeze}
              disabled={using || availableFreezes <= 0}
              className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
            >
              <Snowflake className="w-3 h-3" />
              {using ? "Using…" : "Use freeze"}
            </button>
          ) : (
            <span className="text-[10px] text-muted-foreground">Streak safe ✓</span>
          )}
        </div>
      </div>

      <p className="text-[9px] text-muted-foreground mt-2">
        Skip one day without breaking your streak. Earn freezes at milestones: 7d → 1, 14d → 2, 30d → 3.
      </p>

      {/* History panel */}
      <AnimatePresence>
        {showHistory && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border overflow-hidden"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <History className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-foreground">Freeze History</span>
              <span className="text-[9px] text-muted-foreground ml-auto">{history.length} total</span>
            </div>

            {loadingHistory ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">Loading…</p>
            ) : history.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">No freezes earned yet.</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {history.map((f, i) => (
                  <motion.div
                    key={f.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/30"
                  >
                    <Snowflake className={`w-3 h-3 shrink-0 ${f.used_date ? "text-muted-foreground" : "text-primary"}`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-foreground">
                        Earned {format(new Date(f.earned_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {f.used_date ? (
                      <span className="text-[9px] text-muted-foreground shrink-0">
                        Used {format(new Date(f.used_date + "T00:00:00"), "MMM d")}
                      </span>
                    ) : (
                      <span className="text-[9px] text-primary font-medium shrink-0">Available</span>
                    )}
                  </motion.div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

export default StreakFreezeCard;
