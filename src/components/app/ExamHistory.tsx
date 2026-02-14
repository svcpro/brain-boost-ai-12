import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { History, Zap, Flame, Skull, Trophy, Calendar, Clock, Eye, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { format } from "date-fns";
import ExamReviewModal from "./ExamReviewModal";

interface ExamResult {
  id: string;
  score: number;
  total_questions: number;
  difficulty: string;
  time_used_seconds: number | null;
  topics: string | null;
  questions_data: any[] | null;
  created_at: string;
}

const DIFF_STYLE: Record<string, { icon: typeof Zap; color: string; bg: string; border: string }> = {
  easy: { icon: Zap, color: "text-success", bg: "bg-success/10", border: "border-success/30" },
  medium: { icon: Flame, color: "text-warning", bg: "bg-warning/10", border: "border-warning/30" },
  hard: { icon: Skull, color: "text-destructive", bg: "bg-destructive/10", border: "border-destructive/30" },
};

interface ExamHistoryProps {
  onRetryMistakes?: (questions: any[]) => void;
}

const ExamHistory = ({ onRetryMistakes }: ExamHistoryProps = {}) => {
  const { user } = useAuth();
  const [results, setResults] = useState<ExamResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewResult, setReviewResult] = useState<ExamResult | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("exam_results")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      setResults((data as unknown as ExamResult[]) || []);
      setLoading(false);
    })();
  }, [user]);

  if (loading) {
    return (
      <div className="glass rounded-xl neural-border p-4 animate-pulse">
        <div className="h-4 bg-secondary rounded w-1/3 mb-3" />
        <div className="h-20 bg-secondary rounded" />
      </div>
    );
  }

  if (results.length === 0) return null;

  const avgScore = Math.round(results.reduce((s, r) => s + (r.score / r.total_questions) * 100, 0) / results.length);
  const bestScore = Math.max(...results.map(r => Math.round((r.score / r.total_questions) * 100)));
  const totalExams = results.length;

  const recent3 = results.slice(0, Math.min(3, results.length));
  const prev3 = results.slice(3, Math.min(6, results.length));
  const recentAvg = recent3.reduce((s, r) => s + (r.score / r.total_questions) * 100, 0) / recent3.length;
  const prevAvg = prev3.length > 0 ? prev3.reduce((s, r) => s + (r.score / r.total_questions) * 100, 0) / prev3.length : recentAvg;
  const trend = Math.round(recentAvg - prevAvg);

  const chartData = results.slice(0, 10).reverse();
  const chartW = 280;
  const chartH = 60;
  const chartPoints = chartData.map((r, i) => ({
    x: chartData.length > 1 ? (i / (chartData.length - 1)) * chartW : chartW / 2,
    y: chartH - ((r.score / r.total_questions) * 100 / 100) * (chartH - 6) - 3,
  }));
  const pathD = chartPoints.length > 1 ? `M ${chartPoints.map(p => `${p.x},${p.y}`).join(" L ")}` : "";
  const areaD = pathD ? `${pathD} L ${chartW},${chartH} L 0,${chartH} Z` : "";

  const formatTime = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return m > 0 ? `${m}:${sec.toString().padStart(2, "0")}` : `${sec}s`;
  };

  return (
    <>
      <div className="glass rounded-xl neural-border p-4 space-y-3">
        <div className="flex items-center gap-2">
          <History className="w-4 h-4 text-primary" />
          <h3 className="text-sm font-semibold text-foreground">Exam History</h3>
          <span className="text-[10px] text-muted-foreground ml-auto">{totalExams} exams</span>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-2">
          <div className="glass rounded-lg p-2 neural-border text-center">
            <p className="text-lg font-bold gradient-text">{avgScore}%</p>
            <p className="text-[9px] text-muted-foreground">Avg Score</p>
          </div>
          <div className="glass rounded-lg p-2 neural-border text-center">
            <div className="flex items-center justify-center gap-1">
              <Trophy className="w-3.5 h-3.5 text-warning" />
              <p className="text-lg font-bold text-foreground">{bestScore}%</p>
            </div>
            <p className="text-[9px] text-muted-foreground">Best</p>
          </div>
          <div className="glass rounded-lg p-2 neural-border text-center">
            <p className={`text-lg font-bold ${trend >= 0 ? "text-success" : "text-destructive"}`}>
              {trend >= 0 ? "+" : ""}{trend}%
            </p>
            <p className="text-[9px] text-muted-foreground">Trend</p>
          </div>
        </div>

        {/* Mini trend chart */}
        {chartData.length > 1 && (
          <div className="glass rounded-lg p-3 neural-border">
            <svg viewBox={`-5 -3 ${chartW + 10} ${chartH + 6}`} className="w-full h-16">
              {areaD && <path d={areaD} fill="hsl(var(--primary) / 0.08)" />}
              {pathD && (
                <motion.path
                  d={pathD}
                  fill="none"
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1 }}
                />
              )}
              {chartPoints.map((p, i) => {
                const r = chartData[i];
                const fillColor = r.difficulty === "easy" ? "hsl(var(--success))" : r.difficulty === "hard" ? "hsl(var(--destructive))" : "hsl(var(--warning))";
                return <circle key={i} cx={p.x} cy={p.y} r="3" fill={fillColor} />;
              })}
            </svg>
            <div className="flex justify-between">
              <span className="text-[8px] text-muted-foreground">
                {chartData[0] ? format(new Date(chartData[0].created_at), "MMM d") : ""}
              </span>
              <span className="text-[8px] text-muted-foreground">
                {chartData[chartData.length - 1] ? format(new Date(chartData[chartData.length - 1].created_at), "MMM d") : ""}
              </span>
            </div>
          </div>
        )}

        {/* Recent results list */}
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {results.slice(0, 8).map((r) => {
            const pct = Math.round((r.score / r.total_questions) * 100);
            const style = DIFF_STYLE[r.difficulty] || DIFF_STYLE.medium;
            const DIcon = style.icon;
            const hasReview = r.questions_data && Array.isArray(r.questions_data) && r.questions_data.length > 0;
            return (
              <motion.div
                key={r.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 p-2 rounded-lg bg-secondary/20 border border-border/50"
              >
                <div className={`p-1 rounded ${style.bg} ${style.border} border`}>
                  <DIcon className={`w-3 h-3 ${style.color}`} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className={`text-xs font-bold ${pct >= 80 ? "text-success" : pct >= 50 ? "text-warning" : "text-destructive"}`}>
                      {pct}%
                    </span>
                    <span className="text-[10px] text-muted-foreground">
                      {r.score}/{r.total_questions}
                    </span>
                  </div>
                </div>
                {hasReview && (
                  <>
                    <button
                      onClick={() => setReviewResult(r)}
                      className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors"
                    >
                      <Eye className="w-2.5 h-2.5" />
                      Review
                    </button>
                    {onRetryMistakes && r.questions_data!.some((q: any) => q.userAnswer !== q.correct) && (
                      <button
                        onClick={() => {
                          const mistakes = (r.questions_data as any[]).filter((q: any) => q.userAnswer !== q.correct);
                          onRetryMistakes(mistakes);
                        }}
                        className="flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-medium text-warning hover:bg-warning/10 transition-colors"
                      >
                        <RotateCcw className="w-2.5 h-2.5" />
                        Retry
                      </button>
                    )}
                  </>
                )}
                {r.time_used_seconds && (
                  <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                    <Clock className="w-2.5 h-2.5" />
                    {formatTime(r.time_used_seconds)}
                  </div>
                )}
                <div className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                  <Calendar className="w-2.5 h-2.5" />
                  {format(new Date(r.created_at), "MMM d")}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {reviewResult && reviewResult.questions_data && (
        <ExamReviewModal
          onClose={() => setReviewResult(null)}
          onRetryMistakes={onRetryMistakes ? (mistakes) => {
            setReviewResult(null);
            onRetryMistakes(mistakes);
          } : undefined}
          questions={reviewResult.questions_data as any[]}
          score={reviewResult.score}
          totalQuestions={reviewResult.total_questions}
          difficulty={reviewResult.difficulty}
          timeUsed={reviewResult.time_used_seconds}
          date={reviewResult.created_at}
        />
      )}
    </>
  );
};

export default ExamHistory;
