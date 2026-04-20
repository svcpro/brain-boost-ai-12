import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import {
  Trophy, Share2, RefreshCw, Lock, Crown, Sparkles, Users, Gift, Loader2,
  ListOrdered, Target, Flame, TrendingUp, ChevronRight, Copy, Check,
  Zap, MessageCircle, Instagram, Send, Swords, Eye, EyeOff, Wand2, Home, ArrowLeft,
} from "lucide-react";
import ShareableBadge from "@/components/myrank/ShareableBadge";
import { useReferralHandle } from "@/hooks/useReferralHandle";
import { shareBadgeOneClick, openSharePlaceholder } from "@/lib/shareBadge";
import { useToast } from "@/hooks/use-toast";

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
    flexLine: "Only 1 in 100 reach this. Flex it.",
  },
  elite: {
    label: "ELITE",
    icon: Crown,
    gradient: "from-purple-500 via-pink-500 to-rose-500",
    glow: "shadow-[0_0_80px_-10px_rgba(168,85,247,0.7)]",
    ring: "from-purple-400 via-pink-400 to-rose-500",
    text: "text-pink-300",
    confettiColors: ["#a855f7", "#ec4899", "#f43f5e", "#06b6d4"],
    flexLine: "Top 10% — your friends NEED to see this.",
  },
  great: {
    label: "GREAT",
    icon: Trophy,
    gradient: "from-blue-500 via-cyan-500 to-teal-500",
    glow: "shadow-[0_0_80px_-10px_rgba(6,182,212,0.7)]",
    ring: "from-blue-400 via-cyan-400 to-teal-500",
    text: "text-cyan-300",
    confettiColors: ["#3b82f6", "#06b6d4", "#14b8a6", "#a855f7"],
    flexLine: "Solid score — challenge friends to beat you.",
  },
  good: {
    label: "RISING",
    icon: TrendingUp,
    gradient: "from-emerald-500 via-green-500 to-teal-500",
    glow: "shadow-[0_0_80px_-10px_rgba(16,185,129,0.6)]",
    ring: "from-emerald-400 via-green-400 to-teal-500",
    text: "text-emerald-300",
    confettiColors: ["#10b981", "#22c55e", "#06b6d4", "#fbbf24"],
    flexLine: "Find out who in your group ranks higher 👀",
  },
};

// Pre-written share templates (one-tap copy, increases share volume)
// Designed for WhatsApp: bold-feeling unicode, clean lines, eye-catching headers.
const SHARE_TEMPLATES = [
  {
    label: "Flex 🔥",
    icon: "🏆",
    builder: (r: Result, url: string) =>
      `🏆 *ACRY AI RANK TEST* 🏆
━━━━━━━━━━━━━━━━━
🇮🇳 All-India Rank: *#${r.rank.toLocaleString("en-IN")}*
🎯 Category: ${r.category}
📊 Percentile: *${r.percentile}%*
🧠 AI Tag: _${r.ai_tag}_
━━━━━━━━━━━━━━━━━

Think you can beat me? 😎
Take the 90-sec test 👇
${url}`,
  },
  {
    label: "Challenge ⚔️",
    icon: "⚔️",
    builder: (r: Result, url: string) =>
      `⚔️ *CHALLENGE ACCEPTED?* ⚔️

I just scored *${r.percentile}%* on ACRY's
${r.category} AI Rank Test 🧠⚡

🏅 Rank: #${r.rank.toLocaleString("en-IN")} in India
🎖 Tag: ${r.ai_tag}

Your turn. 90 seconds. Let's see your rank 👇
${url}`,
  },
  {
    label: "Humble brag 😏",
    icon: "😏",
    builder: (r: Result, url: string) =>
      `Just took the *ACRY AI Rank Test*…
apparently I'm in the *top ${Math.max(1, 100 - Math.round(r.percentile))}%* of India 🇮🇳

🏆 Rank #${r.rank.toLocaleString("en-IN")} · ${r.category}
🧠 ${r.ai_tag}

No big deal 😏
${url}`,
  },
  {
    label: "Group war 👥",
    icon: "👥",
    builder: (r: Result, url: string) =>
      `Yo squad 👋

Find your *India rank in 90 seconds* on ACRY.
I got *#${r.rank.toLocaleString("en-IN")}* (${r.ai_tag}) in ${r.category} 🔥

Who's #1 in our group? 👀
${url}`,
  },
];

const MyRankResult = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const [result, setResult] = useState<Result | null>(null);
  const [unlock, setUnlock] = useState<UnlockStatus | null>(null);
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loadingAnalysis, setLoadingAnalysis] = useState(false);
  const [animatedRank, setAnimatedRank] = useState(0);
  const [animatedPct, setAnimatedPct] = useState(0);
  const [showConfetti, setShowConfetti] = useState(true);
  const [copied, setCopied] = useState<string | null>(null);
  const [activeTemplate, setActiveTemplate] = useState(0);
  const [showShareBoost, setShowShareBoost] = useState(false);
  const [liveShareCount, setLiveShareCount] = useState(0);
  const [tagTimer, setTagTimer] = useState(60);
  const [aiSharing, setAiSharing] = useState(false);
  const [aiStatus, setAiStatus] = useState<string>("");

  const { handle: refCode, shareUrl: cleanShareUrl } = useReferralHandle();
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
    const pending = sessionStorage.getItem("myrank_result_pending");
    const inflight = (window as any).__myrankSubmitPromise as Promise<Result | null> | undefined;

    const startAnimations = (r: Result) => {
      setResult(r);
      fetchUnlockStatus();
      if (navigator.vibrate) navigator.vibrate([30, 60, 30, 60, 100]);
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
    };

    if (stored) {
      startAnimations(JSON.parse(stored) as Result);
    } else if (pending && inflight) {
      // Submission in flight — await it instead of bouncing back to landing.
      inflight.then((r) => {
        if (r) startAnimations(r as Result);
        else navigate("/myrank");
      });
    } else if (pending) {
      // Listen for the result event in case the promise reference was lost.
      const onReady = (e: Event) => startAnimations((e as CustomEvent).detail as Result);
      window.addEventListener("myrank:result-ready", onReady, { once: true });
      // Safety fallback: if nothing arrives in 15s, return to landing.
      const t = setTimeout(() => navigate("/myrank"), 15000);
      return () => {
        window.removeEventListener("myrank:result-ready", onReady);
        clearTimeout(t);
      };
    } else {
      navigate("/myrank");
      return;
    }

    const conf = setTimeout(() => setShowConfetti(false), 4500);
    return () => clearTimeout(conf);
  }, [navigate, fetchUnlockStatus]);

  // Live ticker — fake-but-believable social proof (cycles + slow growth)
  useEffect(() => {
    const seed = 1240 + Math.floor(Math.random() * 80);
    setLiveShareCount(seed);
    const id = setInterval(() => {
      setLiveShareCount(c => c + Math.floor(Math.random() * 3) + 1);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  // 60s tag-to-bonus countdown — drives urgency
  useEffect(() => {
    if (tagTimer <= 0) return;
    const id = setTimeout(() => setTagTimer(t => Math.max(0, t - 1)), 1000);
    return () => clearTimeout(id);
  }, [tagTimer]);

  if (!result) {
    return (
      <div className="relative min-h-screen flex flex-col items-center justify-center bg-[#05060f] text-white overflow-hidden">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,rgba(139,92,246,0.18),transparent_60%),radial-gradient(ellipse_at_bottom,rgba(6,182,212,0.15),transparent_60%)]" />
          <div className="absolute -top-40 -left-40 w-96 h-96 rounded-full bg-fuchsia-600/25 blur-3xl animate-pulse" />
          <div className="absolute -bottom-40 -right-40 w-96 h-96 rounded-full bg-cyan-500/20 blur-3xl animate-pulse" style={{ animationDuration: "4s" }} />
        </div>
        <div className="relative z-10 flex flex-col items-center gap-5">
          <div className="relative w-20 h-20">
            <div className="absolute inset-0 rounded-full border-4 border-white/10" />
            <div className="absolute inset-0 rounded-full border-4 border-transparent border-t-fuchsia-400 border-r-cyan-400 animate-spin" />
            <div className="absolute inset-3 rounded-full bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 backdrop-blur flex items-center justify-center">
              <Trophy className="w-7 h-7 text-white" />
            </div>
          </div>
          <div className="text-center space-y-1.5">
            <div className="text-base font-bold bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">
              Calculating your India rank…
            </div>
            <div className="text-[11px] text-white/50 tracking-widest uppercase">
              AI is comparing you to 5M+ aspirants
            </div>
          </div>
        </div>
      </div>
    );
  }

  const tier = (result.percentile >= 99
    ? "legendary"
    : result.percentile >= 90
    ? "elite"
    : result.percentile >= 70
    ? "great"
    : "good") as keyof typeof TIER_CONFIG;
  const cfg = TIER_CONFIG[tier];
  const TierIcon = cfg.icon;

  // Memorable share URL like acry.ai/?ref=rahul123
  const shareUrl = cleanShareUrl;
  const currentMessage = SHARE_TEMPLATES[activeTemplate].builder(result, shareUrl);

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
    // Reward burst animation
    setShowShareBoost(true);
    if (navigator.vibrate) navigator.vibrate([15, 40, 60]);
    setTimeout(() => setShowShareBoost(false), 1400);
    setTimeout(fetchUnlockStatus, 500);
  };

  const userName = user?.user_metadata?.display_name || user?.email?.split("@")[0] || "Champion";

  const runShare = async (
    channel: "whatsapp" | "instagram" | "telegram" | "native",
    preOpenedWindow?: Window | null,
  ) => {
    if (!result) return;

    // Always copy caption first — guarantees user can paste anywhere
    try { await navigator.clipboard?.writeText(currentMessage); } catch { /* non-fatal */ }

    // 🚀 Try image share via shareBadgeOneClick — generates 1080×1080 PNG and
    // hands it to WhatsApp/Telegram/IG via the Web Share API on mobile, or
    // redirects the pre-opened popup window on desktop (avoids popup blocker).
    try {
      const shareRes = await shareBadgeOneClick({
        badge: {
          rank: result.rank,
          percentile: result.percentile,
          category: result.category,
          aiTag: result.ai_tag,
          userName,
        },
        caption: currentMessage,
        shareUrl,
        channel,
        preOpenedWindow,
      });

      if (shareRes.mode === "native-files") {
        await logShare(channel);
        toast({ title: "Shared! 🎉", description: "Image attached — caption copied as backup." });
        return;
      }
      if (shareRes.mode === "cancelled") {
        return;
      }
      if (shareRes.mode === "downloaded") {
        await logShare(channel);
        toast({
          title: "Image saved 📥 — attach it in chat",
          description: shareRes.message || "Caption is pre-filled. Tap 📎 to attach the image.",
        });
        return;
      }
      if (shareRes.mode === "channel-url") {
        await logShare(channel);
        toast({ title: "Opening… 🚀", description: "Caption copied as backup." });
        return;
      }
      // mode === "error" → fall through to legacy text-only path
    } catch { /* fall through */ }

    // ───── Legacy fallback (text-only) ─────
    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    const encoded = encodeURIComponent(currentMessage);

    if (channel === "native") {
      const nav: any = navigator;
      if (typeof nav.share === "function") {
        try {
          await nav.share({ title: "My ACRY AI Rank", text: currentMessage, url: shareUrl });
          await logShare("native");
        } catch (err: any) {
          if (err?.name !== "AbortError") {
            toast({ title: "Caption copied 📋", description: "Paste anywhere to share." });
          }
        }
      } else {
        toast({ title: "Caption copied 📋", description: "Paste anywhere to share." });
        await logShare("native");
      }
      return;
    }

    let target = "";
    switch (channel) {
      case "telegram": {
        const absoluteUrl = /^https?:\/\//i.test(shareUrl)
          ? shareUrl
          : `https://${(shareUrl || "acry.ai").replace(/^\/+/, "")}`;
        const textWithoutUrl = currentMessage
          .replace(shareUrl, "")
          .replace(/\n{3,}/g, "\n\n")
          .trim();
        target =
          `https://t.me/share/url` +
          `?url=${encodeURIComponent(absoluteUrl)}` +
          `&text=${encodeURIComponent(textWithoutUrl)}`;
        break;
      }
      case "instagram":
        target = isMobile
          ? "instagram://direct-inbox"
          : "https://www.instagram.com/direct/inbox/";
        break;
      case "whatsapp":
      default:
        target = `https://wa.me/?text=${encoded}`;
        break;
    }

    if (isMobile) {
      if (channel === "instagram") {
        const fallback = "https://www.instagram.com/direct/inbox/";
        const start = Date.now();
        window.location.href = target;
        setTimeout(() => {
          if (Date.now() - start < 1500 && document.visibilityState === "visible") {
            window.location.href = fallback;
          }
        }, 1200);
      } else {
        window.location.href = target;
      }
    } else if (preOpenedWindow && !preOpenedWindow.closed) {
      try { preOpenedWindow.location.href = target; } catch {
        const w = window.open(target, "_blank", "noopener,noreferrer");
        if (!w) window.location.href = target;
      }
    } else {
      const w = window.open(target, "_blank", "noopener,noreferrer");
      if (!w) window.location.href = target;
    }

    await logShare(channel);

    if (channel === "instagram") {
      toast({
        title: "Caption copied 📋 — paste in Instagram",
        description: "Pick a chat or your story, then long-press to paste.",
      });
    } else {
      toast({
        title: "Opening… 🚀",
        description: "Your caption is pre-filled and copied as backup.",
      });
    }
  };

  const handleWhatsAppShare = () => {
    const win = openSharePlaceholder();
    return runShare("whatsapp", win);
  };
  const handleInstagramShare = () => {
    const win = openSharePlaceholder();
    setCopied("ig");
    setTimeout(() => setCopied(null), 2000);
    return runShare("instagram", win);
  };
  const handleTelegramShare = () => {
    const win = openSharePlaceholder();
    return runShare("telegram", win);
  };
  const handleNativeShare = () => {
    const win = openSharePlaceholder();
    return runShare("native", win);
  };

  /** AI Auto-Share: AI picks best channel + writes optimized caption + shares — zero-click. */
  const pickBestChannel = (p: number): "whatsapp" | "instagram" | "telegram" => {
    if (p >= 99) return "instagram";
    if (p >= 90) return "whatsapp";
    return "telegram";
  };
  const channelLabels: Record<string, string> = {
    whatsapp: "WhatsApp", instagram: "Instagram", telegram: "Telegram",
  };

  const handleAIAutoShare = async () => {
    if (!result || aiSharing) return;
    // 🚨 Open the placeholder window SYNCHRONOUSLY inside the click gesture.
    // Otherwise desktop browsers (Chrome/Safari) block the popup after async work.
    const preWin = openSharePlaceholder();
    setAiSharing(true);
    try {
      const channel = pickBestChannel(result.percentile);
      const label = channelLabels[channel];

      setAiStatus(`AI is picking ${label}…`);
      await new Promise(r => setTimeout(r, 350));

      setAiStatus("Writing your viral caption…");
      let caption = currentMessage;
      try {
        const { data } = await supabase.functions.invoke("myrank-ai-caption", {
          body: {
            rank: result.rank,
            percentile: result.percentile,
            category: result.category,
            ai_tag: result.ai_tag,
            user_name: userName,
            channel,
            tone: result.percentile >= 90 ? "flex" : "challenge",
            share_url: shareUrl,
          },
        });
        if (data?.caption) caption = data.caption as string;
      } catch { /* fallback to template */ }

      setAiStatus(`Opening ${label}…`);
      try { await navigator.clipboard?.writeText(caption); } catch {}

      const res = await shareBadgeOneClick({
        badge: {
          rank: result.rank,
          percentile: result.percentile,
          category: result.category,
          aiTag: result.ai_tag,
          userName,
        },
        caption,
        shareUrl,
        channel,
        preOpenedWindow: preWin,
      });

      await logShare(channel);

      if (res.mode === "native-files") {
        toast({ title: "🤖 AI Shared! 🎉", description: `Posted to ${label} with AI-crafted caption.` });
      } else if (res.mode === "cancelled") {
        // silent
      } else {
        toast({
          title: `🤖 AI opened ${label}`,
          description: res.message || "Caption auto-pasted. Image saved to attach.",
        });
      }
    } catch (e: any) {
      try { preWin?.close(); } catch {}
      toast({ title: "AI share failed", description: e?.message || "Try a manual channel.", variant: "destructive" });
    } finally {
      setAiSharing(false);
      setAiStatus("");
    }
  };

  const handleCopyMessage = async () => {
    await navigator.clipboard.writeText(currentMessage);
    setCopied("msg");
    setTimeout(() => setCopied(null), 1800);
  };

  const handleCopyLink = async () => {
    await navigator.clipboard.writeText(shareUrl);
    setCopied("link");
    setTimeout(() => setCopied(null), 1800);
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
  const sharesDone = unlock?.shares || 0;

  const beats = Math.floor((result.percentile / 100) * 5_000_000);
  const tagBonusActive = tagTimer > 0 && sharesDone < 3;

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060f] text-white pb-[200px]">
      <AuroraBg tier={tier} />
      {showConfetti && <Confetti colors={cfg.confettiColors} />}
      {showShareBoost && <ShareBoostBurst colors={cfg.confettiColors} />}

      {/* Back to Home — only for unauthenticated visitors (shared links) */}
      {!user && (
        <div className="fixed top-3 left-1/2 -translate-x-1/2 z-50 animate-[fade-in_0.4s_ease-out] safe-top">
          <div className="relative">
            {/* Outer pulsing glow ring */}
            <span className="absolute -inset-2 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-70 blur-xl animate-pulse" />
            <span className="absolute -inset-1 rounded-full bg-gradient-to-r from-cyan-400 via-purple-500 to-pink-500 opacity-90 blur-md" />
            <button
              onClick={() => navigate("/app")}
              className="group relative inline-flex items-center gap-2.5 pl-4 pr-5 py-2.5 rounded-full border-2 border-white/40 bg-gradient-to-r from-cyan-500 via-purple-600 to-pink-600 text-white text-[13px] font-extrabold tracking-wide shadow-[0_10px_40px_-5px_rgba(168,85,247,0.8)] transition-all duration-300 hover:scale-110 active:scale-95 overflow-hidden"
            >
              {/* Shimmer sweep */}
              <span className="absolute inset-0 -translate-x-full group-hover:translate-x-full bg-gradient-to-r from-transparent via-white/40 to-transparent transition-transform duration-700" />
              <ArrowLeft className="relative w-4 h-4 transition-transform duration-300 group-hover:-translate-x-1" />
              <Home className="relative w-4 h-4 transition-transform duration-500 group-hover:rotate-[-12deg] group-hover:scale-125" strokeWidth={2.5} />
              <span className="relative uppercase">Back to Home</span>
              <span className="relative flex w-2 h-2">
                <span className="absolute inline-flex w-full h-full rounded-full bg-white opacity-80 animate-ping" />
                <span className="relative inline-flex w-2 h-2 rounded-full bg-white" />
              </span>
            </button>
          </div>
        </div>
      )}

      <div className={`relative z-10 max-w-md mx-auto px-4 ${!user ? "pt-20" : "pt-4"} space-y-5`}>
        {/* Live social proof ticker */}
        <div className="flex justify-center pt-1">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-emerald-400/20 bg-emerald-500/[0.08] backdrop-blur-md text-[10px] font-bold animate-[fade-in_0.4s_ease-out]">
            <span className="relative flex w-1.5 h-1.5">
              <span className="absolute inline-flex w-full h-full rounded-full bg-emerald-400 opacity-75 animate-ping" />
              <span className="relative inline-flex w-1.5 h-1.5 rounded-full bg-emerald-400" />
            </span>
            <span className="text-white/80 tabular-nums">
              {liveShareCount.toLocaleString("en-IN")}
            </span>
            <span className="text-white/50">people sharing right now</span>
          </div>
        </div>

        {/* Tier announcement chip */}
        <div className="flex justify-center -mt-2">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border border-white/15 bg-white/[0.05] backdrop-blur-md text-[10px] font-extrabold uppercase tracking-[0.25em]">
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
          <div className={`absolute inset-0 bg-gradient-to-br ${cfg.gradient} opacity-20`} />
          <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-64 h-64 rounded-full blur-3xl opacity-50 animate-pulse"
            style={{ background: `radial-gradient(circle, var(--tw-gradient-from), transparent 70%)` }}
          />

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

          <div className="relative mt-4 inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full bg-white/10 backdrop-blur-sm border border-white/20 text-sm font-bold">
            <Flame className={`w-3.5 h-3.5 ${cfg.text}`} />
            {result.ai_tag}
          </div>

          <div className="relative mt-5 text-[11px] text-white/70">
            You beat <span className="font-extrabold text-white tabular-nums">{beats.toLocaleString("en-IN")}</span> Indians today 🇮🇳
          </div>

          {/* Tier-specific flex line — drives share intent */}
          <div className={`relative mt-3 text-[12px] font-bold ${cfg.text} animate-pulse`} style={{ animationDuration: "2.5s" }}>
            {cfg.flexLine}
          </div>
        </div>

        {/* === PRIMARY SHARE BLOCK (above the fold after hero) === */}
        <div className="relative overflow-hidden rounded-3xl p-4 border border-white/15 bg-gradient-to-br from-white/[0.06] to-white/[0.02] backdrop-blur-xl">
          <div className="absolute -top-16 -right-16 w-40 h-40 rounded-full bg-fuchsia-500/20 blur-3xl" />
          <div className="absolute -bottom-16 -left-16 w-40 h-40 rounded-full bg-cyan-500/20 blur-3xl" />

          <div className="relative flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-fuchsia-500 to-cyan-500 flex items-center justify-center">
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div>
                <div className="text-sm font-extrabold">Pick your flex style</div>
                <div className="text-[10px] text-white/50">One tap → ready-to-send caption</div>
              </div>
            </div>
            {tagBonusActive && (
              <div className="px-2 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-[9px] font-extrabold text-amber-300 tabular-nums animate-pulse">
                +BONUS {tagTimer}s
              </div>
            )}
          </div>

          {/* Template chips */}
          <div className="relative flex gap-2 overflow-x-auto pb-1 mb-3 scrollbar-none -mx-1 px-1">
            {SHARE_TEMPLATES.map((tpl, i) => (
              <button
                key={i}
                onClick={() => {
                  setActiveTemplate(i);
                  if (navigator.vibrate) navigator.vibrate(8);
                }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-[11px] font-bold border transition ${
                  activeTemplate === i
                    ? `bg-gradient-to-r ${cfg.gradient} text-white border-transparent shadow-[0_0_16px_-4px_rgba(236,72,153,0.6)]`
                    : "bg-white/[0.04] border-white/10 text-white/70 hover:bg-white/[0.08]"
                }`}
              >
                <span className="mr-1">{tpl.icon}</span>
                {tpl.label}
              </button>
            ))}
          </div>

          {/* Preview message */}
          <div className="relative rounded-2xl p-3 bg-black/30 border border-white/10 mb-3 text-[12px] leading-relaxed text-white/85 whitespace-pre-line max-h-32 overflow-y-auto scrollbar-none">
            {currentMessage}
            <button
              onClick={handleCopyMessage}
              className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 backdrop-blur flex items-center justify-center transition"
              aria-label="Copy message"
            >
              {copied === "msg" ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5 text-white/70" />}
            </button>
          </div>

          {/* 🤖 AI AUTO-SHARE — picks best channel + writes viral caption */}
          <button
            onClick={handleAIAutoShare}
            disabled={aiSharing}
            className="relative w-full mb-3 overflow-hidden rounded-2xl p-[2px] active:scale-[0.99] transition disabled:opacity-80"
            style={{
              background:
                "conic-gradient(from 0deg, #f59e0b, #ec4899, #8b5cf6, #06b6d4, #10b981, #f59e0b)",
            }}
          >
            <div
              className="relative flex items-center justify-center gap-2 h-12 rounded-[14px] text-sm font-extrabold text-white"
              style={{
                background:
                  "linear-gradient(120deg, #1e1b4b 0%, #4c1d95 35%, #7c2d92 65%, #1e1b4b 100%)",
                backgroundSize: "200% 200%",
                animation: "ai-share-gradient 4s ease infinite",
              }}
            >
              {aiSharing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span className="text-[12.5px] tracking-wide">{aiStatus || "AI is sharing…"}</span>
                </>
              ) : (
                <>
                  <Wand2 className="w-4 h-4 text-amber-300" />
                  <span>AI Auto-Share</span>
                  <span className="px-1.5 py-0.5 rounded-md bg-white/15 text-[9px] font-black uppercase tracking-wider">
                    1-tap
                  </span>
                  <Sparkles className="w-3.5 h-3.5 text-pink-300 animate-pulse" />
                </>
              )}
            </div>
          </button>

          {/* Channel grid — multi-platform pressure */}
          <div className="relative grid grid-cols-4 gap-2">
            <ChannelBtn
              onClick={handleWhatsAppShare}
              icon={<MessageCircle className="w-4 h-4" />}
              label="WhatsApp"
              color="from-[#25D366] to-[#128C7E]"
              primary
            />
            <ChannelBtn
              onClick={handleInstagramShare}
              icon={<Instagram className="w-4 h-4" />}
              label={copied === "ig" ? "Copied!" : "Instagram"}
              color="from-fuchsia-500 via-pink-500 to-amber-500"
            />
            <ChannelBtn
              onClick={handleTelegramShare}
              icon={<Send className="w-4 h-4" />}
              label="Telegram"
              color="from-sky-400 to-blue-500"
            />
            <ChannelBtn
              onClick={handleNativeShare}
              icon={<Share2 className="w-4 h-4" />}
              label="More"
              color="from-slate-500 to-slate-700"
            />
          </div>

          {/* Share streak indicator */}
          <div className="relative mt-3 flex items-center justify-between text-[11px]">
            <div className="flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-orange-400" />
              <span className="text-white/70">
                Share streak: <span className="font-extrabold text-orange-300 tabular-nums">{sharesDone}</span>
              </span>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1 text-white/50 hover:text-white/80 transition"
            >
              {copied === "link" ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
              {copied === "link" ? "Link copied" : "Copy link"}
            </button>
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

        {/* Percentile arc */}
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

        {/* === CHALLENGE FRIENDS — direct intent === */}
        <div className="relative overflow-hidden rounded-2xl p-4 border border-rose-400/25 bg-gradient-to-br from-rose-500/10 via-orange-500/10 to-amber-500/10 backdrop-blur-xl">
          <div className="absolute -top-10 -right-10 w-32 h-32 rounded-full bg-rose-500/30 blur-3xl animate-pulse" />
          <div className="relative flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-rose-500 to-orange-500 flex items-center justify-center shrink-0 shadow-lg">
              <Swords className="w-5 h-5 text-white" />
            </div>
            <div className="flex-1">
              <div className="text-sm font-extrabold text-white">Who can beat your rank?</div>
              <div className="text-[11px] text-white/60 mt-0.5">
                Send to your study group → see who tops the chat 🔥
              </div>
              <button
                onClick={handleWhatsAppShare}
                className="mt-2.5 w-full h-10 rounded-xl text-xs font-extrabold text-white shadow-[0_0_20px_-4px_rgba(244,63,94,0.5)] active:scale-[0.98] transition flex items-center justify-center gap-2"
                style={{ background: "linear-gradient(135deg, #f43f5e, #f97316)" }}
              >
                <Swords className="w-3.5 h-3.5" />
                Challenge group on WhatsApp
              </button>
            </div>
          </div>
        </div>

        {/* Shareable Badge */}
        <div className="rounded-2xl p-4 border border-white/10 bg-white/[0.03] backdrop-blur space-y-2">
          <div className="text-sm font-bold flex items-center gap-2 text-white">
            <Trophy className="w-4 h-4 text-amber-400" /> Your shareable badge
          </div>
          <div className="text-[11px] text-white/50">
            1080×1080 — perfect for WhatsApp Status & Instagram Story.
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
          onClick={() => navigate(`/myrank/leaderboard?category=${encodeURIComponent(result.category || "ALL")}`)}
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
          {/* Memorable share link — your unique handle */}
          <div className="relative mt-2 rounded-xl border border-purple-400/30 bg-black/40 p-2.5 backdrop-blur">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="text-[9px] uppercase tracking-widest text-purple-300/70 font-bold">Your unique link</div>
                <div className="text-[12px] font-mono font-bold text-white truncate">
                  acry.ai/?ref=<span className="bg-gradient-to-r from-fuchsia-300 to-cyan-300 bg-clip-text text-transparent">{refCode}</span>
                </div>
              </div>
              <button
                onClick={handleCopyLink}
                className="shrink-0 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-fuchsia-500/30 to-cyan-500/30 border border-white/15 hover:from-fuchsia-500/50 hover:to-cyan-500/50 transition flex items-center gap-1 text-[10px] font-bold"
                aria-label="Copy unique link"
              >
                {copied === "link" ? (
                  <><Check className="w-3 h-3 text-emerald-400" /> Copied</>
                ) : (
                  <><Copy className="w-3 h-3 text-white/80" /> Copy</>
                )}
              </button>
            </div>
          </div>

          {/* PRIMARY INVITE CTA — actually triggers a share */}
          <button
            onClick={async () => {
              const inviteMsg =
                `🎯 *${userName} just got Rank #${result.rank.toLocaleString("en-IN")} on ACRY MyRank!*\n\n` +
                `🧠 ${result.ai_tag} · Top ${(100 - result.percentile).toFixed(1)}% in ${result.category}\n\n` +
                `Take the 60-sec AI Rank Test and see where YOU stand 👇\n` +
                `${shareUrl}\n\n` +
                `(Use my link so we both unlock rewards 🎁)`;
              try { await navigator.clipboard?.writeText(inviteMsg); } catch {}
              try {
                const res = await shareBadgeOneClick({
                  badge: {
                    rank: result.rank,
                    percentile: result.percentile,
                    category: result.category,
                    aiTag: result.ai_tag,
                    userName,
                  },
                  caption: inviteMsg,
                  shareUrl,
                  channel: "whatsapp",
                });
                await logShare("invite_whatsapp");
                if (res.mode === "native-files") {
                  toast({ title: "Invite sent! 🎉", description: "Friends who tap your link unlock rewards for both of you." });
                } else if (res.mode !== "cancelled") {
                  toast({ title: "WhatsApp opened 🚀", description: "Caption copied. Paste & send to your group." });
                }
              } catch {
                toast({ title: "Invite copied 📋", description: "Paste it anywhere to share your link.", variant: "default" });
              }
            }}
            className="relative w-full h-12 rounded-xl text-sm font-extrabold text-white shadow-[0_0_24px_-6px_rgba(236,72,153,0.7)] active:scale-[0.98] transition flex items-center justify-center gap-2 overflow-hidden"
            style={{ background: "linear-gradient(135deg, #a855f7 0%, #ec4899 50%, #f59e0b 100%)" }}
          >
            <Gift className="w-4 h-4" />
            Invite friends & earn rewards
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Claim CTAs when unlocked */}
          {(unlock?.unlocks.premium_test || unlock?.unlocks.ai_study_plan) && (
            <div className="relative grid grid-cols-1 gap-2">
              {unlock?.unlocks.premium_test && (
                <button
                  onClick={() => navigate("/app?tab=you")}
                  className="w-full h-10 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-emerald-500 to-teal-600 shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <Check className="w-3.5 h-3.5" />
                  Claim your Premium Test reward
                </button>
              )}
              {unlock?.unlocks.ai_study_plan && (
                <button
                  onClick={() => navigate("/app?tab=you")}
                  className="w-full h-10 rounded-xl text-[12px] font-bold text-white bg-gradient-to-r from-amber-500 to-orange-600 shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  Claim your AI Study Plan
                </button>
              )}
            </div>
          )}
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

const ChannelBtn = ({
  onClick, icon, label, color, primary,
}: { onClick: () => void; icon: React.ReactNode; label: string; color: string; primary?: boolean }) => (
  <button
    onClick={onClick}
    className={`group relative overflow-hidden rounded-xl py-2.5 flex flex-col items-center gap-1 border active:scale-[0.96] transition ${
      primary
        ? "border-emerald-400/30 shadow-[0_0_18px_-6px_rgba(37,211,102,0.5)]"
        : "border-white/10"
    }`}
    style={{ background: `linear-gradient(135deg, ${primary ? "rgba(37,211,102,0.18), rgba(18,140,126,0.12)" : "rgba(255,255,255,0.04), rgba(255,255,255,0.02)"})` }}
  >
    <div className={`w-7 h-7 rounded-lg bg-gradient-to-br ${color} flex items-center justify-center text-white shadow-md`}>
      {icon}
    </div>
    <span className="text-[9px] font-bold text-white/80 leading-tight">{label}</span>
  </button>
);

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

/* ===== Mini share-reward burst (after each share) ===== */
const ShareBoostBurst = ({ colors }: { colors: string[] }) => (
  <div className="fixed inset-0 pointer-events-none z-40 flex items-center justify-center">
    <div className="relative">
      <div
        className="absolute inset-0 rounded-full blur-2xl animate-ping"
        style={{ width: 240, height: 240, background: `radial-gradient(circle, ${colors[0]}cc, transparent 70%)`, animationDuration: "1.2s" }}
      />
      <div
        className="relative px-6 py-3 rounded-2xl bg-black/70 backdrop-blur-xl border border-white/20 text-center animate-[fade-in_0.3s_ease-out]"
        style={{ boxShadow: `0 0 40px ${colors[0]}80` }}
      >
        <div className="text-2xl mb-0.5">🚀</div>
        <div className="text-sm font-extrabold bg-gradient-to-r from-amber-300 to-pink-300 bg-clip-text text-transparent">
          Share counted!
        </div>
        <div className="text-[10px] text-white/70 mt-0.5">+1 toward unlocking AI analysis</div>
      </div>
    </div>
  </div>
);

export default MyRankResult;
