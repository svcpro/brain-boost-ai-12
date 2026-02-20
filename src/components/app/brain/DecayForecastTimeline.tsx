import { useState, useMemo, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Clock, Shield, Zap, Play, TrendingDown, AlertTriangle,
  ChevronLeft, ChevronRight, X, Sparkles, Activity,
  BarChart3, ShieldCheck, Eye,
} from "lucide-react";
import { isPast, isToday, differenceInDays, format, addDays } from "date-fns";

/* ───────── Types ───────── */
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
  onPreventDecay: (subject: string, topic: string) => void;
}

interface DecayEvent {
  topicName: string;
  subjectName: string;
  strength: number;
  dropDate: Date;
  daysUntil: number;
  isOverdue: boolean;
  isDueToday: boolean;
  projectedDrop: number;
  rankImpact: number;
}

/* ───────── Helpers ───────── */
const clamp = (v: number, min: number, max: number) => Math.max(min, Math.min(max, v));

function buildTimeline(subjectHealth: SubjectHealthData[]): DecayEvent[] {
  const now = new Date();
  const all: DecayEvent[] = [];
  for (const sub of subjectHealth) {
    for (const topic of sub.topics) {
      if (!topic.next_predicted_drop_date) continue;
      const dropDate = new Date(topic.next_predicted_drop_date);
      const daysUntil = differenceInDays(dropDate, now);
      if (daysUntil > 14) continue;
      const projectedDrop = clamp(Math.round(topic.memory_strength * 0.3), 5, 35);
      const rankImpact = clamp(Math.round(projectedDrop * 0.4), 1, 12);
      all.push({
        topicName: topic.name,
        subjectName: sub.name,
        strength: topic.memory_strength,
        dropDate, daysUntil,
        isOverdue: isPast(dropDate) && !isToday(dropDate),
        isDueToday: isToday(dropDate),
        projectedDrop,
        rankImpact,
      });
    }
  }
  all.sort((a, b) => a.daysUntil - b.daysUntil);
  return all;
}

/* ───────── Day column for horizontal timeline ───────── */
const DayColumn = ({
  day, dayLabel, events, isToday: isCurrentDay, onSpikeTap, shielded,
}: {
  day: number;
  dayLabel: string;
  events: DecayEvent[];
  isToday: boolean;
  onSpikeTap: (e: DecayEvent) => void;
  shielded: Set<string>;
}) => {
  const maxSpike = events.length > 0
    ? Math.max(...events.map(e => shielded.has(e.topicName) ? 0 : e.projectedDrop))
    : 0;
  const spikeHeight = clamp(maxSpike * 2, 0, 60);
  const hasOverdue = events.some(e => e.isOverdue || e.isDueToday);

  return (
    <div className="flex flex-col items-center gap-1 min-w-[44px]">
      {/* Spike bar */}
      <div className="relative w-full h-16 flex items-end justify-center">
        {events.length > 0 && (
          <motion.button
            initial={{ height: 0 }}
            animate={{ height: spikeHeight }}
            transition={{ duration: 0.6, delay: day * 0.04 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => events[0] && onSpikeTap(events[0])}
            className="w-6 rounded-t-md relative overflow-hidden"
            style={{
              background: hasOverdue
                ? "linear-gradient(to top, hsl(0 72% 51% / 0.8), hsl(0 72% 51% / 0.3))"
                : spikeHeight > 30
                ? "linear-gradient(to top, hsl(38 92% 50% / 0.8), hsl(38 92% 50% / 0.3))"
                : "linear-gradient(to top, hsl(var(--primary) / 0.6), hsl(var(--primary) / 0.2))",
              boxShadow: hasOverdue
                ? "0 -4px 12px hsl(0 72% 51% / 0.3)"
                : spikeHeight > 30
                ? "0 -4px 12px hsl(38 92% 50% / 0.2)"
                : "none",
            }}
          >
            {/* Ripple effect on decay */}
            {hasOverdue && (
              <motion.div
                className="absolute inset-0 bg-destructive/20"
                animate={{ opacity: [0, 0.5, 0] }}
                transition={{ duration: 2, repeat: Infinity }}
              />
            )}
            {/* Event count badge */}
            {events.length > 1 && (
              <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 rounded-full bg-foreground text-background text-[7px] font-bold flex items-center justify-center">
                {events.length}
              </span>
            )}
          </motion.button>
        )}
        {/* Shielded indicator */}
        {events.length > 0 && events.every(e => shielded.has(e.topicName)) && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="absolute bottom-0 inset-x-0 flex justify-center"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-success" />
          </motion.div>
        )}
      </div>

      {/* Day label */}
      <div className={`text-center px-1 py-0.5 rounded-md ${
        isCurrentDay
          ? "bg-primary/15 border border-primary/30"
          : ""
      }`}>
        <p className={`text-[9px] font-semibold ${isCurrentDay ? "text-primary" : "text-muted-foreground"}`}>
          {dayLabel}
        </p>
      </div>

      {/* Dot indicators */}
      <div className="flex gap-0.5">
        {events.slice(0, 3).map((e, i) => (
          <div
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: shielded.has(e.topicName)
                ? "hsl(142 71% 45%)"
                : e.isOverdue
                ? "hsl(0 72% 51%)"
                : e.isDueToday
                ? "hsl(38 92% 50%)"
                : "hsl(var(--muted-foreground) / 0.4)",
            }}
          />
        ))}
      </div>
    </div>
  );
};

/* ───────── Spike Action Panel ───────── */
const SpikeActionPanel = ({
  event, shielded, onPrevent, onShield, onClose,
}: {
  event: DecayEvent;
  shielded: boolean;
  onPrevent: () => void;
  onShield: () => void;
  onClose: () => void;
}) => {
  const stabilityAfter = clamp(event.strength + Math.round(event.projectedDrop * 0.8), 0, 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className="rounded-2xl overflow-hidden backdrop-blur-xl border"
      style={{
        background: "linear-gradient(135deg, hsl(var(--card) / 0.95), hsl(var(--secondary) / 0.85))",
        borderColor: event.isOverdue
          ? "hsl(0 50% 40% / 0.3)"
          : "hsl(var(--border))",
        boxShadow: "0 8px 32px hsl(var(--background) / 0.5)",
      }}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="min-w-0">
            <p className="text-xs font-bold text-foreground truncate">{event.topicName}</p>
            <p className="text-[9px] text-muted-foreground">{event.subjectName}</p>
          </div>
          <motion.button whileTap={{ scale: 0.85 }} onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-secondary/40 transition-colors">
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </motion.button>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          {[
            {
              icon: TrendingDown, label: "Stability Drop",
              value: `-${event.projectedDrop}%`,
              color: "hsl(0 72% 51%)",
            },
            {
              icon: BarChart3, label: "Rank Impact",
              value: `-${event.rankImpact} pos`,
              color: "hsl(38 92% 50%)",
            },
            {
              icon: Activity, label: "After Fix",
              value: `${stabilityAfter}%`,
              color: "hsl(142 71% 45%)",
            },
          ].map(m => (
            <div key={m.label} className="rounded-lg p-2 text-center border border-border/30"
              style={{ background: "hsl(var(--background) / 0.4)" }}>
              <m.icon className="w-3 h-3 mx-auto mb-1" style={{ color: m.color }} />
              <p className="text-xs font-bold tabular-nums" style={{ color: m.color }}>{m.value}</p>
              <p className="text-[8px] text-muted-foreground">{m.label}</p>
            </div>
          ))}
        </div>

        {/* What-If comparison */}
        <div className="rounded-xl p-2.5 mb-3 border border-border/30"
          style={{ background: "hsl(var(--background) / 0.3)" }}>
          <p className="text-[9px] font-semibold text-muted-foreground mb-2 flex items-center gap-1">
            <Eye className="w-3 h-3" /> What-If Simulation
          </p>
          <div className="grid grid-cols-2 gap-2">
            {/* Without action */}
            <div className="rounded-lg p-2 border border-destructive/20" style={{ background: "hsl(0 50% 8% / 0.3)" }}>
              <p className="text-[8px] text-destructive/80 mb-1">Without action</p>
              <div className="h-1 rounded-full bg-secondary/40 mb-1">
                <motion.div className="h-full rounded-full bg-destructive"
                  initial={{ width: `${event.strength}%` }}
                  animate={{ width: `${clamp(event.strength - event.projectedDrop, 0, 100)}%` }}
                  transition={{ duration: 1.2, delay: 0.3 }}
                />
              </div>
              <p className="text-[9px] font-bold text-destructive tabular-nums">
                {clamp(event.strength - event.projectedDrop, 0, 100)}%
              </p>
            </div>
            {/* With action */}
            <div className="rounded-lg p-2 border border-success/20" style={{ background: "hsl(142 50% 8% / 0.3)" }}>
              <p className="text-[8px] text-success/80 mb-1">With 3-min fix</p>
              <div className="h-1 rounded-full bg-secondary/40 mb-1">
                <motion.div className="h-full rounded-full bg-success"
                  initial={{ width: `${event.strength}%` }}
                  animate={{ width: `${stabilityAfter}%` }}
                  transition={{ duration: 1.2, delay: 0.5 }}
                />
              </div>
              <p className="text-[9px] font-bold text-success tabular-nums">{stabilityAfter}%</p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-2">
          <motion.button whileTap={{ scale: 0.95 }} onClick={onPrevent}
            className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-semibold"
            style={{ boxShadow: "0 4px 16px hsl(var(--primary) / 0.3)" }}>
            <Zap className="w-3.5 h-3.5" />
            Prevent Decay
          </motion.button>
          <motion.button whileTap={{ scale: 0.95 }} onClick={onShield}
            className={`flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-[11px] font-semibold border transition-colors ${
              shielded
                ? "bg-success/15 border-success/30 text-success"
                : "border-border/50 text-foreground bg-secondary/30"
            }`}>
            <Shield className={`w-3.5 h-3.5 ${shielded ? "text-success" : ""}`} />
            {shielded ? "Shielded" : "Auto Shield"}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
   ═══════════════════════════════════════════════ */
export default function DecayForecastTimeline({ subjectHealth, onPreventDecay }: DecayForecastTimelineProps) {
  const [selectedSpike, setSelectedSpike] = useState<DecayEvent | null>(null);
  const [shielded, setShielded] = useState<Set<string>>(new Set());
  const [scrollOffset, setScrollOffset] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);

  const events = useMemo(() => buildTimeline(subjectHealth), [subjectHealth]);

  /* ── Build 14-day columns ── */
  const now = new Date();
  const days = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const date = addDays(now, i - Math.max(0, events.filter(e => e.isOverdue).length > 0 ? 3 : 0));
      const dayEvents = events.filter(e => {
        const diff = differenceInDays(e.dropDate, date);
        return diff === 0;
      });
      return {
        date,
        dayLabel: i === 0 ? "Today" : format(date, "EEE"),
        dateLabel: format(date, "d"),
        isToday: isToday(date),
        events: dayEvents,
      };
    });
  }, [events]);

  const overdueCount = events.filter(e => e.isOverdue).length;
  const upcomingCount = events.filter(e => !e.isOverdue && e.daysUntil <= 3).length;
  const shieldedCount = events.filter(e => shielded.has(e.topicName)).length;

  const handlePrevent = useCallback(() => {
    if (!selectedSpike) return;
    onPreventDecay(selectedSpike.subjectName, selectedSpike.topicName);
    setSelectedSpike(null);
  }, [selectedSpike, onPreventDecay]);

  const handleShield = useCallback(() => {
    if (!selectedSpike) return;
    setShielded(prev => {
      const next = new Set(prev);
      if (next.has(selectedSpike.topicName)) {
        next.delete(selectedSpike.topicName);
      } else {
        next.add(selectedSpike.topicName);
      }
      return next;
    });
  }, [selectedSpike]);

  const scrollTimeline = useCallback((dir: number) => {
    if (scrollRef.current) {
      scrollRef.current.scrollBy({ left: dir * 160, behavior: "smooth" });
    }
  }, []);

  /* ── Empty state ── */
  if (events.length === 0) {
    return (
      <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.25 }}>
        <div className="flex items-center gap-2.5 mb-4">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Predictive Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">Decay forecast &amp; prevention</p>
          </div>
        </div>
        <div className="rounded-2xl p-6 text-center" style={{
          background: "linear-gradient(135deg, hsl(var(--card)), hsl(var(--secondary) / 0.3))",
          border: "1px solid hsl(var(--border))",
        }}>
          <ShieldCheck className="w-8 h-8 text-success/40 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">All topics stable — no decay predicted</p>
        </div>
      </motion.section>
    );
  }

  return (
    <motion.section
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.25, duration: 0.5 }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-primary/15 flex items-center justify-center">
            <Clock className="w-4 h-4 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-foreground">Predictive Intelligence</h3>
            <p className="text-[10px] text-muted-foreground">14-day decay forecast</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {overdueCount > 0 && (
            <span className="text-[9px] font-semibold text-destructive bg-destructive/10 px-2 py-0.5 rounded-full">
              {overdueCount} overdue
            </span>
          )}
          {shieldedCount > 0 && (
            <span className="text-[9px] font-semibold text-success bg-success/10 px-2 py-0.5 rounded-full">
              {shieldedCount} shielded
            </span>
          )}
        </div>
      </div>

      {/* Timeline container */}
      <div
        className="rounded-2xl overflow-hidden relative"
        style={{
          background: "linear-gradient(135deg, hsl(var(--card)) 0%, hsl(var(--secondary) / 0.3) 100%)",
          border: "1px solid hsl(var(--border))",
        }}
      >
        {/* Summary bar */}
        <div className="px-4 pt-3 pb-2 flex items-center justify-between">
          <div className="flex items-center gap-3">
            {[
              { color: "hsl(0 72% 51%)", label: "Overdue", count: overdueCount },
              { color: "hsl(38 92% 50%)", label: "Soon", count: upcomingCount },
              { color: "hsl(142 71% 45%)", label: "Shielded", count: shieldedCount },
            ].filter(b => b.count > 0).map(b => (
              <div key={b.label} className="flex items-center gap-1">
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: b.color }} />
                <span className="text-[9px] text-muted-foreground">{b.count} {b.label}</span>
              </div>
            ))}
          </div>
          {/* Scroll arrows */}
          <div className="flex items-center gap-1">
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => scrollTimeline(-1)}
              className="p-1 rounded-md hover:bg-secondary/40 transition-colors">
              <ChevronLeft className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
            <motion.button whileTap={{ scale: 0.85 }} onClick={() => scrollTimeline(1)}
              className="p-1 rounded-md hover:bg-secondary/40 transition-colors">
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            </motion.button>
          </div>
        </div>

        {/* Horizontal scrollable timeline */}
        <div
          ref={scrollRef}
          className="overflow-x-auto scrollbar-hide px-3 pb-3"
          style={{ scrollbarWidth: "none" }}
        >
          <div className="flex gap-1 min-w-max relative">
            {/* Baseline */}
            <div className="absolute bottom-[38px] left-0 right-0 h-px bg-border/30" />

            {days.map((d, i) => (
              <DayColumn
                key={i}
                day={i}
                dayLabel={`${d.dayLabel}\n${d.dateLabel}`}
                events={d.events}
                isToday={d.isToday}
                onSpikeTap={(e) => setSelectedSpike(e)}
                shielded={shielded}
              />
            ))}
          </div>
        </div>

        {/* Spike action panel (overlay within card) */}
        <AnimatePresence>
          {selectedSpike && (
            <div className="px-3 pb-3">
              <SpikeActionPanel
                event={selectedSpike}
                shielded={shielded.has(selectedSpike.topicName)}
                onPrevent={handlePrevent}
                onShield={handleShield}
                onClose={() => setSelectedSpike(null)}
              />
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Predictive Shield global toggle */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="mt-2.5 rounded-xl p-3 flex items-center gap-3 border border-border/40"
        style={{ background: "hsl(var(--card) / 0.5)" }}
      >
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${
          shielded.size > 0 ? "bg-success/15" : "bg-secondary/30"
        }`}>
          <Shield className={`w-4 h-4 ${shielded.size > 0 ? "text-success" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold text-foreground">Predictive Shield</p>
          <p className="text-[9px] text-muted-foreground">
            {shielded.size > 0
              ? `${shielded.size} topic${shielded.size > 1 ? "s" : ""} auto-protected`
              : "Tap spikes to shield topics from decay"}
          </p>
        </div>
        {shielded.size > 0 && (
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-2 h-2 rounded-full bg-success shrink-0"
          />
        )}
      </motion.div>
    </motion.section>
  );
}
