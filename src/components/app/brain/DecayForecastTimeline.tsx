import { useMemo } from "react";
import { motion } from "framer-motion";
import { Clock, AlertTriangle, TrendingDown, Shield } from "lucide-react";
import { isPast, isToday, formatDistanceToNow, format, differenceInDays } from "date-fns";

interface TopicInfo {
  id: string;
  name: string;
  memory_strength: number;
  next_predicted_drop_date: string | null;
}

interface SubjectHealthData {
  id: string;
  name: string;
  strength: number;
  topicCount: number;
  topics: TopicInfo[];
}

interface DecayForecastTimelineProps {
  subjectHealth: SubjectHealthData[];
}

interface DecayEvent {
  topicName: string;
  subjectName: string;
  strength: number;
  dropDate: Date;
  daysUntil: number;
  isOverdue: boolean;
  isDueToday: boolean;
}

export default function DecayForecastTimeline({ subjectHealth }: DecayForecastTimelineProps) {
  const events = useMemo(() => {
    const all: DecayEvent[] = [];
    const now = new Date();

    for (const sub of subjectHealth) {
      for (const topic of sub.topics) {
        if (!topic.next_predicted_drop_date) continue;
        const dropDate = new Date(topic.next_predicted_drop_date);
        const daysUntil = differenceInDays(dropDate, now);
        if (daysUntil > 14) continue; // Only show next 14 days

        all.push({
          topicName: topic.name,
          subjectName: sub.name,
          strength: topic.memory_strength,
          dropDate,
          daysUntil,
          isOverdue: isPast(dropDate) && !isToday(dropDate),
          isDueToday: isToday(dropDate),
        });
      }
    }

    all.sort((a, b) => a.daysUntil - b.daysUntil);
    return all.slice(0, 8);
  }, [subjectHealth]);

  if (events.length === 0) {
    return (
      <motion.section
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25 }}
      >
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Decay Forecast</h3>
            <p className="text-[10px] text-muted-foreground">Predictive risk timeline</p>
          </div>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
          border: "1px solid hsl(var(--border))",
        }}>
          <Shield className="w-8 h-8 text-success/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">All topics stable — no decay alerts</p>
        </div>
      </motion.section>
    );
  }

  const overdueCount = events.filter(e => e.isOverdue).length;
  const todayCount = events.filter(e => e.isDueToday).length;

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Decay Forecast</h3>
            <p className="text-[10px] text-muted-foreground">Next 14 days risk timeline</p>
          </div>
        </div>
        {(overdueCount > 0 || todayCount > 0) && (
          <div className="flex items-center gap-1.5">
            {overdueCount > 0 && (
              <span className="text-[9px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
                {overdueCount} overdue
              </span>
            )}
            {todayCount > 0 && (
              <span className="text-[9px] font-semibold text-warning bg-warning/10 px-2 py-0.5 rounded-full">
                {todayCount} today
              </span>
            )}
          </div>
        )}
      </div>

      {/* Timeline */}
      <div className="relative pl-5">
        {/* Vertical line */}
        <div className="absolute left-[9px] top-2 bottom-2 w-px bg-border/50" />

        <div className="space-y-2">
          {events.map((event, i) => {
            const urgency = event.isOverdue ? "destructive" : event.isDueToday ? "warning" : "muted-foreground";
            const dotColor = event.isOverdue
              ? "bg-destructive"
              : event.isDueToday
              ? "bg-warning"
              : event.daysUntil <= 3
              ? "bg-warning/60"
              : "bg-muted-foreground/40";

            return (
              <motion.div
                key={`${event.topicName}-${i}`}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                className="relative flex items-start gap-3"
              >
                {/* Timeline dot */}
                <div className="relative z-10 mt-1.5">
                  <div className={`w-[7px] h-[7px] rounded-full ${dotColor}`} />
                  {(event.isOverdue || event.isDueToday) && (
                    <motion.div
                      className={`absolute inset-0 rounded-full ${dotColor}`}
                      animate={{ scale: [1, 2.5], opacity: [0.6, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    />
                  )}
                </div>

                {/* Content card */}
                <div
                  className="flex-1 rounded-xl p-3 border"
                  style={{
                    background: event.isOverdue
                      ? "hsl(0 50% 8% / 0.5)"
                      : "hsl(var(--card) / 0.6)",
                    borderColor: event.isOverdue
                      ? "hsl(0 60% 30% / 0.3)"
                      : event.isDueToday
                      ? "hsl(38 60% 40% / 0.2)"
                      : "hsl(var(--border) / 0.4)",
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-foreground truncate">{event.topicName}</p>
                      <p className="text-[9px] text-muted-foreground">{event.subjectName}</p>
                    </div>
                    <div className="text-right shrink-0 ml-2">
                      <p className={`text-[10px] font-bold text-${urgency}`}>
                        {event.isOverdue
                          ? `Overdue ${formatDistanceToNow(event.dropDate)}`
                          : event.isDueToday
                          ? "Today"
                          : `${event.daysUntil}d`}
                      </p>
                      <p className="text-[9px] text-muted-foreground">{event.strength}% strength</p>
                    </div>
                  </div>

                  {/* Mini decay bar */}
                  <div className="h-1 rounded-full bg-secondary/40 mt-2">
                    <motion.div
                      className="h-full rounded-full"
                      style={{
                        background: event.isOverdue
                          ? "hsl(var(--destructive))"
                          : event.isDueToday
                          ? "hsl(var(--warning))"
                          : "hsl(var(--primary))",
                      }}
                      initial={{ width: 0 }}
                      animate={{ width: `${event.strength}%` }}
                      transition={{ duration: 0.6, delay: 0.4 + i * 0.05 }}
                    />
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </motion.section>
  );
}
