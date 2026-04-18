import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Share2, RefreshCw, Lock, Crown } from "lucide-react";

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

const MyRankResult = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [shared, setShared] = useState(false);

  useEffect(() => {
    const stored = sessionStorage.getItem("myrank_result");
    if (!stored) {
      navigate("/myrank");
      return;
    }
    setResult(JSON.parse(stored));
  }, [navigate]);

  if (!result) return null;

  const refCode = user?.id?.slice(0, 8) || localStorage.getItem("myrank_anon_id")?.slice(0, 8) || "guest";
  const shareUrl = `${window.location.origin}/myrank?ref=${refCode}`;
  const shareMessage = `🔥 I am ranked #${result.rank.toLocaleString("en-IN")} in ACRY AI Rank Test (${result.category})\nPercentile: ${result.percentile}% — ${result.ai_tag}\n\nCan you beat me? 😎\n👉 ${shareUrl}`;

  const handleWhatsAppShare = async () => {
    const anonId = localStorage.getItem("myrank_anon_id");
    await supabase.functions.invoke("myrank-engine", {
      body: {
        action: "log_share",
        test_id: result.test_id,
        user_id: user?.id || null,
        anon_session_id: anonId,
        channel: "whatsapp",
      },
    });
    setShared(true);
    window.open(`https://wa.me/?text=${encodeURIComponent(shareMessage)}`, "_blank");
  };

  const handleNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: "My ACRY Rank", text: shareMessage, url: shareUrl });
        setShared(true);
      } catch {}
    } else {
      handleWhatsAppShare();
    }
  };

  const tier = result.percentile >= 99 ? "legendary" : result.percentile >= 90 ? "elite" : result.percentile >= 70 ? "great" : "good";
  const tierGradient = {
    legendary: "from-yellow-400 via-orange-500 to-red-500",
    elite: "from-purple-500 via-pink-500 to-red-500",
    great: "from-blue-500 to-cyan-500",
    good: "from-green-500 to-emerald-500",
  }[tier];

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

        {/* Locked features */}
        <Card className="p-4 space-y-3 border-dashed">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Lock className="w-4 h-4 text-orange-500" />
            Unlock detailed analysis
          </div>
          <div className="text-xs text-muted-foreground">
            Share with 2 friends or invite 3 → unlock weak-subject breakdown, topper strategy, AI study plan.
          </div>
          <Button
            onClick={handleWhatsAppShare}
            variant={shared ? "outline" : "default"}
            size="sm"
            className="w-full"
          >
            {shared ? "✓ Shared — keep going!" : "Unlock now"}
          </Button>
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
