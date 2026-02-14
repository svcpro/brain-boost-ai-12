import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Clock, Flame, Target, ChevronDown, ChevronUp, Timer, Calendar } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface FocusSession {
  id: string;
  duration_minutes: number;
  confidence_level: string | null;
  created_at: string;
  subject: string;
  topic: string | null;
}

const FocusSessionHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    if (!user) return;
    loadSessions();
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    setLoading(false);

    const { data } = await supabase
      .from("study_logs")
      .select("id, duration_minutes, confidence_level, created_at, subject_id, topic_id")
      .eq("user_id", user.id)
      .eq("study_mode", "focus")
      .order("created_at", { ascending: false })
      .limit(50);

    if (!data || data.length === 0) {
      setSessions([]);
      setLoading(false);
      return;
    }

    // Fetch subject/topic names
    const subjectIds = [...new Set(data.map((d) => d.subject_id).filter(Boolean))] as string[];
    const topicIds = [...new Set(data.map((d) => d.topic_id).filter(Boolean))] as string[];

    const [subjectsRes, topicsRes] = await Promise.all([
      subjectIds.length > 0
        ? supabase.from("subjects").select("id, name").in("id", subjectIds)
        : { data: [] },
      topicIds.length > 0
        ? supabase.from("topics").select("id, name").in("id", topicIds)
        : { data: [] },
    ]);

    const subjectMap = new Map((subjectsRes.data || []).map((s) => [s.id, s.name]));
    const topicMap = new Map((topicsRes.data || []).map((t) => [t.id, t.name]));

    setSessions(
      data.map((d) => ({
        id: d.id,
        duration_minutes: d.duration_minutes,
        confidence_level: d.confidence_level,
        created_at: d.created_at,
        subject: subjectMap.get(d.subject_id!) || "Unknown",
        topic: d.topic_id ? topicMap.get(d.topic_id) || null : null,
      }))
    );
    setLoading(false);
  };

  // Stats
  const totalMinutes = sessions.reduce((sum, s) => sum + s.duration_minutes, 0);
  const totalSessions = sessions.length;
  const avgMinutes = totalSessions > 0 ? Math.round(totalMinutes / totalSessions) : 0;
  // Estimate pomodoro cycles (each 25-min block counts as a cycle)
  const estimatedCycles = Math.floor(totalMinutes / 25);

  const visibleSessions = expanded ? sessions : sessions.slice(0, 5);

  if (loading) return null;
  if (totalSessions === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center gap-2 mb-4">
        <History className="w-4 h-4 text-success" />
        <h2 className="font-semibold text-foreground text-sm">Focus Session History</h2>
        <span className="ml-auto px-2 py-0.5 rounded-full bg-success/10 text-success text-[10px] font-medium">
          {totalSessions} session{totalSessions !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="rounded-lg bg-secondary/50 border border-border p-2.5 text-center">
          <Clock className="w-3.5 h-3.5 text-success mx-auto mb-1" />
          <p className="text-sm font-bold text-foreground">{totalMinutes >= 60 ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m` : `${totalMinutes}m`}</p>
          <p className="text-[10px] text-muted-foreground">Total Focus</p>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border p-2.5 text-center">
          <Timer className="w-3.5 h-3.5 text-primary mx-auto mb-1" />
          <p className="text-sm font-bold text-foreground">{estimatedCycles}</p>
          <p className="text-[10px] text-muted-foreground">Pomodoro Cycles</p>
        </div>
        <div className="rounded-lg bg-secondary/50 border border-border p-2.5 text-center">
          <Target className="w-3.5 h-3.5 text-warning mx-auto mb-1" />
          <p className="text-sm font-bold text-foreground">{avgMinutes}m</p>
          <p className="text-[10px] text-muted-foreground">Avg Session</p>
        </div>
      </div>

      {/* Session list */}
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {visibleSessions.map((session) => (
            <motion.div
              key={session.id}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border"
            >
              <div className={`w-2 h-2 rounded-full shrink-0 ${
                session.confidence_level === "high" ? "bg-success" :
                session.confidence_level === "medium" ? "bg-warning" : "bg-destructive"
              }`} />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">
                  {session.subject}{session.topic ? ` · ${session.topic}` : ""}
                </p>
                <p className="text-[10px] text-muted-foreground flex items-center gap-1.5">
                  <Calendar className="w-2.5 h-2.5" />
                  {formatDistanceToNow(new Date(session.created_at), { addSuffix: true })}
                </p>
              </div>
              <span className="text-xs font-semibold text-muted-foreground shrink-0">
                {session.duration_minutes}m
              </span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Show more / less */}
      {sessions.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Show less" : `Show ${sessions.length - 5} more`}
        </button>
      )}
    </motion.div>
  );
};

export default FocusSessionHistory;
