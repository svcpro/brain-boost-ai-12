import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import {
  Gift, Lock, Check, Crown, Sparkles, Loader2, Target,
  Calendar, X, Copy, Share2,
} from "lucide-react";
import ReactMarkdown from "react-markdown";

interface RewardsState {
  referrals: number;
  premium_test: {
    eligible: boolean;
    claimed: boolean;
    active: boolean;
    expires_at: string | null;
    days_left: number | null;
  };
  ai_study_plan: {
    eligible: boolean;
    claimed: boolean;
    plan_id: string | null;
    summary: string | null;
  };
}

/**
 * MyRank Rewards panel — shows the two referral rewards (Premium Test access
 * for 30 days, and a personalized AI 30-day Study Plan) with claim CTAs and
 * post-claim viewers. Renders inline inside the MyRank tab.
 */
const MyRankRewards = () => {
  const { user } = useAuth();
  const { handle, shareUrl } = useReferralHandle();
  const { toast } = useToast();

  const [data, setData] = useState<RewardsState | null>(null);
  const [loading, setLoading] = useState(true);
  const [claiming, setClaiming] = useState<"premium_test" | "ai_study_plan" | null>(null);
  const [showPlan, setShowPlan] = useState(false);
  const [copied, setCopied] = useState(false);

  const fetchStatus = useCallback(async () => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    try {
      const { data: resp, error } = await supabase.functions.invoke("myrank-engine", {
        body: { action: "rewards_status", user_id: user.id, referrer_code: handle },
      });
      if (error) throw error;
      setData(resp as RewardsState);
    } catch (e) {
      console.warn("[MyRankRewards] status failed:", e);
    } finally {
      setLoading(false);
    }
  }, [user?.id, handle]);

  useEffect(() => {
    if (handle && handle !== "guest") fetchStatus();
  }, [handle, fetchStatus]);

  const claim = async (reward: "premium_test" | "ai_study_plan") => {
    if (!user?.id) {
      toast({ title: "Sign in required", description: "Sign in to claim your reward." });
      return;
    }
    setClaiming(reward);
    try {
      const { data: resp, error } = await supabase.functions.invoke("myrank-engine", {
        body: {
          action: reward === "premium_test" ? "claim_premium_test" : "claim_ai_study_plan",
          user_id: user.id,
          referrer_code: handle,
        },
      });
      if (error) throw error;
      if ((resp as any)?.error) {
        toast({
          title: "Cannot claim yet",
          description: (resp as any).message || "Try again later.",
          variant: "destructive",
        });
      } else {
        toast({
          title: reward === "premium_test" ? "🎉 Premium Test unlocked!" : "✨ AI Study Plan ready!",
          description: (resp as any).message,
        });
        await fetchStatus();
        if (reward === "ai_study_plan") setShowPlan(true);
      }
    } catch (e: any) {
      toast({
        title: "Something went wrong",
        description: e?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setClaiming(null);
    }
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast({ title: "Copy failed", description: "Long-press the link to copy." });
    }
  };

  const shareLink = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: "Check your rank on ACRY MyRank",
          text: "Find out where you stand among India's exam toppers — instant AI rank in 60 seconds.",
          url: shareUrl,
        });
      } else {
        await copyLink();
      }
    } catch { /* user cancelled */ }
  };

  if (!user) {
    return (
      <Card className="p-4 border-white/10 bg-white/[0.03] backdrop-blur-xl">
        <div className="flex items-center gap-2 text-sm text-white/60">
          <Lock className="w-4 h-4" />
          Sign in to unlock referral rewards
        </div>
      </Card>
    );
  }

  if (loading) {
    return (
      <Card className="p-4 border-white/10 bg-white/[0.03] backdrop-blur-xl flex items-center justify-center">
        <Loader2 className="w-4 h-4 animate-spin text-white/50" />
      </Card>
    );
  }

  const refs = data?.referrals || 0;
  const premiumDone = data?.premium_test.claimed;
  const planDone = data?.ai_study_plan.claimed;
  const premiumProgress = Math.min(100, (refs / 5) * 100);
  const planProgress = Math.min(100, (refs / 10) * 100);

  return (
    <>
      <Card className="relative overflow-hidden p-4 border-white/10 bg-gradient-to-br from-purple-500/10 via-fuchsia-500/5 to-cyan-500/10 backdrop-blur-xl space-y-4">
        <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-fuchsia-500/20 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-16 -left-16 w-48 h-48 rounded-full bg-cyan-500/20 blur-3xl pointer-events-none" />

        <div className="relative flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center shadow-lg">
              <Gift className="w-4 h-4 text-white" />
            </div>
            <div>
              <div className="text-sm font-bold text-white">My Rewards</div>
              <div className="text-[10px] text-white/50">Invite friends → unlock premium</div>
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-widest text-white/40">Invited</div>
            <div className="text-xl font-extrabold tabular-nums bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              {refs}
            </div>
          </div>
        </div>

        {/* Reward 1 — Premium Test */}
        <div className="relative rounded-xl border border-amber-400/20 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Target className="w-4 h-4 text-amber-300 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white">Premium SureShot Tests</div>
                <div className="text-[10px] text-white/55">
                  Invite 5 friends → 30-day full access
                </div>
              </div>
            </div>
            {premiumDone ? (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-300">
                <Check className="w-3 h-3" /> Active
              </span>
            ) : (
              <span className="shrink-0 text-[10px] tabular-nums text-white/60 font-semibold">
                {refs}/5
              </span>
            )}
          </div>
          {!premiumDone && (
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-amber-400 to-orange-400 transition-all"
                style={{ width: `${premiumProgress}%` }}
              />
            </div>
          )}
          {premiumDone && data?.premium_test.days_left !== null && (
            <div className="flex items-center gap-1.5 text-[10px] text-amber-200/80">
              <Calendar className="w-3 h-3" />
              {data!.premium_test.days_left} days remaining · expires {new Date(data!.premium_test.expires_at!).toLocaleDateString()}
            </div>
          )}
          {!premiumDone && (
            <button
              disabled={!data?.premium_test.eligible || claiming !== null}
              onClick={() => claim("premium_test")}
              className={`w-full h-9 rounded-lg text-[12px] font-bold transition-all ${
                data?.premium_test.eligible
                  ? "bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-[0_4px_20px_-4px_rgba(251,146,60,0.6)] hover:shadow-[0_4px_28px_-4px_rgba(251,146,60,0.8)] active:scale-[0.98]"
                  : "bg-white/[0.04] border border-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              {claiming === "premium_test" ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Unlocking…</span>
              ) : data?.premium_test.eligible ? (
                <span className="inline-flex items-center gap-1.5"><Crown className="w-3.5 h-3.5" /> Claim Premium Test</span>
              ) : (
                `Invite ${5 - refs} more to unlock`
              )}
            </button>
          )}
        </div>

        {/* Reward 2 — AI Study Plan */}
        <div className="relative rounded-xl border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-purple-500/5 p-3 space-y-2">
          <div className="flex items-start justify-between gap-2">
            <div className="flex items-start gap-2 min-w-0">
              <Sparkles className="w-4 h-4 text-fuchsia-300 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="text-[13px] font-bold text-white">AI 30-Day Study Plan</div>
                <div className="text-[10px] text-white/55">
                  Invite 10 friends → personalized to your weak topics
                </div>
              </div>
            </div>
            {planDone ? (
              <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/30 text-[10px] font-bold text-emerald-300">
                <Check className="w-3 h-3" /> Ready
              </span>
            ) : (
              <span className="shrink-0 text-[10px] tabular-nums text-white/60 font-semibold">
                {refs}/10
              </span>
            )}
          </div>
          {!planDone && (
            <div className="h-1.5 rounded-full bg-white/[0.06] overflow-hidden border border-white/10">
              <div
                className="h-full bg-gradient-to-r from-fuchsia-400 to-purple-400 transition-all"
                style={{ width: `${planProgress}%` }}
              />
            </div>
          )}
          {planDone ? (
            <button
              onClick={() => setShowPlan(true)}
              className="w-full h-9 rounded-lg text-[12px] font-bold bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white shadow-[0_4px_20px_-4px_rgba(217,70,239,0.6)] hover:shadow-[0_4px_28px_-4px_rgba(217,70,239,0.8)] active:scale-[0.98] transition-all inline-flex items-center justify-center gap-1.5"
            >
              <Sparkles className="w-3.5 h-3.5" />
              View My 30-Day Plan
            </button>
          ) : (
            <button
              disabled={!data?.ai_study_plan.eligible || claiming !== null}
              onClick={() => claim("ai_study_plan")}
              className={`w-full h-9 rounded-lg text-[12px] font-bold transition-all ${
                data?.ai_study_plan.eligible
                  ? "bg-gradient-to-r from-fuchsia-500 to-purple-500 text-white shadow-[0_4px_20px_-4px_rgba(217,70,239,0.6)] hover:shadow-[0_4px_28px_-4px_rgba(217,70,239,0.8)] active:scale-[0.98]"
                  : "bg-white/[0.04] border border-white/10 text-white/40 cursor-not-allowed"
              }`}
            >
              {claiming === "ai_study_plan" ? (
                <span className="inline-flex items-center gap-1.5"><Loader2 className="w-3.5 h-3.5 animate-spin" /> Generating plan…</span>
              ) : data?.ai_study_plan.eligible ? (
                <span className="inline-flex items-center gap-1.5"><Sparkles className="w-3.5 h-3.5" /> Generate AI Plan</span>
              ) : (
                `Invite ${10 - refs} more to unlock`
              )}
            </button>
          )}
        </div>

        {/* Share strip */}
        <div className="relative rounded-xl border border-white/10 bg-black/30 p-2.5 backdrop-blur">
          <div className="text-[9px] uppercase tracking-widest text-white/40 font-bold mb-1">Your invite link</div>
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1 text-[12px] font-mono font-bold text-white truncate">
              acry.ai/?ref=<span className="bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">{handle}</span>
            </div>
            <button
              onClick={copyLink}
              className="shrink-0 h-7 w-7 rounded-md bg-white/[0.06] border border-white/10 hover:bg-white/[0.1] flex items-center justify-center transition"
              aria-label="Copy link"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
            </button>
            <button
              onClick={shareLink}
              className="shrink-0 h-7 px-2.5 rounded-md bg-gradient-to-r from-fuchsia-500 to-cyan-500 text-white text-[11px] font-bold flex items-center gap-1 active:scale-95 transition"
            >
              <Share2 className="w-3 h-3" /> Share
            </button>
          </div>
        </div>
      </Card>

      {/* AI Plan viewer modal */}
      <AnimatePresence>
        {showPlan && data?.ai_study_plan.summary && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
            onClick={() => setShowPlan(false)}
          >
            <motion.div
              initial={{ y: 40, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 40, opacity: 0 }}
              className="relative max-w-md w-full max-h-[85vh] rounded-2xl bg-gradient-to-br from-[#0d0a1f] to-[#1a0d2e] border border-fuchsia-400/30 shadow-2xl overflow-hidden flex flex-col"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between p-4 border-b border-white/10 bg-gradient-to-r from-fuchsia-500/10 to-purple-500/10">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-fuchsia-300" />
                  <div className="text-sm font-bold text-white">Your AI 30-Day Plan</div>
                </div>
                <button
                  onClick={() => setShowPlan(false)}
                  className="w-7 h-7 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center transition"
                  aria-label="Close"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
              <div className="overflow-y-auto p-4 prose prose-invert prose-sm max-w-none prose-headings:text-fuchsia-200 prose-strong:text-white prose-li:text-white/80 prose-p:text-white/75">
                <ReactMarkdown>{data.ai_study_plan.summary}</ReactMarkdown>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default MyRankRewards;
