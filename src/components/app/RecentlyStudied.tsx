import { useEffect, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { History, Play, Search, CalendarIcon, ArrowUpDown, RefreshCw, CheckCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow, format, startOfDay, endOfDay } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface RecentTopic {
  logId: string;
  topicName: string;
  subjectName: string;
  lastStudied: string;
  minutes: number;
}
interface RecentlyStudiedProps {
  onQuickLog?: (subject: string, topic: string, minutes: number) => void;
  analyzing?: boolean;
}

const RecentlyStudied = ({ onQuickLog, analyzing }: RecentlyStudiedProps) => {
  const { user } = useAuth();
  const [clickedLogId, setClickedLogId] = useState<string | null>(null);
  const [completedLogId, setCompletedLogId] = useState<string | null>(null);
  
  const [items, setItems] = useState<RecentTopic[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [showSearch, setShowSearch] = useState(false);
  const [dateFrom, setDateFrom] = useState<Date | undefined>();
  const [dateTo, setDateTo] = useState<Date | undefined>();
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "longest">("newest");

  const load = useCallback(async () => {
    if (!user) return;

    const { data: logs } = await supabase
      .from("study_logs")
      .select("id, topic_id, subject_id, duration_minutes, created_at")
      .eq("user_id", user.id)
      .not("topic_id", "is", null)
      .order("created_at", { ascending: false })
      .limit(50);

    if (!logs || logs.length === 0) return;

    const topicIds = [...new Set(logs.map((l) => l.topic_id!))];
    const subjectIds = [...new Set(logs.filter((l) => l.subject_id).map((l) => l.subject_id!))];

    const [{ data: topics }, { data: subjects }] = await Promise.all([
      supabase.from("topics").select("id, name").in("id", topicIds),
      subjectIds.length > 0
        ? supabase.from("subjects").select("id, name").in("id", subjectIds)
        : Promise.resolve({ data: [] as { id: string; name: string }[] }),
    ]);

    const topicMap = new Map((topics || []).map((t) => [t.id, t.name]));
    const subjectMap = new Map((subjects || []).map((s) => [s.id, s.name]));

    const result: RecentTopic[] = logs.map((l) => ({
      logId: l.id,
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

  const query = searchQuery.toLowerCase().trim();
  const filteredItems = items.filter((item) => {
    const matchesText = !query || 
      item.topicName.toLowerCase().includes(query) ||
      item.subjectName.toLowerCase().includes(query);
    
    const itemDate = new Date(item.lastStudied);
    const matchesDate = 
      (!dateFrom || itemDate >= startOfDay(dateFrom)) &&
      (!dateTo || itemDate <= endOfDay(dateTo));
    
    return matchesText && matchesDate;
  });

  const sortedItems = [...filteredItems].sort((a, b) => {
    if (sortBy === "oldest") return new Date(a.lastStudied).getTime() - new Date(b.lastStudied).getTime();
    if (sortBy === "longest") return b.minutes - a.minutes;
    return new Date(b.lastStudied).getTime() - new Date(a.lastStudied).getTime();
  });

  // Show success checkmark briefly when analysis finishes
  useEffect(() => {
    if (!analyzing && clickedLogId) {
      setCompletedLogId(clickedLogId);
      setClickedLogId(null);
      const timer = setTimeout(() => setCompletedLogId(null), 2000);
      return () => clearTimeout(timer);
    }
  }, [analyzing]);

  const isFiltering = !!(query || dateFrom || dateTo);
  const displayItems = isFiltering ? sortedItems : sortedItems.slice(0, 5);

  if (items.length === 0) return null;

  const handleResume = (item: RecentTopic) => {
    setClickedLogId(item.logId);
    onQuickLog?.(item.subjectName, item.topicName, item.minutes);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-4 neural-border"
    >
      <div className="flex items-center gap-2 mb-3">
        <History className="w-4 h-4 text-primary" />
        <span className="text-sm font-semibold text-foreground flex-1">Recently Studied</span>
        {showSearch && (
          <span className="text-[10px] text-muted-foreground bg-secondary/70 px-1.5 py-0.5 rounded-full tabular-nums">
            {displayItems.length}/{items.length}
          </span>
        )}
        <button
          onClick={() => { setShowSearch((v) => !v); if (showSearch) { setSearchQuery(""); setDateFrom(undefined); setDateTo(undefined); } }}
          className={`p-1.5 rounded-md transition-colors ${showSearch ? "bg-primary/20 text-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}
        >
          <Search className="w-3.5 h-3.5" />
        </button>
      </div>

      <AnimatePresence>
        {showSearch && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-2"
          >
            <input
              type="text"
              placeholder="Search by subject or topic..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-lg bg-secondary border border-border px-3 py-2 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
              autoFocus
            />
            <div className="flex gap-2 mt-2">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-7 text-[10px] gap-1 flex-1 justify-start font-normal", !dateFrom && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {dateFrom ? format(dateFrom, "MMM d, yyyy") : "From date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar mode="single" selected={dateFrom} onSelect={setDateFrom} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" size="sm" className={cn("h-7 text-[10px] gap-1 flex-1 justify-start font-normal", !dateTo && "text-muted-foreground")}>
                    <CalendarIcon className="w-3 h-3" />
                    {dateTo ? format(dateTo, "MMM d, yyyy") : "To date"}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar mode="single" selected={dateTo} onSelect={setDateTo} initialFocus className={cn("p-3 pointer-events-auto")} />
                </PopoverContent>
              </Popover>
              {(dateFrom || dateTo) && (
                <Button variant="ghost" size="sm" className="h-7 text-[10px] px-2" onClick={() => { setDateFrom(undefined); setDateTo(undefined); }}>
                  Clear
                </Button>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-2">
              <ArrowUpDown className="w-3 h-3 text-muted-foreground shrink-0" />
              {(["newest", "oldest", "longest"] as const).map((opt) => (
                <button
                  key={opt}
                  onClick={() => setSortBy(opt)}
                  className={cn(
                    "px-2 py-0.5 rounded-md text-[10px] font-medium transition-colors capitalize",
                    sortBy === opt ? "bg-primary/20 text-primary" : "bg-secondary/50 text-muted-foreground hover:bg-secondary"
                  )}
                >
                  {opt === "longest" ? "Longest" : opt === "oldest" ? "Oldest" : "Newest"}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="space-y-2">
        {displayItems.length === 0 && (
          <p className="text-[10px] text-muted-foreground text-center py-3">No sessions match your search.</p>
        )}
        {displayItems.map((item, i) => (
          <motion.div
            key={item.logId}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.05 }}
            className={cn(
              "rounded-lg bg-secondary/30 border border-border/50 overflow-hidden cursor-pointer hover:bg-secondary/50 active:scale-[0.98] transition-all",
              clickedLogId === item.logId && analyzing && "ring-1 ring-primary/40 bg-primary/5",
              completedLogId === item.logId && "ring-1 ring-success/40 bg-success/5"
            )}
            onClick={() => !analyzing && handleResume(item)}
          >
            <div className="flex items-center gap-3 p-2.5">
              <div className={cn(
                "p-1.5 rounded-md shrink-0 transition-colors",
                completedLogId === item.logId ? "bg-success/20" : "bg-primary/10"
              )}>
                <AnimatePresence mode="wait">
                  {clickedLogId === item.logId && analyzing ? (
                    <motion.div key="spin" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.5, opacity: 0 }}>
                      <RefreshCw className="w-3 h-3 text-primary animate-spin" />
                    </motion.div>
                  ) : completedLogId === item.logId ? (
                    <motion.div key="check" initial={{ scale: 0, rotate: -90 }} animate={{ scale: 1, rotate: 0 }} exit={{ scale: 0 }} transition={{ type: "spring", stiffness: 300, damping: 15 }}>
                      <CheckCircle className="w-3 h-3 text-success" />
                    </motion.div>
                  ) : (
                    <motion.div key="play" initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}>
                      <Play className="w-3 h-3 text-primary" />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-foreground truncate">{item.topicName}</p>
                <p className="text-[10px] text-muted-foreground truncate">
                  {item.subjectName && `${item.subjectName} · `}
                  {clickedLogId === item.logId && analyzing
                    ? "Analyzing…"
                    : completedLogId === item.logId
                      ? "✅ Analysis complete!"
                      : `${item.minutes}min · ${formatDistanceToNow(new Date(item.lastStudied), { addSuffix: true })}`}
                </p>
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
};

export default RecentlyStudied;
