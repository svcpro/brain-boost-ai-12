import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { useNavigate } from "react-router-dom";
import { Trophy, ChevronRight, Sparkles, TrendingUp, Crown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

const MyRankRankCard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [position, setPosition] = useState<number | null>(null);
  const [hasRank, setHasRank] = useState(false);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const anonId = localStorage.getItem("myrank_anon_id");
        const { data } = await supabase.functions.invoke("myrank-engine", {
          body: {
            action: "leaderboard",
            category: "ALL",
            scope: "india",
            user_id: user?.id,
            anon_session_id: anonId,
          },
        });
        if (!active) return;
        const pos = (data as any)?.my_position ?? null;
        setPosition(pos);
        setHasRank(!!pos);
      } catch {
        /* silent */
      } finally {
        if (active) setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [user?.id]);

  return (
    <motion.button
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate("/myrank")}
      className="group relative w-full overflow-hidden rounded-3xl p-[2px] text-left isolate"
      style={{ background: "#0a0b1a" }}
    >
      {/* Spinning conic-gradient border */}
      <span
        aria-hidden
        className="absolute -inset-[60%] z-0 pointer-events-none"
        style={{
          background:
            "conic-gradient(from 0deg, #f59e0b, #ec4899, #06b6d4, #10b981, #f59e0b)",
          animation: "myrank-yt-rotate 4s linear infinite",
        }}
      />

      <div
        className="relative z-10 rounded-[22px] p-5 overflow-hidden"
        style={{
          background:
            "radial-gradient(ellipse at top left, rgba(236,72,153,0.18), transparent 55%), radial-gradient(ellipse at bottom right, rgba(6,182,212,0.18), transparent 55%), linear-gradient(135deg, #0b0c1f 0%, #0a0b1a 100%)",
        }}
      >
        {/* Animated sweeping beam */}
        <span
          aria-hidden
          className="absolute top-0 bottom-0 w-[2px] pointer-events-none"
          style={{
            background:
              "linear-gradient(180deg, transparent, rgba(252,211,77,0.95), transparent)",
            boxShadow:
              "0 0 16px rgba(252,211,77,0.9), 0 0 32px rgba(252,211,77,0.5)",
            animation: "myrank-yt-beam 3.5s linear infinite",
          }}
        />

        {/* Floating sparkles */}
        {[
          { top: "12%", left: "20%", delay: "0s" },
          { top: "28%", right: "18%", delay: "0.8s" },
          { bottom: "20%", left: "32%", delay: "1.6s" },
        ].map((s, i) => (
          <span
            key={i}
            aria-hidden
            className="absolute w-1 h-1 rounded-full bg-white/80 pointer-events-none"
            style={{
              ...s,
              boxShadow: "0 0 8px rgba(255,255,255,0.9)",
              animation: `myrank-yt-twinkle 2.4s ease-in-out infinite`,
              animationDelay: s.delay,
            }}
          />
        ))}

        <div className="relative flex items-center gap-4">
          {/* Rank badge / trophy */}
          <motion.div
            animate={{ rotate: [0, -6, 6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="relative w-16 h-16 rounded-2xl flex items-center justify-center shrink-0"
            style={{
              background:
                "linear-gradient(135deg, rgba(252,211,77,0.2), rgba(236,72,153,0.15))",
              border: "1.5px solid rgba(252,211,77,0.45)",
              boxShadow:
                "0 0 24px rgba(252,211,77,0.35), inset 0 0 20px rgba(252,211,77,0.15)",
            }}
          >
            <Trophy className="w-8 h-8 text-amber-300" />
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-gradient-to-br from-yellow-300 to-amber-600 border-[1.5px] border-white text-[9px] font-black text-white flex items-center justify-center shadow-lg">
              <Crown className="w-3 h-3" />
            </span>
          </motion.div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 mb-1">
              <Sparkles className="w-3 h-3 text-fuchsia-300" />
              <span className="text-[9px] font-bold uppercase tracking-widest bg-gradient-to-r from-fuchsia-300 via-amber-200 to-cyan-300 bg-clip-text text-transparent">
                MyRank Leaderboard
              </span>
            </div>

            {loading ? (
              <div className="space-y-1.5">
                <div className="h-6 w-32 rounded-md bg-white/10 animate-pulse" />
                <div className="h-3 w-44 rounded-md bg-white/5 animate-pulse" />
              </div>
            ) : hasRank && position ? (
              <>
                <div className="flex items-baseline gap-2">
                  <span className="text-[11px] font-bold text-white/60">#</span>
                  <motion.span
                    initial={{ scale: 0.6, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 220, delay: 0.15 }}
                    className="text-3xl font-black tabular-nums tracking-tight bg-gradient-to-br from-amber-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent"
                    style={{
                      filter: "drop-shadow(0 0 12px rgba(252,211,77,0.4))",
                    }}
                  >
                    {position.toLocaleString()}
                  </motion.span>
                </div>
                <div className="flex items-center gap-1.5 mt-1">
                  <TrendingUp className="w-3 h-3 text-emerald-300" />
                  <span className="text-[10px] text-white/70 font-medium">
                    Your rank in India · Tap to climb higher
                  </span>
                </div>
              </>
            ) : (
              <>
                <p className="text-base font-extrabold leading-tight bg-gradient-to-r from-amber-200 via-pink-200 to-cyan-200 bg-clip-text text-transparent">
                  Get Your India Rank
                </p>
                <p className="text-[10px] text-white/70 mt-1">
                  Take a 60-second AI test to discover your rank
                </p>
              </>
            )}
          </div>

          <motion.div
            animate={{ x: [0, 5, 0] }}
            transition={{ duration: 1.4, repeat: Infinity }}
            className="shrink-0"
          >
            <ChevronRight className="w-5 h-5 text-white/70 group-hover:text-white transition" />
          </motion.div>
        </div>

        {/* Bottom shimmer line */}
        <span
          aria-hidden
          className="absolute left-0 right-0 bottom-0 h-[2px] pointer-events-none"
          style={{
            background:
              "linear-gradient(90deg, transparent, #f59e0b, #ec4899, #06b6d4, #10b981, transparent)",
            backgroundSize: "200% 100%",
            animation: "myrank-yt-shimmer 3s linear infinite",
          }}
        />
      </div>

      <style>{`
        @keyframes myrank-yt-beam { 0% { left: -2px; } 100% { left: 100%; } }
        @keyframes myrank-yt-shimmer { 0% { background-position: 0% 0%; } 100% { background-position: 200% 0%; } }
        @keyframes myrank-yt-rotate { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        @keyframes myrank-yt-twinkle { 0%, 100% { opacity: 0.2; transform: scale(0.7); } 50% { opacity: 1; transform: scale(1.3); } }
      `}</style>
    </motion.button>
  );
};

export default MyRankRankCard;
