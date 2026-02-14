import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { AlertTriangle, RotateCcw, CheckCircle2, XCircle, ChevronDown, ChevronUp, Flame, Bell, BellOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { formatDistanceToNow } from "date-fns";

interface WeakQuestion {
  id: string;
  question_text: string;
  options: string[];
  correct_index: number;
  explanation: string | null;
  times_seen: number;
  times_wrong: number;
  last_wrong_at: string | null;
}

interface WeakQuestionsProps {
  onRetryWeak?: (questions: any[]) => void;
}

const WeakQuestions = ({ onRetryWeak }: WeakQuestionsProps) => {
  const { user } = useAuth();
  const [questions, setQuestions] = useState<WeakQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [remindersOn, setRemindersOn] = useState(true);
  const [remindersLoading, setRemindersLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      // Load weak questions
      const { data } = await supabase
        .from("question_performance")
        .select("*")
        .eq("user_id", user.id)
        .gte("times_wrong", 2)
        .order("times_wrong", { ascending: false })
        .limit(15);
      setQuestions((data as unknown as WeakQuestion[]) || []);

      // Load reminder pref
      const { data: profile } = await supabase
        .from("profiles")
        .select("study_preferences")
        .eq("id", user.id)
        .maybeSingle();
      const prefs = (profile?.study_preferences as Record<string, any>) || {};
      setRemindersOn(prefs.weak_question_reminders !== false);

      setLoading(false);
    })();
  }, [user]);

  const toggleReminders = async () => {
    if (!user) return;
    setRemindersLoading(true);
    const newVal = !remindersOn;

    // Request notification permission if enabling
    if (newVal && "Notification" in window && Notification.permission !== "granted") {
      await Notification.requestPermission();
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("study_preferences")
      .eq("id", user.id)
      .maybeSingle();
    const existing = (profile?.study_preferences as Record<string, any>) || {};
    await supabase.from("profiles").update({
      study_preferences: { ...existing, weak_question_reminders: newVal },
    }).eq("id", user.id);

    setRemindersOn(newVal);
    setRemindersLoading(false);
  };

  if (loading) {
    return (
      <div className="glass rounded-xl neural-border p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/3 mb-3" />
        <div className="h-16 bg-secondary rounded" />
      </div>
    );
  }

  if (questions.length === 0) return null;

  const wrongRate = (q: WeakQuestion) => Math.round((q.times_wrong / q.times_seen) * 100);

  const retryAll = () => {
    if (!onRetryWeak) return;
    const retryQs = questions.map(q => ({
      question: q.question_text,
      options: q.options,
      correct: q.correct_index,
      explanation: q.explanation || "",
      userAnswer: null,
    }));
    onRetryWeak(retryQs);
  };

  return (
    <div className="glass rounded-xl neural-border p-4 space-y-3">
      <div className="flex items-center gap-2">
        <AlertTriangle className="w-4 h-4 text-warning" />
        <h3 className="text-sm font-semibold text-foreground">Weak Questions</h3>
        <span className="text-[10px] text-muted-foreground ml-auto">
          {questions.length} flagged
        </span>
        <button
          onClick={toggleReminders}
          disabled={remindersLoading}
          className={`p-1 rounded-lg transition-colors ${remindersOn ? "text-primary hover:bg-primary/10" : "text-muted-foreground hover:bg-secondary"}`}
          title={remindersOn ? "Reminders on — click to disable" : "Reminders off — click to enable"}
        >
          {remindersOn ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
        </button>
      </div>

      <p className="text-[10px] text-muted-foreground">
        Questions you've answered wrong 2+ times across exams. Practice these for better retention.
      </p>

      {onRetryWeak && questions.length > 0 && (
        <button
          onClick={retryAll}
          className="w-full flex items-center justify-center gap-2 py-2 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95"
        >
          <RotateCcw className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-medium text-foreground">Retry All Weak Questions ({questions.length})</span>
        </button>
      )}

      <div className="space-y-1.5 max-h-60 overflow-y-auto">
        {questions.map((q) => {
          const rate = wrongRate(q);
          const isOpen = expanded === q.id;
          return (
            <motion.div
              key={q.id}
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-lg border border-border/50 bg-secondary/10 overflow-hidden"
            >
              <button
                onClick={() => setExpanded(isOpen ? null : q.id)}
                className="w-full flex items-center gap-2 p-2.5 text-left"
              >
                <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex flex-col items-center justify-center ${
                  rate >= 75 ? "bg-destructive/15" : rate >= 50 ? "bg-warning/15" : "bg-warning/10"
                }`}>
                  <Flame className={`w-3 h-3 ${rate >= 75 ? "text-destructive" : "text-warning"}`} />
                  <span className={`text-[8px] font-bold ${rate >= 75 ? "text-destructive" : "text-warning"}`}>
                    {rate}%
                  </span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-foreground line-clamp-1">{q.question_text}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="text-[9px] text-muted-foreground">
                      Wrong {q.times_wrong}/{q.times_seen} times
                    </span>
                    {q.last_wrong_at && (
                      <span className="text-[9px] text-muted-foreground">
                        · {formatDistanceToNow(new Date(q.last_wrong_at), { addSuffix: true })}
                      </span>
                    )}
                  </div>
                </div>
                {isOpen ? (
                  <ChevronUp className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                ) : (
                  <ChevronDown className="w-3.5 h-3.5 text-muted-foreground flex-shrink-0" />
                )}
              </button>

              {isOpen && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  className="px-2.5 pb-2.5 space-y-1.5"
                >
                  {q.options.map((opt, oi) => (
                    <div
                      key={oi}
                      className={`flex items-center gap-2 p-2 rounded text-[11px] border ${
                        oi === q.correct_index
                          ? "border-success/30 bg-success/5 text-success"
                          : "border-border/30 bg-secondary/10 text-muted-foreground"
                      }`}
                    >
                      <span className="font-medium">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{opt}</span>
                      {oi === q.correct_index && <CheckCircle2 className="w-3 h-3 text-success flex-shrink-0" />}
                    </div>
                  ))}
                  {q.explanation && (
                    <p className="text-[10px] text-muted-foreground bg-secondary/20 rounded p-2">
                      💡 {q.explanation}
                    </p>
                  )}
                </motion.div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default WeakQuestions;
