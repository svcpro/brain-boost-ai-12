import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Trophy, Crown, Medal, TrendingUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { AmbCard, AMB } from "./ui/primitives";
import type { AmbassadorProfile } from "./useAmbassador";

type Row = {
  rank: number;
  ambassador_id: string;
  display_name: string;
  college: string | null;
  city: string | null;
  avatar_url: string | null;
  ai_level: string;
  xp: number;
  weekly_xp: number;
  monthly_xp: number;
  badge_count: number;
  public_slug: string | null;
};

type Period = "all" | "monthly" | "weekly";

export function LeaderboardSection({ profile }: { profile: AmbassadorProfile }) {
  const [period, setPeriod] = useState<Period>("all");
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    supabase.rpc("get_ambassador_leaderboard" as any, { p_period: period, p_limit: 50 }).then(({ data }) => {
      if (!alive) return;
      setRows((data as any) ?? []);
      setLoading(false);
    });
    return () => { alive = false; };
  }, [period]);

  const me = rows.find((r) => r.ambassador_id === profile.id);
  const xpKey = period === "weekly" ? "weekly_xp" : period === "monthly" ? "monthly_xp" : "xp";

  return (
    <div className="space-y-5">
      {/* Period toggle */}
      <div className="flex items-center gap-2">
        {(["weekly", "monthly", "all"] as Period[]).map((p) => (
          <button
            key={p}
            onClick={() => setPeriod(p)}
            className="rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition-all"
            style={{
              borderColor: period === p ? AMB.cyan : AMB.border,
              color: period === p ? AMB.cyan : AMB.mute,
              background: period === p ? `${AMB.cyan}14` : "rgba(255,255,255,0.02)",
            }}
          >
            {p === "all" ? "All time" : p}
          </button>
        ))}
      </div>

      {/* My rank card */}
      {me && (
        <AmbCard className="p-5" glow={AMB.cyan}>
          <div className="flex items-center gap-4">
            <div
              className="grid h-12 w-12 place-items-center rounded-2xl text-lg font-black"
              style={{ background: `linear-gradient(135deg, ${AMB.purple}, ${AMB.cyan})`, color: "#fff" }}
            >
              #{me.rank}
            </div>
            <div className="flex-1">
              <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.cyan }}>Your position</div>
              <div className="text-lg font-bold" style={{ color: AMB.text }}>{me.display_name}</div>
              <div className="text-xs" style={{ color: AMB.mute }}>{me.college ?? "—"}</div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-black" style={{ color: AMB.cyan }}>{(me as any)[xpKey]?.toLocaleString() ?? 0}</div>
              <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>XP</div>
            </div>
          </div>
        </AmbCard>
      )}

      {/* Top 3 podium */}
      {!loading && rows.length >= 3 && (
        <div className="grid grid-cols-3 gap-3">
          {[rows[1], rows[0], rows[2]].map((r, i) => {
            const positions = [
              { rank: 2, color: "#cbd5e1", icon: <Medal className="h-5 w-5" />, h: 90 },
              { rank: 1, color: AMB.amber, icon: <Crown className="h-6 w-6" />, h: 120 },
              { rank: 3, color: "#fb923c", icon: <Medal className="h-5 w-5" />, h: 70 },
            ][i];
            return (
              <motion.div
                key={r.ambassador_id}
                initial={{ y: 30, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: i * 0.15 }}
                className="flex flex-col items-center"
              >
                <Avatar url={r.avatar_url} name={r.display_name} color={positions.color} />
                <div className="mt-2 text-center text-xs font-bold" style={{ color: AMB.text }}>{r.display_name}</div>
                <div className="text-[10px]" style={{ color: AMB.mute }}>{(r as any)[xpKey]?.toLocaleString()} XP</div>
                <div
                  className="mt-2 flex w-full items-center justify-center rounded-t-lg"
                  style={{
                    height: positions.h,
                    background: `linear-gradient(180deg, ${positions.color}40, ${positions.color}10)`,
                    border: `1px solid ${positions.color}40`,
                    color: positions.color,
                  }}
                >
                  <div className="flex flex-col items-center">
                    {positions.icon}
                    <div className="mt-1 text-xl font-black">#{r.rank}</div>
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* List */}
      <AmbCard className="overflow-hidden">
        {loading ? (
          <div className="grid place-items-center py-12"><Loader2 className="h-6 w-6 animate-spin" style={{ color: AMB.cyan }} /></div>
        ) : rows.length === 0 ? (
          <div className="p-10 text-center text-sm" style={{ color: AMB.mute }}>No ambassadors yet — be the first!</div>
        ) : (
          <div>
            {rows.map((r, i) => {
              const isMe = r.ambassador_id === profile.id;
              return (
                <motion.div
                  key={r.ambassador_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: Math.min(i * 0.02, 0.4) }}
                  className="flex items-center gap-3 border-b px-4 py-3 last:border-0"
                  style={{
                    borderColor: AMB.border,
                    background: isMe ? `linear-gradient(90deg, ${AMB.cyan}14, transparent)` : "transparent",
                  }}
                >
                  <div className="w-8 text-center text-sm font-bold" style={{ color: r.rank <= 3 ? AMB.amber : AMB.mute }}>
                    {r.rank <= 3 ? "🏆" : `#${r.rank}`}
                  </div>
                  <Avatar url={r.avatar_url} name={r.display_name} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold" style={{ color: AMB.text }}>
                      {r.display_name} {isMe && <span style={{ color: AMB.cyan }}>· You</span>}
                    </div>
                    <div className="truncate text-[11px]" style={{ color: AMB.mute }}>{r.college ?? "—"}{r.city ? ` · ${r.city}` : ""}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-bold" style={{ color: AMB.cyan }}>{(r as any)[xpKey]?.toLocaleString() ?? 0}</div>
                    <div className="text-[10px] uppercase tracking-wider" style={{ color: AMB.mute }}>{r.ai_level}</div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </AmbCard>

      <div className="flex items-center justify-center gap-2 text-xs" style={{ color: AMB.mute }}>
        <TrendingUp className="h-3 w-3" />
        Rankings update live · Names masked for privacy
      </div>
    </div>
  );
}

function Avatar({ url, name, size = 48, color = AMB.purple }: { url: string | null; name: string; size?: number; color?: string }) {
  const initials = name.split(" ").map((p) => p[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center rounded-full font-bold text-white"
      style={{
        width: size, height: size,
        background: url ? `url(${url}) center/cover` : `linear-gradient(135deg, ${color}, ${AMB.cyan})`,
        border: `2px solid ${color}40`,
        fontSize: size * 0.36,
      }}
    >
      {!url && initials}
    </div>
  );
}
