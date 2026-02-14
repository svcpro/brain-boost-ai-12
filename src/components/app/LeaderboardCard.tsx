import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Flame, Clock, Crown, Medal, Award, RefreshCw, Gift, Snowflake, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { getPushNotifPrefs } from "./NotificationPreferencesPanel";
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
const positionGlows = [
  "shadow-[0_0_12px_hsl(var(--warning)/0.4)]",
  "shadow-[0_0_8px_hsl(var(--muted-foreground)/0.2)]",
  "shadow-[0_0_8px_rgba(251,146,60,0.3)]",
];

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

      // Send push notification to recipient
      try {
        await supabase.functions.invoke("send-push-notification", {
          body: {
            recipient_id: recipientId,
            title: "🎁 You received a freeze gift!",
            body: "Someone sent you a streak freeze. Open ACRY to accept it.",
            data: { type: "freeze_gift" },
          },
        });
      } catch (pushErr) {
        console.warn("Push notification failed:", pushErr);
      }

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
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: [0.3, 0.6, 0.3] }}
              transition={{ duration: 1.2, repeat: Infinity, delay: i * 0.15 }}
              className="h-14 rounded-xl bg-secondary/50"
            />
          ))}
        </div>
      ) : entries.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center py-8"
        >
          <Trophy className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">
            No students on the leaderboard yet.
          </p>
          <p className="text-xs text-muted-foreground/60 mt-1">Run AI Analysis to get ranked!</p>
        </motion.div>
      ) : (
        <div className="space-y-2">
          {/* Current user highlight when outside top 3 */}
          {currentUserEntry && currentUserEntry.position > 3 && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="mb-3 p-3 rounded-xl bg-primary/10 border border-primary/30 relative overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-primary/10 to-primary/5 animate-pulse" />
              <div className="flex items-center gap-3 relative">
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
            </motion.div>
          )}

          {/* Top entries */}
          <AnimatePresence mode="popLayout">
            {topEntries.map((entry, i) => {
              const PosIcon = i < 3 ? positionIcons[i] : null;
              const posColor = i < 3 ? positionColors[i] : "";
              const posGlow = i < 3 ? positionGlows[i] : "";
              const isTop3 = i < 3;

              return (
                <motion.div
                  key={entry.user_id}
                  layout
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, x: 20, scale: 0.95 }}
                  transition={{
                    delay: i * 0.06,
                    type: "spring",
                    stiffness: 300,
                    damping: 25,
                  }}
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.98 }}
                  className={`flex items-center gap-3 p-3 rounded-xl transition-colors relative overflow-hidden ${
                    entry.is_current_user
                      ? "bg-primary/10 border border-primary/30"
                      : isTop3
                      ? `bg-secondary/40 border border-border/60 ${posGlow}`
                      : "bg-secondary/30 border border-border hover:bg-secondary/50"
                  }`}
                >
                  {/* Shimmer for top 3 */}
                  {isTop3 && (
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-transparent via-white/[0.03] to-transparent"
                      animate={{ x: ["-100%", "200%"] }}
                      transition={{ duration: 3, repeat: Infinity, delay: i * 0.8, ease: "easeInOut" }}
                      style={{ width: "50%" }}
                    />
                  )}

                  {/* Position */}
                  <div className="w-7 flex justify-center relative">
                    {PosIcon ? (
                      <motion.div
                        initial={{ rotate: -15, scale: 0 }}
                        animate={{ rotate: 0, scale: 1 }}
                        transition={{ delay: i * 0.06 + 0.2, type: "spring", stiffness: 400 }}
                      >
                        <PosIcon className={`w-5 h-5 ${posColor} drop-shadow-sm`} />
                      </motion.div>
                    ) : (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.06 + 0.15 }}
                        className="text-xs font-bold text-muted-foreground"
                      >
                        #{entry.position}
                      </motion.span>
                    )}
                  </div>

                  {/* Avatar */}
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: i * 0.06 + 0.1, type: "spring", stiffness: 350 }}
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ring-2 ${
                      entry.is_current_user
                        ? "bg-primary text-primary-foreground ring-primary/40"
                        : isTop3
                        ? "bg-secondary text-foreground ring-warning/20"
                        : "bg-secondary text-foreground ring-border"
                    }`}
                  >
                    {entry.display_name.slice(0, 2).toUpperCase()}
                  </motion.div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium truncate ${
                      entry.is_current_user ? "text-primary" : "text-foreground"
                    }`}>
                      {entry.is_current_user ? "You" : entry.display_name}
                    </p>
                    <div className="flex items-center gap-1">
                      <TrendingUp className="w-2.5 h-2.5 text-muted-foreground/60" />
                      <p className="text-[10px] text-muted-foreground">
                        Top {(100 - (entry.percentile || 0)).toFixed(1)}%
                      </p>
                    </div>
                  </div>

                  {/* Stats + Gift */}
                  <div className="flex items-center gap-2">
                    {entry.streak > 0 && (
                      <motion.span
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: i * 0.06 + 0.25 }}
                        className="flex items-center gap-0.5 text-[10px] text-warning font-medium"
                      >
                        <Flame className="w-3 h-3" />{entry.streak}
                      </motion.span>
                    )}
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                      <Clock className="w-3 h-3" />{entry.total_study_hours}h
                    </span>
                    {user && (
                      <motion.button
                        whileHover={{ scale: 1.2 }}
                        whileTap={{ scale: 0.85 }}
                        onClick={(e) => { e.stopPropagation(); if (!entry.is_current_user) sendFreezeGift(entry.user_id); }}
                        disabled={entry.is_current_user || gifting === entry.user_id}
                        className="p-1 rounded-md hover:bg-primary/10 transition-colors disabled:opacity-40"
                        title={entry.is_current_user ? "You can't gift yourself" : "Gift a streak freeze"}
                      >
                        <Gift className={`w-3.5 h-3.5 ${gifting === entry.user_id ? "animate-pulse text-primary" : entry.is_current_user ? "text-muted-foreground" : "text-muted-foreground hover:text-primary"}`} />
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>

          {entries.length > 10 && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="text-[10px] text-muted-foreground text-center pt-2"
            >
              Showing top 10 of {entries.length} students
            </motion.p>
          )}
        </div>
      )}
    </motion.div>
  );
};

export default LeaderboardCard;
