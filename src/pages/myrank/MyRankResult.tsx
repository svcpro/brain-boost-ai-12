import { useEffect, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Share2, RefreshCw, Lock, Crown, Sparkles, Users, Gift, Loader2, ListOrdered } from "lucide-react";
import ShareableBadge from "@/components/myrank/ShareableBadge";

interface Result {
  test_id: string;
  score: number;
  total: number;
  accuracy: number;
  rank: number;
  percentile: number;
  ai_tag: string;
  ai_insight: string;
  category: string;
}

interface UnlockStatus {
  shares: number;
  referrals: number;
  unlocks: {
    detailed_analysis: boolean;
    weak_subject_breakdown: boolean;
    topper_strategy: boolean;
    premium_test: boolean;
    ai_study_plan: boolean;
  };
  next_unlock: { type: string; needs_shares?: number; needs_referrals?: number } | null;
}

interface Analysis {
  weak_areas: { topic: string; severity: string; why: string }[];
  topper_strategy: string[];
  next_steps: string[];
}

const MyRankResult = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [unlock, setUnlock] = useState<UnlockStatus | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);

  const refCode = user?.id?.slice(0, 8) || localStorage.getItem("myrank_anon_id")?.slice(0, 8) || "guest";
  const anonId = typeof window !== "undefined" ? localStorage.getItem("myrank_anon_id") : null;

  const fetchUnlockStatus = useCallback(async () => {
    const { data } = await supabase.functions.invoke("myrank-engine", {
      body: {
        action: "unlock_status",
        user_id: user?.id || null,
        anon_session_id: anonId,
        referrer_code: refCode,
      },
    });
    if (data) setUnlock(data as UnlockStatus);
  }, [user?.id, anonId, refCode]);

  useEffect(() => {
    const stored = sessionStorage.getItem("myrank_result");
    if (!stored) {
      navigate("/myrank");
      return;
    }
    setResult(JSON.parse(stored));
    fetchUnlockStatus();
  }, [navigate, fetchUnlockStatus]);

  if (!result) return null;

  const shareUrl = `${window.location.origin}/myrank?ref=${refCode}`;
  const shareMessage = `🔥 I am ranked #${result.rank.toLocaleString("en-IN")} in ACRY AI Rank Test (${result.category})\nPercentile: ${result.percentile}% — ${result.ai_tag}\n\nCan you beat me? 😎\n👉 ${shareUrl}`;

  const logShare = async (channel: string) => {
    await supabase.functions.invoke("myrank-engine", {
      body: {
        action: "log_share",
        test_id: result.test_id,
        user_id: user?.id || null,
        anon_session_id: anonId,
        channel,
      },
    });
    // Refresh unlock status after share
    setTimeout(fetchUnlockStatus, 500);
  };

  const handleWhatsAppShare = async () => {
    await logShare("whatsapp");
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My ACRY Rank", text: shareMessage, url: shareUrl });
        await logShare("native");
      } catch {}
    } else {
      handleWhatsAppShare();
    }
  };

  const handleUnlockAnalysis = async () => {
    setLoadingAnalysis(true);
    const { data, error } = await supabase.functions.invoke("myrank-engine", {
      body: {
        action: "detailed_analysis",
        test_id: result.test_id,
        user_id: user?.id || null,
        anon_session_id: anonId,
      },
    });
    setLoadingAnalysis(false);
    if (error || (data as any)?.error) {
      // Re-sync unlock state if server says still locked
      fetchUnlockStatus();
      return;
    }
    setAnalysis(data as Analysis);
  };

  const tier = result.percentile >= 99 ? "legendary" : result.percentile >= 90 ? "elite" : result.percentile >= 70 ? "great" : "good";
  const tierGradient = {
    legendary: "from-yellow-400 via-orange-500 to-red-500",
    elite: "from-purple-500 via-pink-500 to-red-500",
    great: "from-blue-500 to-cyan-500",
    good: "from-green-500 to-emerald-500",
  }[tier];

  const isUnlocked = unlock?.unlocks.detailed_analysis ?? false;
  const sharesNeeded = Math.max(0, 2 - (unlock?.shares || 0));
  const referralsNeeded = Math.max(0, 3 - (unlock?.referrals || 0));

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-5">
        {/* Hero rank card */}
        <Card className={`p-6 text-center text-white bg-gradient-to-br ${tierGradient} shadow-2xl`}>
          <div className="flex justify-center mb-2">
            {result.percentile >= 95 ? <Crown className="w-10 h-10" /> : <Trophy className="w-10 h-10" />}
          </div>
          <div className="text-xs uppercase tracking-wider opacity-90">Your Rank</div>
          <div className="text-5xl font-extrabold tabular-nums my-2">
            #{result.rank.toLocaleString("en-IN")}
          </div>
          <div className="text-sm opacity-90">{result.category} · {new Date().toLocaleDateString()}</div>
          <div className="mt-4 inline-block px-4 py-1.5 rounded-full bg-white/20 backdrop-blur-sm text-sm font-bold">
            {result.ai_tag}
          </div>
        </Card>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-2">
          <Card className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Score</div>
            <div className="text-xl font-bold">{result.score}/{result.total}</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Accuracy</div>
            <div className="text-xl font-bold">{result.accuracy}%</div>
          </Card>
          <Card className="p-3 text-center">
            <div className="text-xs text-muted-foreground">Percentile</div>
            <div className="text-xl font-bold">{result.percentile}%</div>
          </Card>
        </div>

        {/* AI Insight */}
        <Card className="p-4 bg-primary/5 border-primary/20">
          <div className="text-xs font-semibold text-primary mb-1">AI INSIGHT</div>
          <div className="text-sm">{result.ai_insight}</div>
        </Card>

        {/* Share CTA */}
        <Button
          onClick={handleWhatsAppShare}
          className="w-full h-14 text-base font-bold bg-[#25D366] hover:bg-[#1da851] text-white shadow-lg"
        >
          <Share2 className="w-5 h-5 mr-2" />
          Share on WhatsApp & Challenge Friends
        </Button>

        <Button onClick={handleNativeShare} variant="outline" className="w-full">
          More share options
        </Button>

        {/* Hard viral gate — Detailed Analysis */}
        {!isUnlocked && !analysis && (
          <Card className="p-4 space-y-3 border-2 border-dashed border-orange-300 bg-gradient-to-br from-orange-50 to-yellow-50 dark:from-orange-950/20 dark:to-yellow-950/20">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Lock className="w-4 h-4 text-orange-500" />
              🔒 Detailed Analysis Locked
            </div>
            <div className="text-xs text-muted-foreground">
              Unlock weak-subject breakdown, topper strategy, and AI study plan.
            </div>

            {/* Progress bars */}
            <div className="space-y-2">
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Share with friends</span>
                  <span className="tabular-nums">{unlock?.shares || 0}/2</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-green-500 to-emerald-500 transition-all"
                    style={{ width: `${Math.min(100, ((unlock?.shares || 0) / 2) * 100)}%` }}
                  />
                </div>
              </div>
              <div className="text-center text-xs text-muted-foreground">— OR —</div>
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="font-medium">Invite friends to test</span>
                  <span className="tabular-nums">{unlock?.referrals || 0}/3</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style={{ width: `${Math.min(100, ((unlock?.referrals || 0) / 3) * 100)}%` }}
                  />
                </div>
              </div>
            </div>

            <Button onClick={handleWhatsAppShare} size="sm" className="w-full bg-[#25D366] hover:bg-[#1da851] text-white">
              <Share2 className="w-4 h-4 mr-2" />
              {sharesNeeded > 0 ? `Share ${sharesNeeded} more time${sharesNeeded > 1 ? "s" : ""}` : "Share now"}
            </Button>
            <div className="text-[10px] text-center text-muted-foreground">
              {referralsNeeded > 0 && `Or get ${referralsNeeded} friend${referralsNeeded > 1 ? "s" : ""} to take the test`}
            </div>
          </Card>
        )}

        {/* Unlocked — show "Reveal" button if not yet fetched */}
        {isUnlocked && !analysis && (
          <Card className="p-4 space-y-3 border-2 border-green-400 bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/20 dark:to-emerald-950/20">
            <div className="flex items-center gap-2 text-sm font-bold text-green-700 dark:text-green-400">
              <Sparkles className="w-4 h-4" />
              ✓ Detailed Analysis Unlocked!
            </div>
            <Button onClick={handleUnlockAnalysis} disabled={loadingAnalysis} className="w-full">
              {loadingAnalysis ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Generating AI insights…</>
              ) : (
                <>Reveal my detailed AI analysis</>
              )}
            </Button>
          </Card>
        )}

        {/* Detailed analysis — revealed */}
        {analysis && (
          <>
            <Card className="p-4 space-y-3">
              <div className="text-sm font-bold flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" /> Weak Areas
              </div>
              <div className="space-y-2">
                {analysis.weak_areas.map((w, i) => (
                  <div key={i} className="text-xs border-l-2 border-orange-400 pl-2">
                    <div className="font-semibold">{w.topic} <span className="text-[10px] uppercase opacity-60">({w.severity})</span></div>
                    <div className="text-muted-foreground">{w.why}</div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-4 space-y-2">
              <div className="text-sm font-bold flex items-center gap-2">
                <Crown className="w-4 h-4 text-purple-500" /> Topper Strategy
              </div>
              <ul className="text-xs space-y-1.5 list-disc list-inside text-muted-foreground">
                {analysis.topper_strategy.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>

            <Card className="p-4 space-y-2">
              <div className="text-sm font-bold flex items-center gap-2">
                <Trophy className="w-4 h-4 text-blue-500" /> Your Next Steps
              </div>
              <ul className="text-xs space-y-1.5 list-disc list-inside text-muted-foreground">
                {analysis.next_steps.map((s, i) => <li key={i}>{s}</li>)}
              </ul>
            </Card>
          </>
        )}

        {/* Referral reward tiers */}
        <Card className="p-4 space-y-3 bg-gradient-to-br from-purple-50 to-pink-50 dark:from-purple-950/20 dark:to-pink-950/20 border-purple-200">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Gift className="w-4 h-4 text-purple-500" />
            Invite & Earn Rewards
          </div>
          <div className="text-xs text-muted-foreground">
            You've invited <span className="font-bold text-foreground">{unlock?.referrals || 0}</span> friend{unlock?.referrals === 1 ? "" : "s"}.
          </div>
          <div className="space-y-2">
            <div className={`flex items-center justify-between p-2 rounded-lg ${unlock?.unlocks.premium_test ? "bg-green-100 dark:bg-green-950/30" : "bg-background"}`}>
              <div className="flex items-center gap-2 text-xs">
                <Users className="w-3 h-3" />
                <span>Invite 5 → Premium test</span>
              </div>
              <span className="text-xs font-bold tabular-nums">
                {unlock?.unlocks.premium_test ? "✓" : `${unlock?.referrals || 0}/5`}
              </span>
            </div>
            <div className={`flex items-center justify-between p-2 rounded-lg ${unlock?.unlocks.ai_study_plan ? "bg-green-100 dark:bg-green-950/30" : "bg-background"}`}>
              <div className="flex items-center gap-2 text-xs">
                <Sparkles className="w-3 h-3" />
                <span>Invite 10 → AI study plan</span>
              </div>
              <span className="text-xs font-bold tabular-nums">
                {unlock?.unlocks.ai_study_plan ? "✓" : `${unlock?.referrals || 0}/10`}
              </span>
            </div>
          </div>
          <div className="text-[10px] text-center text-muted-foreground pt-1">
            Your link: <span className="font-mono">{shareUrl}</span>
          </div>
        </Card>

        <Button onClick={() => navigate("/myrank")} variant="ghost" className="w-full">
          <RefreshCw className="w-4 h-4 mr-2" />
          Try another category
        </Button>
      </div>
    </div>
  );
};

export default MyRankResult;
