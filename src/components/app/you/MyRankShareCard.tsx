import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Share2, Trophy, Sparkles, MessageCircle, Send, Instagram,
  Loader2, CheckCircle2, Crown, Flame, Zap, Users,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { shareBadgeOneClick } from "@/lib/shareBadge";

interface LatestRank {
  rank: number;
  percentile: number;
  ai_tag: string;
  category: string;
}

const SHARE_URL = "https://acry.ai/myrank";

const buildCaption = (r: LatestRank, name: string) =>
  `🏆 *I just got ranked on ACRY MyRank!*

🇮🇳 All-India Rank: *#${r.rank.toLocaleString("en-IN")}*
🎯 Category: ${r.category}
📊 Percentile: *${r.percentile}%* (Top ${Math.max(1, 100 - Math.round(r.percentile))}%)
🧠 AI Tag: _${r.ai_tag}_
━━━━━━━━━━━━━━━━━
Think you can beat ${name}?
👉 Take the 60-sec AI test: ${SHARE_URL}`;

const MyRankShareCard = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [latest, setLatest] = useState<LatestRank | null>(null);
  const [loading, setLoading] = useState(true);
  const [sharing, setSharing] = useState<string | null>(null);
  const [pulse, setPulse] = useState(true);

  // Soft attention pulse — runs for 6s every 18s to draw eye without being annoying
  useEffect(() => {
    const id = setInterval(() => {
      setPulse(p => !p);
    }, 6000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        if (!user?.id) {
          // Try anonymous test
          const anonId = localStorage.getItem("myrank_anon_id");
          if (!anonId) { setLoading(false); return; }
          const { data } = await supabase
            .from("myrank_tests")
            .select("rank, percentile, ai_tag, category")
            .eq("anon_session_id", anonId)
            .not("rank", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (active && data) setLatest(data as LatestRank);
        } else {
          const { data } = await supabase
            .from("myrank_tests")
            .select("rank, percentile, ai_tag, category")
            .eq("user_id", user.id)
            .not("rank", "is", null)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (active && data) setLatest(data as LatestRank);
        }
      } catch { /* silent */ }
      finally { if (active) setLoading(false); }
    })();
    return () => { active = false; };
  }, [user?.id]);

  const userName = (user?.user_metadata?.display_name as string)
    || user?.email?.split("@")[0]
    || "Champion";

  const handleShare = async (channel: "whatsapp" | "instagram" | "telegram" | "native") => {
    if (!latest) return;
    setSharing(channel);
    try {
      const caption = buildCaption(latest, userName);
      const result = await shareBadgeOneClick({
        badge: {
          rank: latest.rank,
          percentile: latest.percentile,
          category: latest.category,
          aiTag: latest.ai_tag,
          userName,
        },
        caption,
        shareUrl: SHARE_URL,
        channel,
      });

      // Log to backend
      try {
        const anonId = localStorage.getItem("myrank_anon_id");
        await supabase.functions.invoke("myrank-engine", {
          body: {
            action: "log_share",
            channel,
            user_id: user?.id,
            anon_session_id: anonId,
          },
        });
      } catch { /* non-fatal */ }

      if (result.mode === "native-files") {
        toast({ title: "Shared! 🎉", description: "Your rank is out there crushing it." });
      } else if (result.mode === "cancelled") {
        // silent
      } else {
        toast({
          title: channel === "instagram" ? "Caption copied 📋" : "Opening… 🚀",
          description: result.message || "Paste your caption to share.",
        });
      }
    } catch (e: any) {
      toast({
        title: "Share failed",
        description: e?.message || "Try a different channel",
        variant: "destructive",
      });
    } finally {
      setSharing(null);
    }
  };

  // Loading skeleton
  if (loading) {
    return (
      <div className="w-full rounded-3xl p-5 glass neural-border">
        <div className="h-6 w-40 bg-white/10 rounded-md animate-pulse mb-3" />
        <div className="h-20 w-full bg-white/5 rounded-2xl animate-pulse" />
      </div>
    );
  }

  // No rank yet → friendly CTA
  if (!latest) {
    return (
      <motion.button
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        whileTap={{ scale: 0.98 }}
        onClick={() => window.dispatchEvent(new CustomEvent("switch-dashboard-tab", { detail: "myrank" }))}
        className="w-full rounded-3xl p-5 text-left relative overflow-hidden"
        style={{
          background: "linear-gradient(135deg, rgba(236,72,153,0.15), rgba(168,85,247,0.12), rgba(6,182,212,0.15))",
          border: "1px solid rgba(236,72,153,0.3)",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-fuchsia-500/30 to-cyan-500/30 flex items-center justify-center">
            <Share2 className="w-6 h-6 text-fuchsia-300" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-extrabold text-foreground">Unlock your shareable rank</p>
            <p className="text-[11px] text-muted-foreground mt-0.5">Take the 60-sec AI test → flex on socials</p>
          </div>
        </div>
      </motion.button>
    );
  }

  const tier = latest.percentile >= 99 ? "legendary"
    : latest.percentile >= 90 ? "elite"
    : latest.percentile >= 70 ? "great" : "good";

  const tierConfig = {
    legendary: { icon: Crown, gradient: "from-amber-400 via-orange-500 to-red-500", glow: "rgba(252,211,77,0.5)", label: "LEGENDARY" },
    elite: { icon: Trophy, gradient: "from-purple-500 via-fuchsia-500 to-pink-500", glow: "rgba(217,70,239,0.5)", label: "ELITE" },
    great: { icon: Zap, gradient: "from-blue-500 via-cyan-500 to-sky-500", glow: "rgba(6,182,212,0.5)", label: "GREAT" },
    good: { icon: Flame, gradient: "from-emerald-500 via-green-500 to-teal-500", glow: "rgba(16,185,129,0.5)", label: "RISING" },
  }[tier];
  const TierIcon = tierConfig.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full rounded-3xl p-[2px] relative overflow-hidden isolate"
      style={{ background: "#0a0b1a" }}
    >
      {/* Spinning conic gradient border for ULTRA attention */}
      <span
        aria-hidden
        className="absolute -inset-[60%] z-0 pointer-events-none"
        style={{
          background: `conic-gradient(from 0deg, ${tierConfig.glow}, #ec4899, #06b6d4, #f59e0b, ${tierConfig.glow})`,
          animation: "share-card-rotate 5s linear infinite",
          opacity: 0.95,
        }}
      />

      <div
        className="relative z-10 rounded-[22px] p-5 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at top right, rgba(236,72,153,0.18), transparent 55%), radial-gradient(ellipse at bottom left, rgba(6,182,212,0.18), transparent 55%), linear-gradient(135deg, #0b0c1f 0%, #0a0b1a 100%)",
        }}
      >
        {/* Floating sparkles */}
        {[
          { top: "14%", left: "12%", delay: "0s" },
          { top: "60%", right: "10%", delay: "0.7s" },
          { bottom: "18%", left: "40%", delay: "1.4s" },
          { top: "30%", right: "30%", delay: "2.1s" },
        ].map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute w-1 h-1 rounded-full bg-white/80 pointer-events-none"
            style={{
              ...s,
              boxShadow: "0 0 10px rgba(255,255,255,0.95)",
              animation: "share-twinkle 2.4s ease-in-out infinite",
              animationDelay: s.delay,
            }}
          />
        ))}

        {/* Header */}
        <div className="flex items-center justify-between mb-4 relative">
          <div className="flex items-center gap-2">
            <Sparkles className="w-3.5 h-3.5 text-fuchsia-300" />
            <span className="text-[10px] font-black uppercase tracking-[0.2em] bg-gradient-to-r from-fuchsia-300 via-amber-200 to-cyan-300 bg-clip-text text-transparent">
              Share Your Rank
            </span>
          </div>
          <AnimatePresence>
            {pulse && (
              <motion.div
                initial={{ opacity: 0, scale: 0.7 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.7 }}
                className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 border border-red-400/40"
              >
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
                <span className="text-[9px] font-bold text-red-200 uppercase tracking-wider">Live Flex</span>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Rank showcase */}
        <div className="flex items-center gap-4 mb-4 relative">
          <motion.div
            animate={{ rotate: [0, -5, 5, 0], scale: [1, 1.05, 1] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className={`w-16 h-16 rounded-2xl bg-gradient-to-br ${tierConfig.gradient} flex items-center justify-center shrink-0 shadow-lg`}
            style={{ boxShadow: `0 0 28px ${tierConfig.glow}` }}
          >
            <TierIcon className="w-8 h-8 text-white drop-shadow-lg" />
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1.5">
              <span className="text-xs font-bold text-white/50">#</span>
              <span
                className={`text-3xl font-black tabular-nums tracking-tight bg-gradient-to-br ${tierConfig.gradient} bg-clip-text text-transparent`}
                style={{ filter: `drop-shadow(0 0 12px ${tierConfig.glow})` }}
              >
                {latest.rank.toLocaleString("en-IN")}
              </span>
              <span className="text-[10px] font-bold text-white/60 uppercase tracking-wider">India</span>
            </div>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-[9px] font-black px-1.5 py-0.5 rounded bg-gradient-to-r ${tierConfig.gradient} text-white`}>
                {tierConfig.label}
              </span>
              <span className="text-[10px] text-white/70 font-semibold">
                Top {Math.max(1, 100 - Math.round(latest.percentile))}% · {latest.category}
              </span>
            </div>
          </div>
        </div>

        {/* Social proof / urgency */}
        <div className="flex items-center gap-1.5 mb-3 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/10">
          <Users className="w-3 h-3 text-cyan-300" />
          <span className="text-[10px] text-white/70">
            <span className="font-bold text-white/90">2,847 students</span> shared their rank today · Be the next 🚀
          </span>
        </div>

        {/* Share buttons */}
        <div className="grid grid-cols-4 gap-2 relative">
          <ShareButton
            icon={MessageCircle}
            label="WhatsApp"
            color="bg-emerald-500"
            loading={sharing === "whatsapp"}
            onClick={() => handleShare("whatsapp")}
            highlight
          />
          <ShareButton
            icon={Instagram}
            label="Instagram"
            color="bg-gradient-to-br from-fuchsia-500 via-pink-500 to-orange-400"
            loading={sharing === "instagram"}
            onClick={() => handleShare("instagram")}
          />
          <ShareButton
            icon={Send}
            label="Telegram"
            color="bg-sky-500"
            loading={sharing === "telegram"}
            onClick={() => handleShare("telegram")}
          />
          <ShareButton
            icon={Share2}
            label="More"
            color="bg-white/10"
            loading={sharing === "native"}
            onClick={() => handleShare("native")}
          />
        </div>

        {/* Bottom shimmer line */}
        <span
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-[2px] pointer-events-none"
          style={{
            background: "linear-gradient(90deg, transparent, #f59e0b, #ec4899, #06b6d4, #10b981, transparent)",
            backgroundSize: "200% 100%",
            animation: "share-shimmer 3s linear infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes share-card-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes share-shimmer { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
        @keyframes share-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.3); } }
        @keyframes share-btn-pulse { 0%, 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0.5); } 50% { box-shadow: 0 0 0 8px rgba(16,185,129,0); } }
      `}</style>
    </motion.div>
  );
};

interface ShareButtonProps {
  icon: any;
  label: string;
  color: string;
  loading?: boolean;
  highlight?: boolean;
  onClick: () => void;
}

const ShareButton = ({ icon: Icon, label, color, loading, highlight, onClick }: ShareButtonProps) => (
  <motion.button
    whileTap={{ scale: 0.92 }}
    whileHover={{ scale: 1.05 }}
    onClick={onClick}
    disabled={loading}
    className="flex flex-col items-center gap-1 py-2.5 rounded-xl bg-white/[0.04] hover:bg-white/[0.08] border border-white/10 transition-all disabled:opacity-60 relative"
    style={highlight ? { animation: "share-btn-pulse 2s ease-in-out infinite" } : undefined}
  >
    <div className={`w-8 h-8 rounded-lg ${color} flex items-center justify-center shadow-md`}>
      {loading ? (
        <Loader2 className="w-4 h-4 text-white animate-spin" />
      ) : (
        <Icon className="w-4 h-4 text-white" />
      )}
    </div>
    <span className="text-[9px] font-bold text-white/80">{label}</span>
    {highlight && (
      <CheckCircle2 className="absolute top-1 right-1 w-2.5 h-2.5 text-emerald-300" />
    )}
  </motion.button>
);

export default MyRankShareCard;
