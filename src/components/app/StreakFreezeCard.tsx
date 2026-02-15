import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Snowflake, History, Gift, Check, X, Clock, Timer, ShieldCheck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";
import { format } from "date-fns";

interface FreezeRecord {
  id: string;
  earned_at: string;
  used_date: string | null;
}

interface SentGift {
  id: string;
  recipient_name: string;
  status: string;
  created_at: string;
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
  const [showSentGifts, setShowSentGifts] = useState(false);
  const [history, setHistory] = useState<FreezeRecord[]>([]);
  const [sentGifts, setSentGifts] = useState<SentGift[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [loadingSentGifts, setLoadingSentGifts] = useState(false);
  const [cancelling, setCancelling] = useState<string | null>(null);
  const [giftCooldown, setGiftCooldown] = useState<string | null>(null);
  const [autoUse, setAutoUse] = useState(false);
  const [autoUseLoading, setAutoUseLoading] = useState(false);

  // Load auto-use preference
  useEffect(() => {
    if (!user) return;
    (supabase as any)
      .from("profiles")
      .select("auto_use_streak_freeze")
      .eq("id", user.id)
      .maybeSingle()
      .then(({ data }: any) => {
        if (data) setAutoUse(!!data.auto_use_streak_freeze);
      });
  }, [user]);

  const toggleAutoUse = async () => {
    if (!user) return;
    setAutoUseLoading(true);
    const newVal = !autoUse;
    const { error } = await (supabase as any)
      .from("profiles")
      .update({ auto_use_streak_freeze: newVal })
      .eq("id", user.id);
    if (!error) {
      setAutoUse(newVal);
      toast({ title: newVal ? "🛡️ Auto-shield enabled" : "Auto-shield disabled", description: newVal ? "A freeze will be used automatically if you miss a day." : "You'll need to manually activate freezes." });
    }
    setAutoUseLoading(false);
  };

  // Load gift cooldown
  useEffect(() => {
    if (!user) return;
    const loadCooldown = async () => {
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { data } = await (supabase as any)
        .from("freeze_gifts")
        .select("created_at")
        .eq("sender_id", user.id)
        .gte("created_at", weekAgo.toISOString())
        .order("created_at", { ascending: false })
        .limit(1);

      if (data && data.length > 0) {
        const nextAvailable = new Date(data[0].created_at);
        nextAvailable.setDate(nextAvailable.getDate() + 7);
        setGiftCooldown(nextAvailable.toISOString());
      } else {
        setGiftCooldown(null);
      }
    };
    loadCooldown();
  }, [user, sentGifts]);

  // Countdown timer
  const [cooldownText, setCooldownText] = useState("");
  useEffect(() => {
    if (!giftCooldown) { setCooldownText(""); return; }
    const update = () => {
      const diff = new Date(giftCooldown).getTime() - Date.now();
      if (diff <= 0) { setGiftCooldown(null); setCooldownText(""); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCooldownText(d > 0 ? `${d}d ${h}h` : `${h}h ${m}m`);
    };
    update();
    const interval = setInterval(update, 60000);
    return () => clearInterval(interval);
  }, [giftCooldown]);
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

  const loadSentGifts = useCallback(async () => {
    if (!user) return;
    setLoadingSentGifts(true);
    const { data } = await (supabase as any)
      .from("freeze_gifts")
      .select("id, recipient_id, status, created_at")
      .eq("sender_id", user.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!data || data.length === 0) {
      setSentGifts([]);
      setLoadingSentGifts(false);
      return;
    }

    const recipientIds = [...new Set(data.map((g: any) => g.recipient_id))];
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, display_name")
      .in("id", recipientIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      nameMap[p.id] = p.display_name || "Someone";
    });

    setSentGifts(
      data.map((g: any) => ({
        id: g.id,
        recipient_name: nameMap[g.recipient_id] || "Someone",
        status: g.status,
        created_at: g.created_at,
      }))
    );
    setLoadingSentGifts(false);
  }, [user]);

  useEffect(() => {
    if (showSentGifts && sentGifts.length === 0) loadSentGifts();
  }, [showSentGifts, loadSentGifts]);

  const cancelGift = async (giftId: string) => {
    if (!user) return;
    setCancelling(giftId);
    try {
      const { error } = await (supabase as any)
        .from("freeze_gifts")
        .delete()
        .eq("id", giftId)
        .eq("sender_id", user.id);

      if (error) throw error;

      setSentGifts((prev) => prev.filter((g) => g.id !== giftId));
      toast({ title: "Gift cancelled", description: "The freeze is back in your inventory." });
    } catch {
      toast({ title: "Failed to cancel gift", variant: "destructive" });
    } finally {
      setCancelling(null);
    }
  };

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
          onClick={() => { setShowSentGifts((s) => !s); setShowHistory(false); }}
          className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all"
          title="Sent gifts"
        >
          <Gift className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={() => { setShowHistory((s) => !s); setShowSentGifts(false); }}
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
        Skip one day without breaking your streak. Earn freezes at milestones: 5d → 1, 7d → 1, 14d → 2, 30d → 3.
      </p>

      {/* Auto-use toggle */}
      <button
        onClick={toggleAutoUse}
        disabled={autoUseLoading}
        className="mt-2 w-full flex items-center gap-2 px-2.5 py-2 rounded-lg border border-border hover:bg-secondary/30 transition-all disabled:opacity-50"
      >
        <ShieldCheck className={`w-3.5 h-3.5 shrink-0 ${autoUse ? "text-success" : "text-muted-foreground"}`} />
        <span className="text-[10px] text-foreground font-medium flex-1 text-left">Auto-shield</span>
        <div className={`w-8 h-4.5 rounded-full relative transition-colors ${autoUse ? "bg-success" : "bg-secondary"}`}>
          <motion.div
            className="absolute top-0.5 w-3.5 h-3.5 rounded-full bg-white shadow-sm"
            animate={{ left: autoUse ? 16 : 2 }}
            transition={{ type: "spring", stiffness: 500, damping: 30 }}
          />
        </div>
      </button>
      {autoUse && (
        <p className="text-[9px] text-success mt-1 px-1">
          🛡️ A freeze will activate automatically if you miss a day
        </p>
      )}

      {cooldownText ? (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-secondary/30">
          <Timer className="w-3 h-3 text-warning" />
          <span className="text-[10px] text-muted-foreground">
            Next gift available in <span className="text-warning font-medium">{cooldownText}</span>
          </span>
        </div>
      ) : availableFreezes > 0 ? (
        <div className="flex items-center gap-1.5 mt-2 px-2 py-1.5 rounded-lg bg-primary/5">
          <Gift className="w-3 h-3 text-primary" />
          <span className="text-[10px] text-primary font-medium">Ready to gift a freeze!</span>
        </div>
      ) : null}

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

      {/* Sent Gifts panel */}
      <AnimatePresence>
        {showSentGifts && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="mt-3 pt-3 border-t border-border overflow-hidden"
          >
            <div className="flex items-center gap-1.5 mb-2">
              <Gift className="w-3 h-3 text-muted-foreground" />
              <span className="text-[10px] font-semibold text-foreground">Sent Gifts</span>
              <span className="text-[9px] text-muted-foreground ml-auto">{sentGifts.length} total</span>
            </div>

            {loadingSentGifts ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">Loading…</p>
            ) : sentGifts.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-2">No gifts sent yet. Gift a freeze from the leaderboard!</p>
            ) : (
              <div className="space-y-1.5 max-h-40 overflow-y-auto">
                {sentGifts.map((g, i) => (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.03 }}
                    className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-secondary/30"
                  >
                    <Gift className={`w-3 h-3 shrink-0 ${
                      g.status === "accepted" ? "text-primary" : g.status === "declined" ? "text-muted-foreground" : "text-warning"
                    }`} />
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] text-foreground truncate block">
                        To {g.recipient_name}
                      </span>
                      <span className="text-[9px] text-muted-foreground">
                        {format(new Date(g.created_at), "MMM d, yyyy")}
                      </span>
                    </div>
                    {g.status === "pending" ? (
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <button
                            disabled={cancelling === g.id}
                            className="text-[9px] font-medium shrink-0 px-1.5 py-0.5 rounded-full bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                            title="Cancel gift"
                          >
                            {cancelling === g.id ? "…" : "✗ Cancel"}
                          </button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Cancel this gift?</AlertDialogTitle>
                            <AlertDialogDescription>
                              The freeze sent to {g.recipient_name} will be returned to your inventory. This can't be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Keep Gift</AlertDialogCancel>
                            <AlertDialogAction onClick={() => cancelGift(g.id)}>
                              Yes, Cancel
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    ) : (
                      <span className={`text-[9px] font-medium shrink-0 px-1.5 py-0.5 rounded-full ${
                        g.status === "accepted"
                          ? "bg-primary/10 text-primary"
                          : "bg-destructive/10 text-destructive"
                      }`}>
                        {g.status === "accepted" ? "✓ Accepted" : "✗ Declined"}
                      </span>
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
