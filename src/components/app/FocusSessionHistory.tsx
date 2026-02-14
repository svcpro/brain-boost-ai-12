import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Clock, Flame, Target, ChevronDown, ChevronUp, Timer, Calendar, StickyNote, Search, X, Download } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, startOfDay, startOfWeek, startOfMonth, format } from "date-fns";

interface FocusSession {
  id: string;
  duration_minutes: number;
  confidence_level: string | null;
  created_at: string;
  subject: string;
  topic: string | null;
  notes: string | null;
}

const FocusSessionHistory = () => {
  const { user } = useAuth();
  const [sessions, setSessions] = useState<FocusSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [expandedNoteId, setExpandedNoteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [confidenceFilter, setConfidenceFilter] = useState<string | null>(null);
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");

  useEffect(() => {
    if (!user) return;
    loadSessions();
  }, [user]);

  const loadSessions = async () => {
    if (!user) return;
    setLoading(false);

    const { data } = await supabase
      .from("study_logs")
      .select("id, duration_minutes, confidence_level, created_at, subject_id, topic_id, notes")
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
        notes: d.notes || null,
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

  const now = new Date();
  const dateStart = dateRange === "today" ? startOfDay(now)
    : dateRange === "week" ? startOfWeek(now, { weekStartsOn: 1 })
    : dateRange === "month" ? startOfMonth(now)
    : null;

  const query = searchQuery.toLowerCase().trim();
  const filteredSessions = sessions.filter((s) => {
    if (dateStart && new Date(s.created_at) < dateStart) return false;
    if (confidenceFilter && s.confidence_level !== confidenceFilter) return false;
    if (query) {
      return (
        s.notes?.toLowerCase().includes(query) ||
        s.subject.toLowerCase().includes(query) ||
        s.topic?.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const visibleSessions = expanded ? filteredSessions : filteredSessions.slice(0, 5);

  if (loading) return null;
  if (totalSessions === 0) return null;

  const exportCSV = () => {
    const header = "Date,Subject,Topic,Duration (min),Confidence,Notes";
    const rows = filteredSessions.map((s) => {
      const date = format(new Date(s.created_at), "yyyy-MM-dd HH:mm");
      const escapeCsv = (v: string | null) => v ? `"${v.replace(/"/g, '""')}"` : "";
      return `${date},${escapeCsv(s.subject)},${escapeCsv(s.topic)},${s.duration_minutes},${s.confidence_level || ""},${escapeCsv(s.notes)}`;
    });
    const totalMins = filteredSessions.reduce((sum, s) => sum + s.duration_minutes, 0);
    const summary = `\nSummary,${filteredSessions.length} sessions,,${totalMins},,`;
    const csv = [header, ...rows, summary].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `focus-sessions-${format(new Date(), "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

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
        <button
          onClick={() => { setShowSearch((v) => !v); setSearchQuery(""); setConfidenceFilter(null); setDateRange("all"); }}
          className={`p-1 rounded-md hover:bg-secondary/50 transition-colors ${showSearch ? "bg-secondary/50" : ""}`}
          title="Search & filter"
        >
          <Search className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
        <button
          onClick={exportCSV}
          className="p-1 rounded-md hover:bg-secondary/50 transition-colors"
          title="Export as CSV"
        >
          <Download className="w-3.5 h-3.5 text-muted-foreground" />
        </button>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="relative mb-3">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by subject, topic, or note…"
                className="w-full pl-8 pr-8 py-2 text-xs bg-secondary/50 border border-border rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                autoFocus
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery("")}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded hover:bg-secondary transition-colors"
                >
                  <X className="w-3 h-3 text-muted-foreground" />
                </button>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              {(["high", "medium", "low"] as const).map((level) => {
                const active = confidenceFilter === level;
                const colors = {
                  high: { dot: "bg-success", activeBg: "bg-success/15 border-success/40 text-success", label: "High" },
                  medium: { dot: "bg-warning", activeBg: "bg-warning/15 border-warning/40 text-warning", label: "Medium" },
                  low: { dot: "bg-destructive", activeBg: "bg-destructive/15 border-destructive/40 text-destructive", label: "Low" },
                };
                const c = colors[level];
                return (
                  <button
                    key={level}
                    onClick={() => setConfidenceFilter(active ? null : level)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-medium transition-colors ${
                      active ? c.activeBg : "border-border text-muted-foreground hover:bg-secondary/50"
                    }`}
                  >
                    <span className={`w-1.5 h-1.5 rounded-full ${c.dot}`} />
                    {c.label}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-1.5 mb-3">
              {([
                { key: "all", label: "All Time" },
                { key: "today", label: "Today" },
                { key: "week", label: "This Week" },
                { key: "month", label: "This Month" },
              ] as const).map(({ key, label }) => (
                <button
                  key={key}
                  onClick={() => setDateRange(key)}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-[10px] font-medium transition-colors ${
                    dateRange === key
                      ? "bg-primary/15 border-primary/40 text-primary"
                      : "border-border text-muted-foreground hover:bg-secondary/50"
                  }`}
                >
                  {key !== "all" && <Calendar className="w-2.5 h-2.5" />}
                  {label}
                </button>
              ))}
              {(query || confidenceFilter || dateRange !== "all") && (
                <span className="text-[10px] text-muted-foreground ml-auto">
                  {filteredSessions.length} result{filteredSessions.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

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
              className="rounded-lg bg-secondary/30 border border-border overflow-hidden"
            >
              <div
                className={`flex items-center gap-3 p-2.5 ${session.notes ? "cursor-pointer" : ""}`}
                onClick={() => session.notes && setExpandedNoteId((prev) => prev === session.id ? null : session.id)}
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
                  {session.notes && (
                    <p className="text-[10px] text-muted-foreground/70 truncate mt-0.5 flex items-center gap-1">
                      <StickyNote className="w-2.5 h-2.5 shrink-0" />
                      <span className="truncate">{session.notes}</span>
                    </p>
                  )}
                </div>
                <span className="text-xs font-semibold text-muted-foreground shrink-0">
                  {session.duration_minutes}m
                </span>
              </div>
              <AnimatePresence>
                {expandedNoteId === session.id && session.notes && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.2, ease: "easeInOut" }}
                    className="overflow-hidden"
                  >
                    <div className="px-3 pb-3 pt-1 border-t border-border/30">
                      <p className="text-[11px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                        {session.notes}
                      </p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Show more / less */}
      {filteredSessions.length > 5 && (
        <button
          onClick={() => setExpanded((v) => !v)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors py-1.5"
        >
          {expanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          {expanded ? "Show less" : `Show ${filteredSessions.length - 5} more`}
        </button>
      )}
    </motion.div>
  );
};

export default FocusSessionHistory;
