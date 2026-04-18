import { useEffect, useState, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy, Share2, RefreshCw, Lock, Crown, Sparkles, Users, Gift, Loader2,
  ListOrdered, Target, Flame, TrendingUp, ChevronRight, Copy, Check,
} from "lucide-react";
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

const TIER_CONFIG = {
  legendary: {
    label: "LEGENDARY",
    icon: Crown,
    gradient: "from-yellow-400 via-orange-500 to-red-500",
    glow: "shadow-[0_0_80px_-10px_rgba(251,191,36,0.7)]",
    ring: "from-yellow-300 via-orange-400 to-red-500",
    text: "text-amber-300",
    confettiColors: ["#fbbf24", "#f97316", "#ef4444", "#ec4899"],
  },
  elite: {
    label: "ELITE",
    icon: Crown,
    gradient: "from-purple-500 via-pink-500 to-rose-500",
    glow: "shadow-[0_0_80px_-10px_rgba(168,85,247,0.7)]",
    ring: "from-purple-400 via-pink-400 to-rose-500",
    text: "text-pink-300",
    confettiColors: ["#a855f7", "#ec4899", "#f43f5e", "#06b6d4"],
  },
  great: {
    label: "GREAT",
    icon: Trophy,
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    glow: "shadow-[0_0_80px_-10px_rgba(6,182,212,0.7)]",
    ring: "from-blue-400 via-cyan-400 to-teal-500",
    text: "text-cyan-300",
    confettiColors: ["#3b82f6", "#06b6d4", "#14b8a6", "#a855f7"],
  },
  good: {
    label: "RISING",
    icon: TrendingUp,
    gradient: "from-emerald-500 via-green-500 to-teal-500",
    glow: "shadow-[0_0_80px_-10px_rgba(16,185,129,0.6)]",
    ring: "from-emerald-400 via-green-400 to-teal-500",
    text: "text-emerald-300",
    confettiColors: ["#10b981", "#22c55e", "#06b6d4", "#fbbf24"],
  },
};

const MyRankResult = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [result, setResult] = useState<Result | null>(null);
  const [unlock, setUnlock] = useState<UnlockStatus | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [animatedRank, setAnimatedRank] = useState(0);
  const [animatedPct, setAnimatedPct] = useState(0);
  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState(false);

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
    const r = JSON.parse(stored) as Result;
    setResult(r);
    fetchUnlockStatus();

    // Vibrate on reveal
    if (navigator.vibrate) navigator.vibrate([30, 60, 30, 60, 100]);

    // Animate rank counter
    const dur = 1800;
    const start = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const ease = 1 - Math.pow(1 - t, 3);
      setAnimatedRank(Math.floor(r.rank * ease));
      setAnimatedPct(Math.floor(r.percentile * ease));
      if (t < 1) requestAnimationFrame(tick);
      else {
        setAnimatedRank(r.rank);
        setAnimatedPct(r.percentile);
      }
    };
    requestAnimationFrame(tick);

    const conf = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(conf);
  }, [navigate, fetchUnlockStatus]);

  if (!result) return null;

  const tier = (result.percentile >= 99
    ? "legendary"
    : result.percentile >= 90
    ? "elite"
    : result.percentile >= 70
    ? "great"
    : "good") as keyof typeof TIER_CONFIG;
  const cfg = TIER_CONFIG[tier];
  const TierIcon = cfg.icon;

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

  const handleCopy = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
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
      fetchUnlockStatus();
      return;
    }
    setAnalysis(data as Analysis);
  };

  const isUnlocked = unlock?.unlocks.detailed_analysis ?? false;
  const sharesNeeded = Math.max(0, 2 - (unlock?.shares || 0));
  const referralsNeeded = Math.max(0, 3 - (unlock?.referrals || 0));
  const sharePct = Math.min(100, ((unlock?.shares || 0) / 2) * 100);
  const refPct = Math.min(100, ((unlock?.referrals || 0) / 3) * 100);

  // Estimate beat-count
  const beats = Math.floor((result.percentile / 100) * 5_000_000);

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white">
      {/* Aurora background */}
      <AuroraBg tier={tier} />
      {showConfetti && <Confetti colors={cfg.confettiColors} />}

      <div className="relative z-10 max-w-md mx-auto px-4 pt-4 pb-10 space-y-5">
        {/* Tier announcement chip */}
        <div className="flex justify-center pt-2">
          <div
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md text-[10px] font-extrabold uppercase tracking-[0.25em] animate-[fade-in_0.5s_ease-out]`}
          >
            <Sparkles className={`w-3 h-3 ${cfg.text}`} />
            <span className={`bg-gradient-to-r ${cfg.gradient} bg-clip-text text-transparent`}>
              {cfg.label} TIER
            </span>
          </div>
        </div>

        {/* Hero rank card */}
        <div
          className={`relative overflow-hidden rounded-3xl p-7 text-center border border-white/10 backdrop-blur-xl ${cfg.glow}`}
          style={{
            background: "linear-gradient(140deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)",
          }}
        >
          {/* Animated tier glow */}
          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-20`} />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-50 animate-pulse"
            style={{ background: `radial-gradient(circle, var(--tw-gradient-from), transparent 70%)` }}
          />

          {/* Conic ring around icon */}
          <div className="relative flex justify-center mb-3">
            <div className="relative w-20 h-20 flex items-center justify-center">
              <div
                className="absolute inset-0 rounded-full animate-spin"
                style={{
                  animationDuration: "6s",
                  background: `conic-gradient(from 0deg, transparent 0%, currentColor 30%, transparent 60%, currentColor 90%, transparent 100%)`,
                  color: tier === "legendary" ? "#fbbf24" : tier === "elite" ? "#ec4899" : tier === "great" ? "#06b6d4" : "#10b981",
                  maskImage: "radial-gradient(circle, transparent 60%, black 62%, black 80%, transparent 82%)",
                  WebkitMaskImage: "radial-gradient(circle, transparent 60%, black 62%, black 80%, transparent 82%)",
                }}
              />
              <div className={`relative w-14 h-14 rounded-full bg-gradient-to-br ${cfg.gradient} flex items-center justify-center shadow-2xl`}>
                <TierIcon className="w-7 h-7 text-white drop-shadow-lg" />
              </div>
            </div>
          </div>

          <div className="relative text-[10px] uppercase tracking-[0.3em] text-white/60 font-semibold">Your India Rank</div>
          <div className={`relative text-6xl font-black tabular-nums my-2 bg-gradient-to-br ${cfg.gradient} bg-clip-text text-transparent drop-shadow-2xl leading-none`}>
            #{animatedRank.toLocaleString("en-IN")}
          </div>
          <div className="relative text-xs text-white/50 font-medium">
            {result.category} · {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
          </div>

          {/* AI tag */}
          <div className="relative mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold">
            <Flame className={`w-3.5 h-3.5 ${cfg.text}`} />
            {result.ai_tag}
          </div>

          {/* Beats meter */}
          <div className="relative mt-5 text-[11px] text-white/70">
            You beat <span className="font-extrabold text-white tabular-nums">{beats.toLocaleString("en-IN")}</span> Indians today 🇮🇳
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: "Score", val: `${result.score}/${result.total}`, from: "from-cyan-400", to: "to-blue-500" },
            { label: "Accuracy", val: `${result.accuracy}%`, from: "from-fuchsia-400", to: "to-pink-500" },
            { label: "Percentile", val: `${animatedPct}%`, from: "from-amber-400", to: "to-orange-500" },
          ].map((s, i) => (
            <div
              key={i}
              className="relative overflow-hidden rounded-2xl p-3 text-center border border-white/10 bg-white/[0.03] backdrop-blur"
            >
              <div className={`absolute -top-6 left-1/2 -translate-x-1/2 w-12 h-12 rounded-full blur-xl bg-gradient-to-br ${s.from} ${s.to} opacity-30`} />
              <div className="relative text-[10px] uppercase tracking-widest text-white/40 font-semibold">{s.label}</div>
              <div className={`relative text-xl font-extrabold tabular-nums bg-gradient-to-br ${s.from} ${s.to} bg-clip-text text-transparent`}>
                {s.val}
              </div>
            </div>
          ))}
        </div>

        {/* Percentile arc visualization */}
        <div className="relative overflow-hidden rounded-2xl p-4 border border-white/10 bg-white/[0.03] backdrop-blur">
          <div className="flex items-center justify-between mb-2">
            <div className="text-[10px] uppercase tracking-widest text-white/40 font-bold">Your position</div>
            <div className={`text-[10px] font-bold ${cfg.text}`}>TOP {Math.max(1, 100 - result.percentile)}%</div>
          </div>
          <div className="relative h-2 rounded-full bg-white/[0.06] overflow-hidden">
            <div
              className={`absolute inset-y-0 left-0 bg-gradient-to-r ${cfg.gradient} rounded-full transition-all duration-[1800ms] ease-out shadow-[0_0_12px_rgba(236,72,153,0.6)]`}
              style={{ width: `${animatedPct}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full bg-white border-2 border-white/50 shadow-[0_0_12px_rgba(255,255,255,0.8)] transition-all duration-[1800ms] ease-out"
              style={{ left: `${animatedPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[9px] text-white/30 mt-1.5 font-medium">
            <span>0%</span><span>50%</span><span>99%</span>
          </div>
        </div>

        {/* AI Insight */}
        <div className="relative overflow-hidden rounded-2xl p-4 border border-fuchsia-400/20 bg-gradient-to-br from-fuchsia-500/10 to-cyan-500/10 backdrop-blur-xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(236,72,153,0.15),transparent_60%)]" />
          <div className="relative">
            <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold mb-1.5">
              <Sparkles className="w-3 h-3 text-fuchsia-400" />
              <span className="bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
                AI Insight
              </span>
            </div>
            <div className="text-sm text-white/85 leading-relaxed">{result.ai_insight}</div>
          </div>
        </div>

        {/* WhatsApp CTA */}
        <button
          onClick={handleWhatsAppShare}
          className="group relative w-full overflow-hidden h-14 rounded-2xl font-extrabold text-base text-white shadow-[0_0_30px_-5px_rgba(37,211,102,0.6)] active:scale-[0.98] transition"
          style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
        >
          <div className="absolute inset-0 -translate-x-full group-hover:translate-x-full transition-transform duration-700 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          <span className="relative flex items-center justify-center gap-2">
            <Share2 className="w-5 h-5" />
            Share on WhatsApp · Challenge Friends
          </span>
        </button>

        {/* Secondary share row */}
        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleNativeShare}
            className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/80 hover:bg-white/[0.06] hover:border-white/20 transition flex items-center justify-center gap-1.5"
          >
            <Share2 className="w-3.5 h-3.5" />
            More options
          </button>
          <button
            onClick={handleCopy}
            className="px-3 py-2.5 rounded-xl border border-white/10 bg-white/[0.03] text-xs font-semibold text-white/80 hover:bg-white/[0.06] hover:border-white/20 transition flex items-center justify-center gap-1.5"
          >
            {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        {/* Shareable Badge */}
        <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03] backdrop-blur space-y-2">
          <div className="text-sm font-bold flex items-center gap-2 text-white">
            <Trophy className="w-4 h-4 text-amber-400" /> Shareable Badge
          </div>
          <div className="text-[11px] text-white/50">
            Auto-generated 1080×1080 — perfect for WhatsApp Status & Instagram.
          </div>
          <ShareableBadge
            rank={result.rank}
            percentile={result.percentile}
            category={result.category}
            aiTag={result.ai_tag}
            userName={user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Champion"}
          />
        </div>

        {/* Leaderboard CTA */}
        <button
          onClick={() => navigate("/myrank/leaderboard")}
          className="group w-full relative overflow-hidden rounded-2xl p-3.5 border border-white/10 bg-gradient-to-r from-amber-500/10 via-fuchsia-500/10 to-cyan-500/10 hover:border-white/20 transition"
        >
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-amber-400 to-orange-600 flex items-center justify-center shadow-lg">
                <ListOrdered className="w-4 h-4 text-white" />
              </div>
              <div className="text-left">
                <div className="text-sm font-bold text-white">Top 100 India Leaderboard</div>
                <div className="text-[11px] text-white/50">See where you stand</div>
              </div>
            </div>
            <ChevronRight className="w-4 h-4 text-white/60 group-hover:translate-x-1 transition-transform" />
          </div>
        </button>

        {/* Detailed analysis gate */}
        {!isUnlocked && !analysis && (
          <div className="relative overflow-hidden rounded-2xl p-4 border-2 border-dashed border-amber-400/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 backdrop-blur space-y-3">
            <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full bg-amber-500/20 blur-3xl" />
            <div className="relative flex items-center gap-2 text-sm font-bold">
              <Lock className="w-4 h-4 text-amber-400" />
              <span className="bg-gradient-to-r from-amber-300 to-orange-300 bg-clip-text text-transparent">
                Detailed AI Analysis · Locked
              </span>
            </div>
            <div className="relative text-[11px] text-white/60">
              Unlock weak-subject breakdown, topper strategy & AI study plan.
            </div>

            <div className="relative space-y-2.5">
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-white/80">📤 Share with friends</span>
                  <span className="tabular-nums text-white/60">{unlock?.shares || 0}/2</span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-400 to-cyan-400 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(16,185,129,0.6)]"
                    style={{ width: `${sharePct}%` }}
                  />
                </div>
              </div>
              <div className="text-center text-[10px] text-white/30 font-bold tracking-widest">— OR —</div>
              <div>
                <div className="flex justify-between text-[11px] mb-1">
                  <span className="font-semibold text-white/80">🎯 Invite friends to test</span>
                  <span className="tabular-nums text-white/60">{unlock?.referrals || 0}/3</span>
                </div>
                <div className="h-2 bg-white/[0.06] rounded-full overflow-hidden border border-white/10">
                  <div
                    className="h-full bg-gradient-to-r from-fuchsia-400 to-pink-400 rounded-full transition-all duration-700 shadow-[0_0_10px_rgba(236,72,153,0.6)]"
                    style={{ width: `${refPct}%` }}
                  />
                </div>
              </div>
            </div>

            <button
              onClick={handleWhatsAppShare}
              className="relative w-full h-11 rounded-xl text-xs font-extrabold text-white shadow-lg active:scale-[0.98] transition"
              style={{ background: "linear-gradient(135deg, #25D366, #128C7E)" }}
            >
              <Share2 className="w-3.5 h-3.5 inline mr-1.5" />
              {sharesNeeded > 0 ? `Share ${sharesNeeded} more time${sharesNeeded > 1 ? "s" : ""} to unlock` : "Share now"}
            </button>
            {referralsNeeded > 0 && (
              <div className="text-[10px] text-center text-white/40">
                Or invite {referralsNeeded} more friend{referralsNeeded > 1 ? "s" : ""}
              </div>
            )}
          </div>
        )}

        {isUnlocked && !analysis && (
          <div className="relative overflow-hidden rounded-2xl p-4 border border-emerald-400/30 bg-gradient-to-br from-emerald-500/10 to-cyan-500/10 backdrop-blur space-y-3">
            <div className="flex items-center gap-2 text-sm font-bold">
              <Sparkles className="w-4 h-4 text-emerald-400" />
              <span className="bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                ✓ Detailed Analysis Unlocked!
              </span>
            </div>
            <button
              onClick={handleUnlockAnalysis}
              disabled={loadingAnalysis}
              className="w-full h-11 rounded-xl font-bold text-sm text-white bg-gradient-to-r from-fuchsia-500 to-cyan-500 shadow-[0_0_20px_-5px_rgba(236,72,153,0.6)] active:scale-[0.98] transition flex items-center justify-center gap-2"
            >
              {loadingAnalysis ? (
                <><Loader2 className="w-4 h-4 animate-spin" /> Generating AI insights…</>
              ) : (
                <><Sparkles className="w-4 h-4" /> Reveal AI analysis</>
              )}
            </button>
          </div>
        )}

        {analysis && (
          <>
            <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03] backdrop-blur space-y-3">
              <div className="text-sm font-bold flex items-center gap-2 text-white">
                <Target className="w-4 h-4 text-orange-400" /> Weak Areas
              </div>
              <div className="space-y-2.5">
                {analysis.weak_areas.map((w, i) => (
                  <div key={i} className="rounded-lg border-l-2 border-orange-400 bg-orange-500/5 pl-3 py-1.5">
                    <div className="text-xs font-bold text-white/90">
                      {w.topic}
                      <span className="ml-1.5 text-[9px] uppercase tracking-wider text-orange-300/80">({w.severity})</span>
                    </div>
                    <div className="text-[11px] text-white/60 mt-0.5">{w.why}</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03] backdrop-blur space-y-2">
              <div className="text-sm font-bold flex items-center gap-2 text-white">
                <Crown className="w-4 h-4 text-purple-400" /> Topper Strategy
              </div>
              <ul className="text-[12px] space-y-1.5 text-white/70">
                {analysis.topper_strategy.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-purple-400 font-bold">→</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03] backdrop-blur space-y-2">
              <div className="text-sm font-bold flex items-center gap-2 text-white">
                <Trophy className="w-4 h-4 text-cyan-400" /> Your Next Steps
              </div>
              <ul className="text-[12px] space-y-1.5 text-white/70">
                {analysis.next_steps.map((s, i) => (
                  <li key={i} className="flex gap-2">
                    <span className="text-cyan-400 font-bold">{i + 1}.</span>
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </div>
          </>
        )}

        {/* Referral rewards */}
        <div className="relative overflow-hidden rounded-2xl p-4 border border-purple-400/20 bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur space-y-3">
          <div className="absolute -bottom-12 -left-12 w-40 h-40 rounded-full bg-purple-500/20 blur-3xl" />
          <div className="relative flex items-center gap-2 text-sm font-bold">
            <Gift className="w-4 h-4 text-purple-400" />
            <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent">
              Invite & Earn Rewards
            </span>
          </div>
          <div className="relative text-[11px] text-white/60">
            You've invited <span className="font-extrabold text-white">{unlock?.referrals || 0}</span> friend{unlock?.referrals === 1 ? "" : "s"}.
          </div>
          <div className="relative space-y-1.5">
            <RewardRow
              icon={Users}
              label="Invite 5 → Premium test"
              done={!!unlock?.unlocks.premium_test}
              progress={`${unlock?.referrals || 0}/5`}
            />
            <RewardRow
              icon={Sparkles}
              label="Invite 10 → AI study plan"
              done={!!unlock?.unlocks.ai_study_plan}
              progress={`${unlock?.referrals || 0}/10`}
            />
          </div>
          <div className="relative text-[10px] text-center text-white/40 pt-1 font-mono truncate">
            {shareUrl}
          </div>
        </div>

        <button
          onClick={() => navigate("/myrank")}
          className="w-full h-11 rounded-xl border border-white/10 bg-white/[0.03] text-sm font-semibold text-white/70 hover:bg-white/[0.06] hover:text-white transition flex items-center justify-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Try another category
        </button>
      </div>
    </div>
  );
};

const RewardRow = ({ icon: Icon, label, done, progress }: { icon: typeof Users; label: string; done: boolean; progress: string }) => (
  <div
    className={`flex items-center justify-between p-2 rounded-lg border transition ${
      done ? "bg-emerald-500/15 border-emerald-400/30" : "bg-white/[0.03] border-white/10"
    }`}
  >
    <div className="flex items-center gap-2 text-[11px] text-white/80">
      <Icon className={`w-3 h-3 ${done ? "text-emerald-400" : "text-white/50"}`} />
      <span>{label}</span>
    </div>
    <span className={`text-[11px] font-extrabold tabular-nums ${done ? "text-emerald-300" : "text-white/60"}`}>
      {done ? "✓" : progress}
    </span>
  </div>
);

/* ===== Aurora background ===== */
const AuroraBg = ({ tier }: { tier: keyof typeof TIER_CONFIG }) => {
  const colors = {
    legendary: ["bg-yellow-500/30", "bg-orange-500/25", "bg-red-500/20"],
    elite: ["bg-fuchsia-500/30", "bg-pink-500/25", "bg-violet-500/20"],
    great: ["bg-cyan-500/30", "bg-blue-500/25", "bg-teal-500/20"],
    good: ["bg-emerald-500/30", "bg-green-500/25", "bg-teal-500/20"],
  }[tier];

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.15),transparent_60%)]" />
      <div className={`absolute -top-32 -left-32 w-96 h-96 rounded-full ${colors[0]} blur-3xl animate-pulse`} style={{ animationDuration: "5s" }} />
      <div className={`absolute top-1/3 -right-32 w-96 h-96 rounded-full ${colors[1]} blur-3xl animate-pulse`} style={{ animationDuration: "7s", animationDelay: "1s" }} />
      <div className={`absolute -bottom-32 left-1/4 w-80 h-80 rounded-full ${colors[2]} blur-3xl animate-pulse`} style={{ animationDuration: "9s", animationDelay: "2s" }} />

      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)",
          backgroundSize: "32px 32px",
        }}
      />

      {Array.from({ length: 20 }).map((_, i) => (
        <span
          key={i}
          className="absolute w-1 h-1 rounded-full bg-white animate-pulse"
          style={{
            top: `${(i * 53) % 100}%`,
            left: `${(i * 37) % 100}%`,
            opacity: 0.3 + (i % 4) * 0.1,
            boxShadow: "0 0 8px rgba(255,255,255,0.8)",
            animationDuration: `${3 + (i % 5)}s`,
            animationDelay: `${(i % 6) * 0.3}s`,
          }}
        />
      ))}
    </div>
  );
};

/* ===== Confetti burst ===== */
const Confetti = ({ colors }: { colors: string[] }) => {
  const pieces = useRef(
    Array.from({ length: 60 }).map((_, i) => ({
      id: i,
      left: Math.random() * 100,
      delay: Math.random() * 0.6,
      duration: 2 + Math.random() * 2,
      size: 6 + Math.random() * 6,
      color: colors[i % colors.length],
      rotate: Math.random() * 360,
      drift: (Math.random() - 0.5) * 100,
    }))
  ).current;

  return (
    <div className="fixed inset-0 pointer-events-none z-20 overflow-hidden">
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translate(0, -10vh) rotate(0deg); opacity: 1; }
          100% { transform: translate(var(--drift, 0), 110vh) rotate(720deg); opacity: 0; }
        }
      `}</style>
      {pieces.map((p) => (
        <span
          key={p.id}
          className="absolute top-0 rounded-sm"
          style={{
            left: `${p.left}%`,
            width: p.size,
            height: p.size * 0.4,
            background: p.color,
            transform: `rotate(${p.rotate}deg)`,
            animation: `confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
            ["--drift" as any]: `${p.drift}px`,
            boxShadow: `0 0 6px ${p.color}80`,
          }}
        />
      ))}
    </div>
  );
};

export default MyRankResult;
