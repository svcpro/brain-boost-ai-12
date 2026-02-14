import { motion } from "framer-motion";
import { X, CheckCircle2, XCircle, Clock, Zap, Flame, Skull, Eye, RotateCcw } from "lucide-react";
import { format } from "date-fns";

interface ReviewQuestion {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  userAnswer: number | null;
}

interface ExamReviewModalProps {
  onClose: () => void;
  onRetryMistakes?: (questions: ReviewQuestion[]) => void;
  questions: ReviewQuestion[];
  score: number;
  totalQuestions: number;
  difficulty: string;
  timeUsed: number | null;
  date: string;
}

const DIFF_STYLE: Record<string, { icon: typeof Zap; color: string; label: string }> = {
  easy: { icon: Zap, color: "text-success", label: "Easy" },
  medium: { icon: Flame, color: "text-warning", label: "Medium" },
  hard: { icon: Skull, color: "text-destructive", label: "Hard" },
};

const ExamReviewModal = ({ onClose, onRetryMistakes, questions, score, totalQuestions, difficulty, timeUsed, date }: ExamReviewModalProps) => {
  const pct = Math.round((score / totalQuestions) * 100);
  const diff = DIFF_STYLE[difficulty] || DIFF_STYLE.medium;
  const DIcon = diff.icon;
  const mistakes = questions.filter(q => q.userAnswer !== q.correct);

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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Exam Review</h2>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-secondary transition-colors">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Summary bar */}
        <div className="flex items-center gap-3 p-3 glass rounded-xl neural-border">
          <div className="flex items-center gap-1.5">
            <DIcon className={`w-4 h-4 ${diff.color}`} />
            <span className={`text-xs font-bold ${diff.color}`}>{diff.label}</span>
          </div>
          <span className="text-xs text-muted-foreground">•</span>
          <span className={`text-sm font-bold ${pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>
            {pct}% ({score}/{totalQuestions})
          </span>
          {timeUsed && (
            <>
              <span className="text-xs text-muted-foreground">•</span>
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="w-3 h-3" />
                {formatTime(timeUsed)}
              </div>
            </>
          )}
          <span className="text-[10px] text-muted-foreground ml-auto">
            {format(new Date(date), "MMM d, yyyy")}
          </span>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          {questions.map((q, qi) => {
            const wasCorrect = q.userAnswer === q.correct;
            const wasSkipped = q.userAnswer === null || q.userAnswer === -1;
            return (
              <motion.div
                key={qi}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: qi * 0.05 }}
                className="glass rounded-xl neural-border p-4 space-y-3"
              >
                <div className="flex items-start gap-2">
                  <span className={`flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${
                    wasSkipped ? "bg-muted text-muted-foreground" :
                    wasCorrect ? "bg-success/15 text-success" : "bg-destructive/15 text-destructive"
                  }`}>
                    {qi + 1}
                  </span>
                  <p className="text-sm font-medium text-foreground leading-snug">{q.question}</p>
                </div>

                <div className="space-y-1.5 pl-8">
                  {q.options.map((opt, oi) => {
                    const isCorrect = oi === q.correct;
                    const isUserPick = oi === q.userAnswer;
                    let style = "border-border bg-secondary/10 text-muted-foreground";
                    if (isCorrect) style = "border-success bg-success/10 text-success";
                    else if (isUserPick && !isCorrect) style = "border-destructive bg-destructive/10 text-destructive";

                    return (
                      <div key={oi} className={`flex items-center gap-2 p-2.5 rounded-lg text-xs border ${style}`}>
                        <span className="font-medium">{String.fromCharCode(65 + oi)}.</span>
                        <span className="flex-1">{opt}</span>
                        {isCorrect && <CheckCircle2 className="w-3.5 h-3.5 text-success flex-shrink-0" />}
                        {isUserPick && !isCorrect && <XCircle className="w-3.5 h-3.5 text-destructive flex-shrink-0" />}
                        {isUserPick && isCorrect && (
                          <span className="text-[9px] font-medium text-success">✓ Your answer</span>
                        )}
                        {isUserPick && !isCorrect && (
                          <span className="text-[9px] font-medium text-destructive">Your answer</span>
                        )}
                      </div>
                    );
                  })}
                </div>

                {wasSkipped && (
                  <p className="text-[10px] text-muted-foreground pl-8 italic">⏱ Time expired — no answer given</p>
                )}

                {q.explanation && (
                  <div className="pl-8 text-[11px] text-muted-foreground bg-secondary/20 rounded-lg p-2.5">
                    💡 {q.explanation}
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>

        <div className="flex gap-2">
          {mistakes.length > 0 && onRetryMistakes && (
            <button
              onClick={() => onRetryMistakes(mistakes)}
              className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95"
            >
              <RotateCcw className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Retry {mistakes.length} Mistake{mistakes.length > 1 ? "s" : ""}</span>
            </button>
          )}
          <button
            onClick={onClose}
            className={`${mistakes.length > 0 && onRetryMistakes ? "" : "w-full "}flex-1 py-2.5 rounded-xl bg-secondary text-foreground text-sm font-medium hover:bg-secondary/80 transition-colors`}
          >
            Close Review
          </button>
        </div>
      </motion.div>
    </div>
  );
};

export default ExamReviewModal;
