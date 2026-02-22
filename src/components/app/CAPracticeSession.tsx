import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Newspaper, CheckCircle2, XCircle, ChevronRight, Trophy, RotateCcw, Sparkles, BookOpen, Loader2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { useCAStudentQuestions, useTodayCAEvents } from "@/hooks/useCurrentAffairs";

interface CAQuestion {
  id: string;
  question_text: string;
  options: string[] | null;
  correct_answer: string | null;
  explanation: string | null;
  difficulty: string | null;
  ca_events: { title: string; category: string; summary: string } | null;
}

export default function CAPracticeSession() {
  const { data: questions, isLoading } = useCAStudentQuestions(20);
  const { data: todayEvents } = useTodayCAEvents();
  const [started, setStarted] = useState(false);
  const [currentQ, setCurrentQ] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [answers, setAnswers] = useState<(number | null)[]>([]);

  const shuffled = useMemo(() => {
    if (!questions) return [];
    return [...questions].sort(() => Math.random() - 0.5).slice(0, 10);
  }, [questions]);

  const q = shuffled[currentQ] as CAQuestion | undefined;
  const options = q?.options && Array.isArray(q.options) ? q.options : [];
  const correctIdx = options.indexOf(q?.correct_answer || "");

  const handleSelect = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === correctIdx) setScore(s => s + 1);
    setAnswers(prev => [...prev, idx]);
  };

  const handleNext = () => {
    if (currentQ + 1 >= shuffled.length) {
      setFinished(true);
    } else {
      setCurrentQ(c => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const restart = () => {
    setStarted(false);
    setCurrentQ(0);
    setSelected(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
    setAnswers([]);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Landing: show today's events + start quiz
  if (!started) {
    return (
      <div className="space-y-4">
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl border border-cyan-500/20 bg-gradient-to-br from-cyan-950/30 via-card/80 to-emerald-950/20 p-5"
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-cyan-500/30 to-emerald-500/30 flex items-center justify-center">
              <Newspaper className="w-5 h-5 text-cyan-400" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground">Current Affairs Quiz</h2>
              <p className="text-xs text-muted-foreground">Test your knowledge on latest events</p>
            </div>
          </div>

          {shuffled.length > 0 ? (
            <Button onClick={() => setStarted(true)}
              className="w-full bg-gradient-to-r from-cyan-600 to-emerald-600 hover:from-cyan-500 hover:to-emerald-500 text-white"
            >
              <Sparkles className="w-4 h-4 mr-2" /> Start Quiz ({shuffled.length} Questions)
            </Button>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-4">No approved questions available yet. Check back later!</p>
          )}
        </motion.div>

        {/* Today's Events Summary */}
        {todayEvents && todayEvents.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-foreground flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5 text-primary" /> Today's Current Affairs
            </p>
            {todayEvents.slice(0, 5).map((ev: any, i: number) => (
              <motion.div key={ev.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Card className="border-border/40 bg-card/60">
                  <CardContent className="p-3">
                    <div className="flex items-start gap-2">
                      <Badge variant="outline" className="text-[9px] capitalize shrink-0 mt-0.5">{ev.category}</Badge>
                      <div>
                        <p className="text-xs font-medium text-foreground leading-snug">{ev.title}</p>
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{ev.summary}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Finished
  if (finished) {
    const pct = Math.round((score / shuffled.length) * 100);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="space-y-4">
        <Card className="border-border/50 bg-gradient-to-br from-card to-secondary/20">
          <CardContent className="p-6 text-center space-y-4">
            <Trophy className={`w-12 h-12 mx-auto ${pct >= 70 ? "text-amber-400" : pct >= 40 ? "text-blue-400" : "text-muted-foreground"}`} />
            <div>
              <p className="text-2xl font-bold text-foreground">{score}/{shuffled.length}</p>
              <p className="text-sm text-muted-foreground">Current Affairs Score</p>
            </div>
            <Progress value={pct} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {pct >= 80 ? "Excellent! You're well-informed 🎯" :
               pct >= 50 ? "Good effort! Keep reading the news 📰" :
               "Keep practicing! Read daily current affairs 📖"}
            </p>
            <Button onClick={restart} variant="outline" className="gap-2">
              <RotateCcw className="w-4 h-4" /> Try Again
            </Button>
          </CardContent>
        </Card>

        {/* Review answers */}
        <div className="space-y-2">
          <p className="text-xs font-semibold text-foreground">Review</p>
          {shuffled.map((sq: any, i: number) => {
            const opts = Array.isArray(sq.options) ? sq.options : [];
            const cIdx = opts.indexOf(sq.correct_answer);
            const userAns = answers[i];
            const isCorrect = userAns === cIdx;
            return (
              <Card key={sq.id} className={`border-border/40 ${isCorrect ? "bg-emerald-500/5" : "bg-destructive/5"}`}>
                <CardContent className="p-3">
                  <div className="flex items-start gap-2 mb-1">
                    {isCorrect ? <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" /> : <XCircle className="w-4 h-4 text-destructive shrink-0 mt-0.5" />}
                    <p className="text-xs text-foreground">{sq.question_text}</p>
                  </div>
                  {!isCorrect && <p className="text-[10px] text-emerald-400 ml-6">Correct: {sq.correct_answer}</p>}
                  {sq.explanation && <p className="text-[10px] text-muted-foreground ml-6 mt-1">{sq.explanation}</p>}
                </CardContent>
              </Card>
            );
          })}
        </div>
      </motion.div>
    );
  }

  // Quiz in progress
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold text-foreground">Question {currentQ + 1}/{shuffled.length}</p>
        <Badge variant="outline" className="text-[10px]">Score: {score}</Badge>
      </div>
      <Progress value={((currentQ + (answered ? 1 : 0)) / shuffled.length) * 100} className="h-1.5" />

      <AnimatePresence mode="wait">
        <motion.div key={currentQ} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
          {q?.ca_events && (
            <Badge variant="outline" className="text-[9px] capitalize mb-2">{q.ca_events.category} · {q.ca_events.title?.substring(0, 50)}</Badge>
          )}
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4 space-y-3">
              <p className="text-sm font-medium text-foreground leading-relaxed">{q?.question_text}</p>
              <div className="space-y-2">
                {options.map((opt, i) => {
                  const isCorrect = i === correctIdx;
                  const isSelected = i === selected;
                  let cls = "border-border/50 bg-secondary/20 hover:bg-secondary/40 cursor-pointer";
                  if (answered) {
                    if (isCorrect) cls = "border-emerald-500/40 bg-emerald-500/10";
                    else if (isSelected) cls = "border-destructive/40 bg-destructive/10";
                    else cls = "border-border/30 bg-secondary/10 opacity-60";
                  }
                  return (
                    <motion.button key={i} whileTap={!answered ? { scale: 0.98 } : {}}
                      onClick={() => handleSelect(i)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${cls}`}
                    >
                      <span className="text-xs text-foreground">
                        <span className="font-semibold mr-2">{String.fromCharCode(65 + i)}.</span>
                        {opt}
                      </span>
                    </motion.button>
                  );
                })}
              </div>

              {answered && q?.explanation && (
                <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }}
                  className="bg-secondary/20 rounded-lg p-3"
                >
                  <p className="text-[10px] text-muted-foreground">{q.explanation}</p>
                </motion.div>
              )}

              {answered && (
                <Button onClick={handleNext} className="w-full gap-2" size="sm">
                  {currentQ + 1 >= shuffled.length ? "See Results" : "Next Question"} <ChevronRight className="w-4 h-4" />
                </Button>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
