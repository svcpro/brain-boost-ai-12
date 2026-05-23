import { useEffect, useState } from "react";
import { Card, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { supabase } from "/integrations/supabase/client";
import { Trophy, Medal, Crown } from "lucide-react";

type Row = {
  rank: number;
  display_name: string;
  college: string | null;
  city: string | null;
  xp: number;
};

export function SimpleLeaderboard({ profile }: { profile: AmbassadorProfile }) {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const { data } = await supabase.rpc("get_ambassador_leaderboard" as any, { p_period: "weekly", p_limit: 10 });
        if (Array.isArray(data)) setRows(data as Row[]);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const myCity = profile.city;
  const cityRows = rows.filter((r) => r.city === myCity);
  const myRow = rows.find((r) =>
    r.display_name?.toLowerCase().startsWith(profile.full_name?.split(" ")[1]?.toLowerCase() || "")
  );
  const myRank = myRow?.rank ?? profile.rank ?? null;

  return (
    <div className="space-y-4">
      {/* Your Rank */}
      <Card glow={T.amber} className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
              Your rank this week
            </div>
            <div className="mt-1 text-4xl font-bold" style={{ color: T.text }}>
              {myRank ? `#${myRank}` : "—"}
            </div>
            <div className="mt-1 text-xs" style={{ color: T.mute }}>
              {profile.weekly_xp?.toLocaleString() ?? 0} XP earned
            </div>
          </div>
          <div className="grid h-14 w-14 place-items-center rounded-full" style={{ background: `${T.amber}22` }}>
            <Crown className="h-7 w-7" style={{ color: T.amber }} />
          </div>
        </div>
      </Card>

      {/* Top Ambassadors */}
      <div>
        <h3 className="mb-3 text-sm font-semibold" style={{ color: T.text }}>
          Top Ambassadors
        </h3>
        {loading ? (
          <Card className="py-6 text-center text-sm">
            <span style={{ color: T.mute }}>Loading…</span>
          </Card>
        ) : rows.length === 0 ? (
          <Card className="py-6 text-center text-sm">
            <span style={{ color: T.mute }}>Be the first on the board</span>
          </Card>
        ) : (
          <div className="space-y-2">
            {rows.map((r) => (
              <RankRow key={r.rank} row={r} isMe={r.display_name?.toLowerCase().startsWith(profile.full_name?.split(" ")[0]?.toLowerCase() || "")} />
            ))}
          </div>
        )}
      </div>

      {/* City Rank */}
      {myCity && cityRows.length > 0 && (
        <div>
          <h3 className="mb-3 text-sm font-semibold" style={{ color: T.text }}>
            Top in {myCity}
          </h3>
          <div className="space-y-2">
            {cityRows.slice(0, 5).map((r) => (
              <RankRow key={`c-${r.rank}`} row={r} isMe={r.display_name?.toLowerCase().startsWith(profile.full_name?.split(" ")[0]?.toLowerCase() || "")} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function RankRow({ row, isMe }: { row: Row; isMe?: boolean }) {
  const isTop3 = row.rank <= 3;
  const icon = row.rank === 1 ? <Crown className="h-4 w-4" /> : row.rank === 2 ? <Medal className="h-4 w-4" /> : row.rank === 3 ? <Medal className="h-4 w-4" /> : null;

  return (
    <Card
      className="flex items-center justify-between py-3"
      glow={isMe ? T.purple : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold"
          style={{
            background: isTop3 ? `${T.amber}22` : "rgba(255,255,255,0.06)",
            color: isTop3 ? T.amber : T.text,
          }}
        >
          {icon || row.rank}
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: T.text }}>
            {row.display_name}
            {isMe && (
              <span className="ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: `${T.purple}22`, color: T.purple }}>
                You
              </span>
            )}
          </div>
          <div className="text-[11px]" style={{ color: T.mute }}>
            {row.college || row.city || "—"}
          </div>
        </div>
      </div>
      <div className="text-right">
        <div className="text-sm font-bold" style={{ color: T.cyan }}>
          {row.xp.toLocaleString()}
        </div>
        <div className="text-[10px]" style={{ color: T.mute }}>
          XP
        </div>
      </div>
    </Card>
  );
}
