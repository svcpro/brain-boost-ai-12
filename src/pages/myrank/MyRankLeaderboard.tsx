import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Trophy, ArrowLeft, Crown, MapPin, Calendar, Globe } from "lucide-react";

const CATEGORIES = ["ALL", "UPSC", "SSC", "JEE", "NEET", "IQ"];
const SCOPES: { key: string; label: string; icon: typeof Globe }[] = [
  { key: "india", label: "India", icon: Globe },
  { key: "weekly", label: "This week", icon: Calendar },
  { key: "city", label: "My city", icon: MapPin },
];

interface Row {
  position: number;
  name: string;
  category: string;
  score: number;
  percentile: number;
  rank: number;
  ai_tag: string;
  city: string | null;
  is_me: boolean;
}

const MyRankLeaderboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [category, setCategory] = useState("ALL");
  const [scope, setScope] = useState<"india" | "weekly" | "city">("india");
  const [rows, setRows] = useState<Row[]>([]);
  const [myPos, setMyPos] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const anonId = localStorage.getItem("myrank_anon_id");
    setLoading(true);
    supabase.functions.invoke("myrank-engine", {
      body: {
        action: "leaderboard",
        category,
        scope,
        user_id: user?.id || null,
        anon_session_id: anonId,
      },
    }).then(({ data }) => {
      setRows((data as any)?.leaderboard || []);
      setMyPos((data as any)?.my_position || null);
      setLoading(false);
    });
  }, [category, scope, user?.id]);

  const medal = (pos: number) => pos === 1 ? "🥇" : pos === 2 ? "🥈" : pos === 3 ? "🥉" : `#${pos}`;

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-md mx-auto px-4 py-6 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/myrank")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <h1 className="text-xl font-bold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" /> Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground">Top 100 across India</p>
          </div>
        </div>

        {/* Scope tabs */}
        <div className="grid grid-cols-3 gap-2">
          {SCOPES.map(s => {
            const Icon = s.icon;
            return (
              <button
                key={s.key}
                onClick={() => setScope(s.key as any)}
                className={`flex flex-col items-center gap-1 p-2 rounded-xl text-xs font-semibold transition-all ${
                  scope === s.key
                    ? "bg-primary text-primary-foreground shadow"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className="w-4 h-4" />
                {s.label}
              </button>
            );
          })}
        </div>

        {/* Category chips */}
        <div className="flex gap-2 overflow-x-auto pb-2 -mx-1 px-1">
          {CATEGORIES.map(c => (
            <button
              key={c}
              onClick={() => setCategory(c)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all ${
                category === c
                  ? "bg-foreground text-background"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        {/* My position */}
        {myPos && myPos > 100 && (
          <Card className="p-3 bg-primary/5 border-primary/30 text-sm flex justify-between items-center">
            <span className="text-muted-foreground">Your position:</span>
            <span className="font-bold text-primary">#{myPos.toLocaleString("en-IN")}</span>
          </Card>
        )}

        {/* Leaderboard list */}
        {loading ? (
          <div className="text-center py-12 text-sm text-muted-foreground">Loading…</div>
        ) : rows.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">
            No rankings yet. Be the first to take this test!
          </Card>
        ) : (
          <div className="space-y-1.5">
            {rows.map(r => (
              <Card
                key={`${r.position}-${r.name}`}
                className={`p-3 flex items-center gap-3 ${
                  r.is_me ? "ring-2 ring-primary bg-primary/5" : ""
                } ${r.position <= 3 ? "bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-950/20 dark:to-orange-950/20" : ""}`}
              >
                <div className="w-10 text-center text-lg font-bold">
                  {r.position <= 3 ? medal(r.position) : <span className="text-sm text-muted-foreground">#{r.position}</span>}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate flex items-center gap-1">
                    {r.name}
                    {r.is_me && <span className="text-[10px] bg-primary text-primary-foreground px-1.5 py-0.5 rounded">YOU</span>}
                    {r.position === 1 && <Crown className="w-3 h-3 text-yellow-500" />}
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate">
                    {r.category} · {r.ai_tag}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-sm font-bold tabular-nums">{r.percentile}%</div>
                  <div className="text-[10px] text-muted-foreground">percentile</div>
                </div>
              </Card>
            ))}
          </div>
        )}

        <Button onClick={() => navigate("/myrank")} className="w-full" variant="outline">
          Take a test to climb
        </Button>
      </div>
    </div>
  );
};

export default MyRankLeaderboard;
