import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Target, AlertTriangle, CheckCircle, Settings2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { subDays, startOfWeek, endOfWeek } from "date-fns";
import { nudgeFeedback, notifyFeedback } from "@/lib/feedback";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";

const THRESHOLD_KEY = "acry-confidence-goal-pct";

const getStoredThreshold = (): number => {
  try {
    const v = localStorage.getItem(THRESHOLD_KEY);
    return v ? Math.min(100, Math.max(10, Number(v))) : 60;
  } catch {
    return 60;
  }
};

const ConfidenceGoalTracker = () => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [threshold, setThreshold] = useState(getStoredThreshold);
  const [showSettings, setShowSettings] = useState(false);
  const [stats, setStats] = useState<{ high: number; total: number } | null>(null);
  const [notified, setNotified] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    const now = new Date();
    const weekStart = startOfWeek(now, { weekStartsOn: 1 });
    const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

    const { data: logs } = await supabase
      .from("study_logs")
      .select("confidence_level")
      .eq("user_id", user.id)
      .not("confidence_level", "is", null)
      .gte("created_at", weekStart.toISOString())
      .lte("created_at", weekEnd.toISOString());

    if (!logs) return;
    const high = logs.filter((l) => l.confidence_level === "high").length;
    setStats({ high, total: logs.length });
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  // Alert when below threshold
  useEffect(() => {
    if (!stats || stats.total < 3 || notified) return;
    const pct = Math.round((stats.high / stats.total) * 100);
    if (pct < threshold) {
      setNotified(true);
      nudgeFeedback();
      toast({
        title: "⚠️ Confidence dipping",
        description: `Only ${pct}% high-confidence this week (goal: ${threshold}%). Focus on weak topics!`,
      });
    }
  }, [stats, threshold, notified, toast]);

  const updateThreshold = (val: number[]) => {
    const v = val[0];
    setThreshold(v);
    try { localStorage.setItem(THRESHOLD_KEY, String(v)); } catch {}
    setNotified(false); // re-evaluate on change
  };

  if (!stats) return null;

  const pct = stats.total > 0 ? Math.round((stats.high / stats.total) * 100) : 0;
  const onTrack = pct >= threshold;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <Target className="w-4 h-4 text-primary" />
        <h2 className="font-semibold text-foreground text-sm">Confidence Goal</h2>
        <span className="ml-auto text-[10px] text-muted-foreground">This week</span>
        <button
          onClick={() => setShowSettings((s) => !s)}
          className="p-1.5 rounded-lg neural-border hover:glow-primary transition-all"
          title="Adjust goal"
        >
          <Settings2 className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 mb-3">
        {onTrack ? (
          <CheckCircle className="w-5 h-5 text-success shrink-0" />
        ) : (
          <AlertTriangle className="w-5 h-5 text-warning shrink-0" />
        )}
        <div className="flex-1">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${onTrack ? "text-success" : "text-warning"}`}>{pct}%</span>
            <span className="text-xs text-muted-foreground">high-confidence</span>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {stats.high} of {stats.total} sessions · Goal: ≥{threshold}%
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="relative">
        <Progress value={Math.min(pct, 100)} className="h-2" />
        {/* Threshold marker */}
        <div
          className="absolute top-0 h-2 w-0.5 bg-foreground/50 rounded"
          style={{ left: `${threshold}%` }}
          title={`Goal: ${threshold}%`}
        />
      </div>
      <div className="flex justify-between mt-1">
        <span className="text-[9px] text-muted-foreground">0%</span>
        <span className="text-[9px] text-muted-foreground">100%</span>
      </div>

      {/* Settings panel */}
      {showSettings && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-4 pt-3 border-t border-border"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">High-confidence goal</span>
            <span className="text-xs font-semibold text-foreground">{threshold}%</span>
          </div>
          <Slider
            value={[threshold]}
            onValueChange={updateThreshold}
            min={10}
            max={100}
            step={5}
            className="w-full"
          />
          <p className="text-[9px] text-muted-foreground mt-2">
            You'll get an alert when your weekly high-confidence rate drops below this.
          </p>
        </motion.div>
      )}

      {/* Nudge */}
      {!onTrack && stats.total >= 3 && (
        <p className="text-[10px] text-warning mt-3">
          💡 Try reviewing weak topics to boost your confidence rate.
        </p>
      )}
    </motion.div>
  );
};

export default ConfidenceGoalTracker;
