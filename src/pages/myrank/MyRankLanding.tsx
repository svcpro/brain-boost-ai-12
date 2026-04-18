import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, Zap, Users, TrendingUp, Sparkles } from "lucide-react";
import { Helmet } from "react-helmet-async";

const CATEGORIES = [
  { key: "UPSC", label: "UPSC", emoji: "🇮🇳", color: "from-orange-500 to-red-500" },
  { key: "JEE", label: "JEE", emoji: "🚀", color: "from-blue-500 to-cyan-500" },
  { key: "NEET", label: "NEET", emoji: "🩺", color: "from-green-500 to-emerald-500" },
  { key: "SSC", label: "SSC", emoji: "📋", color: "from-purple-500 to-pink-500" },
  { key: "IQ", label: "IQ Test", emoji: "🧠", color: "from-yellow-500 to-orange-500" },
];

const MyRankLanding = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stats, setStats] = useState({ total_tests: 234567, total_shares: 0 });
  const [liveCount, setLiveCount] = useState(234567);

  const ref = searchParams.get("ref");

  useEffect(() => {
    if (ref) sessionStorage.setItem("myrank_ref", ref);

    supabase.functions.invoke("myrank-engine", { body: { action: "stats" } })
      .then(({ data }) => {
        if (data?.total_tests) {
          setStats(data);
          setLiveCount(data.total_tests);
        }
      });

    // Animated live counter (simulated growth)
    const interval = setInterval(() => {
      setLiveCount((c) => c + Math.floor(Math.random() * 3) + 1);
    }, 2000);
    return () => clearInterval(interval);
  }, [ref]);

  const startTest = (category: string) => {
    navigate(`/myrank/test?category=${category}`);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5">
      <Helmet>
        <title>MyRank — Check Your Rank in 60 Seconds</title>
        <meta name="description" content="Take a 60-second AI-powered test. Get your rank instantly. Compete with millions across India." />
      </Helmet>

      <div className="max-w-md mx-auto px-4 py-8 space-y-6">
        {/* Hero */}
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold">
            <Sparkles className="w-3 h-3" />
            India's #1 Rank Test
          </div>
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-primary to-purple-500 bg-clip-text text-transparent">
            Check Your Rank in 60 Seconds
          </h1>
          <p className="text-muted-foreground">
            AI-powered. Instant. Brutal.
          </p>
        </div>

        {/* Live counter */}
        <Card className="p-4 bg-gradient-to-r from-primary/10 to-purple-500/10 border-primary/20">
          <div className="flex items-center justify-between">
            <div>
              <div className="text-xs text-muted-foreground">Tests taken</div>
              <div className="text-2xl font-bold tabular-nums">
                {liveCount.toLocaleString("en-IN")}
              </div>
            </div>
            <div className="flex items-center gap-1 text-green-500 text-sm font-semibold">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              LIVE
            </div>
          </div>
        </Card>

        {/* Category cards */}
        <div className="space-y-3">
          <div className="text-sm font-semibold text-muted-foreground px-1">
            Pick your battleground
          </div>
          {CATEGORIES.map((cat) => (
            <button
              key={cat.key}
              onClick={() => startTest(cat.key)}
              className={`w-full p-5 rounded-2xl bg-gradient-to-r ${cat.color} text-white font-bold text-left flex items-center justify-between shadow-lg hover:scale-[1.02] active:scale-[0.98] transition-transform`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{cat.emoji}</span>
                <div>
                  <div className="text-lg">{cat.label}</div>
                  <div className="text-xs opacity-90">7 questions · 90 sec</div>
                </div>
              </div>
              <Zap className="w-5 h-5" />
            </button>
          ))}
        </div>

        {/* Social proof */}
        <div className="grid grid-cols-3 gap-2 pt-2">
          {[
            { icon: Trophy, label: "Top 1%", sub: "Daily" },
            { icon: Users, label: "5M+", sub: "Players" },
            { icon: TrendingUp, label: "Live", sub: "Ranks" },
          ].map((s, i) => (
            <Card key={i} className="p-3 text-center">
              <s.icon className="w-4 h-4 mx-auto mb-1 text-primary" />
              <div className="text-sm font-bold">{s.label}</div>
              <div className="text-xs text-muted-foreground">{s.sub}</div>
            </Card>
          ))}
        </div>

        {ref && (
          <div className="text-center text-xs text-muted-foreground bg-primary/5 p-2 rounded-lg">
            🎯 Invited by a friend — beat their rank!
          </div>
        )}
      </div>
    </div>
  );
};

export default MyRankLanding;
