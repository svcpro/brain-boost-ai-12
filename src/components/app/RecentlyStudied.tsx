import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Play, StickyNote, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";
import FocusModeSession from "./FocusModeSession";

interface RecentTopic {
  topicName: string;
  subjectName: string;
  lastStudied: string;
  minutes: number;
  notes: string | null;
}

const RecentlyStudied = () => {
  const { user } = useAuth();
  const [items, setItems] = useState<RecentTopic[]>([]);
  const [sessionOpen, setSessionOpen] = useState(false);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const load = useCallback(async () => {
    if (!user) return;

    const { data: logs } = await supabase
      .from("study_logs")
      .select("topic_id, subject_id, duration_minutes, created_at, notes")
      .eq("user_id", user.id)
      .not("topic_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(20);

    if (!logs || logs.length === 0) return;

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
      notes: l.notes || null,
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

  const toggleExpand = (index: number) => {
    setExpandedIndex((prev) => (prev === index ? null : index));
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
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.05 }}
              className="rounded-lg bg-secondary/30 border border-border/50 overflow-hidden"
            >
              <div className="flex items-center gap-3 p-2.5">
                <button
                  onClick={() => handleResume(item)}
                  className="p-1.5 rounded-md bg-primary/10 hover:bg-primary/20 transition-colors shrink-0"
                >
                  <Play className="w-3 h-3 text-primary" />
                </button>
                <button
                  onClick={() => item.notes ? toggleExpand(i) : handleResume(item)}
                  className="flex-1 min-w-0 text-left"
                >
                  <p className="text-xs font-medium text-foreground truncate">{item.topicName}</p>
                  <p className="text-[10px] text-muted-foreground truncate">
                    {item.subjectName && `${item.subjectName} · `}
                    {item.minutes}min · {formatDistanceToNow(new Date(item.lastStudied), { addSuffix: true })}
                  </p>
                  {item.notes && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1">
                      <StickyNote className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{item.notes}</span>
                    </p>
                  )}
                </button>
                {item.notes && (
                  <button
                    onClick={() => toggleExpand(i)}
                    className="p-1 rounded-md hover:bg-secondary/50 transition-colors shrink-0"
                  >
                    <ChevronDown
                      className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${
                        expandedIndex === i ? "rotate-180" : ""
                      }`}
                    />
                  </button>
                )}
              </div>

              <AnimatePresence>
                {expandedIndex === i && item.notes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-0.5 border-t border-border/30">
                      <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {item.notes}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
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
