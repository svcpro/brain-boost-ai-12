import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { SlidersHorizontal, X, Play, CheckCircle2, XCircle, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

interface Question {
  question: string;
  options: string[];
  correct: number;
  explanation: string;
}

interface ExamSimulatorProps {
  onClose: () => void;
}

const ExamSimulator = ({ onClose }: ExamSimulatorProps) => {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);
  const [questionCount, setQuestionCount] = useState(5);

  const generateQuiz = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // Get user's topics
      const { data: topics } = await supabase
        .from("topics")
        .select("name, memory_strength, subject_id")
        .eq("user_id", user.id)
        .order("memory_strength", { ascending: true })
        .limit(20);

      const { data: subjects } = await supabase
        .from("subjects")
        .select("id, name")
        .eq("user_id", user.id);

      if (!topics || topics.length === 0) {
        toast({ title: "No topics found", description: "Add subjects and topics first.", variant: "destructive" });
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
        },
      });

      if (error) throw error;

      // Parse questions from AI response
      const content = data?.choices?.[0]?.message?.content || data?.result || "";
      const parsed = parseQuestions(content);

      if (parsed.length === 0) {
        toast({ title: "Could not generate quiz", description: "Try again with more topics.", variant: "destructive" });
      } else {
        setQuestions(parsed);
        setCurrent(0);
        setScore(0);
        setSelected(null);
        setAnswered(false);
        setFinished(false);
      }
    } catch (e: any) {
      toast({ title: "Quiz generation failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  }, [user, questionCount, toast]);

  const parseQuestions = (text: string): Question[] => {
    try {
      // Try JSON parse first
      const jsonMatch = text.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0]);
        if (Array.isArray(parsed)) return parsed.slice(0, questionCount);
      }
    } catch {}

    // Fallback: parse numbered questions
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

  const answer = (idx: number) => {
    if (answered) return;
    setSelected(idx);
    setAnswered(true);
    if (idx === questions[current].correct) setScore(s => s + 1);
  };

  const next = () => {
    if (current + 1 >= questions.length) {
      setFinished(true);
    } else {
      setCurrent(c => c + 1);
      setSelected(null);
      setAnswered(false);
    }
  };

  const q = questions[current];
  const pct = questions.length > 0 ? Math.round((score / questions.length) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-lg glass rounded-2xl neural-border p-5 space-y-4 max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-primary" />
            <h2 className="font-semibold text-foreground">Exam Simulator</h2>
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
            <button
              onClick={generateQuiz}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl neural-gradient neural-border hover:glow-primary transition-all active:scale-95"
            >
              <Play className="w-4 h-4 text-primary" />
              <span className="text-sm font-medium text-foreground">Start Exam Simulation</span>
            </button>
          </div>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-12 gap-3">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
            <p className="text-sm text-muted-foreground">Generating questions from your topics...</p>
          </div>
        )}

        {q && !finished && !loading && (
          <div className="space-y-4">
            {/* Progress */}
            <div className="flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-secondary">
                <motion.div
                  className="h-full rounded-full bg-primary"
                  animate={{ width: `${((current + 1) / questions.length) * 100}%` }}
                />
              </div>
              <span className="text-xs text-muted-foreground">{current + 1}/{questions.length}</span>
            </div>

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
            <p className="text-sm text-foreground">{score}/{questions.length} correct</p>
            <p className="text-xs text-muted-foreground">
              {pct >= 80 ? "Excellent! You're well prepared 🎉" : pct >= 50 ? "Good effort! Review weak areas 💪" : "Keep studying! Focus on weak topics 📚"}
            </p>
            <div className="flex gap-2">
              <button onClick={() => { setQuestions([]); setFinished(false); }} className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl neural-gradient neural-border hover:glow-primary transition-all">
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
