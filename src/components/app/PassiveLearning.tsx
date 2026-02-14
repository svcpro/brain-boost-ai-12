import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Clock, X, Activity, CheckCircle2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format, subDays, differenceInMinutes } from "date-fns";

interface DailyPattern {
  hour: number;
  sessions: number;
  avgMinutes: number;
}

interface PassiveLearningProps {
  onClose: () => void;
}

const PassiveLearning = ({ onClose }: PassiveLearningProps) => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [patterns, setPatterns] = useState<DailyPattern[]>([]);
  const [totalAutoLogged, setTotalAutoLogged] = useState(0);
  const [peakHour, setPeakHour] = useState<number | null>(null);
  const [avgSessionLength, setAvgSessionLength] = useState(0);

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      setLoading(true);
      const since = subDays(new Date(), 30).toISOString();
      const { data: logs } = await supabase
        .from("study_logs")
        .select("created_at, duration_minutes")
        .eq("user_id", user.id)
        .gte("created_at", since);

      if (logs && logs.length > 0) {
        // Analyze hourly patterns
        const hourMap = new Map<number, { count: number; totalMin: number }>();
        for (let h = 0; h < 24; h++) hourMap.set(h, { count: 0, totalMin: 0 });

        let totalMin = 0;
        for (const log of logs) {
          const hour = new Date(log.created_at).getHours();
          const entry = hourMap.get(hour)!;
          entry.count++;
          entry.totalMin += log.duration_minutes;
          totalMin += log.duration_minutes;
        }

        const pats: DailyPattern[] = [];
        let maxSessions = 0;
        let peakH = 0;
        hourMap.forEach((val, hour) => {
          if (val.count > 0) {
            pats.push({ hour, sessions: val.count, avgMinutes: Math.round(val.totalMin / val.count) });
          }
          if (val.count > maxSessions) {
            maxSessions = val.count;
            peakH = hour;
          }
        });

        setPatterns(pats);
        setTotalAutoLogged(logs.length);
        setPeakHour(peakH);
        setAvgSessionLength(logs.length > 0 ? Math.round(totalMin / logs.length) : 0);
      }
      setLoading(false);
    };
    load();
  }, [user]);

  const formatHour = (h: number) => {
    if (h === 0) return "12 AM";
    if (h === 12) return "12 PM";
    return h > 12 ? `${h - 12} PM` : `${h} AM`;
  };

  const maxSessions = Math.max(...patterns.map(p => p.sessions), 1);

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[85vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Passive Learning</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        <p className="text-xs text-muted-foreground">
          Your study patterns are automatically detected and analyzed. Here's what your brain does naturally.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Activity className="w-5 h-5 text-primary animate-pulse" />
          </div>
        ) : patterns.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-8">
            No study patterns detected yet. Start logging sessions to see insights! 📊
          </p>
        ) : (
          <>
            {/* Stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold gradient-text">{totalAutoLogged}</p>
                <p className="text-[10px] text-muted-foreground">Sessions (30d)</p>
              </div>
              <div className="glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold text-foreground">{avgSessionLength}m</p>
                <p className="text-[10px] text-muted-foreground">Avg Length</p>
              </div>
              <div className="glass rounded-xl p-3 neural-border text-center">
                <p className="text-2xl font-bold text-primary">{peakHour !== null ? formatHour(peakHour) : "—"}</p>
                <p className="text-[10px] text-muted-foreground">Peak Hour</p>
              </div>
            </div>

            {/* Hourly Activity Chart */}
            <div className="glass rounded-xl p-4 neural-border">
              <p className="text-xs text-muted-foreground font-medium mb-3">Study Activity by Hour</p>
              <div className="flex items-end gap-[2px] h-24">
                {Array.from({ length: 24 }, (_, h) => {
                  const pat = patterns.find(p => p.hour === h);
                  const height = pat ? (pat.sessions / maxSessions) * 100 : 2;
                  return (
                    <motion.div
                      key={h}
                      className={`flex-1 rounded-t ${pat && pat.sessions > 0 ? "bg-primary/60" : "bg-secondary"}`}
                      initial={{ height: 0 }}
                      animate={{ height: `${height}%` }}
                      transition={{ duration: 0.5, delay: h * 0.02 }}
                      title={`${formatHour(h)}: ${pat?.sessions || 0} sessions`}
                    />
                  );
                })}
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-[8px] text-muted-foreground">12AM</span>
                <span className="text-[8px] text-muted-foreground">6AM</span>
                <span className="text-[8px] text-muted-foreground">12PM</span>
                <span className="text-[8px] text-muted-foreground">6PM</span>
                <span className="text-[8px] text-muted-foreground">11PM</span>
              </div>
            </div>

            {/* Insights */}
            <div className="space-y-2">
              <p className="text-xs text-muted-foreground font-medium">Insights</p>
              <div className="flex items-start gap-2 p-3 rounded-lg bg-secondary/20 border border-border/50">
                <CheckCircle2 className="w-4 h-4 text-success mt-0.5" />
                <p className="text-xs text-foreground">
                  You study most at <span className="text-primary font-medium">{peakHour !== null ? formatHour(peakHour) : "unknown"}</span>.
                  {avgSessionLength > 25 ? " Your sessions are deep and focused!" : " Try extending sessions to 25+ minutes for better retention."}
                </p>
              </div>
            </div>
          </>
        )}
      </motion.div>
    </div>
  );
};

export default PassiveLearning;
