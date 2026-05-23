import { useEffect, useState } from "react";
import { Card, SectionTitle, T } from "./ui";
import type { AmbassadorProfile } from "../useAmbassador";
import { supabase } from "@/integrations/supabase/client";
import { Trophy, MapPin } from "lucide-react";

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
        const { data } = await supabase.rpc("get_ambassador_leaderboard" as any, { p_period: "weekly", p_limit: 20 });
        if (Array.isArray(data)) setRows(data as Row[]);
      } catch {}
      setLoading(false);
    })();
  }, []);

  const myCity = profile.city;
  const cityRows = rows.filter((r) => r.city === myCity);

  return (
    <div className="space-y-4">
      <Card glow={T.amber} className="p-5">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-[11px] uppercase tracking-wider" style={{ color: T.mute }}>
              Your rank
            </div>
            <div className="mt-0.5 text-3xl font-bold" style={{ color: T.text }}>
              #{profile.rank ?? "—"}
            </div>
          </div>
          <Trophy className="h-10 w-10" style={{ color: T.amber }} />
        </div>
      </Card>

      <SectionTitle title="This week's top 20" />
      {loading ? (
        <Card className="py-6 text-center text-sm" >
          <span style={{ color: T.mute }}>Loading…</span>
        </Card>
      ) : rows.length === 0 ? (
        <Card className="py-6 text-center text-sm">
          <span style={{ color: T.mute }}>Be the first on the board 🏆</span>
        </Card>
      ) : (
        <div className="space-y-2">
          {rows.map((r) => (
            <RankRow key={r.rank} row={r} isMe={r.display_name?.toLowerCase().startsWith(profile.full_name?.split(" ")[0]?.toLowerCase() || "")} />
          ))}
        </div>
      )}

      {myCity && cityRows.length > 0 && (
        <>
          <SectionTitle title={`Top in ${myCity}`} />
          <div className="space-y-2">
            {cityRows.slice(0, 5).map((r) => (
              <RankRow key={`c-${r.rank}`} row={r} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function RankRow({ row, isMe }: { row: Row; isMe?: boolean }) {
  const medal = row.rank === 1 ? "🥇" : row.rank === 2 ? "🥈" : row.rank === 3 ? "🥉" : null;
  return (
    <Card
      className="flex items-center justify-between py-3"
      glow={isMe ? T.purple : undefined}
    >
      <div className="flex items-center gap-3">
        <div
          className="grid h-9 w-9 place-items-center rounded-full text-sm font-bold"
          style={{
            background: row.rank <= 3 ? `${T.amber}22` : "rgba(255,255,255,0.06)",
            color: row.rank <= 3 ? T.amber : T.text,
          }}
        >
          {medal || row.rank}
        </div>
        <div>
          <div className="text-sm font-semibold" style={{ color: T.text }}>
            {row.display_name} {isMe && <span className="text-[10px]" style={{ color: T.purple }}>· You</span>}
          </div>
          <div className="flex items-center gap-1 text-[11px]" style={{ color: T.mute }}>
            {row.city && (
              <>
                <MapPin className="h-3 w-3" />
                {row.city}
              </>
            )}
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
