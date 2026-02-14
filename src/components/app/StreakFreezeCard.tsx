import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Snowflake, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";

interface StreakFreezeCardProps {
  availableFreezes: number;
  usedToday: boolean;
  canUseToday: boolean; // true if streak would break today without freeze
  onFreezeUsed: () => void;
}

const StreakFreezeCard = ({ availableFreezes, usedToday, canUseToday, onFreezeUsed }: StreakFreezeCardProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [using, setUsing] = useState(false);

  const useFreeze = async () => {
    if (!user || availableFreezes <= 0 || usedToday || !canUseToday) return;
    setUsing(true);
    try {
      const today = new Date().toISOString().split("T")[0];

      // Find an unused freeze and mark it used
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
      toast({
        title: "❄️ Streak frozen!",
        description: "Your streak is protected for today.",
      });
      onFreezeUsed();
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
      </div>

      <div className="flex items-center gap-3">
        {/* Freeze icons */}
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
        Skip one day without breaking your streak. Earn freezes at every 7-day milestone.
      </p>
    </motion.div>
  );
};

export default StreakFreezeCard;
