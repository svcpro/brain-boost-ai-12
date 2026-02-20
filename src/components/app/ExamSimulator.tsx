import { useState, useCallback, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Play, CheckCircle2, XCircle, Loader2, RotateCcw, Clock, AlertTriangle, Zap, Flame, Skull, BookOpen, Filter, Sparkles } from "lucide-react";
import MentorSuggestion from "./MentorSuggestion";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { emitEvent } from "@/lib/eventBus";
import { useAdaptiveDifficulty } from "@/hooks/useAdaptiveDifficulty";

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface ExamSimulatorProps {
  onClose: () => void;
  retryQuestions?: Question[];
}

type Difficulty = "easy" | "medium" | "hard";

const DIFFICULTY_CONFIG: Record<Difficulty, { label: string; icon: typeof Zap; time: number; color: string; description: string }> = {
  easy: { label: "Easy", icon: Zap, time: 90, color: "text-success", description: "Basic recall, 90s per question" },
  medium: { label: "Medium", icon: Flame, time: 60, color: "text-warning", description: "Application & analysis, 60s per question" },
  hard: { label: "Hard", icon: Skull, time: 35, color: "text-destructive", description: "Deep reasoning & tricky options, 35s per question" },
};

interface SubjectOption {
  id: string;
  name: string;
}

const ExamSimulator = ({ onClose, retryQuestions }: ExamSimulatorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [retryMode] = useState(!!retryQuestions);

  // Auto-start retry mode
  useEffect(() => {
    if (retryQuestions && retryQuestions.length > 0 && questions.length === 0) {
      setQuestions(retryQuestions);
      answersRef.current = retryQuestions.map(q => ({ ...q, userAnswer: null }));
      setCurrent(0);
      setScore(0);
      setSelected(null);
      setAnswered(false);
      setFinished(false);
      setTotalTimeUsed(0);
      setTimeExpired(false);
    }
  }, [retryQuestions]); // eslint-disable-line react-hooks/exhaustive-deps
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);
  const [difficulty, setDifficulty] = useState<Difficulty>("medium");
  const [timeLeft, setTimeLeft] = useState(0);
  const [timerEnabled, setTimerEnabled] = useState(true);
  const { data: adaptiveData, predict: predictDifficulty } = useAdaptiveDifficulty();

  // Auto-set difficulty from adaptive model on mount
  useEffect(() => {
    predictDifficulty().then((result) => {
      if (result?.recommended_difficulty) {
        setDifficulty(result.recommended_difficulty);
        setQuestionCount(result.recommended_question_count || 5);
      }
    });
  }, []);
  const [timeExpired, setTimeExpired] = useState(false);
  const [totalTimeUsed, setTotalTimeUsed] = useState(0);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Subject/topic filter state
  const [allSubjects, setAllSubjects] = useState<SubjectOption[]>([]);
  const [selectedSubjectIds, setSelectedSubjectIds] = useState<Set<string>>(new Set());
  const [subjectsLoading, setSubjectsLoading] = useState(true);
  const answersRef = useRef<Array<{ question: string; options: string[]; correct: number; explanation: string; userAnswer: number | null }>>([]);

  // Load subjects on mount
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("name");
      const subs = (data || []) as SubjectOption[];
      setAllSubjects(subs);
      setSelectedSubjectIds(new Set(subs.map(s => s.id))); // all selected by default
      setSubjectsLoading(false);
    })();
  }, [user]);

  const timePerQuestion = DIFFICULTY_CONFIG[difficulty].time;

  useEffect(() => {
    if (questions.length > 0 && !finished && !answered && timerEnabled) {
      setTimeLeft(timePerQuestion);
      setTimeExpired(false);
      intervalRef.current = setInterval(() => {
        setTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current!);
            setTimeExpired(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [current, questions.length, finished, answered, timerEnabled, timePerQuestion]);

  useEffect(() => {
    if (timeExpired && !answered) {
      setAnswered(true);
      setSelected(-1);
      setTotalTimeUsed(prev => prev + timePerQuestion);
      // Track timeout as -1 answer
      if (answersRef.current[current]) {
        answersRef.current[current].userAnswer = -1;
      }
    }
  }, [timeExpired, answered, timePerQuestion]);

  const answer = (idx: number) => {
    if (answered) return;
    if (intervalRef.current) clearInterval(intervalRef.current);
    setSelected(idx);
    setAnswered(true);
    setTotalTimeUsed(prev => prev + (timePerQuestion - timeLeft));
    if (idx === questions[current].correct) setScore(s => s + 1);
    // Track answer for review
    if (answersRef.current[current]) {
      answersRef.current[current].userAnswer = idx;
    }
  };

  const generateQuiz = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      let topicsQuery = supabase
        .from("topics")
        .select("name, memory_strength, subject_id")
        .eq("user_id", user.id)
        .is("deleted_at", null)
        .order("memory_strength", { ascending: true })
        .limit(20);

      // Filter by selected subjects if not all selected
      if (selectedSubjectIds.size > 0 && selectedSubjectIds.size < allSubjects.length) {
        topicsQuery = topicsQuery.in("subject_id", Array.from(selectedSubjectIds));
      }

      const { data: topics } = await topicsQuery;

      const { data: subjects } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id);

      if (!topics || topics.length === 0) {
        toast({ title: "No topics found", description: "Add topics to the selected subjects first.", variant: "destructive" });
        setLoading(false);
        return;
      }

      const subMap = new Map(subjects?.map(s => [s.id, s.name]) || []);
      const topicList = topics.map(t => `${t.name} (${subMap.get(t.subject_id) || "Unknown"}, strength: ${t.memory_strength}%)`).join(", ");

      const { data, error } = await supabase.functions.invoke("memory-engine", {
        body: {
          action: "exam_simulate",
          topics: topicList,
          questionCount,
          difficulty,
        },
      });

      if (error) throw error;

      const content = data?.choices?.[0]?.message?.content || data?.result || "";
      const parsed = parseQuestions(content);

      if (parsed.length === 0) {
        toast({ title: "Could not generate quiz", description: "Try again with more topics.", variant: "destructive" });
      } else {
        setQuestions(parsed);
        answersRef.current = parsed.map(q => ({ ...q, userAnswer: null }));
        setCurrent(0);
        setScore(0);
        setSelected(null);
        setAnswered(false);
        setFinished(false);
        setTotalTimeUsed(0);
        setTimeExpired(false);
      }
    } catch (e: any) {
      toast({ title: "Quiz generation failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [user, questionCount, difficulty, toast, selectedSubjectIds, allSubjects]);

  const parseQuestions = (text: string): Question[] => {
    try {
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) return parsed.slice(0, questionCount);
      }
    } catch {}

    const qs: Question[] = [];
    const blocks = text.split(/\n(?=\d+[\.\)])/);
    for (const block of blocks) {
      const qMatch = block.match(/\d+[\.\)]\s*(.+)/);
      if (!qMatch) continue;
      const options: string[] = [];
      const optMatches = block.matchAll(/[A-D][\.\)]\s*(.+)/g);
      for (const m of optMatches) options.push(m[1].trim());
      const correctMatch = block.match(/correct[:\s]*([A-D])/i);
      const correct = correctMatch ? correctMatch[1].charCodeAt(0) - 65 : 0;
      const explMatch = block.match(/explanation[:\s]*(.+)/i);
      if (options.length >= 2) {
        qs.push({
          question: qMatch[1].trim(),
          options,
          correct: Math.min(correct, options.length - 1),
          explanation: explMatch?.[1]?.trim() || "",
        });
      }
    }
    return qs.slice(0, questionCount);
  };

  const saveResult = useCallback(async (finalScore: number) => {
    if (!user) return;
    try {
      await supabase.from("exam_results").insert({
        user_id: user.id,
        score: finalScore,
        total_questions: questions.length,
        difficulty,
        time_used_seconds: totalTimeUsed,
        topics: questions.map(q => q.question.slice(0, 50)).join("; "),
        questions_data: answersRef.current,
      } as any);

      // Emit exam completed event
      const pct = Math.round((finalScore / questions.length) * 100);
      emitEvent("exam_completed", {
        score: finalScore, total: questions.length, percentage: pct, difficulty,
      }, { title: "Exam Complete!", body: `You scored ${pct}% (${finalScore}/${questions.length})` });


      // Track per-question performance for spaced repetition
      for (const qa of answersRef.current) {
        const hash = btoa(encodeURIComponent(qa.question.slice(0, 200))).slice(0, 64);
        const wasWrong = qa.userAnswer !== qa.correct;

        const { data: existing } = await supabase
          .from("question_performance")
          .select("id, times_seen, times_wrong")
          .eq("user_id", user.id)
          .eq("question_hash", hash)
          .maybeSingle();

        if (existing) {
          await supabase.from("question_performance").update({
            times_seen: existing.times_seen + 1,
            times_wrong: existing.times_wrong + (wasWrong ? 1 : 0),
            last_seen_at: new Date().toISOString(),
            ...(wasWrong ? { last_wrong_at: new Date().toISOString() } : {}),
          } as any).eq("id", existing.id);
        } else {
          await supabase.from("question_performance").insert({
            user_id: user.id,
            question_hash: hash,
            question_text: qa.question,
            options: qa.options,
            correct_index: qa.correct,
            explanation: qa.explanation || "",
            times_seen: 1,
            times_wrong: wasWrong ? 1 : 0,
            last_seen_at: new Date().toISOString(),
            last_wrong_at: wasWrong ? new Date().toISOString() : null,
          } as any);
        }
      }
    } catch {}
  }, [user, questions, difficulty, totalTimeUsed]);

  const next = () => {
    if (current + 1 >= questions.length) {
      setFinished(true);
      saveResult(score);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setAnswered(false);
      setTimeExpired(false);
    }
  };

  const q = questions[current];
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;
  const timerPct = timePerQuestion > 0 ? (timeLeft / timePerQuestion) * 100 : 0;
  const timerColor = timeLeft <= 10 ? "text-destructive" : timeLeft <= 20 ? "text-warning" : "text-primary";
  const avgTimePerQ = questions.length > 0 ? Math.round(totalTimeUsed / questions.length) : 0;
  const diffConfig = DIFFICULTY_CONFIG[difficulty];

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {retryMode ? <RotateCcw className="w-5 h-5 text-warning" /> : <SlidersHorizontal className="w-5 h-5 text-primary" />}
            <h2 className="font-semibold text-foreground">{retryMode ? "Retry Mistakes" : "Exam Simulator"}</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {questions.length === 0 && !loading && !finished && (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              AI will generate quiz questions based on your weakest topics to simulate exam conditions.
            </p>

            {/* Difficulty Selector */}
            <div className="space-y-2">
              <span className="text-xs font-medium text-muted-foreground">Difficulty:</span>
              <div className="grid grid-cols-3 gap-2">
                {(Object.entries(DIFFICULTY_CONFIG) as [Difficulty, typeof DIFFICULTY_CONFIG[Difficulty]][]).map(([key, cfg]) => {
                  const Icon = cfg.icon;
                  const isSelected = difficulty === key;
                  return (
                    <button
                      key={key}
                      onClick={() => setDifficulty(key)}
                      className={`relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "border-primary bg-primary/10 ring-1 ring-primary/30"
                          : "border-border bg-secondary/20 hover:border-primary/30"
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isSelected ? cfg.color : "text-muted-foreground"}`} />
                      <span className={`text-xs font-semibold ${isSelected ? "text-foreground" : "text-muted-foreground"}`}>
                        {cfg.label}
                      </span>
                      <span className="text-[10px] text-muted-foreground">{cfg.time}s/q</span>
                    </button>
                  );
                })}
              </div>
              <p className="text-[10px] text-muted-foreground text-center">{diffConfig.description}</p>
              {adaptiveData && (
                <div className="flex items-center justify-center gap-1.5 mt-1">
                  <Sparkles className="w-3 h-3 text-primary" />
                  <span className="text-[10px] text-primary font-medium">
                    AI recommends: {adaptiveData.recommended_difficulty} ({adaptiveData.recommended_question_count} Qs)
                  </span>
                </div>
              )}
            </div>

            {/* Subject Filter */}
            {allSubjects.length > 0 && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Filter className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Subjects:</span>
                  <button
                    onClick={() => {
                      if (selectedSubjectIds.size === allSubjects.length) {
                        setSelectedSubjectIds(new Set());
                      } else {
                        setSelectedSubjectIds(new Set(allSubjects.map(s => s.id)));
                      }
                    }}
                    className="ml-auto text-[10px] text-primary hover:underline"
                  >
                    {selectedSubjectIds.size === allSubjects.length ? "Deselect all" : "Select all"}
                  </button>
                </div>
                <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto">
                  {allSubjects.map(sub => {
                    const isOn = selectedSubjectIds.has(sub.id);
                    return (
                      <button
                        key={sub.id}
                        onClick={() => {
                          setSelectedSubjectIds(prev => {
                            const next = new Set(prev);
                            if (next.has(sub.id)) next.delete(sub.id);
                            else next.add(sub.id);
                            return next;
                          });
                        }}
                        className={`px-2.5 py-1 rounded-full text-[11px] font-medium border transition-all ${
                          isOn
                            ? "border-primary bg-primary/15 text-primary"
                            : "border-border bg-secondary/20 text-muted-foreground hover:border-primary/40"
                        }`}
                      >
                        <span className="flex items-center gap-1">
                          <BookOpen className="w-3 h-3" />
                          {sub.name}
                        </span>
                      </button>
                    );
                  })}
                </div>
                {selectedSubjectIds.size === 0 && (
                  <p className="text-[10px] text-destructive">Select at least one subject</p>
                )}
              </div>
            )}

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Questions:</span>
                <select
                  value={questionCount}
                  onChange={e => setQuestionCount(Number(e.target.value))}
                  className="rounded-lg bg-secondary border border-border px-2 py-1.5 text-xs text-foreground focus:outline-none focus:ring-1 focus:ring-primary/50"
                >
                  {[3, 5, 10].map(n => <option key={n} value={n}>{n}</option>)}
                </select>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-muted-foreground" />
                <label className="flex items-center gap-1.5 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={timerEnabled}
                    onChange={e => setTimerEnabled(e.target.checked)}
                    className="rounded border-border accent-primary w-3.5 h-3.5"
                  />
                  <span className="text-xs text-muted-foreground">Timer</span>
                </label>
              </div>
            </div>
            <button
              onClick={generateQuiz}
              disabled={selectedSubjectIds.size === 0 || subjectsLoading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95 disabled:opacity-50 disabled:pointer-events-none"
            >
              <Play className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Start Exam Simulation</span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Generating {diffConfig.label.toLowerCase()} questions...</p>
          </div>
        )}

        {q && !finished && !loading && (
          <div className="space-y-4">
            {/* Difficulty badge + Progress + Timer */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                  difficulty === "easy" ? "border-success/30 bg-success/10 text-success" :
                  difficulty === "hard" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                  "border-warning/30 bg-warning/10 text-warning"
                }`}>
                  {diffConfig.label}
                </span>
                <div className="flex-1 h-1.5 rounded-full bg-secondary">
                  <motion.div
                    className="h-full rounded-full bg-primary"
                    animate={{ width: `${((current + 1) / questions.length) * 100}%` }}
                  />
                </div>
                <span className="text-xs text-muted-foreground">{current + 1}/{questions.length}</span>
              </div>

              {timerEnabled && !answered && (
                <div className="flex items-center gap-2">
                  <Clock className={`w-3.5 h-3.5 ${timerColor} ${timeLeft <= 10 ? "animate-pulse" : ""}`} />
                  <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
                    <motion.div
                      className={`h-full rounded-full transition-colors ${
                        timeLeft <= 10 ? "bg-destructive" : timeLeft <= 20 ? "bg-warning" : "bg-primary"
                      }`}
                      animate={{ width: `${timerPct}%` }}
                      transition={{ duration: 0.3 }}
                    />
                  </div>
                  <motion.span
                    key={timeLeft}
                    initial={{ scale: timeLeft <= 10 ? 1.2 : 1 }}
                    animate={{ scale: 1 }}
                    className={`text-xs font-mono font-semibold min-w-[28px] text-right ${timerColor}`}
                  >
                    {formatTime(timeLeft)}
                  </motion.span>
                </div>
              )}
            </div>

            {timeExpired && (
              <motion.div
                initial={{ opacity: 0, y: -5 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-destructive/10 border border-destructive/20"
              >
                <AlertTriangle className="w-4 h-4 text-destructive" />
                <span className="text-xs text-destructive font-medium">Time's up! The correct answer is highlighted.</span>
              </motion.div>
            )}

            <p className="text-sm font-medium text-foreground">{q.question}</p>

            <div className="space-y-2">
              {q.options.map((opt, i) => (
                <button
                  key={i}
                  onClick={() => answer(i)}
                  disabled={answered}
                  className={`w-full text-left p-3 rounded-lg text-sm transition-all border ${
                    answered
                      ? i === q.correct
                        ? "border-success bg-success/10 text-success"
                        : i === selected
                        ? "border-destructive bg-destructive/10 text-destructive"
                        : "border-border bg-secondary/20 text-muted-foreground"
                      : "border-border bg-secondary/20 text-foreground hover:border-primary/50"
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{String.fromCharCode(65 + i)}.</span>
                    <span>{opt}</span>
                    {answered && i === q.correct && <CheckCircle2 className="w-4 h-4 ml-auto text-success" />}
                    {answered && i === selected && i !== q.correct && <XCircle className="w-4 h-4 ml-auto text-destructive" />}
                  </div>
                </button>
              ))}
            </div>

            {answered && q.explanation && (
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-xs text-muted-foreground bg-secondary/30 rounded-lg p-3">
                💡 {q.explanation}
              </motion.p>
            )}

            {answered && (
              <button onClick={next} className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors">
                {current + 1 >= questions.length ? "See Results" : "Next Question"}
              </button>
            )}
          </div>
        )}

        {finished && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-center space-y-4 py-4">
            <p className="text-4xl font-bold gradient-text">{pct}%</p>
            <div className="flex items-center justify-center gap-2">
              <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full border ${
                difficulty === "easy" ? "border-success/30 bg-success/10 text-success" :
                difficulty === "hard" ? "border-destructive/30 bg-destructive/10 text-destructive" :
                "border-warning/30 bg-warning/10 text-warning"
              }`}>
                {diffConfig.label}
              </span>
              <p className="text-sm text-foreground">{score}/{questions.length} correct</p>
            </div>

            {timerEnabled && (
              <div className="flex items-center justify-center gap-4 text-xs text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Total: {formatTime(totalTimeUsed)}</span>
                </div>
                <span>•</span>
                <span>Avg: {formatTime(avgTimePerQ)}/question</span>
              </div>
            )}

            <MentorSuggestion
              score={pct}
              totalQuestions={questions.length}
              correctCount={score}
              difficulty={difficulty}
              context="exam"
              timeUsed={totalTimeUsed > 0 ? totalTimeUsed : null}
            />

            <div className="flex gap-2">
              <button onClick={() => { setQuestions([]); setFinished(false); setTotalTimeUsed(0); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl neural-gradient neural-border hover:glow-primary transition-all">
                <RotateCcw className="w-4 h-4 text-primary" />
                <span className="text-sm font-medium text-foreground">Try Again</span>
              </button>
              <button onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors">
                Close
              </button>
            </div>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
};

export default ExamSimulator;
