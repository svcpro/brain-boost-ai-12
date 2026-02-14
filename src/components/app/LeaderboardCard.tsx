import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Trophy, Flame, Clock, Crown, Medal, Award, RefreshCw, Gift, Snowflake } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface LeaderboardEntry {
  position: number;
  user_id: string;
  display_name: string;
  is_current_user: boolean;
  predicted_rank: number;
  percentile: number;
  streak: number;
  total_study_hours: number;
}

const positionIcons = [Crown, Medal, Award];
const positionColors = ["text-warning", "text-muted-foreground", "text-orange-400"];

const LeaderboardCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [gifting, setGifting] = useState<string | null>(null);

  const loadLeaderboard = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (session) headers["Authorization"] = `Bearer ${session.access_token}`;

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/leaderboard`,
        { method: "POST", headers }
      );

      if (response.ok) {
        const data = await response.json();
        setEntries(data.leaderboard || []);
      }
    } catch (e) {
      console.error("Leaderboard error:", e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLeaderboard();
  }, []);

  const sendFreezeGift = async (recipientId: string) => {
    if (!user) return;
    setGifting(recipientId);
    try {
      // Check 1/week limit
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data: recentGifts } = await (supabase as any)
        .from("freeze_gifts")
        .select("id")
        .eq("sender_id", user.id)
        .gte("created_at", weekAgo.toISOString());

      if (recentGifts && recentGifts.length > 0) {
        toast({ title: "Gift limit reached", description: "You can only gift 1 freeze per week.", variant: "destructive" });
        return;
      }

      // Find an available freeze
      const { data: freezes } = await (supabase as any)
        .from("streak_freezes")
        .select("id")
        .eq("user_id", user.id)
        .is("used_date", null)
        .limit(1);

      if (!freezes || freezes.length === 0) {
        toast({ title: "No freezes available", description: "Earn freezes at streak milestones.", variant: "destructive" });
        return;
      }

      // Create gift request
      const { error } = await (supabase as any)
        .from("freeze_gifts")
        .insert({
          sender_id: user.id,
          recipient_id: recipientId,
          freeze_id: freezes[0].id,
        });

      if (error) throw error;

      toast({ title: "🎁 Gift sent!", description: "They'll need to accept it." });
    } catch {
      toast({ title: "Failed to send gift", variant: "destructive" });
    } finally {
      setGifting(null);
    }
  };

  const currentUserEntry = entries.find(e => e.is_current_user);
  const topEntries = entries.slice(0, 10);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Trophy className="w-4 h-4 text-warning" />
          <h2 className="font-semibold text-foreground text-sm">Leaderboard</h2>
        </div>
        <button
          onClick={loadLeaderboard}
          disabled={loading}
          className="p-1.5 rounded-lg hover:bg-secondary transition-colors"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-muted-foreground ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      {loading ? (
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="h-12 rounded-lg bg-secondary/50 animate-pulse" />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6">
          No students on the leaderboard yet. Run AI Analysis to get ranked!
        </p>
      ) : (
        <div className="space-y-2">
          {/* Current user highlight */}
          {currentUserEntry && currentUserEntry.position > 3 && (
            <div className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/30">
              <div className="flex items-center gap-3">
                <span className="text-xs font-bold text-primary w-6 text-center">
                  #{currentUserEntry.position}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-foreground">You</p>
                </div>
                <div className="flex items-center gap-3 text-[10px]">
                  <span className="flex items-center gap-1 text-warning">
                    <Flame className="w-3 h-3" />{currentUserEntry.streak}d
                  </span>
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />{currentUserEntry.total_study_hours}h
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Top entries */}
          {topEntries.map((entry, i) => {
            const PosIcon = i < 3 ? positionIcons[i] : null;
            const posColor = i < 3 ? positionColors[i] : "";

            return (
              <motion.div
                key={entry.user_id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.04 }}
                className={`flex items-center gap-3 p-3 rounded-xl transition-all ${
                  entry.is_current_user
                    ? "bg-primary/10 border border-primary/30"
                    : "bg-secondary/30 border border-border hover:bg-secondary/50"
                }`}
              >
                {/* Position */}
                <div className="w-7 flex justify-center">
                  {PosIcon ? (
                    <PosIcon className={`w-5 h-5 ${posColor}`} />
                  ) : (
                    <span className="text-xs font-bold text-muted-foreground">
                      #{entry.position}
                    </span>
                  )}
                </div>

                {/* Avatar */}
                <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                  entry.is_current_user
                    ? "bg-primary text-primary-foreground"
                    : "bg-secondary text-foreground"
                }`}>
                  {entry.display_name.slice(0, 2).toUpperCase()}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-medium truncate ${
                    entry.is_current_user ? "text-primary" : "text-foreground"
                  }`}>
                    {entry.is_current_user ? "You" : entry.display_name}
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Top {(100 - (entry.percentile || 0)).toFixed(1)}%
                  </p>
                </div>

                {/* Stats + Gift */}
                <div className="flex items-center gap-2">
                  {entry.streak > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-warning font-medium">
                      <Flame className="w-3 h-3" />{entry.streak}
                    </span>
                  )}
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="w-3 h-3" />{entry.total_study_hours}h
                  </span>
                  {!entry.is_current_user && user && (
                    <button
                      onClick={(e) => { e.stopPropagation(); sendFreezeGift(entry.user_id); }}
                      disabled={gifting === entry.user_id}
                      className="p-1 rounded-md hover:bg-primary/10 transition-colors disabled:opacity-50"
                      title="Gift a streak freeze"
                    >
                      <Gift className={`w-3.5 h-3.5 ${gifting === entry.user_id ? "animate-pulse text-primary" : "text-muted-foreground hover:text-primary"}`} />
                    </button>
                  )}
                </div>
              </motion.div>
            );
          })}

          {entries.length > 10 && (
            <p className="text-[10px] text-muted-foreground text-center pt-2">
              Showing top 10 of {entries.length} students
            </p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default LeaderboardCard;
