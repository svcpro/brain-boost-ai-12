import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Activity, Brain, Target, Zap, AlertTriangle, Loader2, RefreshCw, Pause, Play } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface AIEvent {
  id: string;
  type: string;
  model: string;
  confidence: number | null;
  latency: number | null;
  timestamp: string;
  correct: boolean | null;
}

export default function RealTimeActivityStream() {
  const [events, setEvents] = useState<AIEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [paused, setPaused] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchEvents = async () => {
    try {
      const [predsRes, eventsRes] = await Promise.all([
        supabase.from("model_predictions").select("id, model_name, confidence, latency_ms, is_correct, created_at")
          .order("created_at", { ascending: false }).limit(30),
        supabase.from("ml_events").select("id, event_type, event_category, created_at")
          .order("created_at", { ascending: false }).limit(20),
      ]);

      const preds: AIEvent[] = (predsRes.data || []).map(p => ({
        id: p.id,
        type: "prediction",
        model: p.model_name,
        confidence: p.confidence ? Math.round(p.confidence * 100) : null,
        latency: p.latency_ms,
        correct: p.is_correct,
        timestamp: p.created_at,
      }));

      const mlEvents: AIEvent[] = (eventsRes.data || []).map(e => ({
        id: e.id,
        type: e.event_type,
        model: e.event_category,
        confidence: null,
        latency: null,
        correct: null,
        timestamp: e.created_at,
      }));

      const all = [...preds, ...mlEvents].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()).slice(0, 40);
      setEvents(all);
      setLoading(false);
    } catch (e) {
      console.error("Activity stream fetch failed:", e);
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEvents();
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  useEffect(() => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (!paused) {
      intervalRef.current = setInterval(fetchEvents, 10000);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [paused]);

  const timeAgo = (d: string) => {
    const diff = Date.now() - new Date(d).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const getIcon = (type: string) => {
    if (type === "prediction") return Target;
    if (type.includes("study")) return Brain;
    if (type.includes("burnout") || type.includes("risk")) return AlertTriangle;
    return Zap;
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="w-5 h-5 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${paused ? "bg-warning" : "bg-success animate-pulse"}`} />
          <span className="text-xs text-muted-foreground">{paused ? "Paused" : "Live"} · {events.length} events</span>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setPaused(!paused)} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            {paused ? <Play className="w-4 h-4 text-success" /> : <Pause className="w-4 h-4 text-warning" />}
          </button>
          <button onClick={fetchEvents} className="p-2 rounded-lg hover:bg-secondary transition-colors">
            <RefreshCw className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>
      </div>

      <div className="space-y-1.5 max-h-[600px] overflow-y-auto">
        <AnimatePresence>
          {events.map((event, i) => {
            const Icon = getIcon(event.type);
            return (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ delay: i * 0.02 }}
                className="glass rounded-lg neural-border p-3 flex items-center gap-3"
              >
                <Icon className="w-4 h-4 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-foreground">{event.model.replace(/_/g, " ")}</span>
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-secondary text-muted-foreground">{event.type}</span>
                  </div>
                  <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                    {event.confidence !== null && <span>Conf: {event.confidence}%</span>}
                    {event.latency !== null && <span>· {event.latency}ms</span>}
                    {event.correct !== null && (
                      <span className={event.correct ? "text-success" : "text-destructive"}>
                        · {event.correct ? "✓ Correct" : "✗ Wrong"}
                      </span>
                    )}
                  </div>
                </div>
                <span className="text-[10px] text-muted-foreground shrink-0">{timeAgo(event.timestamp)}</span>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {events.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8">No AI activity recorded yet</p>
        )}
      </div>
    </div>
  );
}
