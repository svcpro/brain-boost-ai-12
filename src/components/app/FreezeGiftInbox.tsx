import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Gift, Check, X, Snowflake, Inbox } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { notifyFeedback } from "@/lib/feedback";
import { format } from "date-fns";

interface GiftRecord {
  id: string;
  sender_id: string;
  sender_name: string;
  status: string;
  created_at: string;
}

const FreezeGiftInbox = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [gifts, setGifts] = useState<GiftRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [resolving, setResolving] = useState<string | null>(null);

  const loadGifts = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    const { data } = await (supabase as any)
      .from("freeze_gifts")
      .select("id, sender_id, status, created_at")
      .eq("recipient_id", user.id)
      .eq("status", "pending")
      .order("created_at", { ascending: false });

    if (!data || data.length === 0) {
      setGifts([]);
      setLoading(false);
      return;
    }

    // Fetch sender names
    const senderIds = [...new Set(data.map((g: any) => g.sender_id))];
    const { data: profiles } = await (supabase as any)
      .from("profiles")
      .select("id, display_name")
      .in("id", senderIds);

    const nameMap: Record<string, string> = {};
    (profiles || []).forEach((p: any) => {
      nameMap[p.id] = p.display_name || "Someone";
    });

    setGifts(
      data.map((g: any) => ({
        ...g,
        sender_name: nameMap[g.sender_id] || "Someone",
      }))
    );
    setLoading(false);
  }, [user]);

  useEffect(() => {
    loadGifts();
  }, [loadGifts]);

  const resolveGift = async (giftId: string, accept: boolean) => {
    if (!user) return;
    setResolving(giftId);
    try {
      if (accept) {
        // Use security definer function for atomic transfer
        const { error } = await (supabase as any).rpc("accept_freeze_gift", { gift_id: giftId });
        if (error) throw error;

        notifyFeedback();
        toast({ title: "❄️ Freeze received!", description: "A streak freeze has been added to your inventory." });
      } else {
        // Decline: just mark as declined, freeze stays with sender
        await (supabase as any)
          .from("freeze_gifts")
          .update({ status: "declined", resolved_at: new Date().toISOString() })
          .eq("id", giftId);

        toast({ title: "Gift declined" });
      }
      setGifts((prev) => prev.filter((g) => g.id !== giftId));
    } catch {
      toast({ title: "Failed to process gift", variant: "destructive" });
    } finally {
      setResolving(null);
    }
  };

  if (loading || gifts.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      <div className="flex items-center gap-2 mb-3">
        <Inbox className="w-4 h-4 text-primary" />
        <h3 className="font-semibold text-foreground text-sm">Freeze Gifts</h3>
        <span className="ml-auto text-[10px] text-primary font-medium px-2 py-0.5 rounded-full bg-primary/10">
          {gifts.length} pending
        </span>
      </div>

      <div className="space-y-2">
        <AnimatePresence>
          {gifts.map((g) => (
            <motion.div
              key={g.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10, height: 0 }}
              className="flex items-center gap-2 p-2.5 rounded-lg bg-secondary/30 border border-border/50"
            >
              <Snowflake className="w-4 h-4 text-sky-400 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-xs text-foreground font-medium truncate">
                  {g.sender_name} sent you a freeze
                </p>
                <p className="text-[9px] text-muted-foreground">
                  {format(new Date(g.created_at), "MMM d, h:mm a")}
                </p>
              </div>
              <div className="flex gap-1.5 shrink-0">
                <button
                  onClick={() => resolveGift(g.id, true)}
                  disabled={resolving === g.id}
                  className="p-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-all disabled:opacity-50"
                  title="Accept"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => resolveGift(g.id, false)}
                  disabled={resolving === g.id}
                  className="p-1.5 rounded-lg bg-destructive/10 text-destructive hover:bg-destructive/20 transition-all disabled:opacity-50"
                  title="Decline"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default FreezeGiftInbox;
