import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Users, X, RefreshCw, TrendingUp, TrendingDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

interface PeerStat {
  display_name: string;
  weekly_hours: number;
  topic_count: number;
}

interface CompetitionIntelProps {
  onClose: () => void;
}

const CompetitionIntel = ({ onClose }: CompetitionIntelProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [peers, setPeers] = useState<PeerStat[]>([]);
  const [myStats, setMyStats] = useState<{ hours: number; topics: number; rank: number }>({ hours: 0, topics: 0, rank: 0 });

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("leaderboard", {
        body: { type: "weekly" },
      });
      if (!error && data?.leaderboard) {
        const lb = data.leaderboard as any[];
        const peerStats: PeerStat[] = lb.slice(0, 10).map((p: any) => ({
          display_name: p.display_name || "Anonymous",
          weekly_hours: Math.round((p.weekly_minutes || 0) / 60 * 10) / 10,
          topic_count: p.topic_count || 0,
        }));
        setPeers(peerStats);

        const myIndex = lb.findIndex((p: any) => p.user_id === user.id);
        const me = myIndex >= 0 ? lb[myIndex] : null;
        setMyStats({
          hours: me ? Math.round((me.weekly_minutes || 0) / 60 * 10) / 10 : 0,
          topics: me?.topic_count || 0,
          rank: myIndex >= 0 ? myIndex + 1 : lb.length + 1,
        });
      }
    } catch {
      // silent fail
    }
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const avgHours = peers.length > 0 ? Math.round(peers.reduce((s, p) => s + p.weekly_hours, 0) / peers.length * 10) / 10 : 0;
  const ahead = myStats.hours > avgHours;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Competition Intel</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-5 h-5 text-primary animate-spin" />
          </div>
        ) : (
          <>
            {/* Your Position */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold gradient-text">#{myStats.rank}</p>
                <p className="text-[10px] text-muted-foreground">Your Rank</p>
              </div>
              <div className="glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold text-foreground">{myStats.hours}h</p>
                <p className="text-[10px] text-muted-foreground">This Week</p>
              </div>
              <div className="glass rounded-xl p-3 neural-border text-center">
                <div className="flex items-center justify-center gap-1">
                  {ahead ? <TrendingUp className="w-4 h-4 text-success" /> : <TrendingDown className="w-4 h-4 text-destructive" />}
                  <p className={`text-lg font-bold ${ahead ? "text-success" : "text-destructive"}`}>
                    {ahead ? "+" : ""}{Math.round((myStats.hours - avgHours) * 10) / 10}h
                  </p>
                </div>
                <p className="text-[10px] text-muted-foreground">vs Average</p>
              </div>
            </div>

            {/* Peer Leaderboard */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Top Peers This Week</p>
              {peers.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">No peer data available yet.</p>
              ) : (
                peers.map((p, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/20 border border-border/50">
                    <span className={`text-xs font-bold w-6 text-center ${i < 3 ? "text-primary" : "text-muted-foreground"}`}>
                      {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i + 1}`}
                    </span>
                    <span className="flex-1 text-sm text-foreground truncate">{p.display_name}</span>
                    <span className="text-xs text-muted-foreground">{p.weekly_hours}h</span>
                    <span className="text-[10px] text-muted-foreground">{p.topic_count} topics</span>
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default CompetitionIntel;
