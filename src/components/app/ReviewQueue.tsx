import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { RotateCcw, Clock, AlertTriangle, ChevronDown, ChevronUp, Zap } from "lucide-react";
import { useReviewQueue, ReviewItem } from "@/hooks/useReviewQueue";
import { formatDistanceToNow } from "date-fns";

const urgencyConfig = {
  overdue: {
    label: "Overdue",
    dot: "bg-destructive animate-pulse",
    badge: "bg-destructive/20 text-destructive",
    icon: AlertTriangle,
  },
  due_now: {
    label: "Due Now",
    dot: "bg-warning",
    badge: "bg-warning/20 text-warning",
    icon: Zap,
  },
  upcoming: {
    label: "Upcoming",
    dot: "bg-muted-foreground",
    badge: "bg-secondary text-muted-foreground",
    icon: Clock,
  },
};

const ReviewQueue = () => {
  const { queue, dueCount, loading, loadQueue } = useReviewQueue();
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const displayItems = expanded ? queue.slice(0, 15) : queue.filter((i) => i.urgency !== "upcoming").slice(0, 5);
  const hasUpcoming = queue.some((i) => i.urgency === "upcoming");

  if (loading) {
    return (
      <div className="glass rounded-xl p-5 neural-border">
        <div className="flex items-center gap-2 mb-3">
          <RotateCcw className="w-4 h-4 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Loading review queue...</span>
        </div>
      </div>
    );
  }

  if (queue.length === 0) return null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass rounded-xl p-5 neural-border"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-primary" />
          <h2 className="font-semibold text-foreground text-sm">Review Queue</h2>
          {dueCount > 0 && (
            <span className="px-2 py-0.5 rounded-full bg-primary/20 text-primary text-[10px] font-medium">
              {dueCount} due
            </span>
          )}
        </div>
        <button
          onClick={() => loadQueue()}
          className="text-[10px] text-muted-foreground hover:text-primary transition-colors"
        >
          Refresh
        </button>
      </div>

      {displayItems.length > 0 ? (
        <div className="space-y-2">
          <AnimatePresence>
            {displayItems.map((item, i) => (
              <ReviewItemCard key={item.id} item={item} index={i} />
            ))}
          </AnimatePresence>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground text-center py-3">
          No reviews due right now! 🎉
        </p>
      )}

      {(hasUpcoming || displayItems.length < queue.filter((i) => i.urgency !== "upcoming").length) && (
        <button
          onClick={() => setExpanded(!expanded)}
          className="w-full mt-3 flex items-center justify-center gap-1 text-[11px] text-muted-foreground hover:text-primary transition-colors"
        >
          {expanded ? (
            <>Show less <ChevronUp className="w-3 h-3" /></>
          ) : (
            <>Show all ({queue.length}) <ChevronDown className="w-3 h-3" /></>
          )}
        </button>
      )}
    </motion.div>
  );
};

const ReviewItemCard = ({ item, index }: { item: ReviewItem; index: number }) => {
  const config = urgencyConfig[item.urgency];
  const Icon = config.icon;

  const timeLabel =
    item.urgency === "overdue"
      ? `${Math.round(item.hours_overdue)}h overdue`
      : item.urgency === "due_now"
      ? "Review now"
      : `in ${formatDistanceToNow(new Date(item.next_review_date))}`;

  return (
    <motion.div
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 10 }}
      transition={{ delay: index * 0.05 }}
      className="flex items-center gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
    >
      <div className={`w-2 h-2 rounded-full shrink-0 ${config.dot}`} />
      <div className="flex-1 min-w-0">
        <p className="text-sm text-foreground truncate">{item.name}</p>
        <div className="flex items-center gap-2 mt-0.5">
          {item.subject_name && (
            <span className="text-[10px] text-muted-foreground">{item.subject_name}</span>
          )}
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-muted-foreground">{item.memory_strength}%</span>
          <span className="text-[10px] text-muted-foreground">•</span>
          <span className="text-[10px] text-muted-foreground">
            #{item.review_count} → {item.interval_days}d interval
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1.5 shrink-0">
        <Icon className={`w-3 h-3 ${item.urgency === "overdue" ? "text-destructive" : item.urgency === "due_now" ? "text-warning" : "text-muted-foreground"}`} />
        <span className={`text-[10px] font-medium ${item.urgency === "overdue" ? "text-destructive" : item.urgency === "due_now" ? "text-warning" : "text-muted-foreground"}`}>
          {timeLabel}
        </span>
      </div>
    </motion.div>
  );
};

export default ReviewQueue;
