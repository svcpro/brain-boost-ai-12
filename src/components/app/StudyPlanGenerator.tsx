import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Sparkles, Clock, BookOpen, RotateCcw, ChevronDown, ChevronUp, Lightbulb, Zap } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface Session {
  topic: string;
  subject: string;
  duration_minutes: number;
  mode: string;
  reason: string;
}

interface PlanDay {
  day_name: string;
  date: string;
  focus: string;
  total_minutes: number;
  sessions: Session[];
}

interface StudyPlan {
  summary: string;
  days: PlanDay[];
}

const modeConfig: Record<string, { icon: typeof BookOpen; color: string; bg: string }> = {
  "review": { icon: RotateCcw, color: "text-primary", bg: "bg-primary/10" },
  "deep-study": { icon: BookOpen, color: "text-warning", bg: "bg-warning/10" },
  "practice": { icon: Zap, color: "text-success", bg: "bg-success/10" },
  "light-review": { icon: Lightbulb, color: "text-muted-foreground", bg: "bg-secondary" },
};

const StudyPlanGenerator = () => {
  const [plan, setPlan] = useState<StudyPlan | null>(null);
  const [loading, setLoading] = useState(false);
  const [expandedDay, setExpandedDay] = useState<number | null>(0);
  const { toast } = useToast();

  const generatePlan = async () => {
    setLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({ title: "Not logged in", variant: "destructive" });
        return;
      }

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/memory-engine`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({ action: "generate_plan" }),
        }
      );

      if (!response.ok) {
        const err = await response.json().catch(() => ({}));
        throw new Error(err.error || `Error ${response.status}`);
      }

      const data = await response.json();
      setPlan(data.plan);
      setExpandedDay(0);
      toast({ title: "Study plan generated! 🧠", description: "Your personalized weekly schedule is ready." });
    } catch (e: any) {
      console.error("Plan generation error:", e);
      toast({ title: "Failed to generate plan", description: e.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Generate Button */}
      <motion.button
        onClick={generatePlan}
        disabled={loading}
        className="w-full glass rounded-xl p-5 neural-border hover:glow-primary transition-all duration-300 text-left group disabled:opacity-60"
        whileTap={{ scale: 0.98 }}
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-xl bg-primary/10 neural-border">
            {loading ? (
              <Sparkles className="w-6 h-6 text-primary animate-pulse" />
            ) : (
              <CalendarDays className="w-6 h-6 text-primary" />
            )}
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-foreground mb-1 group-hover:text-primary transition-colors">
              {loading ? "Generating your plan..." : plan ? "Regenerate Study Plan" : "AI Study Plan Generator"}
            </h3>
            <p className="text-sm text-muted-foreground">
              {loading
                ? "Analyzing forgetting curves & exam timeline..."
                : "Get a personalized 7-day schedule based on your memory data."}
            </p>
          </div>
        </div>
      </motion.button>

      {/* Plan Display */}
      <AnimatePresence>
        {plan && !loading && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-3"
          >
            {/* Summary */}
            <div className="glass rounded-xl p-4 neural-border">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 text-primary" />
                <span className="text-xs font-semibold text-foreground">AI Strategy</span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">{plan.summary}</p>
            </div>

            {/* Days */}
            {plan.days.map((day, i) => {
              const isExpanded = expandedDay === i;
              const isToday = i === 0;

              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.05 }}
                  className={`glass rounded-xl neural-border overflow-hidden ${isToday ? "ring-1 ring-primary/30" : ""}`}
                >
                  <button
                    onClick={() => setExpandedDay(isExpanded ? null : i)}
                    className="w-full p-4 flex items-center gap-3 text-left"
                  >
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-xs font-bold ${
                      isToday ? "bg-primary text-primary-foreground" : "bg-secondary text-foreground"
                    }`}>
                      {day.day_name.slice(0, 3)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{day.focus}</p>
                      <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                        <Clock className="w-3 h-3" />
                        <span>{day.total_minutes} min</span>
                        <span>•</span>
                        <span>{day.sessions.length} sessions</span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="w-4 h-4 text-muted-foreground" />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    )}
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 space-y-2">
                          {day.sessions.map((session, j) => {
                            const config = modeConfig[session.mode] || modeConfig["review"];
                            const Icon = config.icon;

                            return (
                              <div
                                key={j}
                                className="flex items-start gap-3 p-3 rounded-lg bg-secondary/30 border border-border"
                              >
                                <div className={`p-1.5 rounded-md ${config.bg}`}>
                                  <Icon className={`w-3.5 h-3.5 ${config.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between">
                                    <p className="text-xs font-medium text-foreground truncate">{session.topic}</p>
                                    <span className="text-[10px] text-muted-foreground ml-2 shrink-0">
                                      {session.duration_minutes}m
                                    </span>
                                  </div>
                                  <p className="text-[10px] text-muted-foreground">{session.subject} • {session.mode}</p>
                                  <p className="text-[10px] text-muted-foreground/70 mt-0.5 italic">{session.reason}</p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default StudyPlanGenerator;
