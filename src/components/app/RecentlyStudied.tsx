import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { History, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import FocusModeSession from "./FocusModeSession";

interface RecentTopic {
  topicName: string;
  subjectName: string;
  lastStudied: string;
  minutes: number;
}

const RecentlyStudied = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentTopic[]>([]);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");

  const load = useCallback(async () => {
    if (!user) return;

    // Get recent study logs with topic_id
    const { data: logs } = await supabase
      .from("study_logs")
      .select("topic_id, subject_id, duration_minutes, created_at")
      .eq("user_id", user.id)
      .not("topic_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!logs || logs.length === 0) return;

    // Deduplicate by topic_id, keep most recent
    const seen = new Set<string>();
    const uniqueLogs: typeof logs = [];
    for (const l of logs) {
      if (!seen.has(l.topic_id!)) {
        seen.add(l.topic_id!);
        uniqueLogs.push(l);
      }
      if (uniqueLogs.length >= 3) break;
    }

    const topicIds = uniqueLogs.map((l) => l.topic_id!);
    const subjectIds = [...new Set(uniqueLogs.filter((l) => l.subject_id).map((l) => l.subject_id!))];

    const [{ data: topics }, { data: subjects }] = await Promise.all([
      supabase.from("topics").select("id, name").in("id", topicIds),
      subjectIds.length > 0
        ? supabase.from("subjects").select("id, name").in("id", subjectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const topicMap = new Map((topics || []).map((t) => [t.id, t.name]));
    const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]));

    const result: RecentTopic[] = uniqueLogs.map((l) => ({
      topicName: topicMap.get(l.topic_id!) || "Unknown",
      subjectName: subjectMap.get(l.subject_id!) || "",
      lastStudied: l.created_at,
      minutes: l.duration_minutes,
    }));

    setItems(result);
  }, [user]);

  useEffect(() => {
    load();
  }, [load]);

  if (items.length === 0) return null;

  const handleResume = (item: RecentTopic) => {
    setSelectedSubject(item.subjectName);
    setSelectedTopic(item.topicName);
    setSessionOpen(true);
  };

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass rounded-xl p-4 neural-border"
      >
        <div className="flex items-center gap-2 mb-3">
          <History className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Recently Studied</span>
        </div>

        <div className="space-y-2">
          {items.map((item, i) => (
            <motion.button
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              onClick={() => handleResume(item)}
              className="w-full flex items-center gap-3 p-2.5 rounded-lg bg-secondary/30 border border-border/50 hover:bg-secondary/50 transition-all active:scale-[0.98] text-left"
            >
              <div className="p-1.5 rounded-md bg-primary/10">
                <Play className="w-3 h-3 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.topicName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.subjectName && `${item.subjectName} · `}
                  {item.minutes}min · {formatDistanceToNow(new Date(item.lastStudied), { addSuffix: true })}
                </p>
              </div>
            </motion.button>
          ))}
        </div>
      </motion.div>

      <FocusModeSession
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        initialSubject={selectedSubject}
        initialTopic={selectedTopic}
      />
    </>
  );
};

export default RecentlyStudied;
