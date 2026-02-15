import { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, Clock, Timer, BookOpen, ChevronDown } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import FocusModeSession from "./FocusModeSession";

const QUICK_PRESETS = [
  { label: "10 min", minutes: 10, color: "bg-success/15 border-success/30 text-success" },
  { label: "25 min", minutes: 25, color: "bg-primary/15 border-primary/30 text-primary" },
  { label: "45 min", minutes: 45, color: "bg-warning/15 border-warning/30 text-warning" },
];

interface SubjectOption {
  id: string;
  name: string;
  topics: { id: string; name: string }[];
}

const QuickStartStudy = () => {
  const { user } = useAuth();
  const [sessionOpen, setSessionOpen] = useState(false);
  const [subjects, setSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [loaded, setLoaded] = useState(false);

  const loadSubjects = useCallback(async () => {
    if (!user || loaded) return;
    const { data: subs } = await supabase
      .from("subjects")
      .select("id, name")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name");

    if (!subs || subs.length === 0) { setLoaded(true); return; }

    const { data: topics } = await supabase
      .from("topics")
      .select("id, name, subject_id")
      .eq("user_id", user.id)
      .is("deleted_at", null)
      .order("name");

    const result: SubjectOption[] = subs.map((s) => ({
      ...s,
      topics: (topics || []).filter((t: any) => t.subject_id === s.id).map((t) => ({ id: t.id, name: t.name })),
    }));

    setSubjects(result);
    setLoaded(true);
  }, [user, loaded]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const currentSubject = subjects.find((s) => s.id === selectedSubject);
  const subjectName = currentSubject?.name || "";
  const topicName = currentSubject?.topics.find((t) => t.id === selectedTopic)?.name || "";

  const handleStart = (minutes: number) => {
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
          <Timer className="w-4 h-4 text-primary" />
          <span className="text-sm font-semibold text-foreground">Quick Start</span>
        </div>

        {/* Subject/Topic selectors */}
        {subjects.length > 0 && (
          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <select
                value={selectedSubject}
                onChange={(e) => { setSelectedSubject(e.target.value); setSelectedTopic(""); }}
                className="w-full appearance-none text-xs bg-secondary/40 border border-border rounded-lg px-3 py-2 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 truncate"
              >
                <option value="">Subject (optional)</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>

            {currentSubject && currentSubject.topics.length > 0 && (
              <div className="flex-1 relative">
                <select
                  value={selectedTopic}
                  onChange={(e) => setSelectedTopic(e.target.value)}
                  className="w-full appearance-none text-xs bg-secondary/40 border border-border rounded-lg px-3 py-2 pr-7 text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50 truncate"
                >
                  <option value="">Topic (optional)</option>
                  {currentSubject.topics.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-muted-foreground absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            )}
          </div>
        )}

        <div className="flex gap-2">
          {QUICK_PRESETS.map((preset) => (
            <button
              key={preset.minutes}
              onClick={() => handleStart(preset.minutes)}
              className={`flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border transition-all active:scale-95 hover:scale-[1.02] ${preset.color}`}
            >
              <Clock className="w-4 h-4" />
              <span className="text-xs font-semibold">{preset.label}</span>
            </button>
          ))}
          <button
            onClick={() => handleStart(25)}
            className="flex-1 flex flex-col items-center gap-1.5 py-3 rounded-xl border border-border bg-secondary/30 text-foreground transition-all active:scale-95 hover:scale-[1.02]"
          >
            <Play className="w-4 h-4" />
            <span className="text-xs font-semibold">Custom</span>
          </button>
        </div>
      </motion.div>

      <FocusModeSession
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        onSessionComplete={() => window.dispatchEvent(new Event("insights-refresh"))}
        initialSubject={subjectName}
        initialTopic={topicName}
      />
    </>
  );
};

export default QuickStartStudy;
